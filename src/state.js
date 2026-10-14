import { normalizeAppearance, validAppearance } from './mage-cat-config.js';

export const FOODS = {
  snack: { name: '冻干小鱼', cost: 10, love: 10, hunger: 10 },
  meal: { name: '营养猫粮', cost: 20, love: 25, hunger: 22 },
  fish: { name: '鲜鱼罐罐', cost: 40, love: 50, hunger: 35 },
  chicken: { name: '鸡胸肉', cost: 30, love: 35, hunger: 28 },
  shrimp: { name: '鲜虾小餐', cost: 30, love: 30, hunger: 24 },
  salmon: { name: '三文鱼块', cost: 45, love: 45, hunger: 32 },
  mousse: { name: '幼猫慕斯', cost: 35, love: 40, hunger: 30 },
  treat: { name: '猫咪肉条', cost: 15, love: 15, hunger: 12 },
  water: { name: '清清饮水', cost: 5, love: 5, hunger: 0 },
};
export const FEEDING_WINDOW_MS = 4 * 60 * 60 * 1000;
export const FEEDING_BONUS = 10;
export const CARE_TIME_ZONE = 'Asia/Shanghai';
export const CARE_LIMITS = Object.freeze({
  feed: Object.freeze({ dailyLimit: 6, cooldownMs: FEEDING_WINDOW_MS }),
  pet: Object.freeze({ dailyLimit: 20, cooldownMs: 5 * 60 * 1000 }),
  play: Object.freeze({ dailyLimit: 10, cooldownMs: 30 * 60 * 1000 }),
  sleep: Object.freeze({ dailyLimit: 3, cooldownMs: FEEDING_WINDOW_MS }),
  pair: Object.freeze({ dailyLimit: 3, cooldownMs: 0 }),
});
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_OFFSET_MS = 8 * 60 * 60 * 1000;
const careDay = now => Math.floor((now + DAY_OFFSET_MS) / DAY_MS);
const CLIENT_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const validTime = value => Number.isSafeInteger(value) && value >= 0;
const cleanName = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || '猫友' : '猫友';
const validFood = key => typeof key === 'string' && Object.hasOwn(FOODS, key);
function emptyCareLimits(now) {
  return {
    day: careDay(now),
    counts: { feed: 0, pet: 0, play: 0, sleep: 0, pair: 0 },
    lastActions: { feed: null, pet: null, play: null, sleep: null },
    feedCooldowns: [],
  };
}
/** Missing ledgers are allowed by the store for legacy saves; present ones must be valid. */
export function validCareLimits(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isSafeInteger(value.day) || value.day < 0) return false;
  if (!value.counts || typeof value.counts !== 'object' || Array.isArray(value.counts)) return false;
  for (const [type, rule] of Object.entries(CARE_LIMITS)) {
    if (!Number.isSafeInteger(value.counts[type]) || value.counts[type] < 0 || value.counts[type] > rule.dailyLimit) return false;
  }
  if (!value.lastActions || typeof value.lastActions !== 'object' || Array.isArray(value.lastActions)) return false;
  for (const type of ['feed', 'pet', 'play', 'sleep']) {
    if (value.lastActions[type] !== null && !validTime(value.lastActions[type])) return false;
  }
  if (!Array.isArray(value.feedCooldowns) || value.feedCooldowns.length > 12) return false;
  const ids = new Set();
  return value.feedCooldowns.every(record => {
    if (!record || typeof record.actorId !== 'string' || !CLIENT_ID.test(record.actorId) || !validTime(record.at) || ids.has(record.actorId)) return false;
    ids.add(record.actorId);
    return true;
  });
}
function normalizeCareLimits(value, now) {
  const next = emptyCareLimits(now);
  if (!value || typeof value !== 'object') return next;
  // Only advance the day: clock rollback must not grant another daily allowance.
  if (Number.isSafeInteger(value.day) && value.day >= next.day) {
    next.day = value.day;
    for (const [type, rule] of Object.entries(CARE_LIMITS)) {
      const count = value.counts?.[type];
      if (Number.isSafeInteger(count) && count >= 0) next.counts[type] = Math.min(rule.dailyLimit, count);
    }
  }
  // Cooldowns continue across midnight; resetting counts never resets timers.
  for (const type of Object.keys(next.lastActions)) {
    const at = value.lastActions?.[type];
    if (validTime(at)) next.lastActions[type] = at;
  }
  if (Array.isArray(value.feedCooldowns)) {
    for (const item of value.feedCooldowns.slice(0, 100)) {
      if (!item || typeof item.actorId !== 'string' || !CLIENT_ID.test(item.actorId) || !validTime(item.at) || item.at + CARE_LIMITS.feed.cooldownMs <= now) continue;
      const previous = next.feedCooldowns.find(record => record.actorId === item.actorId);
      if (previous) previous.at = Math.max(previous.at, item.at);
      else next.feedCooldowns.push({ actorId: item.actorId, at: item.at });
    }
    next.feedCooldowns.sort((a, b) => b.at - a.at);
    next.feedCooldowns = next.feedCooldowns.slice(0, 12);
  }
  return next;
}
function feedRecords(value, now) {
  if (!Array.isArray(value)) return [];
  const records = [];
  for (const item of value.slice(0, 100)) {
    if (!item || typeof item.actorId !== 'string' || !CLIENT_ID.test(item.actorId) || !validFood(item.food) || !validTime(item.at) || item.at > now + 60_000) continue;
    const record = { actorId: item.actorId, name: cleanName(item.name), food: item.food, at: item.at };
    const index = records.findIndex(previous => previous.actorId === item.actorId);
    if (index < 0) records.push(record);
    else if (item.at >= records[index].at) records[index] = record;
  }
  return records.slice(0, 2);
}
export function initialState(now = Date.now()) {
  now = validTime(now) ? now : 0;
  return { version: 1, name: '糯米', coins: 1200, love: 86, xp: 86, hunger: 68, mood: 82, energy: 76, sleeping: false, history: [], feedRecords: [], feedingWindow: null, careLimits: emptyCareLimits(now), appearance: normalizeAppearance(), updatedAt: now };
}
const cap = n => Math.max(0, Math.min(100, n));
export function normalizeState(value, now = Date.now()) {
  now = validTime(now) ? now : 0;
  const fallback = initialState(now);
  if (!value || value.version !== 1) return fallback;
  const next = { ...fallback };
  for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy']) {
    if (Number.isFinite(value[key])) next[key] = Math.max(0, Math.min(key === 'coins' || key === 'love' || key === 'xp' ? 999999 : 100, Math.round(value[key])));
  }
  next.name = typeof value.name === 'string' ? value.name.trim().slice(0, 16) || fallback.name : fallback.name;
  next.sleeping = value.sleeping === true;
  next.appearance = normalizeAppearance(value.appearance);
  next.history = Array.isArray(value.history) ? value.history.filter(x => x && typeof x.text === 'string' && typeof x.actor === 'string' && Number.isFinite(x.at)).slice(0, 40) : [];
  if (validTime(value.updatedAt) && value.updatedAt <= now + 60_000) next.updatedAt = value.updatedAt;
  next.feedRecords = feedRecords(value.feedRecords, now);
  next.careLimits = normalizeCareLimits(value.careLimits, now);
  if (value.feedingWindow && validTime(value.feedingWindow.startedAt) && value.feedingWindow.startedAt <= now + 60_000) {
    next.feedingWindow = { startedAt: value.feedingWindow.startedAt, bonusClaimed: value.feedingWindow.bonusClaimed === true };
  }
  return next;
}
function careInfo(current, action, actorId, now) {
  const type = action?.type;
  const rule = Object.hasOwn(CARE_LIMITS, type) ? CARE_LIMITS[type] : null;
  if (!rule) return { allowed: true, reason: null, dailyLimit: null, used: 0, remaining: null, cooldownMs: 0, remainingMs: 0, availableAt: now, isWake: false };
  const isWake = type === 'sleep' && current.sleeping;
  const used = current.careLimits.counts[type];
  let lastAt = current.careLimits.lastActions[type] ?? null;
  if (type === 'feed' && typeof actorId === 'string' && CLIENT_ID.test(actorId)) {
    lastAt = current.careLimits.feedCooldowns.find(record => record.actorId === actorId)?.at
      ?? current.feedRecords.find(record => record.actorId === actorId)?.at ?? null;
  }
  const cooldownEndsAt = lastAt === null ? now : lastAt + rule.cooldownMs;
  const remainingMs = isWake ? 0 : Math.max(0, cooldownEndsAt - now);
  const remaining = Math.max(0, rule.dailyLimit - used);
  const reason = isWake ? null : remaining === 0 ? 'daily_limit' : remainingMs > 0 ? 'cooldown' : null;
  const resetAt = (current.careLimits.day + 1) * DAY_MS - DAY_OFFSET_MS;
  return {
    allowed: reason === null, reason, dailyLimit: rule.dailyLimit, used, remaining,
    cooldownMs: rule.cooldownMs, remainingMs,
    availableAt: isWake ? now : Math.max(now, cooldownEndsAt, remaining === 0 ? resetAt : now), isWake,
  };
}
/** Read-only availability shared by the UI and the authoritative server reducer. */
export function careActionInfo(state, action, actorId, now = Date.now()) {
  now = validTime(now) ? now : 0;
  return careInfo(normalizeState(state, now), action, actorId, now);
}
function recordCare(state, type, actorId, now) {
  state.careLimits.counts[type] += 1;
  if (type === 'pair') return;
  state.careLimits.lastActions[type] = now;
  if (type === 'feed' && typeof actorId === 'string' && CLIENT_ID.test(actorId)) {
    const record = state.careLimits.feedCooldowns.find(item => item.actorId === actorId);
    if (record) record.at = now;
    else state.careLimits.feedCooldowns.push({ actorId, at: now });
  }
}
/** Four-hour food timers are derived from saved timestamps, never ticking state.
 * The reward window is shared by the room and does not restart on repeat feeds.
 * Presence is deliberately irrelevant: an offline partner keeps their record.
 */
