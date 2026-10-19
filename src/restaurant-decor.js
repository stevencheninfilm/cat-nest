/** Shared, additive restaurant decoration rules. Amounts are basis points:
 * 100 bp = 1%. Owned suites grant permanent, snapshotted bonuses. */
export const RESTAURANT_DECORATIONS=Object.freeze([
  {id:'cream-bakery',theme:'cream',name:'奶油烘焙屋',description:'暖木、奶油色与刚出炉的甜香。',cost:0,buffs:{coins:100}},
  {id:'cream-library',theme:'cream',name:'暖光书房',description:'让猫猫在书香与暖灯间享用一餐。',cost:180,buffs:{experience:150}},
  {id:'mint-greenhouse',theme:'mint',name:'薄荷花房',description:'绿叶、玻璃与清新的花园时光。',cost:120,buffs:{cookSpeed:150}},
  {id:'mint-seaside',theme:'mint',name:'海盐假日',description:'条纹遮阳、海风与浅蓝色的小假期。',cost:260,buffs:{coins:200,cookSpeed:100}},
  {id:'sakura-teahouse',theme:'sakura',name:'樱花茶屋',description:'柔粉樱花与热茶，留住午后的温柔。',cost:240,buffs:{experience:200}},
  {id:'sakura-evening',theme:'sakura',name:'花灯晚宴',description:'花灯亮起，和猫猫一起等待星光。',cost:380,buffs:{coins:150,experience:100}},
].map(suite=>Object.freeze({...suite,buffs:Object.freeze(suite.buffs)})));
export const RESTAURANT_CONSTRUCTION_MS=12000;
export const RESTAURANT_DECORATION_SLOTS=Object.freeze([
  Object.freeze({id:'entry',x:12,y:24}),Object.freeze({id:'dining',x:91,y:45}),Object.freeze({id:'kitchen',x:88,y:78}),
]);
const DEFAULTS=Object.freeze({cream:'cream-bakery',mint:'mint-greenhouse',sakura:'sakura-teahouse'});
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const BUFF_KEYS=Object.freeze(['coins','experience','cookSpeed']);
export const RESTAURANT_DECORATION_MAX_COOK_SPEED=RESTAURANT_DECORATIONS.reduce((sum,suite)=>sum+(suite.buffs.cookSpeed??0),0);
const clamp=value=>Math.min(1,Math.max(0,value));
export const restaurantDecoration=id=>RESTAURANT_DECORATIONS.find(suite=>suite.id===id)||null;
export const defaultDecorationForTheme=theme=>DEFAULTS[theme]??null;
export function ownedRestaurantDecorations(restaurant) {
  return [...new Set([...(Array.isArray(restaurant.ownedDecorations)?restaurant.ownedDecorations:[]),...(restaurant.ownedThemes??['cream']).map(defaultDecorationForTheme).filter(Boolean)])];
}
export function restaurantDecorationSnapshot(restaurant) {
  const owned=ownedRestaurantDecorations(restaurant),ids=RESTAURANT_DECORATIONS.filter(suite=>owned.includes(suite.id)).map(suite=>suite.id);
  return ids.length?{version:2,ids,...decorationBonuses(ids)}:null;
}
const decorationBonuses=ids=>Object.fromEntries(BUFF_KEYS.map(key=>[key,ids.reduce((sum,id)=>sum+(restaurantDecoration(id)?.buffs[key]??0),0)]));
export function validDecorationSnapshot(value) {
  if(value?.version===2){
    if(!exact(value,['version','ids',...BUFF_KEYS])||!Array.isArray(value.ids)||!value.ids.length||new Set(value.ids).size!==value.ids.length||value.ids.some(id=>!restaurantDecoration(id)))return false;
    const canonical=RESTAURANT_DECORATIONS.filter(suite=>value.ids.includes(suite.id)).map(suite=>suite.id),bonuses=decorationBonuses(value.ids);
    return value.ids.every((id,i)=>id===canonical[i])&&BUFF_KEYS.every(key=>value[key]===bonuses[key]);
  }
  // Existing single-suite orders retain their original reward and timing.
  const suite=restaurantDecoration(value?.id);
  return !!suite&&exact(value,['id',...BUFF_KEYS])&&BUFF_KEYS.every(key=>value[key]===(suite.buffs[key]??0));
}
export function createRestaurantConstruction(restaurant,decorationId,now) {
  const target=restaurantDecoration(decorationId);
  if(!target||!integer(now,restaurant.openedAt)||!integer(now+RESTAURANT_CONSTRUCTION_MS))return null;
  return {id:`decoration-${restaurant.revision+1}`,fromDecorationId:restaurant.decorationId??null,fromTheme:restaurant.theme,toDecorationId:target.id,startedAt:now,buildAt:now+2000,installAt:now+7000,leaveAt:now+9500,finishAt:now+RESTAURANT_CONSTRUCTION_MS};
}
export function validRestaurantDecorations(restaurant) {
  const owned=ownedRestaurantDecorations(restaurant);
  if(Object.hasOwn(restaurant,'ownedDecorations')&&(!Array.isArray(restaurant.ownedDecorations)||new Set(restaurant.ownedDecorations).size!==restaurant.ownedDecorations.length||restaurant.ownedDecorations.some(id=>!restaurantDecoration(id))))return false;
  if(Object.hasOwn(restaurant,'decorationId')) {
    const suite=restaurantDecoration(restaurant.decorationId);
    if(!suite||suite.theme!==restaurant.theme||!owned.includes(suite.id))return false;
  }
  if(Object.hasOwn(restaurant,'decorationCarry')&&(!exact(restaurant.decorationCarry,['coins','experience'])||!integer(restaurant.decorationCarry.coins,0,9999)||!integer(restaurant.decorationCarry.experience,0,999)))return false;
  const job=restaurant.construction;
  if(job===undefined||job===null)return true;
  const keys=['id','fromDecorationId','fromTheme','toDecorationId','startedAt','buildAt','installAt','leaveAt','finishAt'];
  if(!exact(job,keys)||!/^decoration-[1-9][0-9]*$/.test(job.id)||!integer(Number(job.id.slice(11)),1,restaurant.revision)||!integer(job.startedAt,restaurant.openedAt)||!integer(job.finishAt)||!owned.includes(job.toDecorationId)||!restaurantDecoration(job.toDecorationId)||!restaurant.ownedThemes.includes(job.fromTheme)||!restaurant.ownedThemes.includes(restaurantDecoration(job.toDecorationId).theme))return false;
  if(job.fromDecorationId!==null&&(!owned.includes(job.fromDecorationId)||restaurantDecoration(job.fromDecorationId)?.theme!==job.fromTheme))return false;
  if(job.buildAt!==job.startedAt+2000||job.installAt!==job.startedAt+7000||job.leaveAt!==job.startedAt+9500||job.finishAt!==job.startedAt+RESTAURANT_CONSTRUCTION_MS)return false;
  const before=restaurant.theme===job.fromTheme&&(restaurant.decorationId??null)===job.fromDecorationId;
  const after=restaurant.theme===restaurantDecoration(job.toDecorationId).theme&&restaurant.decorationId===job.toDecorationId;
  return before||after;
}
/** Advance only derived construction state. Reading never charges or grants. */
export function normalizeRestaurantDecorations(restaurant,now) {
  const job=restaurant.construction;
  if(job&&now>=job.installAt) {
    restaurant.decorationId=job.toDecorationId;
    restaurant.theme=restaurantDecoration(job.toDecorationId).theme;
  }
  if(job&&now>=job.finishAt)restaurant.construction=null;
  return restaurant;
}
export function restaurantDecorationInfo(restaurant,now=Date.now()) {
  restaurant=normalizeRestaurantDecorations({...restaurant},now);
  const suite=restaurantDecoration(restaurant.decorationId??defaultDecorationForTheme(restaurant.theme));
  const owned=ownedRestaurantDecorations(restaurant),job=restaurant.construction;
  const construction=job&&now<job.finishAt?{
    ...job,phase:now<job.buildAt?'travel':now<job.installAt?'build':now<job.leaveAt?'install':'leave',
    progress:clamp((now-job.startedAt)/RESTAURANT_CONSTRUCTION_MS),remainingMs:Math.max(0,job.finishAt-now),
    slots:RESTAURANT_DECORATION_SLOTS.map((slot,index)=>({...slot,installedAt:job.installAt+index*800,installed:now>=job.installAt+index*800})),
    workers:[0,1].map(index=>{
      const entry={x:48+index*6,y:15},target={x:84+index*8,y:78};
      const from=now<job.buildAt?entry:target,to=now<job.buildAt?{x:12+index*7,y:24}:now>=job.leaveAt?entry:target;
      const startAt=now<job.buildAt?job.startedAt:now>=job.leaveAt?job.leaveAt:job.buildAt;
      const endAt=now<job.buildAt?job.buildAt:now>=job.leaveAt?job.finishAt:job.installAt;
      const progress=clamp((now-startAt)/(endAt-startAt));
      return {id:`construction-${index+1}`,from,to,startAt,endAt,progress,position:{x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress}};
    }),
  }:null;
  const active=restaurantDecorationSnapshot(restaurant);
  return {decoration:suite,activeDecorationId:restaurant.decorationId??null,activeBuffs:Object.fromEntries(BUFF_KEYS.map(key=>[key,active?.[key]??0])),construction,decorations:RESTAURANT_DECORATIONS.map(item=>({...item,owned:owned.includes(item.id),equipped:restaurant.decorationId===item.id,cost:owned.includes(item.id)?0:item.cost})),carry:{coins:restaurant.decorationCarry?.coins??0,experience:restaurant.decorationCarry?.experience??0}};
}
/** Keep sub-coin and sub-tenth XP remainders across collections, even after a
 * suite changes. Each order supplies its own immutable reward snapshot. */
export function decorationReward(base,snapshot,carry={coins:0,experience:0}) {
  const coins=base.coins*(snapshot?.coins??0)+carry.coins;
  const experience=base.xp*(snapshot?.experience??0)+carry.experience;
  return {coins:base.coins+Math.floor(coins/10000),xp:base.xp+Math.floor(experience/1000)/10,carry:{coins:coins%10000,experience:experience%1000}};
}
