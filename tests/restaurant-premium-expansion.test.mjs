import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialState,reduceAction,normalizeState} from '../src/state.js';
import {restaurantInfo,validRestaurant,sanitizeRestaurantAction} from '../src/restaurant.js';
import {PREMIUM_RESTAURANT_THEMES,premiumRestaurantTheme,equippedPremiumDecorations,premiumDecorationArt} from '../src/restaurant-premium-decorations.js';
import {restaurantResourceLevel} from '../src/restaurant-progression.js';
import {restaurantLevelStartXp as levelStartXp} from '../src/growth-levels.js';
import {premiumThemesMarkup,premiumSceneMarkup,paintPremiumScene} from '../src/restaurant-economy-ui.js';
import {restaurantProgressionPanel} from '../src/restaurant-progression-ui.js';
import {createDemoEngine,DEMO_ACTORS} from '../demo/engine.js';
import {createMemoryStorage} from '../demo/storage.js';
import {createGitHubStore,sanitizeAction} from '../server/github-store.mjs';
const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'premium-decor-owner',name:'店长'};
const added=PREMIUM_RESTAURANT_THEMES.filter(theme=>theme.art.startsWith('gold-v2/'));
const action=themeId=>({type:'restaurant-theme',themeId});
const seed=(level=50,goldFish=100)=>{const state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(level);state.goldFish=goldFish;return state;};

test('six new collectibles join the original three with real catalog art, level gates and stable old prices',()=>{
  assert.equal(PREMIUM_RESTAURANT_THEMES.length,9);assert.equal(added.length,6);assert.equal(new Set(PREMIUM_RESTAURANT_THEMES.map(item=>item.id)).size,9);
  assert.deepEqual(added.map(item=>[item.id,item.unlockLevel,item.priceGold]),[['moonclock',18,3],['aquarium',24,4],['gramophone',31,6],['fireplace',36,7],['snowglobe',42,9],['cloudgarden',48,11]]);
  for(const [id,price] of [['starlight',6],['glass',8],['royal',12]])assert.equal(premiumRestaurantTheme(id).priceGold,price);
  for(const theme of PREMIUM_RESTAURANT_THEMES){assert.equal(restaurantResourceLevel('theme',theme.id),theme.unlockLevel);assert.ok(theme.scene.left>=0&&theme.scene.left+theme.scene.width<=100);assert.ok(theme.scene.top>0&&theme.scene.top<65);}
  assert.equal(premiumRestaurantTheme('unknown'),null);
});

test('each new piece rejects early or underfunded purchase, charges gold once and survives serialization without touching orders',()=>{
  for(const theme of added){
    const early=seed(theme.unlockLevel,theme.priceGold);early.restaurant.stats.experience-=.1;assert.equal(reduceAction(early,action(theme.id),actor,NOW),null);
    assert.equal(reduceAction(seed(theme.unlockLevel,theme.priceGold-1),action(theme.id),actor,NOW),null);
    let before=seed(theme.unlockLevel,theme.priceGold);before=reduceAction(before,{type:'restaurant-start',recipeId:'rice'},actor,NOW);
    const selected=reduceAction(before,action(theme.id),actor,NOW+100);assert.ok(selected);assert.equal(validRestaurant(selected.restaurant),true);
    assert.equal(selected.goldFish,0);assert.equal(selected.coins,before.coins);assert.equal(selected.xp,before.xp);assert.deepEqual(selected.restaurant.stats,before.restaurant.stats);
    assert.deepEqual(selected.restaurant.orders,before.restaurant.orders);assert.deepEqual(selected.restaurant.staffTraining,before.restaurant.staffTraining);
    const reload=normalizeState(JSON.parse(JSON.stringify(selected)),NOW+100);assert.equal(reload.restaurant.theme,before.restaurant.theme);assert.ok(equippedPremiumDecorations(reload.restaurant).includes(theme.id));assert.ok(reload.restaurant.ownedThemes.includes(theme.id));
    const removed=reduceAction(reload,{type:'restaurant-premium-decoration',themeId:theme.id,equipped:false},actor,NOW+100),again=reduceAction(removed,action(theme.id),actor,NOW+100);
    assert.equal(again.goldFish,0);assert.equal(again.restaurant.ownedThemes.filter(id=>id===theme.id).length,1);
    for(const forged of [{cost:0},{priceGold:0},{goldFish:999},{unlockLevel:1},{ownedThemes:[theme.id]}]){assert.equal(sanitizeRestaurantAction({...action(theme.id),...forged}),null);assert.equal(sanitizeAction({...action(theme.id),...forged}),null);}
  }
});

