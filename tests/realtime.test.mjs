import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomSync, validateAction } from '../src/realtime.js';

class Emitter {
  listeners = new Map();
  on(event, callback) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), callback]);
    return this;
  }
  emit(event, ...args) { for (const listener of this.listeners.get(event) || []) listener(...args); }
}

class FakeConnection extends Emitter {
  open = false;
  closed = false;
  constructor(peer, metadata) { super(); this.peer = peer; this.metadata = metadata; }
  send(packet) {
    if (!this.open) throw new Error('closed channel');
    const copy = structuredClone(packet);
    queueMicrotask(() => { if (!this.partner.closed) this.partner.emit('data', copy); });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.emit('close');
    if (!this.partner.closed) this.partner.close();
  }
}

function makeNetwork() {
  const peers = new Map();
  let nextId = 0;
  class FakePeer extends Emitter {
    destroyed = false;
    disconnected = false;
    connections = [];
    constructor(requestedId) {
      super();
      this.id = requestedId || `guest-peer-${++nextId}`;
      if (peers.has(this.id)) {
        queueMicrotask(() => this.emit('error', { type: 'unavailable-id' }));
      } else {
        peers.set(this.id, this);
        queueMicrotask(() => { if (!this.destroyed) this.emit('open', this.id); });
      }
    }
    connect(id, options) {
      const local = new FakeConnection(id, options.metadata);
      const remote = new FakeConnection(this.id, options.metadata);
      local.partner = remote;
      remote.partner = local;
      this.connections.push(local);
      queueMicrotask(() => {
        const target = peers.get(id);
        if (!target || target.destroyed) { this.emit('error', { type: 'peer-unavailable' }); return; }
        target.connections.push(remote);
        target.emit('connection', remote);
        remote.open = true;
        remote.emit('open');
        local.open = true;
        local.emit('open');
      });
      return local;
    }
    reconnect() {
      this.disconnected = false;
      queueMicrotask(() => this.emit('open', this.id));
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      if (peers.get(this.id) === this) peers.delete(this.id);
      for (const connection of this.connections) connection.close();
      this.emit('close');
    }
  }
  return { peers, peerFactory: (id) => new FakePeer(id) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

function makeClient(network, id, options = {}) {
  const observed = { states: [], actions: [], members: [], statuses: [] };
  const sync = createRoomSync({
    roomId: 'abc123', clientId: id, name: id,
    initialState: { count: 0, name: '团子' },
    reduceAction: (state, action) => ({ ...state, count: state.count + 1, ...(action.type === 'rename' ? { name: action.name } : {}) }),
    ...network, ...options,
    onState: (state) => observed.states.push(state),
    onAction: (action, actor) => observed.actions.push({ action, actor }),
    onPresence: (members) => observed.members.push(members),
    onStatus: (status) => observed.statuses.push(status),
  });
  return { sync, observed };
}

test('strict action validation rejects unknown fields and malformed names', () => {
  assert.deepEqual(validateAction({ type: 'feed', food: 'meal' }), { type: 'feed', food: 'meal' });
  assert.deepEqual(validateAction({ type: 'rename', name: '  糯米  ' }), { type: 'rename', name: '糯米' });
  for (const action of [null, [], { type: 'feed', food: 'steak' }, { type: 'pet', coins: 99 }, { type: 'rename', name: '\n坏名字' }, { type: 'rename', name: 'a'.repeat(17) }]) {
    assert.equal(validateAction(action), null);
  }
});

test('room validation does not stringify missing identifiers', () => {
  const options = { clientId: 'client-a', initialState: {}, reduceAction: (state) => state };
  assert.throws(() => createRoomSync(options), /房间号/);
  assert.throws(() => createRoomSync({ ...options, roomId: 'abcdef', clientId: undefined }), /client ID/);
});

test('two peers adopt host state, share committed actions, and synchronize names', async (t) => {
  const network = makeNetwork();
  const host = makeClient(network, 'client-a', { initialState: { count: 9, name: '团子' } });
  const guest = makeClient(network, 'client-b');
  t.after(() => { host.sync.destroy(); guest.sync.destroy(); });
  host.sync.start();
  guest.sync.start();
  assert.equal(guest.sync.dispatch({ type: 'pet' }), false, 'cannot mutate before first authoritative snapshot');
  await flush();
  assert.equal(host.observed.statuses.at(-1).phase, 'online');
  assert.equal(guest.observed.statuses.at(-1).role, 'guest');
  assert.deepEqual(guest.observed.states.at(-1), { count: 9, name: '团子' });
  assert.equal(guest.observed.members.at(-1).length, 2);
  assert.equal(guest.sync.dispatch({ type: 'pet' }), true);
  assert.equal(guest.observed.states.at(-1).count, 9, 'guest does not optimistically commit');
  await flush();
  assert.equal(host.observed.states.at(-1).count, 10);
  assert.equal(guest.observed.states.at(-1).count, 10);
  assert.deepEqual(host.observed.actions.at(-1).actor, { id: 'client-b', name: 'client-b' });
  assert.equal(host.sync.dispatch({ type: 'rename', name: '糯米' }), true);
  await flush();
  assert.equal(guest.observed.states.at(-1).name, '糯米');
  guest.sync.updateName('小鱼');
  await flush();
  assert.equal(host.observed.members.at(-1)[1].name, '小鱼');
  assert.equal(guest.observed.members.at(-1)[1].name, '小鱼');
  const guestPeer = [...network.peers.values()].find((peer) => peer.id.startsWith('guest-'));
  const event = { v: 1, kind: 'action', id: 'fixed-event-001', action: { type: 'pet' } };
  guestPeer.connections[0].send(event);
  guestPeer.connections[0].send(event);
  await flush();
  assert.equal(host.observed.states.at(-1).count, 12, 'duplicate packet commits once');
  assert.equal(guest.observed.actions.length, 3, 'each accepted event animates once');
});

test('third member receives full status without displacing the connected pair', async (t) => {
  const network = makeNetwork();
  const clients = ['client-a', 'client-b', 'client-c'].map((id) => makeClient(network, id));
  t.after(() => clients.forEach((client) => client.sync.destroy()));
  clients[0].sync.start();
  clients[1].sync.start();
  await flush();
  clients[2].sync.start();
  await flush();
  assert.equal(clients[2].observed.statuses.at(-1).phase, 'full');
  assert.equal(clients[2].sync.dispatch({ type: 'pet' }), false);
  assert.equal(clients[0].observed.members.at(-1).length, 2);
  assert.equal(clients[1].sync.dispatch({ type: 'play' }), true);
  await flush();
  assert.equal(clients[0].observed.states.at(-1).count, 1);
});

test('invalid remote packets cannot commit state; host rate limits and reducer rejection work', async (t) => {
  const network = makeNetwork();
  const host = makeClient(network, 'client-a', { reduceAction: (state, action) => action.type === 'sleep' ? null : { ...state, count: state.count + 1 } });
  const guest = makeClient(network, 'client-b');
  t.after(() => { host.sync.destroy(); guest.sync.destroy(); });
  host.sync.start(); guest.sync.start(); await flush();
  const guestPeer = [...network.peers.values()].find((peer) => peer.id.startsWith('guest-'));
  guestPeer.connections[0].send({ v: 1, kind: 'action', action: { type: 'pet' } });
  guestPeer.connections[0].send({ v: 1, kind: 'snapshot', state: { count: 999 } });
  guestPeer.connections[0].send({ v: 1, kind: 'action', id: 'invalid-event', action: { type: 'feed', food: 'infinite' } });
  await flush();
  assert.equal(host.observed.states.at(-1).count, 0);
  assert.equal(host.sync.dispatch({ type: 'sleep' }), false);
  let accepted = 0;
  for (let i = 0; i < 20; i += 1) if (host.sync.dispatch({ type: 'pet' })) accepted += 1;
  assert.equal(accepted, 11, 'rejected reducer calls also consume one rate-limit slot');
  await flush();
  assert.equal(guest.observed.states.at(-1).count, 11);
});

test('signaling reconnect preserves live room epoch and state ordering', async (t) => {
  const network = makeNetwork();
  const host = makeClient(network, 'client-a');
  const guest = makeClient(network, 'client-b');
  t.after(() => { host.sync.destroy(); guest.sync.destroy(); });
  host.sync.start(); guest.sync.start(); await flush();
  host.sync.dispatch({ type: 'pet' }); await flush();
  const hostPeer = network.peers.get('catnest-v1-abc123');
  hostPeer.disconnected = true;
  hostPeer.emit('disconnected');
  assert.equal(host.observed.statuses.at(-1).phase, 'online', 'existing data channel remains live');
  hostPeer.reconnect(); await flush();
  host.sync.dispatch({ type: 'play' }); await flush();
  assert.equal(guest.observed.states.at(-1).count, 2);
});

test('surviving guest becomes host with its last confirmed state after host leaves', async (t) => {
  const network = makeNetwork();
  const host = makeClient(network, 'client-a');
  const guest = makeClient(network, 'client-b');
  t.after(() => { host.sync.destroy(); guest.sync.destroy(); });
  host.sync.start(); guest.sync.start(); await flush();
  guest.sync.dispatch({ type: 'feed', food: 'meal' }); await flush();
  host.sync.destroy();
  assert.equal(guest.observed.statuses.at(-1).phase, 'offline');
  assert.equal(guest.sync.dispatch({ type: 'pet' }), false);
  await new Promise((resolve) => setTimeout(resolve, 2250));
  assert.equal(guest.observed.statuses.at(-1).phase, 'online');
  assert.equal(guest.observed.statuses.at(-1).role, 'host');
  assert.equal(guest.observed.states.at(-1).count, 1);
  assert.equal(guest.observed.members.at(-1).length, 1);
  assert.equal(guest.sync.dispatch({ type: 'pet' }), true);
  assert.equal(guest.observed.states.at(-1).count, 2);
});

test('host recovers signaling after an established data connection also closes', async (t) => {
  const network = makeNetwork();
  const host = makeClient(network, 'client-a');
  const guest = makeClient(network, 'client-b');
  t.after(() => { host.sync.destroy(); guest.sync.destroy(); });
  host.sync.start(); guest.sync.start(); await flush();
  host.sync.dispatch({ type: 'pet' }); await flush();
  const hostPeer = network.peers.get('catnest-v1-abc123');
  hostPeer.disconnected = true;
  hostPeer.emit('disconnected');
  guest.sync.destroy();
  assert.equal(host.observed.statuses.at(-1).phase, 'offline');
  assert.equal(host.sync.dispatch({ type: 'play' }), false);
  await new Promise((resolve) => setTimeout(resolve, 2250));
  assert.equal(host.observed.statuses.at(-1).phase, 'online');
  assert.equal(host.observed.states.at(-1).count, 1);
  assert.equal(host.sync.dispatch({ type: 'play' }), true);
});
