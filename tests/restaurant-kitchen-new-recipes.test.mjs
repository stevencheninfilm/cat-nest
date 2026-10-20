import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction, levelStartXp } from '../src/state.js';
import { restaurantActionResult, restaurantInfo, restaurantRecipe, normalizeRestaurant, validRestaurant, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { KITCHEN_FLOWS, kitchenInfo, validKitchenWorkflow, validKitchenReservations } from '../src/restaurant-kitchen.js';
import { createInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { normalizeStaffTraining, workerStepEnergyCost } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-18T23:00:00Z'),ACTOR={id:'new-recipe-manager',name:'店长'};
const NEW_RECIPES=['sandwich','lemontea','donut','pancake','pudding','matcha','burger','udon','waffle','strawberrymilk','gold-salmon','sushi','pizza','grape','parfait','gold-sundae','cheesecake','gold-latte','cocoa'];
function fixture({staff=0,level=50}={}){
  const state=initialState(NOW);state.coins=90000;state.restaurant.stats.experience=levelStartXp(level);
  state.restaurant.ownedSpecialRecipes=['gold-salmon','sushi','pizza','gold-sundae','gold-latte'];for(const id of state.restaurant.ownedSpecialRecipes)state.restaurant.recipeLevels[id]=1;
  state.restaurant.staff=staff;state.restaurant.staffTraining=normalizeStaffTraining(null,NOW,staff);
  assert.equal(validRestaurant(state.restaurant),true);return state;
}
function act(state,action,at=NOW){
  const result=restaurantActionResult(state,action,ACTOR,at);assert.equal(result.ok,true,result.reason);
  const next=reduceAction(state,action,ACTOR,at);assert.ok(next);
  if(result.growthReward)assert.equal(next.pendingGrowth.at(-1).amount,result.growthReward.amount);
  assert.equal(validRestaurant(next.restaurant),true);assert.equal(validKitchenReservations(next.restaurant),true);return next;
}
const order=(state,id)=>state.restaurant.orders.find(o=>o.id===id);
const step=(state,id,stepId,at)=>act(state,{type:'restaurant-kitchen-step',orderId:id,stepId},at);
function arrive(state,recipeId,at=NOW){const next=act(state,{type:'restaurant-arrive',recipeId,partySize:1},at);return {state:next,id:next.restaurant.orders.at(-1).id};}
function prepare(state,id,at=order(state,id).createdAt){
  if(order(state,id).workflow.acceptedAt===null)state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
  for(const operation of KITCHEN_FLOWS[order(state,id).recipeId].slice(order(state,id).workflow.runs.length)){
    const previous=order(state,id).workflow.runs.at(-1);at=Math.max(at,previous?.endAt??0,previous?.rest?.fullAt??0);
    state=step(state,id,operation.id,at);const run=order(state,id).workflow.runs.at(-1);at=run.rest?.fullAt??run.endAt;
  }
  return {state,at};
}
const workDurations=workflow=>workflow.segments.filter(s=>s.phase==='work').map(s=>s.endAt-s.startAt);

test('gold salmon still needs its real premium purchase, then completes its full manual meal without dish-based gold',()=>{
  let state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(20);state.goldFish=30;
  assert.equal(restaurantActionResult(state,{type:'restaurant-arrive',partySize:1,recipeId:'gold-salmon'},ACTOR,NOW).ok,false);
  state=act(state,{type:'restaurant-unlock-special',recipeId:'gold-salmon'});assert.equal(state.goldFish,0);assert.equal(state.coins,100);
  let id;({state,id}=arrive(state,'gold-salmon'));assert.equal(order(state,id).workflow.version,4);
  const prepared=prepare(state,id);state=step(prepared.state,id,'delivery',prepared.at);
  const servedAt=order(state,id).workflow.servedAt;assert.equal(state.goldFish,0);
  state=act(state,{type:'restaurant-collect',orderId:id},servedAt+RESTAURANT_DINING_MS);
  assert.equal(state.goldFish,0);assert.equal(state.restaurant.stats.ordinaryServed,0);assert.ok(state.restaurant.ownedSpecialRecipes.includes('gold-salmon'));
  assert.equal(restaurantActionResult(state,{type:'restaurant-collect',orderId:id},ACTOR,servedAt+RESTAURANT_DINING_MS+1).ok,false);
});

test('nineteen newly detailed recipes declare their real preparation stations, props and completed dish',()=>{
  const expected={
    sandwich:{ids:['gather','wash-salad','slice-salad','toast-bread','spread-sauce','assemble-sandwich','plate-sandwich'],zones:[10,7,6,3,9,8,3],durations:[3000,2500,3000,3000,1800,3000,2200],props:['ingredients-sandwich','washing-salad','board-salad','toast-bread','sandwich-sauce','sandwich-assembly','sandwich']},
    lemontea:{ids:['gather','wash-lemon','slice-lemon','brew-tea','mix-lemontea','package-lemontea'],zones:[10,7,6,4,1,2],durations:[3000,2200,2500,3500,3000,1800],props:['ingredients-lemontea','washing-lemon','board-lemon','tea-pot','lemontea-mixing','lemontea']},
    donut:{ids:['gather','wash-donut-strawberries','slice-donut-strawberries','knead-donut-dough','proof-donut-dough','shape-donut-rings','fry-donut-rings','cool-donut-rings','mash-donut-strawberries','mix-donut-glaze','dip-donut-glaze','finish-donut'],zones:[10,7,6,8,8,6,5,8,8,9,3,3],durations:[3000,2200,2800,3500,5000,3000,5000,3000,2800,2800,2800,2200],props:['ingredients-donut','washing-berries','board-strawberries','pizza-kneading','pizza-proofing','donut-shaping','donut-frying','donut-cooling','strawberry-puree','donut-glaze','donut-dipping','donut']},
    pancake:{ids:['gather','mix-pancake-batter','grease-pancake-pan','pour-pancake-batter','flip-pancakes','plate-pancake'],zones:[10,8,5,5,5,3],durations:[3000,3500,1800,2200,4500,2200],props:['ingredients-pancake','sweet-batter','butter-pan','pancake-pouring','pancake-griddle','pancake']},
    pudding:{ids:['gather','cook-caramel','mix-custard','strain-custard','steam-pudding','plate-pudding'],zones:[10,4,8,8,4,3],durations:[3000,3500,3000,2500,5000,3000],props:['ingredients-pudding','caramel-pot','sweet-batter','custard-molds','pudding-steamer','pudding']},
    matcha:{ids:['gather','sift-matcha','warm-matcha-milk','whisk-matcha','whip-milk-cap','mix-matcha-milk','package-matcha'],zones:[10,8,4,1,8,1,2],durations:[3000,2200,2800,3500,3500,2500,2200],props:['ingredients-matcha','matcha-sifting','milk-pitcher','matcha-whisking','cream-whipping','matcha-mixing','matcha']},
    burger:{ids:['gather','wash-burger-salad','slice-burger-salad','shape-burger-patty','toast-burger-buns','grill-cheese-patty','assemble-burger','plate-burger'],zones:[10,7,6,8,3,5,8,3],durations:[3000,2500,3000,3000,2500,5000,3000,1800],props:['ingredients-burger','washing-salad','board-salad','burger-patty','burger-buns','burger-grill','burger-assembly','burger']},
    udon:{ids:['gather','rinse-udon-toppings','prep-udon-shrimp','simmer-udon-broth','boil-udon','cook-udon-shrimp','boil-udon-egg','plate-udon'],zones:[10,7,6,4,4,5,4,3],durations:[3000,2200,3200,3200,4200,3500,4000,2500],props:['ingredients-udon','rinsing-udon','board-shrimp','udon-broth','udon-pot','shrimp-pan','egg-pot','udon']},
    waffle:{ids:['gather','wash-waffle-berries','mix-waffle-batter','fill-waffle-iron','bake-waffle','plate-waffle'],zones:[10,7,8,3,3,3],durations:[3000,2200,3500,2500,5000,2500],props:['ingredients-waffle','washing-berries','sweet-batter','waffle-pouring','waffle-baking','waffle']},
    strawberrymilk:{ids:['gather','wash-strawberries','slice-strawberries','macerate-strawberries','mix-strawberrymilk','package-strawberrymilk'],zones:[10,7,6,8,1,2],durations:[3000,2200,2800,3000,3000,1800],props:['ingredients-strawberrymilk','washing-berries','board-strawberries','strawberry-puree','strawberrymilk-pouring','strawberrymilk']},
    'gold-salmon':{ids:['gather','wash-salmon-rice','steam-salmon-rice','cut-salmon','season-gold-salmon','sear-salmon','blanch-salmon-broccoli','assemble-salmon-bowl','finish-gold-salmon'],zones:[10,7,4,6,9,5,4,8,3],durations:[3200,2800,5000,3200,2000,5000,3000,3000,2200],props:['ingredients-gold-salmon','rinsing-rice','rice-cooker','board-salmon','seasonings','salmon-pan','broccoli-pot','salmon-bowl-assembly','gold-salmon']},
    sushi:{"ids":["gather","wash-sushi-rice","steam-sushi-rice","mix-sushi-vinegar","fold-sushi-rice","slice-sushi-filling","roll-sushi-maki","slice-sushi-maki","shape-sushi-nigiri","plate-sushi"],"zones":[10,7,4,9,8,6,8,6,8,3],"durations":[3200,2800,5000,2000,3000,3200,3500,2600,3000,2400],"props":["ingredients-sushi","sushi-rinsing","rice-cooker","sushi-vinegar","sushi-rice","sushi-salmon-board","sushi-rolling","sushi-maki-board","sushi-nigiri","sushi"]},
    pizza:{"ids":["gather","wash-pizza-vegetables","slice-pizza-tomatoes","knead-pizza-dough","proof-pizza-dough","stretch-pizza-base","spread-pizza-sauce","top-pizza","bake-pizza","slice-pizza"],"zones":[10,7,6,8,8,8,9,8,3,3],"durations":[3000,2200,2800,3500,5000,3000,2200,3000,5500,2200],"props":["ingredients-pizza","pizza-washing","pizza-board","pizza-kneading","pizza-proofing","pizza-stretching","pizza-sauce","pizza-toppings","pizza-baking","pizza"]},
    grape:{"ids":["gather","wash-grapes","crush-grapes","boil-grape-pearls","brew-grape-tea","mix-grape-milk-tea","whip-grape-cream","assemble-grape-boba","package-grape"],"zones":[10,7,8,4,4,1,8,1,2],"durations":[3000,2200,3000,4500,3500,3000,3500,2500,2200],"props":["ingredients-grape","grape-washing","grape-crushing","grape-pearls","tea-pot","grape-milk-tea","cream-whipping","grape-assembling","grape"]},
    parfait:{"ids":["gather","wash-parfait-berries","slice-parfait-strawberries","macerate-parfait-berries","whip-parfait-cream","layer-parfait","scoop-parfait","finish-parfait"],"zones":[10,7,6,8,8,2,1,2],"durations":[3000,2200,2800,3000,3500,3000,2800,2200],"props":["ingredients-parfait","washing-berries","board-strawberries","strawberry-puree","cream-whipping","parfait-layers","parfait-scooping","parfait"]},
    "gold-sundae":{"ids":["gather","wash-gold-sundae-berries","slice-gold-sundae-berries","macerate-gold-sundae-sauce","mix-fish-cookie-dough","stamp-fish-cookies","bake-fish-cookies","whip-gold-sundae-cream","layer-gold-sundae","scoop-gold-sundae","decorate-gold-sundae","finish-gold-sundae"],"zones":[10,7,6,8,8,8,3,8,2,1,2,3],"durations":[3200,2200,2800,3000,3500,3000,5000,3500,3000,2800,3000,2200],"props":["ingredients-gold-sundae","washing-berries","board-strawberries","strawberry-puree","fish-cookie-dough","fish-cookie-stamping","fish-cookie-baking","cream-whipping","gold-sundae-layers","gold-sundae-scooping","gold-sundae-decorating","gold-sundae"]},
    "cheesecake":{"ids":["gather","beat-cheesecake-cheese","mix-cheesecake-eggs","fold-cheesecake-batter","pour-cheesecake-mold","bake-cheesecake","chill-cheesecake","wash-cheesecake-berries","slice-cheesecake","plate-cheesecake"],"zones":[10,8,8,8,3,3,10,7,6,3],"durations":[3200,3500,3000,3200,2800,6500,4500,2200,3200,2200],"props":["ingredients-cheesecake","cheesecake-cheese","cheesecake-eggs","cheesecake-batter","cheesecake-mold","cheesecake-baking","cheesecake-chilling","washing-berries","cheesecake-slicing","cheesecake"]},
    "gold-latte":{"ids":["gather","warm-gold-latte-cup","extract-gold-latte","steam-gold-latte-milk","pour-gold-latte","draw-gold-latte-art","apply-gold-latte-leaf","plate-gold-latte"],"zones":[10,4,1,1,1,2,3,2],"durations":[3000,2000,4000,3500,3000,3000,2000,1800],"props":["ingredients-gold-latte","gold-latte-cup","coffee-espresso","milk-pitcher","gold-latte-pouring","gold-latte-art","gold-latte-leaf","gold-latte"]},
    "cocoa":{"ids":["gather","sift-cocoa","chop-cocoa-chocolate","warm-cocoa-milk","melt-cocoa-chocolate","whisk-cocoa","pour-cocoa","finish-cocoa"],"zones":[10,8,6,4,4,1,1,2],"durations":[3000,2000,2800,2800,4000,2800,2500,2200],"props":["ingredients-cocoa","cocoa-sifting","cocoa-chocolate-board","milk-pitcher","cocoa-melting","cocoa-whisking","cocoa-pouring","cocoa"]},
  };
  for(const recipeId of NEW_RECIPES){const flow=KITCHEN_FLOWS[recipeId],contract=expected[recipeId];assert.deepEqual(flow.map(s=>s.id),contract.ids);assert.deepEqual(flow.map(s=>s.zoneId),contract.zones);assert.deepEqual(flow.map(s=>s.durationMs),contract.durations);assert.deepEqual(flow.map(s=>s.prop),contract.props);assert.equal(flow.at(-1).carrying,recipeId);assert.ok(Object.isFrozen(flow)&&flow.every(Object.isFrozen));}
});

test('each new normal arrival requires acceptance, every player click, explicit delivery and dining before a single reward',async t=>{
  for(const recipeId of NEW_RECIPES)await t.test(recipeId,()=>{
    let {state,id}=arrive(fixture(),recipeId),saved=order(state,id),at=saved.createdAt;
    assert.equal(saved.workflow.version,4);assert.equal(saved.workflow.acceptedAt,null);assert.equal(saved.workflow.runs.length,0);assert.equal(saved.readyAt,saved.createdAt);
    assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-accept',orderId:id},ACTOR,at-1).ok,false);
    assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},ACTOR,at).ok,false);
    assert.equal(restaurantInfo(state,at+86400000).orders[0].status,'requested');
    state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);const wallet={coins:state.coins,xp:state.xp};
    for(const operation of KITCHEN_FLOWS[recipeId]){
      const before=structuredClone(state);state=step(state,id,operation.id,at);saved=order(state,id);const run=saved.workflow.runs.at(-1);
      const cost=workerStepEnergyCost(run.energyLevels,saved.workflow.stepEnergyBase??10);assert.equal(run.energyCost,cost);assert.equal(run.energyBefore-run.energyAfter,Math.min(cost,run.energyBefore));assert.equal(saved.workflow.servedAt,null);
      for(const early of [at,run.endAt-1])assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:id,stepId:operation.id},ACTOR,early).ok,false);
      assert.equal(restaurantActionResult(state,{type:'restaurant-collect',orderId:id},ACTOR,run.endAt+86400000).ok,false);
      const future=kitchenInfo(state.restaurant,run.endAt+86400000).orders.find(o=>o.id===id);assert.equal(future.steps.filter(s=>s.status==='complete').length,saved.workflow.runs.length);
      assert.equal(state.coins,wallet.coins);assert.equal(state.xp,wallet.xp);assert.equal(before.restaurant.orders[0].workflow.runs.length,saved.workflow.runs.length-1);
      at=run.rest?.fullAt??run.endAt;
    }
    saved=order(state,id);assert.equal(restaurantInfo(state,at).orders[0].status,'dish-ready');assert.equal(saved.workflow.readyAt,saved.workflow.runs.at(-1).endAt);assert.equal(saved.workflow.servedAt,null);
    state=step(state,id,'delivery',at);const workflow=order(state,id).workflow;
    assert.equal(restaurantInfo(state,workflow.servedAt-1).orders[0].status,'delivering');assert.equal(restaurantInfo(state,workflow.servedAt).orders[0].status,'dining');
    assert.equal(restaurantActionResult(state,{type:'restaurant-collect',orderId:id},ACTOR,workflow.servedAt+RESTAURANT_DINING_MS-1).ok,false);
    const reward=restaurantInfo(state,workflow.servedAt+RESTAURANT_DINING_MS).orders.find(item=>item.id===id);
    state=act(state,{type:'restaurant-collect',orderId:id},workflow.servedAt+RESTAURANT_DINING_MS);
    assert.equal(state.coins,wallet.coins+reward.rewardCoins);assert.equal(state.xp,wallet.xp);assert.equal(state.pendingGrowth.at(-1).amount,reward.rewardXp);assert.equal(state.restaurant.stats.served,1);assert.equal(state.restaurant.orders.length,0);
    assert.equal(restaurantActionResult(state,{type:'restaurant-collect',orderId:id},ACTOR,workflow.servedAt+RESTAURANT_DINING_MS+1).ok,false);
  });
});

