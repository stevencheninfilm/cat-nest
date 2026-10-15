import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, levelInfo, levelStartXp } from '../src/state.js';
import { memoryUnlocks } from '../src/memory-unlocks.js';
import { emptyMemoryJournal, normalizeMemoryJournal, nextMemoryAnniversaryGoal, recordMemoryJournal, memoryHash } from '../src/memory-journal.js';
import { memoryJournalPanel } from '../src/memory-journal-ui.js';

const NOW=Date.parse('2026-10-15T02:00:00Z'),DAY=86_400_000;
const male={id:'partner-male',name:'男方'},female={id:'partner-female',name:'女方'};
const find=(state,id,now=NOW)=>memoryUnlocks(state,now).find(goal=>goal.id===id);

test('unlock guide reads the existing save without adding entries, favorites or rewards; completed firsts disappear',()=>{
  const state=initialState(NOW),snapshot=JSON.stringify(state),goals=memoryUnlocks(state,NOW);
  assert.equal(JSON.stringify(state),snapshot);
  assert.equal(new Set(goals.map(goal=>goal.id)).size,goals.length);
  assert.ok(find(state,'first:pet'));assert.ok(find(state,'first:dress'));assert.ok(!find(state,'adoption'));
  const next=reduceAction(state,{type:'pet'},male,NOW,'unlock-first-pet');
  assert.ok(next.diary.entries.some(entry=>entry.id==='first:pet'));
  assert.ok(!find(next,'first:pet'));
  assert.ok(find(next,'first:play'));
  assert.match(find(state,'first:sleep').requirement,/唤醒不计入/);
});

test('growth goals use claimed cumulative experience, include future heart stages and never invent missing old milestones',()=>{
  const state={...initialState(NOW),xp:119,pendingGrowth:[{id:'unclaimed-growth',amount:1000}]};
  assert.deepEqual(find(state,'level:2').progress,{value:119,max:120});
  assert.match(find(state,'level:2').status,/还差 1 成长/);
  assert.equal(find(state,'level:11').progress.max,2550);
  assert.match(find(state,'level:11').requirement,/领取成长气泡/);
  const old={...state,xp:4000},current=levelInfo(old.xp).level;
  const levels=memoryUnlocks(old,NOW).filter(goal=>goal.entry.kind==='level');
  assert.equal(levels[0].entry.level,current+1);
  assert.ok(levels.every(goal=>goal.entry.level>current));
  assert.equal(levels[0].progress.max,levelStartXp(current+1));
  assert.equal(old.diary.entries.some(entry=>entry.kind==='level'),false);
});

test('cooperation progress uses real valid records, expires with the shared window, and stays collected across days',()=>{
  const state=initialState(NOW);
  const first=reduceAction(state,{type:'pet'},male,NOW,'unlock-pair-first');
  assert.deepEqual(find(first,'together:relay',NOW+1000).progress,{value:1,max:2});
  assert.match(find(first,'together:relay',NOW+1000).status,/男方已摸摸 · 等另一人逗猫/);
  assert.equal(find(first,'together:relay',NOW+30*60_000).progress.value,0);
  const same=reduceAction(first,{type:'play'},male,NOW+1000,'unlock-pair-same');
  assert.ok(find(same,'together:relay',NOW+1000));
  const paired=reduceAction(first,{type:'play'},female,NOW+1000,'unlock-pair-other');
  assert.ok(!find(paired,'together:relay',NOW+1000));
  assert.ok(!find(paired,'together:relay',NOW+DAY));
  const fed=reduceAction(state,{type:'feed',food:'water'},male,NOW,'unlock-pair-feed');
  assert.equal(find(fed,'together:meal',NOW+1000).progress.value,1);
  assert.equal(find({...fed,feedingWindow:{startedAt:NOW+2000}},'together:meal',NOW+3000).progress.value,0);
  assert.match(find(fed,'together:goodnight').requirement,/一人先喂食或摸摸/);
});

