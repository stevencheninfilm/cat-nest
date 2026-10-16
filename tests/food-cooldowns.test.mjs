import test from 'node:test';
import assert from 'node:assert/strict';
import { FOOD_COOLDOWN_MS, FEEDING_WINDOW_MS, FEEDING_BONUS, FOODS, CARE_LIMITS, initialState, normalizeState, reduceAction, careActionInfo, feedingInfo, validCareLimits } from '../src/state.js';
import { feedingSheet } from '../src/feeding-ui.js';

const now = Date.parse('2026-10-14T00:00:00Z');
const male = { id:'partner-male', name:'男方' };
const female = { id:'partner-female', name:'女方' };
const minutes = { water:30, snack:45, treat:60, meal:90, shrimp:120, chicken:150, mousse:180, salmon:210, fish:240 };

for (const [food, duration] of Object.entries(minutes)) {
  test(`${food} retains its ${duration}-minute cooldown after reload and switching menu foods`, () => {
    assert.equal(FOOD_COOLDOWN_MS[food], duration * 60_000);
    const fed = reduceAction(initialState(now), { type:'feed', food }, male, now);
    const reloaded = JSON.parse(JSON.stringify(fed));
    const until = now + duration * 60_000;
    assert.equal(feedingInfo(reloaded, male.id, now).mine.expiresAt, until);
    assert.equal(reloaded.careLimits.feedCooldowns[0].food, food);
    assert.equal(validCareLimits(reloaded.careLimits), true);
    for (const selected of ['water', 'fish']) {
      const action = { type:'feed', food:selected };
      const info = careActionInfo(reloaded, action, male.id, until - 1);
      assert.equal(info.remainingMs, 1);
      assert.equal(info.cooldownMs, duration * 60_000);
      assert.equal(reduceAction(reloaded, action, male, until - 1), null);
      assert.ok(reduceAction(reloaded, action, male, until));
    }
    assert.ok(reduceAction(reloaded, { type:'feed', food:'water' }, female, now + 1));
    assert.deepEqual(reloaded, fed, 'checking or rejecting care must leave the saved state unchanged');
  });
}

test('legacy ledgers infer a meal-specific duration only from their own matching record', () => {
  const legacy = reduceAction(initialState(now), { type:'feed', food:'water' }, male, now);
  delete legacy.careLimits.feedCooldowns[0].food;
  const snapshot = JSON.stringify(legacy);
  assert.equal(careActionInfo(legacy, { type:'feed', food:'fish' }, male.id, now + 1000).remainingMs, 29 * 60_000 + 59_000);
  assert.equal(careActionInfo(legacy, { type:'feed' }, male.id, now + 30 * 60_000).allowed, true);
  const unknown = structuredClone(legacy);
  unknown.careLimits.feedCooldowns[0].at += 1000;
  assert.equal(careActionInfo(unknown, { type:'feed', food:'water' }, male.id, now + 1000).remainingMs, FEEDING_WINDOW_MS);
  assert.equal(JSON.stringify(legacy), snapshot);
  const restored = normalizeState(legacy, now + 1000);
  for (const key of ['xp', 'love', 'coins', 'history', 'pendingGrowth']) assert.deepEqual(restored[key], legacy[key]);
});

test('food cooldowns cross midnight while the shared daily quota resets', () => {
  const late = Date.parse('2026-10-14T15:59:00Z');
  const fed = reduceAction(initialState(late), { type:'feed', food:'water' }, male, late);
  const info = careActionInfo(JSON.parse(JSON.stringify(fed)), { type:'feed', food:'fish' }, male.id, late + 60_000);
  assert.equal(info.remaining, CARE_LIMITS.feed.dailyLimit);
  assert.equal(info.reason, 'cooldown');
  assert.equal(info.remainingMs, 29 * 60_000);
});

test('an eaten short meal still counts toward the shared four-hour pair window once', () => {
  const first = reduceAction(initialState(now), { type:'feed', food:'water' }, male, now);
  const later = now + 35 * 60_000;
  assert.equal(feedingInfo(first, male.id, later).mine.active, false);
  assert.equal(feedingInfo(first, male.id, later).mine.inCurrentWindow, true);
  const together = reduceAction(first, { type:'feed', food:'mousse' }, female, later);
  assert.equal(together.love, first.love + FOODS.mousse.love + FEEDING_BONUS);
  assert.equal(together.careLimits.counts.pair, 1);
  const repeat = reduceAction(together, { type:'feed', food:'water' }, male, later + 1);
  assert.equal(repeat.love, together.love + FOODS.water.love);
  assert.equal(repeat.feedingWindow.startedAt, now);
  assert.equal(repeat.careLimits.counts.pair, 1);
});

test('unknown food keys in a saved cooldown ledger are rejected', () => {
  const fed = reduceAction(initialState(now), { type:'feed', food:'water' }, male, now);
  for (const food of ['__proto__', 'toString', 'steak', null]) {
    const limits = structuredClone(fed.careLimits);
    limits.feedCooldowns[0].food = food;
    assert.equal(validCareLimits(limits), false);
  }
});

test('the menu declares each food duration and selecting another food preserves the current wait', () => {
  const fed = reduceAction(initialState(now), { type:'feed', food:'fish' }, male, now);
  const html = feedingSheet({ state:fed, clientId:male.id, selectedFood:'water', now:now + 1000 });
  assert.match(html, /活力 \+10 · 冷却 30分钟/);
  assert.match(html, /清清饮水[^\"]*冷却30分钟/);
  assert.match(html, /幼猫慕斯[^\"]*冷却3小时/);
  assert.match(html, /03:59:59 后可喂食/);
});
