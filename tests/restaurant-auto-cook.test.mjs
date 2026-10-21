import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, restaurantRecipe, validRestaurant } from '../src/restaurant.js';
import { KITCHEN_FLOWS, validKitchenReservations } from '../src/restaurant-kitchen.js';
import { normalizeStaffTraining } from '../src/restaurant-staff-training.js';
import { createRestaurantAutoCook, nextRestaurantAutoCookAction, paintRestaurantAutoCook, AUTO_COOK_PREFERENCE } from '../src/restaurant-auto-cook.js';
import { restaurantMarkup } from '../src/restaurant-ui.js';
import { restaurantProgressionPanel } from '../src/restaurant-progression-ui.js';

const NOW=Date.parse('2026-10-20T04:00:00Z'),ACTOR={id:'auto-cook-owner',name:'店长'};
function fixture({level=10,staff=0,energy=200}={}){
  const state=initialState(NOW-10000);state.restaurant.stats.experience=restaurantLevelStartXp(level);
  state.restaurant.staff=staff;state.restaurant.staffTraining=normalizeStaffTraining(null,NOW-10000,staff);
  for(const record of Object.values(state.restaurant.staffTraining))Object.assign(record,{energy,energyMode:'rest-room',rest:null});
  return state;
}
function harness(options={}){
  let state=fixture(options),at=NOW,availability={ready:true},active=true;const actions=[],preferences=new Map();
  const apply=action=>{const next=reduceAction(state,action,ACTOR,at);assert.ok(next,JSON.stringify(action));state=next;assert.ok(validRestaurant(state.restaurant));assert.ok(validKitchenReservations(state.restaurant));return next;};
  const controller=createRestaurantAutoCook({getState:()=>state,getAvailability:()=>availability,now:()=>at,preferences:{getItem:key=>preferences.get(key),setItem:(key,value)=>preferences.set(key,value)},onAction:action=>{actions.push(action);apply(action);controller.tick();return true;}});
  const request=(recipeId='coffee')=>{apply({type:'restaurant-arrive',partySize:1,recipeId});const order=state.restaurant.orders.at(-1);at=Math.max(at,order.createdAt);return order.id;};
  function complete(){
    for(let i=0;i<500;i++){
      if(controller.tick({active}))continue;
      const future=state.restaurant.orders.flatMap(o=>o.workflow?.segments?.map(s=>s.endAt)??[]).concat(Object.values(state.restaurant.staffTraining).map(r=>r.rest?.fullAt??0)).filter(t=>t>at);
      if(!future.length)break;at=Math.min(...future);
    }
  }
  return {controller,actions,preferences,apply,request,complete,get state(){return state;},get at(){return at;},set at(value){at=value;},set availability(value){availability=value;},set active(value){active=value;}};
}

test('level nine cannot enable the saved preference; level ten unlocks the switch and roadmap together',()=>{
  const h=harness({level:9});assert.equal(h.controller.toggle(),false);assert.equal(h.controller.enabled,false);assert.equal(h.preferences.size,0);
  assert.equal(nextRestaurantAutoCookAction(h.state,NOW),null);
  const saved=createRestaurantAutoCook({getState:()=>h.state,now:()=>NOW,onAction:()=>assert.fail(),preferences:{getItem:()=> '1'}});
  assert.equal(saved.enabled,false);assert.equal(saved.tick(),false);
  for(const level of [9,10]){
    const info=restaurantInfo(fixture({level}),NOW),node=info.progression.catalog.find(i=>i.key==='feature:auto-cook');
    assert.equal(node.level,10);assert.equal(node.available,level===10);assert.equal(node.owned,level===10);
    assert.match(restaurantProgressionPanel(info),/一键制作/);
  }
});

test('one accepted order automatically performs every real recipe step and delivery, while unaccepted orders and rewards wait for the player',()=>{
  const h=harness();const first=h.request(),unaccepted=h.request('rice');
  h.controller.toggle();assert.equal(h.controller.tick(),false,'enabling never accepts a customer request');
  h.apply({type:'restaurant-kitchen-accept',orderId:first});const wallet=h.state.coins,xp=h.state.xp;
  h.complete();
  const flow=h.state.restaurant.orders.find(o=>o.id===first).workflow;
  assert.deepEqual(h.actions.map(a=>a.stepId),[...KITCHEN_FLOWS.coffee.map(s=>s.id),'delivery']);
  assert.ok(flow.servedAt);assert.equal(flow.runs.length,KITCHEN_FLOWS.coffee.length+1);
  assert.ok(flow.segments.some(s=>s.phase==='delivery'));assert.ok(flow.segments.some(s=>s.phase==='return'));
  assert.equal(h.state.restaurant.orders.find(o=>o.id===unaccepted).workflow.acceptedAt,null);
  assert.equal(h.state.coins,wallet);assert.equal(h.state.xp,xp);assert.equal(h.state.restaurant.stats.served,0);
  assert.ok(h.state.restaurant.staffTraining['worker-1'].energy<200);
});

