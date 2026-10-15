import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, CARE_LIMITS } from '../src/state.js';
import { emptyCoupleCare, normalizeCoupleCare, validCoupleCare, recordCoupleCare, cooperationTasks, cooperationDay, COUPLE_RECORD_LIMIT } from '../src/couple-care.js';
import { sharedCarePanel, careRecords, cooperationButton } from '../src/couple-care-ui.js';

const start = Date.parse('2026-10-14T08:00:00Z'), minute = 60_000;
const male = { id:'partner-male', name:'男方' }, female = { id:'partner-female', name:'女方' };
const perform = (state, actor, type, at, id, extra = {}) => reduceAction(state, { type,...extra }, actor, at, id);
function relay(at = start) {
  const first = perform(initialState(at), male, 'pet', at, `male-pet-${at}`);
  return perform(first, female, 'play', at + minute, `female-play-${at}`);
}
const options = { clientId:male.id, entered:true, configured:true, phase:'online', known:true, ready:true, members:[male,female], now:start + 2 * minute };

test('old saves keep their state and display old canonical care without inventing cooperation', () => {
  const before = initialState(start); delete before.coupleCare;
  before.history = [{ actor:'女方',text:'喂了一份幼猫慕斯，生成40点成长气泡待领取',at:start - minute }];
  const next = normalizeState(before, start);
  assert.equal(next.love,before.love); assert.equal(next.coins,before.coins);
  assert.deepEqual(next.coupleCare,emptyCoupleCare(start));
  assert.equal(careRecords(next,start)[0].food,'mousse');
  assert.ok(cooperationTasks(next,male.id,start).every(task => !task.completed && !task.first));
});

test('two different canonical caregivers complete a relay once without bonus currency or XP', () => {
  const next = relay();
  assert.equal(next.coupleCare.records.length,2);
  assert.equal(next.coupleCare.moments.length,1);
  assert.equal(next.coupleCare.moments[0].kind,'relay');
  assert.equal(next.coupleCare.moments[0].firstActorId,male.id);
  assert.equal(next.coupleCare.moments[0].secondActorId,female.id);
  let baseline=perform(initialState(start),{id:'generic-male',name:'男方'},'pet',start,'generic-pet-0001');
  baseline=perform(baseline,{id:'generic-female',name:'女方'},'play',start+minute,'generic-play-0001');
  for (const key of ['coins','love','xp']) assert.equal(next[key],baseline[key]);
  assert.deepEqual(next.pendingGrowth.map(item=>item.amount),baseline.pendingGrowth.map(item=>item.amount));
  const again=perform(next,male,'pet',start+6*minute,'male-second-pet');
  assert.equal(again.coupleCare.moments.length,1);
});

test('one caregiver or a third identity cannot complete a couple event', () => {
  let next=perform(initialState(start),male,'pet',start,'self-pet-one');
  next=perform(next,male,'play',start+minute,'self-play-two');
  assert.equal(next.coupleCare.moments.length,0);
  const stranger=perform(initialState(start),{id:'third-person',name:'女方'},'pet',start,'third-pet-one');
  const paired=perform(stranger,male,'play',start+minute,'male-play-third');
  assert.equal(paired.coupleCare.records.length,1);
  assert.equal(paired.coupleCare.moments.length,0);
});

test('shared meals use the current feeding round and retain the existing pair reward', () => {
  let next=perform(initialState(start),male,'feed',start,'pair-meal-male',{food:'water'});
  next=perform(next,female,'feed',start+minute,'pair-meal-female',{food:'mousse'});
  assert.equal(next.coupleCare.moments[0].kind,'meal');
  assert.equal(next.careLimits.counts.pair,1);
  assert.equal(next.love,86+5+40+10);
  const later=perform(next,male,'feed',start+4*60*minute,'later-meal-male',{food:'meal'});
  assert.equal(later.coupleCare.moments.length,1);
});

test('goodnight requires the other caregiver to rest after care; waking never completes it', () => {
  let next=perform(initialState(start),male,'pet',start,'goodnight-pet-male');
  next=perform(next,male,'sleep',start+minute,'goodnight-sleep-self');
  assert.equal(next.coupleCare.moments.length,0);
  next=perform(next,female,'sleep',start+2*minute,'goodnight-wake-female');
  assert.equal(next.coupleCare.records[0].type,'wake');
  assert.equal(next.coupleCare.moments.length,0);
  let paired=perform(initialState(start),male,'pet',start,'other-pet-male');
  paired=perform(paired,female,'sleep',start+minute,'other-sleep-female');
  assert.equal(paired.coupleCare.moments[0].kind,'goodnight');
});

