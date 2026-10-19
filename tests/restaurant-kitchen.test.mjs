import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, levelStartXp } from '../src/state.js';
import { initialRestaurant, normalizeRestaurant, validRestaurant, restaurantInfo, sanitizeRestaurantAction, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { KITCHEN_ZONES, KITCHEN_FLOWS, KITCHEN_ORIGIN, KITCHEN_TABLE_POSITIONS, createKitchenWorkflow, kitchenInfo, validKitchenWorkflow, validKitchenReservations } from '../src/restaurant-kitchen.js';
const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'kitchen-manager',name:'店长'};
const action=(state,type,fields={},at=NOW)=>reduceAction(state,{type,...fields},ACTOR,at);
const start=(state,recipeId='rice',at=NOW)=>action(state,'restaurant-start',{recipeId},at);
const eligible=(level=50)=>{const state={...initialState(NOW),coins:1200};state.restaurant.stats.experience=levelStartXp(level);return state;};
const work=workflow=>workflow.segments.filter(segment=>segment.phase==='work');
const noOverlap=(a,b)=>a.endAt<=b.startAt||b.endAt<=a.startAt;

test('ten numbered stations and both recipe flows are declarative and complete',()=>{
  assert.deepEqual(KITCHEN_ZONES.map(zone=>zone.id),[1,2,3,4,5,6,7,8,9,10]);
  for(const zone of KITCHEN_ZONES){assert.ok(zone.name);assert.ok(zone.bounds.w>0);assert.ok(zone.work.x>0);}
  assert.deepEqual(KITCHEN_FLOWS.rice.map(step=>step.zoneId),[10,7,8,6,8,9,5,5,3]);
  assert.deepEqual(KITCHEN_FLOWS.coffee.map(step=>step.zoneId),[10,1,1,2]);
  assert.equal(KITCHEN_FLOWS.rice[2].prop,'bowl-eggs');assert.equal(KITCHEN_FLOWS.rice[3].prop,'board-chicken');
  assert.equal(KITCHEN_FLOWS.coffee.at(-1).prop,'drink-packaging');
});

test('one baseline employee fetches, prepares, cooks and delivers rice without manual serving',()=>{
  const state=start(initialState(NOW)),order=state.restaurant.orders[0],flow=order.workflow;
  assert.equal(validRestaurant(state.restaurant),true);assert.equal(flow.workerId,'worker-1');assert.equal(flow.seat,0);
  assert.deepEqual(work(flow).map(segment=>segment.stepId),KITCHEN_FLOWS.rice.map(step=>step.id));
  for(const segment of flow.segments)if(segment.phase!=='work')assert.ok(segment.from.x===segment.to.x||segment.from.y===segment.to.y,'walking follows the aisles');
  assert.equal(restaurantInfo(state,flow.readyAt-1).orders[0].status,'preparing');
  assert.equal(restaurantInfo(state,flow.readyAt).orders[0].status,'delivering');
  assert.equal(restaurantInfo(state,flow.servedAt-1).orders[0].status,'delivering');
  assert.equal(restaurantInfo(state,flow.servedAt).orders[0].status,'dining');
  assert.equal(action(state,'restaurant-serve',{orderId:order.id},flow.readyAt),null,'serving cannot teleport the employee');
  assert.equal(action(state,'restaurant-collect',{orderId:order.id},flow.servedAt+RESTAURANT_DINING_MS-1),null);
  const collected=action(state,'restaurant-collect',{orderId:order.id},flow.servedAt+RESTAURANT_DINING_MS);
  assert.equal(collected.coins,state.coins+24);assert.equal(collected.xp,state.xp);assert.equal(collected.pendingGrowth.at(-1).amount,6);
  assert.equal(collected.restaurant.orders.length,0);
});

