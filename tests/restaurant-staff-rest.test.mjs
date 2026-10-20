import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantInfo, validRestaurant, restaurantActionResult } from '../src/restaurant.js';
import { KITCHEN_FLOWS, KITCHEN_ORIGIN, kitchenInfo, validKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { normalizeStaffTraining, validStaffTraining, workerAbilitySnapshot, restaurantStaffRestInfo, createStaffExhaustionTestPreset, trainingUpgradeResult, STAFF_REST_ROOM_ENTRANCE, STAFF_REST_ROOM_POSITION, STAFF_TRAINING_STATS } from '../src/restaurant-staff-training.js';
const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'stamina-manager',name:'店长'};
function fixture({energy=100,speed=1,stamina=1,endurance=1,version=3}={}){
  const restaurant={staff:0,levels:{kitchen:1,fridge:1,tables:1},orders:[],staffTraining:normalizeStaffTraining(null,NOW,0)};
  restaurant.staffTraining['worker-1']={levels:{speed,stamina,endurance,skill:1},energyBase:200,abilityVersion:2,energy,energyAt:NOW,energyMode:'rest-room',rest:null};
  const workflow=createInteractiveWorkflow(restaurant,'rice',NOW,{orderId:'table-1',version}),order={id:'table-1',recipeId:'rice',createdAt:NOW,readyAt:NOW,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id,workflow};
  restaurant.orders.push(order);return {restaurant,order};
}
function apply(restaurant,order,result){assert.equal(result.ok,true,result.reason);order.workflow=result.workflow;order.readyAt=result.workflow.readyAt??order.createdAt;restaurant.staffTraining=result.staffTraining;assert.equal(validKitchenWorkflow(order.workflow,order,restaurant),true);assert.equal(validStaffTraining(restaurant.staffTraining,restaurant.staff),true);return result.workflow;}
const accept=(r,o)=>apply(r,o,acceptInteractiveWorkflow(r,o,NOW));
const step=(r,o,id,at)=>apply(r,o,advanceInteractiveWorkflow(r,o,id,at));
function exhaust(options={}){const {restaurant:r,order:o}=fixture({energy:1,...options});accept(r,o);const flow=step(r,o,'gather',NOW);return {r,o,run:flow.runs[0],rest:flow.runs[0].rest};}
const act=(state,action,now)=>{const next=reduceAction(state,action,ACTOR,now);assert.ok(next,`${action.type} rejected`);assert.equal(validRestaurant(next.restaurant),true);return next;};

test('v3 spends ten stamina once per valid click and never recovers while assigned and waiting outside the rest room',()=>{
  const {restaurant:r,order:o}=fixture();accept(r,o);const run=step(r,o,'gather',NOW).runs[0];
  assert.equal(run.energyCost,10);assert.equal(run.energyAfter,90);
  for(const at of [NOW,run.endAt,run.endAt+86400000])assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,at).energy,90);
  const before=structuredClone(r);for(const id of ['gather','beat-eggs','delivery'])assert.equal(advanceInteractiveWorkflow(r,o,id,run.endAt+999999).ok,false);assert.deepEqual(r,before);
  step(r,o,'wash',run.endAt+999999);assert.equal(o.workflow.runs[1].energyBefore,90);assert.equal(o.workflow.runs[1].energyAfter,80);
});

test('a partial final stamina deduction reaches zero and makes that same walk and work exactly five times slower',()=>{
  const normal=fixture(),tired=fixture({energy:3});accept(normal.restaurant,normal.order);accept(tired.restaurant,tired.order);
  const fast=step(normal.restaurant,normal.order,'gather',NOW).runs[0],slow=step(tired.restaurant,tired.order,'gather',NOW).runs[0];
  assert.equal(slow.energyBefore,3);assert.equal(slow.energyCost,10);assert.equal(slow.energyAfter,0);assert.equal(slow.durationMultiplier,5);assert.equal(slow.endAt-NOW,5*(fast.endAt-NOW));
  const normalSegments=normal.order.workflow.segments,slowSegments=tired.order.workflow.segments.filter(s=>s.phase!=='rest-walk');
  assert.equal(slowSegments.length,normalSegments.length);for(let i=0;i<normalSegments.length;i++){assert.deepEqual(slowSegments[i].from,normalSegments[i].from);assert.deepEqual(slowSegments[i].to,normalSegments[i].to);assert.equal(slowSegments[i].endAt-slowSegments[i].startAt,5*(normalSegments[i].endAt-normalSegments[i].startAt));}
});

