import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState } from '../src/state.js';
import { restaurantInfo, restaurantActionResult, validRestaurant } from '../src/restaurant.js';
import { RESTAURANT_GUESTS, eligibleRestaurantGuestCats } from '../src/restaurant-customers.js';
import { restaurantArrivalPlan } from '../src/restaurant-guests.js';
import { nextRestaurantGuestRecipe } from '../src/restaurant-guest-service.js';
import { restaurantGuestDebugResult } from '../demo/restaurant-guests.js';
import { restaurantRecipesPanel } from '../src/restaurant-ui.js';
import { restaurantGradeGuide, restaurantGuestCoursePreview } from '../src/restaurant-order-tiers-ui.js';
import { RESTAURANT_GUEST_ARRIVAL_WEIGHTS, RESTAURANT_DISH_ORDER_WEIGHTS, restaurantGuestTier, restaurantGuestArrivalPool, restaurantDishOrderPool, pickRestaurantProbability } from '../src/restaurant-order-probabilities.js';

const NOW=Date.parse('2026-10-19T12:00:00Z'),actor={id:'order-odds-test',name:'店长'};
const grades=['B','A','S','SS','SSS'];
const recipes=grades.map((grade,index)=>({id:`dish-${grade}`,level:index+1,unlocked:true}));
const counts=(pool,key,n=10000)=>{
  const result={};for(let i=0;i<n;i++){const item=pickRestaurantProbability(pool,(i+.5)/n),value=key(item);result[value]=(result[value]??0)+1;}return result;
};

test('eligible guest tiers have fixed 75/20/5 odds regardless of character count',()=>{
  const cats=RESTAURANT_GUESTS.map(guest=>guest.id),pool=restaurantGuestArrivalPool(cats);
  const sampled=counts(pool,item=>item.tier);
  for(const [tier,weight] of Object.entries(RESTAURANT_GUEST_ARRIVAL_WEIGHTS))assert.equal(sampled[tier],weight*100);
  const extraOrdinary=restaurantGuestArrivalPool([...cats,'extra-cat']);
  assert.deepEqual(counts(extraOrdinary,item=>item.tier),sampled);
  assert.deepEqual(counts(restaurantGuestArrivalPool(['orange','guest-baker']),item=>item.tier),{ordinary:8000,silver:2000});
  assert.deepEqual(counts(restaurantGuestArrivalPool(['orange','guest-baron']),item=>item.tier),{ordinary:9500,gold:500});
  assert.deepEqual(counts(restaurantGuestArrivalPool(['orange','calico']),item=>item.tier),{ordinary:10000});
});

test('quality-first dish odds match the requested preferences without catalog dilution',()=>{
  for(const tier of ['ordinary','silver','gold']){
    const pool=restaurantDishOrderPool([...recipes,{id:'extra-B',level:1,unlocked:true}],tier);
    const sampled=counts(pool,item=>item.grade);
    for(const grade of grades)assert.equal(sampled[grade],RESTAURANT_DISH_ORDER_WEIGHTS[tier][grade]*100);
    const b=pool.filter(item=>item.grade==='B');assert.equal(b[0].chance,b[1].chance);
  }
});

test('only available grades are renormalized, locked or unowned food cannot be ordered',()=>{
  const source=[...recipes.map(recipe=>({...recipe,unlocked:['dish-B','dish-S'].includes(recipe.id)})),{id:'unowned',level:5,special:true,owned:false,unlocked:true}];
  const before=structuredClone(source),pool=restaurantDishOrderPool(source,'silver');
  assert.deepEqual(pool.map(item=>item.recipe.id),['dish-B','dish-S']);
  assert.equal(pool[0].chance,5/55);assert.equal(pool[1].chance,50/55);
  assert.equal(pickRestaurantProbability(restaurantDishOrderPool([recipes[0]],'gold'),.99).grade,'B');
  assert.deepEqual(source,before);assert.equal(pickRestaurantProbability([],0),null);
  // A forged presentation grade does not change the real recipe level.
  assert.equal(restaurantDishOrderPool([{...recipes[0],grade:'SSS'}],'gold')[0].grade,'B');
});

test('authoritative first-course sampling is deterministic and respects eligibility and recipe snapshots',()=>{
  const fixture=restaurantGuestDebugResult(initialState(NOW),{mode:'guest',guestId:'guest-baker'},NOW).state;
  const r=fixture.restaurant;r.orders=[];r.parties=[];
  const eligible=eligibleRestaurantGuestCats(r,NOW),seen={};
  let silver=0;
  for(let i=0;i<4000;i++){
    const at=NOW+i*7919,info=restaurantInfo(fixture,at),plan=restaurantArrivalPlan(info.restaurant,info.recipes, {partySize:1},actor,at);
    assert.deepEqual(plan,restaurantArrivalPlan(info.restaurant,info.recipes,{partySize:1},actor,at));
    const member=plan.members[0],tier=restaurantGuestTier(member.cat);
    assert.ok(eligible.includes(member.cat));assert.ok(member.recipe.unlocked);
    assert.equal(tier==='gold',false);silver+=tier==='silver';seen[member.cat]=true;
  }
  assert.ok(silver>680&&silver<920,`silver visits: ${silver}/4000`);
  assert.ok(Object.keys(seen).length>10);
  const result=restaurantActionResult(fixture,{type:'restaurant-arrive',partySize:2},actor,NOW+1);
  assert.ok(result.ok);assert.ok(validRestaurant(result.restaurant));
  for(const order of result.restaurant.orders)assert.equal(order.recipeLevel,r.recipeLevels[order.recipeId]);
  assert.deepEqual(result,restaurantActionResult(fixture,{type:'restaurant-arrive',partySize:2},actor,NOW+1));
});

test('second courses use the same quality preferences and avoid the first dish',()=>{
  for(const [cat,tier] of [['orange','ordinary'],['guest-baker','silver'],['guest-baron','gold']]){
    const observed=Object.fromEntries(grades.map(grade=>[grade,0]));
    for(let i=0;i<12000;i++){
      const next=nextRestaurantGuestRecipe(recipes,'previous-dish',cat,i+1,NOW+i*7919);
      observed[grades[next.level-1]]++;
    }
    for(const grade of grades)assert.ok(Math.abs(observed[grade]/12000-RESTAURANT_DISH_ORDER_WEIGHTS[tier][grade]/100)<.025,`${tier} ${grade}: ${observed[grade]}`);
    for(let i=0;i<100;i++)assert.notEqual(nextRestaurantGuestRecipe(recipes,'dish-S',cat,i+1,NOW+i).id,'dish-S');
  }
});

test('player catalogs lead to details while specified dishes remain a terminal test',async()=>{
  const info=restaurantInfo(initialState(NOW),NOW),html=restaurantRecipesPanel(info);
  assert.doesNotMatch(html,/data-r-action="start"|客满啦/);
  assert.match(html,/data-r-recipe-detail="rice"/);assert.doesNotMatch(html,/data-r-action="recipe"/);
  assert.match(restaurantGradeGuide(),/顾客随机点餐/);
  const preview=restaurantGuestCoursePreview(RESTAURANT_GUESTS.find(guest=>guest.tier==='gold'),id=>`<i>${id}</i>`);
  assert.doesNotMatch(preview,/data-r-dish-grade|SSS 级订单/);assert.match(preview,/更偏好 SSS/);
  const source=await readFile(new URL('../src/restaurant-ui.js',import.meta.url),'utf8');
  assert.match(source,/data-r-debug-dish|dataset.rDebugDish/);
});
