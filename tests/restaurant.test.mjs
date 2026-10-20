import { SPECIAL_RESTAURANT_RECIPES, PROMOTED_SIGNATURE_RECIPE_IDS } from '../src/restaurant-economy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { initialRestaurant, validRestaurant, normalizeRestaurant, restaurantInfo, restaurantActionResult, sanitizeRestaurantAction, RESTAURANT_DINING_MS, RESTAURANT_RECIPES, RESTAURANT_NEW_RECIPE_IDS, RESTAURANT_RECIPE_CATEGORIES } from '../src/restaurant.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
const ALICE={id:'client-alice',name:'小鱼'};
const BOB={id:'client-bob',name:'小猫'};
const action=(state,type,extra={},now=NOW,actor=ALICE)=>reduceAction(state,{type,...extra},actor,now);
function fragments(state,id='rice'){state.restaurant.research={version:1,startedServed:state.restaurant.stats.served,draws:1,fragments:{[id]:3},lastDraw:{draw:1,recipeId:id,amount:3}};return state;}
const eligible=(level=50)=>{const state={...initialState(NOW),coins:1200};state.restaurant.stats.experience=levelStartXp(level);return state;};
function finishOrder(state,now=NOW,actor=ALICE) {
  let next=action(state,'restaurant-start',{recipeId:'rice'},now,actor);
  const order=restaurantInfo(next,now).orders.at(-1);
  return action(next,'restaurant-collect',{orderId:order.id},order.servedAt+RESTAURANT_DINING_MS,actor);
}

test('legacy homes gain an independent empty restaurant without rewriting shared pet or currency',()=>{
  const legacy=initialState(NOW);delete legacy.restaurant;
  legacy.coins=321;legacy.xp=111.2;legacy.pendingGrowth=[];
  const restored=normalizeState(legacy,NOW);
  assert.equal(restored.coins,321);assert.equal(restored.xp,111.2);
  assert.deepEqual(restored.restaurant,initialRestaurant(NOW));
  assert.deepEqual(restored.homeBond,legacy.homeBond);
  const changed=finishOrder(restored);
  assert.equal(legacy.restaurant,undefined);
  assert.equal(restored.restaurant.orders.length,0);
  assert.equal(changed.coins,345);assert.equal(changed.xp,111.2);assert.equal(changed.pendingGrowth.at(-1).amount,6);
  assert.deepEqual(normalizeRestaurant(changed.restaurant,NOW),changed.restaurant);
});

test('other menu dishes retain manual delivery, dining and authoritative elapsed time',()=>{
  const start=action(initialState(NOW),'restaurant-start',{recipeId:'sandwich'}),id=start.restaurant.orders[0].id;
  const readyAt=start.restaurant.orders[0].readyAt;
  assert.equal(restaurantInfo(start,NOW).orders[0].status,'cooking');
  assert.equal(action(start,'restaurant-serve',{orderId:id},readyAt-1),null);
  assert.equal(action(start,'restaurant-collect',{orderId:id},readyAt),null);
  assert.equal(restaurantInfo(start,readyAt).orders[0].status,'ready');
  const served=action(start,'restaurant-serve',{orderId:id},readyAt);
  assert.equal(restaurantInfo(served,readyAt).orders[0].status,'dining');
  assert.equal(action(served,'restaurant-serve',{orderId:id},readyAt+1),null);
  assert.equal(action(served,'restaurant-collect',{orderId:id},readyAt+RESTAURANT_DINING_MS-1),null);
  const collected=action(served,'restaurant-collect',{orderId:id},readyAt+RESTAURANT_DINING_MS);
  assert.equal(collected.coins,start.coins+28);assert.equal(collected.xp,start.xp);assert.equal(collected.pendingGrowth[0].amount,6);
  assert.equal(collected.restaurant.stats.served,1);assert.equal(collected.restaurant.stats.earned,28);
  assert.equal(collected.pendingGrowth.length,1,'restaurant experience awaits the existing home bubble claim');
  assert.equal(action(collected,'restaurant-collect',{orderId:id},readyAt+RESTAURANT_DINING_MS),null);
});

