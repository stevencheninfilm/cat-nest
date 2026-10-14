import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, FEEDING_WINDOW_MS, FEEDING_BONUS, initialState, normalizeState, reduceAction, feedingInfo } from '../src/state.js';

const start = 1_800_000_000_000;
const alice = { id: 'client-alice', name: '小雨' };
const bob = { id: 'client-bobby', name: '小雨' };
const third = { id: 'client-third', name: '第三位猫友' };
const feed = (state, actor, now = start, food = 'meal') => reduceAction(state, { type: 'feed', food }, actor, now);

test('all nine foods charge their documented price and preserve the original food values', () => {
  assert.deepEqual(FOODS, {
    snack: { name: '冻干小鱼', cost: 10, love: 10, hunger: 10 },
    meal: { name: '营养猫粮', cost: 20, love: 25, hunger: 22 },
    fish: { name: '鲜鱼罐罐', cost: 40, love: 50, hunger: 35 },
    chicken: { name: '鸡胸肉', cost: 30, love: 35, hunger: 28 },
    shrimp: { name: '鲜虾小餐', cost: 30, love: 30, hunger: 24 },
    salmon: { name: '三文鱼块', cost: 45, love: 45, hunger: 32 },
    mousse: { name: '幼猫慕斯', cost: 35, love: 40, hunger: 30 },
    treat: { name: '猫咪肉条', cost: 15, love: 15, hunger: 12 },
    water: { name: '清清饮水', cost: 5, love: 5, hunger: 0 },
  });
  for (const [key, food] of Object.entries(FOODS)) {
    const before = { ...initialState(start), hunger: 10 };
    const after = feed(before, alice, start, key);
    assert.equal(after.coins, before.coins - food.cost, key);
    assert.equal(after.love, before.love + food.love, key);
    assert.equal(after.hunger, before.hunger + food.hunger, key);
    assert.equal(after.feedRecords[0].food, key);
  }
});

test('old version-one saves retain progress, timestamps and diary without inventing feeding records', () => {
  const legacy = { version: 1, name: '糯米', coins: 100, love: 200, xp: 300, hunger: 40, mood: 50, energy: 60, sleeping: true, history: [{ text: '旧日记', actor: '小雨', at: start - 1_000 }], updatedAt: start - 500 };
  const result = normalizeState(legacy, start);
  for (const [key, value] of Object.entries(legacy)) assert.deepEqual(result[key], value);
  assert.deepEqual(result.feedRecords, []);
  assert.deepEqual(result.pendingGrowth, []);
  assert.equal(result.feedingWindow, null);
  assert.equal(feedingInfo(result, alice.id, start).windowEndsAt, null);
  assert.equal(feed(result, alice, start).version, 1);
});

test('invalid and inherited food keys fail without charging currency or creating records', () => {
  const before = initialState(start);
  for (const key of ['steak', 'toString', '__proto__', 'constructor', null, undefined, {}]) assert.equal(reduceAction(before, { type: 'feed', food: key }, alice, start), null);
  assert.equal(reduceAction(before, null, alice, start), null);
  assert.deepEqual(before.feedRecords, []);
  assert.equal(feed({ ...before, coins: 0 }, alice), null);
});

test('same-name caregivers have separate records and earn exactly one pair bonus per window', () => {
  const before = initialState(start);
  const first = feed(before, alice);
  const repeat = feed(first, alice, start + 1_000);
  assert.equal(repeat, null, 'repeat feeding cannot buy growth during cooldown');
  assert.equal(first.feedRecords.length, 1);
  assert.equal(feedingInfo(first, alice.id, start + 1_000).waitingForPartner, true);
  const together = feed(first, bob, start + 2_000);
  assert.equal(together.love, before.love + 2 * FOODS.meal.love + FEEDING_BONUS);
  assert.equal(together.xp, before.xp);
  assert.deepEqual(together.pendingGrowth.map(reward => reward.amount), [FOODS.meal.love, FOODS.meal.love + FEEDING_BONUS]);
  const claimed = together.pendingGrowth.reduce((state, reward) => reduceAction(state, { type: 'claim-growth', rewardId: reward.id }, alice, start + 2_001), together);
  assert.equal(claimed.xp, before.xp + 2 * FOODS.meal.love + FEEDING_BONUS);
  assert.deepEqual(claimed.pendingGrowth, []);
  assert.deepEqual(together.feedRecords.map(record => record.actorId), [alice.id, bob.id]);
  assert.equal(together.feedingWindow.bonusClaimed, true);
  assert.match(together.history[0].text, /双人喂养/);
  assert.equal(feed(together, alice, start + 3_000), null);
  assert.equal(feed(together, bob, start + 4_000), null);
  assert.equal(together.history.length, 2, 'one diary entry per accepted action');
  assert.equal(before.feedRecords.length, 0, 'input state is never changed');
});

test('serializing simultaneous feeds in either order produces the same one-time reward', () => {
  const before = initialState(start);
  for (const actors of [[alice, bob], [bob, alice]]) {
    const after = actors.reduce((state, actor) => feed(state, actor, start), before);
    assert.equal(after.love, before.love + 2 * FOODS.meal.love + FEEDING_BONUS);
    assert.equal(after.feedRecords.length, 2);
    assert.equal(after.feedingWindow.startedAt, start);
    assert.equal(after.feedingWindow.bonusClaimed, true);
  }
});

