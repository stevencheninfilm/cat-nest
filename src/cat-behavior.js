import { clipKey } from './mage-cat-animation.js';
import { normalizeCatExpression } from './cat-expressions.js';

export const CAT_MOODS = Object.freeze({
  sleeping: '梦乡里', hungry: '肚子饿啦', tired: '有点累了', lonely: '想被陪伴',
  sleepy: '困意来了', happy: '心情很好', calm: '悠闲自在',
});
export const CAT_PERIODS = Object.freeze({ morning: '早安时光', day: '午后时光', evening: '晚间陪伴', night: '静谧深夜' });

/** Local time only affects presentation; it never changes the shared care save. */
export function catTemperament(state = {}, now = Date.now(), expression = 'auto') {
  const hour = new Date(now).getHours();
  const period = hour >= 6 && hour < 11 ? 'morning' : hour >= 11 && hour < 18 ? 'day' : hour >= 18 && hour < 22 ? 'evening' : 'night';
  const hunger = Number.isFinite(state.hunger) ? state.hunger : 68;
  const energy = Number.isFinite(state.energy) ? state.energy : 76;
  const moodValue = Number.isFinite(state.mood) ? state.mood : 82;
  const automaticMood = state.sleeping ? 'sleeping' : hunger < 35 ? 'hungry' : energy < 30 ? 'tired' : moodValue < 40 ? 'lonely'
    : period === 'night' && energy < 65 ? 'sleepy' : moodValue >= 80 && energy >= 50 ? 'happy' : 'calm';
  expression = normalizeCatExpression(expression);
  const mood = expression === 'auto' ? automaticMood : expression;
  return { mood, period, moodLabel: CAT_MOODS[mood], periodLabel: CAT_PERIODS[period],
    quiet: ['sleeping', 'tired', 'sleepy'].includes(mood), night: period === 'night',
    energetic: mood === 'happy' && period !== 'night' && hunger >= 35 && energy >= 50 };
}

const FACES = {
  sleeping: { eyes: 'closed', mouth: 'basic' }, hungry: { eyes: 'unamused', mouth: 'sad' },
  tired: { eyes: 'tired', mouth: 'basic' }, lonely: { eyes: 'sad', mouth: 'sad' },
  sleepy: { eyes: 'tired', mouth: 'basic' }, happy: { eyes: 'happy', mouth: 'happy' }, calm: { eyes: 'basic', mouth: 'basic' },
};
// Only appropriate authored clips are used. Hurt and Death remain combat assets.
const ACTIVITIES = {
  watch: { label: '好奇地看看你', clip: 'idle', seconds: 2.4, eyes: 'excited', mouth: 'basic' },
  left: { label: '往左瞧一瞧', clip: 'turn_left' },
  right: { label: '往右瞧一瞧', clip: 'turn_right' },
  stroll: { label: '悠闲地踏踏步', clip: 'walk', cycles: 1, rate: .85 },
  zoomies: { label: '开心地跑跑跳跳', clip: 'run', cycles: 2 },
  nuzzle: { label: '把小脑袋凑过来', clip: 'idle', seconds: 2.8, eyes: 'happy', mouth: 'happy' },
  wink: { label: '悄悄对你眨眨眼', clip: 'idle', seconds: 1.6, eyes: 'wink', mouth: 'happy' },
  yawn: { label: '打了个小哈欠', clip: 'idle', seconds: 2.6, eyes: 'tired', mouth: 'surprised' },
  doze: { label: '眯着眼打个小盹', clip: 'idle', seconds: 5, eyes: 'closed', mouth: 'basic', rate: .3 },
  pet: { label: '舒服地蹭蹭你的手', clip: 'idle', seconds: 2.6, eyes: 'happy', mouth: 'happy' },
  comfort: { label: '被安慰到，慢慢放松了', clip: 'idle', seconds: 3.2, eyes: 'happy', mouth: 'happy' },
  gentle: { label: '困困地回应你的摸摸', clip: 'idle', seconds: 2.8, eyes: 'tired', mouth: 'happy' },
  feed: { label: '开心地吃着小餐', clip: 'idle', seconds: 2.8, eyes: 'excited', mouth: 'happy' },
  savor: { label: '眯着眼，慢慢品尝', clip: 'idle', seconds: 3.1, eyes: 'happy', mouth: 'happy' },
  magic: { label: '为你变一小段魔法', clip: 'special_attack', eyes: 'excited', mouth: 'happy', wide: true },
  paw: { label: '挥挥魔杖追玩具', clip: 'attack', eyes: 'excited', mouth: 'happy' },
  chase: { label: '小跑着追逗猫棒', clip: 'run', cycles: 2, eyes: 'excited', mouth: 'happy' },
  slowPlay: { label: '轻轻踏步，陪你玩一会儿', clip: 'walk', rate: .72, eyes: 'tired', mouth: 'happy' },
  wake: { label: '揉揉眼，向你道声好', clip: 'idle', seconds: 2.8, eyes: 'basic', mouth: 'happy' },
  sleepyTouch: { label: '呼噜…睡梦里也收到你的招呼啦', clip: 'idle', seconds: 2.6, eyes: 'closed', mouth: 'happy', rate: .25 },
};

