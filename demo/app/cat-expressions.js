export const CAT_EXPRESSIONS = Object.freeze([
  Object.freeze({ id: 'happy', name: '开心', detail: '活力充足', art: '0% 0%', tone: '#d1a34d' }),
  Object.freeze({ id: 'calm', name: '平静', detail: '悠闲陪伴', art: '50% 0%', tone: '#96a57d' }),
  Object.freeze({ id: 'lonely', name: '低落', detail: '想被陪伴', art: '100% 0%', tone: '#ab95b5' }),
  Object.freeze({ id: 'hungry', name: '饥饿', detail: '等待开饭', art: '0% 100%', tone: '#ca9779' }),
  Object.freeze({ id: 'tired', name: '疲惫', detail: '放慢动作', art: '50% 100%', tone: '#ae9c8b' }),
  Object.freeze({ id: 'sleeping', name: '熟睡', detail: '安静呼吸', art: '100% 100%', tone: '#99a2bf' }),
]);

export function normalizeCatExpression(value) {
  return CAT_EXPRESSIONS.some(expression => expression.id === value) ? value : 'auto';
}

export function catExpressionName(value) {
  return CAT_EXPRESSIONS.find(expression => expression.id === value)?.name || '跟随心情';
}

export function catExpressionPortrait(value, className = '') {
  const expression = CAT_EXPRESSIONS.find(expression => expression.id === value)
    || CAT_EXPRESSIONS.find(expression => expression.id === (value === 'sleepy' ? 'tired' : 'calm'));
  return `<span class="expression-portrait ${className}" style="--expression-art:${expression.art}" aria-hidden="true"></span>`;
}
