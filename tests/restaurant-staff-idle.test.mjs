import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { normalizeRestaurant, restaurantInfo, restaurantActionResult, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { STAFF_IDLE_RECOVERY_MS, normalizeStaffTraining, restaurantStaffRestInfo, restaurantStaffIdleAt } from '../src/restaurant-staff-training.js';
import { KITCHEN_FLOWS, validKitchenReservations } from '../src/restaurant-kitchen.js';
import { restaurantTrainingPanel } from '../src/restaurant-economy-ui.js';

const NOW=Date.parse('2026-10-19T12:00:00Z'),ACTOR={id:'idle-manager',name:'店长'};
function fixture(energies=[40,70,0]){
  const state=initialState(NOW);state.coins=10000;state.restaurant.stats.experience=levelStartXp(50);
  state.restaurant.staff=energies.length-1;state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,state.restaurant.staff);
  for(const [index,energy] of energies.entries())Object.assign(state.restaurant.staffTraining[`worker-${index+1}`],{energy,energyMode:'rest-room',rest:null});
  return state;
}
function act(state,action,at){const result=restaurantActionResult(state,action,ACTOR,at);assert.equal(result.ok,true,result.reason);const next=reduceAction(state,action,ACTOR,at);assert.ok(next);assert.ok(validRestaurant(next.restaurant));return next;}
const energy=(state,at)=>restaurantInfo(state,at).kitchen.workers.map(worker=>worker.energy);
const order=state=>state.restaurant.orders[0];
const click=(state,stepId,at)=>act(state,{type:'restaurant-kitchen-step',orderId:order(state).id,stepId},at);
function paused(energies=[40]){
  let state=fixture(energies);state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},NOW);
  const at=order(state).createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:order(state).id},at);state=click(state,'gather',at);
  return {state,end:order(state).workflow.runs[0].endAt};
}

test('thirty minutes of inactivity refill every worker to their own trained capacity at the exact boundary',()=>{
  assert.equal(STAFF_IDLE_RECOVERY_MS,30*60_000);
  const state=fixture(),records=state.restaurant.staffTraining;records['worker-2'].levels.stamina=3;records['worker-3'].levels.stamina=10;
  const before=structuredClone(state);
  assert.deepEqual(energy(state,NOW+STAFF_IDLE_RECOVERY_MS-1),[40,70,0]);
  assert.deepEqual(energy(state,NOW+STAFF_IDLE_RECOVERY_MS),[200,260,470]);
  assert.deepEqual(state,before,'a read projection never saves, spends or changes the source');
  const full=normalizeState(JSON.parse(JSON.stringify(state)),NOW+STAFF_IDLE_RECOVERY_MS);
  assert.deepEqual(energy(full,NOW+STAFF_IDLE_RECOVERY_MS),[200,260,470]);
  assert.deepEqual(full.restaurant.stats,before.restaurant.stats);
  assert.equal(full.coins,before.coins);assert.equal(full.xp,before.xp);
  assert.deepEqual(full.pendingGrowth,before.pendingGrowth);
});

test('leaving and re-entering and keeping the page open produce the same refill without advancing a dish',()=>{
  const {state,end}=paused(),at=restaurantStaffIdleAt(state.restaurant),before=structuredClone(state);
  const online=restaurantInfo(state,at),offline=normalizeState(JSON.parse(JSON.stringify(state)),at);
  assert.deepEqual(online.restaurant,offline.restaurant);
  assert.equal(online.kitchen.workers[0].energy,200);assert.equal(online.orders[0].status,'awaiting');
  assert.deepEqual(online.restaurant.orders,state.restaurant.orders);
  assert.deepEqual(online.kitchen.workers[0].position,restaurantInfo(state,end).kitchen.workers[0].position);
  assert.deepEqual(state,before);
  assert.equal(restaurantActionResult(offline,{type:'restaurant-collect',orderId:order(state).id},ACTOR,at).ok,false);
});

