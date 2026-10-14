export const INTERACTION_MODES = Object.freeze([
  Object.freeze({ id: 'random', label: '随心互动', shortLabel: '随心', icon: 'sparkles', description: '点点小猫，随机摸摸、逗猫或陪它休息。' }),
  Object.freeze({ id: 'pet', label: '温柔摸摸', shortLabel: '摸摸', icon: 'hand', description: '每次点击，都给小猫一个温柔的摸摸。' }),
  Object.freeze({ id: 'play', label: '逗猫时间', shortLabel: '逗猫', icon: 'wand-sparkles', description: '点点小猫，陪它追一追逗猫棒。' }),
  Object.freeze({ id: 'sleep', label: '休息一下', shortLabel: '休息', icon: 'moon', description: '点点小猫陪它入睡，再点一次轻轻叫醒。' }),
]);

const modes = new Set(INTERACTION_MODES.map(mode => mode.id));
const randomActions = Object.freeze(['pet', 'play', 'sleep']);

export function normalizeInteractionMode(value) {
  return modes.has(value) ? value : 'random';
}

// Resolve one deliberate tap into an existing action so the normal cloud,
// multiplayer and diary paths remain responsible for saving the interaction.
export function resolveInteraction(mode, state, rng = Math.random) {
  const currentMode = normalizeInteractionMode(mode);
  const energy = Number.isFinite(state?.energy) ? state.energy : 76;
  if (currentMode === 'random') {
    if (state?.sleeping || energy < 24) return { type: 'sleep' };
    const sample = rng();
    const index = Number.isFinite(sample)
      ? Math.max(0, Math.min(randomActions.length - 1, Math.floor(sample * randomActions.length)))
      : 0;
    return { type: randomActions[index] };
  }
  if (currentMode === 'play' && energy < 8) return { type: 'sleep' };
  return { type: currentMode };
}

export function getInteractionHint(mode, state) {
  const currentMode = normalizeInteractionMode(mode);
  if (state?.sleeping && (currentMode === 'random' || currentMode === 'sleep')) return '点点小猫，轻轻叫醒它';
  if (currentMode === 'random') return state?.energy < 24 ? '小猫有点累，点点它陪它休息' : '点点小猫，看看它想做什么';
  if (currentMode === 'play') return state?.energy < 8 ? '小猫有点累，点点它先休息' : '点点小猫，陪它玩一会儿';
  if (currentMode === 'sleep') return '点点小猫，陪它做个好梦';
  return '点点小猫，给它温柔的摸摸';
}
