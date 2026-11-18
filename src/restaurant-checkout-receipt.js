/** Attach the result of one committed bill to its action receipt. */
export function restaurantCheckoutReceipt(action, before, after) {
  if (action.type !== 'restaurant-collect') return undefined;
  const coins = after.restaurant.stats.earned - before.restaurant.stats.earned;
  if (!Number.isSafeInteger(coins) || coins <= 0) return undefined;
  const goldFish = (after.goldFish ?? 0) - (before.goldFish ?? 0);
  const gift = after.restaurant.research?.lastGift;
  return { coins, goldFish, inspiration: gift?.orderId === action.orderId ? gift.amount : 0 };
}
