import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialState,normalizeState,reduceAction} from '../src/state.js';
import {normalizeRestaurant,validRestaurant,restaurantInfo,restaurantProgressPreserved} from '../src/restaurant.js';
import {KITCHEN_FLOWS} from '../src/restaurant-kitchen.js';
import {STAFF_ABILITY_VERSION,normalizeStaffTraining,validStaffTraining,workerAbilitySnapshot,workerDurationMultipliers,staffMaxEnergy,workerStepEnergyCost} from '../src/restaurant-staff-training.js';
const {now:NOW,fixtures}=JSON.parse(await readFile(new URL('./fixtures/restaurant-training-v1.json',import.meta.url)));
const ACTOR={id:'balance-v2-test',name:'Test'};

test('all seven employees receive doubled incremental effects across all ten training levels',()=>{
  assert.equal(STAFF_ABILITY_VERSION,2);
  for(let level=1;level<=10;level++){
    const training=normalizeStaffTraining(null,NOW,6);
    for(const [id,record] of Object.entries(training)){
      record.levels={speed:level,stamina:level,endurance:level,skill:level};
      const next=workerAbilitySnapshot(id,training,NOW),old=workerDurationMultipliers(record.levels,1),delta=level-1;
      assert.ok(Math.abs((1/next.walkMsMultiplier-1)-2*(1/old.walkMsMultiplier-1))<1e-10);
      assert.ok(Math.abs((1/next.workMsMultiplier-1)-2*(1/old.workMsMultiplier-1))<1e-10);
      assert.ok(Math.abs((1-next.enduranceMultiplier)-2*(1-old.enduranceMultiplier))<1e-10);
      assert.equal(next.maxEnergy-200,2*(staffMaxEnergy(record.levels,200,1)-200));
      assert.equal(next.qualityMultiplier,1+.03*delta);
      assert.equal(next.stepEnergyCost,10-delta);
    }
    assert.ok(validStaffTraining(training,6));
  }
  assert.equal(workerStepEnergyCost({endurance:10},15),2,'high-level recipes still have a positive cost at maximum endurance');
});

for(const [name,saved] of Object.entries(fixtures))test(`${name}: trained pre-update saves keep every booked timer and payout through migration and completion`,()=>{
  const before=structuredClone(saved),restaurant=normalizeRestaurant(saved,NOW);
  assert.ok(validRestaurant(saved));assert.ok(validRestaurant(restaurant));assert.ok(restaurantProgressPreserved(saved,restaurant));
  assert.deepEqual(restaurant.orders,saved.orders);
  for(const [id,old] of Object.entries(saved.staffTraining)){
    const record=restaurant.staffTraining[id];
    assert.equal(record.abilityVersion,2);assert.equal(record.energy,old.energy+30);
    assert.deepEqual(record.levels,old.levels);assert.equal(record.energyAt,old.energyAt);assert.deepEqual(record.rest,old.rest);
  }
  assert.deepEqual(normalizeRestaurant(JSON.parse(JSON.stringify(restaurant)),NOW),restaurant,'capacity is granted exactly once');
  let state={...initialState(NOW),coins:1234,xp:87,restaurant};
  const oldRewards=restaurantInfo({restaurant:saved},NOW).orders.map(o=>o.rewardCoins);
  assert.deepEqual(restaurantInfo(state,NOW).orders.map(o=>o.rewardCoins),oldRewards,'accepted dish prices remain frozen');
  const id=restaurant.orders[0].id;
  let flow=restaurant.orders[0].workflow,at=flow.completedAt??flow.runs?.at(-1)?.rest?.fullAt??flow.runs?.at(-1)?.endAt??flow.createdAt;
  if(flow.version!==1)for(const step of [...KITCHEN_FLOWS[flow.recipeId],{id:'delivery'}].slice(flow.runs.length)){
    const history=structuredClone(flow),next=reduceAction(state,{type:'restaurant-kitchen-step',orderId:id,stepId:step.id},ACTOR,at);
    assert.ok(next,`${name}: ${step.id} must be accepted`);assert.ok(validRestaurant(next.restaurant));assert.ok(restaurantProgressPreserved(state.restaurant,next.restaurant));
    flow=next.restaurant.orders[0].workflow;
    // Handoffs may add ownership metadata, but migration never rewrites charges or times.
    assert.deepEqual(flow.segments.slice(0,history.segments.length),history.segments);
    assert.deepEqual(flow.runs.slice(0,history.runs.length),history.runs);
    const run=flow.runs.at(-1);assert.equal(run.abilityVersion,2);assert.equal(run.energyCost,flow.version===2?(step.id==='delivery'?11:4):flow.stepEnergyBase?9:8);
    at=run.rest?.fullAt??run.endAt;state=next;
    assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)),at).restaurant,state.restaurant);
  }
  const collectible=restaurantInfo(state,at+20000).orders.find(o=>o.id===id);
  const paid=reduceAction(state,{type:'restaurant-collect',orderId:id},ACTOR,Math.max(at+20000,collectible.collectAt));
  assert.ok(paid);assert.ok(validRestaurant(paid.restaurant));assert.equal(paid.restaurant.stats.served,saved.stats.served+1);
  assert.equal(paid.restaurant.stats.earned-saved.stats.earned,oldRewards[0]);
  assert.deepEqual(saved,before);
});

test('balance metadata cannot forge another refill, downgrade snapshots or change a booked run',()=>{
  const migrated=normalizeRestaurant(fixtures.waitingV4,NOW),id=migrated.orders[0].id,at=migrated.orders[0].workflow.runs.at(-1).endAt;
  const next=reduceAction({...initialState(NOW),restaurant:migrated},{type:'restaurant-kitchen-step',orderId:id,stepId:'steam-milk'},ACTOR,at);
  assert.ok(next);assert.ok(validRestaurant(next.restaurant));
  for(const mutate of [
    r=>r.staffTraining['worker-1'].abilityVersion=3,
    r=>delete r.staffTraining['worker-1'].abilityVersion,
    r=>r.staffTraining['worker-1'].energy++,
    r=>r.orders[0].workflow.runs[0].abilityVersion=2,
    r=>delete r.orders[0].workflow.runs.at(-1).abilityVersion,
    r=>r.orders[0].workflow.runs.at(-1).abilityVersion=9,
    r=>{const run=r.orders[0].workflow.runs.at(-1);run.energyBefore+=30;run.energyAfter+=30;},
  ]){const changed=structuredClone(next.restaurant);mutate(changed);assert.equal(validRestaurant(changed),false);}
});
