import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo, normalizeRestaurant, validRestaurant, RESTAURANT_DINING_MS, sanitizeRestaurantAction } from '../src/restaurant.js';
import { restaurantInspirationRange, restaurantInspirationGift, restaurantResearchInfo, RESEARCH_INSPIRATION_MAX } from '../src/restaurant-research.js';
import { restaurantRecipePromotions, restaurantRecipeCelebrationMarkup, restaurantResearchTestControls } from '../src/restaurant-recipe-celebration.js';
import { restaurantRecipesPanel } from '../src/restaurant-ui.js';
import { restaurantResearchPanel } from '../src/restaurant-research-ui.js';
import { restaurantGuestDebugResult } from '../demo/restaurant-guests.js';
import { readFile } from 'node:fs/promises';
import { prepareRestaurantMealForCollection } from './restaurant-meal-fixtures.mjs';
const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'inspiration-owner',name:'店长'};
const act=(state,action,at=NOW)=>reduceAction(state,action,ACTOR,at);
function meal(state=initialState(NOW),at=NOW){
  const started=act(state,{type:'restaurant-start',recipeId:'donut'},at),order=started.restaurant.orders[0];
  const served=act(started,{type:'restaurant-serve',orderId:order.id},order.readyAt);
  return {state:served,at:order.readyAt+RESTAURANT_DINING_MS,id:order.id};
}

test('guest ranks and all five actual dish qualities have distinct increasing gift ranges',()=>{
  assert.deepEqual([1,2,3,4,5].map(level=>restaurantInspirationRange('ordinary',level)),[
    {tier:'ordinary',grade:'B',chance:75,min:6,max:12},{tier:'ordinary',grade:'A',chance:75,min:9,max:16},
    {tier:'ordinary',grade:'S',chance:75,min:13,max:22},{tier:'ordinary',grade:'SS',chance:75,min:18,max:30},
    {tier:'ordinary',grade:'SSS',chance:75,min:25,max:40},
  ]);
  for(const level of [1,2,3,4,5]){
    const ordinary=restaurantInspirationRange('ordinary',level);
    assert.deepEqual(restaurantInspirationRange('silver',level),{tier:'silver',grade:ordinary.grade,chance:85,min:ordinary.min+4,max:ordinary.max+8});
    assert.deepEqual(restaurantInspirationRange('gold',level),{tier:'gold',grade:ordinary.grade,chance:95,min:ordinary.min+10,max:ordinary.max+16});
  }
});

test('gifts appear only after tasting, use the accepted quality, and cannot reroll with collection time',()=>{
  const fixture=meal(),before=structuredClone(fixture.state),at=fixture.at;
  assert.equal(restaurantInfo(fixture.state,at-1).orders[0].rewardInspiration,null);
  assert.equal(act(fixture.state,{type:'restaurant-collect',orderId:fixture.id},at-1),null);
  const amount=restaurantInfo(fixture.state,at).orders[0].rewardInspiration;
  const first=act(fixture.state,{type:'restaurant-collect',orderId:fixture.id},at),later=act(fixture.state,{type:'restaurant-collect',orderId:fixture.id},at+86400000);
  assert.equal(first.restaurant.research.lastGift.amount,amount);assert.deepEqual(first.restaurant.research,later.restaurant.research);
  assert.equal(first.restaurant.research.inspirationEarned,90+amount);assert.equal(validRestaurant(first.restaurant),true);
  assert.equal(act(first,{type:'restaurant-collect',orderId:fixture.id},at),null);assert.deepEqual(fixture.state,before);
  const upgraded=structuredClone(fixture.state);upgraded.restaurant.recipeLevels.donut=5;
  assert.deepEqual(restaurantInfo(upgraded,at).orders[0].inspirationRange,{min:6,max:12,chance:75},'a later recipe promotion does not reprice the accepted dish');
});

test('random gifts include misses and several values while every positive result fits its interval',()=>{
  const fixture=meal(),restaurant=fixture.state.restaurant,order=restaurantInfo(fixture.state,fixture.at).orders[0],values=new Set();
  for(let i=0;i<100;i++){
    const gift=restaurantInspirationGift(restaurant,{...order,id:`table-${i+1}`},null,'orange');
    assert.ok(gift.amount===0||gift.amount>=gift.min&&gift.amount<=gift.max);values.add(gift.amount);
    assert.deepEqual(gift,restaurantInspirationGift(restaurant,{...order,id:`table-${i+1}`},null,'orange'));
  }
  assert.ok(values.has(0));assert.ok(values.size>=5);
});

test('both advanced courses receive independent gifts and caps never mint extra inspiration',()=>{
  const seeded=restaurantGuestDebugResult(initialState(NOW),{mode:'guest',guestId:'guest-dawn-duke'},NOW).state;
  const prepared=prepareRestaurantMealForCollection(seeded,'table-1',ACTOR),{order,at}=prepared;
  const next=act(prepared.state,{type:'restaurant-collect',orderId:order.id},at);
  assert.ok(next);assert.equal(next.restaurant.research.lastGift.tier,'gold');assert.equal(next.restaurant.research.lastGift.grade,'B');
  assert.equal(next.restaurant.research.lastGift.amount,restaurantInfo(prepared.state,at).orders[0].rewardInspiration);
  assert.equal(next.restaurant.parties[0].members[0].service.round,2);
  const capped=meal();capped.state.restaurant.research.inspirationEarned=RESEARCH_INSPIRATION_MAX;
  const done=act(capped.state,{type:'restaurant-collect',orderId:capped.id},capped.at);
  assert.equal(done.restaurant.research.inspirationEarned,RESEARCH_INSPIRATION_MAX);assert.equal(done.restaurant.research.lastGift.amount,0);
});

