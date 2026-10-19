// One catalog drives saved theme IDs, level gates, cards, art and scene slots.
// Keep the original three IDs and prices compatible with existing homes.
const item=(id,name,propName,unlockLevel,priceGold,art,left,top,width,extra={})=>Object.freeze({id,name,propName,unlockLevel,priceGold,cost:0,art,scene:Object.freeze({left,top,width,...extra})});
export const PREMIUM_RESTAURANT_THEMES=Object.freeze([
  item('moonclock','月芽时光','月芽猫咪座钟',18,3,'gold-v2/theme-moonclock.webp',27,19,8.5),
  item('aquarium','海盐秘境','珊瑚金鱼水景',24,4,'gold-v2/theme-aquarium.webp',62,18,10.5),
  item('gramophone','莓果旋律','草莓留声机',31,6,'gold-v2/theme-gramophone.webp',13,19,8.5),
  item('fireplace','枫糖炉边','枫叶暖炉',36,7,'gold-v2/theme-fireplace.webp',0,38.8,13.8,{integrated:true}),
  item('starlight','星光小馆','星光金叶灯',39,6,'gold-v1/theme-starlight.webp',4.2,18.8,13.4,{integrated:true}),
  item('snowglobe','雪夜来信','雪夜猫咪水晶球',42,9,'gold-v2/theme-snowglobe.webp',74,20,7),
  item('glass','玻璃花房','樱花琉璃窗',44,8,'gold-v1/theme-glass.webp',59,16.9,23,{height:6,zIndex:0}),
  item('cloudgarden','云端花园','云朵绣球花架',48,11,'gold-v2/theme-cloudgarden.webp',82.4,19.1,13.4,{integrated:true}),
  item('royal','皇家猫宴','皇家猫爪招牌',50,12,'gold-v1/theme-royal.webp',27,12.5,9),
]);
export const premiumRestaurantTheme=id=>PREMIUM_RESTAURANT_THEMES.find(theme=>theme.id===id)||null;
// An old single-theme save keeps its visible item until the player changes it.
// Explicit empty arrays mean everything has been put away, including that item.
export function equippedPremiumDecorations(restaurant){
  return Array.isArray(restaurant?.equippedPremiumDecorations)?[...restaurant.equippedPremiumDecorations]:premiumRestaurantTheme(restaurant?.theme)?[restaurant.theme]:[];
}
export const PREMIUM_SCENE_VARIANTS=Object.freeze(['default','cream-bakery','cream-library','mint-greenhouse','mint-seaside','sakura-teahouse','sakura-evening']);
// Ownership remains the same across rooms; only the illustrated appearance changes.
export function premiumDecorationArt(id,variant='default',{integrated=false}={}){
  const theme=premiumRestaurantTheme(id);
  if(!theme)return null;
  if(variant!=='default'&&PREMIUM_SCENE_VARIANTS.includes(variant))return `premium-themed-v1/${variant}/${integrated&&PREMIUM_SCENE_PATCHES[id]?'integrated/':''}${id}.webp`;
  return integrated&&PREMIUM_SCENE_PATCHES[id]?`premium-integrated-v1/default/${id}.webp`:theme.art;
}
// Cropped from generated room edits; matching room pixels replace old objects.
export const PREMIUM_SCENE_PATCHES=Object.freeze({
  starlight:Object.freeze({left:36,top:300,width:132,height:210}),
  cloudgarden:Object.freeze({left:758,top:310,width:160,height:240}),
  fireplace:Object.freeze({left:0,top:650,width:134,height:280}),
});
