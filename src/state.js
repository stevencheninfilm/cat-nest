export const FOODS = {
  snack: { name: '冻干小鱼', cost: 10, love: 10, hunger: 10 },
  meal: { name: '营养猫粮', cost: 20, love: 25, hunger: 22 },
  fish: { name: '鲜鱼罐罐', cost: 40, love: 50, hunger: 35 },
};
export function initialState() {
  return { version: 1, name: '糯米', coins: 1200, love: 86, xp: 86, hunger: 68, mood: 82, energy: 76, sleeping: false, history: [], updatedAt: Date.now() };
}
const cap = n => Math.max(0, Math.min(100, n));
export function normalizeState(value) {
  const fallback = initialState();
  if (!value || value.version !== 1) return fallback;
  const next = { ...fallback };
  for (const key of ['coins', 'love', 'xp', 'hunger', 'mood', 'energy']) {
    if (Number.isFinite(value[key])) next[key] = Math.max(0, Math.min(key === 'coins' || key === 'love' || key === 'xp' ? 999999 : 100, Math.round(value[key])));
  }
  next.name = typeof value.name === 'string' ? value.name.trim().slice(0, 16) || fallback.name : fallback.name;
  next.sleeping = value.sleeping === true;
  next.history = Array.isArray(value.history) ? value.history.filter(x => x && typeof x.text === 'string' && typeof x.actor === 'string' && Number.isFinite(x.at)).slice(0, 40) : [];
  return next;
}
export function reduceAction(state, action, actor = { name: '铲屎官' }) {
  const next = { ...state, history: [...state.history], updatedAt: Date.now() };
  let text;
  switch (action.type) {
    case 'feed': {
      const food = FOODS[action.food];
      if (!food || next.coins < food.cost) return null;
      next.coins -= food.cost; next.love += food.love; next.xp += food.love;
      next.hunger = cap(next.hunger + food.hunger); next.mood = cap(next.mood + 4); next.sleeping = false;
      text = `喂了一份${food.name}`;
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
  next.history.unshift({ text, actor: String(actor.name || '猫友').slice(0, 16), at: next.updatedAt });
  next.history = next.history.slice(0, 40);
  return normalizeState(next);
}
export function levelInfo(xp) {
  const level = Math.floor(xp / 120) + 1;
  return { level, progress: xp % 120, target: 120 };
}
