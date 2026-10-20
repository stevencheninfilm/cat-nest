import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';
import { initialState, reduceAction } from '../src/state.js';
import { growthTray } from '../src/growth-ui.js';

const ROOM = 'f'.repeat(32), male = { id:'partner-male', name:'男方' }, female = { id:'partner-female', name:'女方' };
const clone = value => structuredClone(value);
const response = (data, status = 200) => ({ ok:status >= 200 && status < 300, status, json:async () => clone(data) });
const snapshot = (state, revision = 0, event) => ({ roomId:ROOM, state, revision, ...(event ? { event } : {}) });
const receipt = (item, state, revision = 1) => snapshot(state, revision, { operationId:item.operationId, action:item.action, actor:{ id:item.clientId, name:item.name } });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; }

function harness(t, handler, pending = []) {
  const requests = [], sources = [], observed = { states:[], actions:[], rollbacks:[], saves:[], pending:[] };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
  class FakeSource {
    listeners = new Map(); closed = false;
    constructor() { sources.push(this); }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    emit(type, data) { if (!this.closed) this.listeners.get(type)?.({ data:JSON.stringify(data) }); }
    close() { this.closed=true; }
  }
  Object.defineProperty(globalThis, 'EventSource', { configurable:true, writable:true, value:FakeSource });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const request = { url, method:options.method || 'GET', body:options.body ? JSON.parse(options.body) : null, signal:options.signal };
    requests.push(request); return handler(request);
  });
  t.mock.timers.enable({ apis:['setTimeout', 'setInterval'] });
  const room = createCloudRoom({ apiBase:'https://cloud.example.test', roomId:ROOM, clientId:male.id, name:male.name, pending,
    optimisticReducer:reduceAction,
    onRoom() {}, onPresence() {}, onStatus() {},
    onState:(state, metadata) => observed.states.push(clone({ state, ...metadata })),
    onAction:(action, actor, metadata) => observed.actions.push(clone({ action, actor, ...metadata })),
    onRollback:(action, actor, metadata) => observed.rollbacks.push(clone({ action, actor, ...metadata })),
    onSaveStatus:status => observed.saves.push(clone(status)),
    onPending:queue => observed.pending.push(clone(queue)),
  });
  t.after(() => { room.destroy(); if (descriptor) Object.defineProperty(globalThis, 'EventSource', descriptor); else delete globalThis.EventSource; });
  return { room, requests, sources, observed, latest:() => observed.states.at(-1).state };
}

test('decoration previews immediately and rebases on the partner’s furniture move while awaiting save',async t=>{
  const base=initialState(),ack=deferred();const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise);
  await h.room.start();h.room.dispatch({type:'nest-palette',palette:'mint'});const item=h.requests.at(-1).body;
  assert.equal(h.latest().nest.palette,'mint');assert.equal(h.observed.states.at(-1).confirmedState.nest.palette,'honey');
  const partnerAction={type:'nest-place',item:'toy',x:-1,z:2,rotation:1},partner=reduceAction(base,partnerAction,female,Date.now(),'partner-nest-move');
  h.sources[0].emit('action',snapshot(partner,1,{operationId:'partner-nest-move',action:partnerAction,actor:female}));
  assert.equal(h.latest().nest.palette,'mint');assert.equal(h.latest().nest.placements.find(p=>p.item==='toy').x,-1);
  const saved=reduceAction(partner,item.action,male,Date.now(),item.operationId);ack.resolve(response(receipt(item,saved,2)));await flush();
  assert.deepEqual(h.latest().nest,saved.nest);assert.equal(h.observed.saves.at(-1).phase,'saved');
});

test('a refused furniture edit restores the confirmed layout instead of claiming it was saved',async t=>{
  const base=initialState(),ack=deferred(),h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise);
  await h.room.start();h.room.dispatch({type:'nest-place',item:'toy',x:-1,z:2,rotation:0});assert.equal(h.latest().nest.placements.find(p=>p.item==='toy').x,-1);
  ack.resolve(response({error:{code:'NEST_ACTION_REJECTED',message:'对方刚刚调整了这个位置'}},409));await flush();
  assert.deepEqual(h.latest().nest,base.nest);assert.equal(h.observed.rollbacks.length,1);assert.equal(h.observed.saves.at(-1).phase,'error');assert.deepEqual(h.observed.pending.at(-1),[]);
});

