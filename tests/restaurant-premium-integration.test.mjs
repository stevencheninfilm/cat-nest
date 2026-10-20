import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, levelStartXp } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),ACTOR={id:'premium-manager',name:'店长'};
const act=(state,type,fields={},at=NOW)=>reduceAction(state,{type,...fields},ACTOR,at);
const TRAINING_STATS=['speed','stamina','endurance','skill'];
function funded({coins=200000,goldFish=500,level=50,ordinaryServed=0}={}) {
  const state=initialState(NOW);state.coins=coins;state.goldFish=goldFish;
  state.restaurant.stats.experience=levelStartXp(level);
  state.restaurant.stats.served=ordinaryServed;
  state.restaurant.stats.ordinaryServed=ordinaryServed;
  state.restaurant.nextOrderId=state.restaurant.stats.served+1;
  return state;
}
function finish(state,recipeId='rice',at=NOW) {
  let next=act(state,'restaurant-start',{recipeId},at);
  assert.ok(next,`${recipeId} can be accepted by the authoritative reducer`);
  const order=restaurantInfo(next,at).orders.at(-1);
  let deliveredAt=order.servedAt;
  if(deliveredAt===null){
    deliveredAt=order.readyAt;
    next=act(next,'restaurant-serve',{orderId:order.id},deliveredAt);
    assert.ok(next,`${recipeId} retains its valid delivery path`);
  }
  const collectAt=deliveredAt+RESTAURANT_DINING_MS;
  assert.equal(act(next,'restaurant-collect',{orderId:order.id},collectAt-1),null,'an early click earns neither currency');
  const completed=act(next,'restaurant-collect',{orderId:order.id},collectAt);
  assert.ok(completed,`${recipeId} can be collected once the cat finishes eating`);
  return {state:completed,order,at:collectAt+1,collectAt};
}
const segmentDurations=(flow,phase)=>flow.segments.filter(segment=>segment.phase===phase).map(segment=>segment.endAt-segment.startAt);

test('ordinary meals never drop gold fish while coins and pending growth still accrue exactly once',()=>{
  let state=funded({coins:1000,goldFish:0}),clock=NOW;
  const ordinary=['rice','sandwich','coffee','donut','lemontea'];
  let expectedCoins=state.coins,expectedXp=state.xp;
  for(const [index,recipeId] of ordinary.entries()){
    const before=structuredClone(state),completed=finish(state,recipeId,clock);
    expectedCoins+=completed.order.rewardCoins;expectedXp+=completed.order.rewardXp;
    assert.deepEqual(state,before,'the previous shared state is immutable');
    state=completed.state;clock=completed.at;
    assert.equal(state.goldFish,0);
    assert.equal(state.restaurant.stats.ordinaryServed,index+1);
    assert.equal(state.coins,expectedCoins);assert.equal(state.xp,funded().xp);assert.equal(state.pendingGrowth.reduce((sum,r)=>sum+r.amount,0),expectedXp-funded().xp);
    assert.equal(act(state,'restaurant-collect',{orderId:completed.order.id},clock),null,'replaying payment cannot mint a second gold fish');
  }
  const reloaded=normalizeState(JSON.parse(JSON.stringify(state)),clock+86400000);
  assert.equal(reloaded.goldFish,0);assert.equal(reloaded.restaurant.stats.ordinaryServed,5);
  assert.equal(reloaded.restaurant.stats.served,5);assert.equal(reloaded.restaurant.orders.length,0);
  const sixth=finish(reloaded,'sandwich',clock+86400000).state;
  assert.equal(sixth.goldFish,0);assert.equal(sixth.restaurant.stats.ordinaryServed,6);
});

