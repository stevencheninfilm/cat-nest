import test from 'node:test';
import assert from 'node:assert/strict';
import { KITCHEN_FLOWS, KITCHEN_ORIGIN, KITCHEN_TABLE_POSITIONS, KITCHEN_ZONES, createKitchenWorkflow, kitchenInfo, validKitchenWorkflow, validKitchenReservations } from '../src/restaurant-kitchen.js';
import { INTERACTIVE_KITCHEN_ZONES } from '../src/restaurant-kitchen-layout.js';
import { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow, interactiveOrderStatus, isInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { normalizeStaffTraining, workerAbilitySnapshot, trainingUpgradeResult } from '../src/restaurant-staff-training.js';
const NOW=Date.parse('2026-10-18T12:00:00Z');
const fixture=(staff=0)=>({staff,levels:{kitchen:1,fridge:1,tables:4},orders:[],staffTraining:normalizeStaffTraining(null,NOW,staff)});
function add(restaurant,recipeId='rice',at=NOW,seat=restaurant.orders.length,options={}){
  const id=`table-${restaurant.orders.length+1}`,workflow=createInteractiveWorkflow(restaurant,recipeId,at,{orderId:id,seat,...options});
  const order={id,recipeId,createdAt:at,readyAt:at,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:options.kitchenLevel??restaurant.levels.kitchen,staffLevel:restaurant.staff,actorId:'interactive-manager',workflow,...(options.cookSpeedBp?{decorationSnapshot:{cookSpeed:options.cookSpeedBp}}:{})};
  restaurant.orders.push(order);return order;
}
function apply(restaurant,order,result){assert.equal(result.ok,true,result.reason);order.workflow=result.workflow;order.readyAt=result.workflow.readyAt??order.createdAt;restaurant.staffTraining=result.staffTraining;assert.equal(validKitchenWorkflow(order.workflow,order,restaurant),true);assert.equal(validKitchenReservations(restaurant),true);return result.workflow;}
const accept=(restaurant,order,at=NOW)=>apply(restaurant,order,acceptInteractiveWorkflow(restaurant,order,at));
const advance=(restaurant,order,id,at)=>apply(restaurant,order,advanceInteractiveWorkflow(restaurant,order,id,at));
function finishPreparation(restaurant,order,at=NOW){accept(restaurant,order,at);for(const step of KITCHEN_FLOWS[order.recipeId]){const flow=advance(restaurant,order,step.id,at);at=flow.runs.at(-1).endAt;}return at;}

test('unaccepted or unclicked orders never move, spend stamina or auto-advance after arbitrary elapsed time',()=>{
  const restaurant=fixture(),order=add(restaurant),initial=structuredClone(restaurant),future=NOW+365*86400000;
  assert.equal(isInteractiveWorkflow(order.workflow),true);assert.equal(validKitchenWorkflow(order.workflow,order,restaurant),true);
  for(const at of [NOW,future]){
    const model=kitchenInfo(restaurant,at);assert.equal(model.orders[0].phase,'requested');assert.equal(model.orders[0].nextStep,null);assert.equal(model.workers[0].phase,'idle');
    assert.equal(interactiveOrderStatus(order.workflow,at),'requested');
  }
  assert.deepEqual(restaurant,initial,'read-only projections do not fill future commands');
  accept(restaurant,order,NOW);const accepted=structuredClone(restaurant);
  assert.equal(order.workflow.acceptedAt,NOW);assert.equal(order.workflow.workerId,null);assert.equal(order.workflow.runs.length,0);
  const model=kitchenInfo(restaurant,future);assert.equal(model.orders[0].phase,'awaiting');assert.equal(model.orders[0].nextStep.id,'gather');assert.equal(model.workers[0].phase,'idle');
  assert.equal(interactiveOrderStatus(order.workflow,future),'awaiting');assert.deepEqual(restaurant,accepted);
});

test('a guest must finish seating and accept its order before ingredients can be clicked',()=>{
  const restaurant=fixture(),order=add(restaurant,'rice',NOW+6000),before=structuredClone(restaurant);
  assert.equal(acceptInteractiveWorkflow(restaurant,order,NOW+5999).ok,false);
  assert.equal(advanceInteractiveWorkflow(restaurant,order,'gather',NOW+6000).ok,false);
  assert.deepEqual(restaurant,before);
  assert.equal(kitchenInfo(restaurant,NOW+5999).orders[0].phase,'arriving');
  accept(restaurant,order,NOW+6000);const after=structuredClone(restaurant);
  assert.equal(acceptInteractiveWorkflow(restaurant,order,NOW+6001).ok,false);assert.deepEqual(restaurant,after);
  advance(restaurant,order,'gather',NOW+6000);assert.equal(order.workflow.runs.length,1);
});

test('rice and latte require one click per operation and a separate click to deliver',async t=>{
  for(const recipeId of ['rice','coffee'])await t.test(recipeId,()=>{
    const restaurant=fixture(),order=add(restaurant,recipeId);let at=NOW;
    accept(restaurant,order,at);
    for(const step of KITCHEN_FLOWS[recipeId]){
      const ready=kitchenInfo(restaurant,at).orders[0];assert.equal(ready.nextStep.id,step.id);
      const flow=advance(restaurant,order,step.id,at),run=flow.runs.at(-1),work=flow.segments.find(segment=>segment.phase==='work'&&segment.stepId===step.id);
      assert.equal(run.commandAt,at);assert.deepEqual(work.to,INTERACTIVE_KITCHEN_ZONES.find(zone=>zone.id===step.zoneId).work);
      const active=kitchenInfo(restaurant,work.startAt+1);assert.equal(active.orders[0].phase,'work');assert.equal(active.orders[0].nextStep,null);assert.equal(active.zones.find(zone=>zone.id===step.zoneId).occupant.orderId,order.id);
      assert.equal(interactiveOrderStatus(flow,work.startAt+1),'preparing');
      at=run.endAt;
      const stopped=kitchenInfo(restaurant,at),future=kitchenInfo(restaurant,at+90000);
      assert.equal(stopped.workers[0].phase,'awaiting');assert.deepEqual(stopped.workers[0].position,work.to);assert.equal(future.orders[0].steps.filter(step=>step.status==='complete').length,flow.runs.length);
      assert.equal(future.orders[0].nextStep.id,stopped.orders[0].nextStep.id);
      assert.equal(stopped.zones.filter(zone=>zone.occupant).length,0,'waiting at a surface is not a work reservation');
      at+=10000; // Deliberate pause: no next operation is silently booked.
    }
    assert.equal(order.workflow.servedAt,null);assert.equal(order.workflow.completedAt,null);assert.equal(order.workflow.readyAt,order.workflow.runs.at(-1).endAt);
    assert.equal(interactiveOrderStatus(order.workflow,at+86400000),'dish-ready');assert.equal(kitchenInfo(restaurant,at).orders[0].nextStep.id,'delivery');
    const delivered=advance(restaurant,order,'delivery',at),last=delivered.runs.at(-1);
    assert.equal(interactiveOrderStatus(delivered,delivered.servedAt-1),'delivering');assert.equal(interactiveOrderStatus(delivered,delivered.servedAt),'dining');assert.equal(interactiveOrderStatus(delivered,delivered.servedAt+4499),'dining');assert.equal(interactiveOrderStatus(delivered,delivered.servedAt+4500),'collectible');
    assert.equal(kitchenInfo(restaurant,delivered.servedAt).workers[0].phase,'return');
    assert.equal(kitchenInfo(restaurant,last.endAt).workers[0].phase,'idle');assert.equal(kitchenInfo(restaurant,last.endAt).orders[0].phase,'complete');
    assert.deepEqual(delivered.segments.findLast(segment=>segment.phase==='delivery').to,KITCHEN_TABLE_POSITIONS[0]);assert.deepEqual(delivered.segments.at(-1).to,KITCHEN_ORIGIN);
    assert.ok(delivered.completedAt<=delivered.servedAt+4500);assert.equal(delivered.runs.length,KITCHEN_FLOWS[recipeId].length+1);
  });
});

test('early, duplicate or out-of-order clicks never schedule work or deduct stamina',()=>{
  const restaurant=fixture(),order=add(restaurant);accept(restaurant,order);
  assert.equal(advanceInteractiveWorkflow(restaurant,order,'wash',NOW).ok,false);
  advance(restaurant,order,'gather',NOW);const before=structuredClone(restaurant),end=order.workflow.runs[0].endAt;
  for(const [stepId,at] of [['gather',NOW],['gather',end],['wash',end-1],['delivery',end],['coins',end]])assert.equal(advanceInteractiveWorkflow(restaurant,order,stepId,at).ok,false);
  assert.deepEqual(restaurant,before);advance(restaurant,order,'wash',end);assert.equal(order.workflow.runs.length,2);
});

test('one employee remains assigned while waiting for a click, until delivery and return end',()=>{
  const restaurant=fixture(),rice=add(restaurant),coffee=add(restaurant,'coffee');accept(restaurant,rice);accept(restaurant,coffee);
  advance(restaurant,rice,'gather',NOW);const end=rice.workflow.runs[0].endAt,before=structuredClone(restaurant);
  assert.equal(advanceInteractiveWorkflow(restaurant,coffee,'gather',end+86400000).ok,false,'an idle surface does not release the assigned employee');
  assert.deepEqual(restaurant,before);assert.equal(coffee.workflow.workerId,null);assert.equal(validKitchenReservations(restaurant),true);
  let at=end;for(const step of KITCHEN_FLOWS.rice.slice(1)){advance(restaurant,rice,step.id,at);at=rice.workflow.runs.at(-1).endAt;}
  advance(restaurant,rice,'delivery',at);assert.equal(advanceInteractiveWorkflow(restaurant,coffee,'gather',rice.workflow.servedAt).ok,false,'return still owns the employee');
  advance(restaurant,coffee,'gather',rice.workflow.completedAt);assert.equal(coffee.workflow.workerId,rice.workflow.workerId);
});

test('different employees cannot operate the same station and rejection keeps the second order unassigned',()=>{
  const restaurant=fixture(1),rice=add(restaurant),coffee=add(restaurant,'coffee');accept(restaurant,rice);accept(restaurant,coffee);
  advance(restaurant,rice,'gather',NOW);const before=structuredClone(restaurant),work=rice.workflow.segments.find(segment=>segment.phase==='work');
  assert.equal(advanceInteractiveWorkflow(restaurant,coffee,'gather',work.startAt+1).ok,false);assert.deepEqual(restaurant,before);assert.equal(coffee.workflow.workerId,null);
  advance(restaurant,coffee,'gather',work.endAt);advance(restaurant,rice,'wash',work.endAt);
  assert.equal(coffee.workflow.workerId,'worker-2');assert.equal(rice.workflow.workerId,'worker-1');assert.equal(validKitchenReservations(restaurant),true);
  const workers=kitchenInfo(restaurant,work.endAt+1).workers;assert.equal(workers.filter(worker=>worker.orderId).length,2);
  const tampered=structuredClone(restaurant);tampered.orders[1].workflow.workerId='worker-1';assert.equal(validKitchenReservations(tampered),false);
});

test('stamina is charged per clicked step, recovers during player pauses and snapshots ability levels',()=>{
  const restaurant=fixture(),order=add(restaurant);restaurant.staffTraining['worker-1'].energy=4;accept(restaurant,order);
  advance(restaurant,order,'gather',NOW);const first=order.workflow.runs[0];assert.equal(first.energyCost,4);assert.equal(first.energyBefore,4);assert.equal(first.energyAfter,0);
  assert.equal(restaurant.staffTraining['worker-1'].energyAt,first.endAt);assert.equal(workerAbilitySnapshot('worker-1',restaurant.staffTraining,first.endAt-1).energy,0);
  const before=structuredClone(restaurant);assert.equal(advanceInteractiveWorkflow(restaurant,order,'wash',first.endAt).ok,false);assert.deepEqual(restaurant,before);
  const restedAt=first.endAt+3200;assert.equal(workerAbilitySnapshot('worker-1',restaurant.staffTraining,restedAt).energy,4);
  advance(restaurant,order,'wash',restedAt);assert.equal(order.workflow.runs[1].energyBefore,4);assert.equal(order.workflow.runs[1].energyAfter,0);
  const at=order.workflow.runs[1].endAt+100000,upgrade=trainingUpgradeResult(restaurant.staffTraining,'worker-1','skill',{coins:10000,goldFish:0},at,0);
  assert.equal(upgrade.ok,true);restaurant.staffTraining=upgrade.training;
  advance(restaurant,order,'beat-eggs',at);const eggs=order.workflow.segments.find(segment=>segment.phase==='work'&&segment.stepId==='beat-eggs');
  assert.equal(order.workflow.workerLevels.skill,1);assert.equal(order.workflow.runs.at(-1).energyLevels.skill,2);assert.equal(eggs.endAt-eggs.startAt,3000,'mid-order training does not mutate the ability snapshot');
});

test('training, fridge upgrades and decoration accelerate only newly clicked snapshot timings',()=>{
  const ordinary=fixture(),rice=add(ordinary);accept(ordinary,rice);advance(ordinary,rice,'gather',NOW);
  const trained=fixture();trained.levels.fridge=2;trained.levels.kitchen=2;trained.staffTraining['worker-1'].levels={speed:4,stamina:2,endurance:4,skill:4};
  const fast=add(trained,'rice',NOW,0,{cookSpeedBp:200});accept(trained,fast);advance(trained,fast,'gather',NOW);
  const first=rice.workflow.runs[0],quick=fast.workflow.runs[0];assert.ok(quick.endAt-quick.startAt<first.endAt-first.startAt);assert.equal(quick.energyCost,4);
  assert.equal(fast.workflow.cookSpeedBp,200);assert.equal(fast.workflow.workerLevels.speed,4);
});

test('refresh preserves waiting, work and delivery projections without filling unclicked operations',()=>{
  const restaurant=fixture(),order=add(restaurant,'coffee');accept(restaurant,order);advance(restaurant,order,'gather',NOW);
  const end=order.workflow.runs[0].endAt;
  for(const at of [NOW+2000,end,end+86400000]){
    const reloaded=JSON.parse(JSON.stringify(restaurant));assert.equal(validKitchenWorkflow(reloaded.orders[0].workflow,reloaded.orders[0],reloaded),true);assert.deepEqual(kitchenInfo(reloaded,at),kitchenInfo(restaurant,at));
  }
  assert.equal(order.workflow.runs.length,1);assert.equal(order.workflow.readyAt,null);
});

test('v1 routes and reservations survive beside interactive orders, and manual assignments block legacy scheduling',()=>{
  const restaurant=fixture(),old=createKitchenWorkflow(restaurant,'coffee',NOW,{orderId:'table-1',seat:0});
  const legacy={id:'table-1',recipeId:'coffee',createdAt:NOW,readyAt:old.readyAt,servedAt:null,kitchenLevel:1,staffLevel:0,workflow:old};restaurant.orders.push(legacy);
  const copy=structuredClone(old),manual=add(restaurant,'rice',NOW,1);accept(restaurant,manual);
  assert.equal(advanceInteractiveWorkflow(restaurant,manual,'gather',NOW+1000).ok,false);
  assert.equal(validKitchenWorkflow(old,legacy,restaurant),true);assert.deepEqual(legacy.workflow,copy);
  advance(restaurant,manual,'gather',old.completedAt+100000);
  assert.equal(createKitchenWorkflow(restaurant,'coffee',manual.workflow.runs[0].endAt,{orderId:'table-3',seat:2}),null,'v1 scheduler cannot steal a manual employee waiting for a click');
  assert.deepEqual(KITCHEN_ZONES.find(zone=>zone.id===5).work,{x:59,y:84});assert.deepEqual(INTERACTIVE_KITCHEN_ZONES.find(zone=>zone.id===5).work,{x:53.5,y:83.9});
});

test('forged steps, shortened timings, energy, metadata or invisible future operations fail validation',()=>{
  const restaurant=fixture(),order=add(restaurant);finishPreparation(restaurant,order);advance(restaurant,order,'delivery',order.workflow.readyAt);
  assert.equal(validKitchenWorkflow(order.workflow,order,restaurant),true);
  for(const mutate of [
    flow=>flow.runs[0].stepId='wash',flow=>flow.runs[0].commandAt--,flow=>flow.runs[0].energyCost=0,
    flow=>flow.runs[0].energyAfter++,flow=>flow.runs[0].energyBefore++,flow=>flow.runs[0].energyLevels.endurance=10,
    flow=>flow.segments[0].endAt--,flow=>flow.segments[0].to.x++,flow=>flow.segments.find(segment=>segment.phase==='work').zoneId=1,
    flow=>flow.workerLevels.skill=10,flow=>flow.acceptedAt=null,flow=>flow.readyAt--,flow=>flow.servedAt=flow.readyAt,
    flow=>flow.completedAt=flow.servedAt+5000,flow=>flow.runs.push({...flow.runs.at(-1)}),flow=>flow.segments.push({...flow.segments.at(-1)}),
  ]){const bad=structuredClone(restaurant);mutate(bad.orders[0].workflow);assert.equal(validKitchenWorkflow(bad.orders[0].workflow,bad.orders[0],bad),false);}
});

test('newly hired employees can take an existing unstarted order while the earlier employee stays assigned',()=>{
  const restaurant=fixture(),rice=add(restaurant),coffee=add(restaurant,'coffee');accept(restaurant,rice);accept(restaurant,coffee);advance(restaurant,rice,'gather',NOW);
  restaurant.staff=1;restaurant.staffTraining=normalizeStaffTraining(restaurant.staffTraining,NOW,1);
  advance(restaurant,coffee,'gather',rice.workflow.runs[0].endAt);
  assert.equal(coffee.workflow.staffLevel,0,'arrival metadata stays unchanged');assert.equal(coffee.workflow.workerId,'worker-2');assert.equal(validKitchenWorkflow(coffee.workflow,coffee,restaurant),true);
});

test('missing array entries and extra invisible commands cannot pass persisted workflow validation',()=>{
  const restaurant=fixture(),order=add(restaurant);accept(restaurant,order);advance(restaurant,order,'gather',NOW);
  const missing=structuredClone(restaurant);delete missing.orders[0].workflow.segments[0];assert.equal(validKitchenWorkflow(missing.orders[0].workflow,missing.orders[0],missing),false);
  const missingRun=structuredClone(restaurant);delete missingRun.orders[0].workflow.runs[0];assert.equal(validKitchenWorkflow(missingRun.orders[0].workflow,missingRun.orders[0],missingRun),false);
});

test('the shared reducer grants no reward until every clicked operation, explicit delivery and dining finish',async()=>{
  const {initialState,reduceAction}=await import('../src/state.js');
  const {restaurantInfo,validRestaurant,sanitizeRestaurantAction}=await import('../src/restaurant.js');
  let state=initialState(NOW);state.restaurant.staff=1;
  const actor={id:'interactive-client',name:'店长'},intent=(type,fields,at)=>reduceAction(state,{type,...fields},actor,at);
  const commit=(type,fields,at)=>{const next=intent(type,fields,at);assert.ok(next,`${type} rejected`);state=next;assert.equal(validRestaurant(state.restaurant),true);};
  commit('restaurant-arrive',{partySize:1,recipeId:'rice'},NOW);const orderId=state.restaurant.orders[0].id,createdAt=state.restaurant.orders[0].createdAt,before={coins:state.coins,xp:state.xp};
  assert.equal(state.restaurant.orders[0].workflow.version,4);assert.equal(state.restaurant.orders[0].readyAt,createdAt);
  assert.equal(intent('restaurant-kitchen-accept',{orderId},createdAt-1),null);assert.equal(intent('restaurant-collect',{orderId},createdAt+100000),null);
  assert.equal(restaurantInfo(state,createdAt+100000).orders[0].autoServeAt,null,'hired staff cannot trigger the legacy auto-serving fallback');
  commit('restaurant-kitchen-accept',{orderId},createdAt);let at=createdAt;
  for(const step of KITCHEN_FLOWS.rice){commit('restaurant-kitchen-step',{orderId,stepId:step.id},at);at=state.restaurant.orders[0].workflow.runs.at(-1).endAt;}
  assert.equal(restaurantInfo(state,at).orders[0].status,'dish-ready');assert.equal(intent('restaurant-collect',{orderId},at+100000),null);assert.equal(intent('restaurant-serve',{orderId},at+100000),null);
  assert.deepEqual({coins:state.coins,xp:state.xp},before);
  commit('restaurant-kitchen-step',{orderId,stepId:'delivery'},at);const delivered=state.restaurant.orders[0].workflow;
  assert.equal(intent('restaurant-kitchen-step',{orderId,stepId:'delivery'},at+1),null);assert.equal(intent('restaurant-collect',{orderId},delivered.servedAt+4499),null);
  commit('restaurant-collect',{orderId},delivered.servedAt+4500);assert.equal(state.coins,before.coins+24);assert.equal(state.xp,before.xp);assert.equal(state.pendingGrowth.at(-1).amount,6);assert.equal(state.restaurant.orders.length,0);
  for(const extra of [{now:NOW},{workerId:'worker-2'},{durationMs:0},{amount:999},{segments:[]},{workflow:{}}])assert.equal(sanitizeRestaurantAction({type:'restaurant-kitchen-step',orderId,stepId:'gather',...extra}),null);
});
