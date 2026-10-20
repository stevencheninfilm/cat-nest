/** Pure employee training and stamina ledger. Each worker owns their levels and
 * energy. Scheduling records energy at the end of reserved work, so occupied
 * time cannot also regenerate stamina. Only authoritative reducers write this. */
export const STAFF_TRAINING_MAX_LEVEL=10;
export const STAFF_WORK_STEP_ENERGY_BASE=10;
export const STAFF_BASE_ENERGY=200;
const LEGACY_STAFF_BASE_ENERGY=100;
/** Missing snapshots retain the original training balance. New work uses v2;
 * historical walks, energy deductions and recovery clocks stay immutable. */
export const STAFF_ABILITY_VERSION=2;
export const staffAbilityVersion=record=>record?.abilityVersion??1;
export const staffAbilitySnapshot=record=>Object.hasOwn(record??{},'abilityVersion')?{abilityVersion:record.abilityVersion}:{};
export const validStaffAbilityVersion=record=>!Object.hasOwn(record??{},'abilityVersion')||[1,2].includes(record.abilityVersion);
const abilityScale=version=>version===2?2:1;
/** Missing snapshots belong to the original 100-point balance. */
export const staffEnergyBase=record=>record?.energyBase??LEGACY_STAFF_BASE_ENERGY;
export const staffMaxEnergy=(levels,base=STAFF_BASE_ENERGY,abilityVersion=STAFF_ABILITY_VERSION)=>base+15*abilityScale(abilityVersion)*(levels.stamina-1);
/** Only balance migrations grant the newly added capacity. Training a new
 * stamina level still expands capacity without replenishing spent energy. */
