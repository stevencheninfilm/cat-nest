import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore } from '../server/github-store.mjs';
import { initialState, validPendingGrowth } from '../src/state.js';

const START = Date.UTC(2026, 9, 14, 0);
const DAY = 24 * 3600_000;
const clone = value => structuredClone(value);
const input = (operationId, action, clientId = 'client-one') => ({ operationId, clientId, name: '猫友', action });
const feed = operationId => input(operationId, { type: 'feed', food: 'fish' });
const claim = (rewardId, operationId = 'claim-durable-growth', clientId = 'client-one') => input(operationId, { type: 'claim-growth', rewardId }, clientId);

function harness() {
  const files = new Map();
  const calls = [];
  const commits = [];
  const controls = { failWrite: false, loseAcknowledgment: false };
  let sha = 0;
  let now = START;
  async function fetchImpl(url, options) {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    const id = new URL(url).pathname.split('/').at(-1).replace('.json', '');
    const existing = files.get(id);
    calls.push({ id, method: options.method });
    if (options.method === 'GET') {
      if (!existing) return new Response('{}', { status: 404 });
      if (options.headers['If-None-Match'] === existing.sha) return new Response(null, { status: 304 });
      return Response.json({
        sha: existing.sha, encoding: 'base64',
        content: Buffer.from(JSON.stringify(existing.room)).toString('base64'),
      }, { headers: { etag: existing.sha } });
    }
    assert.equal(options.method, 'PUT');
    if (controls.failWrite) return new Response('{}', { status: 500 });
    const body = JSON.parse(options.body);
    if ((existing && existing.sha !== body.sha) || (!existing && body.sha)) return new Response('{}', { status: 409 });
    const room = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    files.set(id, { sha: `sha-${++sha}`, room });
    commits.push(clone(room));
    if (controls.loseAcknowledgment) {
      controls.loseAcknowledgment = false;
      throw new Error('The mock connection closed after the GitHub commit');
    }
    return new Response('{}', { status: existing ? 200 : 201 });
  }
  return {
    files, calls, commits, controls,
    at: value => { now = value; },
    store: () => createGitHubStore({ token: 'mock-only', repository: 'test/durable-growth', fetchImpl, now: () => now }),
    saved: roomId => files.get(roomId).room,
  };
}

async function evictOperations(store, roomId, prefix, count = 140) {
  for (let index = 0; index < count; index += 1) {
    await store.applyAction(roomId, input(`${prefix}-${index}`, { type: 'rename', name: `糯米${index}` }));
  }
}

function privateReceipts(result) {
  assert.equal(Object.hasOwn(result, 'claimedGrowth'), false, 'claim receipts stay in the room envelope');
  assert.equal(Object.hasOwn(result.state, 'claimedGrowth'), false, 'public pet state contains no private receipt ledger');
}

test('claimed source operations remain idempotent after eviction, one year and a store restart', async () => {
  const h = harness();
  const store = h.store();
  const room = await store.createRoom();
  const original = feed('durable-original-feeding');
  const fed = await store.applyAction(room.roomId, original);
  const reward = clone(fed.state.pendingGrowth[0]);
  const collected = await store.applyAction(room.roomId, claim(reward.id));
  assert.equal(collected.state.xp, room.state.xp + 55);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, [reward], 'the same commit saves the full immutable reward receipt');
  assert.equal(validPendingGrowth(h.saved(room.roomId).claimedGrowth), true);
  privateReceipts(room);
  privateReceipts(fed);
  privateReceipts(collected);

  await evictOperations(store, room.roomId, 'evict-claimed-operation');
  assert.equal(h.saved(room.roomId).operations.length, 100);
  assert.equal(h.saved(room.roomId).operations.some(operation => operation.id === original.operationId), false);
  h.at(START + 365 * DAY);
  const restarted = h.store();
  const before = await restarted.getRoom(room.roomId);
  const commitsBefore = h.commits.length;
  const replay = await restarted.applyAction(room.roomId, original);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.revision, before.revision);
  assert.deepEqual(replay.state, before.state, 'replay cannot change coins, intimacy, XP, care limits or pending growth');
  assert.deepEqual(replay.event, { operationId: original.operationId, action: original.action, actor: { id: original.clientId, name: original.name } });
  assert.deepEqual(replay.state.pendingGrowth, []);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, [reward]);
  assert.equal(h.commits.length, commitsBefore, 'a permanent duplicate must not create another GitHub write');
  privateReceipts(replay);
  privateReceipts(await restarted.getRoom(room.roomId));

  await assert.rejects(restarted.applyAction(room.roomId, claim(reward.id, 'brand-new-claim-operation')), error => error.code === 'REWARD_ALREADY_CLAIMED' && error.status === 409);
  for (const conflicting of [
    { ...original, clientId: 'client-two' },
    { ...original, action: { type: 'feed', food: 'chicken' } },
    { ...original, action: { type: 'pet' } },
    { ...original, action: { type: 'rename', name: '另一只猫' } },
  ]) {
    await assert.rejects(restarted.applyAction(room.roomId, conflicting), error => error.code === 'OPERATION_CONFLICT' && error.status === 409);
  }
  assert.deepEqual((await restarted.getRoom(room.roomId)).state, before.state);
  assert.equal(h.commits.length, commitsBefore, 'conflicts never write or regenerate the collected bubble');
});

