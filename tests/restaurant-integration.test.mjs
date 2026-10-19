import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ENTRIES, initialHomeState } from '../src/home-context.js';
import { scopedStorage } from '../src/home-storage.js';
import { createMemoryStorage } from '../demo/storage.js';
import { reduceAction, normalizeState } from '../src/state.js';
import { restaurantMarkup, restaurantRecipesPanel } from '../src/restaurant-ui.js';
import { restaurantInfo, RESTAURANT_RECIPES, RESTAURANT_NEW_RECIPE_IDS, RESTAURANT_RECIPE_CATEGORIES } from '../src/restaurant.js';
import { readFile } from 'node:fs/promises';

const now=Date.parse('2026-10-18T12:00:00Z'),actor={id:'client-restaurant',name:'店长'};

test('every registered real home resumes its own restaurant and pending queue without touching another home',()=>{
  const raw=createMemoryStorage(),homes=HOME_ENTRIES.filter(home=>!home.isTest);
  for(const [index,home] of homes.entries()){
    const storage=scopedStorage(raw,home),state=initialHomeState(home,now);
    const started=reduceAction({...state,coins:1200+index},{type:'restaurant-start',recipeId:index%2?'coffee':'rice'},actor,now);
    storage.setItem('catnest.state.room',JSON.stringify(started));
    storage.setItem('catnest.pending.couple.male',JSON.stringify([{operationId:`order-home-${index}`,action:{type:'restaurant-serve',orderId:'table-1'}}]));
  }
  for(const [index,home] of homes.entries()){
    const storage=scopedStorage(raw,home),restored=normalizeState(JSON.parse(storage.getItem('catnest.state.room')),now+1000);
    assert.equal(restored.coins,1200+index);
    assert.equal(restored.restaurant.orders.length,1);
    assert.equal(restored.restaurant.orders[0].recipeId,index%2?'coffee':'rice');
    assert.equal(JSON.parse(storage.getItem('catnest.pending.couple.male'))[0].operationId,`order-home-${index}`);
    const blank=initialHomeState(home,now);assert.equal(blank.restaurant.orders.length,0);
  }
  assert.equal(JSON.parse(raw.getItem('catnest.state.room')).coins,1200,'Steven retains its original unprefixed key');
  assert.equal(JSON.parse(raw.getItem('evian:catnest.state.room')).coins,1201,'Evian retains its existing namespace');
});

test('the recipe menu unifies ordinary and signature dishes and filters seven real dishes per category',()=>{
  const info=restaurantInfo(initialHomeState(HOME_ENTRIES[0],now),now),all=restaurantRecipesPanel(info);
  assert.equal((all.match(/data-r-dish=/g)||[]).length,21);
  assert.doesNotMatch(all,/r-recipe-new/);
  assert.ok(all.includes(`已收录 ${info.recipes.filter(recipe=>recipe.unlocked).length} / 21`));
  for(const category of RESTAURANT_RECIPE_CATEGORIES){
    const panel=restaurantRecipesPanel(info,{category});
    assert.equal((panel.match(/data-r-dish=/g)||[]).length,7);
    for(const recipe of [...info.recipes,...info.specialRecipes])assert.equal(panel.includes(`data-r-dish="${recipe.id}"`),recipe.category===category);
  }
});

test('each new dish ships its own image and a bounded atlas cell',async()=>{
  const root=new URL('../public/assets/restaurant/',import.meta.url);
  const metadata=JSON.parse(await readFile(new URL('sprites.json',root),'utf8'));
  assert.equal(Object.keys(metadata.foods).length,18);
  assert.deepEqual([metadata.foodExpansionAtlas.width,metadata.foodExpansionAtlas.height],[768,1024]);
  for(const id of RESTAURANT_NEW_RECIPE_IDS){
    const bytes=await readFile(new URL(`foods/${id}.webp`,root));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    const cell=metadata.foods[id];assert.equal(cell.atlas,'food-expansion-v1.webp');
    assert.ok(cell.x>=0&&cell.x+cell.width<=768&&cell.y>=0&&cell.y+cell.height<=1024);
  }
});

test('restaurant UI safely displays user names and resolves sprite URLs under the shared production base',t=>{
  const previous=globalThis.document;
  globalThis.document={baseURI:'https://example.test/cat-nest/'};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const markup=restaurantMarkup({...initialHomeState(HOME_ENTRIES[0],now),name:'<img onerror="x">'},{isTest:true});
  assert.ok(markup.includes('&lt;img onerror=&quot;x&quot;&gt;的小食光'));
  assert.ok(!markup.includes('<img onerror="x">'));
  assert.ok(markup.includes("url('https://example.test/cat-nest/assets/restaurant/cat-sprites.webp')"));
  assert.ok(markup.includes('src="https://example.test/cat-nest/assets/restaurant/restaurant-scene.webp"'));
});
