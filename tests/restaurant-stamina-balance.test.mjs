import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { normalizeRestaurant, validRestaurant } from '../src/restaurant.js';
import { KITCHEN_FLOWS, validKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { advanceInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { STAFF_BASE_ENERGY, normalizeStaffTraining, workerAbilitySnapshot, staffAbilityLevelEffects } from '../src/restaurant-staff-training.js';

// Authentic 100-point save snapshots, generated before this balance update.
const { now:NOW, fixtures }=JSON.parse(await readFile(new URL('./fixtures/restaurant-stamina-100.json',import.meta.url)));
const ACTOR={id:'balance-manager',name:'店长'};

test('new employees start at 200 and capacity training retains its fifteen-point increment',()=>{
  assert.equal(STAFF_BASE_ENERGY,200);
  const training=normalizeStaffTraining(null,NOW,6);
  assert.equal(Object.keys(training).length,7);
  for(const record of Object.values(training))assert.equal(record.energy,200);
  for(let level=1;level<=10;level++)assert.deepEqual(staffAbilityLevelEffects('stamina',level),{maxEnergy:200+15*(level-1),capacityPercent:7.5*(level-1)});
});

test('old employees gain the extra hundred once while spent stamina, upgrades and booked clocks survive',()=>{
  const old={'worker-1':{levels:{speed:2,stamina:4,endurance:5,skill:3},energy:60,energyAt:NOW+30000,energyMode:'rest-room',rest:null}};
  const migrated=normalizeStaffTraining(old,NOW,0);
  assert.equal(migrated['worker-1'].energy,160);
  assert.equal(workerAbilitySnapshot('worker-1',migrated,NOW).maxEnergy,245);
  assert.deepEqual(migrated['worker-1'].levels,old['worker-1'].levels);
  assert.equal(migrated['worker-1'].energyAt,old['worker-1'].energyAt);
  assert.deepEqual(normalizeStaffTraining(JSON.parse(JSON.stringify(migrated)),NOW+86400000,0),migrated);
  assert.equal(workerAbilitySnapshot('worker-1',migrated,NOW+86400000).energy,160,'standing does not recover');
  assert.equal(old['worker-1'].energy,60,'normalization does not mutate the input');
});

for(const [name,saved] of Object.entries(fixtures))test(`${name}: genuine old work and rest snapshots survive migration, refresh and the next click`,()=>{
  const before=structuredClone(saved);
  assert.ok(validRestaurant(saved),'the old format must validate before normalization');
  const restaurant=normalizeRestaurant(saved,NOW),order=restaurant.orders[0];
  assert.ok(validRestaurant(restaurant));
  for(const key of Object.keys(saved).filter(key=>key!=='staffTraining'))assert.deepEqual(restaurant[key],saved[key],key);
  for(const [id,old] of Object.entries(saved.staffTraining)){
    const current=restaurant.staffTraining[id];
    assert.equal(current.energy,old.energy+100);
    assert.equal(current.energyBase,200);
    assert.equal(current.energyAt,old.energyAt);
    assert.deepEqual(current.rest,old.rest,'previously booked rest deadline and route stay intact');
  }
  const last=order.workflow.runs.at(-1),at=last.rest?.fullAt??last.endAt;
  const state={...initialState(NOW),coins:1234,xp:87,restaurant},reload=normalizeState(JSON.parse(JSON.stringify(state)),at);
  assert.equal(reload.coins,1234);assert.equal(reload.xp,87);
  assert.deepEqual(reload.restaurant,restaurant,'refresh cannot grant another hundred');
  const result=advanceInteractiveWorkflow(restaurant,order,KITCHEN_FLOWS.coffee[order.workflow.runs.length].id,at);
  assert.equal(result.ok,true,result.reason);
  const nextOrder={...order,workflow:result.workflow,readyAt:result.workflow.readyAt??order.createdAt};
  const next={...restaurant,orders:[nextOrder],staffTraining:result.staffTraining},run=result.workflow.runs.at(-1);
  assert.ok(validKitchenWorkflow(result.workflow,nextOrder,next));assert.ok(validRestaurant(next));
  assert.equal(run.energyBase,200);
  assert.equal(run.energyAfter,run.energyBefore-run.energyCost);
  assert.deepEqual(result.workflow.runs.slice(0,-1),saved.orders[0].workflow.runs,'historical charges and timings are immutable');
  assert.deepEqual(normalizeRestaurant(JSON.parse(JSON.stringify(next)),run.endAt),next);
  assert.deepEqual(saved,before);
});

test('a migrated old rest finishes on its existing deadline and reaches the new capacity',()=>{
  const restaurant=normalizeRestaurant(fixtures.exhaustedV4,NOW),record=restaurant.staffTraining['worker-1'];
  const {rest}=record;
  assert.equal(record.energy,100);
  assert.equal(workerAbilitySnapshot('worker-1',restaurant.staffTraining,rest.arriveAt-1).energy,100);
  assert.equal(workerAbilitySnapshot('worker-1',restaurant.staffTraining,rest.arriveAt+800).energy,101);
  assert.equal(workerAbilitySnapshot('worker-1',restaurant.staffTraining,rest.fullAt).energy,200);
});

test('new capacity snapshots reject forged bases, extra grants and regressions without relaxing route validation',()=>{
  const migrated=normalizeRestaurant(fixtures.activeV4,NOW),order=migrated.orders[0],at=order.workflow.runs[0].endAt;
  const result=advanceInteractiveWorkflow(migrated,order,'espresso',at);
  const next={...migrated,staffTraining:result.staffTraining,orders:[{...order,workflow:result.workflow}]};
  for(const mutate of [
    r=>r.staffTraining['worker-1'].energyBase=300,
    r=>r.staffTraining['worker-1'].energy++,
    r=>r.orders[0].workflow.runs[1].energyBase=201,
    r=>{const run=r.orders[0].workflow.runs[1];run.energyBefore++;run.energyAfter++;},
    r=>r.orders[0].workflow.runs[0].energyBase=200,
    r=>r.orders[0].workflow.segments[0].endAt--,
  ]){const forged=structuredClone(next);mutate(forged);assert.equal(validRestaurant(forged),false);}
});

test('a full default employee completes all rice operations and delivery with one hundred stamina remaining',()=>{
  let state=reduceAction(initialState(NOW),{type:'restaurant-arrive',recipeId:'rice',partySize:1},ACTOR,NOW);
  const order=state.restaurant.orders[0];let at=order.createdAt;
  state=reduceAction(state,{type:'restaurant-kitchen-accept',orderId:order.id},ACTOR,at);
  for(const {id} of [...KITCHEN_FLOWS.rice,{id:'delivery'}]){
    state=reduceAction(state,{type:'restaurant-kitchen-step',orderId:order.id,stepId:id},ACTOR,at);assert.ok(state);
    const run=state.restaurant.orders[0].workflow.runs.at(-1);assert.equal(run.energyCost,10);assert.equal(run.rest,null);assert.equal(run.durationMultiplier,1);at=run.endAt;
  }
  assert.equal(state.restaurant.staffTraining['worker-1'].energy,100);
  assert.ok(validRestaurant(state.restaurant));
});
