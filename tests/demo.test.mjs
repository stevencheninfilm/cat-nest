import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { namespacedStorage, DEMO_PREFIX } from '../demo/storage.js';
import { createDemoEngine, DEMO_ACTORS, DEMO_ROOM } from '../demo/engine.js';
import { createDemoCourt } from '../demo/court-engine.js';
import { validCoupleCare } from '../demo/app/couple-care.js';
import { validCollection, COLLECTION_CATS, collectionCatProgress } from '../demo/app/cat-collection.js';
import { FOODS, levelInfo } from '../demo/app/state.js';
const time=Date.now();
function store() { const data=new Map();return {data,getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}; }
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
test('accepted care persists on reload and duplicate operation IDs award only once',()=>{
  const {engine,storage}=setup();const item={clientId:DEMO_ACTORS.male.id,operationId:'demo-test-operation-01',action:{type:'play'}};
  const before=engine.snapshot();assert.equal(engine.action(item).status,200);const after=engine.snapshot();
  assert.equal(after.revision,before.revision+1);assert.equal(after.state.coupleCare.moments.length,2);
  assert.equal(engine.action(item).status,200);assert.equal(engine.snapshot().revision,after.revision);
  const reopened=createDemoEngine({storage,now:()=>time});assert.deepEqual(reopened.snapshot(),after);
});
test('rejected care changes neither bubbles nor saved state',()=>{
  const {engine}=setup();const before=engine.snapshot();assert.equal(engine.action({clientId:DEMO_ACTORS.female.id,operationId:'demo-test-reject-01',action:{type:'pet'}}).status,409);assert.deepEqual(engine.snapshot(),before);
});
test('demo scenario unlocks all collection conditions without malformed data',()=>{
  const {engine}=setup();engine.scenario('unlock');const state=engine.snapshot().state;
  assert.ok(state.xp>10000);assert.ok(validCollection(state.collection,Object.keys(FOODS)));
  assert.ok(COLLECTION_CATS.every(cat=>collectionCatProgress(cat,state.collection,levelInfo(state.xp).level).complete));
  engine.scenario('portion');assert.equal(engine.snapshot().state.feedRecords.length,2);
  engine.reset();assert.equal(engine.snapshot().state.xp,400);
});
test('multiple demo engines reconcile newer snapshots only',()=>{
  const {engine,storage}=setup(),other=createDemoEngine({storage,now:()=>time});engine.scenario('unlock');other.sync();assert.deepEqual(other.snapshot(),engine.snapshot());
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
test('copied app has explicit storage and closed transports instead of production API bindings',async()=>{
  for (const file of ['main.js','cloud.js','court.js']) {
    const source=await readFile(new URL(`../demo/app/${file}`,import.meta.url),'utf8');
    if(file==='main.js') { assert.match(source,/demoLocalStorage as localStorage/);assert.match(source,/const apiBase = 'https:\/\/demo.cat-nest.invalid'/); }
    else assert.match(source,/demoFetch as fetch/);
  }
  const files=await readdir(new URL('../demo/app/',import.meta.url));
  for(const file of files.filter(file=>file.endsWith('.js') && !['main.js','court.js','cloud.js','court-history-preview.js','realtime.js'].includes(file))) {
    const source=await readFile(new URL(`../demo/app/${file}`,import.meta.url),'utf8');assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage|fetch|EventSource)\s*[.(]/,file);
  }
});
