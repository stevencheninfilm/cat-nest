import { restaurantResearchBatchResult, restaurantResearchBatchMarkup } from './restaurant-research-batch-ui.js';
import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { restaurantGradeGuide, restaurantQualityFood, restaurantQualityAttributes } from './restaurant-order-tiers-ui.js';
import { restaurantDishGrade, restaurantInspirationRange, restaurantResearchPool, restaurantFragmentSurplus } from './restaurant-research.js';
import { restaurantRecipeMenuOrder } from './restaurant-recipe-order.js';
import { restaurantResearchHero } from './restaurant-research-hero.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const food=id=>`<span class="r-food r-food-${esc(id)}" aria-hidden="true"></span>`;

export function restaurantResearchButton(recipe){
  if(!recipe.unlocked)return '';
  const max=recipe.upgradeCost===null,ready=!max&&recipe.fragments>=recipe.upgradeCost,locked=!max&&!recipe.researchUnlocked;
  return `<button class="r-research ${ready&&!locked?'is-ready':''}" data-r-action="recipe" data-r-recipe="${recipe.id}" ${restaurantLockedAttributes(locked)} aria-label="${esc(recipe.name)}，${max?'已达 SSS':locked?`小馆 ${recipe.researchUnlockLevel} 级可研发`:`${recipe.fragments} / ${recipe.upgradeCost} 碎片，研发至 ${restaurantDishGrade(recipe.level+1)}`}" ${max||locked||!ready?'disabled':''}>${locked?restaurantLockIcon():''}${max?'SSS 已满阶':locked?`Lv.${recipe.researchUnlockLevel} 研发`:`碎片 ${recipe.fragments} / ${recipe.upgradeCost}${ready?' · 升阶':''}`}</button>`;
}

export function restaurantResearchPanel(info,{showcase,pendingDraw=null,pendingCount=1}={}){
  const research=info.research,card=research.lastDraw,recipe=card&&info.recipes.find(recipe=>recipe.id===card.recipeId);
  const batch=restaurantResearchBatchResult(info,research.lastBatch?.startDraw);
  const recipes=restaurantRecipeMenuOrder(info.recipes.filter(recipe=>recipe.unlocked));
  return `<section class="rr-research" aria-label="菜谱研发室">${restaurantGradeGuide()}${restaurantResearchHero(info,showcase,{pendingDraw,pendingCount})}${batch?`<div class="rr-batch-ledger">${restaurantResearchBatchMarkup(batch)}</div>`:recipe?`<div class="rr-draw-result" role="status" aria-live="polite" data-r-draw-result="${card.draw}">${food(recipe.id)}<span><small>第 ${card.draw} 次灵感 · 已收下</small><strong>${esc(recipe.name)}</strong><em>菜谱碎片 +${card.amount}</em></span><b>✦</b></div>`:'<p class="rr-intro-note">首次必得蛋包饭碎片 ×3；之后随机，每第 10 次必得 5 枚。抽到重复菜谱会继续累计。</p>'}${restaurantInspirationRules()}<details class="rr-odds"><summary>碎片规则与概率</summary><p>普通抽取：1 枚 60% · 2 枚 25% · 3 枚 12% · 5 枚 3%。第 10、20…次固定 5 枚。菜品解锁越晚，碎片越稀有。已解锁菜谱均参与抽取，包含 SSS 满级菜谱；满级重复碎片可融合回灵感。</p><p>升阶依次需要 3、6、10、15 枚对应碎片，并满足小馆等级。现有研发等级保留；新研发只消耗碎片。</p>${restaurantFragmentOdds(info)}</details>${restaurantFusionSummary(info)}<div class="rr-collection-heading"><h3>碎片手账</h3><span>${recipes.filter(recipe=>recipe.level===5).length} / ${recipes.length} 达到 SSS</span></div><div class="rr-fragment-grid">${recipes.map(recipe=>restaurantFragmentCard(recipe,research)).join('')}</div><button class="rr-back-menu" data-r-tab="recipes">返回全部菜谱 →</button></section>`;
}