test('the exhausted employee walks continuously through the right-hand door and recovers only after arrival',()=>{
  const {r,o,run,rest}=exhaust();
  assert.deepEqual(rest.segments[0].from,o.workflow.segments.find(s=>s.phase==='work').to);assert.equal(rest.departAt,run.endAt);assert.deepEqual(rest.segments.at(-2).to,STAFF_REST_ROOM_ENTRANCE);assert.deepEqual(rest.segments.at(-1).to,STAFF_REST_ROOM_POSITION);
  assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,rest.arriveAt-1).energy,0);
  assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,rest.arriveAt+800).energy,1);
  assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,rest.fullAt).energy,200);
  for(const segment of rest.segments){const start=kitchenInfo(r,segment.startAt).workers[0],end=kitchenInfo(r,segment.endAt).workers[0];assert.deepEqual(start.position,segment.from);assert.deepEqual(end.position,segment.to);}
});

test('travel and partial recovery reject the next click with an authoritative reason and countdown',()=>{
  const {r,o,rest}=exhaust(),before=structuredClone(r);
  assert.match(advanceInteractiveWorkflow(r,o,'wash',rest.departAt).reason,/正在前往休息室/);
  assert.match(advanceInteractiveWorkflow(r,o,'wash',rest.arriveAt+800).reason,/体力恢复中，还需 160 秒/);
  assert.equal(advanceInteractiveWorkflow(r,o,'wash',rest.fullAt-1).ok,false);assert.deepEqual(r,before);
});

test('fully recovered staff stay inside indefinitely until the next valid player click and walk out from the room',()=>{
  const {r,o,rest}=exhaust();
  const before=structuredClone(r),at=rest.fullAt+86400000,worker=kitchenInfo(r,at).workers[0];
  assert.equal(worker.phase,'rest-ready');assert.equal(worker.rest.phase,'ready');assert.deepEqual(worker.position,STAFF_REST_ROOM_POSITION);assert.equal(worker.energy,200);assert.equal(o.workflow.runs.length,1);assert.deepEqual(r,before);
  assert.equal(advanceInteractiveWorkflow(r,o,'plate',at).ok,false);assert.deepEqual(r,before);
  step(r,o,'wash',at);const run=o.workflow.runs[1];assert.equal(run.energyBefore,200);assert.equal(run.energyAfter,190);assert.equal(run.durationMultiplier,1);assert.deepEqual(run.startPosition,STAFF_REST_ROOM_POSITION);assert.equal(r.staffTraining['worker-1'].rest,null);
  assert.deepEqual(o.workflow.segments.find(s=>s.startAt===at).from,STAFF_REST_ROOM_POSITION);
});

test('speed levels shorten employee walking, pickup and rest travel while preserving their destination',()=>{
  const a=exhaust({speed:1}),b=exhaust({speed:10});
  const walks=value=>value.o.workflow.segments.filter(s=>s.phase==='walk').reduce((sum,s)=>sum+s.endAt-s.startAt,0),work=value=>value.o.workflow.segments.find(s=>s.phase==='work');
  assert.ok(walks(b)<walks(a));assert.ok(work(b).endAt-work(b).startAt<work(a).endAt-work(a).startAt);
  assert.ok(b.rest.arriveAt-b.rest.departAt<a.rest.arriveAt-a.rest.departAt);assert.deepEqual(b.rest.segments.at(-1).to,a.rest.segments.at(-1).to);
});

test('endurance reduces each clicked step cost and stamina increases the actual room recovery target',()=>{
  const {restaurant:r,order:o}=fixture({endurance:10});accept(r,o);step(r,o,'gather',NOW);assert.equal(o.workflow.runs[0].energyCost,1);assert.equal(o.workflow.runs[0].energyAfter,99);
  const tired=exhaust({stamina:3});assert.equal(tired.rest.fullAt-tired.rest.arriveAt,260*800);assert.equal(restaurantStaffRestInfo(tired.r,tired.rest.fullAt)[0].maxEnergy,260);
  assert.match(STAFF_TRAINING_STATS.find(stat=>stat.id==='endurance').description,/每道工序/);
});

test('training during room recovery preserves earned stamina and extends capacity without gifting a full bar',()=>{
  const {r,o,rest}=exhaust();const at=rest.arriveAt+8000;
  const result=trainingUpgradeResult(r.staffTraining,'worker-1','stamina',{coins:10000,goldFish:0},at,0);assert.equal(result.ok,true);r.staffTraining=result.training;
  assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,at).energy,10);assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,at).maxEnergy,230);assert.equal(r.staffTraining['worker-1'].rest.fullAt,at+220*800);assert.equal(validStaffTraining(r.staffTraining,0),true);
  assert.equal(advanceInteractiveWorkflow(r,o,'wash',rest.fullAt).ok,false);step(r,o,'wash',r.staffTraining['worker-1'].rest.fullAt);assert.equal(o.workflow.runs[1].energyBefore,230);
});

