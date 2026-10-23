import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';
import { initialState,reduceAction,normalizeState} from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { validRestaurant,restaurantInfo,restaurantRecipe } from '../src/restaurant.js';
import { createRestaurantAutoCook } from '../src/restaurant-auto-cook.js';
import { restaurantStaffIdleAt } from '../src/restaurant-staff-training.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { restaurantGuestDebugResult } from '../demo/restaurant-guests.js';
import { restaurantResearchDebugResult } from '../demo/restaurant-research.js';
import { prepareRestaurantMealForCollection } from './restaurant-meal-fixtures.mjs';
import { restaurantGuestTables } from '../src/restaurant-guests-ui.js';
const NOW=Date.parse('2026-10-18T12:00:00Z'),ROOM='e'.repeat(32),ACTOR={id:'queue-owner',name:'店长'};
const clone=value=>structuredClone(value),response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(data)});
const snapshot=(state,revision=0,event)=>({roomId:ROOM,state,revision,...(event?{event}:{})});
const receipt=(item,state,revision=1)=>snapshot(state,revision,{operationId:item.operationId,action:item.action,actor:{id:item.clientId,name:item.name}});
const flush=async()=>{for(let index=0;index<50;index++)await Promise.resolve();};
const tableView=h=>restaurantGuestTables(restaurantInfo(h.latest(),Date.now()),{icon:()=>'',food:()=>'',pendingCourses:h.cloud.getPendingActions().filter(item=>item.action.type==='restaurant-collect').map(item=>item.action.orderId)});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function requested(recipeId='coffee',count=1){
  let state=initialState(NOW-6000);state.restaurant.stats.experience=levelStartXp(restaurantRecipe(recipeId).unlockLevel);if(restaurantRecipe(recipeId).special){state.restaurant.ownedSpecialRecipes=[recipeId];state.restaurant.recipeLevels[recipeId]=1;}for(let index=0;index<count;index++)state=reduceAction(state,{type:'restaurant-arrive',partySize:1,recipeId},ACTOR,NOW-6000,`seed-arrival-${index}`);
  assert.ok(state);assert.equal(validRestaurant(state.restaurant),true);return state;
}
function harness(t,handler,{state=requested(),pending=[],roomId=ROOM}={}){
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:NOW});
  const requests=[],sources=[],observed={states:[],actions:[],rollbacks:[],pending:[],saves:[],statuses:[]};
  class Source{
    constructor(url){this.url=url;this.listeners=new Map();this.closed=false;sources.push(this);}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    emit(type,data){if(!this.closed)this.listeners.get(type)?.({data:JSON.stringify(data)});}
    fail(){this.onerror?.();}open(){this.onopen?.();}close(){this.closed=true;}
  }
  const cloud=createCloudRoom({apiBase:'https://cloud.example.test',roomId,clientId:ACTOR.id,name:ACTOR.name,initialState:state,pending:clone(pending),optimisticReducer:reduceAction,
    fetchImpl:async(url,options={})=>{const req={url,method:options.method??'GET',body:options.body?JSON.parse(options.body):null,signal:options.signal};requests.push(req);return handler(req);},eventSourceFactory:url=>new Source(url),
    onRoom(){},onPresence(){},onStatus:value=>observed.statuses.push(clone(value)),onState:(state,meta)=>observed.states.push(clone({state,...meta})),
    onAction:(action,actor,meta)=>observed.actions.push(clone({action,actor,...meta})),onRollback:(action,actor,meta)=>observed.rollbacks.push(clone({action,actor,...meta})),
    onPending:value=>observed.pending.push(clone(value)),onSaveStatus:value=>observed.saves.push(clone(value)),
  });
  t.after(()=>cloud.destroy());
  return {cloud,requests,sources,observed,state,latest:()=>observed.states.at(-1)?.state,pending:()=>observed.pending.at(-1)??pending,posts:()=>requests.filter(req=>req.method==='POST')};
}
function apply(state,item,at=Date.now()){const next=reduceAction(state,item.action,{id:item.clientId,name:item.name},at,item.operationId);assert.ok(next,`server rejected ${item.action.type}:${item.action.stepId??''} at ${at}`);return next;}
function upgradeFixture(){
  let state=initialState(NOW);state.coins=50000;state.goldFish=100;state.restaurant.stats.experience=levelStartXp(50);
  state=reduceAction(state,{type:'restaurant-research-draw',draw:1},ACTOR,NOW,'fixture-draw');
  assert.ok(validRestaurant(state.restaurant));return state;
}

test('facility, employee, skill and recipe upgrades update immediately while earlier uploads are still pending',async t=>{
  const base=upgradeFixture(),acks=Array.from({length:6},deferred);let saved=base,posts=0;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved)):acks[posts++].promise,{state:base});await h.cloud.start();
  for(const action of [
    {type:'restaurant-upgrade',upgradeId:'kitchen'},
    {type:'restaurant-upgrade',upgradeId:'kitchen'},
    {type:'restaurant-train',workerId:'worker-1',statId:'stamina'},
    {type:'restaurant-hire'},
    {type:'restaurant-recipe',recipeId:'rice'},
    {type:'pet'},
  ])assert.equal(h.cloud.dispatch(action),true);
  assert.equal(h.posts().length,1);assert.equal(h.pending().length,6);
  const local=h.latest();assert.equal(local.restaurant.levels.kitchen,3);assert.equal(local.restaurant.staffTraining['worker-1'].levels.stamina,2);assert.equal(local.restaurant.staff,1);assert.equal(local.restaurant.recipeLevels.rice,2);assert.equal(local.restaurant.research.fragments.rice,0);assert.equal(local.pendingGrowth.length,1);
  assert.ok(local.coins<base.coins);assert.ok(validRestaurant(local.restaurant));
  assert.deepEqual(h.pending().slice(0,5).map(item=>item.action.expectedLevel),[2,3,2,1,2]);
  for(let i=0;i<6;i++){const item=h.posts()[i].body;saved=apply(saved,item);acks[i].resolve(response(receipt(item,saved,i+1)));await flush();}
  assert.equal(h.pending().length,0);assert.deepEqual(h.latest(),saved);assert.equal(h.observed.rollbacks.length,0);
});

test('offline upgrades survive reload and automatically replay the original targets and IDs without another debit',async t=>{
  const base=upgradeFixture();let saved=base,offline=true,revision=0;const ids=[];
  const handler=req=>{if(req.method==='GET')return response(snapshot(saved,revision));if(offline)throw new TypeError('offline');ids.push(req.body.operationId);saved=apply(saved,req.body);return response(receipt(req.body,saved,++revision));};
  const first=harness(t,handler,{state:base});await first.cloud.start();
  for(const action of [{type:'restaurant-upgrade',upgradeId:'fridge'},{type:'restaurant-train',workerId:'worker-1',statId:'endurance'},{type:'restaurant-recipe',recipeId:'rice'}])assert.equal(first.cloud.dispatch(action),true);
  await flush();const pending=clone(first.pending()),local=first.latest();first.cloud.destroy();t.mock.timers.reset();
  assert.equal(first.observed.rollbacks.length,0);assert.equal(first.observed.saves.at(-1).phase,'queued');
  const second=harness(t,handler,{state:base,pending});await second.cloud.start();await flush();
  assert.equal(second.latest().coins,local.coins);assert.equal(second.latest().restaurant.levels.fridge,2);assert.equal(second.latest().restaurant.staffTraining['worker-1'].levels.endurance,2);assert.equal(second.latest().restaurant.recipeLevels.rice,2);
  offline=false;t.mock.timers.tick(8000);await flush();
  assert.deepEqual(ids,pending.map(item=>item.operationId));assert.equal(second.pending().length,0);assert.equal(saved.coins,local.coins);assert.equal(saved.restaurant.levels.fridge,2);assert.equal(second.observed.rollbacks.length,0);assert.equal(second.observed.actions.filter(item=>item.optimistic).length,0,'reload does not repeat upgrade effects');
});

