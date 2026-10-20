import { normalizeRestaurant, validRestaurant } from '../src/restaurant.js';
import { levelStartXp } from '../src/growth-levels.js';
import { RESEARCH_INSPIRATION_MAX } from '../src/restaurant-research.js';

/** Reachable only through the isolated demo adapter, never a server intent. */
export function restaurantResearchDebugResult(state,command,now=Date.now()){
  const reject=message=>({ok:false,message});
  if(!command||Object.keys(command).length!==1||command.mode!=='research-fusion'||!validRestaurant(state?.restaurant)||!Number.isSafeInteger(now)||now<state.restaurant.openedAt)return reject('碎片融合测试尚未准备好。');
  const next=structuredClone(state),restaurant=normalizeRestaurant(state.restaurant,now),research=restaurant.research;
  restaurant.lastInteractionAt=Math.max(restaurant.lastInteractionAt,now);
  if(research.inspirationEarned>RESEARCH_INSPIRATION_MAX-600)return reject('请刷新测试小馆后再准备融合测试。');
  research.draws+=20;research.inspirationEarned+=600;
  research.fragments.rice=(research.fragments.rice??0)+40;research.fragments.cocoa=(research.fragments.cocoa??0)+5;
  research.lastDraw={draw:research.draws,recipeId:'cocoa',amount:5};
  restaurant.recipeLevels.rice=Math.max(2,restaurant.recipeLevels.rice);restaurant.recipeLevels.cocoa=5;
  restaurant.stats.experience=Math.max(restaurant.stats.experience,levelStartXp(47));restaurant.revision++;next.restaurant=restaurant;next.updatedAt=now;
  if(!validRestaurant(restaurant))return reject('融合测试状态未通过检查，请刷新后再试。');
  return {ok:true,state:next,message:'已准备家常与传说碎片：蛋包饭保留升满所需，满级可可余片全部可融合。仅影响本次测试。'};
}