test('rice preparation starting at half stamina uses nine explicit ten-point steps, then exhausted delivery still permits dining and collection',()=>{
  let state=initialState(NOW);state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,0);Object.assign(state.restaurant.staffTraining['worker-1'],{energy:100,energyMode:'rest-room',rest:null});state=act(state,{type:'restaurant-arrive',recipeId:'rice',partySize:1},NOW);
  const id=state.restaurant.orders[0].id;assert.equal(state.restaurant.orders[0].workflow.version,4);let at=state.restaurant.orders[0].createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
  for(const work of KITCHEN_FLOWS.rice){state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:work.id},at);at=state.restaurant.orders[0].workflow.runs.at(-1).endAt;}
  assert.equal(state.restaurant.staffTraining['worker-1'].energy,10);const before={coins:state.coins,xp:state.xp};
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'delivery'},at);const flow=state.restaurant.orders[0].workflow,run=flow.runs.at(-1);
  assert.equal(run.energyAfter,0);assert.equal(run.durationMultiplier,5);assert.equal(flow.completedAt,flow.servedAt);
  assert.equal(reduceAction(state,{type:'restaurant-collect',orderId:id},ACTOR,flow.servedAt+4499),null);
  state=act(state,{type:'restaurant-collect',orderId:id},flow.servedAt+4500);assert.equal(state.coins,before.coins+24);assert.equal(state.xp,before.xp);assert.equal(state.pendingGrowth.at(-1).amount,6);assert.equal(state.restaurant.orders.length,0);
  assert.equal(state.restaurant.staffTraining['worker-1'].rest.arriveAt,run.rest.arriveAt,'independent room trip survives a collected order');
  const info=restaurantInfo(state,flow.servedAt+4500);assert.equal(info.kitchen.workers[0].phase,'rest-walk');assert.ok(info.kitchen.workers[0].position.x!==KITCHEN_ORIGIN.x||info.kitchen.workers[0].position.y!==KITCHEN_ORIGIN.y);
});

test('refresh preserves exhausted, travelling, recovering and ready phases without repeating stamina deductions',()=>{
  let state=initialState(NOW);state.restaurant.staffTraining=createStaffExhaustionTestPreset(state.restaurant,NOW);
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},NOW);const id=state.restaurant.orders[0].id,at=state.restaurant.orders[0].createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},at);const run=state.restaurant.orders[0].workflow.runs[0],before=structuredClone(state);
  for(const time of [at,run.endAt,run.rest.arriveAt+1600,run.rest.fullAt+10000]){const reload=normalizeState(JSON.parse(JSON.stringify(state)),time);assert.equal(validRestaurant(reload.restaurant),true);assert.deepEqual(restaurantInfo(reload,time).kitchen,restaurantInfo(state,time).kitchen);assert.equal(reload.restaurant.orders[0].workflow.runs.length,1);}
  assert.deepEqual(state,before);
});

test('legacy v1 and v2 data keep their original shape, four-point step cost and idle recovery',()=>{
  const {restaurant:r,order:o}=fixture({version:2});r.staffTraining=normalizeStaffTraining(null,NOW,0);r.staffTraining['worker-1'].energy=4;accept(r,o);step(r,o,'gather',NOW);const run=o.workflow.runs[0];
  assert.equal(o.workflow.version,2);assert.equal(run.energyCost,4);assert.equal(Object.hasOwn(run,'durationMultiplier'),false);assert.equal(workerAbilitySnapshot('worker-1',r.staffTraining,run.endAt+3200).energy,4);assert.equal(validKitchenWorkflow(JSON.parse(JSON.stringify(o.workflow)),o,r),true);
});

