import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, FEEDING_WINDOW_MS } from '../src/state.js';
import { COUPLE_ROLES } from '../src/couple-profile.js';
import { feedingHome, feedingSheet, feedingButtonContent } from '../src/feeding-ui.js';

const now = Date.parse('2026-10-13T04:00:00Z');
const male = { id:COUPLE_ROLES[0].clientId, name:COUPLE_ROLES[0].name };
const female = { id:COUPLE_ROLES[1].clientId, name:COUPLE_ROLES[1].name };
const options = state => ({ state, clientId:male.id, selectedFood:'meal', now });

function summary(html) {
  return html.slice(0, html.indexOf('<section id="food-menu-panel"'));
}

test('the home empty dish describes menu selection without claiming it was served', () => {
  const html = feedingHome({ ...options(initialState(now)), selectedFood:'salmon' });
  assert.match(html, /还没开饭/);
  assert.match(html, /已选三文鱼块 · 尚未上桌/);
  assert.match(html, /home-food-dish meal-empty/);
  assert.doesNotMatch(html, /data-current-food=/);
  assert.doesNotMatch(html, /data-feed-until=/);
  assert.equal((html.match(/本轮未喂/g) || []).length, 2);
  assert.match(html, /<b>我<\/b>/);
  assert.match(html, /<b>对方<\/b>/);
});

test('home food and remaining timer follow the served record after choosing another food', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'fish' }, male, now);
  const html = feedingHome({ ...options(state), selectedFood:'water', now:now + 1000 });
  assert.match(html, /data-current-food="fish"/);
  assert.match(html, /<strong>鲜鱼罐罐<\/strong>/);
  assert.match(html, /正在享用 · <time data-feed-until="[0-9]+">03:59:59<\/time>/);
  assert.doesNotMatch(html, /清清饮水/);
  assert.match(html, /data-feeder="male"><b>我<\/b><span>✓ 本轮已喂/);
  assert.match(html, /data-feeder="female"><b>对方<\/b><span>本轮未喂/);
});

test('the newest active partner meal is shown regardless of saved record order or presence', () => {
  let state = reduceAction(initialState(now), { type:'feed', food:'fish' }, male, now);
  state = reduceAction(state, { type:'feed', food:'treat' }, female, now + 60_000);
  state.feedRecords.reverse();
  const html = feedingHome({ ...options(state), now:now + 120_000, members:[] });
  assert.match(html, /data-current-food="treat"/);
  assert.match(html, /<strong>猫咪肉条<\/strong>/);
  assert.match(html, /03:59:00/);
  assert.equal((html.match(/✓ 本轮已喂/g) || []).length, 2);
  const fromPartner = feedingHome({ ...options(state), clientId:female.id, now:now + 120_000 });
  assert.match(fromPartner, /data-feeder="female"><b>我<\/b>/);
});

test('expired food remains visible with an ended label and no running meal timer', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'chicken' }, male, now);
  const html = feedingHome({ ...options(state), selectedFood:'snack', now:now + FEEDING_WINDOW_MS });
  assert.match(html, /data-current-food="chicken"/);
  assert.match(html, /本餐已结束 · 等你添一份/);
  assert.match(html, /home-food-dish meal-ended/);
  assert.doesNotMatch(html, /data-feed-until=/);
  assert.doesNotMatch(html, /正在享用/);
});

test('the menu shows both feeding statuses before the cards without switching tabs', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'fish' }, male, now);
  const html = feedingSheet({ ...options(state), now:now + 1000 });
  assert.match(summary(html), /aria-label="本轮双人喂食状态"/);
  assert.match(summary(html), /data-feeder="male"><b>我<\/b><span>✓ 本轮已喂/);
  assert.match(summary(html), /data-feeder="female"><b>对方<\/b><span>本轮未喂/);
  assert.match(summary(html), /本轮剩余 <time data-feed-until="[0-9]+">03:59:59/);
  assert.equal((html.match(/data-food="/g) || []).length, 9);
  assert.match(html, /准备喂食 · 尚未上桌/);
  assert.match(html, /喂后点击爱心气泡，成长值才会入账/);
});

test('a still-active meal from the previous round is distinguished from feeding this round', () => {
  const state = initialState(now);
  state.feedRecords = [
    { actorId:male.id, name:male.name, food:'meal', at:now - 60_000 },
    { actorId:female.id, name:female.name, food:'water', at:now },
  ];
  state.feedingWindow = { startedAt:now, bonusClaimed:false };
  const html = feedingSheet(options(state));
  assert.match(summary(html), /data-feeder="male"><b>我<\/b><span>上餐未结束/);
  assert.match(summary(html), /data-feeder="female"><b>对方<\/b><span>✓ 本轮已喂/);
});

test('feeding stays disabled during a save or disconnection and does not promise immediate growth', () => {
  const base = options(initialState(now));
  assert.deepEqual(feedingButtonContent({ ...base, saving:true }), { disabled:true, content:'正在保存这份心意…' });
  assert.deepEqual(feedingButtonContent({ ...base, connected:false }), { disabled:true, content:'正在连接云端小窝…' });
  assert.deepEqual(feedingButtonContent(base), { disabled:false, content:'喂这个 <span>成长气泡 +25</span>' });
  assert.match(feedingSheet({ ...base, saving:true }), /id="serve-food" disabled/);
});
