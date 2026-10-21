import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPetServer } from '../server/pet-server.mjs';
import { createGitHubStore } from '../server/github-store.mjs';
import { createCloudRoom } from '../src/cloud.js';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';

const HOME = 'd'.repeat(32);
const START = Date.UTC(2026, 9, 14, 0);
const clone = value => structuredClone(value);

async function until(predicate, description, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail(`Timed out waiting for ${description}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** Only the GitHub Contents API is mocked; client HTTP and SSE use real sockets. */
function mockGitHub(state) {
  let sha = 1;
  const calls = [];
  const files = new Map([[HOME, {
    sha: 'sha-1',
    room: { version: 1, roomId: HOME, revision: 0, state: clone(state), createdAt: START, updatedAt: START, operations: [] },
  }]]);
  async function fetchImpl(url, options) {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    const id = new URL(url).pathname.split('/').at(-1).replace('.json', '');
    const existing = files.get(id);
    calls.push({ id, method: options.method });
    if (options.method === 'GET') {
      if (!existing) return new Response('{}', { status: 404 });
      if (options.headers['If-None-Match'] === existing.sha) return new Response(null, { status: 304 });
      return Response.json({
        sha: existing.sha, encoding: 'base64',
        content: Buffer.from(JSON.stringify(existing.room)).toString('base64'),
      }, { headers: { etag: existing.sha } });
    }
    assert.equal(options.method, 'PUT');
    const body = JSON.parse(options.body);
    if ((existing && body.sha !== existing.sha) || (!existing && body.sha)) return new Response('{}', { status: 409 });
    files.set(id, { sha: `sha-${++sha}`, room: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) });
    return new Response('{}', { status: existing ? 200 : 201 });
  }
  return { files, calls, fetchImpl };
}

async function fixture(t, state = initialState(START)) {
  const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
  const sources = new Set();
  const clients = [];
  const servers = new Set();
  const requests = [];
  const github = mockGitHub(state);
  let now = START;
  let server;
  let base;

  class FetchEventSource {
    listeners = new Map();
    controller = new AbortController();
    closed = false;
    pauseSnapshots = false;
    events = [];
    constructor(url) {
      assert.equal(new URL(url).hostname, '127.0.0.1', 'SSE may only connect to the local mock server');
      this.url = url;
      sources.add(this);
      this.pump = this.read();
    }
    addEventListener(type, callback) {
      this.listeners.set(type, [...(this.listeners.get(type) || []), callback]);
    }
    async read() {
      try {
        const response = await fetch(this.url, { signal: this.controller.signal });
        if (!response.ok) throw new Error(`SSE failed with HTTP ${response.status}`);
        if (this.closed) return;
        this.onopen?.();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!this.closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const packet = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const event = packet.match(/^event: (.+)$/m)?.[1];
            const data = packet.match(/^data: (.+)$/m)?.[1];
            if (!event || !data || this.closed) continue;
            this.events.push({ event, data: JSON.parse(data) });
            if (this.pauseSnapshots && ['action', 'state'].includes(event)) continue;
            for (const callback of this.listeners.get(event) || []) callback({ data });
          }
        }
      } catch (error) {
        if (!this.closed) this.onerror?.(error);
      }
    }
    close() {
      this.closed = true;
      this.controller.abort();
    }
  }
  Object.defineProperty(globalThis, 'EventSource', { configurable: true, writable: true, value: FetchEventSource });

  async function stop(current = server) {
    if (!current?.listening) return;
    const closed = once(current, 'close');
    current.shutdown();
    current.closeAllConnections();
    await closed;
  }
  t.after(async () => {
    for (const client of clients) client.cloud.destroy();
    for (const source of sources) source.close();
    await Promise.all([...servers].map(stop));
    await Promise.allSettled([...sources].map(source => source.pump));
    if (originalEventSource) Object.defineProperty(globalThis, 'EventSource', originalEventSource);
    else delete globalThis.EventSource;
  });

  async function start() {
    // A new store discards every previous process's cache and lock queue.
    const store = createGitHubStore({
      token: 'mock-test-token', repository: 'test/growth-cloud-save',
      fetchImpl: github.fetchImpl, now: () => now,
    });
    server = createPetServer({ store, coupleRoomId: HOME, serveStatic: false, heartbeatMs: 1000, pollMs: 60_000, corsOrigin: '' });
    servers.add(server);
    server.on('request', (request, response) => {
      const entry = { method: request.method, path: new URL(request.url, 'http://127.0.0.1').pathname };
      requests.push(entry);
      response.once('finish', () => { entry.status = response.statusCode; });
    });
    const listening = once(server, 'listening');
    server.listen(0, '127.0.0.1');
    await listening;
    base = `http://127.0.0.1:${server.address().port}`;
  }
  function client(role) {
    const observed = { states: [], actions: [], presence: [], saves: [], pending: [], statuses: [], rooms: [] };
    const cloud = createCloudRoom({
      apiBase: base, coupleRole: role,
      roomId: null, initialState: undefined, pending: [],
      clientId: `new-device-${clients.length}`, name: '无本地存档的新设备',
      onRoom: value => observed.rooms.push(value),
      onState: value => observed.states.push(clone(value)),
      onAction: (action, actor) => observed.actions.push({ action: clone(action), actor: clone(actor) }),
      onPresence: value => observed.presence.push(clone(value)),
      onStatus: value => observed.statuses.push(clone(value)),
      onSaveStatus: value => observed.saves.push(clone(value)),
      onPending: value => observed.pending.push(clone(value)),
    });
    const result = { cloud, observed, get state() { return observed.states.at(-1); } };
    clients.push(result);
    return result;
  }
  await start();
  return {
    github, requests, sources, start, stop, client,
    advance: ms => { now += ms; },
    get saved() { return github.files.get(HOME).room; },
  };
}

