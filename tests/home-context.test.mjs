import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { homeContext, homeStorageKey, initialHomeState, EVIAN_ROOM_ID } from '../src/home-context.js';
import { createLocalPreviewStore, PREVIEW_HOME } from '../scripts/local-pet-preview.mjs';
import { namedHomeHtml, namedHomeEntry } from '../scripts/named-home-entry.mjs';

test('only the named Evian entry selects its fixed, separate save',()=>{
  for (const path of ['/evian','/evian/','/cat-nest/evian/','/cat-nest/evian/index.html']) {
    const home=homeContext(path);
    assert.equal(home.id,'evian');assert.equal(home.roomId,EVIAN_ROOM_ID);
  }
  for (const path of ['/','/cat-nest/','/cat-nest/index.html','/test/','/evian-other/','/evian/other']) assert.equal(homeContext(path).id,'main');
  assert.notEqual(EVIAN_ROOM_ID,'0aed6937627c924a7497025ebd18fe5d');
});

test('every Evian cache and pending queue is isolated, while the existing keys remain unchanged',()=>{
  const old=homeContext('/cat-nest/'),evian=homeContext('/cat-nest/evian/');
  for (const key of ['catnest.role','catnest.room','catnest.couple.room','catnest.state.saved-room','catnest.pending.couple.male','catnest.pending.couple.female','catnest.food']) {
    assert.equal(homeStorageKey(key,old),key);
    assert.equal(homeStorageKey(key,evian),`evian:${key}`);
  }
  const values=new Map([['catnest.state.saved-room',{coins:9000,xp:10000}]]);
  assert.equal(values.get(homeStorageKey('catnest.state.saved-room',evian)),undefined);
});

test('a fresh Evian home starts at 1200 coins and zero progress without resetting an existing save',()=>{
  const first=initialHomeState(homeContext('/evian/'),1_800_000_000_000);
  assert.deepEqual([first.coins,first.xp,first.love],[1200,0,0]);
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
  assert.equal((await evian.getRoom(EVIAN_ROOM_ID)).state.coins,1200);
  await evian.applyAction(EVIAN_ROOM_ID,{operationId:'evian-drink-test',clientId:'partner-male',name:'男方',action:{type:'feed',food:'water'}});
  const reopened=createLocalPreviewStore({file,homeId:EVIAN_ROOM_ID,seedState,now});
  assert.equal((await reopened.getRoom(EVIAN_ROOM_ID)).state.coins,1195);
  const unchanged=await original.getRoom(PREVIEW_HOME);
  assert.equal(unchanged.state.coins,1200);assert.deepEqual(unchanged.state.pendingGrowth,[]);
  await assert.rejects(evian.getRoom(PREVIEW_HOME),error=>error.code==='ROOM_NOT_FOUND');
});

test('the deployed nested entry shares parent assets and keeps its own home link',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'evian-entry-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const source='<html><head><script src="./assets/app.js"></script></head><body></body></html>';
  await mkdir(join(dir,'dist'));await writeFile(join(dir,'dist/index.html'),source);
  const plugin=namedHomeEntry();plugin.configResolved({command:'build',root:dir,build:{outDir:'dist'}});
  await plugin.closeBundle();
  const nested=await readFile(join(dir,'dist/evian/index.html'),'utf8');
  assert.match(nested,/<base href="\.\.\/">/);
  assert.equal(await readFile(join(dir,'dist/index.html'),'utf8'),source);
  const base=new URL('../','https://stevencheninfilm.com/cat-nest/evian/');
  assert.equal(new URL('./assets/app.js',base).href,'https://stevencheninfilm.com/cat-nest/assets/app.js');
  assert.equal(new URL(homeContext('/evian/').href,base).href,'https://stevencheninfilm.com/cat-nest/evian/');
  assert.match(namedHomeHtml(source,'/'),/<base href="\/">/);
  assert.throws(()=>namedHomeHtml('<head><base href="/">'),/without an existing base/);
});
