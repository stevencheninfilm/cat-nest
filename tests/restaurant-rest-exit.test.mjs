import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { kitchenInfo } from '../src/restaurant-kitchen.js';
import { kitchenStationPath, KITCHEN_ROUTE_LANES } from '../src/restaurant-kitchen-routing.js';
import { INTERACTIVE_KITCHEN_ZONES } from '../src/restaurant-kitchen-layout.js';
import { STAFF_REST_ROOM_ENTRANCE, STAFF_REST_ROOM_POSITION } from '../src/restaurant-staff-training.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';

const NOW=Date.parse('2026-10-18T22:00:00Z'),ACTOR={id:'rest-exit-manager',name:'店长'};
const act=(state,action,at)=>{const next=reduceAction(state,action,ACTOR,at);assert.ok(next,action.type);assert.equal(validRestaurant(next.restaurant),true);return next;};
function recoveredChef(){
  const state=restaurantStaffDebugResult(initialState(NOW),{mode:'rest-six'},NOW).state;
  const record=structuredClone(state.restaurant.staffTraining['worker-2']);
  state.restaurant.staff=0;state.restaurant.staffTraining={'worker-1':record};
  assert.equal(validRestaurant(state.restaurant),true);
  return {state,at:record.rest.fullAt+1};
}
function assertSafeExit(points){
  assert.deepEqual(points[0],STAFF_REST_ROOM_ENTRANCE);
  assert.deepEqual(points[1],{x:90,y:47});assert.deepEqual(points[2],{x:90,y:52});
  const doorway=points.findIndex(p=>p.x===KITCHEN_ROUTE_LANES.returnX&&p.y===KITCHEN_ROUTE_LANES.doorY);
  assert.ok(doorway>=3,'the employee enters through the central kitchen doorway');
  assert.ok(points.slice(doorway+1).some(p=>p.x===KITCHEN_ROUTE_LANES.returnX&&p.y===76));
  let previous=STAFF_REST_ROOM_POSITION;
  for(const point of points){
    assert.ok(point.x===previous.x||point.y===previous.y,'every turn is an explicit orthogonal waypoint');
    if(Math.min(previous.y,point.y)<65.5&&Math.max(previous.y,point.y)>=65.5)assert.ok(previous.x>=40&&previous.x<=61,'the dining-to-kitchen crossing stays inside the doorway');
    previous=point;
  }
}

test('every rest-room exit reaches every workstation through the row aisle and kitchen doorway at all four table layouts',()=>{
  for(const capacity of [2,4,6,8])for(const zone of INTERACTIVE_KITCHEN_ZONES){
    const path=kitchenStationPath(STAFF_REST_ROOM_POSITION,zone.work,capacity);
    assertSafeExit(path);assert.deepEqual(path.at(-1),zone.work);
  }
});

test('a recovered employee uses the saved route continuously and does not teleport across the side wall',()=>{
  let {state,at}=recoveredChef();
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},at);
  const id=state.restaurant.orders[0].id;at=state.restaurant.orders[0].createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},at);
  const flow=state.restaurant.orders[0].workflow,walks=flow.segments.filter(segment=>segment.phase==='walk');
  assert.equal(flow.version,4);assertSafeExit(walks.map(segment=>segment.to));
  assert.deepEqual(walks[0].from,STAFF_REST_ROOM_POSITION);
  for(const segment of walks){
    const start=kitchenInfo(state.restaurant,segment.startAt).workers[0],mid=kitchenInfo(state.restaurant,Math.floor((segment.startAt+segment.endAt)/2)).workers[0];
    assert.deepEqual(start.position,segment.from);
    assert.ok(mid.position.x>=Math.min(segment.from.x,segment.to.x)&&mid.position.x<=Math.max(segment.from.x,segment.to.x));
    assert.ok(mid.position.y>=Math.min(segment.from.y,segment.to.y)&&mid.position.y<=Math.max(segment.from.y,segment.to.y));
  }
  const reloaded=normalizeState(JSON.parse(JSON.stringify(state)),walks[3].startAt+1);
  assert.deepEqual(restaurantInfo(reloaded,walks[3].startAt+1).kitchen,restaurantInfo(state,walks[3].startAt+1).kitchen);
  assert.equal(state.restaurant.staffTraining['worker-1'].energy,90);assert.equal(state.restaurant.staffTraining['worker-1'].rest,null);
});

