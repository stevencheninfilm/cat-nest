import { RESTAURANT_DECORATION_MAX_COOK_SPEED } from './restaurant-decor.js';
import { RESTAURANT_FACILITY_MAX_LEVEL, restaurantTableCapacity } from './restaurant-facilities.js';
import { recipeStepEnergyBase, validRecipeStepEnergyBase } from './restaurant-recipe-energy.js';
import { KITCHEN_FLOWS, KITCHEN_ORIGIN, KITCHEN_TABLE_POSITIONS, kitchenStepDuration, kitchenWorkerMultipliers, kitchenWorkerIdlePoint, KITCHEN_WALK_MS_PER_UNIT } from './restaurant-kitchen.js';
import { INTERACTIVE_KITCHEN_ZONES } from './restaurant-kitchen-layout.js';
import { kitchenStationPath, kitchenDeliveryPath, kitchenReturnPath, kitchenRestPath } from './restaurant-kitchen-routing.js';
import { normalizeStaffTraining, staffMaxEnergy, staffEnergyBase, validStaffEnergyBase, workerAbilitySnapshot, workerStepEnergyCost, workerEnergyReadyAt, reserveWorkerEnergy, STAFF_ENERGY_RECOVERY_MS, STAFF_REST_ROOM_ENTRANCE, STAFF_REST_ROOM_POSITION, STAFF_EXHAUSTED_DURATION_MULTIPLIER, staffRestProjection } from './restaurant-staff-training.js';

/** Version 2 is an intent log: every run exists only after an authoritative
 * player click. Reading an idle workflow never schedules its next operation.
 * Imports from restaurant-kitchen.js are read only inside functions so the
 * shared module can dispatch v1/v2 without initializing a circular constant. */
const MAX=Number.MAX_SAFE_INTEGER;
const integer=(value,min=0,max=MAX)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const LEVEL_KEYS=['speed','stamina','endurance','skill'];
const validLevels=value=>exact(value,LEVEL_KEYS)&&Object.values(value).every(level=>integer(level,1,10));
const sameLevels=(a,b)=>LEVEL_KEYS.every(key=>a[key]===b[key]);
const validPoint=value=>exact(value,['x','y'])&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.x<=100&&value.y>=0&&value.y<=100;
const samePoint=(a,b)=>a.x===b.x&&a.y===b.y;
const clonePoint=point=>({x:point.x,y:point.y});
const clamp=value=>Math.max(0,Math.min(1,value));
const maxEnergy=run=>staffMaxEnergy(run.energyLevels,staffEnergyBase(run));
const energyBaseKeys=run=>Object.hasOwn(run??{},'energyBase')?['energyBase']:[];
const close=(a,b)=>Math.abs(a-b)<1e-7;
const safeTime=value=>integer(value)?value:0;
const zone=id=>INTERACTIVE_KITCHEN_ZONES.find(zone=>zone.id===id);
const deliveryStep=recipeId=>({id:'delivery',zoneId:null,label:'端到客人的餐桌',durationMs:0,prop:recipeId,carrying:recipeId});
export const isInteractiveWorkflow=workflow=>plain(workflow)&&[2,3,4].includes(workflow.version);
const walkMs=(from,to,levels)=>Math.max(180,Math.round(Math.round((Math.abs(to.x-from.x)+Math.abs(to.y-from.y))*KITCHEN_WALK_MS_PER_UNIT)*kitchenWorkerMultipliers(levels).walkMsMultiplier));
function corridorPath(from,to){
  if(samePoint(from,to))return [];
  if(from.x===to.x)return [to];
  return [{x:from.x,y:76},{x:to.x,y:76},to].filter((point,index,points)=>!samePoint(point,index?points[index-1]:from));
}
function diningPath(from,to){
  return [{x:from.x,y:76},{x:50,y:76},{x:50,y:to.y},to].filter((point,index,points)=>!samePoint(point,index?points[index-1]:from));
}
function runSegments(workflow,stepId,at,position,carrying,durationMultiplier=1,safeRestExit=false,pickup=null){
  const segments=[];
  let cursor=at,current=clonePoint(position);
  const floorRoute=workflow.version===4||safeRestExit&&samePoint(position,STAFF_REST_ROOM_POSITION);
  // v3 has no layout snapshot. Use the safe full-layout bypass when a new
  // click resumes from its rest room, including before a later expansion.
  const routeCapacity=workflow.layoutCapacity??8;
  const append=(phase,to,durationMs,zoneId,stepId,held)=>{
    const duration=durationMs*durationMultiplier;
    segments.push({phase,startAt:cursor,endAt:cursor+duration,from:clonePoint(current),to:clonePoint(to),zoneId,stepId,carrying:held});
    cursor+=duration;current=clonePoint(to);
  };
  // A replacement collects the previous employee's prepared food before
  // continuing; even a handoff before delivery starts at the actual worktop.
  if(pickup){
    const path=floorRoute?kitchenStationPath(current,pickup.position,routeCapacity):corridorPath(current,pickup.position);
    for(const point of path)append('walk',point,walkMs(current,point,workflow.workerLevels),null,stepId,null);
    carrying=pickup.carrying;
  }
  if(stepId==='delivery'){
    const table=KITCHEN_TABLE_POSITIONS[workflow.seat];
    const deliveryPath=floorRoute?kitchenDeliveryPath(current,table,workflow.seat,routeCapacity):diningPath(current,table);
    for(const point of deliveryPath)append('delivery',point,walkMs(current,point,workflow.workerLevels),null,'delivery',workflow.recipeId);
    const servedAt=cursor;
    const returnPath=floorRoute?kitchenReturnPath(table,workflow.seat,routeCapacity):[{x:50,y:table.y},KITCHEN_ORIGIN];
    if(![3,4].includes(workflow.version)||durationMultiplier===1)for(const point of returnPath)if(!samePoint(current,point))append('return',point,walkMs(current,point,workflow.workerLevels),null,'return',null);
    return {segments,endAt:cursor,servedAt,position:current,carrying:null};
  }
  const step=KITCHEN_FLOWS[workflow.recipeId].find(step=>step.id===stepId),target=zone(step.zoneId).work;
  const stationPath=floorRoute?kitchenStationPath(current,target,routeCapacity):corridorPath(current,target);
  for(const point of stationPath)append('walk',point,walkMs(current,point,workflow.workerLevels),step.zoneId,step.id,carrying);
  append('work',target,kitchenStepDuration(step,workflow.kitchenLevel,workflow.fridgeLevel,workflow.workerLevels,workflow.cookSpeedBp),step.zoneId,step.id,step.carrying);
  return {segments,endAt:cursor,servedAt:null,position:current,carrying:step.carrying};
}
const nextId=workflow=>KITCHEN_FLOWS[workflow.recipeId][workflow.runs.length]?.id??(workflow.runs.length===KITCHEN_FLOWS[workflow.recipeId].length?'delivery':null);
const energyCost=(stepId,levels)=>Math.ceil((stepId==='delivery'?12:4)*kitchenWorkerMultipliers(levels).enduranceMultiplier);
const currentEnd=workflow=>workflow.runs.at(-1)?.endAt??workflow.acceptedAt??workflow.createdAt;
function workerBlocked(restaurant,id,ownId,now){
  return (restaurant.orders||[]).some(order=>{
    const flow=order.workflow;
    if(!flow||order.id===ownId||flow.workerId!==id)return false;
    if(isInteractiveWorkflow(flow))return flow.runs.length>0&&!(flow.runs.at(-1).rest&&now>=flow.runs.at(-1).endAt)&&(flow.completedAt===null||flow.completedAt>now);
    // A future v1 reservation also owns its employee. A manual order may wait
    // indefinitely, and must never take that employee away from the old order.
    return flow.completedAt>now;
  });
}
function stationBlocked(restaurant,ownId,stepId,segments,now){
  if(stepId==='delivery')return false;
  const work=segments.find(segment=>segment.phase==='work');
  return (restaurant.orders||[]).filter(order=>order.id!==ownId).some(order=>(order.workflow?.segments||[]).some(block=>block.phase==='work'&&block.zoneId===work.zoneId&&(block.startAt<=now&&now<block.endAt||work.startAt<block.endAt&&block.startAt<work.endAt)));
}