test('special recipes require purchase and retain ownership without granting gold for ordinary diners',()=>{
  for(const recipe of SPECIAL_RESTAURANT_RECIPES){
    const state=funded({goldFish:100,level:recipe.unlockLevel,ordinaryServed:4}),coins=state.coins;
    assert.equal(act(state,'restaurant-start',{recipeId:recipe.id}),null,'a restaurant level alone cannot bypass the special recipe purchase');
    assert.equal(act(state,'restaurant-arrive',{partySize:1,recipeId:recipe.id}),null);
    const poor={...state,goldFish:recipe.unlockGold-1};
    assert.equal(act(poor,'restaurant-unlock-special',{recipeId:recipe.id}),null,'ordinary currency cannot pay a gold recipe price');
    const unlocked=act(state,'restaurant-unlock-special',{recipeId:recipe.id});
    assert.ok(unlocked,recipe.id);assert.equal(unlocked.goldFish,100-recipe.unlockGold);
    assert.equal(unlocked.coins,coins);assert.ok(unlocked.restaurant.ownedSpecialRecipes.includes(recipe.id));
    const repeated=act(unlocked,'restaurant-unlock-special',{recipeId:recipe.id});
    if(repeated){assert.equal(repeated.goldFish,unlocked.goldFish);assert.deepEqual(repeated.restaurant.ownedSpecialRecipes,unlocked.restaurant.ownedSpecialRecipes);}
    const tooYoung=structuredClone(unlocked);tooYoung.restaurant.stats.served=0;tooYoung.restaurant.stats.ordinaryServed=0;tooYoung.restaurant.stats.experience=0;
    assert.ok(act(tooYoung,'restaurant-start',{recipeId:recipe.id}),'a permanently purchased special remains available after migration or a lower displayed restaurant level');
    const completed=finish(unlocked,recipe.id);
    assert.equal(completed.state.goldFish,unlocked.goldFish);
    assert.equal(completed.state.restaurant.stats.ordinaryServed,4,'a special payment does not advance the ordinary milestone');
    assert.equal(completed.state.coins,unlocked.coins+completed.order.rewardCoins);
    assert.equal(completed.state.xp,unlocked.xp);assert.equal(completed.state.pendingGrowth.at(-1).amount,completed.order.rewardXp);
    const fifthOrdinary=finish(completed.state,'sandwich',completed.at).state;
    assert.equal(fifthOrdinary.goldFish,unlocked.goldFish);assert.equal(fifthOrdinary.restaurant.stats.ordinaryServed,5);
  }
});

test('previously purchased signatures remain owned at zero gold without a price difference charge',()=>{
  const state=funded({goldFish:0});
  state.restaurant.ownedSpecialRecipes=SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id);
  Object.assign(state.restaurant.research,{draws:3,lastDraw:{draw:3,recipeId:'gold-latte',amount:3}});
  for(const recipe of SPECIAL_RESTAURANT_RECIPES){
    state.restaurant.recipeLevels[recipe.id]=3;
    state.restaurant.research.fragments[recipe.id]=3;
  }
  assert.equal(validRestaurant(state.restaurant),true);
  const loaded=normalizeState(JSON.parse(JSON.stringify(state)),NOW+1000);
  assert.equal(loaded.goldFish,0);assert.equal(loaded.coins,state.coins);
  assert.deepEqual(loaded.restaurant.ownedSpecialRecipes,state.restaurant.ownedSpecialRecipes);
  const info=restaurantInfo(loaded,NOW+1000);
  for(const recipe of SPECIAL_RESTAURANT_RECIPES){
    assert.ok(info.recipes.some(item=>item.id===recipe.id));
    assert.equal(loaded.restaurant.recipeLevels[recipe.id],3);
    assert.equal(loaded.restaurant.research.fragments[recipe.id],3);
    assert.equal(act(loaded,'restaurant-unlock-special',{recipeId:recipe.id}),null);
  }
});

