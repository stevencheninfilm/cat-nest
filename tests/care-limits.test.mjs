import test from 'node:test';
import assert from 'node:assert/strict';
import { CARE_LIMITS, CARE_TIME_ZONE, FEEDING_BONUS, FOODS, foodCooldownMs, initialState, normalizeState, validCareLimits, careActionInfo, reduceAction } from '../src/state.js';

const start = Date.UTC(2026, 9, 13, 0); // 08:00 in the shared daily reset timezone.
const alice = { id: 'partner-male', name: '男方' };
const bob = { id: 'partner-female', name: '女方' };
const action = type => type === 'feed' ? { type, food: 'meal' } : { type };

test('care availability uses bounded room quotas and is read-only', () => {
  assert.equal(CARE_TIME_ZONE, 'Asia/Shanghai');
  const state = initialState(start);
  const snapshot = structuredClone(state);
  for (const [type, rule] of Object.entries(CARE_LIMITS)) {
    const info = careActionInfo(state, action(type), alice.id, start);
    assert.equal(info.allowed, true);
    assert.equal(info.remaining, rule.dailyLimit);
    assert.equal(info.used, 0);
    assert.equal(info.remainingMs, 0);
  }
  assert.equal(careActionInfo(state, { type: 'rename' }, alice.id, start).dailyLimit, null);
  assert.deepEqual(state, snapshot);
  assert.equal(validCareLimits(state.careLimits), true);
});

test('each care action rejects repeats and permits the exact cooldown boundary', () => {
  for (const type of ['feed', 'pet', 'play', 'sleep']) {
    const first = reduceAction(initialState(start), action(type), alice, start);
    const sleeping = type === 'sleep' ? reduceAction(first, action('sleep'), bob, start + 1) : first;
    const snapshot = structuredClone(sleeping);
    const until = start + (type === 'feed' ? foodCooldownMs('meal') : CARE_LIMITS[type].cooldownMs);
    const info = careActionInfo(sleeping, action(type), alice.id, until - 1);
    assert.equal(info.reason, 'cooldown', type);
    assert.equal(info.remainingMs, 1, type);
    assert.equal(info.availableAt, until, type);
    assert.equal(reduceAction(sleeping, action(type), alice, until - 1), null, type);
    assert.deepEqual(sleeping, snapshot, 'rejected action changes no resource, record or diary');
    assert.ok(reduceAction(sleeping, action(type), alice, until), type);
  }
});

test('care quotas and non-feeding cooldowns are shared by both roles', () => {
  for (const type of ['pet', 'play', 'sleep']) {
    const rule = CARE_LIMITS[type];
    let state = { ...initialState(start), energy: 100 };
    for (let index = 0; index < rule.dailyLimit; index += 1) {
      const now = start + index * rule.cooldownMs;
      const actor = index % 2 ? bob : alice;
      state = reduceAction(state, action(type), actor, now);
      assert.ok(state, `${type} accepted ${index + 1}`);
      if (type === 'sleep') state = reduceAction(state, action('sleep'), actor, now);
      assert.equal(reduceAction(state, action(type), index % 2 ? alice : bob, now + 1), null);
    }
    const now = start + rule.dailyLimit * rule.cooldownMs;
    const snapshot = structuredClone(state);
    const info = careActionInfo(state, action(type), bob.id, now);
    assert.equal(info.reason, 'daily_limit', type);
    assert.equal(info.remaining, 0, type);
    assert.equal(info.used, rule.dailyLimit, type);
    assert.equal(reduceAction(state, action(type), bob, now), null);
    assert.deepEqual(state, snapshot);
  }
});

test('feeding cooldown is personal while all foods and identities consume one shared quota', () => {
  const before = initialState(start);
  const first = reduceAction(before, action('feed'), alice, start);
  assert.equal(reduceAction(first, { type: 'feed', food: 'fish' }, alice, start + 1), null);
  assert.ok(reduceAction(first, action('feed'), bob, start + 1), 'partner can complete the current round immediately');
  let state = first;
  for (let index = 1; index < CARE_LIMITS.feed.dailyLimit; index += 1) {
    state = reduceAction(state, { type: 'feed', food: index % 2 ? 'water' : 'snack' }, { id: `device-${index}`, name: '猫友' }, start + index);
    assert.ok(state);
  }
  assert.equal(state.careLimits.counts.feed, 6);
  const snapshot = structuredClone(state);
  assert.equal(careActionInfo(state, action('feed'), 'device-new', start + 10).reason, 'daily_limit');
  assert.equal(reduceAction(state, { type: 'feed', food: 'fish' }, { id: 'device-new', name: '猫友' }, start + 10), null);
  assert.deepEqual(state, snapshot);
});

