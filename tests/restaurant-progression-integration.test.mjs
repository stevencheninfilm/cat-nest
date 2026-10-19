import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, levelInfo, levelStartXp } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction, RESTAURANT_RECIPES, RESTAURANT_STAFF, RESTAURANT_UPGRADES, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { normalizeStaffTraining, STAFF_TRAINING_STATS } from '../src/restaurant-staff-training.js';
import { RESTAURANT_CONSTRUCTION_MS } from '../src/restaurant-decor.js';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'progression-manager',name:'店长'};
const OLD_RECIPE_LEVELS={rice:1,coffee:1,sandwich:1,donut:1,lemontea:1,pancake:2,pudding:2,matcha:2,burger:3,udon:3,waffle:3,strawberrymilk:3,pizza:4,sushi:4,grape:4,parfait:5,cheesecake:5,cocoa:5};
const legacyRecipesAt=level=>Object.entries(OLD_RECIPE_LEVELS).filter(([,required])=>required<=level).map(([id])=>id).sort();
const act=(state,type,fields={},at=NOW)=>reduceAction(state,{type,...fields},ACTOR,at);
function funded(level=1) {
  const state=initialState(NOW);
  state.coins=999999;state.goldFish=999999;
  state.xp=levelStartXp(90); // Cat growth cannot substitute for restaurant growth.
  state.restaurant.stats.experience=levelStartXp(level);
  state.restaurant.progression={version:2,experienceOffset:0,legacyRecipes:[]};
  return state;
}
function below(level) {
  const state=funded(level);
  state.restaurant.stats.experience=levelStartXp(level)-.1;
  return state;
}
function assertGate(type,fields,requiredLevel,configure=()=>{}) {
  const locked=below(requiredLevel);configure(locked);
  const before=structuredClone(locked);
  assert.equal(restaurantInfo(locked,NOW).level,requiredLevel-1);
  assert.equal(act(locked,type,fields),null,`${type} ${JSON.stringify(fields)} requires restaurant Lv.${requiredLevel}, even with full wallets and a high-level cat`);
  assert.deepEqual(locked,before,'a rejected level gate leaves the source state unchanged');
  const eligible=funded(requiredLevel);configure(eligible);
  const result=act(eligible,type,fields);
  assert.ok(result,`${type} ${JSON.stringify(fields)} becomes eligible at restaurant Lv.${requiredLevel}`);
  assert.equal(result.xp,eligible.xp,'purchases and upgrades never add cat experience');
  assert.equal(result.restaurant.stats.experience,eligible.restaurant.stats.experience,'purchases and upgrades never add restaurant experience');
  assert.deepEqual(result.restaurant.progression,eligible.restaurant.progression);
  const poor=structuredClone(eligible);poor.coins=0;poor.goldFish=0;
  assert.equal(act(poor,type,fields),null,'the level requirement grants eligibility while the original currency price still applies');
  return result;
}

test('fresh restaurants use the cat growth ladder with independent experience and no level ceiling',()=>{
  const initial=initialState(NOW);
  assert.deepEqual(initial.restaurant.progression,{version:2,experienceOffset:0,legacyRecipes:[]});
  assert.equal(restaurantInfo(initial,NOW).level,1);
  assert.deepEqual([2,3,4,5].map(levelStartXp),[120,270,450,660]);
  for(const level of [2,3,4,5,6,10,11,37,49,50,51,100]) {
    const state=funded(level),before=structuredClone(state);
    assert.equal(restaurantInfo(state,NOW).level,level);
    assert.equal(restaurantInfo(below(level),NOW).level,level-1);
    assert.equal(levelInfo(state.restaurant.stats.experience).level,level);
    assert.deepEqual(state,before,'inspecting progress never mutates the save');
  }
  const servedOnly=funded();servedOnly.restaurant.stats.served=600;servedOnly.restaurant.stats.ordinaryServed=600;servedOnly.restaurant.nextOrderId=601;
  assert.equal(restaurantInfo(servedOnly,NOW).level,1,'new-schema restaurants cannot gain levels from order count or main-cat XP');
});