test('feeding renders and animates before a delayed response while the persisted snapshot remains confirmed', async t => {
  const base = initialState(), ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : ack.promise);
  await h.room.start();
  assert.equal(h.room.dispatch({ type:'feed', food:'meal' }), true);
  const item = h.requests.at(-1).body, preview = h.observed.states.at(-1);
  assert.equal(preview.state.coins, base.coins - 20);
  assert.equal(preview.state.love, base.love + 25);
  assert.equal(preview.state.pendingGrowth[0].id, item.operationId);
  assert.deepEqual(preview.confirmedState, base);
  assert.equal(preview.optimistic, true);
  assert.equal(h.observed.actions[0].optimistic, true, 'the animation starts before resolving the POST');
  assert.equal(h.observed.pending.at(-1)[0].operationId, item.operationId);
  const saved = reduceAction(base, item.action, male, Date.now(), item.operationId);
  ack.resolve(response(receipt(item, saved)));
  await flush();
  assert.deepEqual(h.latest(), saved);
  assert.equal(h.observed.actions.at(-1).previewed, true, 'confirmation does not replay the animation');
  assert.equal(h.observed.actions.filter(action => action.optimistic).length, 1);
  assert.deepEqual(h.observed.pending.at(-1), []);
  assert.equal(h.observed.saves.at(-1).phase, 'saved');
});

test('a refused claim restores the saved bubble, XP and history and never retries the rejection', async t => {
  const base = reduceAction(initialState(), { type:'pet' }, male, Date.now(), 'seed-claim-reward'), ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : ack.promise);
  await h.room.start();
  h.room.dispatch({ type:'claim-growth', rewardId:'seed-claim-reward' });
  assert.equal(h.latest().pendingGrowth.length, 0);
  assert.equal(h.latest().xp, base.xp + base.pendingGrowth[0].amount);
  ack.resolve(response({ error:{ code:'CARE_REJECTED', message:'这次领取未被接受' } }, 409));
  await flush();
  assert.deepEqual(h.latest(), base);
  assert.equal(h.observed.rollbacks.length, 1);
  assert.deepEqual(h.observed.pending.at(-1), []);
  assert.equal(h.observed.saves.at(-1).phase, 'error');
  t.mock.timers.tick(8000); await flush();
  assert.equal(h.requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(h.observed.actions.filter(action => !action.optimistic).length, 0);
});

test('an unknown storage failure keeps the local display and retries the same operation without animating twice', async t => {
  const base = initialState(); let attempts = 0;
  const h = harness(t, req => {
    if (req.method === 'GET') return response(snapshot(base));
    if (++attempts === 1) return response({ error:{ message:'storage unavailable' } }, 503);
    return response(receipt(req.body, reduceAction(base, req.body.action, male, Date.now(), req.body.operationId)));
  });
  await h.room.start(); h.room.dispatch({ type:'pet' });
  const original = clone(h.requests.at(-1).body);
  assert.equal(h.latest().love, base.love + 3);
  await flush();
  assert.equal(h.latest().love,base.love+3);
  assert.deepEqual(h.observed.states.at(-1).confirmedState,base);
  assert.equal(h.observed.rollbacks.length,0);
  assert.equal(h.observed.pending.at(-1)[0].operationId, original.operationId);
  t.mock.timers.tick(8000); await flush();
  assert.deepEqual(h.requests.at(-1).body, original);
  assert.equal(h.latest().love, base.love + 3);
  assert.equal(h.latest().pendingGrowth.length, 1);
  assert.equal(h.observed.actions.filter(action => action.optimistic).length, 1);
  assert.equal(h.observed.actions.at(-1).previewed, true);
});