export function createInteractiveWorkflow(restaurant,recipeId,createdAt,{orderId,seat=0,kitchenLevel=restaurant?.levels?.kitchen??1,fridgeLevel=restaurant?.levels?.fridge??1,staff=restaurant?.staff??0,cookSpeedBp=0,version=2,stepEnergyBase=null}={}){
  if(!KITCHEN_FLOWS[recipeId]||!integer(createdAt)||typeof orderId!=='string'||!/^table-[1-9][0-9]{0,15}$/.test(orderId)||!integer(seat,0,KITCHEN_TABLE_POSITIONS.length-1)||!integer(kitchenLevel,1,RESTAURANT_FACILITY_MAX_LEVEL)||!integer(fridgeLevel,1,RESTAURANT_FACILITY_MAX_LEVEL)||!integer(staff,0,98)||!integer(cookSpeedBp,0,RESTAURANT_DECORATION_MAX_COOK_SPEED))return null;
  if(![2,3,4].includes(version))return null;
  if(stepEnergyBase!==null&&(version!==4||!validRecipeStepEnergyBase(stepEnergyBase)))return null;
  const layoutCapacity=restaurantTableCapacity(restaurant?.levels?.tables??1);
  if(version===4&&(![2,4,6,8].includes(layoutCapacity)||seat>=layoutCapacity))return null;
  return {version,recipeId,orderId,seat,kitchenLevel,fridgeLevel,staffLevel:staff,cookSpeedBp,createdAt,acceptedAt:null,workerId:null,workerLevels:null,readyAt:null,servedAt:null,completedAt:null,runs:[],segments:[],...(version===4?{layoutCapacity}:{}),...(stepEnergyBase!==null?{stepEnergyBase}:{})};
}

export function acceptInteractiveWorkflow(restaurant,order,now){
  const reject=reason=>({ok:false,reason}),workflow=order?.workflow;
  if(!integer(now)||!isInteractiveWorkflow(workflow)||!validInteractiveWorkflow(workflow,order,restaurant))return reject('这份制作流程暂时无法更新。');
  if(now<workflow.createdAt)return reject('客人正在入座，等坐好后再接单吧。');
  if(workflow.acceptedAt!==null)return reject('这份订单已经接下啦，点冰箱的食材圈开始吧。');
  return {ok:true,workflow:{...structuredClone(workflow),acceptedAt:now},staffTraining:normalizeStaffTraining(restaurant.staffTraining,now,restaurant.staff)};
}

