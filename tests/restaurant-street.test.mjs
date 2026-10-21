import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { restaurantGuestMotion, RESTAURANT_ARRIVAL_MS } from '../src/restaurant-guests.js';
import { createRestaurantArrivalRhythm, restaurantQueuePosition } from '../src/restaurant-street.js';
import { createRestaurantStreetLife } from '../src/restaurant-street-ui.js';

const NOW=Date.parse('2026-10-19T12:00:00Z'),ACTOR={id:'client-street-test',name:'猫友'};
const act=(state,action,at=NOW)=>reduceAction(state,action,ACTOR,at);
function fullRestaurant(){let state=initialState(NOW);for(let index=0;index<2;index++)state=act(state,{type:'restaurant-arrive',partySize:1,recipeId:'sandwich'},NOW+index);return state;}
function payFirstTable(state){
  const orderId=state.restaurant.orders[0].id;let at=NOW+30000;
  const step=action=>{state=act(state,action,at);assert.ok(state,action.type);};
  step({type:'restaurant-kitchen-accept',orderId});
  for(const item of KITCHEN_FLOWS.sandwich){
    const workflow=state.restaurant.orders.find(order=>order.id===orderId).workflow;
    at=Math.max(at,workflow.runs.at(-1)?.endAt??at,workflow.runs.at(-1)?.rest?.fullAt??0);
    step({type:'restaurant-kitchen-step',orderId,stepId:item.id});
  }
  let workflow=state.restaurant.orders.find(order=>order.id===orderId).workflow;
  at=Math.max(at,workflow.runs.at(-1)?.endAt??at,workflow.runs.at(-1)?.rest?.fullAt??0);
  step({type:'restaurant-kitchen-step',orderId,stepId:'delivery'});
  const info=restaurantInfo(state,at+60000);at=info.orders.find(order=>order.id===orderId).collectAt;
  step({type:'restaurant-collect',orderId});return {state,at};
}

test('a full restaurant keeps a bounded FIFO without starting orders, recording encounters or minting rewards',()=>{
  let state=fullRestaurant(),before=structuredClone(state);
  state=act(state,{type:'restaurant-wait'},NOW+10000);state=act(state,{type:'restaurant-wait'},NOW+11000);
  assert.ok(state);assert.equal(validRestaurant(state.restaurant),true);
  const info=restaurantInfo(state,NOW+12000);assert.equal(info.waitingParties.length,2);assert.equal(info.availableTables,0);
  assert.deepEqual(state.restaurant.orders,before.restaurant.orders);assert.deepEqual(state.restaurant.seenGuests,before.restaurant.seenGuests);
  assert.deepEqual(state.restaurant.stats,before.restaurant.stats);assert.equal(state.coins,before.coins);assert.equal(state.goldFish,before.goldFish);
  assert.equal(act(state,{type:'restaurant-wait'},NOW+12000),null);
  assert.equal(act(initialState(NOW),{type:'restaurant-wait'},NOW+10000),null);
});

test('after payment the oldest waiting cats enter together, keeping identity and an authoritative fresh order',()=>{
  let state=act(fullRestaurant(),{type:'restaurant-wait'},NOW+10000);state=act(state,{type:'restaurant-wait'},NOW+11000);
  const queued=structuredClone(state.restaurant.waitingParties),paid=payFirstTable(state);
  const rhythm=createRestaurantArrivalRhythm(),action=rhythm.poll(restaurantInfo(paid.state,paid.at),paid.at);
  assert.deepEqual(action,{type:'restaurant-arrive',waitingPartyId:queued[0].id});
  const entered=act(paid.state,action,paid.at);assert.ok(entered);
  const party=entered.restaurant.parties.at(-1);assert.deepEqual(party.members.map(member=>member.cat),queued[0].cats);assert.equal(party.fromQueue,true);
  assert.deepEqual(entered.restaurant.waitingParties,[queued[1]]);assert.equal(party.seatedAt,paid.at+RESTAURANT_ARRIVAL_MS);
  assert.equal(act(entered,action,paid.at+1),null,'a duplicate admission cannot consume the next waiting group');
  for(let seat=0;seat<party.members.length;seat++){
    const motion=restaurantGuestMotion(party,seat,party.arrivedAt);assert.equal(motion.x,restaurantQueuePosition(0,seat).x);assert.equal(motion.y,restaurantQueuePosition(0,seat).y);
  }
  assert.equal(validRestaurant(entered.restaurant),true);assert.equal(entered.coins,paid.state.coins);assert.equal(entered.goldFish,paid.state.goldFish);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(entered)),paid.at+8000).restaurant,entered.restaurant);
});

test('expired waiting parties are hidden and never admitted, while legacy homes retain their restaurant',()=>{
  const state=act(fullRestaurant(),{type:'restaurant-wait'},NOW+10000),expiresAt=state.restaurant.waitingParties[0].expiresAt;
  assert.equal(restaurantInfo(state,expiresAt).waitingParties.length,0);
  const legacy=structuredClone(state);delete legacy.restaurant.waitingParties;
  const restored=normalizeState(legacy,NOW+12000);assert.deepEqual(restored.restaurant.orders,state.restaurant.orders);assert.deepEqual(restored.restaurant.waitingParties,[]);
  const paid=payFirstTable(state),entered=act(paid.state,{type:'restaurant-arrive'},expiresAt+1);
  assert.equal(entered.restaurant.parties.at(-1).fromQueue,undefined);assert.deepEqual(entered.restaurant.waitingParties,[]);
});

