import { sanitizeRestaurantGrowthClaim } from './restaurant-income-growth.js';
import Peer from 'peerjs';
import { FOODS, validPendingGrowth } from './state.js';
import { validCollectionCatId, validCollectionSceneId } from './cat-collection.js';

/**
 * Two-person, host-authoritative rooms over PeerJS/WebRTC.
 *
 * The room URL is its access key, not an authenticated account. Public PeerJS
 * signaling and a direct WebRTC route must be reachable; restrictive networks
 * may need a separately operated TURN server. No cloud database is involved.
 * The host tab owns the current state. A surviving guest can become the host
 * using its last confirmed snapshot, but unacknowledged actions are not replayed.
 * Mobile background suspension can interrupt a room. Simultaneous offline
 * sessions do not merge; joining a live host adopts that host's snapshot.
 */
const VERSION = 1;
const ROOM_PATTERN = /^[a-z0-9]{6,12}$/;
const ID_PATTERN = /^[a-zA-Z0-9_-]{6,80}$/;
const EVENT_PATTERN = /^[a-zA-Z0-9_:-]{6,180}$/;
const REWARD_PATTERN = /^[a-zA-Z0-9_.:-]{8,180}$/;
const validId = (value) => typeof value === 'string' && ID_PATTERN.test(value);
const validEventId = (value) => typeof value === 'string' && EVENT_PATTERN.test(value);
const MAX_PACKET_BYTES = 48_000;
const HEARTBEAT_MS = 4_000;
const STALE_MS = 18_000;
const CONNECT_TIMEOUT_MS = 14_000;
const MAX_ATTEMPTS = 6;

const noop = () => {};
const randomId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && [...value.trim()].length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const cleanName = (value) => validText(value, 20) ? value.trim() : '铲屎官';

export function validateAction(value) {
  if (!plain(value)) return null;
  const keys = Object.keys(value);
  if (value.type === 'feed' && keys.length === 2 && keys.includes('food') && typeof value.food === 'string' && Object.hasOwn(FOODS, value.food)) {
    return { type: 'feed', food: value.food };
  }
  if (['pet', 'play', 'sleep'].includes(value.type) && keys.length === 1) return { type: value.type };
  if (value.type === 'rename' && keys.length === 2 && keys.includes('name') && validText(value.name, 16)) {
    return { type: 'rename', name: value.name.trim() };
  }
  if (value.type === 'claim-restaurant-growth') return sanitizeRestaurantGrowthClaim(value);
  if (value.type === 'claim-growth' && keys.length === 2 && keys.includes('rewardId') && typeof value.rewardId === 'string' && REWARD_PATTERN.test(value.rewardId)) return { type: 'claim-growth', rewardId: value.rewardId };
  if (value.type === 'invite-cat' && keys.length === 2 && keys.includes('catId') && validCollectionCatId(value.catId)) return { type:'invite-cat', catId:value.catId };
  if (value.type === 'invite-cat' && keys.length === 3 && keys.includes('catId') && keys.includes('sceneId') && validCollectionCatId(value.catId) && validCollectionSceneId(value.sceneId)) return {type:'invite-cat',catId:value.catId,sceneId:value.sceneId};
  return null;
}

