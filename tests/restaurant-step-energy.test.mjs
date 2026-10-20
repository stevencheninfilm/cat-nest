import test from 'node:test';
import assert from 'node:assert/strict';
import { KITCHEN_FLOWS, kitchenInfo, validKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { STAFF_WORK_STEP_ENERGY_BASE, workerStepEnergyCost, normalizeStaffTraining } from '../src/restaurant-staff-training.js';
import { restaurantTrainingPanel } from '../src/restaurant-economy-ui.js';

const NOW=Date.parse('2026-10-18T20:00:00Z');
function fixture(recipeId,{version=4,endurance=1,staff=0}={}){
  const restaurant={staff,levels:{kitchen:1,fridge:1,tables:1},orders:[],staffTraining:normalizeStaffTraining(null,NOW,staff)};
  for(const record of Object.values(restaurant.staffTraining)){record.levels.endurance=endurance;record.energyMode='rest-room';record.rest=null;}
  const order={id:'table-1',recipeId,createdAt:NOW,readyAt:NOW,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:staff,actorId:'step-energy-test',workflow:createInteractiveWorkflow(restaurant,recipeId,NOW,{orderId:'table-1',version})};
  restaurant.orders.push(order);return {restaurant,order};
}
function apply(restaurant,order,result){
  assert.equal(result.ok,true,result.reason);order.workflow=result.workflow;order.readyAt=result.workflow.readyAt??order.createdAt;restaurant.staffTraining=result.staffTraining;
  assert.equal(validKitchenWorkflow(order.workflow,order,restaurant),true);
}

test('manual operations start at ten stamina and apply the doubled endurance discount at every level',()=>{
  assert.equal(STAFF_WORK_STEP_ENERGY_BASE,10);
  assert.deepEqual(Array.from({length:10},(_,i)=>workerStepEnergyCost({endurance:i+1})),[10,9,8,7,6,5,4,3,2,1]);
});

for(const version of [3,4])for(const endurance of [1,10])test(`v${version}, endurance ${endurance}: every recipe charges each accepted operation exactly once`,()=>{
  for(const recipeId of Object.keys(KITCHEN_FLOWS)){
    const {restaurant:r,order:o}=fixture(recipeId,{version,endurance});
    apply(r,o,acceptInteractiveWorkflow(r,o,NOW));assert.equal(r.staffTraining['worker-1'].energy,200,'acceptance does not charge energy');
    let now=NOW;
    for(const stepId of [...KITCHEN_FLOWS[recipeId].map(step=>step.id),'delivery']){
      apply(r,o,advanceInteractiveWorkflow(r,o,stepId,now));
      const run=o.workflow.runs.at(-1),cost=workerStepEnergyCost({endurance});
      assert.equal(run.energyCost,cost,`${recipeId}:${stepId}`);
      assert.equal(run.energyAfter,Math.max(0,run.energyBefore-cost));
      assert.equal(r.staffTraining[o.workflow.workerId].energy,run.energyAfter);
      const before=JSON.stringify(r);
      for(const segment of o.workflow.segments.filter(segment=>segment.startAt>=run.startAt))kitchenInfo(r,Math.floor((segment.startAt+segment.endAt)/2));
      kitchenInfo(r,run.endAt);assert.equal(JSON.stringify(r),before,'walks, countdowns and projections cannot charge again');
      assert.equal(advanceInteractiveWorkflow(r,o,stepId,run.endAt+1).ok,false,'a duplicate or skipped operation is rejected');
      assert.equal(JSON.stringify(r),before,'a rejected click cannot charge energy');
      now=run.rest?.fullAt??run.endAt;
    }
  }
});

test('a busy workstation cannot consume the waiting employee stamina before the operation is accepted',()=>{
  const {restaurant:r,order:first}=fixture('rice',{staff:1});
  const second={...first,id:'table-2',recipeId:'coffee',workflow:createInteractiveWorkflow(r,'coffee',NOW,{orderId:'table-2',seat:1,version:4})};r.orders.push(second);
  apply(r,first,acceptInteractiveWorkflow(r,first,NOW));apply(r,second,acceptInteractiveWorkflow(r,second,NOW));
  apply(r,first,advanceInteractiveWorkflow(r,first,'gather',NOW));
  const saved=JSON.stringify(r),result=advanceInteractiveWorkflow(r,second,'gather',NOW);
  assert.equal(result.ok,false);assert.equal(JSON.stringify(r),saved);assert.equal(r.staffTraining['worker-2'].energy,200);
  apply(r,second,advanceInteractiveWorkflow(r,second,'gather',first.workflow.runs[0].endAt));
  assert.equal(second.workflow.runs[0].energyCost,10);assert.equal(r.staffTraining['worker-2'].energy,190);
});

test('employee training displays the actual discounted step cost beside its ten-point base',()=>{
  for(const [endurance,cost] of [[1,10],[3,8],[10,1]]){
    const {restaurant}=fixture('rice',{endurance}),html=restaurantTrainingPanel({restaurant,level:50},{now:NOW});
    assert.ok(html.includes(`每步 ${cost}–${workerStepEnergyCost({endurance},15)} 体力 · 离线/闲置 30 分钟回满`));
  }
});