test('live acknowledgement, duplicate SSE and an older POST response preserve the partner’s newer action', async t => {
  const base = initialState(), ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : ack.promise);
  await h.room.start(); h.room.dispatch({ type:'play' });
  const item = h.requests.at(-1).body;
  const saved = reduceAction(base, item.action, male, Date.now(), item.operationId), own = receipt(item, saved);
  h.sources[0].emit('action', own); h.sources[0].emit('action', own);
  const partnerAction = { type:'feed', food:'water' }, partnerId = 'partner-newer-feed';
  const latest = reduceAction(saved, partnerAction, female, Date.now(), partnerId);
  h.sources[0].emit('action', snapshot(latest, 2, { operationId:partnerId, action:partnerAction, actor:female }));
  ack.resolve(response(own)); await flush();
  assert.deepEqual(h.latest(), latest);
  assert.equal(h.latest().pendingGrowth.length, 2);
  assert.equal(h.observed.actions.filter(event => event.operationId === item.operationId).length, 2, 'one preview and one confirmation, irrespective of duplicate transports');
  assert.deepEqual(h.observed.pending.at(-1), []);
});

test('duplicate HTTP and live claim receipts do not republish the same snapshot or add growth twice', async t => {
  const base = reduceAction(initialState(), { type:'pet' }, male, Date.now(), 'rapid-claim-reward'), ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : ack.promise);
  await h.room.start(); h.room.dispatch({type:'claim-growth',rewardId:'rapid-claim-reward'});
  const item=h.requests.at(-1).body, saved=reduceAction(base,item.action,male,Date.now(),item.operationId), data=receipt(item,saved);
  h.sources[0].emit('action',data);
  const updates=h.observed.states.length;
  for(let i=0;i<100;i++)h.sources[0].emit('action',data);
  assert.equal(h.observed.states.length,updates);
  ack.resolve(response(data));await flush();
  assert.equal(h.observed.states.length,updates,'HTTP acknowledgement drains the queue without redrawing the live receipt');
  assert.deepEqual(h.latest(),saved);assert.equal(h.latest().xp,base.xp+base.pendingGrowth[0].amount);
  assert.deepEqual(h.observed.pending.at(-1),[]);
  assert.equal(h.observed.actions.filter(event=>!event.optimistic).length,1);
});

test('a simultaneous winning partner claim replaces our preview without restoring an already-collected bubble', async t => {
  const base = reduceAction(initialState(), { type:'pet' }, male, Date.now(), 'shared-claim-reward'), ack = deferred();
  const action = { type:'claim-growth', rewardId:'shared-claim-reward' }, winnerId = 'winning-partner-claim';
  const saved = reduceAction(base, action, female, Date.now(), winnerId);
  let reads = 0;
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(++reads === 1 ? base : saved, reads === 1 ? 0 : 1)) : ack.promise);
  await h.room.start(); h.room.dispatch(action);
  h.sources[0].emit('action', snapshot(saved, 1, { operationId:winnerId, action, actor:female }));
  assert.deepEqual(h.latest(), saved);
  assert.equal(h.observed.rollbacks[0].reason, 'conflict');
  ack.resolve(response({ error:{ code:'REWARD_ALREADY_CLAIMED', message:'对方已经收下这颗气泡' } }, 409));
  await flush();
  assert.deepEqual(h.latest(), saved);
  assert.equal(h.latest().pendingGrowth.length, 0);
  h.sources[0].emit('state', snapshot(base, 0));
  assert.deepEqual(h.latest(), saved, 'late snapshots cannot undo the winner');
});

test('a confirmed live receipt settles a lost HTTP response without rolling back or writing twice', async t => {
  const base = initialState(), ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : ack.promise);
  await h.room.start(); h.room.dispatch({ type:'sleep' });
  const item = h.requests.at(-1).body, saved = reduceAction(base, item.action, male, Date.now(), item.operationId);
  h.sources[0].emit('action', receipt(item, saved));
  ack.reject(new TypeError('HTTP response lost')); await flush();
  assert.deepEqual(h.latest(), saved);
  assert.equal(h.observed.rollbacks.length, 0);
  assert.deepEqual(h.observed.pending.at(-1), []);
  assert.equal(h.observed.saves.at(-1).phase, 'saved');
  t.mock.timers.tick(8000); await flush();
  assert.equal(h.requests.filter(request => request.method === 'POST').length, 1);
});

