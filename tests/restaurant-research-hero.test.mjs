import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { createRestaurantResearchShowcase, restaurantResearchHero, restaurantResearchShortcut } from '../src/restaurant-research-hero.js';
import { restaurantResearchPanel } from '../src/restaurant-research-ui.js';
import { readFile } from 'node:fs/promises';

const NOW=Date.parse('2026-10-19T12:00:00Z');
test('each atelier visit randomizes representative recipes across all five preview grades without changing real grades or odds',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),before=structuredClone(info);
  const first=createRestaurantResearchShowcase(info,{random:()=>.1}),second=createRestaurantResearchShowcase(info,{random:()=>.8});
  assert.deepEqual(first.cards.map(card=>card.grade),['B','A','S','SS','SSS']);assert.equal(new Set(first.cards.map(card=>card.recipe.id)).size,5);
  assert.equal(first.dishes.length,10);assert.equal(new Set(first.dishes.map(recipe=>recipe.id)).size,10);
  assert.notDeepEqual(first.cards.map(card=>card.recipe.id),second.cards.map(card=>card.recipe.id));assert.notEqual(first.key,second.key);
  const once=restaurantResearchHero(info,first),again=restaurantResearchHero(info,first);
  assert.equal(once,again,'polling keeps the same card selection and session key');
  assert.equal((once.match(/class="rr-atelier-card /g)||[]).length,5);
  assert.equal((once.match(/class="rr-atelier-card-face rr-atelier-card-front"/g)||[]).length,5);
  assert.equal((once.match(/class="rr-atelier-card-face rr-atelier-card-back"/g)||[]).length,5);
  for(const grade of ['B','A','S','SS','SSS'])assert.match(once,new RegExp(`<b>${grade}</b>`));
  assert.equal((once.match(/class="rr-atelier-dish"/g)||[]).length,10);
  assert.equal((once.match(/class="rr-atelier-worker"/g)||[]).length,2);
  assert.match(once,/data-r-atelier-corner="left"/);assert.match(once,/data-r-atelier-corner="right"/);
  assert.match(once,/B–SSS 研发品质预览/);assert.match(once,/data-r-action="research-draw" data-r-draw="1"/);
  assert.deepEqual(info,before);
});
test('the shortcut reaches the research panel, and the real draw is still blocked without inspiration',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),showcase=createRestaurantResearchShowcase(info,{random:()=>.4});
  assert.match(restaurantResearchShortcut(),/data-r-tab="research"/);assert.match(restaurantResearchShortcut(),/data-r-research-count hidden/);
  info.research.availableDraws=0;
  const html=restaurantResearchPanel(info,{showcase});assert.match(html,/data-r-action="research-draw" data-r-draw="1" disabled/);
  assert.match(html,/碎片规则与概率/);assert.match(html,/碎片融合规则/);assert.match(html,/碎片手账/);
});
test('the atelier ships its generated raster background and supports reduced motion',async()=>{
  const bytes=await readFile(new URL('../public/assets/restaurant/research-v2/atelier.jpg',import.meta.url));assert.equal(bytes[0],255);assert.equal(bytes[1],216);
  const css=await readFile(new URL('../src/restaurant-research-hero.css',import.meta.url),'utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/preserve-3d/);
  const effects=await readFile(new URL('../src/restaurant-research-lottery.css',import.meta.url),'utf8');assert.match(effects,/prefers-reduced-motion/);assert.match(effects,/rr-energy-collapse/);assert.match(effects,/rr-lottery-flash/);
});

test('a queued discovery disables only another draw and lets the player leave the research room',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),before=structuredClone(info);
  const html=restaurantResearchPanel(info,{pendingDraw:info.research.nextDraw});
  assert.match(html,/data-r-action="research-draw" data-r-draw="1" disabled/);
  assert.match(html,/探索已排队/);assert.match(html,/可先去经营/);
  assert.match(html,/data-r-tab="recipes"/);assert.deepEqual(info,before);
});
