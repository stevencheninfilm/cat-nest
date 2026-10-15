import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { initialState, levelStartXp, reduceAction, validPendingGrowth } from '../src/state.js';
import { GAMES, gameDay, publicGameHub, validGameHub, sanitizeGameAction } from '../src/minigames.js';
import { createGitHubStore } from '../server/github-store.mjs';
import { createPetServer } from '../server/pet-server.mjs';
import { createLocalPreviewStore, PREVIEW_HOME } from '../scripts/local-pet-preview.mjs';
import { minigamesPanel } from '../src/minigames-ui.js';
import { chooseComputerGomoku, chooseComputerCard } from '../src/minigames-computer.js';
import { chooseExtraComputer, createExtraBoard, connect4Cell, extraWinningMoves, lineWinner } from '../src/minigames-extra.js';
import { TOUCH_GAMES, CAT_PLAY_UNLOCK_LEVEL } from '../src/minigames-touch-rules.js';

const START=Date.UTC(2026,9,14,12), alice={id:'client-one',name:'男方'}, bob={id:'client-two',name:'女方'};
let gameSerial=0;
function session(game,mode='duo',supplied) {
  let state=supplied || {...initialState(START),...(TOUCH_GAMES.includes(game)?{xp:levelStartXp(CAT_PLAY_UNLOCK_LEVEL)}:{})}, clock=START, serial=0;
  const apply=(action,actor=alice)=>{
    const next=reduceAction(state,action,actor,clock++,`game-operation-${++gameSerial}`);
    assert.ok(next,JSON.stringify(action)); state=next;
    assert.equal(validGameHub(state.games,{privateState:true}),true);
    assert.equal(validPendingGrowth(state.pendingGrowth),true);
    return next;
  };
  apply({type:'game-create',game,mode,previousId:state.games?.match?.id ?? null});
  if(mode==='duo')apply({type:'game-join',gameId:state.games.match.id},bob);
  return {get state(){return state;},apply,move(move,actor=alice){const m=state.games.match;return apply({type:'game-move',gameId:m.id,step:m.game==='rps'?m.rounds.length:m.step,move},actor);},next(){clock+=1500;const m=state.games.match;return apply({type:'game-next',gameId:m.id,step:m.game==='rps'?m.rounds.length:m.step});},bot(){clock+=1500;const m=state.games.match;return apply({type:'game-bot',gameId:m.id,step:m.step});}};
}
function winRps(s) { for(let round=0;round<2;round++){s.move('rock');s.move('scissors',bob);if(!round)s.next();}return s.state; }
function finishMemory(s) {
  const deck=s.state.games.match.secret.deck;
  for(let n=0;n<8;n++){const pair=deck.flatMap((v,i)=>v===n?[i]:[]);s.move(pair[0]);s.move(pair[1]);}
  return s.state;
}
test('guessing locks choices until both players submit, rejects overwrites, and rewards the shared home once',()=>{
  const s=session('rps');s.move('rock');
  const view=publicGameHub(s.state.games);
  assert.equal(view.match.secret,undefined);assert.deepEqual(view.match.locked,[true,false]);assert.deepEqual(view.match.rounds,[]);
  assert.equal(reduceAction(s.state,{type:'game-move',gameId:view.match.id,step:0,move:'paper'},alice,START+9,'overwrite-hand'),null);
  s.move('scissors',bob);assert.deepEqual(s.state.games.match.scores,[1,0]);s.next();s.move('paper');s.move('rock',bob);
  const done=s.state, reward=done.pendingGrowth[0];
  assert.equal(done.games.match.status,'finished');assert.equal(reward.amount,10);assert.equal(done.xp,86);assert.equal(done.games.earned,10);
  assert.equal(reduceAction(done,{type:'game-move',gameId:done.games.match.id,step:2,move:'rock'},alice,START+9999,'repeat-finish'),null);
  const claimed=reduceAction(done,{type:'claim-growth',rewardId:reward.id},bob,START+9999,'claim-game-xp');
  assert.equal(claimed.xp,96);assert.equal(claimed.pendingGrowth.length,0);
  assert.equal(reduceAction(claimed,{type:'claim-growth',rewardId:reward.id},alice,START+10000,'second-game-claim'),null);
  assert.deepEqual(done.careLimits,initialState(START).careLimits);
});
test('memory sends only revealed cards, waits before covering a miss, rotates turns and completes all eight pairs',()=>{
  const s=session('memory');let m=s.state.games.match;
  assert.equal(publicGameHub(s.state.games).match.cards.every(v=>v===null),true);
  const first=0,other=m.secret.deck.findIndex(v=>v!==m.secret.deck[first]);
  s.move(first);assert.equal(s.state.games.match.cards.filter(v=>v!==null).length,1);s.move(other);
  m=s.state.games.match;assert.equal(m.phase,'reveal');
  assert.equal(reduceAction(s.state,{type:'game-next',gameId:m.id,step:m.step},alice,m.updatedAt+1,'cover-too-early'),null);
  s.next();assert.equal(s.state.games.match.turn,1);assert.equal(s.state.games.match.cards.every(v=>v===null),true);
  assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step:s.state.games.match.step,move:0},alice,START+9999,'wrong-turn-move'),null);
  const solo=session('memory','solo');const finished=finishMemory(solo);
  assert.equal(finished.games.match.status,'finished');assert.equal(finished.pendingGrowth[0].amount,10);assert.equal(finished.games.match.scores[0],8);
});
test('gomoku checks row, column and both diagonals, rejects occupied/stale/outsider moves, and awards 15',()=>{
  for(const cells of [[0,1,2,3,4],[0,15,30,45,60],[0,16,32,48,64],[4,18,32,46,60]]){
    const s=session('gomoku');
    s.move(cells[0]);let m=s.state.games.match;
    for(const [move,actor,step] of [[cells[0],bob,m.step],[100,alice,m.step],[100,{id:'third-user',name:'访客'},m.step],[100,bob,m.step-1]]) assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step,move},actor,START+10,'invalid-board-move'),null);
    s.move(200,bob);
    for(let n=1;n<5;n++){s.move(cells[n]);if(n<4)s.move(200+n*2,bob);}
    assert.equal(s.state.games.match.winner,0);assert.equal(s.state.pendingGrowth[0].amount,15);
  }
});
test('shared daily quota permits partial final rewards, does not reset on clock rollback, and resets at Beijing midnight',()=>{
  let state=initialState(START);
  for(let n=0;n<6;n++){state=winRps(session('rps','duo',state));assert.ok(state.games.earned<=50);}
  assert.equal(state.games.earned,50);assert.equal(state.pendingGrowth.reduce((sum,r)=>sum+r.amount,0),50);
  assert.equal(state.pendingGrowth.length,5);
  assert.equal(reduceAction(state,{type:'game-create',game:'rps',mode:'duo',previousId:null},alice,START+1,'old-create-replay'),null);
  const midnight=(gameDay(START)+1)*86400_000-8*3600_000;
  const cancelled=session('memory','solo',state);const m=cancelled.state.games.match;
  const done=cancelled.apply({type:'game-cancel',gameId:m.id});assert.equal(done.games.earned,50);assert.equal(done.pendingGrowth.length,5);
  const later=reduceAction(done,{type:'game-create',game:'memory',mode:'solo',previousId:m.id},alice,midnight,'new-day-game-start');
  assert.equal(later.games.earned,0);assert.equal(later.pendingGrowth.length,5);
  const partial=initialState(START);partial.games.earned=45;
  assert.equal(finishMemory(session('memory','solo',partial)).games.match.reward,5);
  const backwards=initialState(START);backwards.games.day++;backwards.games.earned=50;
  assert.equal(finishMemory(session('memory','solo',backwards)).games.match.reward,0);
});
test('clients cannot submit results or arbitrary experience, and legacy saves acquire an empty game ledger',()=>{
  for(const action of [{type:'game-finish',xp:100},{type:'game-create',game:'memory',mode:'solo',previousId:null,xp:10},{type:'game-move',gameId:'valid-game-id',step:0,move:999}])assert.equal(sanitizeGameAction(action),null);
  const state=initialState(START);delete state.games;
  const s=session('memory','solo',state);assert.equal(s.state.games.earned,0);
  const html=minigamesPanel({state:s.state,clientId:alice.id,lobby:false});assert.match(html,/猫猫翻牌/);assert.match(html,/十六张卡片/);assert.doesNotMatch(html,/secret|deck/);
});

