import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, restaurantRecipe, validRestaurant, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { restaurantRecipeUnlocked } from '../src/restaurant-progression.js';
import { restaurantResearchPool } from '../src/restaurant-research.js';
import { restaurantRecipesPanel } from '../src/restaurant-ui.js';
import { eligibleRestaurantGuestCats } from '../src/restaurant-customers.js';
import { restaurantGuestDebugResult } from '../demo/restaurant-guests.js';

const NOW=Date.parse('2026-10-19T12:00:00Z'),ACTOR={id:'signature-promotion',name:'店长'};
const recipes=[['sushi',22,40,82,22],['pizza',25,50,84,23]];
const act=(state,action,at=NOW)=>reduceAction(state,action,ACTOR,at);
const high=()=>{const state=initialState(NOW);state.goldFish=200;state.restaurant.stats.experience=levelStartXp(50);return state;};

for(const [id,level,cost,price,seconds] of recipes){
  test(`${id} requires its gold purchase and occurs once as a signature, independently of dish quality`,()=>{
    const state=high(),recipe=restaurantRecipe(id),info=restaurantInfo(state,NOW),html=restaurantRecipesPanel(info);
    assert.equal(recipe.special,true);assert.equal(recipe.unlockLevel,level);assert.equal(recipe.unlockGold,cost);assert.equal(recipe.price,price);assert.equal(recipe.seconds,seconds);assert.equal(recipe.goldReward,0);
    assert.equal(info.recipes.some(item=>item.id===id),false);assert.equal(restaurantResearchPool(info.recipes).some(item=>item.recipe.id===id),false);
    assert.equal((html.match(new RegExp(`data-r-dish="${id}"`,'g'))||[]).length,1);
    assert.match(html,new RegExp(`data-r-action="unlock-special" data-r-recipe="${id}"`));
    state.restaurant.progression.legacyRecipes=[id];
    assert.equal(restaurantRecipeUnlocked(state.restaurant,recipe),false,'old ordinary permissions cannot bypass purchase');
    assert.equal(act(state,{type:'restaurant-arrive',recipeId:id,partySize:1}),null);
    assert.equal(act(state,{type:'restaurant-start',recipeId:id}),null);
    const poor=structuredClone(state);poor.goldFish=cost-1;
    assert.equal(act(poor,{type:'restaurant-unlock-special',recipeId:id}),null);
    const young=structuredClone(state);young.restaurant.stats.experience=levelStartXp(level)-1;
    assert.equal(act(young,{type:'restaurant-unlock-special',recipeId:id}),null);
    const purchased=act(state,{type:'restaurant-unlock-special',recipeId:id});assert.ok(purchased);
    assert.equal(purchased.goldFish,state.goldFish-cost);assert.equal(purchased.coins,state.coins);assert.equal(purchased.xp,state.xp);assert.equal(purchased.restaurant.recipeLevels[id],1);
    assert.equal(act(purchased,{type:'restaurant-unlock-special',recipeId:id}),null,'a second request cannot charge again');
    const unlocked=restaurantInfo(purchased,NOW);assert.equal(unlocked.recipes.filter(item=>item.id===id).length,1);assert.equal(unlocked.specialRecipes.find(item=>item.id===id).grade,'B');
    assert.equal(restaurantResearchPool(unlocked.recipes).some(item=>item.recipe.id===id),true);
  });

  test(`${id} keeps old S-grade progress, fragments and an active meal through migration and purchase`,()=>{
    const state=high();state.restaurant.recipeLevels[id]=3;
    Object.assign(state.restaurant.research,{draws:2,fragments:{[id]:7},lastDraw:{draw:2,recipeId:id,amount:2}});
    state.restaurant.nextOrderId=2;delete state.restaurant.parties;
    const order={id:'table-1',recipeId:id,createdAt:NOW,readyAt:NOW+seconds*1000,servedAt:null,recipeLevel:3,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id};
    state.restaurant.orders=[order];const before=structuredClone(state);
    assert.equal(validRestaurant(state.restaurant),true);
    const loaded=normalizeState(JSON.parse(JSON.stringify(state)),NOW+1000);
    assert.deepEqual(loaded.restaurant.orders,[order]);assert.equal(loaded.restaurant.recipeLevels[id],3);assert.deepEqual(loaded.restaurant.research,state.restaurant.research);assert.equal(loaded.goldFish,state.goldFish);
    assert.equal(restaurantInfo(loaded,NOW).specialRecipes.find(item=>item.id===id).grade,'S');
    const served=act(loaded,{type:'restaurant-serve',orderId:order.id},order.readyAt);assert.ok(served);
    const paid=act(served,{type:'restaurant-collect',orderId:order.id},order.readyAt+RESTAURANT_DINING_MS);assert.ok(paid);assert.equal(paid.goldFish,state.goldFish);assert.equal(paid.restaurant.orders.length,0);
    assert.equal(restaurantRecipeUnlocked(paid.restaurant,restaurantRecipe(id)),false,'old active meal does not grant new sale permission');
    const purchased=act(loaded,{type:'restaurant-unlock-special',recipeId:id});assert.ok(purchased);
    assert.equal(purchased.restaurant.recipeLevels[id],3);assert.equal(purchased.restaurant.research.fragments[id],7);assert.deepEqual(purchased.restaurant.orders,[order]);assert.equal(purchased.goldFish,state.goldFish-cost);
    const reloaded=normalizeState(JSON.parse(JSON.stringify(purchased)),NOW+1000);assert.deepEqual(reloaded.restaurant,purchased.restaurant);assert.deepEqual(state,before);
  });
}

test('the tea master now requires a purchased sushi recipe, and test preparation uses the same ownership gate',()=>{
  const result=restaurantGuestDebugResult(high(),{mode:'guest',guestId:'guest-tea-master'},NOW);assert.ok(result.ok);
  assert.ok(result.state.restaurant.ownedSpecialRecipes.includes('sushi'));
  assert.ok(eligibleRestaurantGuestCats(result.state.restaurant,NOW).includes('guest-tea-master'));
  result.state.restaurant.ownedSpecialRecipes=result.state.restaurant.ownedSpecialRecipes.filter(id=>id!=='sushi');
  assert.ok(!eligibleRestaurantGuestCats(result.state.restaurant,NOW).includes('guest-tea-master'));
});