test('partners can accept and collect each other’s automatically delivered orders only once',()=>{
  const started=action(initialState(NOW),'restaurant-start',{recipeId:'coffee'});
  const order=restaurantInfo(started).orders[0];
  const collected=action(started,'restaurant-collect',{orderId:order.id},order.servedAt+RESTAURANT_DINING_MS,BOB);
  assert.equal(collected.restaurant.orders.length,0);
  assert.equal(action(collected,'restaurant-collect',{orderId:order.id},order.servedAt+RESTAURANT_DINING_MS,ALICE),null);
  const another=action(collected,'restaurant-start',{recipeId:'rice'},order.servedAt+RESTAURANT_DINING_MS,BOB);
  assert.notEqual(another.restaurant.orders[0].id,order.id);
});

test('restaurant experience crossing a pet level records one existing-format level memory',()=>{
  const before=initialState(NOW);before.xp=119;
  const paid=finishOrder(before);
  assert.equal(paid.xp,119);assert.equal(paid.diary.entries.filter(entry=>entry.kind==='level').length,0);
  const after=action(paid,'claim-growth',{rewardId:paid.pendingGrowth[0].id},paid.updatedAt+1,BOB);
  assert.equal(after.xp,125);
  const memories=after.diary.entries.filter(entry=>entry.kind==='level');
  assert.equal(memories.length,1);assert.equal(memories[0].id,'level:2');
  assert.equal(memories[0].level,2);assert.equal(memories[0].at,after.updatedAt);
  const second=finishOrder(after,after.updatedAt+1000);
  assert.equal(second.diary.entries.filter(entry=>entry.id==='level:2').length,1);
});

test('dining capacity is shared and expansion grows from two to eight seats',()=>{
  let state=eligible(38);state.coins=10000;
  state=action(action(state,'restaurant-start',{recipeId:'rice'}),'restaurant-start',{recipeId:'coffee'});
  assert.equal(action(state,'restaurant-start',{recipeId:'rice'}),null);
  for(const capacity of [4,6,8]) {
    state=action(state,'restaurant-upgrade',{upgradeId:'tables'});
    assert.equal(restaurantInfo(state,NOW).capacity,capacity);
  }
  assert.equal(action(state,'restaurant-upgrade',{upgradeId:'tables'}),null);
  assert.equal(state.restaurant.orders.length,2,'expanding does not overwrite seated customers');
});

test('restaurant progression unlocks recipes independently of pet level',()=>{
  let state=initialState(NOW);state.xp=0;
  assert.equal(action(state,'restaurant-start',{recipeId:'pancake'}),null);
  for(let i=0;i<37;i++)state=finishOrder(state,NOW+i*60000);
  assert.equal(restaurantInfo(state,NOW+2220000).level,3);
  assert.equal(state.restaurant.stats.experience,222);
  assert.equal(action(state,'restaurant-start',{recipeId:'pancake'},NOW+2220000),null);
  state=finishOrder(state,NOW+2220000);
  const info=restaurantInfo(state,NOW+2280000);
  assert.equal(info.level,4);assert.equal(info.recipes.find(recipe=>recipe.id==='pancake').unlocked,true);
  assert.equal(state.restaurant.stats.experience,228);
  assert.ok(action(state,'restaurant-start',{recipeId:'pancake'},NOW+2280000));
  assert.equal(action(state,'restaurant-start',{recipeId:'pizza'},NOW+2280000),null);
});

test('facilities and staff spend coins, research spends fragments, and existing orders retain their prices',()=>{
  let state=fragments(eligible(13));state.coins=10000;
  const started=action(state,'restaurant-start',{recipeId:'rice'});
  state=action(started,'restaurant-upgrade',{upgradeId:'tips'});
  state=action(state,'restaurant-upgrade',{upgradeId:'kitchen'});
  state=action(state,'restaurant-recipe',{recipeId:'rice'});
  state=action(state,'restaurant-hire');
  assert.equal(state.coins,10000-120-180-220);
  const next=action(state,'restaurant-start',{recipeId:'rice'}),orders=restaurantInfo(next,NOW).orders;
  assert.equal(orders[0].rewardCoins,24);assert.equal(orders[0].rewardXp,6);
  assert.ok(orders[1].rewardCoins>24);assert.ok(orders[1].rewardXp>6);
  const workMs=order=>order.workflow.segments.filter(segment=>segment.phase==='work'&&segment.zoneId!==10).reduce((total,segment)=>total+segment.endAt-segment.startAt,0);
  assert.ok(workMs(orders[1])<workMs(orders[0]),'upgrades shorten work even when the shared stations have a queue');
  assert.equal(orders[0].autoServeAt,orders[0].workflow.servedAt);assert.equal(orders[1].autoServeAt,orders[1].workflow.servedAt);
  assert.equal(action({...state,coins:0},'restaurant-hire'),null);
});

