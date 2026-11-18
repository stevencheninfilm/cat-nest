import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp } from '../src/growth-levels.js';
import { restaurantInfo, sanitizeRestaurantAction } from '../src/restaurant.js';
import { restaurantStaffPanel } from '../src/restaurant-ui.js';
import { restaurantSupperPanel, supperSelection, supperServiceFeedback } from '../src/restaurant-supper-ui.js';

const now = Date.parse('2026-11-17T10:30:00Z');
const player = { id:'client-supper', name:'主理人' };

function restaurant(level, staff, coins) {
  const state = initialState(now);
  state.restaurant.staff = staff;
  state.restaurant.stats.experience = restaurantLevelStartXp(level);
  state.coins = coins;
  return state;
}

function panel(state, options = {}) {
  return restaurantSupperPanel(restaurantInfo(state, now).supperClub, { coins:state.coins, ...options });
}

test('the standalone menu previews all themes even before unlocking and explains how to recruit', () => {
  const state = restaurant(1, 0, 400);
  for (const view of ['team','training']) {
    const html = restaurantStaffPanel(restaurantInfo(state, now), {view});
    assert.match(html, /data-r-tab="supper" aria-haspopup="dialog">主题餐会/);
    assert.doesNotMatch(html, /data-r-action="supper-start"/);
  }
  const html = panel(state);
  assert.match(html, /小馆 Lv.8 开放主题餐会/);
  assert.match(html, /data-r-tab="staff">招募一位搭档/);
  assert.match(html, /data-r-action="supper-start"[^>]+disabled/);
  assert.equal((html.match(/data-r-supper-theme="/g)||[]).length, 3);
  assert.doesNotMatch(html, /worker-2/);
  assert.match(panel(state, {draft:{themeId:'desserts'}}), /当前可点的甜点不足 2 种/);
});

test('theme and crew selections quote the actual fee, optional bonus and offline action', () => {
  const state = restaurant(50, 6, 38000);
  const draft = { themeId:'drinks', workerIds:['worker-6','worker-7'] };
  const html = panel(state, {draft,offline:true});
  assert.match(html, /data-r-supper-theme="drinks" aria-pressed="true"/);
  assert.match(html, /assets\/restaurant\/supper-club\/drinks\.webp"/);
  assert.match(html, /开办费 <strong>1,200 小鱼干/);
  assert.match(html, /持有 38,000/);
  assert.match(html, /饮品结账额外 \+1 进度/);
  assert.match(html, /完成餐会额外 \+12 灵感/);
  assert.match(html, /<strong>57 <em>研发灵感/);
  assert.match(html, /额外 \+15 灵感/);
  assert.match(html, /收席前结清 2 种不同饮品/);
  assert.match(html, /离线中/);
  assert.match(html, /再办成 3 场.*权重 ×2/);
  const start = html.match(/data-r-action="supper-start" data-r-supper-run="(\d+)" data-r-supper-theme-id="([^"]+)" data-r-supper-workers="([^"]+)">/);
  assert.ok(start, 'start remains enabled');
  const action = { type:'restaurant-supper-start', run:Number(start[1]), themeId:start[2], workerIds:start[3].split(',') };
  assert.deepEqual(sanitizeRestaurantAction(action), {type:'restaurant-supper-start', run:1, ...draft});
  assert.match(html, /<option value="worker-7" disabled>/);
  assert.match(panel({...state, coins:100}), /还差 1,100 小鱼干/);
  const club = restaurantInfo(state, now).supperClub;
  const nearCap = restaurantSupperPanel({...club,inspirationRoom:60}, {coins:state.coins,draft});
  assert.match(nearCap, /额外 \+3 灵感/);
  assert.match(nearCap, /本档额外奖励为 15 灵感/);
  assert.deepEqual(supperSelection(club, {themeId:'retired', workerIds:['worker-9','worker-1']}).workerIds, ['worker-1','worker-2']);
});

test('a running supper retains its crew and stamped dishes when reopened', () => {
  const state = restaurant(20, 2, 6000);
  const action = { type:'restaurant-supper-start',themeId:'desserts',run:1,workerIds:['worker-3','worker-2'] };
  const opened = reduceAction(state, action, player, now);
  const club = restaurantInfo(opened, now).supperClub;
  assert.match(restaurantStaffPanel(restaurantInfo(opened, now)), /主题餐会<small class="rs-tab-status">进行中/);
  const html = panel(opened, {draft:{themeId:'mains',workerIds:['worker-1','worker-2']}});
  assert.match(html, /data-theme="desserts" data-state="serving"/);
  assert.match(html, /第 1 档 · 进行中<\/small><h3>午后甜点会/);
  assert.match(html, /<progress aria-label="餐会进度" max="8" value="0">/);
  assert.match(html, /<strong>奶盖<\/strong>/);
  assert.match(html, /非主题菜结账额外 \+1 进度/);
  assert.match(html, /data-r-dismiss data-r-supper-return>回餐厅接单/);
  assert.doesNotMatch(html, /data-r-action="supper-start"|data-r-supper-slot|data-r-supper-theme="/);
  assert.equal(supperServiceFeedback(1, club), '餐会进度 0 / 8');

  const active = {...club.active, progress:3, signature:{...club.active.signature,collected:['pancake']}};
  const progressed = restaurantSupperPanel({...club, active});
  assert.match(progressed, /max="8" value="3"/);
  assert.match(progressed, /data-collected="true">[^<]*<span class="r-food r-food-pancake"/);
  assert.match(progressed, /1 \/ 2/);
  assert.doesNotMatch(restaurantSupperPanel({...club, active:{...active,signature:null}}), /招牌菜单/);
});

test('the receipt reports the credited total and its bonus exactly once and allows another supper', () => {
  const state = restaurant(50, 6, 38000);
  state.restaurant.stats.served = 12;
  state.restaurant.nextOrderId = 13;
  state.restaurant.supperClub = {completed:{mains:0,desserts:3,drinks:0},active:null,
    last:{themeId:'desserts',run:3,workerIds:['worker-5','worker-6'],reward:120}};
  const options = {draft:{themeId:'desserts'},coins:state.coins};
  const html = panel(state, options);
  assert.match(html, /已办 3 场/);
  assert.match(html, /主题偏好已解锁.*抽到甜点的权重 ×2/);
  assert.match(html, /午后甜点会已收席/);
  assert.match(html, /<b>\+120 <small>灵感/);
  assert.match(html, /data-r-supper-run="4"/);
  const club = restaurantInfo(state, now).supperClub;
  assert.equal(supperServiceFeedback(3, club), '餐会圆满 · 研发灵感 +120');
  const last = {...club.last, reward:143, signature:{completed:true,creditedBonus:23}};
  const withBonus = restaurantSupperPanel({...club,last}, options);
  assert.match(withBonus, /其中 23 灵感来自集菜/);
  assert.match(withBonus, /<b>\+143 <small>灵感/);
  assert.doesNotMatch(withBonus, /\+166 /);
});
