// Saves keep their existing integer units; ten saved units equal one displayed point.
export const AFFECTION_UNITS_PER_POINT = 10;
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits:0 });

export function affectionValue(units) {
  return Number.isFinite(units) && units >= 0 ? units / AFFECTION_UNITS_PER_POINT : 0;
}
export function formatAffection(units) {
  // Truncate only the display; fractional progress stays in the saved units.
  return number.format(Math.floor(affectionValue(units)));
}

/** Convert the known legacy feeding bonus copy only when rendering saved history. */
export function affectionHistoryText(text) {
  return String(text ?? '').replace(/(，双人喂养额外获得)10(点亲密度)$/, (_, before, after) => `${before}${formatAffection(10)}${after}`);
}
