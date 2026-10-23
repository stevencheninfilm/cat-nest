import { restaurantDishGrade, RESTAURANT_DISH_GRADES } from './restaurant-research.js';
import { restaurantQualityAttributes } from './restaurant-order-tiers-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gradeNames={B:'家常风味',A:'清新佳作',S:'金辉珍馔',SS:'皇家珍藏',SSS:'鎏金臻品'};
const price=(recipe,level)=>Math.round(recipe.price*(1+.3*(level-1)));

/** Compare saved levels, not submitted clicks: cloud rejection, loading a save,
 * and opening the restaurant must never announce a promotion. */
export function restaurantRecipePromotions(previous,recipes){
  if(!previous)return [];
  return recipes.filter(recipe=>Number.isSafeInteger(previous[recipe.id])&&recipe.level>previous[recipe.id]&&recipe.level<=5).map(recipe=>({recipe,from:previous[recipe.id],to:recipe.level}));
}
/** Shared central crop of the quality celebration: dish, platter and chefs.
 * The containing quality card supplies the material for its saved grade. */
export function restaurantRecipeStageMarkup(recipe){
  return `<div class="rr-promotion-stage"><div class="rr-promotion-rays" aria-hidden="true"></div><span class="rr-promotion-spark rr-spark-one" aria-hidden="true">✦</span><span class="rr-promotion-spark rr-spark-two" aria-hidden="true">✧</span><span class="rr-promotion-spark rr-spark-three" aria-hidden="true">✦</span><div class="rr-promotion-platter"><span class="r-food r-food-${esc(recipe.id)}" aria-hidden="true"></span></div><span class="r-cat r-cat-chef rr-promotion-chef" aria-hidden="true"></span><span class="r-cat r-cat-waiter rr-promotion-waiter" aria-hidden="true"></span><span class="rr-promotion-laurel" aria-hidden="true">❧</span></div>`;
}

export function restaurantRecipeCelebrationMarkup({recipe,from,to},{preview=false}={}){
  const grade=restaurantDishGrade(to),oldGrade=restaurantDishGrade(from);
  return `<button class="rr-promotion-close" data-r-celebration-close aria-label="关闭菜品升阶庆典">×</button><div class="rr-promotion-heading"><span class="rr-promotion-grade">${grade}</span><div><small>${preview?'品质庆典预览':'RECIPE UPGRADED'}</small><h2 id="rr-promotion-title">${preview?'品质展示':'菜品升阶成功！'}</h2><p>${gradeNames[grade]} · ${grade} 级料理</p></div></div>${restaurantRecipeStageMarkup(recipe)}<div class="rr-promotion-name"><span>✦</span><h3>${esc(recipe.name)}</h3><span>✦</span></div><div class="rr-promotion-path"><span>${oldGrade}</span><i aria-hidden="true">→</i><strong>${grade}</strong></div><div class="rr-promotion-rewards"><div><small>菜品基础售价</small><span>${price(recipe,from)} <i>→</i> <b>${price(recipe,to)}</b><em>小鱼干</em></span></div><div><small>每份基础成长</small><span>${recipe.xp+2*(from-1)} <i>→</i> <b>${recipe.xp+2*(to-1)}</b><em>经验</em></span></div></div><p class="rr-promotion-note">${preview?'仅展示品质效果，不改变菜谱等级。':'新的品质，将从下一份订单开始生效。'}</p><button class="rr-promotion-confirm" data-r-celebration-close>${preview?'收好这份期待':'太棒了，继续研发'}</button><div class="rr-confetti" aria-hidden="true">${Array.from({length:34},(_,index)=>`<i style="--party-x:${index%2?94:6}%;--party-dx:${(index%2?-1:1)*(30+(index*47)%240)}px;--party-dy:${-150-(index*31)%290}px;--party-turn:${240+index*33}deg;--party-delay:${index%7*45}ms;--party-color:${['#e8c56b','#d88e9c','#91c6b5','#c1acd9','#f7e6ad'][index%5]}"></i>`).join('')}<span class="rr-party-left">🎉</span><span class="rr-party-right">🎉</span></div>`;
}

export function restaurantResearchTestControls(enabled){
  return enabled?`<details class="rr-terminal-preview"><summary>研发动画预览<span>只看效果</span></summary><small>菜品升阶</small><div>${RESTAURANT_DISH_GRADES.map(grade=>`<button data-r-preview-grade="${grade}" ${restaurantQualityAttributes(grade)} aria-label="预览 ${grade} 级菜品庆典">${grade}</button>`).join('')}</div><small>灵感翻牌</small><div>${RESTAURANT_DISH_GRADES.map(grade=>`<button data-r-preview-reveal="${grade}" ${restaurantQualityAttributes(grade)} aria-label="预览 ${grade} 级灵感翻牌">${grade}</button>`).join('')}</div><button class="rr-terminal-fusion-test" data-r-debug-research-batch>准备十连探索测试 →</button><button class="rr-terminal-fusion-test" data-r-debug-research-fusion>准备碎片融合测试 →</button></details>`:'';
}

export function createRestaurantRecipeCelebration({dialog}){
  let previous=null,restoreFocus=null;
  const queue=[];
  function show(gain,preview=false){
    if(dialog.open){queue.push({gain,preview});return;}
    restoreFocus=document.activeElement;
    dialog.dataset.rQuality=restaurantDishGrade(gain.to);
    dialog.innerHTML=restaurantRecipeCelebrationMarkup(gain,{preview});
    dialog.showModal();dialog.querySelector('.rr-promotion-confirm').focus({preventScroll:true});
  }
  function closed(){
    dialog.innerHTML='';
    if(queue.length){const next=queue.shift();show(next.gain,next.preview);return;}
    if(restoreFocus?.isConnected&&!restoreFocus.disabled)restoreFocus.focus({preventScroll:true});
    restoreFocus=null;
  }
  function click(event){if(event.target.closest('[data-r-celebration-close]'))dialog.close();}
  function cancel(event){event.preventDefault();event.stopPropagation();dialog.close();}
  dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);
  return {
    sync(info){const gains=restaurantRecipePromotions(previous,info.recipes);previous=Object.fromEntries(info.recipes.map(recipe=>[recipe.id,recipe.level]));for(const gain of gains)show(gain);},
    preview(grade,info){if(!RESTAURANT_DISH_GRADES.includes(grade))return;const level=RESTAURANT_DISH_GRADES.indexOf(grade)+1,recipe=info.recipes.find(recipe=>recipe.id==='rice');if(recipe)show({recipe,from:Math.max(1,level-1),to:level},true);},
    reset(){previous=null;queue.length=0;restoreFocus=null;if(dialog.open)dialog.close();},
    destroy(){queue.length=0;if(dialog.open)dialog.close();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);previous=null;},
  };
}
