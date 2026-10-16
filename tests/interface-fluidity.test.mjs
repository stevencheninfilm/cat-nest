import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeView} from '../src/minigames-arcade-view.js';
import {ARCADE_GAMES,createArcadeRun,advanceArcadeRun,applyArcadeEvent,reactionCue} from '../src/minigames-arcade-rules.js';
import {createUiFrameBatch} from '../src/ui-frame-batch.js';
import {gamePanelSignature,keepArcadeBoard,computerTurnDelay,pendingGameFeedback,paintGameSelection} from '../src/minigames-panel-state.js';
import {careActionInfo,feedingInfo,initialState} from '../src/state.js';
import {reduceGameHub,publicGameHub} from '../src/minigames.js';
import {minigamesPanel} from '../src/minigames-ui.js';

const at=Date.UTC(2026,9,15),actor={id:'partner-male',name:'男方'};
function fixture(game){
  const stats={text:0,html:0,queries:0,canvas:0,style:0},nodes=new Map(),lists=new Map();
  function node(){let content='',html='';const attrs=new Map();return {
    get textContent(){return content;},set textContent(value){stats.text++;content=String(value);},
    get innerHTML(){return html;},set innerHTML(value){stats.html++;html=value;},
    dataset:{},disabled:false,hidden:false,
    style:{setProperty(){stats.style++;}},
    classList:{toggle(){},remove(){}},setAttribute(k,v){attrs.set(k,v);},getAttribute:k=>attrs.get(k),
    getContext:()=>({clearRect(){stats.canvas++;},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},roundRect(){},fill(){},fillText(){}}),
  };}
  const stage=node();stage.dataset.arcadeId='fluidity-game';
  stage.querySelector=selector=>{stats.queries++;if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  stage.querySelectorAll=selector=>{stats.queries++;if(!lists.has(selector))lists.set(selector,selector==='.merge-tile'?Array.from({length:16},node):[]);return lists.get(selector);};
  const root={querySelector:selector=>selector==='[data-arcade-id]'?stage:null,querySelectorAll:()=>[]};
  const match={id:'fluidity-game',game,status:'active',players:[actor],scores:[0,0],arcade:{stage:'running',seed:42,startAt:at}};
  const run=createArcadeRun(game,42),view=createArcadeView(root,()=>actor.id);
  const draw=(now=at+100,extra={})=>view.draw({match,run,now,connected:true,saving:false,inFlight:null,queued:0,...extra});
  return {stats,nodes,lists,stage,match,run,view,draw};
}

test('1000 unchanged 2048 frames perform no additional tile, text or playfield query work',()=>{
  const f=fixture('merge2048');f.draw();const before={...f.stats};
  for(let n=0;n<1000;n++)f.draw(at+100+n*.5);
  assert.deepEqual(f.stats,before);
  const move=[0,1,2,3].find(d=>applyArcadeEvent('merge2048',f.run,[700,d],42));
  assert.notEqual(move,undefined);f.draw(at+700);
  assert.ok(f.stats.style>before.style);assert.equal(f.stats.queries,before.queries,'all playfield nodes remain cached');
});

test('snake canvas paints only changed body/food, even across saving and second boundaries',()=>{
  const f=fixture('snake');f.draw();assert.equal(f.stats.canvas,1);
  for(let n=0;n<1000;n++)f.draw(at+100+n*.05);
  f.draw(at+1000,{saving:true});assert.equal(f.stats.canvas,1);
  advanceArcadeRun('snake',f.run,180);f.draw(at+180);assert.equal(f.stats.canvas,2);
});