async function connect(...clients) {
  await Promise.all(clients.map(client => client.cloud.start()));
  await until(() => clients.every(client => client.observed.statuses.at(-1)?.phase === 'online'), 'the real SSE connections to open');
}
const drained = client => client.observed.pending.at(-1)?.length === 0;
const settled = client => drained(client) && ['saved', 'error'].includes(client.observed.saves.at(-1)?.phase);

test('unclaimed growth survives a server restart and a year before a device with no local save restores it', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const original = f.client('male');
  await connect(original);
  const xp = original.state.xp;
  assert.equal(original.cloud.dispatch({ type: 'feed', food: 'fish' }), true);
  await until(() => drained(original) && original.state.pendingGrowth.length === 1, 'the generated bubble to be committed');
  const rewards = clone(original.state.pendingGrowth);
  assert.equal(rewards[0].amount, 55);
  assert.equal(original.state.xp, xp, 'generating a bubble does not immediately count its XP');
  assert.deepEqual(f.saved.state.pendingGrowth, rewards, 'the reward is persisted in GitHub rather than a device cache');

  original.cloud.destroy();
  await f.stop();
  f.advance(365 * 24 * 3600_000);
  await f.start();
  const freshDevice = f.client('female');
  await connect(freshDevice);
  assert.deepEqual(freshDevice.observed.rooms, [HOME]);
  assert.deepEqual(freshDevice.state.pendingGrowth, rewards);
  assert.equal(freshDevice.state.xp, xp);
  assert.equal(f.requests.filter(request => request.method === 'POST' && request.path === '/api/rooms').length, 0, 'a new device reads the same shared home');
  assert.equal(f.github.calls.filter(call => call.method === 'PUT').length, 1, 'reload and reconnection do not mint another reward');
});

test('either caregiver can collect the other caregiver’s bubble and both clients remove it through real SSE', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const male = f.client('male'), female = f.client('female');
  await connect(male, female);
  await until(() => male.observed.presence.at(-1)?.length === 2 && female.observed.presence.at(-1)?.length === 2, 'both caregivers to join');
  const xp = male.state.xp;
  assert.equal(male.cloud.dispatch({ type: 'feed', food: 'fish' }), true);
  await until(() => drained(male) && female.state.pendingGrowth.length === 1, 'the male caregiver’s bubble to synchronize');
  assert.equal(female.cloud.dispatch({ type: 'play' }), true);
  await until(() => drained(female) && male.state.pendingGrowth.length === 2, 'the female caregiver’s bubble to synchronize');
  const feed = male.state.pendingGrowth.find(reward => reward.kind === 'feed');
  const play = male.state.pendingGrowth.find(reward => reward.kind === 'play');
  assert.equal(feed.actorId, 'partner-male');
  assert.equal(play.actorId, 'partner-female');
  assert.equal(play.amount, 10.4, 'feeding restored energy before the next interaction');
  assert.equal(male.state.xp, xp);

  assert.equal(male.cloud.dispatch({ type: 'claim-growth', rewardId: play.id }), true);
  await until(() => drained(male) && female.state.pendingGrowth.length === 1 && female.state.xp === xp + 10.4, 'the other caregiver’s play reward to be collected');
  assert.equal(female.cloud.dispatch({ type: 'claim-growth', rewardId: feed.id }), true);
  await until(() => drained(female) && male.state.pendingGrowth.length === 0 && female.state.pendingGrowth.length === 0, 'both clients to remove the claimed bubbles');
  assert.equal(male.state.xp, xp + 65.4);
  assert.equal(female.state.xp, xp + 65.4);
  assert.equal(f.saved.revision, 4);
  assert.deepEqual(f.saved.state.pendingGrowth, []);
  assert.equal(f.saved.state.careLimits.counts.feed, 1);
  assert.equal(f.saved.state.careLimits.counts.play, 1);
  for (const client of [male, female]) {
    assert.equal(client.observed.actions.filter(event => event.action.type === 'claim-growth').length, 2, 'SSE and POST acknowledgments animate each saved claim once');
  }
});

function stateWithReward() {
  return reduceAction(initialState(START), { type: 'feed', food: 'fish' }, { id: 'partner-male', name: '男方' }, START, 'persisted-feed-before-claim');
}