test('a state-only receipt cannot apply a queued upgrade twice or buy the following level after a partner conflict',async t=>{
  const base=upgradeFixture(),ack=deferred();let saved=base,revision=0;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved,revision)):ack.promise,{state:base});await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-upgrade',upgradeId:'kitchen'}),true);
  const item=h.posts()[0].body,localWallet=h.latest().coins;
  saved=apply(saved,item);revision=1;h.sources[0].emit('state',snapshot(saved,revision));
  assert.equal(h.latest().restaurant.levels.kitchen,2);assert.equal(h.latest().coins,localWallet);assert.equal(h.pending().length,1);
  assert.equal(reduceAction(saved,item.action,ACTOR,NOW+1000,'different-owner-operation'),null,'same desired target cannot purchase level 3');
  ack.resolve(response({error:{code:'RESTAURANT_ACTION_REJECTED',message:'伙伴已经升级了这项设施，本次未扣费'}},409));await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().restaurant.levels.kitchen,2);assert.equal(h.latest().coins,saved.coins);assert.equal(h.observed.rollbacks.length,1);assert.equal(h.observed.saves.at(-1).rejected,true);
});

test('a competing wallet snapshot and an authentication outage retain the optimistic purchase until explicit refusal',async t=>{
  const base=upgradeFixture();let saved=base,refuse=false;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved,1)):response({error:refuse?{code:'RESTAURANT_ACTION_REJECTED',message:'余额不足，本次未扣费'}:{code:'AUTH_UNAVAILABLE',message:'temporary authorization outage'}},refuse?409:403),{state:base});await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-upgrade',upgradeId:'kitchen'}),true);const local=clone(h.latest());await flush();
  assert.equal(h.pending().length,1);assert.equal(h.observed.rollbacks.length,0);
  saved={...clone(base),coins:0};h.sources[0].emit('state',snapshot(saved,2));
  assert.equal(h.latest().restaurant.levels.kitchen,2);assert.equal(h.latest().coins,local.coins,'only an explicit refusal corrects the local purchase');
  refuse=true;t.mock.timers.tick(8000);await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().restaurant.levels.kitchen,1);assert.equal(h.latest().coins,0);assert.equal(h.observed.rollbacks.length,1);
});

test('restaurant steps and home care keep each other when taps append to the same pending save queue',async t=>{
  const base=requested(),acks=Array.from({length:4},deferred);let saved=base,posts=0;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved)):acks[posts++].promise,{state:base});
  await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'}),true);
  assert.equal(h.cloud.dispatch({type:'pet'}),true);
  assert.equal(h.cloud.dispatch({type:'feed',food:'water'}),true);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}),true);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}),false);
  assert.equal(h.posts().length,1,'the first upload does not block local kitchen or home actions');
  assert.equal(h.latest().pendingGrowth.length,2);
  assert.equal(h.latest().coins,base.coins-5);
  assert.equal(h.latest().restaurant.orders[0].workflow.runs.length,1);
  for(let i=0;i<4;i++){
    const item=h.posts()[i].body;saved=apply(saved,item);
    acks[i].resolve(response(receipt(item,saved,i+1)));await flush();
  }
  assert.equal(h.pending().length,0);
  assert.deepEqual(h.latest(),saved);
  assert.equal(h.observed.rollbacks.length,0);
});

test('an exhausted operation hands off immediately in the optimistic queue without advancing to the first employee full-recovery clock',async t=>{
  let base=requested();base.restaurant.staff=1;
  Object.assign(base.restaurant.staffTraining['worker-1'],{energy:10,energyMode:'rest-room',rest:null});
  base.restaurant.staffTraining['worker-2']={...clone(base.restaurant.staffTraining['worker-1']),energy:100};
  base=reduceAction(base,{type:'restaurant-kitchen-accept',orderId:'table-1'},ACTOR,NOW);
  base=reduceAction(base,{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'},ACTOR,NOW);
  const first=clone(base.restaurant.orders[0].workflow.runs[0]),rest=clone(base.restaurant.staffTraining['worker-1'].rest),ack=deferred();let saved=base;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved)):ack.promise,{state:base});
  t.mock.timers.tick(first.endAt-NOW);await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'}),true);
  assert.equal(h.posts().length,1,'the POST waits only for the completed operation, not for its former employee recovery');
  const local=h.latest(),flow=local.restaurant.orders[0].workflow;
  assert.equal(flow.workerId,'worker-2');assert.equal(flow.runs[1].commandAt,first.endAt);assert.ok(Date.now()<rest.arriveAt);
  assert.equal(local.restaurant.staffTraining['worker-1'].energy,0);assert.deepEqual(local.restaurant.staffTraining['worker-1'].rest,rest);
  assert.equal(local.restaurant.staffTraining['worker-2'].energy,90);assert.ok(validRestaurant(local.restaurant));
  assert.equal(restaurantInfo(local,Date.now()).kitchen.workers[0].phase,'rest-walk');assert.equal(restaurantInfo(local,Date.now()).kitchen.workers[1].phase,'walk');
  t.mock.timers.tick(650);saved=apply(saved,h.posts()[0].body);ack.resolve(response(receipt(h.posts()[0].body,saved)));await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().restaurant.orders[0].workflow.workerId,'worker-2');
  assert.deepEqual(h.latest().restaurant.staffTraining['worker-1'].rest,rest);assert.equal(h.latest().restaurant.staffTraining['worker-2'].energy,90);
  assert.equal(h.observed.rollbacks.length,0);assert.equal(saved.restaurant.orders[0].workflow.runs[1].commandAt,first.endAt+650);
});

test('a restored pickup blocked by an unfinished dish cannot hold its delivery behind an indefinite worker reservation',async t=>{
  let base=requested('coffee',2),at=NOW;
  for(const order of base.restaurant.orders)base=apply(base,{...ACTOR,clientId:ACTOR.id,operationId:`accept-${order.id}`,action:{type:'restaurant-kitchen-accept',orderId:order.id}},at);
  for(const step of KITCHEN_FLOWS.coffee){
    base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:`seed-${step.id}`,action:{type:'restaurant-kitchen-step',orderId:'table-1',stepId:step.id}},at);
    at=base.restaurant.orders[0].workflow.runs.at(-1).endAt;
  }
  const intents=[
    {type:'restaurant-kitchen-step',orderId:'table-2',stepId:'gather'},
    {type:'restaurant-kitchen-step',orderId:'table-1',stepId:'delivery'},
  ];
  const pending=intents.map((action,index)=>({clientId:ACTOR.id,name:ACTOR.name,operationId:`restored-${index}`,action,restaurantPreviewAt:at}));
  let saved=base,revision=0;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved,revision));
    const next=reduceAction(saved,req.body.action,ACTOR,Date.now(),req.body.operationId);
    if(!next)return response({error:{code:'RESTAURANT_ACTION_REJECTED',message:'员工正忙，请等待空闲员工'}},409);
    saved=next;return response(receipt(req.body,saved,++revision));
  },{state:base,pending});
  t.mock.timers.tick(at-NOW);await h.cloud.start();await flush();
  assert.deepEqual(h.posts().map(req=>req.body.operationId),['restored-0','restored-1'],'only an explicit refusal releases the blocked pickup, then the original delivery is saved');
  assert.equal(h.pending().length,0);assert.ok(saved.restaurant.orders[0].workflow.servedAt);
  assert.equal(saved.restaurant.orders[1].workflow.runs.length,0);assert.equal(h.observed.rollbacks.length,1);
  assert.equal(h.observed.rollbacks[0].action.orderId,'table-2');assert.ok(validRestaurant(saved.restaurant));
  const returnAt=saved.restaurant.orders[0].workflow.completedAt;
  t.mock.timers.tick(returnAt-Date.now());
  assert.equal(h.cloud.dispatch(intents[0]),true);await flush();
  assert.equal(h.pending().length,0);assert.equal(saved.restaurant.orders[1].workflow.runs[0].stepId,'gather');
});

