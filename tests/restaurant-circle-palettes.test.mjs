import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, normalizeState } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction, restaurantActionResult } from '../src/restaurant.js';
import { KITCHEN_CIRCLE_PALETTES } from '../src/restaurant-circle-palettes.js';
import { kitchenPaletteMarkup, kitchenCircleStyle } from '../src/restaurant-kitchen-colors.js';
import { levelStartXp } from '../src/growth-levels.js';
import { createDemoEngine, DEMO_ACTORS } from '../demo/engine.js';
import { createMemoryStorage } from '../demo/storage.js';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'palette-owner',name:'店长'};
const atLevel=level=>{const state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(level);return state;};
const choose=paletteId=>({type:'restaurant-palette',paletteId});
const paletteButtons=info=>[...kitchenPaletteMarkup(info).matchAll(/<button\b[^>]*data-r-palette="([^"]+)"[^>]*>[\s\S]*?<\/button>/g)];

test('five real colours unlock at 1, 5, 10, 18 and 28 with exact restaurant XP boundaries',()=>{
  assert.deepEqual(KITCHEN_CIRCLE_PALETTES.map(p=>[p.id,p.unlockLevel]),[['cream',1],['sky',5],['mint',10],['peach',18],['lilac',28]]);
  for(const palette of KITCHEN_CIRCLE_PALETTES.slice(1)){
    const state=atLevel(palette.unlockLevel),before=structuredClone(state);state.restaurant.stats.experience-=.1;
    assert.equal(restaurantActionResult(state,choose(palette.id),actor,NOW).ok,false);
    assert.equal(reduceAction(state,choose(palette.id),actor,NOW),null);
    const unlocked=reduceAction(before,choose(palette.id),actor,NOW);assert.ok(unlocked);
    assert.equal(unlocked.restaurant.circlePalette,palette.id);assert.equal(validRestaurant(unlocked.restaurant),true);
    assert.equal(unlocked.coins,before.coins);assert.equal(unlocked.goldFish,before.goldFish);assert.equal(unlocked.xp,before.xp);
    assert.deepEqual(unlocked.restaurant.stats,before.restaurant.stats);
    assert.deepEqual(unlocked.restaurant.orders,before.restaurant.orders);assert.deepEqual(unlocked.restaurant.levels,before.restaurant.levels);
    const reload=normalizeState(JSON.parse(JSON.stringify(unlocked)),NOW+1000);assert.equal(reload.restaurant.circlePalette,palette.id);
    assert.equal(restaurantActionResult(reload,choose(palette.id),actor,NOW+1000).ok,false,'choosing the active palette is a no-op');
    const cream=reduceAction(reload,choose('cream'),actor,NOW+1000);assert.equal(cream.restaurant.circlePalette,'cream');
  }
});

test('client intents cannot forge palette ownership, level, prices, colours or bonuses',()=>{
  const action=choose('sky');assert.deepEqual(sanitizeRestaurantAction(action),action);assert.deepEqual(sanitizeAction(action),action);
  for(const extra of [{ownedCirclePalettes:['sky']},{unlocked:true},{level:28},{cost:0},{coins:99999},{colour:'#000'},{bonus:2},{circlePalette:'sky'}]){
    assert.equal(sanitizeRestaurantAction({...action,...extra}),null);assert.equal(sanitizeAction({...action,...extra}),null);
  }
  for(const paletteId of ['missing','constructor','',null,3,{},['sky']])assert.equal(sanitizeAction(choose(paletteId)),null);
  for(const ownedCirclePalettes of [null,'sky',{},['sky','sky'],['missing'],[3]])assert.equal(validRestaurant({...atLevel(1).restaurant,ownedCirclePalettes}),false);
});

