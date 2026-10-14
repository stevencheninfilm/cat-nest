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
const CLIENT_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const validTime = value => Number.isSafeInteger(value) && value >= 0;
const cleanName = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || '猫友' : '猫友';
const validFood = key => typeof key === 'string' && Object.hasOwn(FOODS, key);
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
  return { version: 1, name: '糯米', coins: 1200, love: 86, xp: 86, hunger: 68, mood: 82, energy: 76, sleeping: false, history: [], feedRecords: [], feedingWindow: null, updatedAt: validTime(now) ? now : 0 };
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
  next.history = Array.isArray(value.history) ? value.history.filter(x => x && typeof x.text === 'string' && typeof x.actor === 'string' && Number.isFinite(x.at)).slice(0, 40) : [];
  if (validTime(value.updatedAt) && value.updatedAt <= now + 60_000) next.updatedAt = value.updatedAt;
  next.feedRecords = feedRecords(value.feedRecords, now);
  if (value.feedingWindow && validTime(value.feedingWindow.startedAt) && value.feedingWindow.startedAt <= now + 60_000) {
    next.feedingWindow = { startedAt: value.feedingWindow.startedAt, bonusClaimed: value.feedingWindow.bonusClaimed === true };
  }
  return next;
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
  state.feedingWindow.bonusClaimed = true;
  state.love += FEEDING_BONUS;
  state.xp += FEEDING_BONUS;
  return true;
}
export function reduceAction(state, action, actor = { name: '铲屎官' }, now = Date.now()) {
  now = validTime(now) ? now : 0;
  if (!action || typeof action !== 'object') return null;
  const current = normalizeState(state, now);
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
    case 'rename':
      if (typeof action.name !== 'string' || !action.name.trim()) return null;
      next.name = action.name.trim().slice(0, 16); text = `给小猫取名「${next.name}」`; break;
    default: return null;
  }
  next.history.unshift({ text, actor: cleanName(actor?.name).slice(0, 16), at: next.updatedAt });
  next.history = next.history.slice(0, 40);
  return normalizeState(next, now);
}
export function levelInfo(xp) {
  const level = Math.floor(xp / 120) + 1;
  return { level, progress: xp % 120, target: 120 };
}
