import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore } from '../server/github-store.mjs';
import { CARE_LIMITS, initialState, reduceAction } from '../src/state.js';

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
const makeStore = (mock, options = {}) => createGitHubStore({ token: 'test-secret-never-front-end', repository: 'test/private-data', fetchImpl: mock.fetchImpl, ...options });
const CARE_START = Date.parse('2026-10-13T00:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

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
  await Promise.all([first.applyAction(room.roomId, operation('operation-one')), second.applyAction(room.roomId, { ...operation('operation-two'), action: { type: 'rename', name: '布丁' } })]);
  const saved = await first.getRoom(room.roomId);
  assert.equal(saved.revision, 2);
  assert.equal(saved.state.love, room.state.love + 3);
  assert.equal(saved.state.name, '布丁');
  assert.equal(mock.files.get(room.roomId).room.operations.length, 2);
});

test('new food choices and both caregivers persist with one pair reward under conflicting writes', async () => {
  const mock = mockGitHub();
  const first = makeStore(mock);
  const second = makeStore(mock);
  const room = await first.createRoom();
  const feedOne = { operationId:'feeding-one', clientId:'client-one', name:'猫友', action:{type:'feed', food:'chicken'} };
  const feedTwo = { operationId:'feeding-two', clientId:'client-two', name:'猫友', action:{type:'feed', food:'salmon'} };
  await Promise.all([first.applyAction(room.roomId, feedOne), second.applyAction(room.roomId, feedTwo)]);
  const saved = await first.getRoom(room.roomId);
  assert.equal(saved.revision, 2);
  assert.equal(saved.state.coins, room.state.coins - 30 - 45);
  assert.equal(saved.state.love, room.state.love + 35 + 45 + 10);
  assert.equal(saved.state.feedRecords.length, 2);
  assert.equal(saved.state.feedingWindow.bonusClaimed, true);
  const replay = await second.applyAction(room.roomId, feedTwo);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.state.love, saved.state.love);
  assert.equal(mock.files.get(room.roomId).room.state.feedRecords.length, 2);
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
  for (let index = 0; index < 102; index += 1) await store.applyAction(room.roomId, { ...operation(`operation-${String(index).padStart(3, '0')}`), action: { type: 'rename', name: '糯米' } });
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

test('care cooldown is authoritative across restarts and rejects new IDs without extra rewards or writes', async () => {
  const mock = mockGitHub();
  let time = CARE_START;
  const store = makeStore(mock, { now: () => time });
  const room = await store.createRoom();
  const saved = await store.applyAction(room.roomId, operation('pet-original'));
  const stored = structuredClone(mock.files.get(room.roomId).room);
  const writes = mock.calls.filter(call => call.method === 'PUT').length;
  time += MINUTE;
  const restarted = makeStore(mock, { now: () => time });
  await assert.rejects(restarted.applyAction(room.roomId, operation('pet-new-id')), error => error.code === 'CARE_COOLDOWN' && error.status === 409 && /4分钟/.test(error.message));
  await assert.rejects(restarted.applyAction(room.roomId, { ...operation('pet-other-actor'), clientId: 'client-two' }), error => error.code === 'CARE_COOLDOWN');
  assert.deepEqual(mock.files.get(room.roomId).room, stored);
  assert.equal(mock.calls.filter(call => call.method === 'PUT').length, writes);
  const duplicate = await restarted.applyAction(room.roomId, operation('pet-original'));
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.xp, saved.state.xp);
  time = CARE_START + 5 * MINUTE;
  assert.equal((await restarted.applyAction(room.roomId, operation('pet-after-wait'))).state.xp, room.state.xp + 6);
});

