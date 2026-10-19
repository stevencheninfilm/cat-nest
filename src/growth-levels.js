/** The shared cat-growth ladder. Keep all callers on this dependency-free
 * calculation so restaurant progression can reuse the same experience scale. */
export function levelStartXp(level) {
  const completed = Number.isFinite(level) ? Math.max(0, Math.floor(level) - 1) : 0;
  return 15 * completed * (completed + 7);
}

export function levelInfo(xp) {
  const bounded = Number.isFinite(xp) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, xp)) : 0;
  const total = Number.isInteger(bounded) ? bounded : Math.round(bounded * 10) / 10;
  // Each upgrade costs 120 + 30 * (level - 1). Completing n levels therefore
  // costs 15 * n * (n + 7); invert the sum instead of iterating over every level.
  const threshold = completed => levelStartXp(completed + 1);
  let completed = Math.floor((Math.sqrt(49 + 4 * total / 15) - 7) / 2);
  // Correct floating-point rounding at exact boundaries, including large saves.
  while (threshold(completed) > total) completed -= 1;
  while (threshold(completed + 1) <= total) completed += 1;
  const progress = total - threshold(completed);
  return { level: completed + 1, progress:Number.isInteger(progress) ? progress : Math.round(progress * 10) / 10, target: 120 + 30 * completed };
}
