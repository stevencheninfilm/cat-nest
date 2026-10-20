import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRestaurant, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { KITCHEN_FLOWS, KITCHEN_ORIGIN, KITCHEN_TABLE_POSITIONS, createKitchenWorkflow, validKitchenWorkflow, validKitchenReservations, kitchenInfo } from '../src/restaurant-kitchen.js';
import { normalizeStaffTraining, reserveWorkerEnergy, workerOrderEnergyCost, workerAbilitySnapshot } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
const levels=(overrides={})=>({speed:1,stamina:1,endurance:1,skill:1,...overrides});
function kitchen({training=null,staff=0,kitchenLevel=1,fridgeLevel=1}={}) {
  const restaurant=initialRestaurant(NOW);
  restaurant.staff=staff;restaurant.levels.tables=4;
  restaurant.levels.kitchen=kitchenLevel;restaurant.levels.fridge=fridgeLevel;
  if(training){
    restaurant.staffTraining=normalizeStaffTraining(null,NOW,staff);
    for(const record of Object.values(restaurant.staffTraining))record.levels=levels(training);
  }else delete restaurant.staffTraining;
  return restaurant;
}
function addOrder(restaurant,recipeId='rice',at=NOW,{seat=restaurant.orders.length,reserve=false}={}) {
  const id=`table-${restaurant.nextOrderId++}`;
  const workflow=createKitchenWorkflow(restaurant,recipeId,at,{orderId:id,seat});
  assert.ok(workflow,'a valid kitchen creates an authoritative schedule');
  const order={id,recipeId,createdAt:at,readyAt:workflow.readyAt,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:restaurant.levels.kitchen,staffLevel:restaurant.staff,actorId:'kitchen-manager',workflow};
  restaurant.orders.push(order);
  if(reserve){
    const startAt=workflow.segments.find(segment=>segment.phase!=='wait').startAt;
    const training=reserveWorkerEnergy(restaurant.staffTraining,workflow.workerId,{startAt,completedAt:workflow.completedAt,energyCost:workflow.energyCost});
    assert.ok(training,'the schedule reserves stamina once, through its return');
    restaurant.staffTraining=training;
  }
  return order;
}
const durations=(flow,phases)=>flow.segments.filter(segment=>phases.includes(segment.phase)).map(segment=>segment.endAt-segment.startAt);
const validKitchen=restaurant=>restaurant.orders.every(order=>validKitchenWorkflow(order.workflow,order,restaurant))&&validKitchenReservations(restaurant);

test('seven idle employees fit four plus three without overlapping sixteen-percent sprites on the portrait stage',()=>{
  const restaurant=kitchen({staff:6}),before=structuredClone(restaurant),workers=kitchenInfo(restaurant,NOW).workers;
  const rowCounts=new Map();
  for(const worker of workers)rowCounts.set(worker.position.y,(rowCounts.get(worker.position.y)||0)+1);
  assert.deepEqual([...rowCounts.values()],[4,3]);
  const stageWidth=940,stageHeight=1672,actorSize=stageWidth*.16,epsilon=1e-7;
  for(const worker of workers){
    assert.equal(worker.phase,'idle');assert.equal(worker.orderId,null);
    assert.deepEqual(worker.from,worker.position);assert.deepEqual(worker.to,worker.position);
  }
  for(let i=0;i<workers.length;i++)for(let j=i+1;j<workers.length;j++){
    const a=workers[i].position,b=workers[j].position;
    const horizontalGap=Math.abs(a.x-b.x)*stageWidth/100,verticalGap=Math.abs(a.y-b.y)*stageHeight/100;
    assert.ok(horizontalGap>=actorSize-epsilon||verticalGap>=actorSize-epsilon,`${workers[i].id} and ${workers[j].id} have separate visible sprite boxes`);
  }
  assert.deepEqual(kitchenInfo(kitchen(),NOW).workers[0].position,KITCHEN_ORIGIN,'a lone chef keeps the original natural starting point');
  assert.deepEqual(restaurant,before,'idle layout is a read-only projection');
});

test('employee speed accelerates movement and ingredient pickup; skill shortens processing and endurance changes exertion',()=>{
  for(const recipeId of Object.keys(KITCHEN_FLOWS)){
    const old=addOrder(kitchen(),recipeId).workflow;
    const baseRestaurant=kitchen({training:{}}),base=addOrder(baseRestaurant,recipeId).workflow;
    const fast=addOrder(kitchen({training:{speed:10}}),recipeId).workflow;
    const skilled=addOrder(kitchen({training:{skill:10}}),recipeId).workflow;
    const rested=addOrder(kitchen({training:{stamina:10,endurance:10}}),recipeId).workflow;
    assert.deepEqual(base.workerLevels,levels());assert.equal(base.workerId,'worker-1');
    assert.deepEqual(base.segments,old.segments,'untrained workers preserve released timing');
    for(const [index,step] of KITCHEN_FLOWS[recipeId].entries()){
      if(step.zoneId===10)assert.ok(durations(fast,['work'])[index]<durations(base,['work'])[index],'speed accelerates fridge operations, including returning a cake to chill');
      else assert.equal(durations(fast,['work'])[index],durations(base,['work'])[index],'speed preserves processing at the other stations');
    }
    assert.deepEqual(durations(skilled,['walk','delivery','return']),durations(base,['walk','delivery','return']));
    assert.ok(durations(fast,['walk','delivery','return']).every((duration,index)=>duration<=durations(base,['walk','delivery','return'])[index]));
    assert.ok(durations(skilled,['work']).every((duration,index)=>duration<durations(base,['work'])[index]));
    assert.ok(fast.servedAt<base.servedAt);assert.ok(skilled.servedAt<base.servedAt);
    assert.deepEqual(rested.segments,base.segments);assert.ok(rested.energyCost<base.energyCost);
    assert.equal(base.energyCost,workerOrderEnergyCost(KITCHEN_FLOWS[recipeId],workerAbilitySnapshot('worker-1',baseRestaurant.staffTraining,NOW)));
  }
});

