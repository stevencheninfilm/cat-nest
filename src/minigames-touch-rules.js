/** Short cat activities. Input positions are replayed by the same server rules. */
export const TOUCH_GAMES = ['teaser','treats','hide-toy'];
export const CAT_PLAY_UNLOCK_LEVEL = 5;
export const catPlayUnlocked = level => Number.isFinite(level) && level >= CAT_PLAY_UNLOCK_LEVEL;
export const TOUCH_DURATION = {teaser:45000,treats:30000,'hide-toy':40000};
export const TOY_PEEK_MS = 2000;
export const TOUCH_INFO = {
  teaser:{name:'逗猫棒追逐',emoji:'🪶',xp:10,description:'拖动羽毛经过发光爪印，让猫猫追上小魔法。',hint:'按住并拖动羽毛，划过发光爪印；每次移动一小段才算追到。',requirement:'追到 5 次羽毛',duration:45},
  treats:{name:'接住小零食',emoji:'🐟',xp:10,description:'左右移动猫猫，接住落下的小鱼，躲开飘落的叶子。',hint:'按住下方猫猫左右拖动接小鱼；叶子飘来时挪开一点。',requirement:'接住 3 条小鱼并移动 3 次',duration:30},
  'hide-toy':{name:'寻找小玩具',emoji:'🐾',xp:10,description:'先记住小鱼玩具在哪个软垫下面，盖住后点那个软垫找回来。',hint:'先看 2 秒，记住小鱼玩具的位置；盖住后点原来的软垫。每轮可试两次，找到 3 次即可达标。',requirement:'找到 3 次小鱼玩具',duration:40},
};
const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const hash=value=>{let x=value>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return(x^(x>>>16))>>>0;};
export const touchPoint=move=>({x:move%32,y:Math.floor(move/32)});
export const encodeTouchPoint=(x,y)=>Math.max(0,Math.min(31,Math.round(y)))*32+Math.max(0,Math.min(31,Math.round(x)));
const points=[[7,8],[25,12],[10,24],[24,25],[15,7],[7,19],[25,7],[18,23]];
export function teaserTarget(seed,slot){const p=points[(slot+hash(seed)%points.length)%points.length];return {x:p[0],y:p[1]};}
export function treatDrop(seed,index){const h=hash(seed+index*7919);return {x:4+h%24,leaf:Math.floor(h/24)%5===0,spawn:800+index*1000,catchAt:2000+index*1000};}
export function hiddenToyCell(seed,round){let cell=hash(seed)%6;for(let n=1;n<=round;n++)cell=(cell+1+hash(seed+n*31337)%5)%6;return cell;}
export function touchRunFields(game){
  if(game==='teaser')return {hits:0,hitSlots:[],point:encodeTouchPoint(16,20),slot:-1,travel:0,lastInputAt:-100};
  if(game==='treats')return {caught:0,missed:0,bumps:0,basket:16,resolved:-1,lastInputAt:-100};
  return {found:0,wrong:0,attempted:[],solved:[]};
}
export function advanceTouchRun(game,run,until,seed){
  if(game!=='treats')return;
  while(run.resolved<28){
    const index=run.resolved+1,drop=treatDrop(seed,index);
    if(drop.catchAt>until)break;
    const caught=Math.abs(run.basket-drop.x)<=4;
    if(drop.leaf){if(caught)run.bumps++;}
    else if(caught)run.caught++;else run.missed++;
    run.resolved=index;
  }
  run.score=Math.max(0,run.caught*10-run.bumps*2);
}
export function applyTouchEvent(game,run,[at,move],seed){
  if(game==='teaser'){
    if(!int(move,1023)||at-run.lastInputAt<60)return false;
    const slot=Math.floor(at/1500),p=touchPoint(move),previous=touchPoint(run.point),target=teaserTarget(seed,slot);
    if(slot!==run.slot){run.slot=slot;run.travel=0;}
    else run.travel+=Math.min(12,Math.hypot(p.x-previous.x,p.y-previous.y));
    run.point=move;run.lastInputAt=at;
    if(!run.hitSlots.includes(slot)&&run.travel>=8&&Math.hypot(p.x-target.x,p.y-target.y)<=4){run.hitSlots.push(slot);run.hits++;run.score=run.hits*10;}
    return true;
  }
  if(game==='treats'){
    if(!int(move,31)||at-run.lastInputAt<60||move===run.basket)return false;
    run.basket=move;run.lastInputAt=at;return true;
  }
  const round=Math.floor(at/5000),phase=at%5000,key=round*6+move;
  if(!int(move,5)||phase<TOY_PEEK_MS||phase>=4800||run.solved.includes(round)||run.attempted.includes(key)||run.attempted.filter(n=>Math.floor(n/6)===round).length>=2)return false;
  run.attempted.push(key);
  if(move===hiddenToyCell(seed,round)){run.solved.push(round);run.found++;}else run.wrong++;
  run.score=Math.max(0,run.found*10-run.wrong*2);return true;
}
export const touchEligible=(game,run)=>game==='teaser'?run.hits>=5:game==='treats'?run.caught>=3&&run.inputs>=3:run.found>=3;
export function validTouchRun(game,run){
  if(game==='teaser')return int(run.hits,30)&&Array.isArray(run.hitSlots)&&run.hitSlots.length===run.hits&&run.hitSlots.every(n=>int(n,29))&&new Set(run.hitSlots).size===run.hitSlots.length&&int(run.point,1023)&&Number.isInteger(run.slot)&&run.slot>=-1&&run.slot<=29&&Number.isFinite(run.travel)&&run.travel>=0&&run.travel<=10000&&Number.isInteger(run.lastInputAt)&&run.lastInputAt>=-100&&run.lastInputAt<=run.elapsed;
  if(game==='treats')return int(run.caught,29)&&int(run.missed,29)&&int(run.bumps,29)&&int(run.basket,31)&&Number.isInteger(run.resolved)&&run.resolved>=-1&&run.resolved<=28&&run.caught+run.missed+run.bumps<=run.resolved+1&&Number.isInteger(run.lastInputAt)&&run.lastInputAt>=-100&&run.lastInputAt<=run.elapsed;
  return int(run.found,8)&&int(run.wrong,16)&&Array.isArray(run.attempted)&&run.attempted.length===run.found+run.wrong&&run.attempted.length<=16&&run.attempted.every(n=>int(n,47))&&new Set(run.attempted).size===run.attempted.length&&Array.isArray(run.solved)&&run.solved.length===run.found&&run.solved.every(n=>int(n,7))&&new Set(run.solved).size===run.solved.length;
}
export function touchComputerEvents(game,seed,level='normal'){
  const chance={easy:60,normal:80,hard:100}[level],events=[];
  if(game==='teaser')for(let slot=0;slot<30;slot++){
    if(hash(seed+slot*197)%100>=chance)continue;
    const p=teaserTarget(seed,slot),x=p.x>16?p.x-12:p.x+12;
    events.push([slot*1500+200,encodeTouchPoint(x,p.y)],[slot*1500+650,encodeTouchPoint(p.x,p.y)]);
  }
  if(game==='treats')for(let n=0;n<29;n++){
    const d=treatDrop(seed,n),good=hash(seed+n*197)%100<chance;
    events.push([d.catchAt-200,good&&!d.leaf?d.x:d.x>16?2:29]);
  }
  if(game==='hide-toy')for(let round=0;round<8;round++){
    const target=hiddenToyCell(seed,round),good=hash(seed+round*197)%100<chance;
    events.push([round*5000+TOY_PEEK_MS+600,good?target:(target+1)%6]);
  }
  return events;
}
