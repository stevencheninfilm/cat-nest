import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { validRestaurant, restaurantInfo } from '../src/restaurant.js';
import { KITCHEN_FLOWS, KITCHEN_ORIGIN, KITCHEN_TABLE_POSITIONS, kitchenInfo, validKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { INTERACTIVE_KITCHEN_ZONES } from '../src/restaurant-kitchen-layout.js';
import { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { KITCHEN_ROUTE_LANES, KITCHEN_ROW_AISLES, kitchenDeliveryPath, kitchenReturnPath, kitchenRestPath, kitchenStationPath } from '../src/restaurant-kitchen-routing.js';
import { RESTAURANT_TABLES } from '../src/restaurant-guests.js';
import { normalizeStaffTraining, validStaffTraining, STAFF_REST_ROOM_POSITION } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'route-manager',name:'店长'};
const same=(a,b)=>a.x===b.x&&a.y===b.y;
function fixture({recipeId='coffee',tables=3,seat=0,version=4,energy=100,speed=1,stamina=1}={}){
  const r={staff:0,levels:{kitchen:1,fridge:1,tables},orders:[],staffTraining:normalizeStaffTraining(null,NOW,0)};
  r.staffTraining['worker-1']={levels:{speed,stamina,endurance:1,skill:1},energy,energyAt:NOW,energyMode:'rest-room',rest:null};
  const workflow=createInteractiveWorkflow(r,recipeId,NOW,{orderId:'table-1',seat,version});
  const o={id:'table-1',recipeId,createdAt:NOW,readyAt:NOW,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id,workflow};
  r.orders.push(o);return {r,o};
}
function apply(r,o,result){
  assert.equal(result.ok,true,result.reason);o.workflow=result.workflow;o.readyAt=result.workflow.readyAt??o.createdAt;r.staffTraining=result.staffTraining;
  assert.equal(validKitchenWorkflow(o.workflow,o,r),true);assert.equal(validStaffTraining(r.staffTraining,r.staff),true);
  return o.workflow;
}
function prepare(r,o){
  apply(r,o,acceptInteractiveWorkflow(r,o,NOW));let at=NOW;
  for(const step of KITCHEN_FLOWS[o.recipeId]){const flow=apply(r,o,advanceInteractiveWorkflow(r,o,step.id,at));at=flow.runs.at(-1).rest?.fullAt??flow.runs.at(-1).endAt;}
  return at;
}
function deliver(options){const {r,o}=fixture(options),at=prepare(r,o);apply(r,o,advanceInteractiveWorkflow(r,o,'delivery',at));return {r,o,run:o.workflow.runs.at(-1)};}
const rowFor=seat=>seat===6?0:seat===7?2:Math.floor(seat/2);
function routeSegments(from,points){return points.map((to,index)=>({from:index?points[index-1]:from,to}));}
function assertOrthogonal(segments){for(const s of segments){assert.ok(s.from.x===s.to.x||s.from.y===s.to.y,`diagonal ${JSON.stringify(s)}`);assert.equal(same(s.from,s.to),false,'no zero-distance movement');}}
function assertDoor(segments){
  for(const s of segments){
    const low=Math.min(s.from.y,s.to.y),high=Math.max(s.from.y,s.to.y);
    if(low<67&&high>65){assert.equal(s.from.x,s.to.x,'no horizontal movement through kitchen wall');assert.ok([47.5,54.5].includes(s.from.x),`wall crossing at x=${s.from.x}`);}
  }
}
function crossesTable(s,table,index){
  const rx=index<6?7.2:11,ry=index<6?2.45:2.75;
  if(s.from.y===s.to.y)return s.from.y>table.y-ry&&s.from.y<table.y+ry&&Math.max(s.from.x,s.to.x)>table.x-rx&&Math.min(s.from.x,s.to.x)<table.x+rx;
  return s.from.x>table.x-rx&&s.from.x<table.x+rx&&Math.max(s.from.y,s.to.y)>table.y-ry&&Math.min(s.from.y,s.to.y)<table.y+ry;
}
function assertNoTables(segments,capacity){for(const s of segments)for(const [index,table] of RESTAURANT_TABLES.slice(0,capacity).entries())assert.equal(crossesTable(s,table,index),false,`crosses table ${index+1}: ${JSON.stringify(s)}`);}

test('six-table delivery and return use distinct straight axes, doorway and the aisle below each row',()=>{
  for(let seat=0;seat<6;seat++){
    const {o}=deliver({seat}),table=KITCHEN_TABLE_POSITIONS[seat],segments=o.workflow.segments;
    const outgoing=segments.filter(s=>s.phase==='delivery'),returning=segments.filter(s=>s.phase==='return'),aisle=KITCHEN_ROW_AISLES[rowFor(seat)];
    assert.equal(o.workflow.version,4);assert.equal(o.workflow.layoutCapacity,6);
    assert.deepEqual(outgoing.at(-1).from,{x:table.x,y:aisle});assert.deepEqual(outgoing.at(-1).to,table);
    assert.deepEqual(returning[0].from,table);assert.deepEqual(returning[0].to,{x:table.x,y:aisle});
    assert.ok(outgoing.some(s=>same(s.to,{x:47.5,y:65.5})));assert.ok(returning.some(s=>same(s.to,{x:54.5,y:65.5})));
    assert.equal(outgoing.some(s=>s.to.x===61||s.to.x===63),false,'unexpanded floor does not take an unnecessary detour');
    assertOrthogonal([...outgoing,...returning]);assertDoor([...outgoing,...returning]);assertNoTables([...outgoing,...returning],6);
    assert.deepEqual(returning.at(-1).to,KITCHEN_ORIGIN);assert.ok(o.workflow.completedAt<=o.workflow.servedAt+4500,'collection cannot erase an in-flight return');
  }
});

test('eight-table routes avoid both central tabletops while preserving safe table approaches and the dining window',()=>{
  for(let seat=0;seat<8;seat++)for(const speed of [1,10]){
    const {o}=deliver({tables:4,seat,speed}),outgoing=o.workflow.segments.filter(s=>s.phase==='delivery'),returning=o.workflow.segments.filter(s=>s.phase==='return');
    assert.equal(o.workflow.layoutCapacity,8);assertOrthogonal([...outgoing,...returning]);assertDoor([...outgoing,...returning]);assertNoTables([...outgoing,...returning],8);
    assert.deepEqual(outgoing.at(-1).to,KITCHEN_TABLE_POSITIONS[seat]);assert.deepEqual(returning.at(-1).to,KITCHEN_ORIGIN);
    assert.ok(o.workflow.completedAt<=o.workflow.servedAt+4500);
    if(rowFor(seat)<2)assert.ok(outgoing.some(s=>[35,61].includes(s.to.x)),'central table has a side branch');
  }
});

test('all workstation, table and rest-room routes are orthogonal and cross the wall only through its doorway',()=>{
  for(const capacity of [2,4,6,8])for(const station of INTERACTIVE_KITCHEN_ZONES){
    const rest=routeSegments(station.work,kitchenRestPath(station.work,0,capacity)),exit=routeSegments(STAFF_REST_ROOM_POSITION,kitchenStationPath(STAFF_REST_ROOM_POSITION,station.work,capacity));
    assertOrthogonal([...rest,...exit]);assertDoor([...rest,...exit]);assertNoTables([...rest,...exit],capacity);
    assert.deepEqual(rest.at(-1).to,STAFF_REST_ROOM_POSITION);assert.deepEqual(exit.at(-1).to,station.work);
    assert.ok(rest.some(s=>same(s.to,{x:47.5,y:65.5})));assert.ok(exit.some(s=>same(s.to,{x:54.5,y:65.5})));
    for(let seat=0;seat<capacity;seat++){
      const table=KITCHEN_TABLE_POSITIONS[seat],toTable=routeSegments(station.work,kitchenDeliveryPath(station.work,table,seat,capacity)),toKitchen=routeSegments(table,kitchenReturnPath(table,seat,capacity)),toRest=routeSegments(table,kitchenRestPath(table,seat,capacity));
      assertOrthogonal([...toTable,...toKitchen,...toRest]);assertDoor([...toTable,...toKitchen,...toRest]);assertNoTables([...toTable,...toKitchen,...toRest],capacity);
      assert.ok(toRest.every(s=>s.from.y<65.5&&s.to.y<65.5),'a server goes to the room without detouring back into the kitchen');
    }
  }
});

test('exhausted delivery finishes at its table and begins the continuous room trip there, without a kitchen return',()=>{
  for(const tables of [3,4])for(let seat=0;seat<2*tables;seat++){
    const {r,o,run}=deliver({recipeId:'rice',tables,seat}),flow=o.workflow,rest=run.rest;
    assert.equal(run.energyAfter,0);assert.equal(run.durationMultiplier,5);assert.equal(flow.completedAt,flow.servedAt);
    assert.equal(flow.segments.some(s=>s.phase==='return'),false);assert.deepEqual(rest.segments[0].from,KITCHEN_TABLE_POSITIONS[seat]);assert.equal(rest.departAt,flow.servedAt);
    assert.deepEqual(rest.segments.at(-1).to,STAFF_REST_ROOM_POSITION);assert.ok(rest.segments.every(s=>Math.max(s.from.y,s.to.y)<=64));
    assertNoTables(rest.segments,2*tables);assertOrthogonal(rest.segments);
    const onTable=kitchenInfo(r,flow.servedAt).workers[0];assert.equal(onTable.phase,'rest-walk');assert.deepEqual(onTable.position,KITCHEN_TABLE_POSITIONS[seat]);
    assert.equal(validKitchenWorkflow(JSON.parse(JSON.stringify(flow)),o,r),true);
  }
});

test('a rested employee exits the side door, takes the second-row aisle and crosses the kitchen doorway before working',()=>{
  for(const tables of [3,4]){
    const {r,o}=fixture({tables,energy:1});apply(r,o,acceptInteractiveWorkflow(r,o,NOW));apply(r,o,advanceInteractiveWorkflow(r,o,'gather',NOW));
    const first=o.workflow.runs[0],at=first.rest.fullAt;
    apply(r,o,advanceInteractiveWorkflow(r,o,'espresso',at));const run=o.workflow.runs[1],walk=o.workflow.segments.filter(s=>s.phase==='walk'&&s.startAt>=at);
    assert.deepEqual(run.startPosition,STAFF_REST_ROOM_POSITION);assert.deepEqual(walk[0].from,STAFF_REST_ROOM_POSITION);
    assert.ok(walk.some(s=>same(s.to,{x:90,y:52})));assert.ok(walk.some(s=>same(s.to,{x:54.5,y:65.5})));
    assertOrthogonal(walk);assertDoor(walk);assertNoTables(walk,2*tables);assert.equal(run.energyBefore,100);assert.equal(run.energyCost,10);
    assert.deepEqual(walk.at(-1).to,INTERACTIVE_KITCHEN_ZONES[0].work);
  }
});

test('delivery clicked after a final preparation rest first re-enters the kitchen and then uses the outbound lane',()=>{
  const {r,o}=fixture({energy:31,tables:4}),at=prepare(r,o);assert.ok(o.workflow.runs.at(-1).rest);
  apply(r,o,advanceInteractiveWorkflow(r,o,'delivery',at));const segments=o.workflow.segments.filter(s=>s.phase==='delivery');
  assert.deepEqual(segments[0].from,STAFF_REST_ROOM_POSITION);
  const entry=segments.findIndex(s=>same(s.to,{x:54.5,y:65.5})),exit=segments.findIndex(s=>same(s.to,{x:47.5,y:65.5}));assert.ok(entry>=0&&exit>entry);
  assertOrthogonal(segments);assertDoor(segments);assertNoTables(segments,8);
});

test('capacity is snapshotted once, and expansion preserves every earlier route and clock on refresh',()=>{
  const {r,o}=deliver({tables:3}),before=structuredClone(o.workflow);r.levels.tables=4;
  assert.equal(validKitchenWorkflow(o.workflow,o,r),true);assert.deepEqual(o.workflow,before);assert.equal(o.workflow.layoutCapacity,6);
  const fresh=createInteractiveWorkflow(r,'coffee',NOW,{orderId:'table-2',seat:7,version:4});assert.equal(fresh.layoutCapacity,8);
  for(const capacity of [undefined,0,3,10]){const bad=structuredClone(r);bad.orders[0].workflow.layoutCapacity=capacity;assert.equal(validKitchenWorkflow(bad.orders[0].workflow,bad.orders[0],bad),false);}
  const smaller=structuredClone(r);smaller.orders[0].workflow.layoutCapacity=2;assert.equal(validKitchenWorkflow(smaller.orders[0].workflow,smaller.orders[0],smaller),true,'identical two-table and six-table floor networks remain valid historical snapshots');
  const missing=structuredClone(r);delete missing.orders[0].workflow.layoutCapacity;assert.equal(validKitchenWorkflow(missing.orders[0].workflow,missing.orders[0],missing),false);
  const expanded=structuredClone(r);expanded.orders[0].workflow.layoutCapacity=8;assert.equal(validKitchenWorkflow(expanded.orders[0].workflow,expanded.orders[0],expanded),false,'a capacity change cannot rewrite an existing route');
});

test('v2 and v3 snapshots retain their original routes and exact schema beside v4 orders',()=>{
  for(const version of [2,3]){
    const {r,o}=deliver({version}),flow=structuredClone(o.workflow),returning=flow.segments.filter(s=>s.phase==='return');
    assert.equal(Object.hasOwn(flow,'layoutCapacity'),false);assert.deepEqual(returning.map(s=>s.to),[{x:50,y:35.8},KITCHEN_ORIGIN]);assert.equal(validKitchenWorkflow(JSON.parse(JSON.stringify(flow)),o,r),true);
    r.levels.tables=4;assert.equal(validKitchenWorkflow(flow,o,r),true);assert.deepEqual(o.workflow,flow);
    const extra=structuredClone(flow);extra.layoutCapacity=6;assert.equal(validKitchenWorkflow(extra,o,r),false);
  }
  const {r,o,run}=deliver({version:3,recipeId:'rice'});
  assert.deepEqual(run.rest.segments.map(s=>s.to),[{x:24.5,y:76},{x:50,y:76},{x:50,y:47},{x:94,y:47},STAFF_REST_ROOM_POSITION]);
  assert.equal(validKitchenWorkflow(JSON.parse(JSON.stringify(o.workflow)),o,r),true,'old room walks are validated by their old canonical protocol');
});

test('coherent legacy shortcuts, changed door coordinates, shortened walks and forged rest departures fail closed',()=>{
  const {r}=deliver({tables:4}),legacy=deliver({version:3,tables:4}).o.workflow;
  const changes=[
    bad=>{bad.orders[0].workflow.segments[0]=null;},
    bad=>{delete bad.orders[0].workflow.segments[0].to;},
    bad=>{const s=bad.orders[0].workflow.segments.find(s=>s.phase==='delivery'&&s.to.y===65.5);s.to.x=75;},
    bad=>{const flow=bad.orders[0].workflow,s=flow.segments.find(s=>s.phase==='delivery');s.endAt--;},
    bad=>{const flow=bad.orders[0].workflow;flow.segments=structuredClone(legacy.segments);flow.runs.at(-1).endAt=legacy.completedAt;flow.servedAt=legacy.servedAt;flow.completedAt=legacy.completedAt;bad.staffTraining['worker-1'].energyAt=legacy.completedAt;},
  ];
  for(const mutate of changes){const bad=structuredClone(r);mutate(bad);assert.equal(validKitchenWorkflow(bad.orders[0].workflow,bad.orders[0],bad),false);}
  const exhausted=deliver({recipeId:'rice',tables:4}).r;
  const bad=structuredClone(exhausted),flow=bad.orders[0].workflow,rest=flow.runs.at(-1).rest;rest.segments[0].to={x:KITCHEN_TABLE_POSITIONS[0].x,y:76};flow.segments[flow.segments.length-rest.segments.length].to={...rest.segments[0].to};
  assert.equal(validKitchenWorkflow(flow,bad.orders[0],bad),false);
  const recovered=fixture({tables:3,energy:1});apply(recovered.r,recovered.o,acceptInteractiveWorkflow(recovered.r,recovered.o,NOW));
  apply(recovered.r,recovered.o,advanceInteractiveWorkflow(recovered.r,recovered.o,'gather',NOW));
  const restEnd=recovered.o.workflow.runs[0].rest.fullAt;
  apply(recovered.r,recovered.o,advanceInteractiveWorkflow(recovered.r,recovered.o,'espresso',restEnd));
  const malformed=structuredClone(recovered.r),departure=malformed.orders[0].workflow.segments.find(s=>s.startAt===restEnd);
  delete departure.to;
  assert.equal(validKitchenWorkflow(malformed.orders[0].workflow,malformed.orders[0],malformed),false,'a damaged rest-room departure rejects without throwing');
});

test('normal arrivals create v4 intent logs, survive persisted projections and grant rewards only after clicked delivery and dining',()=>{
  const act=(state,action,at)=>{const next=reduceAction(state,action,ACTOR,at);assert.ok(next,action.type);assert.equal(validRestaurant(next.restaurant),true);return next;};
  let state=act(initialState(NOW),{type:'restaurant-arrive',recipeId:'coffee',partySize:1},NOW),order=state.restaurant.orders[0],at=order.createdAt;
  assert.equal(order.workflow.version,4);assert.equal(order.workflow.layoutCapacity,2);
  const id=order.id;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
  for(const step of KITCHEN_FLOWS.coffee){state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:step.id},at);at=state.restaurant.orders[0].workflow.runs.at(-1).endAt;}
  assert.equal(reduceAction(state,{type:'restaurant-collect',orderId:id},ACTOR,at+999999),null);
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'delivery'},at);order=state.restaurant.orders[0];const flow=order.workflow;
  for(const time of [at,flow.servedAt,flow.completedAt,flow.servedAt+4500]){const reload=normalizeState(JSON.parse(JSON.stringify(state)),time);assert.deepEqual(reload.restaurant,state.restaurant);assert.deepEqual(restaurantInfo(reload,time).kitchen,restaurantInfo(state,time).kitchen);}
  assert.equal(reduceAction(state,{type:'restaurant-collect',orderId:id},ACTOR,flow.servedAt+4499),null);
  const before=state.coins;state=act(state,{type:'restaurant-collect',orderId:id},flow.servedAt+4500);assert.ok(state.coins>before);assert.equal(state.restaurant.orders.length,0);
});
