import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { StorageError } from './github-store.mjs';

export const STEVEN_ROOM_ID = '0aed6937627c924a7497025ebd18fe5d';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest();

/** Protect the existing save without copying, reseeding or changing its ID. */
export function createStevenAccess({ key = process.env.STEVEN_ACCESS_KEY || '', roomId = STEVEN_ROOM_ID, now = Date.now } = {}) {
  const tickets = new Map();
  const configured = typeof key === 'string' && key.length >= 24;
  const denied = () => { throw new StorageError('ACCESS_REQUIRED', '请先解锁私人小窝。', 401); };
  function requireConfigured() {
    if (!configured) throw new StorageError('ACCESS_NOT_CONFIGURED', '私人小窝暂未完成访问配置，存档已锁定。', 503);
  }
  function sign(payload) { return createHmac('sha256', key).update(`catnest-steven-session:${payload}`).digest('base64url'); }
  function verify(request) {
    requireConfigured();
    const token = /^Bearer (\S+)$/i.exec(request.headers.authorization || '')?.[1] || '';
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra || token.length > 1500 || !timingSafeEqual(digest(signature), digest(sign(payload)))) denied();
    let claims;
    try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { denied(); }
    if (claims.room !== roomId || claims.scope !== 'steven' || !Number.isSafeInteger(claims.expires) || claims.expires <= now() || claims.expires > now() + SESSION_MS) denied();
    return claims;
  }
  return {
    roomId,
    login(password) {
      requireConfigured();
      if (typeof password !== 'string' || password.length > 512 || !timingSafeEqual(digest(password), digest(key))) denied();
      const expires = now() + SESSION_MS;
      const payload = Buffer.from(JSON.stringify({ room:roomId, scope:'steven', expires, nonce:randomBytes(16).toString('base64url') })).toString('base64url');
      return { token:`${payload}.${sign(payload)}`, expires };
    },
    verify,
    ticket(request, actorId) {
      const claims = verify(request);
      for (const [id, item] of tickets) if (item.expires <= now()) tickets.delete(id);
      if (tickets.size >= 1000) throw new StorageError('TOO_MANY_REQUESTS', '请稍后重新连接。', 429);
      const ticket = randomBytes(32).toString('base64url');
      tickets.set(ticket, { actorId, expires:Math.min(now() + 60_000, claims.expires), sessionExpires:claims.expires });
      return { ticket, expires:60 };
    },
    verifyStream(url) {
      requireConfigured();
      const ticket = url.searchParams.get('ticket');
      const item = tickets.get(ticket);
      tickets.delete(ticket);
      if (!item || item.expires <= now() || item.actorId !== url.searchParams.get('clientId')) denied();
      return item.sessionExpires;
    },
    close() { tickets.clear(); },
  };
}
