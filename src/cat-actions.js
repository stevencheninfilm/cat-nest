/** Presentation choices map directly to the licensed model's original clips. */
export const CAT_ACTIONS = Object.freeze([
  { id: 'idle', name: '待机', original: 'Idle', clip: 'idle', icon: 'sparkles', eyes: 'basic', mouth: 'basic' },
  { id: 'walk', name: '走走', original: 'Walk', clip: 'walk', icon: 'footprints', eyes: 'basic', mouth: 'happy' },
  { id: 'run', name: '小跑', original: 'Run', clip: 'run', icon: 'rabbit', eyes: 'excited', mouth: 'happy' },
  { id: 'attack', name: '挥魔杖', original: 'Attack', clip: 'attack', icon: 'wand-sparkles', eyes: 'angry', mouth: 'serious' },
  { id: 'special_attack', name: '小魔法', original: 'Special Attack', clip: 'special_attack', icon: 'sparkles', eyes: 'excited', mouth: 'happy', wide: true },
  // The listing calls this Hit; the purchased rig names the same authored clip Hurt.
  { id: 'hit', name: '吓一跳', original: 'Hit', clip: 'hurt', icon: 'shield-alert', eyes: 'panic', mouth: 'surprised', manualOnly: true },
  { id: 'death', name: '装晕', original: 'Death', clip: 'death', icon: 'drama', eyes: 'closed', mouth: 'basic', hold: .5, manualOnly: true },
  { id: 'turn_left', name: '向左转', original: 'Turn Left', clip: 'turn_left', icon: 'rotate-ccw', eyes: 'basic', mouth: 'basic' },
  { id: 'turn_right', name: '向右转', original: 'Turn Right', clip: 'turn_right', icon: 'rotate-cw', eyes: 'basic', mouth: 'basic' },
].map((action, index) => Object.freeze({ ...action, art: `${index % 3 * 50}% ${Math.floor(index / 3) * 50}%` })));

export const MANUAL_ONLY_CAT_CLIPS = Object.freeze(CAT_ACTIONS.filter(action => action.manualOnly).map(action => action.clip));

export function catAction(value) { return CAT_ACTIONS.find(action => action.id === value) || null; }

export function catActionPortrait(value) {
  const action = catAction(value) || CAT_ACTIONS[0];
  return `<span class="action-portrait" style="--action-art:${action.art}" aria-hidden="true"></span>`;
}
