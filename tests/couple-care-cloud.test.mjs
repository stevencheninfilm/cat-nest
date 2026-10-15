import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGitHubStore } from '../server/github-store.mjs';
import { createPetServer } from '../server/pet-server.mjs';
import { initialState } from '../src/state.js';
import { cooperationDay, validCoupleCare } from '../src/couple-care.js';

const at=Date.parse('2026-10-14T08:00:00Z'), HOME='b'.repeat(32);
const op=(role,type,id)=>({operationId:id,clientId:`partner-${role}`,name:role==='male'?'男方':'女方',action:{type}});
function github() {
  const files=new Map(), control={failWrite:false};let sha=0;
  async function fetchImpl(url,options) {
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),stored=files.get(id);
    if(options.method==='GET') {
      if(!stored)return new Response('{}',{status:404});
      if(options.headers['If-None-Match']===stored.sha)return new Response(null,{status:304});
      return Response.json({sha:stored.sha,encoding:'base64',content:Buffer.from(JSON.stringify(stored.room)).toString('base64')},{headers:{etag:stored.sha}});
    }
    if(control.failWrite)return new Response('{}',{status:500});
    const body=JSON.parse(options.body);
    if(stored && body.sha!==stored.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`sha-${++sha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    return new Response('{}',{status:stored?200:201});
  }
  return {files,control,fetchImpl};
}
const storeFor=(mock,now=()=>at)=>createGitHubStore({token:'test-only-placeholder',repository:'test/couple-data',fetchImpl:mock.fetchImpl,now});
async function createHome(store,mock,state) {
  const created=await store.createRoom(state?{initialState:state}:{});
  const stored=mock.files.get(created.roomId);
  mock.files.delete(created.roomId);stored.room.roomId=HOME;mock.files.set(HOME,stored);
  return store.getRoom(HOME);
}

test('two store instances merge both caregivers and one permanent memory under a CAS race',async()=>{
  const mock=github(),one=storeFor(mock),two=storeFor(mock),home=await createHome(one,mock);
  await Promise.all([one.applyAction(home.roomId,op('male','pet','concurrent-male-pet')),two.applyAction(home.roomId,op('female','play','concurrent-female-play'))]);
  const saved=await storeFor(mock).getRoom(HOME);
  assert.equal(saved.state.coupleCare.records.length,2);assert.equal(saved.state.coupleCare.moments.length,1);
  assert.equal(saved.state.coupleCare.moments[0].kind,'relay');assert.equal(validCoupleCare(saved.state.coupleCare),true);
  await two.applyAction(HOME,op('female','play','concurrent-female-play'));
  const replayed=await storeFor(mock).getRoom(HOME);
  assert.equal(replayed.revision,2);assert.deepEqual(replayed.state.coupleCare,saved.state.coupleCare);
  const reopened=await storeFor(mock,()=>at+86_400_000).getRoom(HOME);
  assert.deepEqual(reopened.state.coupleCare,saved.state.coupleCare);
});

test('a failed write cannot publish a cooperation record and retrying the same ID completes it once',async()=>{
  const mock=github(),store=storeFor(mock);await createHome(store,mock);
  await store.applyAction(HOME,op('male','pet','failure-male-pet'));
  mock.control.failWrite=true;
  await assert.rejects(store.applyAction(HOME,op('female','play','failure-female-play')),error=>error.code==='STORAGE_WRITE_FAILED');
  assert.equal(mock.files.get(HOME).room.state.coupleCare.records.length,1);
  assert.equal(mock.files.get(HOME).room.state.coupleCare.moments.length,0);
  mock.control.failWrite=false;
  await store.applyAction(HOME,op('female','play','failure-female-play'));
  assert.equal((await storeFor(mock).getRoom(HOME)).state.coupleCare.moments.length,1);
});

test('corrupt stored cooperation data fails closed rather than clearing the owners’ save',async()=>{
  const mock=github(),store=storeFor(mock);await createHome(store,mock);
  const stored=mock.files.get(HOME);stored.room.state.coupleCare.records=[{id:'spoofed-owner-care',actorId:'third-owner',type:'pet',at}];stored.sha='corrupt-revision';
  await assert.rejects(store.getRoom(HOME),error=>error.code==='STORAGE_CORRUPT');
  assert.equal(mock.files.get(HOME).room.state.coupleCare.records[0].actorId,'third-owner');
});

test('permanent memories can exceed the ordinary room-field cap without blocking later saves',async()=>{
  const mock=github(),store=storeFor(mock),state=initialState(at),day=cooperationDay(at);
  for(let offset=1;offset<=1800;offset++) state.coupleCare.moments.push({id:`relay:${day-offset}`,kind:'relay',day:day-offset,at:at-offset*86_400_000,firstActorId:'partner-male',secondActorId:'partner-female',firstId:`archive-male-${offset}`,secondId:`archive-female-${offset}`});
  assert.ok(Buffer.byteLength(JSON.stringify(state.coupleCare))*4/3>350_000);
  await createHome(store,mock,state);
  const reopened=await storeFor(mock).getRoom(HOME);assert.equal(reopened.state.coupleCare.moments.length,1800);
  const next=await storeFor(mock).applyAction(HOME,op('male','pet','large-memory-pet'));
  assert.equal(next.state.coupleCare.moments.length,1800);assert.equal(next.state.coupleCare.records.length,1);
});

async function listen(t,store) {
  const server=createPetServer({store,coupleRoomId:HOME,serveStatic:false,pollMs:60_000,heartbeatMs:60_000});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{const done=once(server,'close');server.shutdown();server.closeAllConnections();await done;});
  return `http://127.0.0.1:${server.address().port}`;
}
async function stream(t,base,role) {
  const abort=new AbortController(),response=await fetch(`${base}/api/rooms/${HOME}/events?clientId=partner-${role}&name=${role}`,{signal:abort.signal});
  const events=[],reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  t.after(()=>abort.abort());
  const pump=(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))!==-1){const chunk=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const event=chunk.match(/^event: (.+)$/m)?.[1],data=chunk.match(/^data: (.+)$/m)?.[1];if(event&&data)events.push({event,data:JSON.parse(data)});}}}catch{/* Stream shutdown. */}})();
  return {events,pump};
}
const waitFor=async predicate=>{const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw new Error('saved SSE receipt was not received');await new Promise(resolve=>setTimeout(resolve,10));}};

