import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_DIALOGUE, FOOD_DIALOGUE, createDialoguePicker, createCatSpeech,
  SPEECH_HOLD_MS, SPEECH_FADE_MS, SPEECH_CHARACTER_MS } from '../src/cat-speech.js';
import { FOODS, initialState, reduceAction } from '../src/state.js';

function fixture({ motion = false, state = initialState() } = {}) {
  const nodes = Object.fromEntries(['speech-text', 'speech-content', 'speech-name', 'speech-announcement']
    .map(key => [`.${key}`, { textContent:'', dataset:{} }]));
  const classes = new Set();
  const element = { hidden:true, dataset:{}, querySelector:key => nodes[key],
    classList:{ add:(...names) => names.forEach(name => classes.add(name)), remove:(...names) => names.forEach(name => classes.delete(name)) } };
  let now = 0, nextId = 0, allowed = true;
  const timers = new Map();
  const speech = createCatSpeech({ element, getState:() => state, canSpeak:() => allowed,
    reducedMotion:() => motion, random:() => 0,
    schedule(fn, ms) { const id = ++nextId; timers.set(id, { fn, at:now + ms }); return id; },
    cancel(id) { timers.delete(id); },
  });
  function tick(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, task]) => task.at <= end);
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  }
  return { speech, element, nodes, classes, tick, timers, state,
    setAllowed(value) { allowed = value; },
    get line() { return nodes['.speech-content'].textContent; },
    get completeLine() { return nodes['.speech-text'].dataset.line; },
    get announcement() { return nodes['.speech-announcement'].textContent; },
  };
}

test('each dialogue context exhausts its variants without adjacent or cycle-boundary repeats', () => {
  for (const kind of ['greeting', 'idle', 'pet', 'play', 'sleep', 'wake', 'dress', 'feeding', 'collect']) {
    const pick = createDialoguePicker(() => 0);
    const state = { name:'糯米', sleeping:kind === 'sleep', hunger:60, energy:60, mood:60 };
    const lines = CAT_DIALOGUE[kind];
    assert.ok(lines.length >= 4, kind);
    let previous;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const used = new Set();
      for (let index = 0; index < lines.length; index += 1) {
        const line = pick(kind, state);
        assert.notEqual(line, previous, kind);
        assert.ok(lines.includes(line), kind);
        used.add(line); previous = line;
      }
      assert.equal(used.size, lines.length, kind);
    }
  }
});

test('all nine foods have distinct reactions and another caregiver is addressed by the cat', () => {
  assert.deepEqual(Object.keys(FOOD_DIALOGUE).sort(), Object.keys(FOODS).sort());
  const pick = createDialoguePicker(() => .5);
  for (const food of Object.keys(FOODS)) {
    const heard = new Set(Array.from({ length:FOOD_DIALOGUE[food].length }, () => pick('feed', {}, { food })));
    assert.deepEqual(heard, new Set(FOOD_DIALOGUE[food]));
    const partnerLine = pick('feed', {}, { food }, { name:'女方', mine:false });
    assert.ok(partnerLine.startsWith('女方，'));
    assert.ok(FOOD_DIALOGUE[food].includes(partnerLine.slice(3)));
  }
});

test('idle thoughts follow sleep, hunger, energy and mood without confusing wake with rest', () => {
  const pick = createDialoguePicker(() => 0);
  const contexts = [
    [{ sleeping:true, hunger:0, energy:0, mood:0 }, 'sleep'],
    [{ hunger:20, energy:50, mood:50 }, 'hungry'],
    [{ hunger:60, energy:20, mood:50 }, 'tired'],
    [{ hunger:60, energy:50, mood:20 }, 'lonely'],
    [{ hunger:95, energy:50, mood:50 }, 'full'],
  ];
  for (const [state, key] of contexts) assert.ok(CAT_DIALOGUE[key].includes(pick('idle', state)));
  assert.ok(CAT_DIALOGUE.sleep.includes(pick('sleep', { sleeping:true })));
  assert.ok(CAT_DIALOGUE.wake.includes(pick('sleep', { sleeping:false })));
  assert.match(pick('rename', { name:'小团子' }), /小团子/);
});

