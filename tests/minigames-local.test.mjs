import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalGames } from '../src/minigames-local-client.js';
import { createLocalGameHub, stepLocalGame, localInputRow, localRowAction, replayLocalGame, sanitizeLocalGameAction } from '../src/minigames-local-rules.js';
import { GAMES, validGameHub, publicGameHub, publicGameEvent } from '../src/minigames.js';
import { gomokuWinningCells } from '../src/minigames-computer.js';
import { extraWinningMoves, connect4Cell } from '../src/minigames-extra.js';
import { ARCADE_GAMES, ARCADE_DURATION, reactionCue } from '../src/minigames-arcade-rules.js';
import { initialState, reduceAction, levelStartXp } from '../src/state.js';
import { minigamesPanel } from '../src/minigames-ui.js';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { createMemoryStorage } from '../demo/storage.js';
import { createHomeRuntime } from '../src/app-runtime.js';
import { HOME_ENTRIES } from '../src/home-context.js';
import { createGamePreload, gameAssetUrls } from '../src/minigames-preload.js';
import { createLocalGameCompute } from '../src/minigames-local-compute.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createPetHandler } from '../server/pet-server.mjs';

const START=Date.UTC(2026,9,16,8),actor={id:'partner-male',name:'男方'};let serial=0;
function session(game='rps',mode='solo'){
  const s={version:1,id:`local-session-${++serial}`,game,mode,level:'normal',seed:42,startedAt:START,log:[]};
  let hub=createLocalGameHub(s,actor),at=START;
  function row(code,value,time=at){at=time;const r=code===4?[at-START,code,...value]:code===0?[at-START,code,value]:[at-START,code];const action=localRowAction(r,hub.match);const next=stepLocalGame(hub,action,s,actor,at,s.log.length);assert.ok(next,JSON.stringify({game,mode,action,at}));s.log.push(r);hub=next;assert.ok(validGameHub(hub,{privateState:true}));return hub.match;}
  return {s,row,get hub(){return hub;},get m(){return hub.match;},get at(){return at;}};
}
function finish(game,mode='solo'){
  const x=session(game,mode);
  if(ARCADE_GAMES.includes(game)){
    x.row(3);assert.equal(x.m.arcade.startAt,START+1000);
    x.row(4,[ARCADE_DURATION[game],[]],START+1000+ARCADE_DURATION[game]);
  }else for(let n=0;x.m.status==='active'&&n<1000;n++){
    const m=x.m;
    if(m.phase==='reveal'){x.row(2,undefined,m.revealUntil);continue;}
    if(mode==='computer'&&m.turn===1&&game!=='rps'){x.row(1,undefined,m.botReadyAt);continue;}
    let move;
    if(game==='rps')move=mode==='solo'?{rock:'paper',paper:'scissors',scissors:'rock'}[m.challengeHand]:'rock';
    else if(game==='memory'){
      const available=m.secret.deck.flatMap((v,n)=>!m.matched[n]&&!m.flipped.includes(n)?[n]:[]);
      move=m.flipped.length?available.find(n=>m.secret.deck[n]===m.secret.deck[m.flipped[0]]):available[0];
    }else if(game==='guess')move=Math.floor((m.low+m.high)/2);
    else if(mode==='solo')move=game==='gomoku'?gomokuWinningCells(m.board,1)[0]:extraWinningMoves(game,m.board,1)[0];
    else move=game==='connect4'?[3,2,4,1,5,0,6].find(c=>connect4Cell(m.board,c)>=0):m.board.findIndex(v=>v===0);
    x.row(0,move,x.at+1);
  }
  assert.equal(x.m.status,'finished',`${game} ${mode} completed`);return x;
}
for(const game of Object.keys(GAMES))for(const mode of ['solo','computer'])test(`${game} ${mode} runs to completion and the API reconstructs exactly the same result`,()=>{
  const x=finish(game,mode),replayed=replayLocalGame(x.s,actor,START+86400000);
  assert.deepEqual(replayed,x.hub);
  let saved=initialState(START);saved.xp=levelStartXp(5);
  const result=reduceAction(saved,{type:'game-local-finish',session:x.s},actor,START+86400000,'local-upload-id');
  assert.ok(result);assert.equal(result.xp,saved.xp);assert.equal(result.games.match,null,'local completion never replaces the shared board');
  assert.equal(result.games.localReceipts[0].id,x.s.id);
  assert.equal(result.pendingGrowth.length,x.m.arcade?0:1,'idle arcade never generates a reward');
});

