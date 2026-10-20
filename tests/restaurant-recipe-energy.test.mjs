import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { initialRestaurant, restaurantInfo, normalizeRestaurant, validRestaurant, RESTAURANT_RECIPES } from '../src/restaurant.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { KITCHEN_FLOWS, validKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { normalizeStaffTraining, workerStepEnergyCost } from '../src/restaurant-staff-training.js';
import { RESTAURANT_RECIPE_STEP_BASE, recipeStepEnergyBase } from '../src/restaurant-recipe-energy.js';
import { restaurantRecipeMenuOrder } from '../src/restaurant-recipe-order.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { restaurantRecipesPanel } from '../src/restaurant-ui.js';
import { restaurantRecipeDetailMarkup } from '../src/restaurant-recipe-detail.js';
import { kitchenWorkflowBoardMarkup } from '../src/restaurant-kitchen-board.js';

const NOW=Date.parse('2026-10-18T20:00:00Z'),ACTOR={id:'recipe-energy-test',name:'店长'};
function fixture(recipeId,{grade=1,endurance=1,legacy=false,energy=235}={}){
  const restaurant={staff:0,levels:{kitchen:1,fridge:1,tables:1},orders:[],recipeLevels:{[recipeId]:grade},staffTraining:normalizeStaffTraining(null,NOW,0)};
  restaurant.staffTraining['worker-1']={levels:{speed:1,stamina:10,endurance,skill:1},energyBase:200,abilityVersion:2,energy,energyAt:NOW,energyMode:'rest-room',rest:null};
  const order={id:'table-1',recipeId,createdAt:NOW,readyAt:NOW,servedAt:null,recipeLevel:grade,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id,workflow:createInteractiveWorkflow(restaurant,recipeId,NOW,{orderId:'table-1',version:4,...(legacy?{}:{stepEnergyBase:recipeStepEnergyBase(recipeId,grade)})})};
  restaurant.orders.push(order);return {restaurant,order};
}
function apply(r,o,result){assert.equal(result.ok,true,result.reason);o.workflow=result.workflow;o.readyAt=result.workflow.readyAt??o.createdAt;r.staffTraining=result.staffTraining;assert.equal(validKitchenWorkflow(o.workflow,o,r),true);}
const act=(s,a,t)=>{const next=reduceAction(s,a,ACTOR,t);assert.ok(next,`${a.type} accepted`);return next;};

test('all menu recipes have gentle monotonic stage costs and a maximum two-point quality bonus',()=>{
  const menu=restaurantRecipeMenuOrder([...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES]);
  assert.deepEqual(Object.keys(RESTAURANT_RECIPE_STEP_BASE).sort(),menu.map(recipe=>recipe.id).sort());
  let previous=0;
  for(const recipe of menu){
    const starter=recipeStepEnergyBase(recipe.id,1);assert.ok(starter>=previous);previous=starter;
    assert.ok(starter>=10&&starter<=13);
    assert.deepEqual(Array.from({length:5},(_,i)=>recipeStepEnergyBase(recipe.id,i+1)),[starter,starter+.5,starter+1,starter+1.5,starter+2]);
    for(let grade=1;grade<=5;grade++)for(let endurance=1;endurance<=10;endurance++){
      const cost=workerStepEnergyCost({endurance},recipeStepEnergyBase(recipe.id,grade));assert.ok(cost>=1&&cost<=15);
    }
  }
  assert.equal(recipeStepEnergyBase('unknown'),null);assert.equal(recipeStepEnergyBase('rice',6),null);
});

for(const grade of [1,5])for(const endurance of [1,10])test(`all detailed recipes charge their snapshotted grade ${grade} cost with endurance ${endurance}`,()=>{
  for(const recipeId of Object.keys(KITCHEN_FLOWS)){
    const {restaurant:r,order:o}=fixture(recipeId,{grade,endurance}),base=recipeStepEnergyBase(recipeId,grade),cost=workerStepEnergyCost({endurance},base);
    assert.equal(o.workflow.stepEnergyBase,base);apply(r,o,acceptInteractiveWorkflow(r,o,NOW));let now=NOW;
    for(const stepId of [...KITCHEN_FLOWS[recipeId].map(step=>step.id),'delivery']){
      apply(r,o,advanceInteractiveWorkflow(r,o,stepId,now));const run=o.workflow.runs.at(-1);
      assert.equal(run.energyCost,cost);assert.equal(run.energyAfter,Math.max(0,run.energyBefore-cost));
      now=run.rest?.fullAt??run.endAt;
    }
  }
});