test('all kitchen upgrades and eight table destinations retain validated routes and finish returning before collection',()=>{
  for(const recipeId of Object.keys(KITCHEN_FLOWS))for(const kitchenLevel of [1,4])for(const fridgeLevel of [1,4])for(const speed of [1,10])for(let seat=0;seat<8;seat++){
    const restaurant=kitchen({training:{speed,skill:10},kitchenLevel,fridgeLevel});
    const order=addOrder(restaurant,recipeId,NOW,{seat}),flow=order.workflow;
    assert.equal(validKitchenWorkflow(flow,order,restaurant),true);
    assert.equal(validKitchen(restaurant),true);
    assert.ok(flow.completedAt<=flow.servedAt+RESTAURANT_DINING_MS,`${recipeId} table ${seat} finishes returning before collection`);
    assert.deepEqual(flow.segments.findLast(segment=>segment.phase==='delivery').to,KITCHEN_TABLE_POSITIONS[seat]);
    assert.equal(kitchenInfo(restaurant,flow.servedAt+RESTAURANT_DINING_MS).workers[0].phase,'idle');
  }
});

test('ability snapshots survive later upgrades while forged levels and energy prices fail validation',()=>{
  const restaurant=kitchen({training:{speed:4,skill:3,endurance:2}}),order=addOrder(restaurant);
  const original=structuredClone(order.workflow);
  restaurant.staffTraining['worker-1'].levels=levels({speed:10,stamina:10,endurance:10,skill:10});
  assert.equal(validKitchen(restaurant),true);assert.deepEqual(order.workflow,original);
  assert.deepEqual(kitchenInfo(JSON.parse(JSON.stringify(restaurant)),NOW+1000),kitchenInfo(restaurant,NOW+1000));
  for(const mutate of [
    flow=>flow.workerLevels.speed=11,
    flow=>flow.workerLevels.skill=0,
    flow=>flow.workerLevels.walkMsMultiplier=.01,
    flow=>flow.energyCost=0,
    flow=>flow.energyCost++,
    flow=>delete flow.energyCost,
    flow=>{delete flow.energyCost;delete flow.workerLevels;},
  ]){
    const forged=structuredClone(restaurant);mutate(forged.orders[0].workflow);
    assert.equal(validKitchen(forged),false);
  }
  const weaker=structuredClone(restaurant);weaker.staffTraining['worker-1'].levels.speed=1;
  assert.equal(validKitchen(weaker),false,'a snapshot cannot claim a future, untrained speed');
});

test('consistent timestamp edits cannot shorten real work, walking, delivery or return',()=>{
  const restaurant=kitchen({training:{speed:4,skill:3}});addOrder(restaurant);
  for(const phase of ['walk','work','delivery','return']){
    const forged=structuredClone(restaurant),order=forged.orders[0],flow=order.workflow;
    const index=flow.segments.findIndex(segment=>segment.phase===phase&&segment.endAt-segment.startAt>180),oldEnd=flow.segments[index].endAt;
    flow.segments[index].endAt-=100;
    for(const segment of flow.segments.slice(index+1)){segment.startAt-=100;segment.endAt-=100;}
    for(const key of ['readyAt','servedAt','completedAt'])if(flow[key]>=oldEnd)flow[key]-=100;
    order.readyAt=flow.readyAt;
    assert.equal(validKitchen(forged),false,`${phase} duration must match both the route and the trusted snapshot`);
  }
});

test('stamina waits persist after collected orders disappear and do not recover during reserved work',()=>{
  const restaurant=kitchen({training:{}});restaurant.staffTraining['worker-1'].energy=100;
  const first=addOrder(restaurant,'rice',NOW,{reserve:true}),second=addOrder(restaurant,'rice',NOW,{reserve:true});
  assert.equal(second.workflow.workerId,first.workflow.workerId);
  assert.equal(second.workflow.segments[0].endAt,first.workflow.completedAt);
  assert.equal(restaurant.staffTraining['worker-1'].energy,4);
  const lastCompleted=second.workflow.completedAt,afterDining=second.workflow.servedAt+RESTAURANT_DINING_MS;
  restaurant.orders=[];
  const third=addOrder(restaurant,'rice',afterDining,{reserve:true}),departure=third.workflow.segments.find(segment=>segment.phase!=='wait').startAt;
  assert.equal(departure,lastCompleted+44*800);
  assert.equal(third.workflow.segments[0].phase,'wait');
  assert.equal(kitchenInfo(restaurant,afterDining).workers[0].phase,'queue');
  assert.equal(validKitchen(restaurant),true);
});

test('the next order chooses a rested employee and station reservations still prevent overlap',()=>{
  const restaurant=kitchen({training:{},staff:6});
  restaurant.staffTraining['worker-1'].energy=0;
  const first=addOrder(restaurant,'rice',NOW,{reserve:true});
  assert.equal(first.workflow.workerId,'worker-2','a tired chef does not block a rested colleague');
  for(let index=0;index<6;index++)addOrder(restaurant,index%2?'rice':'coffee',NOW,{reserve:true});
  assert.equal(validKitchen(restaurant),true);assert.equal(validKitchenReservations(restaurant),true);
  for(const order of restaurant.orders)assert.equal(validKitchenWorkflow(order.workflow,order,restaurant),true);
  assert.equal(kitchenInfo(restaurant,NOW).workers.length,7);
});
