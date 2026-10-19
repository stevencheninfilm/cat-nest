import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurantExperienceGain, createRestaurantExperience } from '../src/restaurant-experience-ui.js';
import { levelStartXp } from '../src/growth-levels.js';
import { restaurantGrowthStage } from '../src/restaurant-growth-stages.js';

const progression=(experience,earnedExperience=experience)=>({experience,earnedExperience});
function fakeContainer() {
  let html='',nodes=new Map();
  const classes=new Set();
  const element=()=>({textContent:'',style:{},attributes:new Map(),setAttribute(name,value){this.attributes.set(name,String(value));},getAttribute(name){return this.attributes.get(name)??null;}});
  return {
    ...element(),
    hidden:true,style:{setProperty(name,value){this[name]=value;}},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
    get innerHTML(){return html;},set innerHTML(value){
      html=value;nodes=new Map();if(!value)return;
      for(const id of ['amount','fill','level','value'])nodes.set(`[data-r-gain-${id}]`,element());
      nodes.get('[data-r-gain-fill]').parentElement=element();
      nodes.get('[data-r-gain-amount]').textContent=value.match(/data-r-gain-amount>([^<]*)</)?.[1]??'';
    },
    querySelector(selector){return nodes.get(selector)??null;},
  };
}
function fakeClock() {
  let now=0,nextId=0;const jobs=new Map();
  const schedule=(kind,callback,delay)=>{const id=++nextId;jobs.set(id,{id,kind,callback,delay,at:now+delay});return id;};
  const next=()=>[...jobs.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];
  const runNext=()=>{const job=next();if(!job)return false;now=job.at;jobs.delete(job.id);job.callback(now);return true;};
  return {
    setTimer:(callback,delay)=>schedule('timer',callback,delay),clearTimer:id=>jobs.delete(id),
    requestFrame:callback=>schedule('frame',callback,16),cancelFrame:id=>jobs.delete(id),
    get now(){return now;},get pending(){return [...jobs.values()];},
    runNext,
    advance(ms){const until=now+ms;let count=0;while(next()?.at<=until){assert.ok(++count<1000,'the fake clock must not spin');runNext();}now=until;},
    finishAnimations(){let count=0;while(jobs.size){const job=next();if(job.kind==='timer'&&job.delay===1400)return;assert.ok(++count<1000,'animation queue must terminate');runNext();}},
  };
}
function fixture({reducedMotion=false}={}) {
  const container=fakeContainer(),clock=fakeClock();
  const controller=createRestaurantExperience({container,setTimer:clock.setTimer,clearTimer:clock.clearTimer,requestFrame:clock.requestFrame,cancelFrame:clock.cancelFrame,reducedMotion:()=>reducedMotion});
  const node=id=>container.querySelector(`[data-r-gain-${id}]`);
  return {container,clock,controller,node};
}

test('one real earned increment produces one same-level segment without mutating authoritative progression',()=>{
  const before=progression(15,10),after=progression(21,16),saved=structuredClone({before,after});
  const gain=restaurantExperienceGain(before,after);
  assert.deepEqual(gain,{earned:6,fromLevel:1,level:1,levelsGained:0,segments:[{level:1,fromExperience:15,experience:21,target:120,from:15/120,to:21/120}]});
  assert.deepEqual({before,after},saved);
});

test('a tenth of earned XP at 119.9 fills the old bar before entering level two',()=>{
  const gain=restaurantExperienceGain(progression(119.9),progression(120));
  assert.equal(gain.earned,.1);assert.equal(gain.fromLevel,1);assert.equal(gain.level,2);assert.equal(gain.levelsGained,1);
  assert.deepEqual(gain.segments,[
    {level:1,fromExperience:119.9,experience:120,target:120,from:119.9/120,to:1},
    {level:2,fromExperience:0,experience:0,target:150,from:0,to:0},
  ]);
});

test('a batched payment crossing several levels reaches the final authoritative level with bounded feedback',()=>{
  const gain=restaurantExperienceGain(progression(110),progression(500));
  assert.equal(gain.earned,390);assert.equal(gain.fromLevel,1);assert.equal(gain.level,4);assert.equal(gain.levelsGained,3);
  assert.equal(gain.segments.length,2);
  assert.deepEqual(gain.segments.map(({level,fromExperience,experience,target})=>({level,fromExperience,experience,target})),[
    {level:1,fromExperience:110,experience:120,target:120},{level:4,fromExperience:0,experience:50,target:210},
  ]);
});

