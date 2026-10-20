import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,normalizeState,reduceAction,CARE_TIME_ZONE} from '../src/state.js';
import {restaurantInfo,restaurantActionResult,validRestaurant,sanitizeRestaurantAction} from '../src/restaurant.js';
import {restaurantLoginDay,restaurantDailyLoginInfo,RESTAURANT_DAILY_LOGIN_TIME_ZONE} from '../src/restaurant-daily-login.js';
import {sanitizeAction} from '../server/github-store.mjs';
const NOW=Date.parse('2026-10-20T04:00:00Z'),DAY=restaurantLoginDay(NOW),ACTOR={id:'daily-owner-one',name:'店长'};
const claim=(day=DAY)=>({type:'restaurant-daily-login',day});

test('one saved daily gift adds exactly 300 shared wallet coins and no sales, XP, inspiration or meal progress',()=>{
  let state=initialState(NOW-6000);
  state=reduceAction(state,{type:'restaurant-arrive',partySize:1,recipeId:'coffee'},ACTOR,NOW-6000);
  state=reduceAction(state,{type:'restaurant-kitchen-accept',orderId:'table-1'},ACTOR,NOW);
  const before=structuredClone(state),next=reduceAction(state,claim(),ACTOR,NOW,'daily-operation-one');
  assert.ok(next);assert.ok(validRestaurant(next.restaurant));assert.equal(next.coins,state.coins+300);
  for(const key of ['xp','goldFish','pendingGrowth'])assert.deepEqual(next[key],state[key]);
  for(const key of ['stats','research','orders','parties'])assert.deepEqual(next.restaurant[key],state.restaurant[key]);
  assert.deepEqual(next.restaurant.dailyLogin,{day:DAY,claimedAt:NOW});
  assert.equal(next.restaurant.revision,state.restaurant.revision+1);assert.deepEqual(state,before);
  const reloaded=normalizeState(JSON.parse(JSON.stringify(next)),NOW+1000);
  for(const actor of [ACTOR,{id:'daily-owner-two',name:'另一位主人'}])assert.equal(reduceAction(reloaded,claim(),actor,NOW+1000),null);
});

test('Beijing midnight resets once, skipped days have no back pay, and a clock rollback cannot reissue a gift',()=>{
  assert.equal(RESTAURANT_DAILY_LOGIN_TIME_ZONE,CARE_TIME_ZONE);
  const midnight=Date.parse('2026-10-20T16:00:00Z'),before=midnight-1,oldDay=restaurantLoginDay(before),newDay=restaurantLoginDay(midnight);
  assert.equal(newDay,oldDay+1);
  let state=reduceAction(initialState(before-1000),claim(oldDay),ACTOR,before);
  assert.equal(restaurantInfo(state,before).dailyLogin.nextResetAt,midnight);
  assert.equal(restaurantInfo(state,midnight).dailyLogin.available,true);
  assert.equal(reduceAction(state,claim(oldDay),ACTOR,midnight),null,'a delayed old intent never claims the next day');
  state=reduceAction(state,claim(newDay),ACTOR,midnight);assert.equal(state.coins,initialState(before).coins+600);
  assert.equal(reduceAction(state,claim(oldDay),ACTOR,before),null);
  const weekLater=midnight+7*86400000;
  state=reduceAction(state,claim(restaurantLoginDay(weekLater)),ACTOR,weekLater);assert.equal(state.coins,initialState(before).coins+900);
});

test('read-only loading and legacy normalization never grant a reward or create an empty receipt',()=>{
  const state=initialState(NOW),before=structuredClone(state);
  for(const at of [NOW,NOW+86400000,NOW+30*86400000]){
    assert.equal(restaurantInfo(state,at).dailyLogin.available,true);
    assert.equal(normalizeState(state,at).coins,state.coins);
    assert.equal(Object.hasOwn(normalizeState(state,at).restaurant,'dailyLogin'),false);
  }
  assert.deepEqual(state,before);
  assert.equal(restaurantDailyLoginInfo(null,NOW).amount,300);
});

test('the intent cannot select rewards or receipt clocks; malformed stored receipts are invalid',()=>{
  assert.deepEqual(sanitizeAction(claim()),claim());assert.deepEqual(sanitizeRestaurantAction(claim()),claim());
  for(const patch of [{day:-1},{day:1.5},{day:'1'},{amount:999999},{coins:300},{claimedAt:NOW},{now:NOW},{actorId:ACTOR.id}])assert.equal(sanitizeAction({...claim(),...patch}),null);
  const state=initialState(NOW);
  assert.equal(restaurantActionResult(state,claim(DAY+1),ACTOR,NOW).ok,false);
  for(const value of [null,{},[],{day:DAY,claimedAt:NOW+86400000},{day:DAY,claimedAt:NOW,amount:300},{day:DAY,claimedAt:-1}])assert.equal(validRestaurant({...state.restaurant,dailyLogin:value}),false);
});

test('a full wallet preserves the entitlement; the exact capacity boundary credits all 300',()=>{
  const state=initialState(NOW);state.coins=999700;
  assert.equal(reduceAction(state,claim(),ACTOR,NOW),null);assert.equal(Object.hasOwn(state.restaurant,'dailyLogin'),false);
  state.coins=999699;const next=reduceAction(state,claim(),ACTOR,NOW);assert.equal(next.coins,999999);assert.equal(next.restaurant.dailyLogin.day,DAY);
});
