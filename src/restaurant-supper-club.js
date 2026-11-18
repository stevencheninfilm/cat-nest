// A supper is hosted alongside normal service. Progress comes exclusively from
// successfully settled meals; no timer or extra kitchen reservation is needed.
import { RESEARCH_INSPIRATION_MAX } from './restaurant-research.js';
import { restaurantRecipe } from './restaurant-recipe-catalog.js';

const UNLOCK_LEVEL = 8;
const FAVORITE_UNLOCK_COMPLETIONS = 3;
const SIGNATURE_TARGET = 2;
const signatureBonus = tier => 15 * tier;
const THEMES = [
  { id:'mains', name:'暖灶家常席', category:'主食' },
  { id:'desserts', name:'午后甜点会', category:'甜点' },
  { id:'drinks', name:'猫爪饮品吧', category:'饮品' },
];
const TIERS = [
  { cost:1200, target:8, baseInspiration:45 },
  { cost:3000, target:12, baseInspiration:75 },
  { cost:6500, target:17, baseInspiration:120 },
  { cost:12000, target:23, baseInspiration:180 },
  { cost:22000, target:30, baseInspiration:255 },
  { cost:38000, target:38, baseInspiration:345 },
];
// Use the same worker IDs as the kitchen and employee-training ledger.
const SKILLS = {
  'worker-1':{ dishes:'主食' },
  'worker-2':{ welcome:'主食' },
  'worker-3':{ dishes:'off-theme' },
  'worker-4':{ welcome:'甜点' },
  'worker-5':{ dishes:'甜点' },
  'worker-6':{ dishes:'饮品' },
  'worker-7':{ welcome:'饮品' },
};
const emptyClub = () => ({completed:{mains:0,desserts:0,drinks:0}, active:null, last:null});
const exact = (value,keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
const natural = (value,min=0,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value>=min && value<=max;
const knownWorker = id => typeof id==='string' && Object.hasOwn(SKILLS,id);
const validPair = ids => Array.isArray(ids) && ids.length===2 && knownWorker(ids[0]) && knownWorker(ids[1]) && ids[0]!==ids[1];
const totalCompleted = club => Object.values(club.completed).reduce((sum,count)=>sum+count,0);

function themeInfo(themeId,completed) {
  const theme=THEMES.find(item=>item.id===themeId);
  const tier=Math.min(completed+1,TIERS.length);
  return {...theme,completed,tier,favoriteUnlocked:completed>=FAVORITE_UNLOCK_COMPLETIONS,...TIERS[tier-1]};
}

export function activeSupperFavoriteCategory(club) {
  const themeId=club?.active?.themeId;
  if(!themeId || club.completed[themeId]<FAVORITE_UNLOCK_COMPLETIONS)return null;
  return THEMES.find(theme=>theme.id===themeId)?.category??null;
}

export function supperTeamPreview(theme,workerIds) {
  const workers=[];
  let reward=theme.baseInspiration;
  for(const id of new Set(workerIds)){
    if(!knownWorker(id))continue;
    const {dishes,welcome}=SKILLS[id];
    if(welcome){
      const extra=(welcome===theme.category?12:6)*theme.tier;
      workers.push({id,description:`完成餐会额外 +${extra} 灵感`});
      reward+=extra;
    }else{
      workers.push({id,description:`${dishes==='off-theme'?'非主题菜':dishes}结账额外 +1 进度`});
    }
  }
  return {reward,workers};
}

export function sanitizeSupperStart(action) {
  if(!exact(action,['type','themeId','workerIds','run']) || action.type!=='restaurant-supper-start'
    || !THEMES.some(theme=>theme.id===action.themeId) || !validPair(action.workerIds) || !natural(action.run,1))return null;
  return {...action,workerIds:[...action.workerIds]};
}

function validRunShape(run,keys) {
  if (!run || !Object.hasOwn(run,'signatureDishes')) return exact(run,keys);
  if (!exact(run,[...keys,'signatureDishes'])) return false;
  const dishes=run.signatureDishes, theme=THEMES.find(item=>item.id===run.themeId);
  return !!theme && Array.isArray(dishes) && dishes.length<=SIGNATURE_TARGET
    && new Set(dishes).size===dishes.length
    && [...dishes].every(id=>restaurantRecipe(id)?.category===theme.category);
}

function earnedSignatureBonus(dishes,tier) {
  return dishes?.length===SIGNATURE_TARGET ? signatureBonus(tier) : 0;
}

// Old clients validate exact receipt keys and the original reward cap.
export function legacySupperClub(club) {
  if (!club?.active?.signatureDishes && !club?.last?.signatureDishes) return club;
  const result={...club};
  if (club.active?.signatureDishes) {
    result.active={...club.active};
    delete result.active.signatureDishes;
  }
  if (club.last?.signatureDishes) {
    const theme=themeInfo(club.last.themeId,club.completed[club.last.themeId]-1);
    result.last={...club.last,reward:Math.min(club.last.reward,supperTeamPreview(theme,club.last.workerIds).reward)};
    delete result.last.signatureDishes;
  }
  return result;
}

export function validSupperClub(club,staff,served) {
  if(!natural(staff,0,6) || !natural(served) || !exact(club,['completed','active','last']) || !exact(club.completed,THEMES.map(theme=>theme.id))
    || !Object.values(club.completed).every(count=>natural(count,0,served)))return false;
  const done=totalCompleted(club);
  if(!natural(done,0,served))return false;
  const validRoster=run=>THEMES.some(theme=>theme.id===run.themeId) && validPair(run.workerIds);
  if(club.active!==null){
    const run=club.active;
    if(!validRunShape(run,['themeId','workerIds','run','progress']) || !validRoster(run) || !natural(run.run,1) || run.run!==done+1)return false;
    if(run.workerIds.some(id=>Number(id.slice(7))>staff+1))return false;
    const {target}=themeInfo(run.themeId,club.completed[run.themeId]);
    if(!natural(run.progress,2*(run.signatureDishes?.length??0),target-1) || run.progress>served*4 || (run.signatureDishes?.length??0)>served)return false;
  }
  if(done===0)return club.last===null;
  const last=club.last;
  if(!validRunShape(last,['themeId','workerIds','run','reward']) || !validRoster(last) || last.run!==done || club.completed[last.themeId]<1 || (last.signatureDishes?.length??0)>served)return false;
  const theme=themeInfo(last.themeId,club.completed[last.themeId]-1);
  return natural(last.reward,0,supperTeamPreview(theme,last.workerIds).reward+earnedSignatureBonus(last.signatureDishes,theme.tier));
}

function preservesStamps(before,after) {
  if (!before.signatureDishes) return !after.signatureDishes;
  return !!after.signatureDishes && before.signatureDishes.every((id,i)=>after.signatureDishes[i]===id);
}

export function supperProgressPreserved(before,after) {
  if(!before)return true;
  if(!after||THEMES.some(({id})=>after.completed[id]<before.completed[id]))return false;
  if(before.last && totalCompleted(before)===totalCompleted(after)){
    const last=after.last;
    if(!last || last.run!==before.last.run || last.themeId!==before.last.themeId
      || last.reward!==before.last.reward || last.workerIds.some((id,index)=>id!==before.last.workerIds[index])
      || !preservesStamps(before.last,last) || last.signatureDishes?.length!==before.last.signatureDishes?.length)return false;
  }
  const previous=before.active;
  if(!previous)return true;
  if(after.completed[previous.themeId]>before.completed[previous.themeId]){
    const receipt=after.last;
    return !!receipt && (receipt.run!==previous.run || (receipt.themeId===previous.themeId && receipt.workerIds.every((id,i)=>id===previous.workerIds[i]) && preservesStamps(previous,receipt)));
  }
  const active=after.active;
  return active?.run===previous.run && active.themeId===previous.themeId
    && active.workerIds.every((id,i)=>id===previous.workerIds[i]) && active.progress>=previous.progress && preservesStamps(previous,active);
}

export function supperClubInfo(restaurant,level,staffCatalog,recipes) {
  const club=restaurant.supperClub??emptyClub();
  const themes=THEMES.map(({id})=>{
    const theme=themeInfo(id,club.completed[id]);
    const dishes=recipes.filter(recipe=>recipe.unlocked && recipe.category===theme.category).map(({id,name})=>({id,name}));
    return {...theme,signature:{target:SIGNATURE_TARGET,bonus:signatureBonus(theme.tier),available:dishes.length>=SIGNATURE_TARGET,dishes}};
  });
  const staff=[{name:'橘子主厨',role:'主厨',sprite:'chef'},...staffCatalog.slice(0,restaurant.staff)];
  const workers=staff.map(({name,role,sprite},index)=>({id:`worker-${index+1}`,name,role,sprite}));
  const active=club.active, last=club.last;
  const project=({signatureDishes,...run},completed)=>{
    const theme=themeInfo(run.themeId,completed);
    const reward=supperTeamPreview(theme,run.workerIds).reward;
    const signature=signatureDishes ? {...themes.find(item=>item.id===run.themeId).signature,
      bonus:signatureBonus(theme.tier),collected:[...signatureDishes],completed:signatureDishes.length===SIGNATURE_TARGET,
      creditedBonus:Math.max(0,(run.reward??reward)-reward)} : null;
    return {tier:theme.tier,target:theme.target,reward,...run,workerIds:[...run.workerIds],signature};
  };
  return {unlockLevel:UNLOCK_LEVEL,maxTier:TIERS.length,favoriteUnlockCompletions:FAVORITE_UNLOCK_COMPLETIONS,unlocked:level>=UNLOCK_LEVEL,inspirationRoom:RESEARCH_INSPIRATION_MAX-restaurant.research.inspirationEarned,nextRun:totalCompleted(club)+1,themes,workers,
    active:active&&project(active,club.completed[active.themeId]),
    last:last&&project(last,club.completed[last.themeId]-1)};
}

export function startSupper(restaurant,info,action,coins) {
  const club=restaurant.supperClub??emptyClub();
  if(!info.unlocked)return {reason:`小馆达到 ${UNLOCK_LEVEL} 级可举办主题餐会。`};
  if(club.active)return {reason:'小馆正在办餐会，完成这场再开下一场吧。'};
  if(action.run!==info.nextRun)return {reason:'场次已更新，请按最新餐会重新选择。'};
  if(!action.workerIds.every(id=>info.workers.some(worker=>worker.id===id)))return {reason:'选择两位已经入职的猫猫筹办餐会。'};
  const theme=info.themes.find(theme=>theme.id===action.themeId);
  if(coins<theme.cost)return {reason:`筹办${theme.name}还差 ${theme.cost-coins} 小鱼干。`};
  if(supperTeamPreview(theme,action.workerIds).reward>info.inspirationRoom)
    return {reason:'灵感累计即将达到上限，无法再筹办这场餐会。'};
  return {club:{...club,active:{run:action.run,themeId:theme.id,workerIds:[...action.workerIds],progress:0,signatureDishes:[]}},
    cost:theme.cost,text:`花费 ${theme.cost} 小鱼干筹办${theme.name}，结账即可推进餐会`};
}

export function settleSupperMeal(restaurant,recipe) {
  const club=restaurant.supperClub, active=club?.active;
  if(!active)return;
  const theme=themeInfo(active.themeId,club.completed[active.themeId]);
  const category=recipe.category, matched=category===theme.category;
  let signatureDishes=active.signatureDishes;
  if(matched && signatureDishes && signatureDishes.length<SIGNATURE_TARGET && !signatureDishes.includes(recipe.id)){
    signatureDishes=[...signatureDishes,recipe.id];
  }
  let points=matched?2:1;
  for(const id of active.workerIds){
    const {dishes}=SKILLS[id];
    if(dishes===category || dishes==='off-theme'&&!matched)points++;
  }
  const progress=active.progress+points;
  if(progress<theme.target){
    restaurant.supperClub={...club,active:{...active,progress,...(signatureDishes && {signatureDishes})}};
    const stamp=signatureDishes!==active.signatureDishes ? ` · 招牌菜单收录${recipe.name}（${signatureDishes.length}/${SIGNATURE_TARGET}）` : '';
    return `${theme.name}进度 ${progress}/${theme.target}${stamp}`;
  }
  // Guest gifts or fragment fusion can fill the cumulative research ledger
  // mid-supper. Always settle the meal and credit only the remaining headroom.
  const baseReward=supperTeamPreview(theme,active.workerIds).reward;
  const reward=Math.min(baseReward+earnedSignatureBonus(signatureDishes,theme.tier),RESEARCH_INSPIRATION_MAX-restaurant.research.inspirationEarned);
  restaurant.research.inspirationEarned+=reward;
  restaurant.supperClub={completed:{...club.completed,[theme.id]:theme.completed+1},active:null,
    last:{run:active.run,themeId:theme.id,workerIds:[...active.workerIds],reward,...(signatureDishes && {signatureDishes})}};
  const bonus=reward-baseReward;
  return `${theme.name}圆满收席，获得 ${reward} 研发灵感`+(bonus>0?`（含招牌菜单 +${bonus}）`:'');
}
