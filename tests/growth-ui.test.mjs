import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { growthBubbles, growthTray } from '../src/growth-ui.js';

const now = Date.UTC(2026, 9, 14);
const actor = { id:'partner-male', name:'男方' };

test('care shows the correct claimable bubble while confirmed XP remains unchanged', () => {
  const before = initialState(now);
  const fed = reduceAction(before, { type:'feed', food:'chicken' }, actor, now, 'growth-ui-feed');
  const html = growthBubbles(fed.pendingGrowth);
  assert.equal(fed.xp, before.xp);
  assert.match(html, /data-growth-reward="growth-ui-feed"/);
  assert.match(html, /领取鸡胸肉的 35 点成长/);
  assert.match(html, /点击气泡，收下成长/);
  assert.doesNotMatch(html, /disabled/);
  assert.match(growthBubbles(fed.pendingGrowth, { blocked:true, claimingRewardId:'growth-ui-feed' }), /disabled[^]*领取中/);
});

test('unclaimed reward remains visible after normalization months later and disappears only after a claim', () => {
  const fed = reduceAction(initialState(now), { type:'pet' }, actor, now, 'growth-ui-pet');
  const claimed = reduceAction(fed, { type:'claim-growth', rewardId:'growth-ui-pet' }, actor, now + 90 * 86400_000);
  assert.match(growthBubbles(fed.pendingGrowth), /领取摸摸的 3 点成长/);
  assert.equal(growthBubbles(claimed.pendingGrowth), '');
  assert.equal(claimed.xp, fed.xp + 3);
});

test('large reward backlogs have an accessible paginated tray and retain the entire total', () => {
  const reward = reduceAction(initialState(now), { type:'pet' }, actor, now, 'growth-ui-seed').pendingGrowth[0];
  const rewards = Array.from({ length:25 }, (_, index) => ({ ...reward, id:`growth-ui-${index}` }));
  const home = growthBubbles(rewards);
  assert.equal((home.match(/data-growth-reward=/g) || []).length, 3);
  assert.match(home, /查看全部 25 个待领取成长气泡/);
  const last = growthTray(rewards, { page:2 });
  assert.match(last, /25 个气泡 · 共 75 点待领取/);
  assert.match(last, /data-growth-reward="growth-ui-24"/);
  assert.match(last, /3 \/ 3/);
  assert.equal(rewards.length, 25);
});

test('personal names cannot inject markup into the growth tray', () => {
  const reward = reduceAction(initialState(now), { type:'pet' }, actor, now, 'growth-ui-safe').pendingGrowth[0];
  const html = growthTray([{ ...reward, actor:'<script>alert(1)</script>' }]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