test('reaction green cue still paints at the exact edge without rebuilding unchanged rounds',()=>{
  const f=fixture('reaction'),cue=reactionCue(42,0);
  f.draw(at+cue-1);assert.equal(f.nodes.get('[data-reaction-label]').textContent,'等绿灯…');
  const count=f.stats.html;
  f.draw(at+cue);assert.equal(f.nodes.get('[data-reaction-label]').textContent,'现在点击！');
  for(let n=0;n<1000;n++)f.draw(at+cue+n*.1);
  assert.equal(f.stats.html,count);
  assert.ok(applyArcadeEvent('reaction',f.run,[cue+200,0],42));f.draw(at+cue+200);
  assert.equal(f.nodes.get('[data-reaction-label]').textContent,'200 ms');assert.equal(f.stats.html,count+1);
});

test('all seven arcade games keep their mounted playfield through checkpoints but leave at completion',()=>{
  for(const game of ARCADE_GAMES){const f=fixture(game),options={match:f.match,previousId:f.match.id,lobby:false,board:f.stage};
    assert.equal(keepArcadeBoard(options),true,game);
    assert.equal(keepArcadeBoard({...options,lobby:true}),false);
    assert.equal(keepArcadeBoard({...options,previousId:'another-game'}),false);
    assert.equal(keepArcadeBoard({...options,match:{...f.match,status:'finished'}}),false);
    assert.equal(keepArcadeBoard({...options,match:{...f.match,arcade:{...f.match.arcade,stage:'ready'}}}),false);
  }
});

test('render key ignores idle clock ticks but changes at reveal unlock, midnight and receipt',()=>{
  const state=initialState(at);state.games=reduceGameHub(state.games,{type:'game-create',game:'rps',mode:'solo',previousId:null},actor,at,'fluidity-rps',()=>.2);
  state.games.match.phase='reveal';state.games.match.revealUntil=at+900;
  const options={state,now:at};const key=gamePanelSignature(options);
  assert.equal(gamePanelSignature({...options,now:at+899}),key);
  assert.notEqual(gamePanelSignature({...options,now:at+900}),key);
  assert.notEqual(gamePanelSignature({...options,now:at+86400_000}),key);
  assert.notEqual(gamePanelSignature({...options,saving:true}),key);
  assert.equal(gamePanelSignature({...options,selectedCell:8}),key,'local selection has its own two-cell paint');
});

test('local board selection moves the draft without replacing any board, input or focus target',()=>{
  for(const game of ['gomoku','tictactoe','connect4']){
    const state=initialState(at);const match=reduceGameHub(state.games,{type:'game-create',game,mode:'solo',previousId:null},actor,at,`selection-${game}`,()=>.2).match;
    const snapshot=structuredClone(match),cells=[],columns=[];let writes=0;
    function node(){let html='';const classes=new Set();return {classList:{add:(...keys)=>keys.forEach(k=>classes.add(k)),remove:(...keys)=>keys.forEach(k=>classes.delete(k))},classes,
      get innerHTML(){return html;},set innerHTML(value){html=value;writes++;},querySelector(){return html?{remove(){html='';}}:null;}};}
    for(let n=0;n<match.board.length;n++)cells.push(node());for(let n=0;n<7;n++)columns.push(node());
    const confirm={};const root={set innerHTML(_){assert.fail('whole board replaced');},querySelectorAll:()=>[...cells,...columns].filter(n=>n.classes.has('is-selected')||n.classes.has('is-draft')),
      querySelector(selector){if(selector==='[data-game-confirm]')return confirm;const index=Number(selector.match(/\d+/)?.[0]);return selector.startsWith('.connect-hole')?cells[index-1]:selector.includes('game-column')?columns[index]:cells[index];}};
    const moves=game==='connect4'?[0,1]:match.board.flatMap((v,n)=>v?[]:[n]).slice(0,2);
    paintGameSelection(root,match,actor.id,moves[0],false);assert.equal(confirm.disabled,false);
    paintGameSelection(root,match,actor.id,moves[1],false);assert.equal(writes,2);
    assert.equal(cells.filter(n=>n.innerHTML).length,1);assert.equal(cells.filter(n=>n.classes.has(game==='connect4'?'is-draft':'is-selected')).length,1);
    paintGameSelection(root,match,actor.id,null,false);assert.equal(confirm.disabled,true);assert.equal(cells.filter(n=>n.innerHTML).length,0);
    assert.deepEqual(match,snapshot,'a draft cannot change the accepted board or game step');
  }
});

