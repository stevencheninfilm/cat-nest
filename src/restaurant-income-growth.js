/** Original reward receipts remain the source of truth; grouping is only a view. */
export const RESTAURANT_INCOME_ID = 'restaurant-income-total';
export const RESTAURANT_INCOME_ART = 'assets/growth-hearts/v2/restaurant-income.webp';
export const RESTAURANT_CLAIM_BATCH_SIZE = 128;
const rewardId = /^[a-zA-Z0-9_.:-]{8,180}$/;
export const isRestaurantGrowth = reward => reward?.kind === 'restaurant-collect';
export const growthAmount = rewards => rewards.reduce((sum, reward) => sum + Math.round(reward.amount * 10), 0) / 10;
export function sanitizeRestaurantGrowthClaim(action) {
  if (!action || action.type !== 'claim-restaurant-growth' || Object.keys(action).length !== 2 || !Array.isArray(action.rewardIds) || !action.rewardIds.length || action.rewardIds.length > RESTAURANT_CLAIM_BATCH_SIZE || !action.rewardIds.every(id => typeof id === 'string' && rewardId.test(id)) || new Set(action.rewardIds).size !== action.rewardIds.length) return null;
  return { type: 'claim-restaurant-growth', rewardIds: [...action.rewardIds] };
}
export function restaurantGrowthClaims(rewards) {
  const ids = rewards.filter(isRestaurantGrowth).map(reward => reward.id), actions = [];
  // Bounded requests stay below the API body limit, even for 180-character IDs.
  for (let index = 0; index < ids.length; index += RESTAURANT_CLAIM_BATCH_SIZE) actions.push({ type: 'claim-restaurant-growth', rewardIds: ids.slice(index, index + RESTAURANT_CLAIM_BATCH_SIZE) });
  return actions;
}
export function growthClaimIds(action) {
  return action?.type === 'claim-growth' ? [action.rewardId] : action?.type === 'claim-restaurant-growth' && Array.isArray(action.rewardIds) ? action.rewardIds : [];
}
export function groupRestaurantGrowth(rewards) {
  if (rewards.some(reward => reward.id === RESTAURANT_INCOME_ID)) return rewards;
  const restaurant = rewards.filter(isRestaurantGrowth);
  if (!restaurant.length) return rewards;
  return [{ id: RESTAURANT_INCOME_ID, kind: 'restaurant-collect', amount: growthAmount(restaurant), count: restaurant.length, rewardIds: restaurant.map(reward => reward.id) }, ...rewards.filter(reward => !isRestaurantGrowth(reward))];
}
