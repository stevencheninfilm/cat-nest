import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { KITCHEN_FOOD_PROPS, kitchenPropUrl } from '../src/restaurant-kitchen-assets.js';
import { restaurantRecipeDetailModel, restaurantRecipeDetailMarkup } from '../src/restaurant-recipe-detail.js';
import { restaurantRecipesPanel, restaurantMarkup } from '../src/restaurant-ui.js';

const NOW=Date.parse('2026-10-19T12:00:00Z');
const catalog=info=>[...new Map([...info.recipes,...info.specialRecipes].map(recipe=>[recipe.id,recipe])).values()];

test('all twenty-one recipe details render without mutating the save and retain the actual flow and research controls',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),before=structuredClone(info);
  for(const recipe of catalog(info)){
    const detail=restaurantRecipeDetailModel(info,recipe.id),flow=KITCHEN_FLOWS[recipe.id];
    assert.equal(detail.recipe.name,recipe.name);
    assert.deepEqual(detail.steps.map(step=>step.id),[...(flow?.map(step=>step.id)||['cook']),'delivery']);
    if(flow)assert.deepEqual(detail.steps.slice(0,-1).map(step=>step.prop),flow.map(step=>step.prop));
    else assert.equal(detail.manual,false,'legacy automatic dishes must not invent manual stations');
    const html=restaurantRecipeDetailMarkup(info,recipe.id);
    assert.equal((html.match(/data-r-recipe-step=/g)||[]).length,detail.steps.length);
    assert.match(html,/菜品详情/);assert.match(html,/制作工序/);assert.match(html,/售价/);assert.match(html,/成长/);
    assert.doesNotMatch(html,/<time|秒|分钟|duration|data-r-action="(?:start|unlock-special)"/);
    if(!detail.locked)assert.match(html,/data-r-action="recipe"/);
    else assert.doesNotMatch(html,/data-r-action="recipe"/);
  }
  assert.deepEqual(info,before);assert.equal(restaurantRecipeDetailModel(info,'unknown'),null);assert.equal(restaurantRecipeDetailMarkup(info,'unknown'),'');
});

test('every process thumbnail points to shipped art and every recipe card has an accessible detail trigger',async()=>{
  const info=restaurantInfo(initialState(NOW),NOW),html=restaurantRecipesPanel(info);
  for(const recipe of catalog(info)){
    assert.match(html,new RegExp(`data-r-recipe-detail="${recipe.id}" aria-haspopup="dialog"`));
    for(const step of restaurantRecipeDetailModel(info,recipe.id).steps){
      if(step.prop===recipe.id||KITCHEN_FOOD_PROPS.includes(step.prop))continue;
      const path=kitchenPropUrl(step.prop).split('/assets/restaurant/')[1];
      await access(new URL(`../public/assets/restaurant/${path}`,import.meta.url));
    }
  }
  assert.equal((html.match(/data-r-recipe-detail=/g)||[]).length,21);
  assert.match(restaurantMarkup(initialState(NOW)),/class="r-recipe-dialog" aria-labelledby="r-recipe-detail-title"/);
});

test('locked recipe details keep lock conditions and never grant access just by previewing',()=>{
  const state=initialState(NOW),info=restaurantInfo(state,NOW);
  assert.match(restaurantRecipeDetailMarkup(info,'gold-salmon'),/data-r-locked="true"/);
  state.restaurant.stats.experience=levelStartXp(50);
  const eligible=restaurantInfo(state,NOW),preview=restaurantRecipeDetailMarkup(eligible,'gold-salmon');
  assert.match(preview,/使用金鱼干解锁后开售/);assert.equal(restaurantRecipeDetailModel(eligible,'gold-salmon').locked,true);
  assert.equal(restaurantRecipeDetailModel(eligible,'sushi').locked,true);
  state.restaurant.ownedSpecialRecipes=['gold-salmon'];state.restaurant.recipeLevels['gold-salmon']=1;
  const acquired=restaurantInfo(state,NOW),detail=restaurantRecipeDetailModel(acquired,'gold-salmon');
  assert.equal(detail.locked,false);assert.equal(detail.collected.filter(recipe=>recipe.id==='gold-salmon').length,1);
});

test('details display saved dish quality and current facility rewards without changing any orders',()=>{
  const state=initialState(NOW);state.restaurant.recipeLevels.rice=5;state.restaurant.levels.tips=3;
  const info=restaurantInfo(state,NOW),before=structuredClone(info),detail=restaurantRecipeDetailModel(info,'rice');
  assert.equal(detail.experience,14);assert.equal(detail.price,69);
  const html=restaurantRecipeDetailMarkup(info,'rice');
  assert.match(html,/aria-label="菜品品质 SSS"/);assert.match(html,/>69<small>小鱼干/);assert.match(html,/\+14<small>经验/);
  assert.deepEqual(info,before);
});

test('recipe cards lead with food and sale price while fragment promotion lives in the dish detail',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),menu=restaurantRecipesPanel(info);
  assert.doesNotMatch(menu,/级料理|道工序|逐步点击|每步基准|成长 \+|data-r-action="recipe"/);
  assert.equal((menu.match(/class="r-recipe-sale"/g)||[]).length,21);
  assert.equal((menu.match(/<small>售价<\/small>/g)||[]).length,21);
  const detail=restaurantRecipeDetailMarkup(info,'rice');
  assert.match(detail,/aria-label="菜品品质研发"/);assert.match(detail,/碎片 0 \/ 3/);
  assert.match(detail,/每步基础 10 体力/);
});

test('promoting from the dish detail consumes the original shards and refreshes the saved grade',()=>{
  const actor={id:'recipe-detail-test',name:'店长'},drawn=reduceAction(initialState(NOW),{type:'restaurant-research-draw',draw:1},actor,NOW);
  const before=structuredClone(drawn),ready=restaurantRecipeDetailMarkup(restaurantInfo(drawn,NOW),'rice');
  assert.match(ready,/r-research is-ready/);assert.match(ready,/碎片 3 \/ 3 · 升阶/);
  const promoted=reduceAction(drawn,{type:'restaurant-recipe',recipeId:'rice'},actor,NOW+1);
  assert.ok(promoted);assert.equal(promoted.restaurant.recipeLevels.rice,2);assert.equal(promoted.restaurant.research.fragments.rice,0);
  assert.equal(promoted.coins,drawn.coins);assert.equal(promoted.xp,drawn.xp);assert.deepEqual(promoted.restaurant.orders,drawn.restaurant.orders);
  const updated=restaurantRecipeDetailMarkup(restaurantInfo(promoted,NOW+1),'rice');
  assert.match(updated,/aria-label="菜品品质 A"/);assert.match(updated,/data-r-grade="A" class="is-earned" aria-current="step"/);
  assert.deepEqual(drawn,before);
});