export function restaurantInspirationRules(){
  return `<details class="rr-inspiration-rules"><summary>顾客的灵感赠礼<span>品质越高，灵感越丰厚</span></summary><p>猫猫吃完后会随机赠送灵感，和本餐一起结账收下。普通顾客 75% · 银级 85% · 金级 95%。</p><table><caption>每餐可能获得的灵感</caption><thead><tr><th>菜品品质</th><th>普通</th><th>银级</th><th>金级</th></tr></thead><tbody>${['B','A','S','SS','SSS'].map((grade,index)=>`<tr><th>${grade}</th>${['ordinary','silver','gold'].map(tier=>{const range=restaurantInspirationRange(tier,index+1);return `<td>${range.min}–${range.max}</td>`;}).join('')}</tr>`).join('')}</tbody></table><p>按本餐实际菜品品质计算，银级与金级猫友另有灵感加成；每一轮品尝独立获得赠礼。</p></details>`;
}

export function restaurantFragmentCard(recipe,research){
  const fragment=recipe.fragmentResearch??{...restaurantFragmentSurplus(recipe),chance:0},{reserve,surplus,fusionValue,convertible=surplus,credit=convertible*fusionValue}=fragment;
  return `<article class="rr-fragment-card rr-quality-card" ${restaurantQualityAttributes(recipe.grade)} data-r-research-recipe="${recipe.id}" ${restaurantLockedAttributes(recipe.upgradeCost!==null&&!recipe.researchUnlocked)}>${restaurantQualityFood(recipe.id,recipe.grade,food)}<h4>${esc(recipe.name)}</h4><small>${recipe.grade} → ${recipe.level===5?'已满阶':restaurantDishGrade(recipe.level+1)}</small><span class="rr-fragment-rarity" data-r-fragment-rarity="${fragment.tier}">${fragment.name} · ${((fragment.chance??0)*100).toFixed(2)}%</span><div class="rr-fragment-progress"><i style="width:${recipe.upgradeCost===null?100:Math.min(100,recipe.fragments/recipe.upgradeCost*100)}%"></i></div>${restaurantResearchButton(recipe)}<small class="rr-fusion-rate">1 枚 → ${fusionValue} 灵感</small>${surplus?`<button class="rr-fuse" data-r-action="research-fuse" data-r-recipe="${recipe.id}" data-r-fuse-amount="${convertible}" data-r-fuse-fragments="${recipe.fragments}" data-r-fuse-revision="${research.fusionRevision}" aria-label="融合${esc(recipe.name)}多余碎片 ${convertible} 枚，获得 ${credit} 灵感" ${convertible?'':'disabled'}>融合 ${convertible} 枚<span>+${credit} 灵感</span></button>`:`<span class="rr-fusion-reserve">${reserve?recipe.fragments>=reserve?'升满所需已备齐':`升满还需 ${reserve-recipe.fragments} 枚`:'暂无多余碎片'}</span>`}</article>`;
}

export function restaurantFragmentOdds(info){
  const pool=restaurantResearchPool(restaurantRecipeMenuOrder(info.recipes));
  return `<table class="rr-fragment-odds"><caption>当前已解锁卡池 · 菜品概率 / 每枚融合价值</caption><thead><tr><th>菜谱 · 难度</th><th>抽取概率</th><th>融合灵感</th></tr></thead><tbody>${pool.map(item=>`<tr><th>${esc(item.recipe.name)}<small>${item.name}</small></th><td>${(item.chance*100).toFixed(2)}%</td><td>+${item.fusionValue}</td></tr>`).join('')}</tbody></table><p>首次探索优先赠蛋包饭 ×3。上表为之后每抽的菜谱概率，随新菜谱解锁重新分配；菜品品质不改变碎片难度。</p>`;
}

export function restaurantFusionSummary(info){
  const last=info.research.lastFusion,recipe=last&&info.recipes.find(recipe=>recipe.id===last.recipeId);
  return `<section class="rr-fusion-summary" aria-label="碎片融合规则"><strong>让多余的灵感，再次发光</strong><p>自动保留升至 SSS 还需要的碎片，只融合多余部分。越难获得的碎片，兑换灵感越多：家常 1 · 精选 2 · 珍味 3 · 典藏 4 · 传说 5。</p>${recipe?`<div class="rr-fusion-receipt" role="status">已融合 ${esc(recipe.name)} ×${last.amount}<b>灵感 +${last.inspiration}</b></div>`:''}</section>`;
}
