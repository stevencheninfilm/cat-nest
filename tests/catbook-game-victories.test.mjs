import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, FOODS } from '../src/state.js';
import { canInviteCat, validCollection, COLLECTION_CATS } from '../src/cat-collection.js';
import { createCollectionEvents } from '../src/catbook-events.js';
import { catbookMarkup } from '../src/catbook-ui.js';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { gomokuWinningCells } from '../src/minigames-computer.js';

const now=Date.UTC(2026,9,14), alice={id:'victory-player-one',name:'男方'},bob={id:'victory-player-two',name:'女方'};
let serial=0;
const beating={rock:'paper',paper:'scissors',scissors:'rock'};
const losing={rock:'scissors',paper:'rock',scissors:'paper'};
function session(game,mode='duo',base=initialState(now)) {
  let state=base,clock=now;
  const apply=(action,actor=alice)=>{
    clock+=2000;const next=reduceAction(state,action,actor,clock,`victory-operation-${++serial}`);
    assert.ok(next,JSON.stringify(action));state=next;return state;
  };
  apply({type:'game-create',game,mode,previousId:state.games.match?.id??null});
  if(mode==='duo')apply({type:'game-join',gameId:state.games.match.id},bob);
  return {get state(){return state;},apply,move(move,actor=alice){const m=state.games.match;return apply({type:'game-move',gameId:m.id,step:game==='rps'?m.rounds.length:m.step,move},actor);},next(){const m=state.games.match;return apply({type:'game-next',gameId:m.id,step:game==='rps'?m.rounds.length:m.step});}};
}
function finishRps(s,winning=true) {
  while(s.state.games.match.status==='active') {
    const m=s.state.games.match;
    if(m.mode==='duo'){s.move(winning?'rock':'scissors');s.move(winning?'scissors':'rock',bob);}
    else s.move((winning?beating:losing)[m.secret.hands[1]]);
    if(s.state.games.match.status==='active')s.next();
  }
  return s.state;
}
function finishMemory(s){const deck=s.state.games.match.secret.deck;for(let card=0;card<8;card++)for(const index of deck.flatMap((value,index)=>value===card?[index]:[]))s.move(index);return s.state;}

test('whole human wins count once in single-player, computer and shared modes',()=>{
  for(const mode of ['solo','computer','duo']) {
    const s=session('rps',mode),before=structuredClone(s.state);
    const done=finishRps(s);assert.equal(done.collection.wins.rps,1,mode);
    assert.equal(before.collection.wins.rps,0,'the source snapshot stays immutable');
    assert.equal(reduceAction(done,{type:'game-move',gameId:done.games.match.id,step:done.games.match.step,move:'rock'},alice,now+99999,'victory-repeat-end'),null);
    assert.equal(normalizeState(JSON.parse(JSON.stringify(done)),now+10*86400_000).collection.wins.rps,1);
  }
  assert.equal(finishRps(session('rps','duo'),false).collection.wins.rps,1,'either human can win for the shared home');
});

test('round wins, computer victories, failed solo challenges, draws and cancellations do not advance the wrong counter',()=>{
  const round=session('rps');round.move('rock');round.move('scissors',bob);
  assert.equal(round.state.collection.wins.rps,0,'one round is not a match victory');
  for(const mode of ['solo','computer'])assert.equal(finishRps(session('rps',mode),false).collection.wins.rps,0);
  const draw=session('rps');for(let n=0;n<20;n++){draw.move('rock');draw.move('rock',bob);if(n<19)draw.next();}
  assert.equal(draw.state.games.match.winner,-1);assert.equal(draw.state.collection.wins.rps,0);
  const cancel=session('memory','solo');cancel.apply({type:'game-cancel',gameId:cancel.state.games.match.id});
  assert.deepEqual(cancel.state.collection.wins,{rps:0,memory:0,gomoku:0});
});

test('memory and gomoku victories advance their own lifetime achievements',()=>{
  const memory=finishMemory(session('memory','solo'));
  assert.deepEqual(memory.collection.wins,{rps:0,memory:1,gomoku:0});
  const chess=session('gomoku','solo');for(let n=0;n<3;n++){chess.move(gomokuWinningCells(chess.state.games.match.board,1)[0]);if(n<2)chess.next();}
  assert.equal(chess.state.games.match.winner,0);assert.deepEqual(chess.state.collection.wins,{rps:0,memory:0,gomoku:1});
});

test('five and twelve victories unlock the new cats even after the daily growth reward cap',()=>{
  let state=initialState(now);state.games.earned=50;
  const events=createCollectionEvents(state);
  for(let n=1;n<=45;n++) {
    state=finishRps(session('rps','duo',state));
    assert.equal(state.games.match.reward,0);assert.equal(state.collection.wins.rps,n);
    assert.equal(canInviteCat('scout',state.collection,1),n>=5);
    assert.equal(canInviteCat('biscuit',state.collection,1),n>=12);
    const notices=events.observe(state);
    assert.deepEqual(notices,n===5?[{type:'cat-unlocked',id:'scout'}]:n===12?[{type:'cat-unlocked',id:'biscuit'}]:[]);
  }
  assert.equal(state.history.length,40);
  assert.equal(state.collection.wins.rps,45,'victories outlive the bounded diary');
  const receipt=reduceAction(state,{type:'invite-cat',catId:'scout'},alice,now+100000,'victory-invite-scout');
  assert.equal(receipt.collection.invited[0].id,'scout');
  assert.deepEqual(receipt.collection.wins,state.collection.wins);
  assert.deepEqual(normalizeState(receipt,now+86400_000).collection.wins,state.collection.wins);
});