export const staffCapacityMigration=(after,before,levels=before.levels??before.energyLevels)=>staffMaxEnergy(levels,staffEnergyBase(after),staffAbilityVersion(after))-staffMaxEnergy(levels,staffEnergyBase(before),staffAbilityVersion(before));
export const validStaffEnergyBase=record=>!Object.hasOwn(record??{},'energyBase')||[LEGACY_STAFF_BASE_ENERGY,STAFF_BASE_ENERGY].includes(record.energyBase);
export const STAFF_ENERGY_RECOVERY_MS=800;
export const STAFF_IDLE_RECOVERY_MS=30*60_000;
export const staffIdleRecoverySnapshot=record=>Object.hasOwn(record??{},'idleRecoveryAt')?{idleRecoveryAt:record.idleRecoveryAt}:{};
export const validStaffIdleRecovery=(record,at)=>!Object.hasOwn(record??{},'idleRecoveryAt')||Number.isSafeInteger(record.idleRecoveryAt)&&record.idleRecoveryAt>=0&&record.idleRecoveryAt<=at;
export const STAFF_REST_ROOM_ENTRANCE=Object.freeze({x:94,y:47});
export const STAFF_REST_ROOM_POSITION=Object.freeze({x:97,y:47});
export const STAFF_EXHAUSTED_DURATION_MULTIPLIER=5;
export const STAFF_TRAINING_STATS=Object.freeze([
  {id:'speed',name:'速度',description:'加快行走、取料与送餐'},
  {id:'stamina',name:'体力',description:'提高体力上限，连续制作更多料理'},
  {id:'endurance',name:'耐力',description:'每道工序基础消耗10点体力，耐力升级可降低'},
  {id:'skill',name:'熟练度',description:'提高加工效率和菜品品质'},
].map(Object.freeze));
const STAT_IDS=Object.freeze(STAFF_TRAINING_STATS.map(stat=>stat.id));
const COIN_COSTS=Object.freeze([80,130,200,300,440,620]);
const GOLD_COSTS=Object.freeze([2,4,7]);
const MAX=Number.MAX_SAFE_INTEGER;
const WORKER_ID=/^worker-([1-9][0-9]?)$/;
const integer=(value,min=0,max=MAX)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const safeTime=now=>integer(now)?now:0;
const validWorkerId=value=>typeof value==='string'&&WORKER_ID.test(value);
const activeWorkerCount=staffCount=>1+(integer(staffCount,0,98)?staffCount:0);
const maxEnergyFor=staffMaxEnergy;
const recordMaxEnergy=record=>maxEnergyFor(record.levels,staffEnergyBase(record),staffAbilityVersion(record));
const normalizedLevels=value=>Object.fromEntries(STAT_IDS.map(id=>[id,integer(value?.[id],1,STAFF_TRAINING_MAX_LEVEL)?value[id]:1]));
const initialRecord=now=>({levels:normalizedLevels(null),energyBase:STAFF_BASE_ENERGY,abilityVersion:STAFF_ABILITY_VERSION,energy:STAFF_BASE_ENERGY,energyAt:safeTime(now)});
const point=value=>exact(value,['x','y'])&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.x<=100&&value.y>=0&&value.y<=100;
const validRest=value=>value===null||exact(value,['departAt','arriveAt','fullAt','speedLevel','segments',...Object.keys(staffAbilitySnapshot(value))])&&validStaffAbilityVersion(value)&&integer(value.departAt)&&integer(value.arriveAt,value.departAt+1)&&integer(value.fullAt,value.arriveAt)&&integer(value.speedLevel,1,10)&&Array.isArray(value.segments)&&value.segments.length>0&&value.segments.length<20&&value.segments.every((s,i)=>exact(s,['phase','startAt','endAt','from','to','zoneId','stepId','carrying'])&&s.phase==='rest-walk'&&integer(s.startAt)&&integer(s.endAt,s.startAt+1)&&s.startAt===(i?value.segments[i-1].endAt:value.departAt)&&point(s.from)&&point(s.to)&&s.zoneId===null&&s.stepId==='rest'&&s.carrying===null&&(s.from.x===s.to.x||s.from.y===s.to.y)&&s.endAt-s.startAt===5*Math.max(180,Math.round(Math.round((Math.abs(s.to.x-s.from.x)+Math.abs(s.to.y-s.from.y))*45)/(1+.075*abilityScale(staffAbilityVersion(value))*(value.speedLevel-1))))&&(i===0||s.from.x===value.segments[i-1].to.x&&s.from.y===value.segments[i-1].to.y))&&value.segments.at(-1).endAt===value.arriveAt&&value.segments.at(-1).to.x===STAFF_REST_ROOM_POSITION.x&&value.segments.at(-1).to.y===STAFF_REST_ROOM_POSITION.y;
const recordIsValid=value=>exact(value,['levels','energy','energyAt',...Object.keys(staffIdleRecoverySnapshot(value)),...Object.keys(staffAbilitySnapshot(value)),...(Object.hasOwn(value??{},'energyBase')?['energyBase']:[]),...(Object.hasOwn(value??{},'energyMode')?['energyMode','rest']:[])])&&validStaffEnergyBase(value)&&validStaffAbilityVersion(value)&&exact(value.levels,STAT_IDS)&&Object.values(value.levels).every(level=>integer(level,1,STAFF_TRAINING_MAX_LEVEL))&&Number.isFinite(value.energy)&&value.energy>=0&&value.energy<=recordMaxEnergy(value)&&integer(value.energyAt)&&validStaffIdleRecovery(value,value.energyAt)&&(!Object.hasOwn(value,'energyMode')||value.energyMode==='rest-room'&&validRest(value.rest)&&(!value.rest||value.energyAt>=value.rest.arriveAt&&value.rest.fullAt===value.energyAt+Math.ceil((recordMaxEnergy(value)-value.energy)*STAFF_ENERGY_RECOVERY_MS)));

/** Snapshot-friendly duration factors, independent of a worker's live ledger. */
export function workerDurationMultipliers(levels,abilityVersion=STAFF_ABILITY_VERSION) {
  levels=normalizedLevels(levels);
  const scale=abilityScale(abilityVersion);
  return {walkMsMultiplier:1/(1+.075*scale*(levels.speed-1)),workMsMultiplier:1/(1+.065*scale*(levels.skill-1)),enduranceMultiplier:1-.05*scale*(levels.endurance-1)};
}

