import { normalizeAppearance, validAppearance } from './mage-cat-config.js';
import { emptyCollection, normalizeCollection, canInviteCat, getCollectionCat, recordCollectionCare, recordCollectionVictory, recordCollectionAchievements } from './cat-collection.js';
import { petNeeds, growthRewardAmount, addGrowthExperience, CARE_NEED_EFFECTS, PLAY_ENERGY_COST } from './pet-needs.js';
import { GAMES, emptyGameHub, normalizeGameHub, reduceGameHub } from './minigames.js';
import { emptyCoupleCare, normalizeCoupleCare, recordCoupleCare } from './couple-care.js';
import { emptyMemoryJournal, normalizeMemoryJournal, recordMemoryJournal, favoriteMemory } from './memory-journal.js';

export const FOODS = {
  snack: { name: '冻干小鱼', cost: 10, love: 10, hunger: 10, energy: 6 },
  meal: { name: '营养猫粮', cost: 20, love: 25, hunger: 22, energy: 6 },
  fish: { name: '鲜鱼罐罐', cost: 40, love: 50, hunger: 35, energy: 6 },
  chicken: { name: '鸡胸肉', cost: 30, love: 35, hunger: 28, energy: 6 },
  shrimp: { name: '鲜虾小餐', cost: 30, love: 30, hunger: 24, energy: 6 },
  salmon: { name: '三文鱼块', cost: 45, love: 45, hunger: 32, energy: 6 },
  mousse: { name: '幼猫慕斯', cost: 35, love: 40, hunger: 30, energy: 6 },
  treat: { name: '猫咪肉条', cost: 15, love: 15, hunger: 12, energy: 6 },
  water: { name: '清清饮水', cost: 5, love: 5, hunger: 0, energy: 8 },
};
export const FEEDING_WINDOW_MS = 4 * 60 * 60 * 1000;
export const FOOD_COOLDOWN_MS = Object.freeze({
  water: 30 * 60_000,
  snack: 45 * 60_000,
  treat: 60 * 60_000,
  meal: 90 * 60_000,
  shrimp: 120 * 60_000,
  chicken: 150 * 60_000,
  mousse: 180 * 60_000,
  salmon: 210 * 60_000,
  fish: 240 * 60_000,
});
export const foodCooldownMs = food => typeof food === 'string' && Object.hasOwn(FOOD_COOLDOWN_MS, food) ? FOOD_COOLDOWN_MS[food] : FEEDING_WINDOW_MS;
export const FEEDING_BONUS = 10;
export const CARE_TIME_ZONE = 'Asia/Shanghai';
export const CARE_LIMITS = Object.freeze({
  feed: Object.freeze({ dailyLimit: 10, cooldownMs: FEEDING_WINDOW_MS }),
  pet: Object.freeze({ dailyLimit: 20, cooldownMs: 5 * 60 * 1000 }),
  play: Object.freeze({ dailyLimit: 10, cooldownMs: 30 * 60 * 1000 }),
  sleep: Object.freeze({ dailyLimit: 3, cooldownMs: FEEDING_WINDOW_MS }),
  pair: Object.freeze({ dailyLimit: 3, cooldownMs: 0 }),
});
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_OFFSET_MS = 8 * 60 * 60 * 1000;
const careDay = now => Math.floor((now + DAY_OFFSET_MS) / DAY_MS);
const CLIENT_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const GROWTH_ID = /^[a-zA-Z0-9_.:-]{8,180}$/;
const GROWTH_AMOUNTS = Object.freeze({ pet: 3, play: 8, sleep: 4 });
const validTime = value => Number.isSafeInteger(value) && value >= 0;
const cleanName = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || '猫友' : '猫友';
const validFood = key => typeof key === 'string' && Object.hasOwn(FOODS, key);
function validGrowthReward(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string' || !GROWTH_ID.test(value.id)) return false;
  if (!['feed', 'pet', 'play', 'sleep', 'game'].includes(value.kind) || !Number.isFinite(value.amount) || value.amount <= 0) return false;
  if (value.kind === 'game') return Object.hasOwn(GAMES,value.game) && Number.isInteger(value.amount) && value.amount <= 15 && typeof value.actorId === 'string' && CLIENT_ID.test(value.actorId) && typeof value.actor === 'string' && value.actor === cleanName(value.actor) && validTime(value.at) && Object.keys(value).every(key => ['id','kind','game','amount','actorId','actor','at'].includes(key));
  if (Object.hasOwn(value, 'boosted') && value.boosted !== true) return false;
  if (Object.hasOwn(value, 'boostCount') && (value.boosted !== true || !Number.isInteger(value.boostCount) || value.boostCount < 1 || value.boostCount > 3)) return false;
  const boostCount = value.boosted ? value.boostCount ?? 1 : 0;
  if (typeof value.actorId !== 'string' || !CLIENT_ID.test(value.actorId) || typeof value.actor !== 'string' || value.actor !== cleanName(value.actor) || !validTime(value.at)) return false;
  if (Object.keys(value).some(key => !['id', 'kind', 'amount', 'actorId', 'actor', 'food', 'at', 'boosted', 'boostCount'].includes(key))) return false;
  if (value.kind === 'feed') {
    if (value.food !== undefined && !validFood(value.food)) return false;
    const amounts = value.food === undefined ? Object.values(FOODS).flatMap(food => [food.love, food.love + FEEDING_BONUS]) : [FOODS[value.food].love, FOODS[value.food].love + FEEDING_BONUS];
    return amounts.some(amount => growthRewardAmount(amount, boostCount) === value.amount);
  }
  return value.food === undefined && value.amount === growthRewardAmount(GROWTH_AMOUNTS[value.kind], boostCount);
}
/** Unclaimed rewards have no expiry or length limit; every saved reward remains claimable. */
export function validPendingGrowth(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  return value.every(reward => {
    if (!validGrowthReward(reward) || ids.has(reward.id)) return false;
    ids.add(reward.id);
    return true;
  });
}
function normalizePendingGrowth(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.filter(reward => {
    if (!validGrowthReward(reward) || ids.has(reward.id)) return false;
    ids.add(reward.id);
    return true;
  }).map(reward => ({ ...reward }));
}
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
    if (!record || typeof record.actorId !== 'string' || !CLIENT_ID.test(record.actorId) || !validTime(record.at) || ids.has(record.actorId) || (record.food !== undefined && !validFood(record.food))) return false;
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
      if (!item || typeof item.actorId !== 'string' || !CLIENT_ID.test(item.actorId) || !validTime(item.at) || item.at + foodCooldownMs(item.food) <= now) continue;
      const previous = next.feedCooldowns.find(record => record.actorId === item.actorId);
      if (previous && item.at >= previous.at) {
        previous.at = item.at;
        if (validFood(item.food)) previous.food = item.food;
        else delete previous.food;
      } else if (!previous) next.feedCooldowns.push({ actorId: item.actorId, at: item.at, ...(validFood(item.food) ? { food: item.food } : {}) });
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
  return { version: 1, name: '糯米', coins: 1200, love: 86, xp: 86, hunger: 68, mood: 82, energy: 76, needsUpdatedAt:now, sleeping: false, history: [], feedRecords: [], feedingWindow: null, pendingGrowth: [], careLimits: emptyCareLimits(now), appearance: normalizeAppearance(), collection:emptyCollection(), games:emptyGameHub(now), coupleCare:emptyCoupleCare(now), diary:emptyMemoryJournal(now), updatedAt: now };
}
const cap = n => Math.max(0, Math.min(100, n));
export function normalizeState(value, now = Date.now()) {
  now = validTime(now) ? now : 0;
  const fallback = initialState(now);
  if (!value || value.version !== 1) return fallback;
  const next = { ...fallback };
  for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy']) {
    const max = key === 'xp' ? Number.MAX_SAFE_INTEGER : key === 'coins' || key === 'love' ? 999999 : 100;
    if (Number.isFinite(value[key])) {
      const bounded = Math.max(0, Math.min(max, value[key]));
      next[key] = key === 'xp' && !Number.isInteger(bounded) ? Math.round(bounded * 10) / 10 : Math.round(bounded);
    }
  }
  next.name = typeof value.name === 'string' ? value.name.trim().slice(0, 16) || fallback.name : fallback.name;
  next.sleeping = value.sleeping === true;
  next.appearance = normalizeAppearance(value.appearance);
  next.history = Array.isArray(value.history) ? value.history.filter(x => x && typeof x.text === 'string' && typeof x.actor === 'string' && Number.isFinite(x.at)).slice(0, 40) : [];
  if (validTime(value.updatedAt) && value.updatedAt <= now + 60_000) next.updatedAt = value.updatedAt;
  const savedBoostCount=['hunger','mood','energy'].filter(key=>next[key]>80).length;
  const needs = petNeeds({ ...next, needsUpdatedAt:validTime(value.needsUpdatedAt) ? value.needsUpdatedAt : next.updatedAt }, now);
  for (const key of ['hunger', 'mood', 'energy', 'needsUpdatedAt']) next[key] = needs[key];
  next.feedRecords = feedRecords(value.feedRecords, now);
  next.pendingGrowth = normalizePendingGrowth(value.pendingGrowth);
  next.games = normalizeGameHub(value.games,now);
  next.coupleCare = normalizeCoupleCare(value.coupleCare, now);
  next.diary = normalizeMemoryJournal(value.diary, next, now);
  next.careLimits = normalizeCareLimits(value.careLimits, now);
  next.collection = normalizeCollection(value.collection, { ...next, savedBoostCount, careLimits:validCareLimits(value.careLimits) ? value.careLimits : next.careLimits }, FOODS);
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
  let cooldownMs = rule.cooldownMs;
  if (type === 'feed' && typeof actorId === 'string' && CLIENT_ID.test(actorId)) {
    const ledger = current.careLimits.feedCooldowns.find(record => record.actorId === actorId);
    const served = current.feedRecords.find(record => record.actorId === actorId);
    lastAt = ledger?.at ?? served?.at ?? null;
    // Old ledgers have no food key. Infer only from the matching saved meal;
    // a later unrelated record must never shorten an earlier cooldown.
    const lastFood = ledger?.food ?? (served?.at === lastAt ? served.food : undefined);
    cooldownMs = foodCooldownMs(lastAt === null ? action.food : lastFood);
  }
  const cooldownEndsAt = lastAt === null ? now : lastAt + cooldownMs;
  const remainingMs = isWake ? 0 : Math.max(0, cooldownEndsAt - now);
  const remaining = Math.max(0, rule.dailyLimit - used);
  const reason = isWake ? null : remaining === 0 ? 'daily_limit' : remainingMs > 0 ? 'cooldown' : null;
  const resetAt = (current.careLimits.day + 1) * DAY_MS - DAY_OFFSET_MS;
  return {
    allowed: reason === null, reason, dailyLimit: rule.dailyLimit, used, remaining,
    cooldownMs, remainingMs,
    availableAt: isWake ? now : Math.max(now, cooldownEndsAt, remaining === 0 ? resetAt : now), isWake,
  };
}
/** Read-only availability shared by the UI and the authoritative server reducer. */
export function careActionInfo(state, action, actorId, now = Date.now()) {
  now = validTime(now) ? now : 0;
  // This selector reads only the care ledger. Unbounded saved rewards should
  // never be validated or copied by the UI's per-second countdown refresh.
  return careInfo(normalizeState(state && typeof state === 'object' ? { ...state, pendingGrowth: [] } : state, now), action, actorId, now);
}
function recordCare(state, type, actorId, now, food) {
  state.careLimits.counts[type] += 1;
  if (type === 'pair') return;
  state.careLimits.lastActions[type] = now;
  if (type === 'feed' && typeof actorId === 'string' && CLIENT_ID.test(actorId)) {
    const record = state.careLimits.feedCooldowns.find(item => item.actorId === actorId);
    if (record) { record.at = now; record.food = food; }
    else state.careLimits.feedCooldowns.push({ actorId, at: now, food });
  }
}
/** Food-specific timers are derived from saved timestamps, never ticking state.
 * The reward window is shared by the room and does not restart on repeat feeds.
 * Presence is deliberately irrelevant: an offline partner keeps their record.
 */
