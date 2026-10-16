import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState, FOODS, levelStartXp } from '../src/state.js';
import { COLLECTION_CATS, collectionSceneInvitation, collectionCatProgress, validCollection } from '../src/cat-collection.js';
import { CAT_SCENES, sceneAllowsCat, collectionSceneProgress } from '../src/catbook-scenes.js';
import { catbookMarkup } from '../src/catbook-ui.js';
import { createCollectionEvents } from '../src/catbook-events.js';
import { sanitizeAction } from '../server/github-store.mjs';
import { validateAction } from '../src/realtime.js';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalPreviewStore, PREVIEW_HOME } from '../scripts/local-pet-preview.mjs';

const now=Date.UTC(2026,9,15),actor={id:'invite-tester',name:'猫友'};
const invite=(state,catId,sceneId,operationId=`visit-${sceneId}-${catId}`)=>reduceAction(state,{type:'invite-cat',catId,sceneId},actor,now,operationId);
const prepared=()=>{const state=initialState(now);state.xp=levelStartXp(120);state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};state.collection.foods=Object.keys(FOODS);state.collection.wins={rps:12,memory:12,gomoku:12};state.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:10,play:10,sleep:3}};return state;};
const withFriends=(state,count=10,exclude)=>{state.collection.invited=COLLECTION_CATS.filter(cat=>cat.id!==exclude).slice(0,count).map(cat=>({id:cat.id,at:now,operationId:`prior-friend-${cat.id}`,actorId:actor.id}));return state;};

test('first invitation collects once in its actual scene and each later scene needs a free invitation',()=>{
  const base=withFriends(prepared(),10,'bandit'),before=structuredClone(base);
  let state=invite(base,'bandit','garden');
  assert.equal(state.collection.invited.length,11);
  assert.ok(collectionSceneInvitation(state.collection,'bandit','garden'));
  assert.equal(collectionSceneInvitation(state.collection,'bandit','station'),null,'a first garden invitation never creates a station visit');
  assert.equal(invite(state,'bandit','garden'),null);
  state=invite(state,'bandit','station');
  assert.equal(state.collection.invited.length,11);
  assert.equal(state.collection.sceneInvited.length,2);
  assert.equal(state.xp,base.xp);assert.equal(state.coins,base.coins);
  assert.deepEqual(state.collection.stats,base.collection.stats);
  assert.deepEqual(state.careLimits,base.careLimits);
  assert.equal(state.collection.invited.filter(record=>record.id==='bandit').length,1,'scene visits never create duplicate collection records');
  assert.deepEqual(base,before,'inviting does not mutate its input snapshot');
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)),now).collection,state.collection);
});

test('legacy collection receipts retain station visits without automatically inviting cats elsewhere',()=>{
  const state=withFriends(prepared());
  state.collection.invited[0]={id:'bandit',at:now,operationId:'legacy-bandit-invite',actorId:actor.id};
  const before=structuredClone(state.collection);
  assert.ok(collectionSceneInvitation(state.collection,'bandit','station'));
  assert.equal(collectionSceneInvitation(state.collection,'bandit','garden'),null);
  const next=invite(state,'bandit','garden');
  assert.equal(next.collection.invited.length,10);
  assert.ok(collectionSceneInvitation(next.collection,'bandit','station'));
  assert.ok(collectionSceneInvitation(next.collection,'bandit','garden'));
  assert.deepEqual(state.collection,before);
  assert.deepEqual(normalizeState(state,now).collection,before,'legacy records are not rewritten');
});

test('scene gates and allowed residents are checked on the reducer and both transport validators',()=>{
  const state=prepared();
  for(const sceneId of ['unknown','garden','snow','western']) assert.equal(invite(state,'bandit',sceneId),null);
  assert.equal(invite(state,'scout','garden'),null);
  for(const validate of [sanitizeAction,validateAction]) {
    const action={type:'invite-cat',catId:'bandit',sceneId:'garden'};
    assert.deepEqual(validate(action),action);
    assert.equal(validate({...action,sceneId:'unknown'}),null);
    assert.equal(validate({...action,free:true}),null);
  }
  let next=state;
  for(const cat of COLLECTION_CATS.slice(0,20)) next=invite(next,cat.id,'station');
  assert.ok(invite(next,'bandit','snow'));
  const progress=collectionSceneProgress(CAT_SCENES.find(scene=>scene.id==='snow'),next.collection,120).current;
  next=invite(next,'bandit','garden');
  assert.equal(collectionSceneProgress(CAT_SCENES.find(scene=>scene.id==='snow'),next.collection,120).current,progress);
});

