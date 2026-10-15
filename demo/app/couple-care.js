import { COUPLE_ROLES } from './couple-profile.js';

export const COUPLE_RECORD_LIMIT = 160;
export const COOPERATION_TIME_ZONE = 'Asia/Shanghai';
export const COOPERATION_RULES = Object.freeze([
  Object.freeze({ id:'meal', name:'一起开饭', icon:'🍽️', windowMs:4 * 60 * 60_000, hint:'两个人各喂一份，凑成小猫的幸福餐桌。' }),
  Object.freeze({ id:'relay', name:'默契接力', icon:'🪄', windowMs:30 * 60_000, hint:'一人摸摸，另一人接着逗猫。' }),
  Object.freeze({ id:'goodnight', name:'安心晚安', icon:'🌙', windowMs:30 * 60_000, hint:'一人喂食或摸摸，另一人陪它休息。' }),
]);
const roleIds = new Set(COUPLE_ROLES.map(role => role.clientId));
const types = new Set(['feed','pet','play','sleep','wake','dress','rename']);
const foodIds = new Set(['snack','meal','fish','chicken','shrimp','salmon','mousse','treat','water']);
const operationId = /^[a-zA-Z0-9_.:-]{8,180}$/;
const validId = value => typeof value === 'string' && operationId.test(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
export const cooperationDay = now => Math.floor((now + 8 * 60 * 60_000) / 86_400_000);
const validRecord = value => plain(value) && validId(value.id) && roleIds.has(value.actorId) && types.has(value.type) && validTime(value.at)
  && (value.type === 'feed' ? foodIds.has(value.food) : value.food === undefined)
  && Object.keys(value).every(key => ['id','actorId','type','food','at'].includes(key));
const validMoment = value => plain(value) && COOPERATION_RULES.some(rule => rule.id === value.kind)
  && Number.isSafeInteger(value.day) && value.day >= 0 && value.id === `${value.kind}:${value.day}` && validTime(value.at)
  && roleIds.has(value.firstActorId) && roleIds.has(value.secondActorId) && value.firstActorId !== value.secondActorId
  && validId(value.firstId) && validId(value.secondId) && value.firstId !== value.secondId
  && Object.keys(value).every(key => ['id','kind','day','at','firstActorId','secondActorId','firstId','secondId'].includes(key));

export function emptyCoupleCare(now = Date.now()) { return { version:1, day:cooperationDay(now), records:[], moments:[] }; }

export function validCoupleCare(value) {
  if (!plain(value) || value.version !== 1 || !Number.isSafeInteger(value.day) || value.day < 0 || !Array.isArray(value.records) || value.records.length > COUPLE_RECORD_LIMIT || !Array.isArray(value.moments)) return false;
  if (Object.keys(value).some(key => !['version','day','records','moments'].includes(key))) return false;
  const recordIds = new Set(), momentIds = new Set();
  return value.records.every(record => validRecord(record) && !recordIds.has(record.id) && recordIds.add(record.id))
    && value.moments.every(moment => validMoment(moment) && moment.day <= value.day && !momentIds.has(moment.id) && momentIds.add(moment.id));
}

export function normalizeCoupleCare(value, now = Date.now()) {
  const next = emptyCoupleCare(now), recordIds = new Set(), momentIds = new Set();
  if (!plain(value) || value.version !== 1) return next;
  if (Number.isSafeInteger(value.day) && value.day >= next.day) next.day = value.day;
  for (const record of Array.isArray(value.records) ? value.records : []) {
    if (!validRecord(record) || recordIds.has(record.id)) continue;
    recordIds.add(record.id); next.records.push({ ...record });
  }
  next.records.sort((a,b) => b.at - a.at);
  next.records = next.records.slice(0, COUPLE_RECORD_LIMIT);
  // Cooperation memories survive both the activity-window limit and day changes.
  for (const moment of Array.isArray(value.moments) ? value.moments : []) {
    if (!validMoment(moment) || momentIds.has(moment.id) || moment.day > next.day) continue;
    momentIds.add(moment.id); next.moments.push({ ...moment });
  }
  next.moments.sort((a,b) => b.at - a.at);
  return next;
}

function sourceFor(rule, record, records, now, feedingWindow) {
  return records.find(previous => {
    if (previous.actorId === record.actorId || previous.at > now || now - previous.at >= rule.windowMs) return false;
    if (rule.id === 'meal') return record.type === 'feed' && previous.type === 'feed' && previous.at >= (feedingWindow?.startedAt ?? now);
    if (rule.id === 'relay') return (record.type === 'pet' && previous.type === 'play') || (record.type === 'play' && previous.type === 'pet');
    return record.type === 'sleep' && ['pet','feed'].includes(previous.type);
  });
}

/** Called only after an ordinary care action passes the shared server reducer. */
export function recordCoupleCare(value, action, actorId, now, id, { isWake = false, feedingWindow } = {}) {
  const next = normalizeCoupleCare(value, now);
  const type = action.type === 'sleep' && isWake ? 'wake' : action.type;
  if (!roleIds.has(actorId) || !types.has(type) || !validId(id) || next.records.some(record => record.id === id)) return next;
  const record = { id, actorId, type, ...(type === 'feed' ? { food:action.food } : {}), at:now };
  if (!validRecord(record)) return next;
  for (const rule of COOPERATION_RULES) {
    const momentId = `${rule.id}:${next.day}`;
    if (next.moments.some(moment => moment.id === momentId)) continue;
    const source = sourceFor(rule, record, next.records, now, feedingWindow);
    if (source) next.moments.unshift({ id:momentId, kind:rule.id, day:next.day, at:now, firstActorId:source.actorId, secondActorId:actorId, firstId:source.id, secondId:id });
  }
  next.records.unshift(record);
  next.records = next.records.slice(0, COUPLE_RECORD_LIMIT);
  return next;
}

/** Suggested next steps still go through the existing care quotas and cooldowns. */
export function cooperationTasks(state, actorId, now = Date.now()) {
  const care = normalizeCoupleCare(state.coupleCare, now);
  return COOPERATION_RULES.map(rule => {
    const completed = care.moments.find(moment => moment.id === `${rule.id}:${care.day}`);
    const first = care.records.find(record => record.at <= now && now - record.at < rule.windowMs && (
      rule.id === 'meal' ? record.type === 'feed' && record.at >= (state.feedingWindow?.startedAt ?? now)
        : rule.id === 'relay' ? ['pet','play'].includes(record.type) : ['pet','feed'].includes(record.type)
    ));
    const type = first ? rule.id === 'meal' ? 'feed' : rule.id === 'relay' ? first.type === 'pet' ? 'play' : 'pet' : 'sleep' : rule.id === 'meal' ? 'feed' : 'pet';
    return { ...rule, completed:completed || null, first:first || null, waiting:first?.actorId === actorId, action:{ type }, expiresAt:first ? first.at + rule.windowMs : null };
  });
}
