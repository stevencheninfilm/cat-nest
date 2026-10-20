import { sanitizeRestaurantGrowthClaim, isRestaurantGrowth } from '../src/restaurant-income-growth.js';
import { validHomeBond } from '../src/home-bond.js';
import { randomBytes } from 'node:crypto';
import { FOODS, careActionInfo, initialState, normalizeState, reduceAction, validCareLimits, validPendingGrowth, levelInfo } from '../src/state.js';
import { validAppearance } from '../src/mage-cat-config.js';
import { validCollection, validCollectionCatId, validCollectionSceneId, collectionSceneInvitation, canInviteCat } from '../src/cat-collection.js';
import { sanitizeGameAction, validGameHub, publicGameHub, publicGameEvent, emptyGameHub } from '../src/minigames.js';
import { sanitizeLocalGameAction, localGameReceipt, validLocalEvent } from '../src/minigames-local-rules.js';
import { validCoupleCare } from '../src/couple-care.js';
import { validMemoryJournal, normalizeMemoryJournal, validMemoryId } from '../src/memory-journal.js';
import { validNest, sanitizeNestAction, validFurnitureCare } from '../src/nest-decor.js';
import { validGoldFish } from '../src/restaurant-economy.js';
import { validRestaurant, restaurantProgressPreserved, normalizeRestaurant, sanitizeRestaurantAction, restaurantActionResult } from '../src/restaurant.js';

export const ROOM_ID = /^[a-f0-9]{32}$/;
const CLIENT_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const OPERATION_ID = /^[a-zA-Z0-9_.:-]{8,180}$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && [...value.trim()].length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const copy = value => structuredClone(value);

export class StorageError extends Error {
  constructor(code, message, status = 503) { super(message); this.name = 'StorageError'; this.code = code; this.status = status; }
}

export function sanitizeAction(value) {
  if (!plain(value)) return null;
  if(value.type==='game-local-finish')return sanitizeLocalGameAction(value);
  if (typeof value.type==='string' && value.type.startsWith('nest-')) return sanitizeNestAction(value);
  if (typeof value.type==='string' && value.type.startsWith('restaurant-')) return sanitizeRestaurantAction(value);
  if (typeof value.type === 'string' && value.type.startsWith('game-')) return sanitizeGameAction(value);
  const keys = Object.keys(value);
  if (value.type === 'join-home' && keys.length === 1) return {type:'join-home'};
  if (value.type === 'adopt-cat' && keys.length === 3 && keys.includes('name') && keys.includes('appearance') && validText(value.name,16) && validAppearance(value.appearance)) return {type:'adopt-cat',name:value.name.trim(),appearance:{...value.appearance}};

  if(value.type==='diary-favorite' && keys.length===3 && validMemoryId(value.memoryId) && typeof value.favorite==='boolean')return {type:'diary-favorite',memoryId:value.memoryId,favorite:value.favorite};
  if (value.type === 'feed' && keys.length === 2 && keys.includes('food') && typeof value.food === 'string' && Object.hasOwn(FOODS, value.food)) return { type: 'feed', food: value.food };
  if (['pet', 'play', 'sleep'].includes(value.type) && keys.length === 1) return { type: value.type };
  if (keys.length===2 && keys.includes('furniture') && validFurnitureCare(value)) return {type:value.type,furniture:value.furniture};
  if (value.type === 'dress' && keys.length === 2 && keys.includes('appearance') && validAppearance(value.appearance)) return { type:'dress', appearance:{...value.appearance} };
  if (value.type === 'rename' && keys.length === 2 && keys.includes('name') && validText(value.name, 16)) return { type: 'rename', name: value.name.trim() };
  if (value.type === 'claim-restaurant-growth') return sanitizeRestaurantGrowthClaim(value);
  if (value.type === 'claim-growth' && keys.length === 2 && keys.includes('rewardId') && typeof value.rewardId === 'string' && OPERATION_ID.test(value.rewardId)) return { type: 'claim-growth', rewardId: value.rewardId };
  if (value.type === 'invite-cat' && keys.length === 2 && keys.includes('catId') && validCollectionCatId(value.catId)) return { type:'invite-cat', catId:value.catId };
  if (value.type === 'invite-cat' && keys.length === 3 && keys.includes('catId') && keys.includes('sceneId') && validCollectionCatId(value.catId) && validCollectionSceneId(value.sceneId)) return {type:'invite-cat',catId:value.catId,sceneId:value.sceneId};
  return null;
}