function safeJson(value, depth = 0, key = '') {
  if (depth > 10) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  // Saved growth has no expiry or count cap. Only this validated collection is
  // exempt from the generic array bound; other packet fields stay bounded.
  if (Array.isArray(value)) return key === 'pendingGrowth' ? validPendingGrowth(value) : value.length <= 500 && value.every((item) => safeJson(item, depth + 1));
  if (!plain(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 100 && entries.every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeJson(item, depth + 1, key));
}

const growthBytes = state => plain(state) && validPendingGrowth(state.pendingGrowth) ? JSON.stringify(state.pendingGrowth).length : 0;

function cloneState(value) {
  if (!plain(value) || !safeJson(value)) return null;
  try {
    const encoded = JSON.stringify(value);
    return encoded.length - growthBytes(value) <= MAX_PACKET_BYTES - 2000 ? JSON.parse(encoded) : null;
  } catch {
    return null;
  }
}

function validActor(value) {
  return plain(value) && validId(value.id) && validText(value.name, 20);
}

function validPacket(value) {
  if (!plain(value) || value.v !== VERSION || typeof value.kind !== 'string' || !safeJson(value)) return false;
  try { return JSON.stringify(value).length - growthBytes(value.state) <= MAX_PACKET_BYTES; } catch { return false; }
}

/**
 * Callbacks receive JSON copies. dispatch() is false if invalid/unavailable;
 * true means submitted (guest UI should wait for onState, never optimistically
 * mutate shared state). onAction runs only after the host has committed an
 * accepted action. Presence contains this tab and, when connected, one friend.
 * start() can also retry a terminal error/full state; destroy() is permanent.
 * peerFactory is an optional constructor adapter used by deterministic tests.
 */
export function createRoomSync({
  roomId,
  clientId,
  name,
  initialState,
  reduceAction,
  onState = noop,
  onAction = noop,
  onPresence = noop,
  onStatus = noop,
  peerFactory = (id) => new Peer(id, { debug: 0, secure: true }),
}) {
  if (typeof roomId !== 'string' || !ROOM_PATTERN.test(roomId)) throw new TypeError('房间号需要 6–12 位小写字母或数字');
  if (!validId(clientId)) throw new TypeError('Invalid client ID');
  if (typeof reduceAction !== 'function') throw new TypeError('A state reducer is required');
  let state = cloneState(initialState);
  if (!state) throw new TypeError('Initial state must be a small JSON object');

  const hostId = `catnest-v1-${roomId}`;
  const me = { id: clientId, name: cleanName(name) };
  let peer = null;
  let hostConnection = null;
  let guestConnection = null;
  let guestActor = null;
  let role = null;
  let epoch = null;
  let sequence = 0;
  let ready = false;
  let signaling = false;
  let started = false;
  let destroyed = false;
  let terminal = false;
  let generation = 0;
  let attempts = 0;
  let retryTimer = null;
  let connectTimer = null;
  let heartbeat = null;
  let signalingTimer = null;
  const delayedCloses = new Set();
  const pendingConnections = new Set();
  const seenEvents = new Set();
  const actionTimes = new Map();
  let lastStatus = '';

  function status(phase, message) {
    const next = { phase, role, message };
    const signature = JSON.stringify(next);
    if (signature !== lastStatus && !destroyed) {
      lastStatus = signature;
      onStatus(next);
    }
  }

  function presence() {
    if (!destroyed) onPresence([ { ...me }, ...(guestActor && guestConnection?.open ? [{ ...guestActor }] : []) ]);
  }

  function guestPresence(members) {
    if (!Array.isArray(members) || members.length !== 2 || !members.every(validActor)) return false;
    if (members[0].id === members[1].id || !members.some((member) => member.id === me.id)) return false;
    onPresence(members.map((member) => ({ id: member.id, name: member.name.trim() })));
    return true;
  }

  function clearTimer(name) {
    if (name === 'retry') { clearTimeout(retryTimer); retryTimer = null; }
    if (name === 'connect') { clearTimeout(connectTimer); connectTimer = null; }
    if (name === 'signal') { clearTimeout(signalingTimer); signalingTimer = null; }
  }

  function closeConnection(connection) {
    try { connection?.close(); } catch { /* A closed WebRTC channel needs no further cleanup. */ }
  }

  function send(connection, packet) {
    if (!connection?.open) return false;
    try { connection.send({ v: VERSION, ...packet }); return true; } catch { return false; }
  }

  function remember(id) {
    if (seenEvents.has(id)) return false;
    seenEvents.add(id);
    if (seenEvents.size > 500) seenEvents.delete(seenEvents.values().next().value);
    return true;
  }

  function allowAction(actorId) {
    const now = Date.now();
    const recent = (actionTimes.get(actorId) || []).filter((time) => now - time < 10_000);
    if (recent.length >= 12) return false;
    recent.push(now);
    actionTimes.set(actorId, recent);
    return true;
  }

  function snapshot(event = null) {
    send(guestConnection, {
      kind: 'snapshot', epoch, sequence, state,
      members: [{ ...me }, ...(guestActor ? [{ ...guestActor }] : [])],
      event,
    });
  }

  function commit(action, actor, eventId) {
    if (seenEvents.has(eventId) || !allowAction(actor.id)) return false;
    let next;
    try { next = cloneState(reduceAction(cloneState(state), { ...action }, { ...actor }, Date.now(), eventId)); } catch { return false; }
    if (!next) return false;
    remember(eventId);
    state = next;
    sequence += 1;
    onState(cloneState(state));
    onAction({ ...action }, { ...actor });
    snapshot({ id: eventId, action, actor });
    return true;
  }

  function cleanupPeer() {
    // Invalidate listeners before destroying connections, whose close events can
    // fire synchronously in test doubles or particular browsers.
    generation += 1;
    clearTimer('connect');
    clearTimer('signal');
    clearInterval(heartbeat);
    heartbeat = null;
    ready = false;
    signaling = false;
    const oldPeer = peer;
    peer = null;
    hostConnection = null;
    guestConnection = null;
    guestActor = null;
    for (const connection of pendingConnections) closeConnection(connection);
    pendingConnections.clear();
    try { oldPeer?.destroy(); } catch { /* Peer may already have been destroyed by its error event. */ }
  }

  function retry(message) {
    if (destroyed || terminal || retryTimer) return;
    cleanupPeer();
    role = null;
    presence();
    attempts += 1;
    if (attempts > MAX_ATTEMPTS) {
      terminal = true;
      status('error', '暂时连不上同养房间，请检查网络后重试；当前进度仍保留在此设备。');
      return;
    }
    status('offline', message);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      electHost();
    }, Math.min(1500 * 2 ** (attempts - 1), 12_000) + Math.floor(Math.random() * 600));
  }

  function fatal(message, phase = 'error') {
    terminal = true;
    cleanupPeer();
    presence();
    status(phase, message);
  }

  function rejectConnection(connection, reason) {
    send(connection, { kind: 'rejected', reason });
    // Give the rejection packet one event-loop turn to leave the channel.
    const timer = setTimeout(() => { delayedCloses.delete(timer); closeConnection(connection); }, 250);
    delayedCloses.add(timer);
  }

  function hostOnlineStatus() {
    status(signaling || guestConnection?.open ? 'online' : 'offline', guestConnection?.open
      ? '你们正在一起养猫，互动会实时同步'
      : signaling ? '房间已开启，等待另一位铲屎官' : '房间连接中断，正在重连');
  }

  function acceptConnection(connection, token) {
    if (pendingConnections.size >= 4) { closeConnection(connection); return; }
    pendingConnections.add(connection);
    let joined = false;
    let lastSeen = Date.now();
    const handshakeTimer = setTimeout(() => { if (!joined) closeConnection(connection); }, 8_000);
    connection.on('open', () => {
      if (destroyed || token !== generation || role !== 'host') { closeConnection(connection); return; }
      if (connection.metadata?.v !== VERSION || connection.metadata?.roomId !== roomId) {
        rejectConnection(connection, 'invalid');
      }
    });
    connection.on('data', (packet) => {
      if (destroyed || token !== generation || !validPacket(packet)) return;
      lastSeen = Date.now();
      if (packet.kind === 'hello' && !joined) {
        if (!validActor(packet.actor) || packet.actor.id === me.id || connection.metadata?.v !== VERSION || connection.metadata?.roomId !== roomId) {
          rejectConnection(connection, 'invalid'); return;
        }
        if (guestConnection?.open) { rejectConnection(connection, 'full'); return; }
        clearTimeout(handshakeTimer);
        pendingConnections.delete(connection);
        guestConnection = connection;
        guestActor = { id: packet.actor.id, name: packet.actor.name.trim() };
        joined = true;
        attempts = 0;
        snapshot();
        presence();
        hostOnlineStatus();
        return;
      }
      if (!joined || connection !== guestConnection) return;
      if (packet.kind === 'ping') send(connection, { kind: 'pong' });
      if (packet.kind === 'action' && validEventId(packet.id)) {
        const action = validateAction(packet.action);
        if (action) commit(action, guestActor, packet.id);
      }
      if (packet.kind === 'name' && validText(packet.name, 20)) {
        guestActor.name = packet.name.trim();
        sequence += 1;
        presence();
        snapshot();
      }
    });
    const closed = () => {
      clearTimeout(handshakeTimer);
      pendingConnections.delete(connection);
      if (destroyed || token !== generation || connection !== guestConnection) return;
      guestConnection = null;
      guestActor = null;
      presence();
      hostOnlineStatus();
      if (!signaling) retry('同养连接已断开，正在恢复房间服务');
    };
    connection.on('close', closed);
    connection.on('error', () => { closeConnection(connection); closed(); });
    connection._catnestHealth = () => {
      if (!joined) return;
      if (Date.now() - lastSeen > STALE_MS) { closeConnection(connection); closed(); }
      else send(connection, { kind: 'ping' });
    };
  }

  function connectToHost(currentPeer, token) {
    let connection;
    try {
      connection = currentPeer.connect(hostId, {
        reliable: true, serialization: 'json', label: 'catnest-v1',
        metadata: { v: VERSION, roomId },
      });
    } catch { retry('无法加入房间，正在重连'); return; }
    hostConnection = connection;
    let lastSeen = Date.now();
    connection.on('open', () => {
      if (destroyed || token !== generation) return;
      send(connection, { kind: 'hello', actor: me });
    });
    connection.on('data', (packet) => {
      if (destroyed || token !== generation || !validPacket(packet)) return;
      lastSeen = Date.now();
      if (packet.kind === 'rejected') {
        fatal(packet.reason === 'full' ? '这个小窝已经有两位铲屎官了，请创建另一个小窝。' : '房间信息不匹配，请重新打开邀请链接。', packet.reason === 'full' ? 'full' : 'error');
        return;
      }
      if (packet.kind === 'ping') { send(connection, { kind: 'pong' }); return; }
      if (packet.kind !== 'snapshot' || !validId(packet.epoch) || !Number.isSafeInteger(packet.sequence) || packet.sequence < 0) return;
      if (epoch && packet.epoch !== epoch && ready) return;
      if (packet.epoch === epoch && packet.sequence < sequence) return;
      const next = cloneState(packet.state);
      if (!next || !guestPresence(packet.members)) return;
      epoch = packet.epoch;
      sequence = packet.sequence;
      state = next;
      ready = true;
      attempts = 0;
      clearTimer('connect');
      onState(cloneState(state));
      if (plain(packet.event) && validEventId(packet.event.id) && validActor(packet.event.actor)) {
        const action = validateAction(packet.event.action);
        if (action && remember(packet.event.id)) onAction(action, { id: packet.event.actor.id, name: packet.event.actor.name });
      }
      status('online', '你们正在一起养猫，互动会实时同步');
    });
    const closed = () => {
      if (!destroyed && token === generation && !terminal) retry('另一位铲屎官暂时离开了，正在重新连接房间');
    };
    connection.on('close', closed);
    connection.on('error', closed);
    heartbeat = setInterval(() => {
      if (destroyed || token !== generation) return;
      if (Date.now() - lastSeen > STALE_MS) { retry('互动连接中断，正在尝试恢复'); return; }
      send(connection, { kind: 'ping' });
    }, HEARTBEAT_MS);
  }

  function attachPeer(currentPeer, token, candidateRole) {
    peer = currentPeer;
    role = candidateRole;
    let opened = false;
    currentPeer.on('open', () => {
      if (destroyed || token !== generation) return;
      signaling = true;
      clearTimer('signal');
      if (role === 'host') {
        clearTimer('connect');
        ready = true;
        attempts = 0;
        if (!opened) {
          epoch = randomId();
          sequence = 0;
        }
        presence();
        onState(cloneState(state));
        snapshot();
        hostOnlineStatus();
        clearInterval(heartbeat);
        heartbeat = setInterval(() => guestConnection?._catnestHealth?.(), HEARTBEAT_MS);
      } else if (!hostConnection) connectToHost(currentPeer, token);
      else if (ready) status('online', '你们正在一起养猫，互动会实时同步');
      opened = true;
    });
    currentPeer.on('connection', (connection) => {
      if (destroyed || token !== generation || role !== 'host' || !ready) { closeConnection(connection); return; }
      acceptConnection(connection, token);
    });
    currentPeer.on('disconnected', () => {
      if (destroyed || token !== generation) return;
      signaling = false;
      const linked = role === 'host' ? guestConnection?.open : hostConnection?.open && ready;
      status(linked ? 'online' : 'offline', linked ? '互动仍在同步，正在恢复房间服务连接' : '房间服务暂时断开，正在重连');
      clearTimer('signal');
      signalingTimer = setTimeout(() => {
        signalingTimer = null;
        if (destroyed || token !== generation) return;
        try {
          if (!currentPeer.destroyed && currentPeer.disconnected) {
            currentPeer.reconnect();
            signalingTimer = setTimeout(() => {
              signalingTimer = null;
              if (destroyed || token !== generation || signaling) return;
              const stillLinked = role === 'host' ? guestConnection?.open : hostConnection?.open && ready;
              if (!stillLinked) retry('房间服务重连超时，正在重新连接');
            }, 10_000);
          }
          else if (!linked) retry('房间服务连接中断，正在重试');
        } catch { if (!linked) retry('房间服务连接中断，正在重试'); }
      }, 1500);
    });
    currentPeer.on('close', () => { if (!destroyed && token === generation && !terminal) retry('房间服务已断开，正在重新连接'); });
    currentPeer.on('error', (error) => {
      if (destroyed || token !== generation || terminal) return;
      if (error?.type === 'unavailable-id' && candidateRole === 'host' && !ready) {
        cleanupPeer();
        role = 'guest';
        epoch = null;
        sequence = 0;
        status('connecting', '正在加入同养小窝');
        const guestToken = generation;
        try { attachPeer(peerFactory(undefined), guestToken, 'guest'); }
        catch { retry('房间服务暂不可用，正在重试'); return; }
        connectTimer = setTimeout(() => { if (!ready && !terminal) retry('连接超时，正在重试；部分网络可能限制实时连接'); }, CONNECT_TIMEOUT_MS);
        return;
      }
      if (error?.type === 'browser-incompatible') { fatal('当前浏览器不支持实时同养，请使用新版 Safari 或 Chrome。'); return; }
      if (['invalid-id', 'invalid-key', 'ssl-unavailable'].includes(error?.type)) { fatal('房间服务配置异常，请稍后重试。'); return; }
      // A lost signaling socket does not invalidate an established data channel.
      const linked = role === 'host' ? guestConnection?.open : hostConnection?.open && ready;
      if (linked && !currentPeer.destroyed && ['network', 'socket-error', 'socket-closed', 'disconnected'].includes(error?.type)) {
        status('online', '互动仍在同步，房间服务暂时不可用');
        return;
      }
      retry(error?.type === 'webrtc' ? '当前网络暂时无法建立实时连接，正在重试' : '房间连接失败，正在重试');
    });
  }

  function electHost() {
    if (destroyed || terminal) return;
    role = null;
    ready = false;
    status('connecting', '正在连接同养小窝');
    const token = generation;
    try { attachPeer(peerFactory(hostId), token, 'host'); }
    catch { retry('无法连接房间服务，正在重试'); return; }
    connectTimer = setTimeout(() => { if (!ready && !terminal) retry('连接超时，正在重试；请确认网络可用'); }, CONNECT_TIMEOUT_MS);
  }

  return {
    start() {
      if (destroyed || started && !terminal) return;
      started = true;
      terminal = false;
      attempts = 0;
      clearTimer('retry');
      cleanupPeer();
      presence();
      electHost();
    },
    dispatch(value) {
      const action = validateAction(value);
      if (destroyed || terminal || !ready || !action) return false;
      const id = `${me.id}:${randomId()}`;
      if (role === 'host') return signaling || guestConnection?.open ? commit(action, me, id) : false;
      return send(hostConnection, { kind: 'action', id, action });
    },
    updateName(value) {
      if (destroyed || !validText(value, 20)) return false;
      me.name = value.trim();
      if (role === 'host') { sequence += 1; presence(); snapshot(); }
      else if (ready) send(hostConnection, { kind: 'name', name: me.name });
      else presence();
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimer('retry');
      cleanupPeer();
      for (const timer of delayedCloses) clearTimeout(timer);
      delayedCloses.clear();
    },
  };
}