test('forged fatigue multipliers, energy arithmetic, shortened rest trips and premature recovery fail validation',()=>{
  const {r}=exhaust();
  for(const mutate of [r=>r.orders[0].workflow.runs[0].durationMultiplier=1,r=>r.orders[0].workflow.runs[0].energyAfter=1,r=>r.orders[0].workflow.runs[0].energyCost=4,r=>r.orders[0].workflow.runs[0].rest.arriveAt--,r=>r.orders[0].workflow.runs[0].rest.fullAt--,r=>r.orders[0].workflow.segments.at(-1).endAt--]){const bad=structuredClone(r);mutate(bad);assert.equal(validKitchenWorkflow(bad.orders[0].workflow,bad.orders[0],bad),false);}
  for(const mutate of [v=>v['worker-1'].rest.fullAt--,v=>v['worker-1'].rest.arriveAt--,v=>v['worker-1'].rest.segments[0].endAt--,v=>v['worker-1'].energyAt=NOW,v=>v['worker-1'].energyMode='idle']){const bad=structuredClone(r.staffTraining);mutate(bad);assert.equal(validStaffTraining(bad,0),false);}
});

test('the exhaustion preset preserves abilities, never edits an assigned employee and changes no gameplay object',()=>{
  const {restaurant:r,order:o}=fixture({speed:5,endurance:4}),before=structuredClone(r),preset=createStaffExhaustionTestPreset(r,NOW);
  assert.equal(preset['worker-1'].energy,1);assert.equal(preset['worker-1'].levels.speed,5);assert.deepEqual(r,before);r.staffTraining=preset;accept(r,o);step(r,o,'gather',NOW);assert.equal(createStaffExhaustionTestPreset(r,NOW+999999),null);
});

test('employee speed never changes guest arrival timing or the guest movement path',async()=>{
  const {restaurantGuestMotion}=await import('../src/restaurant-guests.js');
  const states=[1,10].map(speed=>{let state=initialState(NOW);state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,0);state.restaurant.staffTraining['worker-1'].levels.speed=speed;return act(state,{type:'restaurant-arrive',recipeId:'rice',partySize:1},NOW);});
  assert.deepEqual(states[0].restaurant.parties,states[1].restaurant.parties);
  for(const at of [NOW,NOW+1000,NOW+3000,NOW+5999,NOW+6000])assert.deepEqual(restaurantGuestMotion(states[0].restaurant.parties[0],0,at),restaurantGuestMotion(states[1].restaurant.parties[0],0,at));
});

test('v3 freezes an active run while a later clicked operation snapshots newly trained speed and endurance',()=>{
  const {restaurant:r,order:o}=fixture();accept(r,o);const first=step(r,o,'gather',NOW).runs[0],snapshot=structuredClone(first),segments=structuredClone(o.workflow.segments);
  let upgrade=trainingUpgradeResult(r.staffTraining,'worker-1','speed',{coins:10000,goldFish:0},first.endAt,0);r.staffTraining=upgrade.training;
  upgrade=trainingUpgradeResult(r.staffTraining,'worker-1','endurance',{coins:10000,goldFish:0},first.endAt,0);r.staffTraining=upgrade.training;
  step(r,o,'wash',first.endAt);const second=o.workflow.runs[1];
  assert.deepEqual(o.workflow.runs[0],snapshot);assert.deepEqual(o.workflow.segments.slice(0,segments.length),segments);
  assert.equal(second.energyLevels.speed,2);assert.equal(second.energyLevels.endurance,2);assert.equal(second.energyBefore,90);assert.equal(second.energyCost,9);
  const firstWalk=o.workflow.segments.find(segment=>segment.startAt===second.startAt);assert.ok(firstWalk.endAt-firstWalk.startAt<Math.round((Math.abs(firstWalk.to.x-firstWalk.from.x)+Math.abs(firstWalk.to.y-firstWalk.from.y))*45));
});

test('an unstarted old v2 order can adopt a rested v3 employee while both saved protocols remain valid',()=>{
  const {restaurant:r,order:o}=fixture();accept(r,o);let at=NOW;
  for(const work of KITCHEN_FLOWS.rice){step(r,o,work.id,at);at=o.workflow.runs.at(-1).endAt;}
  step(r,o,'delivery',at);const rest=r.staffTraining['worker-1'].rest;
  const workflow=createInteractiveWorkflow(r,'coffee',NOW,{orderId:'table-2',seat:1,version:2}),old={...o,id:'table-2',recipeId:'coffee',createdAt:NOW,readyAt:NOW,workflow};r.orders.push(old);accept(r,old);
  assert.equal(advanceInteractiveWorkflow(r,old,'gather',rest.arriveAt).ok,false);
  step(r,old,'gather',rest.fullAt);const first=old.workflow.runs[0];assert.equal(first.energyCost,4);assert.equal(validKitchenWorkflow(o.workflow,o,r),true);
  step(r,old,'espresso',first.endAt+100000);assert.equal(old.workflow.runs[1].energyBefore,200);assert.equal(validKitchenWorkflow(o.workflow,o,r),true);
});
