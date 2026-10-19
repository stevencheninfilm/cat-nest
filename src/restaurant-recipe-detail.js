import { KITCHEN_FLOWS } from './restaurant-kitchen.js';
import { KITCHEN_RECIPE_DETAILS, kitchenShortStep } from './restaurant-kitchen-recipes-ui.js';
import { kitchenPropUrl, KITCHEN_FOOD_PROPS } from './restaurant-kitchen-assets.js';
import { restaurantQualityFood } from './restaurant-order-tiers-ui.js';
import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { restaurantTipsMultiplier, restaurantTableIncomeMultiplier } from './restaurant-facilities.js';
import { restaurantRecipeMenuOrder } from './restaurant-recipe-order.js';
import { restaurantResearchButton } from './restaurant-research-ui.js';
import { RESTAURANT_DISH_GRADES, restaurantDishGrade } from './restaurant-research.js';
import { recipeStepEnergyBase } from './restaurant-recipe-energy.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const food=id=>`<span class="r-food r-food-${esc(id)}" aria-hidden="true"></span>`;
const catalog=info=>restaurantRecipeMenuOrder([...new Map([...info.recipes,...info.specialRecipes].map(recipe=>[recipe.id,recipe])).values()]);
const owned=recipe=>recipe.unlocked&&(!recipe.special||recipe.owned);

export const restaurantRecipePreview=recipe=>`<button class="r-recipe-preview" data-r-recipe-detail="${esc(recipe.id)}" aria-haspopup="dialog" aria-label="查看${esc(recipe.name)}的菜品详情">${restaurantQualityFood(recipe.id,recipe.grade,food)}<h3>${esc(recipe.name)}</h3></button>`;

/** Read the real manual flow. Legacy automatic dishes retain their single
 * cooking phase instead of pretending they already have manual stations. */
export function restaurantRecipeDetailModel(info,recipeId){
  const recipes=catalog(info),recipe=recipes.find(item=>item.id===recipeId);
  if(!recipe)return null;
  const flow=KITCHEN_FLOWS[recipe.id],level=recipe.level??1;
  const steps=flow?flow.map(step=>({id:step.id,name:kitchenShortStep(step.id),label:step.label,prop:step.prop}))
    :[{id:'cook',name:'制作料理',label:`制作${recipe.name}`,prop:recipe.id}];
  steps.push({id:'delivery',name:'端到餐桌',label:'把完成的料理送到顾客桌上',prop:recipe.id});
  return {recipe,steps,manual:Boolean(flow),locked:!owned(recipe),
    ingredients:KITCHEN_RECIPE_DETAILS[recipe.id]?.ingredients||'',
    price:Math.round(recipe.price*(1+.3*(level-1))*restaurantTipsMultiplier(info.restaurant.levels.tips)*restaurantTableIncomeMultiplier(info.restaurant.levels.tables)),
    experience:recipe.xp+2*(level-1),stepEnergy:flow?recipeStepEnergyBase(recipe.id,level):null,collected:recipes.filter(owned)};
}

function researchMarkup({recipe,locked}){
  const level=recipe.level??1,max=level===5,cost=recipe.upgradeCost??0;
  return `<section class="r-recipe-detail-research" aria-label="菜品品质研发"><div class="r-recipe-detail-section-title"><h3>品质研发</h3><span>${max?'已满阶':`${recipe.grade??'B'} → ${restaurantDishGrade(level+1)}`}</span></div><ol class="r-recipe-quality-track" aria-label="菜品品质由低到高">${RESTAURANT_DISH_GRADES.map((grade,index)=>`<li data-r-grade="${grade}" class="${index+1<=level?'is-earned':''}"${index+1===level?' aria-current="step"':''}>${grade}</li>`).join('')}</ol>${locked?'<p class="r-recipe-research-locked">解锁菜品后可收集碎片升阶</p>':`${!max?`<div class="r-recipe-fragment-track" role="progressbar" aria-label="${esc(recipe.name)}的升阶碎片" aria-valuemin="0" aria-valuemax="${cost}" aria-valuenow="${Math.min(cost,recipe.fragments??0)}"><i style="width:${cost?Math.min(100,(recipe.fragments??0)/cost*100):0}%"></i></div>`:''}${restaurantResearchButton(recipe)}`}</section>`;
}

export function restaurantRecipeDetailMarkup(info,recipeId){
  const detail=restaurantRecipeDetailModel(info,recipeId);if(!detail)return '';
  const {recipe,steps,manual,locked,ingredients,price,experience,stepEnergy,collected}=detail;
  const prop=step=>step.prop===recipe.id||KITCHEN_FOOD_PROPS.includes(step.prop)?food(step.prop):`<img src="${esc(kitchenPropUrl(step.prop))}" alt="" loading="lazy" draggable="false"/>`;
  return `<header><h2 id="r-recipe-detail-title">菜品详情</h2><button class="r-round" data-r-recipe-detail-close aria-label="关闭菜品详情"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
    <div class="r-recipe-detail-content">
      <section class="r-recipe-detail-hero" ${restaurantLockedAttributes(locked)} aria-label="${esc(recipe.name)}的基本信息">
        <div class="r-recipe-detail-art">${restaurantQualityFood(recipe.id,recipe.grade,food)}</div>
        <div class="r-recipe-detail-copy"><span class="r-recipe-detail-category">${esc(recipe.category)}${recipe.special?' · 金色招牌':''}</span><h3>${esc(recipe.name)}</h3><span class="r-recipe-detail-quality" aria-label="菜品品质 ${esc(recipe.grade??'B')}">${esc(recipe.grade??'B')}</span><dl><div><dt>售价</dt><dd>${price}<small>小鱼干</small></dd></div><div><dt>成长</dt><dd>+${experience}<small>经验</small></dd></div></dl></div>
        ${locked?`<p class="r-recipe-detail-lock">${restaurantLockIcon()}${info.level<recipe.unlockLevel?`Lv.${recipe.unlockLevel} 解锁`:recipe.special?'使用金鱼干解锁后开售':'尚未解锁'}</p>`:''}
      </section>
      ${researchMarkup(detail)}
      ${ingredients?`<p class="r-recipe-detail-ingredients"><strong>食材</strong><span>${esc(ingredients)}</span></p>`:''}
      <section class="r-recipe-detail-process" aria-label="制作工序" ${restaurantLockedAttributes(locked)}><div class="r-recipe-detail-section-title"><h3>制作工序</h3><span>${manual?`${steps.length} 个步骤`:'自动制作'}</span></div>${stepEnergy===null?'':`<p class="r-recipe-detail-energy">每步基础 ${stepEnergy} 体力 · 耐力升级可降低消耗</p>`}<ol>${steps.map((step,index)=>`<li data-r-recipe-step="${esc(step.id)}" title="${esc(step.label)}"><span class="r-recipe-step-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div class="r-recipe-step-art">${prop(step)}</div><strong>${esc(step.name)}</strong></li>`).join('')}</ol></section>
      ${collected.length>1?`<nav class="r-recipe-detail-related" aria-label="切换已收录料理"><div class="r-recipe-detail-section-title"><h3>已收录料理</h3><span>${collected.length} 道</span></div><div>${collected.map(item=>`<button data-r-recipe-detail="${esc(item.id)}" aria-label="查看${esc(item.name)}的菜品详情" aria-pressed="${item.id===recipe.id}">${food(item.id)}</button>`).join('')}</div></nav>`:''}
    </div>`;
}
