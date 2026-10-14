import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { normalizeVerdictDetails } from './court-verdict.mjs';

export const COURT_TABLE = 'cat_court_rooms';
export const COURT_ADVISORY_LOCK = 731904682;
export const COURT_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS ${COURT_TABLE} (
  id text PRIMARY KEY,
  room jsonb NOT NULL,
  active_attempt_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (jsonb_typeof(room) = 'object'),
  CHECK (room->>'id' = id)
);
CREATE INDEX IF NOT EXISTS cat_court_attempt_expiry_idx
  ON ${COURT_TABLE} (active_attempt_expires_at)
  WHERE active_attempt_expires_at IS NOT NULL;`;

export class StorageError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.status = status;
  }
}

const invalid = () => { throw new StorageError('INVALID_COURT_ARCHIVE', '案件存储格式不正确，请管理员检查归档。'); };
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const roomId = (value) => typeof value === 'string' && /^[a-f0-9]{12}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.length <= max;

function normalizeMetadata(input, expectedId = input?.id) {
  if (!object(input) || !roomId(input.id) || input.id !== expectedId || !text(input.title, 100) || !date(input.createdAt)) invalid();
  const room = structuredClone(input);
  if (room.revision === undefined) room.revision = 1;
  if (!Number.isSafeInteger(room.revision) || room.revision < 1 || !object(room.parties)) invalid();
  for (const role of ['a', 'b']) {
    const party = room.parties[role];
    if (!object(party) || !text(party.name, 30) || !(party.tokenHash === null || (typeof party.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(party.tokenHash)))) invalid();
  }
  return room;
}

/** Validate known fields while retaining optional and future-compatible fields. */
export function normalizeCourtRoom(input, expectedId = input?.id) {
  const room = normalizeMetadata(input, expectedId);
  if (!Array.isArray(room.rounds) || room.rounds.length === 0) invalid();
  const roundIds = new Set();
  for (const [index, round] of room.rounds.entries()) {
    if (!object(round) || !roomId(round.id) || roundIds.has(round.id) || round.index !== index + 1 || !['initial', 'appeal'].includes(round.kind) || !['collecting', 'judging', 'judged', 'error'].includes(round.status) || !date(round.createdAt) || !object(round.submissions)) invalid();
    roundIds.add(round.id);
    if (round.attemptId !== undefined && !text(round.attemptId, 128)) invalid();
    if (round.attemptOwner !== undefined && !text(round.attemptOwner, 128)) invalid();
    if (round.attemptExpiresAt !== undefined && round.attemptExpiresAt !== null && !date(round.attemptExpiresAt)) invalid();
    if (round.verdict !== null && (!object(round.verdict) || !text(round.verdict.text, 1000000) || !text(round.verdict.model, 200) || !date(round.verdict.createdAt))) invalid();
    if (round.verdict?.details !== undefined && round.verdict.details !== null) {
      try { normalizeVerdictDetails(round.verdict.details); } catch { invalid(); }
    }
    if (round.repair !== undefined && round.repair !== null) {
      const repair = round.repair;
      if (!object(repair) || !['together', 'boundaries_first'].includes(repair.mode) || !date(repair.createdAt) || !Array.isArray(repair.tasks) || repair.tasks.length > 3 || (repair.mode === 'together' && repair.tasks.length !== 3)) invalid();
      const details = round.verdict?.details;
      if (!details || repair.mode !== details.repairMode || repair.tasks.length !== details.repairTasks.length) invalid();
      const taskIds = new Set();
      for (const [taskIndex, task] of repair.tasks.entries()) {
        if (!object(task) || !roomId(task.id) || taskIds.has(task.id) || !text(task.title, 120) || !text(task.description, 800) || !object(task.confirmations)) invalid();
        if (task.title !== details.repairTasks[taskIndex].title || task.description !== details.repairTasks[taskIndex].description) invalid();
        taskIds.add(task.id);
        for (const role of ['a', 'b']) {
          if (task.confirmations[role] !== null && !date(task.confirmations[role])) invalid();
          if (repair.mode === 'boundaries_first' && task.confirmations[role] !== null) invalid();
        }
      }
    }
    if (round.error !== null && (!object(round.error) || !text(round.error.code, 100) || !text(round.error.message, 2000))) invalid();
    for (const role of ['a', 'b']) {
      const submission = round.submissions[role];
      if (submission === null) continue;
      if (!object(submission) || !text(submission.statement, 12000) || !date(submission.submittedAt) || !Array.isArray(submission.images) || submission.images.length > 4) invalid();
      for (const image of submission.images) {
        if (!object(image) || !roomId(image.id) || !text(image.name, 120) || typeof image.dataUrl !== 'string' || image.dataUrl.length > 6 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl)) invalid();
        if (image.size !== undefined && (!Number.isSafeInteger(image.size) || image.size < 1 || image.size > 4 * 1024 * 1024)) invalid();
      }
    }
  }
  return room;
}

function normalizeArchive(input) {
  if (!object(input) || input.version !== 1 || !object(input.rooms)) invalid();
  return { ...input, rooms: Object.fromEntries(Object.entries(input.rooms).map(([id, room]) => [id, normalizeCourtRoom(room, id)])) };
}

function expiry(room) {
  const round = room.rounds.at(-1);
  return round.status === 'judging' && date(round.attemptExpiresAt) ? round.attemptExpiresAt : null;
}

const unavailable = () => new StorageError('STORAGE_UNAVAILABLE', '案件存储暂时不可用，请稍后重试。');
const closedError = () => new StorageError('STORAGE_CLOSED', '案件服务正在重启，请稍后重试。');
function report(options) {
  try { options.onError?.(unavailable()); } catch { /* Error reporting cannot alter transaction state. */ }
}
function storageFailure(error, options) {
  if (error instanceof StorageError) return error;
  report(options);
  return unavailable();
}

/** The migration command and service share the same pool/TLS policy. */
export async function createCourtPool({ databaseUrl, pool } = {}) {
  if (pool) return pool;
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error('Invalid database URL');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const privateHost = !host.includes('.') || ['localhost', '127.0.0.1', '::1'].includes(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.internal');
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode === 'no-verify' || (sslmode === 'disable' && !privateHost) || (sslmode && !['disable', 'require', 'verify-ca', 'verify-full', 'prefer', 'allow'].includes(sslmode))) throw new Error('Unsafe TLS mode');
    const tls = sslmode ? sslmode !== 'disable' : !privateHost;
    // pg's URL parser can replace an explicit ssl object. Set TLS in one place.
    for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    const { Pool } = await import('pg');
    return new Pool({ connectionString: url.toString(), ssl: tls ? { rejectUnauthorized: true } : false, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  } catch {
    throw unavailable();
  }
}

async function atomicArchiveWrite(dataFile, candidate, options) {
  const temporary = `${dataFile}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let handle;
  try {
    await options.beforePersist?.(candidate);
    await mkdir(path.dirname(dataFile), { recursive: true, mode: 0o700 });
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(candidate), 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, dataFile);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw storageFailure(error, options);
  }
  // Rename is the commit point. A best-effort directory fsync must not turn a
  // completed commit into an advertised rollback on platforms that reject it.
  let directory;
  try { directory = await open(path.dirname(dataFile), 'r'); await directory.sync(); }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error.code)) report(options); }
  finally { await directory?.close().catch(() => {}); }
}