test('the last three employees cost 5, 8 and 12 gold fish and never also charge their old coin prices',()=>{
  let state=funded({goldFish:25});
  for(const cost of [220,650,1400]){
    const before=state;state=act(state,'restaurant-hire');
    assert.ok(state);assert.equal(state.coins,before.coins-cost);assert.equal(state.goldFish,before.goldFish);
  }
  const coins=state.coins;
  for(const amount of [5,8,12]){
    const poor={...state,goldFish:amount-1},before=structuredClone(poor);
    assert.equal(act(poor,'restaurant-hire'),null);assert.deepEqual(poor,before);
    const previousGold=state.goldFish,previousCount=state.restaurant.staff;
    state=act(state,'restaurant-hire');assert.ok(state);
    assert.equal(state.goldFish,previousGold-amount);assert.equal(state.coins,coins);
    assert.equal(state.restaurant.staff,previousCount+1);
    assert.equal(Object.keys(state.restaurant.staffTraining).length,state.restaurant.staff+1);
  }
  assert.equal(state.goldFish,0);assert.equal(state.restaurant.staff,6);
  assert.equal(act(state,'restaurant-hire'),null,'the existing employee ceiling remains authoritative');
});

test('premium decorations charge only gold on first purchase and remain owned when switching themes',()=>{
  let state=funded({goldFish:26}),coins=state.coins;
  for(const [themeId,cost] of [['starlight',6],['glass',8],['royal',12]]){
    assert.equal(act({...state,goldFish:cost-1},'restaurant-theme',{themeId}),null);
    const beforeGold=state.goldFish;state=act(state,'restaurant-theme',{themeId});
    assert.ok(state);assert.equal(state.goldFish,beforeGold-cost);assert.equal(state.coins,coins);
    assert.equal(state.restaurant.theme,'cream');assert.ok(state.restaurant.equippedPremiumDecorations.includes(themeId));assert.ok(state.restaurant.ownedThemes.includes(themeId));
  }
  assert.equal(state.goldFish,0);
  for(const themeId of ['starlight','glass','royal']){
    state=act(state,'restaurant-premium-decoration',{themeId,equipped:false});assert.ok(state);
    state=act(state,'restaurant-premium-decoration',{themeId,equipped:true});assert.ok(state);
    assert.equal(state.goldFish,0);assert.equal(state.coins,coins);
  }
});

test('each of seven employees has four independent ten-level abilities with gold prices only for levels 8–10',()=>{
  let state=funded();
  for(let index=0;index<6;index++){state=act(state,'restaurant-hire');assert.ok(state);}
  const coinCosts=[80,130,200,300,440,620],goldCosts=[2,4,7];
  for(let workerNumber=1;workerNumber<=7;workerNumber++){
    const workerId=`worker-${workerNumber}`;
    for(const statId of TRAINING_STATS){
      for(let targetLevel=2;targetLevel<=10;targetLevel++){
        const before=state,beforeTraining=structuredClone(state.restaurant.staffTraining);
        state=act(state,'restaurant-train',{workerId,statId});assert.ok(state,`${workerId} ${statId} reaches ${targetLevel}`);
        assert.equal(state.restaurant.staffTraining[workerId].levels[statId],targetLevel);
        assert.equal(state.coins,before.coins-(targetLevel<=7?coinCosts[targetLevel-2]:0));
        assert.equal(state.goldFish,before.goldFish-(targetLevel>=8?goldCosts[targetLevel-8]:0));
        for(const [id,record] of Object.entries(beforeTraining))for(const otherStat of TRAINING_STATS)if(id!==workerId||otherStat!==statId)assert.equal(state.restaurant.staffTraining[id].levels[otherStat],record.levels[otherStat]);
      }
      assert.equal(act(state,'restaurant-train',{workerId,statId}),null,'level ten is final');
    }
  }
  assert.equal(state.restaurant.stats.served,0,'employee training cannot level the restaurant');
  assert.equal(restaurantInfo(state,NOW).level,50);
  assert.equal(state.restaurant.stats.experience,levelStartXp(50),'training never changes earned restaurant XP');
  assert.deepEqual(state.restaurant.levels,{kitchen:1,fridge:1,tables:1,tips:1});
  assert.equal(validRestaurant(state.restaurant),true);
});