test('duplicate snapshots, offset-only migration credit, XP rollback and malformed data never create a gain',()=>{
  for(const [before,after] of [
    [progression(120,36),progression(660,36)],
    [progression(660,144),progression(660,144)],
    [progression(660,144),progression(650,150)],
    [progression(120,40),progression(130,39)],
  ])assert.equal(restaurantExperienceGain(before,after),null);
  for(const invalid of [undefined,null,{},progression(-1),progression(Infinity),progression(10,-1),progression(10,NaN),{experience:'120',earnedExperience:120}]) {
    assert.equal(restaurantExperienceGain(invalid,progression(120)),null);
    assert.equal(restaurantExperienceGain(progression(0),invalid),null);
  }
});

test('first sync, duplicate sync and offset-only loading are silent and the next real reward uses the loaded baseline',()=>{
  const {controller,container,clock,node}=fixture();
  controller.sync(progression(120,36));controller.sync(progression(120,36));controller.sync(progression(660,36));
  assert.equal(container.hidden,true);assert.equal(container.innerHTML,'');assert.equal(clock.pending.length,0);
  controller.sync(progression(666,42));
  assert.equal(container.hidden,false);assert.equal(node('amount').textContent,'+6');assert.equal(node('level').textContent,'Lv.5');
  clock.finishAnimations();assert.equal(node('value').textContent,'6 / 240');
  assert.equal(node('fill').parentElement.getAttribute('aria-valuenow'),'3');
});

test('cross-level controller feedback fills the previous level and then resets to the new level progress',()=>{
  const {controller,clock,node}=fixture();controller.sync(progression(119.9));controller.sync(progression(120));
  assert.equal(node('level').textContent,'Lv.1');
  clock.runNext();clock.runNext();
  assert.equal(Number.parseFloat(node('fill').style.width),100);
  assert.equal(node('fill').parentElement.getAttribute('aria-valuenow'),'100');
  clock.runNext();
  assert.equal(node('level').textContent,'Lv.2');assert.equal(Number.parseFloat(node('fill').style.width),0);
  clock.finishAnimations();
  assert.equal(node('value').textContent,'0 / 150');assert.equal(node('fill').parentElement.getAttribute('aria-valuenow'),'0');
});

test('crossing each ten-level title boundary fills the old color before showing the new title and palette',()=>{
  for(const level of [11,21,31,41]){
    const {controller,container,clock,node}=fixture(),xp=levelStartXp(level);
    controller.sync(progression(xp-1));controller.sync(progression(xp));
    assert.equal(container.getAttribute('data-r-growth-stage'),restaurantGrowthStage(level-1).id);
    assert.equal(container.style['--rg-bar'],restaurantGrowthStage(level-1).bar);
    assert.ok(container.innerHTML.includes(`${restaurantGrowthStage(level).title} · 升至 Lv.${level}`));
    clock.runNext();clock.runNext();clock.runNext();
    assert.equal(node('level').textContent,`Lv.${level}`);
    assert.equal(container.getAttribute('data-r-growth-stage'),restaurantGrowthStage(level).id);
    assert.equal(container.style['--rg-bar'],restaurantGrowthStage(level).bar);
    clock.finishAnimations();clock.advance(1580);
    assert.equal(container.hidden,true);
  }
});

test('completion waits 1400 ms before the 180 ms fade, and duplicate sync never extends the deadline',()=>{
  const {controller,container,clock}=fixture();controller.sync(progression(0));controller.sync(progression(6));clock.finishAnimations();
  const completedAt=clock.now;assert.equal(clock.pending.length,1);assert.equal(clock.pending[0].at,completedAt+1400);
  clock.advance(1000);controller.sync(progression(6));
  assert.equal(clock.pending.length,1);assert.equal(clock.pending[0].at,completedAt+1400);
  clock.advance(399);assert.equal(container.hidden,false);assert.equal(container.classList.contains('is-leaving'),false);
  clock.advance(1);assert.equal(container.hidden,false);assert.equal(container.classList.contains('is-leaving'),true);
  clock.advance(179);assert.equal(container.hidden,false);
  clock.advance(1);assert.equal(container.hidden,true);assert.equal(container.innerHTML,'');assert.equal(clock.pending.length,0);
});

