import { createHash, randomBytes } from 'node:crypto';
import { open, readFile, mkdir, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCourtPool, normalizeCourtRoom, COURT_ADVISORY_LOCK, COURT_SCHEMA_SQL } from '../server/court-store.mjs';
const MESSAGES = {
  ARGUMENTS: '请使用 inspect、import 或 export，并通过 --file 指定本地存档路径。数据库地址只能使用环境变量。',
  INVALID_ARCHIVE: '存档格式或案件内容不完整，未导入任何案件。',
  READ_FAILED: '无法读取本地存档，请检查文件存在且有读取权限。',
  DATABASE_REQUIRED: '请在服务端设置 COURT_DATABASE_URL 或 DATABASE_URL；不要把数据库地址放进命令行或聊天。',
  DATABASE_FAILED: '数据库操作失败。请检查连接配置、权限和服务状态；本次未报告成功。',
  ARCHIVE_CONFLICT: '目标数据库已存在内容不同的同编号案件；整批导入已回滚，原案件未被覆盖。',
  DESTINATION_EXISTS: '导出目标已存在，未覆盖；请选择新的备份文件名。',
  WRITE_FAILED: '无法安全创建本地备份。请检查目录权限和磁盘空间，再选择新的文件名重试。',
};

export class ArchiveError extends Error {
  constructor(code) {
    super(MESSAGES[code] || MESSAGES.DATABASE_FAILED);
    this.name = 'ArchiveError';
    this.code = code;
  }
}

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw new ArchiveError('INVALID_ARCHIVE'); };

/** JSONB may change object-key order; hashes compare values without changing evidence. */
export function canonicalJson(value) {
  const visited = new WeakSet();
  const serialize = (item) => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (!record(item) && !Array.isArray(item)) invalid();
    if (visited.has(item)) invalid();
    visited.add(item);
    const result = Array.isArray(item)
      ? `[${item.map(serialize).join(',')}]`
      : `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${serialize(item[key])}`).join(',')}}`;
    visited.delete(item);
    return result;
  };
  return serialize(value);
}

export const archiveDigest = (archive) => createHash('sha256').update(canonicalJson(archive)).digest('hex');

/** Validate the legacy structure, preserving every private room field unchanged. */
export function inspectArchive(archive) {
  if (!record(archive) || archive.version !== 1 || !record(archive.rooms)) invalid();
  // Unknown archive-level fields cannot be represented by the room table; refuse to drop them.
  if (Object.keys(archive).some((key) => !['version', 'rooms'].includes(key))) invalid();
  const summary = { rooms: 0, rounds: 0, submissions: 0, images: 0, imageBytes: 0, verdicts: 0 };
  for (const [roomId, room] of Object.entries(archive.rooms)) {
    // Validate against the running service, but discard its normalized clone so
    // legacy optional fields remain byte-for-byte comparable after migration.
    try { normalizeCourtRoom(room, roomId); } catch { invalid(); }
    if (!/^[a-f0-9]{12}$/.test(roomId) || !record(room) || room.id !== roomId || !Array.isArray(room.rounds) || !room.rounds.length || !record(room.parties)) invalid();
    for (const role of ['a', 'b']) {
      const member = room.parties[role];
      if (!record(member) || typeof member.name !== 'string') invalid();
      if (member.tokenHash !== null && member.tokenHash !== undefined && (typeof member.tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(member.tokenHash))) invalid();
    }
    summary.rooms += 1;
    for (const round of room.rounds) {
      if (!record(round) || !record(round.submissions) || typeof round.id !== 'string' || !['collecting', 'judging', 'judged', 'error'].includes(round.status)) invalid();
      summary.rounds += 1;
      for (const role of ['a', 'b']) {
        const submission = round.submissions[role];
        if (submission === null || submission === undefined) continue;
        if (!record(submission) || typeof submission.statement !== 'string' || !Array.isArray(submission.images)) invalid();
        summary.submissions += 1;
        for (const image of submission.images) {
          if (!record(image) || typeof image.dataUrl !== 'string') invalid();
          const match = /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
          if (!match || match[1].length % 4 !== 0) invalid();
          summary.images += 1;
          summary.imageBytes += Buffer.byteLength(match[1], 'base64');
        }
      }
      if (round.verdict !== null && round.verdict !== undefined) {
        if (!record(round.verdict) || typeof round.verdict.text !== 'string') invalid();
        summary.verdicts += 1;
      }
    }
  }
  return { ...summary, sha256: archiveDigest(archive) };
}

export async function readArchiveFile(file) {
  let source;
  try { source = await readFile(file, 'utf8'); } catch { throw new ArchiveError('READ_FAILED'); }
  let archive;
  try { archive = JSON.parse(source); } catch { throw new ArchiveError('INVALID_ARCHIVE'); }
  return { archive, summary: inspectArchive(archive) };
}

function activeAttemptExpiry(room) {
  const round = room.rounds.at(-1);
  if (round?.status !== 'judging' || typeof round.attemptExpiresAt !== 'string') return null;
  const expiry = new Date(round.attemptExpiresAt);
  return Number.isNaN(expiry.getTime()) ? null : expiry.toISOString();
}

/** The whole archive commits together; an existing different room rolls everything back. */
export async function importArchive(pool, archive) {
  const summary = inspectArchive(archive);
  let client;
  let committed = false;
  let discardClient = false;
  let inserted = 0;
  let skipped = 0;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [COURT_ADVISORY_LOCK]);
    await client.query(COURT_SCHEMA_SQL);
    for (const roomId of Object.keys(archive.rooms).sort()) {
      const room = archive.rooms[roomId];
      const current = await client.query('SELECT room FROM cat_court_rooms WHERE id = $1 FOR UPDATE', [roomId]);
      if (current.rows.length) {
        if (archiveDigest(current.rows[0].room) !== archiveDigest(room)) throw new ArchiveError('ARCHIVE_CONFLICT');
        skipped += 1;
        continue;
      }
      // All service create paths share the advisory lock; the primary key is a second guard.
      await client.query('INSERT INTO cat_court_rooms (id, room, active_attempt_expires_at) VALUES ($1, $2::jsonb, $3)', [roomId, canonicalJson(room), activeAttemptExpiry(room)]);
      inserted += 1;
    }
    await client.query('COMMIT');
    committed = true;
    return { ...summary, inserted, skipped };
  } catch (error) {
    if (client && !committed) {
      try { await client.query('ROLLBACK'); } catch { discardClient = true; }
    }
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError('DATABASE_FAILED');
  } finally {
    client?.release(discardClient);
  }
}

/** One repeatable-read snapshot covers every case, including all evidence and appeals. */
export async function exportArchive(pool) {
  let client;
  let committed = false;
  let discardClient = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await client.query('SELECT id, room FROM cat_court_rooms ORDER BY id');
    const rooms = Object.create(null);
    for (const row of result.rows) {
      if (Object.hasOwn(rooms, row.id)) invalid();
      rooms[row.id] = row.room;
    }
    const archive = { version: 1, rooms };
    const summary = inspectArchive(archive);
    await client.query('COMMIT');
    committed = true;
    return { archive, summary };
  } catch (error) {
    if (client && !committed) {
      try { await client.query('ROLLBACK'); } catch { discardClient = true; }
    }
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError('DATABASE_FAILED');
  } finally {
    client?.release(discardClient);
  }
}

/** Hard-link publication is atomic and refuses even a symlink at the target path. */
export async function writeArchiveFile(file, archive) {
  const summary = inspectArchive(archive);
  const destination = path.resolve(file);
  const directory = path.dirname(destination);
  const temporary = path.join(directory, `.${path.basename(destination)}.${randomBytes(12).toString('hex')}.tmp`);
  let handle;
  let temporaryCreated = false;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    handle = await open(temporary, 'wx', 0o600);
    temporaryCreated = true;
    await handle.writeFile(`${canonicalJson(archive)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await link(temporary, destination);
    const directoryHandle = await open(directory, 'r');
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    return summary;
  } catch (error) {
    throw new ArchiveError(error?.code === 'EEXIST' ? 'DESTINATION_EXISTS' : 'WRITE_FAILED');
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (temporaryCreated) await unlink(temporary).catch(() => {});
  }
}

