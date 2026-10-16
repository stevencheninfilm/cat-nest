import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, FEEDING_WINDOW_MS, foodCooldownMs } from '../src/state.js';
import { COUPLE_ROLES } from '../src/couple-profile.js';
import { feedingHome, feedingSheet, feedingButtonContent } from '../src/feeding-ui.js';

const now = Date.parse('2026-10-13T04:00:00Z');
const male = { id:COUPLE_ROLES[0].clientId, name:COUPLE_ROLES[0].name };
const female = { id:COUPLE_ROLES[1].clientId, name:COUPLE_ROLES[1].name };
const options = state => ({ state, clientId:male.id, selectedFood:'meal', now });

function summary(html) {
  return html.slice(0, html.indexOf('<section id="food-menu-panel"'));
}
function homeSlot(html, role) {
  const start = html.indexOf(`data-feeder="${role}"`);
  assert.notEqual(start, -1);
  const end = html.indexOf('data-feeder=', start + 1);
  return html.slice(start, end < 0 ? html.length : end);
}

test('the home empty plate never shows a selected menu food as a served meal', () => {
  const html = feedingHome({ ...options(initialState(now)), selectedFood:'salmon' });
  assert.doesNotMatch(html, /home-empty-serving|home-meal-owner|等你投喂/);
  assert.doesNotMatch(html, /三文鱼块/);
  assert.doesNotMatch(html, /data-current-food=/);
  assert.doesNotMatch(html, /data-feed-until=/);
  assert.match(homeSlot(html, 'male'), /aria-label="男方：还没上桌，我"/);
  assert.match(homeSlot(html, 'female'), /aria-label="女方：还没上桌"/);
  assert.doesNotMatch(html, /home-feeding-pair|home-feeder-status/);
});

test('home food and remaining timer follow the served record after choosing another food', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'fish' }, male, now);
  const html = feedingHome({ ...options(state), selectedFood:'water', now:now + 1000 });
  assert.match(html, /data-current-food="fish"/);
  assert.match(homeSlot(html, 'male'), /aria-label="男方：鲜鱼罐罐，✓ 本轮已喂，本餐剩余 03:59:59，我"/);
  assert.match(html, /<time aria-label="男方本餐剩余" data-feed-until="[0-9]+">03:59:59<\/time>/);
  assert.doesNotMatch(html, /清清饮水/);
  assert.doesNotMatch(homeSlot(html, 'female'), /data-current-food=|data-feed-until=/);
});

test('each partner keeps their own serving and timer regardless of record order or viewer', () => {
  let state = reduceAction(initialState(now), { type:'feed', food:'water' }, male, now);
  state = reduceAction(state, { type:'feed', food:'mousse' }, female, now + 60_000);
  state.feedRecords.reverse();
  const html = feedingHome({ ...options(state), now:now + 120_000, members:[] });
  assert.match(homeSlot(html, 'male'), /data-current-food="water"/);
  assert.match(homeSlot(html, 'female'), /data-current-food="mousse"/);
  assert.match(homeSlot(html, 'male'), /data-feed-until="[0-9]+">00:28:00/);
  assert.match(homeSlot(html, 'female'), /data-feed-until="[0-9]+">02:59:00/);
  const fromPartner = feedingHome({ ...options(state), clientId:female.id, now:now + 120_000 });
  assert.match(homeSlot(fromPartner, 'male'), /data-current-food="water"/);
  assert.match(homeSlot(fromPartner, 'female'), /data-current-food="mousse"/);
  assert.match(homeSlot(fromPartner, 'female'), /02:59:00，我"/);
  assert.ok(fromPartner.indexOf('data-feeder="male"') < fromPartner.indexOf('data-feeder="female"'));
  const oneExpired = feedingHome({ ...options(state), now:now + foodCooldownMs('mousse') });
  assert.doesNotMatch(homeSlot(oneExpired, 'male'), /data-current-food=|data-feed-until=/);
  assert.match(homeSlot(oneExpired, 'female'), /data-current-food="mousse"/);
  assert.match(homeSlot(oneExpired, 'female'), /data-feed-until="[0-9]+">00:01:00/);
});

test('an eaten serving clears its food and timer while retaining the end status', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'chicken' }, male, now);
  const html = feedingHome({ ...options(state), selectedFood:'snack', now:now + FEEDING_WINDOW_MS });
  assert.match(homeSlot(html, 'male'), /本餐已结束/);
  assert.doesNotMatch(html, /home-empty-serving|home-meal-owner|已吃完/);
  assert.doesNotMatch(html, /data-current-food=/);
  assert.doesNotMatch(html, /data-feed-until=/);
  assert.doesNotMatch(html, /正在享用/);
});

test('the menu shows both feeding statuses before the cards without switching tabs', () => {
  const state = reduceAction(initialState(now), { type:'feed', food:'fish' }, male, now);
  const html = feedingSheet({ ...options(state), now:now + 1000 });
  assert.match(summary(html), /aria-label="本轮双人喂食状态"/);
  assert.match(summary(html), /data-feeder="male"><b>我<\/b><span>✓ 本轮已喂/);
  assert.match(summary(html), /data-feeder="female"><b>对方<\/b><span>本轮未喂/);
  assert.match(summary(html), /双人窗口剩余 <time data-feed-until="[0-9]+">03:59:59/);
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
  const home = feedingHome(options(state));
  assert.match(homeSlot(home, 'male'), /上餐未结束/);
  assert.match(homeSlot(home, 'male'), /data-current-food="meal"/);
  assert.match(homeSlot(home, 'female'), /data-current-food="water"/);
  assert.match(homeSlot(home, 'female'), /✓ 本轮已喂/);
});

test('feeding stays disabled during a save or disconnection and does not promise immediate growth', () => {
  const base = options(initialState(now));
  assert.deepEqual(feedingButtonContent({ ...base, saving:true }), { disabled:true, content:'正在保存这份心意…' });
  assert.deepEqual(feedingButtonContent({ ...base, connected:false }), { disabled:true, content:'正在连接云端小窝…' });
  assert.deepEqual(feedingButtonContent(base), { disabled:false, content:'喂这个 <span>成长气泡 +27.5</span>' });
  assert.match(feedingSheet({ ...base, saving:true }), /id="serve-food" disabled/);
});


test('food forecasts include each eligible need and expire with the shared decay clock', () => {
  const state={...initialState(now),hunger:81,mood:81,energy:81};
  assert.match(feedingButtonContent({...options(state)}).content,/成长气泡 \+32.5/);
  assert.match(feedingSheet(options(state)),/已含状态 ×1.3 加成/);
  assert.match(feedingSheet(options(state)),/营养猫粮，成长气泡加32.5/);
  assert.match(feedingButtonContent({...options(state),now:now+60*60_000}).content,/成长气泡 \+25/);
  assert.match(feedingSheet({...options(state),now:now+60*60_000}),/当前基础成长 ×1.0/);
});

test('the selected meal and drinking water explain their energy recovery without promising the new bonus early', () => {
  const state={...initialState(now),hunger:100,mood:100,energy:76};
  for(const [selectedFood,energy,amount] of [['meal',8,30],['water',10,6]]) {
    const opts={...options(state),selectedFood};
    const html=feedingSheet(opts);
    assert.match(html,new RegExp(`class="dish-time">活力 \\+${energy} · 冷却`));
    assert.match(html,new RegExp(`data-food="${selectedFood}"[^>]*活力加${energy}`));
    assert.match(feedingButtonContent(opts).content,new RegExp(`成长气泡 \\+${amount}<`));
    assert.match(html,/已含状态 ×1.2 加成/);
  }
});