test('work progress begins only on reaching a station and advances through the same authoritative interval',()=>{
  for(const recipeId of NEW_RECIPES){
    let {state,id}=arrive(fixture(),recipeId),at=order(state,id).createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
    for(const operation of KITCHEN_FLOWS[recipeId]){
      state=step(state,id,operation.id,at);const flow=order(state,id).workflow,work=flow.segments.find(s=>s.phase==='work'&&s.stepId===operation.id);
      assert.ok(work.startAt>=at,'work cannot begin before the click; consecutive operations may share a station');
      const before=kitchenInfo(state.restaurant,work.startAt-1),midAt=Math.floor((work.startAt+work.endAt)/2),mid=kitchenInfo(state.restaurant,midAt);
      assert.equal(before.orders[0].steps.find(s=>s.id===operation.id).progress,0);if(work.startAt>at)assert.equal(before.zones.find(z=>z.id===operation.zoneId).occupant,null);
      const zone=mid.zones.find(z=>z.id===operation.zoneId);assert.equal(zone.occupant.orderId,id);assert.equal(zone.occupant.startAt,work.startAt);assert.equal(zone.occupant.endAt,work.endAt);assert.equal(zone.occupant.progress,(midAt-work.startAt)/(work.endAt-work.startAt));
      assert.equal(mid.orders[0].steps.find(s=>s.id===operation.id).progress,zone.occupant.progress);
      assert.equal(kitchenInfo(state.restaurant,work.endAt).zones.find(z=>z.id===operation.zoneId).occupant,null);at=flow.runs.at(-1).rest?.fullAt??work.endAt;
    }
  }
});

