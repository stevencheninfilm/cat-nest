/** One arithmetic ladder implementation, with separate pet and restaurant rates.
 * The pet retains 120, 150, 180…; the restaurant uses 60, 75, 90… . */
function createGrowthLadder(step) {
  const coefficient=step/2;
  function levelStartXp(level) {
    const completed=Number.isFinite(level)?Math.max(0,Math.floor(level)-1):0;
    return coefficient*completed*(completed+7);
  }
  function levelInfo(xp) {
    const bounded=Number.isFinite(xp)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,xp)):0;
    const total=Number.isInteger(bounded)?bounded:Math.round(bounded*10)/10;
    const threshold=completed=>levelStartXp(completed+1);
    let completed=Math.floor((Math.sqrt(49+4*total/coefficient)-7)/2);
    // Correct rounding at exact boundaries, including large saved balances.
    while(threshold(completed)>total)completed-=1;
    while(threshold(completed+1)<=total)completed+=1;
    const progress=total-threshold(completed);
    return {level:completed+1,progress:Number.isInteger(progress)?progress:Math.round(progress*10)/10,target:step*(completed+4)};
  }
  return {levelStartXp,levelInfo};
}
export const {levelInfo,levelStartXp}=createGrowthLadder(30);
export const {levelInfo:restaurantLevelInfo,levelStartXp:restaurantLevelStartXp}=createGrowthLadder(15);
