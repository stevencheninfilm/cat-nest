import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { restaurantResearchPool, restaurantFragmentSurplus, restaurantFragmentRarity, drawRestaurantResearch, normalizeRestaurantResearch, RESEARCH_INSPIRATION_MAX } from '../src/restaurant-research.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { restaurantResearchPanel } from '../src/restaurant-research-ui.js';
import { restaurantResearchRevealFace } from '../src/restaurant-research-reveal.js';
import { restaurantResearchDebugResult } from '../demo/restaurant-research.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'fragment-owner',name:'店长'};
const seed=()=>restaurantResearchDebugResult(initialState(NOW),{mode:'research-fusion'},NOW).state;
const act=(state,action)=>reduceAction(state,action,ACTOR,NOW);
function fusion(state,id){const info=restaurantInfo(state,NOW),recipe=info.recipes.find(recipe=>recipe.id===id);return {type:'restaurant-research-fuse',recipeId:id,amount:recipe.fragmentResearch.convertible,expectedFragments:recipe.fragments,expectedFusion:info.research.fusionRevision};}

test('unlock order lowers exact pool weights, and recipe quality or completed status never raises rarity odds',()=>{
  const state=seed();state.restaurant.ownedSpecialRecipes=SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id);
  for(const recipe of SPECIAL_RESTAURANT_RECIPES)state.restaurant.recipeLevels[recipe.id]=1;
  const info=restaurantInfo(state,NOW),pool=restaurantResearchPool(info.recipes),sorted=[...pool].sort((a,b)=>a.recipe.unlockLevel-b.recipe.unlockLevel);
  assert.equal(pool.length,21);assert.ok(Math.abs(pool.reduce((sum,item)=>sum+item.chance,0)-1)<1e-12);
  for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].recipe.unlockLevel===sorted[i-1].recipe.unlockLevel?sorted[i].weight===sorted[i-1].weight:sorted[i].weight<sorted[i-1].weight);
  assert.deepEqual([1,10,20,30,40].map(unlockLevel=>restaurantFragmentRarity({unlockLevel}).fusionValue),[1,2,3,4,5]);
  assert.ok(5*restaurantFragmentRarity({unlockLevel:47}).fusionValue<30,'even five rare shards cannot fund another draw alone');
  for(const recipe of info.recipes)state.restaurant.recipeLevels[recipe.id]=5;
  assert.deepEqual(restaurantResearchPool(restaurantInfo(state,NOW).recipes).map(item=>[item.recipe.id,item.weight,item.chance]),pool.map(item=>[item.recipe.id,item.weight,item.chance]));
  assert.ok(drawRestaurantResearch(state.restaurant,restaurantInfo(state,NOW).recipes,21,NOW).ok,'a completed catalog still permits duplicate shards');
});

test('weighted accepted draws retain the quantity guarantee and produce substantially fewer late dishes',()=>{
  const state=seed(),info=restaurantInfo(state,NOW),pool=restaurantResearchPool(info.recipes),counts=new Map(pool.map(item=>[item.recipe.id,0]));
  const total=12000;
  for(let i=0;i<total;i++){const result=drawRestaurantResearch(info.restaurant,info.recipes,21,NOW+i);assert.ok(result.ok);counts.set(result.card.recipeId,counts.get(result.card.recipeId)+1);}
  for(const item of pool)assert.ok(Math.abs(counts.get(item.recipe.id)/total-item.chance)<.013,`${item.recipe.id} is close to its published chance`);
  assert.ok(counts.get('rice')>counts.get('cocoa')*5);
  const tenth=structuredClone(info.restaurant);tenth.research.draws=9;tenth.research.lastDraw.draw=9;
  assert.equal(drawRestaurantResearch(tenth,info.recipes,10,NOW).card.amount,5);
});

