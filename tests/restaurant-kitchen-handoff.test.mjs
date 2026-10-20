import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantActionResult, restaurantInfo, restaurantRecipe, validRestaurant, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { KITCHEN_FLOWS, kitchenInfo, validKitchenReservations, validKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { normalizeStaffTraining, STAFF_IDLE_RECOVERY_MS, restaurantStaffIdleAt, restaurantStaffRestInfo } from '../src/restaurant-staff-training.js';
import { kitchenViewModel, kitchenActionPresentation } from '../src/restaurant-kitchen-ui.js';
import { kitchenWorkflowBoardState } from '../src/restaurant-kitchen-board.js';
import { kitchenTerminalState } from '../src/restaurant-kitchen-terminal.js';
const NOW=Date.parse('2026-10-19T21:00:00Z'),ACTOR={id:'handoff-manager',name:'店长'};
function fixture(energies=[10,100]){
  const state=initialState(NOW);state.coins=90000;state.restaurant.stats.experience=levelStartXp(50);
  state.restaurant.staff=energies.length-1;state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,state.restaurant.staff);
  for(const [index,energy] of energies.entries())Object.assign(state.restaurant.staffTraining[`worker-${index+1}`],{energy,energyMode:'rest-room',rest:null});
  assert.ok(validRestaurant(state.restaurant));return state;
}
function act(state,action,at){
  const result=restaurantActionResult(state,action,ACTOR,at);assert.ok(result.ok,result.reason);
  const next=reduceAction(state,action,ACTOR,at);assert.ok(next);assert.ok(validRestaurant(next.restaurant));assert.ok(validKitchenReservations(next.restaurant));return next;
}
const order=(state,id='table-1')=>state.restaurant.orders.find(o=>o.id===id);
const last=(state,id)=>order(state,id).workflow.runs.at(-1);
const click=(state,stepId,at,id='table-1')=>act(state,{type:'restaurant-kitchen-step',orderId:id,stepId},at);
function requested(state=fixture(),recipeId='coffee',at=NOW){
  state=act(state,{type:'restaurant-arrive',recipeId,partySize:1},at);const o=state.restaurant.orders.at(-1);
  state=act(state,{type:'restaurant-kitchen-accept',orderId:o.id},o.createdAt);return {state,at:o.createdAt,id:o.id};
}
function exhausted(energies=[10,100],recipeId='coffee'){
  let {state,at}=requested(fixture(energies),recipeId);state=click(state,'gather',at);return {state,at:last(state).endAt,rest:last(state).rest};
}
const energy=(state,at,id='worker-1')=>restaurantStaffRestInfo(state.restaurant,at).find(w=>w.id===id).energy;

test('standing and unfinished work do not recover stamina before the long-inactivity threshold',()=>{
  let state=fixture([80]);assert.equal(energy(state,NOW+STAFF_IDLE_RECOVERY_MS-1),80);
  let at;({state,at}=requested(state));assert.equal(energy(state,at+8000),80);
  for(const step of [...KITCHEN_FLOWS.coffee,{id:'delivery'}]){state=click(state,step.id,at);at=last(state).endAt;}
  const after=last(state).energyAfter;assert.ok(after>0);assert.equal(energy(state,restaurantStaffIdleAt(state.restaurant)-1),after);
  assert.equal(order(state).workflow.runs.length,KITCHEN_FLOWS.coffee.length+1);
});

test('training extra capacity does not enable ordinary standing recovery before the inactivity threshold',()=>{
  let state=initialState(NOW);state.coins=10000;state.restaurant.stats.experience=levelStartXp(50);
  state=act(state,{type:'restaurant-train',workerId:'worker-1',statId:'stamina'},NOW+8000);
  assert.equal(state.restaurant.staffTraining['worker-1'].energyMode,'rest-room');
  assert.equal(energy(state,NOW+8000+STAFF_IDLE_RECOVERY_MS-1),200);assert.equal(restaurantStaffRestInfo(state.restaurant,NOW+86400000)[0].maxEnergy,215);
});

test('the next bubble, terminal and workflow board open at the exhausted operation end while its employee is still walking to rest',()=>{
  const {state,at,rest}=exhausted();assert.ok(rest.arriveAt>at);
  const before=kitchenActionPresentation(state.restaurant,kitchenViewModel(state.restaurant,null,at-1),at-1);assert.equal(before.running,true);
  assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'},ACTOR,at-1).ok,false);
  const view=kitchenViewModel(state.restaurant,null,at),action=kitchenActionPresentation(state.restaurant,view,at);
  assert.equal(view.phase,'awaiting');assert.equal(view.active.handoffReady,true);assert.equal(action.step.id,'espresso');assert.equal(action.running,false);assert.equal(action.stationBusy,false);
  const info=restaurantInfo(state,at);assert.equal(info.kitchen.workers[0].phase,'rest-walk');
  assert.equal(kitchenTerminalState(info,{now:at}).action.stepId,'espresso');assert.equal(kitchenWorkflowBoardState(info,'coffee',at).action.stepId,'espresso');
  assert.match(kitchenWorkflowBoardState(info,'coffee',at).status,/接手/);
});

