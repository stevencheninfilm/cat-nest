import { RESTAURANT_DISH_GRADES } from './restaurant-research.js';
import { restaurantQualityFood, restaurantQualityAttributes } from './restaurant-order-tiers-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const food=id=>`<span class="r-food r-food-${esc(id)}" aria-hidden="true"></span>`;
const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/research-v2/${file}`,globalThis.document?.baseURI||import.meta.url).href;
let session=0;

/** Decorative previews are separate from the authoritative draw pool. Choose
 * once per visit, never during polling or saving. No player state is mutated. */
export function createRestaurantResearchShowcase(info,{random=Math.random}={}){
  const catalog=[...new Map([...info.recipes,...(info.specialRecipes??[])].map(recipe=>[recipe.id,recipe])).values()];
  const choices=[...catalog];
  for(let i=choices.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[choices[i],choices[j]]=[choices[j],choices[i]];}
  const cards=RESTAURANT_DISH_GRADES.map((grade,index)=>({grade,recipe:choices[index%Math.max(1,choices.length)]})).filter(card=>card.recipe);
  return {key:`atelier-${++session}`,cards,dishes:choices.slice(0,10),rotation:36+Math.floor(random()*5)*72};
}

function showcaseCard(card,index){
  return `<div class="rr-atelier-card rr-quality-card" ${restaurantQualityAttributes(card.grade)} style="--card-angle:${index*72}deg"><div class="rr-atelier-card-face rr-atelier-card-front"><small>灵感手札</small>${restaurantQualityFood(card.recipe.id,card.grade,food)}<strong>${esc(card.recipe.name)}</strong><span>${card.grade} 级品质</span></div><div class="rr-atelier-card-face rr-atelier-card-back"><small>RECIPE ATELIER</small><span class="rr-card-back-seal">✦</span><b>${card.grade}</b><span>灵感手札</span><i aria-hidden="true">✧ · ✧</i></div></div>`;
}

export function restaurantResearchHero(info,showcase){
  const preview=showcase??createRestaurantResearchShowcase(info,{random:()=>.5}),research=info.research,available=research.availableDraws>0&&info.recipes.some(recipe=>recipe.unlocked);
  const dishes=preview.dishes??preview.cards.map(card=>card.recipe);
  return `<section class="rr-atelier" aria-label="猫猫研发工坊"><div class="rr-showcase" data-r-research-showcase="${esc(preview.key)}"><img class="rr-atelier-art" src="${asset('atelier.jpg')}" alt="暖光下的猫猫研发厨房，围绕中央舞台摆着食材和厨具" draggable="false"/><div class="rr-atelier-shade" aria-hidden="true"></div><header class="rr-atelier-heading"><small>RECIPE ATELIER</small><h3>美味灵感研究所</h3><p>一张手札，一道值得期待的美味</p></header><div class="rr-atelier-foods" aria-hidden="true">${dishes.map((recipe,index)=>`<span class="rr-atelier-dish" style="--food-delay:${-index*.43}s;--dish-shift:${[3,-1,-3,-1,3][index%5]}px">${food(recipe.id)}</span>`).join('')}</div><div class="rr-atelier-carousel" aria-hidden="true"><div class="rr-atelier-turntable" style="--showcase-start:${preview.rotation}deg">${preview.cards.map(showcaseCard).join('')}</div><div class="rr-atelier-pedestal"></div></div><div class="rr-atelier-chefs" aria-hidden="true">${['chef','staff-pudding'].map((sprite,index)=>`<span class="rr-atelier-worker" data-r-atelier-corner="${index?'right':'left'}"><span class="r-cat r-cat-${sprite}"></span>${index?'<i class="rr-atelier-recipe-book"></i>':'<i class="rr-atelier-pan"></i>'}</span>`).join('')}</div><div class="rr-atelier-caption"><span>✦ B–SSS 研发品质预览 ✦</span></div></div><div class="rr-atelier-controls"><div class="rr-research-meter"><span>灵感 <b>${research.inspiration}</b></span><span>可探索 <b>${research.availableDraws}</b> 次</span><i role="progressbar" aria-label="下一次灵感抽卡进度" aria-valuemin="0" aria-valuemax="30" aria-valuenow="${research.progressExperience}"><em style="width:${research.progressExperience/30*100}%"></em></i></div><button class="rr-draw rr-atelier-draw" data-r-action="research-draw" data-r-draw="${research.nextDraw}" ${available?'':'disabled'}><span class="rr-draw-symbol" aria-hidden="true">✦</span><strong>${available?'开启灵感探索':'等待新的灵感'}</strong><span>30 灵感 · 菜谱碎片 ×1 / 2 / 3 / 5</span><i aria-hidden="true">›</i></button><p>顾客品尝后赠送灵感 · 首次探索赠 3 枚蛋包饭碎片</p></div></section>`;
}

export function restaurantResearchShortcut(){
  return `<button class="rr-research-shortcut" data-r-tab="research" aria-label="进入菜谱研发室，探索灵感碎片"><span class="rr-shortcut-glow" aria-hidden="true"></span><span class="rr-shortcut-orbit" aria-hidden="true"></span><span class="rr-shortcut-medal" aria-hidden="true"><span class="rr-shortcut-rays"></span><span class="rr-shortcut-cards"><i></i><i></i><i><span>✦</span></i></span><span class="rr-shortcut-sheen"></span></span><span class="rr-shortcut-count" data-r-research-count hidden></span><strong>研 发</strong><small class="rr-shortcut-caption">灵感探索</small><span class="rr-shortcut-spark rr-shortcut-spark-one" aria-hidden="true">✦</span><span class="rr-shortcut-spark rr-shortcut-spark-two" aria-hidden="true">✧</span></button>`;
}