test('an unclaimed reward permanently deduplicates its source request independently of recent operation history', async () => {
  const h = harness();
  const store = h.store();
  const room = await store.createRoom();
  const original = feed('durable-unclaimed-feeding');
  const fed = await store.applyAction(room.roomId, original);
  await evictOperations(store, room.roomId, 'evict-pending-operation');
  h.at(START + 365 * DAY);
  const restarted = h.store();
  const before = await restarted.getRoom(room.roomId);
  const commitsBefore = h.commits.length;
  const replay = await restarted.applyAction(room.roomId, { ...original, name: '改过昵称的猫友' });
  assert.equal(replay.duplicate, true, 'the stable actor ID identifies the existing reward even after a nickname change');
  assert.deepEqual(replay.state, before.state);
  assert.deepEqual(replay.state.pendingGrowth, fed.state.pendingGrowth);
  assert.equal(h.commits.length, commitsBefore);
  await assert.rejects(restarted.applyAction(room.roomId, { ...original, clientId: 'client-two' }), error => error.code === 'OPERATION_CONFLICT');
  const collected = await restarted.applyAction(room.roomId, claim(fed.state.pendingGrowth[0].id));
  assert.equal(collected.state.xp, room.state.xp + 55);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, fed.state.pendingGrowth);
});

test('more than one hundred receipt records retain their full reward value without an age or count cutoff', async () => {
  const h = harness();
  const store = h.store();
  const room = await store.createRoom();
  const receipts = [];
  for (let index = 0; index < 150; index += 1) {
    h.at(START + index * DAY);
    const cared = await store.applyAction(room.roomId, input(`permanent-pet-${index}`, { type: 'pet' }));
    const reward = cared.state.pendingGrowth[0];
    receipts.push(clone(reward));
    await store.applyAction(room.roomId, claim(reward.id, `permanent-claim-${index}`));
  }
  assert.equal(h.saved(room.roomId).operations.length, 100);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, receipts);
  assert.equal(validPendingGrowth(receipts), true);
  h.at(START + 515 * DAY);
  const restarted = h.store();
  const before = await restarted.getRoom(room.roomId);
  assert.equal(before.state.xp, room.state.xp + 3.3 + 149 * 3);
  assert.deepEqual(before.state.pendingGrowth, []);
  assert.equal((await restarted.applyAction(room.roomId, input('permanent-pet-0', { type: 'pet' }))).duplicate, true);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, receipts);
  privateReceipts(before);
});

test('malformed, duplicated and overlapping private receipts fail closed before a read or write can erase them', async () => {
  const h = harness();
  const store = h.store();
  const room = await store.createRoom();
  const fed = await store.applyAction(room.roomId, feed('receipt-validation-feed'));
  const reward = clone(fed.state.pendingGrowth[0]);
  await store.applyAction(room.roomId, claim(reward.id));
  const valid = clone(h.saved(room.roomId));
  const corruptLists = [
    null, {}, [reward, reward],
    [{ ...reward, amount: -1 }], [{ ...reward, amount: 500 }],
    [{ ...reward, id: '<bad-id>' }], [{ ...reward, actorId: '<bad-actor>' }],
    [{ ...reward, kind: 'rename' }], [{ ...reward, extra: 'untrusted' }],
  ];
  for (const claimedGrowth of corruptLists) {
    h.saved(room.roomId).claimedGrowth = clone(claimedGrowth);
    const commitsBefore = h.commits.length;
    const restarted = h.store();
    await assert.rejects(restarted.getRoom(room.roomId), error => error.code === 'STORAGE_CORRUPT');
    await assert.rejects(restarted.applyAction(room.roomId, input('never-write-over-corrupt', { type: 'rename', name: '糯米' })), error => error.code === 'STORAGE_CORRUPT');
    assert.equal(h.commits.length, commitsBefore);
  }
  h.files.get(room.roomId).room = valid;
  h.saved(room.roomId).state.pendingGrowth = [reward];
  await assert.rejects(h.store().getRoom(room.roomId), error => error.code === 'STORAGE_CORRUPT', 'a reward cannot simultaneously be pending and permanently claimed');
});

