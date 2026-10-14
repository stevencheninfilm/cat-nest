import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, levelInfo, reduceAction } from '../src/state.js';
import { GROWTH_STAGES, getGrowthStage, growthStageForXp, growthStageProgress, growthUpgrade } from '../src/growth-stages.js';
import { growthStagesPanel, growthUpgradePanel } from '../src/growth-stage-ui.js';
import { growthBubbles, growthTray, jellyHeartMarkup } from '../src/growth-ui.js';

const xpAt = level => 15 * (level - 1) * (level + 6);
const expected = ['jelly','candy','crystal','amber','gold-amber','ruby','sapphire','opal','diamond'];

test('every ten-level boundary follows the selected material order, without capping levels', () => {
  for (let index=0; index<expected.length; index++) {
    const first = index * 10 + 1;
    assert.equal(getGrowthStage(first).id, expected[index]);
    assert.equal(getGrowthStage(first+9).id, expected[index]);
    assert.equal(growthStageForXp(xpAt(first)).id, expected[index]);
    if (index) assert.equal(growthStageForXp(xpAt(first)-1).id, expected[index-1]);
  }
  assert.equal(getGrowthStage(1000).id, 'diamond');
  assert.equal(levelInfo(xpAt(105)).level, 105);
  for (const input of [NaN, -10, undefined]) assert.equal(getGrowthStage(input).id, 'jelly');
});

test('bubbles, backlog and flying heart artwork select the same current material', () => {
  const reward={id:'saved-reward',kind:'pet',amount:3,actor:'男方'};
  for (const stage of GROWTH_STAGES) {
    for (const html of [growthBubbles([reward],{stage}),growthTray([reward],{stage}),jellyHeartMarkup(stage)]) {
      assert.match(html,new RegExp(`data-heart-stage="${stage.id}"`));
      assert.match(html,new RegExp(`--growth-color:${stage.color}`));
      assert.match(html,new RegExp(`assets/growth-hearts/v1/${stage.id}\\.webp`));
    }
  }
});

test('previewing locked stages keeps actual level and progress unchanged', () => {
  const xp=xpAt(12)+35;
  const before=growthStageForXp(xp);
  const html=growthStagesPanel(xp,'ruby');
  assert.equal((html.match(/data-stage-preview=/g)||[]).length,9);
  assert.match(html,/红宝石材质预览/);
  assert.match(html,/Lv\.51 解锁/);
  assert.match(html,/当前 Lv\.12 · 镭射糖果/);
  assert.match(html,/aria-label="当前阶段成长进度" aria-valuenow="455" aria-valuemin="0" aria-valuemax="5550"/);
  assert.match(html,/本级 35 \/ 450/);
  assert.match(html,/data-stage-preview="ruby"[^]*?aria-pressed="true"/);
  assert.equal(growthStageForXp(xp),before);
});

test('stage growth uses the full ten-level budget and resets only at the next skin boundary', () => {
  for (const [index,stage] of GROWTH_STAGES.slice(0,-1).entries()) {
    const start=xpAt(stage.min), end=xpAt(GROWTH_STAGES[index+1].min), target=end-start;
    const fresh=growthStageProgress(start,stage);
    assert.equal(fresh.target,target);
    assert.equal(fresh.earned,0);
    assert.equal(fresh.ratio,0);
    assert.equal(fresh.remaining,target);
    const half=growthStageProgress(start+target/2,stage);
    assert.equal(half.earned,target/2);
    assert.equal(half.ratio,.5);
    assert.equal(half.remaining,target/2);
    const last=growthStageProgress(end-1,stage);
    assert.equal(last.remaining,1);
    assert.ok(last.ratio<1);
    assert.equal(growthStageProgress(end,stage).ratio,1);
    assert.equal(growthStageProgress(end, GROWTH_STAGES[index+1]).ratio,index===7?1:0);
  }
  assert.equal(growthStageProgress(1275).ratio,.5);
  assert.equal(growthStageProgress(1275).target,2550);
  assert.equal(growthStageProgress(xpAt(11)+1).earned,1);
  assert.equal(growthStageProgress(xpAt(11)+1).target,5550);
});

