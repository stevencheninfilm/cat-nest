import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,normalizeState,reduceAction,validPendingGrowth} from '../src/state.js';
import {restaurantInfo,RESTAURANT_DINING_MS} from '../src/restaurant.js';
import {growthBubbles,growthTray} from '../src/growth-ui.js';
const NOW=Date.parse('2026-10-19T12:00:00Z');
const OWNER={id:'restaurant-owner',name:'男方'},PARTNER={id:'restaurant-partner',name:'女方'};
function meal(state=initialState(NOW),operationId='restaurant-payment-one'){
  let next=reduceAction(state,{type:'restaurant-start',recipeId:'sandwich'},OWNER,NOW);
  const order=restaurantInfo(next,NOW).orders.at(-1);
  next=reduceAction(next,{type:'restaurant-serve',orderId:order.id},OWNER,order.readyAt);
  const at=order.readyAt+RESTAURANT_DINING_MS;
  return {state:reduceAction(next,{type:'restaurant-collect',orderId:order.id},OWNER,at,operationId),at,order};
}
test('restaurant settlement pays the shared wallet and own XP, reserving exactly the same pet XP in a home bubble',()=>{
  const before=initialState(NOW),{state,at,order}=meal(before);
  assert.equal(state.coins,before.coins+order.rewardCoins);
  assert.equal(state.restaurant.stats.experience,order.rewardXp);
  assert.equal(state.xp,before.xp);
  assert.deepEqual(state.pendingGrowth,[{id:'restaurant-payment-one',kind:'restaurant-collect',orderId:order.id,recipeId:order.recipeId,amount:order.rewardXp,actorId:OWNER.id,actor:OWNER.name,at}]);
  assert.equal(reduceAction(state,{type:'restaurant-collect',orderId:order.id},PARTNER,at+1,'restaurant-payment-duplicate'),null);
  const restored=normalizeState(JSON.parse(JSON.stringify(state)),at+90*86400000);
  assert.deepEqual(restored.pendingGrowth,state.pendingGrowth);
  const claimed=reduceAction(restored,{type:'claim-growth',rewardId:'restaurant-payment-one'},PARTNER,at+90*86400000,'restaurant-claim-one');
  assert.equal(claimed.xp,before.xp+order.rewardXp);assert.equal(claimed.coins,state.coins);
  assert.equal(claimed.restaurant.stats.experience,state.restaurant.stats.experience);assert.deepEqual(claimed.pendingGrowth,[]);
  assert.equal(reduceAction(claimed,{type:'claim-growth',rewardId:'restaurant-payment-one'},OWNER,at+90*86400000+1,'restaurant-claim-two'),null);
});
test('home and tray identify restaurant experience with its source and preserve ordinary care bubbles',()=>{
  const cared=reduceAction(initialState(NOW),{type:'pet'},OWNER,NOW,'restaurant-care-first');
  const {state}=meal(cared);
  const html=growthBubbles(state.pendingGrowth),tray=growthTray(state.pendingGrowth);
  assert.match(html,/领取累计 1 笔餐厅经营经验的 6 点成长/);assert.match(html,/领取摸摸的/);
  assert.match(tray,/累计 1 笔收入/);assert.equal(state.xp,cared.xp);
});
test('old saved restaurant XP is never reissued during migration, normalization or unrelated edits',()=>{
  const old=initialState(NOW);old.xp=888;old.restaurant.stats.experience=132;old.restaurant.stats.served=22;old.restaurant.nextOrderId=23;
  const restored=normalizeState(JSON.parse(JSON.stringify(old)),NOW+86400000);
  assert.equal(restored.xp,888);assert.deepEqual(restored.pendingGrowth,[]);
  const renamed=reduceAction(restored,{type:'rename',name:'糯团'},OWNER,NOW+86400001);
  assert.equal(renamed.xp,888);assert.deepEqual(renamed.pendingGrowth,[]);assert.equal(renamed.restaurant.stats.experience,132);
});
test('restaurant rewards reject unknown dishes, invalid amounts, extra fields and duplicate receipt IDs',()=>{
  const reward=meal().state.pendingGrowth[0];assert.equal(validPendingGrowth([reward]),true);
  for(const fields of [{amount:1000},{amount:6.01},{amount:NaN},{amount:-6},{recipeId:'unknown'},{orderId:'table-0'},{orderId:'table-9007199254740992'},{actorId:'x'},{at:-1},{boosted:true},{game:'memory'},{furniture:'bed'}])assert.equal(validPendingGrowth([{...reward,...fields}]),false,JSON.stringify(fields));
  assert.equal(validPendingGrowth([reward,reward]),false);
});
test('another restaurant payment reserves all pending XP before admitting an unsafe total',()=>{
  const {state}=meal(),pending=state.pendingGrowth[0];
  const nearFull={...initialState(NOW),xp:Number.MAX_SAFE_INTEGER-10,pendingGrowth:[pending]};
  const {state:rejected}=meal(nearFull,'restaurant-overflow-payment');assert.equal(rejected,null);
  assert.equal(nearFull.pendingGrowth[0].amount,6);assert.equal(nearFull.coins,100);
});
