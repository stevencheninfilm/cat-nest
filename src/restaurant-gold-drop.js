import { RESTAURANT_TABLES, restaurantSeat } from './restaurant-guests.js';

export const RESTAURANT_GOLD_DROP_ART=new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/gold-v1/gold-fish.webp`,globalThis.document?.baseURI||import.meta.url).href;
export const GOLD_DROP_FLIGHT_MS=760;
const HOLD_MS=1800,FADE_MS=260,MAX_RECORDS=128,MAX_VISIBLE=12;

/** Percent coordinates keep the parabola attached to the scene as it scales. */
export function restaurantGoldDropFrames(from,to){
  const control={x:(from.x+to.x)/2,y:Math.min(from.y,to.y)-8};
  return Array.from({length:25},(_,index)=>{
    const t=index/24,u=1-t;
    return {offset:t,left:`${u*u*from.x+2*u*t*control.x+t*t*to.x}%`,top:`${u*u*from.y+2*u*t*control.y+t*t*to.y}%`,opacity:Math.min(1,.7+t*3),transform:`translate(-50%,-50%) rotate(${-18*u}deg) scale(${.85+.15*t+.12*Math.sin(Math.PI*t)})`};
  });
}

/** Local visual feedback only: the existing collection action owns all money.
 * Keep records beyond the animation so a rollback can cancel/re-enable a retry.
 */
export function createRestaurantGoldDrops({stage,layer,setTimer=setTimeout,clearTimer=clearTimeout,reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}){
  const records=new Map();
  function clear(record){
    for(const timer of record.timers)clearTimer(timer);
    record.timers.clear();record.motion?.cancel();record.motion=null;record.node?.remove();record.node=null;
  }
  function cancel(id){const record=records.get(id);if(record)clear(record);records.delete(id);}
  function later(record,callback,delay){
    const timer=setTimer(()=>{record.timers.delete(timer);if(records.get(record.id)===record)callback();},delay);
    record.timers.add(timer);
  }
  function prepare(order){
    const table=RESTAURANT_TABLES[order?.table];
    if(order?.status!=='collectible'||!table||![0,1].includes(order.seat)||!Number.isSafeInteger(order.rewardGold)||order.rewardGold<=0||records.has(order.id))return false;
    const box=stage.getBoundingClientRect();if(box.width<=0||box.height<=0)return false;
    const actor=stage.querySelector(`[data-guest="${order.partyId}:${order.seat}"]`),body=actor?.getBoundingClientRect();
    const seat=restaurantSeat(order.table,order.seat);
    const from=body?.width>0?{x:(body.left+body.width*.55-box.left)/box.width*100,y:(body.top+body.height*.58-box.top)/box.height*100}:{x:seat.x,y:seat.y-5};
    records.set(order.id,{id:order.id,amount:order.rewardGold,from,to:{x:table.x+(order.seat===0?-3:3),y:table.y-.6},removed:false,played:false,node:null,motion:null,timers:new Set()});
    while(records.size>MAX_RECORDS)cancel(records.keys().next().value);
    return true;
  }
  function play(id){
    const record=records.get(id);if(!record||record.played)return false;
    record.played=true;
    const visible=[...records.values()].filter(item=>item.node);
    if(visible.length>=MAX_VISIBLE)clear(visible[0]);
    const node=layer.ownerDocument.createElement('span');record.node=node;
    node.className='rg-gold-drop';node.dataset.rGoldDrop=id;
    node.setAttribute('role','img');node.setAttribute('aria-label',`金鱼干 +${record.amount}`);
    node.innerHTML=`<i class="rg-gold-halo"></i><span class="rg-gold-token"><img src="${RESTAURANT_GOLD_DROP_ART}" alt="" draggable="false"/><strong>+${record.amount}</strong></span><i class="rg-gold-spark rg-gold-spark-a">✦</i><i class="rg-gold-spark rg-gold-spark-b">✧</i>`;
    node.style.left=`${record.from.x}%`;node.style.top=`${record.from.y}%`;layer.append(node);
    function land(){
      node.style.left=`${record.to.x}%`;node.style.top=`${record.to.y}%`;
      record.motion?.cancel();record.motion=null;node.classList.add('is-landed');
      later(record,()=>{node.classList.add('is-leaving');later(record,()=>clear(record),FADE_MS);},HOLD_MS);
    }
    if(reducedMotion()||typeof node.animate!=='function')land();
    else{
      try{record.motion=node.animate(restaurantGoldDropFrames(record.from,record.to),{duration:GOLD_DROP_FLIGHT_MS,easing:'linear',fill:'forwards'});later(record,land,GOLD_DROP_FLIGHT_MS);}
      catch{land();}
    }
    return true;
  }
  function sync(info){
    const live=new Set(info.orders.map(order=>order.id));
    for(const record of records.values()){
      if(!live.has(record.id))record.removed=true;
      else if(record.removed)cancel(record.id); // A rejected collection restored it.
    }
  }
  function reset(){for(const record of records.values())clear(record);records.clear();}
  return {prepare,play,cancel,sync,reset,destroy:reset};
}
