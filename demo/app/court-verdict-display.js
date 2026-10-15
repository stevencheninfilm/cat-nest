const ASSESSMENTS = Object.freeze({ a_more: 'primary-a', b_more: 'primary-b', similar: 'shared', undetermined: 'undetermined' });
const LABELS = Object.freeze({
  'primary-a': { title: '责任较重', caption: '本轮主要责任 · 猫爪方', tone: 'crimson' },
  'primary-b': { title: '责任较重', caption: '本轮主要责任 · 鱼干方', tone: 'cobalt' },
  shared: { title: '共同调整', caption: '双方具体行为责任相近', tone: 'amber' },
  undetermined: { title: '证据待补', caption: '暂无法比较主要责任', tone: 'indigo' },
  boundaries: { title: '边界优先', caption: '先照顾安全与自主选择', tone: 'jade' },
});

/** A visual label follows the saved decision; it never recalculates blame. */
export function verdictDisplay(verdict, repair) {
  const details = verdict?.details;
  if (details?.repairMode === 'boundaries_first' || repair?.mode === 'boundaries_first') return { key: 'boundaries', ...LABELS.boundaries, source: 'structured' };
  const assessment = details?.responsibility?.assessment;
  if (Object.hasOwn(ASSESSMENTS, assessment)) {
    const key = ASSESSMENTS[assessment];
    return { key, ...LABELS[key], source: 'structured' };
  }
  // Older verdicts have no JSON assessment. Read only their first ruling
  // section, so quotes, hypotheticals and earlier overturned decisions cannot
  // turn into a new responsibility claim. The complete text remains visible.
  const text = String(verdict?.text || '').trim();
  const ruling = text.replace(/^(?:#{1,4}\s*)?(?:①|1[.、．])?\s*(?:本轮裁定|本轮结论|猫猫裁定|裁定结论)[^\n]*\n+/, '');
  const lead = ruling.split(/\n\s*\n/)[0].slice(0, 900);
  let key = 'undetermined', source = 'legacy-unclassified';
  if (/(?:无法|不能|尚难|暂难)(?:确定|判断|比较)[^。；\n]{0,55}(?:主要责任|责任大小|谁|双方责任)|主要责任[^。；\n]{0,15}(?:无法|尚未|未能|尚难)/.test(lead)) source = 'legacy-explicit';
  else {
    const positive = lead.split(/[。；\n]/).filter(sentence => !/(?:不应|无需|不承担|不能认定|不能再认定|无法认定|尚不能)/.test(sentence)).join('。');
    const a = /甲(?:方)?[^。；\n]{0,45}(?:承担|负有|负担)[^。；\n]{0,12}(?:主要|较大|更多)(?:行为)?责任/.test(positive);
    const b = /乙(?:方)?[^。；\n]{0,45}(?:承担|负有|负担)[^。；\n]{0,12}(?:主要|较大|更多)(?:行为)?责任/.test(positive);
    if (a !== b) { key = a ? 'primary-a' : 'primary-b'; source = 'legacy-explicit'; }
    else if (/双方(?:具体行为的)?(?:责任|行为责任)(?:相近|接近|相当)/.test(lead)) { key = 'shared'; source = 'legacy-explicit'; }
  }
  return { key, ...LABELS[key], ...(source === 'legacy-unclassified' ? { title: '判词已归档', caption: '责任结论以原文为准' } : {}), source };
}
