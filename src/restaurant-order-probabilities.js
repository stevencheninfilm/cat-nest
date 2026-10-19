import { RESTAURANT_DISH_GRADES, restaurantDishGrade } from './restaurant-research.js';
import { RESTAURANT_GUESTS } from './restaurant-customers.js';

export const RESTAURANT_GUEST_ARRIVAL_WEIGHTS=Object.freeze({ordinary:75,silver:20,gold:5});
export const RESTAURANT_DISH_ORDER_WEIGHTS=Object.freeze({
  ordinary:Object.freeze({B:35,A:35,S:25,SS:4,SSS:1}),
  silver:Object.freeze({B:5,A:20,S:50,SS:20,SSS:5}),
  gold:Object.freeze({B:1,A:4,S:10,SS:20,SSS:65}),
});
const tiers=new Map(RESTAURANT_GUESTS.map(guest=>[guest.id,guest.tier??'ordinary']));
export const restaurantGuestTier=cat=>tiers.get(cat)??'ordinary';
const groupBy=(items,key)=>items.reduce((groups,item)=>{(groups[key(item)]??=[]).push(item);return groups;},{});

/** Keep rare visitors rare as the catalog grows. An ineligible advanced
 * tier gives its share to ordinary guests instead of promoting another tier. */
export function restaurantGuestArrivalPool(cats){
  const groups=groupBy(cats,restaurantGuestTier),weights={...RESTAURANT_GUEST_ARRIVAL_WEIGHTS};
  for(const tier of ['silver','gold'])if(!groups[tier]?.length){weights.ordinary+=weights[tier];weights[tier]=0;}
  const total=Object.keys(groups).reduce((sum,tier)=>sum+weights[tier],0);
  return cats.map(cat=>{const tier=restaurantGuestTier(cat);return {cat,tier,chance:weights[tier]/total/groups[tier].length};});
}

/** Sample a quality first, then a dish within that quality. Catalog size
 * cannot dilute a quality's advertised share. Never invent a higher grade. */
export function restaurantDishOrderPool(recipes,tier='ordinary'){
  // restaurantInfo.recipes already includes only owned specials. A full
  // catalog can additionally mark unowned entries explicitly with owned:false.
  const choices=recipes.filter(recipe=>recipe.unlocked!==false&&recipe.owned!==false);
  const groups=groupBy(choices,recipe=>restaurantDishGrade(recipe.level??1));
  const weights=RESTAURANT_DISH_ORDER_WEIGHTS[tier]??RESTAURANT_DISH_ORDER_WEIGHTS.ordinary;
  const total=RESTAURANT_DISH_GRADES.reduce((sum,grade)=>sum+(groups[grade]?.length?weights[grade]:0),0);
  return choices.map(recipe=>{const grade=restaurantDishGrade(recipe.level??1);return {recipe,grade,chance:weights[grade]/total/groups[grade].length};});
}

/** The caller supplies its authoritative seeded roll; no client outcome or
 * ambient Math.random enters a replayable restaurant action. */
export function pickRestaurantProbability(pool,roll){
  if(!pool.length)return null;
  let remaining=Math.max(0,Math.min(1-Number.EPSILON,Number.isFinite(roll)?roll:0));
  for(const item of pool){remaining-=item.chance;if(remaining<0)return item;}
  return pool.at(-1);
}
