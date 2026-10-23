import { recipeStepEnergyBase } from './restaurant-recipe-energy.js';
import { restaurantDailyLoginInfo, validRestaurantDailyLogin } from './restaurant-daily-login.js';
import { RESTAURANT_GUEST_DINING_MS, initialRestaurantGuestService, restaurantGuestHasNextCourse, restaurantGuestCompletionBonus, nextRestaurantGuestService, nextRestaurantGuestRecipe } from './restaurant-guest-service.js';
import { initialRestaurantResearch, normalizeRestaurantResearch, restaurantInspirationGift, awardRestaurantInspiration, validRestaurantResearch, restaurantResearchInfo, restaurantResearchCost, restaurantDishGrade, drawRestaurantResearch, drawRestaurantResearchBatch, restaurantResearchPool, restaurantFragmentSurplus, fuseRestaurantResearch, RESEARCH_INSPIRATION_MAX } from './restaurant-research.js';
import { validRestaurantSeenGuests, normalizeRestaurantSeenGuests, restaurantCustomerInfo, validRestaurantGuestConditions, completedRestaurantGuestConditions } from './restaurant-customers.js';
import { addGrowthExperience } from './pet-needs.js';
import { normalizeRestaurantParties, validRestaurantParties, restaurantArrivalPlan, RESTAURANT_GUEST_CATS } from './restaurant-guests.js';
import { validRestaurantWaitingParties, restaurantWaitingParties, createRestaurantWaitingParty, RESTAURANT_WAITING_LIMIT } from './restaurant-street.js';
import { KITCHEN_ZONES, KITCHEN_FLOWS, createKitchenWorkflow, validKitchenWorkflow, validKitchenReservations, kitchenInfo } from './restaurant-kitchen.js';
import { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow, isInteractiveWorkflow, interactiveOrderStatus } from './restaurant-kitchen-interactive.js';
import { SPECIAL_RESTAURANT_RECIPES, PROMOTED_SIGNATURE_RECIPE_IDS, PREMIUM_RESTAURANT_THEMES, specialRestaurantRecipe, premiumStaffHireCost, restaurantGoldReward, normalizeGoldFish, validGoldFish, GOLD_FISH_MAX } from './restaurant-economy.js';
import { staffQualityMultiplier, staffAbilityVersion, normalizeStaffTraining, normalizeRestaurantStaffTraining, restaurantStaffLastInteractionAt, validStaffTraining, reserveWorkerEnergy, trainingUpgradeResult, STAFF_TRAINING_STATS, STAFF_IDLE_RECOVERY_MS } from './restaurant-staff-training.js';
import { restaurantDecoration, ownedRestaurantDecorations, restaurantDecorationSnapshot, validDecorationSnapshot, createRestaurantConstruction, validRestaurantDecorations, normalizeRestaurantDecorations, restaurantDecorationInfo, decorationReward } from './restaurant-decor.js';
import { RESTAURANT_DECORATIONS } from './restaurant-decor.js';
import { restaurantLevelInfo as levelInfo } from './growth-levels.js';
import { RESTAURANT_FACILITIES, RESTAURANT_FACILITY_MAX_LEVEL, restaurantFacilityTimeMultiplier, restaurantTipsMultiplier, restaurantTableCapacity, restaurantTableIncomeMultiplier } from './restaurant-facilities.js';
import { restaurantCirclePalette, restaurantCirclePaletteUnlocked } from './restaurant-circle-palettes.js';
import { premiumRestaurantTheme, equippedPremiumDecorations } from './restaurant-premium-decorations.js';
import { initialRestaurantProgression, validRestaurantProgression, normalizeRestaurantProgression, restaurantExperience, restaurantResourceLevel, restaurantRecipeUnlocked, restaurantProgressionInfo } from './restaurant-progression.js';

/** Shared restaurant rules. Time and rewards come from the authoritative reducer;
 * clients submit only an intent, never elapsed time, currency or experience. */
