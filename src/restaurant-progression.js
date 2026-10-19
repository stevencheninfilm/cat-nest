import { restaurantDishGrade } from './restaurant-research.js';
import { levelInfo, levelStartXp } from './growth-levels.js';
import { addGrowthExperience } from './pet-needs.js';
import { ownedRestaurantDecorations } from './restaurant-decor.js';
import { staffTrainingUpgradeCost } from './restaurant-staff-training.js';
import { KITCHEN_CIRCLE_PALETTES, restaurantCirclePaletteUnlocked } from './restaurant-circle-palettes.js';
import { PREMIUM_RESTAURANT_THEMES } from './restaurant-premium-decorations.js';

/** Restaurant experience uses the pet's exact curve, but has its own ledger.
 * These are purchase permissions; reaching a level never spends or grants a wallet. */
export const RESTAURANT_UNLOCK_LEVELS=Object.freeze({
  recipe:Object.freeze({rice:1,coffee:1,sandwich:1,donut:1,lemontea:1,pancake:4,pudding:6,matcha:8,burger:11,udon:14,waffle:17,strawberrymilk:19,sushi:22,pizza:25,grape:28,parfait:29,cheesecake:32,cocoa:47,'gold-salmon':20,'gold-sundae':30,'gold-latte':40}),
  staff:Object.freeze({shadow:2,milky:12,sesame:24,pudding:35,mint:42,chestnut:49}),
  facility:Object.freeze({kitchen:Object.freeze([1,10,23,40,41,43,45,47,49,50]),fridge:Object.freeze([1,7,18,34,36,39,42,45,48,50]),tables:Object.freeze([1,3,20,38,40,42,44,46,48,50]),tips:Object.freeze([1,13,27,43,44,45,46,47,49,50])}),
  research:Object.freeze([1,1,10,30,45]),
  training:Object.freeze([1,1,5,15,21,31,36,41,46,48]),
  decoration:Object.freeze({'cream-bakery':1,'cream-library':9,'mint-greenhouse':16,'mint-seaside':26,'sakura-teahouse':33,'sakura-evening':37}),
  theme:Object.freeze({cream:1,mint:16,sakura:33,...Object.fromEntries(PREMIUM_RESTAURANT_THEMES.map(theme=>[theme.id,theme.unlockLevel]))}),
  palette:Object.freeze(Object.fromEntries(KITCHEN_CIRCLE_PALETTES.map(palette=>[palette.id,palette.unlockLevel]))),
});
// Only used to preserve permissions earned before the 50-level roadmap.
const LEGACY_RECIPE_LEVELS=Object.freeze({rice:1,coffee:1,pancake:2,burger:3,pizza:4,parfait:5,sandwich:1,donut:1,lemontea:1,pudding:2,matcha:2,udon:3,waffle:3,strawberrymilk:3,sushi:4,grape:4,cheesecake:5,cocoa:5});
const MAX=Number.MAX_SAFE_INTEGER;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const validTenths=value=>Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*10))&&Math.abs(value*10-Math.round(value*10))<1e-6;
const legacyRestaurantLevel=served=>Math.min(5,1+Math.floor(Math.max(0,Number.isSafeInteger(served)?served:0)/6));
export const initialRestaurantProgression=()=>({version:2,experienceOffset:0,legacyRecipes:[]});

export function validRestaurantProgression(value,earnedExperience=0){
  const legacy=value?.version===1&&exact(value,['version','experienceOffset']);
  const current=value?.version===2&&exact(value,['version','experienceOffset','legacyRecipes'])&&Array.isArray(value.legacyRecipes)&&new Set(value.legacyRecipes).size===value.legacyRecipes.length&&value.legacyRecipes.every(id=>typeof id==='string'&&Object.hasOwn(LEGACY_RECIPE_LEVELS,id));
  return (legacy||current)&&validTenths(value.experienceOffset)&&value.experienceOffset<=levelStartXp(5)&&addGrowthExperience(earnedExperience,value.experienceOffset)!==null;
}

/** A one-time credit preserves an old restaurant's reached level. It is not a
 * reward: the ordinary experience statistic, pet XP and both wallets stay intact. */
