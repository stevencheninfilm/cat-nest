import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, CARE_LIMITS, careActionInfo, initialState, normalizeState, reduceAction, levelInfo, validPendingGrowth } from '../src/state.js';
import { petNeeds, NEED_KEYS, NEEDS_DECAY_INTERVAL_MS as INTERVAL, addGrowthExperience } from '../src/pet-needs.js';
import { needButtons, needDetails, growthBonusBadge, growthBonusDetails } from '../src/pet-needs-ui.js';
import { growthStageProgress } from '../src/growth-stages.js';
import { growthTray } from '../src/growth-ui.js';

const START = Date.UTC(2026, 9, 14, 0);
const actor = { id:'partner-male', name:'男方' };
const healthy = () => ({ ...initialState(START), hunger:100, mood:100, energy:100 });

test('each need above 80 adds ten percent, up to an additive 1.3 multiplier', () => {
  const keys=['hunger','mood','energy'];
  for(let mask=0;mask<8;mask++) {
    const values=Object.fromEntries(keys.map((key,index)=>[key,mask & (1<<index) ? 81 : 80]));
    const count=Object.values(values).filter(value=>value===81).length;
    assert.equal(petNeeds({...healthy(),...values},START).multiplier,(10+count)/10);
    assert.equal(petNeeds({...healthy(),...values},START).boostCount,count);
  }
  assert.equal(petNeeds(healthy(), START + 19 * INTERVAL).multiplier,1.3);
  assert.equal(petNeeds(healthy(), START + 20 * INTERVAL - 1).multiplier,1.3);
  assert.equal(petNeeds(healthy(), START + 20 * INTERVAL).multiplier,1);
});

test('saved needs decay at exact half-hour boundaries, preserve partial time and never double-decay', () => {
  const before = healthy(), snapshot = structuredClone(before);
  assert.equal(INTERVAL,30*60_000);
  assert.deepEqual(NEED_KEYS.map(key=>petNeeds(before,START+30*60_000-1)[key]),[100,100,100]);
  assert.deepEqual(NEED_KEYS.map(key=>petNeeds(before,START+30*60_000)[key]),[99,99,99]);
  assert.deepEqual(NEED_KEYS.map(key=>petNeeds(before,START+60*60_000)[key]),[98,98,98]);
  assert.deepEqual(NEED_KEYS.map(key=>petNeeds(before,START+24*60*60_000)[key]),[52,52,52]);
  assert.equal(petNeeds(before, START + INTERVAL - 1).hunger, 100);
  const first = normalizeState(before, START + INTERVAL + 1234);
  assert.deepEqual([first.hunger,first.mood,first.energy], [99,99,99]);
  assert.equal(first.needsUpdatedAt, START + INTERVAL);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(first)), START + 2 * INTERVAL - 1);
  assert.equal(reloaded.hunger, 99);
  assert.equal(normalizeState(reloaded, START + 2 * INTERVAL).hunger, 98);
  assert.deepEqual(normalizeState(first, START + INTERVAL + 1234), first);
  assert.equal(petNeeds(first, START).hunger, 99, 'clock rollback never restores needs');
  const away = normalizeState(before, START + 10000 * INTERVAL);
  assert.deepEqual([away.hunger,away.mood,away.energy], [0,0,0]);
  assert.deepEqual(before, snapshot);
});

test('unrelated saves and care cannot reset the unfinished decay interval', () => {
  let state = healthy();
  for (let minute=1; minute<30; minute++) state=reduceAction(state,{type:'rename',name:'糯米'},actor,START + minute * 60_000);
  assert.equal(state.needsUpdatedAt, START);
  const after = reduceAction(state,{type:'pet'},actor,START + INTERVAL,'decay-pet-operation');
  assert.equal(after.hunger,99);
  assert.equal(after.energy,99);
  assert.equal(after.needsUpdatedAt,START + INTERVAL);
  const legacy = healthy(); delete legacy.needsUpdatedAt;
  assert.equal(normalizeState(legacy,START + INTERVAL).hunger,99,'legacy saves use their saved update time');
});

