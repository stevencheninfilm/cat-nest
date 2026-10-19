import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { RESTAURANT_DECORATIONS } from '../src/restaurant-decor.js';
import { restaurantDecorationsPanel, constructionWorkerMotion, decorationSceneMarkup, decorationBuffLabels, createRestaurantDecorationScene } from '../src/restaurant-decor-ui.js';
import { restaurantTerminalPanel } from '../src/restaurant-guests-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'decor-ui',name:'店长'};
test('the decoration completion cue fires once after the job finishes, never just from loading a finished scene',t=>{
  const before={Image:globalThis.Image,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,now:Date.now};
  let now=NOW;
  globalThis.Image=class{};globalThis.document={baseURI:'http://127.0.0.1:5174/cat-nest/test/'};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};Date.now=()=>now;
  t.after(()=>{Date.now=before.now;for(const key of ['Image','document','requestAnimationFrame','cancelAnimationFrame']){if(before[key]===undefined)delete globalThis[key];else globalThis[key]=before[key];}});
  const style={setProperty(){}},classList={toggle(){},add(){},remove(){}},root={dataset:{},classList},nodes={'.r-scene-art':{src:'',alt:''},'[data-r-decor-props]':{children:[],innerHTML:''},'[data-r-construction]':{hidden:true},'[data-r-decor-status]':{classList,querySelector:()=>({style})}};
  const container={closest:()=>root,querySelector:selector=>nodes[selector],querySelectorAll:()=>[]};
  const completed=[],scene=createRestaurantDecorationScene({container,onComplete:suite=>completed.push(suite.id)});
  const state=reduceAction(initialState(NOW),{type:'restaurant-decoration',decorationId:'cream-bakery'},actor,NOW);
  scene.open();scene.sync(restaurantInfo(state,now));now+=7000;scene.sync(restaurantInfo(state,now));assert.deepEqual(completed,[],'installation is still in progress');
  now=NOW+12000;scene.sync(restaurantInfo(state,now));assert.deepEqual(completed,['cream-bakery']);
  for(let i=0;i<5;i++)scene.sync(restaurantInfo(state,now+i*400));scene.close();scene.open();assert.deepEqual(completed,['cream-bakery']);scene.destroy();
  const reloaded=createRestaurantDecorationScene({container,onComplete:suite=>completed.push(suite.id)});reloaded.open();reloaded.sync(restaurantInfo(state,now));assert.deepEqual(completed,['cream-bakery']);reloaded.destroy();
});
test('six independently illustrated suites show their own price and capped bonuses without silently equipping the legacy default',()=>{
  const state=initialState(NOW),before=structuredClone(state),markup=restaurantDecorationsPanel(restaurantInfo(state,NOW));
  assert.equal((markup.match(/data-r-decoration-card=/g)||[]).length,6);
  for(const suite of RESTAURANT_DECORATIONS){assert.ok(markup.includes(`${suite.id}/scene.webp`));assert.ok(markup.includes(`data-r-decoration="${suite.id}"`));for(const label of decorationBuffLabels(suite.buffs))assert.ok(markup.includes(label));}
  const defaultButton=markup.match(/<button[^>]*data-r-decoration="cream-bakery"[^>]*>/)[0];
  assert.doesNotMatch(defaultButton,/disabled/);assert.match(defaultButton,/免费布置/);
  assert.deepEqual(state,before);
});
test('in-progress construction locks every suite card and equipment becomes visible only at installation',()=>{
  let state=initialState(NOW);state.coins=1000;state.restaurant.ownedDecorations=['mint-seaside'];state.restaurant.ownedThemes.push('mint');
  state=reduceAction(state,{type:'restaurant-decoration',decorationId:'mint-seaside'},actor,NOW);
  const markup=restaurantDecorationsPanel(restaurantInfo(state,NOW+3000));
  assert.match(markup,/海盐假日」 · 9 秒/);
  assert.equal((markup.match(/data-r-decoration="[a-z-]+"[^>]* disabled/g)||[]).length,6);
  assert.equal(restaurantInfo(state,NOW+6999).decorationInfo.activeDecorationId,null);
  assert.equal(restaurantInfo(state,NOW+7000).decorationInfo.activeDecorationId,'mint-seaside');
});
test('two construction cats follow continuous feet paths through all phase boundaries and finish at the doorway',()=>{
  const job={startedAt:NOW};
  for(let worker=0;worker<2;worker++){
    let previous=constructionWorkerMotion(job,worker,NOW);
    for(let elapsed=16;elapsed<=12000;elapsed+=16){const current=constructionWorkerMotion(job,worker,NOW+elapsed);assert.ok(Math.hypot(current.x-previous.x,current.y-previous.y)<2,`worker ${worker}, ${elapsed}`);assert.ok(current.x>=12&&current.x<=91&&current.y>=20&&current.y<=78);previous=current;}
    assert.equal(constructionWorkerMotion(job,worker,NOW+12000).opacity,0);
    assert.equal(constructionWorkerMotion(job,worker,NOW+2000).building,true);
    assert.equal(constructionWorkerMotion(job,worker,NOW+11000).back,true);
  }
  assert.deepEqual([0,1].map(i=>{const m=constructionWorkerMotion(job,i,NOW+3000);return[m.x,m.y];}),[[18,26],[80,78]]);
  assert.equal(constructionWorkerMotion(job,0,NOW+8000).x,84);
  assert.equal((decorationSceneMarkup().match(/data-r-builder=/g)||[]).length,2);
});
test('the test-only terminal exposes catalog unlock only when the adapter explicitly supplies it',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),icon=()=>'';
  assert.ok(!restaurantTerminalPanel(info,{icon}).includes('data-r-debug-unlock-decor'));
  assert.match(restaurantTerminalPanel(info,{icon,unlockDecorations:true}),new RegExp(`解锁全部装扮 · ${RESTAURANT_DECORATIONS.length} 套`));
});
test('every suite ships a full WebP scene plus three transparent props, and both builders have front and back frames',async()=>{
  const root=new URL('../public/assets/restaurant/decor/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.deepEqual(Object.keys(manifest.sets).sort(),RESTAURANT_DECORATIONS.map(s=>s.id).sort());
  for(const suite of RESTAURANT_DECORATIONS){const entry=manifest.sets[suite.id],scene=await readFile(new URL(entry.scene,root));assert.equal(scene.toString('ascii',8,12),'WEBP');assert.ok(scene.length>100000);assert.equal(entry.props.length,3);for(const prop of entry.props){const bytes=await readFile(new URL(`${suite.id}/${prop.file}`,root));assert.equal(bytes.toString('ascii',12,16),'VP8X');assert.ok(bytes[20]&0x10,'prop has an alpha channel');}}
  for(const id of ['builder-orange','builder-orange-back','builder-gray','builder-gray-back']){const bytes=await readFile(new URL(manifest.crew[id].file,root));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes[20]&0x10);}
});