test('two employees making equal or different new dishes wait for a shared fridge and sink without overlapping work',()=>{
  for(const recipes of [['sandwich','sandwich'],['lemontea','lemontea'],['sandwich','lemontea'],['burger','sandwich'],['pancake','matcha'],['udon','waffle'],['strawberrymilk','gold-salmon'],['sushi','pizza'],['grape','parfait'],['cheesecake','cocoa'],['gold-sundae','udon'],['gold-latte','gold-latte']]){
    const first=arrive(fixture({staff:1}),recipes[0]),second=arrive(first.state,recipes[1],NOW+1);let state=second.state;const ids=[first.id,second.id],at=Math.max(...state.restaurant.orders.map(o=>o.createdAt));
    for(const id of ids)state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
    state=step(state,first.id,'gather',at);const firstGather=order(state,first.id).workflow.runs[0],before=structuredClone(state);
    const blocked=restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:second.id,stepId:'gather'},ACTOR,at);assert.equal(blocked.ok,false);assert.match(blocked.reason,/工位/);assert.deepEqual(state,before);
    assert.equal(order(state,second.id).workflow.workerId,null);assert.equal(state.restaurant.staffTraining['worker-2'].energy,200);
    state=step(state,second.id,'gather',firstGather.endAt);const secondGather=order(state,second.id).workflow.runs[0];
    assert.equal(order(state,first.id).workflow.workerId,'worker-1');assert.equal(order(state,second.id).workflow.workerId,'worker-2');
    const firstWash=KITCHEN_FLOWS[recipes[0]][1],secondWash=KITCHEN_FLOWS[recipes[1]][1];state=step(state,first.id,firstWash.id,secondGather.endAt-300);
    const wash=order(state,first.id).workflow.runs.at(-1),waiting=structuredClone(state);assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:second.id,stepId:secondWash.id},ACTOR,secondGather.endAt).ok,false);assert.deepEqual(state,waiting);
    assert.equal(kitchenInfo(state.restaurant,secondGather.endAt).orders.find(o=>o.id===second.id).nextStep.id,secondWash.id);
    state=step(state,second.id,secondWash.id,wash.endAt);let clock=order(state,second.id).workflow.runs.at(-1).endAt;
    for(const id of ids){const result=prepare(state,id,clock);state=result.state;clock=result.at;state=step(state,id,'delivery',clock);clock=order(state,id).workflow.completedAt;}
    const flows=state.restaurant.orders.map(o=>o.workflow);assert.equal(new Set(flows.flatMap(f=>f.runs.map(run=>run.workerId??f.workerId))).size,2);assert.equal(validKitchenReservations(state.restaurant),true);
    for(const left of flows[0].segments.filter(s=>s.phase==='work'))for(const right of flows[1].segments.filter(s=>s.phase==='work'))if(left.zoneId===right.zoneId)assert.ok(left.endAt<=right.startAt||right.endAt<=left.startAt);
  }
});

