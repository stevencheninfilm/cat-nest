import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/state.js';
import { restaurantMarkup } from '../src/restaurant-ui.js';
import { restaurantGuestTables } from '../src/restaurant-guests-ui.js';
import { paintSupperScene } from '../src/restaurant-supper-scene.js';

test('the permanent supper control shares the scene toolbar with research in every home and opens the restaurant sheet', () => {
  for (const isTest of [false, true]) {
    const html = restaurantMarkup(initialState(), {isTest});
    const controls = html.split('class="r-scene-controls">')[1].split('</div><aside')[0];
    assert.deepEqual([...controls.matchAll(/data-r-tab="([^"]+)"/g)].map(match => match[1]), ['research','supper']);
    assert.match(controls, /data-r-tab="supper" aria-haspopup="dialog" aria-controls="r-panel-dialog"/);
    assert.match(html, /<dialog id="r-panel-dialog"/);
  }
});

test('the same foyer sign previews locked suppers, tracks a running service, and removes the garlands at closing', () => {
  const badge = {}, shortcut = {
    dataset:{}, querySelector:() => badge, getAttribute:() => shortcut.label,
    setAttribute:(_,label) => { shortcut.label = label; },
  };
  const garlands = {hidden:true,dataset:{}};
  const club = {themes:[{id:'drinks',name:'猫爪饮品吧'}],unlockLevel:8,unlocked:false,active:null};
  paintSupperScene(shortcut,garlands,club);
  assert.equal(badge.textContent,'Lv.8 开席');
  assert.equal(garlands.hidden,true);
  club.unlocked = true;
  club.active = {themeId:'drinks',progress:3,target:8};
  paintSupperScene(shortcut,garlands,club);
  assert.equal(shortcut.label,'查看主题餐会，猫爪饮品吧，进度 3/8');
  assert.equal(garlands.hidden,false);
  assert.equal(garlands.dataset.theme,'drinks');
  club.active = null;
  paintSupperScene(shortcut,garlands,club);
  assert.equal(badge.textContent,'常驻活动');
  assert.equal(garlands.hidden,true);
});

test('only uncollected signature dishes carry a visible stamp hint on a real order bubble', () => {
  const recipe = {id:'omelet',name:'蛋包饭'};
  const member = {seat:0,order:{id:'one',status:'requested',recipe}};
  const info = {capacity:1,parties:[{table:0,status:'seated',members:[member]}]};
  const render = () => restaurantGuestTables(info,{icon:() => '',food:() => ''});
  assert.doesNotMatch(render(), /rs-order-stamp/);
  const signature = {dishes:[recipe],collected:[],completed:false};
  info.supperClub = {active:{signature}};
  assert.match(render(), /aria-label="1号桌左座，接单 · 蛋包饭，结账可为招牌菜单集章"/);
  assert.match(render(), /class="rs-order-stamp"/);
  signature.collected.push(recipe.id);
  assert.doesNotMatch(render(), /rs-order-stamp/);
});
