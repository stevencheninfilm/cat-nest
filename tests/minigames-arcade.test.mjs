import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCADE_GAMES, ARCADE_DURATION, createArcadeRun, slideTiles, applyArcadeEvent, advanceArcadeRun, advanceArcadeComputer, choose2048Direction, chooseSnakeDirection, reactionCue, whackTarget } from '../src/minigames-arcade-rules.js';
import { GAMES, emptyGameHub, reduceGameHub, validGameHub, sanitizeGameAction, publicGameHub } from '../src/minigames.js';
import { TOUCH_GAMES, touchComputerEvents } from '../src/minigames-touch-rules.js';
import { initialState, reduceAction } from '../src/state.js';
import { minigamesPanel } from '../src/minigames-ui.js';
import { createGitHubStore } from '../server/github-store.mjs';
const START=Date.UTC(2026,9,15),alice={id:'client-one',name:'男方'},bob={id:'client-two',name:'女方'};let serial=0;
function session(game,mode='solo') {
  let hub=emptyGameHub(START),time=START;
  function send(action,actor=alice){hub=reduceGameHub(hub,action,actor,time,`arcade-operation-${++serial}`,()=>.314159);assert.ok(hub,JSON.stringify(action));assert.equal(validGameHub(hub,{privateState:true}),true);return hub;}
  send({type:'game-create',game,mode,previousId:null});const id=hub.match.id;
  if(mode==='duo')send({type:'game-join',gameId:id},bob);
  send({type:'game-arcade-ready',gameId:id});if(mode==='duo'){assert.equal(hub.match.arcade.stage,'ready');send({type:'game-arcade-ready',gameId:id},bob);}
  assert.equal(hub.match.arcade.startAt,START+3000);
  return {get hub(){return hub;},send,at(elapsed){time=START+3000+elapsed;},reject(action,actor=alice){assert.equal(reduceGameHub(hub,action,actor,time,`bad-operation-${++serial}`),null);}};
}
function humanEvents(game,source,seed,until) {
  const run=structuredClone(source),events=[];
  function add(at,move){if(applyArcadeEvent(game,run,[at,move],seed))events.push([at,move]);}
  if(TOUCH_GAMES.includes(game))for(const e of touchComputerEvents(game,seed,'hard'))if(e[0]>source.elapsed&&e[0]<=until)add(...e);
  if(game==='merge2048')for(let at=(Math.floor(run.elapsed/300)+1)*300;at<until&&!run.finished;at+=300){const move=choose2048Direction(run,'normal');if(move!==null)add(at,move);}
  if(game==='snake')for(let at=(run.tick+1)*run.tickMs-1;at<until&&!run.finished;at=(run.tick+1)*run.tickMs-1){advanceArcadeRun(game,run,at);add(at,chooseSnakeDirection(run));advanceArcadeRun(game,run,at+1);}
  if(game==='whack')for(let slot=0;slot<36;slot++){const at=slot*850+250,target=whackTarget(seed,slot);if(at>run.elapsed&&at<until&&!target.cat)add(at,target.cell);}
  return events;
}
function play(s,game,mode) {
  const duration=ARCADE_DURATION[game];
  if(game==='reaction')for(let round=0;round<5;round++)for(let player=0;player<(mode==='duo'?2:1);player++) {
    const a=s.hub.match.arcade,at=reactionCue(a.seed,round)+200+player*100;s.at(at);
    s.send({type:'game-arcade-input',gameId:s.hub.match.id,seq:a.runs[player].seq,until:at,events:[[at,round]]},player?bob:alice);
  }
  const increment=game==='reaction'?duration:2000;
  for(let until=game==='reaction'?duration:increment;until<=duration&&s.hub.match.status==='active';until+=increment) {
    s.at(until);
    for(let player=0;player<(mode==='duo'?2:1);player++) {
      const m=s.hub.match,source=m.arcade.runs[player];if(source.finished)continue;
      const events=humanEvents(game,source,m.arcade.seed,until);
      s.send({type:'game-arcade-input',gameId:m.id,seq:source.seq,until,events},player?bob:alice);
    }
  }
  if(s.hub.match.status==='active'){s.at(duration+11000);s.send({type:'game-arcade-sync',gameId:s.hub.match.id});}
}
test('2048 merges each tile once in all directions and leaves no-op boards unchanged',()=>{
  const board=[2,2,2,2,...Array(12).fill(0)];
  assert.deepEqual(slideTiles(board,3).tiles.slice(0,4),[4,4,0,0]);assert.equal(slideTiles(board,3).gain,8);
  assert.deepEqual(slideTiles(board,1).tiles.slice(0,4),[0,0,4,4]);
  const column=Array(16).fill(0);[0,4,8,12].forEach(n=>column[n]=2);
  assert.deepEqual([0,4,8,12].map(n=>slideTiles(column,0).tiles[n]),[4,4,0,0]);
  assert.deepEqual([0,4,8,12].map(n=>slideTiles(column,2).tiles[n]),[0,0,4,4]);
  assert.equal(slideTiles([2,...Array(15).fill(0)],0).changed,false);assert.equal(board[0],2);
});
test('snake replay preserves queued turns, rejects reversal and resets after a collision',()=>{
  const run=createArcadeRun('snake',42),copy=structuredClone(run);
  assert.equal(applyArcadeEvent('snake',run,[20,3],42),false);
  assert.equal(applyArcadeEvent('snake',run,[30,0],42),true);
  assert.equal(applyArcadeEvent('snake',run,[40,2],42),false);
  advanceArcadeRun('snake',run,180);assert.equal(run.direction,0);
  advanceArcadeRun('snake',run,10000);assert.ok(run.crashes>0);
  const a=structuredClone(copy),b=structuredClone(copy);advanceArcadeRun('snake',a,5000);for(let t=10;t<=5000;t+=10)advanceArcadeRun('snake',b,t);assert.deepEqual(a,b);
});
test('whack excludes cats and duplicate hits; reactions score early, valid and missed rounds',()=>{
  const run=createArcadeRun('whack',42);let mouse=0,cat=0;
  while(whackTarget(42,mouse).cat)mouse++;while(!whackTarget(42,cat).cat)cat++;
  const a=createArcadeRun('whack',42),t=whackTarget(42,mouse);
  assert.equal(applyArcadeEvent('whack',a,[mouse*850+300,t.cell],42),true);assert.equal(a.score,10);
  assert.equal(applyArcadeEvent('whack',a,[mouse*850+400,t.cell],42),false);
  applyArcadeEvent('whack',run,[cat*850+300,whackTarget(42,cat).cell],42);assert.equal(run.misses,1);assert.equal(run.hits,0);
  const r=createArcadeRun('reaction',42);applyArcadeEvent('reaction',r,[10,0],42);applyArcadeEvent('reaction',r,[reactionCue(42,1)+200,1],42);advanceArcadeRun('reaction',r,25000);
  assert.equal(r.reactions[0].kind,'early');assert.equal(r.reactions[1].ms,200);assert.equal(r.reactions[2].kind,'miss');assert.equal(r.score,2800);
});
test('all timed games finish in every mode with one capped reward and independent human sequences',()=>{
  for(const game of ARCADE_GAMES)for(const mode of ['solo','computer','duo']) {
    const s=session(game,mode);play(s,game,mode);const m=s.hub.match;
    assert.equal(m.status,'finished',`${game}/${mode}`);assert.equal(m.arcade.rewardEligible,true,`${game}/${mode}`);assert.equal(m.reward,GAMES[game].xp+(mode==='duo'?5:0));
    assert.equal(s.hub.earned,m.reward);s.reject({type:'game-arcade-sync',gameId:m.id});
    assert.equal(publicGameHub(s.hub).match.secret,undefined);
    assert.match(minigamesPanel({state:{games:s.hub,pendingGrowth:[]},clientId:alice.id,lobby:false}),/本局已结算|data-arcade-status/);
  }
});
test('arcade rejects forged scores, future input, stale sequence, outsiders, and legacy move routes',()=>{
  assert.equal(sanitizeGameAction({type:'game-arcade-input',gameId:'valid-game-id',seq:0,until:100,events:[],score:999}),null);
  for(const game of ARCADE_GAMES){const s=session(game),m=s.hub.match;s.at(1000);
    s.reject({type:'game-arcade-input',gameId:m.id,seq:0,until:5000,events:[]});
    s.reject({type:'game-move',gameId:m.id,step:m.step,move:0});
    s.reject({type:'game-arcade-input',gameId:m.id,seq:0,until:500,events:[]},{id:'outsider-id',name:'访客'});
    s.send({type:'game-arcade-input',gameId:m.id,seq:0,until:1000,events:[]});
    s.reject({type:'game-arcade-input',gameId:m.id,seq:0,until:1000,events:[]});
  }
});
test('reaction timing uses receipt time, and idle deadlines settle without XP',()=>{
  const s=session('reaction'),m=s.hub.match,at=reactionCue(m.arcade.seed,0)+600;s.at(at);
  s.send({type:'game-arcade-input',gameId:m.id,seq:0,until:at,events:[[reactionCue(m.arcade.seed,0)+90,0]]});
  assert.equal(s.hub.match.arcade.runs[0].reactions[0].ms,600);
  for(const game of ARCADE_GAMES){const idle=session(game,'duo');idle.at(ARCADE_DURATION[game]+11000);idle.send({type:'game-arcade-sync',gameId:idle.hub.match.id});assert.equal(idle.hub.match.status,'finished');assert.equal(idle.hub.match.reward,0);assert.equal(idle.hub.match.arcade.rewardEligible,false);}
});
test('computer algorithms are deterministic across checkpoint sizes and difficulty settings',()=>{
  for(const game of ARCADE_GAMES)for(const level of ['easy','normal','hard']){const a=createArcadeRun(game,42,{computer:true,level}),b=structuredClone(a),duration=ARCADE_DURATION[game];advanceArcadeComputer(game,a,duration+10000,42,level);for(let t=1000;t<=duration;t+=1000)advanceArcadeComputer(game,b,t,42,level);assert.deepEqual(a,b,`${game}/${level}`);}
});
test('completion enters the existing claim ledger only once and respects the remaining daily quota',()=>{
  const s=session('whack');play(s,'whack','solo');let before=initialState(START);before.games=structuredClone(s.hub);before.games.earned=48;
  const m=before.games.match;m.status='active';m.arcade.stage='running';m.arcade.runs[0].finished=false;m.arcade.runs[0].elapsed=29999;
  const after=reduceAction(before,{type:'game-arcade-sync',gameId:m.id},alice,START+50000,'last-checkpoint-op');
  assert.equal(after.games.match.reward,2);assert.equal(after.games.earned,50);assert.equal(after.pendingGrowth.length,1);
  const claimed=reduceAction(after,{type:'claim-growth',rewardId:after.pendingGrowth[0].id},alice,START+50001,'claim-arcade-reward');assert.equal(claimed.xp,before.xp+2);
  assert.equal(reduceAction(claimed,{type:'claim-growth',rewardId:after.pendingGrowth[0].id},bob,START+50002,'repeat-arcade-reward'),null);
});
test('GitHub reload retains checkpoints and deduplicates a completed game operation',async()=>{
  const files=new Map();let sha=0,time=START;
  const fetchImpl=async(url,options)=>{const key=new URL(url).pathname,saved=files.get(key);if(options.method==='GET')return saved?Response.json({sha:saved.sha,encoding:'base64',content:Buffer.from(JSON.stringify(saved.room)).toString('base64')}):new Response('{}',{status:404});const body=JSON.parse(options.body);if(saved&&body.sha!==saved.sha)return new Response('{}',{status:409});files.set(key,{sha:`sha-${++sha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString())});return Response.json({});};
  const make=()=>createGitHubStore({token:'test',repository:'test/games',fetchImpl,now:()=>time}),store=make(),room=await store.createRoom();let operation=0;
  const send=action=>make().applyAction(room.roomId,{clientId:alice.id,name:alice.name,operationId:`cloud-arcade-op-${++operation}`,action});
  let result=await send({type:'game-create',game:'reaction',mode:'computer',previousId:null});const id=result.state.games.match.id;await send({type:'game-arcade-ready',gameId:id});
  for(let round=0;round<5;round++){const m=(await make().getRoom(room.roomId)).state.games.match,at=reactionCue(m.arcade.seed,round)+200;time=m.arcade.startAt+at;result=await send({type:'game-arcade-input',gameId:id,seq:round,until:at,events:[[at,round]]});assert.equal(result.state.games.match.arcade.runs[0].seq,round+1);}
  const m=result.state.games.match;time=m.arcade.startAt+25000;const action={type:'game-arcade-input',gameId:id,seq:5,until:25000,events:[]};result=await send(action);
  assert.equal(result.state.pendingGrowth.filter(r=>r.kind==='game').length,1);assert.equal(result.state.games.match.status,'finished');
  const duplicate=await make().applyAction(room.roomId,{clientId:alice.id,name:alice.name,operationId:`cloud-arcade-op-${operation}`,action});assert.equal(duplicate.duplicate,true);assert.equal((await make().getRoom(room.roomId)).state.games.earned,5);
});