export function normalizeRestaurantProgression(restaurant){
  if(restaurant.progression?.version===2)return {...restaurant.progression,legacyRecipes:[...restaurant.progression.legacyRecipes]};
  const threshold=levelStartXp(legacyRestaurantLevel(restaurant.stats?.served));
  const earned=restaurant.stats?.experience??0;
  const experienceOffset=restaurant.progression?.experienceOffset??Math.max(0,Math.round((threshold-earned)*10)/10);
  const oldLevel=levelInfo(addGrowthExperience(earned,experienceOffset)??MAX).level;
  const legacyRecipes=Object.entries(LEGACY_RECIPE_LEVELS).filter(([id,required])=>required<=oldLevel||(restaurant.recipeLevels?.[id]??1)>1||restaurant.orders?.some(order=>order.recipeId===id)).map(([id])=>id);
  return {version:2,experienceOffset,legacyRecipes};
}
export function restaurantExperience(restaurant){
  const earned=restaurant?.stats?.experience??0,offset=restaurant?.progression?.experienceOffset??normalizeRestaurantProgression(restaurant??{}).experienceOffset;
  return Math.min(MAX,addGrowthExperience(earned,offset)??MAX);
}
export function restaurantExperienceInfo(restaurant){
  const experience=restaurantExperience(restaurant),growth=levelInfo(experience),startExperience=levelStartXp(growth.level);
  return {level:growth.level,experience,earnedExperience:restaurant.stats.experience,legacyExperience:normalizeRestaurantProgression(restaurant).experienceOffset,
    startExperience,target:levelStartXp(growth.level+1),levelExperience:growth.progress,levelTarget:growth.target,
    progress:growth.progress/growth.target,remaining:Math.round((growth.target-growth.progress)*10)/10,nextLevel:growth.level+1};
}
export function restaurantResourceLevel(kind,id,targetLevel=1){
  if(kind==='facility')return RESTAURANT_UNLOCK_LEVELS.facility[id]?.[targetLevel-1]??1;
  if(kind==='research')return RESTAURANT_UNLOCK_LEVELS.research[targetLevel-1]??1;
  if(kind==='training')return RESTAURANT_UNLOCK_LEVELS.training[targetLevel-1]??1;
  return RESTAURANT_UNLOCK_LEVELS[kind]?.[id]??1;
}
export function restaurantRecipeUnlocked(restaurant,recipe){
  if(recipe.special)return Boolean(restaurant.ownedSpecialRecipes?.includes(recipe.id));
  return levelInfo(restaurantExperience(restaurant)).level>=recipe.unlockLevel||normalizeRestaurantProgression(restaurant).legacyRecipes.includes(recipe.id);
}

/** Build the roadmap from the live catalogs, rather than copying names or art.
 * New items automatically appear; a catalog count never includes imaginary assets. */
