import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catTemperament, createCatBehavior, idleChoices } from '../src/cat-behavior.js';
import { createMageAnimationPlayer } from '../src/mage-cat-player.js';
import { createDialoguePicker, CAT_DIALOGUE } from '../src/cat-speech.js';

const at = hour => new Date(2026, 9, 14, hour).valueOf();
const healthy = { hunger: 70, energy: 76, mood: 90, sleeping: false };
const clips = ['idle', 'walk', 'run', 'attack', 'special_attack', 'turn_left', 'turn_right', 'hurt', 'death']
  .map(name => new THREE.AnimationClip(`Cat|${name}`, name === 'attack' ? 3.45 : name === 'special_attack' ? 2.883 : 1, []));
function fixture(options = {}) {
  const behavior = createCatBehavior({ random: () => .4, clock: () => at(14), ...options });
  behavior.setClips(clips); behavior.setState(healthy); return behavior;
}
function advance(behavior, seconds) { let pose; for (let i = 0; i < Math.ceil(seconds * 30); i++) pose = behavior.step(1 / 30); return pose; }

test('local day boundaries and current needs determine mood without mutating the shared state', () => {
  for (const [hour, period] of [[0, 'night'], [5, 'night'], [6, 'morning'], [10, 'morning'], [11, 'day'], [17, 'day'], [18, 'evening'], [21, 'evening'], [22, 'night'], [23, 'night']]) {
    assert.equal(catTemperament(healthy, at(hour)).period, period);
  }
  for (const [state, mood] of [[{ sleeping: true, hunger: 0 }, 'sleeping'], [{ hunger: 20 }, 'hungry'], [{ energy: 20 }, 'tired'], [{ mood: 20 }, 'lonely'], [{ energy: 60 }, 'sleepy'], [{}, 'happy']]) {
    const value = { ...healthy, ...state }; const before = structuredClone(value);
    assert.equal(catTemperament(value, at(23)).mood, mood); assert.deepEqual(value, before);
  }
});

test('five minutes of unattended behavior uses varied authored clips, with quiet gaps and no recent repeats', () => {
  let seed = 24; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const behavior = fixture({ random }), seen = [], keys = new Set(); let previousToken = 0, neutralFrames = 0;
  for (let i = 0; i < 30 * 300; i++) {
    const pose = behavior.step(1 / 30); keys.add(pose.clip);
    if (pose.id === 'idle') neutralFrames++;
    else if (pose.token !== previousToken) { assert.ok(!seen.slice(-2).includes(pose.id)); seen.push(pose.id); previousToken = pose.token; }
    assert.ok(!['hurt', 'death', 'attack', 'special_attack'].includes(pose.clip));
  }
  assert.ok(seen.length >= 15); assert.ok(new Set(seen).size >= 5);
  assert.ok(keys.has('walk')); assert.ok(keys.has('turn_left') || keys.has('turn_right'));
  assert.ok(neutralFrames > 30 * 100, 'leave breathing room between gestures');
});

test('night and fatigue suppress running, extend quiet gaps, and never persist autonomous sleep or rewards', () => {
  const behavior = fixture({ clock: () => at(23) });
  const state = { ...healthy, energy: 45, coins: 50, xp: 80, pendingGrowth: [] }, before = structuredClone(state);
  behavior.setState(state); const seen = new Set(); let starts = 0, token = 0;
  for (let i = 0; i < 30 * 300; i++) {
    const pose = behavior.step(1 / 30); seen.add(pose.id);
    assert.equal(pose.sleeping, false); assert.equal(pose.period, 'night'); assert.ok(!['walk', 'run', 'attack', 'special_attack'].includes(pose.clip));
    if (pose.token && pose.token !== token) { starts++; token = pose.token; }
  }
  assert.ok(seen.has('doze') && seen.has('yawn')); assert.ok(starts < 20); assert.deepEqual(state, before);
});

test('care interrupts idle immediately and emotion changes the same interaction', () => {
  const behavior = fixture(); advance(behavior, 5);
  const reaction = behavior.react('play', healthy);
  assert.equal(reaction.source, 'interaction'); assert.ok(['attack', 'run', 'special_attack'].includes(reaction.clip));
  assert.equal(reaction.eyes, 'excited');
  const pet = behavior.react('pet', { ...healthy, mood: 20 });
  assert.ok(['comfort', 'nuzzle'].includes(pet.id)); assert.equal(pet.source, 'interaction');
  const tired = behavior.react('play', { ...healthy, energy: 20 });
  assert.ok(['slowPlay', 'nuzzle'].includes(tired.id)); assert.ok(!['attack', 'run', 'special_attack'].includes(tired.clip));
  behavior.cancel(healthy); assert.equal(behavior.snapshot().id, 'idle');
  assert.equal(behavior.snapshot().mood, 'happy');
});

