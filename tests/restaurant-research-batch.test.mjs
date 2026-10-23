import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantInfo,validRestaurant,sanitizeRestaurantAction } from '../src/restaurant.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { restaurantResearchPanel } from '../src/restaurant-research-ui.js';
import { restaurantResearchBatchResult,restaurantResearchBatchMarkup } from '../src/restaurant-research-batch-ui.js';
const NOW=Date.parse('2026-10-23T12:00:00Z'),actor={id:'batch-owner',name:'店长'};
function fixture(balance=600){const state=initialState(NOW);state.restaurant.research.inspirationEarned=balance;state.restaurant.stats.experience=restaurantLevelStartXp(50);return state;}
const act=(state,action)=>reduceAction(state,action,actor,NOW);

test('a ten-draw transaction matches ten ordinary draws, including welcome and tenth-card rules',()=>{
  const base=fixture(),source=structuredClone(base),batch=act(base,{type:'restaurant-research-draw',draw:1,count:10});
  assert.ok(batch);assert.deepEqual(base,source);assert.ok(validRestaurant(batch.restaurant));
  let singles=base;for(let draw=1;draw<=10;draw++)singles=act(singles,{type:'restaurant-research-draw',draw});
  const {lastBatch,...research}=batch.restaurant.research;assert.deepEqual(research,singles.restaurant.research);
  assert.equal(lastBatch.cards.length,10);assert.deepEqual(lastBatch.cards[0],{draw:1,recipeId:'rice',amount:3});assert.equal(lastBatch.cards[9].amount,5);
  assert.equal(restaurantInfo(batch,NOW).research.inspiration,300);
  for(const key of ['coins','goldFish','xp'])assert.equal(batch[key],base[key]);
  assert.equal(act(batch,{type:'restaurant-research-draw',draw:1,count:10}),null);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(batch)),NOW),batch,'accepted batch receipt survives saved state normalization');
});

test('batch validation rejects partial funding and forged counts without changing the source',()=>{
  for(const balance of [90,299]){const base=fixture(balance),source=structuredClone(base);assert.equal(act(base,{type:'restaurant-research-draw',draw:1,count:10}),null);assert.deepEqual(base,source);}
  for(const count of [0,1,2,9,11,100,'10'])assert.equal(sanitizeRestaurantAction({type:'restaurant-research-draw',draw:1,count}),null);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-research-draw',draw:33333325,count:10}),null);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-research-draw',draw:1,count:10,cards:[]}),null);
});

test('later singles replace the batch receipt and malformed saved batches are rejected',()=>{
  const batch=act(fixture(),{type:'restaurant-research-draw',draw:1,count:10}),single=act(batch,{type:'restaurant-research-draw',draw:11});
  assert.ok(single);assert.equal(single.restaurant.research.lastBatch,undefined);assert.ok(validRestaurant(single.restaurant));
  for(const corrupt of [r=>r.lastBatch.cards.pop(),r=>r.lastBatch.cards[0].draw=2,r=>r.lastBatch.cards[9].amount=1]){
    const bad=structuredClone(batch.restaurant);corrupt(bad.research);assert.equal(validRestaurant(bad),false);
  }
});

test('ten-card results and ledger use the accepted receipt only and offer a properly funded batch button',()=>{
  const base=fixture(),batch=act(base,{type:'restaurant-research-draw',draw:1,count:10}),info=restaurantInfo(batch,NOW),result=restaurantResearchBatchResult(info,1);
  assert.equal(restaurantResearchBatchResult(restaurantInfo(base,NOW),1),null);assert.equal(restaurantResearchBatchResult(info,2),null);
  const html=restaurantResearchBatchMarkup(result,{animated:true});assert.equal((html.match(/data-rr-batch-draw=/g)||[]).length,10);
  assert.match(html,/--batch-index:9/);assert.match(html,/is-animated/);assert.match(html,/十份灵感/);
  assert.match(restaurantResearchPanel(info),/十连探索结果/);
  assert.match(restaurantResearchPanel(restaurantInfo(fixture(299),NOW)),/data-r-count="10" disabled/);
  assert.doesNotMatch(restaurantResearchPanel(restaurantInfo(base,NOW)),/data-r-count="10" disabled/);
});

test('batch preparation belongs only to the isolated demo and leaves real wallet and existing research intact',async()=>{
  const {restaurantResearchDebugResult}=await import('../demo/restaurant-research.js');
  const base=initialState(NOW),source=structuredClone(base),result=restaurantResearchDebugResult(base,{mode:'research-batch'},NOW);
  assert.equal(result.ok,true);assert.deepEqual(base,source);assert.equal(result.state.restaurant.research.inspirationEarned,690);
  assert.deepEqual(result.state.restaurant.research.fragments,base.restaurant.research.fragments);assert.equal(result.state.goldFish,base.goldFish);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-debug-research-batch'}),null);
});
