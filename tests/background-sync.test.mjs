import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudRoom} from '../src/cloud.js';
import {initialState,reduceAction,levelStartXp} from '../src/state.js';
import {cooperationButton} from '../src/couple-care-ui.js';
import {catbookMarkup} from '../src/catbook-ui.js';
import {gamePanelSignature} from '../src/minigames-panel-state.js';

const at=1_800_000_000_000, roomId='f'.repeat(32), actor={id:'partner-male',name:'男方'};
const clone=value=>structuredClone(value);
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(value)});
const snapshot=(state,revision=0,event)=>({roomId,state,revision,...(event?{event}:{})});
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),get resolve(){return resolve;},get reject(){return reject;}};};
function harness(t,handler,base=initialState(at),optimisticReducer=reduceAction) {
  t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:at});
  const posts=[],states=[],queues=[],saves=[],actions=[],rollbacks=[],statuses=[],sources=[];
  class Source {
    listeners=new Map();
    constructor(){sources.push(this);}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    emit(type,data){this.listeners.get(type)?.({data:JSON.stringify(data)});}
    close(){}
  }
  const room=createCloudRoom({apiBase:'https://background.example.test',roomId,clientId:actor.id,name:actor.name,optimisticReducer,
    fetchImpl:async(url,options={})=>{
      if(options.method!=='POST')return response(snapshot(base));
      const item=JSON.parse(options.body);posts.push(item);return handler(item,posts.length);
    },eventSourceFactory:()=>new Source(),
    onRoom(){},onPresence(){},onState:(state,meta)=>states.push(clone({state,...meta})),onPending:q=>queues.push(clone(q)),
    onSaveStatus:s=>saves.push(s),onStatus:s=>statuses.push(s),onAction:(action,who,meta)=>actions.push({action,who,...meta}),onRollback:(...args)=>rollbacks.push(args),
  });
  t.after(()=>room.destroy());
  const receipt=(item,state,revision=1)=>snapshot(state,revision,{operationId:item.operationId,action:item.action,actor});
  return {room,posts,queues,saves,actions,rollbacks,statuses,sources,states,receipt,
    display:()=>states.at(-1).state,confirmed:()=>states.at(-1).confirmedState};
}

test('different care actions, dress and a new bubble claim respond before the first HTTP write completes',async t=>{
  const acknowledgements=Array.from({length:5},deferred),base=initialState(at);
  const h=harness(t,(item,n)=>acknowledgements[n-1].promise,base);
  await h.room.start();
  assert.equal(h.room.dispatch({type:'pet'}),true);
  const petId=h.posts[0].operationId;
  assert.equal(h.room.dispatch({type:'pet'}),false,'local cooldown prevents repeated pending taps');
  assert.equal(h.room.dispatch({type:'feed',food:'water'}),true);
  assert.equal(h.room.dispatch({type:'play'}),true);
  assert.equal(h.room.dispatch({type:'dress',appearance:{...base.appearance,clothes:1}}),true);
  assert.equal(h.room.dispatch({type:'claim-growth',rewardId:petId}),true);
  assert.equal(h.room.dispatch({type:'claim-growth',rewardId:petId}),false);
  assert.equal(h.posts.length,1,'only the network queue is serial');
  assert.equal(h.queues.at(-1).length,5);
  assert.equal(h.display().appearance.clothes,1);
  assert.ok(h.display().xp>base.xp,'a deliberate claim responds locally');
  assert.equal(h.display().pendingGrowth.length,2);
  assert.deepEqual(h.confirmed(),base,'only confirmed snapshots are available for persistence/unlocks');
  let server=base;
  for(let i=0;i<5;i++){
    const item=h.posts[i];server=reduceAction(server,item.action,actor,at+i,item.operationId);assert.ok(server);
    acknowledgements[i].resolve(response(h.receipt(item,server,i+1)));await flush();
  }
  assert.deepEqual(h.display(),server);assert.deepEqual(h.queues.at(-1),[]);
  assert.equal(h.actions.filter(a=>a.optimistic).length,5);
  assert.equal(h.actions.filter(a=>!a.optimistic).length,5);
});

test('upload failure retains local choices and backoff prevents each new click from retrying the failed POST',async t=>{
  const base=initialState(at);let server=base,revision=0;
  const h=harness(t,(item,n)=>{
    if(n===1)return response({error:{message:'temporary storage error'}},503);
    server=reduceAction(server,item.action,actor,Date.now(),item.operationId);assert.ok(server);
    return response(h.receipt(item,server,++revision));
  },base);
  await h.room.start();h.room.dispatch({type:'pet'});const original=h.posts[0];await flush();
  assert.equal(h.display().love,base.love+3);assert.deepEqual(h.confirmed(),base);
  assert.equal(h.rollbacks.length,0);assert.equal(h.saves.at(-1).phase,'error');
  assert.equal(h.room.dispatch({type:'feed',food:'water'}),true);
  assert.equal(h.room.dispatch({type:'play'}),true);
  assert.equal(h.posts.length,1);
  assert.equal(h.display().pendingGrowth.length,3);
  t.mock.timers.tick(7999);await flush();assert.equal(h.posts.length,1);
  t.mock.timers.tick(1);await flush();
  assert.deepEqual(h.posts[1],original,'the original durable deduplication ID is reused');
  assert.equal(h.posts.length,4);assert.equal(h.display().pendingGrowth.length,3);
  assert.deepEqual(h.display(),server);assert.equal(h.saves.at(-1).phase,'saved');
});

