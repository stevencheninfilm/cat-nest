import { restaurantDishGrade } from './restaurant-research.js';
import { restaurantQualityAttributes, restaurantQualityFood } from './restaurant-order-tiers-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const food=id=>`<span class="r-food r-food-${esc(id)}" aria-hidden="true"></span>`;

export function restaurantResearchBatchResult(info,draw){
  const batch=info.research.lastBatch;
  if(!batch||batch.startDraw!==draw||batch.cards.length!==10)return null;
  const cards=batch.cards.map(card=>{
    const recipe=info.recipes.find(recipe=>recipe.id===card.recipeId);
    return recipe?{card:{...card},recipe:{...recipe},grade:restaurantDishGrade(recipe.level)}:null;
  });
  if(cards.some(card=>!card))return null;
  return {...cards.at(-1),cards,total:cards.reduce((sum,result)=>sum+result.card.amount,0)};
}

/** All fronts come from one accepted receipt. CSS staggers the ten flips;
 * closing early, reduced motion, or a missed animation event cannot lose them. */
export function restaurantResearchBatchMarkup(result,{animated=false}={}){
  return `<section class="rr-batch-results ${animated?'is-animated':''}" aria-label="十连探索结果"><header><strong>十份灵感，一起揭晓</strong><p>第 ${result.cards[0].card.draw}–${result.card.draw} 次探索 · 菜谱碎片共 ${result.total} 枚</p></header><ol class="rr-batch-grid">${result.cards.map(({card,recipe,grade},index)=>`<li class="rr-batch-card rr-quality-card" ${restaurantQualityAttributes(grade)} style="--batch-index:${index}" data-rr-batch-draw="${card.draw}"><div class="rr-batch-flipper"><div class="rr-batch-back" aria-hidden="true"><small>RECIPE ATELIER</small><b>✦</b><span>美味灵感 ${index+1}</span></div><div class="rr-batch-front"><small>${String(index+1).padStart(2,'0')} · ${grade}</small>${restaurantQualityFood(recipe.id,grade,food)}<strong>${esc(recipe.name)}</strong><span>菜谱碎片 <b>×${card.amount}</b></span></div></div></li>`).join('')}</ol></section>`;
}
