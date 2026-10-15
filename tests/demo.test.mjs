import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { namespacedStorage, DEMO_PREFIX, DEMO_PREFERENCES_PREFIX, createMemoryStorage, clearLegacyDemoProgress } from '../demo/storage.js';
import { initializeDemoVisit } from '../demo/visit.js';
import { createDemoEngine, DEMO_ACTORS, DEMO_ROOM } from '../demo/engine.js';
import { createDemoCourt } from '../demo/court-engine.js';
import { validCoupleCare } from '../src/couple-care.js';
import { validCollection, COLLECTION_CATS, collectionCatProgress } from '../src/cat-collection.js';
import { FOODS, levelInfo } from '../src/state.js';
const time=Date.now();
function store() { const data=new Map();return {data,get length(){return data.size;},key:index=>[...data.keys()][index] ?? null,getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}; }
function setup() { const storage=store();return {storage,engine:createDemoEngine({storage,now:()=>time})}; }

test('demo storage never reads, changes, or deletes an existing real save',()=>{
  const raw=store();raw.setItem('catnest.role','"female"');raw.setItem('catnest.state.real','private-data');
  const isolated=namespacedStorage(raw);assert.equal(isolated.getItem('catnest.role'),null);
  isolated.setItem('catnest.role','"male"');assert.equal(raw.getItem('catnest.role'),'"female"');
  isolated.removeItem('catnest.role');assert.equal(raw.getItem('catnest.state.real'),'private-data');
  assert.equal(raw.getItem(DEMO_PREFIX+'catnest.role'),null);
});
test('blocked storage still preserves changes in memory',()=>{
  const raw={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
  const isolated=namespacedStorage(raw);isolated.setItem('a','1');assert.equal(isolated.getItem('a'),'1');isolated.removeItem('a');assert.equal(isolated.getItem('a'),null);
});
test('demo seed contains both feeding portions, bubbles and valid two-person records',()=>{
  const {engine}=setup(),snap=engine.snapshot();assert.equal(snap.roomId,DEMO_ROOM);assert.equal(snap.state.feedRecords.length,2);
  assert.equal(snap.state.pendingGrowth.length,3);assert.ok(validCoupleCare(snap.state.coupleCare));assert.equal(snap.state.coupleCare.moments[0].kind,'meal');
});
test('accepted care updates the current visit and duplicate operation IDs award only once',()=>{
  const {engine,storage}=setup();const item={clientId:DEMO_ACTORS.male.id,operationId:'demo-test-operation-01',action:{type:'play'}};
  const before=engine.snapshot();assert.equal(engine.action(item).status,200);const after=engine.snapshot();
  assert.equal(after.revision,before.revision+1);assert.equal(after.state.coupleCare.moments.length,2);
  assert.equal(engine.action(item).status,200);assert.equal(engine.snapshot().revision,after.revision);
  const sameVisit=createDemoEngine({storage,now:()=>time});assert.deepEqual(sameVisit.snapshot(),after);
});
test('rejected care changes neither bubbles nor saved state',()=>{
  const {engine}=setup();const before=engine.snapshot();assert.equal(engine.action({clientId:DEMO_ACTORS.female.id,operationId:'demo-test-reject-01',action:{type:'pet'}}).status,409);assert.deepEqual(engine.snapshot(),before);
});
test('demo scenario unlocks basic achievements without bypassing diary-card goals',()=>{
  const {engine}=setup();engine.scenario('unlock');const state=engine.snapshot().state;
  assert.ok(state.xp>10000);assert.ok(validCollection(state.collection,Object.keys(FOODS)));
  assert.ok(COLLECTION_CATS.slice(0,24).every(cat=>collectionCatProgress(cat,state.collection,levelInfo(state.xp).level,state.diary).complete));
  assert.ok(collectionCatProgress(COLLECTION_CATS[24],state.collection,1,state.diary).complete);
  assert.equal(collectionCatProgress(COLLECTION_CATS[35],state.collection,1,state.diary).complete,false);
  assert.equal(state.collection.invited.length,0);
  engine.scenario('portion');assert.equal(engine.snapshot().state.feedRecords.length,2);
  engine.reset();assert.equal(engine.snapshot().state.xp,400);
});
test('separate demo visits do not share unlocks or resume saved play',()=>{
  const first=createMemoryStorage(),second=createMemoryStorage();
  const a=createDemoEngine({storage:first,now:()=>time}),b=createDemoEngine({storage:second,now:()=>time});
  first.setItem('catnest.role','"female"');a.scenario('unlock');b.sync();
  assert.ok(a.snapshot().state.xp>10000);assert.equal(b.snapshot().state.xp,400);assert.equal(second.getItem('catnest.role'),null);
});
test('refreshing starts default pet, games, requests and court instead of the prior visit',()=>{
  const oldLocal=createMemoryStorage(),oldSession=createMemoryStorage();
  const oldEngine=createDemoEngine({storage:oldLocal,now:()=>time});
  oldEngine.scenario('unlock');createDemoCourt(oldEngine,{now:()=>time}).showcase();
  oldLocal.setItem('catnest.role','"female"');oldLocal.setItem('catnest.pending.preview.female','[{"action":{"type":"pet"}}]');
  oldSession.setItem('catcourt.session.demo','old-session');
  oldEngine.action({clientId:DEMO_ACTORS.female.id,operationId:'demo-previous-game-01',action:{type:'game-create',game:'rps',mode:'duo',previousId:null}});
  assert.ok(oldEngine.snapshot().state.games.match);
  const freshLocal=createMemoryStorage(),freshSession=createMemoryStorage(),fresh=createDemoEngine({storage:freshLocal,now:()=>time});
  assert.equal(fresh.snapshot().state.xp,400);assert.equal(fresh.snapshot().state.coins,11960);
  assert.equal(fresh.snapshot().state.games.match,null);assert.equal(fresh.getCourt(),null);
  assert.equal(freshLocal.getItem('catnest.role'),null);assert.equal(freshLocal.getItem('catnest.pending.preview.female'),null);assert.equal(freshSession.getItem('catcourt.session.demo'),null);
});
test('legacy cleanup clears only old demo keys and preserves real saves and guide preference',()=>{
  const raw=store();
  const preserved={'catnest.role':'"male"','catnest.state.real':'real-pet','catcourt.session.real':'real-court',[`${DEMO_PREFERENCES_PREFIX}welcome`]:'done'};
  for(const [key,value] of Object.entries(preserved))raw.setItem(key,value);
  for(const key of ['server','catnest.role','catcourt.session.demo','catnest.pending.preview.male'])raw.setItem(DEMO_PREFIX+key,'old-demo');
  clearLegacyDemoProgress(raw);
  for(const [key,value] of Object.entries(preserved))assert.equal(raw.getItem(key),value);
  assert.equal(raw.length,Object.keys(preserved).length);
  assert.doesNotThrow(()=>clearLegacyDemoProgress(null));assert.doesNotThrow(()=>clearLegacyDemoProgress({get length(){throw Error('blocked');}}));
});
test('a restored browser history page reloads while an ordinary first load does not',()=>{
  const listeners=new Map();let reloads=0,cleaned;
  initializeDemoVisit({location:{href:'https://example.com/test/?court=oldcase&room=oldroom&mode=judge&campaign=demo',reload(){reloads++;}},history:{replaceState(_state,_title,url){cleaned=new URL(url);}},addEventListener:(name,handler)=>listeners.set(name,handler)});
  assert.equal(cleaned.searchParams.has('court'),false);assert.equal(cleaned.searchParams.has('room'),false);assert.equal(cleaned.searchParams.has('mode'),false);assert.equal(cleaned.searchParams.get('campaign'),'demo');
  listeners.get('pageshow')({persisted:false});assert.equal(reloads,0);listeners.get('pageshow')({persisted:true});assert.equal(reloads,1);
});
test('simulated partner joins and plays a real duo game without exposing hidden hands',()=>{
  const {engine}=setup();
  engine.action({clientId:DEMO_ACTORS.male.id,operationId:'demo-game-test-01',action:{type:'game-create',game:'rps',mode:'duo',previousId:null}});
  assert.equal(engine.snapshot().state.games.match.status,'waiting');
  assert.equal(engine.partnerGame(DEMO_ACTORS.male.id),true);
  assert.equal(engine.snapshot().state.games.match.players.length,2);
  assert.equal(engine.partnerGame(DEMO_ACTORS.male.id),true);
  assert.equal(engine.snapshot().state.games.match.locked[1],true);
  assert.equal('secret' in engine.snapshot().state.games.match,false);
});
test('court create, claim, submit, repair and appeal use fictional browser records',()=>{
  const {engine}=setup(),court=createDemoCourt(engine,{now:()=>time});
  assert.equal(court.request('/config','GET').data.configured,true);
  court.request('/rooms','POST',{title:'演示案例'});
  const claim=court.request('/rooms/demo00000001/claim','POST',{role:'a',name:'演示访客'});assert.equal(claim.data.token,'demo-a');
  const result=court.request('/rooms/demo00000001/submit','POST',{statement:'虚构陈词',images:[]},{Authorization:'Bearer demo-a'});
  assert.equal(result.data.room.rounds[0].status,'judged');assert.match(result.data.room.rounds[0].verdict.model,/未调用 AI/);
  const task=result.data.room.rounds[0].repair.tasks[0];court.request('/rooms/demo00000001/repair','POST',{roundId:'demo-round-1',taskId:task.id,confirmed:true});
  assert.equal(engine.getCourt().rounds[0].repair.tasks[0].confirmations.a,true);
  court.request('/rooms/demo00000001/appeal','POST',{statement:'补充演示'});assert.equal(engine.getCourt().rounds.length,2);
});
test('closed transport blocks production hosts and unknown endpoints',async()=>{
  const {demoFetch,demoEngine}=await import('../demo/transport.js');demoEngine.controls.latency=0;
  await assert.rejects(()=>demoFetch('https://cat-nest-api.onrender.com/api/couple/home'),/禁止连接正式服务器/);
  assert.equal((await demoFetch('https://demo.cat-nest.invalid/api/not-allowed',{method:'POST'})).status,404);
  const before=demoEngine.snapshot();demoEngine.controls.rejectNext=true;
  const result=await demoFetch(`https://demo.cat-nest.invalid/api/rooms/${DEMO_ROOM}/actions`,{method:'POST',body:JSON.stringify({clientId:DEMO_ACTORS.male.id,operationId:'demo-test-network-reject',action:{type:'pet'}})});
  assert.equal(result.status,409);assert.deepEqual(demoEngine.snapshot(),before);
  demoEngine.setOffline(true);await assert.rejects(()=>demoFetch('https://demo.cat-nest.invalid/api/couple/home'),/网络已断开/);demoEngine.setOffline(false);
});
