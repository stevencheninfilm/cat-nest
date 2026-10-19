import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { kitchenViewModel, kitchenActionPresentation } from '../src/restaurant-kitchen-ui.js';
import { restaurantInputBlocked, restaurantSaveLabel } from '../src/restaurant-ui.js';

const NOW=Date.parse('2026-10-18T19:00:00Z'),actor={id:'manual-kitchen-feedback',name:'店长'};
function acceptedOrder(){
  let state=reduceAction(initialState(NOW),{type:'restaurant-arrive',recipeId:'rice',partySize:1},actor,NOW);
  const id=state.restaurant.orders[0].id;
  state=reduceAction(state,{type:'restaurant-kitchen-accept',orderId:id},actor,NOW+6000);
  return {state,id};
}
const actionAt=(state,id,at)=>kitchenActionPresentation(state.restaurant,kitchenViewModel(state.restaurant,id,at),at);

test('the same ingredient bubble remains at its station through a click, walk and work, then exposes only the next step',()=>{
  let {state,id}=acceptedOrder();
  const before=actionAt(state,id,NOW+6001);
  assert.equal(before.step.id,'gather');assert.equal(before.running,false);assert.equal(before.seconds,null);
  state=reduceAction(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},actor,NOW+6010);
  const flow=state.restaurant.orders[0].workflow,run=flow.runs[0];
  const walking=actionAt(state,id,run.startAt+1);
  const work=flow.segments.find(segment=>segment.phase==='work');
  const working=actionAt(state,id,work.startAt+100);
  for(const current of [walking,working]){
    assert.equal(current.order.id,id);assert.equal(current.step.id,before.step.id);
    assert.equal(current.step.zoneId,before.step.zoneId);assert.equal(current.step.prop,before.step.prop);
    assert.equal(current.running,true);
  }
  assert.equal(walking.moving,true);assert.equal(walking.counting,false);assert.equal(walking.seconds,null);assert.equal(walking.progress,0);
  assert.equal(working.moving,false);assert.equal(working.counting,true);assert.ok(working.seconds>0);assert.ok(working.progress>0&&working.progress<1);
  const arriving=actionAt(state,id,work.startAt),beforeArrival=actionAt(state,id,work.startAt-1);
  assert.equal(beforeArrival.seconds,null);assert.equal(beforeArrival.progress,0);
  assert.equal(arriving.seconds,Math.ceil((work.endAt-work.startAt)/1000));assert.equal(arriving.progress,0);
  const midpoint=actionAt(state,id,(work.startAt+work.endAt)/2);
  assert.equal(midpoint.progress,.5);assert.equal(midpoint.seconds,Math.ceil((work.endAt-work.startAt)/2000));
  const after=actionAt(state,id,run.endAt+1);
  assert.equal(after.running,false);assert.equal(after.step.id,'wash');assert.equal(after.seconds,null);
});

test('an unaccepted order has no operation bubble and an old completed step never starts itself',()=>{
  const state=reduceAction(initialState(NOW),{type:'restaurant-arrive',recipeId:'rice',partySize:1},actor,NOW);
  assert.equal(actionAt(state,state.restaurant.orders[0].id,NOW+3600000),null);
  const accepted=acceptedOrder();
  assert.equal(actionAt(accepted.state,accepted.id,NOW+3600000).step.id,'gather');
  assert.equal(actionAt(accepted.state,accepted.id,NOW+3600000).running,false);
});

test('background saves and an offline loaded home allow normal play while the first snapshot remains a gate',()=>{
  assert.equal(restaurantInputBlocked({ready:true,connected:true,saving:true}),false);
  assert.equal(restaurantInputBlocked({ready:true,connected:false,saving:true}),false);
  assert.equal(restaurantInputBlocked({ready:false,connected:true,saving:false}),true);
  assert.equal(restaurantInputBlocked({ready:false,connected:false,saving:false}),true);
  assert.equal(restaurantInputBlocked({connected:true,saving:true}),false);
});

test('successful background saving stays quiet and only a connection or saving problem changes the status',()=>{
  const connected={ready:true,connected:true,saving:false,savePhase:'saved'};
  assert.equal(restaurantSaveLabel({...connected,saving:true,savePhase:'saving'},true),restaurantSaveLabel(connected,true));
  assert.equal(restaurantSaveLabel({...connected,saving:true,savePhase:'saving'}),restaurantSaveLabel(connected));
  assert.match(restaurantSaveLabel({...connected,connected:false}),/已暂存/);
  assert.equal(restaurantSaveLabel({...connected,savePhase:'queued',retrying:false}),restaurantSaveLabel(connected));
  assert.match(restaurantSaveLabel({...connected,savePhase:'queued',retrying:true}),/自动重试/);
  assert.match(restaurantSaveLabel({...connected,savePhase:'error'}),/保存未完成/);
});
