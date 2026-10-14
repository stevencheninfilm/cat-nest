import { sentencePreview, verdictContent } from './court-verdict-content.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paragraphs = value => String(value || '').split(/\n\s*\n/).filter(Boolean).map(part => `<p>${esc(part).replace(/\n/g, '<br>')}</p>`).join('');
const levels = { primary: '主要责任', contributing: '有一定责任', limited: '责任有限', unclear: '暂难判断' };
const confidence = { high: '判断把握较高', medium: '判断把握中等', low: '判断把握较低' };

function compact(value, key, count = 2) {
  const preview = sentencePreview(value, count);
  if (!preview.lead) return '';
  return `${paragraphs(preview.lead)}${preview.rest ? `<details class="court-text-expansion" data-history="${esc(key)}"><summary>展开其余说明<span aria-hidden="true">⌄</span></summary><div>${paragraphs(preview.rest)}</div></details>` : ''}`;
}

function heading(kind, title, note) {
  const file = `${import.meta.env.BASE_URL}assets/court-explainers/${kind}-v1.webp`;
  return `<header class="court-explainer-heading"><img src="${esc(file)}" width="76" height="76" alt="" loading="lazy" decoding="async"><div><h4>${esc(title)}</h4><p>${esc(note)}</p></div></header>`;
}

function entries(values, key, limit = 2, label = '展开全部说明') {
  if (!values?.length) return '';
  const item = (value, index) => {
    const text = typeof value === 'string' ? value : value.text;
    const source = typeof value === 'string' ? '' : value.source;
    return `<li>${compact(text, `${key}-${index}`)}${source ? `<span class="court-evidence-source">依据：${esc(source)}</span>` : ''}</li>`;
  };
  return `<ul class="court-explainer-list">${values.slice(0, limit).map(item).join('')}</ul>${values.length > limit ? `<details class="court-text-expansion" data-history="${esc(key)}-more"><summary>${esc(label)}<span>${values.length - limit} 条 · ⌄</span></summary><ul class="court-explainer-list">${values.slice(limit).map((value, index) => item(value, index + limit)).join('')}</ul></details>` : ''}`;
}

/** Present saved explanations as short excerpts with the remaining text intact. */
export function verdictCards(round, personName) {
  const content = verdictContent(round.verdict, round.kind);
  const id = round.id;
  const roles = ['a', 'b'].filter(role => content.parties[role]);
  const evidence = [...content.facts, ...content.evidenceNotes];
  const appeal = round.kind === 'appeal' && (content.changed.length || content.unchanged.length || content.appealNotes.length);
  const decision = content.decision.replace(/^猫猫判官(?:初审|复议)?[：:]\s*/, '');
  return `<div class="court-formal-content court-explainer-content">
    ${decision ? `<section class="court-verdict-summary"><span class="court-mini-label">裁定要点</span>${compact(decision, `decision-${id}`)}${confidence[round.verdict.details?.confidence] ? `<span class="court-confidence">${confidence[round.verdict.details.confidence]}</span>` : ''}${entries(content.decisionNotes, `decision-notes-${id}`)}</section>` : '<p class="court-archive-hint">本轮判词已归档，可展开下方完整原文。</p>'}
    ${content.rootAnalysis ? `<section class="court-root-analysis"><h4>问题的根源</h4>${compact(content.rootAnalysis, `root-${id}`)}</section>` : ''}
    ${roles.length || content.accountNotes.length || content.responsibilitySummary ? `<section class="court-explainer-card accounts">
      ${heading('accounts', '双方责任', '分别看具体行为，也保留各自的感受')}
      ${content.responsibilitySummary ? compact(content.responsibilitySummary, `responsibility-summary-${id}`) : ''}
      <div class="court-explainer-parties">${roles.map(role => {
        const saved = content.parties[role];
        return `<article class="court-explainer-person ${role}"><header><div><span>${role === 'a' ? '猫爪方' : '鱼干方'}</span><h5>${esc(personName(role))}</h5></div>${levels[saved.level] ? `<b>${levels[saved.level]}</b>` : ''}</header>${compact(saved.reason, `reason-${id}-${role}`, 1)}</article>`;
      }).join('')}</div>
      ${entries(content.accountNotes, `account-notes-${id}`)}
    </section>` : ''}
    ${evidence.length || content.disputes.length ? `<section class="court-explainer-card evidence">
      ${heading('evidence', '证据与分歧', '哪些已说明，哪些还需要核对')}
      ${entries(evidence, `evidence-explanation-${id}`, 2, '查看其余证据解读')}
      ${content.disputes.length ? `<div class="court-dispute-notes"><h5>尚未明确</h5>${entries(content.disputes, `dispute-${id}`)}</div>` : ''}
    </section>` : ''}
    ${appeal ? `<section class="court-explainer-card appeal">
      ${heading('appeal', '复议变化', '在原有案卷上，说明本轮调整')}
      ${content.changed.length ? `<div class="court-appeal-changes"><h5>本轮调整</h5>${entries(content.changed, `changed-${id}`, 1)}</div>` : ''}
      ${content.unchanged.length ? `<div class="court-appeal-retained"><h5>仍然保留</h5>${entries(content.unchanged, `unchanged-${id}`, 1)}</div>` : ''}
      ${entries(content.appealNotes, `appeal-notes-${id}`)}
    </section>` : ''}
    ${content.repairNotes.length ? `<section class="court-next-agreement"><span class="court-mini-label">为下一次，留下一份约定</span><h4>接下来怎么做</h4>${entries(content.repairNotes, `next-${id}`, 3, '查看其余约定')}</section>` : ''}
    ${content.followUp.length ? `<details class="court-verdict-details" data-history="follow-up-${esc(id)}"><summary><span>还需要补充什么？</span><span class="court-detail-chevron">⌄</span></summary>${entries(content.followUp, `follow-up-notes-${id}`, content.followUp.length)}</details>` : ''}
  </div>`;
}