export function advanceInteractiveWorkflow(restaurant,order,stepId,now){
  if([3,4].includes(order?.workflow?.version))return advanceRestWorkflow(restaurant,order,stepId,now);
  const reject=reason=>({ok:false,reason}),saved=order?.workflow;
  if(!integer(now)||!isInteractiveWorkflow(saved)||!validInteractiveWorkflow(saved,order,restaurant))return reject('这份制作流程暂时无法更新。');
  if(saved.acceptedAt===null)return reject('先点顾客的菜品需求，接下这份订单吧。');
  if(now<saved.acceptedAt||now<currentEnd(saved))return reject('这一步还没做完，等员工停下来再继续吧。');
  if(nextId(saved)!==stepId)return reject('请按顺序点击下一步，已经完成的工序不用重复操作。');
  let workflow=structuredClone(saved),training=normalizeStaffTraining(restaurant.staffTraining,now,restaurant.staff),worker=workflow.workerId;
  if(worker===null){
    for(let index=0;index<=restaurant.staff;index++){
      const id=`worker-${index+1}`;
      if(workerBlocked(restaurant,id,order.id,now))continue;
      if(restBlockedReason(training[id],now))continue;
      const levels=workerAbilitySnapshot(id,training,now).levels,cost=energyCost(stepId,levels),plan=workerEnergyReadyAt(training[id],now,cost);
      if(plan?.startAt===now){worker=id;workflow.workerId=id;workflow.workerLevels={...levels};break;}
    }
    if(worker===null)return reject('员工正忙或需要休息，等一位伙伴空闲后再点食材圈吧。');
  }else if(workerBlocked(restaurant,worker,order.id,now))return reject('这位员工还在处理上一份订单，请稍后再试。');
  const restReason=restBlockedReason(training[worker],now);if(restReason)return reject(restReason);
  // A pre-upgrade v2 intent log keeps its historical idle-recovery protocol.
  // It may adopt a v3 employee only after that employee has fully rested.
  if(training[worker].energyMode==='rest-room'){
    const ability=workerAbilitySnapshot(worker,training,now);
    training[worker]={levels:{...training[worker].levels},energyBase:staffEnergyBase(training[worker]),energy:ability.energy,energyAt:Math.max(now,training[worker].energyAt)};
  }
  const before=workflow.segments.at(-1),position=before?.to??KITCHEN_ORIGIN,carrying=before?.carrying??null;
  const scheduled=runSegments(workflow,stepId,now,position,carrying);
  if(!integer(scheduled.endAt))return reject('餐厅时钟正在同步，请稍后再试。');
  if(stationBlocked(restaurant,order.id,stepId,scheduled.segments,now))return reject('这个工位正被其他员工使用，等空闲后再点一次吧。');
  const cost=energyCost(stepId,workflow.workerLevels),plan=workerEnergyReadyAt(training[worker],now,cost);
  if(!plan||plan.startAt!==now)return reject('这位员工需要休息恢复体力，稍等一会儿再继续吧。');
  const reserved=reserveWorkerEnergy(training,worker,{startAt:now,completedAt:scheduled.endAt,energyCost:cost});
  if(!reserved)return reject('员工体力正在同步，请稍后再试。');
  workflow.runs.push({stepId,commandAt:now,startAt:now,endAt:scheduled.endAt,energyCost:cost,energyBefore:plan.energyBefore,energyAfter:reserved[worker].energy,energyBase:staffEnergyBase(training[worker]),energyLevels:{...training[worker].levels}});
  workflow.segments.push(...scheduled.segments);
  if(stepId==='delivery'){workflow.servedAt=scheduled.servedAt;workflow.completedAt=scheduled.endAt;}
  else if(workflow.runs.length===KITCHEN_FLOWS[workflow.recipeId].length)workflow.readyAt=scheduled.endAt;
  return {ok:true,workflow,staffTraining:reserved};
}

const WORKFLOW_KEYS=['version','recipeId','orderId','seat','kitchenLevel','fridgeLevel','staffLevel','cookSpeedBp','createdAt','acceptedAt','workerId','workerLevels','readyAt','servedAt','completedAt','runs','segments'];
const RUN_KEYS=['stepId','commandAt','startAt','endAt','energyCost','energyBefore','energyAfter','energyLevels'];
const SEGMENT_KEYS=['phase','startAt','endAt','from','to','zoneId','stepId','carrying'];
const equalSegment=(a,b)=>exact(a,SEGMENT_KEYS)&&SEGMENT_KEYS.every(key=>key==='from'||key==='to'?validPoint(a[key])&&samePoint(a[key],b[key]):a[key]===b[key]);

/** Reconstruct every clicked run. Future operations, shorter routes, changed
 * work durations, skipped steps and forged energy deductions all fail closed. */
