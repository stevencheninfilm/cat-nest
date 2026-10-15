import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/state.js';
import {COLLECTION_CATS} from '../src/cat-collection.js';
import {catbookMarkup} from '../src/catbook-ui.js';
const now=Date.UTC(2026,9,15);
const detailMarkup=(state,id)=>catbookMarkup(state,{catId:id}).match(/<article class="book-detail"[\s\S]*?<\/article>/)[0];
const detail=(state,id)=>detailMarkup(state,id).replace(/<\/?strong>/g,'');

test('a locked cat shows its own condition, confirmed progress and remaining care',()=>{
  const state=initialState(now);state.collection.stats.feed=8;
  const before=structuredClone(state),html=detail(state,'bolt');
  assert.match(html,/如何解锁闪电/);assert.match(html,/累计喂食 30 次/);
  assert.match(html,/8 \/ 30/);assert.match(html,/还需喂食 22 次/);
  assert.match(html,/data-book-invite="bolt"[^>]* disabled/);
  assert.deepEqual(state,before);
});
test('multi-condition cats list only unmet requirements and explain distinct foods',()=>{
  const state=initialState(now);state.collection.stats.feed=54;state.collection.foods=['water','meal'];
  const html=detail(state,'gozer');
  assert.match(html,/如何解锁布丁/);assert.match(html,/还需尝过 7 种不同的食物/);
  assert.doesNotMatch(html,/还需喂食/);assert.match(html,/每种食物只计一次/);
});
test('daily, game, growth and outfit unlocks give the correct next action',()=>{
  const state=initialState(now);state.collection.achievements.daily.feed=7;
  assert.match(detail(state,'toast'),/最高单日喂食记录还差 3 次/);
  assert.match(detail(state,'toast'),/跨日次数不相加/);
  assert.match(detail(state,'scout'),/还需赢得石头剪刀布 5 局/);
  assert.match(detail(state,'scout'),/完成整局并获胜/);
  assert.match(detail(state,'dottie'),/领取成长气泡来升级/);
  assert.match(detail(state,'velvet'),/换一个不同的装扮并保存/);
});
test('achieved cats can be invited explicitly, and viewing does not invite them',()=>{
  const state=initialState(now);state.collection.stats.pet=5;
  const before=structuredClone(state),html=detail(state,'bandit');
  assert.match(html,/已经可以邀请啦/);
  assert.match(html,/data-book-invite="bandit"[^>]* >/);
  assert.deepEqual(state,before);
  state.collection.invited=[{id:'bandit',at:now,operationId:'existing-invite',actorId:'partner-male'}];
  assert.doesNotMatch(detail(state,'bandit'),/book-unlock-help/);
});
test('every collectible cat has a matching detail without missing metric copy',()=>{
  const state=initialState(now);
  for(const cat of COLLECTION_CATS){
    const html=detail(state,cat.id);
    assert.match(html,new RegExp(`如何解锁${cat.name}|已经可以邀请啦`));
    assert.doesNotMatch(html,/undefined|NaN/);
  }
});
test('remaining numbers and concrete next steps come before the full achievement record',()=>{
  const state=initialState(now);state.collection.stats.feed=8;
  const html=detailMarkup(state,'bolt');
  assert.match(html,/<h3>还差多少<\/h3>/);
  assert.match(html,/还需喂食 <strong>22<\/strong> 次/);
  assert.match(html,/<h3>如何完成<\/h3>[\s\S]*点击「喂食」并选择食物/);
  assert.ok(html.indexOf('book-unlock-help')<html.indexOf('book-achievement-card'));
});
test('daily guidance names the full daily goal even when the historical best is partially complete',()=>{
  const state=initialState(now);state.collection.achievements.daily.feed=7;
  const html=detailMarkup(state,'toast');
  assert.match(html,/最高单日喂食记录还差 <strong>3<\/strong> 次/);
  assert.match(html,/需在同一天完成 10 次，跨日次数不相加/);
});
test('first invitation guidance never overlays the yard cats',()=>{
  const html=catbookMarkup(initialState(now));
  const yard=html.split('</section><header class="book-game-topbar">')[0];
  const about=html.match(/<dialog[^>]*data-book-sheet="about"[\s\S]*?<\/dialog>/)[0];
  assert.doesNotMatch(yard,/book-empty-yard/);
  assert.match(about,/book-empty-yard[\s\S]*邀请斑斑来猫猫车站/);
});
