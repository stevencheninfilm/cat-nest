/** Energy policy 1. Keep the catalog bands stable for already saved orders.
 * The menu advances from starter dishes to early, middle and late recipes. */
export const RESTAURANT_RECIPE_STEP_BASE=Object.freeze({
  rice:10,coffee:10,sandwich:10,lemontea:10,donut:10,
  pancake:11,pudding:11,matcha:11,
  burger:12,udon:12,waffle:12,strawberrymilk:12,sushi:12,pizza:12,grape:12,parfait:12,'gold-salmon':12,
  cheesecake:13,cocoa:13,'gold-sundae':13,'gold-latte':13,
});
export const RESTAURANT_GRADE_ENERGY_BONUS=Object.freeze([0,.5,1,1.5,2]);
export const RESTAURANT_STEP_ENERGY_MIN=10;
export const RESTAURANT_STEP_ENERGY_MAX=15;
export const validRecipeStepEnergyBase=value=>Number.isFinite(value)&&value>=RESTAURANT_STEP_ENERGY_MIN&&value<=RESTAURANT_STEP_ENERGY_MAX&&Number.isInteger(value*2);

/** The grade belongs to the order, rather than the recipe's later live grade. */
export function recipeStepEnergyBase(recipeId,recipeLevel=1){
  const base=RESTAURANT_RECIPE_STEP_BASE[recipeId];
  if(!base||!Number.isInteger(recipeLevel)||recipeLevel<1||recipeLevel>5)return null;
  return base+RESTAURANT_GRADE_ENERGY_BONUS[recipeLevel-1];
}