export function validInteractiveWorkflow(workflow,order,restaurant){
  if([3,4].includes(workflow?.version))return validRestWorkflow(workflow,order,restaurant);
  if(!exact(workflow,WORKFLOW_KEYS)||workflow.version!==2)return false;
  const flow=KITCHEN_FLOWS[workflow.recipeId];
  if(!flow||workflow.recipeId!==order?.recipeId||workflow.orderId!==order.id||workflow.createdAt!==order.createdAt||workflow.kitchenLevel!==order.kitchenLevel||workflow.staffLevel!==order.staffLevel||!integer(workflow.createdAt)||!integer(workflow.kitchenLevel,1,restaurant?.levels?.kitchen??1)||!integer(workflow.fridgeLevel,1,restaurant?.levels?.fridge??1)||!integer(workflow.staffLevel,0,restaurant?.staff??0)||!integer(workflow.seat,0,Math.min(KITCHEN_TABLE_POSITIONS.length,restaurantTableCapacity(restaurant?.levels?.tables??1))-1)||!integer(workflow.cookSpeedBp,0,RESTAURANT_DECORATION_MAX_COOK_SPEED)||workflow.cookSpeedBp!==(order.decorationSnapshot?.cookSpeed??0))return false;
  if(!Array.isArray(workflow.runs)||workflow.runs.length>flow.length+1||!Array.isArray(workflow.segments)||workflow.segments.length>80||order.readyAt!==(workflow.readyAt??order.createdAt)||order.servedAt!==null&&order.servedAt!==workflow.servedAt)return false;
  if(workflow.acceptedAt===null)return workflow.workerId===null&&workflow.workerLevels===null&&workflow.readyAt===null&&workflow.servedAt===null&&workflow.completedAt===null&&workflow.runs.length===0&&workflow.segments.length===0;
  if(!integer(workflow.acceptedAt,workflow.createdAt))return false;
  if(workflow.runs.length===0)return workflow.workerId===null&&workflow.workerLevels===null&&workflow.readyAt===null&&workflow.servedAt===null&&workflow.completedAt===null&&workflow.segments.length===0;
  const workerMatch=typeof workflow.workerId==='string'&&/^worker-([1-9][0-9]?)$/.exec(workflow.workerId),currentLevels=restaurant?.staffTraining?.[workflow.workerId]?.levels;
  if(!workerMatch||!integer(Number(workerMatch[1]),1,(restaurant?.staff??0)+1)||!validLevels(workflow.workerLevels)||!validLevels(currentLevels)||LEVEL_KEYS.some(key=>workflow.workerLevels[key]>currentLevels[key]))return false;
  let position=KITCHEN_ORIGIN,carrying=null,cursor=workflow.acceptedAt,segments=[],expectedReady=null,expectedServed=null,expectedComplete=null,previousRun=null;
  for(let index=0;index<workflow.runs.length;index++){
    const run=workflow.runs[index],expectedStep=flow[index]?.id??'delivery';
    if(!exact(run,[...RUN_KEYS,...energyBaseKeys(run)])||!validStaffEnergyBase(run)||run.stepId!==expectedStep||!integer(run.commandAt,cursor)||run.startAt!==run.commandAt||!integer(run.endAt,run.startAt+1)||!validLevels(run.energyLevels)||LEVEL_KEYS.some(key=>run.energyLevels[key]>currentLevels[key]||run.energyLevels[key]<workflow.workerLevels[key])||run.energyCost!==energyCost(run.stepId,workflow.workerLevels)||!Number.isFinite(run.energyBefore)||run.energyBefore<run.energyCost||run.energyBefore>maxEnergy(run)||!Number.isFinite(run.energyAfter)||run.energyAfter<0||run.energyAfter>maxEnergy(run)||!close(run.energyAfter,run.energyBefore-run.energyCost))return false;
    if(index===0&&!sameLevels(run.energyLevels,workflow.workerLevels))return false;
    if(previousRun){
      if(staffEnergyBase(run)<staffEnergyBase(previousRun)||LEVEL_KEYS.some(key=>run.energyLevels[key]<previousRun.energyLevels[key]))return false;
      const bonus=staffEnergyBase(run)-staffEnergyBase(previousRun),recovery=(run.commandAt-previousRun.endAt)/STAFF_ENERGY_RECOVERY_MS,lower=Math.min(maxEnergy(previousRun)+bonus,previousRun.energyAfter+bonus+recovery),upper=Math.min(maxEnergy(run),previousRun.energyAfter+bonus+recovery);
      if(run.energyBefore<lower-1e-7||run.energyBefore>upper+1e-7)return false;
    }
    const expected=runSegments(workflow,run.stepId,run.commandAt,position,carrying);
    if(run.endAt!==expected.endAt)return false;
    segments.push(...expected.segments);position=expected.position;carrying=expected.carrying;cursor=run.endAt;
    if(index===flow.length-1)expectedReady=run.endAt;
    if(run.stepId==='delivery'){expectedServed=expected.servedAt;expectedComplete=expected.endAt;}
    previousRun=run;
  }
  if(workflow.readyAt!==expectedReady||workflow.servedAt!==expectedServed||workflow.completedAt!==expectedComplete||expectedComplete!==null&&expectedComplete>expectedServed+4500)return false;
  if(workflow.segments.length!==segments.length||!segments.every((segment,index)=>equalSegment(workflow.segments[index],segment)))return false;
  const ledger=restaurant.staffTraining[workflow.workerId];
  if(staffEnergyBase(ledger)<staffEnergyBase(previousRun)||ledger.energyAt<previousRun.endAt||ledger.energyAt===previousRun.endAt&&!close(ledger.energy,previousRun.energyAfter+staffEnergyBase(ledger)-staffEnergyBase(previousRun)))return false;
  return true;
}