test('concurrent caregivers cannot both earn a globally limited care reward after SHA retry', async () => {
  const mock = mockGitHub();
  const first = makeStore(mock, { now: () => CARE_START });
  const second = makeStore(mock, { now: () => CARE_START });
  const room = await first.createRoom();
  const results = await Promise.allSettled([
    first.applyAction(room.roomId, operation('pet-concurrent-one')),
    second.applyAction(room.roomId, { ...operation('pet-concurrent-two'), clientId: 'client-two' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'CARE_COOLDOWN');
  assert.equal(rejected.reason.status, 409);
  const saved = await first.getRoom(room.roomId);
  assert.equal(saved.revision, 1);
  assert.equal(saved.state.xp, room.state.xp + 3);
  assert.equal(saved.state.love, room.state.love + 3);
  assert.equal(mock.files.get(room.roomId).room.operations.length, 1);
});

test('feeding cooldown belongs to each caregiver but daily quota and pair rewards belong to the room', async () => {
  const mock = mockGitHub();
  let time = CARE_START;
  const store = makeStore(mock, { now: () => time });
  const room = await store.createRoom();
  const feed = (index, actor = 'client-one') => ({ operationId: `feed-quota-${index}`, clientId: actor, name: '猫友', action: { type: 'feed', food: 'water' } });
  const first = await store.applyAction(room.roomId, feed(0));
  await assert.rejects(store.applyAction(room.roomId, feed('duplicate')), error => error.code === 'CARE_COOLDOWN' && /4小时/.test(error.message));
  const paired = await store.applyAction(room.roomId, feed(1, 'client-two'));
  assert.equal(paired.state.xp, first.state.xp + 5 + 10);
  for (let round = 1; round < 3; round += 1) {
    time = CARE_START + round * 4 * HOUR;
    await store.applyAction(room.roomId, feed(round * 2));
    await store.applyAction(room.roomId, feed(round * 2 + 1, 'client-two'));
  }
  const saved = await store.getRoom(room.roomId);
  assert.equal(saved.state.xp, room.state.xp + 6 * 5 + 3 * 10);
  assert.equal(saved.state.coins, room.state.coins - 6 * 5);
  assert.equal(saved.state.careLimits.counts.feed, 6);
  assert.equal(saved.state.careLimits.counts.pair, 3);
  const beforeRejected = structuredClone(mock.files.get(room.roomId).room);
  time = CARE_START + 12 * HOUR;
  await assert.rejects(store.applyAction(room.roomId, feed(6, 'client-three')), error => error.code === 'DAILY_CARE_LIMIT' && error.status === 409 && /6次上限/.test(error.message) && /4小时后可继续/.test(error.message) && /北京时间00:00/.test(error.message));
  assert.deepEqual(mock.files.get(room.roomId).room, beforeRejected, 'quota refusal must not spend coins or edit feeding records');
  time = Date.parse('2026-10-13T16:00:00Z');
  const nextDay = await makeStore(mock, { now: () => time }).applyAction(room.roomId, feed('next-day'));
  assert.equal(nextDay.state.careLimits.counts.feed, 1);
});

test('daily play cap prevents added growth and currency, while sleep toggles cannot farm rest rewards', async () => {
  const mock = mockGitHub();
  let time = CARE_START;
  const store = makeStore(mock, { now: () => time });
  const room = await store.createRoom({ initialState: { version: 1, energy: 100 } });
  for (let index = 0; index < 10; index += 1) {
    time = CARE_START + index * 30 * MINUTE;
    await store.applyAction(room.roomId, operation(`play-quota-${index}`, 'play'));
  }
  const saved = await store.getRoom(room.roomId);
  assert.equal(saved.state.coins, room.state.coins + 100);
  assert.equal(saved.state.xp, room.state.xp + 80);
  time += 30 * MINUTE;
  await assert.rejects(store.applyAction(room.roomId, operation('play-quota-excess', 'play')), error => error.code === 'DAILY_CARE_LIMIT');
  assert.deepEqual((await store.getRoom(room.roomId)).state, saved.state);
  const asleep = await store.applyAction(room.roomId, operation('rest-first', 'sleep'));
  const awake = await store.applyAction(room.roomId, operation('wake-immediate', 'sleep'));
  assert.equal(awake.state.sleeping, false);
  assert.equal(awake.state.xp, asleep.state.xp);
  assert.equal(awake.state.energy, asleep.state.energy);
  assert.equal(awake.state.careLimits.counts.sleep, 1);
  await assert.rejects(store.applyAction(room.roomId, operation('rest-spam', 'sleep')), error => error.code === 'CARE_COOLDOWN');
  assert.deepEqual((await store.getRoom(room.roomId)).state, awake.state);
});

test('malformed persisted care quota fails closed instead of clearing earned limits', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock, { now: () => CARE_START });
  const room = await store.createRoom();
  await store.applyAction(room.roomId, operation('pet-before-corruption'));
  mock.files.get(room.roomId).room.state.careLimits.counts.pet = -1;
  await assert.rejects(store.applyAction(room.roomId, operation('pet-after-corruption')), error => error.code === 'STORAGE_CORRUPT');
  assert.equal(mock.files.get(room.roomId).room.revision, 1);
  assert.equal(mock.files.get(room.roomId).room.state.careLimits.counts.pet, -1);
});

test('appearance saves and reloads while care is capped without resetting its ledger or feeding round', async () => {
  const mock = mockGitHub();
  let time = CARE_START;
  const actor = { id: 'client-one', name: '小鱼' };
  let supplied = reduceAction(initialState(time), { type: 'feed', food: 'meal' }, actor, time);
  for (const type of ['pet', 'play', 'sleep', 'sleep']) supplied = reduceAction(supplied, { type }, actor, time);
  for (const [type, rule] of Object.entries(CARE_LIMITS)) supplied.careLimits.counts[type] = rule.dailyLimit;
  const store = makeStore(mock, { now: () => time });
  const room = await store.createRoom({ initialState: supplied });
  const appearance = { body: 4, clothes: 3, eyes: 2, wand: 1 };
  time += 1;
  const dressed = await store.applyAction(room.roomId, { ...operation('dress-while-capped'), action: { type: 'dress', appearance } });
  assert.equal(dressed.revision, 1);
  assert.deepEqual(dressed.state.appearance, appearance);
  assert.deepEqual(dressed.state.careLimits, room.state.careLimits);
  assert.deepEqual(dressed.state.feedRecords, room.state.feedRecords);
  assert.deepEqual(dressed.state.feedingWindow, room.state.feedingWindow);
  for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy', 'sleeping']) assert.equal(dressed.state[key], room.state[key], key);
  const restarted = makeStore(mock, { now: () => time });
  assert.deepEqual((await restarted.getRoom(room.roomId)).state, dressed.state);
  const stored = structuredClone(mock.files.get(room.roomId).room);
  const writes = mock.calls.filter(call => call.method === 'PUT').length;
  await assert.rejects(restarted.applyAction(room.roomId, operation('pet-after-dress')), error => error.code === 'DAILY_CARE_LIMIT');
  await assert.rejects(restarted.applyAction(room.roomId, { ...operation('feed-after-dress'), action: { type: 'feed', food: 'fish' } }), error => error.code === 'DAILY_CARE_LIMIT');
  assert.deepEqual(mock.files.get(room.roomId).room, stored, 'rejected care cannot change the outfit, currency, ledger or feeding round');
  assert.equal(mock.calls.filter(call => call.method === 'PUT').length, writes);
  time = Date.parse('2026-10-13T16:00:00Z');
  const cared = await restarted.applyAction(room.roomId, operation('pet-next-day-outfit'));
  assert.deepEqual(cared.state.appearance, appearance);
  assert.equal(cared.state.xp, dressed.state.xp + 3);
  assert.equal(cared.state.coins, dressed.state.coins);
  assert.equal(cared.state.careLimits.counts.pet, 1);
  assert.deepEqual((await makeStore(mock, { now: () => time }).getRoom(room.roomId)).state, cared.state);
});
