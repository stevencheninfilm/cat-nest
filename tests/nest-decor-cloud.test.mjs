import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createGitHubStore} from '../server/github-store.mjs';
import {createPetServer} from '../server/pet-server.mjs';
import {initialState} from '../src/state.js';
const at=Date.parse('2026-10-15T08:00:00Z'),HOME='d'.repeat(32);
const op=(role,action,operationId)=>({clientId:`partner-${role}`,name:role==='male'?'男方':'女方',action,operationId});
function mockGitHub(){
  const files=new Map(),control={fail:false,loseAck:false};let version=0;
  async function fetchImpl(url,options){const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),stored=files.get(id);
    if(options.method==='GET'){if(!stored)return new Response('{}',{status:404});if(options.headers['If-None-Match']===stored.sha)return new Response(null,{status:304});return Response.json({sha:stored.sha,encoding:'base64',content:Buffer.from(JSON.stringify(stored.room)).toString('base64')},{headers:{etag:stored.sha}});}
    if(control.fail)return new Response('{}',{status:500});const body=JSON.parse(options.body);if(stored&&stored.sha!==body.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`sha-${++version}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});if(control.loseAck){control.loseAck=false;throw new Error('lost network acknowledgement');}return new Response('{}',{status:stored?200:201});
  }
  const store=()=>createGitHubStore({token:'test-placeholder',repository:'test/nest',fetchImpl,now:()=>at});
  async function home(state=initialState(at)){const result=await store().createRoom({initialState:state}),saved=files.get(result.roomId);files.delete(result.roomId);saved.room.roomId=HOME;files.set(HOME,saved);}
  return {files,control,store,home};
}
test('different shared edits merge across independent store instances, persist on reload, and replay once',async()=>{
  const m=mockGitHub();await m.home();const a=m.store(),b=m.store();
  const move=op('male',{type:'nest-place',item:'toy',x:-1,z:2,rotation:1},'shared-toy-move-0001');
  const color=op('female',{type:'nest-palette',palette:'lilac'},'shared-palette-0001');
  await Promise.all([a.applyAction(HOME,move),b.applyAction(HOME,color)]);
  const saved=await m.store().getRoom(HOME);assert.equal(saved.revision,2);assert.equal(saved.state.nest.palette,'lilac');assert.equal(saved.state.nest.placements.find(p=>p.item==='toy').x,-1);assert.equal(saved.state.nest.revision,2);
  await m.store().applyAction(HOME,move);assert.deepEqual((await m.store().getRoom(HOME)).state.nest,saved.state.nest);
});
test('concurrent collections cannot overspend coins and a lost purchase response never charges twice',async()=>{
  const m=mockGitHub(),state=initialState(at);state.coins=160;await m.home(state);
  const results=await Promise.allSettled([m.store().applyAction(HOME,op('male',{type:'nest-buy',item:'plant'},'concurrent-plant-buy')),m.store().applyAction(HOME,op('female',{type:'nest-buy',item:'cushion'},'concurrent-cushion-buy'))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const saved=await m.store().getRoom(HOME);assert.ok(saved.state.coins>=0);assert.equal(saved.state.nest.owned.length,6);
  const another=mockGitHub();await another.home();another.control.loseAck=true;const buy=op('female',{type:'nest-buy',item:'plant'},'lost-purchase-response');
  await assert.rejects(another.store().applyAction(HOME,buy));const retry=await another.store().applyAction(HOME,buy);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.coins,1080);assert.equal(retry.state.nest.owned.filter(id=>id==='plant').length,1);
});
test('failed writes do not acknowledge a changed room and corrupt furniture data fails closed',async()=>{
  const m=mockGitHub();await m.home();m.control.fail=true;
  await assert.rejects(m.store().applyAction(HOME,op('male',{type:'nest-palette',palette:'mint'},'failed-room-palette')));
  assert.equal(m.files.get(HOME).room.state.nest.palette,'honey');assert.equal(m.files.get(HOME).room.revision,0);
  m.control.fail=false;m.files.get(HOME).room.state.nest.placements[0].x=999;m.files.get(HOME).sha='corrupt';
  await assert.rejects(m.store().getRoom(HOME),error=>error.code==='STORAGE_CORRUPT');assert.equal(m.files.get(HOME).room.state.nest.placements[0].x,999);
});
test('both caregivers receive the same saved decoration through SSE and reload',async t=>{
  const m=mockGitHub();await m.home();const server=createPetServer({store:m.store(),coupleRoomId:HOME,serveStatic:false,pollMs:60000,heartbeatMs:60000});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`,clients=[];
  t.after(async()=>{for(const c of clients)c.abort.abort();const done=once(server,'close');server.shutdown();server.closeAllConnections();await done;});
  for(const role of ['male','female']){const abort=new AbortController(),res=await fetch(`${base}/api/rooms/${HOME}/events?clientId=partner-${role}&name=${role}`,{signal:abort.signal}),client={abort,events:[]};clients.push(client);const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';void(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))!==-1){const packet=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=packet.match(/^event: (.+)$/m)?.[1],data=packet.match(/^data: (.+)$/m)?.[1];if(event==='action'&&data)client.events.push(JSON.parse(data));}}}catch{}})();}
  const action=op('female',{type:'nest-palette',palette:'mint'},'sse-decoration-palette');
  const result=await fetch(`${base}/api/rooms/${HOME}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});assert.equal(result.status,200);
  const end=Date.now()+3000;while(!clients.every(c=>c.events.length)){if(Date.now()>end)throw new Error('decoration SSE not received');await new Promise(resolve=>setTimeout(resolve,10));}
  assert.deepEqual(clients[0].events[0].state.nest,clients[1].events[0].state.nest);
  assert.equal(clients[0].events[0].state.nest.lastEdit.actor,'女方');
  assert.deepEqual((await(await fetch(`${base}/api/couple/home`)).json()).state.nest,clients[0].events[0].state.nest);
});