test('simultaneous claims by both clients persist and synchronize exactly one XP award', { timeout: 10_000 }, async t => {
  const before = stateWithReward();
  const f = await fixture(t, before);
  const male = f.client('male'), female = f.client('female');
  await connect(male, female);
  const action = { type: 'claim-growth', rewardId: before.pendingGrowth[0].id };
  assert.equal(male.cloud.dispatch(action), true);
  assert.equal(female.cloud.dispatch(action), true);
  // A rejected claim clears its queue before awaiting the authoritative GET.
  // Wait for both final save callbacks, even if SSE already removed the bubble.
  await until(() => settled(male) && settled(female) && male.state.pendingGrowth.length === 0 && female.state.pendingGrowth.length === 0, 'both competing claims and their conflict reconciliation to finish');
  await until(() => [male, female].every(client => client.observed.actions.filter(event => event.action.type === 'claim-growth').length === 1), 'the single accepted claim to reach both SSE clients');
  assert.equal(f.saved.state.xp, before.xp + 55);
  assert.equal(male.state.xp, before.xp + 55);
  assert.equal(female.state.xp, before.xp + 55);
  assert.equal(f.saved.revision, 1);
  assert.equal(f.saved.operations.length, 1);
  assert.deepEqual(f.saved.state.pendingGrowth, []);
  const posts = f.requests.filter(request => request.method === 'POST' && request.path.endsWith('/actions'));
  assert.deepEqual(posts.map(request => request.status).sort(), [200, 409]);
  assert.equal(f.github.calls.filter(call => call.method === 'PUT').length, 1, 'a refused claim cannot write another XP increment');
  assert.equal([male, female].filter(client => client.observed.saves.some(save => save.phase === 'error' && /已经被领取/.test(save.message))).length, 1);
  for (const client of [male, female]) assert.equal(client.observed.actions.filter(event => event.action.type === 'claim-growth').length, 1);
});

test('a stale client immediately reloads cloud state after a claim conflict when the winning SSE update was missed', { timeout: 10_000 }, async t => {
  const before = stateWithReward();
  const f = await fixture(t, before);
  const male = f.client('male'), female = f.client('female');
  await connect(male, female);
  const femaleSource = [...f.sources].find(source => new URL(source.url).searchParams.get('clientId') === 'partner-female');
  femaleSource.pauseSnapshots = true;
  const action = { type: 'claim-growth', rewardId: before.pendingGrowth[0].id };
  assert.equal(male.cloud.dispatch(action), true);
  await until(() => drained(male) && male.state.pendingGrowth.length === 0, 'the first claim to commit');
  assert.equal(female.state.pendingGrowth.length, 1, 'this device deliberately missed the winning live update');
  const readsBefore = f.requests.filter(request => request.method === 'GET' && request.path === `/api/rooms/${HOME}`).length;

  assert.equal(female.cloud.dispatch(action), true);
  await until(() => drained(female) && female.state.pendingGrowth.length === 0, 'an immediate authoritative reload after HTTP 409');
  assert.equal(f.requests.filter(request => request.method === 'GET' && request.path === `/api/rooms/${HOME}`).length, readsBefore + 1, 'conflict recovery does not wait for the 20-second poll');
  assert.equal(female.state.xp, before.xp + 55);
  assert.equal(f.saved.state.xp, before.xp + 55);
  assert.equal(f.saved.revision, 1);
  assert.equal(female.observed.actions.length, 0, 'reloading state does not invent a second committed claim event');
  assert.equal(female.observed.saves.at(-1).phase, 'error');
  assert.match(female.observed.saves.at(-1).message, /已经被领取/);
});

test('guest achievement metadata reaches both real HTTP and SSE clients without adding unknown restaurant keys for older pages',async t=>{
  const state=initialState(START);state.restaurant.seenGuests=['guest-baker'];state.restaurant.ownedThemes.push('mint');
  state.restaurant.stats.experience=restaurantLevelStartXp(30);
  const h=await fixture(t,state),male=h.client('male'),female=h.client('female');await connect(male,female);
  for(const client of [male,female]){assert.ok(client.state.restaurant.completedGuestConditions.includes('decoration:cream-bakery'));assert.ok(client.state.restaurant.completedGuestConditions.includes('level:30'));}
  assert.equal(male.cloud.dispatch({type:'restaurant-theme',themeId:'mint'}),true);
  await until(()=>male.state.restaurant.theme==='mint'&&female.state.restaurant.theme==='mint','both clients to receive the scene change');
  for(const client of [male,female])assert.ok(client.state.restaurant.completedGuestConditions.includes('decoration:cream-bakery'));
  const packets=[...h.sources].flatMap(source=>source.events).filter(packet=>['state','action'].includes(packet.event));
  assert.ok(packets.length>=3);for(const packet of packets){assert.equal(Object.hasOwn(packet.data.state.restaurant,'completedGuestConditions'),false);assert.ok(packet.data.restaurantGuestConditions.includes('decoration:cream-bakery'));assert.ok(packet.data.restaurantGuestConditionsV2.includes('level:30'));assert.ok(!packet.data.restaurantGuestConditions.includes('level:30'));}
  assert.ok(h.saved.state.restaurant.completedGuestConditions.includes('decoration:cream-bakery'));
});