test('new training intents reject forged prices, levels, energy and workers outside the hired team',()=>{
  const state=funded(),valid={type:'restaurant-train',workerId:'worker-1',statId:'speed'};
  assert.deepEqual(sanitizeRestaurantAction(valid),valid);
  for(const extra of [{amount:0},{goldFish:999},{level:10},{levels:{speed:10}},{energy:999},{energyCost:0},{now:0}]){
    assert.equal(sanitizeRestaurantAction({...valid,...extra}),null);
    assert.equal(reduceAction(state,{...valid,...extra},ACTOR,NOW),null);
  }
  const unlock={type:'restaurant-unlock-special',recipeId:'gold-salmon'};
  assert.deepEqual(sanitizeRestaurantAction(unlock),unlock);
  for(const extra of [{unlockGold:0},{amount:0},{goldFish:999},{ownedSpecialRecipes:['gold-salmon']}]){
    assert.equal(sanitizeRestaurantAction({...unlock,...extra}),null);
    assert.equal(reduceAction(state,{...unlock,...extra},ACTOR,NOW),null);
  }
  for(const fields of [{workerId:'worker-2',statId:'speed'},{workerId:'worker-0',statId:'skill'},{workerId:'worker-1',statId:'coins'}])assert.equal(act(state,'restaurant-train',fields),null);
  assert.equal(act({...state,coins:0},'restaurant-train',{workerId:'worker-1',statId:'speed'}),null);
  let levelSeven=state;
  for(let index=0;index<6;index++)levelSeven=act(levelSeven,'restaurant-train',{workerId:'worker-1',statId:'speed'});
  const poor={...levelSeven,goldFish:1},before=structuredClone(poor);
  assert.equal(act(poor,'restaurant-train',{workerId:'worker-1',statId:'speed'}),null);
  assert.deepEqual(poor,before,'insufficient gold cannot partly mutate the employee ledger');
});

test('accepted detailed orders persist training and stamina through reload and later training affects only new orders',()=>{
  const initial=funded(),first=act(initial,'restaurant-start',{recipeId:'rice'});
  assert.ok(first);const saved=structuredClone(first.restaurant.orders[0].workflow),record=first.restaurant.staffTraining['worker-1'];
  assert.deepEqual(saved.workerLevels,{speed:1,stamina:1,endurance:1,skill:1});
  assert.equal(saved.energyCost,48);assert.equal(record.energy,152);assert.equal(record.energyAt,saved.completedAt);
  const reloaded=normalizeState(JSON.parse(JSON.stringify(first)),NOW+1000);
  assert.deepEqual(reloaded.restaurant.staffTraining,first.restaurant.staffTraining);
  assert.deepEqual(reloaded.restaurant.orders[0].workflow,saved);
  let trained=act(reloaded,'restaurant-train',{workerId:'worker-1',statId:'speed'},NOW+1000);
  trained=act(trained,'restaurant-train',{workerId:'worker-1',statId:'skill'},NOW+1000);assert.ok(trained);
  assert.deepEqual(trained.restaurant.orders[0].workflow,saved,'already accepted movement and work retain their original durations');
  assert.equal(trained.restaurant.staffTraining['worker-1'].energy,152,'training during reserved work does not regenerate stamina');
  const second=act(trained,'restaurant-start',{recipeId:'rice'},NOW+1000);assert.ok(second);
  const next=second.restaurant.orders[1].workflow;
  assert.equal(next.workerLevels.speed,2);assert.equal(next.workerLevels.skill,2);
  assert.ok(segmentDurations(next,'work').every((duration,index)=>duration<segmentDurations(saved,'work')[index]));
  assert.ok(segmentDurations(next,'delivery').every((duration,index)=>duration<=segmentDurations(saved,'delivery')[index]));
  assert.equal(second.restaurant.staffTraining['worker-1'].energy,104);
  assert.equal(second.restaurant.staffTraining['worker-1'].energyAt,next.completedAt);
  const firstCollectedAt=saved.servedAt+RESTAURANT_DINING_MS;
  const paid=act(second,'restaurant-collect',{orderId:second.restaurant.orders[0].id},firstCollectedAt);assert.ok(paid);
  assert.equal(paid.restaurant.orders.length,1);assert.equal(validRestaurant(paid.restaurant),true);
  const third=act(paid,'restaurant-start',{recipeId:'rice'},firstCollectedAt+1);assert.ok(third);
  const thirdFlow=third.restaurant.orders.at(-1).workflow,departAt=thirdFlow.segments.find(segment=>segment.phase!=='wait').startAt;
  assert.equal(departAt,next.completedAt,'the third rice order can start after the reserved return with the larger capacity');
  assert.equal(third.restaurant.staffTraining['worker-1'].energy,56);
  assert.equal(third.restaurant.staffTraining['worker-1'].energyAt,thirdFlow.completedAt);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(third)),firstCollectedAt+1000).restaurant.staffTraining,third.restaurant.staffTraining);
});

