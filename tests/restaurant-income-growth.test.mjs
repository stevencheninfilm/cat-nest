import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState, validPendingGrowth } from '../src/state.js';
import { growthSideSlots, growthBubbles, growthTray } from '../src/growth-ui.js';
import { RESTAURANT_INCOME_ID, RESTAURANT_INCOME_ART, restaurantGrowthClaims, groupRestaurantGrowth, sanitizeRestaurantGrowthClaim } from '../src/restaurant-income-growth.js';
import { restaurantProgressPreserved } from '../src/restaurant.js';
import { sanitizeAction } from '../server/github-store.mjs';
const at = Date.UTC(2026, 9, 20), actor = { id:'client-one', name:'猫友' };
const income = (index, amount = 9.1) => ({ id:`income-reward-${index}`, kind:'restaurant-collect', orderId:`table-${index+1}`, recipeId:'coffee', amount, actorId:actor.id, actor:actor.name, at });
const care = {id:'care-reward-pet',kind:'pet',amount:3,...{actorId:actor.id,actor:actor.name,at}};
const seed = rewards => ({...initialState(at),pendingGrowth:rewards});

test('old restaurant receipts merge exactly into the upper-left slot without rewriting the save', () => {
  const rewards=[care,income(0,8.1),income(1,9.2),income(2,9.1),income(3,9.1)], before=structuredClone(rewards);
  const grouped=groupRestaurantGrowth(rewards);
  assert.equal(grouped.length,2);assert.equal(grouped[0].amount,35.5);assert.equal(grouped[0].count,4);
  const slots=growthSideSlots(rewards,growthSideSlots([care]));
  assert.equal(slots[0].id,RESTAURANT_INCOME_ID);assert.equal(slots[1].id,care.id);
  const home=growthBubbles(rewards),tray=growthTray(rewards);
  for(const markup of [home,tray]){assert.equal((markup.match(/data-growth-reward=/g)||[]).length,2);assert.match(markup,/累计 4 笔餐厅经营经验的 35.5 点成长/);assert.ok(markup.includes(RESTAURANT_INCOME_ART));assert.doesNotMatch(markup,/更多成长/);}
  assert.deepEqual(rewards,before);assert.deepEqual(normalizeState(seed(rewards),at).pendingGrowth,rewards);
});

test('one captured batch claims saved restaurant amounts only, keeping care and later income untouched', () => {
  const state=seed([income(0,8.1),care,income(1,9.2)]), [action]=restaurantGrowthClaims(state.pendingGrowth);
  state.pendingGrowth.push(income(2,9.1));
  const claimed=reduceAction(state,action,actor,at+1,'income-batch-operation');
  assert.equal(claimed.xp,state.xp+17.3);assert.deepEqual(claimed.pendingGrowth,[care,income(2,9.1)]);
  assert.equal(restaurantProgressPreserved(state.restaurant,claimed.restaurant),true);assert.equal(validPendingGrowth(claimed.pendingGrowth),true);
  assert.equal(reduceAction(claimed,action,actor,at+2),null);
  assert.equal(reduceAction(state,{type:action.type,rewardIds:[care.id]},actor,at+1),null);
  assert.equal(reduceAction({...state,xp:Number.MAX_SAFE_INTEGER},action,actor,at+1),null);
});

test('a large backlog uses bounded requests, retains every receipt and adds exact tenths', () => {
  const rewards=Array.from({length:1000},(_,i)=>income(i,i%2?8.1:9.2)), actions=restaurantGrowthClaims(rewards);
  let state=seed(rewards);
  for(const action of actions){assert.ok(action.rewardIds.length<=128);assert.deepEqual(sanitizeAction(action),action);assert.ok(Buffer.byteLength(JSON.stringify({operationId:'x'.repeat(180),clientId:'x'.repeat(80),name:'猫友',action}))<32768);state=reduceAction(state,action,actor,at);assert.ok(state);}
  assert.equal(state.xp,initialState(at).xp+8650);assert.deepEqual(state.pendingGrowth,[]);
  assert.equal(groupRestaurantGrowth(rewards)[0].amount,8650);
});

test('batch sanitizer rejects forged amounts, duplicate IDs, care receipts and oversized manifests', () => {
  const good={type:'claim-restaurant-growth',rewardIds:['income-reward-1']};
  assert.deepEqual(sanitizeRestaurantGrowthClaim(good),good);
  for(const bad of [{...good,amount:999}, {...good,rewardIds:[]},{...good,rewardIds:['income-reward-1','income-reward-1']},{...good,rewardIds:['bad']},{...good,rewardIds:[null]},{...good,rewardIds:Array.from({length:129},(_,i)=>`income-reward-${i}`)}])assert.equal(sanitizeAction(bad),null);
});