test('an actual paid order crosses exact restaurant thresholds and adds the same earned XP to the main cat once',()=>{
  for(const targetLevel of [2,3,4,5,6,11,37,49,50,51]) {
    const original=funded();original.coins=1000;original.goldFish=0;original.xp=137;
    original.restaurant.stats.experience=levelStartXp(targetLevel)-6;
    assert.equal(restaurantInfo(original,NOW).level,targetLevel-1);
    let state=act(original,'restaurant-start',{recipeId:'sandwich'});
    assert.ok(state);assert.equal(state.xp,137);assert.equal(state.restaurant.stats.experience,original.restaurant.stats.experience);
    const order=restaurantInfo(state,NOW).orders[0];
    assert.equal(order.rewardXp,6);
    assert.equal(act(state,'restaurant-collect',{orderId:order.id},order.readyAt),null,'cooking and delivery are not paid experience');
    state=act(state,'restaurant-serve',{orderId:order.id},order.readyAt);
    assert.ok(state);assert.equal(state.xp,137);assert.equal(restaurantInfo(state,order.readyAt).level,targetLevel-1);
    const paidAt=order.readyAt+RESTAURANT_DINING_MS;
    assert.equal(act(state,'restaurant-collect',{orderId:order.id},paidAt-1),null);
    const paid=act(state,'restaurant-collect',{orderId:order.id},paidAt);
    assert.ok(paid);assert.equal(paid.xp,137);assert.equal(paid.pendingGrowth.at(-1).amount,6);
    const claimed=act(paid,'claim-growth',{rewardId:paid.pendingGrowth.at(-1).id},paidAt+1);assert.equal(claimed.xp,143);assert.deepEqual(claimed.restaurant,paid.restaurant);assert.equal(paid.coins,1000+order.rewardCoins);
    assert.equal(paid.restaurant.stats.experience,levelStartXp(targetLevel));
    assert.equal(restaurantInfo(paid,paidAt).level,targetLevel);
    assert.deepEqual(paid.restaurant.progression,{version:2,experienceOffset:0,legacyRecipes:[]});
    assert.equal(paid.restaurant.stats.served,1);
    assert.equal(act(paid,'restaurant-collect',{orderId:order.id},paidAt+1),null,'repeated collection cannot grant more progress');
    assert.equal(restaurantInfo(normalizeState(JSON.parse(JSON.stringify(paid)),paidAt+1000),paidAt+1000).level,targetLevel);
  }
});

test('all employee hires are level-gated independently of coins, gold, and the main cat level',()=>{
  const levels=[2,12,24,35,42,49];
  for(const [index,required] of levels.entries()) {
    const result=assertGate('restaurant-hire',{},required,state=>{
      state.restaurant.staff=index;
      state.restaurant.staffTraining=normalizeStaffTraining(undefined,NOW,index);
    });
    assert.equal(result.restaurant.staff,index+1);
    const employee=RESTAURANT_STAFF[index];
    assert.equal(result[employee.costCurrency==='goldFish'?'goldFish':'coins'],999999-employee.cost);
  }
});

test('each facility upgrade checks the required restaurant level for its exact target tier',()=>{
  const gates={kitchen:[10,23,40],fridge:[7,18,34],tables:[3,20,38],tips:[13,27,43]};
  for(const [upgradeId,levels] of Object.entries(gates))for(const [index,required] of levels.entries()) {
    const target=index+2,result=assertGate('restaurant-upgrade',{upgradeId},required,state=>{state.restaurant.levels[upgradeId]=target-1;});
    assert.equal(result.restaurant.levels[upgradeId],target);
    assert.equal(result.coins,999999-RESTAURANT_UPGRADES.find(upgrade=>upgrade.id===upgradeId).costs[index]);
  }
});