test('every collectible has a compact card, matching roadmap image and one positioned scene prop',()=>{
  const info=restaurantInfo(seed(),NOW),cards=premiumThemesMarkup(info),scene=premiumSceneMarkup(),roadmap=restaurantProgressionPanel(info,{category:'decoration'});
  assert.equal((cards.match(/data-r-theme=/g)||[]).length,9);assert.equal((scene.match(/data-r-premium-prop=/g)||[]).length,9);
  for(const theme of PREMIUM_RESTAURANT_THEMES){
    assert.ok(cards.includes(theme.propName));assert.ok(cards.includes(premiumDecorationArt(theme.id,info.decorationInfo.decoration.id)));assert.ok(scene.includes(`data-r-premium-prop="${theme.id}"`));assert.ok(scene.includes(theme.scene.integrated?`default/${theme.id}.webp`:theme.art));assert.ok(roadmap.includes(theme.art));
    const entry=info.progression.catalog.find(item=>item.key===`decoration:${theme.id}`);assert.equal(entry.level,theme.unlockLevel);assert.equal(entry.cost,theme.priceGold);
  }
  assert.doesNotMatch(cards+scene+roadmap,/undefined\.webp|undefined<\/em>/);
  const props=PREMIUM_RESTAURANT_THEMES.map(theme=>({dataset:{rPremiumProp:theme.id},style:{display:'none'}})),layer={dataset:{},querySelectorAll:()=>props},root={querySelector:selector=>selector==='.re-decor-layer'?layer:null};
  for(const theme of PREMIUM_RESTAURANT_THEMES){paintPremiumScene(root,{equippedPremiumDecorations:[theme.id]});assert.deepEqual(props.filter(prop=>prop.style.display==='block').map(prop=>prop.dataset.rPremiumProp),[theme.id]);}
  paintPremiumScene(root,{equippedPremiumDecorations:[]});assert.equal(props.some(prop=>prop.style.display==='block'),false);
});

test('all six additions ship as separate 512 px transparent WebP assets with generation provenance',async()=>{
  const base=new URL('../public/assets/restaurant/gold-v2/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
  assert.equal(Object.keys(manifest.assets).length,6);
  for(const theme of added){
    const record=manifest.assets[`theme-${theme.id}`],bytes=await readFile(new URL(record.file,base));
    assert.equal(record.width,512);assert.equal(record.height,512);assert.equal(record.alpha,true);assert.match(record.source,/generated_images\/.+\.png$/);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.toString('ascii',12,16),'VP8X');assert.ok(bytes[20]&0x10,`${theme.id} retains real alpha`);
  }
});

test('the test-only unlock-all command discovers new collectibles below level gates without gifting currency or silently equipping one',()=>{
  const engine=createDemoEngine({storage:createMemoryStorage(),now:()=>NOW}),before=engine.snapshot().state;
  engine.scenario('restaurant-decorations');const unlocked=engine.snapshot().state;
  for(const theme of PREMIUM_RESTAURANT_THEMES)assert.ok(unlocked.restaurant.ownedThemes.includes(theme.id));
  assert.equal(unlocked.coins,before.coins);assert.equal(unlocked.goldFish,before.goldFish);assert.equal(unlocked.xp,before.xp);assert.equal(unlocked.restaurant.theme,before.restaurant.theme);
  for(const theme of added){const response=engine.action({operationId:`premium-preview-${theme.id}`,clientId:DEMO_ACTORS.male.id,action:action(theme.id)});assert.equal(response.status,200);assert.ok(equippedPremiumDecorations(response.data.state.restaurant).includes(theme.id));assert.equal(response.data.state.goldFish,before.goldFish);}
});

