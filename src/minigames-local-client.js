import { createLocalGameHub, stepLocalGame, localInputRow, replayLocalGame, sanitizeLocalGameAction, LOCAL_GAME_VERSION } from './minigames-local-rules.js';
import { createLocalGameCompute } from './minigames-local-compute.js';

/** Solo/computer play never waits for the network or changes confirmed pet XP. */
export function createLocalGames({storage,getActor,getConfirmedState,submit,canUpload=()=>true,isQueued=()=>false,onChange=()=>{},notice=()=>{},now=Date.now,uuid=()=>crypto.randomUUID(),seed=()=>crypto.getRandomValues(new Uint32Array(1))[0]||1,setTimer=setTimeout,clearTimer=clearTimeout,compute=createLocalGameCompute()}){
  let owner='',data,hub=null,timer=null,persistTimer=null,paused=false;
  const sent=new Set();
  function load(){
    const actor=getActor();if(data && actor.id===owner)return;
    persistNow();clearTimer(timer);timer=null;owner=actor.id;hub=null;data=null;sent.clear();
    try{data=JSON.parse(storage?.getItem(`catnest.local-games.${owner}`)||'null');}catch{}
    if(data?.version!==1||!Array.isArray(data.pending)||data.pending.length>20)data={version:1,current:null,pending:[]};
    data.pending=data.pending.filter(s=>sanitizeLocalGameAction({type:'game-local-finish',session:s}));
    if(data.current){hub=replayLocalGame(data.current,actor,now());if(!hub)data.current=null;}
  }
  function persistNow(){clearTimer(persistTimer);persistTimer=null;if(!data||!owner)return;try{storage?.setItem(`catnest.local-games.${owner}`,JSON.stringify(data));}catch{notice('本机空间不足，请保持页面打开，联网后会继续保存结果。');}}
  function persist(){if(!persistTimer)persistTimer=setTimer(persistNow,100);}
  function schedule(){
    clearTimer(timer);timer=null;if(paused||!hub||hub.match.status!=='active')return;
    const m=hub.match;
    const type=m.game==='memory'&&m.phase==='reveal'?'game-next':m.mode==='computer'&&m.turn===1&&m.phase==='play'&&!m.arcade?'game-bot':null;
    if(type)timer=setTimer(()=>{
      timer=null;const action={type,gameId:m.id,step:m.game==='rps'?m.rounds.length:m.step};
      const s=data.current,snapshot=hub,ownerAtStart=owner,at=Math.max(s.log.at(-1)?.[0]||0,now()-s.startedAt);
      const work=type==='game-bot'&&['gomoku','tictactoe','connect4'].includes(m.game)?compute.run({hub,action,session:{id:s.id,seed:s.seed,startedAt:s.startedAt},actor:getActor(),at:s.startedAt+at,index:s.log.length}):null;
      if(work)work.then(next=>{if(paused||hub!==snapshot||owner!==ownerAtStart||data.current!==s||hub.match.status!=='active')return;if(next)commit(action,s,at,next);else dispatch(action);});
      else dispatch(action);
    },Math.max(0,(type==='game-next'?m.revealUntil:m.botReadyAt)-now()));
  }
  function reconcile(){
    load();const receipts=getConfirmedState().games.localReceipts||[];
    const saved=new Map(receipts.filter(r=>r.actorId===owner).map(r=>[r.id,r]));
    const remaining=data.pending.filter(s=>!saved.has(s.id));
    if(remaining.length!==data.pending.length){data.pending=remaining;persist();}
    if(hub&&saved.has(hub.match.id))hub.match.reward=saved.get(hub.match.id).reward;
  }
  function pump(){
    reconcile();if(!canUpload()||data.pending.some(s=>isQueued(s.id)))return;
    for(const session of data.pending){
      if(sent.has(session.id)||isQueued(session.id))continue;
      sent.add(session.id);
      if(submit({type:'game-local-finish',session:structuredClone(session)}))return;
      sent.delete(session.id);
    }
  }
  function dispatch(action){
    load();
    if(action.type==='game-create'){
      if(!['solo','computer'].includes(action.mode)||hub?.match.status==='active')return false;
      if(data.pending.length>=20){notice('还有较多对局结果等待上传，请先联网保存。');return false;}
      const session={version:LOCAL_GAME_VERSION,id:uuid(),game:action.game,mode:action.mode,level:action.difficulty||'normal',seed:seed(),startedAt:now(),log:[]};
      if(!sanitizeLocalGameAction({type:'game-local-finish',session}))return false;
      const next=createLocalGameHub(session,getActor());if(!next)return false;
      data.current=session;hub=next;persistNow();onChange();schedule();return true;
    }
    if(!hub||action.gameId!==hub.match.id)return false;
    if(action.type==='game-cancel'){
      if(hub.match.status!=='active')return false;
      hub.match.status='cancelled';data.current=null;clearTimer(timer);timer=null;persistNow();onChange();return true;
    }
    const s=data.current;if(!s||hub.match.status!=='active')return false;
    const at=Math.max(s.log.at(-1)?.[0]||0,now()-s.startedAt),row=localInputRow(action,at);
    if(!row)return false;
    // Run only the small game hub; no full diary/collection normalization per tap.
    const next=stepLocalGame(hub,action,s,getActor(),s.startedAt+at,s.log.length);if(!next)return false;
    return commit(action,s,at,next);
  }
  function commit(action,s,at,next){
    const row=localInputRow(action,at);
    const log=[...s.log,row];
    if(!sanitizeLocalGameAction({type:'game-local-finish',session:{...s,log}})){notice('本局操作记录已达上限，请结束后重新开局。');return false;}
    s.log=log;hub=next;
    if(hub.match.status==='finished'){
      data.pending.push(structuredClone(s));persistNow();pump();
    }else persist();
    onChange();schedule();return true;
  }
  return {
    dispatch,pump,reconcile,persist:persistNow,warm:compute.warm,
    get active(){load();return Boolean(hub);},
    handles(action){load();return Boolean(hub&&action?.gameId===hub.match.id);},
    state(base){load();return hub?{...base,games:{...hub,day:base.games.day,earned:base.games.earned}}:base;},
    status(){reconcile();return {pending:data.pending.length,unconfirmed:Boolean(hub?.match.status==='finished'&&data.pending.some(s=>s.id===hub.match.id))};},
    exit(){load();if(hub?.match.status==='active')return false;hub=null;data.current=null;persistNow();return true;},
    retry(){sent.clear();pump();onChange();},
    pause(){paused=true;clearTimer(timer);timer=null;persistNow();},
    resume(){load();paused=false;schedule();pump();},
  };
}
