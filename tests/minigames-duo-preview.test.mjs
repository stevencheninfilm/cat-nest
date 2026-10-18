import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { publicGameHub, reduceGameHub, validGameHub } from '../src/minigames.js';
import { previewDuoGameAction } from '../src/minigames-duo-preview.js';
import { minigamesPanel } from '../src/minigames-ui.js';
import { createCloudRoom } from '../src/cloud.js';
import { createPetServer } from '../server/pet-server.mjs';

const at=Date.UTC(2026,9,16),roomId='f'.repeat(32);
const a={id:'partner-male',name:'男方'},b={id:'partner-female',name:'女方'};
const clone=structuredClone;
function fixture(game='memory') {
  const state=initialState(at);
  state.games=reduceGameHub(state.games,{type:'game-create',game,mode:'duo',previousId:null},a,at,`duo-game-${game}`,()=>.2);
  state.games=reduceGameHub(state.games,{type:'game-join',gameId:state.games.match.id},b,at+1,'duo-join-action');
  return state;
}
const publicState=s=>({...s,games:publicGameHub(s.games)});
const move=(s,value)=>({type:'game-move',gameId:s.games.match.id,step:s.games.match.game==='rps'?s.games.match.rounds.length:s.games.match.step,move:value});
const preview=(s,action,actor=a)=>previewDuoGameAction(s,action,actor,at+2000,'duo-preview-action');
const response=(data,status=200)=>({ok:status===200,status,json:async()=>clone(data)});
const snapshot=(s,revision=0,event)=>({roomId,state:publicState(s),revision,...(event?{event}:{})});
const receipt=(s,item,revision=1)=>snapshot(s,revision,{operationId:item.operationId,action:item.action,actor:{id:item.clientId,name:item.name}});
const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
function deferred(){let resolve,reject;return {promise:new Promise((y,n)=>{resolve=y;reject=n;}),get resolve(){return resolve;},get reject(){return reject;}};}
function harness(t,base,handler,pending=[]) {
  const requests=[],sources=[],states=[],rollbacks=[],queues=[];
  class Source {listeners=new Map();constructor(){sources.push(this);}addEventListener(k,f){this.listeners.set(k,f);}emit(k,data){this.listeners.get(k)?.({data:JSON.stringify(data)});}close(){}}
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const cloud=createCloudRoom({apiBase:'https://duo.example.test',roomId,clientId:a.id,name:a.name,pending,
    fetchImpl:async(url,options={})=>{const req={url,method:options.method||'GET',item:options.body?JSON.parse(options.body):null};requests.push(req);return req.method==='GET'?response(snapshot(base)):handler(req);},eventSourceFactory:()=>new Source(),optimisticReducer:reduceAction,
    onState:(s,meta)=>states.push(clone({s,...meta})),onPending:q=>queues.push(clone(q)),onRollback:(...v)=>rollbacks.push(v),onRoom(){},onAction(){},onPresence(){},onStatus(){},onSaveStatus(){}});
  t.after(()=>cloud.destroy());return {cloud,requests,sources,states,rollbacks,queues,latest:()=>states.at(-1).s};
}

test('all three shared boards place a real local piece immediately without predicting a win or reward',()=>{
  for(const game of ['gomoku','tictactoe','connect4']) {
    const s=publicState(fixture(game)),before=clone(s),action=move(s,0),next=preview(s,action);
    const cell=game==='connect4'?35:0;
    assert.equal(next.games.match.board[cell],1);assert.equal(next.games.match.turn,1);assert.equal(next.games.match.step,s.games.match.step+1);
    assert.equal(next.games.match.status,'active');assert.equal(next.games.match.winner,null);
    assert.equal(next.xp,s.xp);assert.deepEqual(next.pendingGrowth,s.pendingGrowth);assert.equal(next.games.earned,s.games.earned);assert.ok(validGameHub(next.games));
    assert.equal(preview(next,move(next,1)),null,'same player cannot take the next turn');assert.deepEqual(s,before);
    const html=minigamesPanel({state:next,clientId:a.id,lobby:false,pendingActions:[action],now:at});
    assert.match(html,/轮到伙伴啦/);assert.doesNotMatch(html,/game-result/);
  }
});

