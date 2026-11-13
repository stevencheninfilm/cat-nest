import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApplicationServer } from '../server/bootstrap.mjs';
import { createCourtServer } from '../server/court.mjs';
import { CourtDatabaseUnavailableError, StorageError } from '../server/court-store.mjs';
import { initialState } from '../src/state.js';

const origin = 'https://stevencheninfilm.com';
const roomId = 'a'.repeat(32);
const unavailableStatus = { available: false, reason: 'storage_unavailable', storage: 'postgres' };
const databaseUrl = 'postgres://unused.invalid/cases';
const unavailable = () => Object.assign(new Error('postgres://synthetic-user:synthetic-password@private.invalid/cases'), { code: 'ECONNREFUSED' });

function petStore() {
  const state = initialState(1000);
  let revision = 3;
  return {
    configured: true,
    writes: 0,
    async getRoom(id) { assert.equal(id, roomId); return { roomId, state: structuredClone(state), revision }; },
    async applyAction(id, input) {
      assert.equal(id, roomId);
      this.writes += 1;
      revision += 1;
      return { roomId, state: structuredClone(state), revision, event: { operationId: input.operationId, action: input.action, actor: { id: input.clientId, name: input.name } } };
    },
  };
}

// Only fake SQL reaches this adapter: tests never read real credentials or call
// PostgreSQL/GitHub. A shared map models the same durable DB after a restart.
class Pool {
  constructor({ connectError, recoveryError, rooms = new Map() } = {}) {
    this.connectError = connectError;
    this.recoveryError = recoveryError;
    this.rooms = rooms;
    this.queries = [];
    this.ends = 0;
    this.listenerAdds = [];
    this.listenerRemovals = [];
    this.errorListeners = new Set();
  }
  on(event, listener) {
    this.listenerAdds.push({ event, listener });
    if (event === 'error') this.errorListeners.add(listener);
  }
  removeListener(event, listener) {
    this.listenerRemovals.push({ event, listener });
    if (event === 'error') this.errorListeners.delete(listener);
  }
  async end() { this.ends += 1; }
  async connect() {
    if (this.connectError) throw this.connectError;
    return { query: (sql, args = []) => this.query(sql, args), release() {} };
  }
  async query(sql, args = []) {
    this.queries.push(sql);
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('CREATE TABLE') || sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
    if (sql.includes('jsonb_typeof(room)')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('SELECT id') && sql.includes('active_attempt_expires_at')) {
      if (this.recoveryError) throw this.recoveryError;
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith('SELECT id') && sql.includes('WHERE id = $1')) return { rows: this.rooms.has(args[0]) ? [{ id: args[0] }] : [] };
    if (sql.startsWith('SELECT count(')) return { rows: [{ count: this.rooms.size }] };
    if (sql.startsWith('INSERT INTO')) { this.rooms.set(args[0], JSON.parse(args[1])); return { rows: [], rowCount: 1 }; }
    if (sql.startsWith('SELECT room FROM')) return { rows: this.rooms.has(args[0]) ? [{ room: structuredClone(this.rooms.get(args[0])) }] : [] };
    if (sql.includes('AS now_ms')) return { rows: [{ now_ms: String(Date.now()) }] };
    throw new TypeError(`Unexpected fake SQL: ${sql}`);
  }
}

function assertPoolClosed(pool) {
  assert.equal(pool.ends, 1, 'the pool must close exactly once');
  assert.equal(pool.listenerAdds.length, 1);
  assert.equal(pool.listenerAdds[0].event, 'error');
  assert.deepEqual(pool.listenerRemovals, pool.listenerAdds, 'the registered error listener must be removed');
  assert.equal(pool.errorListeners.size, 0);
}

