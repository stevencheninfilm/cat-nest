import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createPetServer } from '../server/pet-server.mjs';
import { initialState, reduceAction } from '../src/state.js';

const ROOM='a'.repeat(32),ORIGIN='https://example.github.io';
async function fixture(t,coupleRoomId=ROOM){
  let snapshot={roomId:ROOM,revision:0,state:initialState()};
  snapshot.state.history=Array.from({length:40},(_,index)=>({text:`${index} 小猫在窗边晒太阳，今天也一起慢慢长大。`.repeat(8).slice(0,190),actor:'男方',at:Date.now()}));
  const store={configured:true,getRoom:async()=>structuredClone(snapshot),applyAction:async(id,input)=>{
    const event={operationId:input.operationId,action:input.action,actor:{id:input.clientId,name:input.name}};
    snapshot={...snapshot,revision:snapshot.revision+1,state:reduceAction(snapshot.state,input.action,event.actor,Date.now(),input.operationId)};
    return {...structuredClone(snapshot),event,duplicate:false};
  }};
  const server=createPetServer({store,coupleRoomId,serveStatic:false,corsOrigin:ORIGIN,heartbeatMs:50,pollMs:60000});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{const closed=once(server,'close');server.shutdown();server.closeAllConnections();await closed;});
  return {base:`http://127.0.0.1:${server.address().port}`,snapshot:()=>structuredClone(snapshot),metadata:()=>{snapshot.restaurantGuestConditionsV2={remembered:!(snapshot.restaurantGuestConditionsV2?.remembered)};}};
}
async function raw(url,headers){return new Promise((resolve,reject)=>get(url,{headers},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks)}));}).on('error',reject));}
async function live(t,base,id){
  const controller=new AbortController();t.after(()=>controller.abort());
  const response=await fetch(`${base}/api/rooms/${ROOM}/events?clientId=${id}&name=${id}`,{headers:{'Accept-Encoding':'gzip'},signal:controller.signal});
  const events=[];let buffer='';const decoder=new TextDecoder(),reader=response.body.getReader();
  void (async()=>{try{for(;;){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const event=packet.match(/^event: (.+)$/m)?.[1],data=packet.match(/^data: (.+)$/m)?.[1];if(event&&data)events.push({event,data:JSON.parse(data)});}}}catch{/* Test cancellation. */}})();
  return {response,events};
}
async function until(predicate){const deadline=Date.now()+2000;while(!predicate()){if(Date.now()>deadline)throw new Error('Live event was buffered or lost');await new Promise(resolve=>setTimeout(resolve,10));}}

test('large JSON snapshots shrink on the wire without changing any saved fields',async t=>{
  const f=await fixture(t),path=`${f.base}/api/rooms/${ROOM}`;
  const identity=await raw(path,{'Accept-Encoding':'identity',Origin:ORIGIN}),compressed=await raw(path,{'Accept-Encoding':'gzip',Origin:ORIGIN});
  assert.equal(compressed.status,200);assert.equal(compressed.headers['content-encoding'],'gzip');assert.ok(compressed.bytes.length<identity.bytes.length*.5);
  assert.deepEqual(JSON.parse(gunzipSync(compressed.bytes)),f.snapshot());assert.deepEqual(gunzipSync(compressed.bytes),identity.bytes);
  assert.equal(compressed.headers.etag,identity.headers.etag);assert.match(compressed.headers.vary,/Origin/);assert.match(compressed.headers.vary,/Accept-Encoding/);
  assert.match(compressed.headers['cache-control'],/no-store/);assert.equal(Number(compressed.headers['content-length']),compressed.bytes.length);
  const declined=await raw(path,{'Accept-Encoding':'gzip;q=0, *;q=1'});assert.equal(declined.headers['content-encoding'],undefined);
});

test('unchanged room and couple snapshots return empty 304s; metadata changes invalidate their validators',async t=>{
  const f=await fixture(t);
  for(const path of [`/api/rooms/${ROOM}`,'/api/couple/home']){
    const first=await fetch(f.base+path,{headers:{Origin:ORIGIN}}),tag=first.headers.get('etag');assert.ok(tag);await first.arrayBuffer();
    assert.equal(first.headers.get('access-control-expose-headers'),'ETag');
    const next=await fetch(f.base+path,{headers:{'If-None-Match':`"old", ${tag}`,Origin:ORIGIN}});
    assert.equal(next.status,304);assert.equal((await next.arrayBuffer()).byteLength,0);
    f.metadata();const changed=await fetch(f.base+path,{headers:{'If-None-Match':tag}});assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),tag);await changed.arrayBuffer();
  }
  const preflight=await fetch(`${f.base}/api/rooms/${ROOM}`,{method:'OPTIONS',headers:{Origin:ORIGIN,'Access-Control-Request-Headers':'if-none-match'}});
  assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/If-None-Match/i);
});

test('compressed live streams flush state, presence, saved actions, heartbeats and room-full events immediately',async t=>{
  const f=await fixture(t,'b'.repeat(32)),one=await live(t,f.base,'partner-male'),two=await live(t,f.base,'partner-female');
  assert.equal(one.response.headers.get('content-encoding'),'gzip');
  await until(()=>one.events.some(x=>x.event==='state')&&one.events.some(x=>x.event==='presence'&&x.data.length===2));
  const saved=await fetch(`${f.base}/api/rooms/${ROOM}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId:'bandwidth-action',clientId:'partner-male',name:'partner-male',action:{type:'pet'}})});
  assert.equal(saved.status,200);const receipt=await saved.json();await until(()=>two.events.some(x=>x.event==='action'));
  assert.deepEqual(two.events.find(x=>x.event==='action').data.state,receipt.state);
  await until(()=>one.events.some(x=>x.event==='heartbeat'&&x.data.revision===1));
  const third=await live(t,f.base,'client-three');await until(()=>third.events.some(x=>x.event==='full'));
});
