import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { homeBinding, homeInviteUrl, isNewPet, validHomeBond } from '../src/home-bond.js';
import { sanitizeAction } from '../server/github-store.mjs';
import { createLocalPreviewStore, PREVIEW_HOME } from '../scripts/local-pet-preview.mjs';
import { HOME_ENTRIES } from '../src/home-context.js';
import { scopedStorage } from '../src/home-storage.js';
import { createMemoryStorage } from '../demo/storage.js';
import { createDemoEngine } from '../demo/engine.js';
import { loadGuide, invitationModel, invitationMarkup } from '../src/onboarding.js';
const at=1800000000000;
const male={id:'partner-male',name:'男方'},female={id:'partner-female',name:'女方'};

test('joining adds exactly one owner without spending, rewards, care counts or a fabricated care record',()=>{
  const original=initialState(at),first=reduceAction(original,{type:'join-home'},male,at+1,'join-male');
  assert.equal(first.homeBond.owners.length,1);assert.ok(validHomeBond(first.homeBond));
  for(const field of ['xp','coins','love','history','careLimits','pendingGrowth','collection'])assert.deepEqual(first[field],original[field]);
  const second=reduceAction(first,{type:'join-home'},male,at+2,'join-male-again');
  assert.equal(second.homeBond.owners.length,1);assert.equal(second.homeBond.owners[0].joinedAt,at+1);
  const together=reduceAction(second,{type:'join-home'},female,at+3,'join-female');
  assert.equal(homeBinding(together,[],true).complete,true);
  assert.ok(homeBinding(together,[],true).owners.every(owner=>owner.joined&&!owner.online));
  assert.equal(reduceAction(original,{type:'join-home'},{id:'third-user',name:'猫友'},at),null);
});

test('old saved care infers both owners while unknown presence never claims they left the home',()=>{
  const legacy=initialState(at);delete legacy.homeBond;
  legacy.history=[{actor:'男方',text:'温柔地摸了摸小猫',at:at-100}];
  legacy.feedRecords=[{actorId:female.id,name:female.name,food:'water',at:at-50}];
  const normalized=normalizeState(legacy,at),bound=homeBinding(normalized,[],false);
  assert.equal(bound.complete,true);assert.ok(bound.owners.every(owner=>owner.online===null));
  assert.deepEqual(normalized.history,legacy.history);assert.deepEqual(normalized.feedRecords,legacy.feedRecords);
  const model=invitationModel({state:normalized,role:'male',members:[],known:true,ready:true});
  assert.ok(model.owners.every(owner=>owner.label==='已加入 · 离线'));
  const noSnapshot=invitationMarkup(invitationModel({state:normalized,role:'male',members:[],known:false,ready:false}));
  assert.match(noSnapshot,/同步后确认/);assert.doesNotMatch(noSnapshot,/两位主人已加入/);
});

test('fresh pet adoption is atomic and a concurrent second adoption cannot rename or reset it',()=>{
  const initial={...initialState(at),xp:0,love:0};assert.equal(isNewPet(initial),true);
  const action={type:'adopt-cat',name:'小团子',appearance:{body:4,clothes:0,eyes:0,wand:0}};
  assert.deepEqual(sanitizeAction(action),action);
  const adopted=reduceAction(initial,action,male,at+1,'adoption-male');
  assert.equal(adopted.name,'小团子');assert.equal(adopted.appearance.body,4);
  assert.equal(adopted.coins,initial.coins);assert.equal(adopted.xp,0);assert.equal(adopted.pendingGrowth.length,0);
  assert.equal(adopted.homeBond.adoptedAt,at+1);assert.equal(isNewPet(adopted),false);
  assert.equal(reduceAction(adopted,{...action,name:'另一只猫'},female,at+2,'adoption-female'),null);
  const established={...initialState(at),xp:500,name:'原来的糯米'};
  assert.equal(reduceAction(established,action,male,at+1,'adoption-overwrite'),null);
  for(const malformed of [{...action,name:'\u0000'}, {...action,name:'长'.repeat(17)}, {...action,appearance:{body:999}}])assert.equal(sanitizeAction(malformed),null);
});

test('new owner survives file reload and both players keep the same pet and progress',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'onboarding-bond-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=join(directory,'home.json');const store=createLocalPreviewStore({file,now:()=>at});
  await store.applyAction(PREVIEW_HOME,{operationId:'male-joins-home',clientId:male.id,name:male.name,action:{type:'join-home'}});
  const reopened=createLocalPreviewStore({file,now:()=>at+100});
  const saved=await reopened.applyAction(PREVIEW_HOME,{operationId:'female-joins-home',clientId:female.id,name:female.name,action:{type:'join-home'}});
  assert.equal(saved.revision,2);assert.equal(saved.state.xp,86);assert.equal(saved.state.coins,1200);assert.equal(homeBinding(saved.state).count,2);
});

test('invite URLs stay in their own save, suggest the opposite role, and contain no room or court credential',()=>{
  for(const home of HOME_ENTRIES)for(const role of ['male','female']) {
    const url=new URL(homeInviteUrl(home,'https://stevencheninfilm.com/cat-nest/',role));
    assert.equal(url.pathname,`/cat-nest/${home.id}/`);assert.equal(url.searchParams.get('join'),role==='male'?'female':'male');
    assert.equal([...url.searchParams.keys()].join(','),'join');
    if(home.id==='test')assert.ok(!url.href.includes('/steven/'));
  }
  assert.throws(()=>homeInviteUrl({href:'https://wrong.example',source:'room'},'https://example.test','male'));
});

test('guide progress and identity remain scoped to the existing save prefixes',()=>{
  const raw=createMemoryStorage();
  const first=scopedStorage(raw,HOME_ENTRIES[0]),second=scopedStorage(raw,HOME_ENTRIES[1]);
  first.setItem('catnest.onboarding.v2.male',JSON.stringify({version:2,step:'claim',rewardId:'my-reward'}));
  assert.equal(loadGuide(first,'male').rewardId,'my-reward');assert.equal(loadGuide(first,'female'),null);assert.equal(loadGuide(second,'male'),null);
  raw.setItem('evian:catnest.onboarding.v2.male',JSON.stringify({version:2,step:'done'}));
  assert.equal(loadGuide(second,'male').step,'done');assert.equal(loadGuide(first,'male').step,'claim');
});

test('the first-home scenario and simulated invitation use the shared reducer and never become real save data',()=>{
  const storage=createMemoryStorage(),engine=createDemoEngine({storage,now:()=>at});
  engine.scenario('new-home','male');let state=engine.snapshot().state;assert.equal(isNewPet(state),true);assert.equal(homeBinding(state).count,0);
  engine.action({operationId:'demo-first-adoption',clientId:male.id,action:{type:'adopt-cat',name:'汤圆',appearance:state.appearance}});
  engine.scenario('join','male');state=engine.snapshot().state;assert.equal(homeBinding(state).count,2);assert.equal(state.name,'汤圆');assert.equal(engine.controls.partnerOnline,true);
  const fresh=createDemoEngine({storage:createMemoryStorage(),now:()=>at});assert.equal(fresh.snapshot().state.name,'糯米');assert.equal(fresh.snapshot().state.xp,400);
});