test('both connected roles receive the same saved cooperation through real SSE, and reload reads it back',async t=>{
  const mock=github(),store=storeFor(mock);await createHome(store,mock);const base=await listen(t,store);
  const male=await stream(t,base,'male'),female=await stream(t,base,'female');
  const post=payload=>fetch(`${base}/api/rooms/${HOME}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await post(op('male','pet','sse-male-pet'))).status,200);
  assert.equal((await post(op('female','play','sse-female-play'))).status,200);
  for(const client of [male,female]) await waitFor(()=>client.events.some(packet=>packet.event==='action'&&packet.data.state.coupleCare.moments.length===1));
  const a=male.events.filter(packet=>packet.event==='action').at(-1).data;
  const b=female.events.filter(packet=>packet.event==='action').at(-1).data;
  assert.deepEqual(a.state.coupleCare,b.state.coupleCare);
  assert.equal(a.state.coupleCare.records.length,2);
  const reloaded=await (await fetch(`${base}/api/couple/home`)).json();
  assert.deepEqual(reloaded.state.coupleCare,a.state.coupleCare);
  mock.control.failWrite=true;
  const failed=await post(op('male','sleep','sse-rejected-sleep'));assert.equal(failed.status,503);
  assert.equal(mock.files.get(HOME).room.state.coupleCare.moments.length,1);
  assert.ok(!male.events.some(packet=>packet.data.event?.operationId==='sse-rejected-sleep'));
});
