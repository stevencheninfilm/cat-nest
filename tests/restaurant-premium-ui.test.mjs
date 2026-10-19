import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, reduceAction, levelStartXp } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { goldWalletMarkup, restaurantTrainingPanel, restaurantGoldPanel, premiumThemesMarkup } from '../src/restaurant-economy-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'premium-ui-test',name:'店长'};
test('the gold entry explains only silver and gold diner rewards without changing the save',()=>{
  const state=initialState(NOW),before=structuredClone(state),info=restaurantInfo(state,NOW);
  state.goldFish=7;before.goldFish=7;
  assert.match(goldWalletMarkup(state.goldFish),/aria-label="金鱼干 7/);
  const markup=restaurantGoldPanel(info,state);
  assert.match(markup,/仅银级、金级顾客完成两餐后掉落/);assert.match(markup,/银级猫友<strong>\+1 金鱼干/);assert.match(markup,/金级猫友<strong>\+2 金鱼干/);assert.doesNotMatch(markup,/普通料理每结账|特殊料理每道|金鱼干 \+1|re-milestone-track/);
  assert.equal((markup.match(/data-r-action="unlock-special"/g)||[]).length,5);
  for(const recipe of info.specialRecipes)assert.ok(markup.includes(`Lv.${recipe.unlockLevel} 解锁`));
  assert.deepEqual(state,before);
});
test('training shows only hired workers, exact current levels and the correct wallet at the gold boundary',()=>{
  let state=initialState(NOW);state.coins=5000;state.goldFish=20;state.restaurant.stats.experience=levelStartXp(50);
  for(let i=0;i<6;i++)state=reduceAction(state,{type:'restaurant-train',workerId:'worker-1',statId:'speed'},actor,NOW);
  let markup=restaurantTrainingPanel(restaurantInfo(state,NOW),{now:NOW});
  assert.equal((markup.match(/data-r-training-worker=/g)||[]).length,1);
  assert.equal((markup.match(/data-r-action="train"/g)||[]).length,4);
  assert.match(markup,/data-r-ability="speed"[\s\S]*?Lv.7/);
  assert.match(markup,/aria-label="2 金鱼干"/);assert.match(markup,/升至 8 级/);
  assert.ok(!markup.includes('data-r-worker="worker-2"'));
  state=reduceAction(state,{type:'restaurant-hire'},actor,NOW);
  markup=restaurantTrainingPanel(restaurantInfo(state,NOW),{workerId:'worker-2',now:NOW});
  assert.equal((markup.match(/data-r-training-worker=/g)||[]).length,2);
  assert.match(markup,/小黑的体力/);assert.match(markup,/data-r-worker="worker-2" data-r-stat="skill"/);
  assert.match(markup,/员工体力储备/);
});
test('training separates the resident chef from the six recruited partners without extra or duplicate workers',()=>{
  const state=initialState(NOW);state.restaurant.staff=6;
  const before=structuredClone(state),markup=restaurantTrainingPanel(restaurantInfo(state,NOW),{workerId:'worker-4',now:NOW});
  const chief=markup.match(/aria-label="选择主厨">([\s\S]*?)<\/div>/)[1];
  const partners=markup.match(/aria-label="选择伙伴">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual([...chief.matchAll(/data-r-training-worker="([^"]+)"/g)].map(match=>match[1]),['worker-1']);
  assert.deepEqual([...partners.matchAll(/data-r-training-worker="([^"]+)"/g)].map(match=>match[1]),['worker-2','worker-3','worker-4','worker-5','worker-6','worker-7']);
  assert.match(markup,/<strong>伙伴<\/strong><span>6 \/ 6<\/span>/);
  assert.match(partners,/r-cat-staff-sesame/);assert.match(markup,/芝麻的体力/);
  assert.match(markup,/data-r-worker="worker-4" data-r-stat="speed"/);
  assert.deepEqual(state,before);
});
test('owned specials retain research without choosing customer orders; owned decorations switch freely',()=>{
  const state=initialState(NOW);state.goldFish=40;state.restaurant.stats.experience=levelStartXp(50);
  const unlocked=reduceAction(state,{type:'restaurant-unlock-special',recipeId:'gold-salmon'},actor,NOW);
  const themed=reduceAction(unlocked,{type:'restaurant-theme',themeId:'starlight'},actor,NOW);
  const info=restaurantInfo(themed,NOW),gold=restaurantGoldPanel(info,themed),themes=premiumThemesMarkup(info);
  assert.ok(!gold.includes('data-r-action="start"'));assert.ok(gold.includes('data-r-recipe-detail="gold-salmon"'));
  assert.ok(!gold.includes('data-r-action="unlock-special" data-r-recipe="gold-salmon"'));
  assert.match(themes,/theme-starlight selected[^>]*data-r-theme-active="true"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(themes,/已摆放 · 收起|<small>摆放<\/small>/);
  assert.ok(themes.includes('樱花琉璃窗'));assert.ok(themes.includes('皇家猫爪招牌'));
  assert.equal(themed.goldFish,4);
});
test('the shipped premium art is independently transparent and every UI asset has a manifest entry',async()=>{
  const root=new URL('../public/assets/restaurant/gold-v1/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.ok(manifest);
  for(const id of ['gold-fish','special-salmon','special-sundae','special-latte','theme-starlight','theme-glass','theme-royal']){
    const bytes=await readFile(new URL(`${id}.webp`,root));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(JSON.stringify(manifest).includes(`${id}.webp`));
  }
});
test('skill upgrades change only future detailed dish quality and cannot reprice a previously accepted order',()=>{
  let state=initialState(NOW);state.coins=50000;state.goldFish=100;state.restaurant.stats.experience=levelStartXp(50);
  state=reduceAction(state,{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  const old=restaurantInfo(state,NOW).orders[0];assert.equal(old.rewardCoins,24);
  for(let i=0;i<9;i++)state=reduceAction(state,{type:'restaurant-train',workerId:'worker-1',statId:'skill'},actor,NOW);
  state=reduceAction(state,{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  const info=restaurantInfo(state,NOW);
  assert.equal(info.orders[0].rewardCoins,24);assert.equal(info.orders[1].rewardCoins,27);
  assert.equal(info.orders[1].workflow.workerLevels.skill,10);
});
