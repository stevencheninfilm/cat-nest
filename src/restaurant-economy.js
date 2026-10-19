import { restaurantResourceLevel } from './restaurant-progression.js';
export { PREMIUM_RESTAURANT_THEMES } from './restaurant-premium-decorations.js';

/** Shared premium-currency catalog and reward rules. Call the reward helper only
 * after the authoritative restaurant reducer verifies a collectible order. */
export const GOLD_FISH_MAX=999999;
export const PROMOTED_SIGNATURE_RECIPE_IDS=Object.freeze(['sushi','pizza']);
export const SPECIAL_RESTAURANT_RECIPES=Object.freeze([
  {id:'gold-salmon',name:'金箔三文鱼饭',category:'主食',price:76,xp:13,seconds:20,unlockGold:30,goldReward:0,icon:'gold-salmon',special:true},
  {id:'sushi',name:'樱花寿司',category:'主食',price:82,xp:15,seconds:22,unlockGold:40,goldReward:0,icon:'sushi',special:true},
  {id:'pizza',name:'田园披萨',category:'主食',price:84,xp:15,seconds:23,unlockGold:50,goldReward:0,icon:'pizza',special:true},
  {id:'gold-sundae',name:'星光金鱼圣代',category:'甜点',price:98,xp:17,seconds:25,unlockGold:50,goldReward:0,icon:'gold-sundae',special:true},
  {id:'gold-latte',name:'鎏金猫爪拿铁',category:'饮品',price:124,xp:20,seconds:29,unlockGold:70,goldReward:0,icon:'gold-latte',special:true},
].map(recipe=>Object.freeze({...recipe,unlockLevel:restaurantResourceLevel('recipe',recipe.id)})));
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
export const validGoldFish=value=>integer(value,0,GOLD_FISH_MAX);
/** Missing premium currency in a legacy home means zero, never a free grant. */
export const normalizeGoldFish=value=>validGoldFish(value)?value:0;
export const specialRestaurantRecipe=id=>SPECIAL_RESTAURANT_RECIPES.find(recipe=>recipe.id===id)||null;

/** Preserve the ordinary-dish history without minting currency from recipes.
 * Only the verified final course of a silver/gold guest grants gold fish,
 * through restaurantGuestCompletionBonus in the authoritative collection. */
export function restaurantGoldReward({ordinaryServed=0,recipeId}={}) {
  if(!integer(ordinaryServed)||ordinaryServed===Number.MAX_SAFE_INTEGER||typeof recipeId!=='string'||!recipeId)return null;
  const special=specialRestaurantRecipe(recipeId);
  return {amount:0,ordinaryServed:special?ordinaryServed:ordinaryServed+1};
}

/** Zero-based hire index, matching restaurant.staff before a new hire. Existing
 * hires 0–2 keep their original coin price; hires 3–5 require premium currency.
 * Returning null leaves the existing/other-branch catalog authoritative. */
export function premiumStaffHireCost(hireIndex) {
  if(!integer(hireIndex,3,5))return null;
  return Object.freeze({currency:'goldFish',amount:[5,8,12][hireIndex-3]});
}