export function feedingInfo(state, actorId, now = Date.now()) {
  now = validTime(now) ? now : 0;
  const normalized = normalizeState(state, now);
  const window = normalized.feedingWindow;
  const windowStartedAt = window?.startedAt ?? null;
  const windowEndsAt = window ? window.startedAt + FEEDING_WINDOW_MS : null;
  const windowActive = Boolean(window && now >= window.startedAt && now < windowEndsAt);
  const records = normalized.feedRecords.map(record => {
    const expiresAt = record.at + FEEDING_WINDOW_MS;
    const active = now >= record.at && now < expiresAt;
    return { ...record, expiresAt, remainingMs: active ? expiresAt - now : 0, active, isMine: record.actorId === actorId, inCurrentWindow: windowActive && active && record.at >= windowStartedAt };
  });
  const mine = records.find(record => record.isMine) || null;
  const partner = records.find(record => !record.isMine) || null;
  const bothFed = records.length === 2 && records.every(record => record.inCurrentWindow);
  const bonusClaimed = window?.bonusClaimed === true;
  return {
    records, mine, partner, windowStartedAt, windowEndsAt, windowActive,
    windowRemainingMs: windowActive ? windowEndsAt - now : 0,
    hasFed: mine?.active === true, bothFed, bonusClaimed,
    bonusEligible: windowActive && bothFed && !bonusClaimed,
    waitingForPartner: windowActive && mine?.inCurrentWindow === true && !bothFed && !bonusClaimed,
  };
}
function recordFeeding(state, food, actor, now) {
  if (!actor || typeof actor.id !== 'string' || !CLIENT_ID.test(actor.id)) return false;
  if (!state.feedingWindow || now < state.feedingWindow.startedAt || now >= state.feedingWindow.startedAt + FEEDING_WINDOW_MS) {
    state.feedingWindow = { startedAt: now, bonusClaimed: false };
  }
  const record = { actorId: actor.id, name: cleanName(actor.name), food, at: now };
  let index = state.feedRecords.findIndex(previous => previous.actorId === actor.id);
  if (index < 0 && state.feedRecords.length < 2) index = state.feedRecords.length;
  // A third device cannot displace either active caregiver to earn extra rewards.
  // Once a record expires, another caregiver may take that slot in a later round.
  if (index < 0) {
    let oldest = Infinity;
    state.feedRecords.forEach((previous, slot) => {
      if (previous.at + FEEDING_WINDOW_MS <= now && previous.at < oldest) { oldest = previous.at; index = slot; }
    });
  }
  if (index < 0) return false;
  state.feedRecords[index] = record;
  if (!feedingInfo(state, actor.id, now).bonusEligible) return false;
  // The round is completed even after today's reward quota has been exhausted.
  state.feedingWindow.bonusClaimed = true;
  if (!careInfo(state, { type: 'pair' }, actor.id, now).allowed) return false;
  recordCare(state, 'pair', actor.id, now);
  state.love += FEEDING_BONUS;
  state.xp += FEEDING_BONUS;
  return true;
}
export function reduceAction(state, action, actor = { name: '铲屎官' }, now = Date.now()) {
  now = validTime(now) ? now : 0;
  if (!action || typeof action !== 'object') return null;
  const current = normalizeState(state, now);
  const care = careInfo(current, action, actor?.id, now);
  if (!care.allowed) return null;
  const next = { ...current, history: [...current.history], feedRecords: [...current.feedRecords], feedingWindow: current.feedingWindow ? { ...current.feedingWindow } : null, updatedAt: now };
  let text;
  switch (action.type) {
    case 'feed': {
      if (!validFood(action.food)) return null;
      const food = FOODS[action.food];
      if (next.coins < food.cost) return null;
      next.coins -= food.cost; next.love += food.love; next.xp += food.love;
      next.hunger = cap(next.hunger + food.hunger); next.mood = cap(next.mood + 4); next.sleeping = false;
      text = `喂了一份${food.name}`;
      if (recordFeeding(next, action.food, actor, now)) text += '，双人喂养额外获得10点亲密度与成长';
      break;
    }
    case 'pet':
      next.love += 3; next.xp += 3; next.mood = cap(next.mood + 6); next.sleeping = false; text = '温柔地摸了摸小猫'; break;
    case 'play':
      if (next.energy < 8) return null;
      next.energy = cap(next.energy - 8); next.hunger = cap(next.hunger - 3); next.mood = cap(next.mood + 10);
      next.coins += 10; next.love += 5; next.xp += 8; next.sleeping = false; text = '陪小猫玩了逗猫棒'; break;
    case 'sleep':
      next.sleeping = !next.sleeping; next.energy = cap(next.energy + (next.sleeping ? 20 : 0)); next.xp += next.sleeping ? 4 : 0;
      text = next.sleeping ? '陪小猫打了个盹' : '轻轻叫醒了小猫'; break;
    case 'dress':
      if (!validAppearance(action.appearance)) return null;
      next.appearance = normalizeAppearance(action.appearance); text = '给小猫换上了新的魔法装扮'; break;
    case 'rename':
      if (typeof action.name !== 'string' || !action.name.trim()) return null;
      next.name = action.name.trim().slice(0, 16); text = `给小猫取名「${next.name}」`; break;
    default: return null;
  }
  if (Object.hasOwn(CARE_LIMITS, action.type) && !care.isWake) recordCare(next, action.type, actor?.id, now);
  next.history.unshift({ text, actor: cleanName(actor?.name).slice(0, 16), at: next.updatedAt });
  next.history = next.history.slice(0, 40);
  return normalizeState(next, now);
}
export function levelInfo(xp) {
  const level = Math.floor(xp / 120) + 1;
  return { level, progress: xp % 120, target: 120 };
}
