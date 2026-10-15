import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';
import { COUPLE_ROLES, normalizeCoupleRole, getCoupleProfile } from '../src/couple-profile.js';

const HOME = '0aed6937627c924a7497025ebd18fe5d';
const clone = value => structuredClone(value);
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => clone(data) });
const saved = (revision = 19, event) => ({ roomId: HOME, revision, state: { name: '原来的糯米', love: 145, history: [{ actor: '旧猫友', text: '温柔地摸了摸小猫', at: 10 }] }, ...(event ? { event } : {}) });
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

function harness(t, handler, options = {}) {
  const requests = [], sources = [], rooms = [];
  const observed = { states: [], actions: [], statuses: [], saves: [], pending: [], presence: [] };
  const clients = [];
  const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
  class FakeEventSource {
    listeners = new Map();
    constructor(url) { this.url = url; sources.push(this); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type, value) { if (!this.closed) this.listeners.get(type)?.({ data: JSON.stringify(value) }); }
    close() { this.closed = true; }
  }
  Object.defineProperty(globalThis, 'EventSource', { configurable: true, writable: true, value: FakeEventSource });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const request = { url, method: options.method || 'GET', headers:options.headers, body: options.body ? JSON.parse(options.body) : undefined };
    requests.push(request);
    return handler(request);
  });
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  function create(overrides = {}) {
    const client = createCloudRoom({
      apiBase: 'https://cloud.example.test', roomId: 'b'.repeat(32), clientId: 'random-browser-id', name: '随便的昵称',
      coupleRole: 'male', initialState: { love: 0 },
      onRoom: value => rooms.push(value),
      onState: value => observed.states.push(clone(value)),
      onAction: (action, actor) => observed.actions.push(clone({ action, actor })),
      onPresence: value => observed.presence.push(clone(value)),
      onStatus: value => observed.statuses.push(clone(value)),
      onSaveStatus: value => observed.saves.push(clone(value)),
      onPending: value => observed.pending.push(clone(value)),
      ...options, ...overrides,
    });
    clients.push(client);
    return client;
  }
  t.after(() => {
    clients.forEach(client => client.destroy());
    if (originalEventSource) Object.defineProperty(globalThis, 'EventSource', originalEventSource);
    else delete globalThis.EventSource;
  });
  return { create, requests, sources, rooms, observed };
}

test('couple profiles use two immutable identities and reject every other role', () => {
  assert.deepEqual(COUPLE_ROLES, [
    { id: 'male', name: '男方', clientId: 'partner-male' },
    { id: 'female', name: '女方', clientId: 'partner-female' },
  ]);
  for (const role of COUPLE_ROLES) {
    assert.equal(normalizeCoupleRole(role.id), role.id);
    assert.equal(getCoupleProfile(role.id), role);
    assert.equal(Object.isFrozen(role), true);
  }
  for (const role of [null, undefined, 'Male', '', 'partner-male', {}, 1]) {
    assert.equal(normalizeCoupleRole(role), null);
    assert.equal(getCoupleProfile(role), null);
  }
});

test('different browsers and both selected roles read the same existing save with stable actor IDs', async t => {
  const h = harness(t, request => {
    if (request.method === 'GET') {
      assert.equal(request.url, 'https://cloud.example.test/api/couple/home');
      return response(saved());
    }
    return response(saved(20, { operationId: request.body.operationId, action: request.body.action, actor: { id: request.body.clientId, name: request.body.name } }));
  });
  for (const [role, randomId] of [['male', 'first-browser'], ['male', 'another-browser'], ['female', 'girlfriend-browser']]) {
    const client = h.create({ coupleRole: role, clientId: randomId, roomId: null });
    await client.start();
    const profile = getCoupleProfile(role);
    assert.equal(h.sources.at(-1).url, `https://cloud.example.test/api/rooms/${HOME}/events?clientId=${profile.clientId}&name=${encodeURIComponent(profile.name)}`);
    assert.equal(client.dispatch({ type: 'pet' }), true);
    await flush();
    assert.equal(h.requests.at(-1).body.clientId, profile.clientId);
    assert.equal(h.requests.at(-1).body.name, profile.name);
    client.destroy();
  }
  assert.deepEqual(h.rooms, [HOME, HOME, HOME]);
  assert.ok(h.observed.states.every(state => state.love === 145));
  assert.ok(h.requests.every(request => request.method !== 'POST' || request.url.endsWith('/actions')), 'no browser creates or seeds a replacement home');
});

test('invalid role fails before contacting the server and cannot dispatch', async t => {
  const h = harness(t, () => { throw new Error('must never fetch'); });
  for (const role of [undefined, null, '', 'guest', 'Male']) {
    const client = h.create({ coupleRole: role });
    await client.start();
    assert.equal(client.dispatch({ type: 'pet' }), false);
  }
  assert.equal(h.requests.length, 0);
  assert.equal(h.sources.length, 0);
  assert.equal(h.observed.statuses.at(-1).phase, 'error');
  assert.equal(h.observed.saves.at(-1).phase, 'error');
  assert.deepEqual(h.rooms, []);
});

test('missing or unavailable common save is not recreated and preserves pending work', async t => {
  const pending = [{ operationId: 'waiting-male', clientId: 'partner-male', name: '男方', action: { type: 'pet' } }];
  const h = harness(t, request => {
    assert.equal(request.method, 'GET');
    return response({ error: { message: '没有找到共同存档' } }, 404);
  }, { pending });
  const client = h.create();
  await client.start();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.observed.pending, [], 'no pending operations are dropped or relabeled on a read failure');
  assert.deepEqual(h.observed.states, []);
  assert.deepEqual(h.rooms, []);
  assert.equal(h.sources.length, 0);
  assert.equal(h.observed.saves.at(-1).phase, 'error');
});