export function interactiveOrderProjection(workflow,now=Date.now()){
  now=safeTime(now);
  const flow=KITCHEN_FLOWS[workflow.recipeId],current=workflow.segments.find(segment=>segment.phase!=='rest-walk'&&segment.startAt<=now&&now<segment.endAt);
  const steps=flow.map(step=>{
    const segment=workflow.segments.find(segment=>segment.phase==='work'&&segment.stepId===step.id);
    return {...step,startAt:segment?.startAt??null,endAt:segment?.endAt??null,status:segment&&now>=segment.endAt?'complete':segment&&now>=segment.startAt?'working':'pending',progress:segment?clamp((now-segment.startAt)/(segment.endAt-segment.startAt)):0};
  });
  const next=nextId(workflow),nextStep=next==='delivery'?deliveryStep(workflow.recipeId):flow.find(step=>step.id===next)??null;
  let phase,currentStep,clickable=null;
  if(now<workflow.createdAt){phase='arriving';currentStep={id:'arriving',zoneId:null,label:'等待客人入座',prop:null};}
  else if(workflow.acceptedAt===null){phase='requested';currentStep={id:'request',zoneId:null,label:'点击顾客的菜品需求接单',prop:workflow.recipeId};}
  else if(current){phase=current.phase;currentStep=flow.find(step=>step.id===current.stepId)??{id:current.stepId,zoneId:null,label:current.phase==='rest-walk'?'前往休息室':current.phase==='return'?'回到厨房':'端到客人的餐桌',prop:current.phase==='rest-walk'?null:workflow.recipeId};}
  else if(workflow.completedAt!==null&&now>=workflow.completedAt){phase='complete';currentStep={id:'complete',zoneId:null,label:'料理已经送达，员工回到厨房',prop:null};}
  else {phase=next==='delivery'?'awaiting-delivery':'awaiting';clickable=nextStep;currentStep=nextStep??{id:'complete',zoneId:null,label:'料理已经送达',prop:null};}
  const progress=current?clamp((now-current.startAt)/(current.endAt-current.startAt)):0;
  const workProgress=steps.reduce((total,step)=>total+step.progress,0)/flow.length;
  return {id:workflow.orderId,recipeId:workflow.recipeId,workerId:workflow.workerId,handoffReady:Boolean(clickable&&workflow.runs.at(-1)?.rest),seat:workflow.seat,phase,currentStep:{...currentStep,status:phase,startAt:current?.startAt??null,endAt:current?.endAt??null,progress},nextStep:clickable,steps,progress:workProgress,queuedUntil:null,acceptedAt:workflow.acceptedAt};
}

/** Ownership ends when an exhausted operation finishes, rather than after
 * recovery. Per-run IDs preserve earlier employees when a handoff occurs. */
export function interactiveWorkerReservations(workflow){
  const windows=[];
  for(let index=0;index<workflow.runs.length;index++){
    const run=workflow.runs[index],id=run.workerId??workflow.workerId,previous=workflow.runs[index-1];
    if(!previous||previous.rest||id!==(previous.workerId??workflow.workerId))windows.push({workerId:id,startAt:run.startAt,endAt:MAX});
    if(run.rest)windows.at(-1).endAt=run.endAt;
    else if(index===workflow.runs.length-1)windows.at(-1).endAt=workflow.completedAt??MAX;
  }
  return windows;
}

export function interactiveWorkerProjection(workflow,now=Date.now(),workerId=workflow.workerId){
  now=safeTime(now);
  const window=interactiveWorkerReservations(workflow).find(item=>item.workerId===workerId&&item.startAt<=now&&now<item.endAt);
  if(!window)return null;
  const owned=workflow.segments.filter(s=>s.phase!=='rest-walk'&&s.startAt>=window.startAt&&s.endAt<=window.endAt);
  const model=interactiveOrderProjection(workflow,now),segment=owned.find(s=>s.startAt<=now&&now<s.endAt),last=owned.filter(s=>s.endAt<=now).at(-1),position=segment?{x:segment.from.x+(segment.to.x-segment.from.x)*model.currentStep.progress,y:segment.from.y+(segment.to.y-segment.from.y)*model.currentStep.progress}:clonePoint(last?.to??KITCHEN_ORIGIN);
  return {id:workerId,orderId:workflow.orderId,phase:segment?segment.phase:'awaiting',position,from:segment?.from??position,to:segment?.to??position,startAt:segment?.startAt??null,endAt:segment?.endAt??null,progress:model.currentStep.progress,step:model.currentStep,carrying:segment?.carrying??last?.carrying??null};
}

export function interactiveOrderStatus(workflow,now=Date.now()){
  now=safeTime(now);
  if(now<workflow.createdAt)return 'arriving';
  if(workflow.acceptedAt===null)return 'requested';
  if(workflow.servedAt!==null)return now<workflow.servedAt?'delivering':now<workflow.servedAt+4500?'dining':'collectible';
  const phase=interactiveOrderProjection(workflow,now).phase;
  return phase==='awaiting-delivery'?'dish-ready':phase==='walk'||phase==='work'?'preparing':'awaiting';
}

