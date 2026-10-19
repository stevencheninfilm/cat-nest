import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createGuideStore, emptyGuide } from '../server/guide-store.mjs';
import { createGuideHandler, guideResetMessage, verifyGuideReset } from '../server/guide-api.mjs';
import { createGuideSync } from '../src/guide-sync.js';
import { guideMonitorMarkup } from '../src/monitor-guide-ui.js';
import { createMemoryStorage } from '../demo/storage.js';
import { createMonitorHandler, createMonitorService } from '../scripts/local-save-monitor.mjs';
import { HOME_ENTRIES } from '../src/home-context.js';

const at=1800000000000;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function gitFixture(){
  const files=new Map(),calls=[];let sequence=0,conflict=false;
  const fetchImpl=async(url,options)=>{
    calls.push({url,method:options.method});const path=new URL(url).pathname;
    assert.match(path,/\/contents\/guides\/[a-zA-Z0-9-]+\.json$/,'metadata must never write rooms');
    const file=files.get(path);
    if(options.method==='GET')return {ok:!!file,status:file?200:404,json:async()=>({sha:file.sha,content:Buffer.from(JSON.stringify(file.data)).toString('base64')})};
    const input=JSON.parse(options.body);
    if(conflict){conflict=false;return {ok:false,status:409};}
    if((file?.sha||null)!==(input.sha||null))return {ok:false,status:409};
    files.set(path,{sha:String(++sequence),data:JSON.parse(Buffer.from(input.content,'base64').toString('utf8'))});return {ok:true,status:200};
  };
  const store=createGuideStore({token:'fixture',repository:'owner/private',fetchImpl,now:()=>at});
  return {store,calls,files,setConflict(){conflict=true;}};
}
const shown=(generation=0,phase='shown')=>({generation,phase,operationId:'event-00000001'});

test('guide reads do not create metadata or rooms; roles and homes remain independent',async()=>{
  const f=gitFixture();assert.deepEqual(await f.store.get('steven','male'),emptyGuide());assert.equal(f.files.size,0);
  await f.store.report('steven','male',shown());
  assert.equal((await f.store.get('steven','male')).phase,'shown');
  assert.equal((await f.store.get('steven','female')).phase,'unknown');assert.equal((await f.store.get('todd','male')).phase,'unknown');
  assert.ok(f.calls.every(c=>!c.url.includes('/rooms/')));
});
test('reset is generation checked, retry idempotent and immune to late old-device reports',async()=>{
  const f=gitFixture();await f.store.report('Crown','female',shown(0,'completed'));
  const input={expectedGeneration:0,operationId:'reset-00000001'};
  const reset=await f.store.reset('Crown','female',input);assert.equal(reset.generation,1);assert.equal(reset.phase,'unknown');assert.equal(reset.resetAt,at);
  const writes=()=>f.calls.filter(c=>c.method==='PUT').length,n=writes();
  assert.deepEqual(await f.store.reset('Crown','female',input),reset);assert.equal(writes(),n);
  const late=await f.store.report('Crown','female',shown(0,'completed'));assert.equal(late.stale,true);assert.equal(late.record.phase,'unknown');assert.equal(writes(),n);
  await assert.rejects(f.store.reset('Crown','female',{...input,operationId:'reset-00000002'}),e=>e.status===409);
  await f.store.report('Crown','female',shown(1));assert.equal((await f.store.get('Crown','female')).phase,'shown');
});
test('completion cannot regress to a delayed shown or pause event; GitHub CAS conflict retries safely',async()=>{
  const f=gitFixture();f.setConflict();await f.store.report('todd','male',shown(0,'completed'));
  await Promise.all([f.store.report('todd','male',shown()),f.store.report('todd','male',shown(0,'paused'))]);
  assert.equal((await f.store.get('todd','male')).phase,'completed');assert.equal((await f.store.get('todd','male')).completedAt,at);
  await assert.rejects(f.store.report('todd','male',{...shown(),coins:1200}));
});
test('reset signatures bind home, role, generation and operation, expire, and are required before a write',async()=>{
  const keys=generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({type:'spki',format:'pem'});
  const input={expectedGeneration:0,operationId:'reset-signed-001',issuedAt:at};
  input.signature=sign(null,Buffer.from(guideResetMessage('todd','male',input)),keys.privateKey).toString('base64');
  assert.equal(verifyGuideReset('todd','male',input,{publicKey,now:()=>at}),true);
  for(const [home,role,value,now]of [['evian','male',input,at],['todd','female',input,at],['todd','male',{...input,expectedGeneration:1},at],['todd','male',input,at+300001]])assert.equal(verifyGuideReset(home,role,value,{publicKey,now:()=>now}),false);
  let writes=0;const handler=createGuideHandler({store:{reset:async()=>{writes++;return emptyGuide();}},publicKey,now:()=>at});
  const req={method:'POST',socket:{remoteAddress:'127.0.0.1'}},url=new URL('http://localhost/api/guides/todd/male/reset');
  await assert.rejects(handler(req,{},url,{body:async()=>({...input,signature:'invalid'}),json(){}}),e=>e.status===403);assert.equal(writes,0);
  await handler(req,{},url,{body:async()=>input,json(){}});assert.equal(writes,1);
  await assert.rejects(handler(req,{},new URL('http://localhost/api/guides/test/male/reset'),{body:async()=>input,json(){}}),e=>e.status===404);
});