test('a long upload queue projects only the new choice on each tap, and rejects overflow without losing queued work',async t=>{
  const ack=deferred();let reductions=0;
  const h=harness(t,()=>ack.promise,initialState(at),(...args)=>{reductions++;return reduceAction(...args);});
  await h.room.start();
  for(let i=0;i<20;i++)assert.equal(h.room.dispatch({type:'rename',name:`测试猫${i}`}),true);
  assert.equal(reductions,20,'normal taps never replay the preceding queue or re-normalize its diaries');
  assert.equal(h.posts.length,1);assert.equal(h.display().name,'测试猫19');
  assert.equal(h.room.dispatch({type:'rename',name:'排队上限'}),false);
  assert.equal(h.queues.at(-1).length,20);assert.equal(reductions,20);
});

test('a late SSE acknowledgement releases the next care action without another upload of the confirmed action',async t=>{
  const base=initialState(at),next=deferred();
  const h=harness(t,(item,n)=>n===1?response({error:{message:'response lost'}},503):next.promise,base);
  await h.room.start();h.room.dispatch({type:'pet'});await flush();
  h.room.dispatch({type:'feed',food:'water'});assert.equal(h.posts.length,1);
  const item=h.posts[0],saved=reduceAction(base,item.action,actor,at,item.operationId);
  h.sources[0].emit('action',h.receipt(item,saved));await flush();
  assert.equal(h.posts.length,2);assert.equal(h.posts[1].action.type,'feed');
  const fed=reduceAction(saved,h.posts[1].action,actor,at,h.posts[1].operationId);
  next.resolve(response(h.receipt(h.posts[1],fed,2)));await flush();
  t.mock.timers.tick(8000);await flush();assert.equal(h.posts.length,2);
  assert.deepEqual(h.display(),fed);assert.equal(h.rollbacks.length,0);
});

test('an HTTP timeout after a durable write retries the original receipt rather than discarding or duplicating care',async t=>{
  const base=initialState(at);let saved,first;
  const h=harness(t,(item,n)=>{
    if(n===1){first=item;saved=reduceAction(base,item.action,actor,at,item.operationId);return response({error:{message:'gateway timed out'}},408);}
    assert.deepEqual(item,first);return response(h.receipt(item,saved));
  },base);
  await h.room.start();h.room.dispatch({type:'pet'});await flush();
  assert.equal(h.queues.at(-1).length,1);assert.equal(h.rollbacks.length,0);
  t.mock.timers.tick(8000);await flush();
  assert.equal(h.posts.length,2);assert.deepEqual(h.confirmed(),saved);
  assert.equal(h.confirmed().pendingGrowth.length,1);assert.deepEqual(h.queues.at(-1),[]);
});

test('a definitive rejection corrects only that operation and the following legal care still saves',async t=>{
  const base=initialState(at),first=deferred();
  const h=harness(t,(item,n)=>n===1?first.promise:response(h.receipt(item,reduceAction(base,item.action,actor,at,item.operationId))),base);
  await h.room.start();h.room.dispatch({type:'pet'});h.room.dispatch({type:'feed',food:'water'});
  first.resolve(response({error:{code:'CARE_COOLDOWN',message:'对方刚刚摸过小猫'}},409));await flush();
  assert.equal(h.posts.length,2);assert.deepEqual(h.queues.at(-1),[]);
  assert.equal(h.display().pendingGrowth.length,1);assert.equal(h.display().pendingGrowth[0].kind,'feed');
  assert.equal(h.display().collection.stats.pet,0);assert.equal(h.rollbacks.length,1);
});

test('a loaded room remains interactive during a broken live connection; a first load never uses an unverified cached save',async t=>{
  const base=initialState(at),ack=deferred(),h=harness(t,()=>ack.promise,base);
  assert.equal(h.room.ready,false);assert.equal(h.room.dispatch({type:'pet'}),false);
  await h.room.start();h.sources[0].onerror();
  assert.equal(h.statuses.at(-1).phase,'offline');assert.equal(h.room.ready,true);
  assert.equal(h.room.dispatch({type:'pet'}),true);assert.equal(h.display().pendingGrowth.length,1);
});

test('favorites toggle locally in order while another action is still uploading',async t=>{
  const base=initialState(at);base.xp=levelStartXp(3);
  const first=deferred(),h=harness(t,()=>first.promise,base);
  await h.room.start();h.room.dispatch({type:'pet'});
  assert.equal(h.room.dispatch({type:'diary-favorite',memoryId:'adoption',favorite:true}),true);
  assert.deepEqual(h.display().diary.favorites,['adoption']);assert.deepEqual(h.confirmed().diary.favorites,[]);
  assert.equal(h.room.dispatch({type:'diary-favorite',memoryId:'adoption',favorite:false}),true);
  assert.deepEqual(h.display().diary.favorites,[]);assert.equal(h.queues.at(-1).length,3);
});

test('cooperation and other cat invitations stay available while only the selected invitation is pending',()=>{
  const base=initialState(at);
  const button=cooperationButton({action:{type:'pet'}},base,{ready:true,configured:true,phase:'offline',connected:true,saving:true,clientId:actor.id,now:at});
  assert.equal(button.disabled,false);
  base.xp=120;
  base.collection.stats.feed=5;
  const pendingInvitations=new Set(['bandit:station']);
  const pending=catbookMarkup(base,{catId:'bandit',sceneId:'station',pendingInvitations});
  assert.match(pending,/data-book-invite="bandit"[^>]*disabled/);assert.match(pending,/邀请已送出/);
  const available=catbookMarkup(base,{catId:'bandit',sceneId:'station',pendingInvitations:new Set(['other:station']),saving:true});
  assert.doesNotMatch(available,/data-book-invite="bandit"[^>]*disabled/);
  const options={state:base,clientId:actor.id};
  assert.notEqual(gamePanelSignature(options),gamePanelSignature({...options,saveError:'upload failed'}),'an error/recovery refreshes the game notice');
});
