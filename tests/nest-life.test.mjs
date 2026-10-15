import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { localNestTime, NEST_PERIODS, LIFE_RULES, LIFE_EVENTS, normalizeLifeLedger, rollLifeEvent, createLifeScheduler, makeLifeEvent } from '../src/nest-life.js';
import { lifeDiaryMarkup } from '../src/nest-life-ui.js';
import { createCatBehavior, catTemperament } from '../src/cat-behavior.js';
import { createDialoguePicker, CAT_DIALOGUE } from '../src/cat-speech.js';
import { scopedStorage } from '../src/home-storage.js';
import { HOME_ENTRIES } from '../src/home-context.js';
import { initialState } from '../src/state.js';
const at=(hour=14,day=15,minute=0)=>new Date(2026,9,day,hour,minute).valueOf();
function fixture({random=()=>0,storage,canEvent}={}) {
  let now=at(),saved=storage?.getItem('life')?JSON.parse(storage.getItem('life')):null,allowed=true;
  const shown=[],ended=[];
  const options={read:()=>saved,write:value=>{saved=structuredClone(value);storage?.setItem('life',JSON.stringify(saved));},clock:()=>now,random,canEvent:()=>allowed&&(!canEvent||canEvent()),onEvent:event=>shown.push(event),onEnd:()=>ended.push(now)};
  const scheduler=createLifeScheduler(options);
  return {scheduler,shown,ended,options,get saved(){return saved;},get now(){return now;},set now(value){now=value;},allow(value){allowed=value;},tick(ms=0){now+=ms;scheduler.tick();},opportunity(){scheduler.tick();now+=LIFE_RULES.warmupMs;scheduler.tick();}};
}
test('four local periods agree across atmosphere, cat temperament and dialogue at every boundary',()=>{
  const pick=createDialoguePicker(()=>.4),state={hunger:70,mood:80,energy:80};
  for(const [hour,minute,period] of [[5,59,'night'],[6,0,'morning'],[10,59,'morning'],[11,0,'day'],[16,59,'day'],[17,0,'evening'],[20,59,'evening'],[21,0,'night'],[23,59,'night'],[0,0,'night']]){
    const time=at(hour,15,minute),info=localNestTime(time);assert.equal(info.period,period);assert.equal(catTemperament(state,time).period,period);assert.equal(info.clock,`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
    assert.ok(CAT_DIALOGUE[period].includes(pick('greeting',{...state,behaviorPeriod:period})));assert.ok(NEST_PERIODS[period].ambient>0);
  }
  assert.equal(localNestTime(at(8)).day,'2026-10-15');assert.equal(localNestTime(at(0,16)).day,'2026-10-16');
  assert.equal(localNestTime(at(8)).description,localNestTime(at(8,15,30)).description);
  assert.ok(new Set(Array.from({length:14},(_,n)=>localNestTime(at(8,15+n)).description)).size>1);
});
test('the same real instant follows each device timezone instead of a fixed server hour',()=>{
  for(const [timezone,period,clock] of [['America/Los_Angeles','night','04:00'],['Asia/Shanghai','evening','19:00'],['UTC','day','11:00']]) {
    const source="import {localNestTime} from './src/nest-life.js';const time=localNestTime(Date.UTC(2026,9,15,11));console.log(JSON.stringify([time.period,time.clock]));";
    const actual=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source],{env:{...process.env,TZ:timezone},encoding:'utf8'}));
    assert.deepEqual(actual,[period,clock]);
  }
});
test('low-probability checks do not reroll every frame or after a reload',()=>{
  let rolls=0;const f=fixture({random:()=>{rolls++;return .9;}});f.opportunity();assert.equal(rolls,1);assert.equal(f.shown.length,0);
  for(let n=0;n<59;n++)f.tick(1000);assert.equal(rolls,1);
  const restored=createLifeScheduler(f.options);restored.tick();f.now+=LIFE_RULES.warmupMs;restored.tick();assert.equal(rolls,2,'only one later minute was checked');
  f.now+=2*86400000;restored.tick();assert.equal(rolls,3,'returning does not replay two days of missed opportunities');
  const empty=normalizeLifeLedger(null,at());assert.equal(rollLifeEvent(empty,at(),()=>LIFE_RULES.chance),null);assert.ok(rollLifeEvent(empty,at(),()=>0));
});
test('rare moments have a persisted fifteen-minute cooldown and three-event local daily cap',()=>{
  const f=fixture();f.opportunity();assert.equal(f.shown.length,1);assert.equal(f.saved.count,1);
  f.tick(LIFE_RULES.holdMs);assert.equal(f.ended.length,1);assert.equal(f.scheduler.active,null);
  f.tick(LIFE_RULES.cooldownMs-LIFE_RULES.holdMs-1);assert.equal(f.shown.length,1);f.tick(1);assert.equal(f.shown.length,2);
  f.tick(LIFE_RULES.cooldownMs);assert.equal(f.shown.length,3);f.tick(2*LIFE_RULES.cooldownMs);assert.equal(f.shown.length,3);
  assert.notEqual(f.shown[0].kind,f.shown[1].kind);assert.equal(f.saved.records.length,3);
  const restored=createLifeScheduler(f.options);restored.tick();f.now+=LIFE_RULES.warmupMs;restored.tick();assert.equal(f.shown.length,3);
  f.now=at(8,16);restored.tick();assert.equal(f.shown.length,4);assert.equal(f.saved.count,1);assert.equal(f.saved.records.length,4);
});
test('backgrounds, busy views and user interactions cancel quietly and resume with a fresh gap',()=>{
  const f=fixture();f.allow(false);f.tick(20*60000);assert.equal(f.saved,null);assert.equal(f.shown.length,0);
  f.allow(true);f.tick();f.tick(LIFE_RULES.warmupMs-1);assert.equal(f.shown.length,0);f.tick(1);assert.equal(f.shown.length,1);
  f.scheduler.interrupt();assert.equal(f.scheduler.active,null);assert.equal(f.ended.length,1);assert.equal(f.saved.count,1);
  f.allow(false);f.tick(30*60000);f.allow(true);f.tick();f.tick(LIFE_RULES.warmupMs-1);assert.equal(f.shown.length,1);f.tick(1);assert.equal(f.shown.length,2);
});
test('midnight, time rollback and daylight-saving clock changes do not bypass cooldown or leave a stuck effect',()=>{
  const f=fixture();f.now=at(23,15,59);f.opportunity();const last=f.now;
  f.now=last-3600000;f.scheduler.tick();assert.equal(f.scheduler.active,null);assert.equal(f.saved.count,1);assert.equal(f.shown.length,1);
  f.now=at(0,16,1);f.scheduler.tick();assert.equal(f.shown.length,1,'new local day still respects the previous event cooldown');
  f.now=last+LIFE_RULES.cooldownMs;f.scheduler.tick();assert.equal(f.shown.length,2);assert.equal(f.saved.day,'2026-10-16');assert.equal(f.saved.count,1);
  assert.equal(normalizeLifeLedger(f.saved,at(8,15)).count,1);assert.equal(rollLifeEvent(normalizeLifeLedger(f.saved,at(8,15)),at(8,15),()=>0),null);
});
test('night events stay quiet, variant selection varies and corrupt records fail closed to an empty cosmetic ledger',()=>{
  for(let n=0;n<30;n++){const ledger=normalizeLifeLedger(null,at(23));const values=[0,n/30,n/30];const event=rollLifeEvent(ledger,at(23),()=>values.shift());assert.notEqual(event.kind,'spill');}
  const invalid={version:1,day:'2026-10-15',count:0,checkedAt:0,lastAt:0,records:[{...makeLifeEvent('gift',at()),at:Number.MAX_SAFE_INTEGER}]};
  assert.deepEqual(normalizeLifeLedger(invalid,at()).records,[]);
  for(const record of [{...makeLifeEvent('gift',at()),kind:'<script>'},{...makeLifeEvent('gift',at()),variant:999}])assert.equal(normalizeLifeLedger({...invalid,records:[record]},at()).records.length,0);
  assert.doesNotMatch(lifeDiaryMarkup([makeLifeEvent('gift',at())],at()),/script|data-action/);
  assert.match(lifeDiaryMarkup([],at()),/偶尔会有一点小惊喜/);
});
test('event clips yield to care, expressions, authored actions and sleep without touching rewards or needs',()=>{
  const state=initialState(at()),before=structuredClone(state),behavior=createCatBehavior({clock:()=>at(),random:()=>0});behavior.setState(state);
  assert.equal(behavior.ambientEvent('gift').source,'ambient');assert.equal(behavior.canAmbientEvent(),true);
  behavior.react('pet');assert.equal(behavior.snapshot().source,'interaction');assert.equal(behavior.ambientEvent('spill'),false);
  behavior.cancel();behavior.setExpression('happy');assert.equal(behavior.ambientEvent('gift'),false);
  behavior.cancel();behavior.playAction('walk');assert.equal(behavior.ambientEvent('gift'),false);
  behavior.cancel({sleeping:true});assert.equal(behavior.ambientEvent('affection'),false);
  assert.deepEqual(state,before);
});
test('cosmetic ledgers isolate each registered home and manual previews never produce a persisted event',()=>{
  const raw=new Map(),storage={getItem:key=>raw.get(key)??null,setItem:(key,value)=>raw.set(key,value)};
  const saves=HOME_ENTRIES.map(home=>scopedStorage(storage,home));
  for(let n=0;n<saves.length;n++){const f=fixture({storage:saves[n]});assert.equal(f.saved,null);f.opportunity();assert.equal(f.saved.count,1);}
  assert.equal(raw.size,HOME_ENTRIES.length);assert.ok(raw.has('life'));assert.ok(raw.has('evian:life'));assert.ok(raw.has('test:life'));
  const f=fixture();for(const kind of Object.keys(LIFE_EVENTS)){assert.equal(f.scheduler.preview(kind),true);f.scheduler.interrupt();}assert.equal(f.saved,null);assert.equal(f.shown.length,3);
});