test('reloaded pending work is verified using its original ID without replaying an unconfirmed preview', async t => {
  const base = initialState(), item = { operationId:'restored-care-id', clientId:male.id, name:male.name, action:{ type:'pet' } };
  const saved = reduceAction(base, item.action, male, Date.now(), item.operationId), ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(saved, 1)) : ack.promise, [item]);
  await h.room.start();
  assert.deepEqual(h.latest(), saved);
  assert.equal(h.observed.actions.length, 0);
  assert.deepEqual(h.requests.at(-1).body, item);
  ack.resolve(response(receipt(item, saved))); await flush();
  assert.equal(h.latest().pendingGrowth.length, 1);
  assert.equal(h.latest().love, saved.love);
  assert.equal(h.observed.actions.at(-1).previewed, false);
});

test('a stalled action keeps its local feedback after fifteen seconds and retains the pending ID for verification', async t => {
  const base = initialState();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : new Promise((resolve, reject) => req.signal.addEventListener('abort', () => reject(new Error('request timed out')))));
  await h.room.start(); h.room.dispatch({ type:'pet' });
  assert.equal(h.latest().love, base.love + 3);
  t.mock.timers.tick(15000); await flush();
  assert.equal(h.latest().love,base.love+3);
  assert.deepEqual(h.observed.states.at(-1).confirmedState,base);
  assert.equal(h.observed.pending.at(-1).length, 1);
  assert.equal(h.observed.rollbacks.length, 0);
  assert.equal(h.observed.saves.at(-1).phase, 'error');
});

test('distinct bubbles respond immediately in one queue and each confirms once without counting the next preview as saved XP', async t => {
  let base = reduceAction(initialState(), { type:'pet' }, male, Date.now(), 'queued-pet-reward');
  base = reduceAction(base, { type:'feed', food:'water' }, female, Date.now(), 'queued-feed-reward');
  const first = deferred(), second = deferred(); let posts = 0;
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : [first, second][posts++].promise);
  await h.room.start();
  h.room.dispatch({ type:'claim-growth', rewardId:'queued-pet-reward' });
  const firstItem = clone(h.requests.at(-1).body);
  assert.equal(h.room.dispatch({ type:'claim-growth', rewardId:'queued-pet-reward' }), false, 'the same unresolved bubble cannot be resubmitted');
  h.room.dispatch({ type:'claim-growth', rewardId:'queued-feed-reward' });
  assert.equal(h.latest().pendingGrowth.length, 0);
  assert.equal(h.observed.actions.filter(event => event.optimistic).length, 2);
  assert.equal(posts, 1, 'requests drain serially while both displays respond immediately');
  const savedFirst = reduceAction(base, firstItem.action, male, Date.now(), firstItem.operationId);
  first.resolve(response(receipt(firstItem, savedFirst))); await flush();
  assert.equal(h.observed.states.at(-1).confirmedState.xp, savedFirst.xp);
  assert.ok(h.latest().xp > savedFirst.xp, 'the second display is still a preview');
  assert.equal(h.observed.actions.find(event => !event.optimistic).confirmedXp, savedFirst.xp);
  const secondItem = h.requests.at(-1).body;
  const savedSecond = reduceAction(savedFirst, secondItem.action, male, Date.now(), secondItem.operationId);
  second.resolve(response(receipt(secondItem, savedSecond, 2))); await flush();
  assert.deepEqual(h.latest(), savedSecond);
  assert.deepEqual(h.observed.pending.at(-1), []);
  assert.equal(h.observed.actions.filter(event => !event.optimistic).length, 2);
});

test('a malformed success response cannot commit the temporary display or erase the pending request', async t => {
  const base = initialState();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(base)) : response({ state:null, revision:1 }));
  await h.room.start(); h.room.dispatch({ type:'pet' }); await flush();
  assert.deepEqual(h.observed.states.at(-1).confirmedState,base);
  assert.equal(h.latest().love,base.love+3);
  assert.equal(h.observed.pending.at(-1).length, 1);
  assert.equal(h.observed.saves.at(-1).phase, 'error');
  assert.equal(h.observed.actions.filter(event => !event.optimistic).length, 0);
});