test('all unlocked games offer solo and computer play without a second human or forged bot identity',()=>{
  for(const game of Object.keys(GAMES))for(const mode of ['solo','computer']) {
    const s=session(game,mode),m=s.state.games.match;
    assert.equal(m.status,'active');assert.equal(m.players.length,mode==='computer'?2:1);
    assert.equal(reduceAction(s.state,{type:'game-join',gameId:m.id},bob,START+1000,'uninvited-bot-join'),null);
    assert.equal(reduceAction(s.state,{type:'game-cancel',gameId:m.id},bob,START+1000,'uninvited-bot-cancel'),null);
    assert.equal(reduceAction(s.state,{type:'game-cancel',gameId:m.id},{id:'computer-cat',name:'电脑猫猫'},START+1000,'forged-computer-role'),null);
  }
  const html=minigamesPanel({state:initialState(START),clientId:alice.id});
  assert.equal((html.match(/data-game-select=/g)||[]).length,Object.keys(GAMES).length);
  for(const game of Object.keys(GAMES)) {
    assert.match(html,new RegExp(`data-game-select="${game}"`));
    const picker=minigamesPanel({state:initialState(START),clientId:alice.id,selectedGame:game});
    for(const mode of ['solo','computer','duo'])assert.equal((picker.match(new RegExp(`data-game-mode="${mode}"`,'g'))||[]).length,1);
    assert.match(picker,/单人挑战/);assert.match(picker,/对战电脑/);assert.match(picker,/双人联机/);
  }
});
test('solo rock paper scissors completes three practice questions and gives only five experience',()=>{
  const s=session('rps','solo');
  for(let n=0;n<3;n++) {
    const m=s.state.games.match,hand=m.challengeHand;
    assert.equal(publicGameHub(s.state.games).match.challengeHand,hand);
    s.move({rock:'paper',paper:'scissors',scissors:'rock'}[hand]);
    if(n<2){assert.equal(s.state.games.match.status,'active');s.next();}
  }
  assert.equal(s.state.games.match.status,'finished');assert.equal(s.state.games.match.scores[0],3);
  assert.equal(s.state.pendingGrowth[0].amount,5);assert.equal(s.state.games.earned,5);
  assert.match(minigamesPanel({state:s.state,clientId:alice.id,lobby:false}),/答对 3 \/ 3 题/);
});
test('computer guessing precommits a hidden hand and still awards a completed loss without a dual-player bonus',()=>{
  const s=session('rps','computer');
  for(let n=0;n<2;n++) {
    const m=s.state.games.match,committed=m.secret.hands[1];
    assert.equal(publicGameHub(s.state.games).match.secret,undefined);
    assert.equal(publicGameHub(s.state.games).match.challengeHand,undefined);
    assert.deepEqual(m.locked,[false,true]);
    s.move({rock:'scissors',paper:'rock',scissors:'paper'}[committed]);
    assert.equal(s.state.games.match.rounds[n].hands[1],committed);
    if(n===0)s.next();
  }
  assert.equal(s.state.games.match.winner,1);assert.equal(s.state.pendingGrowth[0].amount,5);
  assert.match(minigamesPanel({state:s.state,clientId:alice.id,lobby:false}),/电脑猫猫赢啦/);
});
test('solo gomoku supplies three one-move puzzles, shows feedback and rejects moves while awaiting the next puzzle',()=>{
  const s=session('gomoku','solo');
  for(const [index,cell] of [114,113,128].entries()) {
    assert.equal(s.state.games.match.puzzleIndex,index);s.move(cell);
    const m=s.state.games.match;
    assert.equal(m.challengeCorrect,true);assert.equal(m.scores[0],index+1);
    if(index<2) {
      assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step:m.step,move:0},alice,START+9999,'extra-puzzle-guess'),null);
      s.next();
    }
  }
  assert.equal(s.state.games.match.status,'finished');assert.equal(s.state.pendingGrowth[0].amount,10);
  const wrong=session('gomoku','solo');wrong.move(0);
  assert.equal(wrong.state.games.match.challengeCorrect,false);assert.deepEqual(wrong.state.games.match.solutions,[114]);
  assert.match(minigamesPanel({state:wrong.state,clientId:alice.id,lobby:false}),/绿色圆圈/);
});
test('computer gomoku wins before defending, blocks an immediate five and takes only one legal move per accepted turn',()=>{
  const board=Array(225).fill(0);for(const cell of [105,106,107,108])board[cell]=1;
  assert.equal(chooseComputerGomoku(board,()=>0),109);
  for(const cell of [120,121,122,123])board[cell]=2;
  assert.equal(chooseComputerGomoku(board,()=>0),124);
  const s=session('gomoku','computer');s.move(112);const before=s.state.games.match;
  assert.equal(reduceAction(s.state,{type:'game-bot',gameId:before.id,step:before.step},alice,before.updatedAt+699,'computer-too-fast'),null);
  s.bot();const after=s.state.games.match;
  assert.equal(after.turn,0);assert.equal(after.board.filter(v=>v===2).length,1);
  assert.equal(reduceAction(s.state,{type:'game-bot',gameId:after.id,step:before.step},alice,START+9999,'stale-computer-step'),null);
  assert.equal(reduceAction(s.state,{type:'game-bot',gameId:after.id,step:after.step},alice,START+9999,'skip-human-turn'),null);
});
test('memory computer sees only its observed memory, completes a full match and generates one ten-point reward',()=>{
  const s=session('memory','computer');s.state.games.match.secret.deck=Array.from({length:16},(_,n)=>n%8);
  const a=structuredClone(s.state.games.match),b=structuredClone(a);b.secret.deck.reverse();
  assert.equal(chooseComputerCard(a,()=>0),chooseComputerCard(b,()=>0));
  a.secret.botMemory[0]=a.secret.botMemory[8]=0;
  assert.equal(chooseComputerCard(a,()=>.8),0);a.flipped=[0];assert.equal(chooseComputerCard(a,()=>.8),8);
  let actions=0,botMoves=0;
  while(s.state.games.match.status==='active'&&actions++<300) {
    const m=s.state.games.match;
    if(m.phase==='reveal'){s.next();continue;}
    if(m.turn===1){s.bot();botMoves++;continue;}
    const available=Array.from({length:16},(_,n)=>n).filter(n=>!m.matched[n]&&!m.flipped.includes(n));
    const move=m.flipped.length?(available.find(n=>m.secret.deck[n]!==m.secret.deck[m.flipped[0]])??available[0]):available[0];
    s.move(move);
  }
  assert.ok(botMoves>0);assert.ok(actions<300);assert.equal(s.state.games.match.status,'finished');
  assert.equal(s.state.games.match.scores.reduce((a,b)=>a+b,0),8);assert.equal(s.state.games.match.winner,1);
  assert.equal(s.state.pendingGrowth.length,1);assert.equal(s.state.pendingGrowth[0].amount,10);
  assert.equal(publicGameHub(s.state.games).match.secret,undefined);
  const m=s.state.games.match;
  assert.equal(reduceAction(s.state,{type:'game-bot',gameId:m.id,step:m.step},alice,START+999999,'replay-final-bot'),null);
});

