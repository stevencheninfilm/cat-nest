import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo, normalizeRestaurant, validRestaurant, RESTAURANT_UPGRADES } from '../src/restaurant.js';
import { restaurantFacilityTimeMultiplier, restaurantFacilityEffect, restaurantTableCapacity } from '../src/restaurant-facilities.js';
import { restaurantResourceLevel } from '../src/restaurant-progression.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { KITCHEN_FLOWS, kitchenStepDuration } from '../src/restaurant-kitchen.js';
import { createInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { restaurantFacilityCards, staffEffectCopy, staffAbilityEffectsMarkup, restaurantUpgradeHelp } from '../src/restaurant-upgrade-ui.js';
import { staffAbilityLevelEffects } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'facility-manager',name:'店长'};
const act=(state,type,fields={},at=NOW)=>reduceAction(state,{type,...fields},ACTOR,at);
const funded=()=>{const state=initialState(NOW);state.coins=999999;state.restaurant.stats.experience=levelStartXp(50);return state;};

test('all four facilities upgrade exactly nine times with authoritative prices, gates and a level ten ceiling',()=>{
  for(const facility of RESTAURANT_UPGRADES){
    let state=funded(),spent=0;
    assert.equal(facility.maxLevel,10);assert.equal(facility.costs.length,9);
    for(let target=2;target<=10;target++){
      const required=restaurantResourceLevel('facility',facility.id,target),locked=structuredClone(state);
      locked.restaurant.stats.experience=levelStartXp(required)-.1;
      assert.equal(act(locked,'restaurant-upgrade',{upgradeId:facility.id}),null);
      const poor=structuredClone(state);poor.coins=facility.costs[target-2]-1;
      assert.equal(act(poor,'restaurant-upgrade',{upgradeId:facility.id}),null);
      const xp=state.restaurant.stats.experience;
      state=act(state,'restaurant-upgrade',{upgradeId:facility.id});assert.ok(state);
      spent+=facility.costs[target-2];assert.equal(state.coins,999999-spent);
      assert.equal(state.restaurant.levels[facility.id],target);
      assert.equal(state.restaurant.stats.experience,xp);assert.equal(validRestaurant(state.restaurant),true);
      assert.equal(normalizeRestaurant(JSON.parse(JSON.stringify(state.restaurant)),NOW).levels[facility.id],target);
    }
    assert.equal(restaurantInfo(state,NOW).upgrades.find(item=>item.id===facility.id).cost,null);
    assert.equal(act(state,'restaurant-upgrade',{upgradeId:facility.id}),null);
  }
});

test('old facility timings and prices survive while level five to ten continue reducing processing times',()=>{
  assert.deepEqual(RESTAURANT_UPGRADES.map(item=>item.costs.slice(0,3)),[[180,420,900],[100,280,620],[150,450,1100],[120,340,800]]);
  for(let level=1;level<=4;level++)assert.equal(restaurantFacilityTimeMultiplier(level),1-.15*(level-1));
  assert.deepEqual(Array.from({length:10},(_,i)=>restaurantFacilityEffect('kitchen',i+1).percent),[0,15,30,45,50,55,60,65,70,75]);
  for(const step of [{durationMs:10000,zoneId:5},{durationMs:10000,zoneId:10}]){
    const durations=Array.from({length:10},(_,i)=>kitchenStepDuration(step,i+1,i+1));
    assert.deepEqual(durations,[10000,8500,7000,5500,5000,4500,4000,3500,3000,2500]);
  }
});

test('table upgrades retain the eight-table floor and snapshot comfort income for new orders only',()=>{
  let state=funded();state.restaurant.levels.tables=4;
  state=act(state,'restaurant-start',{recipeId:'pancake'});
  const old=restaurantInfo(state,NOW).orders[0],saved=structuredClone(state.restaurant.orders[0]);
  state=act(state,'restaurant-upgrade',{upgradeId:'tables'});
  assert.equal(restaurantInfo(state,NOW).capacity,8);assert.deepEqual(state.restaurant.orders[0],saved);
  assert.equal(restaurantInfo(state,NOW).orders[0].rewardCoins,old.rewardCoins);
  state=act(state,'restaurant-start',{recipeId:'pancake'});
  let info=restaurantInfo(state,NOW),fresh=info.orders[1];
  assert.equal(fresh.tablesLevel,5);assert.equal(fresh.rewardCoins,Math.round(fresh.recipe.price*1.05));
  state.restaurant.levels.tables=10;state.restaurant.levels.kitchen=10;state.restaurant.levels.fridge=10;state.restaurant.levels.tips=10;
  assert.equal(validRestaurant(state.restaurant),true);
  assert.equal(restaurantInfo(state,NOW).orders[1].rewardCoins,fresh.rewardCoins);
  const forged=structuredClone(state.restaurant);forged.orders[1].tablesLevel=11;assert.equal(validRestaurant(forged),false);
  state=act(state,'restaurant-start',{recipeId:'pancake'});info=restaurantInfo(state,NOW);
  const facilityIncome=Math.round(fresh.recipe.price*2.35*1.3);
  assert.equal(info.orders.at(-1).rewardCoins,facilityIncome+Math.floor(facilityIncome/100),'the default owned bakery adds its permanent 1% after facility income');
  for(const level of [4,5,6,7,8,9,10])assert.equal(restaurantTableCapacity(level),8);
  assert.deepEqual(restaurantFacilityEffect('tables',10),{capacity:8,percent:30,kind:'tables'});
});

