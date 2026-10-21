import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { RESTAURANT_DECORATIONS, createRestaurantConstruction } from '../src/restaurant-decor.js';
import { SPECIAL_RESTAURANT_RECIPES, PREMIUM_RESTAURANT_THEMES } from '../src/restaurant-economy.js';
import { restaurantArrivalPlan } from '../src/restaurant-guests.js';
import { RESTAURANT_GUESTS, eligibleRestaurantGuestCats, validRestaurantSeenGuests } from '../src/restaurant-customers.js';
import { restaurantCustomersPanel, restaurantCustomerDetail } from '../src/restaurant-customers-ui.js';
import { restaurantMarkup } from '../src/restaurant-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'customer-book-test',name:'店长'};
const advanced=RESTAURANT_GUESTS.filter(guest=>guest.advanced);
function prepared(guest){
  const state=initialState(NOW),r=state.restaurant;
  r.stats.experience=levelStartXp(50);r.staff=6;
  r.levels={kitchen:4,fridge:4,tables:4,tips:4};
  r.ownedSpecialRecipes=SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id);
  r.ownedSpecialRecipes.forEach(id=>r.recipeLevels[id]=1);
  r.ownedThemes=['cream','mint','sakura',...PREMIUM_RESTAURANT_THEMES.map(theme=>theme.id)];
  r.ownedDecorations=RESTAURANT_DECORATIONS.map(suite=>suite.id);
  const decor=guest.requirements.find(item=>['decoration','theme'].includes(item.kind));
  const suite=RESTAURANT_DECORATIONS.find(suite=>suite.id===decor.id);
  if(suite){r.decorationId=suite.id;r.theme=suite.theme;}else r.theme=decor.id;
  assert.ok(validRestaurant(r));return state;
}

test('every advanced visitor requires its recipe, employee, upgrade, decor and level together',()=>{
  assert.equal(advanced.length,16);
  const initial=initialState(NOW);
  assert.equal(eligibleRestaurantGuestCats(initial.restaurant,NOW).length,16);
  for(const guest of advanced){
    const state=prepared(guest),r=state.restaurant;
    assert.ok(eligibleRestaurantGuestCats(r,NOW).includes(guest.id),guest.name);
    assert.deepEqual(guest.requirements.map(item=>item.kind).slice(0,4),['level','recipe','staff','facility']);
    for(const requirement of guest.requirements){
      const missing=structuredClone(r);
      if(requirement.kind==='level')missing.stats.experience=levelStartXp(requirement.minimum)-1;
      if(requirement.kind==='staff')missing.staff=requirement.minimum-1;
      if(requirement.kind==='facility')missing.levels[requirement.id]=requirement.minimum-1;
      if(requirement.kind==='decoration')delete missing.decorationId;
      if(requirement.kind==='theme')missing.theme='cream';
      if(requirement.kind==='recipe'){
        // Ordinary permissions follow the shared level curve; a legacy recipe
        // permission can satisfy a recipe before its normal level milestone.
        if(SPECIAL_RESTAURANT_RECIPES.some(recipe=>recipe.id===requirement.id)){missing.ownedSpecialRecipes=missing.ownedSpecialRecipes.filter(id=>id!==requirement.id);delete missing.recipeLevels[requirement.id];}
        else {missing.stats.experience=0;missing.progression.legacyRecipes=[];}
      }
      assert.ok(!eligibleRestaurantGuestCats(missing,NOW).includes(guest.id),`${guest.name}: ${requirement.kind}`);
    }
    const projected=restaurantInfo(state,NOW).customerBook.customers.find(item=>item.id===guest.id);
    assert.ok(projected.requirements.every(item=>item.met&&!item.label.includes('undefined')));
  }
});

