import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoEngine, DEMO_ACTORS, DEMO_ROOM } from '../demo/engine.js';
import { createMemoryStorage } from '../demo/storage.js';
import { demoEngine, demoFetch, DEMO_ORIGIN } from '../demo/transport.js';

const operation=(id,name,role='male')=>({clientId:DEMO_ACTORS[role].id,operationId:`demo-batch-${id}`,action:{type:'rename',name}});
const first=operation('first','糯米一号'),second=operation('second','糯米二号');
const now=()=>Date.parse('2026-11-18T09:00:00Z');
function fixture() {
  const storage=createMemoryStorage(), writes=[], events=[];
  const setItem=storage.setItem;
  storage.setItem=(key,value)=>{writes.push(JSON.parse(value).revision);setItem(key,value);};
  const engine=createDemoEngine({storage,now});
  engine.subscribe((type,data)=>events.push({type,revision:data.revision,stored:JSON.parse(storage.getItem('server')).revision}));
  writes.length=0;
  return {storage,engine,writes,events};
}

test('one durable demo write precedes every individual event, and retrying stored receipts never repeats actions',()=>{
  const {engine,storage,writes,events}=fixture();
  const batch=engine.actionBatch([first,second]);
  assert.equal(batch.status,200);
  assert.deepEqual(batch.data.results.map(r=>[r.revision,r.state.name,r.event.operationId,r.event.actor.id]),[[1,first.action.name,first.operationId,first.clientId],[2,second.action.name,second.operationId,second.clientId]]);
  assert.deepEqual(writes,[2]);
  assert.deepEqual(events,[{type:'action',revision:1,stored:2},{type:'action',revision:2,stored:2}]);
  const replay=engine.actionBatch([first,second]);
  assert.deepEqual(replay.data.results.map(r=>[r.duplicate,r.event.operationId,r.revision]),[[true,first.operationId,2],[true,second.operationId,2]]);
  assert.deepEqual(writes,[2]);assert.equal(events.length,2);
  const restored=createDemoEngine({storage,now});
  assert.equal(restored.action(first).data.event.operationId,first.operationId);
  assert.equal(restored.action({...first,action:second.action}).status,409);
  assert.equal(restored.action({...first,clientId:DEMO_ACTORS.female.id}).status,409);
});

test('invalid batches affect neither state nor listeners, and a valid single can subsequently save',()=>{
  const {engine,writes,events}=fixture();
  for(const items of [[first],[first,first],[first,operation('other','猫','female')],Array.from({length:7},(_,i)=>operation(i,'猫'))])assert.equal(engine.actionBatch(items).status,400);
  assert.equal(engine.actionBatch([first,{...second,action:{type:'invalid-test-action'}}]).status,409);
  assert.equal(engine.snapshot().revision,0);assert.deepEqual(writes,[]);assert.deepEqual(events,[]);
  assert.equal(engine.action(first).data.revision,1);
});

test('an old ID-only acknowledgement falls back to its single route without replaying it',()=>{
  const {engine,storage}=fixture();
  engine.action(first);
  const saved=JSON.parse(storage.getItem('server'));saved.receipts=[first.operationId];storage.setItem('server',JSON.stringify(saved));
  const restored=createDemoEngine({storage,now});
  assert.equal(restored.actionBatch([first,second]).status,409);
  assert.equal(restored.action(first).data.duplicate,true);
  assert.equal(restored.action(second).data.revision,2);
});

test('the closed demo transport advertises batches and exercises throttle, offline and rejection controls',async()=>{
  const url=DEMO_ORIGIN+'/api/rooms/'+DEMO_ROOM;
  const post=(path,body)=>demoFetch(url+path,{method:'POST',body:JSON.stringify(body)});
  demoEngine.controls.latency=0;
  for(const entry of [url,DEMO_ORIGIN+'/api/couple/home'])assert.equal((await (await demoFetch(entry)).json()).actionBatchLimit,6);
  demoEngine.setOffline(true);
  await assert.rejects(post('/actions/batch',{operations:[first,second]}),/网络已断开/);
  demoEngine.setOffline(false);
  demoEngine.controls.rejectNext=true;
  assert.equal((await post('/actions/batch',{operations:[first,second]})).status,409);
  assert.equal((await post('/actions',first)).status,409);
  const good=await post('/actions/batch',{operations:[first,second]});
  assert.equal(good.status,200);assert.deepEqual((await good.json()).results.map(item=>item.event.operationId),[first.operationId,second.operationId]);
  await assert.rejects(demoFetch('https://example.org/api/rooms/'+DEMO_ROOM+'/actions/batch'),/禁止连接/);
});