test('a spoken line types in place, stays six seconds after completion, then disappears', () => {
  const f = fixture();
  f.speech.start();
  assert.equal(f.element.hidden, false);
  assert.equal(Array.from(f.line).length, 1);
  assert.equal(f.announcement, '', 'screen readers do not receive every typed letter');
  const typingTime = (Array.from(f.completeLine).length - 1) * SPEECH_CHARACTER_MS;
  f.tick(typingTime);
  assert.equal(f.line, f.completeLine);
  assert.equal(f.announcement, `糯米说：${f.line}`);
  f.tick(SPEECH_HOLD_MS - 1);
  assert.equal(f.classes.has('is-speaking'), true);
  f.tick(1);
  assert.equal(f.classes.has('is-speaking'), false);
  assert.equal(f.announcement, '');
  f.tick(SPEECH_FADE_MS);
  assert.equal(f.element.hidden, true);
  assert.equal(f.line, '');
});

test('a new interaction cancels the previous hold, typing and fade timers', () => {
  const f = fixture({ motion:true });
  f.speech.start();
  f.tick(SPEECH_HOLD_MS - 50);
  f.speech.say('pet');
  const petLine = f.line;
  f.tick(100);
  assert.equal(f.line, petLine);
  assert.equal(f.element.hidden, false, 'the greeting must not hide a new response');
  f.tick(SPEECH_HOLD_MS);
  assert.equal(f.element.hidden, true);

  const animated = fixture();
  animated.speech.start();
  animated.tick(100);
  animated.speech.say('feed', { food:'water' });
  animated.tick(2000);
  assert.equal(animated.line, animated.completeLine);
  assert.ok(FOOD_DIALOGUE.water.includes(animated.line));
  animated.tick(SPEECH_HOLD_MS - 1000);
  animated.speech.say('play');
  animated.tick(2000);
  assert.ok(CAT_DIALOGUE.play.includes(animated.line));
  assert.equal(animated.element.hidden, false);
});

test('idle speech leaves a quiet gap, pauses in hidden views, and resumes without a backlog', () => {
  const f = fixture({ motion:true });
  f.speech.start(); f.tick(SPEECH_HOLD_MS);
  assert.equal(f.element.hidden, true);
  f.tick(27999); assert.equal(f.element.hidden, true);
  f.tick(1); assert.equal(f.element.hidden, false);
  f.setAllowed(false); f.speech.sync();
  assert.equal(f.element.hidden, true);
  f.tick(120000); assert.equal(f.element.hidden, true);
  assert.equal(f.timers.size, 0);
  f.setAllowed(true); f.speech.sync();
  f.tick(27999); assert.equal(f.element.hidden, true);
  f.tick(1); assert.equal(f.element.hidden, false);
  f.speech.stop(); f.tick(120000);
  assert.equal(f.element.hidden, true); assert.equal(f.timers.size, 0);
});

test('a response arriving during fade-out is not removed by the old fade callback', () => {
  const f = fixture();
  f.speech.start();
  f.tick((Array.from(f.completeLine).length - 1) * SPEECH_CHARACTER_MS + SPEECH_HOLD_MS);
  assert.equal(f.classes.has('is-speaking'), false);
  assert.equal(f.element.hidden, false, 'fade is still in progress');
  f.speech.say('pet');
  f.tick(SPEECH_FADE_MS + 2000);
  assert.equal(f.element.hidden, false);
  assert.equal(f.classes.has('is-speaking'), true);
  assert.ok(CAT_DIALOGUE.pet.includes(f.line));
});

test('speech expiry and idle chatter never change resources or expire unclaimed growth', () => {
  const state = reduceAction(initialState(), { type:'pet' }, { id:'partner-male', name:'男方' }, Date.now(), 'speech-test-reward');
  const snapshot = structuredClone(state);
  const f = fixture({ state, motion:true });
  f.speech.start(); f.speech.say('pet'); f.tick(10 * 60000);
  assert.deepEqual(state, snapshot);
  assert.equal(state.pendingGrowth.length, 1);
  assert.equal(state.pendingGrowth[0].amount, 3.3);
  f.speech.stop();
});