test('reaction records local tap time, not delayed network arrival, and settlement retains the daily cap and click-to-claim',()=>{
  const x=session('reaction','computer');x.row(3);
  for(let round=0;round<5;round++){
    const at=reactionCue(x.m.arcade.seed,round)+100;
    x.row(4,[at,[[at,round]]],START+1000+at);
    assert.equal(x.m.arcade.runs[0].reactions[round].ms,100);
  }
  x.row(4,[25000,[]],START+26000);assert.equal(x.m.arcade.rewardEligible,true);
  const before={...initialState(START),games:{day:Math.floor((START+8*3600000)/86400000),earned:48,match:null}};
  const saved=reduceAction(before,{type:'game-local-finish',session:x.s},actor,START+999000,'reaction-upload');
  assert.equal(saved.games.earned,50);assert.equal(saved.games.localReceipts[0].reward,2);assert.equal(saved.pendingGrowth[0].amount,2);assert.equal(saved.xp,before.xp);
  const claimed=reduceAction(saved,{type:'claim-growth',rewardId:`game:${x.s.id}`},actor,START+999001,'reaction-claim');
  assert.equal(claimed.xp,before.xp+2);assert.equal(claimed.games.localReceipts.length,1);
  assert.equal(reduceAction(claimed,{type:'game-local-finish',session:x.s},actor,START+999002,'replayed-local-upload'),null);
});

test('invalid or unfinished replays, duo forgeries, arbitrary scores, reordered timestamps and oversized inputs fail closed',()=>{
  const x=finish('rps'),action={type:'game-local-finish',session:x.s};
  for(const changed of [s=>s.mode='duo',s=>s.seed=0,s=>s.score=999,s=>s.log[1][0]=-1,s=>s.log.reverse(),s=>s.log.push([0,8]),s=>s.log[0].push(7),s=>s.log=Array.from({length:2049},()=>[0,1]),s=>s.log=Array.from({length:2048},(_,i)=>[i,4,180000,[[180000,1023]]])]){
    const value=structuredClone(action);changed(value.session);assert.equal(sanitizeLocalGameAction(value),null);
  }
  assert.equal(sanitizeAction({type:'game-local-finish',sessionId:x.s.id}),null,'public receipt is not a submit action');
  assert.equal(sanitizeAction({...action,xp:999}),null);
  const unfinished=session('memory').s;
  assert.equal(reduceAction(initialState(START),{type:'game-local-finish',session:unfinished},actor,START+100000,'unfinished-upload'),null);
  const premature=structuredClone(x.s);premature.log[1][0]=0;
  assert.equal(replayLocalGame(premature,actor,START+999000),null,'waiting guards are part of the replay');
  assert.equal(replayLocalGame(x.s,actor,START-120000),null,'future recorded inputs cannot be submitted early');
});

test('a finished local session preserves an in-progress shared duo, needs, existing rewards and collection data',()=>{
  const x=finish('rps');let state=initialState(START);
  state=reduceAction(state,{type:'game-create',game:'memory',mode:'duo',previousId:null},actor,START,'existing-duo-game');
  const board=structuredClone(state.games.match);
  const result=reduceAction(state,{type:'game-local-finish',session:x.s},actor,START+100000,'independent-upload');
  assert.deepEqual(result.games.match,board);assert.equal(result.games.earned,5);assert.equal(result.collection.wins.rps,1);assert.equal(result.pendingGrowth.length,1);
  assert.equal(result.coins,state.coins);assert.equal(result.love,state.love);
  assert.equal(reduceAction(result,{type:'game-local-finish',session:x.s},actor,START+86400000,'replay-next-day'),null);
  const exposed=publicGameEvent({action:{type:'game-local-finish',session:x.s}});
  assert.deepEqual(exposed.action,{type:'game-local-finish',sessionId:x.s.id});assert.equal(publicGameHub(result.games).match.secret,undefined);
});

