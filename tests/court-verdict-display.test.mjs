import test from 'node:test';
import assert from 'node:assert/strict';
import { verdictDisplay } from '../src/court-verdict-display.js';

// Prepared for the combined acceptance run; no AI or server requests.
test('saved structured responsibility selects artwork without invented ratios', () => {
  for (const [assessment, key] of [['a_more', 'primary-a'], ['b_more', 'primary-b'], ['similar', 'shared'], ['undetermined', 'undetermined']]) {
    const display = verdictDisplay({ details: { responsibility: { assessment } } });
    assert.equal(display.key, key);
    assert.equal(display.source, 'structured');
    assert.equal('percentage' in display, false);
  }
});

test('the historical initial decision stays undetermined and its appeal reflects the corrected ruling', () => {
  const initial = '① 本轮裁定\n\n猫猫判官初审：目前无法确定谁应对“取消晚餐却让甲白跑”承担主要责任；乙在19:38私聊回应中的沟通不足，可以单独指出。\n\n② 可确认的信息与争议';
  const appeal = '① 本轮裁定\n\n猫猫判官复议：在本案现有材料范围内，乙已提前通知取消，甲也明确确认，不能再认定乙“未通知失约”。甲对这次误赴餐厅及不完整指责承担主要责任；乙19:38回应中的沟通不足仍应单独修复。\n\n初审“主要责任尚无法判断”现予修正。\n\n② 已确认的信息与争议点';
  assert.equal(verdictDisplay({ text: initial }).key, 'undetermined');
  assert.equal(verdictDisplay({ text: appeal }).key, 'primary-a');
});

test('legacy quotes, negated responsibility and missing structured fields do not manufacture a ruling', () => {
  assert.equal(verdictDisplay({ text: '本轮暂不比较责任。\n\n甲方陈词：乙方承担主要责任。' }).source, 'legacy-unclassified');
  assert.equal(verdictDisplay({ text: '不能认定甲方承担主要责任，需要先补充完整材料。' }).source, 'legacy-unclassified');
  const display = verdictDisplay({ text: '这是一份完整的历史判词。' });
  assert.equal(display.title, '判词已归档');
  assert.equal(display.caption, '责任结论以原文为准');
});

test('boundary-first saved mode takes precedence over responsibility styling', () => {
  assert.equal(verdictDisplay({ details: { repairMode: 'boundaries_first', responsibility: { assessment: 'a_more' } } }).key, 'boundaries');
  assert.equal(verdictDisplay({ details: { responsibility: { assessment: 'b_more' } } }, { mode: 'boundaries_first' }).key, 'boundaries');
});
