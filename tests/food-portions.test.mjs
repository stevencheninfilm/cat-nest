import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, foodCooldownMs, initialState, reduceAction } from '../src/state.js';
import { foodRemainingPortion } from '../src/food-portions.js';
import { feedingHome, feedingSheet, foodArt } from '../src/feeding-ui.js';

for (const food of Object.keys(FOODS)) {
  test(`${food} switches exactly at 75%, 50%, 25% and its own expiry`, () => {
    const duration = foodCooldownMs(food);
    assert.equal(foodRemainingPortion(food, duration), 100);
    assert.equal(foodRemainingPortion(food, duration * .75 + 1), 100);
    assert.equal(foodRemainingPortion(food, duration * .75), 75);
    assert.equal(foodRemainingPortion(food, duration * .5 + 1), 75);
    assert.equal(foodRemainingPortion(food, duration * .5), 50);
    assert.equal(foodRemainingPortion(food, duration * .25 + 1), 50);
    assert.equal(foodRemainingPortion(food, duration * .25), 25);
    assert.equal(foodRemainingPortion(food, 1), 25);
    assert.equal(foodRemainingPortion(food, 0), 0);
  });
}

test('two meals derive independent portion stages after closing and restoring the page', () => {
  const now = Date.parse('2026-10-14T00:00:00Z');
  const male = { id:'partner-male', name:'男方' }, female = { id:'partner-female', name:'女方' };
  let state = reduceAction(initialState(now), { type:'feed', food:'water' }, male, now);
  state = reduceAction(state, { type:'feed', food:'mousse' }, female, now);
  const snapshot = JSON.stringify(state);
  const options = { state:JSON.parse(snapshot), clientId:male.id, selectedFood:'meal', now:now + 22.5 * 60_000 };
  const home = feedingHome(options);
  const split = home.indexOf('data-feeder="female"');
  assert.match(home.slice(0, split), /data-current-food="water"/);
  assert.match(home.slice(0, split), /data-food-portion="25"/);
  assert.match(home.slice(split), /data-current-food="mousse"/);
  assert.match(home.slice(split), /data-food-portion="100"/);
  const sheet = feedingSheet({ ...options, tab:'pair' });
  const records = sheet.slice(sheet.indexOf('class="feeders-grid"'), sheet.indexOf('<p class="pair-bonus'));
  assert.match(records, /data-food-portion="25"/);
  assert.match(records, /data-food-portion="100"/);
  const expired = feedingHome({ ...options, now:now + foodCooldownMs('water') });
  assert.doesNotMatch(expired.slice(0, expired.indexOf('data-feeder="female"')), /home-serving-food|data-feed-until=/);
  assert.match(expired.slice(expired.indexOf('data-feeder="female"')), /home-serving-food/);
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(JSON.stringify(options.state), snapshot);
});

test('menu previews stay full and invalid portion values cannot select an arbitrary asset', () => {
  assert.match(foodArt('water'), /data-food-portion="100"/);
  assert.match(foodArt('water', '', '" onerror="bad'), /data-food-portion="100"/);
  assert.match(foodArt('water', '', 0), /data-food-portion="0"/);
  assert.equal(foodRemainingPortion('water', NaN), 0);
  assert.equal(foodRemainingPortion('water', -1), 0);
});
