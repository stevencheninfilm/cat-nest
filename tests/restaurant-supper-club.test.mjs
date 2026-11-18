import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { RESEARCH_INSPIRATION_MAX } from '../src/restaurant-research.js';
import { restaurantActionResult, restaurantInfo, sanitizeRestaurantAction, validRestaurant, restaurantProgressPreserved, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { restaurantDishOrderPool } from '../src/restaurant-order-probabilities.js';
import { restaurantArrivalPlan } from '../src/restaurant-guests.js';
import { legacySupperClub, startSupper, supperClubInfo, supperTeamPreview, validSupperClub } from '../src/restaurant-supper-club.js';

const now=Date.parse('2026-11-17T10:00:00Z');
const alice={id:'client-alice',name:'小鱼'};
const bob={id:'client-bobby',name:'小猫'};
const kickoff=(overrides={})=>({type:'restaurant-supper-start',themeId:'mains',workerIds:['worker-1','worker-2'],run:1,...overrides});
const menu=state=>restaurantInfo(state,now).supperClub;
function ready(level=50,staff=6) {
  const state=initialState(now);
  state.restaurant.stats.experience=restaurantLevelStartXp(level);
  state.restaurant.staff=staff;
  state.coins=100000;
  return state;
}

function makeMeal(state,recipeId,at){
  const next=reduceAction(state,{type:'restaurant-start',recipeId},alice,at);
  assert.ok(next);
  const order=restaurantInfo(next,at).orders.at(-1);
  return {state:next,action:{type:'restaurant-collect',orderId:order.id},collectAt:order.servedAt+RESTAURANT_DINING_MS};
}

function finishSupper(state,at=now){
  do {
    const meal=makeMeal(state,'sandwich',at);
    state=reduceAction(meal.state,meal.action,bob,meal.collectAt);
    assert.ok(state);
    at=meal.collectAt+1000;
  }while(state.restaurant.supperClub.active);
  return state;
}

function settleMeals(state,recipeIds){
  let at=Math.max(now,state.restaurant.lastInteractionAt)+1000;
  for(const id of recipeIds){
    const meal=makeMeal(state,id,at);
    state=reduceAction(meal.state,meal.action,bob,meal.collectAt);
    assert.ok(state);
    at=meal.collectAt+1000;
  }
  return state;
}

test('only distinct paid theme dishes stamp the optional menu, with one bonus at settlement',()=>{
  const open=reduceAction(ready(),kickoff(),alice,now);
  const base=menu(open).active.reward;
  let state=settleMeals(open,['sandwich','coffee','sandwich']);
  assert.deepEqual(menu(state).active.signature.collected,['sandwich']);
  assert.equal(menu(state).active.signature.creditedBonus,0);
  assert.equal(menu(state).active.progress,7);
  const meal=makeMeal(state,'rice',state.restaurant.lastInteractionAt+1000);
  const gift=restaurantInfo(meal.state,meal.collectAt).orders.at(-1).rewardInspiration;
  const before=meal.state.restaurant.research.inspirationEarned;
  assert.equal(reduceAction(meal.state,meal.action,bob,meal.collectAt-1),null);
  state=reduceAction(meal.state,meal.action,bob,meal.collectAt);
  const {last,themes}=menu(state);
  assert.equal(last.reward,base+15);
  assert.equal(last.signature.completed,true);
  assert.deepEqual(last.signature.collected,['sandwich','rice']);
  assert.equal(last.signature.bonus,15);
  assert.equal(last.signature.creditedBonus,15);
  assert.equal(themes[0].signature.bonus,30);
  assert.equal(state.restaurant.research.inspirationEarned,before+gift+last.reward);
  assert.equal(reduceAction(state,meal.action,alice,meal.collectAt+1),null);
  assert.deepEqual(normalizeState(state,meal.collectAt).restaurant.supperClub,state.restaurant.supperClub);
  const old=legacySupperClub(state.restaurant.supperClub);
  assert.equal(old.last.reward,base);
  assert.equal(Object.hasOwn(old.last,'signatureDishes'),false);
  assert.equal(legacySupperClub(old),old);
  assert.ok(validSupperClub(old,state.restaurant.staff,state.restaurant.stats.served));
  assert.equal(state.restaurant.supperClub.last.reward,base+15);
});

test('earned menu bonus obeys remaining headroom and the receipt states the actual extra credit',()=>{
  const open=reduceAction(ready(),kickoff(),alice,now);
  const base=menu(open).active.reward;
  const paid=settleMeals(open,['rice','sandwich']);
  assert.equal(menu(paid).active.signature.completed,true);
  assert.equal(menu(paid).active.signature.creditedBonus,0);
  const meal=makeMeal(paid,'burger',paid.restaurant.lastInteractionAt+1000);
  const gift=restaurantInfo(meal.state,meal.collectAt).orders.at(-1).rewardInspiration;
  for(const headroom of [0,base-1,base+1,base+15]){
    const state=structuredClone(meal.state);
    state.restaurant.research.inspirationEarned=RESEARCH_INSPIRATION_MAX-headroom-gift;
    const finished=reduceAction(state,meal.action,alice,meal.collectAt);
    assert.ok(finished);
    const {last}=menu(finished);
    assert.equal(last.reward,headroom);
    assert.equal(last.signature.creditedBonus,Math.max(0,headroom-base));
    assert.equal(legacySupperClub(finished.restaurant.supperClub).last.reward,Math.min(headroom,base));
    assert.deepEqual(last.signature.collected,['rice','sandwich']);
    assert.equal(finished.restaurant.research.inspirationEarned,RESEARCH_INSPIRATION_MAX);
    assert.equal(reduceAction(finished,meal.action,bob,meal.collectAt),null);
  }
});

test('an older active supper retains its original payout and receipt, then the next run has its own menu',()=>{
  const open=reduceAction(ready(),kickoff(),alice,now);
  delete open.restaurant.supperClub.active.signatureDishes;
  assert.equal(legacySupperClub(open.restaurant.supperClub),open.restaurant.supperClub);
  assert.ok(validRestaurant(open.restaurant));
  const {active}=menu(open);
  assert.equal(active.signature,null);
  const state=settleMeals(open,['sandwich','rice','burger']);
  assert.equal(menu(state).last.signature,null);
  assert.equal(menu(state).last.reward,active.reward);
  assert.ok(restaurantProgressPreserved(open.restaurant,state.restaurant));
  const resumed=reduceAction(state,kickoff({run:2}),bob,state.restaurant.lastInteractionAt+1);
  assert.equal(menu(resumed).last.signature,null);
  assert.deepEqual(menu(resumed).active.signature.collected,[]);
  assert.equal(menu(resumed).active.signature.bonus,30);
  assert.deepEqual(legacySupperClub(resumed.restaurant.supperClub).last,state.restaurant.supperClub.last);
});

test('the menu advertises only available theme dishes, and ordinary hosting works with just one',()=>{
  const state=ready(8,1);
  const recipes=restaurantInfo(state,now).recipes.filter(dish=>dish.id!=='sandwich');
  const staff=[{name:'小黑',role:'送餐员',sprite:'waiter'}];
  const view=supperClubInfo(state.restaurant,8,staff,recipes);
  assert.deepEqual(view.themes[0].signature,{target:2,available:false,dishes:[{id:'rice',name:'暖暖蛋包饭'}],bonus:15});
  const {club}=startSupper(state.restaurant,view,kickoff(),state.coins);
  assert.ok(club.active);
  const during={...state.restaurant,supperClub:club};
  assert.equal(supperClubInfo(during,8,staff,recipes).active.signature.available,false);
  const expanded=supperClubInfo(during,8,staff,restaurantInfo(state,now).recipes);
  assert.equal(expanded.active.signature.available,true);
  assert.deepEqual(expanded.active.signature.dishes.map(dish=>dish.id),['rice','sandwich']);
});

test('invalid stamps, reward claims, and rewinds cannot pass the shared supper validator',()=>{
  const open=reduceAction(ready(),kickoff(),alice,now);
  const state=settleMeals(open,['rice','sandwich']);
  const {restaurant}=state;
  assert.ok(validRestaurant(restaurant));
  for(const stamps of [['rice','rice'],['rice','coffee'],['no-such-dish'],['rice',,'sandwich'],['rice','burger','sandwich'],null,{}]){
    const tampered=structuredClone(restaurant);
    tampered.supperClub.active.signatureDishes=stamps;
    assert.equal(validRestaurant(tampered),false);
  }
  const forged=structuredClone(restaurant);
  forged.supperClub.active.progress=2;
  assert.equal(validRestaurant(forged),false);
  for(const stampList of [[],['sandwich','rice'],undefined]){
    const rollback=structuredClone(restaurant);
    if(stampList)rollback.supperClub.active.signatureDishes=stampList;
    else delete rollback.supperClub.active.signatureDishes;
    assert.equal(restaurantProgressPreserved(restaurant,rollback),false);
  }
  const finished=settleMeals(state,['rice']);
  const stale=structuredClone(finished.restaurant);
  stale.supperClub.last.signatureDishes=['rice'];
  assert.equal(validRestaurant(stale),false);
  assert.equal(restaurantProgressPreserved(restaurant,stale),false);
  assert.equal(restaurantProgressPreserved(finished.restaurant,stale),false);
});

test('legacy restaurant opens with its original balance and an optional empty supper projection',()=>{
  const state=ready(8,1);
  assert.ok(validRestaurant(state.restaurant));
  assert.equal(state.restaurant.supperClub,undefined);
  const view=menu(state);
  assert.equal(view.active,null);
  assert.equal(view.nextRun,1);
  assert.deepEqual(view.workers.map(x=>x.id),['worker-1','worker-2']);
  assert.equal(state.restaurant.supperClub,undefined);
  const action=kickoff();
  const next=reduceAction(state,action,alice,now);
  assert.equal(next.coins,state.coins-view.themes[0].cost);
  assert.equal(next.xp,state.xp);
  assert.deepEqual(next.restaurant.orders,state.restaurant.orders);
  assert.equal(restaurantProgressPreserved(state.restaurant,next.restaurant),true);
  assert.deepEqual(normalizeState(next,now).restaurant.supperClub,next.restaurant.supperClub);
  assert.equal(reduceAction(next,action,bob,now+1),null);
  assert.equal(reduceAction(next,kickoff({themeId:'desserts'}),bob,now+1),null);
});

test('start checks intent shape, roster, level, exact available coins and cumulative inspiration headroom',()=>{
  const state=ready(8,1);
  for(const fields of [{themeId:'unknown'},{workerIds:['worker-1','worker-1']},{workerIds:['worker-1']},
    {workerIds:[,'worker-1']},{workerIds:['worker-1','worker-8']},{run:0},{reward:5000},{expectedLevel:1}]){
    assert.equal(sanitizeRestaurantAction(kickoff(fields)),null);
  }
  assert.equal(restaurantActionResult(ready(7),kickoff(),alice,now).ok,false);
  assert.equal(restaurantActionResult(ready(8,0),kickoff(),alice,now).ok,false);
  assert.equal(restaurantActionResult(state,kickoff({workerIds:['worker-1','worker-3']}),alice,now).ok,false);
  assert.equal(restaurantActionResult(state,kickoff({run:2}),alice,now).ok,false);
  assert.equal(restaurantActionResult({...state,coins:1199},kickoff(),alice,now).ok,false);
  assert.equal(restaurantActionResult({...state,coins:1200},kickoff(),alice,now).coins,0);
  const team=kickoff().workerIds, reward=supperTeamPreview(menu(state).themes[0],team).reward;
  state.restaurant.research.inspirationEarned=RESEARCH_INSPIRATION_MAX-reward+1;
  assert.equal(restaurantActionResult(state,kickoff(),alice,now).ok,false);
  assert.equal(state.restaurant.supperClub,undefined);
});

test('only successful real checkouts advance a supper; different pairs trade speed for inspiration',()=>{
  const state=ready(),theme=menu(state).themes.find(item=>item.id==='desserts');
  const quick=['worker-5','worker-3'], host=['worker-4','worker-2'];
  assert.ok(supperTeamPreview(theme,quick).reward<supperTeamPreview(theme,host).reward);
  const preview=menu(reduceAction(state,kickoff({themeId:'desserts',workerIds:host}),alice,now));
  assert.equal(preview.active.reward,supperTeamPreview(theme,host).reward);
  for(const [pair,recipe,expected] of [[quick,'pancake',3],[quick,'sandwich',2],[host,'pancake',2],[host,'sandwich',1]]){
    const open=reduceAction(state,kickoff({themeId:'desserts',workerIds:pair}),alice,now);
    const meal=makeMeal(open,recipe,now);
    assert.equal(menu(meal.state).active.progress,0);
    assert.equal(reduceAction(meal.state,meal.action,bob,meal.collectAt-1),null);
    const paid=reduceAction(meal.state,meal.action,bob,meal.collectAt);
    assert.equal(menu(paid).active.progress,expected);
    assert.equal(reduceAction(paid,meal.action,alice,meal.collectAt),null);
    assert.ok(restaurantProgressPreserved(meal.state.restaurant,paid.restaurant));
    assert.equal(restaurantProgressPreserved(paid.restaurant,meal.state.restaurant),false);
  }
});

test('supper receipts and prices are per theme, a stale start from either caregiver cannot debit twice',()=>{
  const state=ready(), open=reduceAction(state,kickoff(),alice,now);
  const complete=finishSupper(open);
  const view=menu(complete);
  assert.equal(view.active,null);
  assert.equal(view.last.reward,menu(open).active.reward);
  assert.deepEqual(complete.restaurant.supperClub.completed,{mains:1,desserts:0,drinks:0});
  assert.ok(complete.restaurant.research.inspirationEarned>=state.restaurant.research.inspirationEarned+view.last.reward);
  assert.equal(view.themes[0].cost,3000);
  assert.equal(view.themes[1].cost,1200);
  assert.equal(view.nextRun,2);
  assert.equal(reduceAction(complete,kickoff(),bob,now+86400000),null);
  assert.equal(reduceAction(complete,kickoff({themeId:'drinks'}),bob,now+86400000),null);
  const second=reduceAction(complete,kickoff({run:2}),bob,now+86400000);
  assert.equal(second.coins,complete.coins-view.themes[0].cost);
  const lost=structuredClone(second.restaurant);
  delete lost.supperClub;
  assert.ok(validRestaurant(lost));
  assert.equal(restaurantProgressPreserved(second.restaurant,lost),false);
  const swapped=structuredClone(second.restaurant);
  swapped.supperClub.active.workerIds=['worker-1','worker-3'];
  assert.equal(restaurantProgressPreserved(second.restaurant,swapped),false);
  assert.ok(restaurantProgressPreserved(open.restaurant,complete.restaurant));
});

test('club at the research cap still settles orders and records the actual credited reward once',()=>{
  const open=reduceAction(ready(),kickoff(),alice,now);
  open.restaurant.research.inspirationEarned=RESEARCH_INSPIRATION_MAX;
  const complete=finishSupper(open);
  assert.equal(complete.restaurant.research.inspirationEarned,RESEARCH_INSPIRATION_MAX);
  assert.equal(menu(complete).last.reward,0);
  assert.equal(complete.restaurant.supperClub.completed.mains,1);
  assert.equal(complete.restaurant.stats.served,3);
});

test('prices, rewards and targets rise to a finite plateau; invalid receipts and rosters are rejected',()=>{
  let state=ready();
  const costs=[],targets=[],rewards=[];
  for(let i=1;i<=7;i++){
    const previous=state.restaurant;
    state.coins=999000;
    const theme=menu(state).themes[0];
    costs.push(theme.cost);targets.push(theme.target);rewards.push(supperTeamPreview(theme,kickoff().workerIds).reward);
    const at=now+i*86400000;
    state=finishSupper(reduceAction(state,kickoff({run:i}),alice,at),at);
    assert.ok(restaurantProgressPreserved(previous,state.restaurant));
    assert.equal(menu(state).last.tier,Math.min(i,6));
    assert.equal(menu(state).last.reward,rewards.at(-1));
  }
  for(const values of [costs,targets,rewards]){
    assert.ok(values.slice(1,-1).every((value,index)=>value>values[index]));
    assert.equal(values.at(-2),values.at(-1));
  }
  const original=state.restaurant.supperClub;
  for(const modified of [{...original,last:null},{...original,last:{...original.last,reward:9999999}},
      {...original,last:{...original.last,run:1}},{...original,completed:{...original.completed,drinks:-1}}]){
    assert.equal(validSupperClub(modified,state.restaurant.staff,state.restaurant.stats.served),false);
  }
  assert.equal(validSupperClub({...original,last:{...original.last,workerIds:['worker-1','worker-8']}},6,state.restaurant.stats.served),false);
});


test('a theme earned three times doubles matching ordinary dish weights only during a new supper of that theme',()=>{
  const recipes=[
    {id:'rice',category:'主食',level:1},{id:'lemontea',category:'饮品',level:1},
    {id:'pancake',category:'甜点',level:3},{id:'burger',category:'主食',level:3},
    {id:'locked',category:'主食',level:5,unlocked:false},{id:'unowned',category:'主食',level:2,owned:false},
  ];
  const basePool=restaurantDishOrderPool(recipes);
  const favored=restaurantDishOrderPool(recipes,'ordinary','主食');
  assert.equal(favored.length,4);
  assert.deepEqual(favored.map(item=>item.recipe.id),basePool.map(item=>item.recipe.id));
  assert.ok(favored.every(item=>item.chance>0));
  assert.ok(Math.abs(favored.reduce((sum,item)=>sum+item.chance,0)-1)<1e-10);
  const odds=pool=>pool[0].chance/pool[1].chance;
  assert.equal(odds(favored),2*odds(basePool));
  for(const tier of ['silver','gold'])
    assert.deepEqual(restaurantDishOrderPool(recipes,tier,'主食'),restaurantDishOrderPool(recipes,tier));
  const state=ready();
  state.restaurant.supperClub={completed:{mains:3,desserts:0,drinks:0},active:{themeId:'mains'},last:null};
  const restaurant=state.restaurant, menuOptions=recipes.filter(r=>r.unlocked!==false&&r.owned!==false);
  let changed=0;
  for(let i=0;i<100;i++){
    const at=now+i*73571;
    const baseline={...restaurant,supperClub:undefined};
    const plan=(r,action={partySize:1})=>restaurantArrivalPlan(r,menuOptions,action,alice,at);
    const standard=plan(baseline),withSupper=plan(restaurant);
    assert.equal(standard.members[0].cat,withSupper.members[0].cat);
    if(withSupper.members[0].recipe.id!==standard.members[0].recipe.id)changed++;
    assert.deepEqual(plan({...restaurant,supperClub:{...restaurant.supperClub,active:null}}),standard);
    assert.deepEqual(plan({...restaurant,supperClub:{...restaurant.supperClub,completed:{mains:2}}}),standard);
    assert.deepEqual(plan({...restaurant,supperClub:{...restaurant.supperClub,active:{themeId:'drinks'}}}),standard);
    assert.deepEqual(plan(restaurant,{recipeId:'pancake',partySize:2}),plan(baseline,{recipeId:'pancake',partySize:2}));
  }
  assert.ok(changed>0);
});

test('normal kitchen orders keep their original workflow and gain supper progress only upon collecting',()=>{
  const original=reduceAction(ready(),{type:'restaurant-arrive',partySize:1,recipeId:'rice'},alice,now);
  let state=reduceAction(original,kickoff(),bob,now);
  const order=original.restaurant.orders[0], orderId=order.id;
  let at=order.createdAt;
  assert.deepEqual(state.restaurant.orders,original.restaurant.orders);
  const step=(type,fields={})=>{
    state=reduceAction(state,{type,orderId,...fields},alice,at);
    assert.ok(state);
    assert.equal(state.restaurant.supperClub.active.progress,0);
  };
  step('restaurant-kitchen-accept');
  for(const {id} of KITCHEN_FLOWS.rice){
    step('restaurant-kitchen-step',{stepId:id});
    at=state.restaurant.orders[0].workflow.runs.at(-1).endAt;
  }
  step('restaurant-kitchen-step',{stepId:'delivery'});
  at=state.restaurant.orders[0].workflow.servedAt+RESTAURANT_DINING_MS;
  const collected=reduceAction(state,{type:'restaurant-collect',orderId},bob,at);
  assert.equal(menu(collected).active.progress,3);
  assert.equal(collected.pendingGrowth.length,1);
});

test('a completed supper keeps its historical team when the demo returns to one chef',()=>{
  const completed=finishSupper(reduceAction(ready(),kickoff(),alice,now));
  const demo=restaurantStaffDebugResult(completed,{mode:'preset',staff:0},now+86400000);
  assert.ok(demo.ok,demo.message);
  assert.equal(demo.state.restaurant.staff,0);
  assert.deepEqual(demo.state.restaurant.supperClub,completed.restaurant.supperClub);
  assert.ok(validRestaurant(demo.state.restaurant));
});

test('shrinking a demo roster during a supper explains the conflict and keeps the active run intact',()=>{
  const started=reduceAction(ready(),kickoff({workerIds:['worker-6','worker-7']}),alice,now);
  const before=structuredClone(started);
  const demo=restaurantStaffDebugResult(started,{mode:'preset',staff:3},now);
  assert.equal(demo.ok,false);
  assert.match(demo.message,/先完成本场餐会/);
  assert.deepEqual(started,before);
});
