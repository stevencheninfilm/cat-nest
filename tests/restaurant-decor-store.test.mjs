import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { initialState } from '../src/state.js';
import { restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { RESTAURANT_UNLOCK_LEVELS } from '../src/restaurant-progression.js';
const NOW=Date.parse('2026-10-18T12:00:00Z');
function mockGitHub() {
  const files=new Map();let nextSha=0,putGate=null;
  const controls={loseAcknowledgment:false,conflicts:0,gateNextTwoWrites(){let release;const ready=new Promise(resolve=>{release=resolve;});putGate={remaining:2,ready,release};}};
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json','');
    if(options.method==='GET') {
      const previous=files.get(id);
      if(!previous)return new Response('{}',{status:404});
      if(options.headers['If-None-Match']===previous.sha)return new Response(null,{status:304});
      return Response.json({sha:previous.sha,encoding:'base64',content:Buffer.from(JSON.stringify(previous.room)).toString('base64')},{headers:{etag:previous.sha}});
    }
    const gate=putGate;if(gate){gate.remaining--;if(gate.remaining===0){putGate=null;gate.release();}await gate.ready;}
    const previous=files.get(id),body=JSON.parse(options.body);
    if(previous&&previous.sha!==body.sha){controls.conflicts++;return new Response('{}',{status:409});}
    files.set(id,{sha:`decor-sha-${++nextSha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    if(controls.loseAcknowledgment){controls.loseAcknowledgment=false;throw new Error('lost acknowledgment');}
    return new Response('{}',{status:previous?200:201});
  };
  return {files,controls,fetchImpl};
}
const makeStore=(mock,now=()=>NOW)=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now});
// Start these payment/concurrency fixtures at a level that permits every tested suite.
const TEST_EXPERIENCE=levelStartXp(Math.max(...Object.values(RESTAURANT_UNLOCK_LEVELS.decoration)));
const createDecorRoom=store=>{const state={...initialState(NOW),coins:1200};state.restaurant.stats.experience=TEST_EXPERIENCE;return store.createRoom({initialState:state});};
const payload=(decorationId,operationId='decor-operation-one',clientId='decor-client-one')=>({operationId,clientId,name:'店长',action:{type:'restaurant-decoration',decorationId}});

test('cloud action validation accepts only a decoration ID, leaving time, price and bonuses authoritative',()=>{
  const action={type:'restaurant-decoration',decorationId:'cream-library'};assert.deepEqual(sanitizeAction(action),action);
  for(const fields of [{cost:0},{startedAt:0},{finishAt:0},{coins:999999},{buffs:{coins:99999}},{construction:null}])assert.equal(sanitizeAction({...action,...fields}),null);
});

test('the shared cloud save keeps one construction job through reload, role switching and completion',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const first=makeStore(mock,()=>clock),room=await createDecorRoom(first);
  const request=payload('mint-seaside'),building=await first.applyAction(room.roomId,request),saved=structuredClone(mock.files.get(room.roomId).room);
  assert.equal(building.state.coins,room.state.coins-260);assert.equal(building.state.restaurant.construction.startedAt,NOW);
  clock+=3000;const reader=makeStore(mock,()=>clock),loaded=await reader.getRoom(room.roomId);
  assert.equal(loaded.state.restaurant.construction.startedAt,NOW);assert.deepEqual(mock.files.get(room.roomId).room,saved,'read never rewrites a cloud room');
  await assert.rejects(reader.applyAction(room.roomId,payload('cream-library','decor-other-role','decor-client-two')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  clock=NOW+12000;const done=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.equal(done.state.restaurant.construction,null);assert.equal(done.state.restaurant.decorationId,'mint-seaside');assert.equal(done.state.coins,building.state.coins);assert.equal(done.roomId,room.roomId);assert.equal(mock.files.size,1);assert.equal(validRestaurant(done.state.restaurant),true);
});

test('a lost cloud acknowledgement and replayed operation never purchase or start the suite twice',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await createDecorRoom(store),request=payload('cream-library');
  mock.controls.loseAcknowledgment=true;
  await assert.rejects(store.applyAction(room.roomId,request));
  const retry=await makeStore(mock).applyAction(room.roomId,request);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.coins,room.state.coins-180);assert.equal(retry.state.restaurant.revision,1);assert.equal(retry.state.restaurant.construction.id,'decoration-1');
  await assert.rejects(makeStore(mock).applyAction(room.roomId,{...request,action:{type:'restaurant-decoration',decorationId:'mint-seaside'}}),error=>error.code==='OPERATION_CONFLICT');
});

test('two partners concurrently buying the same or different suites create exactly one job and one charge',async()=>{
  for(const secondId of ['mint-seaside','sakura-evening']) {
    const mock=mockGitHub(),first=makeStore(mock),second=makeStore(mock),room=await createDecorRoom(first);
    mock.controls.gateNextTwoWrites();
    const results=await Promise.allSettled([first.applyAction(room.roomId,payload('mint-seaside','decor-race-one')),second.applyAction(room.roomId,payload(secondId,'decor-race-two','decor-client-two'))]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.ok(mock.controls.conflicts>=1);
    const loaded=await makeStore(mock).getRoom(room.roomId),id=loaded.state.restaurant.construction.toDecorationId;
    assert.equal(loaded.state.coins,room.state.coins-(id==='mint-seaside'?260:380));assert.equal(loaded.state.restaurant.revision,1);assert.equal(loaded.state.restaurant.ownedDecorations.filter(id=>['mint-seaside','sakura-evening'].includes(id)).length,1);
  }
});

test('new orders retain their suite snapshot and one-tenth XP through a saved cloud collection',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const first=makeStore(mock,()=>clock),room=await createDecorRoom(first);
  await first.applyAction(room.roomId,payload('cream-library'));
  clock=NOW+12000;
  const started=await first.applyAction(room.roomId,{...payload('ignored','decor-order-one'),action:{type:'restaurant-start',recipeId:'sandwich'}});
  let state=started.state;
  for(let index=0;index<2;index++) {
    if(index){clock+=1000;state=(await first.applyAction(room.roomId,{...payload('ignored',`decor-order-${index+1}`),action:{type:'restaurant-start',recipeId:'sandwich'}})).state;}
    let order=restaurantInfo(state,clock).orders[0];assert.equal(order.decorationSnapshot.experience,150);
    clock=order.readyAt;
    state=(await first.applyAction(room.roomId,{...payload('ignored',`decor-serve-${index}`),action:{type:'restaurant-serve',orderId:order.id}})).state;
    clock+=4500;
    state=(await first.applyAction(room.roomId,{...payload('ignored',`decor-collect-${index}`,'decor-client-two'),action:{type:'restaurant-collect',orderId:order.id}})).state;
  }
  const loaded=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.equal(loaded.state.xp,room.state.xp);assert.equal(loaded.state.pendingGrowth.reduce((sum,r)=>sum+r.amount,0),12.1);assert.equal(loaded.state.restaurant.stats.experience,room.state.restaurant.stats.experience+12.1);assert.equal(loaded.state.restaurant.decorationCarry.experience,800);assert.equal(validRestaurant(loaded.state.restaurant),true);
});

test('future suites remain isolated per home even with identical operation IDs',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),one=await createDecorRoom(store),two=await createDecorRoom(store);
  const request=payload('sakura-teahouse');
  const result=await store.applyAction(one.roomId,request);
  assert.equal(result.state.restaurant.construction.toDecorationId,'sakura-teahouse');
  const untouched=await store.getRoom(two.roomId);assert.equal(untouched.state.restaurant.construction,undefined);assert.equal(untouched.state.coins,two.state.coins);
  const second=await store.applyAction(two.roomId,request);assert.equal(second.duplicate,false);assert.equal(second.state.coins,two.state.coins-240);assert.equal(mock.files.size,2);
});