test('queue data rejects forged types, unknown cats, excessive groups and unbounded waiting clocks',()=>{
  const state=act(fullRestaurant(),{type:'restaurant-wait'},NOW+10000);
  for(const mutate of [r=>r.waitingParties[0].cats=['unknown'],r=>r.waitingParties[0].expiresAt+=999999,r=>r.waitingParties.push(r.waitingParties[0]),r=>r.waitingParties[0].extra=1]){
    const bad=structuredClone(state.restaurant);mutate(bad);assert.equal(validRestaurant(bad),false);
  }
  for(const action of [{type:'restaurant-wait',cats:['orange']},{type:'restaurant-wait',arrivedAt:NOW},{type:'restaurant-arrive',fromQueue:true}])assert.equal(sanitizeRestaurantAction(action),null);
});

test('natural arrivals wait through startup and freshly freed seats; polling and saves do not reroll the timer',()=>{
  const rhythm=createRestaurantArrivalRhythm({random:()=>.5}),empty={availableTables:2,waitingParties:[]};
  assert.equal(rhythm.poll(empty,NOW),null);
  for(let delta=400;delta<11500;delta+=400)assert.equal(rhythm.poll(empty,NOW+delta),null);
  assert.deepEqual(rhythm.poll(empty,NOW+11500),{type:'restaurant-arrive'});
  rhythm.poll({availableTables:0,waitingParties:[]},NOW+12000);
  assert.equal(rhythm.poll(empty,NOW+18000),null);assert.equal(rhythm.poll(empty,NOW+29000),null);
  assert.deepEqual(rhythm.poll(empty,NOW+29500),{type:'restaurant-arrive'});
  rhythm.poll(empty,NOW+30000,{enabled:false});assert.equal(rhythm.poll(empty,NOW+90000),null);
});

test('waiting visitors bypass startup and walk-in pauses as soon as a table frees, while a pending admission blocks duplicates',()=>{
  const rhythm=createRestaurantArrivalRhythm({random:()=>0}),full={availableTables:0,waitingParties:[]};
  rhythm.poll(full,NOW);assert.deepEqual(rhythm.poll(full,NOW+8000),{type:'restaurant-wait'});
  const free={availableTables:1,waitingParties:[{id:'wait-1-1'}]};
  assert.equal(rhythm.poll(free,NOW+9000,{blocked:true}),null);
  assert.deepEqual(rhythm.poll(free,NOW+9001),{type:'restaurant-arrive',waitingPartyId:'wait-1-1'});
  rhythm.reset();assert.deepEqual(rhythm.poll(free,NOW+9002),{type:'restaurant-arrive',waitingPartyId:'wait-1-1'});
});

test('street life includes distinct paired passers, local interactions and no saved-state writes',()=>{
  const info=restaurantInfo(fullRestaurant(),NOW+20000),before=structuredClone(info),life=createRestaurantStreetLife({random:()=>0});
  life.update(info,NOW);const first=life.update(info,NOW+2300);assert.equal(first.actors.filter(actor=>actor.kind==='passer').length,2);
  assert.equal(new Set(first.actors.map(actor=>actor.cat)).size,2);
  const later=life.update(info,NOW+8500);assert.ok(later.actors[0].x>first.actors[0].x);assert.ok(later.bubbles.length>0);
  assert.ok(life.update(info,NOW+11200).bubbles.some(bubble=>bubble.kind==='passer'||bubble.kind==='inside'));
  assert.deepEqual(info,before);assert.deepEqual(life.update(info,NOW+12000,{active:false}),{actors:[],bubbles:[],waiting:0});
});

test('queue and indoor conversation anchors follow actual guests and disappear when those guests leave',()=>{
  const state=act(fullRestaurant(),{type:'restaurant-wait'},NOW+10000),info=restaurantInfo(state,NOW+20000);
  const life=createRestaurantStreetLife({random:()=>.99});life.update(info,NOW+20000);
  const waiting=life.update(info,NOW+20100).actors.filter(actor=>actor.kind==='queue');assert.equal(waiting.length,info.waitingParties[0].cats.length);
  const talking=life.update(info,NOW+29000);assert.ok(talking.bubbles.some(bubble=>bubble.kind==='queue'));
  const gone=life.update({...info,waitingParties:[],parties:[]},NOW+29100);assert.equal(gone.bubbles.length,0);assert.equal(gone.actors.filter(actor=>actor.kind==='queue').length,0);
});

test('nearby companions take turns speaking so their bubbles cannot cover each other',()=>{
  const info={parties:[],waitingParties:[{id:'waiting-pair',arrivedAt:NOW-10000,expiresAt:NOW+100000,cats:['orange','calico']}]},life=createRestaurantStreetLife({random:()=>.99});
  life.update(info,NOW);const opening=life.update(info,NOW+9000);assert.equal(opening.bubbles.length,1);
  const reply=life.update(info,NOW+11700);assert.equal(reply.bubbles.length,1);assert.notEqual(reply.bubbles[0].speaker,opening.bubbles[0].speaker);
});