test('each game remains locked until a full duo match of that game creates its actual memory',()=>{
  const state=initialState(NOW),after=structuredClone(state);
  after.games.match={id:'unlock-duo-rps',game:'rps',mode:'duo',status:'active'};
  assert.match(find(after,'game:rps').status,/正在一起玩/);
  after.games.match.status='finished';
  after.diary=recordMemoryJournal(state.diary,{before:state,after,action:{type:'game-move'},actorId:male.id,now:NOW,id:'unlock-duo-move'});
  assert.ok(!find(after,'game:rps'));assert.ok(find(after,'game:memory'));
  const solo=structuredClone(state);solo.games.match={id:'unlock-solo-rps',game:'rps',mode:'solo',status:'finished'};
  solo.diary=recordMemoryJournal(state.diary,{before:state,after:solo,action:{type:'game-move'},actorId:male.id,now:NOW,id:'unlock-solo-move'});
  assert.ok(find(solo,'game:rps'));
});

test('uncollected vignette themes accurately say random and daily limited, never promise counts or assign fake progress',()=>{
  const state=initialState(NOW),id=Array.from({length:100},(_,i)=>`unlock-fun-${i}`).find(id=>memoryHash(id)%5===0);
  const next=reduceAction(state,{type:'pet'},male,NOW,id),collected=next.diary.entries.find(entry=>entry.kind==='fun');
  const goals=memoryUnlocks(next,NOW).filter(goal=>goal.entry.kind==='fun');
  assert.equal(goals.length,11);assert.ok(!find(next,`fun:${collected.variant}`));
  for(const goal of goals){assert.match(goal.requirement,/每天最多一篇，内容随机/);assert.equal(goal.progress,null);assert.match(goal.status,/今天的随笔已记录/);}
  assert.match(find(next,goals[0].id,NOW+DAY).status,/随机邂逅/);
});

test('next anniversary shares leap-day and Shanghai boundaries with actual journal creation',()=>{
  const adopted=Date.parse('2024-02-29T08:00:00Z'),before=Date.parse('2025-02-27T15:59:59Z'),due=before+1000;
  const state={...initialState(adopted),diary:emptyMemoryJournal(adopted)};
  assert.deepEqual(nextMemoryAnniversaryGoal(state.diary,before),{at:Date.parse('2025-02-27T16:00:00Z'),year:1,days:1});
  assert.match(find(state,'anniversary:1',before).status,/还需 1 天/);
  assert.ok(!find(state,'anniversary:1',due));assert.ok(find(state,'anniversary:2',due));
  assert.ok(normalizeMemoryJournal(state.diary,state,due).entries.some(entry=>entry.id==='anniversary:1'));
  assert.equal(state.diary.entries.length,1);
});

test('locked cards show accessible progress, lock and complete conditions without favorite/export controls; filters paginate independently',()=>{
  const state=initialState(NOW);state.name='<猫>';
  const html=memoryJournalPanel(state,{tab:'locked',now:NOW});
  assert.match(html,/待解锁 \d+/);assert.match(html,/id="diary-tab-locked" aria-selected="true"/);
  assert.match(html,/memory-photo-locked/);assert.match(html,/class="memory-lock"/);assert.match(html,/<progress[^>]*aria-label=/);
  assert.match(html,/领取成长气泡/);assert.doesNotMatch(html,/<猫>/);
  assert.doesNotMatch(html,/data-memory-favorite|data-memory-card=|data-memory-download/);
  assert.equal((html.match(/data-memory-unlock=/g)||[]).length,8);
  const second=memoryJournalPanel(state,{tab:'locked',page:1,now:NOW});
  assert.doesNotMatch(second,/data-memory-unlock="level:2"/);
  const fun=memoryJournalPanel(state,{tab:'locked',filter:'fun',now:NOW});
  assert.match(fun,/随机/);assert.doesNotMatch(fun,/<progress/);
  const allFun=structuredClone(state);
  allFun.diary.entries.push(...Array.from({length:12},(_,variant)=>({id:`fun:${Math.floor((NOW+8*3600_000)/DAY)-variant}`,kind:'fun',variant,at:NOW-variant*DAY,sourceId:`old-fun-${variant}`,catName:'糯米',photo:'happy'})));
  assert.match(memoryJournalPanel(allFun,{tab:'locked',filter:'fun',now:NOW}),/这一类的回忆已经收齐了/);
  assert.match(memoryJournalPanel(state,{now:NOW}),/data-memory-card="adoption"/);
});