test('three complete pair rounds receive exactly three bonuses and then no more feeding rewards', () => {
  const before = initialState(start);
  let state = before;
  for (let round = 0; round < 3; round += 1) {
    const now = start + round * CARE_LIMITS.feed.cooldownMs;
    state = reduceAction(state, action('feed'), alice, now);
    state = reduceAction(state, action('feed'), bob, now);
    assert.ok(state);
    assert.equal(state.careLimits.counts.pair, round + 1);
    assert.equal(state.feedingWindow.bonusClaimed, true);
  }
  assert.equal(state.xp, before.xp);
  assert.equal(state.pendingGrowth.reduce((total, reward) => total + reward.amount, 0), 213.5);
  const claimed = state.pendingGrowth.reduce((current, reward) => reduceAction(current, { type: 'claim-growth', rewardId: reward.id }, bob, start + 12 * 3600_000), state);
  assert.equal(claimed.xp, before.xp + 213.5);
  assert.deepEqual(claimed.careLimits.counts, state.careLimits.counts);
  assert.equal(careActionInfo(state, { type: 'pair' }, alice.id, start + 12 * 3600_000).reason, 'daily_limit');
  assert.equal(reduceAction(state, action('feed'), alice, start + 12 * 3600_000), null);
});

test('waking never earns resources or consumes quota, and sleeping again cannot farm energy or growth', () => {
  const asleep = reduceAction(initialState(start), action('sleep'), alice, start);
  const awake = reduceAction(asleep, action('sleep'), bob, start + 1);
  assert.equal(awake.xp, asleep.xp);
  assert.equal(awake.energy, asleep.energy);
  assert.equal(awake.careLimits.counts.sleep, 1);
  assert.equal(reduceAction(awake, action('sleep'), alice, start + 2), null);
  const capped = { ...asleep, careLimits: { ...asleep.careLimits, counts: { ...asleep.careLimits.counts, sleep: 3 } } };
  assert.equal(careActionInfo(capped, action('sleep'), bob.id, start + 3).isWake, true);
  assert.equal(careActionInfo(capped, action('sleep'), bob.id, start + 3).allowed, true);
  assert.ok(reduceAction(capped, action('sleep'), bob, start + 3));
});

test('Shanghai midnight resets daily counts, preserves cross-day cooldowns and survives serialization', () => {
  const midnight = Date.UTC(2026, 9, 13, 16);
  const first = reduceAction(initialState(midnight - 60_000), action('pet'), alice, midnight - 60_000);
  const reloaded = JSON.parse(JSON.stringify(first));
  const info = careActionInfo(reloaded, action('pet'), bob.id, midnight);
  assert.equal(info.used, 0);
  assert.equal(info.remaining, 20);
  assert.equal(info.reason, 'cooldown');
  assert.equal(info.remainingMs, 4 * 60_000);
  assert.equal(reduceAction(reloaded, action('pet'), bob, midnight), null);
  const next = reduceAction(reloaded, action('pet'), bob, midnight + 4 * 60_000);
  assert.equal(next.careLimits.counts.pet, 1);
  assert.equal(next.xp, first.xp);
  assert.deepEqual(next.pendingGrowth.map(reward => reward.amount), [3.3, 3.3]);
  const previousDay = normalizeState(next, midnight - 1);
  assert.equal(previousDay.careLimits.counts.pet, 1, 'clock rollback cannot reset the same quota again');
});

test('a daily cap resets only at the shared timezone boundary, independent of actor identity', () => {
  const midnight = Date.UTC(2026, 9, 13, 16);
  const state = initialState(start);
  state.careLimits.counts.feed = 6;
  const info = careActionInfo(state, action('feed'), alice.id, midnight - 1);
  assert.equal(info.availableAt, midnight);
  assert.equal(info.allowed, false);
  assert.equal(reduceAction(state, action('feed'), bob, midnight - 1), null);
  assert.equal(reduceAction(state, action('feed'), bob, midnight).careLimits.counts.feed, 1);
});