export const RESTAURANT_RECIPES = Object.freeze([
  { id:'rice', name:'暖暖蛋包饭', category:'主食', price:24, xp:6, seconds:8, icon:'rice' },
  { id:'coffee', name:'猫爪拿铁', category:'饮品', price:32, xp:7, seconds:11, icon:'coffee' },
  { id:'pancake', name:'蜂蜜松饼', category:'甜点', price:46, xp:9, seconds:14, icon:'pancake' },
  { id:'burger', name:'芝士汉堡', category:'主食', price:62, xp:12, seconds:18, icon:'burger' },
  { id:'parfait', name:'莓莓圣代', category:'甜点', price:110, xp:19, seconds:28, icon:'parfait' },
  { id:'sandwich', name:'猫爪三明治', category:'主食', price:28, xp:6, seconds:9, icon:'sandwich' },
  { id:'lemontea', name:'柠檬气泡茶', category:'饮品', price:26, xp:6, seconds:9, icon:'lemontea' },
  { id:'donut', name:'草莓甜甜圈', category:'甜点', price:30, xp:7, seconds:10, icon:'donut' },
  { id:'pudding', name:'焦糖布丁', category:'甜点', price:42, xp:8, seconds:13, icon:'pudding' },
  { id:'matcha', name:'抹茶奶盖', category:'饮品', price:44, xp:9, seconds:14, icon:'matcha' },
  { id:'udon', name:'鲜虾乌冬', category:'主食', price:66, xp:12, seconds:19, icon:'udon' },
  { id:'waffle', name:'莓果华夫饼', category:'甜点', price:64, xp:12, seconds:18, icon:'waffle' },
  { id:'strawberrymilk', name:'草莓牛奶', category:'饮品', price:58, xp:11, seconds:17, icon:'strawberrymilk' },
  { id:'grape', name:'葡萄啵啵', category:'饮品', price:78, xp:14, seconds:21, icon:'grape' },
  { id:'cheesecake', name:'巴斯克芝士蛋糕', category:'甜点', price:108, xp:18, seconds:27, icon:'cheesecake' },
  { id:'cocoa', name:'棉花糖可可', category:'饮品', price:104, xp:18, seconds:26, icon:'cocoa' },
].map(recipe=>Object.freeze({...recipe,unlockLevel:restaurantResourceLevel('recipe',recipe.id)})));
export const RESTAURANT_RECIPE_CATEGORIES=Object.freeze(['主食','甜点','饮品']);
export const RESTAURANT_NEW_RECIPE_IDS=Object.freeze(RESTAURANT_RECIPES.filter(recipe=>!['rice','coffee','pancake','burger','parfait'].includes(recipe.id)).map(recipe=>recipe.id));
// These six keys were mandatory in the first released restaurant schema.
// New dishes are optional on disk and receive level 1 when a legacy save loads.
// Promoted signatures keep dormant levels/shards before purchase; those keys
// never grant sale permission. Previously accepted meals retain their snapshots.
const ORIGINAL_RECIPE_IDS=Object.freeze(['rice','coffee','pancake','burger','pizza','parfait']);
export const RESTAURANT_UPGRADES = RESTAURANT_FACILITIES;
export const RESTAURANT_THEMES = Object.freeze([
  { id:'cream', name:'奶油小馆', cost:0 },
  { id:'mint', name:'薄荷花园', cost:120 },
  { id:'sakura', name:'樱花午后', cost:240 },
].map(Object.freeze));
export const RESTAURANT_STAFF = Object.freeze([
  {id:'shadow',name:'小黑',role:'送餐员',sprite:'waiter',cost:220,greeting:'最喜欢送餐啦！',description:'把每一份热乎乎的心意送到餐桌。'},
  {id:'milky',name:'奶盖',role:'帮厨',sprite:'staff-milky',cost:650,greeting:'厨房交给我吧！',description:'认真备好食材，让主厨做菜更轻松。'},
  {id:'sesame',name:'芝麻',role:'领班',sprite:'staff-sesame',cost:1400,greeting:'今天也元气满满！',description:'穿着青绿马甲、戴着金色领结，照顾好客人与伙伴。'},
  {id:'pudding',name:'布丁',role:'甜点师',sprite:'staff-pudding',cost:5,costCurrency:'goldFish',greeting:'甜甜的幸福，出炉啦！',description:'戴着粉色贝雷帽，最拿手的是甜点。',isNew:true},
  {id:'mint',name:'薄荷',role:'饮品师',sprite:'staff-mint',cost:8,costCurrency:'goldFish',greeting:'要来一杯清凉的吗？',description:'调一杯清新的饮品，给小馆添点好心情。',isNew:true},
  {id:'chestnut',name:'栗子',role:'传菜员',sprite:'staff-chestnut',cost:12,costCurrency:'goldFish',greeting:'好吃的马上就到！',description:'端起小托盘，轻快地穿梭在餐桌之间。',isNew:true},
].map(Object.freeze));
export const RESTAURANT_STAFF_COSTS = Object.freeze(RESTAURANT_STAFF.map(employee=>employee.cost));
export const RESTAURANT_DINING_MS = RESTAURANT_GUEST_DINING_MS;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const CLIENT_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const ORDER_ID = /^table-[1-9][0-9]{0,15}$/;
const plain = value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact = (value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer = (value,min=0,max=MAX_SAFE)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const validTime = value=>integer(value);
const validLevel = value=>integer(value,1,RESTAURANT_FACILITY_MAX_LEVEL);
const validRecipeLevel = value=>integer(value,1,5);
const safeNow = value=>validTime(value)?value:0;
export const restaurantRecipe = id=>RESTAURANT_RECIPES.find(recipe=>recipe.id===id)||specialRestaurantRecipe(id);
const restaurantTheme=id=>RESTAURANT_THEMES.find(theme=>theme.id===id)||PREMIUM_RESTAURANT_THEMES.find(theme=>theme.id===id)||null;
export const restaurantLevel = experience=>levelInfo(experience).level;
export const restaurantRecipeUpgradeCost = (recipeId,level)=>restaurantRecipe(recipeId)?restaurantResearchCost(level):null;
const cookingMs = (recipe,kitchenLevel,staffLevel,cookSpeed=0)=>Math.max(3000,Math.round(recipe.seconds*1000*restaurantFacilityTimeMultiplier(kitchenLevel)*(1-.08*staffLevel)/(1+cookSpeed/10000)));
const rewardFor = order=>({coins:Math.round(restaurantRecipe(order.recipeId).price*(1+.3*(order.recipeLevel-1))*restaurantTipsMultiplier(order.tipsLevel)*restaurantTableIncomeMultiplier(order.tablesLevel??1)*staffQualityMultiplier(order.workflow?.workerLevels,staffAbilityVersion(order.workflow))),xp:restaurantRecipe(order.recipeId).xp+2*(order.recipeLevel-1)});
const autoServeAt = order=>isInteractiveWorkflow(order.workflow)?order.workflow.servedAt:order.workflow?.servedAt??(order.staffLevel>0?order.readyAt+1500:null);
const servedAt = order=>order.servedAt===null?autoServeAt(order):autoServeAt(order)===null?order.servedAt:Math.min(order.servedAt,autoServeAt(order));

/** Arrival and a seated guest's next request use the same authoritative
 * snapshot factory. New manual workflows retain the current route protocol. */
function createRestaurantGuestOrder(restaurant,recipe,createdAt,table,actor,decorationSnapshot){
  const id=`table-${restaurant.nextOrderId}`,staffLevel=restaurant.staff,kitchenLevel=restaurant.levels.kitchen;
  const workflow=KITCHEN_FLOWS[recipe.id]?createInteractiveWorkflow(restaurant,recipe.id,createdAt,{orderId:id,seat:table,kitchenLevel,fridgeLevel:restaurant.levels.fridge,staff:staffLevel,cookSpeedBp:decorationSnapshot?.cookSpeed??0,version:4,stepEnergyBase:recipeStepEnergyBase(recipe.id,restaurant.recipeLevels[recipe.id])}):null;
  if(KITCHEN_FLOWS[recipe.id]&&!workflow)return null;
  const readyAt=workflow?createdAt:createdAt+cookingMs(recipe,kitchenLevel,staffLevel,decorationSnapshot?.cookSpeed??0);
  if(!validTime(readyAt))return null;
  return {id,recipeId:recipe.id,createdAt,readyAt,servedAt:null,recipeLevel:restaurant.recipeLevels[recipe.id],tipsLevel:restaurant.levels.tips,kitchenLevel,staffLevel,actorId:typeof actor?.id==='string'&&CLIENT_ID.test(actor.id)?actor.id:'local-care',...(restaurant.levels.tables>4?{tablesLevel:restaurant.levels.tables}:{}),...(workflow?{workflow}:{}),...(decorationSnapshot?{decorationSnapshot:{...decorationSnapshot}}:{})};
}

export function initialRestaurant(now=Date.now()) {
  return {version:1,openedAt:safeNow(now),lastInteractionAt:safeNow(now),nextOrderId:1,parties:[],seenGuests:[],levels:{kitchen:1,fridge:1,tables:1,tips:1},recipeLevels:Object.fromEntries([...RESTAURANT_RECIPES.map(recipe=>recipe.id),...PROMOTED_SIGNATURE_RECIPE_IDS].map(id=>[id,1])),ownedSpecialRecipes:[],staff:0,theme:'cream',ownedThemes:['cream'],orders:[],stats:{served:0,ordinaryServed:0,earned:0,experience:0},progression:initialRestaurantProgression(),research:initialRestaurantResearch(),revision:0};
}

export function validRestaurant(value) {
  if(!exact(value,['version','openedAt','nextOrderId','levels','recipeLevels','staff','theme','ownedThemes','orders','stats','revision',...['dailyLogin','lastInteractionAt','parties','waitingParties','seenGuests','completedGuestConditions','ownedSpecialRecipes','staffTraining','decorationId','ownedDecorations','construction','decorationCarry','progression','research','circlePalette','ownedCirclePalettes','equippedPremiumDecorations'].filter(key=>Object.hasOwn(value||{},key))])||value.version!==1||!validTime(value.openedAt)||!integer(value.nextOrderId,1)||!integer(value.revision)||!integer(value.staff,0,RESTAURANT_STAFF.length))return false;
  if(Object.hasOwn(value,'dailyLogin')&&!validRestaurantDailyLogin(value.dailyLogin))return false;
  if(Object.hasOwn(value,'lastInteractionAt')&&(!validTime(value.lastInteractionAt)||value.lastInteractionAt<value.openedAt))return false;
  if(Object.hasOwn(value,'circlePalette')&&!restaurantCirclePalette(value.circlePalette))return false;
  if(Object.hasOwn(value,'ownedCirclePalettes')&&(!Array.isArray(value.ownedCirclePalettes)||new Set(value.ownedCirclePalettes).size!==value.ownedCirclePalettes.length||value.ownedCirclePalettes.some(id=>!restaurantCirclePalette(id))))return false;
  if(Object.hasOwn(value,'seenGuests')&&!validRestaurantSeenGuests(value.seenGuests))return false;
  if(Object.hasOwn(value,'completedGuestConditions')&&!validRestaurantGuestConditions(value.completedGuestConditions))return false;
  const specials=value.ownedSpecialRecipes??[];
  if(!Array.isArray(specials)||new Set(specials).size!==specials.length||specials.some(id=>!specialRestaurantRecipe(id)))return false;
  if(Object.hasOwn(value,'staffTraining')&&(!validStaffTraining(value.staffTraining,value.staff)||Object.values(value.staffTraining).some(record=>record.idleRecoveryAt!==undefined&&record.idleRecoveryAt<value.openedAt+STAFF_IDLE_RECOVERY_MS)))return false;
  if(!(exact(value.levels,['kitchen','tables','tips'])||exact(value.levels,['kitchen','fridge','tables','tips']))||!Object.values(value.levels).every(validLevel))return false;
  if(!plain(value.recipeLevels)||!ORIGINAL_RECIPE_IDS.every(id=>Object.hasOwn(value.recipeLevels,id))||Object.keys(value.recipeLevels).some(id=>!restaurantRecipe(id)||specialRestaurantRecipe(id)&&!specials.includes(id)&&!PROMOTED_SIGNATURE_RECIPE_IDS.includes(id))||specials.some(id=>!Object.hasOwn(value.recipeLevels,id))||!Object.values(value.recipeLevels).every(validRecipeLevel))return false;
  if(!Array.isArray(value.ownedThemes)||!value.ownedThemes.includes('cream')||new Set(value.ownedThemes).size!==value.ownedThemes.length||value.ownedThemes.some(id=>!restaurantTheme(id))||!value.ownedThemes.includes(value.theme))return false;
  if(Object.hasOwn(value,'equippedPremiumDecorations')&&(!Array.isArray(value.equippedPremiumDecorations)||new Set(value.equippedPremiumDecorations).size!==value.equippedPremiumDecorations.length||value.equippedPremiumDecorations.some(id=>!premiumRestaurantTheme(id)||!value.ownedThemes.includes(id))))return false;
  if(!validRestaurantDecorations(value))return false;
  if(!exact(value.stats,['served','earned','experience',...(Object.hasOwn(value.stats||{},'ordinaryServed')?['ordinaryServed']:[])])||!Object.entries(value.stats).every(([key,v])=>integer(v)||key==='experience'&&Number.isFinite(v)&&v>=0&&Number.isSafeInteger(Math.round(v*10))&&Math.abs(v*10-Math.round(v*10))<1e-6)||value.stats.served>=value.nextOrderId||(value.stats.ordinaryServed??0)>value.stats.served)return false;
  if(Object.hasOwn(value,'progression')&&!validRestaurantProgression(value.progression,value.stats.experience))return false;
  if(Object.hasOwn(value,'research')&&!validRestaurantResearch(value.research,value,restaurantRecipe))return false;
  if(!Array.isArray(value.orders)||value.orders.length>2*restaurantTableCapacity(value.levels.tables)||new Set(value.orders.map(order=>order?.id)).size!==value.orders.length)return false;
  const validOrders=value.orders.every(order=>{
    const keys=['id','recipeId','createdAt','readyAt','servedAt','recipeLevel','tipsLevel','kitchenLevel','staffLevel','actorId'];
    if(!exact(order,[...keys,...['workflow','decorationSnapshot','tablesLevel'].filter(key=>Object.hasOwn(order||{},key))])||typeof order.id!=='string'||!ORDER_ID.test(order.id)||!integer(Number(order.id.slice(6)),1,value.nextOrderId-1)||!restaurantRecipe(order.recipeId)||!validTime(order.createdAt)||order.createdAt<value.openedAt||!validTime(order.readyAt)||!validRecipeLevel(order.recipeLevel)||!validLevel(order.tipsLevel)||!validLevel(order.kitchenLevel)||!integer(order.staffLevel,0,RESTAURANT_STAFF.length)||typeof order.actorId!=='string'||!CLIENT_ID.test(order.actorId))return false;
    if(Object.hasOwn(order,'tablesLevel')&&!integer(order.tablesLevel,5,value.levels.tables))return false;
    if(Object.hasOwn(order,'decorationSnapshot')&&(!validDecorationSnapshot(order.decorationSnapshot)||!(order.decorationSnapshot.ids??[order.decorationSnapshot.id]).every(id=>ownedRestaurantDecorations(value).includes(id))))return false;
    if(order.recipeLevel>(value.recipeLevels[order.recipeId]??1)||order.tipsLevel>value.levels.tips||order.kitchenLevel>value.levels.kitchen||order.staffLevel>value.staff)return false;
    // Existing sushi/pizza orders keep their captured permission after promotion.
    // New orders still pass the purchase gate before they can be created.
    if(specialRestaurantRecipe(order.recipeId)&&!specials.includes(order.recipeId)&&!PROMOTED_SIGNATURE_RECIPE_IDS.includes(order.recipeId))return false;
    if(Object.hasOwn(order,'workflow'))return validKitchenWorkflow(order.workflow,order,value);
    if(order.readyAt!==order.createdAt+cookingMs(restaurantRecipe(order.recipeId),order.kitchenLevel,order.staffLevel,order.decorationSnapshot?.cookSpeed??0))return false;
    return order.servedAt===null||validTime(order.servedAt)&&order.servedAt>=order.readyAt;
  });
  return validOrders&&validRestaurantParties(value)&&validRestaurantWaitingParties(value)&&validKitchenReservations(value);
}

/** A normal game action cannot erase permanent restaurant progress. */
export function restaurantProgressPreserved(before,after){
  if(!validRestaurant(before)||!validRestaurant(after))return false;
  return after.openedAt===before.openedAt&&after.revision>=before.revision&&after.nextOrderId>=before.nextOrderId&&after.staff>=before.staff
    &&['served','earned','experience'].every(key=>after.stats[key]>=before.stats[key])
    &&Object.entries(before.levels).every(([key,value])=>after.levels[key]>=value)
    &&Object.entries(before.recipeLevels).every(([key,value])=>after.recipeLevels[key]>=value)
    &&(before.completedGuestConditions??[]).every(key=>(after.completedGuestConditions??[]).includes(key));
}

/** Old homes get an empty restaurant without touching wallet, pet or room IDs. */
export function normalizeRestaurant(value,now=Date.now()) {
  if(!validRestaurant(value))return initialRestaurant(now);
  const restaurant=structuredClone(value);
  restaurant.progression=normalizeRestaurantProgression(restaurant);
  restaurant.research=normalizeRestaurantResearch(restaurant.research,restaurant.stats.served);
  restaurant.levels.fridge??=1;
  restaurant.parties=normalizeRestaurantParties(restaurant);
  restaurant.waitingParties??=[];
  restaurant.seenGuests=normalizeRestaurantSeenGuests(restaurant);
  restaurant.ownedSpecialRecipes??=[];
  restaurant.stats.ordinaryServed??=restaurant.stats.served;
  restaurant.lastInteractionAt??=restaurantStaffLastInteractionAt(restaurant);
  restaurant.staffTraining=normalizeRestaurantStaffTraining(restaurant,now);
  // Raise owned legacy signatures to their base rank; accepted orders keep their snapshots.
  restaurant.recipeLevels=Object.fromEntries([...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES.filter(recipe=>restaurant.ownedSpecialRecipes.includes(recipe.id)||PROMOTED_SIGNATURE_RECIPE_IDS.includes(recipe.id))].map(recipe=>[recipe.id,Math.max(value.recipeLevels[recipe.id]??1,restaurant.ownedSpecialRecipes.includes(recipe.id)?recipe.baseLevel:1)]));
  const completedConditions=completedRestaurantGuestConditions(restaurant,safeNow(now));
  if(completedConditions.length)restaurant.completedGuestConditions=completedConditions;
  normalizeRestaurantDecorations(restaurant,safeNow(now));
  return restaurant;
}

export function restaurantInfo(state,now=Date.now()) {
  now=safeNow(now);
  const restaurant=normalizeRestaurant(state?.restaurant??(state?.version===1&&state?.levels?state:null),now);
  const level=restaurantLevel(restaurantExperience(restaurant));
  const kitchen=kitchenInfo(restaurant,now);
  const orders=restaurant.orders.map(order=>{
    const recipe=restaurantRecipe(order.recipeId),deliveryAt=servedAt(order),collectAt=deliveryAt===null?null:deliveryAt+RESTAURANT_DINING_MS;
    const party=restaurant.parties.find(party=>party.members.some(member=>member.orderId===order.id)),seat=party.members.findIndex(member=>member.orderId===order.id);
    const status=now<order.createdAt?'arriving':isInteractiveWorkflow(order.workflow)?interactiveOrderStatus(order.workflow,now):now<order.readyAt?(order.workflow?'preparing':'cooking'):deliveryAt===null||now<deliveryAt?(order.workflow?'delivering':'ready'):now<collectAt?'dining':'collectible';
    const member=party.members[seat],guestBonus=restaurantGuestCompletionBonus(member),inspiration=restaurantInspirationGift(restaurant,{...order,servedAt:deliveryAt},member.service?.tier,member.cat);
    const kitchenOrder=kitchen.orders.find(item=>item.id===order.id);
    const until=status==='arriving'?order.createdAt:status==='preparing'&&isInteractiveWorkflow(order.workflow)?kitchenOrder?.currentStep?.endAt??null:['cooking','preparing'].includes(status)?order.readyAt:['ready','delivering'].includes(status)?autoServeAt(order):status==='dining'?collectAt:null;
    const reward=decorationReward(rewardFor(order),order.decorationSnapshot,restaurant.decorationCarry);
    return {...order,inspirationRange:{min:inspiration.min,max:inspiration.max,chance:inspiration.chance},rewardInspiration:status==='collectible'?inspiration.amount:null,partyId:party.id,table:party.table,seat,recipe,status,guestTier:member.service?.tier??null,course:member.service?.round??1,courses:member.service?.rounds??1,hasNextCourse:restaurantGuestHasNextCourse(member),rewardGuestGold:guestBonus,servedAt:deliveryAt,autoServeAt:autoServeAt(order),collectAt,remainingMs:until===null?0:Math.max(0,until-now),progress:isInteractiveWorkflow(order.workflow)?kitchenOrder?.progress??0:status==='arriving'?0:['cooking','preparing'].includes(status)?Math.max(0,Math.min(1,(now-order.createdAt)/(order.readyAt-order.createdAt))):1,rewardCoins:reward.coins,rewardXp:reward.xp,rewardGold:(restaurantGoldReward({ordinaryServed:restaurant.stats.ordinaryServed,recipeId:order.recipeId})?.amount??0)+guestBonus};
  });
  const parties=restaurant.parties.map(party=>({...party,status:now<party.seatedAt?'arriving':'seated',members:party.members.map((member,seat)=>({...member,seat,order:orders.find(order=>order.id===member.orderId)||null}))}));
  const recipes=[...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES.filter(recipe=>restaurant.ownedSpecialRecipes.includes(recipe.id))].map(recipe=>{
    const recipeLevel=restaurant.recipeLevels[recipe.id],unlocked=restaurantRecipeUnlocked(restaurant,recipe),researchUnlockLevel=Math.max(unlocked?1:recipe.unlockLevel,restaurantResourceLevel('research',recipe.id,Math.min(5,recipeLevel+1)));
    return {...recipe,unlocked,level:recipeLevel,grade:restaurantDishGrade(recipeLevel),fragments:restaurant.research.fragments[recipe.id]??0,upgradeCost:restaurantRecipeUpgradeCost(recipe.id,recipeLevel),researchUnlockLevel,researchUnlocked:unlocked&&level>=researchUnlockLevel};
  });
  const research=restaurantResearchInfo(restaurant),researchPool=restaurantResearchPool(recipes);
  for(const recipe of recipes){const surplus=restaurantFragmentSurplus(recipe),convertible=Math.min(surplus.surplus,Math.floor((RESEARCH_INSPIRATION_MAX-research.experience)/surplus.fusionValue));recipe.fragmentResearch={...surplus,chance:researchPool.find(item=>item.recipe.id===recipe.id)?.chance??0,convertible,credit:convertible*surplus.fusionValue};}
  const progression=restaurantProgressionInfo(restaurant,{recipes:[...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES],staff:RESTAURANT_STAFF,upgrades:RESTAURANT_UPGRADES,decorations:RESTAURANT_DECORATIONS,premiumThemes:PREMIUM_RESTAURANT_THEMES,zones:KITCHEN_ZONES});
  const decoration=restaurantDecorationInfo(restaurant,now),decorationInfo={...decoration,decorations:decoration.decorations.map(suite=>({...suite,unlockLevel:restaurantResourceLevel('decoration',suite.id),unlocked:suite.owned||level>=restaurantResourceLevel('decoration',suite.id)}))};
  const hireUnlockLevel=RESTAURANT_STAFF[restaurant.staff]?restaurantResourceLevel('staff',RESTAURANT_STAFF[restaurant.staff].id):1;
  const customerBook=restaurantCustomerInfo(restaurant,{recipes:[...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES],staff:RESTAURANT_STAFF,upgrades:RESTAURANT_UPGRADES,decorations:RESTAURANT_DECORATIONS,themes:[...RESTAURANT_THEMES,...PREMIUM_RESTAURANT_THEMES]},now);
  return {restaurant,dailyLogin:restaurantDailyLoginInfo(restaurant,now),waitingParties:restaurantWaitingParties(restaurant,now),research:restaurantResearchInfo(restaurant),progression,decorationInfo,customerBook,kitchen,level,capacity:restaurantTableCapacity(restaurant.levels.tables),availableTables:restaurantTableCapacity(restaurant.levels.tables)-parties.length,guestCount:parties.reduce((count,party)=>count+party.members.length,0),parties,orders,recipes,specialRecipes:SPECIAL_RESTAURANT_RECIPES.map(recipe=>({...recipe,...recipes.find(item=>item.id===recipe.id),level:Math.max(restaurant.recipeLevels[recipe.id]??1,recipe.baseLevel),fragments:restaurant.research.fragments[recipe.id]??0,grade:restaurantDishGrade(Math.max(restaurant.recipeLevels[recipe.id]??1,recipe.baseLevel)),owned:restaurant.ownedSpecialRecipes.includes(recipe.id),unlocked:restaurantRecipeUnlocked(restaurant,recipe)||recipe.unlockLevel<=level})),upgrades:RESTAURANT_UPGRADES.map(upgrade=>{
    const facilityLevel=restaurant.levels[upgrade.id],unlockLevel=restaurantResourceLevel('facility',upgrade.id,Math.min(upgrade.maxLevel,facilityLevel+1));
    return {...upgrade,level:facilityLevel,cost:upgrade.costs[facilityLevel-1]??null,unlockLevel,unlocked:level>=unlockLevel};
  }),hireCost:RESTAURANT_STAFF_COSTS[restaurant.staff]??null,hireCurrency:premiumStaffHireCost(restaurant.staff)?.currency??'coins',hireUnlockLevel,hireUnlocked:level>=hireUnlockLevel};
}

/** A queued purchase names the level clicked, so retrying never buys a later
 * level after another owner changes the same facility, recipe or employee. */
export function restaurantUpgradeCurrentLevel(restaurant,action){
  if(action?.type==='restaurant-upgrade')return restaurant?.levels?.[action.upgradeId]??1;
  if(action?.type==='restaurant-recipe')return restaurant?.recipeLevels?.[action.recipeId]??1;
  if(action?.type==='restaurant-train')return restaurant?.staffTraining?.[action.workerId]?.levels?.[action.statId]??1;
  if(action?.type==='restaurant-hire')return restaurant?.staff??0;
  return null;
}

export function sanitizeRestaurantAction(value) {
  if(!plain(value))return null;
  if(Object.hasOwn(value,'expectedLevel')){
    if(restaurantUpgradeCurrentLevel(null,value)===null||!integer(value.expectedLevel,1,10))return null;
    const {expectedLevel,...action}=value,clean=sanitizeRestaurantAction(action);
    return clean?{...clean,expectedLevel}:null;
  }
  if(value.type==='restaurant-daily-login'&&exact(value,['type','day'])&&integer(value.day))return {...value};
  if(value.type==='restaurant-wait'&&exact(value,['type']))return {...value};
  if(value.type==='restaurant-arrive'&&exact(value,['type','waitingPartyId'])&&typeof value.waitingPartyId==='string'&&/^wait-[0-9]{1,16}-[1-9][0-9]{0,15}$/.test(value.waitingPartyId))return {...value};
  if(value.type==='restaurant-arrive'&&Object.keys(value).every(key=>['type','partySize','recipeId'].includes(key))&&(!Object.hasOwn(value,'partySize')||[1,2].includes(value.partySize))&&(!Object.hasOwn(value,'recipeId')||restaurantRecipe(value.recipeId)))return {...value};
  if(['restaurant-start','restaurant-recipe'].includes(value.type)&&exact(value,['type','recipeId'])&&restaurantRecipe(value.recipeId))return {...value};
  if(['restaurant-serve','restaurant-collect'].includes(value.type)&&exact(value,['type','orderId'])&&typeof value.orderId==='string'&&ORDER_ID.test(value.orderId))return {...value};
  if(value.type==='restaurant-kitchen-accept'&&exact(value,['type','orderId'])&&typeof value.orderId==='string'&&ORDER_ID.test(value.orderId))return {...value};
  if(value.type==='restaurant-kitchen-step'&&exact(value,['type','orderId','stepId'])&&typeof value.orderId==='string'&&ORDER_ID.test(value.orderId)&&['delivery',...new Set(Object.values(KITCHEN_FLOWS).flatMap(flow=>flow.map(step=>step.id)))].includes(value.stepId))return {...value};
  if(value.type==='restaurant-upgrade'&&exact(value,['type','upgradeId'])&&RESTAURANT_UPGRADES.some(upgrade=>upgrade.id===value.upgradeId))return {...value};
  if(value.type==='restaurant-hire'&&exact(value,['type']))return {...value};
  if(value.type==='restaurant-research-draw'&&exact(value,['type','draw'])&&integer(value.draw,1,33333333))return {...value};
  if(value.type==='restaurant-research-draw'&&exact(value,['type','draw','count'])&&value.count===10&&integer(value.draw,1,33333324))return {...value};
  if(value.type==='restaurant-research-fuse'&&exact(value,['type','recipeId','amount','expectedFragments','expectedFusion'])&&restaurantRecipe(value.recipeId)&&integer(value.amount,1,166666665)&&integer(value.expectedFragments,1,166666665)&&integer(value.expectedFusion,0,166666665))return {...value};
  if(value.type==='restaurant-theme'&&exact(value,['type','themeId'])&&restaurantTheme(value.themeId))return {...value};
  if(value.type==='restaurant-premium-decoration'&&exact(value,['type','themeId','equipped'])&&premiumRestaurantTheme(value.themeId)&&typeof value.equipped==='boolean')return {...value};
  if(value.type==='restaurant-decoration'&&exact(value,['type','decorationId'])&&restaurantDecoration(value.decorationId))return {...value};
  if(value.type==='restaurant-palette'&&exact(value,['type','paletteId'])&&restaurantCirclePalette(value.paletteId))return {...value};
  if(value.type==='restaurant-unlock-special'&&exact(value,['type','recipeId'])&&specialRestaurantRecipe(value.recipeId))return {...value};
  if(value.type==='restaurant-train'&&exact(value,['type','workerId','statId'])&&typeof value.workerId==='string'&&/^worker-[1-7]$/.test(value.workerId)&&STAFF_TRAINING_STATS.some(stat=>stat.id===value.statId))return {...value};
  return null;
}

export function restaurantActionResult(state,action,actor={id:'local-care',name:'猫友'},now=Date.now()) {
  const reject=reason=>({ok:false,reason});
  if(!sanitizeRestaurantAction(action))return reject('这项餐厅操作无效。');
  now=safeNow(now);
  const info=restaurantInfo(state,now),restaurant=info.restaurant;
  if(action.expectedLevel!==undefined&&restaurantUpgradeCurrentLevel(restaurant,action)+1!==action.expectedLevel)return reject('这项升级的进度已更新，本次操作未扣费，请按最新等级继续。');
  const decorationSnapshot=restaurantDecorationSnapshot(restaurant),cookSpeed=decorationSnapshot?.cookSpeed??0;
  let coins=state.coins,goldFish=normalizeGoldFish(state.goldFish),xp=state.xp,text,growthReward;
  if(!integer(coins,0,999999)||Object.hasOwn(state,'goldFish')&&!validGoldFish(state.goldFish)||!Number.isFinite(xp)||xp<0||xp>MAX_SAFE||restaurant.revision>=MAX_SAFE)return reject('这份餐厅存档暂时无法更新。');
  const spend=cost=>{if(coins<cost)return false;coins-=cost;return true;};
  const spendGold=cost=>{if(goldFish<cost)return false;goldFish-=cost;return true;};
  const reserve=workflow=>{
    if(!workflow?.workerLevels)return true;
    const first=workflow.segments.find(segment=>segment.phase!=='wait');
    const training=reserveWorkerEnergy(restaurant.staffTraining,workflow.workerId,{startAt:first.startAt,completedAt:workflow.completedAt,energyCost:workflow.energyCost});
    if(!training)return false;
    restaurant.staffTraining=training;return true;
  };
  if(action.type==='restaurant-daily-login'){
    if(action.day!==info.dailyLogin.day)return reject('开店礼已跨天，请领取今天的礼物。');
    if(!info.dailyLogin.available)return reject('今天的开店礼已经领取啦，明天再来。');
    if(coins+info.dailyLogin.amount>999999)return reject('小鱼干快装满啦，留出 300 的空间再领取。');
    coins+=info.dailyLogin.amount;
    restaurant.dailyLogin={day:info.dailyLogin.day,claimedAt:now};
    text='领取每日开店礼，获得 300 小鱼干（已同步小窝金币）';
  }else if(action.type==='restaurant-kitchen-accept'||action.type==='restaurant-kitchen-step'){
    const order=restaurant.orders.find(item=>item.id===action.orderId);
    if(!order||!isInteractiveWorkflow(order.workflow))return reject('这份订单暂时没有逐步制作流程。');
    const result=action.type==='restaurant-kitchen-accept'?acceptInteractiveWorkflow(restaurant,order,now):advanceInteractiveWorkflow(restaurant,order,action.stepId,now);
    if(!result.ok)return reject(result.reason);
    order.workflow=result.workflow;
    order.readyAt=result.workflow.readyAt??order.createdAt;
    if(result.staffTraining)restaurant.staffTraining=result.staffTraining;
    text=action.type==='restaurant-kitchen-accept'?`记下${restaurantRecipe(order.recipeId).name}订单，等待点击冰箱取料`:action.stepId==='delivery'?`端起${restaurantRecipe(order.recipeId).name}，送到客人桌边`:`开始${KITCHEN_FLOWS[order.recipeId].find(step=>step.id===action.stepId).label}`;
  }else if(action.type==='restaurant-wait'){
    if(info.availableTables)return reject('小馆还有空桌，可以直接迎客入座。');
    if(now<restaurant.openedAt||now>MAX_SAFE-120000)return reject('餐厅时钟正在同步，请稍后再试。');
    const queue=restaurantWaitingParties(restaurant,now);
    if(queue.length>=RESTAURANT_WAITING_LIMIT)return reject('门外已有两组猫猫等位，先照顾好它们吧。');
    const plan=restaurantArrivalPlan(restaurant,info.recipes.filter(recipe=>recipe.unlocked),{},actor,now);
    const waiting=createRestaurantWaitingParty(restaurant,plan.members.map(member=>member.cat),now);
    if(queue.some(party=>party.id===waiting.id))return reject('这组猫猫已经在等位了。');
    restaurant.waitingParties=[...queue,waiting];text=`${waiting.cats.length===2?'两位结伴的':'一位'}猫猫在门外等位`;
  }else if(action.type==='restaurant-arrive'){
    if(!info.availableTables)return reject('餐桌都坐满啦，等一桌客人用完餐再迎接新朋友。');
    if(restaurant.nextOrderId>MAX_SAFE-2||now<restaurant.openedAt)return reject('餐厅时钟正在同步，请稍后再试。');
    const recipes=info.recipes.filter(recipe=>recipe.unlocked);
    if(action.recipeId&&!recipes.some(recipe=>recipe.id===action.recipeId))return reject('这份料理还没有解锁，先让小馆慢慢长大吧。');
    const queue=restaurantWaitingParties(restaurant,now),waiting=action.partySize||action.recipeId?null:queue[0];
    if(action.waitingPartyId&&waiting?.id!==action.waitingPartyId)return reject('这组等位顾客已入座或离开，请按门外的最新队伍继续迎客。');
    const plan=restaurantArrivalPlan(restaurant,recipes,action,actor,now,waiting),party={...plan,members:[]};
    for(const member of plan.members){
      const order=createRestaurantGuestOrder(restaurant,member.recipe,plan.seatedAt,plan.table,actor,decorationSnapshot);
      if(!order)return reject('厨房正在安排工位或同步时钟，请稍后再试。');
      restaurant.nextOrderId++;restaurant.orders.push(order);
      const service=initialRestaurantGuestService(member.cat);
      party.members.push({cat:member.cat,orderId:order.id,...(service?{service}:{})});
    }
    restaurant.parties.push(party);
    restaurant.waitingParties=waiting?queue.slice(1):queue;
    restaurant.seenGuests=normalizeRestaurantSeenGuests(restaurant);
    text=`迎接${party.members.length===2?'两位结伴的':'一位'}猫猫，入座后各点一道料理`;
  }else if(action.type==='restaurant-start') {
    const recipe=restaurantRecipe(action.recipeId);
    if(recipe.special&&!restaurant.ownedSpecialRecipes.includes(recipe.id))return reject('先用金鱼干解锁这份招牌料理吧。');
    if(!restaurantRecipeUnlocked(restaurant,recipe))return reject(`小馆达到 ${recipe.unlockLevel} 级就能解锁这份料理。`);
    if(info.availableTables===0)return reject('餐桌都坐满啦，收好小鱼干再接下一位客人。');
    if(restaurant.nextOrderId>=MAX_SAFE)return reject('今天先让小馆休息一下吧。');
    const staffLevel=restaurant.staff,kitchenLevel=restaurant.levels.kitchen;
    const id=`table-${restaurant.nextOrderId}`;
    // Compatibility endpoint for the original timed orders. Current player
    // controls use restaurant-arrive, which creates all four manual workflows.
    // Do not expand this old v1 scheduler when a new manual recipe is added.
    const occupied=new Set(restaurant.parties.map(party=>party.table));
    const seat=Array.from({length:info.capacity},(_,index)=>index).find(index=>!occupied.has(index));
    const legacyFlow=['rice','coffee'].includes(recipe.id);
    const workflow=legacyFlow?createKitchenWorkflow(restaurant,recipe.id,now,{orderId:id,seat,kitchenLevel,fridgeLevel:restaurant.levels.fridge,staff:staffLevel,cookSpeedBp:cookSpeed}):null;
    if(legacyFlow&&!workflow)return reject('餐厅时钟正在同步，请稍后再试。');
    if(!reserve(workflow))return reject('员工正在恢复体力，请稍后再试。');
    const readyAt=workflow?.readyAt??now+cookingMs(recipe,kitchenLevel,staffLevel,cookSpeed);
    if(!validTime(readyAt)||now<restaurant.openedAt)return reject('餐厅时钟正在同步，请稍后再试。');
    restaurant.nextOrderId++;
    restaurant.orders.push({id,recipeId:recipe.id,createdAt:now,readyAt,servedAt:null,recipeLevel:restaurant.recipeLevels[recipe.id],tipsLevel:restaurant.levels.tips,kitchenLevel,staffLevel,actorId:typeof actor?.id==='string'&&CLIENT_ID.test(actor.id)?actor.id:'local-care',...(restaurant.levels.tables>4?{tablesLevel:restaurant.levels.tables}:{}),...(workflow?{workflow}:{}),...(decorationSnapshot?{decorationSnapshot:{...decorationSnapshot}}:{})});
    restaurant.parties.push({id:`party-${id.slice(6)}`,table:seat,arrivedAt:now,seatedAt:now,members:[{cat:RESTAURANT_GUEST_CATS[(restaurant.nextOrderId-2)%4],orderId:id}]});
    restaurant.seenGuests=normalizeRestaurantSeenGuests(restaurant);
    text=`接待一位猫猫，开始制作${recipe.name}`;
  }else if(action.type==='restaurant-serve'||action.type==='restaurant-collect') {
    const order=info.orders.find(order=>order.id===action.orderId);
    if(!order)return reject('这份订单已被伙伴收好，按最新餐桌继续吧。');
    if(action.type==='restaurant-serve') {
      if(order.workflow)return reject(now<order.workflow.servedAt?'猫猫正端着料理送往餐桌，请等它走到客人身边。':'这份料理已经送到餐桌啦。');
      if(order.status!=='ready')return reject(order.status==='cooking'?'料理还在制作中，再等一会儿。':'这份料理已经送到餐桌啦。');
      restaurant.orders.find(saved=>saved.id===order.id).servedAt=now;
      text=`把${order.recipe.name}送到猫猫的餐桌`;
    }else {
      if(order.status!=='collectible')return reject('猫猫还没用完餐，等它吃完再来收款吧。');
      const party=restaurant.parties.find(party=>party.members.some(member=>member.orderId===order.id)),member=party.members.find(member=>member.orderId===order.id);
      const hasNextCourse=restaurantGuestHasNextCourse(member),bonusGold=restaurantGuestCompletionBonus(member);
      if(hasNextCourse&&restaurant.nextOrderId>=MAX_SAFE)return reject('今天先让小馆休息一下吧。');
      const reward=decorationReward(rewardFor(order),order.decorationSnapshot,restaurant.decorationCarry);
      // Reserve room for every unclaimed bubble before accepting another meal.
      // Home XP is credited only by claim-growth; restaurant XP grows now.
      const reservedXp=(state.pendingGrowth??[]).reduce((total,pending)=>total===null?null:addGrowthExperience(total,pending.amount),xp);
      const nextXp=reservedXp===null?null:addGrowthExperience(reservedXp,reward.xp),totalExperience=addGrowthExperience(restaurant.stats.experience,reward.xp);
      const gold=restaurantGoldReward({ordinaryServed:restaurant.stats.ordinaryServed,recipeId:order.recipeId});
      if(!gold||goldFish+gold.amount+bonusGold>GOLD_FISH_MAX)return reject('金鱼干口袋快满啦，先解锁一些新内容吧。');
      if(coins+reward.coins>999999||nextXp===null||restaurant.stats.earned+reward.coins>MAX_SAFE||totalExperience===null||addGrowthExperience(totalExperience,restaurant.progression.experienceOffset)===null)return reject('小鱼干口袋或成长记录快满啦，先收好现有进度吧。');
      restaurant.orders=restaurant.orders.filter(saved=>saved.id!==order.id);
      restaurant.stats.served++;restaurant.stats.ordinaryServed=gold.ordinaryServed;restaurant.stats.earned+=reward.coins;restaurant.stats.experience=totalExperience;
      if(order.decorationSnapshot||restaurant.decorationCarry)restaurant.decorationCarry=reward.carry;
      const inspiration=awardRestaurantInspiration(restaurant,order,member);restaurant.research=inspiration.research;
      goldFish+=gold.amount+bonusGold;
      coins+=reward.coins;
      growthReward={orderId:order.id,recipeId:order.recipeId,amount:reward.xp};
      let nextRecipe=null;
      if(hasNextCourse){
        const service=nextRestaurantGuestService(member,order,now);
        nextRecipe=nextRestaurantGuestRecipe(info.recipes.filter(recipe=>recipe.unlocked),order.recipeId,member.cat,restaurant.nextOrderId,now);
        const nextOrder=nextRecipe&&createRestaurantGuestOrder(restaurant,nextRecipe,now,party.table,actor,decorationSnapshot);
        if(!service||!nextOrder)return reject('下一份料理正在安排，请稍后再试。');
        restaurant.nextOrderId++;restaurant.orders.push(nextOrder);
        member.orderId=nextOrder.id;member.service=service;
      }
      restaurant.parties=restaurant.parties.filter(party=>party.members.some(member=>restaurant.orders.some(saved=>saved.id===member.orderId)));
      text=`完成${order.recipe.name}订单，收到 ${reward.coins} 小鱼干，生成 ${reward.xp} 点餐厅经营经验气泡${nextRecipe?`；猫猫吃完第一餐，又点了${nextRecipe.name}`:''}${bonusGold?`；完成两餐，额外获得 ${bonusGold} 金鱼干`:''}${inspiration.gift.amount?`；猫猫赠送 ${inspiration.gift.amount} 灵感`:''}`;
    }
  }else if(action.type==='restaurant-upgrade') {
    const upgrade=info.upgrades.find(upgrade=>upgrade.id===action.upgradeId);
    if(upgrade.cost===null)return reject('这项设施已经升到最高级啦。');
    if(!upgrade.unlocked)return reject(`小馆达到 ${upgrade.unlockLevel} 级可升级${upgrade.name}。`);
    if(!spend(upgrade.cost))return reject(`还差 ${upgrade.cost-coins} 小鱼干，接待猫猫慢慢攒吧。`);
    restaurant.levels[upgrade.id]++;text=`把${upgrade.name}升级到 ${restaurant.levels[upgrade.id]} 级`;
  }else if(action.type==='restaurant-recipe') {
    const recipe=info.recipes.find(recipe=>recipe.id===action.recipeId);
    if(!recipe?.unlocked)return reject('先把这份料理解锁吧。');
    if(recipe.upgradeCost===null)return reject('这份料理已经升到最高级啦。');
    if(!recipe.researchUnlocked)return reject(`小馆达到 ${recipe.researchUnlockLevel} 级可继续研发这份料理。`);
    if(recipe.fragments<recipe.upgradeCost)return reject(`${recipe.name}还差 ${recipe.upgradeCost-recipe.fragments} 枚菜谱碎片，先到研发室抽取吧。`);
    restaurant.research.fragments[recipe.id]-=recipe.upgradeCost;
    restaurant.recipeLevels[recipe.id]++;text=`集齐碎片，把${recipe.name}研发至 ${restaurantDishGrade(restaurant.recipeLevels[recipe.id])} 级`;
  }else if(action.type==='restaurant-research-draw'){
    const result=(action.count===10?drawRestaurantResearchBatch:drawRestaurantResearch)(restaurant,info.recipes,action.draw,now);
    if(!result.ok)return reject(result.reason);
    restaurant.research=result.research;
    text=action.count===10?`十连探索完成，10 份灵感共获得 ${result.cards.reduce((sum,card)=>sum+card.amount,0)} 枚菜谱碎片`:`研发灵感揭晓：${restaurantRecipe(result.card.recipeId).name}碎片 ×${result.card.amount}`;
  }else if(action.type==='restaurant-research-fuse'){
    const result=fuseRestaurantResearch(restaurant,info.recipes,action);
    if(!result.ok)return reject(result.reason);
    restaurant.research=result.research;
    text=`融合${restaurantRecipe(action.recipeId).name}多余碎片 ${result.fusion.amount} 枚，收回 ${result.fusion.inspiration} 灵感`;
  }else if(action.type==='restaurant-hire') {
    if(info.hireCost===null)return reject('小馆的猫猫员工已经到齐啦。');
    if(!info.hireUnlocked)return reject(`小馆达到 ${info.hireUnlockLevel} 级可雇佣下一位猫猫伙伴。`);
    if(info.hireCurrency==='goldFish'?!spendGold(info.hireCost):!spend(info.hireCost))return reject(`雇佣猫猫还差 ${info.hireCost-(info.hireCurrency==='goldFish'?goldFish:coins)} ${info.hireCurrency==='goldFish'?'金鱼干':'小鱼干'}。`);
    const employee=RESTAURANT_STAFF[restaurant.staff];
    restaurant.staff++;text=`雇佣${employee.name}成为${employee.role}，之后的新订单会自动送餐`;
    restaurant.staffTraining=normalizeStaffTraining(restaurant.staffTraining,now,restaurant.staff);
  }else if(action.type==='restaurant-unlock-special') {
    const recipe=specialRestaurantRecipe(action.recipeId);
    if(restaurant.ownedSpecialRecipes.includes(recipe.id))return reject('这份招牌料理已经解锁啦。');
    if(recipe.unlockLevel>info.level)return reject(`小馆达到 ${recipe.unlockLevel} 级就能解锁这份招牌料理。`);
    if(!spendGold(recipe.unlockGold))return reject(`解锁料理还差 ${recipe.unlockGold-goldFish} 金鱼干。`);
    restaurant.ownedSpecialRecipes.push(recipe.id);restaurant.recipeLevels[recipe.id]=Math.max(restaurant.recipeLevels[recipe.id]??1,recipe.baseLevel);
    text=`用 ${recipe.unlockGold} 金鱼干解锁${recipe.name}`;
  }else if(action.type==='restaurant-train') {
    const currentLevel=restaurant.staffTraining[action.workerId]?.levels?.[action.statId],unlockLevel=restaurantResourceLevel('training',action.statId,(currentLevel??0)+1);
    if(currentLevel&&currentLevel<10&&info.level<unlockLevel)return reject(`小馆达到 ${unlockLevel} 级可把这项能力训练至 ${currentLevel+1} 级。`);
    // A fresh employee may still have the legacy full-energy record. Training
    // extra capacity must not enable standing recovery in current gameplay.
    // Keep an in-progress v1/v2 order's historical energy protocol intact.
    const record=restaurant.staffTraining[action.workerId],legacyAssigned=restaurant.orders.some(({workflow})=>workflow?.workerId===action.workerId&&workflow.version<=2&&(workflow.completedAt===null||workflow.completedAt>now));
    if(record&&!record.energyMode&&!legacyAssigned)restaurant.staffTraining[action.workerId]={...record,energyMode:'rest-room',rest:null};
    const result=trainingUpgradeResult(restaurant.staffTraining,action.workerId,action.statId,{coins,goldFish},now,restaurant.staff);
    if(!result.ok)return reject(result.reason);
    restaurant.staffTraining=result.training;coins=result.coins;goldFish=result.goldFish;
    text=`把${action.workerId==='worker-1'?'橘子主厨':RESTAURANT_STAFF[Number(action.workerId.slice(7))-2].name}的${STAFF_TRAINING_STATS.find(stat=>stat.id===action.statId).name}训练至 ${result.level} 级`;
  }else if(action.type==='restaurant-palette') {
    const palette=restaurantCirclePalette(action.paletteId);
    if(!restaurantCirclePaletteUnlocked(restaurant,palette,info.level))return reject(`小馆达到 ${palette.unlockLevel} 级可解锁${palette.name}操作圈。`);
    if((restaurant.circlePalette??'cream')===palette.id)return reject('正在使用这款操作圈配色。');
    restaurant.circlePalette=palette.id;
    restaurant.ownedCirclePalettes=[...new Set(['cream',...(restaurant.ownedCirclePalettes??[]),palette.id])];
    text=`操作圈已换成${palette.name}`;
  }else if(action.type==='restaurant-decoration') {
    const suite=restaurantDecoration(action.decorationId),owned=ownedRestaurantDecorations(restaurant);
    if(restaurant.construction)return reject('猫猫施工队正在布置小馆，等它们收好工具再换装吧。');
    if(restaurant.decorationId===suite.id)return reject('小馆已经布置好这套装扮啦。');
    const unlockLevel=restaurantResourceLevel('decoration',suite.id);
    if(!owned.includes(suite.id)&&info.level<unlockLevel)return reject(`小馆达到 ${unlockLevel} 级可解锁${suite.name}。`);
    const construction=createRestaurantConstruction(restaurant,suite.id,now);
    if(!construction)return reject('餐厅时钟正在同步，请稍后再试。');
    if(!owned.includes(suite.id)&&!spend(suite.cost))return reject(`这套装扮还差 ${suite.cost-coins} 小鱼干。`);
    restaurant.ownedDecorations=[...new Set([...owned,suite.id])];
    if(!restaurant.ownedThemes.includes(suite.theme))restaurant.ownedThemes.push(suite.theme);
    restaurant.construction=construction;
    text=`两位猫猫施工员开始布置${suite.name}，约 12 秒后完成`;
  }else if(action.type==='restaurant-premium-decoration'||action.type==='restaurant-theme'&&premiumRestaurantTheme(action.themeId)) {
    const theme=premiumRestaurantTheme(action.themeId),equipped=action.type==='restaurant-theme'||action.equipped,active=equippedPremiumDecorations(restaurant);
    if(restaurant.construction)return reject('猫猫施工队正在布置小馆，等它们收好工具再摆放吧。');
    if(active.includes(theme.id)===equipped)return reject(equipped?'这件珍藏已经摆好啦。':'这件珍藏已经收起来啦。');
    if(!restaurant.ownedThemes.includes(theme.id)){
      if(!equipped)return reject('还没有解锁这件珍藏。');
      if(info.level<theme.unlockLevel)return reject(`小馆达到 ${theme.unlockLevel} 级可解锁${theme.name}。`);
      if(!spendGold(theme.priceGold))return reject(`这件珍藏还差 ${theme.priceGold-goldFish} 金鱼干。`);
      restaurant.ownedThemes.push(theme.id);
    }
    restaurant.equippedPremiumDecorations=equipped?[...active,theme.id]:active.filter(id=>id!==theme.id);
    text=equipped?`已摆放${theme.propName}`:`已收起${theme.propName}`;
  }else {
    const theme=restaurantTheme(action.themeId);
    if(restaurant.construction)return reject('猫猫施工队正在布置小馆，等它们收好工具再换装吧。');
    if(restaurant.theme===theme.id)return reject('小馆已经是这个装扮啦。');
    if(!restaurant.ownedThemes.includes(theme.id)) {
      const unlockLevel=restaurantResourceLevel('theme',theme.id);
      if(info.level<unlockLevel)return reject(`小馆达到 ${unlockLevel} 级可解锁${theme.name}。`);
      if(theme.priceGold?!spendGold(theme.priceGold):!spend(theme.cost))return reject(`这套装扮还差 ${theme.priceGold?theme.priceGold-goldFish:theme.cost-coins} ${theme.priceGold?'金鱼干':'小鱼干'}。`);
      restaurant.ownedThemes.push(theme.id);
    }
    restaurant.theme=theme.id;delete restaurant.decorationId;text=`给小馆换上${theme.name}`;
  }
  // Background arrivals/queue changes must not keep an unattended kitchen awake.
  if(!['restaurant-arrive','restaurant-wait'].includes(action.type))restaurant.lastInteractionAt=Math.max(restaurant.lastInteractionAt,now);
  restaurant.revision++;
  const completedConditions=completedRestaurantGuestConditions(restaurant,now);
  if(completedConditions.length)restaurant.completedGuestConditions=completedConditions;
  // Never let normalization turn an invalid operation result into a new save.
  if(!validRestaurant(restaurant))return reject('餐厅工序数据校验未通过，已保留原进度，请稍后重试。');
  return {ok:true,restaurant,coins,goldFish,xp,text,...(growthReward?{growthReward}:{})};
}