test('even an obvious winning line waits for an authoritative result and creates no growth',()=>{
  const s=publicState(fixture('tictactoe'));s.games.match.board=[1,1,0,2,2,0,0,0,0];
  const next=preview(s,move(s,2));assert.equal(next.games.match.board[2],1);assert.equal(next.games.match.status,'active');assert.equal(next.games.match.winner,null);assert.equal(next.games.match.reward,0);assert.equal(next.pendingGrowth.length,0);
});

test('memory accepts two distinct taps before either response, never a third or an invented face',()=>{
  const s=publicState(fixture()),first=move(s,0),one=preview(s,first),second=move(one,1),two=preview(one,second);
  assert.deepEqual(two.games.match.flipped,[0,1]);assert.ok(two.games.match.cards.every(v=>v===null));assert.deepEqual(two.games.match.scores,[0,0]);assert.ok(validGameHub(two.games));
  assert.equal(preview(one,move(one,0)),null);assert.equal(preview(two,move(two,2)),null);
  const html=minigamesPanel({state:one,clientId:a.id,lobby:false,pendingActions:[first],now:at});
  assert.doesNotMatch(html.match(/<button[^>]*data-game-move="1"[^>]*>/)[0],/disabled/,'second card stays tappable');
  const twoHtml=minigamesPanel({state:two,clientId:a.id,lobby:false,pendingActions:[first,second],now:at});
  assert.equal((twoHtml.match(/is-opening/g)||[]).length,2);assert.match(twoHtml.match(/<button[^>]*data-game-move="2"[^>]*>/)[0],/disabled/);
});

test('RPS immediately locks and shows only our chosen hand, while guess never fabricates a hint',()=>{
  let s=publicState(fixture('rps')),action=move(s,'rock'),next=preview(s,action);
  assert.deepEqual(next.games.match.locked,[true,false]);assert.equal(next.games.match.rounds.length,0);assert.equal(next.games.match.secret,undefined);assert.equal(preview(next,move(next,'paper')),null);
  const html=minigamesPanel({state:next,clientId:a.id,lobby:false,pendingActions:[action],now:at});assert.match(html,/<span>✊<\/span>/);assert.match(html,/等伙伴出手/);
  s=publicState(fixture('guess'));next=preview(s,move(s,50));assert.deepEqual(next.games.match.guesses,[]);assert.equal(next.games.match.low,1);assert.equal(next.games.match.high,100);assert.equal(next.games.match.answer,null);assert.equal(next.games.match.turn,1);
});

test('join, cancel and reveal transitions are local, but ready never invents the shared start clock',()=>{
  const base=fixture('memory');let s=publicState(base);s.games.match.phase='reveal';s.games.match.flipped=[0,1];s.games.match.cards[0]=0;s.games.match.cards[1]=1;s.games.match.revealUntil=at+1000;
  const next=preview(s,{type:'game-next',gameId:s.games.match.id,step:s.games.match.step});assert.equal(next.games.match.phase,'play');assert.equal(next.games.match.turn,1);assert.ok(next.games.match.cards.every(v=>v===null));
  s=publicState(fixture('snake'));const ready=preview(s,{type:'game-arcade-ready',gameId:s.games.match.id});assert.equal(ready.games.match.arcade.ready[0],true);assert.equal(ready.games.match.arcade.stage,'ready');assert.equal(ready.games.match.arcade.startAt,0);assert.ok(validGameHub(ready.games));assert.equal(preview(ready,{type:'game-arcade-ready',gameId:s.games.match.id}),null);
  assert.equal(preview(s,{type:'game-cancel',gameId:s.games.match.id}).games.match.status,'cancelled');
  const empty=initialState(at),created=preview(empty,{type:'game-create',game:'snake',mode:'duo',previousId:null});assert.equal(created.games.match.status,'waiting');assert.equal(created.games.match.secret,undefined);
  const joined=preview(created,{type:'game-join',gameId:created.games.match.id},b);assert.equal(joined.games.match.status,'active');assert.ok(validGameHub(joined.games));
});