test('a replacement departs immediately from its standing position, collects prepared food and spends only its own energy',()=>{
  let {state,at,rest}=exhausted();const prefix=structuredClone(order(state).workflow),oldLedger=structuredClone(state.restaurant.staffTraining['worker-1']),start=kitchenInfo(state.restaurant,at).workers[1].position;
  state=click(state,'espresso',at);const flow=order(state).workflow,run=last(state);
  assert.equal(flow.workerId,'worker-2');assert.deepEqual(flow.runs.map(r=>r.workerId),['worker-1','worker-2']);
  const {workerId,...original}=flow.runs[0];assert.deepEqual(original,prefix.runs[0]);assert.equal(workerId,'worker-1');
  assert.deepEqual(flow.segments.slice(0,prefix.segments.length),prefix.segments);assert.deepEqual(state.restaurant.staffTraining['worker-1'],oldLedger);
  assert.equal(run.commandAt,at);assert.ok(run.commandAt<rest.arriveAt);assert.deepEqual(run.startPosition,start);assert.equal(run.energyBefore,100);assert.equal(run.energyAfter,90);
  const pickup=prefix.segments.find(s=>s.phase==='work').to,walks=flow.segments.slice(prefix.segments.length).filter(s=>s.phase==='walk');
  assert.deepEqual(walks[0].from,start);assert.ok(walks.some(s=>s.to.x===pickup.x&&s.to.y===pickup.y));
  const work=flow.segments.find(s=>s.phase==='work'&&s.stepId==='espresso');assert.ok(work.startAt>at,'walking and pickup precede the countdown');
  const model=kitchenInfo(state.restaurant,at+1);assert.equal(model.workers[0].phase,'rest-walk');assert.equal(model.workers[1].phase,'walk');assert.equal(model.orders[0].phase,'walk');
  const firstWork=prefix.segments.find(s=>s.phase==='work'),historical=kitchenInfo(state.restaurant,firstWork.startAt+1);
  assert.equal(historical.zones.find(z=>z.id===firstWork.zoneId).occupant.workerId,'worker-1');
  assert.equal(kitchenInfo(state.restaurant,work.startAt+1).zones.find(z=>z.id===work.zoneId).occupant.workerId,'worker-2');
});

test('without a spare employee the next bubble stays visible, rejected clicks do not charge, and the same employee resumes only when fully rested',()=>{
  let {state,at,rest}=exhausted([10]);const before=structuredClone(state);
  for(const time of [at,rest.arriveAt+800,rest.fullAt-1]){
    const result=restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'},ACTOR,time);
    assert.equal(result.ok,false);assert.match(result.reason,/休息室|恢复体力|体力恢复中/);assert.ok(kitchenViewModel(state.restaurant,null,time).next);
  }
  assert.deepEqual(state,before);state=click(state,'espresso',rest.fullAt);assert.equal(last(state).energyBefore,200);assert.equal(last(state).energyAfter,190);
  assert.equal(order(state).workflow.runs.some(run=>Object.hasOwn(run,'workerId')),false,'a single employee log keeps its original shape');
});

test('several exhausted employees can hand off successively while their independent rest journeys continue',()=>{
  let {state,at}=exhausted([10,10,100]);const firstRest=structuredClone(last(state).rest);
  state=click(state,'espresso',at);const secondRest=structuredClone(last(state).rest);at=last(state).endAt;
  state=click(state,'steam-milk',at);assert.deepEqual(order(state).workflow.runs.map(run=>run.workerId),['worker-1','worker-2','worker-3']);
  assert.deepEqual(state.restaurant.staffTraining['worker-1'].rest,firstRest);assert.deepEqual(state.restaurant.staffTraining['worker-2'].rest,secondRest);
  const saved=structuredClone(state),reload=normalizeState(JSON.parse(JSON.stringify(state)),at+1);assert.ok(validRestaurant(reload.restaurant));assert.deepEqual(reload.restaurant,saved.restaurant);
  at=last(state).endAt;for(const step of [...KITCHEN_FLOWS.coffee.slice(3),{id:'delivery'}]){state=click(state,step.id,at);at=last(state).endAt;}
  const flow=order(state).workflow,receipt=flow.servedAt+RESTAURANT_DINING_MS;
  state=act(state,{type:'restaurant-collect',orderId:'table-1'},receipt);
  assert.equal(state.restaurant.orders.length,0);assert.ok(state.restaurant.staffTraining['worker-1'].rest);assert.ok(state.restaurant.staffTraining['worker-2'].rest);
  assert.equal(state.restaurant.stats.served,1);assert.equal(state.coins,saved.coins+restaurantRecipe('coffee').price);
  assert.equal(state.pendingGrowth.at(-1).amount,restaurantRecipe('coffee').xp);
});