test('a second order waits until the single employee has returned to the kitchen',()=>{
  let state=start(initialState(NOW));state=start(state,'coffee');
  const [rice,coffee]=state.restaurant.orders.map(order=>order.workflow);
  assert.equal(rice.workerId,coffee.workerId);
  assert.equal(coffee.segments[0].phase,'wait');assert.equal(coffee.segments[0].endAt,rice.completedAt);
  assert.equal(coffee.segments.find(segment=>segment.phase==='walk').startAt,rice.completedAt);
  assert.equal(validRestaurant(state.restaurant),true);
  const queue=kitchenInfo(state.restaurant,NOW+1000);assert.equal(queue.workers.length,1);assert.equal(queue.workers[0].orderId,'table-1');
  assert.equal(queue.orders[1].phase,'queue');assert.equal(queue.orders[1].queuedUntil,rice.completedAt);
  const after=kitchenInfo(state.restaurant,rice.completedAt);assert.equal(after.workers[0].orderId,'table-2');
});

test('four employees keep all workstation intervals exclusive, including consecutive steps',()=>{
  let state=eligible();state.coins=20000;
  for(let i=0;i<3;i++)state=action(state,'restaurant-hire');
  for(let i=0;i<3;i++)state=action(state,'restaurant-upgrade',{upgradeId:'tables'});
  for(const recipe of ['rice','coffee','rice','coffee','rice','coffee','rice','coffee'])state=start(state,recipe);
  const flows=state.restaurant.orders.map(order=>order.workflow);
  assert.equal(new Set(flows.map(flow=>flow.workerId)).size,4);assert.equal(validRestaurant(state.restaurant),true);
  for(let i=0;i<flows.length;i++)for(let j=i+1;j<flows.length;j++){
    for(const left of work(flows[i]))for(const right of work(flows[j]))if(left.zoneId===right.zoneId)assert.ok(noOverlap(left,right),`zone ${left.zoneId} overlaps`);
    if(flows[i].workerId===flows[j].workerId){const busy=flow=>({startAt:flow.segments.find(segment=>segment.phase!=='wait').startAt,endAt:flow.completedAt});assert.ok(noOverlap(busy(flows[i]),busy(flows[j])));}
  }
  assert.ok(flows.some(flow=>flow.segments.some(segment=>segment.phase==='wait'&&segment.zoneId===10)),'shared fridge creates a real station queue');
  const first=work(flows[0])[0],info=kitchenInfo(state.restaurant,first.startAt+1000),fridge=info.zones.find(zone=>zone.id===10);
  assert.equal(fridge.occupant.orderId,'table-1');assert.equal(fridge.occupant.progress,.25);assert.ok(fridge.queue.length>0);
});

test('fridge improves fetching only and cooking upgrades improve all preparation steps only',()=>{
  const base=eligible(10),original=start(base).restaurant.orders[0].workflow;
  const fridge=start(action(base,'restaurant-upgrade',{upgradeId:'fridge'})).restaurant.orders[0].workflow;
  const kitchen=start(action(base,'restaurant-upgrade',{upgradeId:'kitchen'})).restaurant.orders[0].workflow;
  const durations=flow=>work(flow).map(segment=>segment.endAt-segment.startAt);
  const normal=durations(original),cold=durations(fridge),cook=durations(kitchen);
  assert.equal(cold[0],normal[0]*.85);assert.deepEqual(cold.slice(1),normal.slice(1));
  assert.equal(cook[0],normal[0]);assert.ok(cook.slice(1).every((duration,index)=>duration<normal[index+1]));
  assert.equal(validRestaurant({ ...base.restaurant,orders:[] }),true);
});

test('all eight seats return within the dining window, so collecting cannot erase an in-flight return',()=>{
  for(let seat=0;seat<8;seat++){
    let state=initialState(NOW);state.restaurant.levels.tables=4;
    // Reserve earlier seats using legacy-style orders (other dishes retain them).
    for(let index=0;index<seat;index++)state=start(state,'sandwich');
    state=start(state,'coffee');const order=state.restaurant.orders.at(-1),flow=order.workflow;
    assert.equal(flow.seat,seat);assert.ok(flow.completedAt<=flow.servedAt+RESTAURANT_DINING_MS);
    assert.deepEqual(flow.segments.findLast(segment=>segment.phase==='delivery').to,KITCHEN_TABLE_POSITIONS[seat]);
    assert.deepEqual(flow.segments.at(-1).to,KITCHEN_ORIGIN);
    const after=action(state,'restaurant-collect',{orderId:order.id},flow.servedAt+RESTAURANT_DINING_MS);
    const next=start(after,'coffee',flow.servedAt+RESTAURANT_DINING_MS);
    assert.equal(next.restaurant.orders.at(-1).workflow.segments[0].phase,'walk');
    assert.equal(validRestaurant(next.restaurant),true);
  }
});

