import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurantCommissionEntry, restaurantDailyCommissionMarkup } from '../src/restaurant-daily-commission-ui.js';

const commission = {category: '饮品', progress: 1, target: 2, rewardCoins: 30, completed: false};

test('commission entry and sheet show the same current objective and progress', () => {
  assert.match(restaurantCommissionEntry(commission), /data-r-tab="commission"[\s\S]*饮品 · 1 \/ 2 份/);
  const card = restaurantDailyCommissionMarkup(commission);
  assert.match(card, /结账 2 份饮品/);
  assert.match(card, /<progress[^>]*value="1" max="2"/);
  assert.match(card, /\+30 小鱼干/);
  assert.match(card, /达成时自动入账/);
  assert.match(card, /每天北京时间 0 点更新/);
});

test('completed commissions acknowledge the automatic payout without another claim', () => {
  const complete = {...commission, progress: 2, completed: true};
  assert.match(restaurantCommissionEntry(complete), /已完成/);
  const card = restaurantDailyCommissionMarkup(complete);
  assert.match(card, /已到账/);
  assert.doesNotMatch(card, /<button|达成时自动入账/);
});
