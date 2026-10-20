/** A restaurant's two owners share one gift per Beijing calendar day.
 * Only the authoritative action reducer creates a receipt or credits coins. */
export const RESTAURANT_DAILY_LOGIN_COINS=300;
export const RESTAURANT_DAILY_LOGIN_TIME_ZONE='Asia/Shanghai';
const DAY_MS=86400000,OFFSET_MS=8*3600000;
export const restaurantLoginDay=now=>Math.floor(now/DAY_MS+OFFSET_MS/DAY_MS);
export function validRestaurantDailyLogin(value){
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&
    Number.isSafeInteger(value.day)&&value.day>=0&&Number.isSafeInteger(value.claimedAt)&&value.claimedAt>=0&&
    value.day===restaurantLoginDay(value.claimedAt);
}
export function restaurantDailyLoginInfo(restaurant,now=Date.now()){
  const day=restaurantLoginDay(now),claimed=(restaurant?.dailyLogin?.day??-1)>=day;
  return {day,amount:RESTAURANT_DAILY_LOGIN_COINS,claimed,available:!claimed,nextResetAt:(day+1)*DAY_MS-OFFSET_MS};
}