test('recipe research and every independent employee ability obey their target-tier level requirements',()=>{
  for(const [index,required] of [1,10,30,45].entries()) {
    const target=index+2,configure=state=>{state.restaurant.recipeLevels.rice=target-1;state.restaurant.research={version:1,startedServed:0,draws:3,fragments:{rice:15},lastDraw:{draw:3,recipeId:'rice',amount:5}};};
    if(required>1){const locked=below(required);configure(locked);assert.equal(act(locked,'restaurant-recipe',{recipeId:'rice'}),null);}
    const state=funded(required);configure(state);state.coins=0;state.goldFish=0;
    const result=act(state,'restaurant-recipe',{recipeId:'rice'});
    assert.ok(result);assert.equal(result.restaurant.recipeLevels.rice,target);assert.equal(result.coins,0);assert.equal(result.goldFish,0);
    assert.equal(result.xp,state.xp);assert.equal(result.restaurant.stats.experience,state.restaurant.stats.experience);
  }
  for(const stat of STAFF_TRAINING_STATS)for(const [index,required] of [1,5,15,21,31,36,41,46,48].entries()) {
    const target=index+2,configure=state=>{
      state.restaurant.staffTraining=normalizeStaffTraining(undefined,NOW,0);
      state.restaurant.staffTraining['worker-1'].levels[stat.id]=target-1;
    };
    if(required===1) {
      const state=funded();configure(state);
      const result=act(state,'restaurant-train',{workerId:'worker-1',statId:stat.id});
      assert.ok(result);assert.equal(result.restaurant.staffTraining['worker-1'].levels[stat.id],2);
      assert.equal(result.xp,state.xp);assert.equal(result.restaurant.stats.experience,0);
    }else {
      const result=assertGate('restaurant-train',{workerId:'worker-1',statId:stat.id},required,configure);
      assert.equal(result.restaurant.staffTraining['worker-1'].levels[stat.id],target);
    }
  }
});

test('new suites, premium themes and every recipe obey their 1–50 restaurant level gates',()=>{
  const recipeLevels={rice:1,coffee:1,sandwich:1,donut:1,lemontea:1,pancake:4,pudding:6,matcha:8,burger:11,udon:14,waffle:17,strawberrymilk:19,sushi:22,pizza:25,grape:28,parfait:29,cheesecake:32,cocoa:47,'gold-salmon':20,'gold-sundae':30,'gold-latte':40};
  for(const [decorationId,required] of [['cream-library',9],['mint-greenhouse',16],['mint-seaside',26],['sakura-teahouse',33],['sakura-evening',37]]) {
    const result=assertGate('restaurant-decoration',{decorationId},required);
    assert.ok(result.restaurant.ownedDecorations.includes(decorationId));
    assert.equal(result.restaurant.construction.toDecorationId,decorationId);
  }
  for(const [themeId,required] of [['mint',16],['sakura',33],['starlight',39],['glass',44],['royal',50]]) {
    const result=assertGate('restaurant-theme',{themeId},required);
    if(['mint','sakura'].includes(themeId))assert.equal(result.restaurant.theme,themeId);else assert.ok(result.restaurant.equippedPremiumDecorations.includes(themeId));assert.ok(result.restaurant.ownedThemes.includes(themeId));
  }
  for(const recipe of [...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES]) {
    assert.ok(recipe.unlockLevel>=1&&recipe.unlockLevel<=50);
    assert.equal(recipe.unlockLevel,recipeLevels[recipe.id],'the authoritative menu uses the complete fifty-level roadmap');
    if(recipe.unlockLevel===1)continue;
    const locked=below(recipe.unlockLevel);
    if(recipe.special) {
      assert.equal(act(locked,'restaurant-unlock-special',{recipeId:recipe.id}),null);
      const unlocked=act(funded(recipe.unlockLevel),'restaurant-unlock-special',{recipeId:recipe.id});
      assert.ok(unlocked);assert.ok(unlocked.restaurant.ownedSpecialRecipes.includes(recipe.id));
    }else {
      assert.equal(act(locked,'restaurant-start',{recipeId:recipe.id}),null);
      assert.ok(act(funded(recipe.unlockLevel),'restaurant-start',{recipeId:recipe.id}));
    }
  }
});

