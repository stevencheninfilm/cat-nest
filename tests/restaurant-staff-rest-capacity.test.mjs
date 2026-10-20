import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantInfo, restaurantActionResult, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { restaurantStaffRestInfo } from '../src/restaurant-staff-training.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';
import { restaurantRestRoomPanel, restaurantRestSummaryMarkup, restRoomSceneMarkup } from '../src/restaurant-staff-rest-ui.js';
import { restaurantStaffTerminal, restaurantStaffDebugCommand } from '../src/restaurant-staff-terminal.js';

const NOW=Date.parse('2026-10-18T21:00:00Z'),ACTOR={id:'six-rest-manager',name:'店长'};
const sixRest=(state=initialState(NOW))=>{const result=restaurantStaffDebugResult(state,{mode:'rest-six'},NOW);assert.equal(result.ok,true,result.message);return result.state;};
const act=(state,action,at)=>{const next=reduceAction(state,action,ACTOR,at);assert.ok(next,action.type);assert.equal(validRestaurant(next.restaurant),true);return next;};

test('six hired employees rest independently while the chef remains available and the test fixture preserves the wallet',()=>{
  const seed=initialState(NOW),before=structuredClone(seed),state=sixRest(seed);
  const inside=restaurantStaffRestInfo(state.restaurant,NOW+40900);
  assert.equal(state.restaurant.staff,6);assert.equal(state.restaurant.orders.length,0);assert.equal(state.restaurant.parties.length,0);
  assert.equal(inside[0].rest,null);assert.equal(inside[0].energy,200);
  assert.deepEqual(inside.slice(1).map(worker=>worker.rest.phase),Array(6).fill('recovering'));
  assert.deepEqual(inside.slice(1).map(worker=>worker.energy),Array(6).fill(50));
  assert.deepEqual(inside.slice(1).map(worker=>worker.rest.remainingMs),Array(6).fill(120000));
  for(const key of Object.keys(seed).filter(key=>!['restaurant','updatedAt'].includes(key)))assert.deepEqual(state[key],seed[key],key);
  assert.deepEqual(state.restaurant.stats,seed.restaurant.stats);assert.deepEqual(seed,before);
  const reload=normalizeState(JSON.parse(JSON.stringify(state)),NOW+40900);
  assert.deepEqual(restaurantStaffRestInfo(reload.restaurant,NOW+40900),inside);
});

test('the collapsed right-edge entrance contains no long status banner and expansion lists each of six employees once',()=>{
  const state=sixRest(),at=NOW+40900,workers=restaurantStaffRestInfo(state.restaurant,at),shell=restRoomSceneMarkup();
  assert.match(shell,/<details class="rr-rest-summary" data-r-rest-summary hidden>/);
  assert.doesNotMatch(shell,/rr-door-bubble|data-r-rest-bubble|<details[^>]*\sopen[\s>]/);
  assert.match(shell,/aria-controls="rr-rest-status"/);assert.match(shell,/data-r-rest-collapse/);
  const summary=restaurantRestSummaryMarkup(workers,at),room=restaurantRestRoomPanel(restaurantInfo(state,at),{now:at});
  assert.equal((summary.match(/data-r-rest-summary-worker=/g)||[]).length,6);
  assert.equal((room.match(/data-r-resting-worker=/g)||[]).length,6);
  assert.equal((room.match(/恢复 02:00/g)||[]).length,6);
  for(let index=2;index<=7;index++){
    assert.equal((summary.match(new RegExp(`data-r-rest-summary-worker="worker-${index}"`,'g'))||[]).length,1);
    assert.equal((room.match(new RegExp(`data-r-resting-worker="worker-${index}"`,'g'))||[]).length,1);
  }
  assert.match(room,/rr-many-workers/);assert.match(room,/恢复中 <b>6<\/b>/);assert.match(room,/待派工 <b>0<\/b>/);
  assert.doesNotMatch(room,/体力回满后留在这里|位伙伴在休息室/);
});

test('six restored employees remain inside with no automatic work until one valid player step dispatches one employee',()=>{
  let state=sixRest();
  // Reserve the chef on a manually paused order; the six hired workers must
  // not silently take the second order while their energy is recovering.
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},NOW+1000);
  const first=state.restaurant.orders[0].id,firstAt=state.restaurant.orders[0].createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:first},firstAt);
  state=act(state,{type:'restaurant-kitchen-step',orderId:first,stepId:'gather'},firstAt);
  const firstDone=state.restaurant.orders[0].workflow.runs[0].endAt;
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},firstDone);
  const second=state.restaurant.orders[1].id,secondAt=state.restaurant.orders[1].createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:second},secondAt);
  const before=structuredClone(state),blocked=restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:second,stepId:'gather'},ACTOR,secondAt);
  assert.equal(blocked.ok,false);assert.match(blocked.reason,/体力恢复中/);assert.deepEqual(state,before);
  const fullAt=NOW+160900,allReady=restaurantStaffRestInfo(state.restaurant,fullAt+1000000).slice(1);
  assert.equal(allReady.length,6);assert.ok(allReady.every(worker=>worker.energy===200&&worker.rest.phase==='ready'));
  assert.equal(state.restaurant.orders[1].workflow.runs.length,0);
  state=act(state,{type:'restaurant-kitchen-step',orderId:second,stepId:'gather'},fullAt+1);
  assert.equal(state.restaurant.orders[1].workflow.workerId,'worker-2');
  assert.equal(state.restaurant.staffTraining['worker-2'].energy,190);assert.equal(state.restaurant.staffTraining['worker-2'].rest,null);
  assert.equal(restaurantStaffRestInfo(state.restaurant,fullAt+1).filter(worker=>worker.rest?.phase==='ready').length,5);
});

test('six-person recovery respects individual stamina capacities and the fixture cannot be submitted to production',()=>{
  const seed=restaurantStaffDebugResult(initialState(NOW),{mode:'preset',staff:6},NOW).state;
  seed.restaurant.staffTraining['worker-3'].levels.stamina=2;
  seed.restaurant.staffTraining['worker-5'].levels.speed=10;
  const state=sixRest(seed),at=NOW+160900,workers=restaurantStaffRestInfo(state.restaurant,at);
  assert.equal(workers.find(worker=>worker.id==='worker-3').rest.phase,'recovering');
  assert.equal(workers.find(worker=>worker.id==='worker-3').rest.remainingMs,24000);
  assert.equal(workers.filter(worker=>worker.rest?.phase==='ready').length,5);
  assert.equal(validRestaurant(state.restaurant),true);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-rest-six'}),null);
  assert.equal(restaurantStaffDebugResult(seed,{mode:'rest-six',staff:6},NOW).ok,false);
  assert.doesNotMatch(restaurantStaffTerminal(restaurantInfo(state,at)),/data-r-debug-staff-rest-six/);
  assert.match(restaurantStaffTerminal(restaurantInfo(state,at),{enabled:true}),/data-r-debug-staff-rest-six/);
  assert.deepEqual(restaurantStaffDebugCommand({hasAttribute:key=>key==='data-r-debug-staff-rest-six'}),{mode:'rest-six'});
});