test('tic tac toe resolves rows and draws, rejects occupied and stale moves, and grants one shared reward',()=>{
  const s=session('tictactoe');s.move(0);s.move(3,bob);
  const m=s.state.games.match;
  for(const [move,actor,step] of [[0,alice,m.step],[9,alice,m.step],[1,bob,m.step],[1,alice,m.step-1]])assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step,move},actor,START+9999,'invalid-tic-move'),null);
  s.move(1);s.move(4,bob);s.move(2);
  assert.equal(s.state.games.match.winner,0);assert.equal(s.state.games.match.status,'finished');
  assert.equal(s.state.pendingGrowth.length,1);assert.equal(s.state.pendingGrowth[0].amount,10);
  const draw=session('tictactoe');
  [0,1,2,4,3,5,7,6,8].forEach((move,n)=>draw.move(move,n%2?bob:alice));
  assert.equal(draw.state.games.match.winner,-1);assert.equal(draw.state.pendingGrowth[0].amount,10);
  for(const cells of [[0,1,2],[0,3,6],[0,4,8],[2,4,6]]) {
    const board=Array(9).fill(0);cells.forEach(cell=>board[cell]=1);
    assert.equal(lineWinner(board,cells.at(-1),1,3,3,3),true);
  }
});
test('new board solo modes complete three legal one-move puzzles and reward only their base experience',()=>{
  for(const [game,moves,xp] of [['tictactoe',[2,6,8],5],['connect4',[3,2,3],10]]) {
    const s=session(game,'solo');
    for(const [index,move] of moves.entries()) {
      assert.ok(extraWinningMoves(game,s.state.games.match.board,1).includes(move));
      s.move(move);assert.equal(s.state.games.match.challengeCorrect,true);
      if(index<2)s.next();
    }
    assert.equal(s.state.games.match.status,'finished');assert.equal(s.state.games.match.scores[0],3);
    assert.equal(s.state.pendingGrowth[0].amount,xp);
    assert.match(minigamesPanel({state:s.state,clientId:alice.id,lobby:false}),/完成 3 \/ 3 关/);
    const wrong=session(game,'solo');wrong.move(game==='tictactoe'?8:4);
    assert.equal(wrong.state.games.match.challengeCorrect,false);
    const m=wrong.state.games.match;
    assert.equal(reduceAction(wrong.state,{type:'game-next',gameId:m.id,step:m.step},alice,m.updatedAt+100,'skip-new-puzzle-feedback'),null);
    assert.match(minigamesPanel({state:wrong.state,clientId:alice.id,lobby:false}),/绿色标记/);
  }
});
test('connect four falls to the lowest empty cell, rejects full columns, and detects every winning direction',()=>{
  const s=session('connect4');
  for(let n=0;n<6;n++)s.move(0,n%2?bob:alice);
  const m=s.state.games.match;
  assert.deepEqual([0,7,14,21,28,35].map(n=>m.board[n]),[2,1,2,1,2,1]);
  assert.equal(connect4Cell(m.board,0),-1);
  assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step:m.step,move:0},alice,START+9999,'full-connect-column'),null);
  assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step:m.step,move:7},alice,START+9999,'invalid-connect-column'),null);
  const vertical=session('connect4');
  for(let n=0;n<4;n++){vertical.move(0);if(n<3)vertical.move(1,bob);}
  assert.equal(vertical.state.games.match.winner,0);assert.equal(vertical.state.pendingGrowth[0].amount,15);
  const horizontal=session('connect4');
  for(let n=0;n<4;n++){horizontal.move(n);if(n<3)horizontal.move(6,bob);}
  assert.equal(horizontal.state.games.match.winner,0);
  for(const cells of [[35,36,37,38],[35,28,21,14],[35,29,23,17],[38,30,22,14]]) {
    const board=Array(42).fill(0);cells.forEach(cell=>board[cell]=2);
    assert.equal(lineWinner(board,cells.at(-1),2,6,7,4),true);
  }
  const invalid=structuredClone(s.state.games);invalid.match.board[35]=0;
  assert.equal(validGameHub(invalid,{privateState:true}),false);
});
test('new board computers take wins before blocks, and tic tac toe cannot lose against any legal human sequence',()=>{
  const tic=createExtraBoard('tictactoe','computer');tic[0]=tic[1]=1;
  assert.equal(chooseExtraComputer({game:'tictactoe',board:tic},()=>0),2);
  tic[3]=tic[4]=2;assert.equal(chooseExtraComputer({game:'tictactoe',board:tic},()=>0),5);
  const connect=createExtraBoard('connect4','solo');
  assert.equal(chooseExtraComputer({game:'connect4',board:connect},()=>0),3);
  for(const cell of [41,34,27])connect[cell]=2;
  assert.equal(chooseExtraComputer({game:'connect4',board:connect},()=>0),6);
  let leaves=0;
  function explore(board) {
    for(let cell=0;cell<9;cell++) {
      if(board[cell])continue;
      const copy=[...board];copy[cell]=1;
      assert.equal(lineWinner(copy,cell,1,3,3,3),false);
      if(copy.every(Boolean)){leaves++;continue;}
      const reply=chooseExtraComputer({game:'tictactoe',board:copy},()=>0);
      assert.equal(copy[reply],0);copy[reply]=2;
      if(lineWinner(copy,reply,2,3,3,3)||copy.every(Boolean)){leaves++;continue;}
      explore(copy);
    }
  }
  explore(Array(9).fill(0));assert.ok(leaves>10);
  for(const game of ['tictactoe','connect4']) {
    const s=session(game,'computer');s.move(game==='tictactoe'?0:3);const before=s.state.games.match;
    assert.equal(reduceAction(s.state,{type:'game-bot',gameId:before.id,step:before.step},alice,before.updatedAt+699,'extra-bot-too-fast'),null);
    s.bot();assert.equal(s.state.games.match.turn,0);assert.equal(s.state.games.match.board.filter(v=>v===2).length,1);
    assert.equal(reduceAction(s.state,{type:'game-bot',gameId:before.id,step:before.step},alice,START+99999,'extra-bot-stale'),null);
  }
});
test('guess number keeps its answer secret, enforces narrowed bounds, and rewards completion once in all modes',()=>{
  for(const mode of ['solo','computer','duo']) {
    const s=session('guess',mode);s.state.games.match.secret.target=73;
    assert.equal(publicGameHub(s.state.games).match.secret,undefined);
    assert.equal(publicGameHub(s.state.games).match.answer,null);
    s.move(50);let m=s.state.games.match;
    assert.deepEqual([m.low,m.high],[51,100]);assert.equal(m.guesses[0].hint,-1);
    const actor=mode==='duo'?bob:alice;
    assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step:m.step,move:49},actor,START+99999,'out-of-range-number'),null);
    if(mode==='computer')s.bot();else s.move(80,actor);
    let actions=0;
    while(s.state.games.match.status==='active'&&actions++<20) {
      m=s.state.games.match;
      if(mode==='computer'&&m.turn===1)s.bot();
      else s.move(Math.floor((m.low+m.high)/2),m.turn===1?bob:alice);
    }
    m=s.state.games.match;assert.equal(m.status,'finished');assert.equal(m.answer,73);
    assert.equal(publicGameHub(s.state.games).match.answer,73);
    assert.equal(s.state.pendingGrowth.length,1);assert.equal(s.state.pendingGrowth[0].amount,mode==='duo'?10:5);
    assert.equal(reduceAction(s.state,{type:'game-move',gameId:m.id,step:m.step,move:73},alice,START+999999,'repeat-number-finish'),null);
    assert.doesNotMatch(minigamesPanel({state:publicGameHub(s.state.games).match?{...s.state,games:publicGameHub(s.state.games)}:s.state,clientId:alice.id,lobby:false}),/secret|target/);
  }
  const wrong=session('guess','solo');wrong.state.games.match.secret.target=50;
  for(let n=1;n<=7;n++)wrong.move(n);
  assert.equal(wrong.state.games.match.status,'finished');assert.equal(wrong.state.games.match.winner,-1);
  assert.equal(wrong.state.pendingGrowth[0].amount,5);assert.match(minigamesPanel({state:wrong.state,clientId:alice.id,lobby:false}),/答案是 50/);
  const a=session('guess','computer').state.games.match,b=structuredClone(a);b.secret.target=a.secret.target===10?90:10;
  assert.equal(chooseExtraComputer(a),chooseExtraComputer(b));
});
test('new computer board games run to a complete result, including a perfect-play tic tac toe draw',()=>{
  for(const game of ['tictactoe','connect4']) {
    const s=session(game,'computer');let actions=0;
    while(s.state.games.match.status==='active'&&actions++<43) {
      const m=s.state.games.match;
      if(m.turn===1)s.bot();
      else s.move(chooseExtraComputer({game,board:m.board.map(piece=>piece?3-piece:0)},()=>0));
    }
    assert.equal(s.state.games.match.status,'finished');assert.ok(actions<=42);
    assert.equal(s.state.pendingGrowth.length,1);assert.equal(s.state.pendingGrowth[0].amount,game==='tictactoe'?5:10);
    if(game==='tictactoe')assert.equal(s.state.games.match.winner,-1);
  }
});