test('client intents cannot forge experience, a progression offset, the current level or eligibility',()=>{
  const actions=[
    {type:'restaurant-hire'},
    {type:'restaurant-upgrade',upgradeId:'kitchen'},
    {type:'restaurant-recipe',recipeId:'rice'},
    {type:'restaurant-train',workerId:'worker-1',statId:'speed'},
    {type:'restaurant-theme',themeId:'royal'},
    {type:'restaurant-decoration',decorationId:'sakura-evening'},
    {type:'restaurant-unlock-special',recipeId:'gold-salmon'},
  ];
  const state=funded();
  for(const action of actions)for(const fields of [{level:100},{restaurantLevel:100},{experience:999999},{xp:999999},{experienceOffset:999999},{progression:{version:1,experienceOffset:999999}},{requiredLevel:0},{cost:0}]) {
    const forged={...action,...fields},before=structuredClone(state);
    assert.equal(sanitizeRestaurantAction(forged),null);assert.equal(sanitizeAction(forged),null);
    assert.equal(reduceAction(state,forged,ACTOR,NOW),null);
    assert.deepEqual(state,before);
  }
});

test('legacy order-count progression receives an idempotent restaurant-only offset without minting currency or main XP',()=>{
  for(const [served,earnedXp] of [[0,0],[6,10],[12,40],[18,90],[24,150],[96,200],[24,1000]]) {
    const legacy=funded();legacy.coins=417;legacy.goldFish=13;legacy.xp=177;
    delete legacy.restaurant.progression;
    legacy.restaurant.stats={served,ordinaryServed:served,earned:300,experience:earnedXp};legacy.restaurant.nextOrderId=served+1;
    const before=structuredClone(legacy),oldLevel=Math.min(5,1+Math.floor(served/6));
    const restored=normalizeState(legacy,NOW+1000),offset=Math.max(0,levelStartXp(oldLevel)-earnedXp);
    assert.equal(restored.restaurant.progression.version,2);
    assert.equal(restored.restaurant.progression.experienceOffset,offset);
    assert.deepEqual([...restored.restaurant.progression.legacyRecipes].sort(),legacyRecipesAt(Math.max(oldLevel,levelInfo(earnedXp).level)));
    assert.equal(restaurantInfo(restored,NOW+1000).level,Math.max(oldLevel,levelInfo(earnedXp).level));
    assert.equal(restored.coins,417);assert.equal(restored.goldFish,13);assert.equal(restored.xp,177);
    assert.deepEqual(restored.restaurant.stats,legacy.restaurant.stats);
    assert.equal(validRestaurant(restored.restaurant),true);assert.deepEqual(legacy,before);
    const again=normalizeState(JSON.parse(JSON.stringify(restored)),NOW+86400000);
    assert.deepEqual(again.restaurant.progression,restored.restaurant.progression);
    assert.deepEqual(again.restaurant.stats,restored.restaurant.stats);
    assert.equal(again.xp,177);assert.equal(again.coins,417);assert.equal(again.goldFish,13);
  }
});

test('v1 saves retain every ordinary dish already opened before the fifty-level roadmap while fresh v2 saves obey the new gates',()=>{
  for(const oldLevel of [1,2,3,4,5]) {
    const legacy=funded(oldLevel);legacy.coins=1250;legacy.goldFish=17;legacy.xp=86;
    legacy.restaurant.progression={version:1,experienceOffset:0};
    const before=structuredClone(legacy),restored=normalizeState(legacy,NOW);
    assert.deepEqual([...restored.restaurant.progression.legacyRecipes].sort(),legacyRecipesAt(oldLevel));
    assert.equal(restored.restaurant.progression.version,2);assert.equal(restored.restaurant.progression.experienceOffset,0);
    assert.equal(restored.coins,1250);assert.equal(restored.goldFish,17);assert.equal(restored.xp,86);
    assert.equal(restored.restaurant.stats.experience,levelStartXp(oldLevel));assert.deepEqual(legacy,before);
    for(const recipe of RESTAURANT_RECIPES) {
      const inherited=OLD_RECIPE_LEVELS[recipe.id]<=oldLevel;
      assert.equal(restaurantInfo(restored,NOW).recipes.find(item=>item.id===recipe.id).unlocked,inherited,`${recipe.id} preserves its original Lv.${oldLevel} permission`);
      if(inherited)assert.ok(act(restored,'restaurant-start',{recipeId:recipe.id}));
      if(recipe.unlockLevel>oldLevel)assert.equal(act(funded(oldLevel),'restaurant-start',{recipeId:recipe.id}),null,`${recipe.id} is still gated for a new v2 restaurant`);
    }
    const reloaded=normalizeState(JSON.parse(JSON.stringify(restored)),NOW+86400000);
    assert.deepEqual(reloaded.restaurant.progression,restored.restaurant.progression,'the inherited menu is saved once and survives reload');
    assert.deepEqual(reloaded.restaurant.recipeLevels,restored.restaurant.recipeLevels);
  }
  const upgraded=funded();upgraded.restaurant.progression={version:1,experienceOffset:0};upgraded.restaurant.recipeLevels.cocoa=2;
  const restored=normalizeState(upgraded,NOW);
  assert.ok(restored.restaurant.progression.legacyRecipes.includes('cocoa'),'an already researched dish remains usable even if its old level ledger is lower');
  assert.ok(act(restored,'restaurant-start',{recipeId:'cocoa'}));
  assert.equal(restored.restaurant.recipeLevels.cocoa,2);
});

