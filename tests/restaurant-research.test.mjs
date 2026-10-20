import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, validRestaurant, normalizeRestaurant, sanitizeRestaurantAction, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { RESTAURANT_DISH_GRADES, restaurantDishGrade, restaurantResearchInfo } from '../src/restaurant-research.js';
import { restaurantResearchPanel } from '../src/restaurant-research-ui.js';
import { restaurantTierFood, restaurantQualityFood } from '../src/restaurant-order-tiers-ui.js';
const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'research-owner',name:'店长'};
const act=(state,action,at=NOW)=>reduceAction(state,action,ACTOR,at);
const draw=state=>act(state,{type:'restaurant-research-draw',draw:restaurantInfo(state,NOW).research.nextDraw});
function settle(state,at){
  const started=act(state,{type:'restaurant-start',recipeId:'donut'},at),order=restaurantInfo(started,at).orders[0];
  const served=act(started,{type:'restaurant-serve',orderId:order.id},order.readyAt);
  return act(served,{type:'restaurant-collect',orderId:order.id},order.readyAt+RESTAURANT_DINING_MS);
}

test('new research teaches one real fragment upgrade and consumes no wallet or growth XP',()=>{
  const before=initialState(NOW),source=structuredClone(before),first=draw(before);
  assert.ok(first);assert.equal(validRestaurant(first.restaurant),true);assert.deepEqual(before,source);
  assert.deepEqual(first.restaurant.research.lastDraw,{draw:1,recipeId:'rice',amount:3});
  assert.equal(restaurantInfo(first,NOW).research.availableDraws,2);
  const upgraded=act(first,{type:'restaurant-recipe',recipeId:'rice'});
  assert.equal(upgraded.restaurant.recipeLevels.rice,2);assert.equal(restaurantInfo(upgraded,NOW).recipes.find(recipe=>recipe.id==='rice').grade,'A');
  assert.equal(upgraded.restaurant.research.fragments.rice,0);
  for(const key of ['coins','goldFish','xp'])assert.equal(upgraded[key],before[key]);
  assert.deepEqual(upgraded.restaurant.stats,before.restaurant.stats);
  assert.equal(act(upgraded,{type:'restaurant-recipe',recipeId:'rice'}),null);
  assert.equal(act(first,{type:'restaurant-research-draw',draw:1}),null,'same draw number cannot be claimed twice');
});

test('only settled meals add the customer gift and new draws spend the inspiration balance',()=>{
  let state=initialState(NOW);for(let i=0;i<3;i++)state=draw(state);
  assert.equal(draw(state),null);
  for(let i=0;i<30&&restaurantResearchInfo(state.restaurant).availableDraws===0;i++){
    const before=state,served=settle(state,NOW+i*60000);assert.ok(served);
    const gift=served.restaurant.research.lastGift;
    assert.ok(gift.amount===0||gift.amount>=6&&gift.amount<=12);
    assert.equal(restaurantResearchInfo(served.restaurant).experience-restaurantResearchInfo(before.restaurant).experience,gift.amount);
    state=served;
  }
  const fourth=draw(state);assert.ok(fourth);assert.equal(fourth.restaurant.research.draws,4);
  assert.equal(restaurantResearchInfo(state.restaurant).inspiration-restaurantResearchInfo(fourth.restaurant).inspiration,30);
});

test('cards use only unlocked recipes, merge duplicates and guarantee five shards on the tenth draw',()=>{
  let state=initialState(NOW);
  for(let i=0;restaurantResearchInfo(state.restaurant).availableDraws<10&&i<100;i++)state=settle(state,NOW+i*60000);
  const unlocked=new Set(restaurantInfo(state,NOW).recipes.filter(recipe=>recipe.unlocked).map(recipe=>recipe.id));
  let total=0;
  for(let i=1;i<=10;i++){
    const next=draw(state),card=next.restaurant.research.lastDraw;assert.equal(card.draw,i);assert.ok(unlocked.has(card.recipeId));
    assert.equal(next.restaurant.research.fragments[card.recipeId],(state.restaurant.research.fragments[card.recipeId]??0)+card.amount);
    total+=card.amount;state=next;
  }
  assert.equal(state.restaurant.research.lastDraw.amount,5);assert.equal(Object.values(state.restaurant.research.fragments).reduce((sum,value)=>sum+value,0),total);
  for(const recipe of restaurantInfo(state,NOW).recipes.filter(recipe=>recipe.unlocked))state.restaurant.recipeLevels[recipe.id]=5;
  assert.equal(draw(state),null,'the ten draws consumed the available inspiration');state.restaurant.research.inspirationEarned+=30;const duplicate=draw(state);assert.ok(duplicate,'mastered dishes remain available as fusion material');assert.equal(validRestaurant(duplicate.restaurant),true);
});

