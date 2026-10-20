import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant, restaurantProgressPreserved, sanitizeRestaurantAction } from '../src/restaurant.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { completedRestaurantGuestConditions, validRestaurantGuestConditions, eligibleRestaurantGuestCats } from '../src/restaurant-customers.js';
import { restaurantCustomerDetail } from '../src/restaurant-customers-ui.js';
const NOW=Date.UTC(2026,9,20),ACTOR={id:'conditions-owner',name:'店长'};
const card=(state,id,at=NOW)=>restaurantInfo(state,at).customerBook.customers.find(guest=>guest.id===id);
const met=(state,id,kind,at=NOW)=>card(state,id,at).requirements.find(condition=>condition.kind===kind).met;
function seed(){const state=initialState(NOW);state.coins=10000;state.goldFish=100;state.restaurant.stats.experience=restaurantLevelStartXp(50);return state;}
function act(state,action,at=NOW){const next=reduceAction(state,action,ACTOR,at,`condition-action-${at}`);assert.ok(next,JSON.stringify(action));return next;}

test('a scene condition is recorded independently before the rest of its guest requirements and survives a later scene change',()=>{
  const base=seed();assert.equal(card(base,'guest-reader').eligible,false);
  const started=act(base,{type:'restaurant-decoration',decorationId:'cream-library'});
  assert.equal(met(started,'guest-reader','decoration',NOW+6999),false,'a purchase or unfinished installation is not an achievement');
  assert.equal(met(started,'guest-reader','decoration',NOW+7000),true);
  // No intermediate read/write is needed when the player returns after installation.
  const changed=act(started,{type:'restaurant-decoration',decorationId:'cream-bakery'},NOW+13000);
  assert.ok(changed.restaurant.completedGuestConditions.includes('decoration:cream-library'));
  assert.equal(met(changed,'guest-reader','decoration',NOW+26000),true);
  assert.equal(card(changed,'guest-reader',NOW+26000).eligible,false,'unachieved employee and facility conditions stay locked');
  const reload=normalizeState(JSON.parse(JSON.stringify(changed)),NOW+86400000);
  assert.equal(met(reload,'guest-reader','decoration',NOW+86400000),true);assert.deepEqual(reload.restaurant.seenGuests,[],'achieving a condition does not fabricate a visit');
  assert.equal(reload.restaurant.staff,0);assert.equal(reload.restaurant.levels.tips,1);
  let fulfilled=act(reload,{type:'restaurant-hire'},NOW+86400001);
  fulfilled=act(fulfilled,{type:'restaurant-hire'},NOW+86400002);
  fulfilled=act(fulfilled,{type:'restaurant-upgrade',upgradeId:'tips'},NOW+86400003);
  assert.equal(fulfilled.restaurant.decorationId,'cream-bakery');assert.equal(card(fulfilled,'guest-reader',NOW+86400003).eligible,true,'requirements can be achieved at different times');
});

test('premium decoration achievements persist after putting the piece away, while mere ownership is insufficient',()=>{
  const base=seed();base.restaurant.ownedThemes.push('royal');base.restaurant.equippedPremiumDecorations=[];
  assert.equal(met(base,'guest-royal-critic','theme'),false);
  const equipped=act(base,{type:'restaurant-premium-decoration',themeId:'royal',equipped:true});
  const stored=act(equipped,{type:'restaurant-premium-decoration',themeId:'royal',equipped:false},NOW+1);
  assert.deepEqual(stored.restaurant.equippedPremiumDecorations,[]);assert.equal(met(stored,'guest-royal-critic','theme',NOW+2),true);
  assert.ok(stored.restaurant.completedGuestConditions.includes('theme:royal'));
});

test('an authoritative historical visit restores all five requirements in an old save without changing its wallet, research or upgrades',()=>{
  const old=seed();old.restaurant.seenGuests=['guest-baker'];old.restaurant.theme='mint';old.restaurant.ownedThemes.push('mint');
  const before=structuredClone(old),restored=normalizeState(old,NOW+1),baker=card(restored,'guest-baker',NOW+1);
  assert.ok(baker.requirements.every(condition=>condition.met));assert.equal(baker.eligible,true);assert.ok(eligibleRestaurantGuestCats(restored.restaurant,NOW+1).includes('guest-baker'));
  assert.equal(restored.coins,before.coins);assert.equal(restored.xp,before.xp);assert.deepEqual(restored.restaurant.levels,before.restaurant.levels);assert.deepEqual(restored.restaurant.research,before.restaurant.research);assert.equal(restored.restaurant.staff,before.restaurant.staff);
  assert.deepEqual(old,before,'reading does not rewrite the supplied save');
  const html=restaurantCustomerDetail(restaurantInfo(restored,NOW+1),{selectedId:'guest-baker'});assert.match(html,/每项达成后永久保留/);assert.doesNotMatch(html,/装扮需正在使用|再次满足条件后/);assert.equal((html.match(/class="is-met"/g)||[]).length,5);
});

test('a legacy construction origin retains its achieved condition after the target installation finishes',()=>{
  const installed=act(seed(),{type:'restaurant-decoration',decorationId:'cream-library'});
  const changing=act(installed,{type:'restaurant-decoration',decorationId:'cream-bakery'},NOW+13000);
  delete changing.restaurant.completedGuestConditions;
  const restored=normalizeState(changing,NOW+30000);assert.ok(restored.restaurant.completedGuestConditions.includes('decoration:cream-library'));assert.equal(restored.restaurant.decorationId,'cream-bakery');
});

test('saved achievements are strictly bounded, cannot be supplied as player intents, and cannot be erased by an ordinary save',()=>{
  const state=normalizeState({...seed(),restaurant:{...seed().restaurant,seenGuests:['guest-baker']}},NOW),saved=state.restaurant;
  assert.equal(validRestaurantGuestConditions(saved.completedGuestConditions),true);assert.equal(validRestaurant(saved),true);
  for(const conditions of [null,{},['decoration:unknown'],['level:999'],['level:10','level:10']]){assert.equal(validRestaurantGuestConditions(conditions),false);assert.equal(validRestaurant({...saved,completedGuestConditions:conditions}),false);}
  assert.equal(restaurantProgressPreserved(saved,{...saved,completedGuestConditions:[]}),false);assert.equal(restaurantProgressPreserved(saved,saved),true);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-arrive',completedGuestConditions:['level:50']}),null);
  assert.deepEqual(completedRestaurantGuestConditions(saved,NOW),saved.completedGuestConditions);
});
