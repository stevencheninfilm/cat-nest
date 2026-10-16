import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';
import { createCollectionEvents, sceneInvitationNotice } from '../src/catbook-events.js';
import { memoryHash } from '../src/memory-journal.js';
import { COLLECTION_CATS } from '../src/cat-collection.js';
import { initialState, reduceAction, levelStartXp, levelInfo, FOODS } from '../src/state.js';

const roomId='c'.repeat(32), actor={id:'partner-male',name:'男方'};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(data)});
const snapshot=(state,revision=0,event)=>({roomId,state,revision,...(event?{event}:{})});
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
const seedInvites=(state,count)=>{state.collection.invited=COLLECTION_CATS.slice(0,count).map(cat=>({id:cat.id,at:Date.now(),operationId:`cloud-seed-${cat.id}`,actorId:actor.id}));return state;};
const carouselReady=()=>{const state=seedInvites(initialState(),10);state.xp=levelStartXp(120);state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};state.collection.foods=Object.keys(FOODS);return state;};
const gardenReady=()=>{const base=seedInvites(initialState(),10);base.xp=levelStartXp(120);base.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};base.collection.foods=Object.keys(FOODS);return base;};

test('inviting an already collected cat to another scene waits for confirmation and celebrates once',async t=>{
  const base=gardenReady(),h=harness(t,base);await h.room.start();
  h.room.dispatch({type:'invite-cat',catId:'bandit',sceneId:'garden'});
  assert.equal(h.display().collection.sceneInvited,undefined);assert.deepEqual(h.notifications,[]);
  const saved=h.accepted();h.ack.resolve(response(saved));await flush();h.sources[0].emit('action',saved);
  assert.equal(h.confirmed().collection.invited.length,10);
  assert.equal(h.confirmed().collection.sceneInvited[0].sceneId,'garden');
  assert.deepEqual(h.notifications,[{type:'cat-arrived',id:'bandit',sceneId:'garden'}]);
});

test('a failed cross-scene invitation leaves the cat absent and never shows an arrival',async t=>{
  const base=gardenReady(),h=harness(t,base);await h.room.start();
  h.room.dispatch({type:'invite-cat',catId:'bandit',sceneId:'garden'});
  h.ack.resolve(response({error:{code:'STORAGE_WRITE_FAILED',message:'尚未确认保存'}},503));await flush();
  assert.equal(h.confirmed().collection.sceneInvited,undefined);assert.deepEqual(h.notifications,[]);
  assert.equal(h.confirmed().collection.invited.length,10);
});

test('invitation pagination advances and decreases once only after the cloud confirms, including repeated live receipts',async t=>{
  const h=harness(t,carouselReady());await h.room.start();
  const before=sceneInvitationNotice(h.confirmed(),'garden',{catId:'bolt'});
  h.room.dispatch({type:'invite-cat',catId:'bolt',sceneId:'garden'});
  assert.deepEqual(sceneInvitationNotice(h.confirmed(),'garden',{catId:'bolt'}),before);
  const saved=h.accepted();h.ack.resolve(response(saved));await flush();
  const next=sceneInvitationNotice(h.confirmed(),'garden',{catId:'bolt'});
  assert.equal(next.id,'breezy');assert.equal(next.total,before.total-1);
  h.sources[0].emit('action',saved);h.sources[0].emit('state',saved);
  assert.deepEqual(sceneInvitationNotice(h.confirmed(),'garden',{catId:'bolt'}),next);
});

test('failed cloud invitations keep the same selected cat and remaining count',async t=>{
  const h=harness(t,carouselReady());await h.room.start();
  const before=sceneInvitationNotice(h.confirmed(),'garden',{catId:'bolt'});
  h.room.dispatch({type:'invite-cat',catId:'bolt',sceneId:'garden'});
  h.ack.resolve(response({error:{code:'STORAGE_WRITE_FAILED',message:'尚未确认保存'}},503));await flush();
  assert.deepEqual(sceneInvitationNotice(h.confirmed(),'garden',{catId:'bolt'}),before);
});