test('old three-level saves and in-flight legacy rice keep their exact order and wallet',()=>{
  const state=initialState(NOW);state.coins=657;state.xp=175;
  const legacy=structuredClone(state.restaurant);delete legacy.levels.fridge;delete legacy.parties;delete legacy.progression;
  legacy.nextOrderId=2;legacy.orders.push({id:'table-1',recipeId:'rice',createdAt:NOW,readyAt:NOW+8000,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id});
  const before=structuredClone(legacy),restored=normalizeRestaurant(legacy,NOW+1000);
  assert.equal(validRestaurant(legacy),true);assert.equal(restored.levels.fridge,1);
  assert.deepEqual(restored.orders,before.orders);assert.deepEqual(legacy,before);
  const served=action({...state,restaurant:restored},'restaurant-serve',{orderId:'table-1'},NOW+8000);
  const complete=action(served,'restaurant-collect',{orderId:'table-1'},NOW+8000+RESTAURANT_DINING_MS);
  assert.equal(complete.coins,681);assert.equal(complete.xp,175);assert.equal(complete.pendingGrowth.at(-1).amount,6);
  assert.ok(start({...state,restaurant:restored},'coffee').restaurant.orders[1].workflow);
});

test('tampered steps, walking, timing, seat and overlapping worker/station reservations fail validation',()=>{
  let state=action(eligible(2),'restaurant-hire');state=start(start(state),'coffee');
  const good=state.restaurant;assert.equal(validRestaurant(good),true);
  for(const mutate of [
    flow=>flow.segments.find(segment=>segment.phase==='work').endAt--,
    flow=>flow.segments.find(segment=>segment.phase==='work').zoneId=1,
    flow=>flow.segments.find(segment=>segment.phase==='work').stepId='instant',
    flow=>flow.segments.find(segment=>segment.phase==='walk').to.x--,
    flow=>flow.servedAt=flow.readyAt,
    flow=>flow.completedAt=flow.servedAt+5000,
    flow=>flow.fridgeLevel=4,
    flow=>flow.seat=7,
    flow=>flow.workerId='worker-4',
    flow=>flow.segments.shift(),
    flow=>flow.segments.find(segment=>segment.phase==='work').carrying='coins',
  ]){const bad=structuredClone(good);mutate(bad.orders[0].workflow);assert.equal(validRestaurant(bad),false);}
  const worker=structuredClone(good);worker.orders[1].workflow.workerId='worker-1';assert.equal(validRestaurant(worker),false);
  const seat=structuredClone(good);seat.orders[1].workflow.seat=0;assert.equal(validRestaurant(seat),false);
  const first=good.orders[0];assert.equal(validKitchenWorkflow(first.workflow,first,good),true);
});

test('client actions cannot provide workflows, workers, seats, or elapsed-time shortcuts',()=>{
  for(const extra of [{workflow:{}},{workerId:'worker-2'},{seat:0},{durationMs:0},{fridgeLevel:4},{servedAt:NOW},{readyAt:NOW},{amount:9999}])assert.equal(sanitizeRestaurantAction({type:'restaurant-start',recipeId:'rice',...extra}),null);
  assert.deepEqual(sanitizeRestaurantAction({type:'restaurant-upgrade',upgradeId:'fridge'}),{type:'restaurant-upgrade',upgradeId:'fridge'});
  const state=start(initialState(NOW),'coffee'),flow=state.restaurant.orders[0].workflow;
  const saving=JSON.parse(JSON.stringify(state.restaurant)),now=flow.segments.find(segment=>segment.phase==='work').startAt+1000;
  assert.deepEqual(kitchenInfo(saving,now),kitchenInfo(state.restaurant,now),'reload resumes identical employee positions and progress');
  assert.deepEqual(saving,state.restaurant,'UI projection is read-only');
});

