import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, levelInfo } from '../src/state.js';
test('feeding charges currency and caps needs while growth waits for a bubble claim', () => {
  const before=initialState(); const after=reduceAction(before,{type:'feed',food:'fish'},{name:'小雨'});
  assert.equal(after.coins,1160); assert.equal(after.love,136); assert.equal(after.hunger,100);
  assert.equal(before.coins,1200); assert.equal(after.history[0].actor,'小雨'); assert.equal(after.xp,before.xp);
  const claimed=reduceAction(after,{type:'claim-growth',rewardId:after.pendingGrowth[0].id});
  assert.equal(claimed.xp,before.xp+55); assert.equal(levelInfo(claimed.xp).level,2);
});
test('insufficient currency and energy cannot create an accepted action', () => {
  const poor={...initialState(),coins:0}; assert.equal(reduceAction(poor,{type:'feed',food:'meal'}),null);
  const tired={...initialState(),energy:0}; assert.equal(reduceAction(tired,{type:'play'}),null);
});
test('play earns currency and consumes energy, resting restores it',()=>{
  const after=reduceAction(initialState(),{type:'play'}); assert.equal(after.coins,1210); assert.equal(after.energy,72);
  const rest=reduceAction(after,{type:'sleep'}); assert.equal(rest.energy,100); assert.equal(rest.sleeping,true);
});
test('persisted state clamps corrupted fields and retains only valid history',()=>{
  const after=normalizeState({...initialState(),hunger:999,coins:-10,name:'',history:[null,{text:'hi',actor:'you',at:123}]});
  assert.equal(after.hunger,100); assert.equal(after.coins,0); assert.equal(after.name,'糯米'); assert.equal(after.history.length,1);
});

test('upgrade requirements increase gently and reset progress at each cumulative boundary', () => {
  const starts = [0, 120, 270, 450, 660, 900];
  const targets = [120, 150, 180, 210, 240, 270];
  for (let index = 0; index < starts.length; index += 1) {
    assert.deepEqual(levelInfo(starts[index]), { level: index + 1, progress: 0, target: targets[index] });
    assert.deepEqual(levelInfo(starts[index] + targets[index] - 1), { level: index + 1, progress: targets[index] - 1, target: targets[index] });
  }
});

test('claiming a reward crosses the new upgrade boundary without losing excess experience', () => {
  const before = { ...initialState(), xp: 430 };
  const fed = reduceAction(before, { type: 'feed', food: 'fish' });
  const claimed = reduceAction(fed, { type: 'claim-growth', rewardId: fed.pendingGrowth[0].id });
  assert.equal(claimed.xp, 485);
  assert.deepEqual(levelInfo(claimed.xp), { level: 4, progress: 35, target: 210 });
  const restored = normalizeState(JSON.parse(JSON.stringify(claimed)));
  assert.equal(restored.xp, claimed.xp);
  assert.deepEqual(levelInfo(restored.xp), levelInfo(claimed.xp));
});

test('existing cumulative experience is preserved and interpreted using the new curve', () => {
  const saved = normalizeState({ ...initialState(), xp: 912 });
  assert.equal(saved.xp, 912);
  assert.deepEqual(levelInfo(saved.xp), { level: 6, progress: 12, target: 270 });
});

test('large saves keep exact progress at upgrade boundaries and the safe integer limit', () => {
  const boundary = 15n * 24_000_000n * 24_000_007n;
  for (const value of [boundary - 1n, boundary, boundary + 1n, BigInt(Number.MAX_SAFE_INTEGER)]) {
    const info = levelInfo(Number(value));
    const completed = BigInt(info.level - 1);
    const start = 15n * completed * (completed + 7n);
    assert.ok(start <= value);
    assert.ok(value < 15n * (completed + 1n) * (completed + 8n));
    assert.equal(BigInt(info.progress), value - start);
    assert.ok(info.progress >= 0 && info.progress < info.target);
  }
});

test('invalid experience has a safe first-level display', () => {
  for (const xp of [undefined, null, '120', NaN, Infinity, -1]) {
    assert.deepEqual(levelInfo(xp), { level: 1, progress: 0, target: 120 });
  }
});