test('an unresolved bubble is disabled individually while another saved bubble remains collectable', () => {
  const html = growthTray([
    { id:'pending-bubble', kind:'pet', amount:3, actor:'男方' },
    { id:'other-bubble', kind:'pet', amount:3, actor:'女方' },
  ], { pendingRewardIds:new Set(['pending-bubble']) });
  const buttons = [...html.matchAll(/<button[^>]*data-growth-reward="([^"]+)"[^>]*>/g)];
  assert.match(buttons.find(match => match[1] === 'pending-bubble')[0], /disabled/);
  assert.doesNotMatch(buttons.find(match => match[1] === 'other-bubble')[0], /disabled/);
});

const restaurantIncome=(index,amount=9.1)=>({id:`restaurant-income-${index}`,kind:'restaurant-collect',recipeId:'coffee',orderId:`table-${index+1}`,amount,actorId:male.id,actor:male.name,at:Date.now()});
const claimIncome=ids=>({type:'claim-restaurant-growth',rewardIds:ids});

test('restaurant income reacts immediately offline, permits care, and retries the same saved manifest silently',async t=>{
  const rewards=[restaurantIncome(0,8.1),restaurantIncome(1,9.2)],base={...initialState(),pendingGrowth:rewards};let online=false,saved=base,revision=0;
  const h=harness(t,req=>{if(req.method==='GET')return response(snapshot(saved,revision));if(!online)throw new TypeError('offline');saved=reduceAction(saved,req.body.action,male,Date.now(),req.body.operationId);return response(receipt(req.body,saved,++revision));});
  await h.room.start();const action=claimIncome(rewards.map(r=>r.id));assert.equal(h.room.dispatch(action),true);
  assert.equal(h.latest().xp,base.xp+17.3);assert.deepEqual(h.latest().pendingGrowth,[]);assert.equal(h.observed.actions[0].optimistic,true);
  assert.equal(h.room.dispatch({type:'pet'}),true,'saving income does not block unrelated care');
  await flush();const original=clone(h.observed.pending.at(-1));assert.equal(original.length,2);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.saves.at(-1).phase,'queued');
  online=true;h.room.retryPending();await flush();assert.deepEqual(h.observed.pending.at(-1),[]);assert.equal(h.latest().xp,base.xp+17.3);assert.equal(h.latest().pendingGrowth.length,1);
  assert.deepEqual(h.requests.filter(r=>r.method==='POST').slice(0,2).map(r=>r.body.operationId),[original[0].operationId,original[0].operationId]);assert.equal(h.observed.actions.filter(a=>a.action.type===action.type&&a.optimistic).length,1);
});

test('restaurant claim survives timeout and refresh using original IDs without replaying feedback',async t=>{
  const reward=restaurantIncome(0),base={...initialState(),pendingGrowth:[reward]},ack=deferred();
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise);
  await h.room.start();h.room.dispatch(claimIncome([reward.id]));const pending=clone(h.observed.pending.at(-1));
  h.room.destroy();t.mock.timers.reset();const reloaded=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise,pending);await reloaded.room.start();
  assert.equal(reloaded.latest().xp,base.xp+reward.amount);assert.deepEqual(reloaded.latest().pendingGrowth,[]);assert.equal(reloaded.observed.actions.length,0);
  const item=reloaded.requests.at(-1).body;assert.equal(item.operationId,pending[0].operationId);ack.resolve(response(receipt(item,reduceAction(base,item.action,male,Date.now(),item.operationId))));await flush();
  assert.equal(reloaded.observed.actions.at(-1).previewed,true);assert.deepEqual(reloaded.observed.pending.at(-1),[]);
});

test('explicit restaurant claim refusal restores XP and receipts and stops retrying',async t=>{
  const reward=restaurantIncome(0),base={...initialState(),pendingGrowth:[reward]},ack=deferred();
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise);await h.room.start();h.room.dispatch(claimIncome([reward.id]));
  assert.equal(h.latest().xp,base.xp+reward.amount);ack.resolve(response({error:{code:'GROWTH_REWARD_UNAVAILABLE',message:'领取记录不匹配'}},409));await flush();
  assert.deepEqual(h.latest(),base);assert.equal(h.observed.rollbacks.length,1);assert.deepEqual(h.observed.pending.at(-1),[]);t.mock.timers.tick(8000);await flush();assert.equal(h.requests.filter(r=>r.method==='POST').length,1);
});

