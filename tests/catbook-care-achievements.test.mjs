import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, CARE_LIMITS, FOOD_COOLDOWN_MS, FOODS } from '../src/state.js';
import { canInviteCat, emptyCollectionAchievements, validCollection } from '../src/cat-collection.js';
import { createCollectionEvents } from '../src/catbook-events.js';
import { catbookMarkup } from '../src/catbook-ui.js';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';

const start=Date.UTC(2026,9,15,0),day=86400_000;
const actor={id:'achievement-player',name:'猫友'},partner={id:'achievement-partner',name:'搭档'};
let serial=0;
const act=(state,action,at=start,who=actor)=>reduceAction(state,action,who,at,`achievement-test-${++serial}`);
const careAction=type=>type==='feed'?{type,food:'water'}:{type};

for(const [type,target,id] of [['feed',10,'toast'],['play',10,'sprout'],['pet',10,'mint'],['sleep',3,'luna']]) {
  test(`${type} needs ${target} accepted actions in one Shanghai day, and remains unlocked after midnight`,()=>{
    let state={...initialState(start),xp:120};const events=createCollectionEvents(state);
    const cooldown=type==='feed'?FOOD_COOLDOWN_MS.water:CARE_LIMITS[type].cooldownMs;
    for(let index=0;index<target;index++) {
      const at=start+index*cooldown,prior=structuredClone(state);
      state=act(state,careAction(type),at,index%2?partner:actor);assert.ok(state);
      assert.equal(prior.collection.achievements.daily[type],index);
      assert.equal(state.collection.achievements.daily[type],index+1);
      assert.equal(canInviteCat(id,state.collection,1),index===target-1);
      if(type==='sleep')state=act(state,{type:'sleep'},at+1);
      const before=structuredClone(state);
      assert.equal(act(state,careAction(type),at+2,index%2?partner:actor),null);
      assert.deepEqual(state,before,'cooldown or quota rejection cannot record a daily achievement');
      const notice=events.observe(state).filter(event=>event.id===id);
      assert.deepEqual(notice,index===target-1?[{type:'cat-unlocked',id}]:[]);
    }
    const restored=normalizeState(JSON.parse(JSON.stringify(state)),start+7*day);
    assert.equal(restored.careLimits.counts[type],0);
    assert.equal(restored.collection.achievements.daily[type],target);
    assert.equal(canInviteCat(id,restored.collection,1),true);
    const invited=act(restored,{type:'invite-cat',catId:id},start+7*day);
    assert.equal(invited.collection.invited[0].id,id);
    assert.deepEqual(events.observe(invited).filter(event=>event.id===id),[{type:'cat-arrived',id}]);
    assert.deepEqual(events.observe(structuredClone(invited)),[]);
  });
}

test('daily goals keep a best single-day record instead of adding different days or waking',()=>{
  let state=initialState(start);
  for(let d=0;d<2;d++)for(let index=0;index<5;index++)state=act(state,{type:'feed',food:'water'},start+d*day+index*FOOD_COOLDOWN_MS.water);
  assert.equal(state.collection.stats.feed,10);
  assert.equal(state.collection.achievements.daily.feed,5);
  assert.equal(canInviteCat('toast',state.collection,1),false);
  const rollback=normalizeState(state,start-day);
  assert.equal(rollback.careLimits.day,state.careLimits.day);
  assert.equal(rollback.collection.achievements.daily.feed,5);
  assert.equal(act(rollback,{type:'feed',food:'water'},start-day),null);
  for(let index=0;index<50;index++)state=act(state,{type:'rename',name:`猫猫${index}`},start+3*day+index);
  assert.equal(state.history.length,40);assert.equal(state.collection.achievements.daily.feed,5);
  state=act(state,{type:'sleep'},start+4*day);
  state=act(state,{type:'sleep'},start+4*day+1);
  assert.equal(state.collection.achievements.daily.sleep,1,'wake is not another sleep');
});