export function idleChoices(temperament) {
  if (temperament.mood === 'sleeping') return [];
  if (temperament.quiet) return [['yawn', 3], ['doze', temperament.night ? 5 : 2], ['watch', 1]];
  if (temperament.mood === 'hungry') return [['watch', 3], ['left', 2], ['right', 2]];
  if (temperament.mood === 'lonely') return [['nuzzle', 4], ['watch', 2], ['left', 1], ['right', 1]];
  if (temperament.night) return [['watch', 2], ['left', 1], ['right', 1], ['yawn', 3], ['doze', 2], ['nuzzle', 2]];
  return [['watch', 2], ['left', 2], ['right', 2], ['stroll', 2], ['nuzzle', 2], ['wink', 1],
    ...(temperament.energetic ? [['zoomies', temperament.period === 'evening' ? 3 : 1]] : [])];
}

/** Weighted selection avoids recent activities whenever the context has alternatives. */
function choose(choices, recent, sample) {
  const fresh = choices.filter(([id]) => !recent.includes(id));
  const pool = fresh.length ? fresh : choices.filter(([id]) => id !== recent.at(-1));
  const available = pool.length ? pool : choices;
  let cursor = sample() * available.reduce((sum, [, weight]) => sum + weight, 0);
  return (available.find(([, weight]) => (cursor -= weight) < 0) || available.at(-1))[0];
}