function cloudMock(){
  const files=new Map();let sha=0,gate=null;const controls={holdTwo(){let release;const ready=new Promise(resolve=>release=resolve);gate={remaining:2,ready,release};}};
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),previous=files.get(id);
    if(options.method==='GET'){
      if(!previous)return new Response('{}',{status:404});if(options.headers['If-None-Match']===previous.sha)return new Response(null,{status:304});
      return Response.json({sha:previous.sha,encoding:'base64',content:Buffer.from(JSON.stringify(previous.room)).toString('base64')},{headers:{etag:previous.sha}});
    }
    const currentGate=gate;if(currentGate){if(--currentGate.remaining===0){gate=null;currentGate.release();}await currentGate.ready;}
    const latest=files.get(id),body=JSON.parse(options.body);if(latest&&latest.sha!==body.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`collectible-${++sha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});return new Response('{}',{status:latest?200:201});
  };return{files,fetchImpl,controls};
}
test('two partners cannot overspend one gold wallet and cloud reload/retry preserves ownership in only the selected home',async()=>{
  const mock=cloudMock(),store=()=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now:()=>NOW});
  const first=store(),second=store(),room=await first.createRoom({initialState:seed(50,11)}),other=await first.createRoom({initialState:seed(50,11)});
  const request=(id,operationId)=>({operationId,clientId:actor.id,name:actor.name,action:action(id)}),one=request('cloudgarden','collectible-race-one'),two=request('moonclock','collectible-race-two');
  mock.controls.holdTwo();const results=await Promise.allSettled([first.applyAction(room.roomId,one),second.applyAction(room.roomId,two)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const loaded=await store().getRoom(room.roomId),theme=premiumRestaurantTheme(equippedPremiumDecorations(loaded.state.restaurant)[0]);assert.ok(theme);assert.equal(loaded.state.goldFish,11-theme.priceGold);assert.equal(loaded.state.restaurant.ownedThemes.filter(id=>premiumRestaurantTheme(id)).length,1);
  const retry=await store().applyAction(room.roomId,theme.id==='cloudgarden'?one:two);assert.equal(retry.duplicate,true);assert.equal(retry.state.goldFish,loaded.state.goldFish);
  const isolated=await store().getRoom(other.roomId);assert.equal(isolated.state.goldFish,11);assert.deepEqual(isolated.state.restaurant.ownedThemes,['cream']);assert.equal(mock.files.size,2);
});

const place=(themeId,equipped)=>({type:'restaurant-premium-decoration',themeId,equipped});
test('all nine collectibles coexist with one scene suite, keep its bonuses and can be individually put away for free',()=>{
  let state=normalizeState(seed(50,100),NOW);state.coins=1000;state.restaurant.decorationId='cream-library';state.restaurant.ownedDecorations=['cream-bakery','cream-library'];
  const before=structuredClone(state),total=PREMIUM_RESTAURANT_THEMES.reduce((sum,theme)=>sum+theme.priceGold,0);
  for(const theme of PREMIUM_RESTAURANT_THEMES){state=reduceAction(state,place(theme.id,true),actor,NOW);assert.ok(state);assert.ok(validRestaurant(state.restaurant));}
  assert.deepEqual(equippedPremiumDecorations(state.restaurant).sort(),PREMIUM_RESTAURANT_THEMES.map(theme=>theme.id).sort());
  assert.equal(state.goldFish,100-total);assert.equal(state.coins,before.coins);assert.equal(state.xp,before.xp);assert.equal(state.restaurant.decorationId,'cream-library');assert.equal(state.restaurant.theme,'cream');
  assert.deepEqual(restaurantInfo(state,NOW).decorationInfo.activeBuffs,{coins:100,experience:150,cookSpeed:0});assert.deepEqual(state.restaurant.stats,before.restaurant.stats);assert.deepEqual(state.restaurant.staffTraining,before.restaurant.staffTraining);
  const loaded=normalizeState(JSON.parse(JSON.stringify(state)),NOW);
  assert.deepEqual(loaded.restaurant.equippedPremiumDecorations,state.restaurant.equippedPremiumDecorations);
  for(const id of ['starlight','fireplace','cloudgarden']){
    const rest=equippedPremiumDecorations(state.restaurant).filter(other=>other!==id);
    state=reduceAction(state,place(id,false),actor,NOW);assert.deepEqual(equippedPremiumDecorations(state.restaurant),rest);assert.ok(state.restaurant.ownedThemes.includes(id));
    state=reduceAction(state,place(id,true),actor,NOW);assert.ok(state.restaurant.equippedPremiumDecorations.includes(id));assert.equal(state.goldFish,100-total);
  }
  const building=reduceAction(state,{type:'restaurant-decoration',decorationId:'mint-greenhouse'},actor,NOW);
  assert.ok(building);assert.deepEqual(building.restaurant.equippedPremiumDecorations,state.restaurant.equippedPremiumDecorations);
  const installed=normalizeState(building,NOW+12000);assert.equal(installed.restaurant.decorationId,'mint-greenhouse');assert.deepEqual(installed.restaurant.equippedPremiumDecorations,state.restaurant.equippedPremiumDecorations);
});

test('legacy single-theme saves retain their piece until explicitly removed, without resetting scene, wallet or orders',()=>{
  let original=normalizeState(seed(),NOW);original=reduceAction(original,{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  original.restaurant.theme='starlight';original.restaurant.ownedThemes.push('starlight');delete original.restaurant.equippedPremiumDecorations;
  assert.equal(validRestaurant(original.restaurant),true);const loaded=normalizeState(JSON.parse(JSON.stringify(original)),NOW);
  assert.deepEqual(equippedPremiumDecorations(loaded.restaurant),['starlight']);assert.deepEqual(loaded.restaurant.orders,original.restaurant.orders);
  assert.equal(restaurantInfo(loaded,NOW).customerBook.customers.find(guest=>guest.id==='guest-astronomer').requirements.find(item=>item.kind==='theme').met,true);
  const removed=reduceAction(loaded,place('starlight',false),actor,NOW);assert.deepEqual(equippedPremiumDecorations(removed.restaurant),[]);assert.equal(removed.restaurant.theme,'starlight');assert.equal(removed.goldFish,original.goldFish);
  assert.deepEqual(equippedPremiumDecorations(normalizeState(JSON.parse(JSON.stringify(removed)),NOW).restaurant),[],'a legacy theme name cannot silently re-enable a removed piece');
  assert.equal(restaurantInfo(removed,NOW).customerBook.customers.find(guest=>guest.id==='guest-astronomer').requirements.find(item=>item.kind==='theme').met,false,'a removed legacy collectible no longer meets the guest requirement');
  const restored=reduceAction(removed,place('starlight',true),actor,NOW);assert.deepEqual(equippedPremiumDecorations(restored.restaurant),['starlight']);assert.equal(restored.goldFish,original.goldFish);
});

test('placement actions accept only one known piece and an explicit boolean target, with no forged ownership or charge',()=>{
  const valid=place('fireplace',true);assert.deepEqual(sanitizeAction(valid),valid);
  for(const equipped of [0,1,'true',null,[],{}])assert.equal(sanitizeAction({...valid,equipped}),null);
  for(const extra of [{goldFish:999},{priceGold:0},{owned:true},{equippedPremiumDecorations:['fireplace']},{theme:'cream'},{now:NOW}])assert.equal(sanitizeAction({...valid,...extra}),null);
  assert.equal(sanitizeAction(place('cream',true)),null);assert.equal(sanitizeAction(place('unknown',true)),null);
  const state=seed();assert.equal(reduceAction(state,place('fireplace',false),actor,NOW),null);
  for(const equippedPremiumDecorations of [['unknown'],['fireplace','fireplace'],['fireplace'],null,'fireplace'])assert.equal(validRestaurant({...state.restaurant,equippedPremiumDecorations}),false);
  const placed=reduceAction(state,valid,actor,NOW),before=structuredClone(placed);assert.equal(reduceAction(placed,valid,actor,NOW),null);assert.deepEqual(placed,before);
});

test('two partners concurrently placing different affordable pieces retain both, and removing one leaves the other saved',async()=>{
  const mock=cloudMock(),store=()=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now:()=>NOW});
  const first=store(),second=store(),room=await first.createRoom({initialState:seed(50,100)});
  const request=(themeId,equipped,operationId)=>({operationId,clientId:actor.id,name:actor.name,action:place(themeId,equipped)}),one=request('starlight',true,'placement-race-star'),two=request('fireplace',true,'placement-race-fire');
  mock.controls.holdTwo();const results=await Promise.allSettled([first.applyAction(room.roomId,one),second.applyAction(room.roomId,two)]);assert.equal(results.filter(result=>result.status==='fulfilled').length,2);
  const loaded=await store().getRoom(room.roomId);assert.deepEqual(equippedPremiumDecorations(loaded.state.restaurant).sort(),['fireplace','starlight']);assert.equal(loaded.state.goldFish,87);
  const retry=await store().applyAction(room.roomId,one);assert.equal(retry.duplicate,true);assert.equal(retry.state.goldFish,87);
  const removed=await store().applyAction(room.roomId,request('starlight',false,'placement-remove-star'));assert.deepEqual(equippedPremiumDecorations(removed.state.restaurant),['fireplace']);assert.equal(removed.state.goldFish,87);
  const reload=await store().getRoom(room.roomId);assert.deepEqual(reload.state.restaurant.equippedPremiumDecorations,['fireplace']);assert.equal(reload.state.restaurant.theme,'cream');
});

test('integrated pieces use the matching room tiles, coexist with small props and restore original furnishings when removed',()=>{
  const ids=['starlight','fireplace','cloudgarden','aquarium'],props=PREMIUM_RESTAURANT_THEMES.map(theme=>({dataset:{rPremiumProp:theme.id},style:{},src:''}));
  let art='https://test.invalid/assets/restaurant/decor/cream-library/scene.webp';const layer={dataset:{},querySelectorAll:()=>props},root={querySelector:selector=>selector==='.re-decor-layer'?layer:selector==='.r-scene-art'?{getAttribute:()=>art}:null};
  paintPremiumScene(root,{equippedPremiumDecorations:ids});assert.equal(props.filter(p=>p.style.display==='block').length,4);
  for(const prop of props.filter(p=>ids.includes(p.dataset.rPremiumProp)&&p.dataset.rPremiumProp!=='aquarium'))assert.ok(prop.src.includes(`/cream-library/integrated/${prop.dataset.rPremiumProp}.webp`));
  art='https://test.invalid/assets/restaurant/decor/sakura-evening/scene.webp';paintPremiumScene(root,{equippedPremiumDecorations:ids});assert.ok(props.find(p=>p.dataset.rPremiumProp==='fireplace').src.includes('/sakura-evening/integrated/fireplace.webp'));
  paintPremiumScene(root,{equippedPremiumDecorations:['aquarium']});assert.deepEqual(props.filter(p=>p.style.display==='block').map(p=>p.dataset.rPremiumProp),['aquarium']);
});

test('all seven original and suite backgrounds ship three independently reversible room edits',async()=>{
  const base=new URL('../public/assets/restaurant/premium-integrated-v1/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
  assert.deepEqual(Object.keys(manifest.variants).sort(),['default','cream-bakery','cream-library','mint-greenhouse','mint-seaside','sakura-teahouse','sakura-evening'].sort());
  for(const variant of Object.values(manifest.variants)){
    assert.deepEqual(Object.keys(variant.patches).sort(),['cloudgarden','fireplace','starlight']);
    for(const [id,patch] of Object.entries(variant.patches)){
      const bytes=await readFile(new URL(patch.file,base));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes[20]&0x10);
      assert.ok(patch.left>=0&&patch.left+patch.width<=940&&patch.top+patch.height<=1672);assert.ok(patch.width*patch.height<940*1672*.04,'a local replacement never covers the entire room');
      if(id==='fireplace')assert.ok(patch.top>=650&&patch.top<700,'the fireplace replaces the middle side cabinet, not the kitchen corner');
    }
  }
});