test('level-ten facilities create valid workflows on all eight existing routes and cannot seat an invisible ninth table',()=>{
  const state=funded();state.restaurant.levels={kitchen:10,fridge:10,tables:10,tips:10};
  for(const recipeId of Object.keys(KITCHEN_FLOWS))for(let seat=0;seat<8;seat++){
    const flow=createInteractiveWorkflow(state.restaurant,recipeId,NOW,{orderId:'table-1',seat,version:4});
    assert.ok(flow);assert.equal(flow.layoutCapacity,8);assert.equal(flow.kitchenLevel,10);assert.equal(flow.fridgeLevel,10);
  }
  let full=state;
  for(let i=0;i<8;i++){full=act(full,'restaurant-arrive',{partySize:2,recipeId:'pancake'});assert.ok(full);assert.equal(validRestaurant(full.restaurant),true);}
  assert.equal(restaurantInfo(full,NOW).capacity,8);assert.equal(restaurantInfo(full,NOW).guestCount,16);
  assert.equal(act(full,'restaurant-arrive',{partySize:1}),null);
});

test('staff percentage previews distinguish rate, duration, capacity and rounded step costs at every level',()=>{
  const stepCosts=[10,9,8,7,6,5,4,3,2,1];
  const walkReductions=[0,13,23.1,31,37.5,42.9,47.4,51.2,54.5,57.4];
  for(let level=1;level<=10;level++){
    assert.deepEqual(staffAbilityLevelEffects('speed',level),{ratePercent:15*(level-1),timeReductionPercent:walkReductions[level-1]});
    assert.deepEqual(staffAbilityLevelEffects('stamina',level),{maxEnergy:200+30*(level-1),capacityPercent:15*(level-1)});
    assert.deepEqual(staffAbilityLevelEffects('endurance',level),{factorReductionPercent:10*(level-1),stepEnergyCost:stepCosts[level-1],actualReductionPercent:(10-stepCosts[level-1])*10});
  }
  assert.deepEqual(staffAbilityLevelEffects('skill',10),{ratePercent:117,timeReductionPercent:53.9,incomePercent:27});
  assert.equal(staffEffectCopy('speed',10).primary,'行走与取料速度 +135%');
  assert.equal(staffEffectCopy('endurance',10).secondary,'每步 1 点 · 实际耗能 −90%');
});

test('upgrade cards retain quick previews while all ten-level tables live in help without purchase intents',()=>{
  const state=funded(),info=restaurantInfo(state,NOW),before=structuredClone(state),markup=restaurantFacilityCards(info);
  assert.equal((markup.match(/data-r-action="upgrade"/g)||[]).length,4);
  assert.doesNotMatch(markup,/data-r-effect-level=|data-r-upgrade-detail=|明细/);
  assert.match(markup,/data-r-tab="help" data-r-upgrade-help-link/);
  assert.match(markup,/满级 −75%/);
  const help=restaurantUpgradeHelp(info);
  assert.equal((help.match(/data-r-effect-level=/g)||[]).length,80);
  assert.equal((help.match(/data-r-upgrade-detail="facility:/g)||[]).length,4);
  assert.equal((help.match(/data-r-upgrade-detail="training:/g)||[]).length,4);
  for(const value of ['加工基础耗时 −75%','取料基础耗时 −75%','小鱼干收入 +135%','舒适收益 +30%','小馆 Lv.50','行走与取料速度 +135%','体力上限 +135%','耗能系数 −90%','加工速度 +117%','7 金鱼干'])assert.ok(help.includes(value),value);
  assert.doesNotMatch(help,/data-r-action=/);
  for(const id of ['speed','stamina','endurance','skill']){
    const card=staffAbilityEffectsMarkup({id,level:1});
    assert.doesNotMatch(card,/data-r-effect-level=|data-r-upgrade-detail=|查看 1–10/);
    assert.match(card,/当前/);assert.match(card,/下一级/);assert.match(card,/Lv\.10 满级/);
    assert.doesNotMatch(card,/data-r-action=/);
    const max=staffAbilityEffectsMarkup({id,level:10});assert.doesNotMatch(max,/ru-next/);
  }
  assert.deepEqual(state,before);
});
