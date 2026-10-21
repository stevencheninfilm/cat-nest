import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGitHubStore, ROOM_ID, sanitizeActor, StorageError } from './github-store.mjs';
import { COUPLE_ROLES } from '../src/couple-profile.js';
import { createModelAssetHandler } from './model-assets.mjs';
import { createGuideHandler } from './guide-api.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

/** Reusable API handler. Use serveStatic:false when mounting in another server.
 * Returns false for unrelated routes; call handler.close() during shutdown.
 * A room's unguessable URL is its bearer capability. Never put GITHUB_TOKEN in
 * frontend variables; use a private repository for names and interaction logs.
 */
export function createPetHandler({
  store = createGitHubStore(),
  corsOrigin = process.env.CORS_ORIGIN || '',
  distDir = process.env.DIST_DIR || resolve(root, 'dist'),
  serveStatic = true,
  heartbeatMs = 15_000,
  pollMs = 15_000,
  maxBodyBytes = 32_768,
  modelAssets = createModelAssetHandler(),
  guideHandler = createGuideHandler(),
  coupleRoomId = process.env.COUPLE_ROOM_ID || '0aed6937627c924a7497025ebd18fe5d',
} = {}) {
  const origins = new Set((Array.isArray(corsOrigin) ? corsOrigin : corsOrigin.split(',')).map(value => value.trim()).filter(Boolean));
  const rooms = new Map();
  const rates = new Map();
  let closed = false;

  function json(response, status, body, extra = {}) {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
    response.end(JSON.stringify(body));
  }
  function fail(response, error) {
    json(response, error instanceof StorageError ? error.status : 500, { error: { code: error instanceof StorageError ? error.code : 'INTERNAL_ERROR', message: error instanceof StorageError ? error.message : '服务暂时不可用，请稍后重试。' } });
  }
  function rate(key, count, duration) {
    const now = Date.now();
    const entry = rates.get(key);
    if (!entry || entry.until < now) { rates.set(key, { count: 1, until: now + duration }); return; }
    entry.count += 1;
    if (rates.size > 10_000) for (const [storedKey, value] of rates) if (value.until < now) rates.delete(storedKey);
    if (entry.count > count) throw new StorageError('TOO_MANY_REQUESTS', '互动太快啦，请稍等片刻再试。', 429);
  }
  function roomActor(id, clientId, name) {
    if (id === coupleRoomId) {
      const profile = COUPLE_ROLES.find(role => role.clientId === clientId);
      if (!profile) throw new StorageError('INVALID_COUPLE_ROLE', '请选择男方或女方后再互动。', 400);
      return { id: profile.clientId, name: profile.name };
    }
    const actor = sanitizeActor(clientId, name);
    if (!actor) throw new StorageError('INVALID_ACTOR', '铲屎官信息无效。', 400);
    return actor;
  }
  async function body(request) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw new StorageError('INVALID_CONTENT_TYPE', '请求需要使用 JSON 格式。', 415);
    if (Number(request.headers['content-length']) > maxBodyBytes) throw new StorageError('BODY_TOO_LARGE', '请求内容过大。', 413);
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > maxBodyBytes) throw new StorageError('BODY_TOO_LARGE', '请求内容过大。', 413);
      chunks.push(chunk);
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch { throw new StorageError('INVALID_JSON', '请求内容不是有效的 JSON 对象。', 400); }
  }
  function emit(response, event, data) {
    if (!response.destroyed && !response.writableEnded) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  function broadcast(hub, event, data) {
    for (const member of hub.members.values()) for (const response of member.responses) emit(response, event, data);
  }
  function presence(hub) { broadcast(hub, 'presence', [...hub.members.values()].map(({ id, name }) => ({ id, name }))); }
  function updateHub(hub, result, event = 'state') {
    if (result.revision <= hub.revision) return;
    hub.revision = result.revision;
    hub.state = result.state;
    hub.restaurantGuestConditions = result.restaurantGuestConditions;
    hub.restaurantGuestConditionsV2 = result.restaurantGuestConditionsV2;
    broadcast(hub, event, { state:result.state, revision:result.revision, restaurantGuestConditions:result.restaurantGuestConditions, restaurantGuestConditionsV2:result.restaurantGuestConditionsV2, ...(event==='action'?{event:result.event}:{}) });
  }
  function makeHub(id, result) {
    const hub = { members: new Map(), revision: result.revision, state: result.state, restaurantGuestConditions:result.restaurantGuestConditions, restaurantGuestConditionsV2:result.restaurantGuestConditionsV2, polling: false, heartbeat: null, poll: null };
    hub.heartbeat = setInterval(() => {
      for (const member of hub.members.values()) for (const response of member.responses) if (!response.destroyed) response.write(': keepalive\n\n');
    }, heartbeatMs);
    hub.poll = setInterval(async () => {
      if (hub.polling || closed) return;
      hub.polling = true;
      try { updateHub(hub, await store.getRoom(id)); }
      catch { broadcast(hub, 'status', { phase: 'offline', message: '云端存档暂不可用，互动暂未确认保存。' }); }
      finally { hub.polling = false; }
    }, pollMs);
    hub.heartbeat.unref?.(); hub.poll.unref?.();
    return hub;
  }
  function clearHub(id, hub) {
    clearInterval(hub.heartbeat); clearInterval(hub.poll);
    if (rooms.get(id) === hub) rooms.delete(id);
  }

  async function handle(request, response) {
    let url;
    try { url = new URL(request.url, 'http://localhost'); } catch { return false; }
    const apiRoute = url.pathname.startsWith('/api/guides/') || url.pathname.startsWith('/api/pet-model/') || url.pathname === '/api/health' || url.pathname === '/api/couple/home' || url.pathname === '/api/rooms' || url.pathname.startsWith('/api/rooms/');
    if (!apiRoute && !serveStatic) return false;
    if (closed) { json(response, 503, { error: { code: 'SHUTTING_DOWN', message: '服务正在重启，请稍后重试。' } }); return true; }
    try {
      if (apiRoute) {
        const origin = request.headers.origin;
        if (origin) {
          // Render terminates HTTPS at its proxy; allow its own frontend origin
          // while still restricting every separate origin to the exact list.
          const protocol = request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
          const ownOrigin = `${protocol}://${request.headers.host}`;
          if (!origins.has(origin) && origin !== ownOrigin) throw new StorageError('ORIGIN_NOT_ALLOWED', '此网站来源未获允许。', 403);
          response.setHeader('Access-Control-Allow-Origin', origin);
          response.setHeader('Vary', 'Origin');
        }
        if (request.method === 'OPTIONS') {
          response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
          response.end(); return true;
        }
        if (await modelAssets(request, response, url)) return true;
        if (await guideHandler(request,response,url,{json,body})) return true;
        if (url.pathname === '/api/health' && request.method === 'GET') {
          json(response, store.configured ? 200 : 503, { ok: !!store.configured, configured: !!store.configured, storage: store.storage || 'github' }); return true;
        }
        if (url.pathname === '/api/couple/home') {
          if (request.method !== 'GET') {
            json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '这个接口不支持当前请求方式。' } }, { Allow: 'GET' }); return true;
          }
          if (typeof coupleRoomId !== 'string' || !ROOM_ID.test(coupleRoomId)) throw new StorageError('INVALID_COUPLE_HOME', '共同小窝配置无效，请联系网站维护者。', 503);
          // Read only: a missing or inaccessible save must never create a new home.
          json(response, 200, { ...await store.getRoom(coupleRoomId), roles: COUPLE_ROLES }); return true;
        }
        if (url.pathname === '/api/rooms' && request.method === 'POST') {
          rate(`create:${request.socket.remoteAddress}`, 10, 3_600_000);
          const input = await body(request);
          if (input.name !== undefined && !sanitizeActor('create-user', input.name)) throw new StorageError('INVALID_NAME', '昵称需要 1–20 个字符。', 400);
          if (input.initialState !== undefined && (input.initialState === null || typeof input.initialState !== 'object' || Array.isArray(input.initialState))) throw new StorageError('INVALID_STATE', '初始存档格式无效。', 400);
          json(response, 201, await store.createRoom(input)); return true;
        }
        const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})(?:\/(actions|events))?$/);
        if (!match || !ROOM_ID.test(match[1])) { json(response, 404, { error: { code: 'NOT_FOUND', message: '没有找到这个接口。' } }); return true; }
        const [, id, route] = match;
        if (!route && request.method === 'GET') { json(response, 200, await store.getRoom(id)); return true; }
        if (route === 'actions' && request.method === 'POST') {
          const input = await body(request);
          const actor = roomActor(id, input.clientId, input.name);
          const hub = rooms.get(id);
          if (hub?.members.size >= 2 && !hub.members.has(actor.id)) throw new StorageError('ROOM_FULL', '这个小窝已经有两位铲屎官啦。', 409);
          rate(`action:${id}:${actor.id}`, 90, 60_000);
          const result = await store.applyAction(id, { ...input, clientId: actor.id, name: actor.name });
          // The GitHub commit has completed before any response or live event.
          if (hub && !result.duplicate) updateHub(hub, result, 'action');
          json(response, 200, result); return true;
        }
        if (route === 'events' && request.method === 'GET') {
          const actor = roomActor(id, url.searchParams.get('clientId'), url.searchParams.get('name'));
          const result = await store.getRoom(id);
          if (request.destroyed || response.destroyed) return true;
          let hub = rooms.get(id);
          if (!hub) { hub = makeHub(id, result); rooms.set(id, hub); }
          if (hub.members.size >= 2 && !hub.members.has(actor.id)) {
            // EventSource cannot read an HTTP error body. An explicit event lets
            // the client stop reconnecting and show the actual room-full state.
            response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
            emit(response, 'full', { message: '这个小窝已经有两位铲屎官啦。' });
            response.end(); return true;
          }
          updateHub(hub, result);
          let member = hub.members.get(actor.id);
          if (!member) { member = { ...actor, responses: new Set() }; hub.members.set(actor.id, member); }
          member.name = actor.name;
          member.responses.add(response);
          response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
          response.write(': connected\n\n');
          emit(response, 'state', { state: hub.state, revision: hub.revision, restaurantGuestConditions:hub.restaurantGuestConditions, restaurantGuestConditionsV2:hub.restaurantGuestConditionsV2 });
          presence(hub);
          response.on('close', () => {
            member.responses.delete(response);
            if (!member.responses.size) hub.members.delete(actor.id);
            if (!hub.members.size) clearHub(id, hub);
            else presence(hub);
          });
          return true;
        }
        json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '这个接口不支持当前请求方式。' } }, { Allow: route === 'actions' ? 'POST' : 'GET' }); return true;
      }
      if (!['GET', 'HEAD'].includes(request.method)) return false;
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); } catch { json(response, 400, { error: { code: 'INVALID_PATH', message: '网址无效。' } }); return true; }
      const directory = resolve(distDir);
      let target = resolve(directory, `.${decoded}`);
      if (target !== directory && !target.startsWith(`${directory}${sep}`)) { json(response, 404, { error: { code: 'NOT_FOUND', message: '页面不存在。' } }); return true; }
      try { if (!(await stat(target)).isFile()) target = resolve(directory, 'index.html'); }
      catch { if (extname(decoded)) return false; target = resolve(directory, 'index.html'); }
      try {
        const content = await readFile(target);
        response.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream', 'Content-Length': content.length, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600' });
        response.end(request.method === 'HEAD' ? undefined : content); return true;
      } catch { return false; }
    } catch (error) { fail(response, error); return true; }
  }
  handle.close = () => {
    closed = true;
    for (const [id, hub] of rooms) {
      for (const member of hub.members.values()) for (const response of member.responses) response.end();
      clearHub(id, hub);
    }
    rates.clear();
  };
  return handle;
}

export function createPetServer(options = {}) {
  const handler = createPetHandler(options);
  const server = createServer(async (request, response) => {
    if (!await handler(request, response) && !response.headersSent) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: '页面不存在。' } }));
    }
  });
  server.on('close', handler.close);
  server.petHandler = handler;
  server.shutdown = () => { handler.close(); server.close(); };
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const server = createPetServer();
  const port = Number(process.env.PORT || 10000);
  server.listen(port, '0.0.0.0', () => console.log(`Cat nest service listening on port ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { server.shutdown(); setTimeout(() => process.exit(0), 5000).unref(); });
}