/** Cumulative effects relative to level 1, shared by numeric upgrade previews.
 * Rate increases and duration reductions are deliberately separate values. */
export function staffAbilityLevelEffects(statId,level){
  const levels=normalizedLevels({[statId]:level}),factors=workerDurationMultipliers(levels),round=value=>Math.round(value*1000)/10;
  if(statId==='speed')return {ratePercent:round(1/factors.walkMsMultiplier-1),timeReductionPercent:round(1-factors.walkMsMultiplier)};
  if(statId==='stamina')return {maxEnergy:maxEnergyFor(levels),capacityPercent:round(maxEnergyFor(levels)/STAFF_BASE_ENERGY-1)};
  if(statId==='endurance'){
    const stepEnergyCost=workerStepEnergyCost(levels);
    return {factorReductionPercent:round(1-factors.enduranceMultiplier),stepEnergyCost,actualReductionPercent:round(1-stepEnergyCost/STAFF_WORK_STEP_ENERGY_BASE)};
  }
  if(statId==='skill')return {ratePercent:round(1/factors.workMsMultiplier-1),timeReductionPercent:round(1-factors.workMsMultiplier),incomePercent:round(.03*(levels.skill-1))};
  return null;
}

/** One accepted manual step is charged once; walking and waiting are free. */
export function workerStepEnergyCost(levels,baseEnergy=STAFF_WORK_STEP_ENERGY_BASE,abilityVersion=STAFF_ABILITY_VERSION) {
  return Math.ceil(baseEnergy*workerDurationMultipliers(levels,abilityVersion).enduranceMultiplier);
}

/** staffCount is the existing number of hired employees, excluding the main
 * chef. The roster is not changed; unknown/unhired worker records are omitted. */
export function normalizeStaffTraining(value,now=Date.now(),staffCount=0) {
  now=safeTime(now);
  return Object.fromEntries(Array.from({length:activeWorkerCount(staffCount)},(_,index)=>{
    const id=`worker-${index+1}`,saved=plain(value)?value[id]:null;
    if(!plain(saved))return [id,initialRecord(now)];
    const levels=normalizedLevels(saved.levels),maxEnergy=maxEnergyFor(levels);
    // Grant the added capacity once, preserving spent stamina and booked clocks.
    // Both sides of an existing rest deficit grow equally, so fullAt is stable.
    const capacityBonus=staffCapacityMigration({energyBase:STAFF_BASE_ENERGY,abilityVersion:STAFF_ABILITY_VERSION},{energyBase:saved.energyBase===STAFF_BASE_ENERGY?STAFF_BASE_ENERGY:LEGACY_STAFF_BASE_ENERGY,abilityVersion:saved.abilityVersion===2?2:1},levels);
    return [id,{levels,energyBase:STAFF_BASE_ENERGY,abilityVersion:STAFF_ABILITY_VERSION,energy:Number.isFinite(saved.energy)&&saved.energy>=0?Math.min(maxEnergy,saved.energy+capacityBonus):maxEnergy,energyAt:integer(saved.energyAt)?saved.energyAt:now,...(validStaffIdleRecovery(saved,saved.energyAt)?staffIdleRecoverySnapshot(saved):{}),...(saved.energyMode==='rest-room'&&validRest(saved.rest)?{energyMode:'rest-room',rest:structuredClone(saved.rest)}:{})}];
  }));
}

/** Fallback for old saves without an explicit player-activity clock. A booked
 * work/recovery anchor also preserves compatibility with older booked jobs. */
