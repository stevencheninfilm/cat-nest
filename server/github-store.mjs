import { randomBytes } from 'node:crypto';
import { FOODS, initialState, normalizeState, reduceAction } from '../src/state.js';

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
  const keys = Object.keys(value);
  if (value.type === 'feed' && keys.length === 2 && keys.includes('food') && typeof value.food === 'string' && Object.hasOwn(FOODS, value.food)) return { type: 'feed', food: value.food };
  if (['pet', 'play', 'sleep'].includes(value.type) && keys.length === 1) return { type: value.type };
  if (value.type === 'rename' && keys.length === 2 && keys.includes('name') && validText(value.name, 16)) return { type: 'rename', name: value.name.trim() };
  return null;
}

export function sanitizeActor(clientId, name) {
  return typeof clientId === 'string' && CLIENT_ID.test(clientId) && validText(name, 20) ? { id: clientId, name: name.trim() } : null;
}

function safeState(value) {
  const next = normalizeState(value);
  if (!validText(next.name, 16)) next.name = '糯米';
  next.history = next.history.map(item => ({ text: item.text.slice(0, 200), actor: item.actor.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20) || '猫友', at: item.at }));
  return next;
}

function validStoredState(value) {
  if (!plain(value) || value.version !== 1 || !validText(value.name, 16) || typeof value.sleeping !== 'boolean' || !Number.isFinite(value.updatedAt)) return false;
  for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy']) {
    const max = ['coins', 'love', 'xp'].includes(key) ? 999999 : 100;
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > max) return false;
  }
  return Array.isArray(value.history) && value.history.length <= 40 && value.history.every(item => plain(item) && typeof item.text === 'string' && item.text.length <= 200 && typeof item.actor === 'string' && item.actor.length <= 20 && Number.isFinite(item.at));
}

function publicRoom(room) { return { roomId: room.roomId, state: copy(room.state), revision: room.revision }; }

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
  async function request(id, method, body, etag) {
    assertConfigured();
    let response;
    try {
      response = await fetchImpl(`${base}${id}.json${method === 'GET' ? `?${new URLSearchParams({ ref: branch })}` : ''}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
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
      if (data.encoding !== 'base64' || typeof data.content !== 'string' || data.content.length > 350_000 || typeof data.sha !== 'string') throw new Error();
      const room = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      if (room.version !== 1 || room.roomId !== id || !Number.isSafeInteger(room.revision) || room.revision < 0 || !validStoredState(room.state) || !Array.isArray(room.operations) || room.operations.length > 100) throw new Error();
      for (const operation of room.operations) {
        if (!plain(operation) || typeof operation.id !== 'string' || !OPERATION_ID.test(operation.id) || !plain(operation.event) || operation.event.operationId !== operation.id || !sanitizeAction(operation.event.action) || !sanitizeActor(operation.event.actor?.id, operation.event.actor?.name)) throw new Error();
      }
      const record = { room, sha: data.sha };
      cache.set(id, { record, etag: response.headers.get('etag') });
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      return copy(record);
    } catch { throw new StorageError('STORAGE_CORRUPT', '云端存档格式异常，请联系网站维护者。'); }
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
        const now = Date.now();
        const room = { version: 1, roomId: id, revision: 0, createdAt: now, updatedAt: now, state: safeState(suppliedState || initialState()), operations: [] };
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
          const duplicate = room.operations.find(operation => operation.id === operationId);
          if (duplicate) {
            if (duplicate.event.actor.id !== actor.id || JSON.stringify(duplicate.event.action) !== JSON.stringify(action)) throw new StorageError('OPERATION_CONFLICT', '这个操作编号已用于另一项互动。', 409);
            return { ...publicRoom(room), event: copy(duplicate.event), duplicate: true };
          }
          const reduced = reduceAction(copy(room.state), action, actor);
          if (!reduced) throw new StorageError('ACTION_REJECTED', '当前金币或精力不足，暂时无法完成这项互动。', 409);
          const event = { operationId, action, actor };
          const next = { ...room, revision: room.revision + 1, state: safeState(reduced), updatedAt: Date.now(), operations: [...room.operations, { id: operationId, event }].slice(-100) };
          if (await write(next, sha)) return { ...publicRoom(next), event, duplicate: false };
          cache.delete(id);
        }
        throw new StorageError('STORAGE_CONFLICT', '两位铲屎官的存档正在合并，请重试这次互动。');
      });
    },
  };
}
