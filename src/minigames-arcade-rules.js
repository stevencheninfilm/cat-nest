/** Deterministic engines shared by the browser and authoritative API. */
import { TOUCH_GAMES, TOUCH_DURATION, touchRunFields, advanceTouchRun, applyTouchEvent, touchEligible, validTouchRun, touchComputerEvents } from './minigames-touch-rules.js';
export const ARCADE_GAMES = ['reaction','merge2048','snake','whack',...TOUCH_GAMES];
export const ARCADE_DURATION = {reaction:25000,merge2048:180000,snake:60000,whack:30000,...TOUCH_DURATION};
export const ARCADE_LEVELS = ['easy','normal','hard'];
export const SNAKE_SIZE = 12;
const bounded = (v,max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const hash = value => {let n=value>>>0;n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);return(n^(n>>>16))>>>0;};
function random(run) {let x=run.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;run.rng=x>>>0;return run.rng/4294967296;}
export const reactionCue = (seed,round) => round*5000+1500+hash(seed+round*7919)%1300;
export function whackTarget(seed,slot) {
  const value=hash(seed+slot*65537);
  return {cell:value%9,cat:Math.floor(value/9)%5===0};
}
export function slideTiles(tiles,direction) {
  const next=Array(16).fill(0);let gain=0;
  for(let line=0;line<4;line++) {
    const cells=Array.from({length:4},(_,n)=>direction===0?n*4+line:direction===1?line*4+3-n:direction===2?(3-n)*4+line:line*4+n);
    const values=cells.map(cell=>tiles[cell]).filter(Boolean),merged=[];
    for(let n=0;n<values.length;n++) {
      if(values[n]===values[n+1]){merged.push(values[n]*2);gain+=values[n]*2;n++;}
      else merged.push(values[n]);
    }
    cells.forEach((cell,n)=>next[cell]=merged[n]||0);
  }
  return {tiles:next,gain,changed:next.some((v,n)=>v!==tiles[n])};
}
function spawnTile(run) {
  const cells=run.tiles.flatMap((v,n)=>v?[]:[n]);
  if(cells.length)run.tiles[cells[Math.floor(random(run)*cells.length)]]=random(run)<.9?2:4;
}
function canSlide(tiles) {return [0,1,2,3].some(d=>slideTiles(tiles,d).changed);}
function spawnFood(run) {
  const available=Array.from({length:144},(_,n)=>n).filter(n=>!run.body.includes(n));
  run.food=available.length?available[Math.floor(random(run)*available.length)]:-1;
}
export function createArcadeRun(game,seed,{computer=false,level='normal'}={}) {
  const run={seq:0,elapsed:0,score:0,finished:false,rng:seed||1,inputs:0};
  if(TOUCH_GAMES.includes(game))Object.assign(run,{seed:seed||1},touchRunFields(game));
  if(game==='reaction')Object.assign(run,{reactions:Array(5).fill(null),hits:0});
  if(game==='merge2048'){Object.assign(run,{tiles:Array(16).fill(0),moves:0,maxTile:2,lastInputAt:-100});spawnTile(run);spawnTile(run);}
  if(game==='snake'){Object.assign(run,{body:[78,77,76],direction:1,queued:null,tick:0,restUntil:0,fish:0,crashes:0,tickMs:computer?{easy:240,normal:200,hard:160}[level]:180,food:0,turns:0});spawnFood(run);}
  if(game==='whack')Object.assign(run,{hits:0,misses:0,attempted:[]});
  return run;
}
function nextSnakeCell(run,direction) {
  const head=run.body[0],y=Math.floor(head/12),x=head%12;
  const row=y+[-1,0,1,0][direction],col=x+[0,1,0,-1][direction];
  return row<0||row>=12||col<0||col>=12?-1:row*12+col;
}
function snakeStep(run) {
  run.tick++;
  if(run.tick<=run.restUntil)return;
  if(run.queued!==null){if((run.queued+2)%4!==run.direction)run.direction=run.queued;run.queued=null;}
  const cell=nextSnakeCell(run,run.direction),eats=cell===run.food;
  const occupied=run.body.slice(0,eats?run.body.length:-1);
  if(cell<0||occupied.includes(cell)) {
    run.crashes++;run.body=[78,77,76];run.direction=1;run.queued=null;run.restUntil=run.tick+6;
    if(run.body.includes(run.food))spawnFood(run);
  }else{
    run.body.unshift(cell);
    if(eats){run.fish++;spawnFood(run);if(run.food<0)run.finished=true;}else run.body.pop();
  }
  run.score=Math.max(0,run.fish*10-run.crashes*2);
}
export function advanceArcadeRun(game,run,until) {
  if(run.finished)return;
  until=Math.max(run.elapsed,Math.min(ARCADE_DURATION[game],Math.floor(until)));
  if(TOUCH_GAMES.includes(game))advanceTouchRun(game,run,until,run.seed);
  if(game==='snake')while(run.tick<Math.floor(until/run.tickMs)&&!run.finished)snakeStep(run);
  if(game==='reaction')for(let n=0;n<5;n++)if(until>=(n+1)*5000&&!run.reactions[n])run.reactions[n]={ms:3000,kind:'miss'};
  run.elapsed=until;
  if(until>=ARCADE_DURATION[game]||game==='merge2048'&&!canSlide(run.tiles))run.finished=true;
}
/** Each event is [elapsed milliseconds, direction/cell/round]. No scores arrive from clients. */
export function applyArcadeEvent(game,run,event,seed) {
  const [at,move]=event;
  advanceArcadeRun(game,run,at);
  if(run.finished)return false;
  if(TOUCH_GAMES.includes(game)) {
    if(!applyTouchEvent(game,run,event,seed))return false;
  }else if(game==='merge2048') {
    if(move>3||at-run.lastInputAt<70)return false;
    const result=slideTiles(run.tiles,move);if(!result.changed)return false;
    run.tiles=result.tiles;run.score+=result.gain;run.moves++;run.lastInputAt=at;spawnTile(run);
    run.maxTile=Math.max(...run.tiles);if(!canSlide(run.tiles))run.finished=true;
  }else if(game==='snake') {
    if(move>3||move===(run.direction+2)%4||run.queued!==null||move===run.direction)return false;
    run.queued=move;run.turns++;
  }else if(game==='whack') {
    const slot=Math.floor(at/850),target=whackTarget(seed,slot);
    if(move>8||run.attempted.includes(slot))return false;
    run.attempted.push(slot);
    if(at%850<650&&move===target.cell&&!target.cat)run.hits++;else run.misses++;
    run.score=Math.max(0,run.hits*10-run.misses*4);
  }else {
    const round=Math.floor(at/5000);if(move!==round||round>4||run.reactions[round])return false;
    const elapsed=at-reactionCue(seed,round),kind=elapsed<80?'early':'hit';
    const ms=kind==='hit'?Math.min(3000,elapsed):3000;
    run.reactions[round]={ms,kind};if(kind==='hit')run.hits++;
    run.score=run.reactions.reduce((sum,r)=>sum+(r?3000-r.ms:0),0);
  }
  run.inputs++;return true;
}
export function arcadeEligible(game,run) {
  if(TOUCH_GAMES.includes(game))return touchEligible(game,run);
  return game==='reaction'?run.hits>=1:game==='merge2048'?run.moves>=8:game==='snake'?run.fish>=1:run.hits>=3;
}
function tileValue(tiles) {
  const empty=tiles.filter(v=>!v).length,max=Math.max(...tiles);
  let smooth=0;
  for(let n=0;n<16;n++)for(const j of [n%4<3?n+1:-1,n<12?n+4:-1])if(j>=0&&tiles[n]&&tiles[j])smooth-=Math.abs(Math.log2(tiles[n])-Math.log2(tiles[j]));
  return empty*180+smooth*8+([0,3,12,15].some(n=>tiles[n]===max)?max:0);
}
export function choose2048Direction(run,level='normal') {
  const options=[0,1,2,3].map(move=>({move,...slideTiles(run.tiles,move)})).filter(o=>o.changed);
  if(!options.length)return null;
  if(level==='easy'&&hash(run.moves+run.rng)%3===0)return options[hash(run.moves)%options.length].move;
  options.forEach(o=>o.value=tileValue(o.tiles)+o.gain*2);
  if(level==='hard')for(const o of options)o.value+=Math.max(...[0,1,2,3].map(d=>{const r=slideTiles(o.tiles,d);return tileValue(r.tiles)+r.gain;}))*.5;
  options.sort((a,b)=>b.value-a.value);return options[0].move;
}
export function chooseSnakeDirection(run,level='normal') {
  const possible=[0,1,2,3].filter(d=>d!==(run.direction+2)%4&&nextSnakeCell(run,d)>=0&&!run.body.slice(0,-1).includes(nextSnakeCell(run,d)));
  if(!possible.length)return run.direction;
  if(level==='easy'&&possible.includes(run.direction)&&hash(run.tick+run.rng)%3)return run.direction;
  const blocked=new Set(run.body.slice(0,-1));
  function distance(start) {
    const queue=[[start,0]],seen=new Set([start]);let reach=0;
    for(let n=0;n<queue.length;n++) {
      const [cell,steps]=queue[n];reach++;
      if(cell===run.food)return {steps,reach:144};
      const y=Math.floor(cell/12),x=cell%12;
      for(const [dy,dx] of [[-1,0],[0,1],[1,0],[0,-1]]) {
        const row=y+dy,col=x+dx,at=row*12+col;
        if(row<0||row>=12||col<0||col>=12||blocked.has(at)||seen.has(at))continue;
        seen.add(at);queue.push([at,steps+1]);
      }
    }
    return {steps:999,reach};
  }
  return possible.map(move=>({move,...distance(nextSnakeCell(run,move))})).sort((a,b)=>a.steps-b.steps||b.reach-a.reach)[0].move;
}
export function advanceArcadeComputer(game,run,until,seed,level) {
  if(run.finished)return;
  until=Math.min(until,ARCADE_DURATION[game]);
  if(TOUCH_GAMES.includes(game)) {
    for(const event of touchComputerEvents(game,seed,level))if(event[0]>run.elapsed&&event[0]<=until)applyArcadeEvent(game,run,event,seed);
  }else if(game==='snake') {
    const target=Math.floor(until/run.tickMs);
    while(run.tick<target&&!run.finished){const at=(run.tick+1)*run.tickMs;run.queued=chooseSnakeDirection(run,level);advanceArcadeRun(game,run,at);}
  }else if(game==='merge2048') {
    const interval={easy:1200,normal:800,hard:500}[level];
    for(let at=(Math.floor(run.elapsed/interval)+1)*interval;at<=until&&!run.finished;at+=interval){const move=choose2048Direction(run,level);if(move!==null)applyArcadeEvent(game,run,[at,move],seed);else break;}
  }else if(game==='whack') {
    const probability={easy:55,normal:72,hard:88}[level];
    for(let slot=0;slot<Math.ceil(until/850);slot++) {
      const at=slot*850+250+hash(seed+slot)%300,target=whackTarget(seed,slot);
      if(at>run.elapsed&&at<=until&&!target.cat&&hash(seed^slot*31337)%100<probability)applyArcadeEvent(game,run,[at,target.cell],seed);
    }
  }else for(let round=0;round<5;round++) {
    const at=reactionCue(seed,round)+{easy:550,normal:360,hard:230}[level]+hash(seed+round)%100;
    if(at>run.elapsed&&at<=until)applyArcadeEvent(game,run,[at,round],seed);
  }
  advanceArcadeRun(game,run,until);
}
export function validArcadeRun(game,run) {
  if(!run||!bounded(run.seq,100000)||!bounded(run.elapsed,ARCADE_DURATION[game])||!bounded(run.score,1e9)||!bounded(run.rng,4294967295)||typeof run.finished!=='boolean'||!bounded(run.inputs,100000))return false;
  if(TOUCH_GAMES.includes(game))return bounded(run.seed,4294967295)&&run.seed>0&&validTouchRun(game,run);
  if(game==='merge2048')return Array.isArray(run.tiles)&&run.tiles.length===16&&run.tiles.every(v=>v===0||bounded(v,2**30)&&Number.isInteger(Math.log2(v))&&v>=2)&&bounded(run.moves,10000)&&bounded(run.maxTile,2**30)&&Number.isSafeInteger(run.lastInputAt)&&run.lastInputAt>=-100&&run.lastInputAt<=run.elapsed;
  if(game==='snake')return Array.isArray(run.body)&&run.body.length>=3&&run.body.length<=144&&run.body.every(v=>bounded(v,143))&&new Set(run.body).size===run.body.length&&bounded(run.direction,3)&&(run.queued===null||bounded(run.queued,3))&&bounded(run.tick,5000)&&bounded(run.restUntil,5006)&&bounded(run.fish,5000)&&bounded(run.crashes,5000)&&[160,180,200,240].includes(run.tickMs)&&(run.food===-1||bounded(run.food,143)&&!run.body.includes(run.food))&&bounded(run.turns,10000);
  if(game==='whack')return bounded(run.hits,36)&&bounded(run.misses,36)&&Array.isArray(run.attempted)&&run.attempted.length<=36&&run.attempted.every(v=>bounded(v,35))&&new Set(run.attempted).size===run.attempted.length;
  return bounded(run.hits,5)&&Array.isArray(run.reactions)&&run.reactions.length===5&&run.reactions.every(r=>r===null||r&&bounded(r.ms,3000)&&['hit','early','miss'].includes(r.kind));
}
