import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERACTION_MODES, normalizeInteractionMode, resolveInteraction, getInteractionHint } from '../src/interaction-mode.js';
import { careActionInfo, initialState, reduceAction } from '../src/state.js';

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
  assert.equal(after.energy, 37);
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
  assert.deepEqual(resolveInteraction('play', { ...state, energy: 4 }), { type: 'play' });
  assert.deepEqual(resolveInteraction('play', { ...state, energy: 3 }), { type: 'sleep' });
  assert.deepEqual(resolveInteraction('sleep', state), { type: 'sleep' });
  assert.match(getInteractionHint('play', { ...state, energy: 3 }), /休息/);
});

test('random boundaries always produce a supported action', () => {
  for (const sample of [-1, 1, 10, Number.NaN, Number.POSITIVE_INFINITY]) {
    const action = resolveInteraction('random', initialState(), () => sample);
    assert.ok(['pet', 'play', 'sleep'].includes(action.type));
    assert.notEqual(reduceAction(initialState(), action), null);
  }
});

test('random taps only select interactions whose shared care limits allow them', () => {
  const now = Date.UTC(2026, 9, 13, 0);
  const actor = { id: 'partner-male', name: '男方' };
  const petted = reduceAction(initialState(now), { type: 'pet' }, actor, now);
  const allowed = action => careActionInfo(petted, action, actor.id, now + 1).allowed;
  assert.deepEqual(resolveInteraction('random', petted, () => 0, allowed), { type: 'play' });
  assert.deepEqual(resolveInteraction('random', petted, () => 1, allowed), { type: 'sleep' });
  assert.deepEqual(resolveInteraction('pet', petted, () => 0, allowed), { type: 'pet' }, 'fixed selections retain their explanatory cooldown feedback');
});

test('tired random interactions can use an available alternative while rest is cooling down', () => {
  const tired = { ...initialState(), energy: 3 };
  const allowed = action => action.type !== 'sleep';
  assert.deepEqual(resolveInteraction('random', tired, () => { throw new Error('one possible action needs no random roll'); }, allowed), { type: 'pet' });
  assert.equal(resolveInteraction('random', tired, () => 0, () => false), null);
  assert.deepEqual(resolveInteraction('random', { ...tired, sleeping: true }, () => 0, allowed), null);
});