test('facility and employee upgrades shorten the appropriate new operations while saved runs stay unchanged',()=>{
  for(const recipeId of NEW_RECIPES){
    const base=fixture({level:50}),fridge=act(base,{type:'restaurant-upgrade',upgradeId:'fridge'}),kitchen=act(base,{type:'restaurant-upgrade',upgradeId:'kitchen'}),skilled=act(base,{type:'restaurant-train',workerId:'worker-1',statId:'skill'});
    const make=state=>{const arrival=arrive(state,recipeId);return prepare(arrival.state,arrival.id).state.restaurant.orders[0].workflow;};
    const original=make(base),cold=make(fridge),hot=make(kitchen),skill=make(skilled),durations=workDurations(original);
    for(const [index,operation] of KITCHEN_FLOWS[recipeId].entries()){
      if(operation.zoneId===10){assert.ok(workDurations(cold)[index]<durations[index]);assert.equal(workDurations(hot)[index],durations[index]);}
      else{assert.equal(workDurations(cold)[index],durations[index]);assert.ok(workDurations(hot)[index]<durations[index]);}
    }
    assert.ok(workDurations(skill).every((d,i)=>d<durations[i]));
    let {state,id}=arrive(base,recipeId),at=order(state,id).createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);state=step(state,id,'gather',at);const saved=structuredClone(order(state,id).workflow);at=saved.runs[0].endAt;
    state=act(state,{type:'restaurant-upgrade',upgradeId:'kitchen'},at);state=act(state,{type:'restaurant-upgrade',upgradeId:'fridge'},at);assert.deepEqual(order(state,id).workflow,saved);
  }
});

