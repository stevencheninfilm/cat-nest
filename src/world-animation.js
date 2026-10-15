export function worldTravelStyle(path,start,{reducedMotion=false,energy=100}={}){
  let distance=0,before=start;
  for(const p of path){distance+=Math.hypot(p.x-before.x,p.z-before.z);before=p;}
  const run=!reducedMotion && energy>=35 && distance>=2.8;
  return {clip:run?'run':'walk',speed:reducedMotion?1.25:run?2.5:1.55,rate:reducedMotion?.55:run?1.05:.95};
}
export function worldTurnStyle(from,to,{reducedMotion=false}={}){
  const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
  if(reducedMotion || Math.abs(delta)<.8)return null;
  return {from,delta,clip:delta>0?'turn_left':'turn_right',rate:1.15};
}
export function worldInteractionStyle(id,{reducedMotion=false}={}){
  if(reducedMotion)return {clip:'idle',rate:.55,seconds:3.2};
  if(['console','bookshelf','claw','popcorn'].includes(id))return {clip:'special_attack',rate:1,seconds:3.2};
  if(['robot','toy','scratch','arcade','pool','recycle'].includes(id))return {clip:'attack',rate:1,seconds:3.6};
  return {clip:'idle',rate:1,seconds:3.4};
}
