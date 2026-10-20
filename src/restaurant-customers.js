import { specialRestaurantRecipe } from './restaurant-economy.js';
import { RESTAURANT_EXTRA_CUSTOMER_ROWS } from './restaurant-customer-expansion.js';
import { restaurantLevelInfo as levelInfo } from './growth-levels.js';
import { restaurantExperience, restaurantRecipeUnlocked, restaurantResourceLevel } from './restaurant-progression.js';
import { normalizeRestaurantDecorations } from './restaurant-decor.js';
import { premiumRestaurantTheme, equippedPremiumDecorations } from './restaurant-premium-decorations.js';

const ordinary=[
  ['orange','橘猫'],['calico','三花猫'],['gray','灰猫'],['scarf','围巾猫'],
  ['guest-angler','草帽钓客'],['guest-aloha','花衬衫猫'],['guest-professor','眼镜教授'],['guest-conductor','蓝帽列车长'],
  ['guest-detective','侦探猫'],['guest-headphones','耳机猫'],['guest-princess','小皇冠猫'],['guest-sunglasses','墨镜明星'],
  ['guest-sailor','水手猫'],['guest-beanie','毛线帽猫'],['guest-shark','鲨鱼帽猫'],['guest-florist','花帽猫'],
].map(([id,name],index)=>({id,name,advanced:false,description:'喜欢在小馆坐坐的猫猫朋友。',requirements:[],...(index>=4?{atlasSet:'guests-v1',atlasIndex:index-4}:{})}));
// Every advanced visitor requires ALL five conditions. Staff is hired in order;
// the explicit minimum keeps eligibility independent of UI catalog ordering.
const advanced=[
  ['baker','奶油烘焙客','只要闻到蜂蜜松饼的香气，就会忍不住探头。',10,'pancake','shadow',1,'kitchen',2,'cream-bakery'],
  ['reader','书店常客','一杯拿铁、一本旧书，就能度过整个下午。',13,'coffee','milky',2,'tips',2,'cream-library'],
  ['botanist','温室植物学家','最爱绿叶间的光影，还有清新的抹茶奶盖。',18,'matcha','milky',2,'fridge',2,'mint-greenhouse'],
  ['captain','海盐船长','靠岸后的第一件事，是来吃一碗热乌冬。',26,'udon','sesame',3,'tables',2,'mint-seaside'],
  ['tea-master','茶道先生','用一份樱花寿司，配一场安静的茶会。',33,'sushi','sesame',3,'kitchen',3,'sakura-teahouse'],
  ['violinist','暮樱琴师','演出结束后，喜欢坐在花灯下喝葡萄啵啵。',37,'grape','pudding',4,'tips',3,'sakura-evening'],
  ['painter','云朵画家','把华夫饼和窗边的暖光，一起画进速写本。',36,'waffle','pudding',4,'tables',3,'cream-library'],
  ['explorer','远行探险家','走过很多森林，还是想念花房的草莓牛奶。',42,'strawberrymilk','mint',5,'fridge',3,'mint-greenhouse'],
  ['astronomer','星光学者','抱着热可可，等今晚的第一颗星星。',47,'cocoa','mint',5,'kitchen',4,'starlight'],
  ['baron','金鱼男爵','对三文鱼饭和皇家小馆，都有自己的讲究。',50,'gold-salmon','chestnut',6,'tables',4,'royal'],
  ['pearl','珍珠海客','在琉璃窗边，慢慢享用一份星光圣代。',49,'gold-sundae','chestnut',6,'fridge',4,'glass'],
  ['royal-critic','皇家食评家','听说这里的鎏金拿铁很好喝，特地前来拜访。',50,'gold-latte','chestnut',6,'tips',4,'royal'],
...RESTAURANT_EXTRA_CUSTOMER_ROWS,
].map(([suffix,name,description,level,recipe,staff,staffCount,facility,facilityLevel,decoration],index)=>({
  id:`guest-${suffix}`,name,description,advanced:true,tier:index<8?'silver':'gold',courses:2,bonusGold:index<8?1:2,atlasSet:index<12?'guests-v2':'guests-v3',atlasIndex:index<12?index:index-12,atlasRows:index<12?6:2,
  requirements:[{kind:'level',minimum:level},{kind:'recipe',id:recipe},{kind:'staff',id:staff,minimum:staffCount},{kind:'facility',id:facility,minimum:facilityLevel},{kind:decoration.includes('-')?'decoration':'theme',id:decoration}],
}));
export const RESTAURANT_GUESTS=Object.freeze([...ordinary,...advanced].map(guest=>Object.freeze({...guest,requirements:Object.freeze(guest.requirements.map(Object.freeze))})));
export const RESTAURANT_GUEST_CATS=Object.freeze(RESTAURANT_GUESTS.map(guest=>guest.id));

