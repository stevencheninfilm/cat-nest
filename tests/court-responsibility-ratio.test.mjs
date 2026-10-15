import test from 'node:test';
import assert from 'node:assert/strict';
import { responsibilityRatio } from '../src/court-responsibility-ratio.js';

// Prepared for the combined acceptance run; no API requests or case writes.
const verdict = (assessment, percentages, extra = {}) => ({ details: { confidence: 'medium', responsibility: { assessment, ...(percentages === undefined ? {} : { percentages }) }, ...extra } });

test('saved estimates preserve both values and direction', () => {
  for (const [assessment, percentages] of [['a_more', { a: 65, b: 35 }], ['b_more', { a: 20, b: 80 }], ['similar', { a: 50, b: 50 }], ['b_more', { a: 0, b: 100 }]]) {
    assert.deepEqual(responsibilityRatio(verdict(assessment, percentages)), percentages);
  }
});

test('old records and unknown responsibility never receive an invented half split', () => {
  assert.equal(responsibilityRatio(verdict('a_more')), null);
  assert.equal(responsibilityRatio({ text: '甲方承担主要责任。' }), null);
  assert.equal(responsibilityRatio(verdict('undetermined', { a: 50, b: 50 })), null);
  assert.equal(responsibilityRatio(verdict('a_more', { a: null, b: null })), null);
});

test('bad values and inconsistent saved direction are hidden rather than fixed or rounded', () => {
  for (const percentages of [{ a: 65, b: 30 }, { a: '65', b: 35 }, { a: 65.5, b: 34.5 }, { a: 35, b: 65 }, { a: -5, b: 105 }, { a: 66, b: 34 }]) {
    assert.equal(responsibilityRatio(verdict('a_more', percentages)), null);
  }
  assert.equal(responsibilityRatio(verdict('similar', { a: 70, b: 30 })), null);
});

test('safety mode and low confidence take precedence over saved numeric values', () => {
  const saved = verdict('a_more', { a: 65, b: 35 });
  assert.equal(responsibilityRatio(saved, { mode: 'boundaries_first' }), null);
  assert.equal(responsibilityRatio(verdict('a_more', { a: 65, b: 35 }, { repairMode: 'boundaries_first' })), null);
  assert.equal(responsibilityRatio(verdict('a_more', { a: 65, b: 35 }, { confidence: 'low' })), null);
});