test('old collections retain their cats and care progress without inventing game victories',()=>{
  const state=initialState(now);state.collection.stats.feed=30;delete state.collection.wins;
  state.collection.invited=[{id:'bolt',at:now,operationId:'legacy-victory-bolt',actorId:alice.id}];
  assert.equal(validCollection(state.collection,Object.keys(FOODS)),true);
  const migrated=normalizeState(state,now);
  assert.deepEqual(migrated.collection.wins,{rps:0,memory:0,gomoku:0});
  assert.equal(migrated.collection.stats.feed,30);assert.equal(migrated.collection.invited[0].id,'bolt');
  assert.equal(canInviteCat('scout',migrated.collection,120),false);
  for(const wins of [{rps:-1,memory:0,gomoku:0},{rps:1.5,memory:0,gomoku:0},{rps:0,memory:0},{rps:0,memory:0,gomoku:0,fake:1}])assert.equal(validCollection({...migrated.collection,wins},Object.keys(FOODS)),false);
});

test('new portraits remain gray before invitation and the first scene is the large station',()=>{
  const state=initialState(now);state.collection.wins.rps=5;
  const html=catbookMarkup(state,{catId:'scout',tab:'achievements'});
  assert.match(html,/data-scene-id="station"/);
  assert.match(html,/石头剪刀布累计获胜 5 局/);
  assert.match(html,/book-cat-sprite is-game-cat undiscovered/);
  assert.equal(COLLECTION_CATS.length,24);
  for(const action of [{type:'game-finish',winner:0},{type:'invite-cat',catId:'scout',wins:5}])assert.equal(sanitizeAction(action),null);
});

function mockStorage() {
  const files=new Map();let sequence=0,fail=false;
  return {files,set fail(value){fail=value;},fetchImpl:async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),file=files.get(id);
    if(options.method==='GET')return file?Response.json({sha:file.sha,encoding:'base64',content:Buffer.from(JSON.stringify(file.room)).toString('base64')}):new Response('{}',{status:404});
    if(fail)return new Response('{}',{status:500});
    const data=JSON.parse(options.body);if(file&&file.sha!==data.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`victory-sha-${++sequence}`,room:JSON.parse(Buffer.from(data.content,'base64').toString())});return new Response('{}',{status:200});
  }};
}

test('cloud victory confirmation, retry and failed writes preserve exactly one victory',async()=>{
  const mock=mockStorage();let clock=now;
  const store=createGitHubStore({token:'fake-token',repository:'test/victories',fetchImpl:mock.fetchImpl,now:()=>clock});
  const room=await store.createRoom();
  const apply=async(action,actor=alice,id=`cloud-victory-${++serial}`)=>{clock+=2000;return store.applyAction(room.roomId,{operationId:id,clientId:actor.id,name:actor.name,action});};
  const created=await apply({type:'game-create',game:'rps',mode:'duo',previousId:null}),matchId=created.state.games.match.id;
  await apply({type:'game-join',gameId:matchId},bob);await apply({type:'game-move',gameId:matchId,step:0,move:'rock'});await apply({type:'game-move',gameId:matchId,step:0,move:'scissors'},bob);
  await apply({type:'game-next',gameId:matchId,step:1});await apply({type:'game-move',gameId:matchId,step:1,move:'rock'});
  const finish={type:'game-move',gameId:matchId,step:1,move:'scissors'};
  mock.fail=true;await assert.rejects(apply(finish,bob,'cloud-victory-last-move'));assert.equal(mock.files.get(room.roomId).room.state.collection.wins.rps,0);
  mock.fail=false;const saved=await apply(finish,bob,'cloud-victory-last-move');assert.equal(saved.state.collection.wins.rps,1);
  const retry=await apply(finish,bob,'cloud-victory-last-move');assert.equal(retry.duplicate,true);assert.equal(retry.state.collection.wins.rps,1);
});

test('the server checks game victories before accepting a new game-cat invitation',async()=>{
  const mock=mockStorage(),store=createGitHubStore({token:'fake-token',repository:'test/victories',fetchImpl:mock.fetchImpl,now:()=>now});
  const room=await store.createRoom(),file=mock.files.get(room.roomId);
  file.room.state.collection.wins.rps=4;file.sha='four-victories';
  const invite={operationId:'victory-scout-invitation',clientId:alice.id,name:alice.name,action:{type:'invite-cat',catId:'scout'}};
  await assert.rejects(store.applyAction(room.roomId,invite),error=>error.code==='CAT_ACHIEVEMENT_REQUIRED');
  file.room.state.collection.wins.rps=5;file.sha='five-victories';
  const saved=await store.applyAction(room.roomId,invite);
  assert.equal(saved.state.collection.invited[0].id,'scout');assert.equal(saved.state.collection.wins.rps,5);
  const persisted=mock.files.get(room.roomId);
  persisted.room.state.collection.wins.memory=-1;persisted.sha='corrupt-victories';
  await assert.rejects(store.getRoom(room.roomId),error=>error.code==='STORAGE_CORRUPT');
});
