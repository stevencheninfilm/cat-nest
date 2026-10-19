/** Recipe research is earned through settled meals, never a wallet purchase.
 * A monotonically increasing draw number makes retries and double taps safe. */
export const RESTAURANT_DISH_GRADES=Object.freeze(['B','A','S','SS','SSS']);
// Retained only for the exact migration of the first research ledger.
const LEGACY_RESEARCH_XP_PER_MEAL=10;
export const RESEARCH_INSPIRATION_MAX=1000000000;
export const RESEARCH_DRAW_XP=30;
export const RESEARCH_WELCOME_XP=90;
export const RESEARCH_FRAGMENT_COSTS=Object.freeze([3,6,10,15]);
const MAX=Number.MAX_SAFE_INTEGER;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer=(value,min=0,max=MAX)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
export const restaurantDishGrade=level=>RESTAURANT_DISH_GRADES[integer(level,1,5)?level-1:0];
export const restaurantResearchCost=level=>integer(level,1,4)?RESEARCH_FRAGMENT_COSTS[level-1]:null;
const FRAGMENT_RARITIES=Object.freeze(['家常','精选','珍味','典藏','传说']);
/** Unlock order is stable across ownership/quality changes. A finished dish
 * stays in the pool, so mastering common food cannot force rare discoveries. */
export function restaurantFragmentRarity(recipe){
  const level=integer(recipe?.unlockLevel,1,100)?recipe.unlockLevel:1,tier=Math.min(4,Math.floor(level/10));
  return {name:FRAGMENT_RARITIES[tier],tier,weight:Math.max(1,Math.round(1000*.95**(level-1))),fusionValue:tier+1};
}
export function restaurantResearchPool(recipes){
  const pool=recipes.filter(recipe=>recipe.unlocked).map(recipe=>({recipe,...restaurantFragmentRarity(recipe)})),total=pool.reduce((sum,item)=>sum+item.weight,0);
  return pool.map(item=>({...item,chance:item.weight/total}));
}
export function restaurantFragmentSurplus(recipe){
  const reserve=RESEARCH_FRAGMENT_COSTS.slice(Math.max(0,(recipe.level??1)-1)).reduce((sum,cost)=>sum+cost,0);
  return {reserve,surplus:Math.max(0,(recipe.fragments??0)-reserve),...restaurantFragmentRarity(recipe)};
}
export const initialRestaurantResearch=(served=0)=>({version:2,startedServed:served,draws:0,fragments:{},lastDraw:null,inspirationEarned:RESEARCH_WELCOME_XP,lastGift:null});
const legacyEarned=(research,served)=>Math.min(RESEARCH_INSPIRATION_MAX,RESEARCH_WELCOME_XP+LEGACY_RESEARCH_XP_PER_MEAL*(served-research.startedServed));
const earnedInspiration=(research,served)=>research.version===1?legacyEarned(research,served):research.inspirationEarned;
const GIFT_RANGES=Object.freeze([[6,12],[9,16],[13,22],[18,30],[25,40]].map(Object.freeze));
const GUEST_GIFTS=Object.freeze({ordinary:{chance:75,min:0,max:0},silver:{chance:85,min:4,max:8},gold:{chance:95,min:10,max:16}});
export function restaurantInspirationRange(tier,recipeLevel=1){
  tier=Object.hasOwn(GUEST_GIFTS,tier)?tier:'ordinary';
  const level=integer(recipeLevel,1,5)?recipeLevel:1,base=GIFT_RANGES[level-1],guest=GUEST_GIFTS[tier];
  return {tier,grade:restaurantDishGrade(level),chance:guest.chance,min:base[0]+guest.min,max:base[1]+guest.max};
}