test('the x1.3 achievement respects >80, records activation after care, and keeps a used boost',()=>{
  const threshold={...initialState(start),hunger:80,mood:100,energy:100};
  const below=act(threshold,{type:'feed',food:'water'});
  assert.equal(below.collection.achievements.boost,2);assert.equal(canInviteCat('sunshine',below.collection,1),false);
  const activated=act(threshold,{type:'feed',food:'meal'});
  assert.equal(activated.collection.achievements.boost,3);assert.equal(canInviteCat('sunshine',activated.collection,1),true);
  const poor={...threshold,coins:0};assert.equal(act(poor,{type:'feed',food:'meal'}),null);assert.equal(poor.collection.achievements.boost,0);
  const used=act({...initialState(start),hunger:90,mood:90,energy:82},{type:'play'});
  assert.equal(used.energy,80);assert.equal(used.pendingGrowth[0].boostCount,3);
  assert.equal(used.collection.achievements.boost,3,'the pre-action x1.3 reward also proves activation');
  const later=normalizeState(activated,start+100*day);
  assert.equal(later.hunger,0);assert.equal(canInviteCat('sunshine',later.collection,1),true);
});

test('only an accepted change of appearance awards the dress achievement',()=>{
  const before=initialState(start),same=act(before,{type:'dress',appearance:before.appearance});
  assert.equal(same.collection.achievements.dress,0);
  assert.equal(canInviteCat('velvet',same.collection,1),false);
  assert.equal(act(before,{type:'dress',appearance:{...before.appearance,body:99}}),null);
  const changed=act(before,{type:'dress',appearance:{...before.appearance,clothes:1}});
  assert.equal(changed.collection.achievements.dress,1);assert.equal(before.collection.achievements.dress,0);
  assert.equal(canInviteCat('velvet',changed.collection,1),true);
  assert.equal(act(changed,{type:'dress',appearance:before.appearance}).collection.achievements.dress,1);
});

test('legacy saves keep existing cats and migrate only verifiable appearance, boost and single-day records',()=>{
  const legacy=initialState(start);delete legacy.collection.achievements;
  legacy.appearance.clothes=1;legacy.hunger=90;legacy.mood=90;legacy.energy=90;
  legacy.careLimits.counts={feed:6,pet:10,play:9,sleep:2,pair:0};
  legacy.collection.invited=[{id:'bandit',at:start,operationId:'legacy-achievement-cat',actorId:actor.id}];
  const first=normalizeState(legacy,start+day),again=normalizeState(JSON.parse(JSON.stringify(first)),start+2*day);
  assert.deepEqual(first.collection.achievements,{boost:3,dress:1,daily:{feed:6,pet:10,play:9,sleep:2}});
  assert.deepEqual(again.collection,first.collection);assert.equal(first.collection.invited[0].id,'bandit');
  const fresh=initialState(start);delete fresh.collection.achievements;fresh.history=[{text:'给小猫换上了新的魔法装扮',actor:actor.name,at:start}];
  assert.equal(normalizeState(fresh,start).collection.achievements.dress,0,'a no-op historic dress entry is not proof');
  fresh.hunger=10;fresh.mood=10;fresh.energy=10;
  fresh.history=[{text:'温柔地摸了摸小猫，生成3.9点成长气泡待领取（好状态 ×1.3）',actor:actor.name,at:start}];
  assert.equal(normalizeState(fresh,start+day).collection.achievements.boost,3,'an actual saved x1.3 care reward proves past activation');
  fresh.history=[{text:'给小猫取名「（好状态 ×1.3）」',actor:actor.name,at:start}];
  assert.equal(normalizeState(fresh,start+day).collection.achievements.boost,0,'a name cannot invent past activation');
});

