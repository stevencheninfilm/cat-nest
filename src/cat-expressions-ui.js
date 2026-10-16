import { CAT_EXPRESSIONS, catExpressionPortrait } from './cat-expressions.js';
import { CAT_ACTIONS, catActionPortrait } from './cat-actions.js';
import { isFeatureUnlocked, FEATURE_UNLOCKS } from './feature-unlocks.js';
import { featureLockPanel } from './feature-unlocks-ui.js';

export function catExpressionsPanel(tab = 'expressions', {level=1}={}) {
  const actions = tab === 'actions';
  const locked=!isFeatureUnlocked(actions?'actions':'expressions',level);
  const tabLabel=(feature,label)=>`${label}<small>${isFeatureUnlocked(feature,level)?feature==='actions'?'9':'':`🔒 Lv.${FEATURE_UNLOCKS[feature].level}`}</small>`;
  return `<div class="expression-heading"><h2 id="expression-panel-title">${actions ? '小猫动作' : '小猫表情'}</h2></div>
    <div class="expression-tabs" role="group" aria-label="选择表情或动作"><button class="${isFeatureUnlocked('expressions',level)?'':'is-level-locked'}" data-cat-palette-tab="expressions" aria-pressed="${!actions}">${tabLabel('expressions','表情')}</button><button class="${isFeatureUnlocked('actions',level)?'':'is-level-locked'}" data-cat-palette-tab="actions" aria-pressed="${actions}">${tabLabel('actions','动作')}</button></div>
    ${locked?featureLockPanel(actions?'actions':'expressions'):actions ? `<div class="expression-grid animation-grid" role="group" aria-label="选择猫咪动作">${CAT_ACTIONS.map(action => `<button class="expression-choice animation-choice" data-cat-animation="${action.id}" aria-label="${action.name}${action.manualOnly ? '，仅点选时播放' : ''}" title="${action.name}${action.manualOnly ? ' · 仅点选时播放' : ''}">${catActionPortrait(action.id)}<strong>${action.name}</strong>${action.manualOnly ? '<span class="animation-manual">点选</span>' : ''}</button>`).join('')}</div>`
      : `<div class="expression-grid" role="group" aria-label="选择猫咪表情">${CAT_EXPRESSIONS.map(expression => `<button class="expression-choice" data-expression-choice="${expression.id}" aria-label="${expression.name}，${expression.detail}" title="${expression.name} · ${expression.detail}">${catExpressionPortrait(expression.id)}<strong>${expression.name}</strong></button>`).join('')}</div>`}
    ${locked?'':`<div class="expression-footer"><p>${actions ? '吓一跳、装晕仅点选' : '做个小表情，再继续陪你'}</p><button class="expression-greet" data-expression-greet>打个招呼 <span aria-hidden="true">♡</span></button></div>`}`;
}
