import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRestaurantGuestService, restaurantGuestServiceDefinition, nextRestaurantGuestService, restaurantGuestHasNextCourse, restaurantGuestCompletionBonus, validRestaurantGuestService, nextRestaurantGuestRecipe } from '../src/restaurant-guest-service.js';

test('silver and gold visits keep a fixed two-meal requirement and a small final bonus',()=>{
  assert.equal(initialRestaurantGuestService('orange'),null);
  for(const [cat,tier,bonus] of [['guest-baker','silver',1],['guest-astronomer','gold',2]]){
    const member={cat,orderId:'table-1',service:initialRestaurantGuestService(cat)},definition=restaurantGuestServiceDefinition(cat);
    assert.deepEqual(definition,{tier,rounds:2,bonusGold:bonus});
    assert.equal(restaurantGuestHasNextCourse(member),true);assert.equal(restaurantGuestCompletionBonus(member),0);
    const meal={id:'table-1',recipeId:'rice',createdAt:6000,servedAt:10000};
    assert.equal(nextRestaurantGuestService(member,meal,14499),null);
    member.service=nextRestaurantGuestService(member,meal,14500);member.orderId='table-2';
    assert.equal(restaurantGuestHasNextCourse(member),false);assert.equal(restaurantGuestCompletionBonus(member),bonus);
    const party={seatedAt:6000},restaurant={nextOrderId:3,recipeLevels:{rice:1},orders:[{id:'table-2'}]};
    assert.equal(validRestaurantGuestService(member,party,restaurant),true);
    for(const mutate of [s=>s.round=1,s=>s.rounds=1,s=>s.tier=tier==='gold'?'silver':'gold',s=>s.history[0].collectedAt=14499,s=>s.history[0].createdAt++,s=>s.history[0].orderId='table-2',s=>s.bonusGold=99]){
      const bad=structuredClone(member);mutate(bad.service);assert.equal(validRestaurantGuestService(bad,party,restaurant),false);
    }
  }
});
test('a second course uses an unlocked different dish, with stable server selection',()=>{
  const recipes=[{id:'rice',unlocked:true},{id:'coffee',unlocked:true},{id:'gold-latte',unlocked:false}];
  const next=nextRestaurantGuestRecipe(recipes,'rice','guest-baker',2,100);
  assert.equal(next.id,'coffee');assert.deepEqual(next,nextRestaurantGuestRecipe(recipes,'rice','guest-baker',2,100));
  assert.equal(nextRestaurantGuestRecipe([{id:'rice',unlocked:true}],'rice','guest-baker',2,100).id,'rice');
  assert.equal(nextRestaurantGuestRecipe([{id:'rice',unlocked:false}],'rice','guest-baker',2,100),null);
});
