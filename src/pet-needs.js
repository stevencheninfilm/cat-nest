export const NEEDS_DECAY_INTERVAL_MS = 30 * 60_000;
export const NEEDS_DECAY_PER_INTERVAL = Object.freeze({ hunger:1, mood:1, energy:1 });
export const NEEDS_BOOST_THRESHOLD = 80;
export const NEED_KEYS = Object.freeze(['hunger', 'mood', 'energy']);
export const NEED_LABELS = Object.freeze({ hunger:'饱饱', mood:'开心', energy:'活力' });
export const CARE_NEED_EFFECTS = Object.freeze({
  feed:Object.freeze({ mood:0 }),
  pet:Object.freeze({ mood:3 }),
  play:Object.freeze({ hunger:-1, mood:5, energy:-2 }),
  sleep:Object.freeze({ energy:35 }),
});
export const PLAY_ENERGY_COST = -CARE_NEED_EFFECTS.play.energy;

const validTime = value => Number.isSafeInteger(value) && value >= 0;
const bounded = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;

/** A shared saved clock accounts for offline time without timer writes or drift.
 * Keep the unfinished interval when an interaction changes a need. Reads never
 * mutate the saved snapshot, so polling or a second device cannot double-decay.
 */
export function petNeeds(state, now = Date.now()) {
  now = validTime(now) ? now : 0;
  const anchor = validTime(state?.needsUpdatedAt) ? state.needsUpdatedAt
    : validTime(state?.updatedAt) ? state.updatedAt : now;
  const elapsed = Math.floor(Math.max(0, now - anchor) / NEEDS_DECAY_INTERVAL_MS);
  const needsUpdatedAt = anchor + elapsed * NEEDS_DECAY_INTERVAL_MS;
  const values = Object.fromEntries(NEED_KEYS.map(key => [key, Math.max(0, bounded(state?.[key]) - elapsed * NEEDS_DECAY_PER_INTERVAL[key])]));
  const boostCount = NEED_KEYS.filter(key => values[key] > NEEDS_BOOST_THRESHOLD).length;
  return { ...values, needsUpdatedAt, nextDecayAt:needsUpdatedAt + NEEDS_DECAY_INTERVAL_MS,
    boostCount, boosted:boostCount > 0, multiplier:(10 + boostCount) / 10 };
}

export function needsDecayDescription() {
  return `每 ${NEEDS_DECAY_INTERVAL_MS / 60_000} 分钟：${NEED_KEYS.map(key=>`${NEED_LABELS[key]}下降 ${NEEDS_DECAY_PER_INTERVAL[key]} 点`).join('、')}`;
}

export function growthRewardAmount(base, boostCount = 0) {
  return base * (10 + Number(boostCount)) / 10;
}

/** Whole historic XP keeps its full safe-integer range. Decimal XP uses exact
 * tenths and refuses an unsafe addition rather than discarding a saved reward.
 */
export function addGrowthExperience(total, amount) {
  if (Number.isSafeInteger(total) && Number.isSafeInteger(amount)) {
    const next = total + amount;
    return Number.isSafeInteger(next) ? next : null;
  }
  const currentTenths = Math.round(total * 10), rewardTenths = Math.round(amount * 10);
  const next = currentTenths + rewardTenths;
  return Number.isSafeInteger(currentTenths) && Number.isSafeInteger(rewardTenths) && Number.isSafeInteger(next) ? next / 10 : null;
}