test('one-shot duration follows the actual authored clip and randomized speed, then returns to idle', () => {
  const behavior = fixture({ random: () => 0 }); const pose = behavior.react('play', healthy);
  assert.equal(pose.clip, 'special_attack'); assert.ok(Math.abs(pose.duration * pose.rate - 2.883) < 1e-10);
  advance(behavior, pose.duration - .08); assert.equal(behavior.snapshot().id, 'magic');
  advance(behavior, .12); assert.equal(behavior.snapshot().id, 'idle');
});

test('sleep, wake, suspension, missing clips and reduced motion keep a valid neutral pose', () => {
  const behavior = fixture(); behavior.react('play');
  behavior.setState({ sleeping: true }); const sleep = advance(behavior, 60);
  assert.equal(sleep.id, 'idle'); assert.equal(sleep.clip, 'idle'); assert.equal(sleep.eyes, 'closed'); assert.equal(sleep.rate, .25);
  const wake = behavior.react('sleep', { sleeping: false }); assert.equal(wake.id, 'wake'); assert.equal(wake.sleeping, false);
  behavior.react('play'); behavior.suspend(); assert.equal(behavior.snapshot().id, 'idle');
  assert.equal(behavior.step(0).id, 'idle', 'resume leaves a fresh quiet gap');
  const reduced = fixture({ reducedMotion: true }); assert.equal(reduced.react('play').clip, 'idle');
  for (let i = 0; i < 2000; i++) assert.equal(reduced.step(.1).clip, 'idle');
  const limited = fixture(); limited.setClips([clips[0]]); assert.equal(limited.react('play').clip, 'idle');
  for (const delta of [NaN, -2, Infinity, undefined]) assert.ok(Number.isFinite(limited.step(delta).time));
});

test('manual dragging and court mode can suppress unattended activity', () => {
  const court = fixture({ autonomous: false });
  assert.equal(advance(court, 300).id, 'idle');
  for (const mood of ['sleeping', 'tired', 'sleepy', 'hungry', 'lonely', 'calm', 'happy']) {
    const choices = idleChoices({ mood, quiet: ['sleeping', 'tired', 'sleepy'].includes(mood), night: true });
    assert.ok(!choices.some(([id]) => ['zoomies', 'magic', 'paw'].includes(id)));
  }
});

test('blink intervals vary and preserve the current emotional mouth', () => {
  let seed = 12; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const behavior = fixture({ random, autonomous: false }); behavior.setState({ mood: 20 });
  const blinks = []; let closed = false;
  for (let i = 0; i < 30 * 50; i++) {
    const pose = behavior.step(1 / 30);
    if (pose.eyes === 'closed' && !closed) blinks.push(i);
    assert.equal(pose.mouth, 'sad'); closed = pose.eyes === 'closed';
  }
  assert.ok(blinks.length > 6); assert.ok(new Set(blinks.slice(1).map((frame, i) => frame - blinks[i])).size > 3);
});

test('animation playback restarts repeated clips, loops locomotion, and releases faded actions', () => {
  const root = new THREE.Object3D(), mixer = new THREE.AnimationMixer(root);
  const player = createMageAnimationPlayer(mixer, clips);
  const sync = (clip, token, loop = false, rate = 1) => player.sync({ clip, token, loop, rate });
  sync('idle', 0, true); player.update(.3);
  sync('attack', 1); player.update(.5); assert.ok(mixer.clipAction(clips[3]).time > .4);
  sync('attack', 2); assert.equal(mixer.clipAction(clips[3]).time, 0);
  sync('walk', 3, true); player.update(2.4); assert.equal(mixer.clipAction(clips[1]).isRunning(), true);
  sync('idle', 0, true, .25); player.update(.3);
  for (const clip of clips.slice(1)) assert.equal(mixer.clipAction(clip).isRunning(), false);
  assert.equal(mixer.clipAction(clips[0]).getEffectiveTimeScale(), .25);
});

test('dialogue follows both mood and time, including touch feedback during care cooldowns', () => {
  const pick = createDialoguePicker(() => .4);
  for (const [kind, state, key] of [['pet', { mood: 20 }, 'comfort'], ['touch', { energy: 20 }, 'gentlePet'], ['play', { behaviorPeriod: 'night' }, 'gentlePlay'], ['idle', { behaviorPeriod: 'night' }, 'night'], ['greeting', { behaviorPeriod: 'morning' }, 'morning']]) {
    assert.ok(CAT_DIALOGUE[key].includes(pick(kind, { ...healthy, ...state })));
  }
});
