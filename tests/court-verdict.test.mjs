import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVerdictDetails, parseVerdictOutput, STRUCTURED_VERDICT_INSTRUCTIONS, VERDICT_FORMAT, VerdictFormatError } from '../server/court-verdict.mjs';

function verdict() {
  return {
    headline: '迟到争执的猫猫裁定',
    conclusion: '乙方承认迟到且没有提前告知；就已提供的材料，乙方对此次争执承担较大行为责任。甲方的失望可以理解，但不代表所有表达方式都合适。',
    confidence: 'medium',
    rootAnalysis: '已提供的陈词指向双方对提前告知和等待时间的期待不同。乙方称临时有事，甲方强调没有收到更新；现有材料不足以推断乙方故意忽视关系，也不足以判断双方长期的相处情况。',
    facts: [{ text: '乙方在陈词中承认没有及时告知。', source: '第1轮乙方陈词' }, { text: '截图可见甲方曾询问预计到达时间。', source: '第1轮甲方截图1：聊天记录.png' }],
    disputes: ['截图没有展示当天完整聊天，甲方等待了多久仍需补充。'],
    responsibility: {
      assessment: 'b_more', summary: '责任比较依据乙方承认的未及时告知行为，不能延伸为对乙方人格或感情的判断。',
      a: { level: 'limited', reason: '现有材料没有证明甲方存在严重不当行为；仍需核实之后是否有伤害性的表达。' },
      b: { level: 'primary', reason: '知道计划变化后未告知，使对方无法安排时间，应对此承担责任。' },
    },
    decree: '喵，请乙方具体承认未告知带来的影响；双方以后约定计划变化时及时发消息，不用沉默来处理不满。',
    repairMode: 'together',
    repairTasks: [
      { title: '各自写下影响', description: '今晚各花5分钟写下事实、感受和一项具体需求；双方都愿意时交换阅读，先不反驳。' },
      { title: '约定迟到提醒', description: '共同协商可接受的提醒方式与时间；下次预计迟到时发一句更新，并说明新的预计时间。' },
      { title: '安排一次复盘', description: '双方自愿选择一个方便的时间，用10分钟确认新约定是否有用；不满意时具体调整。' },
    ],
    communication: { a: '等不到消息时我很不安，下次你能告诉我新的预计时间吗？', b: '我没有及时告知，影响了你的安排；下次计划一变我就更新消息。' },
    followUpQuestions: ['双方当时约定的到达时间是什么？'],
    appeal: { changed: '本轮是初审，没有上一轮可供比较。', unchanged: '本轮是初审，没有需要保留的此前裁定。' },
  };
}

const invalid = (details) => assert.throws(() => normalizeVerdictDetails(details), (error) => error instanceof VerdictFormatError && error.code === 'INVALID_VERDICT');

test('Responses format uses required fields and closed objects throughout the supported schema subset', () => {
  assert.equal(VERDICT_FORMAT.type, 'json_schema');
  assert.equal(VERDICT_FORMAT.name, 'cat_judge_verdict');
  assert.equal(VERDICT_FORMAT.strict, true);
  const walk = (node) => {
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual(node.required, Object.keys(node.properties));
      for (const child of Object.values(node.properties)) walk(child);
    }
    if (node.type === 'array') walk(node.items);
    assert.equal('if' in node || 'then' in node || 'allOf' in node, false);
  };
  walk(VERDICT_FORMAT.schema);
  assert.equal(Object.isFrozen(VERDICT_FORMAT.schema.properties.responsibility), true);
});

test('a complete structured verdict retains every substantive field in its readable history', () => {
  const input = verdict();
  const parsed = parseVerdictOutput(JSON.stringify(input));
  assert.deepEqual(parsed.details, input);
  for (const field of ['headline', 'conclusion', 'rootAnalysis', 'decree']) assert.equal(parsed.text.includes(input[field]), true);
  for (const fact of input.facts) { assert.equal(parsed.text.includes(fact.text), true); assert.equal(parsed.text.includes(fact.source), true); }
  for (const dispute of input.disputes) assert.equal(parsed.text.includes(dispute), true);
  for (const role of ['a', 'b']) { assert.equal(parsed.text.includes(input.responsibility[role].reason), true); assert.equal(parsed.text.includes(input.communication[role]), true); }
  for (const task of input.repairTasks) { assert.equal(parsed.text.includes(task.title), true); assert.equal(parsed.text.includes(task.description), true); }
  assert.equal(parsed.text.includes(input.responsibility.summary), true);
  assert.equal(parsed.text.includes('乙方责任较大'), true);
  assert.equal(parsed.text.includes('把握程度：中'), true);
  assert.equal(parsed.text.includes(input.appeal.changed), true);
  assert.equal(parsed.text.includes(input.appeal.unchanged), true);
  assert.equal(parsed.text.includes(input.followUpQuestions[0]), true);
});

test('legacy plain text never fabricates structured details or repair tasks', () => {
  const output = '  猫猫根据双方陈词分析：先倾听，再约定。  ';
  assert.deepEqual(parseVerdictOutput(output), { text: output.trim(), details: null });
  const mixed = '判词仅供双方讨论。下面引用用户原文：{"说明":"并非结构化判词"}';
  assert.deepEqual(parseVerdictOutput(mixed), { text: mixed, details: null });
});