export function createCatBehavior({ random = Math.random, clock = Date.now, reducedMotion = false, autonomous = true } = {}) {
  let state = {}, expression = 'auto', active = null, sequence = 0, elapsed = 0, blinkLeft = 0;
  let catalog = new Map([['idle', 2.333]]), idleRecent = [], reactionRecent = [];
  const sample = () => { const value = random(); return Number.isFinite(value) ? Math.max(0, Math.min(.999999, value)) : .5; };
  let idleIn = 3 + sample() * 3, blinkIn = 2.8 + sample() * 3.6;
  const temperament = () => catTemperament(state, clock(), expression);
  const wait = () => { const t = temperament(); return (t.quiet || t.night ? 12 : 5) + sample() * (t.quiet || t.night ? 12 : 8); };
  function neutral() { active = null; idleIn = wait(); }
  function start(id, source) {
    const definition = ACTIVITIES[id];
    const clip = reducedMotion || !catalog.has(definition.clip) ? 'idle' : definition.clip;
    const t = temperament();
    const rate = reducedMotion ? .45 : (definition.rate || (t.quiet ? .7 : t.night ? .85 : 1)) * (.94 + sample() * .12);
    const seconds = clip === 'idle' ? (definition.seconds || 2.6) : catalog.get(clip) * (definition.cycles || 1) / rate;
    active = { ...definition, id, token: ++sequence, source, clip, rate, duration: seconds, time: 0 };
    const recent = source === 'idle' ? idleRecent : reactionRecent;
    recent.push(id); if (recent.length > 2) recent.shift();
    blinkLeft = 0;
    idleIn = wait();
  }
  function snapshot() {
    const t = temperament();
    const sleeping = t.mood === 'sleeping';
    const base = FACES[t.mood];
    const expressive = active && active.time < active.duration * .88;
    const face = expressive && active.eyes ? { eyes: active.eyes, mouth: active.mouth || base.mouth } : base;
    return { ...t, expression, id: active?.id || 'idle', token: active?.token || 0, source: active?.source || 'idle',
      label: active?.label || (sleeping ? '安静地做着小猫梦' : t.moodLabel),
      clip: active?.clip || 'idle', loop: ['idle', 'walk', 'run'].includes(active?.clip || 'idle'),
      rate: active?.rate || (sleeping ? .25 : reducedMotion ? .45 : t.quiet ? .55 : t.night ? .8 : 1),
      time: active?.time || 0, duration: active?.duration || 0, elapsed,
      wide: !reducedMotion && Boolean(active?.wide), sleeping,
      eyes: sleeping || blinkLeft > 0 ? 'closed' : face.eyes, mouth: sleeping && active?.id !== 'sleepyTouch' ? 'basic' : face.mouth };
  }
  return {
    setClips(clips) {
      catalog = new Map(clips.map(clip => [clipKey(clip.name), clip.duration]));
    },
    setExpression(value) {
      expression = normalizeCatExpression(value); neutral(); blinkLeft = 0;
      return snapshot();
    },
    setState(value = {}) {
      const before = temperament(); state = { ...state, ...value }; const after = temperament();
      if (before.mood !== after.mood || before.period !== after.period) {
        // Care feedback finishes; unattended activity yields immediately to a changed need.
        if (active?.source !== 'interaction' || before.mood === 'sleeping' || after.mood === 'sleeping') neutral();
      }
      return snapshot();
    },
    react(type, value = {}) {
      const wasSleeping = Boolean(state.sleeping);
      if (typeof value.sleeping !== 'boolean') value = { ...value, sleeping: type === 'sleep' ? !wasSleeping : ['pet', 'feed', 'play'].includes(type) ? false : wasSleeping };
      state = { ...state, ...value };
      // Deliberate care can wake a posed sleeping face without altering care data.
      if (type === 'sleep' || (expression === 'sleeping' && ['pet', 'feed', 'play'].includes(type))) expression = 'auto';
      const t = temperament();
      if (t.mood === 'sleeping') { if (type === 'touch') start('sleepyTouch', 'interaction'); else neutral(); return snapshot(); }
      let choices;
      if (type === 'sleep') choices = [['wake', 1]];
      else if (type === 'pet' || type === 'touch') choices = t.quiet ? [['gentle', 3], ['comfort', 1]] : t.mood === 'lonely' ? [['comfort', 3], ['nuzzle', 2]] : [['pet', 3], ['nuzzle', 2], ['wink', 1]];
      else if (type === 'feed') choices = t.quiet ? [['savor', 1]] : [['feed', 3], ['savor', 1]];
      else if (type === 'play') choices = t.quiet || t.night || t.mood === 'hungry' ? [['slowPlay', 1], ['nuzzle', 1]] : [['magic', 3], ['paw', 2], ['chase', 2]];
      else if (type === 'dress') choices = [['left', 1], ['right', 1], ['wink', 1]];
      else return snapshot();
      start(choose(choices, reactionRecent, sample), 'interaction');
      return snapshot();
    },
    cancel(value = {}) { state = { ...state, ...value }; neutral(); return snapshot(); },
    suspend() { neutral(); blinkLeft = 0; blinkIn = 2.8 + sample() * 3.6; },
    step(delta = 0) {
      delta = Number.isFinite(delta) ? Math.max(0, Math.min(.1, delta)) : 0;
      elapsed += delta;
      if (active) { active.time += delta; if (active.time >= active.duration) neutral(); }
      else {
        idleIn -= delta;
        if (autonomous && idleIn <= 0) {
          const choices = idleChoices(temperament());
          if (choices.length) start(choose(choices, idleRecent, sample), 'idle');
          else idleIn = wait();
        }
      }
      blinkLeft = Math.max(0, blinkLeft - delta); blinkIn -= delta;
      if (blinkIn <= 0) { blinkLeft = .13 + sample() * .08; blinkIn = 2.8 + sample() * 3.6; }
      return snapshot();
    },
    snapshot,
  };
}