test('legacy homes receive zero gold and locked special recipes while retaining wallet, progress and active orders',()=>{
  const legacy=initialState(NOW);legacy.coins=417;legacy.xp=177;
  delete legacy.restaurant.progression;delete legacy.goldFish;delete legacy.restaurant.ownedSpecialRecipes;delete legacy.restaurant.staffTraining;delete legacy.restaurant.parties;
  legacy.restaurant.staff=3;legacy.restaurant.stats={served:9,earned:300,experience:90};legacy.restaurant.nextOrderId=11;
  const oldOrder={id:'table-10',recipeId:'rice',createdAt:NOW,readyAt:NOW+6080,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:3,actorId:ACTOR.id};
  legacy.restaurant.orders=[oldOrder];
  for(const recipe of SPECIAL_RESTAURANT_RECIPES.filter(recipe=>!['sushi','pizza'].includes(recipe.id)))delete legacy.restaurant.recipeLevels[recipe.id];
  const before=structuredClone(legacy),restored=normalizeState(legacy,NOW+1000);
  assert.equal(restored.goldFish,0);assert.equal(restored.coins,417);assert.equal(restored.xp,177);
  assert.equal(restored.restaurant.stats.served,9);assert.equal(restored.restaurant.stats.earned,300);
  assert.ok(Number.isSafeInteger(restored.restaurant.stats.ordinaryServed));
  assert.ok(restored.restaurant.stats.ordinaryServed>=0&&restored.restaurant.stats.ordinaryServed<=9);
  assert.deepEqual(restored.restaurant.ownedSpecialRecipes,[]);assert.deepEqual(restored.restaurant.orders,[oldOrder]);
  assert.equal(Object.keys(restored.restaurant.staffTraining).length,4);
  for(const record of Object.values(restored.restaurant.staffTraining))assert.deepEqual(record.levels,{speed:1,stamina:1,endurance:1,skill:1});
  assert.equal(validRestaurant(restored.restaurant),true);assert.deepEqual(legacy,before);
  const again=normalizeState(JSON.parse(JSON.stringify(restored)),NOW+86400000);
  assert.equal(again.goldFish,0);assert.equal(again.restaurant.stats.served,9);
});

test('a full gold wallet does not block ordinary meal payment because it grants no gold',()=>{
  const state=funded({goldFish:999999,ordinaryServed:4}),started=act(state,'restaurant-start',{recipeId:'donut'});
  assert.ok(started);const order=started.restaurant.orders[0],served=act(started,'restaurant-serve',{orderId:order.id},order.readyAt);
  const before=structuredClone(served),collectAt=order.readyAt+RESTAURANT_DINING_MS;
  const completed=act(served,'restaurant-collect',{orderId:order.id},collectAt);assert.ok(completed);assert.equal(completed.goldFish,999999);assert.equal(completed.restaurant.orders.length,0);assert.deepEqual(served,before);
  assert.equal(served.restaurant.stats.ordinaryServed,4);assert.equal(served.restaurant.orders.length,1);
  const paid=act({...served,goldFish:999998},'restaurant-collect',{orderId:order.id},collectAt);
  assert.ok(paid);assert.equal(paid.goldFish,999998);assert.equal(paid.restaurant.stats.ordinaryServed,5);
  assert.equal(paid.restaurant.orders.length,0);
});
