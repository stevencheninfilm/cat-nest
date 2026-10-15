// Shared by the client and server: achievements advance after accepted care or victories.
export const COLLECTION_STATS = Object.freeze(['feed', 'pet', 'play', 'sleep', 'pair']);
export const COLLECTION_GAMES = Object.freeze(['rps', 'memory', 'gomoku']);
export const COLLECTION_DAILY_LIMITS = Object.freeze({feed:10,pet:20,play:10,sleep:3});
const cat = (id, name, english, index, personality, achievement, metric, baseTarget, difficultyMultiplier, extraRequirements = []) => {
  const target = baseTarget * difficultyMultiplier;
  const requirements = Object.freeze([{ metric, target }, ...extraRequirements].map(Object.freeze));
  return Object.freeze({ id, name, english, index, personality, achievement, metric, target, baseTarget, difficultyMultiplier, requirements });
};
export const COLLECTION_CATS = Object.freeze([
  cat('bandit', '斑斑', 'Bandit', 0, '慢热的小玳瑁，最喜欢在木台上晒太阳。', '初次见面', 'care', 1, 5),
  cat('bolt', '闪电', 'Bolt', 1, '一听见开饭就竖起耳朵的金色虎斑。', '好饭日常', 'feed', 6, 5),
  cat('breezy', '微风', 'Breezy', 2, '喜欢温柔的摸摸，也喜欢静静待在你身边。', '温柔的习惯', 'pet', 20, 5),
  cat('callie', '花花', 'Callie', 3, '总在寻找新玩具的好奇三花小猫。', '玩耍小伙伴', 'play', 10, 5),
  cat('cocoa', '可可', 'Cocoa', 4, '午后会找一个舒服角落，陪你慢慢打盹。', '安心好梦', 'sleep', 6, 5),
  cat('dottie', '小雪', 'Dottie', 5, '把每一点成长都记在心里的白色小猫。', '慢慢长大', 'level', 8, 5),
  cat('fred', '奶糖', 'Fred', 6, '认得你开饭的声音，也珍惜每一顿认真准备的好饭。', '认真开饭', 'feed', 30, 6),
  cat('gabriel', '芝麻', 'Gabriel', 7, '穿着小礼服的黑白猫，记得你每一次温柔的摸摸。', '摸摸收藏家', 'pet', 100, 6),
  cat('ginger', '姜姜', 'Ginger', 8, '橘红色的小运动员，每次玩耍都精神满满。', '玩耍好搭档', 'play', 50, 6),
  cat('gozer', '布丁', 'Gozer', 9, '喜欢尝鲜，也会记住你认真准备的每一顿饭。', '尝鲜小食客', 'feed', 9, 6, [{ metric:'foods', target:9 }]),
  cat('lexy', '银杏', 'Lexy', 10, '看见你们一直一起照顾小猫，就想加入这个家。', '双人的心意', 'pair', 12, 8),
  cat('mack', '云朵', 'Mack', 11, '在漫长的成长路上等着你，带来新的陪伴。', '小窝新伙伴', 'level', 15, 8),
  cat('scout', '栗栗', 'Scout', 12, '戴着牛仔帽的小队长，每一次猜拳都像一场小冒险。', '猜拳小能手', 'win-rps', 1, 5),
  cat('mochi', '年糕', 'Mochi', 13, '围着薄荷色小围巾，能记住每张卡片和每位朋友。', '翻牌记忆家', 'win-memory', 1, 5),
  cat('onyx', '墨影', 'Onyx', 14, '安静的忍者小猫，总能在棋盘上找到自己的节奏。', '棋盘新星', 'win-gomoku', 1, 5),
  cat('biscuit', '饼饼', 'Biscuit', 15, '穿着小围裙的快乐厨师，喜欢把胜利变成新的点心。', '猜拳常胜客', 'win-rps', 2, 6),
  cat('maple', '枫糖', 'Maple', 16, '带着星星项链的小旅人，玩累了就找个角落打盹。', '翻牌大师', 'win-memory', 2, 6),
  cat('pearl', '珍珠', 'Pearl', 17, '别着粉色蝴蝶结的小棋手，喜欢在阳光里伸懒腰。', '五子棋高手', 'win-gomoku', 2, 6),
  cat('sunshine', '曦曦', 'Sunshine', 18, '戴着小太阳项链，喜欢陪你把每一天照顾得暖暖的。', '满格好状态', 'boost', 3, 1),
  cat('sprout', '豆豆', 'Sprout', 19, '系着绿色蝴蝶结的小运动员，最喜欢追着毛线球跑。', '今日玩耍家', 'daily-play', 10, 1),
  cat('velvet', '绒绒', 'Velvet', 20, '戴着薰衣草色贝雷帽，总想和你一起试试新装扮。', '换装初体验', 'dress', 1, 1),
  cat('toast', '吐司', 'Toast', 21, '围着红格子小围兜，把每一顿认真准备的饭都记在心里。', '今日开饭啦', 'daily-feed', 10, 1),
  cat('mint', '薄荷', 'Mint', 22, '白白软软的小猫，得到摸摸后就会伸一个长长的懒腰。', '今日温柔时光', 'daily-pet', 10, 1),
  cat('luna', '月牙', 'Luna', 23, '戴着小月亮项链，会陪你把忙碌的一天慢慢放下来。', '今日安心好梦', 'daily-sleep', 3, 1),
]);
const byId = new Map(COLLECTION_CATS.map(cat => [cat.id, cat]));
const STABLE_ID = /^[a-zA-Z0-9_.:-]{8,180}$/;
const ACTOR_ID = /^[a-zA-Z0-9_-]{6,80}$/;
const safeCount = value => Number.isSafeInteger(value) && value >= 0;
export const getCollectionCat = id => byId.get(id) || null;
export const validCollectionCatId = id => typeof id === 'string' && byId.has(id);
export function emptyCollectionAchievements() {
  return {boost:0,dress:0,daily:Object.fromEntries(Object.keys(COLLECTION_DAILY_LIMITS).map(key=>[key,0]))};
}
function validAchievements(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 3
    && safeCount(value.boost) && value.boost <= 3 && safeCount(value.dress) && value.dress <= 1
    && value.daily && typeof value.daily === 'object' && !Array.isArray(value.daily)
    && Object.keys(value.daily).length === Object.keys(COLLECTION_DAILY_LIMITS).length
    && Object.entries(COLLECTION_DAILY_LIMITS).every(([key,max])=>safeCount(value.daily[key]) && value.daily[key] <= max);
}
/** Best single-day records never add separate days together, and remain after midnight. */
export function recordCollectionAchievements(collection,{boostCount=0,careCounts={},dressChanged=false}={}) {
  const record=collection.achievements ??= emptyCollectionAchievements();
  record.boost=Math.max(record.boost,Math.min(3,boostCount));
  if(dressChanged)record.dress=1;
  for(const [key,target] of Object.entries(COLLECTION_DAILY_LIMITS)) {
    if(safeCount(careCounts[key]))record.daily[key]=Math.max(record.daily[key],Math.min(target,careCounts[key]));
  }
}
function knownAchievements(legacy) {
  const collection={achievements:emptyCollectionAchievements()};
  const historicBoost=(legacy.history || []).some(entry=>/^(?:喂了一份|温柔地摸了摸小猫|陪小猫玩了逗猫棒|陪小猫打了个盹).*（好状态 ×1\.3）$/.test(entry?.text || '')) ? 3 : 0;
  const boostCount=(legacy.pendingGrowth || []).reduce((max,reward)=>Math.max(max,reward.boosted ? reward.boostCount ?? 1 : 0),
    Math.max(historicBoost,legacy.savedBoostCount || 0,['hunger','mood','energy'].filter(key=>legacy[key]>80).length));
  recordCollectionAchievements(collection,{boostCount,careCounts:legacy.careLimits?.counts,
    dressChanged:Object.values(legacy.appearance || {}).some(choice=>choice !== 0)});
  return collection.achievements;
}
export function emptyCollection() {
  return { stats:Object.fromEntries(COLLECTION_STATS.map(key => [key, 0])), wins:Object.fromEntries(COLLECTION_GAMES.map(key => [key, 0])), achievements:emptyCollectionAchievements(), foods:[], invited:[] };
}
function validInvite(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && validCollectionCatId(value.id)
    && safeCount(value.at) && typeof value.operationId === 'string' && STABLE_ID.test(value.operationId)
    && typeof value.actorId === 'string' && ACTOR_ID.test(value.actorId)
    && Object.keys(value).every(key => ['id', 'at', 'operationId', 'actorId'].includes(key));
}
export function validCollection(value, foodIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['stats','wins','achievements','foods','invited'].includes(key))) return false;
  if (!value.stats || typeof value.stats !== 'object' || Array.isArray(value.stats) || Object.keys(value.stats).length !== COLLECTION_STATS.length || !COLLECTION_STATS.every(key => safeCount(value.stats[key]))) return false;
  if (value.wins !== undefined && (!value.wins || typeof value.wins !== 'object' || Array.isArray(value.wins) || Object.keys(value.wins).length !== COLLECTION_GAMES.length || !COLLECTION_GAMES.every(key => safeCount(value.wins[key])))) return false;
  if (value.achievements !== undefined && !validAchievements(value.achievements)) return false;
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
    const achievements=value.achievements;
    return { stats:{ ...value.stats }, wins:{ ...next.wins, ...value.wins }, achievements:achievements ? {...achievements,daily:{...achievements.daily}} : knownAchievements(legacy), foods:[...value.foods], invited:value.invited.map(record => ({ ...record })) };
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
  next.achievements=knownAchievements(legacy);
  return next;
}
export function collectionCatProgress(cat, collection, level) {
  const requirements = cat.requirements.map(({ metric, target }) => {
    const current = metric.startsWith('daily-') ? collection.achievements?.daily[metric.slice(6)] || 0
      : ['boost','dress'].includes(metric) ? collection.achievements?.[metric] || 0
      : metric.startsWith('win-') ? collection.wins?.[metric.slice(4)] || 0 : metric === 'level' ? level : metric === 'foods' ? collection.foods.length : metric === 'care'
      ? Math.min(Number.MAX_SAFE_INTEGER, ['feed','pet','play','sleep'].reduce((sum, key) => sum + collection.stats[key], 0))
      : collection.stats[metric];
    return { metric, current, target, complete:current >= target, fraction:Math.min(1, current / target) };
  });
  const { current, target } = requirements[0];
  const achieved = requirements.every(requirement => requirement.complete);
  const invited = collection.invited.find(record => record.id === cat.id) || null;
  // Previously invited cats remain collected when achievement thresholds increase.
  return { current, target, requirements, achieved, complete:!!invited || achieved, invited, fraction:invited ? 1 : Math.min(...requirements.map(requirement => requirement.fraction)) };
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
/** Call only on the server-validated transition to a finished game. One win per match. */
export function recordCollectionVictory(collection, match) {
  if (match.status !== 'finished' || !COLLECTION_GAMES.includes(match.game) || !Number.isInteger(match.winner) || match.winner < 0) return false;
  const winner = match.players[match.winner];
  if (!winner || winner.computer || winner.id === 'computer-cat') return false;
  collection.wins ??= Object.fromEntries(COLLECTION_GAMES.map(key => [key, 0]));
  collection.wins[match.game] = Math.min(Number.MAX_SAFE_INTEGER, collection.wins[match.game] + 1);
  return true;
}
