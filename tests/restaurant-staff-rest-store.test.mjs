import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { initialState } from '../src/state.js';
import { validRestaurant, restaurantInfo } from '../src/restaurant.js';
import { normalizeStaffTraining } from '../src/restaurant-staff-training.js';
const NOW=Date.parse('2026-10-18T12:00:00Z');
function mockGitHub(){
  const files=new Map();let seq=0,gate=null;
  const controls={lose:false,conflicts:0,pair(){let release;const ready=new Promise(resolve=>release=resolve);gate={remaining:2,ready,release};}};
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json','');
    if(options.method==='GET'){const file=files.get(id);if(!file)return new Response('{}',{status:404});if(options.headers['If-None-Match']===file.sha)return new Response(null,{status:304});return Response.json({sha:file.sha,encoding:'base64',content:Buffer.from(JSON.stringify(file.room)).toString('base64')},{headers:{etag:file.sha}});}
    const current=gate;if(current){current.remaining--;if(!current.remaining){gate=null;current.release();}await current.ready;}
    const body=JSON.parse(options.body),old=files.get(id);if(old&&old.sha!==body.sha){controls.conflicts++;return new Response('{}',{status:409});}
    files.set(id,{sha:`rest-${++seq}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    if(controls.lose){controls.lose=false;throw new Error('lost acknowledgement');}return new Response('{}',{status:old?200:201});
  };return {files,controls,fetchImpl};
}
const payload=(type,fields={},operationId='rest-operation',clientId='rest-client-one')=>({operationId,clientId,name:'店长',action:{type,...fields}});
async function setup(energy=10,{staff=0}={}){
  const mock=mockGitHub();let clock=NOW;const store=()=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now:()=>clock});
  const first=store(),state=initialState(NOW);state.restaurant.staff=staff;state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,staff);state.restaurant.staffTraining['worker-1']={...state.restaurant.staffTraining['worker-1'],energy,energyMode:'rest-room',rest:null};
  const room=await first.createRoom({initialState:state});
  await first.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'rice'},'rest-arrival'));
  clock+=6000;await first.applyAction(room.roomId,payload('restaurant-kitchen-accept',{orderId:'table-1'},'rest-accept'));
  return {mock,first,room,store,setClock(value){clock=value;},get clock(){return clock;}};
}

test('two independent clients clicking one v3 operation reserve one run and deduct ten energy once',async()=>{
  const {mock,first,room,store}=await setup(100);mock.controls.pair();
  const results=await Promise.allSettled([first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'rest-step-one')),store().applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'rest-step-two','rest-client-two'))]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.ok(mock.controls.conflicts>0);
  const state=(await store().getRoom(room.roomId)).state;assert.equal(state.restaurant.orders[0].workflow.runs.length,1);assert.equal(state.restaurant.staffTraining['worker-1'].energy,90);assert.equal(validRestaurant(state.restaurant),true);
});

test('cloud reads and retries grant no energy outside the rest room and charge each accepted operation once',async()=>{
  const context=await setup(40),{mock,first,room,store}=context;
  context.setClock(context.clock+800);const request=payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'standing-same-click');
  mock.controls.lose=true;await assert.rejects(first.applyAction(room.roomId,request));
  const retry=await store().applyAction(room.roomId,request);assert.equal(retry.duplicate,true);
  const run=retry.state.restaurant.orders[0].workflow.runs[0];assert.equal(run.energyBefore,40);assert.equal(run.energyAfter,30);
  context.setClock(run.endAt+8000);const loaded=await store().getRoom(room.roomId),saved=structuredClone(mock.files.get(room.roomId).room);
  assert.equal(restaurantInfo(loaded.state,context.clock).kitchen.workers[0].energy,30);
  assert.deepEqual(mock.files.get(room.roomId).room,saved);
  mock.controls.pair();const attempts=await Promise.allSettled([
    first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'wash'},'standing-wash-a')),
    store().applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'wash'},'standing-wash-b','rest-client-two'))
  ]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  const final=(await store().getRoom(room.roomId)).state;assert.equal(final.restaurant.orders[0].workflow.runs[1].energyBefore,30);assert.equal(final.restaurant.staffTraining['worker-1'].energy,20);
});

test('the same operation ID across simultaneous retries never spends stamina twice',async()=>{
  const {mock,first,room,store}=await setup(10),request=payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'rest-same-click');mock.controls.pair();
  const results=await Promise.all([first.applyAction(room.roomId,request),store().applyAction(room.roomId,request)]);
  assert.equal(results.filter(result=>result.duplicate).length,1);
  const state=(await store().getRoom(room.roomId)).state,run=state.restaurant.orders[0].workflow.runs[0];
  assert.equal(run.energyBefore,10);assert.equal(run.energyAfter,0);assert.equal(run.durationMultiplier,5);assert.equal(state.restaurant.orders[0].workflow.runs.length,1);assert.equal(state.restaurant.staffTraining['worker-1'].rest.arriveAt,run.rest.arriveAt);
});

test('lost handoff acknowledgement and concurrent next clicks preserve both employees and charge the replacement once',async()=>{
  const context=await setup(10,{staff:1}),{mock,first,room,store}=context;
  let result=await first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'handoff-gather'));
  const firstRun=structuredClone(result.state.restaurant.orders[0].workflow.runs[0]),rest=structuredClone(result.state.restaurant.staffTraining['worker-1'].rest);
  context.setClock(firstRun.endAt);
  const request=payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'wash'},'handoff-wash');
  mock.controls.lose=true;await assert.rejects(first.applyAction(room.roomId,request));
  const retried=await store().applyAction(room.roomId,request);assert.equal(retried.duplicate,true);
  assert.deepEqual(retried.state.restaurant.orders[0].workflow.runs.map(run=>run.workerId),['worker-1','worker-2']);
  assert.deepEqual(retried.state.restaurant.staffTraining['worker-1'].rest,rest);assert.equal(retried.state.restaurant.staffTraining['worker-2'].energy,90);
  const {workerId,...preserved}=retried.state.restaurant.orders[0].workflow.runs[0];assert.equal(workerId,'worker-1');assert.deepEqual(preserved,firstRun);
  const nextAt=retried.state.restaurant.orders[0].workflow.runs[1].endAt;context.setClock(nextAt);mock.controls.pair();
  const attempts=await Promise.allSettled([
    first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'beat-eggs'},'handoff-beat-a')),
    store().applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'beat-eggs'},'handoff-beat-b','rest-client-two'))
  ]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  const loaded=(await store().getRoom(room.roomId)).state;assert.equal(loaded.restaurant.orders[0].workflow.runs.length,3);assert.equal(loaded.restaurant.staffTraining['worker-2'].energy,80);
  assert.equal(restaurantInfo(loaded,rest.arriveAt+800).kitchen.workers[0].energy,1);assert.ok(validRestaurant(loaded.restaurant));
});

test('lost acknowledgement, refresh and another role preserve the same fatigue and rest timestamps',async()=>{
  const context=await setup(3),{mock,first,room,store}=context,request=payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'rest-lost-step');
  mock.controls.lose=true;await assert.rejects(first.applyAction(room.roomId,request));
  const retry=await store().applyAction(room.roomId,request);assert.equal(retry.duplicate,true);const run=retry.state.restaurant.orders[0].workflow.runs[0],saved=structuredClone(mock.files.get(room.roomId).room);
  context.setClock(run.rest.arriveAt+8000);const reload=await store().getRoom(room.roomId);
  assert.equal(reload.state.restaurant.orders[0].workflow.runs.length,1);assert.equal(restaurantInfo(reload.state,context.clock).kitchen.workers[0].energy,10);assert.deepEqual(mock.files.get(room.roomId).room,saved);
  await assert.rejects(store().applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'wash'},'rest-too-soon','rest-client-two')),error=>error.code==='RESTAURANT_ACTION_REJECTED'&&/体力恢复中/.test(error.message));
  context.setClock(run.rest.fullAt);const next=await store().applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'wash'},'rest-finished','rest-client-two'));
  assert.deepEqual(next.state.restaurant.orders[0].workflow.runs[1].startPosition,{x:97,y:47});assert.equal(next.state.restaurant.orders[0].workflow.runs[1].energyAfter,90);assert.equal(next.state.restaurant.staffTraining['worker-1'].rest,null);
});

test('a resting employee cannot be assigned to a second order and room recovery creates no automatic run or reward',async()=>{
  const context=await setup(),{first,room,store}=context;
  let result=await first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'rest-first-job'));const rest=result.state.restaurant.staffTraining['worker-1'].rest;
  await first.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'coffee'},'rest-second-arrival'));context.setClock(context.clock+6000);
  await first.applyAction(room.roomId,payload('restaurant-kitchen-accept',{orderId:'table-2'},'rest-second-accept'));
  context.setClock(rest.arriveAt+1000);await assert.rejects(store().applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-2',stepId:'gather'},'rest-second-too-soon')),error=>error.code==='RESTAURANT_ACTION_REJECTED'&&/体力恢复中/.test(error.message));
  const before=await store().getRoom(room.roomId);context.setClock(rest.fullAt+86400000);const after=await store().getRoom(room.roomId);
  assert.equal(after.state.coins,before.state.coins);assert.equal(after.state.xp,before.state.xp);assert.equal(after.state.restaurant.orders[0].workflow.runs.length,1);assert.equal(after.state.restaurant.orders[1].workflow.runs.length,0);assert.equal(restaurantInfo(after.state,context.clock).kitchen.workers[0].rest.phase,'ready');
});

test('cloud intents cannot supply energy, fatigue multipliers, rest clocks or workflow records',()=>{
  const valid={type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'};
  assert.deepEqual(sanitizeAction(valid),valid);for(const extra of [{energy:100},{energyAfter:100},{durationMultiplier:1},{rest:null},{fullAt:0},{energyMode:'legacy'},{workflow:{version:2}},{runs:[]}])assert.equal(sanitizeAction({...valid,...extra}),null);
});

test('corrupt persisted rest clocks and shortened room travel fail closed without resetting the save',async()=>{
  for(const mutate of [r=>r.fullAt--,r=>r.segments[0].endAt--,r=>r.arriveAt--]){
    const {mock,first,room,store}=await setup();await first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:'table-1',stepId:'gather'},'rest-corruption'));
    const file=mock.files.get(room.roomId);mutate(file.room.state.restaurant.staffTraining['worker-1'].rest);file.sha='corrupt-rest';
    await assert.rejects(store().getRoom(room.roomId),error=>error.code==='STORAGE_CORRUPT');assert.equal(mock.files.size,1);
  }
});