test('a replacement can collect a plated dish and perform the delivery without repeating completed preparation',()=>{
  let {state,at}=requested(fixture([40,100]));
  for(const step of KITCHEN_FLOWS.coffee){state=click(state,step.id,at);at=last(state).endAt;}
  const prefix=structuredClone(order(state).workflow),plate=prefix.segments.filter(s=>s.phase==='work').at(-1).to;
  assert.ok(last(state).rest);state=click(state,'delivery',at);const flow=order(state).workflow,appended=flow.segments.slice(prefix.segments.length);
  assert.equal(flow.workerId,'worker-2');assert.equal(flow.runs.length,prefix.runs.length+1);assert.ok(appended.some(s=>s.phase==='walk'&&s.to.x===plate.x&&s.to.y===plate.y));
  const firstDelivery=appended.findIndex(s=>s.phase==='delivery'),pickup=appended.findIndex(s=>s.phase==='walk'&&s.to.x===plate.x&&s.to.y===plate.y);
  assert.ok(pickup<firstDelivery);assert.ok(flow.servedAt>at);assert.ok(flow.completedAt>flow.servedAt);
});

test('an occupied replacement is not stolen by another order, while a recovered previous employee can take that order',()=>{
  let {state,at,rest}=exhausted();state=click(state,'espresso',at);at=last(state).endAt;
  let id;({state,at,id}=requested(state,'coffee',at));const before=structuredClone(state);
  const denied=restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},ACTOR,at);
  assert.equal(denied.ok,false);assert.deepEqual(state,before);
  state=click(state,'gather',rest.fullAt+1,id);assert.equal(order(state,id).workflow.workerId,'worker-1');assert.equal(order(state).workflow.workerId,'worker-2');
  assert.ok(validKitchenReservations(state.restaurant));
});

test('replacement abilities determine their own cost and animation times without rewriting the first employee snapshots',()=>{
  let seed=fixture();Object.assign(seed.restaurant.staffTraining['worker-2'].levels,{speed:4,skill:3,endurance:3});
  let {state,at}=requested(seed);state=click(state,'gather',at);at=last(state).endAt;state=click(state,'espresso',at);
  const flow=order(state).workflow;assert.equal(flow.runs[0].energyCost,10);assert.equal(last(state).energyCost,9);
  assert.equal(last(state).energyAfter,91);assert.deepEqual(flow.workerLevels,seed.restaurant.staffTraining['worker-2'].levels);assert.ok(validKitchenWorkflow(flow,order(state),state.restaurant));
  const rest=state.restaurant.staffTraining['worker-1'].rest;state=act(state,{type:'restaurant-train',workerId:'worker-1',statId:'stamina'},rest.arriveAt+800);
  assert.ok(validRestaurant(state.restaurant));assert.equal(energy(state,rest.arriveAt+800),1);
});

test('partial or forged worker ownership, a pre-exhaustion switch and an early return from rest all fail validation',()=>{
  let {state,at}=exhausted();state=click(state,'espresso',at);
  for(const mutate of [f=>delete f.runs[0].workerId,f=>f.runs[1].workerId='worker-99',f=>f.workerId='worker-1',f=>f.runs[1].commandAt--,f=>f.runs[1].energyBefore++,f=>f.runs[1].startPosition={x:1,y:1},f=>f.runs[0].rest=null]){
    const bad=structuredClone(state);mutate(order(bad).workflow);assert.equal(validRestaurant(bad.restaurant),false);
  }
});

test('every detailed recipe can finish after a handoff without resetting its food, income or manual step order',()=>{
  for(const recipeId of Object.keys(KITCHEN_FLOWS)){
    const seed=fixture([10,100]);if(recipeId.startsWith('gold-')||['sushi','pizza'].includes(recipeId)){seed.restaurant.ownedSpecialRecipes=[recipeId];seed.restaurant.recipeLevels[recipeId]=1;}
    let {state,at}=requested(seed,recipeId);state=click(state,'gather',at);at=last(state).endAt;
    for(const step of [...KITCHEN_FLOWS[recipeId].slice(1),{id:'delivery'}]){
      const result=restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:'table-1',stepId:step.id},ACTOR,at);
      if(!result.ok)at=Math.max(...Object.values(state.restaurant.staffTraining).map(r=>r.rest?.fullAt??at));
      state=click(state,step.id,at);at=last(state).endAt;
    }
    const flow=order(state).workflow;assert.deepEqual(flow.runs.map(r=>r.stepId),[...KITCHEN_FLOWS[recipeId].map(s=>s.id),'delivery']);
    assert.ok(flow.runs.some(run=>run.workerId==='worker-2'));assert.ok(flow.segments.length<=320);assert.equal(state.coins,seed.coins);
  }
});