test('the shared round does not extend when a caregiver feeds repeatedly', () => {
  const first = feed(initialState(start), alice);
  const repeat = feed(first, alice, start + FEEDING_WINDOW_MS - 1);
  assert.equal(repeat, null);
  assert.equal(first.feedingWindow.startedAt, start);
  const info = feedingInfo(first, alice.id, start + FEEDING_WINDOW_MS - 1);
  assert.equal(info.windowRemainingMs, 1);
  assert.equal(info.mine.remainingMs, 1, 'rejected feeds do not extend the meal timer');
  const nextRound = feed(first, bob, start + FEEDING_WINDOW_MS);
  assert.equal(nextRound.feedingWindow.startedAt, start + FEEDING_WINDOW_MS);
  assert.equal(nextRound.feedingWindow.bonusClaimed, false, 'previous-round meal cannot complete the new round');
  const completed = feed(nextRound, alice, start + FEEDING_WINDOW_MS + 1);
  assert.equal(completed.love, nextRound.love + FOODS.meal.love + FEEDING_BONUS);
});

test('each new four-hour round requires fresh feeds from both caregivers', () => {
  const together = feed(feed(initialState(start), alice), bob, start + 1);
  const a = feed(together, alice, start + FEEDING_WINDOW_MS);
  assert.equal(a.feedingWindow.bonusClaimed, false);
  assert.equal(a.love, together.love + FOODS.meal.love);
  const aAgain = feed(a, alice, start + FEEDING_WINDOW_MS + 1);
  assert.equal(aAgain, null);
  const b = feed(a, bob, start + FEEDING_WINDOW_MS + 2);
  assert.equal(b.love, a.love + FOODS.meal.love + FEEDING_BONUS);
});

test('a third ID cannot replace active records or collect another pair bonus', () => {
  const together = feed(feed(initialState(start), alice), bob, start + 1);
  const untracked = feed(together, third, start + 2);
  assert.equal(untracked.love, together.love + FOODS.meal.love);
  assert.deepEqual(untracked.feedRecords, together.feedRecords);
  assert.equal(feedingInfo(untracked, third.id, start + 2).mine, null);
  const expired = feed(untracked, third, start + FEEDING_WINDOW_MS + 2);
  assert.equal(expired.feedRecords.length, 2);
  assert.deepEqual(expired.feedRecords.map(record => record.actorId), [third.id, bob.id]);
  assert.equal(expired.feedingWindow.bonusClaimed, false);
});

test('offline records survive unrelated actions, normalization and countdown expiry', () => {
  const before = feed(feed(initialState(start), alice), bob, start + 1);
  const after = reduceAction(before, { type: 'pet' }, alice, start + FEEDING_WINDOW_MS + 2);
  assert.deepEqual(after.feedRecords, before.feedRecords);
  const info = feedingInfo(after, alice.id, start + FEEDING_WINDOW_MS + 2);
  assert.equal(info.records.length, 2);
  assert.equal(info.mine.remainingMs, 0);
  assert.equal(info.partner.remainingMs, 0);
  assert.equal(info.windowRemainingMs, 0);
  assert.equal(info.windowActive, false);
  assert.equal(info.hasFed, false);
  assert.equal(info.bonusEligible, false);
});

test('feedingInfo is deterministic, read-only and returns exact countdown boundaries', () => {
  const state = feed(initialState(start), alice);
  const snapshot = JSON.stringify(state);
  const info = feedingInfo(state, alice.id, start + 1_234);
  assert.deepEqual(feedingInfo(state, alice.id, start + 1_234), info);
  assert.equal(info.mine.remainingMs, FEEDING_WINDOW_MS - 1_234);
  assert.equal(info.windowEndsAt, start + FEEDING_WINDOW_MS);
  assert.equal(info.windowRemainingMs, FEEDING_WINDOW_MS - 1_234);
  assert.equal(info.records[0].isMine, true);
  assert.equal(info.partner, null);
  info.records[0].name = 'changed';
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(feedingInfo(state, alice.id, start + FEEDING_WINDOW_MS - 1).mine.active, true);
  assert.equal(feedingInfo(state, alice.id, start + FEEDING_WINDOW_MS).mine.active, false);
});

test('record normalization rejects invalid IDs, duplicate slots, unknown foods and future timestamps', () => {
  const record = { actorId: alice.id, name: '  小\u0000雨  ', food: 'meal', at: start };
  const normalized = normalizeState({ ...initialState(start), feedRecords: [
    null, { ...record, actorId: 'short' }, { ...record, actorId: 'x'.repeat(81) },
    { ...record, actorId: '<bad-id>' }, { ...record, food: 'toString' },
    { ...record, at: start + FEEDING_WINDOW_MS }, { ...record, at: Infinity },
    record, { ...record, at: start + 1 }, { ...record, actorId: bob.id }, { ...record, actorId: third.id },
  ], feedingWindow: { startedAt: start + FEEDING_WINDOW_MS, bonusClaimed: true }, updatedAt: start - 123 }, start + 1);
  assert.deepEqual(normalized.feedRecords, [{ ...record, name: '小雨', at: start + 1 }, { ...record, actorId: bob.id, name: '小雨' }]);
  assert.equal(normalized.feedingWindow, null);
  assert.equal(normalized.updatedAt, start - 123);
});

test('missing actor identity cannot claim a teammate slot or earn a pair bonus', () => {
  const before = feed(initialState(start), alice);
  for (const actor of [undefined, null, { name: '小雨' }, { id: 'short', name: '小雨' }]) {
    assert.equal(feed(before, actor, start + 1), null, 'anonymous feeds share the room fallback cooldown');
    const after = feed(before, actor, start + FEEDING_WINDOW_MS);
    assert.equal(after.love, before.love + FOODS.meal.love);
    assert.deepEqual(after.feedRecords, before.feedRecords);
    assert.equal(after.feedingWindow.bonusClaimed, false);
  }
});