test('the collection and transport reject forged, unbounded or incomplete achievement fields',()=>{
  const collection=initialState(start).collection;
  for(const record of [{...emptyCollectionAchievements(),boost:4},{...emptyCollectionAchievements(),dress:2},{...emptyCollectionAchievements(),extra:1},
    {boost:1,dress:0,daily:{feed:11,pet:0,play:0,sleep:0}},{boost:1,dress:0,daily:{feed:0,pet:-1,play:0,sleep:0}},
    {boost:1,dress:0,daily:{feed:0,pet:0.5,play:0,sleep:0}},{boost:1,dress:0,daily:{feed:0,pet:0,play:0}}]) {
    assert.equal(validCollection({...collection,achievements:record},Object.keys(FOODS)),false);
  }
  for(const action of [{type:'achievement-complete',catId:'toast'},{type:'invite-cat',catId:'toast',dailyFeed:10},{type:'dress',appearance:initialState(start).appearance,achievement:1}])assert.equal(sanitizeAction(action),null);
  const state=initialState(start),html=catbookMarkup(state,{catId:'toast',tab:'achievements'});
  assert.match(html,/当日喂食 10 次/);assert.match(html,/0 \/ 10 · 单日最高/);
  assert.match(html,/跨日不会重新上锁/);assert.match(html,/achievement-cats-v1\.png/);assert.match(html,/is-game-cat undiscovered/);
});

function memoryStore(){const files=new Map();let sequence=0,fail=false;return {files,set fail(value){fail=value;},fetchImpl:async(url,options)=>{
  const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),file=files.get(id);
  if(options.method==='GET')return file?Response.json({sha:file.sha,encoding:'base64',content:Buffer.from(JSON.stringify(file.room)).toString('base64')}):new Response('{}',{status:404});
  if(fail)return new Response('{}',{status:500});
  const body=JSON.parse(options.body);if(file&&file.sha!==body.sha)return new Response('{}',{status:409});
  files.set(id,{sha:`achievement-sha-${++sequence}`,room:JSON.parse(Buffer.from(body.content,'base64').toString())});return new Response('{}',{status:200});
}};}

test('a failed cloud write cannot unlock a dress cat, and confirmed retries invite once',async()=>{
  const mock=memoryStore(),store=createGitHubStore({token:'fake',repository:'test/achievements',fetchImpl:mock.fetchImpl,now:()=>start});
  const room=await store.createRoom(),events=createCollectionEvents(room.state);
  mock.files.get(room.roomId).room.state.xp=120;
  const request={operationId:'cloud-achievement-dress',clientId:actor.id,name:actor.name,action:{type:'dress',appearance:{...room.state.appearance,body:1}}};
  mock.fail=true;await assert.rejects(store.applyAction(room.roomId,request));assert.equal(mock.files.get(room.roomId).room.state.collection.achievements.dress,0);
  mock.fail=false;const saved=await store.applyAction(room.roomId,request);
  assert.deepEqual(events.observe(saved.state),[{type:'cat-unlocked',id:'velvet'}]);
  const retry=await store.applyAction(room.roomId,request);assert.equal(retry.duplicate,true);assert.deepEqual(events.observe(retry.state),[]);
  const invite={...request,operationId:'cloud-achievement-invite',action:{type:'invite-cat',catId:'velvet'}};
  const invited=await store.applyAction(room.roomId,invite);assert.deepEqual(events.observe(invited.state),[{type:'cat-arrived',id:'velvet'}]);
  assert.equal((await store.applyAction(room.roomId,invite)).duplicate,true);
  assert.equal(mock.files.get(room.roomId).room.state.collection.invited.filter(cat=>cat.id==='velvet').length,1);
});

test('the server applies verified legacy achievement migration before checking an invitation',async()=>{
  const mock=memoryStore(),store=createGitHubStore({token:'fake',repository:'test/achievements',fetchImpl:mock.fetchImpl,now:()=>start});
  const room=await store.createRoom(),file=mock.files.get(room.roomId);delete file.room.state.collection.achievements;
  file.room.state.xp=120;file.room.state.appearance.clothes=1;file.sha='legacy-changed-outfit';
  const saved=await store.applyAction(room.roomId,{operationId:'legacy-achievement-invite',clientId:actor.id,name:actor.name,action:{type:'invite-cat',catId:'velvet'}});
  assert.equal(saved.state.collection.achievements.dress,1);assert.equal(saved.state.collection.invited[0].id,'velvet');
});