export function validRestaurantSeenGuests(value){
  return Array.isArray(value)&&new Set(value).size===value.length&&value.length<=RESTAURANT_GUESTS.length&&value.every(id=>RESTAURANT_GUEST_CATS.includes(id));
}
export function normalizeRestaurantSeenGuests(restaurant){
  // Legacy saves can prove only the visitors who are still seated. Do not
  // invent historical encounters from an aggregate served count.
  return [...new Set([...(restaurant.seenGuests??[]),...(restaurant.parties??[]).flatMap(party=>party.members.map(member=>member.cat))])];
}

export const restaurantGuestConditionKey = condition => [condition.kind, condition.id, condition.minimum].filter(value => value !== undefined).join(':');
const CONDITION_KEYS = Object.freeze([...new Set(RESTAURANT_GUESTS.flatMap(guest => guest.requirements.map(restaurantGuestConditionKey)))]);
const CONDITION_KEY_SET = new Set(CONDITION_KEYS);
export function validRestaurantGuestConditions(value) {
  return Array.isArray(value) && value.length <= CONDITION_KEYS.length && new Set(value).size === value.length && value.every(key => CONDITION_KEY_SET.has(key));
}
/** Conditions are independent achievements. A past authoritative visit also
 * proves its requirements for saves created before this ledger existed. */
export function completedRestaurantGuestConditions(restaurant, now = Date.now()) {
  const effective = normalizeRestaurantDecorations({...restaurant}, now), level = levelInfo(restaurantExperience(effective)).level;
  const completed = new Set(restaurant.completedGuestConditions ?? []), seen = new Set(normalizeRestaurantSeenGuests(restaurant));
  for (const guest of RESTAURANT_GUESTS) for (const condition of guest.requirements) {
    if (seen.has(guest.id) || requirementMet(effective, condition, level)) completed.add(restaurantGuestConditionKey(condition));
  }
  // The saved construction origin proves the previously installed suite even
  // when the old save is first opened after the new installation has finished.
  const previousSuite = restaurant.construction?.fromDecorationId;
  if (previousSuite) completed.add(`decoration:${previousSuite}`);
  return CONDITION_KEYS.filter(key => completed.has(key));
}

function requirementMet(restaurant,condition,level){
  if(condition.kind==='level')return level>=condition.minimum;
  if(condition.kind==='recipe')return restaurantRecipeUnlocked(restaurant,{id:condition.id,unlockLevel:restaurantResourceLevel('recipe',condition.id),special:Boolean(specialRestaurantRecipe(condition.id))});
  if(condition.kind==='staff')return restaurant.staff>=condition.minimum;
  if(condition.kind==='facility')return (restaurant.levels[condition.id]??1)>=condition.minimum;
  if(condition.kind==='decoration')return restaurant.decorationId===condition.id;
  if(condition.kind==='theme')return premiumRestaurantTheme(condition.id)?equippedPremiumDecorations(restaurant).includes(condition.id):restaurant.theme===condition.id;
  return false;
}
/** Called by the authoritative arrival planner, never supplied by the client. */
export function eligibleRestaurantGuestCats(restaurant,now){
  const completed=new Set(completedRestaurantGuestConditions(restaurant,now));
  return RESTAURANT_GUESTS.filter(guest=>guest.requirements.every(condition=>completed.has(restaurantGuestConditionKey(condition)))).map(guest=>guest.id);
}

/** Names come from the same live catalogs as purchasing and upgrade panels. */
export function restaurantCustomerInfo(restaurant,{recipes=[],staff=[],upgrades=[],decorations=[],themes=[]}={},now=Date.now()){
  const completed=new Set(completedRestaurantGuestConditions(restaurant,now)),seen=new Set(normalizeRestaurantSeenGuests(restaurant));
  const label=condition=>{
    const catalog=condition.kind==='recipe'?recipes:condition.kind==='staff'?staff:condition.kind==='facility'?upgrades:condition.kind==='decoration'?decorations:themes;
    const name=catalog.find(item=>item.id===condition.id)?.name??condition.id;
    return condition.kind==='level'?`小馆达到 Lv.${condition.minimum}`:condition.kind==='recipe'?`解锁 ${name}`:condition.kind==='staff'?`雇佣 ${name}`:condition.kind==='facility'?`${name} Lv.${condition.minimum}`:`布置 ${name}`;
  };
  const customers=RESTAURANT_GUESTS.map(guest=>{
    const requirements=guest.requirements.map(condition=>({...condition,label:label(condition),met:completed.has(restaurantGuestConditionKey(condition)),panel:({level:'progression',recipe:'recipes',staff:'staff',facility:'upgrades',decoration:'themes',theme:'themes'})[condition.kind]}));
    return {...guest,requirements,eligible:requirements.every(item=>item.met),seen:seen.has(guest.id),visiting:(restaurant.parties??[]).some(party=>party.members.some(member=>member.cat===guest.id))};
  });
  return {customers,total:customers.length,seen:customers.filter(item=>item.seen).length,eligible:customers.filter(item=>item.eligible).length,advanced:customers.filter(item=>item.advanced).length};
}
