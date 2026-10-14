import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERACTION_MODES, normalizeInteractionMode, resolveInteraction, getInteractionHint } from '../src/interaction-mode.js';
import { initialState, reduceAction } from '../src/state.js';

test('the mode picker defaults to random and accepts only known modes', () => {
  assert.deepEqual(INTERACTION_MODES.map(mode => mode.id), ['random', 'pet', 'play', 'sleep']);
  assert.equal(normalizeInteractionMode('pet'), 'pet');
  assert.equal(normalizeInteractionMode('feed'), 'random');
  assert.equal(normalizeInteractionMode(null), 'random');
});

test('random taps can select each of the three interactions', () => {
  const state = initialState();
  assert.deepEqual(resolveInteraction('random', state, () => 0), { type: 'pet' });
  assert.deepEqual(resolveInteraction('random', state, () => 0.5), { type: 'play' });
  assert.deepEqual(resolveInteraction('random', state, () => 0.999), { type: 'sleep' });
  assert.equal(state.history.length, 0);
  assert.equal(state.sleeping, false);
});

test('a tired cat rests in random mode without rolling an impossible play', () => {
  const tired = { ...initialState(), energy: 7 };
  assert.deepEqual(resolveInteraction('random', tired, () => { throw new Error('must not roll while tired'); }), { type: 'sleep' });
  const after = reduceAction(tired, resolveInteraction('random', tired));
  assert.equal(after.sleeping, true);
  assert.equal(after.energy, 27);
  assert.equal(after.history.length, 1);
});

test('a tap on a sleeping cat in random mode wakes it once', () => {
  const sleeping = { ...initialState(), sleeping: true };
  const action = resolveInteraction('random', sleeping, () => 0.5);
  assert.deepEqual(action, { type: 'sleep' });
  assert.equal(reduceAction(sleeping, action).sleeping, false);
  assert.match(getInteractionHint('random', sleeping), /叫醒/);
});

test('fixed modes preserve the selection and rest if play is unaffordable', () => {
  const state = initialState();
  assert.deepEqual(resolveInteraction('pet', state, () => 0.9), { type: 'pet' });
  assert.deepEqual(resolveInteraction('play', { ...state, energy: 8 }), { type: 'play' });
  assert.deepEqual(resolveInteraction('play', { ...state, energy: 7 }), { type: 'sleep' });
  assert.deepEqual(resolveInteraction('sleep', state), { type: 'sleep' });
  assert.match(getInteractionHint('play', { ...state, energy: 7 }), /休息/);
});

test('random boundaries always produce a supported action', () => {
  for (const sample of [-1, 1, 10, Number.NaN, Number.POSITIVE_INFINITY]) {
    const action = resolveInteraction('random', initialState(), () => sample);
    assert.ok(['pet', 'play', 'sleep'].includes(action.type));
    assert.notEqual(reduceAction(initialState(), action), null);
  }
});
