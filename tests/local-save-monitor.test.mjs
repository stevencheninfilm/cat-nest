import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HOME_ENTRIES, initialHomeState, validateHomes } from '../src/home-context.js';
import { FOODS } from '../src/state.js';
import { createMonitorService, createMonitorHandler, summarizeHome, localSaveMonitor } from '../scripts/local-save-monitor.mjs';

const at=1_800_000_000_000;
const todd=HOME_ENTRIES.find(home=>home.id==='todd');
const room=(home,extra={})=>({roomId:home.roomId || 'a'.repeat(32),revision:3,state:{...initialHomeState(home,at),...extra}});
function cloudFake({broken=new Set(),calls=[],release='a'.repeat(40)}={}) {
  return async (url,options)=>{
    calls.push({url,options});
    if(broken.has(url))throw new Error('Sensitive upstream error');
    let value;
    if(new URL(url).pathname.endsWith('/version.json'))value={release,entries:HOME_ENTRIES.map(home=>home.id)};
    else if(url.endsWith('/api/health'))value={ok:true};
    else {
      const home=HOME_ENTRIES.find(home=>home.source==='couple' ? url.endsWith('/api/couple/home') : url.endsWith(`/api/rooms/${home.roomId}`));
      assert.ok(home,'only registered production saves are requested');value=room(home);
    }
    return {ok:true,json:async()=>value};
  };
}
function response() {
  return {status:null,headers:null,body:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
}
const request=(extra={})=>({url:'/__monitor/snapshot',method:'GET',headers:{host:'127.0.0.1:5174'},socket:{remoteAddress:'127.0.0.1'},...extra});

test('monitor lists all registered homes and excludes temporary test saves from cloud reads',async()=>{
  const calls=[],service=createMonitorService({fetchImpl:cloudFake({calls}),now:()=>at});
  const snapshot=await service.snapshot();
  assert.deepEqual(snapshot.entries.map(home=>home.id),HOME_ENTRIES.map(home=>home.id));
  assert.deepEqual(snapshot.entries.filter(home=>home.status==='ready').map(home=>home.id),['steven','evian','todd']);
  const testHome=snapshot.entries.find(home=>home.id==='test');
  assert.equal(testHome.status,'temporary');assert.equal(testHome.level,undefined);
  assert.equal(calls.filter(call=>call.url.includes('/api/rooms/')).length,2);
  assert.ok(calls.every(call=>call.options.method==='GET' && !call.options.body && !call.options.headers.Authorization));
  assert.equal(snapshot.version.synced,true);
  assert.ok(snapshot.entries.find(home=>home.id==='todd').coins===1200);
});

test('unclaimed bubbles remain separate from saved XP and private histories never leave the collector',()=>{
  const state={xp:120,coins:1195,pendingGrowth:[{id:'private-reward-id',amount:3.3,actor:'private actor'}],history:[{text:'private history'}],diary:{private:'diary'},homeBond:{version:1,owners:[],adoptedAt:null}};
  const original=room(todd,state),before=structuredClone(original);
  const summary=summarizeHome(todd,original,at);
  assert.equal(summary.level.level,2);assert.equal(summary.level.progress,0);assert.equal(summary.xp,120);
  assert.deepEqual(summary.pending,{count:1,amount:3.3});assert.equal(summary.coins,1195);
  for(const field of ['roomId','history','diary','feedRecords','pendingGrowth','state'])assert.equal(summary[field],undefined);
  assert.doesNotMatch(JSON.stringify(summary),/private history|private-reward-id|private actor/);
  assert.deepEqual(original,before,'reading never changes saved state');
});

test('offline needs decay is derived without a write, and meals follow the saved feeding window',()=>{
  const saved=room(todd,{needsUpdatedAt:at-2*60*60_000,hunger:31,mood:82,energy:76,feedRecords:[{actorId:'partner-male',name:'男方',food:'fish',at:at-60_000}],feedingWindow:{startedAt:at-60_000,bonusClaimed:false}});
  const row=summarizeHome(todd,saved,at);
  assert.deepEqual(row.needs,{hunger:27,mood:78,energy:72});assert.equal(row.attention,true);
  assert.equal(row.meals[0].fed,true);assert.equal(row.meals[0].food,FOODS.fish.name);assert.equal(row.meals[1].fed,false);
  assert.equal(saved.state.hunger,31);
});

test('a new registered save automatically joins monitoring without a separate implementation',async()=>{
  const extra={id:'friends',label:'朋友',source:'room',roomId:'f'.repeat(32),storagePrefix:'friends:'};
  let reads=0;
  const service=createMonitorService({homes:[...HOME_ENTRIES,extra],now:()=>at,fetchImpl:async(url,options)=>{
    if(url.endsWith(`/api/rooms/${extra.roomId}`)){reads++;return {ok:true,json:async()=>room(extra)};}
    return cloudFake()(url,options);
  }});
  const result=await service.snapshot();assert.equal(reads,1);assert.equal(result.entries.at(-1).id,'friends');
  assert.equal(result.version.synced,false,'a manifest missing the new save is flagged');
});

test('simultaneous refreshes share one collection and 30-second cache limits upstream reads',async()=>{
  let time=at;const calls=[];
  const service=createMonitorService({now:()=>time,fetchImpl:cloudFake({calls})});
  const [one,two]=await Promise.all([service.snapshot(),service.snapshot()]);
  assert.equal(one,two);const count=calls.length;
  await service.snapshot();assert.equal(calls.length,count);
  time+=30_001;await service.snapshot();assert.equal(calls.length,count*2);
});

test('partial failure preserves the last good metrics with an explicit stale status',async()=>{
  let time=at;const broken=new Set(),url=`https://cat-nest-api.onrender.com/api/rooms/${todd.roomId}`;
  const service=createMonitorService({now:()=>time,fetchImpl:cloudFake({broken})});
  const first=await service.snapshot();broken.add(url);time+=30_001;
  const next=await service.snapshot(),row=next.entries.find(home=>home.id==='todd');
  assert.equal(row.status,'stale');assert.equal(row.coins,1200);assert.equal(row.sampledAt,at);
  assert.equal(next.entries.find(home=>home.id==='steven').status,'ready');
  assert.doesNotMatch(JSON.stringify(next),/Sensitive upstream/);
  assert.equal(first.entries.find(home=>home.id==='todd').status,'ready');
});

test('a first read failure has no invented zero balance or level, and a mismatched room is rejected',async()=>{
  const service=createMonitorService({now:()=>at,fetchImpl:async(url,options)=>url.endsWith(`/api/rooms/${todd.roomId}`) ? {ok:true,json:async()=>room({...todd,roomId:'b'.repeat(32)})} : cloudFake()(url,options)});
  const row=(await service.snapshot()).entries.find(home=>home.id==='todd');
  assert.equal(row.status,'error');assert.equal(row.coins,undefined);assert.equal(row.level,undefined);
});

test('frontend/backend release mismatch is visible instead of claiming all entries are aligned',async()=>{
  const service=createMonitorService({now:()=>at,fetchImpl:async(url,options)=>cloudFake({release:url.startsWith('https://stevencheninfilm.com') ? 'a'.repeat(40):'b'.repeat(40)})(url,options)});
  assert.equal((await service.snapshot()).version.synced,false);
});

test('only local loopback requests can read the dashboard and collector, including before any cloud call',async()=>{
  let reads=0;const handle=createMonitorHandler({service:{snapshot:async()=>{reads++;return {ok:true};}}});
  for(const change of [
    {socket:{remoteAddress:'192.168.1.9'}},
    {headers:{host:'evil.example:5174'}},
    {headers:{host:'127.0.0.1:5174',origin:'https://evil.example'}},
    {headers:{host:'127.0.0.1:5174','sec-fetch-site':'cross-site'}},
    {headers:{host:'127.0.0.1:9999'}},
  ])for(const url of ['/monitor/','/__monitor/snapshot']){
    const res=response();await handle(request({...change,url}),res);assert.equal(res.status,403);
  }
  assert.equal(reads,0);
  for(const address of ['127.0.0.1','::1','::ffff:127.0.0.1']){
    const res=response();await handle(request({socket:{remoteAddress:address}}),res);
    assert.equal(res.status,200);assert.equal(res.headers['Cache-Control'],'no-store');
    assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);
  }
});