test('new entry checks reset once, does not poll an active player, and migrates only actual local history',async()=>{
  const storage=createMemoryStorage(),requests=[],applied=[],ready=[];
  const sync=createGuideSync({home:'todd',storage,view:null,makeId:()=> 'event-migrated-001',apiBase:'https://api.example',getLocal:()=>({tourStarted:true,resetGeneration:0}),applyRemote:(r,role)=>applied.push({r,role}),onReady:()=>ready.push(true),fetchImpl:async(url,options)=>{
    requests.push({url,options});return {ok:true,json:async()=>({record:{...emptyGuide(),...(options.method==='POST'?{phase:'legacy'}:{})}})};
  }});
  sync.sync('male');sync.sync('male');await tick();await tick();assert.equal(requests.filter(r=>r.options.method==='GET').length,1);
  assert.equal(JSON.parse(requests[1].options.body).phase,'legacy');assert.equal(sync.ready('male'),true);assert.equal(ready.length,1);assert.equal(applied[0].role,'male');
  sync.sync('male');await tick();assert.equal(requests.length,2);sync.destroy();
});
test('offline guide reports survive reload and upload quietly; no gameplay queue or reward changes',async()=>{
  const storage=createMemoryStorage(),callbacks=new Map();let online=false,calls=0;
  const fetchImpl=async(url,options)=>{calls++;if(!online)throw Error('offline');return {ok:true,json:async()=>({record:{...emptyGuide(),phase:options.method==='POST'?JSON.parse(options.body).phase:'unknown'}})};};
  const create=()=>createGuideSync({home:'evian',storage,apiBase:'https://api.example',makeId:()=> 'event-offline-001',retryMs:999999,view:{addEventListener:(n,fn)=>callbacks.set(n,fn),removeEventListener:n=>callbacks.delete(n)},fetchImpl});
  let sync=create();sync.report({role:'male',phase:'completed'});await tick();assert.ok(storage.getItem('catnest.guide-report.v1.male'));sync.destroy();
  online=true;sync=create();sync.sync('male');await tick();await tick();assert.equal(storage.getItem('catnest.guide-report.v1.male'),null);assert.equal(sync.ready('male'),true);
  assert.equal(storage.getItem('catnest.pending'),null);assert.ok(calls>=3);sync.destroy();
});
test('an old in-flight report cannot delete a newer report after a reset',async()=>{
  const storage=createMemoryStorage();let release;const bodies=[];
  const sync=createGuideSync({home:'todd',storage,view:null,makeId:(()=>{let n=0;return()=>`operation-${++n}`;})(),fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);bodies.push(body);
    if(body.generation===0)await new Promise(resolve=>release=resolve);
    return {ok:true,json:async()=>({stale:body.generation===0,record:{...emptyGuide(),generation:1,phase:body.generation===1?'shown':'unknown'}})};
  }});
  sync.report({role:'male',phase:'completed',generation:0});await tick();sync.report({role:'male',phase:'shown',generation:1});release();await tick();await tick();
  assert.deepEqual(bodies.map(b=>b.generation),[0,1]);assert.equal(storage.getItem('catnest.guide-report.v1.male'),null);sync.destroy();
});
test('local reset route rejects remote, cross-site and missing CSRF token before contacting production',async()=>{
  let writes=0;const handler=createMonitorHandler({csrfToken:'local-csrf',service:{resetGuide:async()=>{writes++;return {ok:true};}}});
  const response=()=>({writeHead(status){this.status=status;},end(){}});
  const base={url:'/__monitor/guide-reset',method:'POST',headers:{host:'127.0.0.1:5174','content-type':'application/json','x-monitor-token':'local-csrf'},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){yield '{}';}};
  for(const patch of [{socket:{remoteAddress:'192.168.1.5'}},{headers:{...base.headers,origin:'https://evil.test'}},{headers:{...base.headers,'x-monitor-token':''}}]){const res=response();await handler({...base,...patch},res);assert.equal(res.status,403);}
  assert.equal(writes,0);const res=response();await handler(base,res);assert.equal(res.status,200);assert.equal(writes,1);
});
test('monitor resets only registered real-home guide metadata and UI distinguishes unknown and pending',async()=>{
  const calls=[];const service=createMonitorService({now:()=>at,signReset:async(home,role,input)=>({...input,signature:'fixture'}),fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({record:{...emptyGuide(),generation:1,resetAt:at}})};}});
  await service.resetGuide({home:'todd',role:'male',expectedGeneration:0,operationId:'reset-monitor-01'});
  assert.equal(calls.length,1);assert.match(calls[0].url,/\/api\/guides\/todd\/male\/reset$/);assert.equal(JSON.parse(calls[0].options.body).expectedGeneration,0);
  for(const home of ['test','unknown'])await assert.rejects(service.resetGuide({home,role:'male',expectedGeneration:0,operationId:'reset-monitor-02'}));
  const home={id:'todd',status:'ready',guide:{status:'ready',roles:{male:emptyGuide(),female:{...emptyGuide(),generation:1}}}};
  const ui=guideMonitorMarkup(home,{enabled:true});assert.match(ui,/未上报/);assert.match(ui,/待重播 · 下次进入/);assert.match(ui,/“未上报”不等于没看过/);assert.equal(guideMonitorMarkup({status:'temporary'}),'');
  assert.ok(HOME_ENTRIES.some(h=>h.id==='Crown'));
});