test('a relay expires at thirty minutes and rejected care leaves no record', () => {
  const first=perform(initialState(start),male,'pet',start,'expiry-pet-male');
  assert.equal(perform(first,female,'pet',start+minute,'rejected-cooldown'),null);
  const late=perform(first,female,'play',start+30*minute,'expiry-play-female');
  assert.equal(late.coupleCare.moments.length,0);
  assert.ok(cooperationTasks(first,female.id,start+30*minute).every(task=>!task.first));
  assert.equal(first.coupleCare.records.length,1);
});

test('a repeated operation cannot append activity or a second memory', () => {
  const next=relay();
  const record=next.coupleCare.records[0];
  const again=recordCoupleCare(next.coupleCare,{type:'play'},female.id,record.at,record.id);
  assert.deepEqual(again,next.coupleCare);
});

test('daily memories renew at the shared timezone boundary and survive clock rollback', () => {
  const nearMidnight=Date.parse('2026-10-14T15:58:00Z');
  const first=relay(nearMidnight);
  const nextDay=nearMidnight+24*60*minute;
  const a=perform(first,male,'pet',nextDay,'day-two-pet');
  const next=perform(a,female,'play',nextDay+minute,'day-two-play');
  assert.equal(next.coupleCare.moments.length,2);
  assert.equal(cooperationDay(nearMidnight+2*minute),cooperationDay(nearMidnight)+1);
  const rollback=normalizeCoupleCare(next.coupleCare,nearMidnight);
  assert.equal(rollback.moments.length,2);
  assert.equal(rollback.day,next.coupleCare.day);
});

test('activity has a bounded recent window while every cooperation memory remains saved and pageable', () => {
  let care=emptyCoupleCare(start);
  for(let day=0;day<100;day++) {
    const at=start+day*86_400_000;
    care=recordCoupleCare(care,{type:'pet'},male.id,at,`archive-male-${day}`);
    care=recordCoupleCare(care,{type:'play'},female.id,at+minute,`archive-female-${day}`);
  }
  assert.equal(care.records.length,COUPLE_RECORD_LIMIT);
  assert.equal(care.moments.length,100);
  assert.equal(validCoupleCare(care),true);
  const state={...initialState(start),coupleCare:JSON.parse(JSON.stringify(care))};
  const html=sharedCarePanel(state,{...options,now:start+100*86_400_000,tab:'memories',memoriesPage:4});
  assert.match(html,/已留下 100 个共同纪念/);
  assert.match(html,/5 \/ 5/);
  assert.match(html,/2026年10月14日/);
});

test('corrupt activity, duplicate memories and spoofed identities fail storage validation', () => {
  const care=relay().coupleCare;
  assert.equal(validCoupleCare({...care,records:[{...care.records[0],id:123456789}]}),false);
  assert.equal(validCoupleCare({...care,records:[{...care.records[0],actorId:'third-person'}]}),false);
  assert.equal(validCoupleCare({...care,moments:[...care.moments,...care.moments]}),false);
  assert.equal(validCoupleCare({...care,moments:[{...care.moments[0],firstActorId:female.id}]}),false);
  assert.equal(normalizeCoupleCare({...care,records:[null,...care.records]},start+minute).records.length,2);
});

test('suggestions distinguish waiting for a partner from joining, and cannot bypass cooldowns', () => {
  const state=perform(initialState(start),male,'pet',start,'suggestion-pet-male');
  const mine=cooperationTasks(state,male.id,start+minute).find(task=>task.id==='relay');
  const partners=cooperationTasks(state,female.id,start+minute).find(task=>task.id==='relay');
  assert.equal(mine.waiting,true); assert.equal(partners.waiting,false); assert.equal(partners.action.type,'play');
  assert.equal(cooperationButton(mine,state,{...options,now:start+minute}).disabled,true);
  const played=perform(state,female,'play',start+minute,'suggestion-play-female');
  const task={...partners,completed:null};
  assert.equal(cooperationButton(task,played,{...options,now:start+2*minute,clientId:female.id}).disabled,true);
  const quota={...state,careLimits:{...state.careLimits,counts:{...state.careLimits.counts,play:CARE_LIMITS.play.dailyLimit}}};
  assert.match(cooperationButton(partners,quota,{...options,clientId:female.id}).label,/次数已满/);
});

test('legacy diary deduplication and UI escaping preserve accurate role attribution', () => {
  const state=relay();
  assert.equal(careRecords(state,start+minute).filter(record=>record.actorId===male.id&&record.type==='pet').length,1);
  const html=sharedCarePanel({...state,name:'<img src=x onerror=alert(1)>'},{...options,notice:{title:'<script>',text:'<b>unsafe</b>',until:start+3*minute}});
  assert.doesNotMatch(html,/<img|<script>|<b>unsafe/);
  assert.match(html,/&lt;img/); assert.match(html,/&lt;script&gt;/);
});
