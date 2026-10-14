// Fictional data for the combined test run. No remote requests or credentials.
export function structuredVerdict(overrides = {}) {
  return {
    headline: '把时间说准确，把期待讲清楚',
    conclusion: '就当前提供的材料而言，甲方对约定的理解需要优先核对，乙方也需要更早说明变化。',
    confidence: 'medium',
    rootAnalysis: '双方描述中，时间安排与被认真对待的期待没有被充分讲清。这里仅提出可能的沟通分歧，不推断双方的人格或动机。',
    facts: [{ text: '甲方称双方对见面时间有分歧。', source: '第1轮甲方陈词；这是当事人主张' }],
    disputes: ['双方是否明确确认了最后的时间，需要补充完整上下文。'],
    responsibility: {
      assessment: 'a_more', summary: '本轮暂以核对甲方所依据的约定为主要改进方向，结论可被新证据修正。',
      a: { level: 'primary', reason: '甲方需要先核对明确约定，再表达对迟到的判断。' },
      b: { level: 'contributing', reason: '乙方需要及时说明安排变化，减少对方猜测。' },
    },
    decree: '先停止争论谁更在乎，核对完整约定，并共同写下下次临时变更的通知方式。',
    repairMode: 'together',
    repairTasks: [
      { title: '约好继续对话的时间', description: '各自冷静后，双方自愿选择一个能专心沟通的时间；任何一方需要暂停都可以明确提出。' },
      { title: '复述彼此的期待', description: '各自复述对方最在意的一点，让对方确认是否被准确理解，避免给对方猜动机。' },
      { title: '留下下次变更的约定', description: '一起明确临时变更提前多久通知、通过什么方式确认，并保留各自的边界。' },
    ],
    communication: { a: '我想先核对我们最后确认的时间，再说说当时的失落。', b: '我会更早说明变化，也想听听你希望怎样确认安排。' },
    followUpQuestions: ['请补充双方最终确认时间的完整对话。'],
    appeal: { changed: '本轮为初审，尚无此前结论可比较。', unchanged: '后续将始终区分证据、主张和推断。' },
    ...overrides,
  };
}