test('hired staff deliver after cooking, while offline progress creates no extra orders or automatic currency',()=>{
  let state=action(eligible(2),'restaurant-hire');
  state=action(state,'restaurant-start',{recipeId:'rice'});
  const order=restaurantInfo(state,NOW).orders[0];
  assert.equal(restaurantInfo(state,order.readyAt).orders[0].status,'delivering');
  assert.equal(restaurantInfo(state,order.autoServeAt).orders[0].status,'dining');
  const future=NOW+365*86400000,info=restaurantInfo(state,future);
  assert.equal(info.orders.length,1);assert.equal(info.orders[0].status,'collectible');
  assert.equal(state.coins,980);assert.equal(state.xp,86);
  const collected=action(state,'restaurant-collect',{orderId:order.id},future);
  assert.equal(collected.coins,1004);assert.equal(collected.restaurant.orders.length,0);
});

test('restaurant action allowlist rejects forged reward, actor, timing and state fields',()=>{
  for(const value of [
    {type:'restaurant-collect',orderId:'table-1',amount:9999},
    {type:'restaurant-start',recipeId:'rice',readyAt:0},
    {type:'restaurant-serve',orderId:'table-1',at:0},
    {type:'restaurant-hire',staff:3},
    {type:'restaurant-upgrade',upgradeId:'coins'},
    {type:'restaurant-start',recipeId:'unknown'},
    {type:'restaurant-collect',orderId:'table-0'},
  ]) {
    assert.equal(sanitizeRestaurantAction(value),null);
    assert.equal(restaurantActionResult(initialState(NOW),value,ALICE,NOW).ok,false);
  }
});

test('owned themes switch without repeated charges and cannot bypass wallet checks',()=>{
  let state=action(eligible(33),'restaurant-theme',{themeId:'mint'});
  assert.equal(state.coins,1080);
  state=action(state,'restaurant-theme',{themeId:'cream'});
  state=action(state,'restaurant-theme',{themeId:'mint'});
  assert.equal(state.coins,1080);
  assert.equal(action({...state,coins:0},'restaurant-theme',{themeId:'sakura'}),null);
});

test('restaurant validator rejects corrupt totals, forged snapshot prices and duplicate order IDs',()=>{
  const good=action(initialState(NOW),'restaurant-start',{recipeId:'rice'}).restaurant;
  assert.equal(validRestaurant(JSON.parse(JSON.stringify(good))),true);
  for(const mutate of [
    value=>value.orders.push({...value.orders[0]}),
    value=>value.orders[0].readyAt=NOW,
    value=>value.orders[0].price=99999,
    value=>value.orders[0].recipeLevel=4,
    value=>value.stats.earned=-1,
    value=>value.nextOrderId=1,
    value=>value.staff=10,
    value=>value.levels.tables=11,
    value=>value.orders[0].servedAt=NOW,
  ]) {const bad=structuredClone(good);mutate(bad);assert.equal(validRestaurant(bad),false);}
});

test('collection at a full wallet or unsafe experience total preserves the collectible order',()=>{
  let state=action(initialState(NOW),'restaurant-start',{recipeId:'rice'});
  const order=state.restaurant.orders[0];
  const collectAt=order.workflow.servedAt+RESTAURANT_DINING_MS;
  assert.equal(action({...state,coins:999999},'restaurant-collect',{orderId:order.id},collectAt),null);
  assert.equal(action({...state,xp:Number.MAX_SAFE_INTEGER},'restaurant-collect',{orderId:order.id},collectAt),null);
  assert.equal(state.restaurant.orders.length,1);
});

test('the menu has sixteen ordinary and five distinct signature dishes',()=>{
  assert.equal(RESTAURANT_RECIPES.length,16);
  assert.equal(new Set(RESTAURANT_RECIPES.map(recipe=>recipe.id)).size,16);
  assert.equal(RESTAURANT_NEW_RECIPE_IDS.length,11);
  for(const category of RESTAURANT_RECIPE_CATEGORIES)assert.equal([...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES].filter(recipe=>recipe.category===category).length,7);
  assert.equal(new Set([...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES].map(recipe=>recipe.id)).size,21);
  const fresh=restaurantInfo(initialState(NOW),NOW);
  assert.equal(fresh.recipes.filter(recipe=>recipe.unlocked).length,5);
  assert.equal(fresh.recipes.filter(recipe=>recipe.unlocked&&RESTAURANT_NEW_RECIPE_IDS.includes(recipe.id)).length,3);
});

