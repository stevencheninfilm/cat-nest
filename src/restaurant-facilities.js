/** Shared facility effects. Levels 1–4 retain the original prices and timing
 * factors so already accepted orders and existing saves need no migration. */
export const RESTAURANT_FACILITY_MAX_LEVEL=10;
const safeLevel=value=>Number.isSafeInteger(value)?Math.min(10,Math.max(1,value)):1;
export const restaurantTableCapacity=level=>2*Math.min(4,safeLevel(level));
export const restaurantFacilityTimeMultiplier=level=>{
  const steps=safeLevel(level)-1;
  return steps<=3?1-.15*steps:(55-5*(steps-3))/100;
};
export const restaurantTipsMultiplier=level=>1+.15*(safeLevel(level)-1);
export const restaurantTableIncomeMultiplier=level=>1+.05*Math.max(0,safeLevel(level)-4);

export const RESTAURANT_FACILITIES=Object.freeze([
  {id:'kitchen',name:'料理台',description:'缩短食材加工与烹饪的基础耗时',costs:[180,420,900,1450,2200,3200,4500,6100,8000]},
  {id:'fridge',name:'保鲜冰箱',description:'缩短取食材的基础耗时',costs:[100,280,620,1050,1650,2450,3500,4800,6400]},
  {id:'tables',name:'用餐座位',description:'1–4 级增加餐桌，5–10 级提高用餐舒适收益',costs:[150,450,1100,1700,2500,3500,4700,6200,8000]},
  {id:'tips',name:'暖心服务',description:'提高每道料理的小鱼干收入',costs:[120,340,800,1350,2100,3100,4400,6000,7900]},
].map(item=>Object.freeze({...item,maxLevel:RESTAURANT_FACILITY_MAX_LEVEL,costs:Object.freeze(item.costs)})));

/** Numeric effects also drive the UI, preventing preview values from drifting
 * from authoritative cooking, rewards and table capacity. */
export function restaurantFacilityEffect(id,level){
  level=safeLevel(level);
  if(id==='kitchen'||id==='fridge')return {percent:Math.round((1-restaurantFacilityTimeMultiplier(level))*100),kind:'time-reduction'};
  if(id==='tips')return {percent:Math.round((restaurantTipsMultiplier(level)-1)*100),kind:'income'};
  if(id==='tables')return {capacity:restaurantTableCapacity(level),percent:Math.round((restaurantTableIncomeMultiplier(level)-1)*100),kind:'tables'};
  return null;
}
