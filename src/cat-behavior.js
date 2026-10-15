import { clipKey } from './mage-cat-animation.js';
import { normalizeCatExpression } from './cat-expressions.js';
import { catAction, MANUAL_ONLY_CAT_CLIPS } from './cat-actions.js';
import { localNestTime, NEST_PERIODS } from './nest-life.js';

export const CAT_MOODS = Object.freeze({
  sleeping: '梦乡里', hungry: '肚子饿啦', tired: '有点累了', lonely: '想被陪伴',
  sleepy: '困意来了', happy: '心情很好', calm: '悠闲自在',
});
export const CAT_PERIODS = Object.freeze(Object.fromEntries(Object.entries(NEST_PERIODS).map(([id,period])=>[id,period.label])));
export const CAT_EXPRESSION_SECONDS = 3;

/** Local time only affects presentation; it never changes the shared care save. */
export function catTemperament(state = {}, now = Date.now(), expression = 'auto') {
  const {period} = localNestTime(now);
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
// Autonomous care uses gentle clips; all nine can be played explicitly from the palette.
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
  foodStep: { label: '吃饱啦，轻快地踏踏步', clip: 'walk', rate: .85, eyes: 'happy', mouth: 'happy' },
  magic: { label: '为你变一小段魔法', clip: 'special_attack', eyes: 'excited', mouth: 'happy', wide: true },
  paw: { label: '挥挥魔杖追玩具', clip: 'attack', eyes: 'excited', mouth: 'happy' },
  chase: { label: '小跑着追逗猫棒', clip: 'run', cycles: 2, eyes: 'excited', mouth: 'happy' },
  slowPlay: { label: '轻轻踏步，陪你玩一会儿', clip: 'walk', rate: .72, eyes: 'tired', mouth: 'happy' },
  wake: { label: '揉揉眼，向你道声好', clip: 'idle', seconds: 2.8, eyes: 'basic', mouth: 'happy' },
  sleepyTouch: { label: '呼噜…睡梦里也收到你的招呼啦', clip: 'idle', seconds: 2.6, eyes: 'closed', mouth: 'happy', rate: .25 },
  ambientSpill: { label:'拨拨线团，再追着玩一会儿',clip:'idle',seconds:6.5,eyes:'excited',mouth:'happy' },
  ambientGift: { label:'发现了一件小宝贝',clip:'turn_left',eyes:'excited',mouth:'happy' },
  ambientAffection: { label:'忽然凑过来撒个娇',clip:'idle',seconds:3.5,eyes:'happy',mouth:'happy' },
};
const LIVELY_CLIP_GAPS = Object.freeze({ run: 50, attack: 60, special_attack: 90 });

export function idleChoices(temperament) {
  if (temperament.mood === 'sleeping') return [];
  if (temperament.quiet) return [['yawn', 3], ['doze', temperament.night ? 5 : 2], ['watch', 1]];
  if (temperament.mood === 'hungry') return [['watch', 3], ['left', 2], ['right', 2]];
  if (temperament.mood === 'lonely') return [['nuzzle', 4], ['watch', 2], ['left', 1], ['right', 1], ['stroll', 1]];
  if (temperament.night) return [['watch', 2], ['left', 1], ['right', 1], ['yawn', 3], ['doze', 2], ['nuzzle', 2]];
  return [['watch', 2], ['left', 2], ['right', 2], ['stroll', 2], ['nuzzle', 2], ['wink', 1],
    ...(temperament.energetic ? [['zoomies', temperament.period === 'evening' ? 3 : 1], ['paw', 1], ['magic', .6]] : [])];
}

/** Different gestures sharing a clip still look alike; prefer fresh clips as well as IDs. */
function choose(choices, recent, sample, recentClips) {
  // Small reaction sets may revisit the second-last choice, avoiding a fixed three-step cycle.
  const avoided = choices.length > 3 ? recent : recent.slice(-1);
  const fresh = choices.filter(([id]) => !avoided.includes(id));
  const pool = fresh.length ? fresh : choices.filter(([id]) => id !== recent.at(-1));
  const available = pool.length ? pool : choices;
  const clipWindow = new Set(choices.map(([id]) => ACTIVITIES[id].clip)).size > 3 ? recentClips : recentClips.slice(-1);
  const freshClips = available.filter(([id]) => !clipWindow.includes(ACTIVITIES[id].clip));
  const varied = (freshClips.length ? freshClips : available).map(([id, weight]) =>
    [id, weight * (recentClips.includes(ACTIVITIES[id].clip) ? .55 : 1)]);
  let cursor = sample() * varied.reduce((sum, [, weight]) => sum + weight, 0);
  return (varied.find(([, weight]) => (cursor -= weight) < 0) || varied.at(-1))[0];
}