test('a six-dish saved restaurant retains all progress and existing order snapshots while receiving new recipe levels',()=>{
  let state=action(fragments(eligible(16)),'restaurant-recipe',{recipeId:'rice'});
  state=action(state,'restaurant-theme',{themeId:'mint'});
  state=action(state,'restaurant-start',{recipeId:'rice'});
  const legacy=structuredClone(state.restaurant);
  delete legacy.progression;
  for(const id of RESTAURANT_NEW_RECIPE_IDS)delete legacy.recipeLevels[id];
  const before=structuredClone(legacy),restored=normalizeState({...state,restaurant:legacy},NOW+1000);
  assert.equal(validRestaurant(legacy),true);
  assert.equal(Object.keys(restored.restaurant.recipeLevels).length,18);
  for(const id of RESTAURANT_NEW_RECIPE_IDS)assert.equal(restored.restaurant.recipeLevels[id],1);
  const {recipeLevels,progression,...progress}=restored.restaurant,{recipeLevels:oldLevels,...oldProgress}=legacy;
  assert.deepEqual(progress,oldProgress);assert.equal(recipeLevels.rice,2);
  assert.equal(progression.version,2);assert.equal(progression.experienceOffset,0);
  assert.deepEqual([...progression.legacyRecipes].sort(),[...RESTAURANT_RECIPES.map(recipe=>recipe.id),...PROMOTED_SIGNATURE_RECIPE_IDS].sort());
  assert.equal(restored.coins,state.coins);assert.equal(restored.xp,state.xp);
  assert.deepEqual(legacy,before,'migration never mutates the saved object');
  const order=restored.restaurant.orders[0];
  const collected=action(restored,'restaurant-collect',{orderId:order.id},order.workflow.servedAt+RESTAURANT_DINING_MS,BOB);
  assert.equal(collected.coins,restored.coins+31);assert.equal(collected.xp,restored.xp);assert.equal(collected.pendingGrowth.at(-1).amount,8);
  const bad=structuredClone(legacy);delete bad.recipeLevels.rice;assert.equal(validRestaurant(bad),false);
  const unknown=structuredClone(legacy);unknown.recipeLevels.unknownDish=1;assert.equal(validRestaurant(unknown),false);
});

test('each added dish respects its unlock level and completes research, cooking, delivery and collection',async t=>{
  for(const recipe of RESTAURANT_RECIPES.filter(recipe=>RESTAURANT_NEW_RECIPE_IDS.includes(recipe.id)))await t.test(recipe.name,()=>{
    const base={...initialState(NOW),coins:1200};
    if(recipe.unlockLevel>1)assert.equal(action(base,'restaurant-start',{recipeId:recipe.id}),null);
    base.restaurant.stats.experience=levelStartXp(Math.max(10,recipe.unlockLevel));
    const researched=action(fragments(base,recipe.id),'restaurant-recipe',{recipeId:recipe.id});
    assert.equal(researched.coins,base.coins);
    const started=action(researched,'restaurant-start',{recipeId:recipe.id}),order=started.restaurant.orders[0];
    assert.equal(order.readyAt,NOW+recipe.seconds*1000);
    assert.equal(action(started,'restaurant-serve',{orderId:order.id},order.readyAt-1),null);
    const served=action(started,'restaurant-serve',{orderId:order.id},order.readyAt,BOB);
    const reward=restaurantInfo(served,order.readyAt+RESTAURANT_DINING_MS).orders.find(item=>item.id===order.id);
    const completed=action(served,'restaurant-collect',{orderId:order.id},order.readyAt+RESTAURANT_DINING_MS,BOB);
    assert.equal(completed.coins,researched.coins+reward.rewardCoins);
    assert.equal(completed.xp,base.xp);assert.equal(completed.pendingGrowth.at(-1).amount,recipe.xp+2);
    assert.equal(completed.restaurant.stats.served,base.restaurant.stats.served+1);
    assert.equal(action(completed,'restaurant-collect',{orderId:order.id},order.readyAt+RESTAURANT_DINING_MS),null);
  });
});