test('stale steps, other sessions, spectators, invalid columns, and hidden/solo actions cannot preview',()=>{
  for(const game of ['rps','memory','gomoku','tictactoe','connect4','guess']){
    const s=publicState(fixture(game)),action=move(s,game==='rps'?'rock':0);
    assert.equal(preview(s,{...action,step:99}),null);assert.equal(preview(s,{...action,gameId:'another-game-id'}),null);assert.equal(preview(s,action,{id:'spectator-id',name:'旁观者'}),null);assert.equal(preview(s,{...action,move:225}),null);
    assert.equal(preview(s,{...action,secret:{deck:[]}}),null);s.games.match.mode='computer';assert.equal(preview(s,action),null);
  }
});

test('two memory taps queue at once and SSE confirmation releases the second request before the first HTTP response',async t=>{
  const base=fixture(),first=deferred(),second=deferred();let posts=0;
  const h=harness(t,base,()=>[first,second][posts++].promise);await h.cloud.start();
  assert.equal(h.cloud.dispatch(move(h.latest(),0)),true);const item=h.requests.at(-1).item;
  assert.equal(h.cloud.dispatch(move(h.latest(),1)),true);assert.equal(h.cloud.dispatch(move(h.latest(),2)),false);assert.equal(posts,1);assert.deepEqual(h.latest().games.match.flipped,[0,1]);
  const saved=reduceAction(base,item.action,a,at+100,item.operationId);h.sources[0].emit('action',receipt(saved,item));await flush();
  assert.equal(posts,2,'the pending duplicate HTTP response does not block the next move');const item2=h.requests.at(-1).item;assert.equal(item2.action.step,item.action.step+1);assert.equal(h.states.at(-1).pendingGames.length,1);
  const saved2=reduceAction(saved,item2.action,a,at+200,item2.operationId);second.resolve(response(receipt(saved2,item2,2)));await flush();
  assert.deepEqual(h.latest(),publicState(saved2));assert.deepEqual(h.queues.at(-1),[]);
  first.resolve(response(receipt(saved,item)));await flush();assert.deepEqual(h.latest(),publicState(saved2),'late HTTP never overwrites a newer confirmed move');assert.equal(h.rollbacks.length,0);
});

test('an unrelated delayed care save does not block either immediate game choice',async t=>{
  const base=fixture(),ack=deferred(),h=harness(t,base,()=>ack.promise);await h.cloud.start();
  assert.equal(h.cloud.dispatch({type:'pet'}),true);assert.equal(h.cloud.dispatch(move(h.latest(),0)),true);assert.equal(h.cloud.dispatch(move(h.latest(),1)),true);
  assert.deepEqual(h.latest().games.match.flipped,[0,1]);assert.equal(h.queues.at(-1).length,3);assert.equal(h.requests.filter(r=>r.method==='POST').length,1);
  assert.deepEqual(h.states.at(-1).confirmedState,publicState(base));
});

test('a temporary failure preserves queued game display and retries the original ID only once',async t=>{
  const base=fixture('tictactoe');let attempts=0;
  const h=harness(t,base,req=>++attempts===1?response({error:{message:'temporary failure'}},503):response(receipt(reduceAction(base,req.item.action,a,at+100,req.item.operationId),req.item)));
  await h.cloud.start();h.cloud.dispatch(move(h.latest(),0));const item=clone(h.requests.at(-1).item);await flush();
  assert.equal(h.latest().games.match.board[0],1);assert.equal(h.rollbacks.length,0);assert.equal(h.queues.at(-1)[0].operationId,item.operationId);
  t.mock.timers.tick(8000);await flush();assert.equal(attempts,2);assert.deepEqual(h.requests.at(-1).item,item);assert.deepEqual(h.queues.at(-1),[]);assert.equal(h.latest().games.match.board[0],1);
});

test('a definitive refusal rolls back both dependent card selections and stops retrying them',async t=>{
  const base=fixture(),ack=deferred(),h=harness(t,base,()=>ack.promise);await h.cloud.start();
  h.cloud.dispatch(move(h.latest(),0));h.cloud.dispatch(move(h.latest(),1));ack.resolve(response({error:{code:'GAME_ACTION_REJECTED',message:'对局已更新'}},409));await flush();
  assert.deepEqual(h.latest(),publicState(base));assert.deepEqual(h.queues.at(-1),[]);assert.equal(h.requests.filter(r=>r.method==='POST').length,1);assert.equal(h.rollbacks.length,1);
  t.mock.timers.tick(8000);await flush();assert.equal(h.requests.filter(r=>r.method==='POST').length,1);
});

