import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_ENTRIES, homeContext, homeTitle, homeStorageKey, initialHomeState, EVIAN_ROOM_ID, validateHomes } from '../src/home-context.js';
import { createLocalPreviewStore, PREVIEW_HOME } from '../scripts/local-pet-preview.mjs';
import { namedHomeHtml, namedHomeEntry } from '../scripts/named-home-entry.mjs';

test('only the named Evian entry selects its fixed, separate save',()=>{
  for (const path of ['/evian','/evian/','/cat-nest/evian/','/cat-nest/evian/index.html']) {
    const home=homeContext(path);
    assert.equal(home.id,'evian');assert.equal(home.roomId,EVIAN_ROOM_ID);
  }
  for (const path of ['/','/cat-nest/','/cat-nest/index.html']) assert.equal(homeContext(path).id,'main');
  assert.equal(homeContext('/test/').id,'test');
  for (const path of ['/evian-other/','/evian/other']) assert.equal(homeContext(path).id,'unknown');
  assert.notEqual(EVIAN_ROOM_ID,'0aed6937627c924a7497025ebd18fe5d');
});

test('every Evian cache and pending queue is isolated, while the existing keys remain unchanged',()=>{
  const old=homeContext('/cat-nest/'),evian=homeContext('/cat-nest/evian/');
  for (const key of ['catnest.role','catnest.room','catnest.couple.room','catnest.state.saved-room','catnest.pending.couple.male','catnest.pending.couple.female','catnest.food']) {
    assert.equal(homeStorageKey(key,old),key);
    assert.equal(homeStorageKey(key,homeContext('/cat-nest/steven/')),key);
    assert.equal(homeStorageKey(key,evian),`evian:${key}`);
  }
  const values=new Map([['catnest.state.saved-room',{coins:9000,xp:10000}]]);
  assert.equal(values.get(homeStorageKey('catnest.state.saved-room',evian)),undefined);
});

test('a fresh Evian home starts at 100 coins and zero progress without resetting an existing save',()=>{
  const first=initialHomeState(homeContext('/evian/'),1_800_000_000_000);
  assert.deepEqual([first.coins,first.xp,first.love],[100,0,0]);
  assert.deepEqual(first.history,[]);assert.deepEqual(first.pendingGrowth,[]);assert.deepEqual(first.collection.invited,[]);
  assert.ok(Object.values(first.careLimits.counts).every(count=>count===0));
  const original=initialHomeState(homeContext('/'),1_800_000_000_000);
  assert.equal(original.xp,86);assert.equal(original.love,86);
});

test('local Evian care persists separately and reload never grants its starting coins again',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'evian-save-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const now=()=>1_800_000_000_000;
  const seedState=at=>initialHomeState(homeContext('/evian/'),at);
  const original=createLocalPreviewStore({file:join(dir,'home.json'),now});
  const file=join(dir,'evian.json'),evian=createLocalPreviewStore({file,homeId:EVIAN_ROOM_ID,seedState,now});
  assert.equal((await evian.getRoom(EVIAN_ROOM_ID)).state.coins,100);
  await evian.applyAction(EVIAN_ROOM_ID,{operationId:'evian-drink-test',clientId:'partner-male',name:'男方',action:{type:'feed',food:'water'}});
  const reopened=createLocalPreviewStore({file,homeId:EVIAN_ROOM_ID,seedState,now});
  assert.equal((await reopened.getRoom(EVIAN_ROOM_ID)).state.coins,95);
  const unchanged=await original.getRoom(PREVIEW_HOME);
  assert.equal(unchanged.state.coins,100);assert.deepEqual(unchanged.state.pendingGrowth,[]);
  await assert.rejects(evian.getRoom(PREVIEW_HOME),error=>error.code==='ROOM_NOT_FOUND');
});

test('the deployed nested entry shares parent assets and keeps its own home link',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'evian-entry-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const source='<html><head><script src="./assets/app.js"></script></head><body></body></html>';
  await mkdir(join(dir,'dist'));await writeFile(join(dir,'dist/index.html'),source);
  const plugin=namedHomeEntry();plugin.configResolved({command:'build',root:dir,build:{outDir:'dist'}});
  await plugin.closeBundle();
  const nested=await readFile(join(dir,'dist/evian/index.html'),'utf8');
  assert.equal(await readFile(join(dir,'dist/steven/index.html'),'utf8'),nested);
  assert.equal(await readFile(join(dir,'dist/test/index.html'),'utf8'),nested);
  assert.match(nested,/<base href="\.\.\/">/);
  const redirect=await readFile(join(dir,'dist/index.html'),'utf8');
  assert.match(redirect,/url=\.\/test\//);assert.match(redirect,/location.replace/);assert.doesNotMatch(redirect,/assets\/app.js|steven|evian/);
  const base=new URL('../','https://stevencheninfilm.com/cat-nest/evian/');
  assert.equal(new URL('./assets/app.js',base).href,'https://stevencheninfilm.com/cat-nest/assets/app.js');
  assert.equal(new URL(homeContext('/evian/').href,base).href,'https://stevencheninfilm.com/cat-nest/evian/');
  assert.match(namedHomeHtml(source,'/'),/<base href="\/">/);
  assert.throws(()=>namedHomeHtml('<head><base href="/">'),/without an existing base/);
});


