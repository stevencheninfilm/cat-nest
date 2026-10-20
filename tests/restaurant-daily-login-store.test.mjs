import test from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubStore} from '../server/github-store.mjs';
import {initialState} from '../src/state.js';
import {restaurantLoginDay} from '../src/restaurant-daily-login.js';
const NOW=Date.parse('2026-10-20T04:00:00Z');
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
const payload=(id='daily-operation-one',clientId='daily-client-one',day=restaurantLoginDay(NOW))=>({operationId:id,clientId,name:'店长',action:{type:'restaurant-daily-login',day}});

test('two owners racing different IDs receive one shared daily gift through the atomic cloud save',async()=>{
  const mock=mockGitHub(),a=makeStore(mock),b=makeStore(mock),room=await a.createRoom({initialState:initialState(NOW)});
  mock.controls.gateNextTwoWrites();
  const results=await Promise.allSettled([a.applyAction(room.roomId,payload()),b.applyAction(room.roomId,payload('daily-operation-two','daily-client-two'))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(mock.controls.conflicts>=1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'RESTAURANT_ACTION_REJECTED');
  const saved=await makeStore(mock).getRoom(room.roomId);assert.equal(saved.state.coins,room.state.coins+300);assert.equal(saved.state.restaurant.revision,1);
  assert.equal(saved.state.restaurant.dailyLogin.day,restaurantLoginDay(NOW));
});

test('a lost acknowledgement, reload and replay of the same operation never re-credit the wallet',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom({initialState:initialState(NOW)}),request=payload();
  mock.controls.loseAcknowledgment=true;await assert.rejects(store.applyAction(room.roomId,request));
  const replay=await makeStore(mock).applyAction(room.roomId,request);assert.equal(replay.duplicate,true);assert.equal(replay.state.coins,room.state.coins+300);
  await assert.rejects(makeStore(mock).applyAction(room.roomId,payload('daily-other-operation','daily-client-two')),e=>e.code==='RESTAURANT_ACTION_REJECTED');
});

test('unclaimed and claimed read-only snapshots never write; independent homes have independent gifts',async()=>{
  const mock=mockGitHub();let clock=NOW;const store=makeStore(mock,()=>clock);
  const a=await store.createRoom({initialState:initialState(NOW)}),b=await store.createRoom({initialState:initialState(NOW)});
  const raw=structuredClone(mock.files);
  await store.getRoom(a.roomId);assert.deepEqual(mock.files,raw);
  await store.applyAction(a.roomId,payload());assert.equal((await store.getRoom(b.roomId)).state.coins,b.state.coins);
  await store.applyAction(b.roomId,payload());assert.equal((await store.getRoom(b.roomId)).state.coins,b.state.coins+300);
  clock+=86400000;const claimedRaw=structuredClone(mock.files);const next=await makeStore(mock,()=>clock).getRoom(a.roomId);
  assert.equal(next.state.coins,a.state.coins+300);assert.deepEqual(mock.files,claimedRaw);
  await assert.rejects(store.applyAction(a.roomId,payload('daily-stale-operation')),e=>e.code==='RESTAURANT_ACTION_REJECTED');
  const nextGift=await store.applyAction(a.roomId,payload('daily-next-day-operation','daily-client-two',restaurantLoginDay(clock)));
  assert.equal(nextGift.state.coins,a.state.coins+600);assert.equal(mock.files.size,2);
});