test('our local board piece rebases over a partner snapshot and rewards remain strictly confirmed',async t=>{
  const base=fixture('tictactoe'),ack=deferred(),h=harness(t,base,()=>ack.promise);await h.cloud.start();h.cloud.dispatch(move(h.latest(),0));const own=h.requests.at(-1).item;
  const saved=reduceAction(base,own.action,a,at+100,own.operationId);h.sources[0].emit('action',receipt(saved,own));await flush();
  const otherMove=move(saved,4),partner=reduceAction(saved,otherMove,b,at+200,'duo-partner-move');h.sources[0].emit('action',snapshot(partner,2,{operationId:'duo-partner-move',actor:b,action:otherMove}));
  assert.equal(h.cloud.dispatch(move(h.latest(),1)),true);assert.deepEqual(h.latest().games.match.board.slice(0,5),[1,1,0,0,2]);assert.equal(h.latest().xp,base.xp);assert.equal(h.latest().pendingGrowth.length,0);
});

test('a partner advancing the same RPS reveal does not discard our queued next-round hand',async t=>{
  let base=fixture('rps');base=reduceAction(base,move(base,'rock'),a,at+10,'duo-rock-action');base=reduceAction(base,move(base,'scissors'),b,at+20,'duo-scissors-action');
  // Use current time for reveal eligibility, just as a real ready button does.
  t.mock.method(Date,'now',()=>at+2000);
  const blocker=deferred(),h=harness(t,base,()=>blocker.promise);await h.cloud.start();h.cloud.dispatch({type:'pet'});
  const next={type:'game-next',gameId:base.games.match.id,step:base.games.match.rounds.length};assert.equal(h.cloud.dispatch(next),true);assert.equal(h.cloud.dispatch(move(h.latest(),'paper')),true);
  const partner=reduceAction(base,next,b,at+2000,'duo-partner-next');h.sources[0].emit('action',snapshot(partner,1,{operationId:'duo-partner-next',action:next,actor:b}));
  assert.equal(h.latest().games.match.locked[0],true);assert.equal(h.rollbacks.length,0);assert.equal(h.states.at(-1).pendingGames.at(-1).move,'paper');
});

test('reloaded unconfirmed game input is retried with its original ID and never fabricates a result',async t=>{
  const base=fixture('rps'),item={operationId:'duo-reloaded-action',clientId:a.id,name:a.name,action:move(publicState(base),'rock')},ack=deferred();
  const h=harness(t,base,()=>ack.promise,[item]);await h.cloud.start();assert.deepEqual(h.requests.at(-1).item,item);assert.deepEqual(h.latest(),publicState(base));
  ack.resolve(response(receipt(reduceAction(base,item.action,a,at+100,item.operationId),item)));await flush();assert.deepEqual(h.latest().games.match.locked,[true,false]);assert.equal(h.latest().games.match.rounds.length,0);assert.deepEqual(h.queues.at(-1),[]);
});

test('simultaneous next-round requests preserve our following hand when the partner transition wins',async t=>{
  let base=fixture('rps');base=reduceAction(base,move(base,'rock'),a,at+10,'duo-rock-action');base=reduceAction(base,move(base,'scissors'),b,at+20,'duo-scissors-action');t.mock.method(Date,'now',()=>at+2000);
  const next={type:'game-next',gameId:base.games.match.id,step:base.games.match.rounds.length},ack=deferred();let posts=0;
  const h=harness(t,base,()=>++posts===1?ack.promise:new Promise(()=>{}));await h.cloud.start();h.cloud.dispatch(next);assert.equal(h.cloud.dispatch(move(h.latest(),'paper')),true);
  const partner=reduceAction(base,next,b,at+2000,'duo-partner-next');h.sources[0].emit('action',snapshot(partner,1,{operationId:'duo-partner-next',action:next,actor:b}));
  ack.resolve(response({error:{code:'GAME_ACTION_REJECTED',message:'对方已开启下一轮'}},409));await flush();
  assert.equal(posts,2);assert.equal(h.requests.at(-1).item.action.move,'paper');assert.equal(h.latest().games.match.locked[0],true);assert.equal(h.rollbacks.length,0);
});

