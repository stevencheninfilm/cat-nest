import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { restaurantTrainingPanel } from '../src/restaurant-economy-ui.js';
import { staffEnergyMarkup, staffRestCountdown, staffRestStatus, restaurantRestRoomPanel, restRoomSceneMarkup } from '../src/restaurant-staff-rest-ui.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';
import { restaurantStaffTerminal, restaurantStaffDebugCommand } from '../src/restaurant-staff-terminal.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'rest-ui-manager',name:'店长'};
const act=(state,action,at)=>{const next=reduceAction(state,action,ACTOR,at);assert.ok(next,action.type);return next;};
function tiredChef(){
  let state=restaurantStaffDebugResult(initialState(NOW),{mode:'stamina'},NOW).state;
  state=act(state,{type:'restaurant-arrive',recipeId:'coffee',partySize:1},NOW);
  const order=state.restaurant.orders[0],at=order.createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:order.id},at);
  state=act(state,{type:'restaurant-kitchen-step',orderId:order.id,stepId:'gather'},at);
  return {state,rest:state.restaurant.staffTraining['worker-1'].rest};
}
test('each ability has exactly ten segments and lights the saved employee level',()=>{
  const state=initialState(NOW),levels={speed:2,stamina:4,endurance:6,skill:8};
  state.restaurant=restaurantInfo(state,NOW).restaurant;
  state.restaurant.staffTraining['worker-1'].levels=levels;
  const before=structuredClone(state),html=restaurantTrainingPanel(restaurantInfo(state,NOW),{now:NOW});
  for(const [id,level] of Object.entries(levels)){
    const article=html.match(new RegExp(`<article class="re-ability" data-r-ability="${id}"[^>]*>([\\s\\S]*?)<\\/article>`))[1];
    const bar=article.match(/class="re-skill-segments"([\s\S]*?)<\/span>/)[1];
    assert.match(bar,new RegExp(`aria-valuenow="${level}"`));
    assert.equal((bar.match(/<i /g)||[]).length,10);
    assert.equal((bar.match(/class="is-lit"/g)||[]).length,level);
  }
  assert.deepEqual(state,before);
});
test('the slim employee meter clamps its fill and reports actual stamina accessibly',()=>{
  assert.match(staffEnergyMarkup(25,100,'橘子的体力'),/aria-label="橘子的体力"[\s\S]*aria-valuenow="25"[\s\S]*width:25%/);
  assert.match(staffEnergyMarkup(-10,100),/aria-valuenow="0"[\s\S]*width:0%/);
  assert.match(staffEnergyMarkup(999,115),/aria-valuenow="115"[\s\S]*width:100%/);
  assert.equal(staffRestCountdown(79999),'01:20');assert.equal(staffRestCountdown(0),'00:00');
});
test('the lounge renders recovery countdowns and keeps fully restored employees waiting for dispatch',()=>{
  const {state,rest}=tiredChef(),before=structuredClone(state),at=rest.arriveAt+8000;
  let html=restaurantRestRoomPanel(restaurantInfo(state,at),{now:at});
  assert.match(html,/data-r-resting-worker="worker-1" data-rest-phase="recovering"/);
  assert.match(html,/恢复体力 02:32/);assert.match(html,/aria-valuenow="10"/);
  assert.match(html,/恢复中 <b>1<\/b>/);
  html=restaurantRestRoomPanel(restaurantInfo(state,rest.fullAt+3600000),{now:rest.fullAt+3600000});
  assert.match(html,/data-rest-phase="ready"/);assert.match(html,/体力已满 · 等你派工/);assert.match(html,/aria-valuenow="200"/);
  assert.deepEqual(state,before,'viewing a lounge never starts a step or spends energy');
});
test('travelling employees are reported at the entrance and appear inside only after arrival',()=>{
  const {state,rest}=tiredChef(),at=rest.departAt+1;
  const html=restaurantRestRoomPanel(restaurantInfo(state,at),{now:at});
  assert.doesNotMatch(html,/data-r-resting-worker=/);assert.match(html,/1 位正在前往休息室/);
  assert.match(restRoomSceneMarkup(),/data-r-tab="restroom" aria-label="进入员工休息室"/);
  assert.match(staffRestStatus({rest:{phase:'walking',arriveAt:at+1000}},at),/前往休息室 00:01/);
});
test('the exhaustion fixture is test-only, preserves the save and refuses to edit an assigned worker',()=>{
  const seed=initialState(NOW),before=structuredClone(seed),result=restaurantStaffDebugResult(seed,{mode:'stamina'},NOW);
  assert.equal(result.ok,true);assert.equal(result.state.restaurant.staffTraining['worker-1'].energy,1);assert.equal(validRestaurant(result.state.restaurant),true);
  for(const key of ['coins','goldFish','xp','careLimits','diary'])assert.deepEqual(result.state[key],seed[key]);
  assert.deepEqual(seed,before);
  const tired=tiredChef();assert.equal(restaurantStaffDebugResult(tired.state,{mode:'stamina'},NOW+999999).ok,false);
  const info=restaurantInfo(seed,NOW);assert.doesNotMatch(restaurantStaffTerminal(info),/data-r-debug-staff-stamina/);
  assert.match(restaurantStaffTerminal(info,{enabled:true}),/data-r-debug-staff-stamina/);
  assert.deepEqual(restaurantStaffDebugCommand({hasAttribute:key=>key==='data-r-debug-staff-stamina'}),{mode:'stamina'});
});