test('a pickup waiting for rest lets another queued dish deliver and release an employee before the recovery deadline',async t=>{
  let base=requested('coffee',2),at=NOW;
  base.restaurant.staff=1;
  base.restaurant.staffTraining['worker-2']={...clone(base.restaurant.staffTraining['worker-1']),energy:200};
  Object.assign(base.restaurant.staffTraining['worker-1'],{energy:1,energyMode:'rest-room',rest:null});
  const seed=(orderId,stepId)=>{base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:`seed-${orderId}-${stepId}`,action:{type:'restaurant-kitchen-step',orderId,stepId}},at);at=base.restaurant.orders.find(o=>o.id===orderId).workflow.runs.at(-1).endAt;};
  for(const o of base.restaurant.orders)base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:`accept-${o.id}`,action:{type:'restaurant-kitchen-accept',orderId:o.id}},at);
  seed('table-1','gather');
  for(const step of KITCHEN_FLOWS.coffee)seed('table-2',step.id);
  const fullAt=base.restaurant.staffTraining['worker-1'].rest.fullAt;
  assert.ok(at<fullAt);
  const pending=[
    {operationId:'waiting-handoff',action:{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'}},
    {operationId:'release-other-employee',action:{type:'restaurant-kitchen-step',orderId:'table-2',stepId:'delivery'}},
  ].map(item=>({...item,clientId:ACTOR.id,name:ACTOR.name,restaurantPreviewAt:at}));
  let saved=base,revision=0;
  const h=harness(t,req=>{if(req.method==='GET')return response(snapshot(saved,revision));saved=apply(saved,req.body);return response(receipt(req.body,saved,++revision));},{state:base,pending});
  t.mock.timers.tick(at-NOW);await h.cloud.start();await flush();
  assert.equal(h.posts()[0]?.body.operationId,'release-other-employee');
  for(let i=0;i<30&&h.pending().length;i++){t.mock.timers.tick(1000);await flush();}
  assert.equal(h.pending().length,0);assert.ok(Date.now()<fullAt);
  assert.deepEqual(h.posts().map(req=>req.body.operationId),['release-other-employee','waiting-handoff']);
  assert.equal(saved.restaurant.orders[0].workflow.workerId,'worker-2');assert.equal(h.observed.rollbacks.length,0);
  assert.equal(saved.restaurant.staffTraining['worker-1'].rest.fullAt,fullAt);assert.ok(validRestaurant(saved.restaurant));
});

test('an acknowledgement with an earlier real clock does not retain a future local exhaustion and replay its rest trip',async t=>{
  let base=requested();Object.assign(base.restaurant.staffTraining['worker-1'],{energy:1,energyMode:'rest-room',rest:null});
  base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:'accept',action:{type:'restaurant-kitchen-accept',orderId:'table-1'}},NOW);
  const ack=deferred();let saved=base;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved)):ack.promise,{state:base});await h.cloud.start();t.mock.timers.tick(5000);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}),true);
  const item=h.posts()[0].body;saved=apply(saved,item,NOW+4000);ack.resolve(response(receipt(item,saved,1)));await flush();
  assert.equal(h.latest().restaurant.orders[0].workflow.runs[0].commandAt,NOW+4000);
  assert.deepEqual(h.latest().restaurant.staffTraining['worker-1'].rest,saved.restaurant.staffTraining['worker-1'].rest);
  const fullAt=saved.restaurant.staffTraining['worker-1'].rest.fullAt;t.mock.timers.tick(fullAt-Date.now());
  assert.equal(restaurantInfo(h.latest(),Date.now()).kitchen.workers[0].phase,'rest-ready');
});

test('a real recovered energy ledger replaces a speculative exhausted trip instead of sending the worker to rest again',async t=>{
  let base=requested();Object.assign(base.restaurant.staffTraining['worker-1'],{energy:1,energyMode:'rest-room',rest:null});
  base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:'accept',action:{type:'restaurant-kitchen-accept',orderId:'table-1'}},NOW);
  const ack=deferred();let saved=clone(base);saved.restaurant.staffTraining['worker-1'].energy=100;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise,{state:base});await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}),true);
  assert.ok(h.latest().restaurant.staffTraining['worker-1'].rest);
  t.mock.timers.tick(650);const item=h.posts()[0].body;saved=apply(saved,item);ack.resolve(response(receipt(item,saved,1)));await flush();
  assert.equal(h.latest().restaurant.staffTraining['worker-1'].rest,null);
  assert.equal(h.latest().restaurant.orders[0].workflow.runs[0].durationMultiplier,1);
});

test('delayed receipts, concurrent dishes and exhausted handoffs finish without early next-step buttons or replaying a completed rest trip',async t=>{
  let base=requested('coffee',2);base.restaurant.stats.experience=levelStartXp(10);base.restaurant.staff=2;
  for(const id of ['worker-1','worker-2','worker-3'])base.restaurant.staffTraining[id]={...clone(base.restaurant.staffTraining['worker-1']),energy:id==='worker-2'?25:1,energyMode:'rest-room',rest:null};
  for(const order of base.restaurant.orders)base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:`accept-${order.id}`,action:{type:'restaurant-kitchen-accept',orderId:order.id}},NOW);
  let saved=base,revision=0;
  const h=harness(t,async req=>{
    if(req.method==='GET')return response(snapshot(saved,revision));
    await new Promise(resolve=>setTimeout(resolve,650));
    const next=reduceAction(saved,req.body.action,ACTOR,Date.now(),req.body.operationId);
    if(!next)return response({error:{code:'RESTAURANT_ACTION_REJECTED',message:'当前工序尚未就绪'}},409);
    saved=next;return response(receipt(req.body,saved,++revision));
  },{state:base});await h.cloud.start();
  const controller=createRestaurantAutoCook({getState:()=>normalizeState(h.latest(),Date.now()),getAvailability:()=>({ready:true,savePhase:h.observed.saves.at(-1)?.phase,saveRejected:h.observed.saves.at(-1)?.rejected,pendingKitchenSteps:h.pending().filter(i=>i.action.type==='restaurant-kitchen-step').map(i=>`${i.action.orderId}:${i.action.stepId}`)}),onAction:action=>h.cloud.dispatch(action),preferences:{getItem:()=> '1'}});
  const completedRest=new Map();
  for(let i=0;i<6000;i++){
    controller.tick();t.mock.timers.tick(250);await flush();
    const info=restaurantInfo(h.latest(),Date.now());
    for(const order of info.kitchen.orders)if(order.nextStep){const actual=info.restaurant.orders.find(o=>o.id===order.id);assert.ok((actual.workflow.runs.at(-1)?.endAt??0)<=Date.now(),'no next button before the already queued run finishes');}
    for(const worker of info.kitchen.workers){
      const rest=info.restaurant.staffTraining[worker.id].rest;
      if(!rest)continue;
      if(worker.phase==='rest-ready')completedRest.set(worker.id,rest.departAt);
      assert.ok(!(worker.phase==='rest-walk'&&completedRest.get(worker.id)===rest.departAt),'a completed rest journey must not replay');
    }
    if(!h.pending().length&&saved.restaurant.orders.every(o=>o.workflow.completedAt!==null&&o.workflow.completedAt<=Date.now()))break;
  }
  assert.equal(h.pending().length,0);assert.ok(saved.restaurant.orders.every(o=>o.workflow.servedAt!==null));assert.ok(validRestaurant(saved.restaurant));
  for(const order of saved.restaurant.orders)assert.deepEqual(order.workflow.runs.map(run=>run.stepId),[...KITCHEN_FLOWS.coffee.map(step=>step.id),'delivery']);
});