function harness(t,base) {
  // Keep unrelated daily random vignettes out of these cloud-confirmation fixtures.
  let operation=0;
  t.mock.method(globalThis.crypto,'randomUUID',()=>{let id;do{id=`cloud-care-operation-${++operation}`;}while(memoryHash(id)%5===0);return id;});
  const ack=deferred(), requests=[], notifications=[], sources=[];
  const events=createCollectionEvents(base);
  let display=base, confirmed=base;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'EventSource');
  class Source {
    listeners=new Map();
    constructor(){sources.push(this);}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    emit(type,data){this.listeners.get(type)?.({data:JSON.stringify(data)});}
    close(){}
  }
  Object.defineProperty(globalThis,'EventSource',{configurable:true,writable:true,value:Source});
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    if(options.method==='POST'){requests.push(JSON.parse(options.body));return ack.promise;}
    return response(snapshot(base));
  });
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const room=createCloudRoom({apiBase:'https://cloud.example.test',roomId,clientId:actor.id,name:actor.name,optimisticReducer:reduceAction,
    onRoom(){},onPresence(){},onStatus(){},onSaveStatus(){},onPending(){},onAction(){},
    onState(next,metadata){
      display=next;confirmed=metadata?.confirmedState||next;
      // The courtyard uses this same confirmed snapshot while the home displays its preview.
      notifications.push(...events.observe(confirmed));
    },
  });
  t.after(()=>{room.destroy();if(descriptor)Object.defineProperty(globalThis,'EventSource',descriptor);else delete globalThis.EventSource;});
  const accepted=()=>{
    const item=requests.at(-1), saved=reduceAction(base,item.action,actor,Date.now(),item.operationId);
    assert.ok(saved);
    return snapshot(saved,1,{operationId:item.operationId,action:item.action,actor});
  };
  return {room,ack,requests,notifications,sources,accepted,display:()=>display,confirmed:()=>confirmed};
}

test('daily feeding waits for confirmed cloud state before unlocking the daily cats',async t=>{
  const base=seedInvites(initialState(),1);base.careLimits.counts.feed=9;base.collection.stats.feed=9;base.collection.achievements.daily.feed=9;
  const h=harness(t,base);await h.room.start();h.room.dispatch({type:'feed',food:'water'});
  assert.equal(h.display().collection.achievements.daily.feed,10);
  assert.equal(h.confirmed().collection.achievements.daily.feed,9);assert.deepEqual(h.notifications,[]);
  const saved=h.accepted();h.ack.resolve(response(saved));await flush();h.sources[0].emit('action',saved);
  assert.deepEqual(h.notifications,[{type:'cat-unlocked',id:'toast'}]);
});

test('a rejected outfit preview never unlocks the dress cat',async t=>{
  const base=initialState(),h=harness(t,base);await h.room.start();
  h.room.dispatch({type:'dress',appearance:{...base.appearance,clothes:1}});
  assert.equal(h.display().collection.achievements.dress,1);assert.equal(h.confirmed().collection.achievements.dress,0);assert.deepEqual(h.notifications,[]);
  h.ack.resolve(response({error:{code:'STORAGE_WRITE_FAILED',message:'尚未确认保存'}},503));await flush();
  assert.equal(h.display().collection.achievements.dress,0);assert.deepEqual(h.notifications,[]);
});

test('delayed feeding does not unlock a cat until the shared cloud save is confirmed',async t=>{
  const base=seedInvites(initialState(),1);base.collection.stats.feed=29;
  const h=harness(t,base);await h.room.start();h.room.dispatch({type:'feed',food:'meal'});
  assert.equal(h.display().collection.stats.feed,30);
  assert.equal(h.confirmed().collection.stats.feed,29);
  assert.deepEqual(h.notifications,[]);
  const saved=h.accepted();h.ack.resolve(response(saved));await flush();
  assert.deepEqual(h.notifications,[{type:'cat-unlocked',id:'bolt'},{type:'cat-unlocked',id:'sunshine'}]);
  h.sources[0].emit('action',saved);
  assert.equal(h.notifications.length,2,'HTTP and live receipts celebrate each achievement once');
});

