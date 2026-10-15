import { foodCooldownMs } from './state.js';

/** Remaining portions follow each saved meal's own duration, without new state. */
export function foodRemainingPortion(food, remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  const duration = foodCooldownMs(food);
  if (remainingMs <= duration * .25) return 25;
  if (remainingMs <= duration * .5) return 50;
  if (remainingMs <= duration * .75) return 75;
  return 100;
}
