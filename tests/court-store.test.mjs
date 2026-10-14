import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COURT_ADVISORY_LOCK, createCourtStore, StorageError } from '../server/court-store.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYKsAAAAASUVORK5CYII=';
const timestamp = '2026-10-14T10:00:00.000Z';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function makeRoom(id = 'aabbccddeeff') {
  return { id, title: '迟到的小争执', createdAt: timestamp, revision: 1,
    parties: { a: { name: '小鱼', tokenHash: null }, b: { name: '团子', tokenHash: null } },
    rounds: [{ id: '111111111111', index: 1, kind: 'initial', status: 'collecting', createdAt: timestamp, submissions: { a: null, b: null }, verdict: null, error: null }],
  };
}

async function fileFixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-store-'));
  const dataFile = path.join(directory, 'rooms.json');
  const store = await createCourtStore({ dataFile, databaseUrl: '', ...options });
  t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
  return { store, dataFile, directory };
}

// SQL fixture for adapter boundaries. Real cross-process locking is covered by
// the opt-in database integration suite, which must be run separately.
class FakePool {
  rooms = new Map();
  queries = [];
  now = Date.parse(timestamp);
  ended = false;
  failCommit = false;
  commitGate = null;
  commitEntered = null;
  on() {}
  removeListener() {}
  async end() { this.ended = true; }
  async query(sql, args = []) { return this.evaluate(sql, args, null); }
  async connect() {
    const pending = new Map();
    return {
      query: (sql, args = []) => this.evaluate(sql, args, pending),
      release: () => {},
    };
  }
  async evaluate(sql, args, pending) {
    this.queries.push({ sql, args });
    if (sql === 'BEGIN' || sql.startsWith('CREATE TABLE') || sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
    if (sql === 'ROLLBACK') { pending.clear(); return { rows: [], rowCount: 0 }; }
    if (sql === 'COMMIT') {
      this.commitEntered?.resolve();
      if (this.commitGate) await this.commitGate.promise;
      if (this.failCommit) throw new Error('connection failed: postgres://admin:secret@example.invalid/cases');
      for (const [id, room] of pending) this.rooms.set(id, room);
      pending.clear();
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('jsonb_typeof(room)')) return { rows: [], rowCount: 0 };
    if (sql.includes('AS now_ms')) return { rows: [{ now_ms: String(this.now) }], rowCount: 1 };
    if (sql.startsWith('SELECT room FROM')) {
      const room = this.rooms.get(args[0]);
      return { rows: room ? [{ room: structuredClone(room) }] : [], rowCount: room ? 1 : 0 };
    }
    if (sql.startsWith("SELECT room - 'rounds'")) {
      const room = this.rooms.get(args[0]);
      if (!room) return { rows: [], rowCount: 0 };
      const { rounds, ...metadata } = structuredClone(room);
      const round = rounds.at(-1);
      return { rows: [{ metadata, expired_judgment: round.status === 'judging' && (!round.attemptExpiresAt || Date.parse(round.attemptExpiresAt) <= this.now) }], rowCount: 1 };
    }
    if (sql.startsWith('SELECT count(')) return { rows: [{ count: this.rooms.size }], rowCount: 1 };
    if (sql.startsWith('SELECT id') && sql.includes('WHERE id = $1')) return { rows: this.rooms.has(args[0]) ? [{ id: args[0] }] : [], rowCount: this.rooms.has(args[0]) ? 1 : 0 };
    if (sql.startsWith('SELECT id') && sql.includes('active_attempt_expires_at')) {
      return { rows: [...this.rooms.values()].filter((room) => {
        const round = room.rounds.at(-1);
        return round.status === 'judging' && (!round.attemptExpiresAt || Date.parse(round.attemptExpiresAt) <= this.now);
      }).map((room) => ({ id: room.id })) };
    }
    if (sql.startsWith('INSERT INTO')) { pending.set(args[0], JSON.parse(args[1])); return { rows: [], rowCount: 1 }; }
    if (sql.startsWith('UPDATE ')) {
      if (!this.rooms.has(args[0])) return { rows: [], rowCount: 0 };
      pending.set(args[0], JSON.parse(args[1]));
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected fake SQL: ${sql}`);
  }
}

async function postgresFixture(t) {
  const pool = new FakePool();
  const store = await createCourtStore({ databaseUrl: 'postgres://unused.invalid/cases', pool });
  t.after(() => store.close());
  return { store, pool };
}

test('file adapter preserves whole cases across a new store and keeps read callbacks isolated', async (t) => {
  const { store, dataFile } = await fileFixture(t);
  const room = makeRoom();
  room.customField = { preserved: true };
  room.parties.a.tokenHash = 'a'.repeat(64);
  room.rounds[0].submissions.a = { statement: '已提交证词', images: [{ id: '222222222222', name: '聊天记录.png', dataUrl: PNG }], submittedAt: timestamp };
  await store.createRoom(room, 10);
  await store.withRoom(room.id, (draft) => { draft.title = '未保存的修改'; });
  assert.equal(await store.withRoom(room.id, (draft) => draft.title), room.title);
  await store.close();
  const restarted = await createCourtStore({ dataFile, databaseUrl: '' });
  t.after(() => restarted.close());
  assert.equal(restarted.kind, 'file');
  assert.equal(restarted.durable, false);
  assert.deepEqual(await restarted.withRoom(room.id, (draft) => draft), room);
  assert.equal(await restarted.withRoom('ffffffffffff', (draft) => draft), null);
});

test('file save stages only once and rolls back when its callback throws', async (t) => {
  const { store, dataFile } = await fileFixture(t);
  const room = makeRoom();
  await store.createRoom(room, 10);
  const original = await readFile(dataFile, 'utf8');
  await assert.rejects(store.withRoom(room.id, async (draft, save) => {
    draft.title = '不应写入'; draft.revision++;
    await save(draft);
    throw new Error('callback aborted');
  }), /callback aborted/);
  assert.equal(await readFile(dataFile, 'utf8'), original);
  await assert.rejects(store.withRoom(room.id, async (draft, save) => {
    await save(draft);
    await save(draft);
  }), (error) => error instanceof StorageError && error.code === 'INVALID_SAVE');
  assert.equal(await store.withRoom(room.id, (draft) => draft.revision), 1);
});

test('file metadata waits for the archive commit and never includes evidence', async (t) => {
  const gate = deferred();
  const entered = deferred();
  let shouldWait = false;
  const { store, dataFile } = await fileFixture(t, { beforePersist: async () => { if (shouldWait) { entered.resolve(); await gate.promise; } } });
  const room = makeRoom();
  room.rounds[0].submissions.a = { statement: '私密陈词', submittedAt: timestamp, images: [{ id: '222222222222', name: '证据.png', dataUrl: PNG }] };
  await store.createRoom(room);
  shouldWait = true;
  const update = store.withRoom(room.id, async (draft, save, now) => { assert.equal(typeof now, 'number'); draft.revision++; await save(draft); return draft.revision; });
  await entered.promise;
  const metadata = store.readMetadata(room.id);
  try { assert.equal(await Promise.race([metadata.then(() => 'early'), pause(20).then(() => 'waiting')]), 'waiting'); }
  finally { gate.resolve(); }
  assert.equal(await update, 2);
  const result = await metadata;
  assert.equal(result.room.revision, 2);
  assert.equal('rounds' in result.room, false);
  assert.equal(JSON.stringify(result).includes(PNG), false);
  assert.equal(JSON.stringify(result).includes('私密陈词'), false);
  assert.equal(JSON.parse(await readFile(dataFile, 'utf8')).rooms[room.id].revision, 2);
});

test('file persistence failure keeps the committed seat free and its error omits local paths', async (t) => {
  const { store, directory } = await fileFixture(t);
  const room = makeRoom();
  await store.createRoom(room);
  const backup = `${directory}-backup`;
  await rename(directory, backup);
  await writeFile(directory, 'not a directory');
  try {
    await assert.rejects(store.withRoom(room.id, async (draft, save) => { draft.parties.a.tokenHash = 'a'.repeat(64); draft.revision++; await save(draft); }), (error) => error.status === 503 && !error.message.includes(directory));
    assert.equal(await store.withRoom(room.id, (draft) => draft.parties.a.tokenHash), null);
  } finally {
    await rm(directory, { force: true });
    await rename(backup, directory);
  }
  await store.withRoom(room.id, async (draft, save) => { draft.parties.a.tokenHash = 'a'.repeat(64); draft.revision++; await save(draft); });
  assert.equal(await store.withRoom(room.id, (draft) => draft.revision), 2);
});

test('legacy revision fields normalize without dropping data; malformed archives fail closed', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-legacy-'));
  const dataFile = path.join(directory, 'rooms.json');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const room = makeRoom(); delete room.revision;
  await writeFile(dataFile, JSON.stringify({ version: 1, rooms: { [room.id]: room } }));
  const store = await createCourtStore({ dataFile, databaseUrl: '' });
  await store.withRoom(room.id, (draft) => { assert.equal(draft.revision, 1); });
  await store.close();
  room.rounds[0].submissions.a = { statement: 123, images: [], submittedAt: timestamp };
  await writeFile(dataFile, JSON.stringify({ version: 1, rooms: { [room.id]: room } }));
  await assert.rejects(createCourtStore({ dataFile, databaseUrl: '' }), (error) => error.code === 'INVALID_COURT_ARCHIVE');
});

test('Postgres locks the room, uses database time, and returns only after COMMIT succeeds', async (t) => {
  const { store, pool } = await postgresFixture(t);
  const room = makeRoom();
  await store.createRoom(room, 10);
  pool.commitGate = deferred(); pool.commitEntered = deferred();
  const update = store.withRoom(room.id, async (draft, save, now) => { assert.equal(now, pool.now); draft.title = '事务保存'; draft.revision++; await save(draft); return draft.title; });
  await pool.commitEntered.promise;
  assert.equal(pool.rooms.get(room.id).title, room.title);
  try { assert.equal(await Promise.race([update.then(() => 'early'), pause(20).then(() => 'waiting')]), 'waiting'); }
  finally { pool.commitGate.resolve(); }
  assert.equal(await update, '事务保存');
  assert.equal(pool.rooms.get(room.id).title, '事务保存');
  assert.equal(pool.queries.some(({ sql }) => sql.includes('FOR UPDATE')), true);
  assert.equal(pool.queries.some(({ sql }) => sql.includes('clock_timestamp()')), true);
  assert.equal(pool.queries.some(({ sql, args }) => sql.includes('pg_advisory_xact_lock') && args[0] === COURT_ADVISORY_LOCK), true);
  assert.equal(store.durable, true);
});

test('Postgres commit failure and callback failure roll back without exposing database credentials', async (t) => {
  const { store, pool } = await postgresFixture(t);
  const room = makeRoom();
  await store.createRoom(room);
  pool.failCommit = true;
  await assert.rejects(store.withRoom(room.id, async (draft, save) => { draft.parties.a.tokenHash = 'a'.repeat(64); draft.revision++; await save(draft); }), (error) => error.status === 503 && !JSON.stringify(error).includes('secret') && !error.message.includes('postgres://'));
  pool.failCommit = false;
  assert.equal(await store.withRoom(room.id, (draft) => draft.parties.a.tokenHash), null);
  await assert.rejects(store.withRoom(room.id, async (draft, save) => { draft.title = '不保存'; await save(draft); throw new Error('abort callback'); }), /abort callback/);
  assert.equal(pool.rooms.get(room.id).title, room.title);
  assert.equal(pool.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('Postgres metadata SQL excludes round history and recovery preserves unexpired work', async (t) => {
  const { store, pool } = await postgresFixture(t);
  for (const [id, lease] of [['aaaaaaaaaaaa', '2026-10-14T11:00:00.000Z'], ['bbbbbbbbbbbb', '2026-10-14T09:00:00.000Z'], ['cccccccccccc', undefined]]) {
    const room = makeRoom(id); room.rounds[0].status = 'judging'; room.rounds[0].attemptId = '1'.repeat(24);
    if (lease) room.rounds[0].attemptExpiresAt = lease;
    room.rounds[0].submissions.a = { statement: '私密陈词', submittedAt: timestamp, images: [{ id: '222222222222', name: '证据.png', dataUrl: PNG }] };
    await store.createRoom(room);
  }
  const metadata = await store.readMetadata('aaaaaaaaaaaa');
  assert.equal(metadata.expiredJudgment, false);
  assert.equal('rounds' in metadata.room, false);
  assert.equal(JSON.stringify(metadata).includes(PNG), false);
  assert.equal(pool.queries.at(-1).sql.includes("room - 'rounds'"), true);
  assert.deepEqual((await store.listRecoverableRooms()).sort(), ['bbbbbbbbbbbb', 'cccccccccccc']);
  assert.equal((await store.readMetadata('bbbbbbbbbbbb')).expiredJudgment, true);
  assert.equal(await store.readMetadata('dddddddddddd'), null);
});

test('database setup fails closed and does not create a local fallback archive', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-no-fallback-'));
  const dataFile = path.join(directory, 'rooms.json');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pool = { connect: async () => { throw new Error('postgres://admin:secret@example.invalid/private'); }, end: async () => {} };
  await assert.rejects(createCourtStore({ dataFile, databaseUrl: 'postgres://unused.invalid/cases', pool }), (error) => error.status === 503 && !error.message.includes('secret'));
  await assert.rejects(readFile(dataFile), (error) => error.code === 'ENOENT');
});

test('close drains an active Postgres transaction before ending the pool', async (t) => {
  const { store, pool } = await postgresFixture(t);
  const room = makeRoom(); await store.createRoom(room);
  const gate = deferred(); const entered = deferred();
  const update = store.withRoom(room.id, async (draft, save) => { entered.resolve(); await gate.promise; draft.revision++; await save(draft); });
  await entered.promise;
  const closing = store.close();
  assert.equal(pool.ended, false);
  await assert.rejects(store.readMetadata(room.id), (error) => error.code === 'STORAGE_CLOSED');
  gate.resolve(); await update; await closing;
  assert.equal(pool.ended, true);
  assert.equal(store.close(), closing, 'closing is idempotent');
});
