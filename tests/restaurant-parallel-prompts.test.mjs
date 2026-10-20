import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantActionResult, validRestaurant } from '../src/restaurant.js';
import { kitchenActionPresentations, kitchenActionPresentation, kitchenViewModel, layoutKitchenActions } from '../src/restaurant-kitchen-ui.js';
import { normalizeStaffTraining } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-19T23:00:00Z'),ACTOR={id:'parallel-prompts',name:'店长'};
function act(state,action,now){
  const result=restaurantActionResult(state,action,ACTOR,now);assert.ok(result.ok,result.reason);
  const next=reduceAction(state,action,ACTOR,now);assert.ok(next);assert.ok(validRestaurant(next.restaurant));return next;
}
function fixture(recipes=['coffee','rice']){
  let state=initialState(NOW);state.restaurant.staff=1;state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,1);
  for(const recipeId of recipes)state=act(state,{type:'restaurant-arrive',recipeId,partySize:1},NOW);
  for(const order of state.restaurant.orders)state=act(state,{type:'restaurant-kitchen-accept',orderId:order.id},NOW+6000);
  return state;
}
const click=(state,id,step,at)=>act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:step},at);
const order=(state,id)=>state.restaurant.orders.find(o=>o.id===id);
const run=(state,id)=>order(state,id).workflow.runs.at(-1);
const actions=(state,at)=>kitchenActionPresentations(state.restaurant,at);

test('accepting a second order retains the first ingredient circle and carries the correct order ID on both',()=>{
  const state=fixture(),before=structuredClone(state),all=actions(state,NOW+6000);
  assert.equal(all.length,2);assert.deepEqual(all.map(a=>[a.order.id,a.order.recipeId,a.step.id]),[['table-1','coffee','gather'],['table-2','rice','gather']]);
  for(const selectedId of ['table-1','table-2']){
    kitchenViewModel(state.restaurant,selectedId,NOW+6000);
    assert.deepEqual(actions(state,NOW+6000),all,'selection changes focus without filtering scene actions');
  }
  assert.deepEqual(state,before);
});

test('coffee keeps its next step while the second dish moves to its own next station',()=>{
  let state=fixture();state=click(state,'table-1','gather',NOW+6000);let at=run(state,'table-1').endAt;
  state=click(state,'table-2','gather',at);at=run(state,'table-2').endAt;
  assert.deepEqual(actions(state,at).map(a=>[a.order.id,a.step.id]),[['table-1','espresso'],['table-2','wash']]);
  state=click(state,'table-2','wash',at);const washing=order(state,'table-2').workflow.segments.find(s=>s.phase==='work'&&s.stepId==='wash');at=washing.startAt+100;
  const all=actions(state,at),coffee=all.find(a=>a.order.id==='table-1'),rice=all.find(a=>a.order.id==='table-2');
  assert.equal(coffee.step.id,'espresso');assert.equal(coffee.running,false);assert.equal(rice.step.id,'wash');assert.equal(rice.counting,true);
  assert.ok(rice.progress>0);assert.equal(coffee.progress,0);assert.equal(coffee.seconds,null);
  assert.deepEqual(coffee,kitchenActionPresentation(state.restaurant,kitchenViewModel(state.restaurant,'table-1',at),at));
  assert.deepEqual(actions(state,run(state,'table-2').endAt).map(a=>a.step.id),['espresso','beat-eggs']);
});

test('two running dishes retain independent rings and countdowns without changing the other employee charge',()=>{
  let state=fixture();state=click(state,'table-1','gather',NOW+6000);let at=run(state,'table-1').endAt;
  state=click(state,'table-2','gather',at);at=run(state,'table-2').endAt;
  state=click(state,'table-1','espresso',at);state=click(state,'table-2','wash',at);
  const works=state.restaurant.orders.map(o=>o.workflow.segments.filter(s=>s.phase==='work').at(-1));
  const now=Math.max(...works.map(s=>s.startAt))+1,all=actions(state,now);
  assert.equal(all.length,2);assert.ok(all.every(a=>a.running&&a.counting));
  for(const action of all){const work=works.find(s=>s.stepId===action.step.id);assert.equal(action.seconds,Math.ceil((work.endAt-now)/1000));assert.equal(action.progress,(now-work.startAt)/(work.endAt-work.startAt));}
  assert.deepEqual(Object.values(state.restaurant.staffTraining).map(r=>r.energy),[180,180]);
});

test('two orders at the same workstation both retain their circles while the waiting one respects occupancy',()=>{
  let state=fixture(['coffee','coffee']);state=click(state,'table-1','gather',NOW+6000);
  const work=order(state,'table-1').workflow.segments.find(s=>s.phase==='work'),all=actions(state,work.startAt+1);
  assert.equal(all.length,2);assert.equal(all[0].counting,true);assert.equal(all[1].step.id,'gather');assert.equal(all[1].stationBusy,true);
  const before=structuredClone(state),rejected=restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:'table-2',stepId:'gather'},ACTOR,work.startAt+1);
  assert.equal(rejected.ok,false);assert.deepEqual(state,before);
  assert.equal(actions(state,work.endAt)[1].stationBusy,false);
});

test('parallel circles fit narrow and wide scenes without overlapping or covering view controls',()=>{
  const state=fixture(['coffee','coffee']),both=actions(state,NOW+6000);
  for(const width of [320,390,480,620]){
    const height=width*1672/940,obstacles=[{left:width*.35,right:width*.65,top:height*.634,bottom:height*.634+32}];
    const points=layoutKitchenActions(both,{width,height,obstacles});assert.equal(points.length,2);
    for(const point of points){const x=point.x*width/100,y=point.y*height/100;assert.ok(x>=29&&x<=width-29);assert.ok(y>=30&&y<=height-40);assert.ok(x+28<=obstacles[0].left||x-28>=obstacles[0].right||y+40<=obstacles[0].top||y-30>=obstacles[0].bottom);}
    assert.ok(Math.abs(points[0].x-points[1].x)*width/100>=56||Math.abs(points[0].y-points[1].y)*height/100>=70);
    assert.deepEqual(layoutKitchenActions(both,{width,height,obstacles}),points,'layout is stable between frames');
  }
});

test('a busy group of eight orders keeps every clickable target separate',()=>{
  const action=actions(fixture(),NOW+6000)[0],many=Array.from({length:8},(_,i)=>({...action,order:{...action.order,id:`table-${i+1}`,seat:i}}));
  for(const width of [320,480]){
    const height=width*1672/940,points=layoutKitchenActions(many,{width,height});
    assert.equal(points.length,8);assert.equal(new Set(points.map(p=>p.orderId)).size,8);
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.abs(points[i].x-points[j].x)*width/100>=56-1e-6||Math.abs(points[i].y-points[j].y)*height/100>=70-1e-6);
  }
});

test('delivered orders remove only their own circle and an unaccepted order adds none',()=>{
  let state=fixture();let at=NOW+6000;
  for(const stepId of ['gather','espresso','steam-milk','package','delivery']){state=click(state,'table-1',stepId,at);at=run(state,'table-1').endAt;}
  assert.deepEqual(actions(state,at).map(a=>a.order.id),['table-2']);
  const unaccepted=structuredClone(state);order(unaccepted,'table-2').workflow.acceptedAt=null;
  assert.equal(actions(unaccepted,at).length,0);
});
