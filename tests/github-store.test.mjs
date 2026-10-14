import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore } from '../server/github-store.mjs';

function mockGitHub() {
  const files = new Map();
  const calls = [];
  let nextSha = 0;
  const controls = { failWrite: false, loseAcknowledgment: false, forbidden: false };
  async function fetchImpl(url, options) {
    const id = new URL(url).pathname.split('/').at(-1).replace('.json', '');
    calls.push({ url, ...options });
    if (controls.forbidden) return new Response('{}', { status: 403 });
    const existing = files.get(id);
    if (options.method === 'GET') {
      if (!existing) return new Response('{}', { status: 404 });
      if (options.headers['If-None-Match'] === existing.sha) return new Response(null, { status: 304 });
      return Response.json({ sha: existing.sha, encoding: 'base64', content: Buffer.from(JSON.stringify(existing.room)).toString('base64') }, { headers: { etag: existing.sha } });
    }
    if (controls.failWrite) return new Response('{}', { status: 500 });
    const body = JSON.parse(options.body);
    if (existing && existing.sha !== body.sha) return new Response('{}', { status: 409 });
    if (!existing && body.sha) return new Response('{}', { status: 409 });
    files.set(id, { sha: `sha-${++nextSha}`, room: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) });
    if (controls.loseAcknowledgment) { controls.loseAcknowledgment = false; throw new Error('network dropped after commit'); }
    return new Response('{}', { status: existing ? 200 : 201 });
  }
  return { files, calls, controls, fetchImpl };
}
const operation = (id = 'operation-001', type = 'pet') => ({ operationId: id, clientId: 'client-one', name: '小鱼', action: { type } });
const makeStore = mock => createGitHubStore({ token: 'test-secret-never-front-end', repository: 'test/private-data', fetchImpl: mock.fetchImpl });

test('room creation and interactions persist in private GitHub files before resolving', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock);
  const room = await store.createRoom();
  assert.match(room.roomId, /^[a-f0-9]{32}$/);
  assert.equal(room.revision, 0);
  assert.equal(mock.files.get(room.roomId).room.state.name, '糯米');
  const saved = await store.applyAction(room.roomId, operation());
  assert.equal(saved.revision, 1);
  assert.equal(saved.state.love, room.state.love + 3);
  assert.equal(mock.files.get(room.roomId).room.operations[0].id, 'operation-001');
  assert.deepEqual((await store.getRoom(room.roomId)).state, saved.state);
  assert.deepEqual(saved.event.actor, { id: 'client-one', name: '小鱼' });
  assert.ok(mock.calls.every(call => call.url.startsWith('https://api.github.com/repos/test/private-data/contents/rooms/')));
  assert.equal(JSON.stringify(saved).includes('test-secret'), false);
});

test('operation replay is idempotent, including a lost response after a completed commit', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock);
  const room = await store.createRoom();
  mock.controls.loseAcknowledgment = true;
  await assert.rejects(store.applyAction(room.roomId, operation()), error => error.code === 'STORAGE_UNAVAILABLE');
  assert.equal(mock.files.get(room.roomId).room.revision, 1, 'server may have committed even when client did not receive acknowledgment');
  const retry = await store.applyAction(room.roomId, operation());
  assert.equal(retry.duplicate, true);
  assert.equal(retry.revision, 1);
  assert.equal(retry.state.love, room.state.love + 3);
  await assert.rejects(store.applyAction(room.roomId, operation('operation-001', 'play')), error => error.code === 'OPERATION_CONFLICT');
});

test('parallel operations across store instances retry SHA conflicts without losing either action', async () => {
  const mock = mockGitHub();
  const first = makeStore(mock);
  const second = makeStore(mock);
  const room = await first.createRoom();
  await Promise.all([first.applyAction(room.roomId, operation('operation-one')), second.applyAction(room.roomId, operation('operation-two'))]);
  const saved = await first.getRoom(room.roomId);
  assert.equal(saved.revision, 2);
  assert.equal(saved.state.love, room.state.love + 6);
  assert.equal(mock.files.get(room.roomId).room.operations.length, 2);
});

test('failed writes do not produce successful state or erase previous progress', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock);
  const room = await store.createRoom();
  mock.controls.failWrite = true;
  await assert.rejects(store.applyAction(room.roomId, operation()), error => error.code === 'STORAGE_WRITE_FAILED');
  assert.equal(mock.files.get(room.roomId).room.revision, 0);
  assert.equal((await store.getRoom(room.roomId)).state.love, room.state.love);
  mock.controls.failWrite = false;
  assert.equal((await store.applyAction(room.roomId, operation())).revision, 1);
});

test('unconfigured storage, inaccessible storage, invalid actions, and reducer rejection fail closed', async () => {
  const unconfigured = createGitHubStore({ token: '' });
  await assert.rejects(unconfigured.createRoom(), error => error.code === 'STORAGE_NOT_CONFIGURED');
  const mock = mockGitHub();
  const store = makeStore(mock);
  const room = await store.createRoom({ initialState: { version: 1, coins: 0 } });
  await assert.rejects(store.applyAction(room.roomId, { ...operation(), action: { type: 'feed', food: 'meal' } }), error => error.code === 'ACTION_REJECTED');
  await assert.rejects(store.applyAction(room.roomId, { ...operation(), action: { type: 'pet', money: 99 } }), error => error.code === 'INVALID_ACTION');
  await assert.rejects(store.getRoom('../secrets'), error => error.code === 'INVALID_ROOM');
  mock.controls.forbidden = true;
  await assert.rejects(store.getRoom(room.roomId), error => error.code === 'STORAGE_PERMISSION');
});

test('deduplication history is bounded to the most recent 100 operations', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock);
  const room = await store.createRoom();
  for (let index = 0; index < 102; index += 1) await store.applyAction(room.roomId, operation(`operation-${String(index).padStart(3, '0')}`));
  const stored = mock.files.get(room.roomId).room;
  assert.equal(stored.operations.length, 100);
  assert.equal(stored.operations[0].id, 'operation-002');
  assert.equal(stored.state.history.length, 40);
});

test('corrupt stored progress is rejected rather than silently reset and overwritten', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock);
  const room = await store.createRoom();
  mock.files.get(room.roomId).room.state.history = 'broken';
  await assert.rejects(store.applyAction(room.roomId, operation()), error => error.code === 'STORAGE_CORRUPT');
  assert.equal(mock.files.get(room.roomId).room.revision, 0);
  assert.equal(mock.files.get(room.roomId).room.state.history, 'broken');
});
