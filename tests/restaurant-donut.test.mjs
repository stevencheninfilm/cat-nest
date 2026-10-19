import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { RESTAURANT_RECIPES, restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { KITCHEN_FOOD_PROPS, KITCHEN_V8_PROPS, KITCHEN_V8_ANIMATIONS, kitchenAnimationId, kitchenAnimationUrl, kitchenPropUrl } from '../src/restaurant-kitchen-assets.js';
import { kitchenShortStep, kitchenRecipesInMenuOrder } from '../src/restaurant-kitchen-recipes-ui.js';
import { restaurantRecipeMenuOrder } from '../src/restaurant-recipe-order.js';
import { kitchenWorkflowBoardMarkup } from '../src/restaurant-kitchen-board.js';

const NOW=Date.parse('2026-10-19T21:00:00Z'),actor={id:'donut-workflow-test',name:'店长'};

test('every ordinary and premium menu dish now has a complete flow, food art and ordered back-office row',()=>{
  const menu=restaurantRecipeMenuOrder([...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES]);
  assert.equal(menu.length,21);
  assert.deepEqual([...new Set(menu.map(recipe=>recipe.id))].sort(),Object.keys(KITCHEN_FLOWS).sort());
  assert.deepEqual([...KITCHEN_FOOD_PROPS].sort(),menu.map(recipe=>recipe.id).sort());
  assert.ok(menu.every(recipe=>KITCHEN_FLOWS[recipe.id].length>=4));
  const info=restaurantInfo(initialState(NOW),NOW),ordered=kitchenRecipesInMenuOrder(info).map(recipe=>recipe.id);
  assert.deepEqual(ordered,menu.map(recipe=>recipe.id));
  const board=kitchenWorkflowBoardMarkup(info);
  assert.deepEqual([...board.matchAll(/data-r-board-recipe="([^"]+)"/g)].map(match=>match[1]),ordered);
  assert.equal(ordered.indexOf('donut'),4);assert.equal(KITCHEN_FLOWS.donut.length,12);
  assert.equal(Object.values(KITCHEN_FLOWS).reduce((sum,flow)=>sum+flow.length,0),169);
});

test('new donut requests wait for seating, acceptance and manual operations rather than a legacy timer',()=>{
  const state=reduceAction(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'donut'},actor,NOW);
  assert.ok(state);assert.ok(validRestaurant(state.restaurant));
  const order=state.restaurant.orders[0];assert.equal(order.workflow.version,4);assert.equal(order.workflow.acceptedAt,null);
  const future=restaurantInfo(state,NOW+86400000).orders[0];
  assert.equal(future.status,'requested');assert.equal(future.workflow.runs.length,0);assert.equal(future.workflow.servedAt,null);
  assert.equal(reduceAction(state,{type:'restaurant-kitchen-step',orderId:order.id,stepId:'fry-donut-rings'},actor,order.createdAt),null);
});

test('already accepted automatic donuts retain their clock and can still be served and collected once',()=>{
  const started=reduceAction(initialState(NOW),{type:'restaurant-start',recipeId:'donut'},actor,NOW),saved=started.restaurant.orders[0];
  assert.equal(saved.workflow,undefined);assert.ok(saved.readyAt>NOW);
  const loaded=normalizeState(JSON.parse(JSON.stringify(started)),NOW+1000);
  assert.deepEqual(loaded.restaurant.orders,started.restaurant.orders);
  const served=reduceAction(loaded,{type:'restaurant-serve',orderId:saved.id},actor,saved.readyAt);
  assert.ok(served);const receipt=restaurantInfo(served,saved.readyAt+4500).orders[0];
  assert.equal(receipt.status,'collectible');
  const done=reduceAction(served,{type:'restaurant-collect',orderId:saved.id},actor,receipt.collectAt);
  assert.ok(done);assert.equal(done.coins,started.coins+receipt.rewardCoins);assert.equal(done.pendingGrowth.at(-1).amount,receipt.rewardXp);
  assert.equal(reduceAction(done,{type:'restaurant-collect',orderId:saved.id},actor,receipt.collectAt+1),null);
});

test('all donut steps resolve to shipped transparent art and animation, reusing five existing operations',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v8/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.mode,'built-in-imagegen');assert.equal(manifest.props.length,6);assert.equal(manifest.animations.length,7);
  assert.equal(Object.keys(manifest.reuse).length,5);
  assert.deepEqual(manifest.props.map(item=>item.id),[...KITCHEN_V8_PROPS]);
  assert.deepEqual(manifest.animations.map(item=>item.id),[...KITCHEN_V8_ANIMATIONS]);
  for(const item of [...manifest.props,...manifest.animations]){
    assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);
    if(item.frames>1){assert.equal(item.frames,6);assert.equal(item.loop,0);assert.ok(item.distinctDecodedFrames>=3);}
  }
  for(const step of KITCHEN_FLOWS.donut){
    assert.ok(!/[a-z]/i.test(kitchenShortStep(step.id)),'readable short label for '+step.id);
    for(const url of [kitchenPropUrl(step.prop),kitchenAnimationUrl(kitchenAnimationId(step.id,'donut'))]){
      await access(new URL('../public/assets/restaurant/'+url.split('/assets/restaurant/')[1],import.meta.url));
    }
  }
});