test('clock rollback keeps saved daily caps and cooldowns instead of granting fresh rewards', () => {
  const fed = reduceAction(initialState(start), action('feed'), alice, start);
  const petted = reduceAction(fed, action('pet'), bob, start);
  const yesterday = start - 2 * 24 * 3600_000;
  const reloaded = normalizeState(JSON.parse(JSON.stringify(petted)), yesterday);
  assert.equal(reloaded.careLimits.counts.feed, 1);
  assert.equal(reloaded.careLimits.counts.pet, 1);
  assert.equal(reloaded.careLimits.day, petted.careLimits.day);
  assert.equal(careActionInfo(reloaded, action('feed'), alice.id, yesterday).reason, 'cooldown');
  assert.equal(careActionInfo(reloaded, action('pet'), bob.id, yesterday).reason, 'cooldown');
  assert.equal(reduceAction(reloaded, action('feed'), alice, yesterday), null);
  assert.equal(reduceAction(reloaded, action('pet'), bob, yesterday), null);
});

test('quota ledger normalization handles legacy saves and rejects malformed stored ledgers', () => {
  const legacy = initialState(start);
  delete legacy.careLimits;
  const migrated = normalizeState(legacy, start);
  assert.equal(migrated.xp, legacy.xp);
  assert.equal(validCareLimits(migrated.careLimits), true);
  assert.equal(validCareLimits({ ...migrated.careLimits, counts: { ...migrated.careLimits.counts, pet: -1 } }), false);
  assert.equal(validCareLimits({ ...migrated.careLimits, counts: { ...migrated.careLimits.counts, pet: 21 } }), false);
  assert.equal(validCareLimits({ ...migrated.careLimits, feedCooldowns: [{ actorId: alice.id, at: start }, { actorId: alice.id, at: start }] }), false);
});

test('failed resource checks do not consume allowance and unrelated actions remain available', () => {
  const poor = { ...initialState(start), coins: 0, energy: 0 };
  assert.equal(reduceAction(poor, action('feed'), alice, start), null);
  assert.equal(reduceAction(poor, action('play'), alice, start), null);
  assert.deepEqual(poor.careLimits.counts, initialState(start).careLimits.counts);
  const capped = initialState(start);
  for (const [type, rule] of Object.entries(CARE_LIMITS)) capped.careLimits.counts[type] = rule.dailyLimit;
  assert.ok(reduceAction(capped, { type: 'rename', name: '汤圆' }, alice, start));
  assert.ok(reduceAction(capped, { type: 'dress', appearance: capped.appearance }, alice, start));
});

for (const reason of ['daily_limit', 'cooldown']) {
  test(`changing appearance remains free during ${reason} and later care preserves the new outfit`, () => {
    let state = initialState(start);
    state = reduceAction(state, action('feed'), alice, start);
    state = reduceAction(state, action('feed'), bob, start);
    for (const type of ['pet', 'play', 'sleep', 'sleep']) state = reduceAction(state, action(type), alice, start);
    if (reason === 'daily_limit') {
      for (const [type, rule] of Object.entries(CARE_LIMITS)) state.careLimits.counts[type] = rule.dailyLimit;
    }
    const before = structuredClone(state);
    const appearance = { body: 3, clothes: 2, eyes: 1, wand: 2 };
    const dressed = reduceAction(state, { type: 'dress', appearance }, alice, start + 1);
    assert.ok(dressed);
    assert.deepEqual(dressed.appearance, appearance);
    assert.deepEqual(dressed.careLimits, before.careLimits, 'dressing cannot clear quotas or cooldowns');
    assert.deepEqual(dressed.feedRecords, before.feedRecords);
    assert.deepEqual(dressed.feedingWindow, before.feedingWindow);
    for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy', 'sleeping']) assert.equal(dressed[key], before[key], key);
    assert.deepEqual(state, before, 'dressing must not mutate the previous snapshot');
    const dressedSnapshot = structuredClone(dressed);
    for (const type of ['feed', 'pet', 'play', 'sleep']) {
      assert.equal(careActionInfo(dressed, action(type), alice.id, start + 2).reason, reason, type);
      assert.equal(reduceAction(dressed, action(type), alice, start + 2), null, type);
      assert.deepEqual(dressed, dressedSnapshot, 'rejected care cannot alter appearance, ledger, feeding records or resources');
    }
    const nextDay = Date.UTC(2026, 9, 13, 16);
    let later = JSON.parse(JSON.stringify(dressed));
    for (const type of ['feed', 'pet', 'play', 'sleep']) {
      later = reduceAction(later, action(type), alice, nextDay);
      assert.ok(later, `${type} resumes after cooldown and daily reset`);
      assert.deepEqual(later.appearance, appearance, `${type} preserves the selected appearance`);
    }
    assert.deepEqual(dressed, dressedSnapshot, 'later care must not modify the saved dressed snapshot');
  });
}
