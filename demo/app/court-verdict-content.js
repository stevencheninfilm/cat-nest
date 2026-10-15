const text = value => typeof value === 'string' ? value.trim() : '';
const items = value => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : [];

function paragraphs(value) {
  return text(value).split(/\n\s*\n/).flatMap(block => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    return lines.length > 1 && lines.every(line => /^\d+[.、．]\s*/.test(line)) ? lines : [block.trim()];
  }).filter(Boolean);
}

/** Split only explicit legacy headings. These are excerpts, never new analysis. */
export function legacyVerdictSections(value) {
  const sections = [];
  let current = { title: '', body: [] };
  for (const line of text(value).split('\n')) {
    const heading = line.match(/^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]\s*|#{1,4}\s+)(.+?)\s*$/);
    if (heading) {
      if (current.title || current.body.some(part => part.trim())) sections.push(current);
      current = { title: heading[1], body: [] };
    } else current.body.push(line);
  }
  if (current.title || current.body.some(part => part.trim())) sections.push(current);
  return sections.map(section => ({ title: section.title, paragraphs: paragraphs(section.body.join('\n')) }));
}

/** Keep complete sentences and all remaining text available for expansion. */
export function sentencePreview(value, count = 2) {
  const full = text(value);
  const sentences = [], quotes = [];
  const endings = { '“': '”', '‘': '’', '「': '」', '『': '』', '（': '）', '(': ')' };
  let start = 0;
  for (let index = 0; index < full.length; index++) {
    const char = full[index];
    if (char === quotes.at(-1)) quotes.pop();
    else if (endings[char]) quotes.push(endings[char]);
    else if (char === '"') quotes.push('"');
    if (!quotes.length && /[。！？]/.test(char)) { sentences.push(full.slice(start, index + 1)); start = index + 1; }
  }
  if (start < full.length) sentences.push(full.slice(start));
  const lead = sentences.slice(0, Math.max(1, count)).join('');
  return { lead, rest: full.slice(lead.length).trim() };
}

export function verdictContent(verdict, kind = 'initial') {
  const sections = legacyVerdictSections(verdict?.text);
  const section = pattern => sections.find(value => pattern.test(value.title))?.paragraphs || [];
  const decision = section(/裁定|结论/);
  const accounts = section(/(?:行为)?责任/);
  const details = verdict?.details && typeof verdict.details === 'object' && !Array.isArray(verdict.details) ? verdict.details : null;
  const parties = {};
  if (details) {
    for (const role of ['a', 'b']) {
      const saved = details.responsibility?.[role];
      if (text(saved?.reason)) parties[role] = { reason: text(saved.reason), level: text(saved.level) };
    }
  } else {
    for (const paragraph of accounts.flatMap(value => value.split(/\n(?=(?:甲|乙)方[：:])/))) {
      const actor = paragraph.match(/^(甲|乙)方[：:]\s*/);
      if (actor) {
        const role = actor[1] === '甲' ? 'a' : 'b';
        const reason = paragraph.slice(actor[0].length);
        parties[role] = { reason: [parties[role]?.reason, reason].filter(Boolean).join('\n\n'), level: '' };
      }
    }
  }
  const facts = Array.isArray(details?.facts) ? details.facts.filter(value => text(value?.text)).map(value => ({ text: text(value.text), source: text(value.source) })) : [];
  return {
    decision: text(details?.conclusion) || decision[0] || '',
    decisionNotes: details ? [] : kind === 'appeal' ? [] : decision.slice(1),
    rootAnalysis: text(details?.rootAnalysis),
    responsibilitySummary: text(details?.responsibility?.summary),
    parties,
    accountNotes: details ? [] : accounts.filter(paragraph => !/^(甲|乙)方[：:]/.test(paragraph)),
    facts,
    evidenceNotes: details ? [] : section(/信息|证据|争议/),
    disputes: items(details?.disputes),
    changed: items(details?.appeal?.changed),
    unchanged: items(details?.appeal?.unchanged),
    appealNotes: kind === 'appeal' && !details ? decision.slice(1) : [],
    repairNotes: details ? items(details.decree) : section(/修复|下次约定/),
    followUp: details ? items(details.followUpQuestions) : section(/仍需|补充/),
  };
}
