import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { initialRestaurant, restaurantActionResult, restaurantProgressPreserved, validRestaurant } from '../src/restaurant.js';
import { KITCHEN_FLOWS, kitchenInfo } from '../src/restaurant-kitchen.js';
import { normalizeStaffTraining, workerStepEnergyCost } from '../src/restaurant-staff-training.js';
import { recipeStepEnergyBase } from '../src/restaurant-recipe-energy.js';

const NOW=Date.parse('2026-10-20T06:00:00Z'),ACTOR={id:'save-protection',name:'店长'};
function scenario(){
  let at=NOW,state=initialState(NOW-10000);
  state.coins=10000;state.restaurant.stats.experience=restaurantLevelStartXp(50);
  state.restaurant.staffTraining=normalizeStaffTraining(null,NOW-10000,0);
  const cost=workerStepEnergyCost(state.restaurant.staffTraining['worker-1'].levels,recipeStepEnergyBase('pudding',1));
  Object.assign(state.restaurant.staffTraining['worker-1'],{energy:KITCHEN_FLOWS.pudding.length*cost,energyMode:'rest-room',rest:null});
  function act(action){const previous=state,result=restaurantActionResult(state,action,ACTOR,at);assert.ok(result.ok,result.reason);assert.ok(validRestaurant(result.restaurant));state=reduceAction(state,action,ACTOR,at);assert.ok(state);assert.ok(restaurantProgressPreserved(previous.restaurant,state.restaurant));}
  function request(recipeId){act({type:'restaurant-arrive',recipeId,partySize:1});const order=state.restaurant.orders.at(-1);at=order.createdAt;act({type:'restaurant-kitchen-accept',orderId:order.id});return order.id;}
  function step(id,stepId){act({type:'restaurant-kitchen-step',orderId:id,stepId});at=state.restaurant.orders.find(o=>o.id===id).workflow.runs.at(-1).endAt;}
  const first=request('pudding');for(const part of KITCHEN_FLOWS.pudding)step(first,part.id);
  const exhausted=structuredClone(state.restaurant.orders[0].workflow),rest=exhausted.runs.at(-1).rest;assert.ok(rest);at=rest.fullAt;
  // The employee is released from the first order and finishes another job.
  const second=request('coffee');for(const part of [...KITCHEN_FLOWS.coffee,{id:'delivery'}])step(second,part.id);
  at=Math.max(at,state.restaurant.orders.find(o=>o.id===second).workflow.servedAt+4500);
  act({type:'restaurant-collect',orderId:second});
  return {first,exhausted,act,step,get state(){return state;},get at(){return at;}};
}

test('the same employee can finish another order after resting, then return to deliver an older dish without erasing progress',()=>{
  const h=scenario(),before=structuredClone(h.state),energy=before.restaurant.staffTraining['worker-1'].energy;
  assert.ok(energy>0&&energy<200);
  h.step(h.first,'delivery');
  const flow=h.state.restaurant.orders[0].workflow,run=flow.runs.at(-1);
  assert.equal(run.reassigned,true);assert.equal(run.workerId,'worker-1');assert.equal(run.energyBefore,energy);assert.equal(run.energyAfter,energy-run.energyCost);
  assert.equal(run.startPosition.y,76,'employee starts from the kitchen after their other delivery');
  const prepared=h.exhausted.segments.filter(s=>s.phase==='work').at(-1).to;
  assert.ok(flow.segments.slice(h.exhausted.segments.length).some(s=>s.to.x===prepared.x&&s.to.y===prepared.y),'returns to the prepared dish before delivering');
  assert.equal(h.state.restaurant.stats.experience,before.restaurant.stats.experience);assert.equal(h.state.restaurant.stats.served,1);
  assert.equal(h.state.restaurant.openedAt,before.restaurant.openedAt);assert.equal(h.state.coins,before.coins);assert.equal(h.state.xp,before.xp);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(h.state)),h.at).restaurant,h.state.restaurant);
});

test('save protection rejects a fresh restaurant or lost permanent progress while accepting ordinary spending and completed orders',()=>{
  const {state}=scenario(),before=state.restaurant;
  assert.equal(restaurantProgressPreserved(before,initialRestaurant(NOW+100000)),false);
  assert.equal(restaurantProgressPreserved(before,before),true);
  for(const mutate of [r=>r.stats.experience=0,r=>r.stats.served=0,r=>r.revision=0,r=>r.nextOrderId=1,r=>r.openedAt+=1]){
    const changed=structuredClone(before);mutate(changed);assert.equal(restaurantProgressPreserved(before,changed),false);
  }
});

test('a reassignment marker cannot bypass unfinished rest, precede exhaustion or alter the original worker history',()=>{
  const h=scenario();h.step(h.first,'delivery');
  for(const change of [flow=>flow.runs[0].reassigned=true,flow=>flow.runs.at(-1).reassigned=false,flow=>flow.runs.at(-1).commandAt=flow.runs.at(-2).rest.fullAt-1]){
    const r=structuredClone(h.state.restaurant);change(r.orders[0].workflow);assert.equal(validRestaurant(r),false);
  }
});
