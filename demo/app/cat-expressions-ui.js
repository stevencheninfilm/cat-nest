import { CAT_EXPRESSIONS, normalizeCatExpression, catExpressionPortrait } from './cat-expressions.js';

export function catExpressionsPanel(value = 'auto') {
  const selected = normalizeCatExpression(value);
  return `<div class="expression-heading"><h2 id="expression-panel-title">小猫表情</h2><span>每一种心情，都陪着你</span></div>
    <button class="expression-auto" data-expression-choice="auto" aria-pressed="${selected === 'auto'}"><i data-lucide="sparkles" aria-hidden="true"></i><strong>跟随心情</strong><b class="expression-check" aria-hidden="true">${selected === 'auto' ? '✓' : ''}</b></button>
    <div class="expression-grid" role="group" aria-label="选择猫咪表情">${CAT_EXPRESSIONS.map(expression => `<button class="expression-choice" data-expression-choice="${expression.id}" aria-label="${expression.name}，${expression.detail}" title="${expression.name} · ${expression.detail}" aria-pressed="${selected === expression.id}" style="--expression-tone:${expression.tone}">${catExpressionPortrait(expression.id)}<strong>${expression.name}</strong><b class="expression-check" aria-hidden="true">${selected === expression.id ? '✓' : ''}</b></button>`).join('')}</div>
    <div class="expression-footer"><p id="expression-feedback" role="status" aria-live="polite">点一点，换个小心情</p><button class="expression-greet" data-expression-greet>打个招呼 <span aria-hidden="true">♡</span></button></div>`;
}
