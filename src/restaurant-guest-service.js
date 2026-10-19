import { RESTAURANT_GUESTS } from './restaurant-customers.js';
import { restaurantDishOrderPool, restaurantGuestTier, pickRestaurantProbability } from './restaurant-order-probabilities.js';

export const RESTAURANT_GUEST_DINING_MS=4500;
export const RESTAURANT_ADVANCED_COURSES=2;
const advanced=RESTAURANT_GUESTS.filter(guest=>guest.advanced);
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const orderNumber=id=>typeof id==='string'&&/^table-[1-9][0-9]{0,15}$/.test(id)?Number(id.slice(6)):NaN;

/** The catalog fixes each tier. Neither a request nor saved reward amount can
 * promote a guest, shorten its visit or choose a larger completion bonus. */
export function restaurantGuestServiceDefinition(cat){
  const index=advanced.findIndex(guest=>guest.id===cat);
  return index<0?null:{tier:index<8?'silver':'gold',rounds:RESTAURANT_ADVANCED_COURSES,bonusGold:index<8?1:2};
}
export function initialRestaurantGuestService(cat){
  const definition=restaurantGuestServiceDefinition(cat);
  return definition?{version:1,tier:definition.tier,round:1,rounds:definition.rounds,history:[]}:null;
}
export function restaurantGuestHasNextCourse(member){
  return Boolean(member.service&&member.service.round<member.service.rounds);
}
export function restaurantGuestCompletionBonus(member){
  const definition=restaurantGuestServiceDefinition(member.cat),service=member.service;
  return definition&&service&&service.round===definition.rounds&&service.tier===definition.tier?definition.bonusGold:0;
}
export function restaurantGuestCourseStart(member,party){
  return member.service?.history.at(-1)?.collectedAt??party.seatedAt;
}

/** Retain one bounded receipt per prior meal. The active order changes, while
 * the party, character, chair and original arrival clock remain untouched. */
export function nextRestaurantGuestService(member,order,collectedAt){
  if(!restaurantGuestHasNextCourse(member)||!integer(order?.servedAt)||!integer(collectedAt,order.servedAt+RESTAURANT_GUEST_DINING_MS))return null;
  const receipt={orderId:order.id,recipeId:order.recipeId,createdAt:order.createdAt,servedAt:order.servedAt,collectedAt};
  return {...member.service,round:member.service.round+1,history:[...member.service.history,receipt]};
}

export function validRestaurantGuestService(member,party,restaurant){
  if(!Object.hasOwn(member,'service'))return true; // pre-course saves
  const service=member.service,definition=restaurantGuestServiceDefinition(member.cat);
  if(!definition||!exact(service,['version','tier','round','rounds','history'])||service.version!==1||service.tier!==definition.tier||service.rounds!==definition.rounds||!integer(service.round,1,definition.rounds)||!Array.isArray(service.history)||service.history.length!==service.round-1)return false;
  let createdAt=party.seatedAt,previousId=0;
  for(const receipt of service.history){
    if(!exact(receipt,['orderId','recipeId','createdAt','servedAt','collectedAt'])||!integer(orderNumber(receipt.orderId),previousId+1,restaurant.nextOrderId-1)||!Object.hasOwn(restaurant.recipeLevels,receipt.recipeId)||receipt.createdAt!==createdAt||!integer(receipt.servedAt,receipt.createdAt)||!integer(receipt.collectedAt,receipt.servedAt+RESTAURANT_GUEST_DINING_MS)||restaurant.orders.some(order=>order.id===receipt.orderId))return false;
    createdAt=receipt.collectedAt;previousId=orderNumber(receipt.orderId);
  }
  return integer(orderNumber(member.orderId),previousId+1,restaurant.nextOrderId-1);
}

/** Pick only from live, unlocked recipes and avoid repeating the first meal.
 * Timestamp and next ID make retry/reload deterministic on the server. */
export function nextRestaurantGuestRecipe(recipes,previousId,cat,nextOrderId,now){
  const available=restaurantDishOrderPool(recipes,restaurantGuestTier(cat)).map(item=>item.recipe);
  const choices=available.filter(recipe=>recipe.id!==previousId);
  if(!choices.length)return available[0]||null;
  let seed=2166136261;
  for(const character of `${cat}:${nextOrderId}:${now}`)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
  return pickRestaurantProbability(restaurantDishOrderPool(choices,restaurantGuestTier(cat)),seed/4294967296).recipe;
}