test('old fixed-quality gift receipts remain valid without rewriting their earned inspiration',()=>{
  const fixture=meal(),settled=act(fixture.state,{type:'restaurant-collect',orderId:fixture.id},fixture.at);
  for(const [tier,grade,amount] of [['silver','S',30],['gold','SSS',56]]){
    const legacy=structuredClone(settled.restaurant);
    Object.assign(legacy.research.lastGift,{tier,grade,amount});legacy.research.inspirationEarned=90+amount;
    assert.equal(legacy.recipeLevels.donut,1);assert.equal(validRestaurant(legacy),true);
    assert.deepEqual(normalizeRestaurant(legacy,fixture.at),legacy);
  }
});

test('v1 research migration preserves already earned and spent XP, shards, wallets and accepted orders',()=>{
  const fixture=meal(),state=fixture.state;
  state.restaurant.research={version:1,startedServed:0,draws:2,fragments:{rice:4},lastDraw:{draw:2,recipeId:'rice',amount:1}};
  const before=structuredClone(state),loaded=normalizeRestaurant(state.restaurant,NOW),info=restaurantResearchInfo(loaded);
  assert.equal(loaded.research.version,2);assert.equal(info.inspiration,30);assert.deepEqual(loaded.research.fragments,{rice:4});
  assert.deepEqual(loaded.orders,before.restaurant.orders);assert.deepEqual(normalizeRestaurant(loaded,NOW+1000),loaded);
  assert.deepEqual(state,before);assert.equal(loaded.stats.served,0);
  const legacy=structuredClone(loaded);delete legacy.research;
  assert.equal(restaurantResearchInfo(normalizeRestaurant(legacy,NOW)).inspiration,90);
});

test('inspiration and receipt fields cannot be supplied through action intents or corrupted saves',()=>{
  const good=act(meal().state,{type:'restaurant-collect',orderId:'table-1'},meal().at);
  for(const change of [r=>r.inspirationEarned=-1,r=>r.inspirationEarned=Infinity,r=>r.lastGift.amount=999,r=>r.lastGift.served=999,r=>r.lastGift.grade='C',r=>r.lastGift.orderId='table-0',r=>r.lastGift.extra=1]){
    const bad=structuredClone(good.restaurant);change(bad.research);assert.equal(validRestaurant(bad),false);
  }
  for(const action of [{type:'restaurant-collect',orderId:'table-1',inspiration:100},{type:'restaurant-research-draw',draw:1,chance:100},{type:'restaurant-recipe',recipeId:'rice',inspirationEarned:100}])assert.equal(sanitizeRestaurantAction(action),null);
});

test('promotion feedback is silent on load, compares saved grades and uses five matching card materials',async()=>{
  const state=initialState(NOW),info=restaurantInfo(state,NOW),before=Object.fromEntries(info.recipes.map(recipe=>[recipe.id,recipe.level]));
  assert.deepEqual(restaurantRecipePromotions(null,info.recipes),[]);assert.deepEqual(restaurantRecipePromotions(before,info.recipes),[]);
  for(const [index,grade] of ['B','A','S','SS','SSS'].entries())state.restaurant.recipeLevels[info.recipes.filter(recipe=>recipe.unlocked)[index].id]=index+1;
  const upgraded=restaurantInfo(state,NOW),gains=restaurantRecipePromotions(before,upgraded.recipes);
  assert.equal(gains.length,4);assert.deepEqual(restaurantRecipePromotions(Object.fromEntries(upgraded.recipes.map(recipe=>[recipe.id,recipe.level])),upgraded.recipes),[]);
  const research=restaurantResearchPanel(upgraded),menu=restaurantRecipesPanel(upgraded);
  for(const grade of ['B','A','S','SS','SSS']){assert.match(research,new RegExp(`data-r-quality="${grade}"`));assert.match(menu,new RegExp(`data-r-quality="${grade}"`));}
  const html=restaurantRecipeCelebrationMarkup(gains[0]);assert.match(html,/菜品升阶成功/);assert.match(html,/🎉/);assert.match(html,/下一份订单/);assert.equal((html.match(/--party-color:/g)||[]).length,34);
  assert.match(restaurantRecipeCelebrationMarkup(gains[3],{preview:true}),/不改变菜谱等级/);assert.equal(restaurantResearchTestControls(false),'');
  const css=await readFile(new URL('../src/restaurant-recipe-celebration.css',import.meta.url),'utf8');
  for(const grade of ['A','S','SS','SSS'])assert.ok(css.includes(`[data-r-quality=${grade}]`));assert.match(css,/prefers-reduced-motion/);
});
