import { ARCADE_GAMES, ARCADE_DURATION, ARCADE_LEVELS, createArcadeRun, validArcadeRun, advanceArcadeRun, applyArcadeEvent, advanceArcadeComputer, arcadeEligible } from './minigames-arcade-rules.js';
export { ARCADE_GAMES };
const int=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
export function sanitizeArcadeAction(value,keys) {
  if(value.type==='game-arcade-ready'&&keys==='gameId,type'||value.type==='game-arcade-sync'&&keys==='gameId,type')return {type:value.type,gameId:value.gameId};
  if(value.type!=='game-arcade-input'||keys!=='events,gameId,seq,type,until'||!int(value.seq,100000)||!int(value.until,180000)||!Array.isArray(value.events)||value.events.length>256)return null;
  if(value.events.some((e,n)=>!Array.isArray(e)||e.length!==2||!int(e[0],value.until)||!int(e[1],1023)||n>0&&e[0]<value.events[n-1][0]))return null;
  return {type:value.type,gameId:value.gameId,seq:value.seq,until:value.until,events:value.events.map(e=>[...e])};
}
export function createArcadeMatch(m,action,random) {
  if(!ARCADE_GAMES.includes(m.game))return;
  const seed=1+Math.floor(random()*4294967294),level=action.difficulty||'normal';
  m.arcade={version:1,stage:'ready',seed,level,startAt:0,ready:[false,m.mode==='computer'],rewardEligible:null,runs:m.players.map(p=>createArcadeRun(m.game,seed,{computer:p.computer,level}))};
}
export function validArcadeMatch(m) {
  if(!ARCADE_GAMES.includes(m.game))return m.arcade===undefined;
  const a=m.arcade;
  return !!a&&a.version===1&&['ready','running','finished'].includes(a.stage)&&int(a.seed,4294967295)&&a.seed>0&&ARCADE_LEVELS.includes(a.level)&&int(a.startAt)&&Array.isArray(a.ready)&&a.ready.length===2&&a.ready.every(v=>typeof v==='boolean')&&[null,true,false].includes(a.rewardEligible)&&Array.isArray(a.runs)&&a.runs.length===m.players.length&&a.runs.every(r=>validArcadeRun(m.game,r));
}
export function joinArcadeMatch(m) {if(m.arcade)m.arcade.runs.push(createArcadeRun(m.game,m.arcade.seed));}
/** Per-player sequence numbers allow two phones to submit without sharing a turn. */
export function reduceArcadeAction(m,action,player,now) {
  const a=m.arcade,duration=ARCADE_DURATION[m.game];
  if(!a)return false;
  if(action.type==='game-arcade-ready') {
    if(a.stage!=='ready'||a.ready[player])return false;
    a.ready[player]=true;
    if(m.players.every((_,n)=>a.ready[n])){a.stage='running';a.startAt=now+3000;}
    return true;
  }
  if(a.stage!=='running'||now<a.startAt)return false;
  const elapsed=Math.max(0,Math.min(duration,now-a.startAt)),run=a.runs[player];
  if(action.type==='game-arcade-input') {
    if(run.finished||action.seq!==run.seq||action.until<run.elapsed||action.until>Math.min(duration,elapsed+250)||action.events.some(e=>e[0]<run.elapsed))return false;
    if(m.game==='reaction') {
      if(action.events.length>1||action.events.length&&action.events[0][1]!==Math.floor(elapsed/5000))return false;
      if(action.events.length)applyArcadeEvent(m.game,run,[elapsed,action.events[0][1]],a.seed);
      advanceArcadeRun(m.game,run,elapsed);
    }else{
      for(const event of action.events)applyArcadeEvent(m.game,run,event,a.seed);
      advanceArcadeRun(m.game,run,action.until);
    }
    run.seq++;
  }else if(action.type!=='game-arcade-sync')return false;
  // Leave a short grace period for the final queued checkpoint. Never advance
  // another human's replay clock before their input has arrived.
  if(now>=a.startAt+duration+10000)for(let n=0;n<a.runs.length;n++)if(!m.players[n].computer)advanceArcadeRun(m.game,a.runs[n],duration);
  if(m.mode==='computer')advanceArcadeComputer(m.game,a.runs[1],elapsed,a.seed,a.level);
  m.scores=a.runs.map(r=>r.score);if(m.scores.length===1)m.scores.push(0);
  if(a.runs.every(r=>r.finished)) {
    a.stage='finished';m.status='finished';
    a.rewardEligible=a.runs.every((r,n)=>m.players[n].computer||arcadeEligible(m.game,r));
    m.winner=m.mode==='solo'?0:m.scores[0]===m.scores[1]?-1:m.scores[0]>m.scores[1]?0:1;
  }
  return true;
}