function githubFixture() {
  const files=new Map();let sha=0,fail=false;
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),saved=files.get(id);
    if(options.method==='GET')return saved?Response.json({sha:saved.sha,encoding:'base64',content:Buffer.from(JSON.stringify(saved.room)).toString('base64')}):new Response('{}',{status:404});
    if(fail)return new Response('{}',{status:503});
    const body=JSON.parse(options.body);if(saved&&saved.sha!==body.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`sha-${++sha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});return Response.json({});
  };
  return {files,fetchImpl,setFail(value){fail=value;}};
}
test('each new game survives cloud reloads and retains exactly one claimable completion reward',async()=>{
  for(const game of ['tictactoe','connect4','guess']) {
    const mock=githubFixture();let clock=START,serial=0;
    const make=()=>createGitHubStore({token:'test-only',repository:'test/games',fetchImpl:mock.fetchImpl,now:()=>clock});
    const store=make(),room=await store.createRoom();
    const send=action=>make().applyAction(room.roomId,{clientId:alice.id,name:alice.name,operationId:`new-game-cloud-op-${++serial}`,action});
    const created=await send({type:'game-create',game,mode:'solo',previousId:null});
    let m=created.state.games.match;
    if(game==='guess') {
      while(m.status==='active') {
        clock+=1500;
        await send({type:'game-move',gameId:m.id,step:m.step,move:Math.floor((m.low+m.high)/2)});
        m=(await make().getRoom(room.roomId)).state.games.match;
        assert.equal(m.secret,undefined);
      }
    } else {
      const moves=game==='tictactoe'?[2,6,8]:[3,2,3];
      for(const [index,move] of moves.entries()) {
        await send({type:'game-move',gameId:m.id,step:m.step,move});
        m=(await make().getRoom(room.roomId)).state.games.match;
        if(index<2) {clock+=1500;await send({type:'game-next',gameId:m.id,step:m.step});m=(await make().getRoom(room.roomId)).state.games.match;}
      }
    }
    const completed=await make().getRoom(room.roomId),reward=completed.state.pendingGrowth[0];
    assert.equal(completed.state.games.match.status,'finished');assert.equal(reward.amount,GAMES[game].xp);
    const claimed=await send({type:'claim-growth',rewardId:reward.id});
    assert.equal(claimed.state.xp,86+GAMES[game].xp);
    await assert.rejects(send({type:'claim-growth',rewardId:reward.id}));
    assert.equal((await make().getRoom(room.roomId)).state.xp,86+GAMES[game].xp);
  }
});
test('computer turns survive a GitHub reload and concurrent retry cannot produce an extra move',async()=>{
  const mock=githubFixture();let clock=START;
  const make=()=>createGitHubStore({token:'test-only',repository:'test/games',fetchImpl:mock.fetchImpl,now:()=>clock});
  const store=make(),room=await store.createRoom();
  const send=(target,op,action)=>target.applyAction(room.roomId,{clientId:alice.id,name:alice.name,operationId:op,action});
  const created=await send(store,'create-computer-board',{type:'game-create',game:'gomoku',mode:'computer',previousId:null});
  const gameId=created.state.games.match.id;
  const moved=await send(store,'human-computer-board-move',{type:'game-move',gameId,step:0,move:112});
  const reloaded=await make().getRoom(room.roomId);assert.equal(reloaded.state.games.match.turn,1);assert.equal(reloaded.state.games.match.players[1].computer,true);
  clock+=1000;
  const action={type:'game-bot',gameId,step:moved.state.games.match.step};
  const results=await Promise.allSettled([send(store,'first-computer-move',action),send(make(),'other-computer-move',action)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await make().getRoom(room.roomId)).state.games.match.board.filter(v=>v===2).length,1);
  const success=results.find(r=>r.status==='fulfilled').value;
  const replay=await send(make(),success.event.operationId,action);assert.equal(replay.duplicate,true);assert.equal(replay.revision,success.revision);
  assert.equal(replay.state.games.match.secret,undefined);
});
test('preview runtime storage migrates the previous local save once without overwriting later progress',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'cat-games-migration-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const legacyFile=join(directory,'old.json'),file=join(directory,'runtime','home.json');
  const s=session('gomoku','computer');s.move(112);
  const legacy={version:1,roomId:PREVIEW_HOME,revision:2,state:s.state,operations:[],claimedGrowth:[],createdAt:START,updatedAt:START};
  await writeFile(legacyFile,JSON.stringify(legacy));
  const migrated=createLocalPreviewStore({file,legacyFile,now:()=>START+10000});
  assert.equal((await migrated.getRoom(PREVIEW_HOME)).state.games.match.turn,1);
  await migrated.applyAction(PREVIEW_HOME,{clientId:alice.id,name:alice.name,operationId:'migrated-computer-move',action:{type:'game-bot',gameId:s.state.games.match.id,step:s.state.games.match.step}});
  const reopened=await createLocalPreviewStore({file,legacyFile,now:()=>START+11000}).getRoom(PREVIEW_HOME);
  assert.equal(reopened.revision,3);assert.equal(reopened.state.games.match.turn,0);
});
test('GitHub stores hidden game state, masks action events, merges simultaneous hands and persists rewards across a restart',async()=>{
  const mock=githubFixture();let clock=START;
  const make=()=>createGitHubStore({token:'test-only',repository:'test/games',fetchImpl:mock.fetchImpl,now:()=>clock});
  const store=make(),room=await store.createRoom();let serial=0;
  const send=(target,actor,action)=>target.applyAction(room.roomId,{clientId:actor.id,name:actor.name,operationId:`server-game-op-${++serial}`,action});
  const created=await send(store,alice,{type:'game-create',game:'rps',mode:'duo',previousId:null}),gameId=created.state.games.match.id;
  await send(store,bob,{type:'game-join',gameId});
  const [a,b]=await Promise.all([send(store,alice,{type:'game-move',gameId,step:0,move:'rock'}),send(make(),bob,{type:'game-move',gameId,step:0,move:'scissors'})]);
  for(const data of [a,b]){assert.equal(data.state.games.match.secret,undefined);assert.equal(data.event.action.move,undefined);}
  assert.equal((await make().getRoom(room.roomId)).state.games.match.scores[0],1);
  clock+=2000;await send(store,alice,{type:'game-next',gameId,step:1});await send(store,alice,{type:'game-move',gameId,step:1,move:'rock'});
  const finalOp={clientId:bob.id,name:bob.name,operationId:'final-game-operation',action:{type:'game-move',gameId,step:1,move:'scissors'}};
  mock.setFail(true);await assert.rejects(store.applyAction(room.roomId,finalOp));assert.equal((await make().getRoom(room.roomId)).state.pendingGrowth.length,0);
  mock.setFail(false);const completed=await make().applyAction(room.roomId,finalOp);assert.equal(completed.state.pendingGrowth[0].amount,10);
  const replay=await make().applyAction(room.roomId,finalOp);assert.equal(replay.duplicate,true);assert.equal(replay.state.pendingGrowth.length,1);
  const claimed=await send(make(),alice,{type:'claim-growth',rewardId:completed.state.pendingGrowth[0].id});assert.equal(claimed.state.xp,96);
  mock.files.get(room.roomId).room.operations=[];mock.files.get(room.roomId).sha='rolled-over';
  await assert.rejects(make().applyAction(room.roomId,finalOp),e=>e.code==='GAME_ACTION_REJECTED');
  assert.equal((await make().getRoom(room.roomId)).state.xp,96);
});
test('two real HTTP/SSE clients receive invitations, hidden hands and one completed reward from the shared API',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'cat-games-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  let clock=START;
  const file=join(directory,'home.json');
  const server=createPetServer({store:createLocalPreviewStore({file,now:()=>clock}),coupleRoomId:PREVIEW_HOME,pollMs:50});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.shutdown();server.closeAllConnections();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const roles=[{id:'couple-male',name:'男方'},{id:'couple-female',name:'女方'}];
  const {COUPLE_ROLES}=await import('../src/couple-profile.js');roles[0].id=COUPLE_ROLES[0].clientId;roles[1].id=COUPLE_ROLES[1].clientId;
  const buffers=['',''], controllers=[new AbortController(),new AbortController()];
  const streams=await Promise.all(roles.map((actor,n)=>fetch(`${base}/api/rooms/${PREVIEW_HOME}/events?${new URLSearchParams({clientId:actor.id,name:actor.name})}`,{signal:controllers[n].signal})));
  const pumping=streams.map(async(response,n)=>{const reader=response.body.getReader();try{while(true){const {value,done}=await reader.read();if(done)break;buffers[n]+=new TextDecoder().decode(value);}}catch{}});
  t.after(async()=>{controllers.forEach(c=>c.abort());await Promise.all(pumping);});
  let serial=0;
  const send=async(actor,action)=>{const response=await fetch(`${base}/api/rooms/${PREVIEW_HOME}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:actor.id,name:actor.name,operationId:`http-game-op-${++serial}`,action})});assert.equal(response.status,200);return response.json();};
  const created=await send(roles[0],{type:'game-create',game:'rps',mode:'duo',previousId:null});const gameId=created.state.games.match.id;
  await send(roles[1],{type:'game-join',gameId});await send(roles[0],{type:'game-move',gameId,step:0,move:'rock'});
  const first=(await (await fetch(`${base}/api/rooms/${PREVIEW_HOME}`)).json()).state.games.match;assert.deepEqual(first.locked,[true,false]);assert.equal(first.secret,undefined);
  await send(roles[1],{type:'game-move',gameId,step:0,move:'scissors'});clock+=2000;await send(roles[1],{type:'game-next',gameId,step:1});await send(roles[0],{type:'game-move',gameId,step:1,move:'rock'});await send(roles[1],{type:'game-move',gameId,step:1,move:'scissors'});
  const deadline=Date.now()+2000;
  while(!buffers.every(text=>text.includes('"status":"finished"'))&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  for(const text of buffers){assert.match(text,/"status":"waiting"/);assert.match(text,/"status":"finished"/);assert.doesNotMatch(text,/"secret"|"deck"|"move":"rock"/);}
  const saved=JSON.parse(await readFile(file,'utf8'));assert.equal(saved.state.pendingGrowth.length,1);assert.equal(saved.state.pendingGrowth[0].amount,10);
  const restarted=await createLocalPreviewStore({file,now:()=>clock}).getRoom(PREVIEW_HOME);assert.equal(restarted.state.games.match.status,'finished');
});