test('a rejected optimistic care action leaves no unlock notice after rollback',async t=>{
  const base=seedInvites(initialState(),1);base.collection.stats.feed=29;
  const h=harness(t,base);await h.room.start();h.room.dispatch({type:'feed',food:'meal'});
  assert.equal(h.display().collection.stats.feed,30);assert.deepEqual(h.notifications,[]);
  h.ack.resolve(response({error:{code:'CARE_COOLDOWN',message:'请稍后再试'}},409));await flush();
  assert.equal(h.display().collection.stats.feed,29);assert.deepEqual(h.notifications,[]);
});

test('an optimistic level crossing rejected by the cloud never unlocks the growth cat',async t=>{
  let base=seedInvites(initialState(),1);base.xp=levelStartXp(40)-1;
  base=reduceAction(base,{type:'pet'},actor,Date.now(),'cloud-level-pending');
  const h=harness(t,base);await h.room.start();h.room.dispatch({type:'claim-growth',rewardId:'cloud-level-pending'});
  assert.equal(levelInfo(h.display().xp).level,40);assert.equal(levelInfo(h.confirmed().xp).level,39);
  assert.deepEqual(h.notifications,[]);
  h.ack.resolve(response({error:{code:'GROWTH_REWARD_ALREADY_CLAIMED',message:'成长已经领取'}},409));await flush();
  assert.equal(levelInfo(h.display().xp).level,39);assert.deepEqual(h.notifications,[]);
});

test('a scene crossing in the optimistic preview waits for confirmed care, including existing cat receipts',async t=>{
  const base=gardenReady();seedInvites(base,11);base.collection.invited=base.collection.invited.filter(record=>record.id!=='ginger');
  base.collection.stats.play=49;
  const h=harness(t,base);await h.room.start();h.room.dispatch({type:'play'});
  assert.equal(h.display().collection.stats.play,50);assert.equal(h.confirmed().collection.stats.play,49);
  assert.deepEqual(h.notifications,[]);
  h.ack.resolve(response(h.accepted()));await flush();
  assert.deepEqual(h.notifications,[{type:'scene-unlocked',id:'garden'}]);
});

test('a confirmed fifteenth invitation produces one entrance followed by the scene reward',async t=>{
  const base=seedInvites(initialState(),14);base.xp=levelStartXp(120);
  base.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};base.collection.foods=Object.keys(FOODS);
  base.collection.wins={rps:12,memory:12,gomoku:12};
  const h=harness(t,base);await h.room.start();h.room.dispatch({type:'invite-cat',catId:'onyx'});
  assert.equal(h.display().collection.invited.length,14);assert.deepEqual(h.notifications,[]);
  const saved=h.accepted();h.ack.resolve(response(saved));await flush();h.sources[0].emit('action',saved);
  assert.deepEqual(h.notifications,[{type:'cat-arrived',id:'onyx'},{type:'scene-unlocked',id:'western'}]);
});

function twoDiaryCards() {
  const state=initialState();
  state.diary.entries.push({id:'first:feed',kind:'first',occasion:'feed',at:state.updatedAt,catName:'糯米',photo:'hungry'});
  return state;
}

test('a third diary card unlocks No.25 only after cloud confirmation and HTTP/SSE retries never count twice',async t=>{
  const base=twoDiaryCards(),h=harness(t,base);await h.room.start();
  h.room.dispatch({type:'pet'});
  assert.equal(h.confirmed().diary.entries.length,2);assert.deepEqual(h.notifications,[]);
  const saved=h.accepted();h.ack.resolve(response(saved));await flush();h.sources[0].emit('action',saved);
  assert.ok(h.confirmed().diary.entries.some(entry=>entry.id==='first:pet'));
  assert.deepEqual(h.notifications,[{type:'cat-unlocked',id:'porter'}]);
  h.sources[0].emit('state',saved);assert.equal(h.notifications.length,1);
});

test('rejected care does not unlock No.25 or change the two confirmed diary cards',async t=>{
  const base=twoDiaryCards(),h=harness(t,base);await h.room.start();h.room.dispatch({type:'pet'});
  h.ack.resolve(response({error:{code:'CARE_COOLDOWN',message:'请稍后再试'}},409));await flush();
  assert.equal(h.confirmed().diary.entries.length,2);assert.equal(h.display().diary.entries.length,2);
  assert.deepEqual(h.notifications,[]);
});
