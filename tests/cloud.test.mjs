import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';

const ROOM = 'a'.repeat(32);
const OTHER_ROOM = 'b'.repeat(32);
const clone = value => structuredClone(value);
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => clone(data) });
const snapshot = (revision = 0, count = 0, event) => ({ roomId: ROOM, revision, state: { name: '糯米', count }, ...(event ? { event } : {}) });
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(t, handler, options = {}) {
  const requests = [], sources = [], timeline = [];
  const observed = { rooms: [], states: [], actions: [], presence: [], statuses: [], saves: [], pending: [] };
  const persisted = { room: Object.hasOwn(options, 'roomId') ? options.roomId : ROOM, pending: clone(options.pending || []) };
  const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
  class FakeEventSource {
    listeners = new Map();
    closed = false;
    constructor(url) { this.url = url; sources.push(this); }
    addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) || []), listener]); }
    emit(type, data) {
      if (this.closed) return;
      for (const listener of this.listeners.get(type) || []) listener({ data: JSON.stringify(data) });
    }
    open() { if (!this.closed) this.onopen?.(); }
    fail() { if (!this.closed) this.onerror?.(); }
    close() { this.closed = true; }
  }
  Object.defineProperty(globalThis, 'EventSource', { configurable: true, writable: true, value: FakeEventSource });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const req = { url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : undefined, options };
    requests.push(req);
    return handler(req, requests.length);
  });
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  function record(type, value) { observed[type].push(clone(value)); timeline.push(type); }
  const room = createCloudRoom({
    apiBase: 'https://cloud.example.test/', roomId: persisted.room, clientId: 'qa-client', name: '小雨',
    initialState: { name: '本机小猫', count: 99 }, pending: persisted.pending,
    onRoom: value => { persisted.room = value; record('rooms', value); },
    onState: value => record('states', value),
    onAction: (action, actor) => record('actions', { action, actor }),
    onPresence: value => record('presence', value),
    onStatus: value => record('statuses', value),
    onSaveStatus: value => record('saves', value),
    onPending: value => { persisted.pending = clone(value); record('pending', value); },
  });
  t.after(() => {
    room.destroy();
    if (originalEventSource) Object.defineProperty(globalThis, 'EventSource', originalEventSource);
    else delete globalThis.EventSource;
  });
  return { room, requests, sources, observed, persisted, timeline };
}

function committed(req, revision = 1, count = 1) {
  return snapshot(revision, count, { operationId: req.body.operationId, action: req.body.action, actor: { id: 'qa-client', name: '小雨' } });
}

test('cloud reload restores the persisted room and authoritative state without creating a new room', async t => {
  const h = harness(t, req => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, `https://cloud.example.test/api/rooms/${ROOM}`);
    return response(snapshot(8, 12));
  });
  assert.equal(h.room.dispatch({ type: 'pet' }), false, 'no mutations before the first cloud snapshot');
  await h.room.start();
  assert.deepEqual(h.observed.rooms, [ROOM]);
  assert.deepEqual(h.observed.states, [{ name: '糯米', count: 12 }]);
  assert.equal(h.persisted.room, ROOM);
  assert.equal(h.requests.length, 1);
  assert.equal(h.sources.length, 1);
  assert.equal(h.sources[0].url, `https://cloud.example.test/api/rooms/${ROOM}/events?clientId=qa-client&name=${encodeURIComponent('小雨')}`);
  assert.equal(h.observed.saves.at(-1).phase, 'saved');
  h.sources[0].open();
  assert.equal(h.observed.statuses.at(-1).phase, 'online');
});

test('new room creation persists the server-issued room key', async t => {
  const h = harness(t, req => {
    assert.equal(req.url, 'https://cloud.example.test/api/rooms');
    assert.equal(req.method, 'POST');
    assert.deepEqual(req.body, { name: '小雨', initialState: { name: '本机小猫', count: 99 } });
    return response({ ...snapshot(0, 99), roomId: OTHER_ROOM });
  }, { roomId: null });
  await h.room.start();
  assert.equal(h.persisted.room, OTHER_ROOM);
  assert.deepEqual(h.observed.rooms, [OTHER_ROOM]);
  assert.match(h.sources[0].url, new RegExp(`/api/rooms/${OTHER_ROOM}/events`));
});

