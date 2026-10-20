import test from 'node:test';
import assert from 'node:assert/strict';
import { RESTAURANT_GROWTH_STAGES, restaurantGrowthStage, restaurantGrowthStageStyle } from '../src/restaurant-growth-stages.js';
import { applyRestaurantGrowthStage, restaurantStageStars } from '../src/restaurant-growth-stage-ui.js';
import { initialState } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantProgressionPanel, progressionEntryMarkup } from '../src/restaurant-progression-ui.js';

test('the fifty-level roadmap has five contiguous ten-level titles and distinct palettes',()=>{
  assert.deepEqual(RESTAURANT_GROWTH_STAGES.map(({min,max,title,stars})=>[min,max,title,stars]),[
    [1,10,'小馆',1],[11,20,'人气餐厅',2],[21,30,'星级餐厅',3],[31,40,'米其林餐厅',4],[41,50,'全球旗舰店',5],
  ]);
  for(const field of ['color','deep','edge','track','bar'])assert.equal(new Set(RESTAURANT_GROWTH_STAGES.map(stage=>stage[field])).size,5);
  for(const stage of RESTAURANT_GROWTH_STAGES){
    assert.ok(Object.isFrozen(stage));
    for(let level=stage.min;level<=stage.max;level++)assert.equal(restaurantGrowthStage(level),stage);
  }
});

test('invalid levels use the opening title and progress after level fifty retains the final title',()=>{
  for(const level of [undefined,null,NaN,Infinity,'21',0,-10])assert.equal(restaurantGrowthStage(level).id,'bistro');
  assert.equal(restaurantGrowthStage(10.99).id,'bistro');assert.equal(restaurantGrowthStage(11).id,'popular');
  for(const level of [50,51,1000,Number.MAX_SAFE_INTEGER])assert.equal(restaurantGrowthStage(level).id,'flagship');
});

test('compact stars retain an accessible rank and expanded stars show the full tier count',()=>{
  for(const stage of RESTAURANT_GROWTH_STAGES){
    const full=restaurantStageStars(stage.min),compact=restaurantStageStars(stage.min,{compact:true});
    assert.equal((full.match(/class="rg-star"/g)||[]).length,stage.stars);
    assert.equal((compact.match(/class="rg-star"/g)||[]).length,1);
    assert.ok(full.includes(`aria-label="${stage.stars}星${stage.title}"`));
    assert.ok(compact.includes(`<b aria-hidden="true">${stage.stars}</b>`));
  }
});

test('changing stages replaces each color variable without dropping unrelated element styles',()=>{
  const values=new Map([['width','96px']]),attributes=new Map();
  const element={style:{setProperty:(key,value)=>values.set(key,value)},setAttribute:(key,value)=>attributes.set(key,value)};
  for(const stage of RESTAURANT_GROWTH_STAGES){
    assert.equal(applyRestaurantGrowthStage(element,stage.min),stage);
    assert.equal(attributes.get('data-r-growth-stage'),stage.id);
    assert.equal(values.get('--rg-bar'),stage.bar);
    assert.equal(values.get('--rg-deep'),stage.deep);
    assert.equal(values.get('width'),'96px');
    assert.ok(restaurantGrowthStageStyle(stage.min).includes(`--rg-edge:${stage.edge}`));
  }
});

test('real XP thresholds select matching HUD, entry and roadmap titles without changing the saved ledger',()=>{
  const now=Date.parse('2026-10-18T12:00:00Z');
  for(const stage of RESTAURANT_GROWTH_STAGES){
    const state=initialState(now);state.restaurant.stats.experience=levelStartXp(stage.min);
    const saved=structuredClone(state),info=restaurantInfo(state,now),markup=restaurantProgressionPanel(info);
    assert.equal(restaurantGrowthStage(info.level),stage);
    const hero=markup.match(/<header class="rp-hero">[\s\S]*?<\/header>/)[0];
    assert.ok(hero.includes(`<strong>${stage.title}</strong>`));
    assert.equal((hero.match(/class="rg-star"/g)||[]).length,stage.stars);
    assert.ok(progressionEntryMarkup(info).includes(`${stage.title} · Lv.${stage.min}`));
    for(const chapter of RESTAURANT_GROWTH_STAGES){
      const section=markup.match(new RegExp(`<details class="rp-chapter[^>]*data-r-progression-range="${chapter.min}-${chapter.max}"[^>]*>[\\s\\S]*?<\\/summary>`))[0];
      assert.ok(section.includes(`data-r-growth-stage="${chapter.id}"`));
      assert.ok(section.includes(`<strong>${chapter.title}</strong>`));
      assert.equal((section.match(/class="rg-star"/g)||[]).length,chapter.stars);
    }
    assert.deepEqual(state,saved);
  }
});