test('the next clicked operation spends once after refill and subsequent steps cannot claim the refill again',()=>{
  let {state,end}=paused(),at=restaurantStaffIdleAt(state.restaurant);
  const historical=structuredClone(order(state).workflow),firstCost=historical.runs[0].energyCost;
  assert.equal(firstCost,10);assert.deepEqual(energy(state,at-1),[30]);
  state=click(state,'espresso',at);let run=order(state).workflow.runs.at(-1);
  assert.equal(run.energyBefore,200);assert.equal(run.energyAfter,190);assert.equal(run.idleRecoveryAt,at);
  assert.deepEqual(order(state).workflow.runs.slice(0,-1),historical.runs);
  assert.deepEqual(order(state).workflow.segments.slice(0,historical.segments.length),historical.segments);
  const saved=normalizeState(JSON.parse(JSON.stringify(state)),run.endAt);
  assert.deepEqual(saved.restaurant,state.restaurant);
  assert.equal(reduceAction(saved,{type:'restaurant-kitchen-step',orderId:order(state).id,stepId:'espresso'},ACTOR,run.endAt),null);
  state=click(saved,'steam-milk',run.endAt);run=order(state).workflow.runs.at(-1);
  assert.equal(run.energyBefore,190);assert.equal(run.energyAfter,180);assert.equal(run.idleRecoveryAt,at);
  assert.ok(validKitchenReservations(state.restaurant));
  const secondPause=restaurantStaffIdleAt(state.restaurant);
  state=click(state,'package',secondPause);run=order(state).workflow.runs.at(-1);
  assert.equal(run.energyBefore,200);assert.equal(run.energyAfter,190);assert.equal(run.idleRecoveryAt,secondPause);
  state=click(state,'delivery',run.endAt);assert.ok(validRestaurant(state.restaurant));
  assert.equal(state.restaurant.stats.served,0,'only collection settles the order');
});

test('a valid player operation resets inactivity and a booked action must finish before refill',()=>{
  let {state,end}=paused(),at=restaurantStaffIdleAt(state.restaurant)-1;
  state=click(state,'espresso',at);const run=order(state).workflow.runs.at(-1),deadline=at+STAFF_IDLE_RECOVERY_MS;
  assert.equal(run.energyBefore,30);assert.equal(state.restaurant.lastInteractionAt,at);
  assert.equal(restaurantStaffIdleAt(state.restaurant),deadline);
  assert.deepEqual(energy(state,deadline-1),[20]);assert.deepEqual(energy(state,deadline),[200]);
  const booked=fixture([40]);booked.restaurant.staffTraining['worker-1'].energyAt=NOW+STAFF_IDLE_RECOVERY_MS+5000;
  assert.deepEqual(energy(booked,NOW+STAFF_IDLE_RECOVERY_MS),[40]);
  assert.deepEqual(energy(booked,booked.restaurant.staffTraining['worker-1'].energyAt),[200]);
});

test('automatic arrivals, waiting guests, polling and home care do not postpone the restaurant inactivity window',()=>{
  let state=fixture([40]);
  for(const at of [NOW+STAFF_IDLE_RECOVERY_MS-60000,NOW+STAFF_IDLE_RECOVERY_MS-30000])state=act(state,{type:'restaurant-arrive',partySize:1,recipeId:'coffee'},at);
  state=act(state,{type:'restaurant-wait'},NOW+STAFF_IDLE_RECOVERY_MS-10000);
  assert.equal(state.restaurant.lastInteractionAt,NOW);
  const home=reduceAction(state,{type:'pet'},ACTOR,NOW+STAFF_IDLE_RECOVERY_MS-1);assert.ok(home);
  assert.deepEqual(energy(home,NOW+STAFF_IDLE_RECOVERY_MS-1),[40]);
  assert.deepEqual(energy(home,NOW+STAFF_IDLE_RECOVERY_MS),[200]);
  assert.equal(home.restaurant.lastInteractionAt,NOW);
});

test('upgrades and accepting an order restart the shared clock; a rejected command does not restart it',()=>{
  let state=fixture([40]),at=NOW+STAFF_IDLE_RECOVERY_MS-1;
  state=act(state,{type:'restaurant-train',workerId:'worker-1',statId:'stamina'},at);
  assert.equal(state.restaurant.lastInteractionAt,at);assert.deepEqual(energy(state,at+STAFF_IDLE_RECOVERY_MS-1),[40]);
  assert.deepEqual(energy(state,at+STAFF_IDLE_RECOVERY_MS),[230]);
  const before=structuredClone(state);
  assert.equal(reduceAction(state,{type:'restaurant-kitchen-step',orderId:'table-99',stepId:'gather'},ACTOR,at+1),null);assert.deepEqual(state,before);
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},at+1);
  const seated=order(state).createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:order(state).id},seated);
  assert.equal(state.restaurant.lastInteractionAt,seated);
});

test('parallel paused orders stay assigned to their workers and each can continue after the same idle refill',()=>{
  let {state,end}=paused([40,60]);
  state=act(state,{type:'restaurant-arrive',recipeId:'rice',partySize:1},end);const second=state.restaurant.orders[1];
  state=act(state,{type:'restaurant-kitchen-accept',orderId:second.id},second.createdAt);
  state=act(state,{type:'restaurant-kitchen-step',orderId:second.id,stepId:'gather'},second.createdAt);
  const prefix=structuredClone(state.restaurant.orders),at=restaurantStaffIdleAt(state.restaurant);
  assert.deepEqual(energy(state,at),[200,200]);
  state=click(state,'espresso',at);
  const nextAt=order(state).workflow.runs.at(-1).endAt;
  state=act(state,{type:'restaurant-kitchen-step',orderId:second.id,stepId:'wash'},nextAt);
  assert.deepEqual(state.restaurant.orders.map(o=>o.workflow.workerId),['worker-1','worker-2']);
  assert.deepEqual(state.restaurant.orders.map(o=>o.workflow.runs.at(-1).energyBefore),[200,200]);
  assert.deepEqual(state.restaurant.orders.map(o=>o.workflow.runs[0]),prefix.map(o=>o.workflow.runs[0]));
});

