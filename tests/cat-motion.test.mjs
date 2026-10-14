import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatMotion } from '../src/cat-motion.js';

function advance(motion, seconds) {
  let pose;
  for (let i = 0; i < seconds * 60; i++) pose = motion.advance(1 / 60);
  return pose;
}

test('sleep blends into a curled pose and petting wakes the kitten', () => {
  const motion = createCatMotion();
  motion.setState({ sleeping: true });
  assert.ok(advance(motion, 2).sleep > 0.99);
  motion.react('pet');
  const pose = advance(motion, 2);
  assert.equal(pose.sleeping, false);
  assert.ok(pose.sleep < 0.01);
});

test('a synchronized explicit sleep state does not toggle a second time', () => {
  const motion = createCatMotion();
  motion.setState({ sleeping: true });
  motion.react('sleep', { sleeping: true });
  assert.ok(advance(motion, 2).sleep > 0.99);
  motion.react('sleep', { sleeping: false });
  assert.ok(advance(motion, 2).sleep < 0.01);
});

test('play articulates paws and hops, then finishes without changing persistent state', () => {
  const motion = createCatMotion();
  motion.react('play');
  const pose = advance(motion, 1);
  assert.ok(pose.toy > 0.5);
  assert.ok(pose.leftPaw > 0 || pose.rightPaw > 0);
  assert.ok(pose.hop > 0);
  const finished = advance(motion, 4);
  assert.equal(finished.strength, 0);
  assert.equal(finished.toy, 0);
  assert.equal(finished.hop, 0);
});

test('reduced motion lowers travel while preserving feedback and sleeping state', () => {
  const normal = createCatMotion();
  const reduced = createCatMotion({ reducedMotion: true });
  normal.react('play'); reduced.react('play');
  const a = advance(normal, 1);
  const b = advance(reduced, 1);
  assert.ok(b.hop < a.hop);
  assert.ok(b.leftPaw < a.leftPaw);
  assert.equal(b.toy, a.toy);
});

test('invalid frame deltas cannot produce invalid transforms', () => {
  const motion = createCatMotion();
  for (const value of [NaN, Infinity, -1, 10000]) {
    const pose = motion.advance(value);
    for (const [key, number] of Object.entries(pose)) {
      if (typeof number === 'number') assert.ok(Number.isFinite(number), key);
    }
  }
});
