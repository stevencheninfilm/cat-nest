import test from 'node:test';
import assert from 'node:assert/strict';
import { CARE_LIMITS, initialState, normalizeState, reduceAction, validPendingGrowth, careActionInfo, feedingInfo } from '../src/state.js';

const start = Date.UTC(2026, 9, 13, 0);
const alice = { id: 'partner-male', name: '男方' };
const bob = { id: 'partner-female', name: '女方' };
const care = (state, type, now = start, operationId = `growth-${type}-operation`) => reduceAction(state, { type, ...(type === 'feed' ? { food: 'fish' } : {}) }, alice, now, operationId);

test('each accepted care creates one persistent bubble without counting its growth yet', () => {
  for (const [kind, amount] of Object.entries({ feed: 55, pet: 3.3, play: 8.8, sleep: 4.4 })) {
    const before = initialState(start);
    const after = care(before, kind);
    assert.equal(after.xp, before.xp, kind);
    assert.deepEqual(after.pendingGrowth, [{
      id: `growth-${kind}-operation`, kind, amount, actorId: alice.id, actor: alice.name,
      ...(kind === 'feed' ? { food: 'fish' } : {}), boosted:true, boostCount:1, at: start,
    }]);
    assert.equal(validPendingGrowth(after.pendingGrowth), true);
    assert.equal(after.careLimits.counts[kind], 1, 'the action uses its allowance immediately');
    assert.match(after.history[0].text, /成长气泡待领取/);
    assert.deepEqual(before.pendingGrowth, [], 'creating a reward cannot mutate the input snapshot');
    const claimed = reduceAction(after, { type: 'claim-growth', rewardId: after.pendingGrowth[0].id }, bob, start + 1);
    assert.equal(claimed.xp, before.xp + amount);
    assert.deepEqual(claimed.pendingGrowth, []);
    assert.deepEqual(claimed.careLimits, after.careLimits, 'either caregiver can claim shared growth without consuming care allowance');
    for (const key of ['coins', 'love', 'hunger', 'mood', 'energy', 'sleeping', 'appearance', 'feedRecords', 'feedingWindow']) assert.deepEqual(claimed[key], after[key], key);
    assert.match(claimed.history[0].text, new RegExp(`${amount}点成长`));
    assert.equal(claimed.history[0].actor, bob.name);
    assert.equal(after.pendingGrowth.length, 1);
    assert.equal(reduceAction(claimed, { type: 'claim-growth', rewardId: after.pendingGrowth[0].id }, alice, start + 2), null, 'a claimed bubble cannot be counted a second time');
  }
});

test('no timer, reload, midnight reset, rename, dress or wake can discard an unclaimed bubble', () => {
  const asleep = care(initialState(start), 'sleep');
  let state = JSON.parse(JSON.stringify(asleep));
  const later = start + 365 * 24 * 3600_000;
  state = normalizeState(state, later);
  assert.deepEqual(state.pendingGrowth, asleep.pendingGrowth);
  state = reduceAction(state, { type: 'sleep' }, bob, later);
  state = reduceAction(state, { type: 'rename', name: '汤圆' }, bob, later);
  state = reduceAction(state, { type: 'dress', appearance: { body: 2, clothes: 1, eyes: 1, wand: 1 } }, bob, later);
  assert.deepEqual(state.pendingGrowth, asleep.pendingGrowth);
  assert.equal(state.xp, asleep.xp);
  assert.equal(state.careLimits.counts.sleep, 0, 'waking after midnight has no new reward or charge');
  const claimed = reduceAction(state, { type: 'claim-growth', rewardId: state.pendingGrowth[0].id }, alice, later);
  assert.equal(claimed.xp, asleep.xp + 4.4);
});

test('more than one hundred unclaimed rewards remain separate and can each still be claimed', () => {
  let state = initialState(start);
  for (let index = 0; index < 120; index += 1) {
    state = care(state, 'pet', start + index * 24 * 3600_000, `older-growth-${index}`);
    assert.ok(state);
  }
  assert.equal(state.pendingGrowth.length, 120);
  assert.equal(state.xp, initialState(start).xp);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(state)), start + 1_000 * 24 * 3600_000);
  assert.deepEqual(reloaded.pendingGrowth, state.pendingGrowth);
  for (const reward of state.pendingGrowth) state = reduceAction(state, { type: 'claim-growth', rewardId: reward.id }, bob, start + 1_000 * 24 * 3600_000);
  assert.deepEqual(state.pendingGrowth, []);
  assert.equal(state.xp, initialState(start).xp + 3.3 + 119 * 3);
});

test('legacy saves never reinterpret awarded XP or old history as new bubbles', () => {
  const legacy = { ...initialState(start), xp: 912, history: [{ text: '喂了一份营养猫粮', actor: '女方', at: start - 1 }] };
  delete legacy.pendingGrowth;
  const normalized = normalizeState(legacy, start);
  assert.equal(normalized.xp, 912);
  assert.deepEqual(normalized.history, legacy.history);
  assert.deepEqual(normalized.pendingGrowth, []);
});

