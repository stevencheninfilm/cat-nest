import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { initialState } from '../src/state.js';
import { createCloudRoom } from '../src/cloud.js';
const NOW=Date.parse('2026-10-15T00:00:00Z');
function fixture() {
  const files=new Map();let sha=0,writes=0;
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),old=files.get(id);
    if(options.method==='GET') {
      if(!old)return new Response('{}',{status:404});
      if(options.headers['If-None-Match']===old.sha)return new Response(null,{status:304});
      return Response.json({sha:old.sha,encoding:'base64',content:Buffer.from(JSON.stringify(old.room)).toString('base64')},{headers:{etag:old.sha}});
    }
    const body=JSON.parse(options.body);
    if(old&&old.sha!==body.sha)return new Response('{}',{status:409});
    writes++;files.set(id,{sha:`memory-${++sha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString())});return new Response('{}',{status:200});
  };
  const store=()=>createGitHubStore({token:'offline-test-token',repository:'test/memory',now:()=>NOW,fetchImpl});
  return {files,store,get writes(){return writes;}};
}
const favorite=(id,value,operationId='memory-favorite-operation')=>({operationId,clientId:'partner-male',name:'男方',action:{type:'diary-favorite',memoryId:id,favorite:value}});
test('legacy migration uses the real room creation date, reads without writing, and persists alongside the next favorite',async()=>{
  const f=fixture(),store=f.store(),created=await store.createRoom();
  const record=f.files.get(created.roomId).room;delete record.state.diary;record.createdAt=NOW-30*86_400_000;
  record.state.coins=87;record.state.xp=901;record.state.history=[{text:'原来的回忆',actor:'女方',at:NOW-10*86_400_000}];
  const writes=f.writes,recovered=await f.store().getRoom(created.roomId);
  assert.equal(f.writes,writes);assert.equal(recovered.state.diary.adoptedAt,record.createdAt);assert.equal(recovered.state.xp,901);assert.equal(recovered.state.coins,87);
  const saved=await f.store().applyAction(created.roomId,favorite('adoption',true));
  assert.deepEqual(saved.state.diary.favorites,['adoption']);assert.equal(saved.state.xp,901);assert.equal(saved.state.coins,87);
  assert.ok(saved.state.diary.entries.some(e=>e.kind==='legacy'&&e.text==='原来的回忆'));
  const fresh=await f.store().getRoom(created.roomId);assert.deepEqual(fresh.state.diary,saved.state.diary);
});
test('two saves never share memories or favorites, and a replayed favorite is acknowledged only once',async()=>{
  const f=fixture(),store=f.store(),a=await store.createRoom(),b=await store.createRoom();
  const before=structuredClone(f.files.get(b.roomId).room);
  const first=await store.applyAction(a.roomId,favorite('adoption',true)),writes=f.writes;
  const again=await f.store().applyAction(a.roomId,favorite('adoption',true));
  assert.equal(again.duplicate,true);assert.equal(f.writes,writes);assert.equal(again.revision,first.revision);
  assert.deepEqual(f.files.get(b.roomId).room,before);
  assert.deepEqual((await f.store().getRoom(b.roomId)).state.diary.favorites,[]);
  const second=await f.store().applyAction(b.roomId,favorite('adoption',false));assert.deepEqual(second.state.diary.favorites,[]);
  assert.deepEqual((await f.store().getRoom(a.roomId)).state.diary.favorites,['adoption']);
});
test('concurrent favorites merge through CAS instead of dropping a partner favorite',async()=>{
  const f=fixture(),a=f.store(),b=f.store(),created=await a.createRoom();
  const state=f.files.get(created.roomId).room.state;
  state.diary.entries.push({id:'level:2',kind:'level',level:2,at:NOW,catName:'糯米',photo:'happy'});
  await Promise.all([a.applyAction(created.roomId,favorite('adoption',true,'memory-favorite-first')),b.applyAction(created.roomId,{...favorite('level:2',true,'memory-favorite-second'),clientId:'partner-female',name:'女方'})]);
  const saved=await f.store().getRoom(created.roomId);assert.deepEqual(new Set(saved.state.diary.favorites),new Set(['adoption','level:2']));assert.equal(saved.revision,2);
});
test('a long-lived journal survives the old generic room size limit without cutting off old favorites',async()=>{
  const f=fixture(),created=await f.store().createRoom(),state=f.files.get(created.roomId).room.state;
  for(let level=2;level<=2500;level++)state.diary.entries.push({id:`level:${level}`,kind:'level',level,at:NOW,catName:'糯米',photo:'happy'});
  state.diary.favorites=['adoption','level:2'];
  const saved=await f.store().getRoom(created.roomId);assert.equal(saved.state.diary.entries.length,2500);assert.deepEqual(saved.state.diary.favorites,['adoption','level:2']);
});
test('favorite requests cannot inject memories, image payloads or malformed IDs',()=>{
  assert.ok(sanitizeAction({type:'diary-favorite',memoryId:'adoption',favorite:true}));
  for(const action of [{type:'diary-favorite',memoryId:'adoption',favorite:'true'},{type:'diary-favorite',memoryId:'../../room',favorite:true},{type:'diary-favorite',memoryId:'adoption',favorite:true,entries:[]},{type:'diary-favorite',memoryId:'adoption',favorite:true,photo:'data:image/png;base64,bad'}])assert.equal(sanitizeAction(action),null);
});
test('the cloud client restores shared favorites after a fresh device and applies a partner update',async t=>{
  const before=initialState(NOW),after=structuredClone(before);after.diary.favorites=['adoption'];
  const id='a'.repeat(32);let source,last;
  class Source {listeners=new Map();constructor(){source=this;}addEventListener(type,fn){this.listeners.set(type,fn);}close(){} }
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const client=createCloudRoom({apiBase:'https://offline.test',coupleRole:'female',homeRoomId:id,eventSourceFactory:()=>new Source(),fetchImpl:async()=>Response.json({roomId:id,revision:0,state:before}),onRoom(){},onState:value=>last=value,onPresence(){},onAction(){},onStatus(){},onSaveStatus(){},onPending(){}});
  t.after(()=>client.destroy());await client.start();assert.deepEqual(last.diary.favorites,[]);
  source.listeners.get('state')({data:JSON.stringify({roomId:id,revision:1,state:after})});assert.deepEqual(last.diary.favorites,['adoption']);
});
