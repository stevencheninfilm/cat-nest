import { GAMES, emptyGameHub, reduceGameHub, sanitizeGameAction } from './minigames.js';
import { ARCADE_GAMES } from './minigames-arcade-rules.js';

export const LOCAL_GAME_VERSION=1;
export const LOCAL_BOT_DELAY=140;
export const LOCAL_REVEAL_DELAY=650;
export const LOCAL_MAX_DURATION=24*3600_000;
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{8,170}$/.test(value);
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===expected;
export function localGameReceipt(action){return {type:'game-local-finish',sessionId:action.session.id};}
export function validLocalEvent(action){return keys(action,'sessionId,type')&&action.type==='game-local-finish'&&id(action.sessionId);}

/** A bounded input replay, never a client-supplied score, reward or winner. */
export function sanitizeLocalGameAction(action){
  if(!keys(action,'session,type')||action.type!=='game-local-finish')return null;
  const s=action.session;
  if(!keys(s,'game,id,level,log,mode,seed,startedAt,version')||s.version!==LOCAL_GAME_VERSION||!id(s.id)||!Object.hasOwn(GAMES,s.game)||!['solo','computer'].includes(s.mode)||!['easy','normal','hard'].includes(s.level)||!integer(s.seed,4294967295)||s.seed===0||!integer(s.startedAt)||!Array.isArray(s.log)||s.log.length>2048)return null;
  let previous=0,inputs=0;
  for(const row of s.log){
    if(!Array.isArray(row)||!integer(row[0],LOCAL_MAX_DURATION)||row[0]<previous||!integer(row[1],5))return null;
    previous=row[0];const code=row[1];
    if(code===0&&(row.length!==3||!['rock','paper','scissors'].includes(row[2])&&!integer(row[2],224)))return null;
    if([1,2,3,5].includes(code)&&row.length!==2)return null;
    if(code===4){
      if(row.length!==4||!integer(row[2],180000)||!Array.isArray(row[3])||row[3].length>256)return null;
      let at=0;
      for(const event of row[3]){if(!Array.isArray(event)||event.length!==2||!integer(event[0],row[2])||event[0]<at||!integer(event[1],1023))return null;at=event[0];}
      inputs+=row[3].length;if(inputs>2048)return null;
    }
  }
  // Keep the existing 32 KiB API body limit, including its actor envelope.
  if(JSON.stringify(action).length>30000)return null;
  return structuredClone(action);
}
function randomFor(seed,step){let value=(seed^Math.imul(step+1,0x9e3779b9))>>>0;return()=>{value=(value+0x6d2b79f5)>>>0;let n=Math.imul(value^(value>>>15),1|value);n^=n+Math.imul(n^(n>>>7),61|n);return((n^(n>>>14))>>>0)/4294967296;};}
function fastLocalTiming(hub,now){
  const m=hub.match;
  if(m.mode==='computer'&&m.turn===1&&m.phase==='play')m.botReadyAt=now+LOCAL_BOT_DELAY;
  if(m.phase==='reveal')m.revealUntil=now+(m.game==='memory'?LOCAL_REVEAL_DELAY:180);
  if(m.arcade?.stage==='running'&&m.arcade.startAt===now+3000)m.arcade.startAt=now+1000;
  return hub;
}
export function createLocalGameHub(session,actor){
  const action={type:'game-create',game:session.game,mode:session.mode,previousId:null,...(session.mode==='computer'&&ARCADE_GAMES.includes(session.game)?{difficulty:session.level}:{})};
  return reduceGameHub(emptyGameHub(session.startedAt),action,actor,session.startedAt,session.id,randomFor(session.seed,0));
}
export function localInputRow(action,at){
  if(action.type==='game-move')return [at,0,action.move];
  if(action.type==='game-bot')return [at,1];
  if(action.type==='game-next')return [at,2];
  if(action.type==='game-arcade-ready')return [at,3];
  if(action.type==='game-arcade-input')return [at,4,action.until,action.events.map(e=>[...e])];
  if(action.type==='game-arcade-sync')return [at,5];
  return null;
}
export function localRowAction(row,m){
  const base={gameId:m.id},step=m.game==='rps'?m.rounds.length:m.step;
  switch(row[1]){
    case 0:return {type:'game-move',...base,step,move:row[2]};
    case 1:return {type:'game-bot',...base,step};
    case 2:return {type:'game-next',...base,step};
    case 3:return {type:'game-arcade-ready',...base};
    case 4:return {type:'game-arcade-input',...base,seq:m.arcade?.runs[0].seq,until:row[2],events:row[3]};
    case 5:return {type:'game-arcade-sync',...base};
    default:return null;
  }
}
export function stepLocalGame(hub,action,session,actor,at,index){
  if(at<session.startedAt||at>session.startedAt+LOCAL_MAX_DURATION)return null;
  const clean=sanitizeGameAction(action);
  if(!clean||['game-create','game-join','game-cancel'].includes(clean.type))return null;
  const next=reduceGameHub(hub,clean,actor,at,`${session.id}:${index}`,randomFor(session.seed,index+1));
  return next?fastLocalTiming(next,at):null;
}
export function replayLocalGame(session,actor,now=Date.now()){
  const clean=sanitizeLocalGameAction({type:'game-local-finish',session});
  if(!clean||session.startedAt>now+60000||session.startedAt+(session.log.at(-1)?.[0]||0)>now+60000)return null;
  let hub=createLocalGameHub(session,actor);if(!hub)return null;
  for(let n=0;n<session.log.length;n++){
    if(hub.match.status!=='active')return null;
    const row=session.log[n];
    hub=stepLocalGame(hub,localRowAction(row,hub.match),session,actor,session.startedAt+row[0],n);
    if(!hub)return null;
  }
  return hub;
}