test('a funded research draw bypasses a kitchen recovery timer, waits for the real card and preserves the cooking intent',async t=>{
  let base=requested();Object.assign(base.restaurant.staffTraining['worker-1'],{energy:1,energyMode:'rest-room',rest:null});
  for(const action of [{type:'restaurant-kitchen-accept',orderId:'table-1'},{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}])base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:action.type,action},NOW);
  const run=base.restaurant.orders[0].workflow.runs[0],pending=[{operationId:'original-rest-handoff',clientId:ACTOR.id,name:ACTOR.name,action:{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'},restaurantPreviewAt:run.endAt}];
  let saved=base;const ack=deferred();
  const h=harness(t,async req=>{if(req.method==='GET')return response(snapshot(saved));await ack.promise;saved=apply(saved,req.body);return response(receipt(req.body,saved,1));},{state:base,pending});
  t.mock.timers.tick(run.endAt-NOW);await h.cloud.start();await flush();assert.equal(h.posts().length,0);
  assert.equal(h.cloud.dispatch({type:'restaurant-research-draw',draw:1}),true);
  assert.equal(h.posts().length,1,'the draw starts immediately rather than waiting for rest or the dependency timer');
  assert.equal(h.posts()[0].body.action.type,'restaurant-research-draw');assert.equal(h.latest().restaurant.research.draws,0);
  ack.resolve();await flush();assert.equal(h.latest().restaurant.research.draws,1);assert.equal(h.latest().restaurant.research.fragments.rice,3);
  assert.deepEqual(h.pending().map(item=>item.operationId),['original-rest-handoff']);assert.equal(h.pending()[0].action.stepId,'espresso');
  assert.ok(Date.now()<run.rest.fullAt);assert.equal(h.observed.rollbacks.length,0);
});

test('research never overtakes a queued recipe upgrade that changes the requested card quality',async t=>{
  let base=requested();base.restaurant.stats.experience=levelStartXp(10);base.coins=50000;
  base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:'first-card',action:{type:'restaurant-research-draw',draw:1}},NOW);
  Object.assign(base.restaurant.staffTraining['worker-1'],{energy:1,energyMode:'rest-room',rest:null});
  for(const action of [{type:'restaurant-kitchen-accept',orderId:'table-1'},{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}])base=apply(base,{clientId:ACTOR.id,name:ACTOR.name,operationId:action.type,action},NOW);
  const run=base.restaurant.orders[0].workflow.runs[0],pending=[{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'},{type:'restaurant-recipe',recipeId:'rice',expectedLevel:2}].map((action,index)=>({operationId:`keep-order-${index}`,clientId:ACTOR.id,name:ACTOR.name,action,restaurantPreviewAt:run.endAt}));
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):assert.fail('the recipe prerequisite must keep its place'),{state:base,pending});
  t.mock.timers.tick(run.endAt-NOW);await h.cloud.start();await flush();
  assert.equal(h.cloud.dispatch({type:'restaurant-research-draw',draw:2}),true);await flush();
  assert.equal(h.posts().length,0);assert.deepEqual(h.pending().map(item=>item.action.type),['restaurant-kitchen-step','restaurant-recipe','restaurant-research-draw']);
});

test('a research draw waits for the real card and ignores duplicate queued taps',async t=>{
  const base=initialState(NOW),ack=deferred();let saved=base;
  const h=harness(t,async req=>{
    if(req.method==='GET')return response(snapshot(saved));
    await ack.promise;saved=apply(saved,req.body);return response(receipt(req.body,saved));
  },{state:base});
  await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-research-draw',draw:1}),true);
  assert.equal(h.cloud.dispatch({type:'restaurant-research-draw',draw:1}),false);
  assert.equal(h.latest().restaurant.research.draws,0,'no speculative random card appears before the server receipt');
  ack.resolve();await flush();
  assert.equal(h.posts().length,1);assert.equal(h.latest().restaurant.research.draws,1);
  assert.equal(h.latest().restaurant.research.fragments.rice,3);assert.equal(h.pending().length,0);
});

test('fragment fusion reserves its shards and inspiration immediately and ignores repeated queued conversions',async t=>{
  const base=restaurantResearchDebugResult(initialState(NOW),{mode:'research-fusion'},NOW).state,ack=deferred();let saved=base;
  const h=harness(t,async req=>{if(req.method==='GET')return response(snapshot(saved));await ack.promise;saved=apply(saved,req.body);return response(receipt(req.body,saved));},{state:base});
  await h.cloud.start();const action={type:'restaurant-research-fuse',recipeId:'cocoa',amount:5,expectedFragments:5,expectedFusion:0};
  assert.equal(h.cloud.dispatch(action),true);assert.equal(h.cloud.dispatch(action),false);
  assert.equal(h.latest().restaurant.research.fragments.cocoa,0);assert.equal(h.latest().restaurant.research.inspirationEarned,base.restaurant.research.inspirationEarned+25);
  ack.resolve();await flush();assert.equal(h.posts().length,1);assert.equal(h.latest().restaurant.research.fragments.cocoa,0);
  assert.equal(h.latest().restaurant.research.inspirationEarned,base.restaurant.research.inspirationEarned+25);assert.equal(h.pending().length,0);
});

test('a first-course collection waits for its canonical next ID while other existing orders still preview',async t=>{
  let base=restaurantGuestDebugResult(initialState(NOW-3600000),{mode:'guest',guestId:'guest-dawn-duke'},NOW-3600000).state;
  base=prepareRestaurantMealForCollection(base,'table-1',ACTOR).state;
  base.restaurant.levels.tables=2;
  base=reduceAction(base,{type:'restaurant-arrive',partySize:1,recipeId:'coffee'},ACTOR,NOW-6000);
  assert.ok(base);assert.equal(restaurantInfo(base,NOW).orders.find(order=>order.id==='table-1').status,'collectible');
  const ack=deferred();let saved=base,revision=0,posts=0;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved,revision));
    if(posts++===0)return ack.promise;
    saved=apply(saved,req.body);return response(receipt(req.body,saved,++revision));
  },{state:base});await h.cloud.start();
  const collect={type:'restaurant-collect',orderId:'table-1'};
  assert.equal(h.cloud.dispatch(collect),true);assert.equal(h.cloud.dispatch(collect),true,'a repeat tap joins the original collection without reporting a save failure');
  assert.equal(h.pending().filter(item=>item.action.type==='restaurant-collect').length,1);
  assert.equal(h.latest().restaurant.nextOrderId,3);assert.equal(h.latest().coins,base.coins);assert.equal(h.latest().goldFish,base.goldFish);
  assert.equal(h.latest().restaurant.parties[0].members[0].service.round,1,'no guessed next-course ID enters the display');
  assert.match(tableView(h),/正在看菜单…/);assert.match(tableView(h),/role="progressbar"/);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-3'}),false,'a speculative new ID cannot be clicked');
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-2'}),true);
  assert.equal(h.latest().restaurant.orders.find(order=>order.id==='table-2').workflow.acceptedAt,NOW);
  saved=reduceAction(saved,{type:'restaurant-arrive',partySize:1,recipeId:'donut'},{id:'other-owner',name:'伙伴'},NOW);
  assert.ok(saved);assert.equal(saved.restaurant.nextOrderId,4);
  saved=apply(saved,h.posts()[0].body);assert.equal(saved.restaurant.parties[0].members[0].orderId,'table-4');
  ack.resolve(response(receipt(h.posts()[0].body,saved,++revision)));await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().restaurant.parties[0].members[0].orderId,'table-4');
  assert.doesNotMatch(tableView(h),/is-course-thinking/);assert.match(tableView(h),/data-r-action="kitchen-accept" data-r-order-id="table-4"/);
  assert.equal(h.latest().restaurant.orders.find(order=>order.id==='table-2').workflow.acceptedAt,NOW);
  assert.equal(h.latest().restaurant.stats.served,1);assert.equal(h.latest().goldFish,base.goldFish);assert.equal(h.observed.rollbacks.length,0);
});