test('care balances lower consumption and slower mood gains with the actual affordability boundary', () => {
  const before={...initialState(START),hunger:40,mood:40,energy:40},snapshot=structuredClone(before);
  for (const [action,expected] of [
    [{type:'feed',food:'meal'},[62,40,50]],
    [{type:'pet'},[40,41,40]],
    [{type:'play'},[39,42,38]],
    [{type:'sleep'},[40,40,80]],
  ]) {
    const after=reduceAction(before,action,actor,START,`balanced-care-${action.type}`);
    assert.deepEqual(NEED_KEYS.map(key=>after[key]),expected,action.type);
    assert.equal(after.xp,before.xp,'care never claims growth automatically');
  }
  assert.deepEqual(before,snapshot);
  const affordable=reduceAction({...before,energy:2,hunger:0},{type:'play'},actor,START,'balanced-play-last-energy');
  assert.equal(affordable.energy,0); assert.equal(affordable.hunger,0);
  assert.equal(reduceAction({...before,energy:1},{type:'play'},actor,START,'balanced-play-not-enough'),null);
  const full=reduceAction({...before,mood:99},{type:'pet'},actor,START,'balanced-pet-cap');
  assert.equal(full.mood,100);
});

test('every boosted care freezes its exact additive reward before applying care changes', () => {
  for (const [type, amount] of [['pet',3.9],['play',10.4],['sleep',5.2],['feed',65]]) {
    const next=reduceAction(healthy(),{type,...(type==='feed'?{food:'fish'}:{})},actor,START,`boosted-${type}-reward`);
    assert.equal(next.pendingGrowth[0].amount,amount);
    assert.equal(next.pendingGrowth[0].boosted,true);
    assert.equal(next.xp,86);
    assert.equal(validPendingGrowth(next.pendingGrowth),true);
    assert.equal(next.love,86+({pet:3,play:5,sleep:0,feed:50}[type]),'only growth receives the multiplier');
  }
  const start={...healthy(),hunger:80};
  const fed=reduceAction(start,{type:'feed',food:'fish'},actor,START,'crossing-hunger-threshold');
  assert.equal(fed.pendingGrowth[0].amount,60,'crossing the threshold enables the following interaction');
  const touched=reduceAction(fed,{type:'pet'},actor,START,'after-hunger-threshold');
  assert.equal(touched.pendingGrowth[1].amount,3.9);
  const expired=reduceAction({...healthy(),energy:81},{type:'pet'},actor,START + INTERVAL,'expired-boost-reward');
  assert.equal(expired.pendingGrowth[0].amount,3.6,'server-time decay is evaluated before rewarding');
});

test('food and water restore capped energy even after sleep quota, with rewards frozen before recovery', () => {
  for (const [food, amount] of [['meal',10],['water',12]]) {
    const before={...healthy(),energy:76};
    before.careLimits.counts.sleep=CARE_LIMITS.sleep.dailyLimit;
    const snapshot=structuredClone(before);
    assert.equal(careActionInfo(before,{type:'sleep'},actor.id,START).reason,'daily_limit');
    const after=reduceAction(before,{type:'feed',food},actor,START,`recover-energy-${food}`);
    assert.equal(after.energy,76+amount);
    assert.equal(after.careLimits.counts.feed,1);
    assert.equal(after.careLimits.counts.sleep,3);
    assert.equal(after.pendingGrowth[0].amount,FOODS[food].love*1.2,'new energy applies to the next reward');
    const touched=reduceAction(after,{type:'pet'},actor,START,`recovered-bonus-${food}`);
    assert.equal(touched.pendingGrowth[1].amount,3.9);
    assert.equal(normalizeState(JSON.parse(JSON.stringify(after)),START).energy,after.energy);
    assert.equal(reduceAction(after,{type:'feed',food},actor,START+1,`recover-too-early-${food}`),null);
    const capped=reduceAction({...healthy(),energy:98},{type:'feed',food},actor,START,`recover-energy-cap-${food}`);
    assert.equal(capped.energy,100);
    const exhausted={...before,careLimits:{...before.careLimits,counts:{...before.careLimits.counts,feed:CARE_LIMITS.feed.dailyLimit}}};
    assert.equal(reduceAction(exhausted,{type:'feed',food},actor,START,`recover-feed-limit-${food}`),null);
    assert.deepEqual(before,snapshot);
  }
});

