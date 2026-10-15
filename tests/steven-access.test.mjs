import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStevenAccess, STEVEN_ROOM_ID as HOME } from '../server/steven-access.mjs';
import { createPetServer } from '../server/pet-server.mjs';
const key = 'test-only-private-home-password-256-bits';
const authorization = token => ({ authorization:`Bearer ${token}` });
const request = token => ({ headers:authorization(token) });

test('sessions are scoped, expire, resist tampering and stop working after key rotation',()=>{
  let at = 1800000000000;
  const access = createStevenAccess({key,now:()=>at});
  assert.throws(()=>access.login('wrong'),e=>e.status===401);
  const {token} = access.login(key);
  assert.equal(access.verify(request(token)).room,HOME);
  assert.throws(()=>access.verify(request(`${token}x`)),e=>e.status===401);
  assert.throws(()=>createStevenAccess({key:`${key}rotated`}).verify(request(token)),e=>e.status===401);
  assert.throws(()=>createStevenAccess({key,roomId:'b'.repeat(32),now:()=>at}).verify(request(token)),e=>e.status===401);
  at += 30*24*60*60*1000;
  assert.throws(()=>access.verify(request(token)),e=>e.status===401);
  assert.throws(()=>createStevenAccess({key:''}).login(key),e=>e.status===503);
});

test('stream tickets expire in 60 seconds, are single use, and are bound to an actor',()=>{
  let at = 1800000000000;
  const access = createStevenAccess({key,now:()=>at});
  const auth = request(access.login(key).token);
  const url = (ticket,clientId='partner-male')=>new URL(`https://api.example/api/rooms/${HOME}/events?${new URLSearchParams({ticket,clientId})}`);
  let {ticket} = access.ticket(auth,'partner-male');
  access.verifyStream(url(ticket));
  assert.throws(()=>access.verifyStream(url(ticket)),e=>e.status===401);
  ({ticket} = access.ticket(auth,'partner-male'));
  assert.throws(()=>access.verifyStream(url(ticket,'partner-female')),e=>e.status===401);
  ({ticket} = access.ticket(auth,'partner-male'));at+=60000;
  assert.throws(()=>access.verifyStream(url(ticket)),e=>e.status===401);
});

async function running(t,{configured=true}={}) {
  const reads=[],writes=[];
  const saved={roomId:HOME,revision:195,state:{coins:8123,xp:12345,history:[{text:'preserved'}],pendingGrowth:[{id:'existing-bubble'}]}};
  const store={configured:true,async getRoom(id){reads.push(id);return structuredClone({...saved,roomId:id});},async applyAction(id,input){writes.push({id,input});return {...saved,revision:196};},async createRoom(){throw new Error('must not seed a home');}};
  const access=createStevenAccess({key:configured?key:''});
  const server=createPetServer({store,privateAccess:access,serveStatic:false,corsOrigin:'https://example.github.io'});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{const done=once(server,'close');server.shutdown();server.closeAllConnections();await done;});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body={},token)=>fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?authorization(token):{})},body:JSON.stringify(body)});
  return {base,post,reads,writes,saved};
}

test('legacy home, direct room, actions and SSE all reject anonymous visitors before reading or writing a save',async t=>{
  const {base,post,reads,writes}=await running(t);
  for(const path of ['/api/couple/home',`/api/rooms/${HOME}`,`/api/rooms/${HOME}/events?clientId=partner-male&name=male`]) assert.equal((await fetch(`${base}${path}`)).status,401);
  for(const route of ['actions','stream-ticket']) assert.equal((await post(`/api/rooms/${HOME}/${route}`,{clientId:'partner-male',action:{type:'pet'}})).status,401);
  assert.deepEqual(reads,[]);assert.deepEqual(writes,[]);
  assert.equal((await post('/api/access/steven',{password:'wrong'})).status,401);
  const other='6858d44c3a9ce3b77ea7c5334b4acd02';
  assert.equal((await fetch(`${base}/api/rooms/${other}`)).status,200);
});

test('unlocking reads the exact existing save, supports both partners and never seeds a replacement',async t=>{
  const {base,post,reads,writes,saved}=await running(t);
  const response=await post('/api/access/steven',{password:key});assert.equal(response.status,200);
  const {token}=await response.json();
  for(const path of ['/api/couple/home',`/api/rooms/${HOME}`]) {
    const res=await fetch(`${base}${path}`,{headers:authorization(token)});assert.equal(res.status,200);
    const actual=await res.json();assert.deepEqual(actual.state,saved.state);assert.equal(actual.revision,195);assert.equal(actual.roomId,HOME);
  }
  const res=await fetch(`${base}/api/access/steven`,{headers:authorization(token)});assert.deepEqual(await res.json(),{ok:true});
  assert.equal(reads.length,2);assert.deepEqual(writes,[]);
  const cors=await fetch(`${base}/api/couple/home`,{method:'OPTIONS',headers:{Origin:'https://example.github.io','Access-Control-Request-Headers':'authorization'}});
  assert.match(cors.headers.get('access-control-allow-headers'),/Authorization/);
  for(const role of ['male','female']) {
    const clientId=`partner-${role}`;
    const result=await post(`/api/rooms/${HOME}/stream-ticket`,{clientId,name:role},token);assert.equal(result.status,200);
    const {ticket}=await result.json();
    const controller=new AbortController();
    const url=`${base}/api/rooms/${HOME}/events?${new URLSearchParams({clientId,name:role,ticket})}`;
    const stream=await fetch(url,{signal:controller.signal});assert.equal(stream.status,200);controller.abort();
    assert.equal((await fetch(url)).status,401);
    assert.equal((await post(`/api/rooms/${HOME}/actions`,{clientId,name:role,operationId:`private-${role}`,action:{type:'pet'}},token)).status,200);
  }
  assert.equal(writes.length,2);
});

test('missing private configuration locks the old room and login brute-force attempts are limited',async t=>{
  const locked=await running(t,{configured:false});
  assert.equal((await fetch(`${locked.base}/api/couple/home`)).status,503);assert.deepEqual(locked.reads,[]);
  const {post}=await running(t);
  for(let i=0;i<20;i++) assert.equal((await post('/api/access/steven',{password:'guess'})).status,401);
  assert.equal((await post('/api/access/steven',{password:'guess'})).status,429);
});