test('all 21 dishes use the existing animation, station, stamina and route pipeline through serving',()=>{
  for(const recipeId of Object.keys(KITCHEN_FLOWS)){
    const h=harness({level:50,staff:1});const recipe=restaurantRecipe(recipeId);
    if(recipe?.special){h.state.restaurant.ownedSpecialRecipes.push(recipeId);h.state.restaurant.recipeLevels[recipeId]=1;}
    const id=h.request(recipeId);h.apply({type:'restaurant-kitchen-accept',orderId:id});h.controller.toggle();h.complete();
    const flow=h.state.restaurant.orders.find(o=>o.id===id).workflow;
    assert.equal(flow.runs.length,KITCHEN_FLOWS[recipeId].length+1,recipeId);assert.ok(flow.servedAt,recipeId);
    for(const step of KITCHEN_FLOWS[recipeId]){
      const work=flow.segments.find(s=>s.phase==='work'&&s.stepId===step.id);assert.ok(work,step.id);assert.ok(work.endAt>work.startAt);
    }
  }
});

test('two accepted dishes queue on the fridge and complete without overlapping stations or taking each other employees',()=>{
  const h=harness({staff:1}),ids=[h.request(),h.request()];
  for(const id of ids)h.apply({type:'restaurant-kitchen-accept',orderId:id});
  h.controller.toggle();assert.equal(h.controller.tick(),true);assert.equal(h.controller.tick(),false,'second fridge request waits for the reservation');
  h.complete();
  const flows=ids.map(id=>h.state.restaurant.orders.find(o=>o.id===id).workflow);
  assert.ok(flows.every(f=>f.servedAt!==null));assert.notEqual(flows[0].runs[0].workerId??flows[0].workerId,flows[1].runs[0].workerId??flows[1].workerId);
  const works=flows.flatMap(f=>f.segments.filter(s=>s.phase==='work'));
  for(let i=0;i<works.length;i++)for(let j=i+1;j<works.length;j++)if(works[i].zoneId===works[j].zoneId)assert.ok(works[i].endAt<=works[j].startAt||works[j].endAt<=works[i].startAt);
});

test('exhausted employees hand off after work finishes; without a spare, automation waits for the rest room',()=>{
  for(const staff of [0,1]){
    const h=harness({staff,energy:10}),id=h.request();h.apply({type:'restaurant-kitchen-accept',orderId:id});h.controller.toggle();h.controller.tick();
    let flow=h.state.restaurant.orders[0].workflow;const first=flow.runs[0];assert.ok(first.rest);
    h.at=first.endAt-1;assert.equal(h.controller.tick(),false);
    h.at=first.endAt;assert.equal(h.controller.tick(),staff===1);
    if(staff===1)assert.equal(h.state.restaurant.orders[0].workflow.workerId,'worker-2');
    else {h.at=first.rest.fullAt-1;assert.equal(h.controller.tick(),false);h.at=first.rest.fullAt;assert.equal(h.controller.tick(),true);}
    h.complete();flow=h.state.restaurant.orders[0].workflow;assert.ok(flow.servedAt);
  }
});

test('turning off stops after the current step; background, unresolved saves and duplicate pending steps stay silent',()=>{
  const h=harness(),id=h.request();h.apply({type:'restaurant-kitchen-accept',orderId:id});h.controller.toggle();
  h.availability={ready:true,pendingKitchenSteps:[`${id}:gather`]};assert.equal(h.controller.tick(),false);
  h.availability={ready:true,savePhase:'error'};assert.equal(h.controller.tick(),false);
  h.availability={ready:false};assert.equal(h.controller.tick(),false);
  h.availability={ready:true,connected:false,saving:true};assert.equal(h.controller.tick({active:false}),false);
  assert.equal(h.controller.tick(),true,'ready offline homes queue normal durable commands without waiting on another save');
  assert.equal(h.controller.toggle(),true);assert.equal(h.preferences.get(AUTO_COOK_PREFERENCE),'0');
  h.at=h.state.restaurant.orders[0].workflow.runs[0].endAt;assert.equal(h.controller.tick(),false);assert.equal(h.actions.length,1);
  h.controller.toggle();assert.equal(h.controller.tick(),true);assert.equal(h.actions.length,2);
});

test('an explicitly refused prior command does not permanently stop valid automatic cooking',()=>{
  const h=harness(),id=h.request();h.apply({type:'restaurant-kitchen-accept',orderId:id});h.controller.toggle();
  h.availability={ready:true,savePhase:'error',saveRejected:false};assert.equal(h.controller.tick(),false);
  h.availability={ready:true,savePhase:'error',saveRejected:true};assert.equal(h.controller.tick(),true);
  assert.equal(h.actions[0].stepId,'gather');h.complete();assert.ok(h.state.restaurant.orders[0].workflow.servedAt);
});

test('the right rail exposes a labeled toggle with locked, off and blue active states',()=>{
  assert.match(restaurantMarkup(fixture()),/data-r-auto-cook[^>]*aria-pressed="false"/);
  const attrs={},small={};const button={dataset:{},setAttribute:(k,v)=>attrs[k]=v,querySelector:()=>small};
  paintRestaurantAutoCook(button,restaurantInfo(fixture({level:9}),NOW),true);assert.equal(attrs['aria-pressed'],'false');assert.match(attrs['aria-label'],/Lv.10/);
  paintRestaurantAutoCook(button,restaurantInfo(fixture(),NOW),true);assert.equal(attrs['aria-pressed'],'true');assert.equal(small.textContent,'已开启');
});