test('owned decor and unfinished construction do not attract a visitor until installation',()=>{
  const guest=advanced[0],state=prepared(guest),r=state.restaurant;
  delete r.decorationId;
  r.construction=createRestaurantConstruction(r,'cream-bakery',NOW);r.revision++;
  assert.ok(validRestaurant(r));
  assert.ok(!eligibleRestaurantGuestCats(r,NOW+6999).includes(guest.id));
  assert.ok(eligibleRestaurantGuestCats(r,NOW+7000).includes(guest.id));
  assert.ok(!Object.hasOwn(r,'decorationId'),'eligibility reads must not mutate saved state');
  const premium=prepared(advanced.at(-1)).restaurant;
  premium.theme='cream';delete premium.decorationId;assert.ok(!eligibleRestaurantGuestCats(premium,NOW).includes(advanced.at(-1).id),'owning a scene is not installing it');
});

test('server arrival uses only eligible appearances; no client supplied guest can bypass the rules',()=>{
  for(const action of [{type:'restaurant-arrive',cat:'guest-baker'},{type:'restaurant-arrive',guestId:'guest-baker'},{type:'restaurant-arrive',eligibleCats:['guest-baker']},{type:'restaurant-arrive',seenGuests:['guest-baker']}])assert.equal(sanitizeRestaurantAction(action),null);
  for(const guest of advanced){
    const state=prepared(guest),info=restaurantInfo(state,NOW),allowed=new Set(eligibleRestaurantGuestCats(info.restaurant,NOW));
    const observed=new Set();
    for(let i=0;i<160;i++){
      const plan=restaurantArrivalPlan(info.restaurant,info.recipes.filter(recipe=>recipe.unlocked),{partySize:2},actor,NOW+i);
      assert.equal(new Set(plan.members.map(member=>member.cat)).size,2);
      for(const member of plan.members){assert.ok(allowed.has(member.cat));observed.add(member.cat);}
    }
    assert.ok(observed.has(guest.id),`${guest.name} should join the natural pool`);
  }
});

test('accepted arrivals record encounters, reload preserves them, and decor changes keep existing parties',()=>{
  const guest=advanced[0],state=prepared(guest);let arrived;
  for(let i=0;i<120;i++){
    const next=reduceAction(state,{type:'restaurant-arrive',partySize:2},actor,NOW+i);
    assert.ok(next);assert.ok(validRestaurant(next.restaurant));
    if(next.restaurant.parties[0].members.some(member=>member.cat===guest.id)){arrived=next;break;}
  }
  assert.ok(arrived);const expected=arrived.restaurant.parties[0].members.map(member=>member.cat);
  assert.deepEqual(arrived.restaurant.seenGuests,expected);
  assert.equal(arrived.coins,state.coins);assert.equal(arrived.xp,state.xp);
  const reloaded=normalizeState(JSON.parse(JSON.stringify(arrived)),NOW+1000);
  assert.deepEqual(reloaded.restaurant.seenGuests,expected);
  const changed=reduceAction(reloaded,{type:'restaurant-theme',themeId:'royal'},actor,NOW+2000);
  assert.ok(changed);assert.ok(validRestaurant(changed.restaurant));
  assert.deepEqual(changed.restaurant.parties,reloaded.restaurant.parties);
  const entry=restaurantInfo(changed,NOW+2000).customerBook.customers.find(item=>item.id===guest.id);
  assert.equal(entry.seen,true);assert.equal(entry.visiting,true);assert.equal(entry.eligible,true,'another premium piece no longer removes an existing scene requirement');
  const old=structuredClone(arrived);delete old.restaurant.seenGuests;
  assert.ok(validRestaurant(old.restaurant));
  assert.deepEqual(normalizeState(old,NOW+1000).restaurant.seenGuests,expected);
  const empty=initialState(NOW);delete empty.restaurant.seenGuests;
  assert.deepEqual(normalizeState(empty,NOW).restaurant.seenGuests,[]);
  for(const bad of [null,{},['made-up'],[guest.id,guest.id]])assert.equal(validRestaurantSeenGuests(bad),false);
  const bad=structuredClone(arrived);bad.restaurant.seenGuests=['made-up'];assert.equal(validRestaurant(bad.restaurant),false);
});