export function parseArguments(args) {
  if (args.length !== 3 || !['inspect', 'import', 'export'].includes(args[0]) || args[1] !== '--file' || !args[2] || args[2].startsWith('--')) throw new ArchiveError('ARGUMENTS');
  return { command: args[0], file: args[2] };
}

async function databasePool() {
  const connectionString = process.env.COURT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new ArchiveError('DATABASE_REQUIRED');
  let url;
  try { url = new URL(connectionString); } catch { throw new ArchiveError('DATABASE_REQUIRED'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new ArchiveError('DATABASE_REQUIRED');
  try {
    return await createCourtPool({ databaseUrl: connectionString });
  } catch { throw new ArchiveError('DATABASE_FAILED'); }
}

export async function runArchiveCommand(args, output = (summary) => process.stdout.write(`${JSON.stringify(summary)}\n`)) {
  const { command, file } = parseArguments(args);
  if (command === 'inspect') {
    const { summary } = await readArchiveFile(file);
    output({ command, ...summary });
    return;
  }
  let pool;
  try {
    // Read and validate the complete local file before opening any database connection.
    const input = command === 'import' ? await readArchiveFile(file) : null;
    pool = await databasePool();
    if (command === 'import') output({ command, ...await importArchive(pool, input.archive) });
    else {
      const { archive } = await exportArchive(pool);
      output({ command, ...await writeArchiveFile(file, archive) });
    }
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError('DATABASE_FAILED');
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Match the app's local environment loading; never print environment variables.
  if (['import', 'export'].includes(process.argv[2])) {
    try { process.loadEnvFile?.(); } catch { /* Environment may be supplied by the host. */ }
  }
  runArchiveCommand(process.argv.slice(2)).catch((error) => {
    const safe = error instanceof ArchiveError ? error : new ArchiveError('DATABASE_FAILED');
    process.stderr.write(`${safe.code}: ${safe.message}\n`);
    process.exitCode = 1;
  });
}