test('the shared reducer rejects direct yard invitations below 10/15/20 and accepts them at the exact gate',()=>{
  assert.deepEqual(CAT_SCENES.map(scene=>[scene.id,scene.min]),[['station',0],['garden',10],['western',15],['snow',20]]);
  for(const [sceneId,count] of [['garden',10],['western',15],['snow',20]]) {
    const below=withFriends(prepared(),count-1),at=withFriends(prepared(),count);
    const before=structuredClone(below);
    assert.equal(invite(below,'bandit',sceneId),null,`${sceneId} below gate`);
    assert.deepEqual(below,before,'a rejected direct request leaves the save unchanged');
    const entered=invite(at,'bandit',sceneId);
    assert.ok(collectionSceneInvitation(entered.collection,'bandit',sceneId),`${sceneId} at gate`);
    assert.equal(entered.collection.invited.length,count,'re-inviting to a new yard does not count as another friend');
    assert.deepEqual([entered.xp,entered.coins],[at.xp,at.coins]);
  }
});

test('scene receipts reject duplicates, foreign cats, invalid scenes and conflicting permanent operation IDs',()=>{
  const state=invite(withFriends(prepared(),10,'bandit'),'bandit','garden'),record=state.collection.sceneInvited[0];
  for(const records of [[record,record],[{...record,id:'pearl'}],[{...record,sceneId:'other'}],[{...record,extra:true}],[{...record,actorId:'another-actor'}]]) {
    assert.equal(validCollection({...state.collection,sceneInvited:records},Object.keys(FOODS)),false);
  }
  assert.equal(invite(state,'bandit','station',record.operationId),null);
});

test('a later scene arrival is observed once without inflating the collection or replaying on reload',()=>{
  let state=withFriends(prepared());
  const events=createCollectionEvents(state);
  state=invite(state,'bandit','garden');
  assert.deepEqual(events.observe(state),[{type:'cat-arrived',id:'bandit',sceneId:'garden'}]);
  assert.deepEqual(events.observe(structuredClone(state)),[]);
  assert.deepEqual(createCollectionEvents(state).observe(state),[]);
});

test('catalog stays collected while the current scene silhouette and invitation remain available',()=>{
  const state=withFriends(prepared());
  const html=catbookMarkup(state,{catId:'bandit',sceneId:'garden'});
  assert.match(html,/data-book-locked-cat="bandit"/);
  assert.match(html,/查看斑斑的场景邀请，尚未来访/);
  assert.doesNotMatch(html,/<button class="book-yard-cat[^>]*data-book-cat="bandit"/);
  assert.match(html,/class="book-cat-card[^>]*collected[^>]*data-book-cat="bandit"/);
  assert.match(html,/data-book-invite="bandit" data-book-invite-scene="garden" >/);
  assert.match(html,/图鉴只收集一次，每个场景需要单独邀请/);
  const visited=catbookMarkup(invite(state,'bandit','garden'),{catId:'bandit',sceneId:'garden'});
  assert.match(visited,/<button class="book-yard-cat[^>]*data-book-cat="bandit"/);
  assert.match(visited,/data-book-invite-scene="garden" disabled/);
});

test('every allowed scene invitation survives normalization at the maximum ledger size',()=>{
  let state=prepared();
  // Existing receipts may predate newer achievement thresholds and must remain collected.
  state.collection.invited=COLLECTION_CATS.map(cat=>({id:cat.id,at:now,operationId:`old-collected-${cat.id}`,actorId:actor.id}));
  for(const scene of CAT_SCENES) for(const cat of COLLECTION_CATS.filter(cat=>sceneAllowsCat(scene,cat))) {
    if(!collectionSceneInvitation(state.collection,cat.id,scene.id)) state=invite(state,cat.id,scene.id);
    assert.ok(state);
  }
  assert.equal(state.collection.invited.length,36);
  assert.equal(validCollection(state.collection,Object.keys(FOODS)),true);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)),now).collection,state.collection);
});

test('shared local preview also recognizes permanent scene receipts after the short journal is gone',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'catbook-scene-invites-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'home.json'),store=createLocalPreviewStore({file,now:()=>now,seedState:()=>withFriends(prepared(),10,'bandit')});
  const action={type:'invite-cat',catId:'bandit',sceneId:'garden'};
  const input={action,operationId:'local-scene-garden',clientId:actor.id,name:actor.name};
  await store.applyAction(PREVIEW_HOME,input);
  const stored=JSON.parse(await readFile(file,'utf8'));stored.operations=[];await writeFile(file,JSON.stringify(stored));
  const reopened=createLocalPreviewStore({file,now:()=>now});
  const replay=await reopened.applyAction(PREVIEW_HOME,input);
  assert.equal(replay.duplicate,true);assert.equal(replay.state.collection.invited.length,11);
  assert.equal(replay.state.collection.sceneInvited.length,1);
  await assert.rejects(reopened.applyAction(PREVIEW_HOME,{...input,action:{...action,sceneId:'station'}}),error=>error.code==='OPERATION_CONFLICT');
});
