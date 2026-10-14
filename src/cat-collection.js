// Shared by the client and server: achievements only advance after accepted care.
export const COLLECTION_STATS = Object.freeze(['feed', 'pet', 'play', 'sleep', 'pair']);
const cat = (id, name, english, index, personality, achievement, metric, target) => Object.freeze({ id, name, english, index, personality, achievement, metric, target });
export const COLLECTION_CATS = Object.freeze([
  cat('bandit', '斑斑', 'Bandit', 0, '慢热的小玳瑁，最喜欢在木台上晒太阳。', '初次见面', 'welcome', 0),
  cat('bolt', '闪电', 'Bolt', 1, '一听见开饭就竖起耳朵的金色虎斑。', '第一顿好饭', 'feed', 1),
  cat('breezy', '微风', 'Breezy', 2, '喜欢温柔的摸摸，也喜欢静静待在你身边。', '温柔初相遇', 'pet', 1),
  cat('callie', '花花', 'Callie', 3, '总在寻找新玩具的好奇三花小猫。', '一起玩一次', 'play', 1),
  cat('cocoa', '可可', 'Cocoa', 4, '午后会找一个舒服角落，陪你慢慢打盹。', '安心好梦', 'sleep', 1),
  cat('dottie', '小雪', 'Dottie', 5, '把每一点成长都记在心里的白色小猫。', '慢慢长大', 'level', 3),
  cat('fred', '奶糖', 'Fred', 6, '认得你开饭的声音，六顿好饭就会成为老朋友。', '认真开饭', 'feed', 6),
  cat('gabriel', '芝麻', 'Gabriel', 7, '穿着小礼服的黑白猫，摸摸十次就愿意靠近。', '摸摸收藏家', 'pet', 10),
  cat('ginger', '姜姜', 'Ginger', 8, '橘红色的小运动员，每次玩耍都精神满满。', '玩耍好搭档', 'play', 5),
  cat('gozer', '布丁', 'Gozer', 9, '喜欢尝鲜，三种不同食物就是最好的见面礼。', '尝鲜小食客', 'foods', 3),
  cat('lexy', '银杏', 'Lexy', 10, '看见你们一起照顾小猫，就想加入这个家。', '双人的心意', 'pair', 1),
  cat('mack', '云朵', 'Mack', 11, '在成长路上等着你，五级时会带来新的陪伴。', '小窝新伙伴', 'level', 5),
]);
const byId = new Map(COLLECTION_CATS.map(cat => [cat.id, cat]));
const STABLE_ID = /^[a-zA-Z0-9_.:-]{8,180}$/;
const ACTOR_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const safeCount = value => Number.isSafeInteger(value) && value >= 0;
export const getCollectionCat = id => byId.get(id) || null;
export const validCollectionCatId = id => typeof id === 'string' && byId.has(id);
export function emptyCollection() {
  return { stats:Object.fromEntries(COLLECTION_STATS.map(key => [key, 0])), foods:[], invited:[] };
}
function validInvite(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && validCollectionCatId(value.id)
    && safeCount(value.at) && typeof value.operationId === 'string' && STABLE_ID.test(value.operationId)
    && typeof value.actorId === 'string' && ACTOR_ID.test(value.actorId)
    && Object.keys(value).every(key => ['id', 'at', 'operationId', 'actorId'].includes(key));
}
export function validCollection(value, foodIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['stats','foods','invited'].includes(key))) return false;
  if (!value.stats || typeof value.stats !== 'object' || Array.isArray(value.stats) || Object.keys(value.stats).length !== COLLECTION_STATS.length || !COLLECTION_STATS.every(key => safeCount(value.stats[key]))) return false;
  if (!Array.isArray(value.foods) || value.foods.length > foodIds.length || new Set(value.foods).size !== value.foods.length || !value.foods.every(id => foodIds.includes(id))) return false;
  if (!Array.isArray(value.invited) || value.invited.length > COLLECTION_CATS.length || !value.invited.every(validInvite)) return false;
  return new Set(value.invited.map(record => record.id)).size === value.invited.length && new Set(value.invited.map(record => record.operationId)).size === value.invited.length;
}
/** Old saves contribute only verifiable lower bounds from their remaining records. */
export function normalizeCollection(value, legacy, foods) {
  const next = emptyCollection();
  const foodIds = Object.keys(foods);
  if (value !== undefined) {
    if (!validCollection(value, foodIds)) return next;
    return { stats:{ ...value.stats }, foods:[...value.foods], invited:value.invited.map(record => ({ ...record })) };
  }
  for (const entry of legacy.history || []) {
    const text = entry.text;
    const kind = text.startsWith('喂了一份') ? 'feed' : text.startsWith('温柔地摸了摸小猫') ? 'pet' : text.startsWith('陪小猫玩了逗猫棒') ? 'play' : text.startsWith('陪小猫打了个盹') ? 'sleep' : null;
    if (kind) next.stats[kind] += 1;
    if (kind === 'feed') {
      for (const id of foodIds) if (text.startsWith(`喂了一份${foods[id].name}`) && !next.foods.includes(id)) next.foods.push(id);
      if (text.includes('双人喂养额外获得10点亲密度')) next.stats.pair += 1;
    }
  }
  for (const key of COLLECTION_STATS) next.stats[key] = Math.max(next.stats[key], legacy.careLimits?.counts?.[key] || 0);
  for (const record of legacy.feedRecords || []) if (!next.foods.includes(record.food)) next.foods.push(record.food);
  return next;
}
export function collectionCatProgress(cat, collection, level) {
  const current = cat.metric === 'welcome' ? 1 : cat.metric === 'level' ? level : cat.metric === 'foods' ? collection.foods.length : collection.stats[cat.metric];
  const target = cat.target || 1;
  const invited = collection.invited.find(record => record.id === cat.id) || null;
  return { current, target, complete:current >= target, invited, fraction:Math.min(1, current / target) };
}
export function canInviteCat(id, collection, level) {
  const cat = getCollectionCat(id);
  if (!cat) return false;
  const progress = collectionCatProgress(cat, collection, level);
  return progress.complete && !progress.invited;
}
export function recordCollectionCare(collection, type, food) {
  collection.stats[type] = Math.min(Number.MAX_SAFE_INTEGER, collection.stats[type] + 1);
  if (type === 'feed' && !collection.foods.includes(food)) collection.foods.push(food);
}
