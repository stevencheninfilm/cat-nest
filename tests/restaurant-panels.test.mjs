import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, levelStartXp } from '../src/state.js';
import { restaurantInfo, RESTAURANT_STAFF } from '../src/restaurant.js';
import { restaurantRecipesPanel, restaurantStaffPanel, restaurantUpgradesPanel, restaurantInfoPanel, restaurantMarkup, restaurantAppearancePanel } from '../src/restaurant-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
test('appearance tabs render only their own live catalog and retain independent scene and prop actions',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),before=structuredClone(info);
  for(const [view,attribute,count] of [['colors','data-r-palette',5],['scenes','data-r-decoration-card',6],['decor','data-r-theme',9]]){
    const markup=restaurantAppearancePanel(info,{view});
    assert.equal((markup.match(new RegExp(`${attribute}="`,'g'))||[]).length,count);
    assert.equal((markup.match(/data-r-theme-view=/g)||[]).length,3);
    assert.match(markup,new RegExp(`data-r-theme-view="${view}" aria-pressed="true"`));
    for(const other of ['data-r-palette','data-r-decoration-card','data-r-theme'].filter(item=>item!==attribute))assert.ok(!markup.includes(`${other}="`));
  }
  assert.equal(restaurantAppearancePanel(info,{view:'stale'}),restaurantAppearancePanel(info));
  assert.deepEqual(info,before);
});
test('the compact team and ability views keep independent content and retain the selected employee',()=>{
  const state=initialState(NOW);state.restaurant.staff=2;
  const info=restaurantInfo(state,NOW),before=structuredClone(state);
  const team=restaurantStaffPanel(info,{staffId:'milky',workerId:'worker-3'});
  assert.equal((team.match(/data-r-staff-preview=/g)||[]).length,RESTAURANT_STAFF.length);
  assert.match(team,/data-r-staff-detail="milky"/);
  assert.equal((team.match(/data-r-action="hire"/g)||[]).length,1);
  assert.doesNotMatch(team,/data-r-action="train"|r-staff-portrait|点名片预览/);
  const training=restaurantStaffPanel(info,{view:'training',workerId:'worker-3'});
  assert.match(training,/data-r-tab="training" aria-pressed="true"/);
  assert.equal((training.match(/data-r-action="train"/g)||[]).length,4);
  assert.equal((training.match(/data-r-worker="worker-3"/g)||[]).length,4);
  assert.doesNotMatch(training,/data-r-action="hire"|data-r-staff-preview=/);
  assert.deepEqual(state,before);
});
test('every registered ordinary and special recipe remains accessible in the compact category catalog',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),markup=restaurantRecipesPanel(info);
  const catalog=[...info.recipes,...info.specialRecipes];
  assert.equal((markup.match(/data-r-dish=/g)||[]).length,catalog.length);
  for(const recipe of catalog)assert.ok(markup.includes(`data-r-dish="${recipe.id}"`));
  const drinks=restaurantRecipesPanel(info,{category:'饮品'});
  for(const recipe of catalog)assert.equal(drinks.includes(`data-r-dish="${recipe.id}"`),recipe.category==='饮品');
  for(const recipe of info.specialRecipes)assert.ok(markup.includes(`data-r-action="unlock-special" data-r-recipe="${recipe.id}"`));
});
test('owned signature recipes occur once in the combined catalog and the info ledger never double-counts them',()=>{
  const state=initialState(NOW),specials=restaurantInfo(state,NOW).specialRecipes;
  state.restaurant.stats.experience=levelStartXp(50);
  state.restaurant.ownedSpecialRecipes=specials.map(recipe=>recipe.id);
  for(const recipe of specials)state.restaurant.recipeLevels[recipe.id]=1;
  const info=restaurantInfo(state,NOW),markup=restaurantRecipesPanel(info);
  const ids=[...markup.matchAll(/data-r-dish="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,21);assert.equal(new Set(ids).size,21);
  assert.match(markup,/已收录 21 \/ 21/);
  for(const recipe of specials){
    assert.ok(!markup.includes(`data-r-action="start" data-r-recipe="${recipe.id}"`));
    assert.ok(markup.includes(`data-r-recipe-detail="${recipe.id}"`));
    assert.ok(!markup.includes(`data-r-action="unlock-special" data-r-recipe="${recipe.id}"`));
  }
  assert.match(restaurantInfoPanel(info,state),/已收录料理<\/span><strong>21<small>道/);
});
test('the business ledger moves to a dedicated reachable info panel without removing facility upgrade actions',()=>{
  const state=initialState(NOW),info=restaurantInfo(state,NOW),before=structuredClone(state);
  const upgrades=restaurantUpgradesPanel(info),ledger=restaurantInfoPanel(info,state),shell=restaurantMarkup(state,{isTest:true});
  assert.equal((upgrades.match(/data-r-action="upgrade"/g)||[]).length,info.upgrades.length);
  assert.doesNotMatch(upgrades,/小馆的营业手账|r-notebook|r-panel-intro/);
  assert.match(shell,/data-r-tab="info" aria-label="查看小馆营业信息"/);
  assert.match(ledger,/小馆的营业手账/);assert.match(ledger,/营业收入/);assert.match(ledger,/接待容量/);
  assert.match(ledger,/data-r-tab="help"/);assert.match(ledger,/data-r-tab="progression"/);
  assert.deepEqual(state,before);
});