test('old saves retain their orders and wallet, default to cream and ignore a pet level higher than the restaurant',()=>{
  let state=atLevel(1);state.xp=levelStartXp(50);state.coins=456;
  state=reduceAction(state,{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  const before=structuredClone(state),loaded=normalizeState(JSON.parse(JSON.stringify(state)),NOW);
  assert.equal(loaded.restaurant.circlePalette,undefined);assert.equal(restaurantInfo(loaded,NOW).level,1);
  assert.equal(restaurantActionResult(loaded,choose('sky'),actor,NOW).ok,false);
  assert.equal(loaded.coins,before.coins);assert.deepEqual(loaded.restaurant.orders,before.restaurant.orders);
  assert.match(kitchenPaletteMarkup(restaurantInfo(loaded,NOW)),/data-r-palette="cream"[^>]*aria-pressed="true"/);
  const grown=structuredClone(loaded);grown.restaurant.stats.experience=levelStartXp(28);
  const changed=reduceAction(grown,choose('lilac'),actor,NOW+1);
  assert.deepEqual(changed.restaurant.orders,grown.restaurant.orders,'changing the UI leaves existing route and step snapshots intact');
  assert.deepEqual(changed.restaurant.staffTraining,grown.restaurant.staffTraining);assert.deepEqual(changed.restaurant.research,grown.restaurant.research);
});

test('compact decoration cards show every palette, current state and matching gates without introducing debug switches',()=>{
  for(const level of [1,5,10,18,28]){
    const state=atLevel(level),info=restaurantInfo(state,NOW),before=structuredClone(info),buttons=paletteButtons(info);
    assert.equal(buttons.length,5);
    for(const [html,id] of buttons){const palette=KITCHEN_CIRCLE_PALETTES.find(p=>p.id===id);assert.equal(/\bdisabled\b/.test(html),level<palette.unlockLevel);assert.match(html,/seasonings.webp/);assert.ok(html.includes(kitchenCircleStyle(id)));}
    assert.deepEqual(info,before);assert.doesNotMatch(kitchenPaletteMarkup(info),/data-r-kitchen-palette|undefined.webp|<details/);
    const roadmap=info.progression.catalog.filter(item=>item.preview.type==='palette');assert.equal(roadmap.length,5);
    assert.equal(roadmap.filter(item=>item.owned).length,KITCHEN_CIRCLE_PALETTES.filter(p=>p.unlockLevel<=level).length);
  }
});

test('the existing isolated unlock-all-decorations command includes palettes without awarding XP or changing the current selection',()=>{
  const engine=createDemoEngine({storage:createMemoryStorage(),now:()=>NOW}),before=engine.snapshot().state;
  engine.scenario('restaurant-decorations');const unlocked=engine.snapshot().state;
  assert.deepEqual(unlocked.restaurant.ownedCirclePalettes,KITCHEN_CIRCLE_PALETTES.map(p=>p.id));assert.equal(unlocked.restaurant.circlePalette,undefined);
  assert.equal(unlocked.restaurant.stats.experience,before.restaurant.stats.experience);assert.equal(unlocked.xp,before.xp);assert.equal(unlocked.coins,before.coins);
  assert.equal(paletteButtons(restaurantInfo(unlocked,NOW)).some(button=>/\bdisabled\b/.test(button[0])),false);
  const selected=engine.action({operationId:'palette-demo-select',clientId:DEMO_ACTORS.male.id,action:choose('lilac')});
  assert.equal(selected.status,200);assert.equal(selected.data.state.restaurant.circlePalette,'lilac');
});

function mockGitHub(){
  const files=new Map();let revision=0;
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),previous=files.get(id);
    if(options.method==='GET'){
      if(!previous)return new Response('{}',{status:404});
      if(options.headers['If-None-Match']===previous.sha)return new Response(null,{status:304});
      return Response.json({sha:previous.sha,encoding:'base64',content:Buffer.from(JSON.stringify(previous.room)).toString('base64')},{headers:{etag:previous.sha}});
    }
    const body=JSON.parse(options.body);if(previous&&previous.sha!==body.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`palette-${++revision}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});return new Response('{}',{status:previous?200:201});
  };return {files,fetchImpl};
}
test('authoritative cloud persistence survives reload and duplicate retry while keeping homes isolated',async()=>{
  const mock=mockGitHub(),store=()=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now:()=>NOW});
  const first=store(),one=await first.createRoom({initialState:atLevel(28)}),two=await first.createRoom({initialState:atLevel(1)});
  const request={operationId:'palette-select-one',clientId:actor.id,name:actor.name,action:choose('lilac')};
  const selected=await first.applyAction(one.roomId,request),retry=await store().applyAction(one.roomId,request);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.restaurant.circlePalette,'lilac');assert.equal(retry.state.restaurant.revision,1);
  const loaded=await store().getRoom(one.roomId);assert.equal(loaded.state.restaurant.circlePalette,'lilac');assert.equal(loaded.state.coins,one.state.coins);
  const isolated=await store().getRoom(two.roomId);assert.equal(isolated.state.restaurant.circlePalette,undefined);assert.equal(mock.files.size,2);
  await assert.rejects(store().applyAction(two.roomId,request),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  assert.deepEqual((await store().getRoom(one.roomId)).state.restaurant,selected.state.restaurant);
});