test('old saves derive a stable inactivity anchor and existing rest trips keep their exact timestamps',()=>{
  let {state,end}=paused();delete state.restaurant.lastInteractionAt;
  const old=structuredClone(state),at=restaurantStaffIdleAt(state.restaurant);
  const full=normalizeState(JSON.parse(JSON.stringify(state)),at);
  assert.equal(full.restaurant.lastInteractionAt,end);assert.deepEqual(energy(full,at),[200]);
  assert.deepEqual(full.restaurant.orders,old.restaurant.orders);
  assert.deepEqual(normalizeRestaurant(full.restaurant,at+1),full.restaurant);
  ({state}=paused([10]));const trip=structuredClone(state.restaurant.staffTraining['worker-1'].rest);
  const later=normalizeRestaurant(state.restaurant,trip.fullAt+STAFF_IDLE_RECOVERY_MS);
  assert.deepEqual(later.staffTraining['worker-1'].rest,trip);
  assert.equal(restaurantStaffRestInfo(later,trip.fullAt+STAFF_IDLE_RECOVERY_MS)[0].energy,200);
});

test('invalid activity clocks, forged refill checkpoints and client-supplied recharge intents fail closed',()=>{
  let {state,end}=paused();state=click(state,'espresso',end+STAFF_IDLE_RECOVERY_MS);
  for(const mutate of [
    r=>r.lastInteractionAt=-1,r=>r.lastInteractionAt=1.2,
    r=>r.staffTraining['worker-1'].idleRecoveryAt=NaN,
    r=>r.staffTraining['worker-1'].idleRecoveryAt=r.staffTraining['worker-1'].energyAt+1,
    r=>delete r.orders[0].workflow.runs[1].idleRecoveryAt,
    r=>r.orders[0].workflow.runs[1].idleRecoveryAt=r.orders[0].workflow.runs[0].commandAt+STAFF_IDLE_RECOVERY_MS-1,
    r=>r.orders[0].workflow.runs[1].energyBefore--,
    r=>r.orders[0].workflow.segments[0].endAt--,
  ]){const bad=structuredClone(state.restaurant);mutate(bad);assert.equal(validRestaurant(bad),false);}
  for(const extra of [{idleRecoveryAt:NOW},{lastInteractionAt:NOW},{energy:200}])assert.equal(sanitizeRestaurantAction({type:'restaurant-kitchen-step',orderId:order(state).id,stepId:'steam-milk',...extra}),null);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-recharge'}),null);
});

test('the employee panel explains the thirty-minute full recovery rule',()=>{
  const html=restaurantTrainingPanel(restaurantInfo(fixture(),NOW),{now:NOW});
  assert.match(html,/离线\/闲置 30 分钟回满/);
});

test('old v2–v4 save snapshots keep their recorded history when continuing after long inactivity',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {fixtures}=JSON.parse(await readFile(new URL('./fixtures/restaurant-stamina-100.json',import.meta.url)));
  for(const name of ['activeV2','activeV4','waitingV4','exhaustedV3','resumedV4','handoffV4']){
    const saved=fixtures[name],at=restaurantStaffIdleAt(saved),state={...initialState(NOW),restaurant:structuredClone(saved)};
    const normalized=normalizeState(state,at),current=normalized.restaurant.orders[0];
    const next=act(normalized,{type:'restaurant-kitchen-step',orderId:current.id,stepId:KITCHEN_FLOWS.coffee[current.workflow.runs.length].id},at);
    const flow=next.restaurant.orders[0].workflow,run=flow.runs.at(-1);
    assert.deepEqual(flow.runs.slice(0,-1),saved.orders[0].workflow.runs,name);
    assert.equal(run.energyBefore,200,name);assert.equal(run.energyAfter,200-run.energyCost,name);
    assert.ok(validRestaurant(next.restaurant));
  }
});

test('the isolated exhaustion preview still works when the tester returns after a long idle',async()=>{
  const {restaurantStaffDebugResult}=await import('../demo/restaurant-staff.js');
  const result=restaurantStaffDebugResult(fixture([40]),{mode:'stamina'},NOW+STAFF_IDLE_RECOVERY_MS+1000);
  assert.equal(result.ok,true,result.message);
  assert.equal(result.state.restaurant.lastInteractionAt,NOW+STAFF_IDLE_RECOVERY_MS+1000);
  assert.deepEqual(energy(result.state,NOW+STAFF_IDLE_RECOVERY_MS+2000),[1]);
});