export function feedingInfo(state, actorId, now = Date.now()) {
  now = validTime(now) ? now : 0;
  const normalized = normalizeState(state && typeof state === 'object' ? { ...state, pendingGrowth: [] } : state, now);
  const window = normalized.feedingWindow;
  const windowStartedAt = window?.startedAt ?? null;
  const windowEndsAt = window ? window.startedAt + FEEDING_WINDOW_MS : null;
  const windowActive = Boolean(window && now >= window.startedAt && now < windowEndsAt);
  const records = normalized.feedRecords.map(record => {
    const expiresAt = record.at + foodCooldownMs(record.food);
    const active = now >= record.at && now < expiresAt;
    return { ...record, expiresAt, remainingMs: active ? expiresAt - now : 0, active, isMine: record.actorId === actorId, inCurrentWindow: windowActive && now >= record.at && record.at >= windowStartedAt };
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
      if (previous.at + foodCooldownMs(previous.food) <= now && previous.at < oldest) { oldest = previous.at; index = slot; }
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
  return true;
}
export function reduceAction(state, action, actor = { name: '铲屎官' }, now = Date.now(), operationId) {
  now = validTime(now) ? now : 0;
  if (!action || typeof action !== 'object') return null;
  const current = normalizeState(state, now);
  if(action.type==='diary-favorite') {
    const diary=favoriteMemory(current.diary,action.memoryId,action.favorite);
    return diary ? {...current,diary,updatedAt:now} : null;
  }
  const { boostCount, multiplier } = petNeeds(current, now);
  const care = careInfo(current, action, actor?.id, now);
  if (!care.allowed) return null;
  const next = { ...current, history: [...current.history], feedRecords: [...current.feedRecords], pendingGrowth: [...current.pendingGrowth], feedingWindow: current.feedingWindow ? { ...current.feedingWindow } : null, updatedAt: now };
  const createsGrowth = ['feed', 'pet', 'play', 'sleep'].includes(action.type) && !care.isWake;
  const rewardActorId = typeof actor?.id === 'string' && CLIENT_ID.test(actor.id) ? actor.id : 'local-care';
  const rewardId = operationId ?? `${action.type}:${rewardActorId}:${now}${action.type === 'invite-cat' ? `:${action.catId}` : ''}`;
  if (createsGrowth && (typeof rewardId !== 'string' || !GROWTH_ID.test(rewardId) || next.pendingGrowth.some(reward => reward.id === rewardId))) return null;
  let growth = 0;
  let text;
  if (typeof action.type === 'string' && action.type.startsWith('game-')) {
    if (action.type === 'game-create' && current.pendingGrowth.some(reward => reward.id === `game:${rewardId}`)) return null;
    const hub = reduceGameHub(current.games,action,{ id:rewardActorId, name:cleanName(actor?.name) },now,rewardId);
    if (!hub) return null;
    next.games = hub;
    const m = hub.match;
    if (m.status === 'finished' && current.games.match?.status !== 'finished') {
      recordCollectionVictory(next.collection, m);
      if (m.reward > 0) next.pendingGrowth.push({ id:`game:${m.id}`, kind:'game', game:m.game, amount:m.reward, actorId:rewardActorId, actor:cleanName(actor?.name), at:now });
      next.history.unshift({ text:`${m.mode === 'duo' ? '一起完成':'完成'}${GAMES[m.game].name}${m.reward ? `，生成${m.reward}点成长气泡待领取`:'，今日小游戏成长已达上限'}`, actor:cleanName(actor?.name), at:now });
      next.history = next.history.slice(0,40);
    }
    recordCollectionAchievements(next.collection,{boostCount,careCounts:next.careLimits.counts});
    next.diary=recordMemoryJournal(current.diary,{before:current,after:next,action,actorId:actor?.id,now,id:rewardId});
    return normalizeState(next,now);
  }
  switch (action.type) {
    case 'feed': {
      if (!validFood(action.food)) return null;
      const food = FOODS[action.food];
      if (next.coins < food.cost) return null;
      next.coins -= food.cost; next.love += food.love; growth = food.love;
      next.hunger = cap(next.hunger + food.hunger); next.mood = cap(next.mood + CARE_NEED_EFFECTS.feed.mood); next.energy = cap(next.energy + food.energy); next.sleeping = false;
      text = `喂了一份${food.name}`;
      if (recordFeeding(next, action.food, actor, now)) {
        growth += FEEDING_BONUS;
        recordCollectionCare(next.collection, 'pair');
        text += '，双人喂养额外获得10点亲密度';
      }
      break;
    }
    case 'pet':
      next.love += 3; growth = GROWTH_AMOUNTS.pet; next.mood = cap(next.mood + CARE_NEED_EFFECTS.pet.mood); next.sleeping = false; text = '温柔地摸了摸小猫'; break;
    case 'play':
      if (next.energy < PLAY_ENERGY_COST) return null;
      next.energy = cap(next.energy + CARE_NEED_EFFECTS.play.energy); next.hunger = cap(next.hunger + CARE_NEED_EFFECTS.play.hunger); next.mood = cap(next.mood + CARE_NEED_EFFECTS.play.mood);
      next.coins += 10; next.love += 5; growth = GROWTH_AMOUNTS.play; next.sleeping = false; text = '陪小猫玩了逗猫棒'; break;
    case 'sleep':
      next.sleeping = !next.sleeping; next.energy = cap(next.energy + (next.sleeping ? CARE_NEED_EFFECTS.sleep.energy : 0)); growth = next.sleeping ? GROWTH_AMOUNTS.sleep : 0;
      text = next.sleeping ? '陪小猫打了个盹' : '轻轻叫醒了小猫'; break;
    case 'claim-growth': {
      if (typeof action.rewardId !== 'string' || !GROWTH_ID.test(action.rewardId)) return null;
      const index = next.pendingGrowth.findIndex(reward => reward.id === action.rewardId);
      if (index < 0) return null;
      const experience = addGrowthExperience(next.xp, next.pendingGrowth[index].amount);
      if (experience === null) return null;
      const [reward] = next.pendingGrowth.splice(index, 1);
      next.xp = experience;
      text = `收下成长气泡，获得${reward.amount}点成长`;
      break;
    }
    case 'dress':
      if (!validAppearance(action.appearance)) return null;
      next.appearance = normalizeAppearance(action.appearance); text = '给小猫换上了新的魔法装扮'; break;
    case 'invite-cat': {
      if (!canInviteCat(action.catId, next.collection, levelInfo(next.xp).level)) return null;
      if (next.collection.invited.some(record => record.operationId === rewardId)) return null;
      if (typeof rewardId !== 'string' || !GROWTH_ID.test(rewardId)) return null;
      next.collection.invited.push({ id:action.catId, at:now, operationId:rewardId, actorId:rewardActorId });
      text = `邀请${getCollectionCat(action.catId).name}加入猫猫庭院`;
      break;
    }
    case 'rename':
      if (typeof action.name !== 'string' || !action.name.trim()) return null;
      next.name = action.name.trim().slice(0, 16); text = `给小猫取名「${next.name}」`; break;
    default: return null;
  }
  if (growth > 0) {
    growth = growthRewardAmount(growth, boostCount);
    recordCollectionCare(next.collection, action.type, action.food);
    next.pendingGrowth.push({ id: rewardId, kind: action.type, amount: growth, actorId: rewardActorId, actor: cleanName(actor?.name), ...(action.type === 'feed' ? { food: action.food } : {}), ...(boostCount ? { boosted:true, boostCount } : {}), at: now });
    text += `，生成${growth}点成长气泡待领取${boostCount ? `（好状态 ×${multiplier}）` : ''}`;
  }
  if (Object.hasOwn(CARE_LIMITS, action.type) && !care.isWake) recordCare(next, action.type, actor?.id, now, action.food);
  recordCollectionAchievements(next.collection,{boostCount:Math.max(boostCount,petNeeds(next,now).boostCount),careCounts:next.careLimits.counts,
    dressChanged:action.type === 'dress' && Object.keys(current.appearance).some(key=>current.appearance[key] !== next.appearance[key])});
  next.coupleCare = recordCoupleCare(next.coupleCare, action, actor?.id, now, rewardId, { isWake:care.isWake, feedingWindow:next.feedingWindow });
  next.history.unshift({ text, actor: cleanName(actor?.name).slice(0, 16), at: next.updatedAt });
  next.history = next.history.slice(0, 40);
  next.diary=recordMemoryJournal(current.diary,{before:current,after:next,action,actorId:actor?.id,now,id:rewardId,levelBefore:levelInfo(current.xp).level,levelAfter:levelInfo(next.xp).level});
  return normalizeState(next, now);
}
/** Cumulative growth required to reach a level, shared with stage progress. */
export function levelStartXp(level) {
  const completed = Number.isFinite(level) ? Math.max(0, Math.floor(level) - 1) : 0;
  return 15 * completed * (completed + 7);
}

export function levelInfo(xp) {
  const bounded = Number.isFinite(xp) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, xp)) : 0;
  const total = Number.isInteger(bounded) ? bounded : Math.round(bounded * 10) / 10;
  // Each upgrade costs 120 + 30 * (level - 1). Completing n levels therefore
  // costs 15 * n * (n + 7); invert the sum instead of iterating over every level.
  const threshold = completed => levelStartXp(completed + 1);
  let completed = Math.floor((Math.sqrt(49 + 4 * total / 15) - 7) / 2);
  // Correct floating-point rounding at exact boundaries, including large saves.
  while (threshold(completed) > total) completed -= 1;
  while (threshold(completed + 1) <= total) completed += 1;
  const progress = total - threshold(completed);
  return { level: completed + 1, progress:Number.isInteger(progress) ? progress : Math.round(progress * 10) / 10, target: 120 + 30 * completed };
}
