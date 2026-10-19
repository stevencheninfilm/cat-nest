import test from 'node:test';
import assert from 'node:assert/strict';
import { affectionValue, formatAffection, affectionHistoryText } from '../src/affection.js';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { feedingSheet, foodPreview } from '../src/feeding-ui.js';
import { diaryTimeline } from '../src/diary-ui.js';

const now=Date.UTC(2026,9,16,12),male={id:'partner-male',name:'男方'},female={id:'partner-female',name:'女方'};

test('affection displays whole points by truncation while retaining the one-tenth point unit',()=>{
  for(const [saved,shown]of [[0,'0'],[3,'0'],[5,'0'],[9,'0'],[10,'1'],[19,'1'],[86,'8'],[378,'37'],[12345,'1,234'],[999999,'99,999']])assert.equal(formatAffection(saved),shown);
  assert.equal(affectionValue(86),8.6);
  for(const value of [undefined,null,NaN,Infinity,-1])assert.equal(formatAffection(value),'0');
});

test('reloading an old save never rescales its stored units or loses a tenth-point pet reward',()=>{
  let state={...initialState(now),love:543};
  for(let i=0;i<5;i++){
    state=normalizeState(JSON.parse(JSON.stringify(state)),now);
    assert.equal(state.love,543);assert.equal(formatAffection(state.love),'54');
  }
  const next=reduceAction(state,{type:'pet'},male,now,'affection-pet');
  assert.equal(formatAffection(next.love),'54');assert.equal(next.xp,86);assert.equal(next.coins,100);
  assert.equal(next.pendingGrowth[0].amount,3.3,'growth keeps its existing amount');
  const reopened=normalizeState(JSON.parse(JSON.stringify(next)),now);
  assert.equal(formatAffection(reopened.love),'54');assert.equal(reopened.love,546);
  const second=reduceAction(reopened,{type:'pet'},male,now+5*60*1000,'affection-pet-2');
  assert.equal(second.love,549);assert.equal(formatAffection(second.love),'54');
  const third=reduceAction(second,{type:'pet'},male,now+10*60*1000,'affection-pet-3');
  assert.equal(third.love,552);assert.equal(formatAffection(third.love),'55','small gains accumulate into the next whole point');
});

test('feeding bonuses show one intimacy point while preserving ten base growth points',()=>{
  let state=reduceAction(initialState(now),{type:'feed',food:'water'},male,now,'affection-water');
  assert.equal(formatAffection(state.love),'9');
  state=reduceAction(state,{type:'feed',food:'fish'},female,now+1000,'affection-fish');
  assert.equal(formatAffection(state.love),'15');assert.equal(state.coins,55);assert.equal(state.xp,86);
  assert.equal(state.pendingGrowth[1].amount,72,'the 50+10 growth reward retains its existing 1.2 boost');
  const menu=feedingSheet({state:initialState(now),clientId:male.id,selectedFood:'fish',now});
  assert.match(menu,/鲜鱼罐罐，成长气泡加55，亲密度加5，/);
  assert.match(menu,/额外获得 1 亲密度和 10 点成长气泡/);
  assert.match(foodPreview('water'),/♡ \+0 /);
});

test('legacy diary copy uses the new unit without changing stored history or growth numbers',()=>{
  const text='喂了一份鲜鱼罐罐，双人喂养额外获得10点亲密度';
  const history=[{actor:'男方',at:now,text}],before=structuredClone(history);
  const html=diaryTimeline(history,{now});
  assert.match(html,/双人喂养额外获得1点亲密度/);assert.deepEqual(history,before);
  const growth='收下成长气泡，获得10点成长';assert.equal(affectionHistoryText(growth),growth);
});
