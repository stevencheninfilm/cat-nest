import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { CARE_LIMITS, FOODS, initialState, reduceAction } from '../src/state.js';

function mockGitHub() {
  const files = new Map();
  const blobs = new Map();
  const calls = [];
  let nextSha = 0;
  const controls = { failWrite: false, loseAcknowledgment: false, forbidden: false, largeFile: false, failBlobRead: false };
  async function fetchImpl(url, options) {
    const id = new URL(url).pathname.split('/').at(-1).replace('.json', '');
    calls.push({ url, ...options });
    if (controls.forbidden) return new Response('{}', { status: 403 });
    if (new URL(url).pathname.includes('/git/blobs/')) {
      if (controls.failBlobRead) return new Response('{}', { status: 503 });
      const room = blobs.get(id);
      return room ? Response.json({ sha: id, encoding: 'base64', content: Buffer.from(JSON.stringify(room)).toString('base64') }) : new Response('{}', { status: 404 });
    }
    const existing = files.get(id);
    if (options.method === 'GET') {
      if (!existing) return new Response('{}', { status: 404 });
      if (options.headers['If-None-Match'] === existing.sha) return new Response(null, { status: 304 });
      if (controls.largeFile) return Response.json({ sha: existing.sha, encoding: 'none', content: '' }, { headers: { etag: existing.sha } });
      return Response.json({ sha: existing.sha, encoding: 'base64', content: Buffer.from(JSON.stringify(existing.room)).toString('base64') }, { headers: { etag: existing.sha } });
    }
    if (controls.failWrite) return new Response('{}', { status: 500 });
    const body = JSON.parse(options.body);
    if (existing && existing.sha !== body.sha) return new Response('{}', { status: 409 });
    if (!existing && body.sha) return new Response('{}', { status: 409 });
    files.set(id, { sha: `sha-${++nextSha}`, room: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) });
    blobs.set(files.get(id).sha, structuredClone(files.get(id).room));
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
const pendingXp = state => state.pendingGrowth.reduce((total, reward) => total + Math.round(reward.amount * 10), 0) / 10;
const claim = (rewardId, operationId = 'claim-operation-one', clientId = 'client-one') => ({ operationId, clientId, name: '猫友', action: { type: 'claim-growth', rewardId } });

const invite = (catId, operationId='collection-invite-operation', clientId='client-one') => ({ operationId, clientId, name:'猫友', action:{type:'invite-cat',catId} });
test('the server requires starter care and both increased food-achievement conditions before writing', async()=>{
  const mock=mockGitHub(), store=makeStore(mock,{now:()=>CARE_START}), room=await store.createRoom();
  const file=mock.files.get(room.roomId), writes=mock.calls.filter(call=>call.method==='PUT').length;
  await assert.rejects(store.applyAction(room.roomId,invite('bandit')),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  file.room.state.collection.stats.feed=53;file.room.state.collection.foods=Object.keys(FOODS);file.sha='food-count-below-sha';
  await assert.rejects(store.applyAction(room.roomId,invite('gozer')),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  file.room.state.collection.stats.feed=54;file.room.state.collection.foods=Object.keys(FOODS).slice(0,8);file.sha='food-variety-below-sha';
  await assert.rejects(store.applyAction(room.roomId,invite('gozer')),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  assert.equal(mock.calls.filter(call=>call.method==='PUT').length,writes);
  file.room.state.collection.foods=Object.keys(FOODS);file.sha='food-all-conditions-sha';
  const saved=await store.applyAction(room.roomId,invite('gozer'));
  assert.equal(saved.state.collection.invited[0].id,'gozer');
  assert.equal(saved.state.collection.stats.feed,54);
});
test('food-specific cooldowns survive store restart and cannot be bypassed by a menu change', async () => {
  const mock = mockGitHub();
  let clock = CARE_START;
  const store = makeStore(mock, { now:()=>clock });
  const room = await store.createRoom();
  const feed = (food, operationId, clientId='client-one') => ({ operationId, clientId, name:'猫友', action:{ type:'feed', food } });
  const water = await store.applyAction(room.roomId, feed('water', 'food-duration-water'));
  assert.equal(water.state.careLimits.feedCooldowns[0].food, 'water');
  const restarted = makeStore(mock, { now:()=>clock });
  clock += 30 * MINUTE - 1;
  const writes = mock.calls.filter(call=>call.method==='PUT').length;
  await assert.rejects(restarted.applyAction(room.roomId, feed('fish', 'food-duration-too-early')), error=>error.code==='CARE_COOLDOWN');
  assert.equal(mock.calls.filter(call=>call.method==='PUT').length, writes);
  clock += 1;
  const fish = await restarted.applyAction(room.roomId, feed('fish', 'food-duration-fish'));
  assert.equal(fish.state.careLimits.counts.feed, 2);
  assert.equal(fish.state.careLimits.feedCooldowns[0].food, 'fish');
  clock += MINUTE;
  await assert.rejects(makeStore(mock, { now:()=>clock }).applyAction(room.roomId, feed('water', 'food-duration-switch-back')), error=>error.code==='CARE_COOLDOWN');
  const partner = await restarted.applyAction(room.roomId, feed('mousse', 'food-duration-partner', 'client-two'));
  assert.equal(partner.state.careLimits.counts.feed, 3);
  const saved = mock.files.get(room.roomId).room.state;
  assert.equal(saved.careLimits.feedCooldowns.find(record=>record.actorId==='client-one').food, 'fish');
  assert.equal(saved.careLimits.feedCooldowns.find(record=>record.actorId==='client-two').food, 'mousse');
});

test('cat invitations migrate legacy care, enforce achievements, and persist before confirmation', async () => {
  const mock=mockGitHub();
  const store=makeStore(mock,{now:()=>CARE_START});
  const room=await store.createRoom();
  await assert.rejects(store.applyAction(room.roomId,invite('bolt')),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  const file=mock.files.get(room.roomId);
  delete file.room.state.collection;
  file.room.state.history=[{text:'喂了一份鲜鱼罐罐，生成50点成长气泡待领取',actor:'猫友',at:CARE_START}];
  file.sha='legacy-catbook-sha';
  const writes=mock.calls.filter(call=>call.method==='PUT').length;
  await assert.rejects(store.applyAction(room.roomId,invite('bolt')),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  assert.equal(mock.calls.filter(call=>call.method==='PUT').length,writes,'one old feed must not unlock the harder achievement');
  file.room.state.history=Array.from({length:29},(_,index)=>({text:'喂了一份鲜鱼罐罐，生成50点成长气泡待领取',actor:'猫友',at:CARE_START-index*86400_000}));
  file.sha='legacy-catbook-29-feeds-sha';
  await assert.rejects(store.applyAction(room.roomId,invite('bolt')),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  assert.equal(mock.calls.filter(call=>call.method==='PUT').length,writes);
  file.room.state.history.push({text:'喂了一份鲜鱼罐罐，生成50点成长气泡待领取',actor:'猫友',at:CARE_START-29*86400_000});
  file.sha='legacy-catbook-30-feeds-sha';
  const saved=await store.applyAction(room.roomId,invite('bolt'));
  assert.equal(saved.state.collection.stats.feed,30);
  assert.equal(saved.state.collection.invited[0].id,'bolt');
  assert.equal(mock.files.get(room.roomId).room.state.collection.invited[0].id,'bolt');
  const reloaded=await makeStore(mock,{now:()=>CARE_START+86400_000}).getRoom(room.roomId);
  assert.deepEqual(reloaded.state.collection,saved.state.collection);
  await assert.rejects(store.applyAction(room.roomId,invite('bolt','another-invite-operation')),error=>error.code==='CAT_ALREADY_INVITED');
});

test('invitation receipts prevent replay after a lost acknowledgment and operation journal rollover', async () => {
  const mock=mockGitHub();
  const store=makeStore(mock,{now:()=>CARE_START});
  const room=await store.createRoom();
  mock.files.get(room.roomId).room.state.collection.stats.pet=5;
  mock.files.get(room.roomId).sha='starter-care-qualified-sha';
  mock.controls.loseAcknowledgment=true;
  await assert.rejects(store.applyAction(room.roomId,invite('bandit')),error=>error.code==='STORAGE_UNAVAILABLE');
  const file=mock.files.get(room.roomId);
  assert.equal(file.room.state.collection.invited.length,1);
  file.room.operations=[];
  file.room.revision=105;
  file.sha='catbook-rollover-sha';
  const writes=mock.calls.filter(call=>call.method==='PUT').length;
  const replay=await store.applyAction(room.roomId,invite('bandit'));
  assert.equal(replay.duplicate,true);
  assert.equal(replay.revision,105);
  assert.equal(replay.state.collection.invited.length,1);
  assert.equal(mock.calls.filter(call=>call.method==='PUT').length,writes);
  await assert.rejects(store.applyAction(room.roomId,invite('bandit','collection-invite-operation','client-two')),error=>error.code==='OPERATION_CONFLICT');
});

test('concurrent invitations from two store instances keep one cat and one diary entry', async () => {
  const mock=mockGitHub();
  const first=makeStore(mock,{now:()=>CARE_START});
  const second=makeStore(mock,{now:()=>CARE_START});
  const room=await first.createRoom();
  mock.files.get(room.roomId).room.state.collection.stats.pet=5;
  mock.files.get(room.roomId).sha='concurrent-starter-qualified-sha';
  const results=await Promise.allSettled([
    first.applyAction(room.roomId,invite('bandit','first-catbook-invite')),
    second.applyAction(room.roomId,invite('bandit','second-catbook-invite','client-two')),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'CAT_ALREADY_INVITED');
  const saved=await makeStore(mock).getRoom(room.roomId);
  assert.equal(saved.state.collection.invited.length,1);
  assert.equal(saved.state.history.filter(item=>item.text==='邀请斑斑加入猫猫庭院').length,1);
});

test('a corrupt persisted collection ledger fails closed before any save can erase it', async () => {
  const mock=mockGitHub();
  const store=makeStore(mock,{now:()=>CARE_START});
  const room=await store.createRoom();
  mock.files.get(room.roomId).room.state.collection.stats.feed=-1;
  await assert.rejects(store.getRoom(room.roomId),error=>error.code==='STORAGE_CORRUPT');
  await assert.rejects(store.applyAction(room.roomId,invite('bandit')),error=>error.code==='STORAGE_CORRUPT');
});

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
  assert.equal(saved.state.xp, room.state.xp);
  assert.equal(pendingXp(saved.state), 3.3);
  assert.equal(saved.state.pendingGrowth[0].id, 'operation-001');
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
  const afterWait = await restarted.applyAction(room.roomId, operation('pet-after-wait'));
  assert.equal(afterWait.state.xp, room.state.xp);
  assert.equal(pendingXp(afterWait.state), 6.6);
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
  assert.equal(saved.state.xp, room.state.xp);
  assert.equal(pendingXp(saved.state), 3.3);
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
  await assert.rejects(store.applyAction(room.roomId, feed('duplicate')), error => error.code === 'CARE_COOLDOWN' && /30分钟/.test(error.message));
  const paired = await store.applyAction(room.roomId, feed(1, 'client-two'));
  assert.equal(paired.state.xp, room.state.xp);
  assert.equal(pendingXp(paired.state), pendingXp(first.state) + 18);
  for (let round = 1; round < 3; round += 1) {
    time = CARE_START + round * 4 * HOUR;
    await store.applyAction(room.roomId, feed(round * 2));
    await store.applyAction(room.roomId, feed(round * 2 + 1, 'client-two'));
  }
  const saved = await store.getRoom(room.roomId);
  assert.equal(saved.state.xp, room.state.xp);
  assert.deepEqual(saved.state.pendingGrowth.map(reward=>reward.amount),[5.5,18,5.5,16.5,5.5,16.5]);
  assert.equal(pendingXp(saved.state), 67.5);
  assert.equal(saved.state.coins, room.state.coins - 6 * 5);
  assert.equal(saved.state.careLimits.counts.feed, 6);
  assert.equal(saved.state.careLimits.counts.pair, 3);
  for(let index=6;index<CARE_LIMITS.feed.dailyLimit;index++) {
    time=CARE_START+(8+(index-5)*.5)*HOUR;
    await store.applyAction(room.roomId,feed(index,index%2?'client-two':'client-one'));
  }
  const capped=await store.getRoom(room.roomId);
  assert.equal(capped.state.careLimits.counts.feed,10);
  assert.equal(capped.state.careLimits.counts.pair,3);
  assert.equal(capped.state.collection.achievements.daily.feed,10);
  const beforeRejected = structuredClone(mock.files.get(room.roomId).room);
  time = CARE_START + 12 * HOUR;
  await assert.rejects(store.applyAction(room.roomId, feed(10, 'client-three')), error => error.code === 'DAILY_CARE_LIMIT' && error.status === 409 && /10次上限/.test(error.message) && /4小时后可继续/.test(error.message) && /北京时间00:00/.test(error.message));
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
  assert.equal(saved.state.xp, room.state.xp);
  assert.deepEqual(saved.state.pendingGrowth.map(reward=>reward.amount),[...Array(8).fill(9.6),...Array(2).fill(8.8)]);
  assert.equal(pendingXp(saved.state), 94.4);
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
  assert.equal(cared.state.xp, dressed.state.xp);
  assert.equal(pendingXp(cared.state), pendingXp(dressed.state) + 3.3);
  assert.equal(cared.state.coins, dressed.state.coins);
  assert.equal(cared.state.careLimits.counts.pet, 1);
  assert.deepEqual((await makeStore(mock, { now: () => time }).getRoom(room.roomId)).state, cared.state);
});

test('claim actions accept only a valid reward ID and no client-supplied reward values', () => {
  assert.deepEqual(sanitizeAction({ type: 'claim-growth', rewardId: 'growth.reward:001' }), { type: 'claim-growth', rewardId: 'growth.reward:001' });
  for (const action of [
    { type: 'claim-growth' }, { type: 'claim-growth', rewardId: 123 },
    { type: 'claim-growth', rewardId: 'short' }, { type: 'claim-growth', rewardId: '../growth-reward' },
    { type: 'claim-growth', rewardId: 'a'.repeat(181) },
    { type: 'claim-growth', rewardId: 'reward-valid', amount: 9999 },
  ]) assert.equal(sanitizeAction(action), null);
});

test('unclaimed growth survives days and a store restart, then a claim awards XP exactly once', async () => {
  const mock = mockGitHub();
  let time = CARE_START;
  const store = makeStore(mock, { now: () => time });
  const room = await store.createRoom();
  const fed = await store.applyAction(room.roomId, { ...operation('persistent-feed'), action: { type: 'feed', food: 'fish' } });
  const reward = fed.state.pendingGrowth[0];
  assert.equal(reward.id, 'persistent-feed');
  assert.equal(reward.amount, 55);
  assert.equal(fed.state.xp, room.state.xp);
  time += 90 * 24 * HOUR;
  const restarted = makeStore(mock, { now: () => time });
  const loaded = await restarted.getRoom(room.roomId);
  assert.deepEqual(loaded.state.pendingGrowth, [reward]);
  const before = structuredClone(loaded.state);
  const input = claim(reward.id);
  const claimed = await restarted.applyAction(room.roomId, input);
  assert.equal(claimed.state.xp, room.state.xp + 55);
  assert.deepEqual(claimed.state.pendingGrowth, []);
  assert.equal(claimed.state.coins, before.coins);
  assert.equal(claimed.state.love, before.love);
  assert.deepEqual(claimed.state.feedRecords, before.feedRecords);
  assert.deepEqual(claimed.state.feedingWindow, before.feedingWindow);
  assert.equal(claimed.state.careLimits.counts.feed, 0, 'daily rollover is independent of collecting stored growth');
  const replay = await makeStore(mock, { now: () => time }).applyAction(room.roomId, input);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.state.xp, claimed.state.xp);
  const persisted = structuredClone(mock.files.get(room.roomId).room);
  await assert.rejects(restarted.applyAction(room.roomId, claim(reward.id, 'claim-new-operation', 'client-two')), error => error.code === 'REWARD_ALREADY_CLAIMED' && error.status === 409 && /已经被领取/.test(error.message));
  assert.deepEqual(mock.files.get(room.roomId).room, persisted);
});

test('two store instances claiming one bubble award it only once after a SHA conflict', async () => {
  const mock = mockGitHub();
  const first = makeStore(mock, { now: () => CARE_START });
  const second = makeStore(mock, { now: () => CARE_START });
  const room = await first.createRoom();
  const cared = await first.applyAction(room.roomId, operation('pet-for-two-claims'));
  const rewardId = cared.state.pendingGrowth[0].id;
  const results = await Promise.allSettled([
    first.applyAction(room.roomId, claim(rewardId, 'claim-by-first', 'client-one')),
    second.applyAction(room.roomId, claim(rewardId, 'claim-by-second', 'client-two')),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'REWARD_ALREADY_CLAIMED');
  const saved = await first.getRoom(room.roomId);
  assert.equal(saved.revision, 2);
  assert.equal(saved.state.xp, room.state.xp + 3.3);
  assert.deepEqual(saved.state.pendingGrowth, []);
  assert.deepEqual(saved.state.careLimits, cared.state.careLimits, 'claiming spends no care allowance or cooldown');
  assert.equal(mock.files.get(room.roomId).room.operations.length, 2);
});

test('a failed claim write leaves the reward and XP intact and lost acknowledgments replay safely', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock, { now: () => CARE_START });
  const room = await store.createRoom();
  const cared = await store.applyAction(room.roomId, operation('pet-for-failed-claim'));
  const input = claim(cared.state.pendingGrowth[0].id, 'claim-after-failure');
  const stored = structuredClone(mock.files.get(room.roomId).room);
  mock.controls.failWrite = true;
  await assert.rejects(store.applyAction(room.roomId, input), error => error.code === 'STORAGE_WRITE_FAILED');
  assert.deepEqual(mock.files.get(room.roomId).room, stored);
  mock.controls.failWrite = false;
  mock.controls.loseAcknowledgment = true;
  await assert.rejects(store.applyAction(room.roomId, input), error => error.code === 'STORAGE_UNAVAILABLE');
  const retry = await store.applyAction(room.roomId, input);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state.xp, room.state.xp + 3.3);
  assert.deepEqual(retry.state.pendingGrowth, []);
  assert.equal(retry.revision, 2);
});

test('a legacy save gains no retroactive bubbles and corrupt pending rewards cannot be erased by a write', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock, { now: () => CARE_START });
  const room = await store.createRoom();
  const legacy = mock.files.get(room.roomId).room;
  delete legacy.state.pendingGrowth;
  legacy.state.xp = 543;
  const dressed = await store.applyAction(room.roomId, { ...operation('dress-legacy-save'), action: { type: 'dress', appearance: room.state.appearance } });
  assert.equal(dressed.state.xp, 543);
  assert.deepEqual(dressed.state.pendingGrowth, []);
  const cared = await store.applyAction(room.roomId, operation('pet-before-corrupt-reward'));
  mock.files.get(room.roomId).room.state.pendingGrowth[0].amount = -1;
  await assert.rejects(store.applyAction(room.roomId, claim(cared.state.pendingGrowth[0].id)), error => error.code === 'STORAGE_CORRUPT');
  assert.equal(mock.files.get(room.roomId).room.revision, 2);
  assert.equal(mock.files.get(room.roomId).room.state.pendingGrowth[0].amount, -1);
});

test('a growth backlog beyond the old content bound keeps every bubble readable and claimable', async () => {
  const mock = mockGitHub();
  const supplied = initialState(CARE_START);
  supplied.pendingGrowth = Array.from({ length: 3000 }, (_, index) => ({ id: `backlog-reward-${String(index).padStart(5, '0')}`, kind: 'pet', amount: 3, actorId: 'client-one', actor: '猫友', at: CARE_START + index }));
  const now = CARE_START + 365 * 24 * HOUR;
  const store = makeStore(mock, { now: () => now });
  const room = await store.createRoom({ initialState: supplied });
  const content = JSON.parse(mock.calls.find(call => call.method === 'PUT').body).content;
  assert.ok(content.length > 350_000, 'fixture exceeds the old base64 read limit');
  const restarted = makeStore(mock, { now: () => now });
  assert.deepEqual((await restarted.getRoom(room.roomId)).state.pendingGrowth, supplied.pendingGrowth);
  const claimed = await restarted.applyAction(room.roomId, claim(supplied.pendingGrowth[0].id, 'claim-oldest-backlog'));
  assert.equal(claimed.state.xp, room.state.xp + 3);
  assert.deepEqual(claimed.state.pendingGrowth, supplied.pendingGrowth.slice(1));
  assert.deepEqual((await makeStore(mock, { now: () => now }).getRoom(room.roomId)).state.pendingGrowth, supplied.pendingGrowth.slice(1));
});

test('collected XP persists above the old growth ceiling and overflow refuses without losing the bubble', async () => {
  const mock = mockGitHub();
  const store = makeStore(mock, { now: () => CARE_START });
  const room = await store.createRoom({ initialState: { ...initialState(CARE_START), xp: 999_999 } });
  const cared = await store.applyAction(room.roomId, operation('pet-beyond-old-ceiling'));
  const claimed = await store.applyAction(room.roomId, claim(cared.state.pendingGrowth[0].id, 'claim-beyond-old-ceiling'));
  assert.equal(claimed.state.xp, 1_000_002.3);
  assert.equal((await makeStore(mock, { now: () => CARE_START }).getRoom(room.roomId)).state.xp, 1_000_002.3);
  const maximum = await store.createRoom({ initialState: { ...initialState(CARE_START), xp: Number.MAX_SAFE_INTEGER } });
  const pending = await store.applyAction(maximum.roomId, operation('pet-at-safe-ceiling'));
  const stored = structuredClone(mock.files.get(maximum.roomId).room);
  await assert.rejects(store.applyAction(maximum.roomId, claim(pending.state.pendingGrowth[0].id, 'claim-at-safe-ceiling')), error => error.code === 'GROWTH_REWARD_UNAVAILABLE' && error.status === 409);
  assert.deepEqual(mock.files.get(maximum.roomId).room, stored);
});

test('large GitHub saves load immutable blobs when Contents omits inline content', async () => {
  const mock = mockGitHub();
  const supplied = initialState(CARE_START);
  supplied.pendingGrowth = Array.from({ length: 10_000 }, (_, index) => ({ id: `large-growth-${String(index).padStart(6, '0')}`, kind: 'pet', amount: 3, actorId: 'client-one', actor: '猫友', at: CARE_START + index }));
  const store = makeStore(mock, { now: () => CARE_START + 10_000 });
  const room = await store.createRoom({ initialState: supplied });
  assert.ok(Buffer.byteLength(JSON.stringify(mock.files.get(room.roomId).room), 'utf8') > 1_000_000);
  mock.controls.largeFile = true;
  const restarted = makeStore(mock, { now: () => CARE_START + 10_000 });
  const loaded = await restarted.getRoom(room.roomId);
  assert.deepEqual(loaded.state.pendingGrowth, supplied.pendingGrowth);
  assert.ok(mock.calls.some(call => call.url.endsWith('/git/blobs/sha-1')));
  const claimed = await restarted.applyAction(room.roomId, claim(supplied.pendingGrowth.at(-1).id, 'claim-large-file-last'));
  assert.equal(claimed.state.xp, room.state.xp + 3);
  assert.deepEqual(claimed.state.pendingGrowth, supplied.pendingGrowth.slice(0, -1));
  assert.equal((await makeStore(mock, { now: () => CARE_START + 10_000 }).getRoom(room.roomId)).state.pendingGrowth.length, 9999);
  mock.controls.failBlobRead = true;
  await assert.rejects(makeStore(mock).getRoom(room.roomId), error => error.code === 'STORAGE_UNAVAILABLE');
  assert.equal(mock.files.get(room.roomId).room.revision, 1);
});

test('boosted decimal growth is persisted before acknowledgment and concurrent claims count it once after decay', async () => {
  const mock=mockGitHub();
  let time=CARE_START;
  const first=makeStore(mock,{now:()=>time});
  const room=await first.createRoom({initialState:{...initialState(time),hunger:100,mood:100,energy:100}});
  const source=operation('boosted-pet-cloud-source');
  const pending=await first.applyAction(room.roomId,source);
  assert.equal(pending.state.pendingGrowth[0].amount,3.9);
  assert.equal(pending.state.pendingGrowth[0].boosted,true);
  time += 24 * HOUR;
  const second=makeStore(mock,{now:()=>time});
  assert.equal((await second.getRoom(room.roomId)).state.pendingGrowth[0].amount,3.9);
  const results=await Promise.allSettled([
    first.applyAction(room.roomId,claim(source.operationId,'boost-claim-by-one','client-one')),
    second.applyAction(room.roomId,claim(source.operationId,'boost-claim-by-two','client-two')),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'REWARD_ALREADY_CLAIMED');
  const saved=await second.getRoom(room.roomId);
  assert.equal(saved.state.xp,89.9);
  assert.deepEqual(saved.state.pendingGrowth,[]);
  assert.equal(mock.files.get(room.roomId).room.claimedGrowth[0].amount,3.9);
  assert.equal(saved.state.energy,76,'the independent saved clock includes a full day offline');
  const replay=await makeStore(mock,{now:()=>time}).applyAction(room.roomId,source);
  assert.equal(replay.duplicate,true);
  assert.equal(replay.state.xp,89.9);
});

test('server time removes expired boosts and clients cannot supply a multiplier or freeze the needs clock', async () => {
  const mock=mockGitHub();
  let time=CARE_START;
  const store=makeStore(mock,{now:()=>time});
  const room=await store.createRoom({initialState:{...initialState(time),hunger:81,mood:81,energy:81}});
  time+=HOUR;
  for(const fields of [{boosted:true},{multiplier:1.1},{needsUpdatedAt:time}]) {
    await assert.rejects(store.applyAction(room.roomId,{...operation('client-cannot-set-boost'),action:{type:'pet',...fields}}),error=>error.code==='INVALID_ACTION');
  }
  const next=await store.applyAction(room.roomId,operation('decayed-cloud-reward'));
  assert.equal(next.state.pendingGrowth[0].amount,3);
  assert.equal(next.state.pendingGrowth[0].boosted,undefined);
  assert.equal(next.state.hunger,80);
  const file=mock.files.get(room.roomId);
  file.room.state.needsUpdatedAt=-1;
  await assert.rejects(makeStore(mock,{now:()=>time}).getRoom(room.roomId),error=>error.code==='STORAGE_CORRUPT');
  assert.equal(file.room.revision,1);
});

test('energy recovery is saved once across store restarts and keeps working after the sleep quota', async () => {
  const mock=mockGitHub(), time=CARE_START;
  const store=makeStore(mock,{now:()=>time});
  const state={...initialState(time),hunger:100,mood:100,energy:76};
  state.careLimits.counts.sleep=CARE_LIMITS.sleep.dailyLimit;
  const room=await store.createRoom({initialState:state});
  await assert.rejects(store.applyAction(room.roomId,operation('exhausted-sleep-energy','sleep')),error=>error.code==='DAILY_CARE_LIMIT');
  const water={...operation('energy-water-source'),action:{type:'feed',food:'water'}};
  const recovered=await store.applyAction(room.roomId,water);
  assert.equal(recovered.state.energy,88);
  assert.equal(recovered.state.pendingGrowth[0].amount,6);
  assert.equal(recovered.state.careLimits.counts.feed,1);
  const restarted=makeStore(mock,{now:()=>time});
  const replay=await restarted.applyAction(room.roomId,water);
  assert.equal(replay.duplicate,true);
  assert.equal(replay.state.energy,88);
  const read=await makeStore(mock,{now:()=>time}).getRoom(room.roomId);
  assert.equal(read.state.energy,88);
  assert.equal(read.state.careLimits.counts.sleep,3);
  const next=await restarted.applyAction(room.roomId,operation('energy-recovered-growth'));
  assert.equal(next.state.pendingGrowth[1].amount,3.9);
  assert.equal(next.state.xp,room.state.xp);
});
