import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOME_ENTRIES, homeContext, validateHomes } from '../src/home-context.js';
import { scopedStorage } from '../src/home-storage.js';
import { createHomeRuntime } from '../src/app-runtime.js';
import { createMemoryStorage } from '../demo/storage.js';
import { demoFetch, DemoEventSource, DEMO_ORIGIN, demoEngine } from '../demo/transport.js';
import { createCloudRoom } from '../src/cloud.js';
import { verifySharedBuild } from '../scripts/verify-shared-build.mjs';

test('all save data is scoped, preserving Steven and Evian existing keys exactly',()=>{
  const raw=createMemoryStorage();
  const namespaces=HOME_ENTRIES.filter(home=>!home.isTest).map(home=>scopedStorage(raw,home));
  const keys=['catnest.role','catnest.state.original','catnest.pending.couple.male','catnest.pending.couple.female','catnest.food','catnest.sound','catnest.couple.seen','catcourt.session.case','catcourt.draft.case'];
  for(const key of keys) {
    namespaces[0].setItem(key,'Steven-original');namespaces[1].setItem(key,'Evian-original');
    assert.equal(namespaces[0].getItem(key),'Steven-original');assert.equal(namespaces[1].getItem(key),'Evian-original');
    assert.equal(raw.getItem(key),'Steven-original');assert.equal(raw.getItem(`evian:${key}`),'Evian-original');
    namespaces[1].removeItem(key);assert.equal(namespaces[0].getItem(key),'Steven-original');
  }
  assert.throws(()=>scopedStorage(raw,homeContext('/not-a-home/')).getItem('catnest.role'),/未知存档/);
});

test('a future save adds only configuration and receives no other save cache or pending writes',()=>{
  const additional={id:'new-friends',label:'新朋友',source:'room',roomId:'e'.repeat(32),storagePrefix:'new-friends:'};
  assert.equal(validateHomes([...HOME_ENTRIES,additional]).length,4);
  const raw=createMemoryStorage(),original=scopedStorage(raw,HOME_ENTRIES[0]),fresh=scopedStorage(raw,additional);
  original.setItem('catnest.pending.couple.male','original-pending');
  assert.equal(fresh.getItem('catnest.pending.couple.male'),null);
  fresh.setItem('catnest.state.saved','new-save');assert.equal(original.getItem('catnest.state.saved'),null);
  for(const corrupt of [{...additional,id:'evian'},{...additional,storagePrefix:''},{...additional,roomId:HOME_ENTRIES[1].roomId},{...additional,source:'couple'},{...additional,id:'assets'}])assert.throws(()=>validateHomes([...HOME_ENTRIES,corrupt]));
});

test('formal runtimes preserve their original cloud API and isolate court sessions too',()=>{
  const raw=createMemoryStorage(),session=createMemoryStorage(),apiBase='https://api.example.test';
  const first=createHomeRuntime({home:HOME_ENTRIES[0],apiBase,localStorage:raw,sessionStorage:session});
  const second=createHomeRuntime({home:HOME_ENTRIES[1],apiBase,localStorage:raw,sessionStorage:session});
  first.sessionStorage.setItem('catcourt.session.case','original-token');
  assert.equal(second.sessionStorage.getItem('catcourt.session.case'),null);
  assert.equal(first.courtApi,`${apiBase}/api/court`);assert.equal(second.apiBase,apiBase);
  assert.equal(first.home.roomId,null);assert.equal(second.home.roomId,HOME_ENTRIES[1].roomId);
  assert.throws(()=>createHomeRuntime({home:homeContext('/unknown/')}),/有效存档/);
  assert.throws(()=>createHomeRuntime({home:HOME_ENTRIES[0],testAdapter:{}}),/正式存档/);
  assert.throws(()=>createHomeRuntime({home:HOME_ENTRIES[2]}),/隔离接口/);
});

test('the common cloud client completes a test action through its injected adapter without touching real storage or network',async t=>{
  let productionCalls=0;
  const raw=createMemoryStorage();raw.setItem('catnest.state.original','unchanged');
  t.mock.method(globalThis,'fetch',()=>{productionCalls++;throw Error('must not reach production');});
  demoEngine.reset();demoEngine.controls.latency=0;
  const runtime=createHomeRuntime({home:HOME_ENTRIES[2],apiBase:'https://cat-nest-api.onrender.com',localStorage:raw,sessionStorage:raw,testAdapter:{apiBase:DEMO_ORIGIN,fetch:demoFetch,eventSourceFactory:url=>new DemoEventSource(url),localStorage:createMemoryStorage(),sessionStorage:createMemoryStorage()}});
  runtime.localStorage.setItem('catnest.role','male');runtime.sessionStorage.setItem('catcourt.session.case','test-token');
  assert.equal(raw.getItem('catnest.role'),null);assert.equal(raw.getItem('catcourt.session.case'),null);
  let last,finish;const saved=new Promise(resolve=>finish=resolve);
  const client=createCloudRoom({apiBase:runtime.apiBase,coupleRole:'male',homeRoomId:runtime.home.roomId,fetchImpl:runtime.fetch,eventSourceFactory:runtime.eventSourceFactory,
    onRoom(){},onPresence(){},onStatus(){},onSaveStatus(){},onPending(){},onAction(){finish();},onState(value){last=value;}});
  t.after(()=>client.destroy());await client.start();const xp=last.xp;
  assert.equal(client.dispatch({type:'play'}),true);await saved;
  assert.equal(last.xp,xp,'a care action only generates a collectible bubble');
  assert.ok(last.pendingGrowth.some(reward=>reward.kind==='play'));
  assert.equal(productionCalls,0);assert.equal(raw.getItem('catnest.state.original'),'unchanged');
  await assert.rejects(()=>runtime.fetch('https://cat-nest-api.onrender.com/api/court/rooms',{method:'POST'}),/禁止连接/);
});

test('build verification rejects drifted entry HTML and copied per-save bundles',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'shared-app-build-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const html='<head><base href="../"><script type="module" src="/cat-nest/assets/entry.js"></script></head>';
  await mkdir(join(dir,'assets'));await writeFile(join(dir,'assets/entry.js'),'one app');
  for(const {id} of HOME_ENTRIES){await mkdir(join(dir,id));await writeFile(join(dir,id,'index.html'),html);}
  assert.deepEqual((await verifySharedBuild(dir)).entries,['steven','evian','test']);
  await writeFile(join(dir,'test/index.html'),html+'different');await assert.rejects(()=>verifySharedBuild(dir),/不同的应用入口/);
  await writeFile(join(dir,'test/index.html'),html);await mkdir(join(dir,'test/assets'));await assert.rejects(()=>verifySharedBuild(dir),/资源副本/);
});

test('there is one application source and one build step; the test tool imports the common reducer',async()=>{
  await assert.rejects(()=>access(new URL('../demo/app/',import.meta.url)));
  await assert.rejects(()=>access(new URL('../demo/vite.config.mjs',import.meta.url)));
  const workflow=await readFile(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8');
  assert.doesNotMatch(workflow,/build-demo|dist-demo/);
  const engine=await readFile(new URL('../demo/engine.js',import.meta.url),'utf8');assert.match(engine,/from '\.\.\/src\/state.js'/);
  const controls=await readFile(new URL('../demo/controls.js',import.meta.url),'utf8');assert.doesNotMatch(controls,/import ['"].*main.js/);
});