test('existing higher-tier staff, facilities, abilities and purchased decorations survive a lower restaurant level',()=>{
  const state=funded();state.restaurant.staff=6;
  state.restaurant.levels={kitchen:4,fridge:4,tables:4,tips:4};
  state.restaurant.staffTraining=normalizeStaffTraining(undefined,NOW,6);
  for(const record of Object.values(state.restaurant.staffTraining))for(const stat of STAFF_TRAINING_STATS)record.levels[stat.id]=10;
  state.restaurant.ownedThemes=['cream','mint','sakura','starlight','glass','royal'];
  state.restaurant.ownedDecorations=['cream-bakery','cream-library','mint-greenhouse','mint-seaside','sakura-teahouse','sakura-evening'];
  state.restaurant.ownedSpecialRecipes=SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id);
  for(const recipe of [...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES])state.restaurant.recipeLevels[recipe.id]=4;
  const restored=normalizeState(JSON.parse(JSON.stringify(state)),NOW);
  assert.equal(restaurantInfo(restored,NOW).level,1);assert.equal(restored.restaurant.staff,6);
  assert.deepEqual(restored.restaurant.levels,state.restaurant.levels);
  assert.deepEqual(restored.restaurant.staffTraining,state.restaurant.staffTraining);
  assert.deepEqual(restored.restaurant.recipeLevels,state.restaurant.recipeLevels);
  assert.deepEqual(restored.restaurant.ownedSpecialRecipes,state.restaurant.ownedSpecialRecipes);
  assert.deepEqual(restored.restaurant.ownedDecorations,state.restaurant.ownedDecorations);
  for(const themeId of ['mint','sakura','starlight','glass','royal']) {
    const changed=act(restored,'restaurant-theme',{themeId});assert.ok(changed,'already purchased themes remain equippable');
    assert.equal(changed.coins,restored.coins);assert.equal(changed.goldFish,restored.goldFish);
  }
  const building=act(restored,'restaurant-decoration',{decorationId:'sakura-evening'});
  assert.ok(building,'an already owned high-level suite remains equippable');
  assert.equal(building.coins,restored.coins);assert.equal(building.goldFish,restored.goldFish);
  const done=normalizeState(building,NOW+RESTAURANT_CONSTRUCTION_MS);
  assert.equal(done.restaurant.decorationId,'sakura-evening');
  assert.equal(validRestaurant(done.restaurant),true);
});