export function sanitizeActor(clientId, name) {
  return typeof clientId === 'string' && CLIENT_ID.test(clientId) && validText(name, 20) ? { id: clientId, name: name.trim() } : null;
}

function safeState(value, now = Date.now()) {
  const next = normalizeState(value, now);
  if (!validText(next.name, 16)) next.name = '糯米';
  next.history = next.history.map(item => ({ text: item.text.slice(0, 200), actor: item.actor.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20) || '猫友', at: item.at }));
  return next;
}

function validStoredState(value) {
  if (!plain(value) || value.version !== 1 || !validText(value.name, 16) || typeof value.sleeping !== 'boolean' || !Number.isFinite(value.updatedAt)) return false;
  if (Object.hasOwn(value, 'homeBond') && !validHomeBond(value.homeBond)) return false;
  if (Object.hasOwn(value, 'appearance') && !validAppearance(value.appearance)) return false;
  if (Object.hasOwn(value, 'careLimits') && !validCareLimits(value.careLimits)) return false;
  if (Object.hasOwn(value, 'pendingGrowth') && !validPendingGrowth(value.pendingGrowth)) return false;
  if (Object.hasOwn(value, 'collection') && !validCollection(value.collection, Object.keys(FOODS))) return false;
  if (Object.hasOwn(value, 'games') && !validGameHub(value.games, { privateState:true })) return false;
  if (Object.hasOwn(value, 'coupleCare') && !validCoupleCare(value.coupleCare)) return false;
  if (Object.hasOwn(value, 'diary') && !validMemoryJournal(value.diary)) return false;
  if (Object.hasOwn(value, 'nest') && !validNest(value.nest)) return false;
  if (Object.hasOwn(value,'goldFish') && !validGoldFish(value.goldFish)) return false;
  if (Object.hasOwn(value, 'restaurant') && !validRestaurant(value.restaurant)) return false;
  if (Object.hasOwn(value, 'needsUpdatedAt') && (!Number.isSafeInteger(value.needsUpdatedAt) || value.needsUpdatedAt < 0)) return false;
  for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy']) {
    const max = key === 'xp' ? Number.MAX_SAFE_INTEGER : ['coins', 'love'].includes(key) ? 999999 : 100;
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > max) return false;
  }
  return Array.isArray(value.history) && value.history.length <= 40 && value.history.every(item => plain(item) && typeof item.text === 'string' && item.text.length <= 200 && typeof item.actor === 'string' && item.actor.length <= 20 && Number.isFinite(item.at));
}

export function publicRoom(room) {
  const state = copy(room.state);
  if (state.games) state.games = publicGameHub(state.games);
  // Older open pages strictly validate restaurant keys. Send the new ledger as
  // envelope metadata so they keep reading their existing restaurant safely.
  const restaurantGuestConditions = state.restaurant?.completedGuestConditions;
  if (state.restaurant) delete state.restaurant.completedGuestConditions;
  return { roomId:room.roomId, state, revision:room.revision, ...(restaurantGuestConditions ? {restaurantGuestConditions} : {}) };
}

