import { restaurantDayResetAt, restaurantLoginDay } from './restaurant-daily-login.js';

// All three categories have recipes available at restaurant level one.
const ROTATION = ['主食', '甜点', '饮品'];
const TARGET = 2;
const REWARD_COINS = 30;

export function validRestaurantCommission(record) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && Object.keys(record).length === 2 && Number.isSafeInteger(record.day)
    && record.day >= 0 && record.day <= restaurantLoginDay(Number.MAX_SAFE_INTEGER)
    && Number.isInteger(record.progress) && record.progress >= 1 && record.progress <= TARGET;
}

export function restaurantCommissionPreserved(before, after) {
  return !before || Boolean(after && (
    after.day > before.day || (after.day === before.day && after.progress >= before.progress)
  ));
}

export function restaurantDailyCommissionInfo(restaurant, now) {
  const saved = restaurant.dailyCommission;
  const day = Math.max(restaurantLoginDay(now), saved?.day ?? 0);
  const progress = saved?.day === day ? saved.progress : 0;
  return {
    day, category: ROTATION[day % ROTATION.length],
    target: TARGET, progress, rewardCoins: REWARD_COINS, completed: progress === TARGET,
    nextResetAt: restaurantDayResetAt(day),
  };
}

/** Count only an order that the shared settlement actually removes. */
export function settleRestaurantCommission(commission, category, now) {
  if (commission.completed || category !== commission.category || commission.day !== restaurantLoginDay(now)) return null;
  const progress = commission.progress + 1;
  return {day: commission.day, progress};
}

export function restaurantCommissionPayout(before, after) {
  return before && after && before.day === after.day && before.progress === TARGET - 1
    && after.progress === TARGET ? REWARD_COINS : 0;
}
