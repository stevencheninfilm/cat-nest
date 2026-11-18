import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, restaurantProgressPreserved, validRestaurant } from '../src/restaurant.js';
import { restaurantCheckoutReceipt } from '../src/restaurant-checkout-receipt.js';
import { prepareRestaurantMealForCollection } from './restaurant-meal-fixtures.mjs';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const MIDNIGHT = Date.parse('2026-10-18T16:00:00Z');
const DAY = 86_400_000;
const alice = {id: 'client-alice', name: '店长'};
const bob = {id: 'client-bobby', name: '伙伴'};

function prepare(state, recipeId, at = state.updatedAt) {
  const started = reduceAction(state, {type: 'restaurant-start', recipeId}, alice, at);
  assert.ok(started);
  return prepareRestaurantMealForCollection(started, started.restaurant.orders.at(-1).id, alice);
}

function settle(meal, actor = alice, at = meal.at) {
  const action = {type: 'restaurant-collect', orderId: meal.order.id};
  const state = reduceAction(meal.state, action, actor, at);
  assert.ok(state);
  return {state, action, receipt: restaurantCheckoutReceipt(action, meal.state, state)};
}

test('commissions rotate through three reachable level-one categories at Beijing midnight, without writing old saves', () => {
  const old = initialState(NOW), original = structuredClone(old);
  const days = [NOW, MIDNIGHT, MIDNIGHT + DAY].map(at => restaurantInfo(old, at));
  assert.deepEqual(days.map(info => info.dailyCommission.category), ['饮品', '主食', '甜点']);
  assert.equal(days[0].dailyCommission.nextResetAt, MIDNIGHT);
  for (const {dailyCommission: commission, recipes} of days) {
    assert.ok(recipes.some(recipe => recipe.category === commission.category && recipe.unlocked));
    assert.equal(commission.progress, 0);
    assert.equal(commission.target, 2);
    assert.equal(commission.rewardCoins, 30);
  }
  assert.equal(normalizeState(old, MIDNIGHT).restaurant.dailyCommission, undefined);
  assert.deepEqual(old, original);
});

test('only matching settled dishes count and only the checkout that completes the shared commission grants its bonus', () => {
  let current = initialState(NOW);
  const other = settle(prepare(current, 'sandwich'));
  assert.equal(other.state.restaurant.dailyCommission, undefined);
  const drink = prepare(other.state, 'lemontea');
  const first = settle(drink, alice);
  assert.equal(first.receipt.coins, drink.order.rewardCoins);
  assert.equal(first.receipt.commissionCoins, undefined);
  assert.equal(first.state.restaurant.dailyCommission.progress, 1);
  current = normalizeState(JSON.parse(JSON.stringify(first.state)), first.state.updatedAt);
  const secondDrink = prepare(current, 'lemontea');
  const second = settle(secondDrink, bob);
  assert.equal(second.receipt.coins, secondDrink.order.rewardCoins + 30);
  assert.equal(second.receipt.commissionCoins, 30);
  assert.equal(second.state.coins, current.coins + second.receipt.coins);
  assert.equal(second.state.restaurant.stats.earned, current.restaurant.stats.earned + secondDrink.order.rewardCoins);
  assert.equal(restaurantInfo(second.state, secondDrink.at).dailyCommission.completed, true);
  assert.equal(reduceAction(second.state, second.action, alice, secondDrink.at + 1), null);
  const thirdDrink = prepare(second.state, 'lemontea');
  const third = settle(thirdDrink);
  assert.equal(third.receipt.coins, thirdDrink.order.rewardCoins);
  assert.equal(third.receipt.commissionCoins, undefined);
  assert.deepEqual(third.state.restaurant.dailyCommission, second.state.restaurant.dailyCommission);
});

test('failed settlements leave the last commission slot available and crossed-midnight orders count on payment day', () => {
  const first = settle(prepare(initialState(NOW), 'lemontea'));
  const second = prepare(first.state, 'lemontea'), action = {type: 'restaurant-collect', orderId: second.order.id};
  const exact = 999999 - second.order.rewardCoins - 30;
  const full = {...second.state, coins: exact + 1};
  assert.equal(reduceAction(full, action, bob, second.at), null);
  assert.equal(full.restaurant.dailyCommission.progress, 1);
  assert.equal(full.restaurant.orders[0].id, action.orderId);
  assert.equal(settle({...second, state: {...full, coins: exact}}).state.coins, 999999);
  const rollover = settle(second, bob, MIDNIGHT);
  assert.equal(rollover.receipt.commissionCoins, undefined);
  assert.equal(restaurantInfo(rollover.state, MIDNIGHT).dailyCommission.progress, 0);
  const newMain = settle(prepare(rollover.state, 'sandwich', MIDNIGHT + 1));
  assert.equal(newMain.state.restaurant.dailyCommission.progress, 1);
  assert.equal(restaurantProgressPreserved(first.state.restaurant, newMain.state.restaurant), true);
  assert.equal(restaurantProgressPreserved(newMain.state.restaurant, {...newMain.state.restaurant, dailyCommission: first.state.restaurant.dailyCommission}), false);
  assert.equal(validRestaurant({...newMain.state.restaurant, dailyCommission: {day: 0, progress: 3}}), false);
});

test('the same settlement advances an active supper and pays its daily commission once', () => {
  const state = initialState(MIDNIGHT);
  state.restaurant.staff = 1;
  state.restaurant.stats.experience = restaurantLevelStartXp(8);
  state.coins = 2000;
  const open = reduceAction(state, {
    type: 'restaurant-supper-start', themeId: 'mains', workerIds: ['worker-1', 'worker-2'], run: 1,
  }, alice, MIDNIGHT);
  assert.ok(open);
  const first = settle(prepare(open, 'rice'));
  const meal = prepare(first.state, 'sandwich');
  const second = settle(meal, bob);
  const info = restaurantInfo(second.state, meal.at);
  assert.equal(info.dailyCommission.completed, true);
  assert.equal(second.receipt.commissionCoins, 30);
  assert.equal(second.state.coins - meal.state.coins, meal.order.rewardCoins + 30);
  assert.ok(info.supperClub.active.progress > first.state.restaurant.supperClub.active.progress);
  assert.deepEqual(info.supperClub.active.signature.collected, ['rice', 'sandwich']);
  assert.equal(reduceAction(second.state, second.action, alice, meal.at + 1), null);
});