test('a legacy v3 order waiting for a rested employee also uses the doorway for its next new click',()=>{
  let {state,at}=recoveredChef();
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},at);
  const id=state.restaurant.orders[0].id,workflow=state.restaurant.orders[0].workflow;
  workflow.version=3;delete workflow.layoutCapacity;delete workflow.stepEnergyBase;assert.equal(validRestaurant(state.restaurant),true);
  at=workflow.createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},at);
  assertSafeExit(state.restaurant.orders[0].workflow.segments.filter(segment=>segment.phase==='walk').map(segment=>segment.to));
});

test('resuming an already-started v3 dish preserves every recorded segment while its new departure avoids the wall',()=>{
  let state=initialState(NOW);state.restaurant=restaurantInfo(state,NOW).restaurant;
  state.restaurant.staffTraining['worker-1']={...state.restaurant.staffTraining['worker-1'],energy:1,energyMode:'rest-room',rest:null};
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},NOW);
  const id=state.restaurant.orders[0].id,flow=state.restaurant.orders[0].workflow;
  flow.version=3;delete flow.layoutCapacity;delete flow.stepEnergyBase;
  let at=flow.createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},at);
  const previous=structuredClone(state.restaurant.orders[0].workflow),fullAt=state.restaurant.staffTraining['worker-1'].rest.fullAt;
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'espresso'},fullAt+1);
  const resumed=state.restaurant.orders[0].workflow;
  assert.deepEqual(resumed.runs[0],previous.runs[0]);assert.deepEqual(resumed.segments.slice(0,previous.segments.length),previous.segments);
  assertSafeExit(resumed.segments.slice(previous.segments.length).filter(segment=>segment.phase==='walk').map(segment=>segment.to));
});

test('an old rice order resting after plating also returns through the kitchen doorway before delivery',()=>{
  let state=initialState(NOW);state.restaurant=restaurantInfo(state,NOW).restaurant;
  state=act(state,{type:'restaurant-arrive',recipeId:'rice',partySize:1},NOW);
  const order=state.restaurant.orders[0];order.workflow.version=3;delete order.workflow.layoutCapacity;delete order.workflow.stepEnergyBase;
  let at=order.createdAt;
  // Seed at dispatch so arrival-time standing recovery cannot postpone fatigue.
  Object.assign(state.restaurant.staffTraining['worker-1'],{energy:90,energyAt:at,energyMode:'rest-room',rest:null});
  state=act(state,{type:'restaurant-kitchen-accept',orderId:order.id},at);
  for(const stepId of ['gather','wash','beat-eggs','chop-chicken','mix-vegetables','season','fry-rice','wrap-omelette','plate']){
    state=act(state,{type:'restaurant-kitchen-step',orderId:order.id,stepId},at);
    at=state.restaurant.orders[0].workflow.runs.at(-1).endAt;
  }
  const before=structuredClone(state.restaurant.orders[0].workflow),fullAt=state.restaurant.staffTraining['worker-1'].rest.fullAt;
  assert.equal(state.restaurant.staffTraining['worker-1'].energy,0);
  state=act(state,{type:'restaurant-kitchen-step',orderId:order.id,stepId:'delivery'},fullAt+1);
  const flow=state.restaurant.orders[0].workflow,appended=flow.segments.slice(before.segments.length);
  assert.deepEqual(flow.segments.slice(0,before.segments.length),before.segments);
  assertSafeExit(appended.map(segment=>segment.to));
  assert.ok(flow.servedAt>fullAt+1);assert.equal(state.restaurant.staffTraining['worker-1'].energy,90);
});
