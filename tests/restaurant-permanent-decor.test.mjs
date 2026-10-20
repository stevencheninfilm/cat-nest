import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,normalizeState,reduceAction} from '../src/state.js';
import {restaurantInfo,validRestaurant} from '../src/restaurant.js';
import {restaurantLevelStartXp as levelStartXp} from '../src/growth-levels.js';
import {RESTAURANT_DECORATIONS,restaurantDecorationSnapshot,validDecorationSnapshot} from '../src/restaurant-decor.js';
import {restaurantDecorationsPanel} from '../src/restaurant-decor-ui.js';
const NOW=Date.parse('2026-10-19T16:00:00Z'),actor={id:'permanent-decor',name:'店长'};
const seed=()=>{const s=initialState(NOW);s.coins=10000;s.restaurant.stats.experience=levelStartXp(50);return s;};
const act=(s,action,now=NOW)=>{const next=reduceAction(s,action,actor,now);assert.ok(next,action.type);return next;};

test('purchasing a suite grants its bonus immediately, before installation, with no wallet or XP gift',()=>{
  const s=seed(),old=structuredClone(s);const next=act(s,{type:'restaurant-decoration',decorationId:'cream-library'});
  assert.equal(next.coins,s.coins-180);assert.equal(next.goldFish,s.goldFish);assert.equal(next.xp,s.xp);assert.equal(next.restaurant.decorationId,undefined);
  assert.deepEqual(restaurantInfo(next,NOW).decorationInfo.activeBuffs,{coins:100,experience:150,cookSpeed:0});assert.deepEqual(s,old);
  const order=act(next,{type:'restaurant-start',recipeId:'sandwich'},NOW+1).restaurant.orders[0];assert.deepEqual(order.decorationSnapshot.ids,['cream-bakery','cream-library']);assert.equal(order.decorationSnapshot.experience,150);
});

test('all six owned bonuses stay active through each visual scene and reload without repeated charges',()=>{
  let s=seed();s.restaurant.ownedThemes=['cream','mint','sakura'];s.restaurant.ownedDecorations=RESTAURANT_DECORATIONS.map(d=>d.id);
  const before=s.coins;for(const [i,suite] of RESTAURANT_DECORATIONS.entries()){
    const at=NOW+i*13000;s=act(s,{type:'restaurant-decoration',decorationId:suite.id},at);s=normalizeState(JSON.parse(JSON.stringify(s)),at+12000);
    assert.deepEqual(restaurantInfo(s,at+12000).decorationInfo.activeBuffs,{coins:450,experience:450,cookSpeed:250});assert.equal(s.coins,before);assert.equal(validRestaurant(s.restaurant),true);
  }
  s=act(s,{type:'restaurant-start',recipeId:'coffee'},NOW+80000);const order=s.restaurant.orders[0];assert.equal(order.workflow.cookSpeedBp,250);assert.equal(validRestaurant(s.restaurant),true);
});

test('switching the visual base theme does not remove any owned permanent bonus',()=>{
  let s=seed();s.restaurant.ownedDecorations=['cream-bakery','cream-library','mint-greenhouse'];s.restaurant.ownedThemes=['cream','mint'];
  s=act(s,{type:'restaurant-theme',themeId:'mint'});const first=restaurantDecorationSnapshot(s.restaurant);
  s=act(s,{type:'restaurant-theme',themeId:'cream'},NOW+1);assert.deepEqual(restaurantDecorationSnapshot(s.restaurant),first);assert.equal(s.restaurant.decorationId,undefined);
});

test('all unlocked cooking bonuses survive normal arrival, manual steps and a saved interactive workflow',()=>{
  let s=seed();s.restaurant.ownedThemes=['cream','mint','sakura'];s.restaurant.ownedDecorations=RESTAURANT_DECORATIONS.map(d=>d.id);
  s=act(s,{type:'restaurant-arrive',recipeId:'rice',partySize:1});let order=s.restaurant.orders[0],at=order.createdAt;
  assert.equal(order.workflow.version,4);assert.equal(order.workflow.cookSpeedBp,250);
  s=act(s,{type:'restaurant-kitchen-accept',orderId:order.id},at);s=act(s,{type:'restaurant-kitchen-step',orderId:order.id,stepId:'gather'},at);
  order=s.restaurant.orders[0];assert.equal(order.workflow.runs.length,1);assert.equal(order.workflow.cookSpeedBp,250);assert.equal(validRestaurant(s.restaurant),true);
  const restored=normalizeState(JSON.parse(JSON.stringify(s)),order.workflow.runs[0].endAt);assert.deepEqual(restored.restaurant.orders[0],order);assert.equal(validRestaurant(restored.restaurant),true);
});

test('an accepted order keeps its permanent bonus snapshot when another suite is unlocked',()=>{
  let s=act(seed(),{type:'restaurant-start',recipeId:'sandwich'});const before=structuredClone(s.restaurant.orders[0]);
  s=act(s,{type:'restaurant-decoration',decorationId:'cream-library'},NOW+1);assert.deepEqual(s.restaurant.orders[0],before);
  assert.deepEqual(before.decorationSnapshot.ids,['cream-bakery']);assert.equal(restaurantDecorationSnapshot(s.restaurant).experience,150);
});

test('old single-suite and no-snapshot orders remain valid without changing their reward or duration',()=>{
  let s=act(seed(),{type:'restaurant-start',recipeId:'sandwich'});const order=s.restaurant.orders[0];
  delete order.decorationSnapshot;assert.equal(validRestaurant(s.restaurant),true);
  s.restaurant.ownedDecorations=['cream-bakery'];order.decorationSnapshot={id:'cream-bakery',coins:100,experience:0,cookSpeed:0};
  assert.equal(validRestaurant(s.restaurant),true);const saved=structuredClone(order);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s)),NOW+1000).restaurant.orders[0],saved);
});

test('combined snapshots reject forged totals, duplicate or unknown pieces, extra fields and unowned IDs',()=>{
  const good=restaurantDecorationSnapshot(seed().restaurant);assert.equal(validDecorationSnapshot(good),true);
  for(const patch of [{coins:999},{experience:-1},{cookSpeed:250},{ids:['cream-bakery','cream-bakery']},{ids:['missing']},{ids:[]},{version:3},{ids:null},{extra:1}])assert.equal(validDecorationSnapshot({...good,...patch}),false);
  const s=act(seed(),{type:'restaurant-start',recipeId:'sandwich'});s.restaurant.orders[0].decorationSnapshot={version:2,ids:['cream-library'],coins:0,experience:150,cookSpeed:0};assert.equal(validRestaurant(s.restaurant),false);
});

test('the gallery describes permanent unlocked bonuses rather than requiring an equipped scene',()=>{
  const html=restaurantDecorationsPanel(restaurantInfo(seed(),NOW));assert.match(html,/解锁后加成常驻叠加/);assert.doesNotMatch(html,/仅当前套装增益生效/);
});