test('rapid rewards accumulate their heading and drain every queued bar to the final level and progress',()=>{
  const {controller,container,clock,node}=fixture();controller.sync(progression(110));
  controller.sync(progression(116));assert.equal(node('amount').textContent,'+6');
  controller.sync(progression(122));assert.equal(node('amount').textContent,'+12');
  controller.sync(progression(155));assert.equal(node('amount').textContent,'+45');
  clock.finishAnimations();
  assert.equal(container.hidden,false);assert.equal(node('amount').textContent,'+45');assert.equal(node('level').textContent,'Lv.2');
  assert.equal(node('value').textContent,'35 / 150');assert.ok(Math.abs(Number.parseFloat(node('fill').style.width)-35/150*100)<1e-9);
  assert.equal(clock.pending.length,1,'one final dismissal remains after all three gains complete');
  clock.advance(1580);assert.equal(container.hidden,true);
  controller.sync(progression(156));assert.equal(node('amount').textContent,'+1','a later feedback session starts a new displayed total');
});

test('a reward arriving during fade cancels dismissal and preserves the running feedback total',()=>{
  const {controller,container,clock,node}=fixture();controller.sync(progression(0));controller.sync(progression(6));clock.finishAnimations();
  clock.advance(1400);assert.equal(container.classList.contains('is-leaving'),true);
  controller.sync(progression(13));
  assert.equal(container.classList.contains('is-leaving'),false);assert.equal(node('amount').textContent,'+13');
  clock.advance(180);assert.equal(container.hidden,false,'the cancelled old fade cannot hide the new reward');
  clock.finishAnimations();assert.equal(node('value').textContent,'13 / 120');
  clock.advance(1580);assert.equal(container.hidden,true);
});

test('reset and destroy cancel queued animations, frames and timers and clear the observation baseline',()=>{
  for(const phase of ['first-frame','second-frame','animation-timer','dismiss-timer','fade-timer'])for(const method of ['reset','destroy']) {
    const {controller,container,clock,node}=fixture();controller.sync(progression(110));controller.sync(progression(116));controller.sync(progression(122));
    if(phase==='second-frame')clock.runNext();
    if(phase==='animation-timer'){clock.runNext();clock.runNext();}
    if(['dismiss-timer','fade-timer'].includes(phase))clock.finishAnimations();
    if(phase==='fade-timer')clock.advance(1400);
    const staleCallbacks=clock.pending.map(job=>job.callback);
    controller[method]();assert.equal(clock.pending.length,0);assert.equal(container.hidden,true);assert.equal(container.innerHTML,'');
    assert.equal(container.classList.contains('is-leaving'),false);
    for(const callback of staleCallbacks)callback(clock.now);
    assert.equal(clock.pending.length,0);assert.equal(container.hidden,true);assert.equal(container.innerHTML,'','late callbacks from a cancelled generation stay inert');
    clock.advance(100000);controller.sync(progression(122));assert.equal(container.hidden,true,'reopening at the latest snapshot establishes a silent baseline');
    controller.sync(progression(123));assert.equal(node('amount').textContent,'+1');
  }
});

test('switching to a lower save stops current feedback and later sync never replays the previous room gain',()=>{
  const {controller,container,clock,node}=fixture();controller.sync(progression(110));controller.sync(progression(122));controller.sync(progression(150));
  controller.sync(progression(50));assert.equal(container.hidden,true);assert.equal(clock.pending.length,0);
  controller.sync(progression(50));assert.equal(container.hidden,true);
  controller.sync(progression(52));assert.equal(node('amount').textContent,'+2');clock.finishAnimations();assert.equal(node('value').textContent,'52 / 120');
  controller.sync(progression(51,53));assert.equal(container.hidden,true,'effective XP rollback also resets when the earned counter rises');
  controller.sync(progression(52,54));assert.equal(node('amount').textContent,'+1');
});

test('reduced motion preserves level transitions, queued totals and the normal final dismissal',()=>{
  const {controller,container,clock,node}=fixture({reducedMotion:true});controller.sync(progression(119.9));controller.sync(progression(120));controller.sync(progression(126));
  clock.finishAnimations();assert.equal(node('amount').textContent,'+6.1');assert.equal(node('level').textContent,'Lv.2');assert.equal(node('value').textContent,'6 / 150');
  assert.equal(clock.pending.length,1);assert.equal(clock.pending[0].delay,1400);
  clock.advance(1580);assert.equal(container.hidden,true);assert.equal(clock.pending.length,0);
});