function mockGitHub() {
  const files=new Map();let revision=0;
  const controls={loseAcknowledgment:false};
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json',''),previous=files.get(id);
    if(options.method==='GET') {
      if(!previous)return new Response('{}',{status:404});
      if(options.headers['If-None-Match']===previous.sha)return new Response(null,{status:304});
      return Response.json({sha:previous.sha,encoding:'base64',content:Buffer.from(JSON.stringify(previous.room)).toString('base64')},{headers:{etag:previous.sha}});
    }
    const body=JSON.parse(options.body);
    if(previous&&previous.sha!==body.sha)return new Response('{}',{status:409});
    files.set(id,{sha:`progression-${++revision}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    if(controls.loseAcknowledgment){controls.loseAcknowledgment=false;throw new Error('lost acknowledgment');}
    return new Response('{}',{status:previous?200:201});
  };
  return {files,controls,fetchImpl};
}

test('a cloud collection crossing Lv.2 retains one XP award after a lost acknowledgement and operation retry',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const store=()=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now:()=>clock});
  const room=await store().createRoom(),file=mock.files.get(room.roomId);
  file.room.state.restaurant.stats.experience=114;
  file.sha='progression-before-threshold';
  const request=(type,fields,id)=>({operationId:`progression-${id}`,clientId:ACTOR.id,name:ACTOR.name,action:{type,...fields}});
  const started=await store().applyAction(room.roomId,request('restaurant-start',{recipeId:'sandwich'},'start'));
  const order=started.state.restaurant.orders[0];clock=order.readyAt;
  await store().applyAction(room.roomId,request('restaurant-serve',{orderId:order.id},'serve'));
  clock+=RESTAURANT_DINING_MS;
  const collect=request('restaurant-collect',{orderId:order.id},'collect');
  mock.controls.loseAcknowledgment=true;
  await assert.rejects(store().applyAction(room.roomId,collect),error=>error.code==='STORAGE_UNAVAILABLE');
  const replay=await store().applyAction(room.roomId,collect);
  assert.equal(replay.duplicate,true);assert.equal(replay.state.restaurant.stats.experience,120);
  assert.equal(replay.state.xp,room.state.xp);assert.equal(replay.state.pendingGrowth.at(-1).amount,6);assert.equal(replay.state.coins,room.state.coins+28);
  assert.equal(restaurantInfo(replay.state,clock).level,2);assert.equal(replay.state.restaurant.stats.served,1);
  assert.deepEqual(replay.state.restaurant.progression,{version:2,experienceOffset:0,legacyRecipes:[]});
  await assert.rejects(store().applyAction(room.roomId,request('restaurant-collect',{orderId:order.id},'collect-other-operation')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  const loaded=await store().getRoom(room.roomId);
  assert.equal(loaded.state.xp,replay.state.xp);assert.equal(loaded.state.restaurant.stats.experience,120);
  assert.equal(mock.files.size,1);
});

test('collection rejects effective experience overflow atomically even when the earned XP ledger itself still fits',()=>{
  const state=funded();state.coins=1000;state.goldFish=0;state.xp=86;
  state.restaurant.stats.experience=Number.MAX_SAFE_INTEGER-100;
  state.restaurant.progression.experienceOffset=100;
  assert.equal(validRestaurant(state.restaurant),true);
  const started=act(state,'restaurant-start',{recipeId:'sandwich'});
  assert.ok(started);const order=started.restaurant.orders[0];
  const served=act(started,'restaurant-serve',{orderId:order.id},order.readyAt);
  assert.ok(served);const before=structuredClone(served),paidAt=order.readyAt+RESTAURANT_DINING_MS;
  assert.ok(Number.isSafeInteger(served.restaurant.stats.experience+6),'the earned ledger alone would accept this reward');
  assert.equal(Number.isSafeInteger(served.restaurant.stats.experience+served.restaurant.progression.experienceOffset+6),false);
  assert.equal(act(served,'restaurant-collect',{orderId:order.id},paidAt),null);
  assert.deepEqual(served,before,'a rejected effective XP overflow preserves the collectible order, currencies, main XP, and both restaurant XP ledgers');
  assert.equal(restaurantInfo(served,paidAt).orders[0].status,'collectible');
  assert.equal(served.coins,1000);assert.equal(served.goldFish,0);assert.equal(served.xp,86);
  assert.equal(served.restaurant.stats.experience,Number.MAX_SAFE_INTEGER-100);
  assert.deepEqual(served.restaurant.progression,{version:2,experienceOffset:100,legacyRecipes:[]});
  assert.equal(validRestaurant(served.restaurant),true);
});