test('clicked new recipes survive refresh during walking, work, player pauses, delivery and return without new deductions',()=>{
  for(const recipeId of NEW_RECIPES){
    let {state,id}=arrive(fixture(),recipeId),at=order(state,id).createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);state=step(state,id,'gather',at);
    const gathered=order(state,id).workflow,work=gathered.segments.find(s=>s.phase==='work');
    for(const time of [at,work.startAt+1,work.endAt+999999]){const restored=normalizeState(JSON.parse(JSON.stringify(state)),time);assert.deepEqual(restored.restaurant,state.restaurant);assert.deepEqual(kitchenInfo(restored.restaurant,time),kitchenInfo(state.restaurant,time));}
    const prepared=prepare(state,id,work.endAt);state=step(prepared.state,id,'delivery',prepared.at);const flow=order(state,id).workflow;
    for(const time of [prepared.at,flow.servedAt,flow.completedAt]){const restored=normalizeState(JSON.parse(JSON.stringify(state)),time);assert.deepEqual(restored.restaurant,state.restaurant);assert.deepEqual(kitchenInfo(restored.restaurant,time),kitchenInfo(state.restaurant,time));}
  }
});

test('new recipe actions reject skipped operations and client supplied timing, workers, rewards or workflow state',()=>{
  for(const recipeId of NEW_RECIPES){
    let {state,id}=arrive(fixture(),recipeId),at=order(state,id).createdAt;state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);const before=structuredClone(state);
    for(const extra of [{now:at+999999},{workerId:'worker-2'},{durationMs:0},{amount:999},{workflow:{}},{seat:1}])assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather',...extra},ACTOR,at).ok,false);
    for(const stepId of ['delivery','fry-rice',KITCHEN_FLOWS[recipeId][2].id])assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:id,stepId},ACTOR,at).ok,false);
    assert.deepEqual(state,before);state=step(state,id,'gather',at);const good=state.restaurant;
    for(const mutate of [flow=>flow.segments.find(s=>s.phase==='work').endAt--,flow=>flow.runs[0].energyCost=0,flow=>flow.runs[0].stepId='delivery']){const bad=structuredClone(good);mutate(bad.orders[0].workflow);assert.equal(validKitchenWorkflow(bad.orders[0].workflow,bad.orders[0],bad),false);}
  }
});