test('dispatch persists its pending operation but applies state and animation only after POST acknowledgement', async t => {
  const ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot()) : ack.promise);
  await h.room.start();
  const initialStates = h.observed.states.length;
  assert.equal(h.room.dispatch({ type: 'feed', food: 'meal' }), true);
  assert.equal(h.requests.length, 2);
  const req = h.requests.at(-1);
  assert.equal(req.method, 'POST');
  assert.equal(req.url, `https://cloud.example.test/api/rooms/${ROOM}/actions`);
  assert.equal(typeof req.body.operationId, 'string');
  assert.deepEqual(h.persisted.pending, [req.body]);
  assert.equal(h.observed.saves.at(-1).phase, 'saving');
  assert.equal(h.observed.states.length, initialStates);
  assert.equal(h.observed.actions.length, 0);
  h.timeline.push('ack');
  ack.resolve(response(committed(req)));
  await flush();
  assert.deepEqual(h.observed.states.at(-1), { name: '糯米', count: 1 });
  assert.deepEqual(h.observed.actions, [{ action: { type: 'feed', food: 'meal' }, actor: { id: 'qa-client', name: '小雨' } }]);
  assert.deepEqual(h.persisted.pending, []);
  assert.equal(h.observed.saves.at(-1).phase, 'saved');
  const ackIndex = h.timeline.indexOf('ack');
  assert.ok(h.timeline.lastIndexOf('states') > ackIndex);
  assert.ok(h.timeline.lastIndexOf('actions') > ackIndex);
  assert.ok(h.timeline.lastIndexOf('pending') > h.timeline.lastIndexOf('actions'), 'pending is removed only after the acknowledged result has been applied');
});

test('restored pending operations retain their operation ID until acknowledged and drain in order', async t => {
  const restored = [
    { operationId: 'pending-one', clientId: 'qa-client', name: '小雨', action: { type: 'pet' } },
    { operationId: 'pending-two', clientId: 'qa-client', name: '小雨', action: { type: 'play' } },
  ];
  const acknowledgements = [deferred(), deferred()];
  let actionRequests = 0;
  const h = harness(t, req => req.method === 'GET' ? response(snapshot(4, 4)) : acknowledgements[actionRequests++].promise, { pending: restored });
  await h.room.start();
  assert.deepEqual(h.persisted.pending, restored);
  assert.deepEqual(h.requests.at(-1).body, restored[0]);
  assert.equal(actionRequests, 1);
  acknowledgements[0].resolve(response(committed(h.requests.at(-1), 5, 5)));
  await flush();
  assert.deepEqual(h.persisted.pending, [restored[1]]);
  assert.deepEqual(h.requests.at(-1).body, restored[1]);
  assert.equal(actionRequests, 2);
  assert.equal(h.observed.saves.at(-1).phase, 'saving');
  acknowledgements[1].resolve(response(committed(h.requests.at(-1), 6, 6)));
  await flush();
  assert.deepEqual(h.persisted.pending, []);
  assert.equal(h.observed.states.at(-1).count, 6);
  assert.equal(h.observed.actions.length, 2);
  assert.equal(h.observed.saves.at(-1).phase, 'saved');
});