function checkSave(room, id, exists, alreadySaved, callbackOpen) {
  if (!callbackOpen || alreadySaved) throw new StorageError('INVALID_SAVE', '每次案件事务只能保存一次。', 500);
  if (!exists) throw new StorageError('ROOM_NOT_FOUND', '没有找到这个小法庭，请检查邀请链接。', 404);
  return normalizeCourtRoom(room, id);
}

async function createFileStore(options) {
  const dataFile = path.resolve(options.dataFile || path.join(process.cwd(), '.cat-court/rooms.json'));
  let archive;
  try { archive = normalizeArchive(JSON.parse(await readFile(dataFile, 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') archive = { version: 1, rooms: {} }; else throw storageFailure(error, options); }
  let queue = Promise.resolve();
  let closed = false;
  let closePromise;
  const serialize = (operation) => {
    if (closed) return Promise.reject(closedError());
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  return {
    kind: 'file', durable: false,
    readMetadata(id) {
      return serialize(() => {
        const committed = archive.rooms[id];
        if (!committed) return null;
        const { rounds, ...root } = committed;
        const round = rounds.at(-1);
        return { room: normalizeMetadata(root, id), expiredJudgment: round.status === 'judging' && (!date(round.attemptExpiresAt) || Date.parse(round.attemptExpiresAt) <= Date.now()) };
      });
    },
    withRoom(id, callback) {
      return serialize(async () => {
        const committed = archive.rooms[id];
        const room = committed ? normalizeCourtRoom(committed, id) : null;
        let saved;
        let callbackOpen = true;
        const save = async (candidate) => { saved = checkSave(candidate, id, Boolean(committed), Boolean(saved), callbackOpen); };
        let result;
        try { result = await callback(room, save, Date.now()); }
        finally { callbackOpen = false; }
        if (saved) {
          const candidate = { ...archive, rooms: { ...archive.rooms, [id]: saved } };
          await atomicArchiveWrite(dataFile, candidate, options);
          archive = candidate;
        }
        return result;
      });
    },
    createRoom(input, maxRooms = 1000) {
      return serialize(async () => {
        const room = normalizeCourtRoom(input);
        if (!Number.isInteger(maxRooms) || maxRooms < 1) throw new StorageError('INVALID_CAPACITY', '案件容量配置不正确。', 500);
        if (archive.rooms[room.id]) throw new StorageError('ROOM_ALREADY_EXISTS', '这个小法庭已存在，请重试。', 409);
        if (Object.keys(archive.rooms).length >= maxRooms) throw new StorageError('ROOM_CAPACITY', '小法庭暂时满座了，请稍后再来。');
        const candidate = { ...archive, rooms: { ...archive.rooms, [room.id]: room } };
        await atomicArchiveWrite(dataFile, candidate, options);
        archive = candidate;
        return structuredClone(room);
      });
    },
    listRecoverableRooms() { return serialize(() => Object.values(archive.rooms).filter((room) => room.rounds.at(-1).status === 'judging').map((room) => room.id)); },
    close() { if (!closePromise) { closed = true; closePromise = queue.then(() => {}); } return closePromise; },
  };
}

async function createPostgresStore(options) {
  const pool = await createCourtPool(options);
  const active = new Set();
  let closed = false;
  let closePromise;
  const onPoolError = () => report(options);
  pool.on?.('error', onPoolError);

  const transaction = async (operation) => {
    let client;
    let callbackError;
    let discardClient = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await operation(client, (error) => { callbackError = error; });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK'); }
        catch { discardClient = true; }
      }
      throw callbackError || storageFailure(error, options);
    } finally { client?.release(discardClient); }
  };
  const track = (operation) => {
    if (closed) return Promise.reject(closedError());
    const promise = Promise.resolve().then(operation);
    active.add(promise);
    void promise.then(() => active.delete(promise), () => active.delete(promise));
    return promise;
  };
  try {
    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [COURT_ADVISORY_LOCK]);
      await client.query(COURT_SCHEMA_SQL);
      const malformed = await client.query(`SELECT id FROM ${COURT_TABLE} WHERE jsonb_typeof(room) <> 'object' OR room->>'id' IS DISTINCT FROM id OR jsonb_typeof(room->'parties') IS DISTINCT FROM 'object' OR jsonb_typeof(room->'rounds') IS DISTINCT FROM 'array' LIMIT 1`);
      if (malformed.rows.length) invalid();
    });
  } catch (error) {
    pool.removeListener?.('error', onPoolError);
    await pool.end().catch(() => {});
    throw error;
  }
  return {
    kind: 'postgres', durable: true,
    readMetadata(id) {
      return track(async () => {
        try {
          const found = await pool.query(`SELECT room - 'rounds' AS metadata, ((room->'rounds'->-1->>'status') = 'judging' AND (active_attempt_expires_at IS NULL OR active_attempt_expires_at <= clock_timestamp())) AS expired_judgment FROM ${COURT_TABLE} WHERE id = $1`, [id]);
          if (!found.rows.length) return null;
          return { room: normalizeMetadata(found.rows[0].metadata, id), expiredJudgment: Boolean(found.rows[0].expired_judgment) };
        } catch (error) { throw storageFailure(error, options); }
      });
    },
    withRoom(id, callback) {
      return track(() => transaction(async (client, setCallbackError) => {
        const found = await client.query(`SELECT room FROM ${COURT_TABLE} WHERE id = $1 FOR UPDATE`, [id]);
        const room = found.rows[0] ? normalizeCourtRoom(found.rows[0].room, id) : null;
        const time = await client.query('SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms');
        const now = Number(time.rows[0]?.now_ms);
        if (!Number.isFinite(now) || now < 1) throw unavailable();
        let saved = false;
        let callbackOpen = true;
        let pendingSave;
        const save = (candidate) => {
          let normalized;
          try { normalized = checkSave(candidate, id, Boolean(room), saved, callbackOpen); }
          catch (error) { return Promise.reject(error); }
          saved = true;
          pendingSave = (async () => {
            try {
              const updated = await client.query(`UPDATE ${COURT_TABLE} SET room = $2::jsonb, active_attempt_expires_at = $3::timestamptz, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id, JSON.stringify(normalized), expiry(normalized)]);
              if (updated.rowCount !== 1) throw new StorageError('ROOM_NOT_FOUND', '没有找到这个小法庭，请检查邀请链接。', 404);
            } catch (error) { throw storageFailure(error, options); }
          })();
          // Keep a caller's abandoned save promise from producing an unhandled
          // rejection; its failure still reaches the transaction before COMMIT.
          void pendingSave.catch(() => {});
          return pendingSave;
        };
        let result;
        try { result = await callback(room, save, now); }
        catch (error) { setCallbackError(error); throw error; }
        finally { callbackOpen = false; }
        await pendingSave;
        return result;
      }));
    },
    createRoom(input, maxRooms = 1000) {
      return track(() => transaction(async (client) => {
        const room = normalizeCourtRoom(input);
        if (!Number.isInteger(maxRooms) || maxRooms < 1) throw new StorageError('INVALID_CAPACITY', '案件容量配置不正确。', 500);
        await client.query('SELECT pg_advisory_xact_lock($1)', [COURT_ADVISORY_LOCK]);
        const duplicate = await client.query(`SELECT id FROM ${COURT_TABLE} WHERE id = $1`, [room.id]);
        if (duplicate.rows.length) throw new StorageError('ROOM_ALREADY_EXISTS', '这个小法庭已存在，请重试。', 409);
        const count = await client.query(`SELECT count(*)::int AS count FROM ${COURT_TABLE}`);
        if (Number(count.rows[0].count) >= maxRooms) throw new StorageError('ROOM_CAPACITY', '小法庭暂时满座了，请稍后再来。');
        await client.query(`INSERT INTO ${COURT_TABLE} (id, room, active_attempt_expires_at, created_at, updated_at) VALUES ($1, $2::jsonb, $3::timestamptz, $4::timestamptz, CURRENT_TIMESTAMP)`, [room.id, JSON.stringify(room), expiry(room), room.createdAt]);
        return structuredClone(room);
      }));
    },
    listRecoverableRooms() {
      return track(async () => {
        try {
          const found = await pool.query(`SELECT id FROM ${COURT_TABLE} WHERE (room->'rounds'->-1->>'status') = 'judging' AND (active_attempt_expires_at IS NULL OR active_attempt_expires_at <= CURRENT_TIMESTAMP)`);
          return found.rows.map((row) => row.id);
        } catch (error) { throw storageFailure(error, options); }
      });
    },
    close() {
      if (!closePromise) {
        closed = true;
        closePromise = (async () => {
          await Promise.allSettled([...active]);
          pool.removeListener?.('error', onPoolError);
          try { await pool.end(); } catch (error) { throw storageFailure(error, options); }
        })();
      }
      return closePromise;
    },
  };
}

/** A configured database fails closed; it never silently switches to a file. */
export async function createCourtStore(options = {}) {
  const databaseUrl = options.databaseUrl ?? (process.env.COURT_DATABASE_URL || process.env.DATABASE_URL || '');
  return databaseUrl || options.pool ? createPostgresStore({ ...options, databaseUrl }) : createFileStore(options);
}