test('adding recipes preserves the exact existing rice and latte step contracts and v2/v3/v4 saved workflows',()=>{
  assert.deepEqual(KITCHEN_FLOWS.rice.map(s=>[s.id,s.zoneId,s.durationMs]),[['gather',10,4000],['wash',7,3000],['beat-eggs',8,3000],['chop-chicken',6,4000],['mix-vegetables',8,2500],['season',9,1500],['fry-rice',5,5000],['wrap-omelette',5,3000],['plate',3,1800]]);
  assert.deepEqual(KITCHEN_FLOWS.coffee.map(s=>[s.id,s.zoneId,s.durationMs]),[['gather',10,3000],['espresso',1,4000],['steam-milk',1,3500],['package',2,2500]]);
  for(const recipeId of ['rice','coffee'])for(const version of [2,3,4]){
    let {state,id}=arrive(fixture(),recipeId),saved=order(state,id);saved.workflow=createInteractiveWorkflow(state.restaurant,recipeId,saved.createdAt,{orderId:id,seat:0,version});assert.equal(validRestaurant(state.restaurant),true);
    const prepared=prepare(state,id);state=step(prepared.state,id,'delivery',prepared.at);const snapshot=structuredClone(order(state,id).workflow);assert.equal(snapshot.version,version);
    const restored=normalizeState(JSON.parse(JSON.stringify(state)),snapshot.servedAt+1000);assert.deepEqual(restored.restaurant.orders[0].workflow,snapshot);assert.equal(validRestaurant(restored.restaurant),true);
  }
});

