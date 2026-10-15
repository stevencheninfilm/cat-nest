import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPetServer, createPetHandler } from '../server/pet-server.mjs';
import { createGitHubStore } from '../server/github-store.mjs';
import { initialState } from '../src/state.js';
import { COUPLE_ROLES } from '../src/couple-profile.js';

const HOME = '0aed6937627c924a7497025ebd18fe5d';
const OTHER = 'a'.repeat(32);
async function running(t, options = {}) {
  const server = createPetServer({ serveStatic: false, corsOrigin: 'https://example.github.io', heartbeatMs: 1000, pollMs: 60_000, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { const closed = once(server, 'close'); server.shutdown(); server.closeAllConnections(); await closed; });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const post = (base, path, payload) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

function mockGitHub(state = initialState(), revision = 12) {
  const files = new Map();
  const calls = [];
  let nextSha = 1;
  files.set(HOME, { sha: 'sha-1', room: { version: 1, roomId: HOME, revision, state: structuredClone(state), createdAt: 10, updatedAt: state.updatedAt, operations: [] } });
  const controls = { forbidden: false, failWrite: false };
  async function fetchImpl(url, options) {
    const id = new URL(url).pathname.split('/').at(-1).replace('.json', '');
    calls.push({ id, method: options.method });
    if (controls.forbidden) return new Response('{}', { status: 403 });
    const stored = files.get(id);
    if (options.method === 'GET') {
      if (!stored) return new Response('{}', { status: 404 });
      if (options.headers['If-None-Match'] === stored.sha) return new Response(null, { status: 304 });
      return Response.json({ sha: stored.sha, encoding: 'base64', content: Buffer.from(JSON.stringify(stored.room)).toString('base64') }, { headers: { etag: stored.sha } });
    }
    if (controls.failWrite) return new Response('{}', { status: 500 });
    const body = JSON.parse(options.body);
    if (stored && stored.sha !== body.sha) return new Response('{}', { status: 409 });
    if (!stored && body.sha) return new Response('{}', { status: 409 });
    files.set(id, { sha: `sha-${++nextSha}`, room: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) });
    return new Response('{}', { status: 200 });
  }
  return { files, calls, controls, fetchImpl };
}
const storeFor = mock => createGitHubStore({ token: 'test-only-placeholder', repository: 'test/private-save', fetchImpl: mock.fetchImpl });
const feed = (role, operationId, food = 'chicken') => ({ operationId, clientId: `partner-${role}`, name: '客户端不可信昵称', action: { type: 'feed', food } });

async function sse(base, clientId, name = '客户端昵称', id = HOME) {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/rooms/${id}/events?${new URLSearchParams({ clientId, name })}`, { signal: controller.signal });
  const events = [];
  if (!response.ok) return { response, events, close: () => controller.abort() };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
    } catch { /* Closing the reader cancels the stream. */ }
  })();
  return { response, events, pump, close: () => controller.abort() };
}
async function until(predicate) {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for saved live event');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('common home loads the existing GitHub save verbatim, including legacy feeding identities', async t => {
  const state = initialState();
  state.name = '原来的猫猫'; state.love = 543; state.xp = 412;
  state.history = [{ actor: '旧猫友', text: '陪小猫玩了逗猫棒', at: Date.now() }];
  state.feedRecords = [{ actorId: 'old-device-identity', name: '旧猫友', food: 'salmon', at: Date.now() }];
  state.feedingWindow = { startedAt: Date.now(), bonusClaimed: false };
  const mock = mockGitHub(state);
  const { base } = await running(t, { store: storeFor(mock) });
  const first = await fetch(`${base}/api/couple/home`, { headers: { Origin: 'https://example.github.io' } });
  const second = await fetch(`${base}/api/couple/home`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('access-control-allow-origin'), 'https://example.github.io');
  const data = await first.json();
  assert.equal(data.roomId, HOME);
  assert.equal(data.revision, 12);
  assert.deepEqual(data.state, state);
  assert.deepEqual((await second.json()).state, state);
  assert.deepEqual(data.roles, COUPLE_ROLES);
  assert.ok(mock.calls.every(call => call.id === HOME && call.method === 'GET'));
  const handler = createPetHandler({ store: storeFor(mock), serveStatic: false });
  assert.equal(await handler({ url: '/unrelated' }, {}), false);
  handler.close();
});

test('home storage failures and missing saves fail closed without writing a replacement', async t => {
  const mock = mockGitHub();
  const { base } = await running(t, { store: storeFor(mock) });
  mock.files.delete(HOME);
  const missing = await fetch(`${base}/api/couple/home`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'ROOM_NOT_FOUND');
  mock.controls.forbidden = true;
  const forbidden = await fetch(`${base}/api/couple/home`);
  assert.equal(forbidden.status, 503);
  assert.equal((await forbidden.json()).error.code, 'STORAGE_PERMISSION');
  assert.ok(mock.calls.every(call => call.method === 'GET'));
  assert.equal(mock.files.size, 0);
});

test('configured common home override is respected and invalid configuration never reads or creates', async t => {
  const reads = [];
  const store = { configured: true, async getRoom(id) { reads.push(id); return { roomId: id, state: initialState(), revision: 3 }; }, async createRoom() { throw new Error('must not create'); } };
  const { base } = await running(t, { store, coupleRoomId: OTHER });
  assert.equal((await (await fetch(`${base}/api/couple/home`)).json()).roomId, OTHER);
  assert.deepEqual(reads, [OTHER]);
  const invalid = await running(t, { store, coupleRoomId: '../invalid' });
  assert.equal((await fetch(`${invalid.base}/api/couple/home`)).status, 503);
  assert.deepEqual(reads, [OTHER]);
  assert.equal((await post(base, '/api/couple/home', {})).status, 405);
});

test('only stable partner identities can interact with the common home and names are canonical', async t => {
  const mock = mockGitHub();
  const { base } = await running(t, { store: storeFor(mock) });
  const denied = await post(base, `/api/rooms/${HOME}/actions`, { ...feed('male', 'deny-operation'), clientId: 'old-browser-id' });
  assert.equal(denied.status, 400);
  assert.equal((await denied.json()).error.code, 'INVALID_COUPLE_ROLE');
  const deniedEvents = await sse(base, 'old-browser-id');
  assert.equal(deniedEvents.response.status, 400);
  deniedEvents.close();
  const male = await sse(base, 'partner-male');
  const sameMale = await sse(base, 'partner-male', '另一个浏览器昵称');
  const female = await sse(base, 'partner-female');
  t.after(() => { male.close(); sameMale.close(); female.close(); });
  await until(() => male.events.some(item => item.event === 'presence' && item.data.length === 2));
  const presence = male.events.filter(item => item.event === 'presence').at(-1).data;
  assert.deepEqual(presence, [{ id: 'partner-male', name: '男方' }, { id: 'partner-female', name: '女方' }]);
  const saved = await post(base, `/api/rooms/${HOME}/actions`, feed('male', 'saved-male-feed'));
  assert.equal(saved.status, 200);
  const result = await saved.json();
  assert.deepEqual(result.event.actor, { id: 'partner-male', name: '男方' });
  assert.equal(result.state.history[0].actor, '男方');
  await until(() => female.events.some(item => item.event === 'action'));
  assert.deepEqual(female.events.find(item => item.event === 'action').data.event.actor, result.event.actor);
  assert.equal(mock.files.get(HOME).room.revision, 13, 'live event follows the real GitHub write');
});

test('simultaneous partner feeds across server instances save both actions and award the pair once', async t => {
  const mock = mockGitHub();
  const first = await running(t, { store: storeFor(mock) });
  const second = await running(t, { store: storeFor(mock) });
  const starting = structuredClone(mock.files.get(HOME).room.state);
  const male = feed('male', 'concurrent-male-feed', 'chicken');
  const female = feed('female', 'concurrent-female-feed', 'salmon');
  const responses = await Promise.all([
    post(first.base, `/api/rooms/${HOME}/actions`, male),
    post(second.base, `/api/rooms/${HOME}/actions`, female),
  ]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const saved = await (await fetch(`${first.base}/api/couple/home`)).json();
  assert.equal(saved.revision, 14);
  assert.equal(saved.state.coins, starting.coins - 30 - 45);
  assert.equal(saved.state.love, starting.love + 35 + 45 + 10);
  assert.equal(saved.state.xp, starting.xp);
  assert.equal(saved.state.pendingGrowth.length, 2);
  assert.equal(saved.state.pendingGrowth.reduce((sum, reward) => sum + reward.amount, 0), 104.5);
  assert.deepEqual(saved.state.pendingGrowth.map(reward => reward.id).sort(), [male.operationId, female.operationId].sort());
  assert.equal(saved.state.feedingWindow.bonusClaimed, true);
  assert.deepEqual(saved.state.feedRecords.map(record => record.actorId).sort(), ['partner-female', 'partner-male']);
  assert.deepEqual(saved.state.feedRecords.map(record => record.name).sort(), ['女方', '男方']);
  const replay = await (await post(second.base, `/api/rooms/${HOME}/actions`, female)).json();
  assert.equal(replay.duplicate, true);
  assert.equal(replay.revision, 14);
  assert.equal(replay.state.love, saved.state.love);
  const rewardId = saved.state.pendingGrowth[0].id;
  const collect = { operationId: 'female-collect-growth', clientId: 'partner-female', name: '不可信昵称', action: { type: 'claim-growth', rewardId } };
  const claimed = await (await post(second.base, `/api/rooms/${HOME}/actions`, collect)).json();
  assert.equal(claimed.state.xp, starting.xp + saved.state.pendingGrowth[0].amount);
  assert.deepEqual(claimed.event.actor, { id: 'partner-female', name: '女方' });
  assert.equal(claimed.state.pendingGrowth.length, 1);
  assert.deepEqual(claimed.state.careLimits, saved.state.careLimits);
  const retriedClaim = await (await post(first.base, `/api/rooms/${HOME}/actions`, collect)).json();
  assert.equal(retriedClaim.duplicate, true);
  assert.equal(retriedClaim.state.xp, claimed.state.xp);
  const duplicateReward = await post(first.base, `/api/rooms/${HOME}/actions`, { ...collect, operationId: 'male-recollect-growth', clientId: 'partner-male' });
  assert.equal(duplicateReward.status, 409);
  assert.equal((await duplicateReward.json()).error.code, 'REWARD_ALREADY_CLAIMED');
});

test('other room APIs retain their existing nickname and client identity contract', async t => {
  const calls = [];
  const store = {
    configured: true,
    async getRoom(id) { return { roomId: id, state: initialState(), revision: 0 }; },
    async createRoom(input) { calls.push(input); return { roomId: OTHER, state: initialState(), revision: 0 }; },
    async applyAction(id, input) { calls.push(input); return { roomId: id, state: initialState(), revision: 1, duplicate: false, event: { operationId: input.operationId, action: input.action, actor: { id: input.clientId, name: input.name } } }; },
  };
  const { base } = await running(t, { store });
  assert.equal((await post(base, '/api/rooms', { name: '原来的昵称' })).status, 201);
  const input = { operationId: 'old-room-operation', clientId: 'legacy-device', name: '原来的昵称', action: { type: 'pet' } };
  const action = await post(base, `/api/rooms/${OTHER}/actions`, input);
  assert.equal(action.status, 200);
  assert.deepEqual((await action.json()).event.actor, { id: 'legacy-device', name: '原来的昵称' });
  assert.deepEqual(calls.at(-1), input);
});