function careRejection(action, info, now) {
  const label = { feed: '喂食', pet: '摸摸', play: '玩耍', sleep: '休息' }[action.type];
  const totalSeconds = Math.max(1, Math.ceil((info.availableAt - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  const wait = [hours && `${hours}小时`, minutes && `${minutes}分钟`, seconds && `${seconds}秒`].filter(Boolean).join('');
  if (info.reason === 'daily_limit') return new StorageError('DAILY_CARE_LIMIT', `今天${label}已达${info.dailyLimit}次上限，${wait}后可继续；每日北京时间00:00重置。`, 409);
  return new StorageError('CARE_COOLDOWN', `${label}还在冷却中，请等待${wait}后再试。`, 409);
}

/** GitHub Contents API is the source of truth; no successful write is simulated.
 * Each operation is stored with its state in one Git commit before acknowledgment.
 * A retry with the same operation ID is safe after an uncertain network timeout.
 * In-process room queues plus SHA compare-and-swap retries prevent lost updates
 * across instances. The most recent 100 operation IDs remain deduplicated.
 */
export function createGitHubStore({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY || 'stevencheninfilm/cat-nest-data',
  branch = process.env.GITHUB_BRANCH || 'main',
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
  maxRetries = 4,
  now = Date.now,
} = {}) {
  const configured = typeof token === 'string' && token.trim().length > 0 && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository);
  const queues = new Map();
  const cache = new Map();
  const base = `https://api.github.com/repos/${repository}/contents/rooms/`;

  function assertConfigured() {
    if (!configured) throw new StorageError('STORAGE_NOT_CONFIGURED', '云端存档尚未配置，互动暂未保存。');
  }
  function checkId(id) { if (typeof id !== 'string' || !ROOM_ID.test(id)) throw new StorageError('INVALID_ROOM', '小窝链接无效。', 400); }
  function withLock(id, task) {
    const previous = queues.get(id) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    queues.set(id, current);
    return current.finally(() => { if (queues.get(id) === current) queues.delete(id); });
  }
  async function request(id, method, body, etag, blobSha) {
    assertConfigured();
    let response;
    try {
      const url = blobSha ? `https://api.github.com/repos/${repository}/git/blobs/${encodeURIComponent(blobSha)}` : `${base}${id}.json${method === 'GET' ? `?${new URLSearchParams({ ref: branch })}` : ''}`;
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: method === 'GET' && !blobSha ? 'application/vnd.github.object+json' : 'application/vnd.github+json', Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'cat-nest-cloud-save',
          'Cache-Control': 'no-cache', ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(etag ? { 'If-None-Match': etag } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
    } catch { throw new StorageError('STORAGE_UNAVAILABLE', '暂时无法连接云端存档，请重试；尚未确认保存。'); }
    if ([401, 403].includes(response.status)) throw new StorageError('STORAGE_PERMISSION', '云端存档权限或额度暂不可用，请稍后重试。');
    if (response.status === 429) throw new StorageError('STORAGE_RATE_LIMIT', '云端存档请求较多，请稍后重试。');
    return response;
  }

  async function read(id, { missing = false } = {}) {
    checkId(id);
    const cached = cache.get(id);
    const response = await request(id, 'GET', null, cached?.etag);
    if (response.status === 304 && cached) return copy(cached.record);
    if (response.status === 404) {
      cache.delete(id);
      if (missing) return null;
      throw new StorageError('ROOM_NOT_FOUND', '没有找到这个小窝，请检查邀请链接。', 404);
    }
    if (!response.ok) throw new StorageError('STORAGE_UNAVAILABLE', '云端存档暂不可用，请稍后重试。');
    try {
      const data = await response.json();
      if (typeof data.sha !== 'string' || typeof data.content !== 'string') throw new Error();
      let encoded = data.content;
      if (data.encoding === 'none' && data.content === '') {
        // GitHub Contents omits inline content above 1 MB. The blob SHA pins
        // this extra read to the same immutable content used for the CAS write.
        const blobResponse = await request(id, 'GET', null, null, data.sha);
        if (!blobResponse.ok) throw new StorageError('STORAGE_UNAVAILABLE', '云端存档暂不可用，请稍后重试。');
        const blob = await blobResponse.json();
        if (blob.sha !== data.sha || blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new Error();
        encoded = blob.content;
      } else if (data.encoding !== 'base64') throw new Error();
      const room = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      if (room.version !== 1 || room.roomId !== id || !Number.isSafeInteger(room.revision) || room.revision < 0 || !validStoredState(room.state) || !Array.isArray(room.operations) || room.operations.length > 100) throw new Error();
      if (Object.hasOwn(room, 'claimedGrowth') && !validPendingGrowth(room.claimedGrowth)) throw new Error();
      room.claimedGrowth ??= [];
      const claimedIds = new Set(room.claimedGrowth.map(reward => reward.id));
      if (room.state.pendingGrowth?.some(reward => claimedIds.has(reward.id))) throw new Error();
      // Growth receipts and cooperation memories have separately validated,
      // permanent ledgers. Keep the original size limit for other room fields.
      const withoutGrowth = { ...room, state: { ...room.state } };
      // Batch manifests are bounded and validated below, independently of the
      // ordinary room size budget, just like their original growth receipts.
      withoutGrowth.operations = room.operations.map(operation => operation?.event?.action?.type === 'claim-restaurant-growth' ? { ...operation, event:{ ...operation.event, action:{ ...operation.event.action, rewardIds:[] } } } : operation);
      delete withoutGrowth.state.pendingGrowth;
      delete withoutGrowth.claimedGrowth;
      delete withoutGrowth.state.diary;
      if(withoutGrowth.state.games)withoutGrowth.state.games={...withoutGrowth.state.games,localReceipts:[]};
      if (withoutGrowth.state.coupleCare) withoutGrowth.state.coupleCare = { ...withoutGrowth.state.coupleCare, moments:[] };
      if (Buffer.byteLength(JSON.stringify(withoutGrowth), 'utf8') * 4 / 3 > 350_000) throw new Error();
      for (const operation of room.operations) {
        if (!plain(operation) || typeof operation.id !== 'string' || !OPERATION_ID.test(operation.id) || !plain(operation.event) || operation.event.operationId !== operation.id || (!sanitizeAction(operation.event.action)&&!validLocalEvent(operation.event.action)) || !sanitizeActor(operation.event.actor?.id, operation.event.actor?.name)) throw new Error();
      }
      // Migrate only the new optional ledger; preserve the original save fields.
      room.state.collection ??= normalizeState(room.state, now()).collection;
      room.state.diary = normalizeMemoryJournal(room.state.diary,room.state,now(),room.createdAt);
      room.state.restaurant = normalizeRestaurant(room.state.restaurant, now());
      room.state.goldFish ??= 0;
      const record = { room, sha: data.sha };
      cache.set(id, { record, etag: response.headers.get('etag') });
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      return copy(record);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError('STORAGE_CORRUPT', '云端存档格式异常，请联系网站维护者。');
    }
  }

  async function write(room, sha) {
    const response = await request(room.roomId, 'PUT', {
      message: `Save cat room ${room.roomId.slice(0, 8)} revision ${room.revision}`,
      content: Buffer.from(JSON.stringify(room), 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    });
    cache.delete(room.roomId);
    if ([409, 422].includes(response.status)) return false;
    if (!response.ok) throw new StorageError('STORAGE_WRITE_FAILED', '云端存档写入失败，互动尚未确认保存，请重试。');
    return true;
  }

  return {
    configured,
    async createRoom({ initialState: suppliedState } = {}) {
      assertConfigured();
      let id = randomBytes(16).toString('hex');
      for (let attempt = 0; attempt < maxRetries; attempt += 1) {
        const createdAt = now();
        const room = { version: 1, roomId: id, revision: 0, createdAt, updatedAt: createdAt, state: safeState(suppliedState || initialState(createdAt), createdAt), operations: [], claimedGrowth: [] };
        room.state.games = emptyGameHub(createdAt);
        if (await write(room)) return publicRoom(room);
        if (await read(id, { missing: true })) id = randomBytes(16).toString('hex');
      }
      throw new StorageError('STORAGE_CONFLICT', '云端正在处理其他存档，请稍后重试。');
    },
    async getRoom(id) { return publicRoom((await read(id)).room); },
    async applyAction(id, { operationId, clientId, name, action: suppliedAction } = {}) {
      checkId(id);
      const actor = sanitizeActor(clientId, name);
      const action = sanitizeAction(suppliedAction);
      if (!actor || !action || typeof operationId !== 'string' || !OPERATION_ID.test(operationId)) throw new StorageError('INVALID_ACTION', '互动内容或操作编号无效。', 400);
      return withLock(id, async () => {
        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
          const { room, sha } = await read(id);
          const journalAction=action.type==='game-local-finish'?localGameReceipt(action):action;
          const duplicate = room.operations.find(operation => operation.id === operationId);
          if (duplicate) {
            if (duplicate.event.actor.id !== actor.id || JSON.stringify(duplicate.event.action) !== JSON.stringify(journalAction)) throw new StorageError('OPERATION_CONFLICT', '这个操作编号已用于另一项互动。', 409);
            return { ...publicRoom(room), event: publicGameEvent(duplicate.event), duplicate: true };
          }
          if(action.type==='game-local-finish'){
            const receipt=room.state.games.localReceipts?.find(r=>r.id===action.session.id);
            if(receipt){if(receipt.actorId!==actor.id)throw new StorageError('OPERATION_CONFLICT','这个对局编号已用于另一位玩家。',409);return {...publicRoom(room),event:{operationId,action:journalAction,actor},duplicate:true};}
            if(room.state.games.match?.id===action.session.id||room.state.pendingGrowth?.some(r=>r.id===`game:${action.session.id}`)||room.claimedGrowth.some(r=>r.id===`game:${action.session.id}`))throw new StorageError('OPERATION_CONFLICT','这个对局编号已经使用。',409);
          }
          const invitation = room.state.collection?.sceneInvited?.find(record=>record.operationId===operationId) || room.state.collection?.invited.find(record => record.operationId === operationId);
          if (action.type === 'game-create' && (room.state.games.localReceipts?.some(r=>r.id===operationId)||room.state.pendingGrowth?.some(reward => reward.id === `game:${operationId}`) || room.claimedGrowth.some(reward => reward.id === `game:${operationId}`))) throw new StorageError('OPERATION_CONFLICT','这个操作编号已用于已结算的小游戏。',409);
          if (invitation) {
            if (invitation.actorId !== actor.id || action.type !== 'invite-cat' || action.catId !== invitation.id || (action.sceneId || 'station') !== (invitation.sceneId || 'station')) throw new StorageError('OPERATION_CONFLICT', '这个操作编号已用于另一项互动。', 409);
            return { ...publicRoom(room), event:{ operationId, action, actor }, duplicate:true };
          }
          // The short operation journal may roll over while a device is away.
          // A saved reward or permanent receipt still identifies its original
          // care operation, so replay can never regenerate a collected bubble.
          const produced = room.state.pendingGrowth?.find(reward => reward.id === operationId)
            || room.claimedGrowth.find(reward => reward.id === operationId);
          if (produced) {
            if (produced.actorId !== actor.id || produced.kind !== action.type || produced.furniture !== action.furniture || (action.type === 'feed' && produced.food !== action.food) || (action.type === 'restaurant-collect' && produced.orderId !== action.orderId)) throw new StorageError('OPERATION_CONFLICT', '这个操作编号已用于另一项互动。', 409);
            return { ...publicRoom(room), event: { operationId, action, actor }, duplicate: true };
          }
          if (action.type === 'claim-restaurant-growth') {
            const pending = new Map(room.state.pendingGrowth.map(reward => [reward.id, reward]));
            const claimed = new Map(room.claimedGrowth.map(reward => [reward.id, reward]));
            if (action.rewardIds.some(id => !isRestaurantGrowth(pending.get(id) || claimed.get(id)))) throw new StorageError('GROWTH_REWARD_UNAVAILABLE', '餐厅经验记录已更新，请按最新气泡领取。', 409);
            // A lost acknowledgement or another caregiver's collection cannot
            // mint XP again, even after the short operation journal rolls over.
            if (action.rewardIds.every(id => claimed.has(id))) return { ...publicRoom(room), event: { operationId, action, actor }, duplicate: true };
          }
          const actionAt = now();
          const info = careActionInfo(room.state, action, actor.id, actionAt);
          if (!info.allowed) throw careRejection(action, info, actionAt);
          if (action.type === 'claim-growth' && !room.state.pendingGrowth?.some(reward => reward.id === action.rewardId)) throw new StorageError('REWARD_ALREADY_CLAIMED', '这颗成长气泡已经被领取，或暂时无法找到。', 409);
          if (action.type === 'invite-cat') {
            if (action.sceneId ? collectionSceneInvitation(room.state.collection,action.catId,action.sceneId) : room.state.collection.invited.some(record => record.id === action.catId)) throw new StorageError('CAT_ALREADY_INVITED', '这位猫猫已经来到这个庭院啦。', 409);
            if (!canInviteCat(action.catId, normalizeState(room.state,actionAt).collection, levelInfo(room.state.xp).level,action.sceneId,room.state.diary)) throw new StorageError('CAT_ACHIEVEMENT_REQUIRED', '完成这位猫猫的成就后，就可以邀请它入住。', 409);
          }
          const reduced = reduceAction(copy(room.state), action, actor, actionAt, operationId);
          if (!reduced && action.type.startsWith('restaurant-')) throw new StorageError('RESTAURANT_ACTION_REJECTED',restaurantActionResult(normalizeState(room.state,actionAt),action,actor,actionAt).reason||'餐桌已更新，请按最新小馆继续操作。',409);
          if (!reduced && action.type.startsWith('nest-')) throw new StorageError('NEST_ACTION_REJECTED','布置已更新，或金币、空间不足。请按最新小窝继续摆放。',409);
          if (!reduced && action.type.startsWith('game-')) throw new StorageError('GAME_ACTION_REJECTED', '对局已更新，请按最新回合操作；只有本局玩家可以参与。', 409);
          if (!reduced && ['claim-growth','claim-restaurant-growth'].includes(action.type)) throw new StorageError('GROWTH_REWARD_UNAVAILABLE', '暂时无法领取这颗成长气泡，请稍后重试。', 409);
          if (!reduced && action.type === 'invite-cat') throw new StorageError('CAT_SCENE_UNAVAILABLE', '这个庭院尚未开放，或这位猫友会在其他庭院相遇。', 409);
          if (!reduced) throw new StorageError('ACTION_REJECTED', '当前金币或精力不足，暂时无法完成这项互动。', 409);
          const event = { operationId, action:journalAction, actor };
          const claimIds = new Set(action.type === 'claim-growth' ? [action.rewardId] : action.type === 'claim-restaurant-growth' ? action.rewardIds : []);
          const claimedGrowth = claimIds.size ? [...room.claimedGrowth, ...room.state.pendingGrowth.filter(reward => claimIds.has(reward.id)).map(copy)] : room.claimedGrowth;
          const savedState=safeState(reduced,actionAt);
          if(!restaurantProgressPreserved(room.state.restaurant,savedState.restaurant))throw new StorageError('RESTAURANT_SAVE_GUARD','餐厅存档保护已拦截异常更新，原进度保持不变，请联系维护者。');
          const next = { ...room, revision: room.revision + 1, state: savedState, claimedGrowth, updatedAt: actionAt, operations: [...room.operations, { id: operationId, event }].slice(-100) };
          if (await write(next, sha)) return { ...publicRoom(next), event:publicGameEvent(event), duplicate: false };
          cache.delete(id);
        }
        throw new StorageError('STORAGE_CONFLICT', '两位铲屎官的存档正在合并，请重试这次互动。');
      });
    },
  };
}
