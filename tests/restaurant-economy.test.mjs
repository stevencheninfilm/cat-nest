import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLD_FISH_MAX, SPECIAL_RESTAURANT_RECIPES, PREMIUM_RESTAURANT_THEMES, validGoldFish, normalizeGoldFish, restaurantGoldReward, premiumStaffHireCost } from '../src/restaurant-economy.js';

test('legacy homes start with zero gold fish and malformed currency never becomes a grant',()=>{
  for(const value of [undefined,null,-1,1.2,'40',Infinity,NaN,GOLD_FISH_MAX+1]) {
    assert.equal(validGoldFish(value),false);
    assert.equal(normalizeGoldFish(value),0);
  }
  for(const value of [0,1,GOLD_FISH_MAX])assert.equal(normalizeGoldFish(value),value);
});

test('ordinary collections preserve their counter but never mint gold fish',()=>{
  let ordinaryServed=0,totalGold=0;
  for(let i=0;i<15;i++) {
    const reward=restaurantGoldReward({ordinaryServed,recipeId:'rice'});
    assert.equal(reward.amount,0);
    totalGold+=reward.amount;ordinaryServed=reward.ordinaryServed;
  }
  assert.equal(ordinaryServed,15);assert.equal(totalGold,0);
});

test('no recipe or injected reward fields can mint gold fish',()=>{
  for(const recipe of SPECIAL_RESTAURANT_RECIPES)assert.deepEqual(restaurantGoldReward({ordinaryServed:4,recipeId:recipe.id,amount:999999}),{amount:0,ordinaryServed:4});
  assert.deepEqual(restaurantGoldReward({ordinaryServed:4,recipeId:'rice',amount:999999}),{amount:0,ordinaryServed:5});
  assert.deepEqual(restaurantGoldReward({ordinaryServed:5,recipeId:'rice',goldReward:999999}),{amount:0,ordinaryServed:6});
});

test('malformed milestone counters and missing recipe IDs cannot mint currency',()=>{
  for(const ordinaryServed of [-1,1.1,'4',Infinity,Number.MAX_SAFE_INTEGER])assert.equal(restaurantGoldReward({ordinaryServed,recipeId:'rice'}),null);
  for(const recipeId of [undefined,null,'',{},1])assert.equal(restaurantGoldReward({ordinaryServed:4,recipeId}),null);
});

test('special recipes and premium decorations use explicit gold costs without replacing ordinary proceeds',()=>{
  assert.deepEqual(SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id),['gold-salmon','sushi','pizza','gold-sundae','gold-latte']);
  assert.deepEqual(SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.unlockLevel),[20,22,25,30,40]);
  assert.deepEqual(SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.unlockGold),[30,40,50,50,70]);
  for(const recipe of SPECIAL_RESTAURANT_RECIPES) {
    assert.equal(recipe.goldReward,0);assert.ok(recipe.unlockGold>0);assert.ok(recipe.price>0);assert.ok(recipe.xp>0);
    assert.equal(Object.isFrozen(recipe),true);
  }
  assert.deepEqual(PREMIUM_RESTAURANT_THEMES.map(theme=>[theme.id,theme.priceGold]),[['moonclock',3],['aquarium',4],['gramophone',6],['fireplace',7],['starlight',6],['snowglobe',9],['glass',8],['cloudgarden',11],['royal',12]]);
});

test('premium hiring exposes gold costs only for the later three staff slots',()=>{
  for(const index of [-1,0,1,2,6,1.2,'3'])assert.equal(premiumStaffHireCost(index),null);
  for(const [index,amount] of [[3,5],[4,8],[5,12]])assert.deepEqual(premiumStaffHireCost(index),{currency:'goldFish',amount});
});
