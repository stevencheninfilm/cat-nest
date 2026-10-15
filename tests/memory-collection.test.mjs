import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, levelStartXp, normalizeState, reduceAction } from '../src/state.js';
import { MEMORY_CARD_THEME_TOTAL, memoryCardThemeId, memoryCollectionCards, memoryDailyFootprints, memoryDay, unlockedMemoryCardCount, validMemoryJournal } from '../src/memory-journal.js';
import { memoryUnlocks } from '../src/memory-unlocks.js';
import { memoryJournalPanel } from '../src/memory-journal-ui.js';
import { canInviteCat, collectionCatProgress, getCollectionCat } from '../src/cat-collection.js';
import { formalMemoryEntries } from './memory-fixtures.mjs';

const NOW=Date.UTC(2026,9,16),DAY=86_400_000;
const actor={id:'partner-male',name:'男方'};
const base={at:NOW,catName:'糯米',photo:'happy'};
const legacy=(i,text=`旧照顾流水${i}`)=>({...base,id:`legacy:${NOW-i}:${i}`,kind:'legacy',at:NOW-i,text,actorId:actor.id});

test('all 37 formal themes are collectible and collected plus locked stays 37 at every step',()=>{
  const state=initialState(NOW),entries=formalMemoryEntries(NOW);
  assert.equal(MEMORY_CARD_THEME_TOTAL,37);
  assert.equal(new Set(entries.map(memoryCardThemeId)).size,37);
  for(let count=1;count<=37;count++) {
    state.diary.entries=entries.slice(0,count);
    assert.ok(validMemoryJournal(state.diary));
    assert.equal(unlockedMemoryCardCount(state.diary),count);
    assert.equal(memoryUnlocks(state,NOW).length,37-count);
  }
  assert.equal(entries.slice(0,36).some(e=>e.kind==='anniversary'),false,'36-cat goal is reachable without waiting a year');
});

test('old moments and repeat upgrades, matches, years and stories cannot inflate collection or catbook progress',()=>{
  const state=initialState(NOW);
  state.diary.entries.push(
    {...base,kind:'level',id:'level:2',level:2},
    {...base,kind:'level',id:'level:3',level:3,at:NOW+1},
    {...base,kind:'game',id:'game:match-1',sourceId:'match-1',occasion:'rps'},
    {...base,kind:'game',id:'game:match-2',sourceId:'match-2',occasion:'rps',at:NOW+2},
    {...base,kind:'together',id:`together:meal:${memoryDay(NOW)}`,occasion:'meal'},
    {...base,kind:'together',id:`together:meal:${memoryDay(NOW-DAY)}`,occasion:'meal',at:NOW-DAY},
    {...base,kind:'fun',id:`fun:${memoryDay(NOW)}`,sourceId:'fun-one',variant:0},
    {...base,kind:'fun',id:`fun:${memoryDay(NOW-DAY)}`,sourceId:'fun-two',variant:0,at:NOW-DAY},
    {...base,kind:'anniversary',id:'anniversary:1',year:1},
    {...base,kind:'anniversary',id:'anniversary:2',year:2,at:NOW+3},
    ...Array.from({length:40},(_,i)=>legacy(i)),
  );
  state.diary.favorites=['game:match-2','game:match-1','level:3',state.diary.entries.at(-1).id];
  const before=structuredClone(state);
  assert.equal(unlockedMemoryCardCount(state.diary),6);
  assert.equal(memoryCollectionCards(state.diary).filter(e=>e.kind==='game').length,1);
  assert.equal(memoryCollectionCards(state.diary,{favoritesOnly:true}).length,2);
  assert.equal(collectionCatProgress(getCollectionCat('nightwatch'),state.collection,999,state.diary).current,6);
  assert.equal(canInviteCat('nightwatch',state.collection,999,undefined,state.diary),false);
  assert.equal(memoryUnlocks(state,NOW).length,31);
  assert.deepEqual(state,before);
});

