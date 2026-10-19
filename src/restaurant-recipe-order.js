/** Match the menu everywhere: unlock level first, catalog order for ties. */
export function restaurantRecipeMenuOrder(recipes) {
  return [...recipes].sort((a,b)=>(a.unlockLevel??1)-(b.unlockLevel??1));
}
