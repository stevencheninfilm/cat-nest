import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialState,reduceAction,normalizeState} from '../src/state.js';
import {restaurantInfo} from '../src/restaurant.js';
import {RESTAURANT_DECORATIONS} from '../src/restaurant-decor.js';
import {PREMIUM_RESTAURANT_THEMES,PREMIUM_SCENE_PATCHES,premiumDecorationArt} from '../src/restaurant-premium-decorations.js';
import {premiumThemesMarkup,paintPremiumScene} from '../src/restaurant-economy-ui.js';
import {createRestaurantDecorationScene} from '../src/restaurant-decor-ui.js';
const NOW=Date.parse('2026-10-19T12:00:00Z'),actor={id:'themed-decor',name:'店长'};
const ids=PREMIUM_RESTAURANT_THEMES.map(item=>item.id);

test('all nine pieces immediately show, hide and change their art with each room, without changing the save',()=>{
  let room='cream-bakery';const props=ids.map(id=>({dataset:{rPremiumProp:id},style:{display:'none'},src:''}));
  const layer={dataset:{},querySelectorAll:()=>props},root={querySelector:selector=>selector==='.re-decor-layer'?layer:selector==='.r-scene-art'?{getAttribute:()=>`/assets/restaurant/decor/${room}/scene.webp`}:null};
  const restaurant={equippedPremiumDecorations:[...ids]},before=structuredClone(restaurant);
  for(const suite of RESTAURANT_DECORATIONS){
    room=suite.id;paintPremiumScene(root,restaurant);
    for(const prop of props){assert.equal(prop.style.display,'block');assert.equal(prop.dataset.sceneStyle,room);assert.ok(prop.src.endsWith(premiumDecorationArt(prop.dataset.rPremiumProp,room,{integrated:true})));}
    for(const id of ids){paintPremiumScene(root,{equippedPremiumDecorations:ids.filter(other=>other!==id)});assert.equal(props.find(p=>p.dataset.rPremiumProp===id).style.display,'none');assert.equal(props.filter(p=>p.style.display==='block').length,8);paintPremiumScene(root,restaurant);assert.equal(props.find(p=>p.dataset.rPremiumProp===id).style.display,'block');}
  }
  assert.deepEqual(restaurant,before);
  assert.equal(premiumDecorationArt('unknown','cream-bakery'),null);
  assert.equal(premiumDecorationArt('moonclock','../../bad'),premiumDecorationArt('moonclock'));
});

test('changing any of the six owned scenes retains every selected piece and uses the same style in its cards',()=>{
  let state=initialState(NOW);state.restaurant.ownedThemes=['cream','mint','sakura',...ids];state.restaurant.ownedDecorations=RESTAURANT_DECORATIONS.map(s=>s.id);state.restaurant.equippedPremiumDecorations=[...ids];
  const coins=state.coins,gold=state.goldFish,xp=state.xp;
  for(const [index,suite] of RESTAURANT_DECORATIONS.entries()){
    const start=NOW+index*13000;state=reduceAction(state,{type:'restaurant-decoration',decorationId:suite.id},actor,start);assert.ok(state);
    state=normalizeState(state,start+12000);assert.deepEqual(state.restaurant.equippedPremiumDecorations,ids);assert.equal(state.coins,coins);assert.equal(state.goldFish,gold);assert.equal(state.xp,xp);
    const markup=premiumThemesMarkup(restaurantInfo(state,start+12000));
    for(const id of ids)assert.ok(markup.includes(premiumDecorationArt(id,suite.id)));
  }
});