test('formal album and shared favorites deduplicate while the timeline keeps every actual occasion',()=>{
  const state=initialState(NOW);
  state.diary.entries.push({...base,kind:'level',id:'level:2',level:2}, {...base,kind:'level',id:'level:3',level:3,at:NOW+1}, legacy(0));
  state.diary.favorites=['level:2','level:3'];
  const before=structuredClone(state.diary);
  const album=memoryJournalPanel(state,{now:NOW}),timeline=memoryJournalPanel(state,{tab:'moments',now:NOW}),favorites=memoryJournalPanel(state,{tab:'favorites',now:NOW});
  assert.match(album,/id="diary-tab-collection" aria-selected="true"/);
  assert.equal((album.match(/data-memory-kind="level"/g)||[]).length,1);
  assert.equal((favorites.match(/data-memory-kind="level"/g)||[]).length,1);
  assert.equal((timeline.match(/data-memory-kind="level"/g)||[]).length,2);
  for(const html of [album,timeline,favorites])assert.doesNotMatch(html,/data-memory-kind="legacy"|从旧日记拾起的瞬间/);
  assert.deepEqual(state.diary,before);
});

test('daily footprints retain imported history, merge overlapping recent events and render text safely',()=>{
  const state=initialState(NOW);
  state.diary.entries.push(legacy(0,'<旧瞬间>'),legacy(1,'更早的一次摸摸'));
  state.history=[{at:NOW,text:'<旧瞬间>',actor:'男方'},{at:NOW+1,text:'新的日常照顾',actor:'女方'}];
  const before=structuredClone(state),footprints=memoryDailyFootprints(state.diary,state.history);
  assert.equal(footprints.length,3);
  assert.equal(footprints.filter(e=>e.text==='<旧瞬间>').length,1);
  const html=memoryJournalPanel(state,{tab:'recent',now:NOW});
  assert.match(html,/&lt;旧瞬间&gt;/);assert.match(html,/更早的一次摸摸|新的日常照顾/);
  assert.doesNotMatch(html,/<旧瞬间>|data-memory-card=/);
  assert.deepEqual(state,before);
});

test('48-record legacy save reports 8 of 37 themes and 29 locked; saved ownership and ledger survive normalization',()=>{
  const state=initialState(NOW);
  state.xp=levelStartXp(6)+179;
  state.diary.entries.push(...['feed','pet','play','sleep'].map(occasion=>({...base,kind:'first',occasion,id:`first:${occasion}`})),
    {...base,kind:'level',level:6,id:'level:6'},
    {...base,kind:'fun',variant:9,id:`fun:${memoryDay(NOW)}`,sourceId:'saved-fun'},
    {...base,kind:'together',occasion:'meal',id:`together:meal:${memoryDay(NOW)}`},
    ...Array.from({length:40},(_,i)=>legacy(i)));
  state.collection.invited=[{id:'nightwatch',at:NOW,actorId:actor.id,operationId:'already-confirmed-cat'}];
  const saved=structuredClone(state),normalized=normalizeState(state,NOW);
  assert.equal(normalized.diary.entries.length,48);
  assert.equal(unlockedMemoryCardCount(normalized.diary),8);
  assert.equal(memoryUnlocks(normalized,NOW).length,29);
  assert.deepEqual([...normalized.diary.entries].sort((a,b)=>a.id.localeCompare(b.id)),[...saved.diary.entries].sort((a,b)=>a.id.localeCompare(b.id)));
  assert.equal(normalized.diary.adoptedAt,saved.diary.adoptedAt);
  assert.deepEqual(normalized.diary.favorites,saved.diary.favorites);
  assert.deepEqual(normalized.collection.invited,saved.collection.invited);
  assert.deepEqual(collectionCatProgress(getCollectionCat('nightwatch'),normalized.collection,6,normalized.diary).invited,saved.collection.invited[0]);
  assert.match(memoryJournalPanel(normalized,{now:NOW}),/<strong>8<small>\/ 37<\/small>/);
  assert.match(memoryJournalPanel(normalized,{now:NOW}),/待解锁 29/);
  const favorite=reduceAction(normalized,{type:'diary-favorite',memoryId:'level:6',favorite:true},actor,NOW+1,'deduplicated-favorite');
  assert.equal(unlockedMemoryCardCount(favorite.diary),8);
  assert.deepEqual(favorite.collection.invited,normalized.collection.invited);
});