test('one available rest recovers low energy above 90 and drinking still works after all rests',()=>{
  const before={...healthy(),energy:59,mood:90};
  const rest=reduceAction(before,{type:'sleep'},actor,START,'balance-rest-from-59');
  assert.equal(rest.energy,99);assert.equal(rest.mood,90);assert.equal(rest.xp,before.xp);
  const wake=reduceAction(rest,{type:'sleep'},actor,START+1,'balance-wake-from-99');
  assert.equal(wake.energy,99);
  assert.equal(reduceAction(wake,{type:'sleep'},actor,START+2,'balance-repeat-rest'),null);
  const capped={...before,energy:78,careLimits:{...before.careLimits,counts:{...before.careLimits.counts,sleep:3}}};
  const water=reduceAction(capped,{type:'feed',food:'water'},actor,START,'balance-water-from-78');
  assert.equal(water.energy,90);assert.equal(water.mood,90);assert.equal(water.careLimits.counts.sleep,3);
});

test('feeding no longer refills a full mood, while elapsed time and companionship have distinct effects',()=>{
  const before=healthy();
  const fed=reduceAction(before,{type:'feed',food:'meal'},actor,START+INTERVAL,'balance-mood-meal');
  assert.equal(fed.mood,99);
  const petted=reduceAction(fed,{type:'pet'},actor,START+INTERVAL,'balance-mood-pet');
  assert.equal(petted.mood,100);
  const played=reduceAction({...before,mood:85},{type:'play'},actor,START,'balance-mood-play');
  assert.equal(played.mood,87);assert.equal(played.energy,98);
  const reload=normalizeState(JSON.parse(JSON.stringify(petted)),START+INTERVAL);
  assert.equal(reload.mood,100);assert.equal(reload.energy,petted.energy);
  assert.equal(reload.xp,before.xp);assert.deepEqual(reload.pendingGrowth,petted.pendingGrowth);
});

test('a legitimate day keeps energy recoverable while happiness no longer stays full from feeding and play', () => {
  const hourMs=60*60_000, day=START-8*hourMs;
  let state={...initialState(day),hunger:100,mood:100,energy:100};
  const schedule=[
    [.5,'play'],[1.5,'play'],[2.5,'play'],[3.5,'feed','meal'],[4.5,'play'],[5.5,'sleep'],
    [6.5,'play'],[7.5,'play'],[8.5,'feed','water'],[9.5,'play'],[10.5,'play'],[11.5,'feed','meal'],
    [12.5,'play'],[13.5,'sleep'],[14.5,'play'],[15.5,'feed','meal'],
  ];
  for (const [hour,type,food] of schedule) {
    const now=day+hour*hourMs;
    state=reduceAction(state,{type,...(food?{food}:{})},actor,now,`daily-energy-${hour}-${type}`);
    assert.ok(state,`${type} at ${hour}h respects all care limits`);
  }
  assert.deepEqual([state.careLimits.counts.sleep,state.careLimits.counts.feed,state.careLimits.counts.play],[2,4,10]);
  assert.ok(state.energy>=90,'normal feeding and two rests sustain high energy with ten play sessions');
  assert.ok(state.mood>=80 && state.mood<100,'a day of play leaves a healthy but non-maxed mood');
  const nextMorning=petNeeds(state,day+24*hourMs-1);
  assert.ok(nextMorning.energy>80);assert.ok(nextMorning.mood<80);
  assert.equal(nextMorning.multiplier,1.2,'happiness needs renewed attention after time away');
});

