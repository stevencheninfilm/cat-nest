import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, levelInfo } from '../src/state.js';
test('feeding charges currency and caps needs while growth waits for a bubble claim', () => {
  const before=initialState(); const after=reduceAction(before,{type:'feed',food:'fish'},{name:'小雨'});
  assert.equal(after.coins,1160); assert.equal(after.love,136); assert.equal(after.hunger,100);
  assert.equal(before.coins,1200); assert.equal(after.history[0].actor,'小雨'); assert.equal(after.xp,before.xp);
  const claimed=reduceAction(after,{type:'claim-growth',rewardId:after.pendingGrowth[0].id});
  assert.equal(claimed.xp,before.xp+50); assert.equal(levelInfo(claimed.xp).level,2);
});
test('insufficient currency and energy cannot create an accepted action', () => {
  const poor={...initialState(),coins:0}; assert.equal(reduceAction(poor,{type:'feed',food:'meal'}),null);
  const tired={...initialState(),energy:0}; assert.equal(reduceAction(tired,{type:'play'}),null);
});
test('play earns currency and consumes energy, resting restores it',()=>{
  const after=reduceAction(initialState(),{type:'play'}); assert.equal(after.coins,1210); assert.equal(after.energy,68);
  const rest=reduceAction(after,{type:'sleep'}); assert.equal(rest.energy,88); assert.equal(rest.sleeping,true);
});
test('persisted state clamps corrupted fields and retains only valid history',()=>{
  const after=normalizeState({...initialState(),hunger:999,coins:-10,name:'',history:[null,{text:'hi',actor:'you',at:123}]});
  assert.equal(after.hunger,100); assert.equal(after.coins,0); assert.equal(after.name,'糯米'); assert.equal(after.history.length,1);
});