test('all eighteen old timed dishes preserve their original timer and manual reward path',()=>{
  for(const recipeId of NEW_RECIPES){
    const state=fixture(),recipe=restaurantRecipe(recipeId),r=state.restaurant;delete r.parties;r.nextOrderId=2;
    const legacy={id:'table-1',recipeId,createdAt:NOW,readyAt:NOW+recipe.seconds*1000,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:ACTOR.id};r.orders=[legacy];assert.equal(validRestaurant(r),true);
    const snapshot=structuredClone(legacy),restored=normalizeRestaurant(r,NOW+1000);assert.deepEqual(restored.orders,[snapshot]);assert.equal(Object.hasOwn(restored.orders[0],'workflow'),false);
    assert.equal(restaurantInfo({...state,restaurant:restored},legacy.readyAt-1).orders[0].status,'cooking');
    const served=act({...state,restaurant:restored},{type:'restaurant-serve',orderId:legacy.id},legacy.readyAt);const collected=act(served,{type:'restaurant-collect',orderId:legacy.id},legacy.readyAt+RESTAURANT_DINING_MS);
    assert.equal(collected.coins,state.coins+recipe.price);assert.equal(collected.xp,state.xp);assert.equal(collected.pendingGrowth.at(-1).amount,recipe.xp);assert.equal(collected.restaurant.orders.length,0);
  }
});


