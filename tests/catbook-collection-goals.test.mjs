import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_CATS, collectionCatProgress, canInviteCat } from '../src/cat-collection.js';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { catbookMarkup } from '../src/catbook-ui.js';
import { CAT_SCENES, collectionSceneProgress, collectionScene } from '../src/catbook-scenes.js';
import { createCollectionEvents } from '../src/catbook-events.js';
import { emptyMemoryJournal, unlockedMemoryCardCount, memoryHash } from '../src/memory-journal.js';
import { formalMemoryEntries } from './memory-fixtures.mjs';

const now=Date.UTC(2026,9,15),actor={id:'partner-male',name:'男方'};
const cohort=COLLECTION_CATS.slice(24,36);
const receipt=cat=>({id:cat.id,at:now,operationId:`diary-goal-seed-${cat.id}`,actorId:actor.id});
function withCards(count) {
  const state={...initialState(now),xp:270}; // Diary is available from Lv.3.
  state.diary=emptyMemoryJournal(now);
  state.diary.entries=formalMemoryEntries(now).slice(0,count);
  return normalizeState(state,now);
}
const progress=(cat,state)=>collectionCatProgress(cat,state.collection,1,state.diary);

test('No.25–36 require 3,6,…36 unlocked diary cards, independent of invited cats, care totals and levels',()=>{
  assert.equal(cohort.length,12);
  assert.deepEqual(cohort.map(cat=>cat.index+1),Array.from({length:12},(_,i)=>25+i));
  assert.deepEqual(cohort.map(cat=>cat.requirements),Array.from({length:12},(_,i)=>[{metric:'diary-cards',target:3*(i+1)}]));
  for(const cat of cohort) {
    const below=withCards(cat.target-1),at=withCards(cat.target);
    below.collection.invited=COLLECTION_CATS.filter(other=>other.id!==cat.id).map(receipt);
    assert.equal(canInviteCat(cat.id,below.collection,99999,undefined,below.diary),false,`${cat.id} below diary target`);
    assert.equal(canInviteCat(cat.id,at.collection,1,undefined,at.diary),true,`${cat.id} at diary target with no invited cats`);
    const snapshot=structuredClone(at);
    const invited=reduceAction(at,{type:'invite-cat',catId:cat.id},actor,now,`diary-goal-${cat.id}`);
    assert.ok(invited.collection.invited.some(entry=>entry.id===cat.id));
    assert.deepEqual([invited.xp,invited.coins,invited.love],[at.xp,at.coins,at.love]);
    assert.deepEqual(invited.diary,at.diary,'invitation never manufactures more diary cards');
    assert.deepEqual(at,snapshot);
  }
});

test('only valid distinct formal themes count; favorites, locked previews, recent care history and exports add nothing',()=>{
  const state=withCards(2),diary=structuredClone(state.diary);
  diary.entries.push({...diary.entries[1]}, {id:'locked:first:pet',kind:'locked',at:now,catName:'糯米',photo:'happy'});
  diary.favorites=['adoption','level:2'];
  assert.equal(unlockedMemoryCardCount(diary),2);
  assert.equal(unlockedMemoryCardCount({version:1,entries:[{id:'first:pet',kind:'first',occasion:'pet'}]}),0);
  state.history=Array.from({length:40},()=>({text:'摸摸',at:now,actor:'男方'}));
  state.collection.invited=COLLECTION_CATS.map(receipt);
  state.pendingGrowth=[{id:'pending-diary-goal',kind:'pet',amount:3,actorId:actor.id,actor:actor.name,at:now}];
  assert.equal(progress(cohort[0],state).current,2);
  const favorite=reduceAction(state,{type:'diary-favorite',memoryId:'adoption',favorite:true},actor,now,'diary-goal-favorite');
  assert.equal(progress(cohort[0],favorite).current,2);
});

test('No.36 unlocks at 36 diary cards now and has no restriction based on the total cat count',()=>{
  const cat=cohort.at(-1),state=withCards(35);
  assert.equal(progress(cat,state).current,35);assert.equal(progress(cat,state).achieved,false);
  assert.equal(reduceAction(state,{type:'invite-cat',catId:cat.id},actor,now,'diary-goal-final-below'),null);
  const html=catbookMarkup(state,{catId:cat.id});
  assert.match(html,/还需解锁 <strong>1<\/strong> 张猫猫日记卡片/);
  assert.doesNotMatch(html,/后续增加猫猫|其他猫猫图鉴|最多可收集/);
  const at=withCards(36);
  assert.ok(reduceAction(at,{type:'invite-cat',catId:cat.id},actor,now,'diary-goal-final-at'));
});

test('a newly recorded third card unlocks No.25 once; reload and existing invitation receipts retain progress',()=>{
  const state=withCards(2),events=createCollectionEvents(state);
  const operationId=Array.from({length:50},(_,i)=>`diary-goal-third-pet-${i}`).find(id=>memoryHash(id)%5!==0);
  const third=reduceAction(state,{type:'pet'},actor,now,operationId);
  assert.equal(unlockedMemoryCardCount(third.diary),3);
  assert.deepEqual(events.observe(third),[{type:'cat-unlocked',id:'porter'}]);
  assert.deepEqual(events.observe(third),[]);
  const restored=normalizeState(structuredClone(third),now+86400_000);
  assert.equal(progress(cohort[0],restored).current,3);
  assert.ok(canInviteCat('porter',restored.collection,1,undefined,restored.diary));
  const legacy=withCards(1);legacy.collection.invited.push(receipt(cohort.at(-1)));
  assert.deepEqual(normalizeState(structuredClone(legacy),now+86400_000).collection,legacy.collection);
  assert.ok(progress(cohort.at(-1),legacy).invited,'existing confirmed ownership is retained');
});

test('locked red silhouettes and their detail explain diary progress and remain silhouettes until invitation',()=>{
  const cat=cohort[0],state=withCards(2),before=structuredClone(state);
  const locked=catbookMarkup(state,{catId:cat.id});
  assert.match(locked,/data-book-locked-cat="porter"[^>]*>[\s\S]*?stroke="#e74f46"[^>]*stroke-dasharray=/);
  assert.match(locked,/解锁猫猫日记中的 3 张卡片/);
  assert.match(locked,/日记卡片 2 \/ 3 张/);
  assert.match(locked,/日记 → 待解锁/);
  assert.doesNotMatch(locked,/还需undefined|其他猫猫图鉴/);
  assert.deepEqual(state,before);
  const html=catbookMarkup(withCards(3),{catId:cat.id});
  assert.match(html,/data-book-locked-cat="porter"/);
  assert.match(html,/已经可以邀请啦/);
  assert.doesNotMatch(html,/data-book-invite="porter"[^>]*disabled/);
});

test('scene progress and selection use the same diary-card context as invitation rules',()=>{
  const before=withCards(29);before.collection.invited=cohort.slice(0,10).map(receipt);
  const after=withCards(30);after.collection.invited=structuredClone(before.collection.invited);
  const garden=CAT_SCENES.find(scene=>scene.id==='garden'),events=createCollectionEvents(before);
  assert.equal(collectionSceneProgress(garden,before.collection,1,before.diary).current,9);
  assert.equal(collectionScene('garden',after.collection,1,after.diary).id,'garden');
  assert.equal(collectionSceneProgress(garden,after.collection,1,after.diary).current,10);
  assert.deepEqual(events.observe(after),[{type:'scene-unlocked',id:'garden'}]);
});