test('encyclopedia is player-accessible, distinguishes encounters from eligibility, and links missing conditions',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),html=restaurantCustomersPanel(info);
  assert.ok(restaurantMarkup(initialState(NOW),{isTest:false}).includes('data-r-tab="customers"'));
  assert.equal(info.customerBook.seen,0);assert.equal(info.customerBook.eligible,16);
  assert.equal((html.match(/data-r-customer-id=/g)||[]).length,32);
  assert.doesNotMatch(html,/data-r-customer-detail=|rc-customer-intro/,'the list does not open a guest by default');
  assert.equal((html.match(/aria-haspopup="dialog"/g)||[]).length,32);
  const detail=restaurantCustomerDetail(info,{selectedId:'guest-baker'});
  assert.ok(detail.includes('全部满足后随机来访'));assert.ok(detail.includes('每项达成后永久保留'));assert.ok(!detail.includes('装扮需正在使用'));
  for(const panel of ['progression','recipes','staff','upgrades','themes'])assert.ok(detail.includes(`data-r-tab="${panel}"`));
  assert.equal(restaurantCustomerDetail(info,{selectedId:'not-a-guest'}),'');
  assert.match(restaurantMarkup(initialState(NOW)),/id="rc-customer-dialog" class="rc-customer-dialog" aria-labelledby="rc-customer-title"/);
  assert.equal((restaurantCustomersPanel(info,{filter:'advanced'}).match(/data-r-customer-id=/g)||[]).length,16);
  assert.equal((restaurantCustomersPanel(info,{filter:'locked'}).match(/data-r-customer-id=/g)||[]).length,16);
  assert.ok(restaurantCustomersPanel(info,{filter:'seen'}).includes('这里还没有猫友'));
});

test('eligible silver and gold plates unlock before a first visit and stay collected when requirements change',()=>{
  for(const guest of [advanced[0],advanced[8]]){
    const state=prepared(guest),before=structuredClone(state),info=restaurantInfo(state,NOW);
    const card=html=>html.match(new RegExp(`<button class="rc-customer-card[^>]*data-r-customer-id="${guest.id}"[^>]*>`))[0];
    const eligible=card(restaurantCustomersPanel(info));
    assert.match(eligible,/is-unlocked/);assert.match(eligible,new RegExp(`data-r-guest-tier="${guest.tier}"`));assert.doesNotMatch(eligible,/data-r-locked="true"/);
    assert.match(eligible,/等待初见/);assert.deepEqual(state,before,'viewing a plated card does not mark a visit');
    const initial=card(restaurantCustomersPanel(restaurantInfo(initialState(NOW),NOW)));
    assert.match(initial,/data-r-locked="true"/);assert.doesNotMatch(initial,/is-unlocked/);
    const collected=initialState(NOW);collected.restaurant.seenGuests=[guest.id];
    const seen=card(restaurantCustomersPanel(restaurantInfo(collected,NOW)));
    assert.match(seen,/is-unlocked/);assert.doesNotMatch(seen,/data-r-locked="true"/);assert.match(seen,/已到访/);
  }
});

test('all twelve advanced customers have matching transparent front/back art in their own atlas',async()=>{
  const root=new URL('../public/assets/restaurant/guests-v2/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.equal(Object.keys(manifest.customers).length,12);
  const atlas=await readFile(new URL(manifest.atlas.file,root));
  assert.equal(atlas.toString('ascii',12,16),'VP8X');assert.ok(atlas[20]&0x10);
  assert.equal(1+atlas.readUIntLE(24,3),1024);assert.equal(1+atlas.readUIntLE(27,3),1536);
  for(const guest of advanced.filter(guest=>guest.atlasSet==='guests-v2')){
    const cell=manifest.customers[guest.id];assert.equal(cell.name,guest.name);
    assert.equal(cell.column,guest.atlasIndex%4);assert.equal(cell.row,Math.floor(guest.atlasIndex/4)*2);assert.equal(cell.backRow,cell.row+1);
    const [front,back]=await Promise.all([cell.front,cell.back].map(file=>readFile(new URL(file,root))));
    assert.ok(!front.equals(back));for(const bytes of [front,back])assert.ok(bytes.length>1000&&Boolean(bytes[20]&0x10));
  }
});