test('future meters are empty, completed meters are full, and the final skin has no invented XP target', () => {
  const candy=GROWTH_STAGES[1],diamond=GROWTH_STAGES.at(-1);
  const locked=growthStageProgress(1275,candy);
  assert.equal(locked.locked,true);
  assert.equal(locked.earned,0);
  assert.equal(locked.ratio,0);
  assert.equal(locked.unlockRemaining,1275);
  const preview=growthStagesPanel(1275,'candy');
  assert.match(preview,/再积攒 1,275 点成长，Lv\.11 解锁镭射糖果/);
  assert.match(preview,/class="stage-preview-bar stage-meter"[^>]*aria-valuenow="0"[^]*?class="stage-bar-fill" style="width:0%" hidden/);
  assert.match(preview,/class="stage-progress-track stage-meter"[^>]*aria-valuenow="1275"[^>]*aria-valuemax="2550"[^]*?style="width:50%"/);
  const past=growthStageProgress(xpAt(25),GROWTH_STAGES[0]);
  assert.equal(past.ratio,1);
  assert.equal(past.earned,past.target);
  assert.equal(past.remaining,0);
  assert.equal(growthStageProgress(xpAt(81)-1,diamond).ratio,0);
  const final=growthStageProgress(xpAt(81),diamond);
  assert.equal(final.ratio,1);
  assert.equal(final.target,null);
  assert.equal(final.next,null);
  assert.doesNotMatch(growthStagesPanel(xpAt(100)),/NaN|Infinity/);
});

test('unclaimed bubbles do not advance stage growth, and a confirmed claim preserves leftover XP', () => {
  const now=Date.UTC(2026,9,14),actor={id:'partner-male',name:'男方'};
  const before={...initialState(now),xp:xpAt(11)-2};
  const pending=reduceAction(before,{type:'pet'},actor,now,'stage-progress-reward');
  assert.equal(growthStageProgress(pending.xp).earned,2548);
  assert.equal(growthStageProgress(pending.xp).remaining,2);
  assert.doesNotMatch(growthStagesPanel(pending.xp),/>100%/);
  const after=reduceAction(pending,{type:'claim-growth',rewardId:'stage-progress-reward'},actor,now+1);
  assert.equal(growthStageProgress(after.xp).stage.id,'candy');
  assert.equal(growthStageProgress(after.xp).earned,1.3);
  assert.equal(growthStageProgress(after.xp).remaining,5548.7);
  for(const value of [NaN,-1,Infinity]) assert.equal(growthStageProgress(value).earned,0);
});

test('only a confirmed claim across a material boundary celebrates, and repeats cannot award XP', () => {
  const now=Date.UTC(2026,9,14),actor={id:'partner-male',name:'男方'};
  for (const next of [11,21,31,41,51,61,71,81]) {
    const before={...initialState(now),xp:xpAt(next)-2};
    const pending=reduceAction(before,{type:'pet'},actor,now,`stage-${next}`);
    assert.equal(pending.xp,before.xp);
    assert.equal(growthUpgrade(before.xp,pending.xp),null);
    const after=reduceAction(pending,{type:'claim-growth',rewardId:`stage-${next}`},actor,now+1);
    const upgrade=growthUpgrade(pending.xp,after.xp);
    assert.equal(upgrade.to.min,next);
    assert.equal(upgrade.level,next);
    assert.match(growthUpgradePanel(upgrade,after.xp),new RegExp(upgrade.to.name));
    const repeated=reduceAction(after,{type:'claim-growth',rewardId:`stage-${next}`},actor,now+2);
    assert.equal(repeated,null);
    assert.equal(after.xp,before.xp+3.3);
    assert.equal(growthUpgrade(after.xp,after.xp),null);
  }
  assert.equal(growthUpgrade(xpAt(11),xpAt(10)),null);
  assert.equal(growthUpgrade(xpAt(85),xpAt(100)),null);
  assert.equal(growthUpgrade(0,xpAt(51)).to.id,'ruby');
});
