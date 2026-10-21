import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant, restaurantProgressPreserved } from '../src/restaurant.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { restaurantResourceLevel } from '../src/restaurant-progression.js';
import { specialRestaurantRecipe } from '../src/restaurant-economy.js';
import { RESTAURANT_GUESTS, restaurantGuestConditionKey, eligibleRestaurantGuestCats, validRestaurantGuestConditions } from '../src/restaurant-customers.js';
import { LEGACY_GOLD_GUEST_REQUIREMENTS, LEGACY_RESTAURANT_GUEST_CONDITION_KEYS } from '../src/restaurant-guest-conditions-legacy.js';
import { restaurantArrivalPlan } from '../src/restaurant-guests.js';
import { publicRoom } from '../server/github-store.mjs';

const NOW=Date.UTC(2026,9,21),ACTOR={id:'gold-gates-test',name:'店长'};
const gold=RESTAURANT_GUESTS.filter(guest=>guest.tier==='gold');
const gate=guest=>guest.requirements.find(condition=>condition.kind==='level').minimum;
function atLevel(level){const state=initialState(NOW);state.coins=100000;state.goldFish=200;state.restaurant.stats.experience=restaurantLevelStartXp(level);return state;}
function prepareThroughPurchases(guest){
  let state=atLevel(gate(guest)),at=NOW;
  const act=action=>{const next=reduceAction(state,action,ACTOR,at++,`gold-gate-${at}`);assert.ok(next,`${guest.id}: ${JSON.stringify(action)}`);state=next;};
  for(const condition of guest.requirements){
    if(condition.kind==='staff')while(state.restaurant.staff<condition.minimum)act({type:'restaurant-hire'});
    if(condition.kind==='facility')while(state.restaurant.levels[condition.id]<condition.minimum)act({type:'restaurant-upgrade',upgradeId:condition.id});
    if(condition.kind==='recipe'&&specialRestaurantRecipe(condition.id))act({type:'restaurant-unlock-special',recipeId:condition.id});
    if(condition.kind==='theme')act({type:'restaurant-premium-decoration',themeId:condition.id,equipped:true});
    if(condition.kind==='decoration'){act({type:'restaurant-decoration',decorationId:condition.id});at+=13000;state=normalizeState(state,at);}
  }
  return {state,at};
}

test('all eight gold guests are attainable at their displayed level between 30 and 39 through actual purchases',()=>{
  assert.equal(gold.length,8);assert.deepEqual(gold.filter(guest=>gate(guest)===30).map(guest=>guest.id),['guest-astronomer','guest-baron']);
  for(const guest of gold){
    assert.ok(gate(guest)>=30&&gate(guest)<=39,guest.id);
    for(const condition of guest.requirements.filter(condition=>condition.kind!=='level')){
      assert.ok(restaurantResourceLevel(condition.kind,condition.id,condition.minimum)<=gate(guest),`${guest.id}: no hidden higher-level ${condition.kind}`);
    }
    const {state,at}=prepareThroughPurchases(guest),info=restaurantInfo(state,at),entry=info.customerBook.customers.find(item=>item.id===guest.id);
    assert.equal(info.level,gate(guest));assert.ok(validRestaurant(state.restaurant));assert.ok(entry.eligible,guest.id);
    assert.ok(entry.requirements.every(condition=>condition.met));assert.equal(entry.seen,false,'qualification is not an invented visit');
    assert.ok(state.coins<100000);assert.ok(state.goldFish<=200);assert.equal(state.xp,initialState(NOW).xp,'purchases do not grant pet XP');
    const before=structuredClone(state.restaurant);before.stats.experience=restaurantLevelStartXp(gate(guest))-1;delete before.completedGuestConditions;
    assert.ok(!eligibleRestaurantGuestCats(before,at).includes(guest.id),'one level below is still gated');
    const arrived=new Set();
    for(let i=0;i<400;i++)for(const member of restaurantArrivalPlan(info.restaurant,info.recipes,{partySize:1},ACTOR,at+i*7919).members)arrived.add(member.cat);
    assert.ok(arrived.has(guest.id),`${guest.id}: eligible guest actually enters natural arrivals`);
  }
});

test('level 30 alone does not grant gold invitations or assets, and level 29 cannot invite a gold guest',()=>{
  const original=atLevel(30),before=structuredClone(original),info=restaurantInfo(original,NOW);
  assert.equal(info.customerBook.customers.filter(guest=>guest.tier==='gold'&&guest.eligible).length,0);assert.deepEqual(original,before);
  const {state,at}=prepareThroughPurchases(gold[0]);state.restaurant.stats.experience=restaurantLevelStartXp(29);delete state.restaurant.completedGuestConditions;
  assert.ok(!gold.some(guest=>eligibleRestaurantGuestCats(state.restaurant,at).includes(guest.id)));
});

test('old gold achievements and invitations survive the requirement change without changing assets or visits',()=>{
  for(const guest of LEGACY_GOLD_GUEST_REQUIREMENTS){
    const old=atLevel(1);old.restaurant.completedGuestConditions=guest.requirements.map(restaurantGuestConditionKey);
    const before=structuredClone(old),loaded=normalizeState(old,NOW+1);
    assert.ok(validRestaurant(old.restaurant));assert.ok(validRestaurantGuestConditions(loaded.restaurant.completedGuestConditions));
    assert.ok(guest.requirements.every(condition=>loaded.restaurant.completedGuestConditions.includes(restaurantGuestConditionKey(condition))));
    assert.ok(eligibleRestaurantGuestCats(loaded.restaurant,NOW+1).includes(guest.id));
    assert.ok(restaurantProgressPreserved(old.restaurant,loaded.restaurant));
    assert.equal(loaded.coins,before.coins);assert.equal(loaded.goldFish,before.goldFish);assert.equal(loaded.xp,before.xp);
    assert.equal(loaded.restaurant.staff,0);assert.deepEqual(loaded.restaurant.levels,before.restaurant.levels);assert.deepEqual(loaded.restaurant.seenGuests,[]);
    assert.deepEqual(old,before,'normalizing does not rewrite the supplied save');
  }
  const partial=atLevel(1);partial.restaurant.completedGuestConditions=['theme:royal'];
  const loaded=normalizeState(partial,NOW);assert.ok(loaded.restaurant.completedGuestConditions.includes('theme:royal'));
  assert.ok(!gold.some(guest=>eligibleRestaurantGuestCats(loaded.restaurant,NOW).includes(guest.id)),'one legacy achievement does not fabricate an invitation');
});

test('new gold achievements use a complete versioned envelope while older pages receive only known keys',()=>{
  const {state,at}=prepareThroughPurchases(gold[0]),normalized=normalizeState(state,at),before=structuredClone(normalized);
  const wire=publicRoom({roomId:'0'.repeat(32),state:normalized,revision:7});
  assert.equal(Object.hasOwn(wire.state.restaurant,'completedGuestConditions'),false);
  assert.ok(wire.restaurantGuestConditionsV2.includes('level:30'));assert.ok(wire.restaurantGuestConditionsV2.includes('theme:moonclock'));
  assert.ok(wire.restaurantGuestConditions.every(key=>LEGACY_RESTAURANT_GUEST_CONDITION_KEYS.includes(key)));
  assert.ok(!wire.restaurantGuestConditions.includes('level:30'));assert.deepEqual(normalized,before);
  const restored=normalizeState({...wire.state,restaurant:{...wire.state.restaurant,completedGuestConditions:wire.restaurantGuestConditionsV2}},at);
  assert.ok(eligibleRestaurantGuestCats(restored.restaurant,at).includes('guest-astronomer'));
});
