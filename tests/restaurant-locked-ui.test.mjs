import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo } from '../src/restaurant.js';
import { restaurantRecipesPanel, restaurantStaffPanel } from '../src/restaurant-ui.js';
import { restaurantTrainingPanel, premiumThemesMarkup } from '../src/restaurant-economy-ui.js';
import { restaurantFacilityCards } from '../src/restaurant-upgrade-ui.js';
import { restaurantDecorationsPanel } from '../src/restaurant-decor-ui.js';
import { kitchenPaletteMarkup } from '../src/restaurant-kitchen-colors.js';
import { restaurantCustomersPanel } from '../src/restaurant-customers-ui.js';
import { restaurantProgressionPanel } from '../src/restaurant-progression-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'lock-preview',name:'店长'};
const card=(html,attribute,id)=>{
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=html.match(new RegExp(`<(?<tag>article|button|div)\\b[^>]*${attribute}="${escaped}"[^>]*>[\\s\\S]*?<\\/\\k<tag>>`));
  assert.ok(match,`${attribute}=${id}`);return match[0];
};
const locked=html=>{assert.match(html,/data-r-locked="true"/);assert.match(html,/data-r-lock-indicator/);};
const visible=html=>assert.doesNotMatch(html.match(/^<[^>]+>/)[0],/data-r-locked/);

test('unowned previews stay locked after reaching their level and become colourful only after acquiring them',()=>{
  const state=initialState(NOW);state.coins=99999;state.goldFish=100;state.restaurant.stats.experience=levelStartXp(50);
  let info=restaurantInfo(state,NOW);const before=structuredClone(state);
  locked(card(restaurantStaffPanel(info),'data-r-staff-preview','shadow'));
  locked(card(restaurantRecipesPanel(info),'data-r-dish','gold-salmon'));
  locked(card(premiumThemesMarkup(info),'data-r-theme','starlight'));
  const purchase=card(restaurantRecipesPanel(info),'data-r-dish','gold-salmon');
  assert.doesNotMatch(purchase.match(/<button[^>]*data-r-action="unlock-special"[^>]*>/)[0],/disabled/);
  assert.deepEqual(state,before,'rendering previews cannot unlock resources or spend currency');
  let acquired=reduceAction(state,{type:'restaurant-hire'},actor,NOW);
  acquired=reduceAction(acquired,{type:'restaurant-unlock-special',recipeId:'gold-salmon'},actor,NOW);
  acquired=reduceAction(acquired,{type:'restaurant-theme',themeId:'starlight'},actor,NOW);
  info=restaurantInfo(acquired,NOW);
  visible(card(restaurantStaffPanel(info),'data-r-staff-preview','shadow'));
  visible(card(restaurantRecipesPanel(info),'data-r-dish','gold-salmon'));
  visible(card(premiumThemesMarkup(info),'data-r-theme','starlight'));
});

test('level gates colour recipes, facilities, palettes and training independently from temporary disabled actions',()=>{
  const state=initialState(NOW),low=restaurantInfo(state,NOW);
  const recipe=low.recipes.find(item=>!item.unlocked);
  locked(card(restaurantRecipesPanel(low),'data-r-dish',recipe.id));
  locked(card(restaurantFacilityCards(low),'data-r-facility','kitchen'));
  locked(card(kitchenPaletteMarkup(low),'data-r-palette','sky'));
  state.restaurant.stats.experience=levelStartXp(50);const high=restaurantInfo(state,NOW);
  visible(card(restaurantRecipesPanel(high),'data-r-dish',recipe.id));
  visible(card(restaurantFacilityCards(high),'data-r-facility','kitchen'));
  visible(card(kitchenPaletteMarkup(high),'data-r-palette','sky'));
  const gated=structuredClone(high);gated.level=1;
  gated.restaurant.staffTraining['worker-1'].levels.speed=2;
  locked(card(restaurantTrainingPanel(gated,{now:NOW}),'data-r-ability','speed'));
  const full=structuredClone(low);full.availableTables=0;
  const known=card(restaurantRecipesPanel(full),'data-r-dish','rice');
  visible(known);assert.doesNotMatch(known,/客满啦|data-r-action="start"/,'full tables do not add a dish-order button to the menu');
});

test('decoration ownership, guest encounters and roadmap status preserve readable lock conditions',()=>{
  const state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(50);
  let info=restaurantInfo(state,NOW);const suite=info.decorationInfo.decorations.find(item=>!item.owned);
  locked(card(restaurantDecorationsPanel(info),'data-r-decoration-card',suite.id));
  locked(card(restaurantCustomersPanel(info),'data-r-customer-id','guest-baker'));
  locked(card(restaurantProgressionPanel(info),'data-r-progression-key','staff:shadow'));
  state.restaurant.ownedDecorations=[...info.decorationInfo.decorations.filter(item=>item.owned).map(item=>item.id),suite.id];
  state.restaurant.seenGuests=['guest-baker'];
  info=restaurantInfo(state,NOW);
  visible(card(restaurantDecorationsPanel(info),'data-r-decoration-card',suite.id));
  visible(card(restaurantCustomersPanel(info),'data-r-customer-id','guest-baker'));
  visible(card(restaurantProgressionPanel(info),'data-r-progression-key','recipe:rice'));
});