function clockHarness(){
  let at=START,n=0;const timers=new Map();
  return {now:()=>at,setTimer(fn,ms){timers.set(++n,{fn,due:at+ms});return n;},clearTimer(id){timers.delete(id);},advance(ms){const target=at+ms;let count=0;while(true){const next=[...timers].filter(([,t])=>t.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;assert.ok(++count<1000,'timers do not spin');timers.delete(next[0]);at=next[1].due;next[1].fn();}at=target;}};
}
function clientHarness({storage=createMemoryStorage(),base=initialState(START),online=false}={}){
  const time=clockHarness(),requests=[],queued=new Set();let me=actor,confirmed=base,canUpload=online;
  const options={storage,getActor:()=>me,getConfirmedState:()=>confirmed,canUpload:()=>canUpload,isQueued:id=>queued.has(id),submit(action){requests.push(action);return true;},onChange(){},notice(){},uuid:()=>`client-local-${++serial}`,seed:()=>42,...time};
  const local=createLocalGames(options);
  return {local,time,requests,options,storage,queued,get base(){return confirmed;},set base(v){confirmed=v;},set online(v){canUpload=v;},set actor(v){me=v;},m:()=>local.state(confirmed).games.match};
}
function solveClientRps(h){
  for(let n=0;n<3;n++){
    const m=h.m();assert.equal(h.local.dispatch({type:'game-move',gameId:m.id,step:m.rounds.length,move:{rock:'paper',paper:'scissors',scissors:'rock'}[m.challengeHand]}),true);
    if(n<2){h.time.advance(180);const m=h.m();assert.equal(h.local.dispatch({type:'game-next',gameId:m.id,step:m.rounds.length}),true);}
  }
}
test('offline taps update immediately with zero requests, can start the next session, then save once in the background',()=>{
  const h=clientHarness();h.local.dispatch({type:'game-create',game:'rps',mode:'solo'});const id=h.m().id;
  solveClientRps(h);assert.equal(h.m().status,'finished');assert.equal(h.requests.length,0);assert.equal(h.local.status().unconfirmed,true);assert.equal(h.base.pendingGrowth.length,0);
  h.online=true;h.local.pump();assert.equal(h.requests.length,1);h.local.pump();assert.equal(h.requests.length,1,'an outstanding upload is never resent per frame');
  assert.equal(h.local.dispatch({type:'game-create',game:'memory',mode:'solo'}),true,'a stalled upload never blocks a new game');
  const m=h.m();assert.equal(h.local.dispatch({type:'game-move',gameId:m.id,step:m.step,move:0}),true);assert.notEqual(h.m().cards[0],null,'card face appears without any server response');
  h.base=reduceAction(h.base,h.requests[0],actor,START+100000,'saved-local-result');h.local.reconcile();
  assert.equal(h.local.status().pending,0);assert.equal(h.base.pendingGrowth[0].id,`game:${id}`);assert.equal(h.base.xp,86);
});
test('local computer turns take 140 ms, mismatched cards turn over after 650 ms, with no network requests',()=>{
  const h=clientHarness();h.local.dispatch({type:'game-create',game:'tictactoe',mode:'computer'});
  let m=h.m();h.local.dispatch({type:'game-move',gameId:m.id,step:m.step,move:0});
  assert.equal(h.m().turn,1);h.time.advance(139);assert.equal(h.m().board.filter(Boolean).length,1);
  h.time.advance(1);assert.equal(h.m().board.filter(Boolean).length,2);assert.equal(h.m().turn,0);assert.equal(h.requests.length,0);
  h.local.dispatch({type:'game-cancel',gameId:h.m().id});h.local.dispatch({type:'game-create',game:'memory',mode:'computer'});
  m=h.m();const other=m.secret.deck.findIndex(v=>v!==m.secret.deck[0]);
  h.local.dispatch({type:'game-move',gameId:m.id,step:0,move:0});h.local.dispatch({type:'game-move',gameId:m.id,step:1,move:other});
  assert.equal(h.m().phase,'reveal');h.time.advance(649);assert.equal(h.m().flipped.length,2);h.time.advance(1);assert.equal(h.m().phase,'play');assert.equal(h.m().turn,1);
  h.time.advance(140);assert.equal(h.m().flipped.length,1);assert.equal(h.requests.length,0);
});
test('refresh restores the exact local board and pending results; actor and named-home storage remain isolated',()=>{
  const raw=createMemoryStorage(),sessions=createMemoryStorage();
  const runtime=id=>createHomeRuntime({home:HOME_ENTRIES.find(h=>h.id===id),localStorage:raw,sessionStorage:sessions});
  const h=clientHarness({storage:runtime('todd').localStorage});h.local.dispatch({type:'game-create',game:'rps',mode:'solo'});solveClientRps(h);h.local.persist();
  const reloaded=createLocalGames(h.options);assert.deepEqual(reloaded.state(h.base).games.match,h.m());assert.equal(reloaded.status().pending,1);
  const other=clientHarness({storage:runtime('evian').localStorage});assert.equal(other.local.active,false);assert.equal(other.local.status().pending,0);
  h.actor={id:'partner-female',name:'女方'};assert.equal(h.local.active,false);assert.equal(h.local.status().pending,0);
  h.actor=actor;assert.equal(h.local.status().pending,1);
});
test('local UI leaves solo and computer enabled during cloud outages but keeps duo disabled; unconfirmed rewards are never shown as received',()=>{
  const state=initialState(START);
  const html=minigamesPanel({state,clientId:actor.id,saving:true,connected:false,selectedGame:'memory',localPlayable:true});
  for(const mode of ['solo','computer'])assert.doesNotMatch(html.match(new RegExp(`<button data-game-create="memory" data-game-mode="${mode}"[^>]*>`))[0],/disabled/);
  assert.match(html.match(/<button data-game-create="memory" data-game-mode="duo"[^>]*>/)[0],/disabled/);
  const x=finish('rps');const result=minigamesPanel({state:{...state,games:x.hub},clientId:actor.id,lobby:false,localMode:true,localPlayable:true,settlementPending:true,localPendingCount:1});
  assert.match(result,/联网核对后/);assert.doesNotMatch(result,/成长已经收好|data-open="growth"/);assert.match(result,/data-local-game-retry/);
});
test('entering the game room decodes all covers once without blocking on unavailable assets',async()=>{
  let loads=0;class Image{set src(value){loads++;queueMicrotask(()=>value.includes('memory')?this.onerror():this.onload());}decode(){return Promise.resolve();}}
  const preload=createGamePreload({ImageClass:Image});assert.equal(preload(),preload());await preload();assert.equal(loads,11);assert.equal(gameAssetUrls().length,11);
});

test('computer chess delegates to a worker and ignores its response after cancellation',async()=>{
  let solve,job;const h=clientHarness();
  const local=createLocalGames({...h.options,compute:{warm(){},run(input){job=structuredClone(input);return new Promise(resolve=>solve=resolve);}}});
  local.dispatch({type:'game-create',game:'connect4',mode:'computer'});
  let m=local.state(h.base).games.match;
  local.dispatch({type:'game-move',gameId:m.id,step:m.step,move:3});h.time.advance(140);
  assert.ok(job);assert.equal(local.state(h.base).games.match.board.filter(Boolean).length,1);
  local.dispatch({type:'game-cancel',gameId:m.id});
  solve(stepLocalGame(job.hub,job.action,job.session,job.actor,job.at,job.index));await Promise.resolve();
  assert.equal(local.state(h.base).games.match.status,'cancelled');assert.equal(h.requests.length,0);
});
test('worker startup or computation failures fall back to the same local engine',async()=>{
  let created=0,terminated=0;const worker={terminate(){terminated++;},postMessage(){queueMicrotask(()=>this.onerror());}};
  const compute=createLocalGameCompute({createWorker(){created++;return worker;}});
  compute.warm();compute.warm();assert.equal(created,1);assert.equal(await compute.run({}),null);assert.equal(terminated,1);assert.equal(compute.run({}),null);
  const h=clientHarness(),local=createLocalGames({...h.options,compute:{warm(){},run(){return Promise.resolve(null);}}});
  local.dispatch({type:'game-create',game:'tictactoe',mode:'computer'});const m=local.state(h.base).games.match;
  local.dispatch({type:'game-move',gameId:m.id,step:0,move:0});h.time.advance(140);await Promise.resolve();
  assert.equal(local.state(h.base).games.match.board.filter(Boolean).length,2);assert.equal(h.requests.length,0);
});

function mockStore(){
  const files=new Map();let version=0,writes=0;
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),file=files.get(id);
    if(options.method==='GET')return file?Response.json({sha:file.sha,encoding:'base64',content:Buffer.from(JSON.stringify(file.room)).toString('base64')}):new Response('{}',{status:404});
    const body=JSON.parse(options.body);if(file&&body.sha!==file.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`v${++version}`,room:JSON.parse(Buffer.from(body.content,'base64').toString())});writes++;return new Response('{}',{status:200});
  };
  return {files,get writes(){return writes;},make:()=>createGitHubStore({token:'test-token',repository:'test/data',fetchImpl,now:()=>START+999000})};
}
test('one result uses one GitHub write, duplicate/concurrent/new-operation retries cannot re-award after claim, journal rollover and server restart',async()=>{
  const mock=mockStore(),store=mock.make(),room=await store.createRoom(),x=finish('rps');
  const upload={operationId:'local-upload-one',clientId:actor.id,name:actor.name,action:{type:'game-local-finish',session:x.s}};
  const before=mock.writes,[a,b]=await Promise.all([store.applyAction(room.roomId,upload),store.applyAction(room.roomId,upload)]);
  assert.equal(mock.writes,before+1);assert.equal(a.state.games.earned,5);assert.equal(b.duplicate,true);
  assert.deepEqual(a.event.action,{type:'game-local-finish',sessionId:x.s.id});assert.equal(mock.files.get(room.roomId).room.operations[0].event.action.session,undefined,'large input logs are not copied into the permanent operation journal');
  await store.applyAction(room.roomId,{operationId:'local-game-claim',clientId:actor.id,name:actor.name,action:{type:'claim-growth',rewardId:`game:${x.s.id}`}});
  const file=mock.files.get(room.roomId);file.room.operations=[];file.sha='journal-rolled-over';
  const retry=await mock.make().applyAction(room.roomId,{...upload,operationId:'new-upload-operation'});
  assert.equal(retry.duplicate,true);assert.equal(retry.state.games.earned,5);assert.equal(retry.state.collection.wins.rps,1);assert.equal(retry.state.xp,91);assert.equal(retry.state.pendingGrowth.length,0);
  await assert.rejects(mock.make().applyAction(room.roomId,{...upload,operationId:'different-actor-operation',clientId:'partner-female',name:'女方'}),e=>e.code==='OPERATION_CONFLICT');
  assert.equal((await mock.make().getRoom(room.roomId)).state.games.localReceipts.length,1);
});

test('the actual HTTP action route accepts one bounded replay and exposes only its receipt',async t=>{
  const mock=mockStore(),store=mock.make(),room=await store.createRoom(),x=finish('memory');
  const handler=createPetHandler({store,serveStatic:false});
  const api=createServer(handler);api.listen(0,'127.0.0.1');await once(api,'listening');
  t.after(async()=>{handler.close();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));});
  const response=await fetch(`http://127.0.0.1:${api.address().port}/api/rooms/${room.roomId}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId:'http-local-result',clientId:actor.id,name:actor.name,action:{type:'game-local-finish',session:x.s}})});
  assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.state.games.earned,10);assert.equal(saved.state.pendingGrowth[0].amount,10);assert.equal(saved.state.xp,86);assert.equal(saved.event.action.session,undefined);
});