export function validRestaurantResearch(value,restaurant,isRecipe){
  const legacy=value?.version===1,keys=['version','startedServed','draws','fragments','lastDraw',...(!legacy?['inspirationEarned','lastGift']:[]),...(Object.hasOwn(value??{},'fusion')?['fusion']:[])];
  if(!exact(value,keys)||![1,2].includes(value.version)||!integer(value.startedServed,0,restaurant.stats?.served??0)||!integer(earnedInspiration(value,restaurant.stats.served),RESEARCH_WELCOME_XP,RESEARCH_INSPIRATION_MAX)||!integer(value.draws,0,Math.floor(earnedInspiration(value,restaurant.stats.served)/RESEARCH_DRAW_XP))||!plain(value.fragments))return false;
  const entries=Object.entries(value.fragments);
  if(entries.some(([id,amount])=>!isRecipe(id)||!Object.hasOwn(restaurant.recipeLevels,id)||!integer(amount,0,value.draws*5))||entries.reduce((total,[,amount])=>total+amount,0)>value.draws*5)return false;
  if(Object.hasOwn(value,'fusion')){
    const fusion=value.fusion,last=fusion?.last;
    if(legacy||!exact(fusion,['revision','fragments','inspiration','last'])||!integer(fusion.fragments,1,value.draws*5)||!integer(fusion.revision,1,fusion.fragments)||!integer(fusion.inspiration,fusion.fragments,fusion.fragments*5)||fusion.inspiration>value.inspirationEarned-RESEARCH_WELCOME_XP||entries.reduce((sum,[,amount])=>sum+amount,0)+fusion.fragments>value.draws*5)return false;
    if(!exact(last,['revision','recipeId','amount','rate','inspiration'])||last.revision!==fusion.revision||!isRecipe(last.recipeId)||!Object.hasOwn(restaurant.recipeLevels,last.recipeId)||!integer(last.amount,1,fusion.fragments)||last.rate!==restaurantFragmentRarity(isRecipe(last.recipeId)).fusionValue||last.inspiration!==last.amount*last.rate||last.inspiration>fusion.inspiration)return false;
  }
  if(value.draws===0){if(value.lastDraw!==null)return false;}
  else{
    const card=value.lastDraw;
    if(!exact(card,['draw','recipeId','amount'])||card.draw!==value.draws||!isRecipe(card.recipeId)||!Object.hasOwn(restaurant.recipeLevels,card.recipeId)||![1,2,3,5].includes(card.amount))return false;
  }
  if(!legacy&&value.lastGift!==null){
    const gift=value.lastGift;
    if(!exact(gift,['orderId','recipeId','served','tier','grade','amount'])||!/^table-[1-9][0-9]{0,15}$/.test(gift.orderId)||!integer(Number(gift.orderId.slice(6)),1,restaurant.nextOrderId-1)||restaurant.orders.some(order=>order.id===gift.orderId)||!isRecipe(gift.recipeId)||!Object.hasOwn(restaurant.recipeLevels,gift.recipeId)||!integer(gift.served,1,restaurant.stats.served)||!Object.hasOwn(GUEST_GIFTS,gift.tier)||!RESTAURANT_DISH_GRADES.includes(gift.grade))return false;
    const range=restaurantInspirationRange(gift.tier,RESTAURANT_DISH_GRADES.indexOf(gift.grade)+1);
    if(range.grade!==gift.grade||!integer(gift.amount,0,range.max)||gift.amount>value.inspirationEarned-RESEARCH_WELCOME_XP)return false;
  }
  return true;
}

/** Preserve the old balance and shards exactly; past meals are never rerolled. */
export function normalizeRestaurantResearch(research,served=0){
  if(!research)return initialRestaurantResearch(served);
  if(research.version===2)return structuredClone(research);
  return {...structuredClone(research),version:2,inspirationEarned:legacyEarned(research,served),lastGift:null};
}

export function restaurantResearchInfo(restaurant){
  const research=normalizeRestaurantResearch(restaurant.research,restaurant.stats.served),inspiration=research.inspirationEarned-research.draws*RESEARCH_DRAW_XP;
  return {...research,fusionRevision:research.fusion?.revision??0,lastFusion:research.fusion?.last??null,inspiration,experience:research.inspirationEarned,spentExperience:research.draws*RESEARCH_DRAW_XP,availableDraws:Math.floor(inspiration/RESEARCH_DRAW_XP),progressExperience:inspiration%RESEARCH_DRAW_XP,targetExperience:RESEARCH_DRAW_XP,nextDraw:research.draws+1};
}