export function restaurantStaffLastInteractionAt(restaurant){
  return restaurant?.lastInteractionAt??Math.max(restaurant?.openedAt??0,...Object.values(restaurant?.staffTraining??{}).map(record=>record.energyAt),...(restaurant?.orders??[]).flatMap(order=>[order.workflow?.acceptedAt??0,order.servedAt??0]));
}
export function restaurantStaffIdleAt(restaurant,training=restaurant?.staffTraining){
  if(!integer(restaurant?.lastInteractionAt)&&!integer(restaurant?.openedAt))return null;
  const activityAt=restaurantStaffLastInteractionAt(restaurant);
  if(!integer(activityAt)||activityAt>MAX-STAFF_IDLE_RECOVERY_MS)return null;
  // Finish an already booked action before refilling; never interrupt its walk
  // or work. The thirty-minute clock itself follows the last player command.
  return Math.max(activityAt+STAFF_IDLE_RECOVERY_MS,...Object.values(training??{}).map(record=>record.energyAt));
}

/** Pure read projection, persisted by the next successful action. Rest-room
 * journeys already recover normally; keeping them preserves their saved route.
 * A checkpoint lets the next clicked run explain its refill without rewriting
 * historical steps, and prevents refresh/retry from awarding it twice. */
export function normalizeRestaurantStaffTraining(restaurant,now=Date.now()){
  const training=normalizeStaffTraining(restaurant?.staffTraining,now,restaurant?.staff??0),at=restaurantStaffIdleAt(restaurant,training);
  if(at===null||now<at)return training;
  for(const record of Object.values(training)){
    if(record.rest||record.energy>=recordMaxEnergy(record))continue;
    record.energy=recordMaxEnergy(record);record.energyAt=at;record.idleRecoveryAt=at;
  }
  return training;
}

export function validStaffTraining(value,staffCount=0) {
  const ids=Array.from({length:activeWorkerCount(staffCount)},(_,index)=>`worker-${index+1}`);
  return exact(value,ids)&&Object.values(value).every(recordIsValid);
}

/** Values are duration multipliers: lower means faster work. Level 1 preserves
 * current timings. Skill and speed affect distinct parts of the workflow. */
export function workerAbilitySnapshot(workerId,training,now=Date.now()) {
  const saved=validWorkerId(workerId)&&recordIsValid(training?.[workerId])?training[workerId]:initialRecord(now);
  const levels={...saved.levels},energyBase=staffEnergyBase(saved),abilityVersion=staffAbilityVersion(saved),maxEnergy=maxEnergyFor(levels,energyBase,abilityVersion),at=safeTime(now);
  const canRecover=saved.energyMode!=='rest-room'||!!saved.rest&&at>=saved.rest.arriveAt;
  const energy=Math.min(maxEnergy,saved.energy+(canRecover?Math.max(0,at-saved.energyAt)/STAFF_ENERGY_RECOVERY_MS:0));
  return {workerId,levels,energyBase,abilityVersion,maxEnergy,energy,stepEnergyCost:workerStepEnergyCost(levels,STAFF_WORK_STEP_ENERGY_BASE,abilityVersion),energyAt:saved.energyAt,recovering:canRecover&&at>=saved.energyAt&&energy<maxEnergy,
    fullEnergyAt:saved.energyMode==='rest-room'&&!saved.rest?null:saved.energyAt+Math.ceil((maxEnergy-saved.energy)*STAFF_ENERGY_RECOVERY_MS),qualityMultiplier:staffQualityMultiplier(levels,abilityVersion),
    ...workerDurationMultipliers(levels,abilityVersion)};
}

export const staffQualityMultiplier=(levels,abilityVersion=STAFF_ABILITY_VERSION)=>1+.015*abilityScale(abilityVersion)*((levels?.skill??1)-1);

export function staffTrainingUpgradeCost(statId,currentLevel) {
  if(!STAT_IDS.includes(statId)||!integer(currentLevel,1,STAFF_TRAINING_MAX_LEVEL-1))return null;
  const targetLevel=currentLevel+1;
  return targetLevel>=8?{currency:'goldFish',amount:GOLD_COSTS[targetLevel-8],targetLevel}:{currency:'coins',amount:COIN_COSTS[currentLevel-1],targetLevel};
}