test('restoring a queued first-course collection never invents another order or an early completion bonus',async t=>{
  const fixture=restaurantGuestDebugResult(initialState(NOW-3600000),{mode:'guest',guestId:'guest-dawn-duke'},NOW-3600000).state;
  const base=prepareRestaurantMealForCollection(fixture,'table-1',ACTOR).state;
  const pending=[{operationId:'restore-first-course',clientId:ACTOR.id,name:ACTOR.name,action:{type:'restaurant-collect',orderId:'table-1'},restaurantPreviewAt:NOW}];
  let offline=true,saved=base;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved));
    if(offline)throw new TypeError('offline');
    saved=apply(saved,req.body);return response(receipt(req.body,saved));
  },{state:base,pending});await h.cloud.start();await flush();
  assert.equal(h.latest().restaurant.nextOrderId,2);assert.equal(h.latest().restaurant.parties[0].members[0].service.round,1);
  assert.equal(h.latest().coins,base.coins);assert.equal(h.latest().goldFish,base.goldFish);assert.equal(h.pending().length,1);
  assert.match(tableView(h),/正在看菜单…/);assert.match(tableView(h),/aria-busy="true"/);
  offline=false;t.mock.timers.tick(8000);await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().restaurant.nextOrderId,3);assert.equal(h.latest().restaurant.parties[0].members[0].service.round,2);
  assert.doesNotMatch(tableView(h),/is-course-thinking|rg-menu-progress/);assert.match(tableView(h),/data-r-action="kitchen-accept" data-r-order-id="table-2"/);
  assert.equal(h.latest().restaurant.parties[0].members[0].service.history.length,1);assert.equal(h.latest().goldFish,base.goldFish);
  assert.ok(h.posts().every(req=>req.body.operationId==='restore-first-course'));assert.equal(h.observed.actions.filter(action=>action.optimistic).length,0);
});

test('an existing order responds before HTTP, queues other orders, and persists only local preview timing off the wire',async t=>{
  const base=requested('coffee',2),acks=[deferred(),deferred()];let posts=0;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):acks[posts++].promise,{state:base});
  assert.equal(h.cloud.isReady(),false);assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'}),false);
  await h.cloud.start();assert.equal(h.cloud.isReady(),true);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'}),true);
  assert.equal(h.latest().restaurant.orders[0].workflow.acceptedAt,NOW);assert.equal(h.observed.states.at(-1).confirmedState.restaurant.orders[0].workflow.acceptedAt,null);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-2'}),true);assert.equal(h.latest().restaurant.orders[1].workflow.acceptedAt,NOW);
  assert.equal(h.posts().length,1);assert.equal(h.pending().length,2);assert.ok(h.pending().every(item=>item.restaurantPreviewAt===NOW));
  assert.deepEqual(Object.keys(h.posts()[0].body).sort(),['action','clientId','name','operationId']);
  assert.equal(h.cloud.getPendingActions().length,2);const copied=h.cloud.getPendingActions();copied.pop();assert.equal(h.cloud.getPendingActions().length,2);
  let saved=apply(base,h.posts()[0].body);acks[0].resolve(response(receipt(h.posts()[0].body,saved)));await flush();
  assert.equal(h.posts().length,2);saved=apply(saved,h.posts()[1].body);acks[1].resolve(response(receipt(h.posts()[1].body,saved,2)));await flush();
  assert.equal(h.pending().length,0);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.actions.filter(action=>action.optimistic).length,2);
});

test('a 650ms authoritative start delay preserves the local animation and waits before posting the already-clicked next step',async t=>{
  const base=requested(),ack=deferred();let saved=base,revision=0,posts=0;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved,revision));
    if(posts++===0)return ack.promise;
    saved=apply(saved,req.body);return response(receipt(req.body,saved,++revision));
  },{state:base});await h.cloud.start();
  h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'});
  const localEnd=h.latest().restaurant.orders[0].workflow.runs[0].endAt;
  t.mock.timers.tick(650);saved=apply(base,h.posts()[0].body);ack.resolve(response(receipt(h.posts()[0].body,saved,++revision)));await flush();
  const actualEnd=saved.restaurant.orders[0].workflow.runs[0].endAt;assert.equal(actualEnd,localEnd+650);
  assert.equal(h.latest().restaurant.orders[0].workflow.runs[0].endAt,localEnd,'the acknowledged receipt does not rewind the displayed walk');
  t.mock.timers.tick(localEnd-Date.now());assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'}),true);
  const nextId=h.pending()[0].operationId;assert.equal(h.latest().restaurant.orders[0].workflow.runs[1].commandAt,localEnd);assert.equal(h.posts().length,2);
  assert.equal(h.observed.saves.at(-1).phase,'queued');assert.equal(h.observed.saves.at(-1).retrying,false);assert.equal(h.observed.rollbacks.length,0);
  t.mock.timers.tick(649);await flush();assert.equal(h.posts().length,2,'no premature POST can get a timing refusal');
  t.mock.timers.tick(26);await flush();assert.equal(h.posts().length,3);assert.equal(h.posts()[2].body.operationId,nextId);
  assert.ok(saved.restaurant.orders[0].workflow.runs[1].commandAt>=actualEnd);assert.equal(h.pending().length,0);assert.equal(h.observed.rollbacks.length,0);
  assert.equal(h.latest().restaurant.orders[0].workflow.runs[1].commandAt,localEnd);
});

for(const kind of ['network','timeout','503','429','uncertain-409'])test(`${kind} retains the restaurant preview and original operation ID for an automatic retry`,async t=>{
  const base=requested();let attempts=0,saved=base,revision=0;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved,revision));
    if(++attempts===1){if(kind==='network')throw new TypeError('offline');if(kind==='timeout')return new Promise((yes,no)=>req.signal.addEventListener('abort',()=>no(new Error('aborted'))));return response({error:{code:kind==='uncertain-409'?'STORAGE_CONFLICT':'STORAGE_UNAVAILABLE',message:'暂时未确认'}},kind==='uncertain-409'?409:Number(kind));}
    saved=apply(saved,req.body);return response(receipt(req.body,saved,++revision));
  },{state:base});await h.cloud.start();h.sources[0].fail();assert.equal(h.cloud.isReady(),true);
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'}),true);const original=clone(h.posts()[0].body);
  if(kind==='timeout')t.mock.timers.tick(15000);await flush();
  assert.equal(h.latest().restaurant.orders[0].workflow.acceptedAt,NOW);assert.equal(h.pending().length,1);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.saves.at(-1).phase,'queued');assert.equal(h.observed.saves.at(-1).retrying,true);
  t.mock.timers.tick(8000);await flush();assert.equal(attempts,2);assert.deepEqual(h.posts()[1].body,original);assert.equal(h.pending().length,0);assert.equal(h.observed.saves.at(-1).phase,'saved');assert.equal(h.observed.actions.filter(action=>action.optimistic).length,1);
});

test('a malformed success cannot erase the queued action or its preview',async t=>{
  const base=requested(),h=harness(t,req=>req.method==='GET'?response(snapshot(base)):response({state:null,revision:1}),{state:base});await h.cloud.start();h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});await flush();
  assert.equal(h.pending().length,1);assert.equal(h.latest().restaurant.orders[0].workflow.acceptedAt,NOW);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.saves.at(-1).phase,'queued');
});

test('an explicit business refusal is the only failure that removes and rolls back a restaurant preview',async t=>{
  const base=requested(),h=harness(t,req=>req.method==='GET'?response(snapshot(base)):response({error:{code:'RESTAURANT_ACTION_REJECTED',message:'这份订单已被伙伴取消。'}},409),{state:base});await h.cloud.start();h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().restaurant.orders[0].workflow.acceptedAt,null);assert.equal(h.observed.rollbacks.length,1);assert.equal(h.observed.rollbacks[0].reason,'rejected');assert.equal(h.observed.saves.at(-1).phase,'error');
  const count=h.posts().length;t.mock.timers.tick(8000);await flush();assert.equal(h.posts().length,count);
});