test('duplicate SSE and POST copies animate a committed operation once without removing pending before POST ack', async t => {
  const ack = deferred();
  const h = harness(t, req => req.method === 'GET' ? response(snapshot()) : ack.promise);
  await h.room.start();
  h.room.dispatch({ type: 'pet' });
  const req = h.requests.at(-1);
  const data = committed(req);
  h.sources[0].emit('action', data);
  h.sources[0].emit('state', data);
  assert.equal(h.observed.actions.length, 1);
  assert.equal(h.observed.states.at(-1).count, 1);
  assert.equal(h.persisted.pending.length, 1, 'SSE broadcast does not stand in for the POST acknowledgement');
  ack.resolve(response(data));
  await flush();
  assert.equal(h.observed.actions.length, 1);
  assert.deepEqual(h.persisted.pending, []);
  h.sources[0].emit('action', data);
  h.sources[0].emit('state', snapshot(0, 0));
  assert.equal(h.observed.actions.length, 1);
  assert.equal(h.observed.states.at(-1).count, 1, 'older polling/SSE snapshots do not roll back committed state');
});

test('temporary API failure retains the exact pending operation, reports an error, and retries after eight seconds', async t => {
  let attempts = 0;
  const h = harness(t, req => {
    if (req.method === 'GET') return response(snapshot());
    attempts += 1;
    return attempts === 1 ? response({ error: { message: 'GitHub 暂时不可用' } }, 503) : response(committed(req));
  });
  await h.room.start();
  h.room.dispatch({ type: 'sleep' });
  const pending = clone(h.persisted.pending);
  await flush();
  assert.deepEqual(h.persisted.pending, pending);
  assert.equal(h.observed.pending.length, 1, 'failure must not persist an empty queue');
  assert.equal(h.observed.actions.length, 0);
  assert.equal(h.observed.states.length, 1);
  assert.equal(h.observed.saves.at(-1).phase, 'error');
  assert.match(h.observed.saves.at(-1).message, /保存失败.*自动重试/);
  t.mock.timers.tick(7999);
  await flush();
  assert.equal(attempts, 1);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(attempts, 2);
  assert.deepEqual(h.requests.at(-1).body, pending[0], 'retry uses the original idempotency key');
  assert.deepEqual(h.persisted.pending, []);
  assert.equal(h.observed.actions.length, 1);
  assert.equal(h.observed.saves.at(-1).phase, 'saved');
});

test('failure to load cloud data preserves stored pending work and never reports a successful save', async t => {
  const pending = [{ operationId: 'saved-on-device', clientId: 'qa-client', name: '小雨', action: { type: 'pet' } }];
  const h = harness(t, () => { throw new TypeError('network unavailable'); }, { pending });
  await h.room.start();
  assert.deepEqual(h.persisted.pending, pending);
  assert.equal(h.persisted.room, ROOM);
  assert.deepEqual(h.observed.rooms, []);
  assert.deepEqual(h.observed.states, []);
  assert.deepEqual(h.observed.actions, []);
  assert.equal(h.observed.statuses.at(-1).phase, 'error');
  assert.equal(h.observed.saves.at(-1).phase, 'error');
  assert.match(h.observed.saves.at(-1).message, /存档没有被清除/);
  assert.equal(h.observed.saves.some(value => value.phase === 'saved'), false);
  assert.equal(h.room.dispatch({ type: 'pet' }), false);
  assert.equal(h.sources.length, 0);
});

test('destroy closes live events and cancels polling and queued retries', async t => {
  const h = harness(t, req => req.method === 'GET' ? response(snapshot()) : response({ error: { message: 'retry later' } }, 503));
  await h.room.start();
  h.sources[0].emit('presence', [{ id: 'qa-client', name: '小雨' }]);
  assert.equal(h.observed.presence.length, 1);
  h.room.dispatch({ type: 'pet' });
  await flush();
  assert.equal(h.observed.saves.at(-1).phase, 'error');
  h.room.destroy();
  assert.equal(h.sources[0].closed, true);
  const requestCount = h.requests.length;
  t.mock.timers.tick(60000);
  await flush();
  assert.equal(h.requests.length, requestCount);
  assert.equal(h.room.dispatch({ type: 'pet' }), false);
  assert.equal(h.persisted.pending.length, 1, 'leaving the page does not discard unsaved work');
});