/** Supports both a recipe's detailed flow and a plain step count. The base
 * exertion accounts for pickup/delivery plus four energy per work step. */
export function workerOrderEnergyCost(flowOrStepCount,abilities={enduranceMultiplier:1}) {
  const steps=Array.isArray(flowOrStepCount)?flowOrStepCount.length:flowOrStepCount;
  if(!integer(steps,1,100)||!Number.isFinite(abilities?.enduranceMultiplier)||abilities.enduranceMultiplier<.099999999||abilities.enduranceMultiplier>1)return null;
  return Math.ceil((12+steps*4)*abilities.enduranceMultiplier);
}

/** Find when this worker can START an order after prior reservations and enough
 * real rest. A future energyAt includes already-booked work and cannot recover
 * before that work finishes. A cost beyond max stamina is unschedulable. */
export function workerEnergyReadyAt(record,earliestStart,energyCost) {
  if(!recordIsValid(record)||!integer(earliestStart)||!Number.isFinite(energyCost)||energyCost<=0||energyCost>recordMaxEnergy(record))return null;
  const availableAt=Math.max(earliestStart,record.energyAt),maxEnergy=recordMaxEnergy(record);
  if(record.energyMode==='rest-room'){
    if(record.rest&&earliestStart<record.rest.fullAt)return {startAt:record.rest.fullAt,restMs:record.rest.fullAt-earliestStart,energyBefore:maxEnergy,energyCost};
    const ability=workerAbilitySnapshot('worker-1',{'worker-1':record},availableAt);
    if(ability.energy<energyCost)return null;
    return {startAt:availableAt,restMs:0,energyBefore:ability.energy,energyCost};
  }
  const energy=Math.min(maxEnergy,record.energy+(availableAt-record.energyAt)/STAFF_ENERGY_RECOVERY_MS);
  const restMs=Math.max(0,Math.ceil((energyCost-energy)*STAFF_ENERGY_RECOVERY_MS));
  const startAt=availableAt+restMs;
  if(!integer(startAt))return null;
  return {startAt,restMs,energyBefore:Math.min(maxEnergy,energy+restMs/STAFF_ENERGY_RECOVERY_MS),energyCost};
}

/** Persist after scheduling a workflow; no stamina regenerates while it runs.
 * A null result means the scheduler tried to overspend energy or overlap work. */
export function reserveWorkerEnergy(training,workerId,{startAt,completedAt,energyCost}={}) {
  if(!validWorkerId(workerId)||!recordIsValid(training?.[workerId])||!integer(startAt)||!integer(completedAt)||completedAt<=startAt)return null;
  const plan=workerEnergyReadyAt(training[workerId],startAt,energyCost);
  if(!plan||plan.startAt!==startAt)return null;
  return {...training,[workerId]:{levels:{...training[workerId].levels},energyBase:staffEnergyBase(training[workerId]),...staffAbilitySnapshot(training[workerId]),...staffIdleRecoverySnapshot(training[workerId]),energy:Math.max(0,plan.energyBefore-energyCost),energyAt:completedAt,...(training[workerId].energyMode==='rest-room'?{energyMode:'rest-room',rest:null}:{})}};
}

/** Upgrade intents choose only worker/stat. The reducer supplies trusted wallet
 * balances, clock and roster; the cost and resulting level come from this table.
 * Increasing stamina expands capacity without gifting immediately usable energy. */