test('monitor never accepts writes, and failure replies do not expose internal errors',async()=>{
  let reads=0;const handle=createMonitorHandler({service:{snapshot:async()=>{reads++;throw new Error('secret details');}}});
  for(const method of ['POST','PUT','DELETE']){const res=response();await handle(request({method}),res);assert.equal(res.status,405);}
  assert.equal(reads,0);
  const res=response();await handle(request(),res);assert.equal(res.status,503);assert.doesNotMatch(res.body,/secret details/);
});

test('the monitor is a serve-only middleware and leaves application routes untouched',async()=>{
  assert.equal(localSaveMonitor().apply,'serve');
  assert.throws(()=>validateHomes([...HOME_ENTRIES,{id:'monitor',label:'保留入口',source:'room',roomId:'f'.repeat(32),storagePrefix:'monitor:'}]));
  let calls=0;const handle=createMonitorHandler();await handle(request({url:'/todd/'}),response(),()=>calls++);assert.equal(calls,1);
  const res=response();await handle(request({url:'/monitor/'}),res);assert.equal(res.status,200);assert.match(res.body,/local-save-monitor.js/);
  const config=await readFile(new URL('../vite.config.js',import.meta.url),'utf8');assert.match(config,/localSaveMonitor\(\)/);
  const entry=await readFile(new URL('../src/entry.js',import.meta.url),'utf8');assert.doesNotMatch(entry,/local-save-monitor/);
});