test('frozen boosted bubbles survive offline time and count exact decimal XP once', () => {
  const pending=reduceAction({...healthy(),xp:119.9},{type:'pet'},actor,START,'decimal-pet-reward');
  const later=START+1000*INTERVAL;
  const saved=normalizeState(JSON.parse(JSON.stringify(pending)),later);
  assert.deepEqual(saved.pendingGrowth,pending.pendingGrowth);
  const claimed=reduceAction(saved,{type:'claim-growth',rewardId:'decimal-pet-reward'},actor,later);
  assert.equal(claimed.xp,123.8);
  assert.deepEqual(levelInfo(claimed.xp),{level:2,progress:3.8,target:150});
  assert.equal(normalizeState(JSON.parse(JSON.stringify(claimed)),later).xp,123.8);
  assert.equal(reduceAction(claimed,{type:'claim-growth',rewardId:'decimal-pet-reward'},actor,later+1),null);
  let xp=0; for(let index=0;index<10;index++) xp=addGrowthExperience(xp,3.3);
  assert.equal(xp,33);
  assert.equal(growthStageProgress(2550.3).earned,.3);
  assert.equal(growthStageProgress(2550.3).remaining,5549.7);
  const rewards=Array.from({length:3},(_,i)=>({...pending.pendingGrowth[0],id:`decimal-total-${i}`}));
  assert.match(growthTray(rewards),/共 11.7 点待领取/);
});

test('old bubble values never gain a bonus at claim time and invalid bonus metadata fails validation', () => {
  const plain=reduceAction({...initialState(START),mood:80},{type:'pet'},actor,START,'old-normal-pet-reward');
  const claimed=reduceAction({...plain,hunger:100,mood:100,energy:100},{type:'claim-growth',rewardId:'old-normal-pet-reward'},actor,START);
  assert.equal(claimed.xp,89);
  for (const extra of [{amount:3.3},{amount:999,boosted:true},{amount:3.4,boosted:true},{amount:3,boosted:false}]) {
    assert.equal(validPendingGrowth([{...plain.pendingGrowth[0],...extra}]),false);
  }
  const boosted=reduceAction({...healthy(),xp:Number.MAX_SAFE_INTEGER},{type:'pet'},actor,START,'unsafe-decimal-reward');
  assert.equal(reduceAction(boosted,{type:'claim-growth',rewardId:'unsafe-decimal-reward'},actor,START),null);
  assert.equal(boosted.pendingGrowth.length,1);
});

test('each status explains its balanced recovery and the shared half-hour decay rule', () => {
  const buttons=needButtons();
  for (const key of ['hunger','mood','energy']) {
    assert.match(buttons,new RegExp(`data-open="need-${key}"`));
    const html=needDetails({...healthy(),energy:80},key,{now:START,clientId:actor.id});
    assert.match(html,/大于 80，成长 \+10%/);
    assert.match(html,/当前成长总倍率 1.2，查看全部成长加成/);
    assert.match(html,new RegExp(`aria-valuenow="${key === 'energy' ? 80 : 100}"`));
    assert.match(html,/每 30 分钟：饱饱下降 1 点、开心下降 1 点、活力下降 1 点/);
    assert.match(html,key === 'energy' ? /再 \+1 达标/ : /本项 \+10%/);
    assert.doesNotMatch(html,/need-bonus-checks|LITTLE DAILY CARE/);
  }
  assert.match(needDetails(healthy(),'hunger',{now:START}),/鲜鱼罐罐<small>冷却 [^<]+<\/small><\/span><b class="need-gain">\+35/);
  assert.match(needDetails(healthy(),'mood',{now:START}),/温柔摸摸<\/span><b class="need-gain">\+1/);
  assert.match(needDetails(healthy(),'energy',{now:START}),/立即恢复 40 点活力/);
  assert.match(needDetails(healthy(),'energy',{now:START}),/当前成长总倍率 1.3/);
  const sleeping=needDetails({...healthy(),sleeping:true},'energy',{now:START});
  assert.match(sleeping,/小猫正在休息。叫醒不会再次恢复活力/);
  assert.doesNotMatch(sleeping,/data-need-action="sleep"/);
});

