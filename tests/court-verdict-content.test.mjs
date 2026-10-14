import test from 'node:test';
import assert from 'node:assert/strict';
import { verdictContent, sentencePreview } from '../src/court-verdict-content.js';

// Prepared for combined acceptance; no server writes or inference.
test('concise excerpts retain full conditional responsibility and the rest of the explanation', () => {
  const paragraph = '若补充截图确认取消，不能再认定乙未通知。甲也需要更正说法。图片真实性未独立鉴定。';
  const preview = sentencePreview(paragraph, 2);
  assert.equal(preview.lead, '若补充截图确认取消，不能再认定乙未通知。甲也需要更正说法。');
  assert.equal(preview.rest, '图片真实性未独立鉴定。');
  assert.equal(preview.lead + preview.rest, paragraph);
});

test('historical numbered sections preserve separate reasons and appeal corrections', () => {
  const original = '① 本轮裁定\n\n甲应更正此前说法。乙仍需解释语气。\n\n初审未通知的判断现予修正。\n\n② 已确认的信息与争议点\n\n截图显示已提前确认取消。\n\n③ 双方行为责任\n\n甲方：应更正说法，遗忘不等于恶意。\n\n乙方：应解释语气，不能扩大为未通知失约。\n\n④ 修复步骤与下次约定\n\n1. 固定渠道确认。\n2. 出发前核对。\n\n⑤ 仍需补充\n\n确认看到消息的时间。';
  const before = { text: original };
  const content = verdictContent(before, 'appeal');
  assert.equal(content.parties.a.reason, '应更正说法，遗忘不等于恶意。');
  assert.equal(content.parties.b.reason, '应解释语气，不能扩大为未通知失约。');
  assert.deepEqual(content.appealNotes, ['初审未通知的判断现予修正。']);
  assert.deepEqual(content.repairNotes, ['1. 固定渠道确认。', '2. 出发前核对。']);
  assert.equal(before.text, original);
});

test('structured saved fields take precedence over contradictory legacy wording', () => {
  const content = verdictContent({ text: '① 本轮裁定\n\n乙承担更多责任。\n\n③ 双方行为责任\n\n乙方：旧说法。', details: { conclusion: '现有资料不足以比较责任。', responsibility: { a: { level: 'unclear', reason: '尚需核对。' } }, facts: [{ text: '已确认时间。', source: '双方陈词' }], disputes: ['截图是否完整？'] } });
  assert.equal(content.decision, '现有资料不足以比较责任。');
  assert.equal(content.parties.b, undefined);
  assert.equal(content.facts[0].source, '双方陈词');
  assert.deepEqual(content.disputes, ['截图是否完整？']);
});

test('unsectioned old verdicts do not invent actor assignments or factual explanations', () => {
  const content = verdictContent({ text: '这份记录没有正式分节，甲说乙有问题。' });
  assert.deepEqual(content.parties, {});
  assert.deepEqual(content.facts, []);
  assert.deepEqual(content.evidenceNotes, []);
  assert.equal(content.decision, '');
});

test('sentence excerpts do not cut quoted chat evidence or lose quote closings', () => {
  const value = '截图里乙说“好，19:00见。”所以约定时间是19:00。取消情况仍需核对。';
  const preview = sentencePreview(value, 1);
  assert.equal(preview.lead, '截图里乙说“好，19:00见。”所以约定时间是19:00。');
  assert.equal(preview.rest, '取消情况仍需核对。');
  assert.equal(preview.lead + preview.rest, value);
});