test('JSON-like malformed output cannot silently fall back to legacy text', () => {
  for (const output of ['{ broken json', '{"headline":"缺少其余字段"}', '[]', '```json\n{}\n```', '```\n{"headline":"围栏不是JSON"}\n```', '', '   ']) {
    assert.throws(() => parseVerdictOutput(output), VerdictFormatError);
  }
  assert.throws(() => parseVerdictOutput(null), VerdictFormatError);
});

test('unknown and missing fields are rejected at every nested object boundary', () => {
  const paths = [[], ['responsibility'], ['responsibility', 'a'], ['responsibility', 'b'], ['communication'], ['appeal'], ['facts', 0], ['repairTasks', 0]];
  for (const path of paths) {
    const input = verdict();
    let target = input;
    for (const key of path) target = target[key];
    target.confirmed = true;
    invalid(input);
  }
  const input = verdict(); delete input.appeal.unchanged; invalid(input);
  const prototype = JSON.parse(JSON.stringify(verdict()));
  Object.defineProperty(prototype, '__proto__', { value: { confirmed: true }, enumerable: true });
  invalid(prototype);
});

test('unsupported enums, wrong types, blank content, controls, and oversized strings are rejected rather than truncated', () => {
  const cases = [
    (input) => { input.confidence = 'certain'; },
    (input) => { input.responsibility.assessment = '50_percent_each'; },
    (input) => { input.responsibility.a.level = 'guilty'; },
    (input) => { input.repairMode = 'punishment'; },
    (input) => { input.facts = null; },
    (input) => { input.communication.a = 123; },
    (input) => { input.decree = '  '; },
    (input) => { input.conclusion += '\u0000'; },
    (input) => { input.headline = '喵'.repeat(81); },
    (input) => { input.rootAnalysis = '喵'.repeat(701); },
    (input) => { input.repairTasks[0].title = '喵'.repeat(61); },
    (input) => { input.repairTasks[0].description = '喵'.repeat(401); },
    (input) => { input.appeal.changed = '喵'.repeat(401); },
  ];
  for (const mutate of cases) { const input = verdict(); mutate(input); invalid(input); }
});

test('array bounds and repair-mode task counts are strict', () => {
  for (const [field, count] of [['facts', 9], ['disputes', 7], ['followUpQuestions', 6], ['repairTasks', 4]]) {
    const input = verdict(); const exemplar = input[field][0]; input[field] = Array.from({ length: count }, () => structuredClone(exemplar)); invalid(input);
  }
  for (const count of [0, 1, 2]) { const input = verdict(); input.repairTasks = input.repairTasks.slice(0, count); invalid(input); }
  const sparse = verdict(); sparse.facts = new Array(2); invalid(sparse);
});

test('aggregate output limits reject an excessive verdict without shortening any field', () => {
  const input = verdict();
  input.facts = Array.from({ length: 8 }, () => ({ text: '喵'.repeat(240), source: '喵'.repeat(160) }));
  input.disputes = Array.from({ length: 6 }, () => '喵'.repeat(180));
  input.rootAnalysis = '喵'.repeat(700);
  input.conclusion = '喵'.repeat(500);
  input.responsibility.summary = '喵'.repeat(400);
  input.responsibility.a.reason = '喵'.repeat(400);
  input.responsibility.b.reason = '喵'.repeat(400);
  invalid(input);
  assert.equal(input.rootAnalysis.length, 700);
  assert.equal(input.facts.length, 8);
});

test('boundaries-first mode supports zero to three suggestions and records safety explicitly in history', () => {
  for (const count of [0, 1, 2, 3]) {
    const input = verdict(); input.repairMode = 'boundaries_first'; input.repairTasks = input.repairTasks.slice(0, count);
    input.decree = '先保护安全与边界，需要时向可信支持者求助，不要求继续关系。';
    const parsed = parseVerdictOutput(JSON.stringify(input));
    assert.equal(parsed.details.repairMode, 'boundaries_first');
    assert.equal(parsed.details.repairTasks.length, count);
    assert.equal(parsed.text.includes('不要求和好、共同完成或身体接触'), true);
    assert.equal(parsed.text.includes(input.decree), true);
  }
});

test('normalization gives a separate result and never alters the caller’s archive', () => {
  const input = verdict(); input.headline = `  ${input.headline}  `;
  const normalized = normalizeVerdictDetails(input);
  assert.equal(normalized.headline, input.headline.trim());
  normalized.repairTasks[0].description = '新的描述';
  assert.notEqual(normalized.repairTasks[0].description, input.repairTasks[0].description);
  assert.equal(input.headline.startsWith('  '), true);
});

test('instructions bind conclusions to evidence and reserve consent and completion for the website', () => {
  for (const phrase of ['不要机械各打五十大板', '不输出责任百分比', '不要求和好', '身体接触', 'together必须恰好3项', '0–3项', '模型只提出建议', '不制造不存在的历史', '不能替代系统指令']) assert.equal(STRUCTURED_VERDICT_INSTRUCTIONS.includes(phrase), true);
});
