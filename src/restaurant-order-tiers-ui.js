import { RESTAURANT_DISH_GRADES, restaurantDishGrade } from './restaurant-research.js';
import { RESTAURANT_DISH_ORDER_WEIGHTS, restaurantGuestArrivalPool } from './restaurant-order-probabilities.js';
export { RESTAURANT_DISH_GRADES } from './restaurant-research.js';
const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/order-tiers-v1/${file}`,globalThis.document?.baseURI||import.meta.url).href;
export const restaurantTierName=tier=>tier==='gold'?'金级':tier==='silver'?'银级':'普通';
export const restaurantQualityAttributes=grade=>`data-r-quality="${RESTAURANT_DISH_GRADES.includes(grade)?grade:'B'}"`;

/** Crisp type is a separate layer so the same transparent art works at every size. */
export function restaurantGradeLabel(grade){
  const value=RESTAURANT_DISH_GRADES.includes(grade)?grade:'B';
  return `<span class="rg-dish-grade" data-r-dish-grade="${value}" aria-hidden="true">${value}</span>`;
}

export function restaurantGradeGuide(){
  return `<div class="rg-grade-guide" aria-label="菜品品质由低到高：B、A、S、SS、SSS"><span>菜品品质</span><ol>${RESTAURANT_DISH_GRADES.map(grade=>`<li data-r-grade="${grade}">${grade}</li>`).join('')}</ol><p>顾客随机点餐 · 普通偏好 B–S，银级偏好 S，金级偏好 SSS</p></div>`;
}

/** A real alpha image sits above the existing food sprite. The source dish is
 * neither replaced nor recoloured, and remains readable through the opening. */
export function restaurantQualityFood(recipeId,grade,food){
  grade=RESTAURANT_DISH_GRADES.includes(grade)?grade:'B';
  const coating=['S','SSS'].includes(grade)?'gold':null;
  return `<span class="rg-tier-food" data-r-food-grade="${grade}"${coating?` data-r-coating="${coating}"`:''} aria-hidden="true">${food(recipeId)}${coating?`<img class="rg-tier-coating" src="${asset(`${coating}-overlay.webp`)}" alt="" draggable="false"/>`:''}${restaurantGradeLabel(grade)}</span>`;
}
export function restaurantTierFood(recipeId,tier,food,recipeLevel=1){
  return restaurantQualityFood(recipeId,restaurantDishGrade(recipeLevel),food);
}
export function restaurantGuestCoursePreview(guest,food){
  if(!guest.advanced)return '';
  return `<div class="rc-course-preview" data-r-guest-tier="${guest.tier}" aria-label="${restaurantTierName(guest.tier)}顾客，随机两轮点餐"><div><span class="rg-tier-food">${food('rice')}</span><span>随机第 1 餐</span></div><i aria-hidden="true">→</i><div><span class="rg-tier-food">${food('coffee')}</span><span>吃完再随机点餐</span></div><p><strong>${restaurantTierName(guest.tier)}猫友 · 2 轮点餐</strong><span>更偏好 ${guest.tier==='gold'?'SSS':'S 左右'} 品质料理</span><span>完成两餐，额外 +${guest.bonusGold} 金鱼干</span></p></div>`;
}
export function restaurantGuestTestButtons({enabled=false}={}){
  return enabled?'<details class="rg-guest-tests"><summary>高级顾客测试<span>银 / 金 · 两轮点餐</span></summary><div><button data-r-debug-guest="guest-baker">银级来客</button><button data-r-debug-guest="guest-dawn-duke">金级来客</button></div><p>准备指定条件并迎接一位顾客，暂停自然来客。仅影响本次测试存档。</p></details>':'';
}

export function restaurantOrderOddsMarkup(info){
  const cats=info.customerBook?.customers.filter(guest=>guest.eligible).map(guest=>guest.id)??[];
  const chances=restaurantGuestArrivalPool(cats).reduce((sum,item)=>{sum[item.tier]+=item.chance*100;return sum;},{ordinary:0,silver:0,gold:0});
  return `<details class="rg-order-odds"><summary>来访与点餐概率</summary><p>当前来访：${Object.entries(chances).map(([tier,chance])=>`${restaurantTierName(tier)} ${Math.round(chance)}%`).join(' · ')}</p><table aria-label="顾客对五种菜品品质的点单偏好"><thead><tr><th>顾客</th>${RESTAURANT_DISH_GRADES.map(grade=>`<th>${grade}</th>`).join('')}</tr></thead><tbody>${Object.entries(RESTAURANT_DISH_ORDER_WEIGHTS).map(([tier,weights])=>`<tr><th>${restaurantTierName(tier)}</th>${RESTAURANT_DISH_GRADES.map(grade=>`<td>${weights[grade]}%</td>`).join('')}</tr>`).join('')}</tbody></table><p>基础来访：普通 75% · 银级 20% · 金级 5%。未解锁的高级份额转为普通；点餐按可售品质重新分配，再在同品质菜品中随机选择。</p></details>`;
}