test('another caregiver collecting part of a queued restaurant batch rebases without double XP or rollback',async t=>{
  const rewards=[restaurantIncome(0),restaurantIncome(1)],base={...initialState(),pendingGrowth:rewards},ack=deferred();
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise);await h.room.start();h.room.dispatch(claimIncome(rewards.map(r=>r.id)));const item=h.requests.at(-1).body;
  const partnerAction=claimIncome([rewards[0].id]),partner=reduceAction(base,partnerAction,female,Date.now(),'partner-income-claim');h.sources[0].emit('action',snapshot(partner,1,{operationId:'partner-income-claim',action:partnerAction,actor:female}));
  assert.equal(h.latest().xp,base.xp+18.2);assert.equal(h.observed.rollbacks.length,0);
  const final=reduceAction(partner,item.action,male,Date.now(),item.operationId);ack.resolve(response(receipt(item,final,2)));await flush();assert.equal(h.latest().xp,base.xp+18.2);assert.deepEqual(h.observed.pending.at(-1),[]);
});

test('a restaurant income timeout preserves its immediate result and silently schedules a retry',async t=>{
  const reward=restaurantIncome(0),base={...initialState(),pendingGrowth:[reward]};
  const h=harness(t,req=>req.method==='GET'?response(snapshot(base)):new Promise((resolve,reject)=>req.signal.addEventListener('abort',()=>reject(new Error('timed out')))));
  await h.room.start();h.room.dispatch(claimIncome([reward.id]));const queued=clone(h.observed.pending.at(-1));t.mock.timers.tick(15000);await flush();
  assert.equal(h.latest().xp,base.xp+9.1);assert.deepEqual(h.observed.pending.at(-1),queued);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.saves.at(-1).phase,'queued');
  t.mock.timers.tick(8000);await flush();assert.equal(h.requests.filter(r=>r.method==='POST').length,2);assert.deepEqual(h.requests.filter(r=>r.method==='POST').map(r=>r.body),[queued[0],queued[0]]);
});

test('guest condition envelope metadata is rehydrated before optimistic care and survives its confirmation',async t=>{
  const base=initialState(),conditions=['recipe:coffee','decoration:cream-library'],ack=deferred(),envelope=(state,revision=0,event)=>({...snapshot(state,revision,event),restaurantGuestConditions:conditions});
  const h=harness(t,req=>req.method==='GET'?response(envelope(base)):ack.promise);await h.room.start();
  assert.deepEqual(h.latest().restaurant.completedGuestConditions,conditions);assert.equal(Object.hasOwn(base.restaurant,'completedGuestConditions'),false);
  h.room.dispatch({type:'pet'});const item=h.requests.at(-1).body;assert.deepEqual(h.latest().restaurant.completedGuestConditions,conditions);
  const saved=reduceAction(h.observed.states.at(-1).confirmedState,item.action,male,Date.now(),item.operationId);delete saved.restaurant.completedGuestConditions;
  ack.resolve(response(envelope(saved,1,{operationId:item.operationId,action:item.action,actor:male})));await flush();assert.deepEqual(h.latest().restaurant.completedGuestConditions,conditions);assert.deepEqual(h.observed.pending.at(-1),[]);
});

test('malformed guest achievement metadata cannot confirm or discard a queued interaction',async t=>{
  const base=initialState(),ack=deferred(),h=harness(t,req=>req.method==='GET'?response(snapshot(base)):ack.promise);await h.room.start();h.room.dispatch({type:'pet'});const item=h.requests.at(-1).body;
  ack.resolve(response({...receipt(item,reduceAction(base,item.action,male,Date.now(),item.operationId)),restaurantGuestConditions:['forged-condition']}));await flush();
  assert.equal(h.observed.pending.at(-1).length,1);assert.equal(h.observed.pending.at(-1)[0].operationId,item.operationId);assert.equal(h.observed.rollbacks.length,0);assert.equal(h.observed.saves.at(-1).phase,'error');
});
