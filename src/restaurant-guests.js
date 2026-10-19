import { restaurantTableCapacity } from './restaurant-facilities.js';
import { initialRestaurantGuestService, validRestaurantGuestService, restaurantGuestCourseStart, restaurantGuestHasNextCourse } from './restaurant-guest-service.js';
import { RESTAURANT_GUEST_CATS, eligibleRestaurantGuestCats } from './restaurant-customers.js';
import { restaurantGuestArrivalPool, restaurantDishOrderPool, restaurantGuestTier, pickRestaurantProbability } from './restaurant-order-probabilities.js';
import { restaurantQueuePosition } from './restaurant-street.js';
export { RESTAURANT_GUESTS, RESTAURANT_GUEST_CATS } from './restaurant-customers.js';
export const RESTAURANT_ARRIVAL_MS=6000;
export const RESTAURANT_PAIR_CHANCE=.3;
export const RESTAURANT_TABLES=Object.freeze([
  [24.5,31.4],[75.3,31.4],[23.7,43.3],[76.2,43.3],
  [22.8,55.1],[77.3,55.1],[48,29.6],[48,51.6],
].map(([x,y])=>Object.freeze({x,y})));
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const orderId=value=>typeof value==='string'&&/^table-[1-9][0-9]{0,15}$/.test(value);
const clamp=value=>Math.max(0,Math.min(1,value));

/** One party owns a table until every member has paid. Legacy orders remain intact. */
export function normalizeRestaurantParties(restaurant){
  const parties=restaurant.parties??restaurant.orders.map((order,index)=>({id:`party-${order.id.slice(6)}`,table:index,arrivedAt:order.createdAt,seatedAt:order.createdAt,members:[{cat:RESTAURANT_GUEST_CATS[index%4],orderId:order.id}]}));
  return parties.map(party=>({...party,members:party.members.map(member=>{
    const service=!Object.hasOwn(member,'service')&&restaurant.orders.some(order=>order.id===member.orderId)?initialRestaurantGuestService(member.cat):null;
    return service?{...member,service}:member;
  })}));
}
export function validRestaurantParties(restaurant){
  if(!Object.hasOwn(restaurant,'parties'))return restaurant.orders.length<=restaurantTableCapacity(restaurant.levels.tables);
  if(!Array.isArray(restaurant.parties)||restaurant.parties.length>restaurantTableCapacity(restaurant.levels.tables)||restaurant.orders.length>2*restaurantTableCapacity(restaurant.levels.tables))return false;
  const tables=new Set(),ids=new Set(),members=new Set();let receipts=0;
  for(const party of restaurant.parties){
    if(!exact(party,['id','table','arrivedAt','seatedAt','members',...(Object.hasOwn(party??{},'fromQueue')?['fromQueue']:[])])||(Object.hasOwn(party??{},'fromQueue')&&party.fromQueue!==true)||typeof party.id!=='string'||!/^party-[1-9][0-9]{0,15}$/.test(party.id)||!integer(Number(party.id.slice(6)),1,restaurant.nextOrderId-1)||ids.has(party.id)||!integer(party.table,0,restaurantTableCapacity(restaurant.levels.tables)-1)||tables.has(party.table)||!integer(party.arrivedAt,restaurant.openedAt)||!integer(party.seatedAt)||![party.arrivedAt,party.arrivedAt+RESTAURANT_ARRIVAL_MS].includes(party.seatedAt)||!Array.isArray(party.members)||party.members.length<1||party.members.length>2)return false;
    ids.add(party.id);tables.add(party.table);
    let active=0;
    for(const member of party.members){
      if(!exact(member,['cat','orderId',...(Object.hasOwn(member||{},'service')?['service']:[])])||!RESTAURANT_GUEST_CATS.includes(member.cat)||!orderId(member.orderId)||!integer(Number(member.orderId.slice(6)),1,restaurant.nextOrderId-1)||members.has(member.orderId))return false;
      members.add(member.orderId);
      if(!validRestaurantGuestService(member,party,restaurant))return false;
      for(const receipt of member.service?.history??[]){
        if(members.has(receipt.orderId))return false;
        members.add(receipt.orderId);receipts++;
      }
      const order=restaurant.orders.find(order=>order.id===member.orderId);
      if(order){if(order.createdAt!==restaurantGuestCourseStart(member,party))return false;active++;}
      else if(restaurantGuestHasNextCourse(member))return false;
    }
    if(!active)return false;
  }
  return receipts<=restaurant.stats.served&&restaurant.orders.every(order=>members.has(order.id));
}

