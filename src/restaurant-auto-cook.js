import { restaurantActionResult, restaurantInfo } from './restaurant.js';
import { RESTAURANT_AUTO_COOK_LEVEL, restaurantExperienceInfo } from './restaurant-progression.js';

export const AUTO_COOK_PREFERENCE='catnest.restaurant.autoCook';

/** Automation submits the same durable step intents as a player. It never
 * accepts a new request, shortens a timer, skips a reservation or collects XP. */
export function nextRestaurantAutoCookAction(state,now=Date.now(),pendingSteps=[]){
  const info=restaurantInfo(state,now);
  if(info.level<RESTAURANT_AUTO_COOK_LEVEL||info.decorationInfo.construction)return null;
  const orders=[...(info.kitchen?.orders??[])].filter(order=>order.nextStep&&order.acceptedAt!==null)
    .sort((a,b)=>a.acceptedAt-b.acceptedAt||a.id.localeCompare(b.id,undefined,{numeric:true}));
  for(const order of orders){
    const action={type:'restaurant-kitchen-step',orderId:order.id,stepId:order.nextStep.id};
    if(pendingSteps.includes(`${action.orderId}:${action.stepId}`))continue;
    if(restaurantActionResult(state,action,undefined,now).ok)return action;
  }
  return null;
}

export function createRestaurantAutoCook({getState,getAvailability=()=>({ready:true}),onAction,preferences=null,now=Date.now,onStep=()=>{}}){
  let enabled=false,pumping=false;
  try{enabled=preferences?.getItem(AUTO_COOK_PREFERENCE)==='1';}catch{}
  const unlocked=()=>restaurantExperienceInfo(getState().restaurant).level>=RESTAURANT_AUTO_COOK_LEVEL;
  return {
    get enabled(){return enabled&&unlocked();},
    toggle(){
      if(!unlocked())return false;
      enabled=!enabled;
      try{preferences?.setItem(AUTO_COOK_PREFERENCE,enabled?'1':'0');}catch{}
      return true;
    },
    tick({active=true}={}){
      const availability=getAvailability();
      if(pumping||!active||!enabled||!(availability.ready??availability.connected)||availability.savePhase==='error'||!unlocked())return false;
      const action=nextRestaurantAutoCookAction(getState(),now(),availability.pendingKitchenSteps??[]);
      if(!action)return false;
      pumping=true;
      try{
        if(onAction(action)===false)return false;
        onStep(action);return true;
      }finally{pumping=false;}
    },
  };
}

export function paintRestaurantAutoCook(button,info,enabled){
  if(!button)return;
  const unlocked=info.level>=RESTAURANT_AUTO_COOK_LEVEL,active=unlocked&&enabled;
  button.dataset.locked=String(!unlocked);
  button.setAttribute('aria-pressed',String(active));
  button.setAttribute('aria-label',unlocked?`一键制作，已${active?'开启':'关闭'}，点击${active?'关闭':'开启'}`:`一键制作，小馆 Lv.${RESTAURANT_AUTO_COOK_LEVEL} 解锁`);
  button.title=unlocked?(active?'自动制作至上桌 · 点击切回手动':'开启后，点击顾客点餐即可制作至上桌'):`小馆 Lv.${RESTAURANT_AUTO_COOK_LEVEL} 解锁一键制作`;
  button.querySelector('small').textContent=unlocked?(active?'已开启':'一键制作'):`Lv.${RESTAURANT_AUTO_COOK_LEVEL}`;
}
