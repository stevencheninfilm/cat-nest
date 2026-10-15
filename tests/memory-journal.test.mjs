import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { emptyMemoryJournal, normalizeMemoryJournal, recordMemoryJournal, validMemoryJournal, memoryHash, memoryDays, nextMemoryAnniversary } from '../src/memory-journal.js';
import { memoryJournalPanel, memoryCardPanel, memoryPresentation } from '../src/memory-journal-ui.js';
import { wrapMemoryText } from '../src/memory-card.js';

const START=Date.parse('2026-10-15T00:00:00Z'),DAY=86_400_000;
const male={id:'partner-male',name:'男方'},female={id:'partner-female',name:'女方'};
test('adoption date and known legacy moments migrate without inventing old level dates or changing progress',()=>{
  const legacy={...initialState(START),coins:117,xp:4000,love:701,history:[{text:'早先的照顾',actor:'女方',at:START-DAY}]};delete legacy.diary;
  const before=JSON.stringify(legacy);
  const journal=normalizeMemoryJournal(undefined,legacy,START,START-30*DAY);
  assert.equal(journal.adoptedAt,START-30*DAY);assert.equal(memoryDays(journal,START),31);
  assert.ok(journal.entries.some(e=>e.id==='adoption'&&e.at===START-30*DAY));
  assert.ok(journal.entries.some(e=>e.kind==='legacy'&&e.text==='早先的照顾'));
  assert.ok(!journal.entries.some(e=>e.kind==='level'));
  assert.equal(JSON.stringify(legacy),before);assert.ok(validMemoryJournal(journal));
  const next=normalizeState({...legacy,diary:journal},START);
  assert.deepEqual([next.coins,next.xp,next.love],[117,4000,701]);
  assert.deepEqual(normalizeMemoryJournal(journal,next,START),journal);
});
test('anniversaries follow Shanghai calendar dates, survive missed visits and handle leap-day adoption',()=>{
  const adopted=Date.parse('2024-02-29T08:00:00Z'),before=Date.parse('2025-02-27T15:59:59Z'),anniversary=Date.parse('2025-02-27T16:00:00Z');
  const journal=emptyMemoryJournal(adopted);
  assert.ok(!normalizeMemoryJournal(journal,{},before).entries.some(e=>e.kind==='anniversary'));
  assert.equal(nextMemoryAnniversary(journal,before),1);
  const migrated=normalizeMemoryJournal(journal,{},anniversary);
  assert.equal(migrated.entries.find(e=>e.kind==='anniversary').at,anniversary);
  const later=normalizeMemoryJournal(migrated,{},Date.parse('2028-02-29T16:00:00Z'));
  assert.equal(later.entries.filter(e=>e.kind==='anniversary').length,4);
  assert.ok(validMemoryJournal(later));
});
test('first care, cooperation and a claimed level milestone are automatic, deterministic and not double-awarded',()=>{
  let state={...initialState(START),xp:119,hunger:70,mood:70,energy:70};
  state=reduceAction(state,{type:'pet'},male,START,'diary-first-pet');
  assert.equal(state.xp,119);assert.ok(!state.diary.entries.some(e=>e.kind==='level'));
  assert.equal(state.diary.entries.filter(e=>e.id==='first:pet').length,1);
  state=reduceAction(state,{type:'play'},female,START+1000,'diary-first-play');
  assert.ok(state.diary.entries.some(e=>e.kind==='together'&&e.occasion==='relay'));
  state=reduceAction(state,{type:'claim-growth',rewardId:'diary-first-pet'},female,START+2000,'diary-first-claim');
  assert.equal(state.diary.entries.filter(e=>e.id==='level:2').length,1);
  assert.equal(reduceAction(state,{type:'claim-growth',rewardId:'diary-first-pet'},male,START+3000,'diary-duplicate-claim'),null);
  const reopened=normalizeState(structuredClone(state),START+2*DAY);
  assert.deepEqual(reopened.diary.entries,state.diary.entries);assert.ok(validMemoryJournal(state.diary));
});
test('a random vignette is seeded by operation ID, limited to one per day, and remains after history rolls over',()=>{
  const id=Array.from({length:100},(_,i)=>`fun-care-${i}`).find(id=>memoryHash(id)%5===0);
  const original=initialState(START),a=reduceAction(original,{type:'pet'},male,START,id),b=reduceAction(original,{type:'pet'},male,START,id);
  assert.deepEqual(a.diary,b.diary);assert.equal(a.diary.entries.filter(e=>e.kind==='fun').length,1);
  let state=a;
  for(let i=0;i<60;i++)state=reduceAction(state,{type:'rename',name:`小猫${i}`},male,START+1000+i,`later-name-${i}`);
  assert.equal(state.history.length,40);assert.equal(state.diary.entries.filter(e=>e.kind==='fun').length,1);
  assert.ok(state.diary.entries.some(e=>e.id==='first:pet'));
});
test('a finished two-player game becomes one lasting shared memory without recording unfinished games',()=>{
  const before=initialState(START),after=structuredClone(before);
  after.games.match={id:'duo-memory-game',mode:'duo',status:'active',game:'rps'};
  const args={before,after,action:{type:'game-move'},now:START+1,id:'last-game-move',actorId:male.id};
  assert.equal(recordMemoryJournal(before.diary,args).entries.some(e=>e.kind==='game'),false);
  after.games.match.status='finished';const diary=recordMemoryJournal(before.diary,args);
  assert.equal(diary.entries.filter(e=>e.kind==='game').length,1);assert.ok(validMemoryJournal(diary));
  assert.match(memoryJournalPanel({...before,diary},{filter:'together',now:START+1}),/一起玩完一局/);
  assert.equal(recordMemoryJournal(diary,args).entries.filter(e=>e.kind==='game').length,1);
});
test('shared favorites use explicit idempotent values and never grant growth, spend coins, add care history or delete memories',()=>{
  const state=initialState(START),next=reduceAction(state,{type:'diary-favorite',memoryId:'adoption',favorite:true},male,START+10,'favorite-first');
  assert.deepEqual(next.diary.favorites,['adoption']);assert.deepEqual([next.coins,next.xp,next.love],[state.coins,state.xp,state.love]);
  assert.deepEqual(next.history,state.history);assert.deepEqual(next.careLimits,state.careLimits);assert.deepEqual(next.pendingGrowth,state.pendingGrowth);
  const again=reduceAction(next,{type:'diary-favorite',memoryId:'adoption',favorite:true},female,START+11,'favorite-again');
  assert.deepEqual(again.diary.favorites,['adoption']);
  const removed=reduceAction(again,{type:'diary-favorite',memoryId:'adoption',favorite:false},female,START+12,'favorite-remove');
  assert.deepEqual(removed.diary.favorites,[]);assert.ok(removed.diary.entries.some(e=>e.id==='adoption'));
  assert.equal(reduceAction(state,{type:'diary-favorite',memoryId:'missing',favorite:true},male,START+13),null);
});
test('stored ledger validation refuses duplicate IDs, dangling favorites and injected content fields',()=>{
  const state=emptyMemoryJournal(START);assert.ok(validMemoryJournal(state));
  assert.equal(validMemoryJournal({...state,favorites:['missing']}),false);
  assert.equal(validMemoryJournal({...state,entries:[...state.entries,...state.entries]}),false);
  assert.equal(validMemoryJournal({...state,entries:[{...state.entries[0],url:'https://bad.example'}]}),false);
  assert.equal(validMemoryJournal({...state,adoptedAt:Infinity}),false);
});
test('photo timeline, favorite empty state and sharing preview remain accessible and escape saved names and text',()=>{
  const state=initialState(START);state.name='<script>猫</script>';
  state.diary.entries[0].catName='<猫>';
  const html=memoryJournalPanel(state,{now:START});
  assert.match(html,/role="tablist"/);assert.match(html,/aria-pressed="false"/);assert.match(html,/纪念插画/);assert.match(html,/制作纪念卡/);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;猫&gt;/);
  assert.match(memoryJournalPanel(state,{tab:'favorites',now:START}),/舍不得忘记/);
  assert.match(memoryJournalPanel(state,{tab:'recent',now:START}),/最近 40 次/);
  const preview=memoryCardPanel(state.diary.entries[0]);assert.match(preview,/data-memory-download disabled>保存图片/);assert.doesNotMatch(preview,/data-memory-share/);
  assert.match(memoryCardPanel(state.diary.entries[0],{url:'blob:card',canShare:true}),/data-memory-share/);
  assert.match(memoryPresentation(state.diary.entries[0]).description,/<猫>/);
  const ctx={measureText:text=>({width:[...text].length*10})};assert.deepEqual(wrapMemoryText(ctx,'陪你一起成长',30),['陪你一','起成长']);
});

test('new-owner adoption records the actual naming time and cat name while restoring established adoption dates',()=>{
  const original=initialState(START);
  const adopted=reduceAction(original,{type:'adopt-cat',name:'团团',appearance:original.appearance},male,START+10000,'adopt-diary');
  assert.equal(adopted.diary.adoptedAt,START+10000);
  assert.equal(adopted.diary.entries.find(e=>e.id==='adoption').catName,'团团');
  assert.equal(adopted.diary.entries.find(e=>e.id==='adoption').at,adopted.homeBond.adoptedAt);
  const withoutDiary={...adopted};delete withoutDiary.diary;
  assert.equal(normalizeState(withoutDiary,START+20000).diary.adoptedAt,START+10000);
  assert.equal(normalizeMemoryJournal(undefined,withoutDiary,START+20000,START).adoptedAt,START+10000);
});
