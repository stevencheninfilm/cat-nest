import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, CARE_LIMITS, careActionInfo } from '../src/state.js';
import { COUPLE_ROLES } from '../src/couple-profile.js';
import { feedingSheet, feedingButtonContent } from '../src/feeding-ui.js';
import { careStatusText, careBlockedMessage, careRuleText } from '../src/care-ui.js';

const now = Date.parse('2026-10-13T04:00:00Z');
const actor = { id:COUPLE_ROLES[0].clientId, name:COUPLE_ROLES[0].name };

test('a fed caregiver sees the countdown and shared quota, while the partner can feed', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'meal' }, actor, now);
  const options = { state, selectedFood:'meal', clientId:actor.id, now:now + 1000 };
  assert.deepEqual(feedingButtonContent(options), { disabled:true, content:'03:59:59 后可喂食' });
  const html = feedingSheet(options);
  assert.match(html, /今日喂食剩余 5\/6 · 03:59:59 后可用/);
  assert.match(html, /小窝共享每日 6 次 · 每人间隔 4 小时/);
  assert.match(html, /id="serve-food" disabled/);
  const partner = feedingButtonContent({ ...options, clientId:COUPLE_ROLES[1].clientId });
  assert.equal(partner.disabled, false);
});

test('the serve button becomes available at cooldown expiry without changing saved state', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'water' }, actor, now);
  const options = { state, selectedFood:'water', clientId:actor.id };
  assert.equal(feedingButtonContent({ ...options, now:now + CARE_LIMITS.feed.cooldownMs - 1 }).disabled, true);
  assert.deepEqual(feedingButtonContent({ ...options, now:now + CARE_LIMITS.feed.cooldownMs }), { disabled:false, content:'喂这个 <span>成长气泡 +5</span>' });
  assert.equal(state.careLimits.counts.feed, 1);
});

test('daily cap and cross-midnight cooldown are shown independently', () => {
  const late = Date.parse('2026-10-13T15:59:00Z');
  const state = reduceAction(initialState(late), { type:'feed', food:'meal' }, actor, late);
  state.careLimits.counts.feed = CARE_LIMITS.feed.dailyLimit;
  const before = feedingSheet({ state, selectedFood:'meal', clientId:actor.id, now:late + 1000 });
  assert.match(before, /今日喂食剩余 0\/6 · 次数北京时间 0 点重置/);
  assert.match(before, /今日喂食次数已用完/);
  const after = feedingSheet({ state, selectedFood:'meal', clientId:actor.id, now:late + 60_000 });
  assert.match(after, /今日喂食剩余 6\/6 · 03:59:00 后可用/);
  assert.match(after, /id="serve-food" disabled/);
});

test('wake feedback stays available after sleep quota and identifies the zero reward', () => {
  const state = initialState(now);
  state.sleeping = true;
  state.careLimits.counts.sleep = CARE_LIMITS.sleep.dailyLimit;
  state.careLimits.lastActions.sleep = now;
  const info = careActionInfo(state, { type:'sleep' }, actor.id, now);
  assert.equal(info.allowed, true);
  assert.equal(careStatusText('sleep', info), '今日休息剩余 0/3 · 叫醒不计成长');
});

test('pair cap is explained without promising another reward', () => {
  const state = initialState(now);
  state.careLimits.counts.pair = CARE_LIMITS.pair.dailyLimit;
  const html = feedingSheet({ state, selectedFood:'meal', clientId:actor.id, tab:'pair', now });
  assert.match(html, /今日双人奖励已达上限，本轮喂养仍可完成/);
  assert.match(html, /今日双人奖励剩余 0\/3/);
  assert.doesNotMatch(html, /本轮两人各喂一次，额外获得/);
  assert.equal(careRuleText('pair'), '每日 3 次');
});

test('care rejection feedback uses a concise live cooldown', () => {
  const state = reduceAction(initialState(now), { type:'pet' }, actor, now);
  const info = careActionInfo(state, { type:'pet' }, actor.id, now + 1000);
  assert.equal(careBlockedMessage('pet', info), '摸摸还需等 00:04:59，稍后再来陪它');
});
