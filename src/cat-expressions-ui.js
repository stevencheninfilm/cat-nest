import { CAT_EXPRESSIONS, catExpressionPortrait } from './cat-expressions.js';
import { CAT_ACTIONS, catActionPortrait } from './cat-actions.js';

export function catExpressionsPanel(tab = 'expressions') {
  const actions = tab === 'actions';
  return `<div class="expression-heading"><h2 id="expression-panel-title">${actions ? '小猫动作' : '小猫表情'}</h2></div>
    <div class="expression-tabs" role="group" aria-label="选择表情或动作"><button data-cat-palette-tab="expressions" aria-pressed="${!actions}">表情</button><button data-cat-palette-tab="actions" aria-pressed="${actions}">动作 <small>9</small></button></div>
    ${actions ? `<div class="expression-grid animation-grid" role="group" aria-label="选择猫咪动作">${CAT_ACTIONS.map(action => `<button class="expression-choice animation-choice" data-cat-animation="${action.id}" aria-label="${action.name}${action.manualOnly ? '，仅点选时播放' : ''}" title="${action.name}${action.manualOnly ? ' · 仅点选时播放' : ''}">${catActionPortrait(action.id)}<strong>${action.name}</strong>${action.manualOnly ? '<span class="animation-manual">点选</span>' : ''}</button>`).join('')}</div>`
      : `<div class="expression-grid" role="group" aria-label="选择猫咪表情">${CAT_EXPRESSIONS.map(expression => `<button class="expression-choice" data-expression-choice="${expression.id}" aria-label="${expression.name}，${expression.detail}" title="${expression.name} · ${expression.detail}">${catExpressionPortrait(expression.id)}<strong>${expression.name}</strong></button>`).join('')}</div>`}
    <div class="expression-footer"><p>${actions ? '吓一跳、装晕仅点选' : '做个小表情，再继续陪你'}</p><button class="expression-greet" data-expression-greet>打个招呼 <span aria-hidden="true">♡</span></button></div>`;
}
