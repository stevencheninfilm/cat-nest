import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, levelInfo, validPendingGrowth } from '../src/state.js';
import { petNeeds, NEEDS_DECAY_INTERVAL_MS as INTERVAL, addGrowthExperience } from '../src/pet-needs.js';
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
  assert.equal(petNeeds(healthy(), START + 20 * INTERVAL).multiplier,1);
});

test('saved needs decay at exact half-hour boundaries, preserve partial time and never double-decay', () => {
  const before = healthy(), snapshot = structuredClone(before);
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

test('each status opens its own readable methods, threshold and decay explanation', () => {
  const buttons=needButtons();
  for (const key of ['hunger','mood','energy']) {
    assert.match(buttons,new RegExp(`data-open="need-${key}"`));
    const html=needDetails({...healthy(),energy:80},key,{now:START,clientId:actor.id});
    assert.match(html,/大于 80，成长 \+10%/);
    assert.match(html,/当前成长总倍率 1.2，查看全部成长加成/);
    assert.match(html,new RegExp(`aria-valuenow="${key === 'energy' ? 80 : 100}"`));
    assert.match(html,/每 30 分钟各下降 1 点/);
    assert.match(html,key === 'energy' ? /再 \+1 达标/ : /本项 \+10%/);
    assert.doesNotMatch(html,/need-bonus-checks|LITTLE DAILY CARE/);
  }
  assert.match(needDetails(healthy(),'hunger',{now:START}),/鲜鱼罐罐<small>冷却 [^<]+<\/small><\/span><b class="need-gain">\+35/);
  assert.match(needDetails(healthy(),'mood',{now:START}),/温柔摸摸<\/span><b class="need-gain">\+6/);
  assert.match(needDetails(healthy(),'energy',{now:START}),/立即恢复 20 点活力/);
  assert.match(needDetails(healthy(),'energy',{now:START}),/当前成长总倍率 1.3/);
  const sleeping=needDetails({...healthy(),sleeping:true},'energy',{now:START});
  assert.match(sleeping,/小猫正在休息。叫醒不会再次恢复活力/);
  assert.doesNotMatch(sleeping,/data-need-action="sleep"/);
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
  const state={...healthy(),hunger:81,mood:82};
  assert.match(growthBonusDetails(state,{now:START}),/<strong>×1.3/);
  const first=growthBonusDetails(state,{now:START+INTERVAL});
  assert.match(first,/<strong>×1.2/); assert.match(first,/饱饱 80 \/ 100，成长加成 0%，还差 1 点到 81/);
  const second=growthBonusDetails(state,{now:START+2*INTERVAL});
  assert.match(second,/<strong>×1.1/); assert.match(second,/饱饱 79 \/ 100，成长加成 0%，还差 2 点到 81/); assert.match(second,/开心 80 \/ 100，成长加成 0%，还差 1 点到 81/);
});
