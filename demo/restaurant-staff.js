import { restaurantGuestDebugResult } from './restaurant-guests.js';
import { restaurantResearchDebugResult } from './restaurant-research.js';
import { RESTAURANT_STAFF, RESTAURANT_RECIPES, normalizeRestaurant, validRestaurant, restaurantActionResult } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { staffAbilitySnapshot, normalizeStaffTraining, staffMaxEnergy, createStaffExhaustionTestPreset, STAFF_REST_ROOM_ENTRANCE, STAFF_REST_ROOM_POSITION, STAFF_ENERGY_RECOVERY_MS } from '../src/restaurant-staff-training.js';
import { RESTAURANT_ARRIVAL_MS } from '../src/restaurant-guests.js';

const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const reject=message=>({ok:false,message});

/** Isolated test fixtures. This is deliberately outside the shared action
 * reducer: no debug intent or free recruitment is accepted by the real server. */
export function restaurantStaffDebugResult(state,command,now=Date.now()) {
  if(command?.mode==='research-fusion')return restaurantResearchDebugResult(state,command,now);
  if(command?.mode==='guest')return restaurantGuestDebugResult(state,command,now);
  const unlock=exact(command,['mode','staffId'])&&command.mode==='unlock'&&RESTAURANT_STAFF.some(employee=>employee.id===command.staffId);
  const preset=exact(command,['mode','staff'])&&command.mode==='preset'&&[0,3,6].includes(command.staff);
  const rehearse=exact(command,['mode'])&&command.mode==='rehearse';
  const reset=exact(command,['mode'])&&command.mode==='reset';
  const stamina=exact(command,['mode'])&&command.mode==='stamina';
  const restSix=exact(command,['mode'])&&command.mode==='rest-six';
  const recipes=exact(command,['mode'])&&command.mode==='recipes';
  if(!unlock&&!preset&&!rehearse&&!reset&&!stamina&&!restSix&&!recipes)return reject('这项餐厅测试操作无效。');
  if(!Number.isSafeInteger(now)||now<0||!validRestaurant(state?.restaurant)||now<state.restaurant.openedAt)return reject('测试小馆尚未准备好。');
  const next=structuredClone(state),restaurant=normalizeRestaurant(state.restaurant,now);
  if(restaurant.revision>=Number.MAX_SAFE_INTEGER-8)return reject('请刷新测试小馆后再试。');
  next.restaurant=restaurant;restaurant.lastInteractionAt=Math.max(restaurant.lastInteractionAt,now);
  if(reset){
    // Cancelling demo assignments releases them now, without granting energy
    // for the time they were previously waiting on an unfinished order.
    for(const record of Object.values(restaurant.staffTraining))if(!record.rest)record.energyAt=now;
  }
  if(recipes){
    restaurant.progression.legacyRecipes=[...new Set([...restaurant.progression.legacyRecipes,...RESTAURANT_RECIPES.map(recipe=>recipe.id)])];
    restaurant.ownedSpecialRecipes=[...new Set([...restaurant.ownedSpecialRecipes,...SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id)])];
    for(const recipe of SPECIAL_RESTAURANT_RECIPES)restaurant.recipeLevels[recipe.id]??=1;
    restaurant.revision++;next.updatedAt=now;
    if(!validRestaurant(restaurant))return reject('菜谱解锁状态未通过检查，请刷新后再试。');
    return {ok:true,state:next,workers:restaurant.staff+1,message:`已解锁全部 ${RESTAURANT_RECIPES.length+SPECIAL_RESTAURANT_RECIPES.length} 道菜谱，保留研发等级与已接订单；仅影响本次测试存档。`};
  }
  if(restSix){
    restaurant.staff=RESTAURANT_STAFF.length;restaurant.orders=[];restaurant.parties=[];restaurant.waitingParties=[];
    restaurant.staffTraining=normalizeStaffTraining(restaurant.staffTraining,now,restaurant.staff);
    for(const [id,record] of Object.entries(restaurant.staffTraining)){
      const maxEnergy=staffMaxEnergy(record.levels);
      if(id==='worker-1'){
        record.energy=maxEnergy;record.energyAt=now;if(record.energyMode==='rest-room')record.rest=null;
        continue;
      }
      // A real persisted door journey takes 900ms at exhausted speed. Each
      // employee then recovers independently using their existing capacity.
      const arriveAt=now+900;
      record.energy=0;record.energyAt=arriveAt;record.energyMode='rest-room';
      record.rest={...staffAbilitySnapshot(record),departAt:now,arriveAt,fullAt:arriveAt+maxEnergy*STAFF_ENERGY_RECOVERY_MS,speedLevel:record.levels.speed,segments:[{phase:'rest-walk',startAt:now,endAt:arriveAt,from:{...STAFF_REST_ROOM_ENTRANCE},to:{...STAFF_REST_ROOM_POSITION},zoneId:null,stepId:'rest',carrying:null}]};
    }
    restaurant.revision++;next.updatedAt=now;
    if(!validRestaurant(restaurant))return reject('休息室测试状态未通过检查，请刷新后再试。');
    return {ok:true,state:next,workers:restaurant.staff+1,message:'6 位员工同时休息，主厨留岗；测试订单已清空。点击右侧「休息」展开状态。'};
  }
  if(stamina){
    const training=createStaffExhaustionTestPreset(restaurant,now);
    if(!training)return reject('主厨正在执行订单，请先完成或重置测试订单。');
    restaurant.staffTraining=training;restaurant.revision++;next.updatedAt=now;
    if(!validRestaurant(restaurant))return reject('体力测试状态未通过检查，请刷新后再试。');
    return {ok:true,state:next,workers:restaurant.staff+1,message:'主厨体力设为 1：点击下一道工序，观察慢速完工、前往休息室和恢复倒计时。'};
  }
  const employee=unlock?RESTAURANT_STAFF.find(employee=>employee.id===command.staffId):null;
  restaurant.staff=unlock?Math.max(restaurant.staff,RESTAURANT_STAFF.indexOf(employee)+1):reset?restaurant.staff:rehearse?6:command.staff;
  restaurant.staffTraining=normalizeStaffTraining(restaurant.staffTraining,now,restaurant.staff);
  if(!unlock){
    restaurant.orders=[];restaurant.parties=[];restaurant.waitingParties=[];
    if(!reset)for(const record of Object.values(restaurant.staffTraining)){
      record.energy=staffMaxEnergy(record.levels);record.energyAt=now;if(record.energyMode==='rest-room')record.rest=null;
    }
  }
  restaurant.revision++;
  if(rehearse){
    restaurant.levels.tables=4;
    for(let i=0;i<RESTAURANT_STAFF.length+1;i++){
      // A scripted compatibility rehearsal intentionally uses the legacy timed
      // workflow. Ordinary single-dish tests still require every player click.
      const result=restaurantActionResult(next,{type:'restaurant-start',recipeId:i%2?'coffee':'rice'},{id:'restaurant-debug',name:'测试终端'},now+RESTAURANT_ARRIVAL_MS);
      if(!result.ok)return reject(result.reason);
      next.restaurant=result.restaurant;
      next.restaurant.parties.at(-1).arrivedAt=now;
    }
  }
  next.updatedAt=now;
  if(!validRestaurant(next.restaurant))return reject('员工测试状态未通过检查，请刷新后再试。');
  const workers=next.restaurant.staff+1;
  return {ok:true,state:next,workers,message:reset?'餐厅已重置，顾客和订单已清空；点击单菜测试里的菜品，迎接点这道菜的顾客。':unlock?`已解锁至${employee.name}，主厨与 ${next.restaurant.staff} 位员工已在场；未扣费。`:rehearse?'全员动线演练已开始：7 位员工、8 张餐桌、7 份订单，顾客入座后开始制作。':`已切换为${workers===1?'仅主厨':workers===4?'原班 4 人':'全员 7 人'}，测试订单已清空，员工体力已恢复。`};
}
