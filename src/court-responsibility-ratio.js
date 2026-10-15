import { verdictDisplay } from './court-verdict-display.js';

/** Only use a valid, saved estimate. Older verdicts keep their missing values. */
export function responsibilityRatio(verdict, repair) {
  const details = verdict?.details;
  const display = verdictDisplay(verdict, repair);
  const values = details?.responsibility?.percentages;
  if (!values || details.confidence === 'low' || !['primary-a', 'primary-b', 'shared'].includes(display.key)) return null;
  const { a, b } = values;
  if (![a, b].every(number => Number.isInteger(number) && number >= 0 && number <= 100 && number % 5 === 0) || a + b !== 100) return null;
  if (display.key === 'primary-a' && a <= b || display.key === 'primary-b' && b <= a || display.key === 'shared' && Math.abs(a - b) > 10) return null;
  return { a, b };
}