test('fusion reserves every remaining promotion cost and atomically returns rarity-based inspiration',()=>{
  assert.deepEqual([1,2,3,4,5].map(level=>restaurantFragmentSurplus({level,fragments:40}).reserve),[34,31,25,15,0]);
  const state=seed(),before=structuredClone(state),intent=fusion(state,'rice'),next=act(state,intent);
  assert.ok(next);assert.equal(intent.amount,9);assert.equal(next.restaurant.research.fragments.rice,31);
  assert.equal(restaurantInfo(next,NOW).research.inspiration-restaurantInfo(state,NOW).research.inspiration,9);assert.ok(validRestaurant(next.restaurant));
  assert.equal(act(next,intent),null,'a stale click cannot consume more fragments');
  const rare=act(next,fusion(next,'cocoa'));assert.ok(rare);assert.equal(rare.restaurant.research.fragments.cocoa,0);
  assert.equal(rare.restaurant.research.fusion.last.rate,5);assert.equal(rare.restaurant.research.fusion.last.inspiration,25);assert.equal(rare.restaurant.research.fusion.inspiration,34);
  assert.ok(validRestaurant(rare.restaurant));for(const key of ['coins','goldFish','xp'])assert.equal(rare[key],state[key]);
  assert.deepEqual(rare.restaurant.recipeLevels,state.restaurant.recipeLevels);assert.deepEqual(rare.restaurant.orders,state.restaurant.orders);assert.deepEqual(state,before);
});

test('insufficient surplus, locked recipes, stale snapshots, unsafe quantities and forged exchange rates are rejected',()=>{
  const state=seed(),good=fusion(state,'rice');
  for(const action of [{...good,amount:10},{...good,expectedFragments:39},{...good,expectedFusion:1},{...good,recipeId:'coffee',expectedFragments:0,amount:1},{...good,recipeId:'cocoa',amount:6}])assert.equal(act(state,action),null);
  for(const action of [{...good,amount:0},{...good,amount:-1},{...good,amount:.5},{...good,amount:Infinity},{...good,rate:1000},{...good,inspiration:999},{...good,expectedFusion:-1},{type:'restaurant-debug-research-fusion'}])assert.equal(sanitizeRestaurantAction(action),null);
  const done=act(state,good);
  for(const mutate of [f=>f.last.rate=5,f=>f.last.amount=10,f=>f.last.inspiration=999,f=>f.inspiration=1000,f=>f.fragments=10000,f=>f.revision=0]){const bad=structuredClone(done.restaurant);mutate(bad.research.fusion);assert.equal(validRestaurant(bad),false);}
});

test('inspiration cap never destroys extra shards, and existing v1/v2 research stays unchanged on load',()=>{
  const state=seed();state.restaurant.research.inspirationEarned=RESEARCH_INSPIRATION_MAX-2;
  assert.equal(restaurantInfo(state,NOW).recipes.find(recipe=>recipe.id==='cocoa').fragmentResearch.convertible,0);
  const excessive={...fusion(state,'rice'),amount:9};assert.equal(act(state,excessive),null);
  const next=act(state,fusion(state,'rice'));assert.ok(next);assert.equal(next.restaurant.research.inspirationEarned,RESEARCH_INSPIRATION_MAX);assert.equal(next.restaurant.research.fragments.rice,38);assert.ok(validRestaurant(next.restaurant));
  const v2=seed().restaurant.research,before=structuredClone(v2);assert.deepEqual(normalizeRestaurantResearch(v2,0),before);assert.ok(!Object.hasOwn(v2,'fusion'));
  const v1={version:1,startedServed:0,draws:2,fragments:{rice:4},lastDraw:{draw:2,recipeId:'rice',amount:1}},migrated=normalizeRestaurantResearch(v1,2);
  assert.deepEqual(migrated.fragments,v1.fragments);assert.equal(migrated.draws,2);assert.equal(migrated.inspirationEarned,110);assert.equal(migrated.fusion,undefined);
});

test('research publishes dynamic probabilities, protects reserved fragments, and exposes real excess conversion controls',()=>{
  const state=seed(),info=restaurantInfo(state,NOW),before=structuredClone(info),html=restaurantResearchPanel(info);
  assert.match(html,/当前已解锁卡池/);assert.match(html,/越难获得的碎片/);assert.match(html,/data-r-fuse-amount="9"/);assert.match(html,/data-r-fuse-amount="5"/);
  assert.match(html,/融合棉花糖可可多余碎片 5 枚，获得 25 灵感/);
  const low=initialState(NOW);low.restaurant.recipeLevels.rice=2;assert.match(restaurantResearchPanel(restaurantInfo(low,NOW)),/data-r-locked/);
  const recipe=info.recipes.find(recipe=>recipe.id==='cocoa'),face=restaurantResearchRevealFace({card:{amount:5},recipe,grade:'SSS'});
  assert.match(face,/余片可融合/);assert.match(face,/可融合 25 灵感/);assert.deepEqual(info,before);
  const result=restaurantResearchDebugResult(state,{mode:'research-fusion',amount:999},NOW);assert.equal(result.ok,false);
  assert.equal(state.coins,initialState(NOW).coins);assert.equal(state.xp,initialState(NOW).xp);
});