export function restaurantProgressionInfo(restaurant,{recipes,staff,upgrades,decorations,premiumThemes,zones}){
  const growth=restaurantExperienceInfo(restaurant),level=growth.level,catalog=[];
  const add=item=>{
    const available=item.owned||level>=item.level;
    catalog.push({...item,available,status:item.owned?'owned':available?'available':'locked'});
  };
  for(const recipe of recipes){
    const special=Boolean(recipe.special),owned=restaurantRecipeUnlocked(restaurant,recipe);
    add({key:`recipe:${recipe.id}`,kind:'recipe',id:recipe.id,name:recipe.name,level:recipe.unlockLevel,owned,
      currency:special?'goldFish':null,cost:special?recipe.unlockGold:0,description:special?'等级达标后，用金鱼干永久解锁配方':'等级达标自动开放，接单免费',
      preview:{type:special&&recipe.id.startsWith('gold-')?'gold':'food',id:special?({'gold-salmon':'special-salmon','gold-sundae':'special-sundae','gold-latte':'special-latte'}[recipe.id]??recipe.id):recipe.id}});
  }
  add({key:'staff:chef',kind:'staff',id:'chef',name:'橘子主厨',level:1,owned:true,cost:0,currency:null,description:'基础主厨，从取料到送餐完成一整单',preview:{type:'cat',id:'chef'}});
  staff.forEach((employee,index)=>add({key:`staff:${employee.id}`,kind:'staff',id:employee.id,name:`${employee.name} · ${employee.role}`,level:restaurantResourceLevel('staff',employee.id),owned:index<restaurant.staff,
    cost:employee.cost,currency:employee.costCurrency??'coins',description:'按顺序雇佣，分别制作订单和训练能力',preview:{type:'cat',id:employee.sprite}}));
  for(const upgrade of upgrades)for(let target=1;target<=upgrade.maxLevel;target++)add({
    key:`facility:${upgrade.id}:${target}`,kind:'facility',id:upgrade.id,name:`${upgrade.name} Lv.${target}`,targetLevel:target,
    level:restaurantResourceLevel('facility',upgrade.id,target),owned:restaurant.levels[upgrade.id]>=target,currency:target===1?null:'coins',cost:target===1?0:upgrade.costs[target-2],
    description:target===1?'开业即有的基础设施':upgrade.description,preview:{type:'icon',id:upgrade.id},
  });
  for(let target=2;target<=5;target++)add({key:`research:${target}`,kind:'research',id:`research-${target}`,name:`菜谱研发至 ${restaurantDishGrade(target)}`,targetLevel:target,
    level:restaurantResourceLevel('research',null,target),owned:recipes.every(recipe=>(restaurant.recipeLevels[recipe.id]??1)>=target),currency:null,cost:null,
    description:'营业获得研发经验，抽取并集齐对应菜谱碎片升阶',preview:{type:'icon',id:'research'}});
  const workerRecords=Object.values(restaurant.staffTraining??{});
  for(let target=2;target<=10;target++){
    const price=staffTrainingUpgradeCost('speed',target-1);
    add({key:`training:${target}`,kind:'training',id:`training-${target}`,name:`四项员工能力可升至 Lv.${target}`,targetLevel:target,
      level:restaurantResourceLevel('training',null,target),owned:workerRecords.length>0&&workerRecords.every(record=>Object.values(record.levels).every(value=>value>=target)),
      currency:price.currency,cost:price.amount,description:'速度、体力、耐力、熟练度，每位员工每项分别训练',preview:{type:'icon',id:'training'}});
  }
  const ownedDecorations=ownedRestaurantDecorations(restaurant);
  for(const palette of KITCHEN_CIRCLE_PALETTES)add({key:`palette:${palette.id}`,kind:'decoration',id:palette.id,name:`${palette.name}操作圈`,level:palette.unlockLevel,owned:restaurantCirclePaletteUnlocked(restaurant,palette,level),
    currency:null,cost:0,description:'等级达标自动解锁，可在装扮中免费切换',preview:{type:'palette',id:palette.id}});
  for(const suite of decorations)add({key:`decoration:${suite.id}`,kind:'decoration',id:suite.id,name:suite.name,level:restaurantResourceLevel('decoration',suite.id),owned:ownedDecorations.includes(suite.id),
    currency:suite.cost?'coins':null,cost:suite.cost,description:'整套场景与摆件，选择后由猫猫施工队布置',preview:{type:'decoration',id:suite.id}});
  for(const theme of premiumThemes)add({key:`decoration:${theme.id}`,kind:'decoration',id:theme.id,name:theme.name,level:restaurantResourceLevel('theme',theme.id),owned:restaurant.ownedThemes.includes(theme.id),
    currency:'goldFish',cost:theme.priceGold,description:`珍藏道具 · ${theme.propName}`,preview:{type:'premium-decoration',id:theme.id}});
  for(const zone of zones)add({key:`station:${zone.id}`,kind:'station',id:String(zone.id),name:`${zone.id} 号 · ${zone.name}`,level:1,owned:true,currency:null,cost:0,
    description:'厨房独立工位，同一时间一位员工操作',preview:{type:'icon',id:'station'}});
  catalog.sort((a,b)=>a.level-b.level);
  const lastUnlockLevel=Math.max(...catalog.map(item=>item.level));
  const milestones=Array.from({length:lastUnlockLevel},(_,index)=>{
    const milestoneLevel=index+1;
    return {level:milestoneLevel,startExperience:levelStartXp(milestoneLevel),items:catalog.filter(item=>item.level===milestoneLevel),available:level>=milestoneLevel,current:level===milestoneLevel};
  });
  return {...growth,catalog,milestones,lastUnlockLevel,nextUnlockLevel:milestones.find(item=>item.level>level&&item.items.length)?.level??null,
    resourceCounts:{recipes:recipes.length,staff:staff.length+1,facilities:upgrades.length,decorations:decorations.length+premiumThemes.length+KITCHEN_CIRCLE_PALETTES.length,abilities:4,stations:zones.length}};
}