test('six additional hires retain all seven employee identities in detailed cooking and reload',()=>{
  let state=eligible();state.coins=50000;state.goldFish=100;
  for(let index=0;index<6;index++)state=action(state,'restaurant-hire');
  for(let index=0;index<3;index++)state=action(state,'restaurant-upgrade',{upgradeId:'tables'});
  for(let index=0;index<7;index++)state=start(state,index%2?'coffee':'rice');
  assert.equal(state.restaurant.staff,6);assert.equal(kitchenInfo(state.restaurant,NOW).workers.length,7);
  assert.equal(new Set(state.restaurant.orders.map(order=>order.workflow.workerId)).size,7);
  assert.equal(validRestaurant(state.restaurant),true);
  assert.deepEqual(normalizeRestaurant(state.restaurant,NOW),state.restaurant);
});


test('future seating and accepting a detailed order keep employees idle until the first ingredient click',()=>{
  let state=action(initialState(NOW),'restaurant-arrive',{partySize:1,recipeId:'rice'});const createdAt=NOW+6000,id=state.restaurant.orders[0].id;
  assert.equal(validRestaurant(state.restaurant),true);assert.equal(state.restaurant.orders[0].workflow.version,4);
  const before=kitchenInfo(state.restaurant,NOW+5999);
  assert.equal(before.workers[0].phase,'idle');assert.equal(before.workers[0].orderId,null);
  assert.equal(before.orders[0].phase,'arriving');assert.equal(before.orders[0].currentStep.label,'等待客人入座');
  for(const at of [createdAt,createdAt+100000]){const seated=kitchenInfo(state.restaurant,at);assert.equal(seated.workers[0].phase,'idle');assert.equal(seated.orders[0].phase,'requested');assert.equal(seated.orders[0].nextStep,null);}
  assert.equal(action(state,'restaurant-kitchen-accept',{orderId:id},createdAt-1),null);
  state=action(state,'restaurant-kitchen-accept',{orderId:id},createdAt);
  const accepted=kitchenInfo(state.restaurant,createdAt+100000);assert.equal(accepted.workers[0].phase,'idle');assert.equal(accepted.orders[0].phase,'awaiting');assert.equal(accepted.orders[0].nextStep.id,'gather');
  state=action(state,'restaurant-kitchen-step',{orderId:id,stepId:'gather'},createdAt+100000);
  assert.ok(state);assert.equal(kitchenInfo(state.restaurant,createdAt+100000).workers[0].phase,'walk');
});

test('saved v1 future workflows still start automatically at their original seating timestamp',()=>{
  const restaurant=initialRestaurant(NOW),createdAt=NOW+6000;
  const workflow=createKitchenWorkflow(restaurant,'rice',createdAt,{orderId:'table-1',seat:0});
  restaurant.orders.push({id:'table-1',recipeId:'rice',createdAt,readyAt:workflow.readyAt,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id,workflow});
  restaurant.parties=[{id:'party-1',table:0,arrivedAt:NOW,seatedAt:createdAt,members:[{cat:'orange',orderId:'table-1'}]}];restaurant.nextOrderId=2;
  const saved=structuredClone(restaurant);
  assert.equal(validRestaurant(restaurant),true);assert.equal(kitchenInfo(restaurant,createdAt-1).workers[0].phase,'idle');
  assert.equal(kitchenInfo(restaurant,createdAt).workers[0].phase,'walk');assert.deepEqual(normalizeRestaurant(restaurant,NOW).orders,saved.orders);
});

test('two workflows may deliver to the same table only when an explicit party owns both orders',()=>{
  const restaurant=initialRestaurant(NOW);
  const first=createKitchenWorkflow(restaurant,'rice',NOW+6000,{orderId:'table-1',seat:0});
  restaurant.orders.push({id:'table-1',workflow:first});
  const second=createKitchenWorkflow(restaurant,'coffee',NOW+6000,{orderId:'table-2',seat:0});
  restaurant.orders.push({id:'table-2',workflow:second});
  assert.equal(validKitchenReservations(restaurant),false);
  restaurant.parties=[{table:0,members:[{orderId:'table-1'},{orderId:'table-2'}]}];
  assert.equal(validKitchenReservations(restaurant),true);
  restaurant.parties[0].table=1;assert.equal(validKitchenReservations(restaurant),false);
});
