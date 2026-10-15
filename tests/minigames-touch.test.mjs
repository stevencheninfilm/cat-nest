import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUCH_GAMES, TOUCH_DURATION, teaserTarget, treatDrop, hiddenToyCell, touchComputerEvents, encodeTouchPoint } from '../src/minigames-touch-rules.js';
import { createArcadeRun, applyArcadeEvent, advanceArcadeRun, arcadeEligible, validArcadeRun } from '../src/minigames-arcade-rules.js';
import { createGitHubStore } from '../server/github-store.mjs';
import { createDemoEngine, DEMO_ACTORS } from '../demo/engine.js';
import { createMemoryStorage } from '../demo/storage.js';
import { initialState, levelStartXp } from '../src/state.js';
const SEED=42,START=Date.UTC(2026,9,15),actor={id:'partner-male',name:'男方'};

test('teaser needs a real movement within each target window; taps, holds and repeated hits cannot score',()=>{
  const run=createArcadeRun('teaser',SEED),p=teaserTarget(SEED,0),target=encodeTouchPoint(p.x,p.y);
  assert.equal(applyArcadeEvent('teaser',run,[100,target],SEED),true);
  assert.equal(run.hits,0,'a tap at the target has no movement');
  assert.equal(applyArcadeEvent('teaser',run,[120,target],SEED),false,'samples are throttled');
  applyArcadeEvent('teaser',run,[200,encodeTouchPoint(p.x>16?p.x-12:p.x+12,p.y)],SEED);
  applyArcadeEvent('teaser',run,[400,target],SEED);
  assert.equal(run.hits,1);assert.equal(run.score,10);
  applyArcadeEvent('teaser',run,[600,target],SEED);assert.equal(run.hits,1);
  assert.equal(applyArcadeEvent('teaser',run,[800,1024],SEED),false);
  const next=teaserTarget(SEED,1);assert.notDeepEqual(p,next);
  applyArcadeEvent('teaser',run,[1600,encodeTouchPoint(next.x,next.y)],SEED);
  assert.equal(run.hits,1,'the next target needs a new movement');
  assert.equal(validArcadeRun('teaser',run),true);
});
test('falling snacks resolve at their catch time from the last basket position, with no reward for idle play',()=>{
  const idle=createArcadeRun('treats',SEED);advanceArcadeRun('treats',idle,30000);
  assert.equal(arcadeEligible('treats',idle),false);assert.equal(idle.finished,true);
  const run=createArcadeRun('treats',SEED);
  for(const event of touchComputerEvents('treats',SEED,'hard'))applyArcadeEvent('treats',run,event,SEED);
  advanceArcadeRun('treats',run,30000);
  assert.equal(run.caught,Array.from({length:29},(_,n)=>treatDrop(SEED,n)).filter(d=>!d.leaf).length);
  assert.equal(run.bumps,0);assert.equal(run.missed,0);assert.equal(run.resolved,28);
  assert.equal(arcadeEligible('treats',run),true);assert.equal(validArcadeRun('treats',run),true);
  const snapshot=structuredClone(run);advanceArcadeRun('treats',run,40000);assert.deepEqual(run,snapshot);
});
test('hidden toys show a memory cue, permit only two distinct guesses, and change hiding place next round',()=>{
  const run=createArcadeRun('hide-toy',SEED),target=hiddenToyCell(SEED,0);
  assert.equal(applyArcadeEvent('hide-toy',run,[900,target],SEED),false);
  assert.equal(applyArcadeEvent('hide-toy',run,[1999,target],SEED),false,'the two-second memory phase cannot accept guesses');
  const wrong=(target+1)%6;
  assert.equal(applyArcadeEvent('hide-toy',run,[2100,wrong],SEED),true);
  assert.equal(applyArcadeEvent('hide-toy',run,[2200,wrong],SEED),false);
  assert.equal(applyArcadeEvent('hide-toy',run,[2300,target],SEED),true);
  assert.equal(run.found,1);assert.equal(run.wrong,1);assert.equal(run.score,8);
  assert.equal(applyArcadeEvent('hide-toy',run,[2400,(target+2)%6],SEED),false);
  assert.notEqual(hiddenToyCell(SEED,1),target);
  assert.equal(applyArcadeEvent('hide-toy',run,[4900,target],SEED),false);
  advanceArcadeRun('hide-toy',run,40000);assert.equal(validArcadeRun('hide-toy',run),true);
});
test('each touch game survives authoritative reloads and gives one small, claimable reward with no early finish',async()=>{
  for(const game of TOUCH_GAMES){
    const files=new Map();let sha=0,time=START,operation=0;
    const fetchImpl=async(url,options)=>{
      const key=new URL(url).pathname,saved=files.get(key);
      if(options.method==='GET')return saved?Response.json({sha:saved.sha,encoding:'base64',content:Buffer.from(JSON.stringify(saved.room)).toString('base64')}):new Response('{}',{status:404});
      const body=JSON.parse(options.body);if(saved&&saved.sha!==body.sha)return new Response('{}',{status:409});
      files.set(key,{sha:`sha-${++sha}`,room:JSON.parse(Buffer.from(body.content,'base64'))});return Response.json({});
    };
    const make=()=>createGitHubStore({token:'test',repository:'test/touch-games',fetchImpl,now:()=>time});
    const startingXp=levelStartXp(5),room=await make().createRoom({initialState:{...initialState(START),xp:startingXp}});
    const send=action=>make().applyAction(room.roomId,{...actor,clientId:actor.id,operationId:`touch-save-operation-${++operation}`,action});
    let result=await send({type:'game-create',game,mode:'solo',previousId:null});
    const id=result.state.games.match.id;result=await send({type:'game-arcade-ready',gameId:id});
    const a=result.state.games.match.arcade,duration=TOUCH_DURATION[game],events=touchComputerEvents(game,a.seed,'hard');
    for(let until=2000;until<=duration||until===Math.ceil(duration/2000)*2000;until+=2000){
      const end=Math.min(until,duration),run=result.state.games.match.arcade.runs[0];time=a.startAt+end;
      result=await send({type:'game-arcade-input',gameId:id,seq:run.seq,until:end,events:events.filter(e=>e[0]>run.elapsed&&e[0]<=end)});
      if(end<duration){assert.equal(result.state.games.match.status,'active');assert.equal(result.state.pendingGrowth.length,0);}
      else break;
    }
    assert.equal(result.state.games.match.status,'finished',game);
    assert.equal(result.state.games.match.reward,10,game);
    assert.equal(result.state.pendingGrowth.length,1);
    const reward=result.state.pendingGrowth[0];assert.equal(reward.game,game);assert.equal(reward.amount,10);
    assert.equal(result.state.xp,startingXp,'reward is still a bubble');
    time++;result=await send({type:'claim-growth',rewardId:reward.id});assert.equal(result.state.xp,startingXp+10);
    assert.equal((await make().getRoom(room.roomId)).state.pendingGrowth.length,0);
    await assert.rejects(()=>send({type:'claim-growth',rewardId:reward.id}));
  }
});
test('the demo partner joins, prepares and actively plays the new touch games through the same action reducer',()=>{
  for(const game of TOUCH_GAMES){
    let time=START;const engine=createDemoEngine({storage:createMemoryStorage(),now:()=>time});
    engine.scenario('unlock');
    const send=action=>engine.action({clientId:DEMO_ACTORS.male.id,operationId:crypto.randomUUID(),action});
    assert.equal(send({type:'game-create',game,mode:'duo',previousId:null}).status,200);
    assert.equal(engine.partnerGame(DEMO_ACTORS.male.id),true);
    let m=engine.snapshot().state.games.match;
    assert.equal(send({type:'game-arcade-ready',gameId:m.id}).status,200);
    assert.equal(engine.partnerGame(DEMO_ACTORS.male.id),true);
    m=engine.snapshot().state.games.match;const a=m.arcade,events=touchComputerEvents(game,a.seed,'hard');
    for(let elapsed=2000;elapsed<=TOUCH_DURATION[game]+1000;elapsed+=2000){
      const end=Math.min(elapsed,TOUCH_DURATION[game]);time=a.startAt+end;
      m=engine.snapshot().state.games.match;const r=m.arcade.runs[0];
      assert.equal(send({type:'game-arcade-input',gameId:m.id,seq:r.seq,until:end,events:events.filter(e=>e[0]>r.elapsed&&e[0]<=end)}).status,200);
      assert.equal(engine.partnerGame(DEMO_ACTORS.male.id),true);
      if(end===TOUCH_DURATION[game])break;
    }
    m=engine.snapshot().state.games.match;assert.equal(m.status,'finished');assert.ok(m.arcade.runs[1].inputs>0);
  }
});