test('a large valid receipt ledger remains readable without removing entries or raising unrelated field limits', async () => {
  const h = harness();
  const store = h.store();
  const room = await store.createRoom();
  const fed = await store.applyAction(room.roomId, feed('large-receipt-seed'));
  const reward = fed.state.pendingGrowth[0];
  await store.applyAction(room.roomId, claim(reward.id));
  const receipts = Array.from({ length: 4000 }, (_, index) => ({ ...reward, id: `large-claimed-reward-${index}` }));
  h.saved(room.roomId).claimedGrowth = receipts;
  assert.equal(validPendingGrowth(receipts), true);
  assert.ok(Buffer.from(JSON.stringify(h.saved(room.roomId))).toString('base64').length > 350_000);
  h.at(START + 365 * DAY);
  const restarted = h.store();
  const loaded = await restarted.getRoom(room.roomId);
  privateReceipts(loaded);
  const original = feed(receipts[3999].id);
  const replay = await restarted.applyAction(room.roomId, original);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, receipts);
  h.saved(room.roomId).unrelatedOversizedField = 'x'.repeat(400_000);
  await assert.rejects(h.store().getRoom(room.roomId), error => error.code === 'STORAGE_CORRUPT');
});

test('a failed receipt commit keeps the reward unclaimed and a lost acknowledgment replays a single atomic receipt', async () => {
  const h = harness();
  const store = h.store();
  const room = await store.createRoom({ initialState: initialState(START) });
  const fed = await store.applyAction(room.roomId, feed('atomic-receipt-feed'));
  const reward = fed.state.pendingGrowth[0];
  const request = claim(reward.id, 'atomic-receipt-claim');
  const before = clone(h.saved(room.roomId));
  h.controls.failWrite = true;
  await assert.rejects(store.applyAction(room.roomId, request), error => error.code === 'STORAGE_WRITE_FAILED');
  assert.deepEqual(h.saved(room.roomId), before, 'failed persistence changes neither the reward, XP nor private receipts');
  h.controls.failWrite = false;
  h.controls.loseAcknowledgment = true;
  await assert.rejects(store.applyAction(room.roomId, request), error => error.code === 'STORAGE_UNAVAILABLE');
  const committed = h.saved(room.roomId);
  assert.equal(committed.state.xp, fed.state.xp + reward.amount);
  assert.deepEqual(committed.state.pendingGrowth, []);
  assert.deepEqual(committed.claimedGrowth, [reward]);
  const commitsBefore = h.commits.length;
  const retry = await h.store().applyAction(room.roomId, request);
  assert.equal(retry.duplicate, true);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, [reward]);
  assert.equal(h.commits.length, commitsBefore);
});

test('conflicting claim writes from two store instances persist one receipt and one XP increase', async () => {
  const h = harness();
  const first = h.store(), second = h.store();
  const room = await first.createRoom();
  const fed = await first.applyAction(room.roomId, feed('parallel-receipt-feed'));
  const reward = fed.state.pendingGrowth[0];
  const results = await Promise.allSettled([
    first.applyAction(room.roomId, claim(reward.id, 'parallel-claim-first', 'client-one')),
    second.applyAction(room.roomId, claim(reward.id, 'parallel-claim-second', 'client-two')),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'REWARD_ALREADY_CLAIMED');
  assert.equal(h.saved(room.roomId).state.xp, fed.state.xp + reward.amount);
  assert.deepEqual(h.saved(room.roomId).claimedGrowth, [reward]);
  assert.deepEqual(h.saved(room.roomId).state.pendingGrowth, []);
});
