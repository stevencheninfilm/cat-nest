import { COUPLE_ROLES } from './couple-profile.js';

const ids = new Set(COUPLE_ROLES.map(role => role.clientId));
const time = value => Number.isSafeInteger(value) && value >= 0;
export const emptyHomeBond = () => ({ version:1, owners:[], adoptedAt:null });
export function validHomeBond(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.owners) || value.owners.length > 2 || !(value.adoptedAt === null || time(value.adoptedAt))) return false;
  if (Object.keys(value).some(key => !['version','owners','adoptedAt'].includes(key))) return false;
  const seen = new Set();
  return value.owners.every(owner => owner && ids.has(owner.id) && time(owner.joinedAt) && Object.keys(owner).every(key => ['id','joinedAt'].includes(key)) && !seen.has(owner.id) && seen.add(owner.id));
}
/** Old care records prove membership; being offline or copying a URL does not. */
export function normalizeHomeBond(value, state = {}) {
  const next = emptyHomeBond(), owners = new Map();
  const add = (id, at) => { if (ids.has(id) && time(at)) owners.set(id, Math.min(owners.get(id) ?? at, at)); };
  if (validHomeBond(value)) { next.adoptedAt=value.adoptedAt; for (const owner of value.owners) add(owner.id,owner.joinedAt); }
  for (const record of [...(state.coupleCare?.records || []), ...(state.feedRecords || []), ...(state.pendingGrowth || [])]) add(record.actorId,record.at);
  for (const record of state.history || []) add(COUPLE_ROLES.find(role => role.name === record.actor)?.clientId,record.at);
  for (const moment of state.coupleCare?.moments || []) { add(moment.firstActorId,moment.at);add(moment.secondActorId,moment.at); }
  next.owners = COUPLE_ROLES.filter(role => owners.has(role.clientId)).map(role => ({id:role.clientId,joinedAt:owners.get(role.clientId)}));
  return next;
}
export function joinHome(state, actorId, now) {
  if (!ids.has(actorId) || !time(now)) return null;
  const bond = normalizeHomeBond(state.homeBond,state);
  if (!bond.owners.some(owner => owner.id === actorId)) bond.owners.push({id:actorId,joinedAt:now});
  bond.owners.sort((a,b) => [...ids].indexOf(a.id) - [...ids].indexOf(b.id));
  return bond;
}
export function isNewPet(state) {
  return !state.homeBond?.adoptedAt && !state.history?.length && !state.feedRecords?.length && !state.pendingGrowth?.length
    && !state.coupleCare?.records?.length && !state.collection?.invited?.length && state.xp <= 86 && state.coins === 1200 && state.name === '糯米';
}
export function homeBinding(state, members = [], known = false) {
  const bond = normalizeHomeBond(state.homeBond,state);
  const owners = COUPLE_ROLES.map(role => ({ ...role, joined:bond.owners.some(owner => owner.id === role.clientId), online:known ? members.some(member => member.id === role.clientId) : null }));
  return { owners, count:owners.filter(owner => owner.joined).length, complete:owners.every(owner => owner.joined) };
}
export function homeInviteUrl(home, base, role) {
  if (!home || !['couple','room','test'].includes(home.source) || !/^\.\/[a-z][a-z0-9-]*\/$/.test(home.href)) throw new Error('存档入口无效');
  if (!['male','female'].includes(role)) throw new Error('请先选择身份');
  const url = new URL(home.href,base);
  url.search = new URLSearchParams({join:role === 'male' ? 'female':'male'}).toString();
  url.hash = '';
  return url.href;
}