test('computer thinking and reveal use remaining server deadline instead of restarting after network wait',()=>{
  assert.equal(computerTurnDelay({phase:'play',botReadyAt:at+700},at+500),200);
  assert.equal(computerTurnDelay({phase:'play',botReadyAt:at+700},at+1400),0);
  assert.equal(computerTurnDelay({phase:'reveal',revealUntil:at+1200},at+1000),200);
  assert.equal(computerTurnDelay({phase:'reveal',revealUntil:at+1200},at+3000),0);
  assert.equal(computerTurnDelay({phase:'play',botReadyAt:at+700},at+1500,at+1300),800,'a rejected same-step attempt backs off instead of looping');
});

test('frame batching coalesces state/status/pending paints and preserves every confirmed effect in order',()=>{
  let id=0;const frames=new Map(),paint=[],effects=[];
  const batch=createUiFrameBatch(flags=>paint.push([...flags].sort()),{request:fn=>{frames.set(++id,fn);return id;},cancel:n=>frames.delete(n)});
  for(let n=0;n<100;n++){for(const kind of ['state','connection','pending'])batch.request(kind);batch.afterPaint(()=>effects.push(n));}
  assert.equal(frames.size,1);assert.equal(paint.length,0);batch.flush();
  assert.deepEqual(paint,[['connection','pending','state']]);assert.deepEqual(effects,Array.from({length:100},(_,n)=>n));assert.equal(frames.size,0);
  batch.flush();assert.equal(effects.length,100);batch.request('state');batch.cancel();assert.equal(frames.size,0);
});

test('care countdowns never read large journals, games, collection or growth queues',()=>{
  const state=initialState(at);
  for(const key of ['diary','games','collection','pendingGrowth'])Object.defineProperty(state,key,{get(){throw Error(`expensive ${key} read`);}});
  for(let n=0;n<2000;n++){
    for(const type of ['feed','pet','play','sleep','game-move'])assert.equal(careActionInfo(state,{type,food:'meal'},actor.id,at+n).allowed,true);
    assert.equal(feedingInfo(state,actor.id,at+n).hasFed,false);
  }
});

test('pending move shows a choice immediately and clears on receipt or rejection without claiming anything',()=>{
  for(const game of ['memory','rps','gomoku','tictactoe','connect4','guess']){
    const state=initialState(at);
    state.games=publicGameHub(reduceGameHub(state.games,{type:'game-create',game,mode:'solo',previousId:null},actor,at,`pending-${game}`,()=>.2));
    const match=state.games.match,move=game==='rps'?'rock':game==='guess'?50:game==='memory'?0:game==='connect4'?0:match.board.findIndex(v=>!v);
    const action={type:'game-move',gameId:match.id,step:0,move},before=structuredClone(state);
    const pending=pendingGameFeedback(match,action,actor.id);assert.ok(pending,game);
    const html=minigamesPanel({state,clientId:actor.id,lobby:false,saving:true,pendingAction:action,now:at});
    assert.match(html,/game-move-feedback/);assert.doesNotMatch(html,/这局为猫猫带来/);
    if(game==='memory'){assert.match(html,/is-opening/);assert.match(html,/翻开中/);assert.ok(match.cards.every(v=>v===null));}
    assert.deepEqual(state,before,'display feedback never changes saved game, XP or rewards');
    assert.equal(pendingGameFeedback({...match,step:1,rounds:game==='rps'?[{}]:match.rounds},action,actor.id),null);
    assert.doesNotMatch(minigamesPanel({state,clientId:actor.id,lobby:false,pendingAction:null,now:at}),/game-move-feedback/);
    assert.equal(pendingGameFeedback(match,action,'other-player'),null);
  }
});
