import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { createInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { recipeStepEnergyBase } from '../src/restaurant-recipe-energy.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';

const NOW=Date.parse('2026-10-21T08:00:00Z'),ACTOR={id:'signature-quality-test',name:'店长'};
const high=()=>{const state=initialState(NOW);state.goldFish=200;state.restaurant.stats.experience=restaurantLevelStartXp(50);return state;};
const act=(state,action)=>reduceAction(state,action,ACTOR,NOW);

test('all five gold purchases preview S quality without granting ownership or changing ordinary dishes',()=>{
  const state=initialState(NOW),before=structuredClone(state),info=restaurantInfo(state,NOW);
  assert.equal(info.specialRecipes.length,5);
  for(const recipe of info.specialRecipes){
    assert.equal(recipe.grade,'S');assert.equal(recipe.level,3);assert.equal(recipe.owned,false);assert.equal(recipe.unlocked,false);
    assert.equal(info.recipes.some(item=>item.id===recipe.id),false);
  }
  assert.ok(info.recipes.every(recipe=>recipe.level===1&&recipe.grade==='B'));
  assert.deepEqual(state,before);
});

test('gold purchases start real orders at S and research continues through SS and SSS using only the remaining fragments',()=>{
  for(const recipe of SPECIAL_RESTAURANT_RECIPES){
    const state=high(),purchased=act(state,{type:'restaurant-unlock-special',recipeId:recipe.id});
    assert.ok(purchased);assert.equal(purchased.goldFish,state.goldFish-recipe.unlockGold);
    const info=restaurantInfo(purchased,NOW),owned=info.recipes.find(item=>item.id===recipe.id);
    assert.equal(owned.level,3);assert.equal(owned.grade,'S');assert.equal(owned.upgradeCost,10);
    let working=act(purchased,{type:'restaurant-arrive',recipeId:recipe.id,partySize:1});assert.ok(working);
    const accepted=structuredClone(working.restaurant.orders[0]),order=restaurantInfo(working,NOW).orders[0];
    assert.equal(order.recipeLevel,3);assert.equal(order.workflow.stepEnergyBase,recipeStepEnergyBase(recipe.id,3));
    assert.ok(order.rewardCoins>recipe.price*1.5);assert.ok(order.rewardXp>recipe.xp);
    Object.assign(working.restaurant.research,{draws:10,fragments:{[recipe.id]:25},lastDraw:{draw:10,recipeId:recipe.id,amount:5},inspirationEarned:900});
    const wallet={coins:working.coins,goldFish:working.goldFish};
    for(const [target,grade,remaining] of [[4,'SS',15],[5,'SSS',0]]){
      working=act(working,{type:'restaurant-recipe',recipeId:recipe.id,expectedLevel:target});assert.ok(working);
      assert.equal(restaurantInfo(working,NOW).recipes.find(item=>item.id===recipe.id).grade,grade);
      assert.equal(working.restaurant.research.fragments[recipe.id],remaining);
      assert.deepEqual(working.restaurant.orders[0],accepted,'accepted S orders retain their price, stamina and timing snapshots');
      assert.deepEqual({coins:working.coins,goldFish:working.goldFish},wallet);
    }
  }
});

test('legacy owned dishes gain the S minimum once while higher ranks, fragments, wallets and active v4 orders remain intact',()=>{
  for(const previousLevel of [1,2,3,4,5]){
    const state=high(),r=state.restaurant;
    r.ownedSpecialRecipes=SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id);
    for(const id of r.ownedSpecialRecipes)r.recipeLevels[id]=previousLevel;
    Object.assign(r.research,{draws:50,fragments:Object.fromEntries(r.ownedSpecialRecipes.map(id=>[id,7])),lastDraw:{draw:50,recipeId:'gold-latte',amount:2},inspirationEarned:1800});
    const recipeId='gold-salmon',workflow=createInteractiveWorkflow(r,recipeId,NOW,{orderId:'table-1',seat:1,kitchenLevel:1,fridgeLevel:1,staff:0,version:4,stepEnergyBase:recipeStepEnergyBase(recipeId,previousLevel)});
    assert.ok(workflow);r.nextOrderId=2;delete r.parties;
    r.orders=[{id:'table-1',recipeId,createdAt:NOW,readyAt:NOW,servedAt:null,recipeLevel:previousLevel,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id,workflow}];
    assert.equal(validRestaurant(r),true);
    const before=structuredClone(state),loaded=normalizeState(JSON.parse(JSON.stringify(state)),NOW+1000);
    assert.equal(validRestaurant(loaded.restaurant),true);
    for(const id of r.ownedSpecialRecipes)assert.equal(loaded.restaurant.recipeLevels[id],Math.max(3,previousLevel));
    assert.deepEqual(loaded.restaurant.orders,r.orders);assert.deepEqual(loaded.restaurant.research,r.research);
    assert.deepEqual(loaded.restaurant.stats,r.stats);
    for(const key of ['coins','goldFish','xp'])assert.equal(loaded[key],state[key]);
    assert.deepEqual(normalizeState(loaded,NOW+1000).restaurant,loaded.restaurant,'reloading never repeatedly grants levels or consumes shards');
    assert.deepEqual(state,before);
  }
});

test('the isolated unlock-all fixture follows S defaults and retains existing higher research',()=>{
  const state=high();state.restaurant.recipeLevels.sushi=5;
  const result=restaurantStaffDebugResult(state,{mode:'recipes'},NOW);assert.ok(result.ok);
  for(const recipe of SPECIAL_RESTAURANT_RECIPES)assert.equal(result.state.restaurant.recipeLevels[recipe.id],recipe.id==='sushi'?5:3);
  assert.equal(result.state.goldFish,state.goldFish);
});