async function fixture(t, { pool = new Pool({ connectError: unavailable() }), store = petStore(), ...courtOptions } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-server-isolation-'));
  const dataFile = path.join(directory, 'must-not-create-cases.json');
  await writeFile(path.join(directory, 'version.json'), JSON.stringify({ release: 'isolated-test-release' }));
  let server;
  const stop = async () => {
    if (!server) return;
    const current = server;
    server = null;
    current.closePetHandler();
    if (current.listening) {
      const closed = once(current, 'close');
      current.close();
      current.closeAllConnections();
      await closed;
    }
    await current.closeCourtStore();
  };
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  const start = async (extra = {}) => {
    server = await createApplicationServer({
      petOptions: { store, corsOrigin: origin, heartbeatMs: 60_000, pollMs: 60_000 },
      courtOptions: { databaseUrl, pool, dataFile, distDir: directory, allowedOrigins: origin, apiKey: '', requireDurableStorage: true, ...courtOptions, ...extra },
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  };
  const base = await start();
  return { server, base, store, pool, dataFile, stop, start };
}

const post = (base, endpoint, input, headers = {}) => fetch(`${base}${endpoint}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input),
});

test('a failed court PostgreSQL startup leaves pet reads/saves and static version available', async t => {
  const f = await fixture(t);
  assert.deepEqual(f.server.courtStorageStatus(), unavailableStatus);
  const health = await fetch(`${f.base}/api/health`, { headers: { Origin: origin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(await health.json(), { ok: true, configured: true, storage: 'github', court: unavailableStatus, degraded: true });
  const read = await fetch(`${f.base}/api/rooms/${roomId}`);
  assert.equal(read.status, 200);
  assert.equal((await read.json()).revision, 3);
  const saved = await post(f.base, `/api/rooms/${roomId}/actions`, { operationId: 'pet-during-court-outage', clientId: 'test-caregiver', name: '小鱼', action: { type: 'pet' } });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 4);
  assert.equal(f.store.writes, 1);
  const version = await fetch(`${f.base}/version.json`);
  assert.equal(version.status, 200);
  assert.deepEqual(await version.json(), { release: 'isolated-test-release' });
  await assert.rejects(readFile(f.dataFile), { code: 'ENOENT' });
  assertPoolClosed(f.pool);
  assert.deepEqual(f.pool.queries, []);
});

test('unavailable court rejects every court route and create without leaking database errors', async t => {
  const { base, pool, dataFile } = await fixture(t);
  for (const endpoint of ['/api/court', '/api/court/', '/api/court/config', '/api/court/rooms', '/api/court/rooms/aabbccddeeff', '/api/court/unknown']) {
    const response = await fetch(`${base}${endpoint}`, { headers: { Origin: origin } });
    assert.equal(response.status, 503, endpoint);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, 'COURT_STORAGE_UNAVAILABLE');
    assert.doesNotMatch(text, /synthetic-user|synthetic-password|private\.invalid|postgres:\/\//);
  }
  const response = await post(base, '/api/court/rooms', { title: '不得新建的案件' }, { Origin: origin });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'COURT_STORAGE_UNAVAILABLE');
  assert.equal(pool.rooms.size, 0);
  await assert.rejects(readFile(dataFile), { code: 'ENOENT' });
});

test('court outage preserves exact CORS preflight and denies other origins', async t => {
  const { base } = await fixture(t);
  const preflight = await fetch(`${base}/api/court/rooms`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization, Content-Type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  for (const method of ['GET', 'OPTIONS']) {
    const denied = await fetch(`${base}/api/court/config`, { method, headers: { Origin: 'https://untrusted.invalid' } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
});

test('a database disconnection during court recovery also isolates only the court', async t => {
  const pool = new Pool({ recoveryError: unavailable() });
  const { base, server } = await fixture(t, { pool });
  assert.deepEqual(server.courtStorageStatus(), unavailableStatus);
  assert.equal((await fetch(`${base}/api/rooms/${roomId}`)).status, 200);
  assert.equal((await fetch(`${base}/api/court/config`)).status, 503);
  assertPoolClosed(pool);
});

test('default court factory continues to fail closed without isolation opt-in', async () => {
  const pool = new Pool({ connectError: unavailable() });
  await assert.rejects(createCourtServer({ databaseUrl, pool, apiKey: '', allowedOrigins: origin }), error => error instanceof CourtDatabaseUnavailableError);
  assertPoolClosed(pool);
});

test('configuration, programming and corrupt-archive failures never activate isolation', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-server-invalid-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cases = [
    { databaseUrl: 'invalid-database-url' },
    { databaseUrl: 'postgres://remote.invalid/cases?sslmode=disable' },
    { databaseUrl: '', dataFile: path.join(directory, 'missing.json'), requireDurableStorage: true },
    { databaseUrl, pool: new Pool({ connectError: new TypeError('a programming mistake') }) },
    { databaseUrl, pool: new Pool({ connectError: new Error('an unclassified synthetic failure') }) },
    ...['28P01', '42501', '42601'].map(code => ({ databaseUrl, pool: new Pool({ connectError: Object.assign(new Error('synthetic credential, permission or SQL configuration failure'), { code }) }) })),
    { store: { kind: 'postgres', durable: true, async listRecoverableRooms() { throw new StorageError('INVALID_COURT_ARCHIVE', 'invalid archive'); }, async close() {} } },
  ];
  for (const options of cases) {
    await assert.rejects(createApplicationServer({
      petOptions: { store: petStore(), corsOrigin: origin },
      courtOptions: { allowedOrigins: origin, apiKey: '', ...options },
    }), error => !(error instanceof CourtDatabaseUnavailableError));
    if (options.pool) assertPoolClosed(options.pool);
  }
});

test('restored PostgreSQL uses the normal durable court after restart and retains cases', async t => {
  const f = await fixture(t);
  await f.stop();
  const rooms = new Map();
  const firstPool = new Pool({ rooms });
  const base = await f.start({ pool: firstPool });
  const config = await fetch(`${base}/api/court/config`);
  assert.equal(config.status, 200);
  assert.deepEqual((await config.json()).storage, { kind: 'postgres', durable: true });
  const created = await post(base, '/api/court/rooms', { title: '恢复后的同一个数据库' });
  assert.equal(created.status, 201);
  const room = (await created.json()).room;
  assert.equal(rooms.size, 1);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.degraded, false);
  assert.deepEqual(health.court, { available: true, storage: 'postgres' });
  await f.stop();
  assertPoolClosed(firstPool);
  const secondPool = new Pool({ rooms });
  const restartedBase = await f.start({ pool: secondPool });
  const restored = await fetch(`${restartedBase}/api/court/rooms/${room.id}`);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).room.title, room.title);
  await f.stop();
  assertPoolClosed(secondPool);
  await assert.rejects(readFile(f.dataFile), { code: 'ENOENT' });
});

test('closing the pet handler ends an existing SSE stream during court outage', async t => {
  const { base, server } = await fixture(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`${base}/api/rooms/${roomId}/events?clientId=test-caregiver&name=Test`, { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  assert.equal((await reader.read()).done, false);
  server.closePetHandler();
  server.closePetHandler();
  let deadline;
  try {
    await Promise.race([
      (async () => { while (!(await reader.read()).done) {} })(),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('SSE did not close')), 2000); }),
    ]);
  } finally { clearTimeout(deadline); }
});