test('each longer new recipe resumes exactly at its next operation after mid-order exhaustion and full recovery',()=>{
  for(const recipeId of ['pancake','pudding','matcha','burger','udon','waffle','strawberrymilk','gold-salmon','sushi','pizza','grape','parfait','gold-sundae','cheesecake','gold-latte','cocoa']){
    const base=fixture();
    let {state,id}=arrive(base,recipeId),at=order(state,id).createdAt;
    // Isolate two-step exhaustion from the new standing recovery during arrival.
    Object.assign(state.restaurant.staffTraining['worker-1'],{energy:20,energyAt:at,energyMode:'rest-room',rest:null});
    state=act(state,{type:'restaurant-kitchen-accept',orderId:id},at);
    for(const operation of KITCHEN_FLOWS[recipeId].slice(0,2)){
      state=step(state,id,operation.id,at);const run=order(state,id).workflow.runs.at(-1);at=run.rest?.fullAt??run.endAt;
    }
    const rest=order(state,id).workflow.runs.at(-1).rest,third=KITCHEN_FLOWS[recipeId][2];assert.ok(rest);
    for(const time of [rest.departAt,rest.arriveAt,rest.fullAt-1]){
      assert.equal(restaurantActionResult(state,{type:'restaurant-kitchen-step',orderId:id,stepId:third.id},ACTOR,time).ok,false);
      const restored=normalizeState(JSON.parse(JSON.stringify(state)),time);assert.deepEqual(restored.restaurant,state.restaurant);
    }
    const saved=structuredClone(order(state,id).workflow.runs);
    const finished=prepare(state,id,rest.fullAt);state=step(finished.state,id,'delivery',finished.at);
    const flow=order(state,id).workflow;assert.deepEqual(flow.runs.slice(0,2),saved);
    assert.equal(flow.runs.length,KITCHEN_FLOWS[recipeId].length+1);assert.ok(flow.segments.length<=160);
    const delivery=flow.runs.at(-1),settledAt=Math.max(flow.completedAt,delivery.rest?.fullAt??0);
    assert.ok(flow.servedAt<=flow.completedAt);
    if(delivery.rest){assert.equal(kitchenInfo(state.restaurant,delivery.rest.departAt).orders[0].phase,'complete');assert.equal(kitchenInfo(state.restaurant,delivery.rest.departAt).workers.find(w=>w.id===flow.workerId).phase,'rest-walk');}
    assert.equal(kitchenInfo(state.restaurant,settledAt).orders[0].phase,'complete');
    assert.equal(validRestaurant(state.restaurant),true);
  }
});

for(const [recipeId,level,cost] of [['gold-sundae',30,50],['gold-latte',40,70]])test(recipeId+' requires its own purchase and completes manual dining without dish-based gold',()=>{
  let state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(level);state.goldFish=cost;
  assert.equal(restaurantActionResult(state,{type:'restaurant-arrive',partySize:1,recipeId},ACTOR,NOW).ok,false);
  state=act(state,{type:'restaurant-unlock-special',recipeId});assert.equal(state.goldFish,0);assert.equal(state.coins,100);
  let id;({state,id}=arrive(state,recipeId));state=act(state,{type:'restaurant-kitchen-accept',orderId:id},order(state,id).createdAt);
  assert.equal(restaurantActionResult(state,{type:'restaurant-collect',orderId:id},ACTOR,NOW+86400000).ok,false);
  const done=prepare(state,id);state=step(done.state,id,'delivery',done.at);
  const servedAt=order(state,id).workflow.servedAt;assert.equal(state.goldFish,0);
  state=act(state,{type:'restaurant-collect',orderId:id},servedAt+RESTAURANT_DINING_MS);
  assert.equal(state.goldFish,0);assert.equal(state.restaurant.stats.ordinaryServed,0);
  assert.equal(state.pendingGrowth.at(-1).amount,restaurantRecipe(recipeId).xp);
  assert.equal(restaurantActionResult(state,{type:'restaurant-collect',orderId:id},ACTOR,servedAt+RESTAURANT_DINING_MS+1).ok,false);
});