// Versions 3/4 recover only inside the rest room. When fatigue releases an
// employee, a later click may assign a replacement. Only handoff logs gain
// per-run worker IDs; older single-employee logs keep their exact saved shape.
// Version 4 keeps that stamina protocol and snapshots the floor capacity for
// doorway-only routing. Version 3 continues to reconstruct its original paths.
const REST_RUN_KEYS=[...RUN_KEYS,'startPosition','durationMultiplier','rest'];
const restEnergyCost=(workflow,levels)=>workerStepEnergyCost(levels,workflow.stepEnergyBase??10);
function restTrip(position,departAt,levels,workflow,energyBase){
  const points=workflow.version===4?kitchenRestPath(position,workflow.seat,workflow.layoutCapacity):[{x:position.x,y:76},{x:50,y:76},{x:50,y:47},STAFF_REST_ROOM_ENTRANCE,STAFF_REST_ROOM_POSITION].filter((p,i,all)=>!samePoint(p,i?all[i-1]:position));
  const segments=[];let cursor=departAt,current=clonePoint(position);
  for(const to of points){const endAt=cursor+walkMs(current,to,levels)*STAFF_EXHAUSTED_DURATION_MULTIPLIER;segments.push({phase:'rest-walk',startAt:cursor,endAt,from:clonePoint(current),to:clonePoint(to),zoneId:null,stepId:'rest',carrying:null});cursor=endAt;current=clonePoint(to);}
  return {departAt,arriveAt:cursor,fullAt:cursor+staffMaxEnergy(levels,energyBase)*STAFF_ENERGY_RECOVERY_MS,speedLevel:levels.speed,segments};
}
function restBlockedReason(record,now){
  const rest=staffRestProjection(record,now);
  if(!rest||rest.phase==='ready')return null;
  return rest.phase==='walking'||rest.phase==='exhausted'?'正在前往休息室，请等员工到达并恢复体力。':`体力恢复中，还需 ${Math.ceil(rest.remainingMs/1000)} 秒。`;
}
function advanceRestWorkflow(restaurant,order,stepId,now){
  const reject=reason=>({ok:false,reason}),saved=order?.workflow;
  if(!integer(now)||!validRestWorkflow(saved,order,restaurant))return reject('这份制作流程暂时无法更新。');
  if(saved.acceptedAt===null)return reject('先点顾客的菜品需求，接下这份订单吧。');
  if(now<saved.acceptedAt||now<currentEnd(saved))return reject('这一步还没做完，等员工停下来再继续吧。');
  if(nextId(saved)!==stepId)return reject('请按顺序点击下一步，已经完成的工序不用重复操作。');
  const workflow=structuredClone(saved),training=normalizeStaffTraining(restaurant.staffTraining,now,restaurant.staff),lastRun=workflow.runs.at(-1);
  let worker=lastRun?.rest?null:workflow.workerId,lastRestReason=null;
  if(worker===null){
    for(let index=0;index<=restaurant.staff;index++){
      const id=`worker-${index+1}`,reason=restBlockedReason(training[id],now);
      if(reason){lastRestReason=reason;continue;}
      if(workerBlocked(restaurant,id,order.id,now))continue;
      const ability=workerAbilitySnapshot(id,training,now);
      if(ability.energy<=0)continue;
      worker=id;break;
    }
    if(worker===null)return reject(lastRestReason??'员工正忙或需要休息，等一位伙伴空闲后再点食材圈吧。');
  }else{
    const reason=restBlockedReason(training[worker],now);if(reason)return reject(reason);
    if(workerBlocked(restaurant,worker,order.id,now))return reject('这位员工还在处理上一份订单，请稍后再试。');
  }
  const ability=workerAbilitySnapshot(worker,training,now),runLevels={...ability.levels},cost=restEnergyCost(workflow,runLevels),energyBefore=ability.energy;
  if(energyBefore<=0)return reject('员工体力耗尽，请等待休息室恢复。');
  const replaced=workflow.workerId!==null&&worker!==workflow.workerId;
  if(replaced){
    for(const run of workflow.runs)run.workerId??=workflow.workerId;
  }
  if(worker!==workflow.workerId){workflow.workerId=worker;workflow.workerLevels={...runLevels};}
  const energyAfter=Math.max(0,energyBefore-cost),durationMultiplier=energyAfter===0?STAFF_EXHAUSTED_DURATION_MULTIPLIER:1;
  const previous=workflow.segments.at(-1),prepared=workflow.segments.filter(s=>s.phase==='work').at(-1),position=training[worker].rest?STAFF_REST_ROOM_POSITION:replaced?kitchenWorkerIdlePoint(Number(worker.slice(7))-1,restaurant.staff+1):previous?.to??KITCHEN_ORIGIN,carrying=replaced?null:previous?.carrying??null;
  const pickup=replaced&&prepared?{position:prepared.to,carrying:prepared.carrying}:null;
  const scheduled=runSegments({...workflow,workerLevels:runLevels},stepId,now,position,carrying,durationMultiplier,true,pickup);
  if(!integer(scheduled.endAt))return reject('餐厅时钟正在同步，请稍后再试。');
  if(stationBlocked(restaurant,order.id,stepId,scheduled.segments,now))return reject('这个工位正被其他员工使用，等空闲后再点一次吧。');
  const rest=energyAfter===0?restTrip(scheduled.position,scheduled.endAt,runLevels,workflow):null;
  // Capacity may have been trained after this order took its speed snapshot.
  if(rest)rest.fullAt=rest.arriveAt+ability.maxEnergy*STAFF_ENERGY_RECOVERY_MS;
  if(rest&&!integer(rest.fullAt))return reject('餐厅时钟正在同步，请稍后再试。');
  training[worker]={levels:{...training[worker].levels},energyBase:staffEnergyBase(training[worker]),energy:energyAfter,energyAt:rest?.arriveAt??scheduled.endAt,energyMode:'rest-room',rest:structuredClone(rest)};
  workflow.runs.push({stepId,commandAt:now,startAt:now,endAt:scheduled.endAt,energyCost:cost,energyBefore,energyAfter,energyBase:ability.energyBase,energyLevels:{...training[worker].levels},startPosition:clonePoint(position),durationMultiplier,rest:structuredClone(rest),...(workflow.runs.some(run=>run.workerId)?{workerId:worker}:{})});
  workflow.segments.push(...scheduled.segments,...(rest?.segments??[]));
  if(stepId==='delivery'){workflow.servedAt=scheduled.servedAt;workflow.completedAt=scheduled.endAt;}
  else if(workflow.runs.length===KITCHEN_FLOWS[workflow.recipeId].length)workflow.readyAt=scheduled.endAt;
  return {ok:true,workflow,staffTraining:training};
}
function validRestWorkflow(workflow,order,restaurant){
  const energySnapshot=Object.hasOwn(workflow??{},'stepEnergyBase');
  const keys=workflow?.version===4?[...WORKFLOW_KEYS,'layoutCapacity',...(energySnapshot?['stepEnergyBase']:[])]:WORKFLOW_KEYS;
  if(![3,4].includes(workflow?.version)||!exact(workflow,keys))return false;
  if(energySnapshot&&(!validRecipeStepEnergyBase(workflow.stepEnergyBase)||workflow.stepEnergyBase!==recipeStepEnergyBase(order?.recipeId,order?.recipeLevel)))return false;
  if(workflow.version===4&&(![2,4,6,8].includes(workflow.layoutCapacity)||workflow.layoutCapacity>restaurantTableCapacity(restaurant?.levels?.tables??1)||!integer(workflow.seat,0,workflow.layoutCapacity-1)))return false;
  const flow=KITCHEN_FLOWS[workflow.recipeId];
  if(!flow||workflow.recipeId!==order?.recipeId||workflow.orderId!==order.id||workflow.createdAt!==order.createdAt||workflow.kitchenLevel!==order.kitchenLevel||workflow.staffLevel!==order.staffLevel||!integer(workflow.createdAt)||!integer(workflow.kitchenLevel,1,restaurant?.levels?.kitchen??1)||!integer(workflow.fridgeLevel,1,restaurant?.levels?.fridge??1)||!integer(workflow.staffLevel,0,restaurant?.staff??0)||!integer(workflow.seat,0,Math.min(KITCHEN_TABLE_POSITIONS.length,restaurantTableCapacity(restaurant?.levels?.tables??1))-1)||!integer(workflow.cookSpeedBp,0,RESTAURANT_DECORATION_MAX_COOK_SPEED)||workflow.cookSpeedBp!==(order.decorationSnapshot?.cookSpeed??0))return false;
  if(!Array.isArray(workflow.runs)||workflow.runs.length>flow.length+1||!Array.isArray(workflow.segments)||order.readyAt!==(workflow.readyAt??order.createdAt)||order.servedAt!==null&&order.servedAt!==workflow.servedAt)return false;
  const handoff=workflow.runs.some(run=>Object.hasOwn(run??{},'workerId'));
  if(workflow.segments.length>(handoff?320:160))return false;
  if(workflow.acceptedAt===null)return workflow.workerId===null&&workflow.workerLevels===null&&workflow.readyAt===null&&workflow.servedAt===null&&workflow.completedAt===null&&workflow.runs.length===0&&workflow.segments.length===0;
  if(!integer(workflow.acceptedAt,workflow.createdAt))return false;
  if(!workflow.runs.length)return workflow.workerId===null&&workflow.workerLevels===null&&workflow.readyAt===null&&workflow.servedAt===null&&workflow.completedAt===null&&workflow.segments.length===0;
  const match=typeof workflow.workerId==='string'&&/^worker-([1-9][0-9]?)$/.exec(workflow.workerId),levels=restaurant?.staffTraining?.[workflow.workerId]?.levels;
  if(!match||!integer(Number(match[1]),1,(restaurant?.staff??0)+1)||!validLevels(workflow.workerLevels)||!validLevels(levels)||LEVEL_KEYS.some(key=>workflow.workerLevels[key]>levels[key]))return false;
  let position=null,carrying=null,cursor=workflow.acceptedAt,segments=[],readyAt=null,servedAt=null,completedAt=null,previous=null,prepared=null,assignmentFirst=null;
  const latestByWorker=new Map();
  for(let index=0;index<workflow.runs.length;index++){
    const run=workflow.runs[index],owner=handoff?run.workerId:workflow.workerId,ownerMatch=typeof owner==='string'&&/^worker-([1-9][0-9]?)$/.exec(owner),ownerLevels=restaurant.staffTraining?.[owner]?.levels,changed=index>0&&owner!==(handoff?previous.workerId:workflow.workerId),ownPrevious=latestByWorker.get(owner);
    if(!ownerMatch||!integer(Number(ownerMatch[1]),1,(restaurant.staff??0)+1)||!validLevels(ownerLevels)||!exact(run,[...REST_RUN_KEYS,...energyBaseKeys(run),...(handoff?['workerId']:[])])||!validStaffEnergyBase(run)||run.stepId!==(flow[index]?.id??'delivery')||!integer(run.commandAt,cursor)||run.startAt!==run.commandAt||!integer(run.endAt,run.startAt+1)||!validLevels(run.energyLevels)||LEVEL_KEYS.some(key=>run.energyLevels[key]>ownerLevels[key])||run.energyCost!==restEnergyCost(workflow,run.energyLevels)||!Number.isFinite(run.energyBefore)||run.energyBefore<=0||run.energyBefore>maxEnergy(run)||!Number.isFinite(run.energyAfter)||!close(run.energyAfter,Math.max(0,run.energyBefore-run.energyCost))||run.durationMultiplier!==(run.energyAfter===0?STAFF_EXHAUSTED_DURATION_MULTIPLIER:1)||!validPoint(run.startPosition))return false;
    if(ownPrevious&&(staffEnergyBase(run)<staffEnergyBase(ownPrevious)||LEVEL_KEYS.some(key=>run.energyLevels[key]<ownPrevious.energyLevels[key])||ownPrevious.rest&&run.commandAt<ownPrevious.rest.fullAt))return false;
    if(index===0||changed){
      const workerIndex=Number(owner.slice(7))-1,idleStart=changed&&Array.from({length:restaurant.staff+1-workerIndex},(_,offset)=>kitchenWorkerIdlePoint(workerIndex,workerIndex+1+offset)).some(point=>samePoint(run.startPosition,point));
      if(changed&&!previous.rest||!samePoint(run.startPosition,KITCHEN_ORIGIN)&&!samePoint(run.startPosition,STAFF_REST_ROOM_POSITION)&&!idleStart)return false;
      position=run.startPosition;carrying=null;assignmentFirst=run;
    }else{
      if(LEVEL_KEYS.some(key=>run.energyLevels[key]<previous.energyLevels[key])||!samePoint(run.startPosition,position))return false;
      if(previous.rest){if(run.commandAt<previous.rest.fullAt||!close(run.energyBefore,maxEnergy(run)))return false;}
      else if(!close(run.energyBefore,previous.energyAfter+staffEnergyBase(run)-staffEnergyBase(previous)))return false;
    }
    if(!handoff&&LEVEL_KEYS.some(key=>run.energyLevels[key]<workflow.workerLevels[key]))return false;
    // Existing v3 runs keep their saved timings. New departures are identified
    // by their first waypoint at the rest-room door, then reconstructed fully.
    const firstSegment=workflow.segments.find(segment=>segment?.phase!=='rest-walk'&&segment?.startAt===run.startAt);
    const safeRestExit=samePoint(position,STAFF_REST_ROOM_POSITION)&&validPoint(firstSegment?.to)&&samePoint(firstSegment.to,STAFF_REST_ROOM_ENTRANCE);
    const expected=runSegments({...workflow,workerLevels:run.energyLevels},run.stepId,run.commandAt,position,carrying,run.durationMultiplier,safeRestExit,changed?prepared:null);
    if(run.endAt!==expected.endAt)return false;
    segments.push(...expected.segments);position=expected.position;carrying=expected.carrying;prepared={position:clonePoint(position),carrying};
    if(run.energyAfter===0){
      const rest=restTrip(position,run.endAt,run.energyLevels,workflow,staffEnergyBase(run));rest.fullAt=rest.arriveAt+maxEnergy(run)*STAFF_ENERGY_RECOVERY_MS;
      if(!exact(run.rest,['departAt','arriveAt','fullAt','speedLevel','segments'])||run.rest.departAt!==rest.departAt||run.rest.arriveAt!==rest.arriveAt||run.rest.fullAt!==rest.fullAt||run.rest.speedLevel!==rest.speedLevel||!Array.isArray(run.rest.segments)||run.rest.segments.length!==rest.segments.length||!rest.segments.every((s,i)=>equalSegment(run.rest.segments[i],s)))return false;
      segments.push(...rest.segments);position=clonePoint(STAFF_REST_ROOM_POSITION);carrying=null;
    }else if(run.rest!==null)return false;
    cursor=run.endAt;latestByWorker.set(owner,run);
    if(index===flow.length-1)readyAt=run.endAt;
    if(run.stepId==='delivery'){servedAt=expected.servedAt;completedAt=expected.endAt;}
    previous=run;
  }
  if(workflow.readyAt!==readyAt||workflow.servedAt!==servedAt||workflow.completedAt!==completedAt||workflow.segments.length!==segments.length||!segments.every((s,i)=>equalSegment(workflow.segments[i],s)))return false;
  if(handoff&&previous.workerId!==workflow.workerId||!sameLevels(assignmentFirst.energyLevels,workflow.workerLevels))return false;
  for(const [owner,run] of latestByWorker){
    const ledger=restaurant.staffTraining[owner],released=run.rest||workflow.completedAt!==null;
    const laterLegacyJob=released&&ledger.energyMode===undefined&&ledger.energyAt>run.endAt;
    if(staffEnergyBase(ledger)<staffEnergyBase(run)||!(ledger.energyMode==='rest-room'||laterLegacyJob)||ledger.energyAt<run.endAt||ledger.energyAt===run.endAt&&!close(ledger.energy,run.energyAfter+staffEnergyBase(ledger)-staffEnergyBase(run)))return false;
  }
  return true;
}