export function createCatBehavior({ random = Math.random, clock = Date.now, reducedMotion = false, autonomous = true } = {}) {
  let state = {}, expression = 'auto', expressionTime = 0, active = null, sequence = 0, elapsed = 0, blinkLeft = 0;
  let catalog = new Map([['idle', 2.333]]), idleRecent = [], reactionRecent = [];
  const recentClips = [], recentGestures = [], lastClipAt = new Map();
  let lastLivelyAt = 0;
  const sample = () => { const value = random(); return Number.isFinite(value) ? Math.max(0, Math.min(.999999, value)) : .5; };
  let idleIn = 3 + sample() * 3, blinkIn = 2.8 + sample() * 3.6;
  const temperament = () => catTemperament(state, clock(), expression);
  const wait = () => { const t = temperament(); return (t.quiet || t.night ? 12 : 5) + sample() * (t.quiet || t.night ? 12 : 8); };
  function neutral() { active = null; idleIn = wait(); }
  function clearExpression() { expression = 'auto'; expressionTime = 0; }
  function remember(id, clip) {
    recentGestures.push(id); if (recentGestures.length > 2) recentGestures.shift();
    recentClips.push(clip); if (recentClips.length > 2) recentClips.shift();
    lastClipAt.set(clip, elapsed);
    if (LIVELY_CLIP_GAPS[clip]) lastLivelyAt = elapsed;
  }
  function select(choices, source) {
    const allowed = choices.filter(([id]) => {
      const clip = ACTIVITIES[id].clip;
      if (MANUAL_ONLY_CAT_CLIPS.includes(clip)) return false;
      return source !== 'idle' || !LIVELY_CLIP_GAPS[clip]
        || (elapsed - lastLivelyAt >= 45 && elapsed - (lastClipAt.get(clip) ?? -Infinity) >= LIVELY_CLIP_GAPS[clip]);
    });
    if (!allowed.length) { neutral(); return; }
    const history = source === 'idle' ? idleRecent : reactionRecent;
    start(choose(allowed, [...history, ...recentGestures], sample, recentClips), source);
  }
  function start(id, source) {
    const definition = ACTIVITIES[id];
    const clip = reducedMotion || !catalog.has(definition.clip) ? 'idle' : definition.clip;
    const t = temperament();
    const rate = reducedMotion ? .45 : (definition.rate || (t.quiet ? .7 : t.night ? .85 : 1)) * (.94 + sample() * .12);
    const seconds = clip === 'idle' ? (definition.seconds || 2.6) : catalog.get(clip) * (definition.cycles || 1) / rate;
    active = { ...definition, id, token: ++sequence, source, clip, rate, duration: seconds, time: 0 };
    const recent = source === 'idle' ? idleRecent : reactionRecent;
    recent.push(id); if (recent.length > 2) recent.shift();
    remember(id, clip);
    blinkLeft = 0;
    idleIn = wait();
  }
  function snapshot() {
    const t = temperament();
    const playingAction = active?.source === 'animation';
    const sleeping = t.mood === 'sleeping' && !playingAction;
    const base = FACES[t.mood];
    const expressive = active && (playingAction || active.time < active.duration * .88);
    const face = expressive && active.eyes ? { eyes: active.eyes, mouth: active.mouth || base.mouth } : base;
    const presenting = expression !== 'auto';
    return { ...t, expression, id: presenting ? 'expression' : active?.id || 'idle', token: presenting ? sequence : active?.token || 0, source: presenting ? 'expression' : active?.source || 'idle',
      label: active?.label || (sleeping ? '安静地做着小猫梦' : t.moodLabel),
      clip: active?.clip || 'idle', loop: !playingAction && ['idle', 'walk', 'run'].includes(active?.clip || 'idle'),
      rate: active?.rate || (sleeping ? .25 : reducedMotion ? .45 : t.quiet ? .55 : t.night ? .8 : 1),
      time: presenting ? expressionTime : active?.time || 0, duration: presenting ? CAT_EXPRESSION_SECONDS : active?.duration || 0, elapsed,
      wide: !reducedMotion && Boolean(active?.wide), sleeping,
      eyes: sleeping || (!presenting && !playingAction && blinkLeft > 0) ? 'closed' : face.eyes, mouth: sleeping && active?.id !== 'sleepyTouch' ? 'basic' : face.mouth };
  }
  function canAmbientEvent(){return expression==='auto'&&!state.sleeping&&!['interaction','animation'].includes(active?.source);}
  return {
    canAmbientEvent,
    ambientEvent(kind) {
      const id={spill:'ambientSpill',gift:'ambientGift',affection:'ambientAffection'}[kind];
      if(!id||!canAmbientEvent())return false;
      start(id,'ambient');return snapshot();
    },
    setClips(clips) {
      catalog = new Map(clips.map(clip => [clipKey(clip.name), clip.duration]));
    },
    setExpression(value) {
      expression = normalizeCatExpression(value); expressionTime = 0; sequence += 1; neutral(); blinkLeft = 0;
      return snapshot();
    },
    playAction(value) {
      const action = catAction(value);
      if (!action) return snapshot();
      clearExpression();
      const clip = reducedMotion || !catalog.has(action.clip) ? 'idle' : action.clip;
      const rate = reducedMotion ? .45 : 1;
      active = { ...action, id: `animation-${action.id}`, label: action.name, clip,
        token: ++sequence, source: 'animation', rate, time: 0,
        duration: (catalog.get(clip) || 2.333) / rate + (action.hold || 0) };
      remember(active.id, clip);
      blinkLeft = 0;
      return snapshot();
    },
    setState(value = {}) {
      const before = temperament(); state = { ...state, ...value }; const after = temperament();
      if (before.mood !== after.mood || before.period !== after.period) {
        // Care feedback finishes; unattended activity yields immediately to a changed need.
        if (active?.source !== 'animation' && (active?.source !== 'interaction' || before.mood === 'sleeping' || after.mood === 'sleeping')) neutral();
      }
      return snapshot();
    },
    react(type, value = {}) {
      clearExpression();
      const wasSleeping = Boolean(state.sleeping);
      if (typeof value.sleeping !== 'boolean') value = { ...value, sleeping: type === 'sleep' ? !wasSleeping : ['pet', 'feed', 'play'].includes(type) ? false : wasSleeping };
      state = { ...state, ...value };
      const t = temperament();
      if (t.mood === 'sleeping') { if (type === 'touch') start('sleepyTouch', 'interaction'); else neutral(); return snapshot(); }
      let choices;
      if (type === 'sleep') choices = [['wake', 1]];
      else if (type === 'pet' || type === 'touch') choices = t.quiet ? [['gentle', 3], ['comfort', 1]]
        : t.mood === 'lonely' ? [['comfort', 3], ['nuzzle', 2]]
        : t.mood === 'hungry' ? [['watch', 3], ['pet', 2], ['nuzzle', 1]]
        : [['pet', 3], ['nuzzle', 2], ['wink', 1], ['left', 1], ['right', 1]];
      else if (type === 'feed') choices = t.quiet || t.night ? [['savor', 3], ['feed', 1]]
        : [['feed', 3], ['savor', 2], ...(t.energetic ? [['foodStep', 1]] : [])];
      else if (type === 'play') choices = t.quiet || t.night || t.mood === 'hungry' ? [['slowPlay', 1], ['nuzzle', 1]]
        : t.mood === 'lonely' ? [['nuzzle', 3], ['slowPlay', 2], ['left', 1], ['right', 1]]
        : t.energetic ? [['magic', 3], ['paw', 2], ['chase', 2]] : [['slowPlay', 3], ['paw', 1], ['left', 1], ['right', 1]];
      else if (type === 'dress') choices = [['left', 1], ['right', 1], ['wink', 1]];
      else return snapshot();
      select(choices, 'interaction');
      return snapshot();
    },
    cancel(value = {}) { state = { ...state, ...value }; clearExpression(); neutral(); return snapshot(); },
    suspend() { clearExpression(); neutral(); blinkLeft = 0; blinkIn = 2.8 + sample() * 3.6; },
    step(delta = 0) {
      delta = Number.isFinite(delta) ? Math.max(0, Math.min(.1, delta)) : 0;
      elapsed += delta;
      if (expression !== 'auto') {
        expressionTime += delta;
        if (expressionTime >= CAT_EXPRESSION_SECONDS) { clearExpression(); neutral(); }
        return snapshot();
      }
      if (active) { active.time += delta; if (active.time >= active.duration) neutral(); }
      else {
        idleIn -= delta;
        if (autonomous && idleIn <= 0) {
          const choices = idleChoices(temperament());
          if (choices.length) select(choices, 'idle');
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