/** The server derives party size, distinct cats and distinct unlocked dishes. */
export function restaurantArrivalPlan(restaurant,recipes,action,actor,now,waiting=null){
  let seed=2166136261;
  for(const char of `${now}:${restaurant.nextOrderId}:${actor?.id}`)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const size=waiting?.cats.length??action.partySize??(random()<RESTAURANT_PAIR_CHANCE?2:1),dishes=[...recipes],cats=eligibleRestaurantGuestCats(restaurant,now);
  const table=Array.from({length:restaurantTableCapacity(restaurant.levels.tables)},(_,i)=>i).find(index=>!restaurant.parties.some(party=>party.table===index));
  const members=Array.from({length:size},(_,seat)=>{
    const cat=waiting?.cats[seat]??pickRestaurantProbability(restaurantGuestArrivalPool(cats),random()).cat;
    const recipe=seat===0&&action.recipeId?dishes.find(recipe=>recipe.id===action.recipeId):pickRestaurantProbability(restaurantDishOrderPool(dishes,restaurantGuestTier(cat)),random()).recipe;
    if(cats.includes(cat))cats.splice(cats.indexOf(cat),1);dishes.splice(dishes.indexOf(recipe),1);
    return {cat,recipe};
  });
  return {id:`party-${restaurant.nextOrderId}`,table,arrivedAt:now,seatedAt:now+RESTAURANT_ARRIVAL_MS,members,...(waiting?{fromQueue:true}:{})};
}

export function restaurantSeat(table,seat=0){
  const position=RESTAURANT_TABLES[table]||RESTAURANT_TABLES[0];
  return {x:position.x+(seat===0?-9.3:9.3),y:position.y+3.6};
}

/** Foot positions follow street → doorway → central aisle → chair, with no jump. */
export function restaurantGuestRoute(table,seat=0,{layoutCapacity=6,fromQueue=false}={}){
  const target=restaurantSeat(table,seat),row=RESTAURANT_TABLES[table]||RESTAURANT_TABLES[0];
  const points=[fromQueue?restaurantQueuePosition(0,seat):{x:-9,y:14.6},{x:50,y:14.6},{x:50,y:22}];
  // Only the expanded eight-table layout has tables in the central aisle.
  if(layoutCapacity>6&&table!==6&&row.y>29.6)points.push({x:50,y:25},{x:61,y:25},{x:61,y:35.6},{x:50,y:35.6});
  if(layoutCapacity>6&&table!==7&&row.y>51.6)points.push({x:50,y:47},{x:61,y:47},{x:61,y:57.6},{x:50,y:57.6});
  points.push({x:50,y:row.y+8},{x:target.x,y:row.y+8},target);
  return points;
}
export function restaurantPathPosition(points,progress){
  if(progress<=0)return {...points[0],facing:points[1]?.x>points[0].x?'right':'front'};
  if(progress>=1)return {...points.at(-1),facing:'front'};
  const distances=points.slice(1).map((point,index)=>Math.hypot(point.x-points[index].x,(point.y-points[index].y)*1672/940));
  const total=distances.reduce((sum,distance)=>sum+distance,0);let remaining=clamp(progress)*total;
  for(let index=0;index<distances.length;index++){
    if(remaining<=distances[index]||index===distances.length-1){
      const t=distances[index]===0?1:clamp(remaining/distances[index]),from=points[index],to=points[index+1];
      return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,facing:Math.abs(to.x-from.x)>.01?(to.x>from.x?'right':'left'):to.y<from.y?'back':'front'};
    }
    remaining-=distances[index];
  }
  return {...points.at(-1),facing:'front'};
}
export function restaurantGuestMotion(party,seat,now,{replayAt=null,departAt=null,reducedMotion=false,layoutCapacity=6}={}){
  const points=restaurantGuestRoute(party.table,seat,{layoutCapacity,fromQueue:party.fromQueue&&departAt===null}),start=replayAt??party.arrivedAt;
  if(departAt!==null){const progress=reducedMotion?1:clamp((now-departAt)/RESTAURANT_ARRIVAL_MS);return {...restaurantPathPosition([...points].reverse(),progress),progress,phase:progress===1?'gone':'leaving'};}
  const delay=seat*320,duration=party.seatedAt===party.arrivedAt&&replayAt===null?0:RESTAURANT_ARRIVAL_MS;
  const progress=reducedMotion||duration===0?1:clamp((now-start-delay)/(duration-delay));
  const position=restaurantPathPosition(points,progress);
  return {...position,facing:progress===1?(seat===0?'right':'left'):position.facing,progress,phase:progress===1?'seated':'arriving'};
}