test('invalid or duplicate rewards are rejected by validation while normalization copies every valid reward', () => {
  const reward = care(initialState(start), 'feed').pendingGrowth[0];
  for (const invalid of [
    null, {}, { ...reward, id: 'short' }, { ...reward, id: 'x'.repeat(181) },
    { ...reward, id: '<bad-id>' }, { ...reward, kind: 'rename' }, { ...reward, amount: -1 },
    { ...reward, amount: 500 }, { ...reward, amount: 3.5 }, { ...reward, actorId: '<bad>' },
    { ...reward, actor: '\u0000男方' }, { ...reward, food: 'toString' }, { ...reward, at: Infinity },
    { ...reward, extra: true }, { ...reward, kind: 'pet', amount: 3 },
  ]) assert.equal(validPendingGrowth([invalid]), false);
  assert.equal(validPendingGrowth([reward, reward]), false);
  assert.equal(validPendingGrowth(null), false);
  assert.equal(validPendingGrowth([]), true);
  const state = { ...initialState(start), pendingGrowth: [null, reward, { ...reward, id: 'another-reward', at: start + 60_000_000 }] };
  const normalized = normalizeState(state, start);
  assert.equal(normalized.pendingGrowth.length, 2, 'rollback and future timestamps do not expire already-earned rewards');
  normalized.pendingGrowth[0].amount = 10;
  assert.equal(reward.amount, 55, 'normalization copies reward objects');
});

test('rejected care, invalid claims and duplicate reward IDs preserve all resources and pending growth', () => {
  const first = care(initialState(start), 'pet');
  const snapshot = structuredClone(first);
  assert.equal(care(first, 'pet', start + 1, 'new-pet-growth'), null);
  assert.equal(care(first, 'play', start + 1, first.pendingGrowth[0].id), null);
  assert.equal(care(first, 'play', start + 1, '<bad-id>'), null);
  assert.equal(reduceAction({ ...first, coins: 0 }, { type: 'feed', food: 'fish' }, alice, start + 1), null);
  assert.equal(reduceAction({ ...first, energy: 0 }, { type: 'play' }, alice, start + 1), null);
  for (const rewardId of ['missing-reward', 'short', '<bad>', null, undefined, {}]) assert.equal(reduceAction(first, { type: 'claim-growth', rewardId }, alice, start + 1), null);
  assert.deepEqual(first, snapshot);
  for (const [kind, rule] of Object.entries(CARE_LIMITS)) first.careLimits.counts[kind] = rule.dailyLimit;
  const claimed = reduceAction(first, { type: 'claim-growth', rewardId: first.pendingGrowth[0].id }, bob, start + 1);
  assert.ok(claimed, 'daily limits do not block collection');
  assert.deepEqual(claimed.careLimits.counts, first.careLimits.counts);
});

test('anonymous care uses a stable local actor and deterministic fallback ID', () => {
  const first = reduceAction(initialState(start), { type: 'pet' }, { name: ' 小\u0000雨 ' }, start);
  assert.deepEqual(first.pendingGrowth[0], { id: `pet:local-care:${start}`, kind: 'pet', amount: 3.3, actorId: 'local-care', actor: '小雨', boosted:true, boostCount:1, at: start });
});

test('claiming growth never discards reward value at the former XP ceiling', () => {
  const before = care({ ...initialState(start), xp: 999998 }, 'feed');
  const after = reduceAction(before, { type: 'claim-growth', rewardId: before.pendingGrowth[0].id }, alice, start + 1);
  assert.equal(after.xp, 1_000_053);
  assert.equal(normalizeState(JSON.parse(JSON.stringify(after)), start + 2).xp, after.xp);
  const overflow = { ...before, xp: Number.MAX_SAFE_INTEGER - 1 };
  const snapshot = structuredClone(overflow);
  assert.equal(reduceAction(overflow, { type: 'claim-growth', rewardId: before.pendingGrowth[0].id }, alice, start + 1), null);
  assert.deepEqual(overflow, snapshot, 'numeric overflow preserves the whole unclaimed reward');
});

test('countdown selectors never traverse or clone an unbounded pending reward collection', () => {
  const fed = care(initialState(start), 'feed');
  const now = start + 1_234;
  const expectedCare = careActionInfo(fed, { type: 'feed' }, alice.id, now);
  const expectedFeeding = feedingInfo(fed, alice.id, now);
  const rewards = new Proxy(fed.pendingGrowth, { get() { throw new Error('countdown selectors must not read reward collection contents'); } });
  const snapshot = { ...fed, pendingGrowth: rewards };
  assert.deepEqual(careActionInfo(snapshot, { type: 'feed' }, alice.id, now), expectedCare);
  assert.deepEqual(feedingInfo(snapshot, alice.id, now), expectedFeeding);
  assert.equal(snapshot.pendingGrowth, rewards, 'the saved collection remains untouched');
  assert.equal(fed.pendingGrowth.length, 1);
  for (const input of [null, undefined, false, 'old-save']) {
    assert.doesNotThrow(() => careActionInfo(input, { type: 'pet' }, alice.id, now));
    assert.doesNotThrow(() => feedingInfo(input, alice.id, now));
  }
});