test('a room image change notifies the decoration layer in the same update',()=>{
  const root={dataset:{},classList:{toggle(){}}},art={src:''},props={innerHTML:'',children:[]},crew={},status={classList:{remove(){}},innerHTML:''};
  const container={closest:()=>root,querySelector:selector=>selector==='.r-scene-art'?art:selector==='[data-r-decor-props]'?props:selector==='[data-r-construction]'?crew:status,querySelectorAll:()=>[]};
  const observed=[],oldDocument=globalThis.document;globalThis.document={baseURI:'https://example.test/cat-nest/test/'};
  try{
    const scene=createRestaurantDecorationScene({container,onSceneChange:id=>observed.push([id,art.src])});
    const info=id=>({decorationInfo:{decoration:RESTAURANT_DECORATIONS.find(s=>s.id===id),construction:null,activeDecorationId:id,activeBuffs:{}}});
    scene.sync(info('cream-bakery'));scene.open();scene.sync(info('mint-seaside'));scene.sync(info('mint-seaside'));
    assert.deepEqual(observed.map(([id])=>id),['cream-bakery','mint-seaside']);assert.ok(observed[1][1].endsWith('/mint-seaside/scene.webp'));assert.equal(status.hidden,true);assert.equal(status.innerHTML,'');scene.destroy();
  }finally{globalThis.document=oldDocument;}
});

test('room replacement backgrounds stay behind guests while clipped window fragments stay above the entrance masks',async()=>{
  const decorCss=await readFile(new URL('../src/restaurant-economy.css',import.meta.url),'utf8'),guestCss=await readFile(new URL('../src/restaurant-guests.css',import.meta.url),'utf8');
  const wall=Number(guestCss.match(/\.rg-entry-wall\{[^}]*z-index:(\d+)/)[1]),guest=Number(guestCss.match(/\.rg-guest-layer\{[^}]*z-index:(\d+)/)[1]);
  assert.match(decorCss,/\.re-decor-layer\{[^}]*z-index:auto/,'the wrapper cannot raise opaque floor pixels over guests');
  const {premiumSceneMarkup}=await import('../src/restaurant-economy-ui.js'),html=premiumSceneMarkup();
  for(const id of ['starlight','cloudgarden','fireplace']){const img=html.match(new RegExp(`<img[^>]*data-r-premium-prop="${id}"[^>]*>`))[0];assert.ok(Number(img.match(/z-index:(\d+)/)[1])<guest);}
  for(const id of ['starlight','cloudgarden']){const img=html.match(new RegExp(`<img[^>]*data-r-premium-wall="${id}"[^>]*>`))[0];assert.ok(Number(img.match(/z-index:(\d+)/)[1])>=wall);assert.match(img,/clip-path:inset/);}
  assert.doesNotMatch(html,/data-r-premium-wall="fireplace"/);
});

test('six unique generated furniture sets include all nine transparent icons and reversible replacement tiles',async()=>{
  const base=new URL('../public/assets/restaurant/premium-themed-v1/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
  assert.deepEqual(Object.keys(manifest.sets).sort(),RESTAURANT_DECORATIONS.map(s=>s.id).sort());
  const hashes=new Map(ids.map(id=>[id,new Set()]));
  for(const suite of RESTAURANT_DECORATIONS){const pack=manifest.sets[suite.id];assert.equal(pack.tool,'built-in image_gen');assert.deepEqual(Object.keys(pack.icons).sort(),[...ids].sort());
    for(const id of ids){const bytes=await readFile(new URL(pack.icons[id].file,base));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes[20]&0x10,`${suite.id}/${id} retains alpha`);assert.match(pack.icons[id].source,/generated_images\/.+\.png$/);hashes.get(id).add(createHash('sha256').update(bytes).digest('hex'));}
    assert.deepEqual(Object.keys(pack.patches).sort(),Object.keys(PREMIUM_SCENE_PATCHES).sort());
    for(const [id,patch] of Object.entries(pack.patches)){assert.deepEqual(patch.bounds,PREMIUM_SCENE_PATCHES[id]);const bytes=await readFile(new URL(patch.file,base));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes[20]&0x10);}
  }
  for(const [id,set] of hashes)assert.equal(set.size,6,`${id} has six separately illustrated variants`);
});
