import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { RESTAURANT_DINING_MS, restaurantRecipe, validRestaurant, normalizeRestaurant, restaurantInfo } from '../src/restaurant.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'legacy-kitchen',name:'店长'};
const LEGACY_DISH_IDS=['rice','coffee','pancake','burger','pizza','parfait','sandwich','donut','lemontea','pudding','matcha','udon','waffle','strawberrymilk','sushi','grape','cheesecake','cocoa'];

test('all eighteen released dishes preserve legacy in-flight timing, serving and rewards',()=>{
  for(const recipeId of LEGACY_DISH_IDS){
    const recipe=restaurantRecipe(recipeId),state=initialState(NOW),restaurant=state.restaurant;
    delete restaurant.parties;delete restaurant.progression;
    // This fixture deliberately uses the old on-disk order, without workflow.
    // Rice and coffee now create detailed schedules, but already-saved orders
    // retain the original timers until the customer finishes eating.
    restaurant.stats.served=(recipe.unlockLevel-1)*6;
    const id=`table-${restaurant.stats.served+1}`;
    restaurant.nextOrderId=restaurant.stats.served+2;
    const saved={id,recipeId,createdAt:NOW,readyAt:NOW+recipe.seconds*1000,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id};
    restaurant.orders=[saved];
    assert.equal(validRestaurant(restaurant),true,recipeId);
    const restored=normalizeRestaurant(restaurant,NOW+1000);
    assert.deepEqual(restored.orders,[saved]);
    assert.equal(restaurantInfo({...state,restaurant:restored},saved.readyAt-1).orders[0].status,'cooking');
    const served=reduceAction({...state,restaurant:restored},{type:'restaurant-serve',orderId:id},ACTOR,saved.readyAt);
    assert.ok(served,`${recipeId} preserves manual serving for its original order`);
    assert.equal(reduceAction(served,{type:'restaurant-collect',orderId:id},ACTOR,saved.readyAt+RESTAURANT_DINING_MS-1),null);
    const complete=reduceAction(served,{type:'restaurant-collect',orderId:id},ACTOR,saved.readyAt+RESTAURANT_DINING_MS);
    assert.ok(complete,recipeId);assert.equal(complete.coins,state.coins+recipe.price);
    assert.equal(complete.xp,state.xp);assert.equal(complete.pendingGrowth.at(-1).amount,recipe.xp);assert.equal(complete.restaurant.orders.length,0);
  }
});

test('coherent shortening of legacy cooking timers still fails validation',()=>{
  const state=initialState(NOW),restaurant=state.restaurant;
  delete restaurant.parties;delete restaurant.progression;
  restaurant.nextOrderId=2;
  restaurant.orders=[{id:'table-1',recipeId:'rice',createdAt:NOW,readyAt:NOW+8000,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id}];
  assert.equal(validRestaurant(restaurant),true);
  for(const duration of [0,1,3000,7999]){
    const forged=structuredClone(restaurant);forged.orders[0].readyAt=NOW+duration;
    assert.equal(validRestaurant(forged),false);
  }
});
