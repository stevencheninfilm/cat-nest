import { RESTAURANT_GUEST_CATS } from './restaurant-customers.js';

export const RESTAURANT_WAITING_LIMIT=2;
export const RESTAURANT_WAIT_MIN_MS=90000;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

/** Waiting is a small authoritative FIFO, separate from occupied tables/orders.
 * Walking passers-by and conversations are local scenery, never encounters. */
export function validRestaurantWaitingParties(restaurant){
  if(!Object.hasOwn(restaurant,'waitingParties'))return true;
  const queue=restaurant.waitingParties;
  return Array.isArray(queue)&&queue.length<=RESTAURANT_WAITING_LIMIT&&new Set(queue.map(party=>party?.id)).size===queue.length&&queue.every((party,index)=>
    exact(party,['id','arrivedAt','expiresAt','cats'])&&typeof party.id==='string'&&/^wait-[0-9]{1,16}-[1-9][0-9]{0,15}$/.test(party.id)&&integer(party.arrivedAt)&&party.arrivedAt>=restaurant.openedAt&&integer(party.expiresAt)&&party.expiresAt>=party.arrivedAt+RESTAURANT_WAIT_MIN_MS&&party.expiresAt<=party.arrivedAt+120000&&(!index||party.arrivedAt>=queue[index-1].arrivedAt)&&Array.isArray(party.cats)&&party.cats.length>=1&&party.cats.length<=2&&new Set(party.cats).size===party.cats.length&&party.cats.every(cat=>RESTAURANT_GUEST_CATS.includes(cat)));
}

export function restaurantWaitingParties(restaurant,now){
  return (restaurant.waitingParties??[]).filter(party=>party.expiresAt>now);
}

export function createRestaurantWaitingParty(restaurant,cats,now){
  return {id:`wait-${now}-${restaurant.nextOrderId}`,arrivedAt:now,expiresAt:now+RESTAURANT_WAIT_MIN_MS+(now%30001),cats:[...cats]};
}

export function restaurantQueuePosition(group,seat=0){return {x:65+group*18+seat*7,y:14.6+seat*.45};}

/** Polling, redraws and save acknowledgements must not reroll the clock.
 * A newly freed table starts a fresh pause; queued visitors get priority. */
export function createRestaurantArrivalRhythm({random=Math.random}={}){
  const between=(min,max)=>Math.round(min+(max-min)*Math.max(0,Math.min(1,random())));
  let nextAt=null,previousTables=null,active=false;
  function defer(now,queued=false){nextAt=now+between(queued?6500:8000,queued?9500:15000);}
  return {
    defer,
    reset(){nextAt=null;previousTables=null;active=false;},
    poll(info,now,{enabled=true,blocked=false}={}){
      const available=info.availableTables,waiting=info.waitingParties?.length??0;
      if(!enabled){active=false;previousTables=available;return null;}
      if(!active){active=true;defer(now,waiting>0);previousTables=available;return null;}
      if(previousTables!==null&&available>previousTables)defer(now,waiting>0);
      previousTables=available;
      if(blocked)return null;
      if(now<nextAt)return null;
      if(available>0){defer(now,waiting>0);return {type:'restaurant-arrive'};}
      nextAt=now+between(12000,20000);
      return waiting<RESTAURANT_WAITING_LIMIT&&random()<.55?{type:'restaurant-wait'}:null;
    },
  };
}