test('a state-only snapshot that moves a dependency later cannot withdraw the next local step',async t=>{
  const base=requested(),pending=deferred();const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):pending.promise,{state:base});await h.cloud.start();
  h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'});const localEnd=h.latest().restaurant.orders[0].workflow.runs[0].endAt;
  t.mock.timers.tick(localEnd-NOW);assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'}),true);
  let later=reduceAction(base,{type:'restaurant-kitchen-accept',orderId:'table-1'},ACTOR,NOW+650,'later-accept');later=reduceAction(later,{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'},ACTOR,NOW+650,'later-gather');
  h.sources[0].emit('state',snapshot(later,2));assert.equal(h.pending().length,3);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.latest().restaurant.orders[0].workflow.runs[1].stepId,'espresso');
  assert.ok(h.latest().restaurant.orders[0].workflow.runs[1].commandAt>=later.restaurant.orders[0].workflow.runs[0].endAt);
});

test('reload restores restaurant previews and replays only original IDs, respecting every authoritative processing interval',async t=>{
  const base=requested(),restoreAt=NOW+10000,items=[
    {operationId:'restore-kitchen-accept',clientId:ACTOR.id,name:ACTOR.name,action:{type:'restaurant-kitchen-accept',orderId:'table-1'},restaurantPreviewAt:NOW},
    {operationId:'restore-kitchen-gather',clientId:ACTOR.id,name:ACTOR.name,action:{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'},restaurantPreviewAt:NOW},
    {operationId:'restore-kitchen-espresso',clientId:ACTOR.id,name:ACTOR.name,action:{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'},restaurantPreviewAt:restoreAt},
  ];let saved=base,revision=0;
  const h=harness(t,req=>{if(req.method==='GET')return response(snapshot(saved,revision));saved=apply(saved,req.body);return response(receipt(req.body,saved,++revision));},{state:base,pending:items});
  await h.cloud.start();await flush();assert.equal(h.posts().length,2);assert.equal(h.pending().length,1);assert.equal(h.latest().restaurant.orders[0].workflow.runs[1].stepId,'espresso');
  const end=saved.restaurant.orders[0].workflow.runs[0].endAt;t.mock.timers.tick(end-Date.now()+25);await flush();assert.equal(h.posts().length,3);assert.equal(h.pending().length,0);assert.deepEqual(h.posts().map(req=>req.body.operationId),items.map(item=>item.operationId));
  assert.ok(saved.restaurant.orders[0].workflow.runs[1].commandAt>=end);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.actions.filter(action=>action.optimistic).length,0,'reload never replays click animations');
});

test('a durable SSE receipt drains a restaurant action once even if its HTTP acknowledgement times out',async t=>{
  const base=requested(),h=harness(t,req=>req.method==='GET'?response(snapshot(base)):new Promise((yes,no)=>req.signal.addEventListener('abort',()=>no(new Error('lost HTTP')))),{state:base});await h.cloud.start();h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});
  const item=h.posts()[0].body,saved=apply(base,item),data=receipt(item,saved);h.sources[0].emit('action',data);h.sources[0].emit('action',data);await flush();assert.equal(h.pending().length,0);
  t.mock.timers.tick(15000);await flush();assert.equal(h.posts().length,1);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.actions.filter(action=>!action.optimistic).length,1);
});

test('all twenty-one complete dishes can be clicked offline and replay in order without skipping real server processing or awarding twice',async t=>{
  for(const recipeId of ['rice','coffee','sandwich','lemontea','donut','pancake','pudding','matcha','burger','udon','waffle','strawberrymilk','gold-salmon','sushi','pizza','grape','parfait','gold-sundae','cheesecake','gold-latte','cocoa'])await t.test(recipeId,async t=>{
    const base=requested(recipeId);let saved=base,revision=0,offline=true;const committed=[];
    const h=harness(t,req=>{
      if(req.method==='GET')return response(snapshot(saved,revision));
      if(offline)throw new TypeError('offline');
      saved=apply(saved,req.body);committed.push(clone(req.body));return response(receipt(req.body,saved,++revision));
    },{state:base});await h.cloud.start();h.sources[0].fail();
    assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'}),true);await flush();
    for(const step of KITCHEN_FLOWS[recipeId]){
      assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:step.id}),true);
      const run=h.latest().restaurant.orders[0].workflow.runs.at(-1);t.mock.timers.tick((run.rest?.fullAt??run.endAt)-Date.now());await flush();
    }
    assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'delivery'}),true);
    const delivered=h.latest().restaurant.orders[0].workflow;t.mock.timers.tick(delivered.servedAt+4500-Date.now());await flush();
    assert.equal(h.cloud.dispatch({type:'restaurant-collect',orderId:'table-1'}),true);
    const expected=clone(h.pending()),localWallet=h.latest().coins,localXp=h.latest().xp;
    assert.equal(expected.length,KITCHEN_FLOWS[recipeId].length+3);assert.equal(h.latest().restaurant.orders.length,0);assert.equal(saved.coins,base.coins);assert.equal(saved.xp,base.xp);
    const reconnectAt=Date.now();offline=false;assert.equal(h.cloud.retryPending(),true);await flush();
    for(let attempts=0;h.pending().length&&attempts<40;attempts++){
      const order=saved.restaurant.orders[0],run=order?.workflow.runs.at(-1),action=h.pending()[0].action;
      const nextAt=action.type==='restaurant-collect'?order.workflow.servedAt+4500:run?.rest?.fullAt??run?.endAt??Date.now();
      t.mock.timers.tick(Math.max(26,nextAt-Date.now()+26));await flush();
    }
    assert.equal(h.pending().length,0);assert.deepEqual(committed.map(item=>item.operationId),expected.map(item=>item.operationId));
    assert.equal(saved.coins,localWallet);assert.equal(saved.xp,localXp);assert.equal(saved.xp,base.xp);assert.equal(saved.pendingGrowth.length,1);assert.equal(saved.pendingGrowth[0].amount,restaurantRecipe(recipeId).xp+2*((restaurantRecipe(recipeId).baseLevel??1)-1));assert.equal(saved.restaurant.stats.served,1);assert.equal(validRestaurant(saved.restaurant),true);assert.equal(saved.restaurant.orders.length,0);
    assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.saves.at(-1).phase,'saved');
    assert.ok(saved.updatedAt>=reconnectAt);assert.ok(committed.every(item=>!Object.hasOwn(item,'restaurantPreviewAt')));
  });
});

test('an uncertain write which already committed is retried with the same ID and confirms once',async t=>{
  const base=requested();let saved=base,attempts=0,first;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved,first?1:0));
    if(++attempts===1){first=clone(req.body);saved=apply(saved,req.body);throw new TypeError('response lost after durable write');}
    assert.deepEqual(req.body,first);return response({...receipt(first,saved),duplicate:true});
  },{state:base});await h.cloud.start();h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});await flush();assert.equal(h.pending().length,1);
  t.mock.timers.tick(8000);await flush();assert.equal(h.pending().length,0);assert.equal(attempts,2);assert.equal(h.observed.actions.filter(action=>!action.optimistic).length,1);assert.equal(h.observed.rollbacks.length,0);
});

test('foreign-room snapshots and receipts cannot replace this home or erase its pending intent',async t=>{
  const base=requested(),foreign={...snapshot(initialState(NOW),20),roomId:'a'.repeat(32)};
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):response(foreign),{state:base});await h.cloud.start();h.cloud.dispatch({type:'restaurant-kitchen-accept',orderId:'table-1'});await flush();
  h.sources[0].emit('state',foreign);assert.equal(h.pending().length,1);assert.equal(h.latest().restaurant.orders[0].workflow.acceptedAt,NOW);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.states.at(-1).confirmedState.restaurant.orders[0].workflow.acceptedAt,null);
});

