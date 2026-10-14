import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { createPetServer, createPetHandler } from '../server/pet-server.mjs';
import { createGitHubStore, StorageError } from '../server/github-store.mjs';
import { initialState, reduceAction } from '../src/state.js';

const roomId = 'a'.repeat(32);
function memoryStore() {
  let state = initialState();
  let revision = 0;
  const controls = { fail: false, block: null };
  return {
    configured: true, controls,
    async createRoom() { return { roomId, state: structuredClone(state), revision }; },
    async getRoom(id) { if (id !== roomId) throw new StorageError('ROOM_NOT_FOUND', '没有这个小窝', 404); return { roomId, state: structuredClone(state), revision }; },
    async applyAction(id, input) {
      if (controls.block) await controls.block;
      if (controls.fail) throw new StorageError('STORAGE_WRITE_FAILED', '存档失败');
      const next = reduceAction(state, input.action, { id: input.clientId, name: input.name }, Date.now(), input.operationId);
      if (!next) throw new StorageError(input.action.type === 'claim-growth' ? 'REWARD_ALREADY_CLAIMED' : 'ACTION_REJECTED', '这次互动已不可用。', 409);
      state = next;
      revision += 1;
      return { roomId, state: structuredClone(state), revision, event: { operationId: input.operationId, action: input.action, actor: { id: input.clientId, name: input.name } }, duplicate: false };
    },
  };
}
async function running(t, options = {}) {
  const store = options.store || memoryStore();
  const server = createPetServer({ store, serveStatic: false, corsOrigin: 'https://example.github.io', heartbeatMs: 1000, pollMs: 60_000, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { const done = once(server, 'close'); server.shutdown(); server.closeAllConnections(); await done; });
  return { store, server, base: `http://127.0.0.1:${server.address().port}` };
}
const post = (base, path, payload, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });

async function sse(base, id, name = id) {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/rooms/${roomId}/events?${new URLSearchParams({ clientId: id, name })}`, { signal: controller.signal });
  if (!response.ok) return { response, close: () => controller.abort() };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  let ended = false;
  const pump = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const packet = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const event = packet.match(/^event: (.+)$/m)?.[1];
          const data = packet.match(/^data: (.+)$/m)?.[1];
          if (event && data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch { /* Cancellation closes the stream. */ }
    ended = true;
  })();
  return { response, events, close: () => controller.abort(), pump, get ended() { return ended; } };
}
async function until(predicate, ms = 1000) {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for event');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('health, room create/read, CORS, and reusable handler agree with client contract', async t => {
  const { base } = await running(t);
  const health = await fetch(`${base}/api/health`);
  assert.deepEqual(await health.json(), { ok: true, configured: true, storage: 'github' });
  const created = await post(base, '/api/rooms', { name: '小鱼' }, { Origin: 'https://example.github.io' });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('access-control-allow-origin'), 'https://example.github.io');
  assert.equal((await created.json()).roomId, roomId);
  const read = await fetch(`${base}/api/rooms/${roomId}`);
  assert.equal((await read.json()).revision, 0);
  const denied = await post(base, '/api/rooms', {}, { Origin: 'https://bad.example' });
  assert.equal(denied.status, 403);
  const handler = createPetHandler({ store: memoryStore(), serveStatic: false });
  assert.equal(await handler({ url: '/court' }, {}), false);
  handler.close();
});

test('SSE broadcasts saved interactions, shows two members, and rejects a third member', async t => {
  const { base } = await running(t);
  const first = await sse(base, 'client-one', '小鱼');
  const second = await sse(base, 'client-two', '小雨');
  t.after(() => { first.close(); second.close(); });
  await until(() => first.events.some(item => item.event === 'presence' && item.data.length === 2));
  const third = await sse(base, 'client-three');
  assert.equal(third.response.status, 200);
  await until(() => third.events.some(item => item.event === 'full'));
  assert.match(third.events.find(item => item.event === 'full').data.message, /两位/);
  third.close();
  const saved = await post(base, `/api/rooms/${roomId}/actions`, { operationId: 'operation-one', clientId: 'client-one', name: '小鱼', action: { type: 'pet' } });
  assert.equal(saved.status, 200);
  const result = await saved.json();
  await until(() => second.events.some(item => item.event === 'action'));
  assert.equal(result.revision, 1);
  assert.equal(second.events.find(item => item.event === 'action').data.state.love, result.state.love);
  assert.equal(second.events.find(item => item.event === 'action').data.event.actor.name, '小鱼');
  first.close();
  await until(() => second.events.filter(item => item.event === 'presence').at(-1).data.length === 1);
});

test('pending or failed persistence is neither acknowledged nor broadcast as saved', async t => {
  const { base, store } = await running(t);
  const observer = await sse(base, 'client-one');
  t.after(() => observer.close());
  let release;
  store.controls.block = new Promise(resolve => { release = resolve; });
  let resolved = false;
  const request = post(base, `/api/rooms/${roomId}/actions`, { operationId: 'operation-one', clientId: 'client-one', name: '小鱼', action: { type: 'pet' } }).then(response => { resolved = true; return response; });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(resolved, false);
  assert.equal(observer.events.some(item => item.event === 'action'), false);
  store.controls.fail = true;
  release();
  const response = await request;
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'STORAGE_WRITE_FAILED');
  assert.equal(observer.events.some(item => item.event === 'action'), false);
});

test('unconfigured GitHub fails health and creation without a fake local fallback', async t => {
  const { base } = await running(t, { store: createGitHubStore({ token: '' }) });
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  const response = await post(base, '/api/rooms', {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'STORAGE_NOT_CONFIGURED');
});

test('malformed body and invalid membership information are rejected', async t => {
  const { base } = await running(t);
  const invalid = await post(base, '/api/rooms', []);
  assert.equal(invalid.status, 400);
  const response = await post(base, `/api/rooms/${roomId}/actions`, { clientId: '../bad', name: '小鱼' });
  assert.equal(response.status, 400);
  const oversized = await post(base, '/api/rooms', { name: 'x'.repeat(40_000) });
  assert.equal(oversized.status, 413);
});

for (const code of ['CARE_COOLDOWN', 'DAILY_CARE_LIMIT', 'REWARD_ALREADY_CLAIMED']) {
  test(`${code} is exposed as HTTP 409 without acknowledging a saved action`, async () => {
    const store = memoryStore();
    const message = '摸摸暂不可用，请等待5分钟后再试。';
    store.applyAction = async () => { throw new StorageError(code, message, 409); };
    const handler = createPetHandler({ store, serveStatic: false });
    const action = code === 'REWARD_ALREADY_CLAIMED' ? { type: 'claim-growth', rewardId: 'claimed-growth-one' } : { type: 'pet' };
    const request = Readable.from([Buffer.from(JSON.stringify({ operationId: 'limited-action', clientId: 'client-one', name: '小鱼', action }))]);
    request.method = 'POST';
    request.url = `/api/rooms/${roomId}/actions`;
    request.headers = { 'content-type': 'application/json' };
    request.socket = { remoteAddress: '127.0.0.1' };
    const response = {
      headersSent: false, destroyed: false, status: null, data: null,
      writeHead(status) { this.status = status; this.headersSent = true; },
      end(data) { this.data = JSON.parse(data); },
    };
    try {
      assert.equal(await handler(request, response), true);
      assert.equal(response.status, 409);
      assert.deepEqual(response.data, { error: { code, message } });
      assert.equal((await store.getRoom(roomId)).revision, 0);
    } finally { handler.close(); }
  });
}