test('the five grades upgrade with exact fragments and level gates while accepted orders keep their snapshot',()=>{
  const base=draw(initialState(NOW)),started=act(base,{type:'restaurant-start',recipeId:'rice'}),oldOrder=structuredClone(started.restaurant.orders[0]);
  let state=act(started,{type:'restaurant-recipe',recipeId:'rice'});
  assert.deepEqual(state.restaurant.orders[0],oldOrder);
  for(const [level,cost,gate] of [[2,6,10],[3,10,30],[4,15,45]]){
    state.restaurant.stats.experience=levelStartXp(gate-1);state.restaurant.research.draws=3;state.restaurant.research.fragments={rice:cost};state.restaurant.research.lastDraw={draw:3,recipeId:'rice',amount:5};
    assert.equal(act(state,{type:'restaurant-recipe',recipeId:'rice'}),null);
    state.restaurant.stats.experience=levelStartXp(gate);
    const next=act(state,{type:'restaurant-recipe',recipeId:'rice'});assert.ok(next);assert.equal(next.restaurant.recipeLevels.rice,level+1);state=next;
  }
  assert.deepEqual(RESTAURANT_DISH_GRADES,['B','A','S','SS','SSS']);assert.equal(restaurantDishGrade(state.restaurant.recipeLevels.rice),'SSS');
  assert.equal(act(state,{type:'restaurant-recipe',recipeId:'rice'}),null);assert.equal(validRestaurant(state.restaurant),true);
  assert.deepEqual(state.restaurant.orders[0],oldOrder);
});

test('legacy research levels and active orders survive adding the isolated ledger without retroactive meal credit',()=>{
  const state=settle(initialState(NOW),NOW);state.restaurant.recipeLevels.rice=4;delete state.restaurant.research;
  const source=structuredClone(state.restaurant),loaded=normalizeRestaurant(source,NOW+60000);
  assert.equal(loaded.recipeLevels.rice,4);assert.equal(loaded.research.startedServed,1);assert.equal(restaurantResearchInfo(loaded).experience,90);
  assert.deepEqual(normalizeRestaurant(loaded,NOW+120000),loaded);assert.deepEqual(state.restaurant,source);
  assert.deepEqual(loaded.stats,source.stats);
});

test('forged draw outcomes, unsafe ledgers and arbitrary grades are rejected or safely rendered',()=>{
  const good=draw(initialState(NOW));
  for(const mutate of [r=>r.draws=4,r=>r.startedServed=1,r=>r.fragments.rice=100,r=>r.fragments.unknown=1,r=>r.lastDraw.amount=99,r=>r.extra=true]){
    const bad=structuredClone(good.restaurant);mutate(bad.research);assert.equal(validRestaurant(bad),false);
  }
  for(const action of [{type:'restaurant-research-draw',draw:0},{type:'restaurant-research-draw',draw:1,recipeId:'rice'},{type:'restaurant-research-draw',draw:1,amount:5},{type:'restaurant-recipe',recipeId:'rice',grade:'SSS'}])assert.equal(sanitizeRestaurantAction(action),null);
  const food=id=>`<i class="food-${id}"></i>`;
  for(const tier of ['ordinary','silver','gold']){
    assert.match(restaurantTierFood('rice',tier,food),/data-r-dish-grade="B"/);
    assert.doesNotMatch(restaurantTierFood('rice',tier,food),/gold-overlay/);
    assert.match(restaurantTierFood('rice',tier,food,3),/gold-overlay.webp[^]*data-r-dish-grade="S"[^]*>S<\/span>/);
    assert.match(restaurantTierFood('rice',tier,food,5),/gold-overlay.webp[^]*data-r-dish-grade="SSS"[^]*>SSS<\/span>/);
  }
  assert.doesNotMatch(restaurantQualityFood('rice','<script>',food),/<script>/);
  const info=restaurantInfo(good,NOW),before=structuredClone(info),html=restaurantResearchPanel(info);
  assert.match(html,/data-r-action="research-draw" data-r-draw="2"/);assert.match(html,/菜谱碎片 \+3/);assert.match(html,/碎片 3 \/ 3 · 升阶/);assert.deepEqual(info,before);
});
