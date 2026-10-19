import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { validRestaurant, normalizeRestaurant, restaurantInfo, sanitizeRestaurantAction, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { RESTAURANT_DECORATIONS, RESTAURANT_CONSTRUCTION_MS, restaurantDecoration, restaurantDecorationInfo, decorationReward } from '../src/restaurant-decor.js';
import { KITCHEN_FLOWS, kitchenStepDuration, validKitchenReservations } from '../src/restaurant-kitchen.js';
import { levelStartXp } from '../src/growth-levels.js';
import { RESTAURANT_UNLOCK_LEVELS } from '../src/restaurant-progression.js';
const NOW=Date.parse('2026-10-18T12:00:00Z'),ALICE={id:'decor-alice',name:'小鱼'},BOB={id:'decor-bob',name:'小猫'};
const act=(state,type,fields={},at=NOW,actor=ALICE)=>reduceAction(state,{type,...fields},actor,at);
// These tests exercise decoration economics and construction after purchase permissions are met.
const TEST_EXPERIENCE=levelStartXp(Math.max(...Object.values(RESTAURANT_UNLOCK_LEVELS.decoration),...Object.values(RESTAURANT_UNLOCK_LEVELS.theme),...Object.values(RESTAURANT_UNLOCK_LEVELS.staff)));
const funded=()=>{const state={...initialState(NOW),coins:10000,goldFish:100};state.restaurant.stats.experience=TEST_EXPERIENCE;return state;};
function equip(state,id,at=NOW) {
  const result=act(state,'restaurant-decoration',{decorationId:id},at);
  assert.ok(result,`can construct ${id}`);
  return normalizeState(result,at+RESTAURANT_CONSTRUCTION_MS);
}
function complete(state,recipeId='sandwich',at=NOW) {
  let next=act(state,'restaurant-start',{recipeId},at);assert.ok(next);
  let order=restaurantInfo(next,at).orders.at(-1);
  if(!order.workflow&&order.autoServeAt===null){next=act(next,'restaurant-serve',{orderId:order.id},order.readyAt);order=restaurantInfo(next,order.readyAt).orders.at(-1);}
  next=act(next,'restaurant-collect',{orderId:order.id},order.collectAt,BOB);assert.ok(next);
  return next;
}

test('three base scenes have two complete suites each, with only one or two 1–2% bonuses',()=>{
  assert.equal(RESTAURANT_DECORATIONS.length,6);
  for(const theme of ['cream','mint','sakura'])assert.equal(RESTAURANT_DECORATIONS.filter(item=>item.theme===theme).length,2);
  for(const suite of RESTAURANT_DECORATIONS){assert.ok(Object.keys(suite.buffs).length>=1&&Object.keys(suite.buffs).length<=2);for(const [key,bp] of Object.entries(suite.buffs)){assert.ok(['coins','experience','cookSpeed'].includes(key));assert.ok(bp>=100&&bp<=200);}}
});

test('old ownership grants permanent bonuses without rewriting the save or equipping a scene',()=>{
  const state=initialState(NOW),before=structuredClone(state.restaurant),restored=normalizeRestaurant(state.restaurant,NOW);
  const {staffTraining,waitingParties,...rest}=restored;assert.deepEqual(rest,before);assert.deepEqual(waitingParties,[]);assert.equal(Object.hasOwn(restored,'decorationId'),false);assert.deepEqual(state.restaurant,before);
  const info=restaurantInfo(state,NOW).decorationInfo;
  assert.equal(info.decoration.id,'cream-bakery');assert.equal(info.activeDecorationId,null);
  assert.deepEqual(info.activeBuffs,{coins:100,experience:0,cookSpeed:0});
  const old=act(state,'restaurant-start',{recipeId:'sandwich'});assert.deepEqual(old.restaurant.orders[0].decorationSnapshot,{version:2,ids:['cream-bakery'],coins:100,experience:0,cookSpeed:0});
});

test('the free default suite sends two workers while its owned income bonus stays active',()=>{
  const state=initialState(NOW),building=act(state,'restaurant-decoration',{decorationId:'cream-bakery'});
  assert.equal(building.coins,state.coins);assert.equal(building.restaurant.theme,'cream');assert.equal(building.restaurant.decorationId,undefined);
  assert.equal(restaurantInfo(building,NOW).decorationInfo.activeBuffs.coins,100);
  assert.equal(restaurantInfo(building,NOW).decorationInfo.construction.workers.length,2);
  const complete=restaurantInfo(building,NOW+12000).decorationInfo;
  assert.equal(complete.activeDecorationId,'cream-bakery');assert.equal(complete.activeBuffs.coins,100);assert.equal(complete.construction,null);
});

test('construction charges once at acceptance, preserves the previous scene and uses authoritative phases',()=>{
  const state=funded(),building=act(state,'restaurant-decoration',{decorationId:'mint-greenhouse'}),job=building.restaurant.construction;
  assert.equal(building.coins,state.coins-120);assert.equal(job.finishAt,NOW+12000);
  for(const [offset,phase] of [[0,'travel'],[1999,'travel'],[2000,'build'],[6999,'build'],[7000,'install'],[9499,'install'],[9500,'leave'],[11999,'leave']])assert.equal(restaurantInfo(building,NOW+offset).decorationInfo.construction.phase,phase);
  assert.equal(restaurantInfo(building,NOW+6999).restaurant.theme,'cream');assert.equal(restaurantInfo(building,NOW+6999).decorationInfo.activeDecorationId,null);
  assert.equal(restaurantInfo(building,NOW+7000).restaurant.theme,'mint');assert.equal(restaurantInfo(building,NOW+7000).decorationInfo.activeBuffs.cookSpeed,150);
  assert.equal(restaurantInfo(building,NOW+12000).restaurant.construction,null);
  assert.equal(building.restaurant.theme,'cream','read-only time projection never mutates saved input');
});

test('three scene modules install in order after construction, before the crew leaves',()=>{
  const building=act(funded(),'restaurant-decoration',{decorationId:'sakura-evening'});
  for(const [offset,count] of [[6999,0],[7000,1],[7799,1],[7800,2],[8600,3],[9500,3]])assert.equal(restaurantInfo(building,NOW+offset).decorationInfo.construction.slots.filter(slot=>slot.installed).length,count);
});

test('switching roles, refresh and later actions retain construction identity and never restart its clock',()=>{
  const building=act(funded(),'restaurant-decoration',{decorationId:'cream-library'}),id=building.restaurant.construction.id;
  const reload=normalizeState(JSON.parse(JSON.stringify(building)),NOW+3000);
  const order=act(reload,'restaurant-start',{recipeId:'sandwich'},NOW+3000,BOB);
  assert.equal(order.restaurant.construction.id,id);assert.equal(order.restaurant.construction.startedAt,NOW);
  assert.deepEqual(order.restaurant.orders[0].decorationSnapshot,{version:2,ids:['cream-bakery','cream-library'],coins:100,experience:150,cookSpeed:0},'unlock bonuses apply before the scene is installed');
  assert.equal(normalizeState(order,NOW+12000).restaurant.decorationId,'cream-library');
});

test('one room cannot run overlapping construction or escape it using an old theme action',()=>{
  const building=act(funded(),'restaurant-decoration',{decorationId:'mint-seaside'}),before=structuredClone(building);
  for(const actor of [ALICE,BOB])for(const id of ['mint-seaside','sakura-evening'])assert.equal(act(building,'restaurant-decoration',{decorationId:id},NOW+1000,actor),null);
  assert.equal(act(building,'restaurant-theme',{themeId:'royal'},NOW+1000),null);
  assert.deepEqual(building,before);
});

test('owned suites can be reinstalled with a fresh crew but never charge twice',()=>{
  let state=equip(funded(),'mint-seaside'),balance=state.coins;
  state=equip(state,'cream-bakery',NOW+12000);assert.equal(state.coins,balance);
  const again=act(state,'restaurant-decoration',{decorationId:'mint-seaside'},NOW+24000);
  assert.equal(again.coins,balance);assert.equal(again.restaurant.construction.startedAt,NOW+24000);
  assert.equal(act(state,'restaurant-decoration',{decorationId:'cream-bakery'},NOW+24000),null);
});

test('old base theme ownership unlocks its original suite without charging for that theme again',()=>{
  let state=act(funded(),'restaurant-theme',{themeId:'mint'});assert.equal(state.coins,9880);
  const building=act(state,'restaurant-decoration',{decorationId:'mint-greenhouse'});
  assert.equal(building.coins,state.coins);assert.ok(building.restaurant.ownedDecorations.includes('mint-greenhouse'));
});

test('premium gold decorations coexist with a scene and retain its bonuses and ownership',()=>{
  let state=equip(funded(),'sakura-evening'),balance=state.coins;
  state=act(state,'restaurant-theme',{themeId:'royal'},NOW+12000);
  assert.ok(state);assert.equal(state.restaurant.theme,'sakura');assert.deepEqual(state.restaurant.equippedPremiumDecorations,['royal']);assert.equal(state.coins,balance);assert.equal(state.goldFish,88);
  assert.equal(restaurantInfo(state,NOW+12000).decorationInfo.activeDecorationId,'sakura-evening');
  assert.ok(state.restaurant.ownedDecorations.includes('sakura-evening'));
  assert.equal(state.coins,balance);assert.equal(state.restaurant.decorationId,'sakura-evening');
});

test('all owned suite bonuses stack permanently regardless of the selected scene',()=>{
  let state=funded(),clock=NOW;
  const totals=[[100,0,0],[100,150,0],[100,150,150],[300,150,250],[300,350,250],[450,450,250]];
  for(const [index,suite] of RESTAURANT_DECORATIONS.entries()){state=equip(state,suite.id,clock);clock+=12000;const info=restaurantInfo(state,clock).decorationInfo;assert.deepEqual(info.activeBuffs,Object.fromEntries(['coins','experience','cookSpeed'].map((key,i)=>[key,totals[index][i]])));}
  assert.equal(state.restaurant.ownedDecorations.length,6);
});

test('low-price orders accumulate sub-coin bonuses rather than rounding them away',()=>{
  let state=equip(funded(),'cream-bakery'),clock=NOW+12000;
  const balance=state.coins;
  for(let index=0;index<4;index++){state=complete(state,'sandwich',clock);clock+=30000;}
  assert.equal(state.coins,balance+4*28+1);assert.equal(state.restaurant.decorationCarry.coins,1200);
  assert.equal(state.restaurant.stats.earned,113);assert.equal(validRestaurant(state.restaurant),true);
});

test('low XP gains use exact tenths and preserve the remainder across collection and reload',()=>{
  let state=equip(funded(),'cream-library'),clock=NOW+12000;
  const before=state.xp;
  state=complete(state,'sandwich',clock);assert.equal(state.xp,before);assert.equal(state.pendingGrowth.at(-1).amount,6);assert.equal(state.restaurant.decorationCarry.experience,900);
  state=normalizeState(JSON.parse(JSON.stringify(state)),clock+30000);
  state=complete(state,'sandwich',clock+30000);
  assert.equal(state.xp,before);assert.deepEqual(state.pendingGrowth.map(r=>r.amount),[6,6.1]);
  for(const reward of state.pendingGrowth)state=act(state,'claim-growth',{rewardId:reward.id},state.updatedAt+1);
  assert.equal(state.xp,before+12.1);assert.equal(state.restaurant.stats.experience,TEST_EXPERIENCE+12.1);assert.equal(state.restaurant.decorationCarry.experience,800);
  assert.equal(validRestaurant(state.restaurant),true);
});

test('changing suites does not alter an accepted order’s income or XP bonus snapshot',()=>{
  let state=equip(funded(),'sakura-evening'),clock=NOW+12000;
  state=act(state,'restaurant-start',{recipeId:'sandwich'},clock);
  const saved=structuredClone(state.restaurant.orders[0]);
  state=equip(state,'cream-library',clock);
  assert.deepEqual(state.restaurant.orders[0],saved);
  const info=restaurantInfo(state,clock+12000).orders[0];
  assert.equal(info.decorationSnapshot.coins,250);assert.equal(info.decorationSnapshot.experience,300);
  const manual=act(state,'restaurant-serve',{orderId:saved.id},saved.readyAt);
  const done=act(manual,'restaurant-collect',{orderId:saved.id},saved.readyAt+RESTAURANT_DINING_MS);
  assert.equal(done.restaurant.decorationCarry.coins,7000);assert.equal(done.restaurant.decorationCarry.experience,800);
});

test('old orders accepted before equipping a suite retain original amounts and timing',()=>{
  let state=act(funded(),'restaurant-start',{recipeId:'sandwich'}),order=structuredClone(state.restaurant.orders[0]);
  state=equip(state,'mint-seaside');assert.deepEqual(state.restaurant.orders[0],order);
  const served=act(state,'restaurant-serve',{orderId:order.id},order.readyAt),paid=act(served,'restaurant-collect',{orderId:order.id},order.readyAt+4500);
  assert.equal(paid.coins,state.coins+28);assert.equal(paid.xp,state.xp);assert.equal(paid.pendingGrowth.at(-1).amount,6);
});

test('cooking-speed suites shorten legacy cooking time while keeping accepted timings frozen',()=>{
  const ordinary=act(funded(),'restaurant-start',{recipeId:'sandwich'}).restaurant.orders[0];
  let state=equip(funded(),'mint-greenhouse');state=act(state,'restaurant-start',{recipeId:'sandwich'},NOW+12000);
  const fast=state.restaurant.orders[0];assert.equal(fast.readyAt-fast.createdAt,Math.round(9000/1.015));assert.ok(fast.readyAt-fast.createdAt<ordinary.readyAt-ordinary.createdAt);
  const switched=equip(state,'cream-library',NOW+12000);assert.deepEqual(switched.restaurant.orders[0],fast);
  assert.equal(validRestaurant(switched.restaurant),true);
});

test('detailed cooking snapshots speed on every real work step and preserves exact walking and return paths',()=>{
  const plain=act(funded(),'restaurant-start',{recipeId:'rice'}).restaurant.orders[0];
  const fast=act(equip(funded(),'mint-greenhouse'),'restaurant-start',{recipeId:'rice'},NOW+12000).restaurant.orders[0];
  assert.equal(fast.workflow.cookSpeedBp,150);
  for(const work of KITCHEN_FLOWS.rice){const segment=fast.workflow.segments.find(segment=>segment.phase==='work'&&segment.stepId===work.id);assert.equal(segment.endAt-segment.startAt,kitchenStepDuration(work,1,1,fast.workflow.workerLevels,150));}
  const walks=order=>order.workflow.segments.filter(segment=>['walk','delivery','return'].includes(segment.phase)).map(segment=>({phase:segment.phase,from:segment.from,to:segment.to,ms:segment.endAt-segment.startAt}));
  assert.deepEqual(walks(fast),walks(plain));assert.ok(fast.readyAt-fast.createdAt<plain.readyAt-plain.createdAt);
});

test('multiple trained workers retain non-overlapping reservations with an active speed suite',()=>{
  let state=equip(funded(),'mint-seaside');
  for(let i=0;i<3;i++)state=act(state,'restaurant-hire',{},NOW+12000);
  state=act(state,'restaurant-upgrade',{upgradeId:'tables'},NOW+12000);
  for(const recipeId of ['rice','coffee','rice','coffee'])state=act(state,'restaurant-start',{recipeId},NOW+12000);
  assert.equal(state.restaurant.orders.length,4);assert.equal(validKitchenReservations(state.restaurant),true);assert.equal(validRestaurant(JSON.parse(JSON.stringify(state.restaurant))),true);
});

test('forged snapshots, carry, construction clocks, ownership and unknown suites fail closed',()=>{
  const good=act(equip(funded(),'mint-greenhouse'),'restaurant-start',{recipeId:'rice'},NOW+12000).restaurant;
  for(const change of [r=>r.decorationId='missing',r=>r.ownedDecorations=['missing'],r=>r.ownedDecorations={},r=>r.orders[0].decorationSnapshot.cookSpeed=9999,r=>r.orders[0].workflow.cookSpeedBp=0,r=>r.decorationCarry={coins:10000,experience:0},r=>r.decorationCarry={coins:0,experience:1000},r=>r.decorationCarry={coins:-1,experience:0}]){const bad=structuredClone(good);change(bad);assert.equal(validRestaurant(bad),false);}
  const construction=act(funded(),'restaurant-decoration',{decorationId:'mint-seaside'}).restaurant;
  for(const change of [r=>r.construction.installAt--,r=>r.construction.finishAt--,r=>r.construction.startedAt--,r=>r.construction.toDecorationId='sakura-evening',r=>r.construction.fromTheme='missing',r=>r.construction.id='decoration-2']){const bad=structuredClone(construction);change(bad);assert.equal(validRestaurant(bad),false);}
});

test('construction intent does not accept client-supplied buff, price, ownership, timestamps or targets',()=>{
  const valid={type:'restaurant-decoration',decorationId:'cream-library'};assert.deepEqual(sanitizeRestaurantAction(valid),valid);
  for(const extra of [{coins:999},{cost:0},{owned:true},{startedAt:0},{finishAt:0},{buffs:{coins:10000}},{workers:[]},{theme:'cream'}])assert.equal(sanitizeRestaurantAction({...valid,...extra}),null);
  assert.equal(sanitizeRestaurantAction({...valid,decorationId:'unknown'}),null);
});

test('insufficient funds cannot unlock, start construction or mutate a home',()=>{
  const state={...funded(),coins:179},before=structuredClone(state);
  assert.equal(act(state,'restaurant-decoration',{decorationId:'cream-library'}),null);assert.deepEqual(state,before);
});

test('sub-unit carry survives a switch and is spent only at successful authoritative collection',()=>{
  const reward=decorationReward({coins:28,xp:6},{coins:100,experience:150},{coins:9800,experience:900});
  assert.deepEqual(reward,{coins:29,xp:6.1,carry:{coins:2600,experience:800}});
  let state=equip(funded(),'cream-bakery');state=complete(state,'sandwich',NOW+12000);
  const carry=structuredClone(state.restaurant.decorationCarry);state=equip(state,'cream-library',NOW+50000);
  assert.deepEqual(state.restaurant.decorationCarry,carry);
  const started=act(state,'restaurant-start',{recipeId:'sandwich'},NOW+62000),before=structuredClone(started);
  assert.equal(act(started,'restaurant-collect',{orderId:started.restaurant.orders[0].id},NOW+62000),null);assert.deepEqual(started,before);
});

test('construction derives from a stable saved job after the clock passes finish and keeps wallet intact',()=>{
  const state=act(funded(),'restaurant-decoration',{decorationId:'sakura-teahouse'}),before=structuredClone(state);
  const restored=normalizeState(JSON.parse(JSON.stringify(state)),NOW+86400000);
  assert.equal(restored.restaurant.construction,null);assert.equal(restored.restaurant.decorationId,'sakura-teahouse');assert.equal(restored.coins,state.coins);assert.deepEqual(state,before);
  assert.equal(restaurantDecorationInfo(restored.restaurant,NOW+86400000).activeBuffs.experience,200);
});