test('real demo business and simulated explicit refusals both settle instead of retrying forever',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:NOW});
  const {demoEngine,demoFetch,DEMO_ORIGIN}=await import('../demo/transport.js');
  const {DEMO_ROOM,DEMO_ACTORS}=await import('../demo/engine.js');
  const originalControls=clone(demoEngine.controls);
  t.after(()=>Object.assign(demoEngine.controls,originalControls));
  for(const kind of ['DEMO_ACTION_REJECTED','DEMO_REJECTED']){
    demoEngine.reset();Object.assign(demoEngine.controls,{latency:0,offline:false,rejectNext:false,partnerOnline:false});
    const arrival=demoEngine.action({operationId:`demo-queue-seed-${kind}`,clientId:DEMO_ACTORS.male.id,name:DEMO_ACTORS.male.name,action:{type:'restaurant-arrive',partySize:1,recipeId:'coffee'}});assert.equal(arrival.status,200);
    const orderId=arrival.data.state.restaurant.orders[0].id;t.mock.timers.tick(6000);
    const observed={states:[],rollbacks:[],pending:[],saves:[]};
    const cloud=createCloudRoom({apiBase:DEMO_ORIGIN,roomId:DEMO_ROOM,coupleRole:'male',fetchImpl:demoFetch,eventSourceFactory:()=>({addEventListener(){},close(){}}),optimisticReducer:reduceAction,
      onRoom(){},onPresence(){},onStatus(){},onAction(){},onState:state=>observed.states.push(clone(state)),onPending:queue=>observed.pending.push(clone(queue)),onSaveStatus:status=>observed.saves.push(clone(status)),onRollback:(action,actor,meta)=>observed.rollbacks.push(clone(meta)),
    });t.after(()=>cloud.destroy());
    const starting=cloud.start();t.mock.timers.tick(35);await starting;
    if(kind==='DEMO_ACTION_REJECTED')demoEngine.scenario('new-home');else demoEngine.controls.rejectNext=true;
    assert.equal(cloud.dispatch({type:'restaurant-kitchen-accept',orderId}),true);
    assert.ok(observed.states.at(-1).restaurant.orders[0].workflow.acceptedAt!==null);
    for(const delay of [0,35,35,35]){t.mock.timers.tick(delay);await flush();}
    assert.equal(observed.pending.at(-1).length,0);assert.equal(observed.rollbacks.length,1);assert.equal(observed.rollbacks[0].code,kind);assert.equal(observed.saves.at(-1).phase,'error');
    assert.equal(kind==='DEMO_ACTION_REJECTED'?observed.states.at(-1).restaurant.orders.length:observed.states.at(-1).restaurant.orders[0].workflow.acceptedAt,kind==='DEMO_ACTION_REJECTED'?0:null);
    const count=demoEngine.logs.filter(log=>log.method==='POST').length;t.mock.timers.tick(8000);await flush();assert.equal(demoEngine.logs.filter(log=>log.method==='POST').length,count);
    cloud.destroy();
  }
});

test('a post-idle click immediately previews the refilled ledger and keeps its progress clock after delayed acknowledgement',async t=>{
  let base=requested();Object.assign(base.restaurant.staffTraining['worker-1'],{energy:40,energyMode:'rest-room',rest:null});
  base=reduceAction(base,{type:'restaurant-kitchen-accept',orderId:'table-1'},ACTOR,NOW);
  base=reduceAction(base,{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'},ACTOR,NOW);
  const first=clone(base.restaurant.orders[0].workflow.runs[0]),at=restaurantStaffIdleAt(base.restaurant),ack=deferred();let saved=base;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved)):ack.promise,{state:base});
  t.mock.timers.tick(at-NOW);await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'espresso'}),true);
  assert.equal(h.posts().length,1);
  const local=h.latest(),run=local.restaurant.orders[0].workflow.runs[1];
  assert.equal(run.commandAt,at);assert.equal(run.energyBefore,200);assert.equal(run.energyAfter,190);assert.equal(run.idleRecoveryAt,at);assert.ok(validRestaurant(local.restaurant));
  t.mock.timers.tick(650);saved=apply(saved,h.posts()[0].body);ack.resolve(response(receipt(h.posts()[0].body,saved)));await flush();
  assert.equal(h.pending().length,0);assert.equal(h.observed.rollbacks.length,0);
  assert.equal(h.latest().restaurant.staffTraining['worker-1'].energy,190);
  assert.equal(h.latest().restaurant.orders[0].workflow.runs[1].commandAt,at,'the ring keeps the click time instead of jumping to the receipt');
  assert.deepEqual(h.latest().restaurant.orders[0].workflow.runs[0],first);
  assert.ok(validRestaurant(h.latest().restaurant));
});

test('daily gifts wait for durable currency, retain their ID after an unknown response and suppress repeated taps',async t=>{
  const base=initialState(NOW);let saved=base,lose=true;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved));
    if(lose){lose=false;throw new Error('offline');}
    saved=apply(saved,req.body);return response(receipt(req.body,saved));
  },{state:base});
  await h.cloud.start();
  const action={type:'restaurant-daily-login',day:Math.floor((NOW+8*3600000)/86400000)};
  assert.equal(h.cloud.dispatch(action),true);assert.equal(h.cloud.dispatch(action),false);await flush();
  const operationId=h.pending()[0].operationId;
  assert.equal(h.latest().coins,base.coins,'no optimistic currency for a gift');assert.equal(h.pending().length,1);
  assert.equal(h.cloud.dispatch({type:'pet'}),true,'the gift only locks its own button');
  t.mock.timers.tick(8000);await flush();
  assert.equal(h.posts()[1].body.operationId,operationId);assert.equal(saved.coins,base.coins+300);
  assert.equal(h.pending().length,0);assert.equal(h.observed.rollbacks.length,0);
});

test('a partner claiming the daily gift first reconciles from the saved receipt without a false save failure',async t=>{
  const base=initialState(NOW),action={type:'restaurant-daily-login',day:Math.floor((NOW+8*3600000)/86400000)};
  let saved=base;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved,1));
    saved=reduceAction(saved,action,{id:'daily-partner-two',name:'另一位主人'},NOW,'daily-partner-operation');
    return response({error:'今天已领取',code:'RESTAURANT_ACTION_REJECTED'},409);
  },{state:base});
  await h.cloud.start();assert.equal(h.cloud.dispatch(action),true);await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().coins,base.coins+300);
  assert.equal(h.observed.saves.some(s=>s.phase==='error'),false);assert.equal(h.observed.rollbacks.length,0);
});

test('a saved gift restored with its queued operation drains once after reload',async t=>{
  const action={type:'restaurant-daily-login',day:Math.floor((NOW+8*3600000)/86400000)},base=initialState(NOW);
  const item={operationId:'daily-restored-operation',clientId:ACTOR.id,name:ACTOR.name,action},saved=apply(base,item,NOW);
  const h=harness(t,req=>response(req.method==='GET'?snapshot(saved):{...receipt(item,saved),duplicate:true}),{state:base,pending:[item]});
  await h.cloud.start();await flush();assert.equal(h.pending().length,0);assert.equal(h.latest().coins,base.coins+300);
  assert.equal(h.posts().length,1);assert.equal(h.posts()[0].body.operationId,item.operationId);
});