test('recipe research during an order cannot change its energy base, and employee endurance applies only to later clicks',()=>{
  const {restaurant:r,order:o}=fixture('pancake');apply(r,o,acceptInteractiveWorkflow(r,o,NOW));apply(r,o,advanceInteractiveWorkflow(r,o,'gather',NOW));
  const first=structuredClone(o.workflow.runs[0]);r.recipeLevels.pancake=5;r.staffTraining['worker-1'].levels.endurance=10;
  apply(r,o,advanceInteractiveWorkflow(r,o,KITCHEN_FLOWS.pancake[1].id,first.endAt));
  assert.equal(o.workflow.stepEnergyBase,11);assert.deepEqual(o.workflow.runs[0],first);assert.equal(o.workflow.runs[1].energyCost,2);
});

test('older workflows without the energy snapshot retain their flat ten-point policy and exact saved runs',()=>{
  const {restaurant:r,order:o}=fixture('burger',{grade:5,legacy:true});apply(r,o,acceptInteractiveWorkflow(r,o,NOW));apply(r,o,advanceInteractiveWorkflow(r,o,'gather',NOW));
  const old=JSON.parse(JSON.stringify(o.workflow)),first=o.workflow.runs[0];assert.equal(first.energyCost,10);assert.equal(Object.hasOwn(old,'stepEnergyBase'),false);
  apply(r,o,advanceInteractiveWorkflow(r,o,KITCHEN_FLOWS.burger[1].id,first.endAt));assert.deepEqual(o.workflow.runs[0],old.runs[0]);assert.equal(o.workflow.runs[1].energyCost,10);
});

test('forged recipe, grade, energy base or recorded charges fail validation without erasing a legitimate snapshot',()=>{
  const {restaurant:r,order:o}=fixture('burger',{grade:5});apply(r,o,acceptInteractiveWorkflow(r,o,NOW));apply(r,o,advanceInteractiveWorkflow(r,o,'gather',NOW));
  for(const value of [9,10,12,14.5,15,16,NaN]){const changed=structuredClone(o.workflow);changed.stepEnergyBase=value;assert.equal(validKitchenWorkflow(changed,o,r),false,`${value} is not the grade-specific base`);}
  const changed=structuredClone(o.workflow);changed.runs[0].energyCost--;assert.equal(validKitchenWorkflow(changed,o,r),false);
  assert.equal(validKitchenWorkflow(o.workflow,o,r),true);
});

test('normal arrivals snapshot their grade cost; save/reload and later research keep that snapshot valid',()=>{
  let state=initialState(NOW);state.restaurant=initialRestaurant(NOW);state.restaurant.stats.experience=levelStartXp(50);state.restaurant.recipeLevels.pancake=5;
  state=act(state,{type:'restaurant-arrive',partySize:1,recipeId:'pancake'},NOW);
  const order=state.restaurant.orders[0],at=order.createdAt;assert.equal(order.workflow.stepEnergyBase,13);
  state=act(state,{type:'restaurant-kitchen-accept',orderId:order.id},at);state=act(state,{type:'restaurant-kitchen-step',orderId:order.id,stepId:'gather'},at);
  assert.equal(state.restaurant.orders[0].workflow.runs[0].energyCost,13);assert.ok(validRestaurant(state.restaurant));
  const reload=normalizeRestaurant(JSON.parse(JSON.stringify(state.restaurant)),at+1000);assert.deepEqual(reload.orders,state.restaurant.orders);
  const info=restaurantInfo(state,at+1000);assert.doesNotMatch(restaurantRecipesPanel(info),/每步基准|每步基础/);assert.match(restaurantRecipeDetailMarkup(info,'pancake'),/每步基础 13 体力/);assert.match(kitchenWorkflowBoardMarkup(info),/每步基准 13 体力/);
});

test('higher costs still finish an exhausting operation, preserve its slow route and wait for full room recovery',()=>{
  const {restaurant:r,order:o}=fixture('burger',{grade:5,energy:5});apply(r,o,acceptInteractiveWorkflow(r,o,NOW));apply(r,o,advanceInteractiveWorkflow(r,o,'gather',NOW));
  const run=o.workflow.runs[0];assert.equal(run.energyCost,14);assert.equal(run.energyAfter,0);assert.equal(run.durationMultiplier,5);assert.ok(run.rest);
  const before=JSON.stringify(r);assert.equal(advanceInteractiveWorkflow(r,o,KITCHEN_FLOWS.burger[1].id,run.rest.fullAt-1).ok,false);assert.equal(JSON.stringify(r),before);
  apply(r,o,advanceInteractiveWorkflow(r,o,KITCHEN_FLOWS.burger[1].id,run.rest.fullAt));assert.equal(o.workflow.runs[1].energyCost,14);
});