test('duplicate arcade checkpoints are blocked independently from care and other game queues',async t=>{
  const base=fixture('snake'),ack=deferred(),h=harness(t,base,()=>ack.promise);await h.cloud.start();
  const action={type:'game-arcade-input',gameId:base.games.match.id,seq:0,events:[],until:100};
  assert.equal(h.cloud.dispatch(action),true);assert.equal(h.cloud.dispatch(action),false);assert.equal(h.cloud.dispatch({type:'game-arcade-sync',gameId:action.gameId}),true);assert.equal(h.cloud.dispatch({type:'game-arcade-sync',gameId:action.gameId}),false);
});

test('two real HTTP/SSE clients see local pieces before persistence and converge on one confirmed winner',async t=>{
  let saved=fixture('tictactoe'),revision=0;const initialXp=saved.xp;
  const writes=[],sources=[],clients=[],errors=[];
  const store={configured:true,getRoom:async()=>snapshot(saved,revision),async applyAction(id,item){
    const gate=deferred();writes.push({item,gate});await gate.promise;
    const actor={id:item.clientId,name:item.name},next=reduceAction(saved,item.action,actor,Date.now(),item.operationId);
    assert.ok(next);saved=next;revision++;return receipt(saved,item,revision);
  }};
  const server=createPetServer({store,serveStatic:false,pollMs:60000,heartbeatMs:60000});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  class HttpSource {
    listeners=new Map();controller=new AbortController();
    constructor(url){sources.push(this);this.pump(url).catch(e=>{if(e.name!=='AbortError')errors.push(e);});}
    addEventListener(k,fn){this.listeners.set(k,fn);}
    close(){this.controller.abort();}
    async pump(url){const res=await fetch(url,{signal:this.controller.signal});this.onopen?.();const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
      for(;;){const {done,value}=await reader.read();if(done)return;buffer+=decoder.decode(value,{stream:true});let end;
        while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=block.match(/^event: (.+)$/m)?.[1],data=block.match(/^data: (.+)$/m)?.[1];if(event&&data)this.listeners.get(event)?.({data});}
      }
    }
  }
  t.after(()=>{clients.forEach(c=>c.cloud.destroy());sources.forEach(s=>s.close());server.shutdown();server.closeAllConnections();});
  const wait=async condition=>{for(let n=0;n<1000;n++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.fail('HTTP/SSE condition timed out');};
  for(const actor of [a,b]){
    const client={state:null,confirmed:null,phase:''};client.cloud=createCloudRoom({apiBase:base,roomId,clientId:actor.id,name:actor.name,optimisticReducer:reduceAction,eventSourceFactory:url=>new HttpSource(url),
      onRoom(){},onState(s,meta){client.state=s;client.confirmed=meta?.confirmedState||s;},onAction(){},onPresence(){},onStatus(s){client.phase=s.phase;},onSaveStatus(){},onPending(){},onRollback(){assert.fail('a legal move must not roll back');}});
    clients.push(client);await client.cloud.start();
  }
  await wait(()=>clients.every(c=>c.phase==='online'));
  for(const [turn,cell] of [0,3,1,4,2].entries()){
    const current=clients[turn%2],other=clients[1-turn%2],before=revision;
    assert.equal(current.cloud.dispatch(move(current.state,cell)),true);
    assert.equal(current.state.games.match.board[cell],turn%2+1,'local input paints synchronously before any network completion');assert.equal(current.confirmed.games.match.board[cell],0);assert.equal(other.state.games.match.board[cell],0);
    assert.equal(current.state.pendingGrowth.length,0,'unconfirmed winning moves never generate rewards');
    await wait(()=>writes.length===turn+1);assert.equal(revision,before,'HTTP remains blocked behind the synthetic durable write');writes[turn].gate.resolve();
    await wait(()=>clients.every(c=>c.confirmed.games.match.step===saved.games.match.step&&c.confirmed.games.match.board[cell]===turn%2+1));
    assert.deepEqual(clients[0].state.games,clients[1].state.games);
  }
  assert.equal(saved.games.match.status,'finished');assert.equal(saved.games.match.winner,0);assert.equal(saved.games.match.reward,10);assert.equal(saved.pendingGrowth.length,1);assert.equal(saved.xp,initialXp);assert.equal(writes.length,5);assert.deepEqual(errors,[]);
});