export function fuseRestaurantResearch(restaurant,recipes,action){
  const info=restaurantResearchInfo(restaurant),recipe=recipes.find(recipe=>recipe.id===action.recipeId);
  if(!recipe?.unlocked)return {ok:false,reason:'先解锁这份菜谱，再整理它的灵感碎片。'};
  if(action.expectedFusion!==info.fusionRevision||action.expectedFragments!==recipe.fragments)return {ok:false,reason:'碎片手账已更新，请按最新数量继续融合。'};
  const surplus=restaurantFragmentSurplus(recipe),room=RESEARCH_INSPIRATION_MAX-info.experience;
  if(!integer(action.amount,1,surplus.surplus))return {ok:false,reason:`先保留升至 SSS 所需的 ${surplus.reserve} 枚碎片，超出部分才可融合。`};
  const inspiration=action.amount*surplus.fusionValue;
  if(inspiration>room)return {ok:false,reason:'这次兑换会超过灵感累计上限，请按手账中的可兑换数量融合。'};
  const research=normalizeRestaurantResearch(restaurant.research,restaurant.stats.served),previous=research.fusion;
  const last={revision:info.fusionRevision+1,recipeId:recipe.id,amount:action.amount,rate:surplus.fusionValue,inspiration};
  research.fragments[recipe.id]-=action.amount;research.inspirationEarned+=inspiration;
  research.fusion={revision:last.revision,fragments:(previous?.fragments??0)+action.amount,inspiration:(previous?.inspiration??0)+inspiration,last};
  return {ok:true,research,fusion:last};
}

/** The seed uses the accepted meal and its actual delivery, never click time.
 * Waiting longer or retrying a collection cannot reroll a customer's gift. */
export function restaurantInspirationGift(restaurant,order,tier,cat){
  const range=restaurantInspirationRange(tier,order.recipeLevel),seed=`gift:${restaurant.openedAt}:${order.id}:${order.createdAt}:${order.servedAt}:${cat}:${range.grade}`;
  const rolled=hash(`${seed}:chance`)%100<range.chance?range.min+hash(`${seed}:amount`)%(range.max-range.min+1):0;
  const earned=earnedInspiration(restaurant.research??initialRestaurantResearch(restaurant.stats.served),restaurant.stats.served);
  return {...range,amount:Math.max(0,Math.min(rolled,RESEARCH_INSPIRATION_MAX-earned))};
}
export function awardRestaurantInspiration(restaurant,order,member){
  const research=normalizeRestaurantResearch(restaurant.research,restaurant.stats.served),gift=restaurantInspirationGift({...restaurant,research},order,member.service?.tier,member.cat);
  research.inspirationEarned+=gift.amount;
  research.lastGift={orderId:order.id,recipeId:order.recipeId,served:restaurant.stats.served,tier:gift.tier,grade:gift.grade,amount:gift.amount};
  return {research,gift};
}

function hash(text){let value=2166136261;for(const char of text)value=Math.imul(value^char.charCodeAt(0),16777619);return value>>>0;}
export function drawRestaurantResearch(restaurant,recipes,draw,now){
  const info=restaurantResearchInfo(restaurant);
  if(draw!==info.nextDraw||info.availableDraws<1)return {ok:false,reason:draw!==info.nextDraw?'抽卡记录已更新，请按最新结果继续。':'灵感不足，招待顾客品尝料理后再来抽取。'};
  const pool=restaurantResearchPool(recipes);
  if(!pool.length)return {ok:false,reason:'先解锁一道菜谱，再来发现美味灵感。'};
  // First discovery teaches the fragment loop; subsequent cards use the full pool.
  const seed=hash(`${restaurant.openedAt}:${restaurant.revision}:${draw}:${now}`),roll=hash(`amount:${seed}`)%100;
  const amount=draw===1?3:draw%10===0?5:roll<60?1:roll<85?2:roll<97?3:5;
  let choice=hash(`recipe:${seed}`)%pool.reduce((sum,item)=>sum+item.weight,0),picked=pool.at(-1);
  for(const item of pool){if(choice<item.weight){picked=item;break;}choice-=item.weight;}
  const recipe=(draw===1?(pool.find(item=>item.recipe.id==='rice')??pool[0]):picked).recipe;
  const research=normalizeRestaurantResearch(restaurant.research,restaurant.stats.served);
  research.draws=draw;research.fragments[recipe.id]=(research.fragments[recipe.id]??0)+amount;research.lastDraw={draw,recipeId:recipe.id,amount};
  return {ok:true,research,card:research.lastDraw};
}