export function trainingUpgradeResult(training,workerId,statId,wallet,now=Date.now(),staffCount=0) {
  if(!integer(wallet?.coins,0,999999)||!integer(wallet?.goldFish,0,999999)||!integer(now))return {ok:false,reason:'员工训练数据暂时无法更新。'};
  const next=normalizeStaffTraining(training,now,staffCount);
  if(!validWorkerId(workerId)||!Object.hasOwn(next,workerId)||!STAT_IDS.includes(statId))return {ok:false,reason:'请选择已到岗的员工和训练项目。'};
  const record=next[workerId],cost=staffTrainingUpgradeCost(statId,record.levels[statId]);
  if(!cost)return {ok:false,reason:'这项能力已经达到 10 级。'};
  if(wallet[cost.currency]<cost.amount)return {ok:false,reason:cost.currency==='goldFish'?'金鱼干还不够，继续完成订单吧。':'小鱼干还不够，继续完成订单吧。'};
  // Rebase idle recovery before capacity changes; never erase future booked work.
  if(now>=record.energyAt){record.energy=workerAbilitySnapshot(workerId,next,now).energy;record.energyAt=now;}
  record.levels[statId]=cost.targetLevel;
  if(record.rest)record.rest.fullAt=record.energyAt+Math.ceil((recordMaxEnergy(record)-record.energy)*STAFF_ENERGY_RECOVERY_MS);
  return {ok:true,training:next,coins:wallet.coins-(cost.currency==='coins'?cost.amount:0),goldFish:wallet.goldFish-(cost.currency==='goldFish'?cost.amount:0),workerId,statId,level:cost.targetLevel,cost};
}

export function staffTrainingInfo(restaurant,now=Date.now()) {
  now=safeTime(now);
  const training=normalizeRestaurantStaffTraining(restaurant,now);
  return Object.keys(training).map(workerId=>({...workerAbilitySnapshot(workerId,training,now),rest:staffRestProjection(training[workerId],now),stats:STAFF_TRAINING_STATS.map(stat=>({...stat,level:training[workerId].levels[stat.id],cost:staffTrainingUpgradeCost(stat.id,training[workerId].levels[stat.id])}))}));
}

export function staffRestProjection(record,now=Date.now()){
  if(record?.energyMode!=='rest-room'||!record.rest)return null;
  const job=record.rest,segment=job.segments.find(s=>now<s.endAt),progress=segment?Math.min(1,Math.max(0,(now-segment.startAt)/(segment.endAt-segment.startAt))):1;
  const position=segment?{x:segment.from.x+(segment.to.x-segment.from.x)*progress,y:segment.from.y+(segment.to.y-segment.from.y)*progress}:{...STAFF_REST_ROOM_POSITION};
  return {phase:now<job.departAt?'exhausted':now<job.arriveAt?'walking':now<job.fullAt?'recovering':'ready',departAt:job.departAt,arriveAt:job.arriveAt,fullAt:job.fullAt,remainingMs:Math.max(0,job.fullAt-now),position,from:segment?.from??position,to:segment?.to??position,startAt:segment?.startAt??job.arriveAt,endAt:segment?.endAt??job.fullAt,progress};
}
export function restaurantStaffRestInfo(restaurant,now=Date.now()){
  now=safeTime(now);
  const training=normalizeRestaurantStaffTraining(restaurant,now);
  return Object.keys(training).map(id=>{const ability=workerAbilitySnapshot(id,training,now);return {id,energy:ability.energy,maxEnergy:ability.maxEnergy,energyMode:training[id].energyMode??'legacy',rest:staffRestProjection(training[id],now)};});
}

/** Isolated demo tooling may preview a single exhaustion click without erasing
 * any order, wallet or employee ability. An assigned employee is never edited. */
export function createStaffExhaustionTestPreset(restaurant,now=Date.now(),workerId='worker-1'){
  const training=normalizeRestaurantStaffTraining(restaurant,now);
  if(!training[workerId]||!integer(now)||(restaurant?.orders??[]).some(order=>{const flow=order.workflow;return flow?.workerId===workerId&&(flow.runs?.length?flow.completedAt===null||flow.completedAt>now:flow.completedAt>now);}))return null;
  return {...training,[workerId]:{levels:{...training[workerId].levels},energyBase:staffEnergyBase(training[workerId]),...staffAbilitySnapshot(training[workerId]),...staffIdleRecoverySnapshot(training[workerId]),energy:1,energyAt:now,energyMode:'rest-room',rest:null}};
}