function finalCollectionFixture(kind='ordinary'){
  let base=initialState(NOW-3600000);base.coins=2000;
  if(kind==='ordinary'){
    base=reduceAction(base,{type:'restaurant-arrive',partySize:2,recipeId:'coffee'},ACTOR,NOW-3600000);
    assert.equal(base.restaurant.parties[0].members.length,2);
    const firstId=base.restaurant.parties[0].members[0].orderId,secondId=base.restaurant.parties[0].members[1].orderId;
    const first=prepareRestaurantMealForCollection(base,firstId,ACTOR);base=first.state;
    base.updatedAt=first.at+60000; // Let the sole chef finish the return walk before the companion meal.
    const second=prepareRestaurantMealForCollection(base,secondId,ACTOR);
    base=reduceAction(second.state,{type:'restaurant-collect',orderId:firstId},ACTOR,second.at,'paid-companion-original');
    assert.equal(base.restaurant.parties.length,1);assert.equal(base.restaurant.orders.length,1);
  }else{
    base=restaurantGuestDebugResult(base,{mode:'guest',guestId:kind==='silver'?'guest-baker':'guest-dawn-duke'},NOW-3600000).state;
    const first=prepareRestaurantMealForCollection(base,'table-1',ACTOR);
    base=reduceAction(first.state,{type:'restaurant-collect',orderId:first.order.id},ACTOR,first.at,'first-course-original');
    base=prepareRestaurantMealForCollection(base,base.restaurant.orders[0].id,ACTOR).state;
  }
  assert.ok(base.updatedAt<NOW);assert.ok(validRestaurant(base.restaurant));
  const order=restaurantInfo(base,NOW).orders[0];assert.equal(order.status,'collectible');assert.equal(order.hasNextCourse,false);
  return {base,order};
}

for(const kind of ['ordinary','silver','gold'])test(`${kind} final collection joins repeated taps and survives a lost response without duplicate currency or departure`,async t=>{
  const {base,order}=finalCollectionFixture(kind),ack=deferred();let saved=base,posts=0;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved));
    if(posts++===0)return ack.promise;
    saved=apply(saved,req.body);return response(receipt(req.body,saved));
  },{state:base});await h.cloud.start();
  const action={type:'restaurant-collect',orderId:order.id};
  assert.equal(h.cloud.dispatch(action),true);const original=clone(h.pending()[0]);
  for(let i=0;i<20;i++)assert.equal(h.cloud.dispatch(action),true);
  assert.equal(h.pending().length,1);assert.equal(h.posts().length,1);
  assert.equal(h.latest().coins,base.coins+order.rewardCoins);assert.equal(h.latest().goldFish,base.goldFish+order.rewardGold);
  assert.equal(h.latest().restaurant.orders.length,0);assert.equal(h.latest().restaurant.parties.length,0);
  ack.reject(new TypeError('connection lost'));await flush();
  assert.equal(h.cloud.dispatch(action),true);assert.equal(h.pending()[0].operationId,original.operationId);
  assert.equal(h.observed.saves.at(-1).phase,'queued');assert.equal(h.observed.rollbacks.length,0);
  t.mock.timers.tick(8000);await flush();
  assert.equal(h.pending().length,0);assert.equal(saved.coins,base.coins+order.rewardCoins);assert.equal(saved.goldFish,base.goldFish+order.rewardGold);
  assert.equal(saved.restaurant.stats.served,base.restaurant.stats.served+1);
  assert.equal(saved.pendingGrowth.filter(reward=>reward.id===original.operationId).length,1);
  assert.ok(h.posts().every(req=>req.body.operationId===original.operationId));
});

test('a pending final bill stays busy after a competing snapshot and re-enables only after explicit refusal',async t=>{
  const {base,order}=finalCollectionFixture(),ack=deferred();let saved=base;
  const h=harness(t,req=>req.method==='GET'?response(snapshot(saved,2)):ack.promise,{state:base});await h.cloud.start();
  const action={type:'restaurant-collect',orderId:order.id};assert.equal(h.cloud.dispatch(action),true);
  saved=clone(base);saved.coins=999990;
  h.sources[0].emit('state',snapshot(saved,2));
  const html=tableView(h);assert.match(html,/正在收款…/);assert.match(html,/这笔小鱼干已记下/);assert.match(html,/aria-busy="true"/);
  assert.doesNotMatch(html,new RegExp(`data-r-action="collect" data-r-order-id="${order.id}"`));
  assert.equal(h.cloud.dispatch(action),true);assert.equal(h.pending().length,1);assert.equal(h.posts().length,1);
  ack.resolve(response({error:{code:'RESTAURANT_ACTION_REJECTED',message:'小鱼干口袋快满啦'}},409));await flush();
  assert.equal(h.pending().length,0);assert.doesNotMatch(tableView(h),/正在收款/);assert.match(tableView(h),/data-r-action="collect"/);
  assert.equal(h.latest().coins,saved.coins);assert.equal(h.observed.rollbacks.length,1);
});

test('premium decoration purchases equip and reserve gold immediately while offline, then restore after reload',async t=>{
  const base=upgradeFixture();let offline=true,saved=base;
  const handler=req=>{if(req.method==='GET')return response(snapshot(saved));if(offline)throw new TypeError('offline');saved=apply(saved,req.body);return response(receipt(req.body,saved));};
  const first=harness(t,handler,{state:base});await first.cloud.start();
  const action={type:'restaurant-premium-decoration',themeId:'aquarium',equipped:true};
  assert.equal(first.cloud.dispatch(action),true);
  assert.equal(first.latest().goldFish,base.goldFish-4);assert.ok(first.latest().restaurant.equippedPremiumDecorations.includes('aquarium'));
  assert.equal(first.cloud.dispatch(action),false,'the visible target already equips this decoration');
  await flush();assert.equal(first.observed.rollbacks.length,0);
  const queue=clone(first.pending()),id=queue[0].operationId;first.cloud.destroy();t.mock.timers.reset();
  const second=harness(t,handler,{state:base,pending:queue});await second.cloud.start();
  assert.equal(second.latest().goldFish,base.goldFish-4);assert.ok(second.latest().restaurant.equippedPremiumDecorations.includes('aquarium'));
  await flush();offline=false;t.mock.timers.tick(10000);await flush();
  assert.equal(second.pending().length,0);assert.equal(saved.goldFish,base.goldFish-4);assert.equal(second.posts().at(-1).body.operationId,id);
});

test('a ten-draw intent survives a lost acknowledgement without another inspiration debit',async t=>{
  const base=upgradeFixture();base.restaurant.research.inspirationEarned=600;
  let saved=base,attempt=0,operationId;
  const h=harness(t,req=>{
    if(req.method==='GET')return response(snapshot(saved));
    if(!operationId){operationId=req.body.operationId;saved=apply(saved,req.body);attempt++;throw new TypeError('receipt lost');}
    assert.equal(req.body.operationId,operationId);attempt++;return response(receipt(req.body,saved));
  },{state:base});await h.cloud.start();
  const draw=restaurantInfo(base,NOW).research.nextDraw,action={type:'restaurant-research-draw',draw,count:10};
  assert.equal(h.cloud.dispatch(action),true);assert.equal(h.cloud.dispatch(action),false);
  assert.deepEqual(h.latest().restaurant.research,base.restaurant.research,'random results stay server-confirmed');
  await flush();assert.equal(h.pending().length,1);t.mock.timers.tick(10000);await flush();
  assert.equal(attempt,2);assert.equal(h.pending().length,0);assert.equal(restaurantInfo(saved,NOW).research.inspiration,restaurantInfo(base,NOW).research.inspiration-300);
  assert.equal(saved.restaurant.research.lastBatch.cards.length,10);assert.deepEqual(h.latest(),saved);
});

test('an explicit premium-decoration refusal restores gold and equipment without retrying the purchase',async t=>{
  const base=upgradeFixture(),ack=deferred();const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise,{state:base});await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'restaurant-premium-decoration',themeId:'aquarium',equipped:true}),true);assert.equal(h.latest().goldFish,base.goldFish-4);
  ack.resolve(response({error:{code:'RESTAURANT_ACTION_REJECTED',message:'这件珍藏未能解锁'}},409));await flush();
  assert.equal(h.pending().length,0);assert.equal(h.latest().goldFish,base.goldFish);assert.deepEqual(h.latest().restaurant.equippedPremiumDecorations,base.restaurant.equippedPremiumDecorations);
  assert.equal(h.observed.rollbacks.length,1);t.mock.timers.tick(10000);await flush();assert.equal(h.posts().length,1);
});