test('energy details keep food recovery available while sleep is capped, cooling down or already asleep', () => {
  for (const kind of ['capped','cooldown','sleeping']) {
    const state={...healthy(),energy:70,sleeping:kind==='sleeping'};
    if(kind==='capped') state.careLimits.counts.sleep=3;
    if(kind==='cooldown') state.careLimits.lastActions.sleep=START;
    const html=needDetails(state,'energy',{now:START,clientId:actor.id});
    assert.match(html,/开始休息<\/span><b class="need-gain">\+40/);
    assert.match(html,/清清饮水<\/span><b class="need-gain">\+12/);
    assert.match(html,/普通食物<\/span><b class="need-gain">\+10/);
    assert.match(html,/<button type="button" class="need-recovery-link" data-open="feeding">/);
    assert.match(html,/休息每日 3 次，间隔 4 小时/);
    if(kind!=='sleeping') assert.match(html,/<button class="primary modal-primary" disabled data-need-action="sleep"/);
  }
});

test('the bonus badge remains a keyboard-accessible detail entry even without a bonus', () => {
  const html=growthBonusBadge();
  assert.match(html,/<button type="button"[^>]*data-open="growth-bonus"[^>]*aria-haspopup="dialog"/);
  assert.doesNotMatch(html,/\bhidden\b/);
  const none=growthBonusDetails({...healthy(),hunger:80,mood:70,energy:0},{now:START});
  assert.match(none,/当前总倍率<\/span><strong>×1.0/);
  assert.doesNotMatch(none,/bonus-goal|bonus-step-meter|距离 ×1.3/);
  assert.equal((none.match(/<b>\+0%<\/b>/g)||[]).length,3);
  for(const [label,value,gap] of [['饱饱',80,1],['开心',70,11],['活力',0,81]]) assert.match(none,new RegExp(`${label} ${value} / 100，成长加成 0%，还差 ${gap} 点到 81`));
});

test('bonus overview itemizes contributions and exact state gaps without changing the save', () => {
  const state={...healthy(),hunger:90,mood:80,energy:70},before=structuredClone(state);
  const html=growthBonusDetails(state,{now:START});
  assert.match(html,/当前总倍率<\/span><strong>×1.1/);
  assert.match(html,/基础 100% \+ 状态加成 10%/);
  assert.match(html,/饱饱 90 \/ 100，成长加成 10%，已达标/);
  assert.match(html,/开心 80 \/ 100，成长加成 0%，还差 1 点到 81/);
  assert.match(html,/活力 70 \/ 100，成长加成 0%，还差 11 点到 81/);
  assert.doesNotMatch(html,/bonus-goal|bonus-step-meter|还差 2 项达标|开心再 \+1|活力再 \+11/);
  assert.match(html,/3 → 3.3/);
  assert.deepEqual(state,before);
  const full=growthBonusDetails(healthy(),{now:START});
  assert.match(full,/当前总倍率<\/span><strong>×1.3/);
  assert.equal((full.match(/<b>\+10%<\/b>/g)||[]).length,3);
  assert.doesNotMatch(full,/再 \+0|还差 0 项/);
});

test('the overview recalculates contributions and per-state gaps after a decay boundary', () => {
  const state={...healthy(),hunger:81,mood:81};
  assert.match(growthBonusDetails(state,{now:START}),/<strong>×1.3/);
  const first=growthBonusDetails(state,{now:START+INTERVAL});
  assert.match(first,/<strong>×1.1/); assert.match(first,/饱饱 80 \/ 100，成长加成 0%，还差 1 点到 81/);
  const second=growthBonusDetails(state,{now:START+2*INTERVAL});
  assert.match(second,/<strong>×1.1/); assert.match(second,/饱饱 79 \/ 100，成长加成 0%，还差 2 点到 81/); assert.match(second,/开心 79 \/ 100，成长加成 0%，还差 2 点到 81/);
});
