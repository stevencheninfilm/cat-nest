import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoEngine, DEMO_ACTORS, DEMO_ROOM } from '../demo/engine.js';
import { createMemoryStorage } from '../demo/storage.js';
import { RESTAURANT_DECORATIONS } from '../src/restaurant-decor.js';
import { RESTAURANT_THEMES, restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { PREMIUM_RESTAURANT_THEMES } from '../src/restaurant-economy.js';
import { createHomeRuntime } from '../src/app-runtime.js';
import { HOME_ENTRIES } from '../src/home-context.js';
import { levelStartXp } from '../src/growth-levels.js';
import { restaurantResourceLevel } from '../src/restaurant-progression.js';
const NOW=Date.parse('2026-10-18T12:00:00Z');
const suiteIds=()=>RESTAURANT_DECORATIONS.map(suite=>suite.id).sort();
const themeIds=()=>[...new Set([...RESTAURANT_THEMES,...PREMIUM_RESTAURANT_THEMES].map(theme=>theme.id))].sort();
const setup=({level=1,coins=100}={})=>{
  const storage=createMemoryStorage();let clock=NOW,engine=createDemoEngine({storage,now:()=>clock});
  if(level>1||coins!==100){const record=JSON.parse(storage.getItem('server'));record.state.restaurant.stats.experience=levelStartXp(level);record.state.coins=coins;storage.setItem('server',JSON.stringify(record));engine=createDemoEngine({storage,now:()=>clock});}
  return {storage,engine,advance(ms){clock+=ms;}};
};
const action=(engine,item,id='decor-demo-order')=>engine.action({operationId:id,clientId:DEMO_ACTORS.male.id,action:item});
function withoutOwnership(state){const result=structuredClone(state);delete result.restaurant.ownedDecorations;delete result.restaurant.ownedCirclePalettes;delete result.restaurant.ownedThemes;return result;}

test('dedicated test unlock discovers every catalog suite and base or premium theme without altering gameplay',()=>{
  const {engine}=setup(),before=engine.snapshot();
  const text=engine.scenario('restaurant-decorations'),after=engine.snapshot();
  assert.match(text,/施工队/);assert.equal(after.roomId,DEMO_ROOM);assert.equal(after.revision,before.revision+1);
  assert.deepEqual([...after.state.restaurant.ownedDecorations].sort(),suiteIds());assert.deepEqual([...after.state.restaurant.ownedThemes].sort(),themeIds());
  assert.deepEqual(withoutOwnership(after.state),withoutOwnership(before.state));
  assert.equal(after.state.coins,before.state.coins);assert.equal(after.state.xp,before.state.xp);assert.equal(after.state.goldFish,before.state.goldFish);
  assert.equal(after.state.restaurant.decorationId,undefined);assert.equal(after.state.restaurant.construction,undefined);
  assert.equal(validRestaurant(after.state.restaurant),true);
});

test('repeated test unlock is idempotent for ownership, wallet, current scene and active orders',()=>{
  const {engine}=setup();
  assert.equal(action(engine,{type:'restaurant-start',recipeId:'rice'}).status,200);
  engine.scenario('restaurant-decorations');const before=engine.snapshot();
  engine.scenario('restaurant-decorations');const after=engine.snapshot();
  assert.deepEqual(after.state,before.state);assert.equal(after.roomId,before.roomId);
  assert.equal(after.state.restaurant.orders.length,1);assert.equal(after.state.restaurant.orders[0].workflow.workerId,'worker-1');
  assert.equal(new Set(after.state.restaurant.ownedDecorations).size,after.state.restaurant.ownedDecorations.length);
});

test('unlock during construction preserves both workers, the full clock and accepted order snapshots',()=>{
  const {engine,advance}=setup({level:restaurantResourceLevel('decoration','mint-greenhouse'),coins:1200});
  assert.equal(action(engine,{type:'restaurant-decoration',decorationId:'mint-greenhouse'},'decor-demo-build').status,200);
  assert.equal(action(engine,{type:'restaurant-start',recipeId:'sandwich'},'decor-demo-active').status,200);
  advance(3000);const before=engine.snapshot(),job=before.state.restaurant.construction;
  engine.scenario('restaurant-decorations');const after=engine.snapshot();
  assert.deepEqual(withoutOwnership(after.state),withoutOwnership(before.state));
  assert.deepEqual(after.state.restaurant.construction,job);assert.equal(after.state.restaurant.theme,'cream');
  const projection=restaurantInfo(after.state,NOW+3000).decorationInfo;
  assert.equal(projection.construction.phase,'build');assert.equal(projection.construction.workers.length,2);assert.equal(projection.activeDecorationId,null);
  const result=action(engine,{type:'restaurant-decoration',decorationId:'sakura-evening'},'decor-demo-overlap');assert.equal(result.status,409);
  advance(9000);assert.equal(engine.snapshot().state.restaurant.decorationId,'mint-greenhouse');assert.equal(engine.snapshot().state.restaurant.construction,null);
});

test('an unlocked suite still uses the normal twelve-second construction instead of immediate equipment',()=>{
  const {engine,advance}=setup();engine.scenario('restaurant-decorations');
  const before=engine.snapshot().state;
  assert.equal(restaurantInfo(before,NOW).level,1,'owned test suites remain installable below their original purchase level');
  const response=action(engine,{type:'restaurant-decoration',decorationId:'sakura-evening'},'decor-demo-owned');
  assert.equal(response.status,200);assert.equal(response.data.state.coins,before.coins);assert.equal(response.data.state.restaurant.decorationId,undefined);
  assert.equal(response.data.state.restaurant.construction.finishAt,NOW+12000);
  advance(6999);assert.equal(engine.snapshot().state.restaurant.theme,'cream');
  advance(1);assert.equal(engine.snapshot().state.restaurant.decorationId,'sakura-evening');
  advance(5000);assert.equal(engine.snapshot().state.restaurant.construction,null);
});

test('general unlock includes restaurant catalog while preserving running restaurant work',()=>{
  const {engine}=setup();action(engine,{type:'restaurant-start',recipeId:'rice'});
  const before=engine.snapshot().state.restaurant;
  engine.scenario('unlock');const state=engine.snapshot().state;
  assert.deepEqual([...state.restaurant.ownedDecorations].sort(),suiteIds());assert.deepEqual([...state.restaurant.ownedThemes].sort(),themeIds());
  assert.deepEqual(state.restaurant.orders,before.orders);assert.deepEqual(state.restaurant.parties,before.parties);assert.deepEqual(state.restaurant.staffTraining,before.staffTraining);
  assert.equal(state.restaurant.decorationId,undefined);assert.equal(state.restaurant.construction,undefined);
});

test('test unlock affects only the ephemeral test adapter, preserving every real home cache and pending queue',()=>{
  const raw=createMemoryStorage(),sessions=createMemoryStorage(),{engine,storage}=setup();
  for(const home of HOME_ENTRIES.filter(home=>!home.isTest)) {
    raw.setItem(`${home.storagePrefix}catnest.role`,JSON.stringify('female'));
    raw.setItem(`${home.storagePrefix}catnest.state`,JSON.stringify({coins:501,home:home.id}));
    raw.setItem(`${home.storagePrefix}catnest.pending.couple.female`,JSON.stringify([{operationId:`pending-${home.id}`,action:{type:'restaurant-start',recipeId:'rice'}}]));
  }
  const saved=HOME_ENTRIES.filter(home=>!home.isTest).map(home=>({home,role:raw.getItem(`${home.storagePrefix}catnest.role`),state:raw.getItem(`${home.storagePrefix}catnest.state`),pending:raw.getItem(`${home.storagePrefix}catnest.pending.couple.female`)}));
  const runtime=createHomeRuntime({home:HOME_ENTRIES.find(home=>home.isTest),localStorage:raw,sessionStorage:sessions,testAdapter:{apiBase:'https://demo.invalid',fetch:()=>{},eventSourceFactory:()=>{},localStorage:storage,sessionStorage:createMemoryStorage(),actions:{unlockRestaurantDecorations:()=>engine.scenario('restaurant-decorations')}}});
  runtime.testActions.unlockRestaurantDecorations();assert.equal(engine.snapshot().state.restaurant.ownedDecorations.length,RESTAURANT_DECORATIONS.length);
  for(const entry of saved){const normal=createHomeRuntime({home:entry.home,localStorage:raw,sessionStorage:sessions});assert.equal(normal.testActions,null);assert.equal(normal.localStorage.getItem('catnest.role'),entry.role);assert.equal(normal.localStorage.getItem('catnest.state'),entry.state);assert.equal(normal.localStorage.getItem('catnest.pending.couple.female'),entry.pending);assert.throws(()=>createHomeRuntime({home:entry.home,testAdapter:{}}),/正式存档不能使用测试接口/);}
  assert.equal(raw.getItem('server'),null);
  const fresh=createDemoEngine({storage:createMemoryStorage(),now:()=>NOW});assert.equal(fresh.snapshot().state.restaurant.ownedDecorations,undefined,'refreshing the test visit restores the original locked catalog');
});

test('entry adapter and global console expose the dedicated test-only unlock command',async()=>{
  const [entry,controls]=await Promise.all([readFile(new URL('../src/entry.js',import.meta.url),'utf8'),readFile(new URL('../demo/controls.js',import.meta.url),'utf8')]);
  assert.match(entry,/if\(home\.isTest\)\s*\{[\s\S]*unlockRestaurantDecorations:\(\)=>transport\.demoEngine\.scenario\('restaurant-decorations'\)/);
  assert.match(controls,/<button data-demo="restaurant-decorations">解锁全部餐厅装扮<\/button>/);
});
