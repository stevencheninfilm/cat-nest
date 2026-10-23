import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';
const ROOM='a'.repeat(32),clone=value=>structuredClone(value);
const snapshot=(revision=0)=>({roomId:ROOM,revision,state:{name:'糯米',count:revision}});
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const response=(data,etag='W/"state-0"')=>({ok:true,status:200,headers:new Headers({etag}),json:async()=>clone(data)});
const unchanged=()=>({ok:false,status:304,json:async()=>{throw new Error('304 has no JSON body');}});
class Visibility extends EventTarget{hidden=false;set(hidden){this.hidden=hidden;this.dispatchEvent(new Event('visibilitychange'));}}
function fixture(t,handler){
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000000});
  const requests=[],sources=[],states=[],pending=[],visibility=new Visibility(),connectivity=new EventTarget();
  class Source{listeners=new Map();addEventListener(type,fn){this.listeners.set(type,fn);}emit(type,data){this.listeners.get(type)?.({data:JSON.stringify(data)});}close(){this.closed=true;}}
  const cloud=createCloudRoom({apiBase:'https://cloud.example',roomId:ROOM,clientId:'client-one',name:'男方',visibilityTarget:visibility,connectivityTarget:connectivity,eventSourceFactory:()=>{const source=new Source();sources.push(source);return source;},fetchImpl:async(url,options={})=>{const req={url,method:options.method??'GET',headers:options.headers,body:options.body?JSON.parse(options.body):null};requests.push(req);return handler(req);},onRoom(){},onState:state=>states.push(clone(state)),onAction(){},onPresence(){},onStatus(){},onSaveStatus(){},onPending:queue=>pending.push(clone(queue))});
  t.after(()=>cloud.destroy());return {cloud,requests,sources,states,pending,visibility,connectivity,reads:()=>requests.filter(req=>req.method==='GET')};
}

test('healthy live heartbeats replace periodic snapshot downloads while partner actions still apply immediately',async t=>{
  const h=fixture(t,()=>response(snapshot()));await h.cloud.start();h.sources[0].onopen();
  for(let i=0;i<40;i++){t.mock.timers.tick(15000);h.sources[0].emit('heartbeat',{revision:0});await flush();}
  assert.equal(h.reads().length,1,'ten quiet minutes need only the initial snapshot');
  h.sources[0].emit('action',{...snapshot(1),event:{operationId:'partner-action',actor:{id:'client-two',name:'女方'},action:{type:'pet'}}});
  assert.equal(h.states.at(-1).count,1);assert.equal(h.reads().length,1);
});

test('explicit restart reads a full snapshot instead of reusing a previous conditional validator',async t=>{
  const h=fixture(t,req=>{assert.equal(req.headers['If-None-Match'],undefined);return response(snapshot());});
  await h.cloud.start();await h.cloud.start();assert.equal(h.reads().length,2);assert.equal(h.sources[0].closed,true);
});

test('a silent or disconnected stream falls back to conditional reads without parsing or repainting 304s',async t=>{
  let reads=0;const h=fixture(t,()=>++reads===1?response(snapshot()):unchanged());await h.cloud.start();h.sources[0].onopen();
  t.mock.timers.tick(40000);await flush();assert.equal(reads,1);
  t.mock.timers.tick(20000);await flush();assert.equal(reads,2);assert.equal(h.reads()[1].headers['If-None-Match'],'W/"state-0"');assert.equal(h.states.length,1);
  h.sources[0].onerror();t.mock.timers.tick(20000);await flush();assert.equal(reads,3);
  h.sources[0].onopen();for(let i=0;i<4;i++){t.mock.timers.tick(15000);h.sources[0].emit('heartbeat',{revision:0});await flush();}assert.equal(reads,3);
});

test('hidden tabs stop fallback reads, keep live updates and drain the exact saved operation on reconnect',async t=>{
  let online=false,saved=snapshot();const h=fixture(t,req=>{
    if(req.method==='GET')return response(saved);
    if(!online)throw new TypeError('offline');
    saved={...snapshot(1),event:{operationId:req.body.operationId,actor:{id:'client-one',name:'男方'},action:req.body.action}};return response(saved);
  });await h.cloud.start();h.visibility.set(true);h.sources[0].onerror();
  assert.equal(h.cloud.dispatch({type:'pet'}),true);await flush();const original=clone(h.pending.at(-1)[0]);
  t.mock.timers.tick(20000);await flush();assert.equal(h.reads().length,1);assert.equal(h.pending.at(-1)[0].operationId,original.operationId);
  h.sources[0].emit('state',snapshot(2));assert.equal(h.states.at(-1).count,2,'hiding never disconnects partner updates');
  online=true;h.visibility.set(false);h.connectivity.dispatchEvent(new Event('online'));await flush();
  assert.deepEqual(h.pending.at(-1),[]);assert.ok(h.requests.filter(req=>req.method==='POST').every(req=>req.body.operationId===original.operationId));
});

test('foreground and reconnect reads coalesce; a newer heartbeat recovers a missed state, and destroy removes all wakeups',async t=>{
  let resolveRead,reads=0;const h=fixture(t,()=>++reads===1?response(snapshot()):new Promise(resolve=>{resolveRead=resolve;}));await h.cloud.start();
  h.sources[0].emit('heartbeat',{revision:1});h.visibility.set(false);h.connectivity.dispatchEvent(new Event('online'));await flush();assert.equal(reads,2);
  resolveRead(response(snapshot(1),'W/"state-1"'));await flush();assert.equal(h.states.at(-1).count,1);
  h.cloud.destroy();h.visibility.set(false);h.connectivity.dispatchEvent(new Event('online'));t.mock.timers.tick(120000);await flush();assert.equal(reads,2);
});