test('Steven uses the original home and unchanged browser keys while keeping navigation private',()=>{
 for(const path of ['/steven','/steven/','/cat-nest/steven/','/cat-nest/steven/index.html']) {
  const home=homeContext(path);assert.equal(home.id,'steven');assert.equal(home.roomId,null);assert.equal(home.href,'./steven/');
 }
 assert.equal(homeContext('/steven/other/').id,'unknown');
});

test('Todd uses its own permanent room, title and storage namespace',()=>{
  const todd=homeContext('/todd/');
  for(const path of ['/todd','/cat-nest/todd/','/cat-nest/todd/index.html'])assert.equal(homeContext(path),todd);
  assert.equal(homeTitle(todd),'Todd 猫猫小窝');
  assert.equal(homeTitle(homeContext('/steven/')),'Steven 猫猫小窝');
  assert.equal(homeTitle(homeContext('/evian/')),'Evian · 猫猫小窝');
  assert.equal(todd.source,'room');assert.notEqual(todd.roomId,EVIAN_ROOM_ID);
  for(const key of ['catnest.role','catnest.state.saved','catnest.pending.couple.male','catnest.couple.seen','catcourt.session.case','catcourt.draft.case'])assert.equal(homeStorageKey(key,todd),`todd:${key}`);
  const state=initialHomeState(todd,1_800_000_000_000);
  assert.deepEqual([state.coins,state.xp,state.love],[100,0,0]);
  assert.deepEqual(state.history,[]);assert.deepEqual(state.pendingGrowth,[]);assert.deepEqual(state.homeBond.owners,[]);
});

for(const home of HOME_ENTRIES.filter(home=>home.source==='room')) {
test(`${home.label} resolves only its own entry and storage namespace`,()=>{
  for(const path of [`/${home.id}`,`/${home.id}/`,`/cat-nest/${home.id}/`,`/cat-nest/${home.id}/index.html`])assert.equal(homeContext(path),home);
  assert.equal(homeContext(`/${home.id}/other/`).id,'unknown');
  assert.equal(homeTitle(home),home.title || `${home.label} · 猫猫小窝`);
  for(const key of ['catnest.role','catnest.room','catnest.state.saved','catnest.pending.couple.male','catnest.pending.couple.female','catnest.couple.seen','catcourt.session.case','catcourt.draft.case'])assert.equal(homeStorageKey(key,home),`${home.id}:${key}`);
  const state=initialHomeState(home,1_800_000_000_000);
  assert.deepEqual([state.coins,state.xp,state.love],[100,0,0]);
  assert.deepEqual(state.history,[]);assert.deepEqual(state.pendingGrowth,[]);assert.deepEqual(state.homeBond.owners,[]);
});

test(`${home.label} saves spending once and reloading never refills its starting balance`,async t=>{
  const dir=await mkdtemp(join(tmpdir(),`${home.id}-save-test-`));t.after(()=>rm(dir,{recursive:true,force:true}));
  const now=()=>1_800_000_000_000;
  const options={file:join(dir,`${home.id}.json`),homeId:home.roomId,seedState:at=>initialHomeState(home,at),now};
  const store=createLocalPreviewStore(options);
  assert.equal((await store.getRoom(home.roomId)).state.coins,100);
  await store.applyAction(home.roomId,{operationId:`${home.id}-drink-test`,clientId:'partner-male',name:'男方',action:{type:'feed',food:'water'}});
  const reopened=createLocalPreviewStore(options);
  assert.equal((await reopened.getRoom(home.roomId)).state.coins,95);
  for(const other of HOME_ENTRIES.filter(other=>other.roomId && other.roomId!==home.roomId))await assert.rejects(()=>reopened.getRoom(other.roomId),error=>error.code==='ROOM_NOT_FOUND');
});
}


test('mixed-case save entries preserve their spelling and reject case collisions and reserved paths',()=>{
  assert.equal(homeContext('/Crown/').id,'Crown');
  for(const path of ['/crown/','/CROWN/'])assert.equal(homeContext(path).id,'unknown');
  const additional={id:'CrowN',label:'Duplicate',source:'room',roomId:'e'.repeat(32),storagePrefix:'CrowN:'};
  assert.throws(()=>validateHomes([...HOME_ENTRIES,additional]),/存档网址无效或重复/);
  for(const id of ['Assets','API','Model','Index','Monitor'])assert.throws(()=>validateHomes([...HOME_ENTRIES,{...additional,id,storagePrefix:`${id}:` }]),/存档网址无效或重复/);
});

test('shared local preview recognizes production-style home paths and supplies the common asset base',async()=>{
  const plugin=namedHomeEntry();plugin.configResolved({command:'serve',root:fileURLToPath(new URL('..',import.meta.url)),build:{outDir:'dist'}});
  let handle;plugin.configureServer({middlewares:{use(fn){handle=fn;}},transformIndexHtml:async(path,html)=>html});
  for(const path of ['/test/','/cat-nest/test/index.html','/cat-nest/steven/','/cat-nest/oliver/']){
    let html,passed=false;await handle({url:path},{setHeader(){},end(value){html=value;}},()=>{passed=true;});
    assert.equal(passed,false);assert.match(html,/<base href="\/">/);
  }
  let location;await handle({url:'/cat-nest/'},{writeHead(status,headers){assert.equal(status,302);location=headers.Location;},end(){}},()=>assert.fail('known public entry'));
  assert.equal(location,'/cat-nest/test/');
  let next=false;await handle({url:'/cat-nest/unknown/'},{},()=>{next=true;});assert.equal(next,true);
});
