import { specialRestaurantRecipe } from '../src/restaurant-economy.js';
import { normalizeRestaurant, validRestaurant, restaurantActionResult } from '../src/restaurant.js';
import { RESTAURANT_GUESTS, eligibleRestaurantGuestCats } from '../src/restaurant-customers.js';
import { restaurantDecoration } from '../src/restaurant-decor.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { normalizeStaffTraining, staffMaxEnergy } from '../src/restaurant-staff-training.js';
import { initialRestaurantGuestService } from '../src/restaurant-guest-service.js';

/** Explicitly isolated test fixture, never a shared/server intent. It prepares
 * the actual requirements, then uses the real arrival/order/reward pipeline. */
export function restaurantGuestDebugResult(state,command,now=Date.now()){
  const reject=message=>({ok:false,message});
  if(!command||Object.keys(command).length!==2||command.mode!=='guest'||typeof command.guestId!=='string')return reject('这项顾客测试操作无效。');
  const guest=RESTAURANT_GUESTS.find(item=>item.id===command.guestId&&item.advanced);
  if(!guest||!Number.isSafeInteger(now)||now<0||!validRestaurant(state?.restaurant)||now<state.restaurant.openedAt)return reject('测试小馆尚未准备好。');
  const next=structuredClone(state),r=normalizeRestaurant(state.restaurant,now),seen=[...r.seenGuests];next.restaurant=r;r.lastInteractionAt=Math.max(r.lastInteractionAt,now);
  r.orders=[];r.parties=[];r.construction=null;
  for(const requirement of guest.requirements){
    if(requirement.kind==='level')r.stats.experience=Math.max(r.stats.experience,levelStartXp(requirement.minimum));
    if(requirement.kind==='staff')r.staff=Math.max(r.staff,requirement.minimum);
    if(requirement.kind==='facility')r.levels[requirement.id]=Math.max(r.levels[requirement.id],requirement.minimum);
    if(requirement.kind==='recipe'&&specialRestaurantRecipe(requirement.id)){
      if(!r.ownedSpecialRecipes.includes(requirement.id))r.ownedSpecialRecipes.push(requirement.id);
      r.recipeLevels[requirement.id]??=1;
    }
    if(requirement.kind==='decoration'){
      const suite=restaurantDecoration(requirement.id);
      r.ownedDecorations=[...new Set([...(r.ownedDecorations??[]),suite.id])];
      if(!r.ownedThemes.includes(suite.theme))r.ownedThemes.push(suite.theme);
      r.theme=suite.theme;r.decorationId=suite.id;
    }
    if(requirement.kind==='theme'){
      if(!r.ownedThemes.includes(requirement.id))r.ownedThemes.push(requirement.id);
      r.theme=requirement.id;delete r.decorationId;
    }
  }
  r.staffTraining=normalizeStaffTraining(r.staffTraining,now,r.staff);
  for(const record of Object.values(r.staffTraining)){
    record.energy=staffMaxEnergy(record.levels);record.energyAt=now;
    if(record.energyMode==='rest-room')record.rest=null;
  }
  if(!validRestaurant(r)||!eligibleRestaurantGuestCats(r,now).includes(guest.id))return reject('这位顾客的测试条件尚未准备完成。');
  const arrival=restaurantActionResult(next,{type:'restaurant-arrive',partySize:1,recipeId:'donut'},{id:'restaurant-guest-debug',name:'顾客测试'},now);
  if(!arrival.ok)return reject(arrival.reason);
  next.restaurant=arrival.restaurant;
  const member=next.restaurant.parties.at(-1).members[0];
  member.cat=guest.id;member.service=initialRestaurantGuestService(guest.id);
  next.restaurant.seenGuests=[...new Set([...seen,guest.id])];next.updatedAt=now;
  if(!validRestaurant(next.restaurant))return reject('顾客测试状态未通过检查。');
  return {ok:true,state:next,workers:r.staff+1,message:`${guest.name}正在进店，已准备实际解锁条件；吃完第 1 餐后再点第 2 餐。仅影响本次测试。`};
}