test('a malformed home response cannot report a successful load or open a new room', async t => {
  const h = harness(t, () => response({ roomId: HOME, state: null, revision: 4 }));
  await h.create().start();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.rooms, []);
  assert.deepEqual(h.observed.states, []);
  assert.equal(h.sources.length, 0);
  assert.equal(h.observed.saves.at(-1).phase, 'error');
});

test('canonical role name cannot be changed and committed live actions animate once', async t => {
  let resolve;
  const ack = new Promise(done => { resolve = done; });
  const h = harness(t, request => request.method === 'GET' ? response(saved()) : ack);
  const client = h.create({ coupleRole: 'female' });
  await client.start();
  client.updateName('乱填的昵称');
  assert.equal(h.sources.length, 1, 'changing a name cannot replace the canonical profile or reconnect');
  client.dispatch({ type: 'feed', food: 'chicken' });
  const request = h.requests.at(-1);
  assert.equal(request.body.clientId, 'partner-female');
  assert.equal(request.body.name, '女方');
  const data = saved(20, { operationId: request.body.operationId, action: request.body.action, actor: { id: 'partner-female', name: '女方' } });
  h.sources[0].emit('action', data);
  h.sources[0].emit('action', data);
  assert.equal(h.observed.actions.length, 1);
  assert.equal(h.observed.pending.at(-1).length, 1);
  resolve(response(data));
  await flush();
  assert.equal(h.observed.actions.length, 1);
  assert.deepEqual(h.observed.pending.at(-1), []);
  h.sources[0].emit('presence', [{ id: 'partner-male', name: '男方' }, { id: 'partner-female', name: '女方' }]);
  assert.deepEqual(h.observed.presence.at(-1).map(member => member.name), ['男方', '女方']);
});

test('a named couple home ignores other cached room IDs and reconnects both roles to its fixed save',async t=>{
  const id='6858d44c3a9ce3b77ea7c5334b4acd02';
  const h=harness(t,request=>{
    assert.equal(request.url,`https://cloud.example.test/api/rooms/${id}`);
    assert.equal(request.method,'GET');
    return response({...saved(0),roomId:id,state:{coins:1200,xp:0,love:0,history:[]}});
  });
  for(const coupleRole of ['male','female','male']) {
    const client=h.create({coupleRole,homeRoomId:id,roomId:HOME});await client.start();
    assert.equal(h.rooms.at(-1),id);
    assert.match(h.sources.at(-1).url,new RegExp(`/api/rooms/${id}/events`));
    assert.equal(h.observed.states.at(-1).coins,1200);client.destroy();
  }
  assert.ok(h.requests.every(request=>request.method==='GET'));
});

test('a named home never falls back to the original home or creates a save on a missing or mismatched response',async t=>{
  const id='6858d44c3a9ce3b77ea7c5334b4acd02';
  let data;const h=harness(t,()=>data);
  for(const result of [response({error:{message:'存档暂不可用'}},404),response(saved())]) {
    data=result;const before=h.requests.length;const client=h.create({homeRoomId:id});await client.start();
    assert.equal(h.observed.statuses.at(-1).phase,'error');assert.equal(h.rooms.length,0);
    assert.equal(h.sources.length,0);assert.equal(client.dispatch({type:'pet'}),false);
    assert.equal(h.requests.length,before+1);assert.equal(h.requests.at(-1).url,`https://cloud.example.test/api/rooms/${id}`);
    client.destroy();
  }
});

test('invalid named home configuration fails before any network request',async t=>{
  const h=harness(t,()=>{throw new Error('must not fetch');});
  for(const homeRoomId of ['',null,'../rooms','0'.repeat(31)]) {
    const client=h.create({homeRoomId});await client.start();
    assert.equal(h.observed.statuses.at(-1).phase,'error');assert.equal(h.requests.length,0);
    client.destroy();
  }
});


test('private sessions authenticate reads and writes; live streams get a scoped ticket without exposing the session in URLs',async t=>{
  const h=harness(t,request=>{
    assert.equal(request.headers.Authorization,'Bearer test-session');
    if(request.url.endsWith('/stream-ticket')) return response({ticket:'one-use-ticket'});
    return response(saved(20,request.body?.action ? {operationId:request.body.operationId,action:request.body.action,actor:{id:'partner-male',name:'男方'}}:undefined));
  },{accessToken:'test-session'});
  const client=h.create();await client.start();await flush();
  assert.match(h.sources[0].url,/ticket=one-use-ticket$/);
  assert.ok(!h.sources[0].url.includes('test-session'));
  assert.equal(client.dispatch({type:'pet'}),true);await flush();
  assert.equal(h.observed.pending.at(-1).length,0);
});

test('expired private access preserves pending actions for unlocking again',async t=>{
  let expired=0;
  const h=harness(t,request=>request.url.endsWith('/actions') ? response({error:{code:'ACCESS_REQUIRED',message:'重新解锁'}},401) : request.url.endsWith('/stream-ticket') ? response({ticket:'ticket'}) : response(saved()),{accessToken:'old-session',onAccessExpired(){expired++;}});
  const client=h.create();await client.start();await flush();
  client.dispatch({type:'pet'});await flush();
  assert.equal(expired,1);assert.equal(h.observed.pending.at(-1).length,1);
  assert.equal(client.dispatch({type:'play'}),false);
});
