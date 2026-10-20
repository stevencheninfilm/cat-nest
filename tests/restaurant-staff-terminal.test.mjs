import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { RESTAURANT_STAFF, RESTAURANT_RECIPES, restaurantInfo, validRestaurant, sanitizeRestaurantAction, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { kitchenInfo } from '../src/restaurant-kitchen.js';
import { isInteractiveWorkflow } from '../src/restaurant-kitchen-interactive.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';
import { createDemoEngine } from '../demo/engine.js';
import { createMemoryStorage } from '../demo/storage.js';
import { restaurantStaffTerminal, createRestaurantStaffDebugger } from '../src/restaurant-staff-terminal.js';
import { restaurantTerminalPanel } from '../src/restaurant-guests-ui.js';
import { createHomeRuntime } from '../src/app-runtime.js';
import { HOME_ENTRIES } from '../src/home-context.js';
import { sanitizeAction } from '../server/github-store.mjs';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'staff-terminal-client',name:'店长'};
const setup=(state,command,now=NOW)=>{const result=restaurantStaffDebugResult(state,command,now);assert.equal(result.ok,true,result.message);return result.state;};
const button=(name,value='')=>({hasAttribute:key=>key===name,dataset:{rDebugStaffUnlock:value,rDebugStaffPreset:value}});
test('unlock-all recipes is an isolated permission fixture that preserves current work, quality and wallets',()=>{
  const state=reduceAction(initialState(NOW),{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  state.restaurant.recipeLevels.coffee=3;
  const before=structuredClone(state),unlocked=setup(state,{mode:'recipes'});
  assert.equal(restaurantInfo(unlocked,NOW).recipes.filter(recipe=>recipe.unlocked).length,RESTAURANT_RECIPES.length+SPECIAL_RESTAURANT_RECIPES.length);
  assert.equal(unlocked.restaurant.recipeLevels.coffee,3);
  assert.deepEqual(unlocked.restaurant.orders,before.restaurant.orders);assert.deepEqual(unlocked.restaurant.parties,before.restaurant.parties);
  assert.deepEqual(unlocked.restaurant.research,before.restaurant.research);assert.deepEqual(unlocked.restaurant.stats,before.restaurant.stats);
  assert.deepEqual([unlocked.coins,unlocked.goldFish,unlocked.xp],[before.coins,before.goldFish,before.xp]);
  assert.equal(validRestaurant(unlocked.restaurant),true);assert.deepEqual(state,before);
  assert.equal(sanitizeRestaurantAction({type:'restaurant-unlock-recipes'}),null);
  assert.equal(restaurantStaffDebugResult(state,{mode:'recipes',free:true},NOW).ok,false);
  const engine=createDemoEngine({storage:createMemoryStorage(),now:()=>NOW});
  assert.equal(engine.debugRestaurantStaff({mode:'recipes'}).ok,true);
  assert.equal(restaurantInfo(engine.snapshot().state,NOW).recipes.filter(recipe=>recipe.unlocked).length,21);
  engine.reset();assert.ok(restaurantInfo(engine.snapshot().state,NOW).recipes.some(recipe=>!recipe.unlocked));
});

test('each employee can be unlocked for scene testing with no currency, growth or existing-order changes',()=>{
  const seed=reduceAction(initialState(NOW),{type:'restaurant-start',recipeId:'rice'},actor,NOW),before=structuredClone(seed);
  for(const [index,employee] of RESTAURANT_STAFF.entries()){
    const state=setup(seed,{mode:'unlock',staffId:employee.id});
    assert.equal(state.restaurant.staff,index+1);
    assert.equal(kitchenInfo(state.restaurant,NOW).workers.length,index+2);
    assert.deepEqual(state.restaurant.orders,seed.restaurant.orders);
    assert.deepEqual(state.restaurant.parties,seed.restaurant.parties);
    assert.equal(state.coins,seed.coins);assert.equal(state.goldFish,seed.goldFish);assert.equal(state.xp,seed.xp);
    assert.deepEqual(state.restaurant.stats,seed.restaurant.stats);
    assert.deepEqual(state.diary,seed.diary);assert.deepEqual(state.careLimits,seed.careLimits);
    assert.equal(validRestaurant(state.restaurant),true);
  }
  assert.deepEqual(seed,before);
  const all=setup(seed,{mode:'unlock',staffId:'chestnut'});
  assert.equal(setup(all,{mode:'unlock',staffId:'shadow'}).restaurant.staff,6,'unlocking an earlier employee never removes a later one');
});

test('switching from a busy full team to only the chef removes stale orders and training records safely',()=>{
  const busy=setup(initialState(NOW),{mode:'rehearse'}),before=structuredClone(busy);
  busy.restaurant.staffTraining['worker-1'].levels.stamina=3;
  busy.restaurant.staffTraining['worker-1'].energy=1;
  const state=setup(busy,{mode:'preset',staff:0},NOW+1000);
  assert.equal(state.restaurant.staff,0);assert.equal(state.restaurant.orders.length,0);assert.equal(state.restaurant.parties.length,0);
  assert.deepEqual(Object.keys(state.restaurant.staffTraining),['worker-1']);
  assert.equal(state.restaurant.staffTraining['worker-1'].levels.stamina,3);
  assert.equal(state.restaurant.staffTraining['worker-1'].energy,230);
  assert.equal(state.restaurant.staffTraining['worker-1'].energyAt,NOW+1000);
  assert.equal(state.restaurant.nextOrderId,before.restaurant.nextOrderId,'discarded fixture order IDs are never reused');
  assert.equal(state.coins,busy.coins);assert.equal(state.goldFish,busy.goldFish);assert.equal(state.xp,busy.xp);
  assert.equal(validRestaurant(state.restaurant),true);
  for(const staff of [3,6])assert.equal(kitchenInfo(setup(state,{mode:'preset',staff},NOW+1000).restaurant,NOW+1000).workers.length,staff+1);
});

test('the full rehearsal reserves seven real workflows, one per employee, and pays only after actual dining',()=>{
  const seed=initialState(NOW),rehearsal=setup(seed,{mode:'rehearse'}),orders=rehearsal.restaurant.orders;
  assert.equal(rehearsal.restaurant.staff,6);assert.equal(restaurantInfo(rehearsal,NOW).capacity,8);
  assert.equal(orders.length,7);assert.equal(rehearsal.restaurant.parties.length,7);
  assert.deepEqual(orders.map(order=>order.workflow.workerId),Array.from({length:7},(_,i)=>`worker-${i+1}`));
  assert.equal(new Set(orders.map(order=>order.workflow.seat)).size,7);
  assert.ok(orders.every(order=>order.createdAt===NOW+6000));
  assert.equal(rehearsal.coins,seed.coins);assert.equal(rehearsal.goldFish,seed.goldFish);assert.equal(rehearsal.xp,seed.xp);
  for(const order of orders){
    const work=order.workflow.segments.find(segment=>segment.phase==='work');
    const model=kitchenInfo(rehearsal.restaurant,work.startAt+1),worker=model.workers.find(worker=>worker.id===order.workflow.workerId);
    assert.equal(worker.orderId,order.id);assert.equal(worker.phase,'work');
    assert.ok(order.workflow.segments.some(segment=>segment.phase==='delivery'));
    assert.equal(order.workflow.segments.at(-1).phase,'return');
  }
  assert.equal(validRestaurant(rehearsal.restaurant),true,'all worker and workstation reservations remain exclusive');
  const finishedAt=Math.max(...orders.map(order=>order.workflow.servedAt))+RESTAURANT_DINING_MS;
  let completed=rehearsal;
  for(const order of orders)completed=reduceAction(completed,{type:'restaurant-collect',orderId:order.id},actor,finishedAt);
  assert.ok(completed);assert.equal(completed.restaurant.orders.length,0);assert.equal(completed.restaurant.parties.length,0);
  assert.equal(completed.restaurant.stats.served,7);assert.ok(completed.coins>seed.coins);assert.equal(completed.xp,seed.xp);assert.equal(completed.pendingGrowth.length,7);assert.ok(completed.pendingGrowth.reduce((sum,r)=>sum+r.amount,0)>0);
});

test('a repeated rehearsal clears old fixtures instead of creating duplicate actors, orders or rewards',()=>{
  const first=setup(initialState(NOW),{mode:'rehearse'}),second=setup(first,{mode:'rehearse'},NOW+2000);
  assert.equal(second.restaurant.orders.length,7);assert.equal(second.restaurant.parties.length,7);
  const oldIds=new Set(first.restaurant.orders.map(order=>order.id));
  assert.ok(second.restaurant.orders.every(order=>!oldIds.has(order.id)));
  assert.equal(second.coins,first.coins);assert.equal(second.xp,first.xp);
  assert.deepEqual(second.restaurant.stats,first.restaurant.stats);assert.equal(validRestaurant(second.restaurant),true);
});

test('reset clears every guest and workflow while preserving the team, wallet, experience and upgrades',()=>{
  const busy=setup(initialState(NOW),{mode:'rehearse'});
  busy.restaurant.staffTraining['worker-1'].levels.stamina=3;
  busy.restaurant.staffTraining['worker-1'].energy=12;
  const before=structuredClone(busy),state=setup(busy,{mode:'reset'},NOW+1000);
  assert.equal(state.restaurant.orders.length,0);assert.equal(state.restaurant.parties.length,0);
  assert.equal(kitchenInfo(state.restaurant,NOW+1000).workers.length,7);
  const expected=structuredClone(before.restaurant);
  expected.orders=[];expected.parties=[];expected.revision++;
  for(const record of Object.values(expected.staffTraining))if(!record.rest)record.energyAt=NOW+1000;
  assert.deepEqual(state.restaurant,expected);
  for(const key of Object.keys(before).filter(key=>!['restaurant','updatedAt'].includes(key)))assert.deepEqual(state[key],before[key],key);
  assert.deepEqual(busy,before,'reset does not mutate the input');
  assert.equal(validRestaurant(state.restaurant),true);
  const again=setup(state,{mode:'reset'},NOW+2000);
  assert.equal(again.restaurant.orders.length,0);assert.equal(again.restaurant.parties.length,0);
  assert.equal(again.restaurant.nextOrderId,state.restaurant.nextOrderId);
});

test('after resetting, each single-dish selection welcomes exactly one guest ordering that recipe',()=>{
  for(const recipeId of ['rice','coffee']){
    const state=setup(setup(initialState(NOW),{mode:'rehearse'}),{mode:'reset'},NOW+1000);
    assert.equal(restaurantInfo(state,NOW+60_000).guestCount,0);
    const next=reduceAction(state,{type:'restaurant-arrive',partySize:1,recipeId},actor,NOW+60_000);
    assert.ok(next);assert.equal(next.restaurant.parties.length,1);assert.equal(next.restaurant.orders.length,1);
    assert.equal(next.restaurant.parties[0].members.length,1);
    assert.equal(next.restaurant.orders[0].recipeId,recipeId);
    assert.equal(isInteractiveWorkflow(next.restaurant.orders[0].workflow),true);
    assert.equal(restaurantInfo(next,NOW+66_000).orders[0].status,'requested');
  }
});

test('invalid fixtures and forged server debug actions are rejected without mutating the input',()=>{
  const seed=initialState(NOW),before=structuredClone(seed);
  for(const command of [null,[],{mode:'unlock',staffId:'unknown'},{mode:'preset',staff:-1},{mode:'preset',staff:99},{mode:'rehearse',coins:99999},{mode:'reset',coins:99999},{mode:'unlock',staffId:'mint',goldFish:100}])assert.equal(restaurantStaffDebugResult(seed,command,NOW).ok,false);
  assert.deepEqual(seed,before);
  for(const action of [{type:'restaurant-debug-staff',staff:6},{type:'restaurant-reset'},{type:'restaurant-hire',free:true},{type:'restaurant-arrive',staff:6}]){
    assert.equal(sanitizeRestaurantAction(action),null);assert.equal(sanitizeAction(action),null);
  }
});

test('the isolated engine broadcasts and persists staff fixtures while a fresh visit restores the default roster',()=>{
  const storage=createMemoryStorage();storage.setItem('unrelated-home',JSON.stringify({staff:2,coins:123}));
  const engine=createDemoEngine({storage,now:()=>NOW}),before=engine.snapshot(),notifications=[];
  engine.subscribe((type,data)=>notifications.push({type,data}));
  assert.equal(engine.debugRestaurantStaff({mode:'unlock',staffId:'chestnut'}).ok,true);
  assert.equal(notifications.at(-1).type,'state');assert.equal(notifications.at(-1).data.state.restaurant.staff,6);
  assert.equal(createDemoEngine({storage,now:()=>NOW}).snapshot().state.restaurant.staff,6);
  assert.equal(storage.getItem('unrelated-home'),JSON.stringify({staff:2,coins:123}));
  assert.equal(engine.snapshot().state.coins,before.state.coins);
  engine.controls.offline=true;const offline=engine.snapshot();
  assert.equal(engine.debugRestaurantStaff({mode:'preset',staff:0}).ok,false);assert.deepEqual(engine.snapshot(),offline);
  assert.equal(createDemoEngine({storage:createMemoryStorage(),now:()=>NOW}).snapshot().state.restaurant.staff,0);
});

test('production runtimes and ordinary terminals expose no free employee test operations',()=>{
  const action=()=>{throw Error('must not be invoked');};
  const real=createHomeRuntime({home:HOME_ENTRIES.find(home=>!home.isTest),localStorage:createMemoryStorage(),sessionStorage:createMemoryStorage()});
  assert.equal(real.testActions,null);
  const testRuntime=createHomeRuntime({home:HOME_ENTRIES.find(home=>home.isTest),testAdapter:{apiBase:'https://demo.cat-nest.invalid',actions:{restaurantStaff:action}}});
  assert.equal(testRuntime.testActions.restaurantStaff,action);
  const info=restaurantInfo(initialState(NOW),NOW);
  assert.equal(restaurantStaffTerminal(info),'');
  assert.ok(!restaurantTerminalPanel(info,{icon:()=>''}).includes('data-r-debug-staff'));
  assert.ok(!restaurantTerminalPanel(info,{icon:()=>''}).includes('data-r-debug-unlock-recipes'));
  const html=restaurantTerminalPanel(info,{icon:()=>'',staffTesting:true});
  for(const employee of RESTAURANT_STAFF)assert.ok(html.includes(`data-r-debug-staff-unlock="${employee.id}"`));
  assert.ok(html.includes('data-r-debug-staff-preset="0"'));assert.ok(html.includes('data-r-debug-staff-preset="3"'));assert.ok(html.includes('data-r-debug-staff-preset="6"'));
  assert.ok(html.includes('data-r-debug-staff-rehearse'));assert.ok(!html.includes('<details class="rg-staff-debug" open'));
  assert.ok(html.includes('解锁全部员工'));assert.ok(html.includes('data-r-debug-unlock-recipes'));
});

test('staff debug UI gates in-flight saves, connection failures and real homes before invoking a fixture',()=>{
  let calls=0,enabled=true,status={connected:true,saving:false},message='';
  const controller=createRestaurantStaffDebugger({enabled:()=>enabled,availability:()=>status,run:()=>{calls++;return {ok:true,message:'changed'};},message:text=>message=text});
  const unlock=button('data-r-debug-staff-unlock','mint');
  enabled=false;assert.equal(controller.handle(unlock),true);assert.equal(calls,0);
  enabled=true;
  for(const blocked of [{connected:false},{connected:true,saving:true},{connected:true,pending:true}]){status=blocked;controller.handle(unlock);assert.equal(calls,0);}
  status={connected:true,saving:false};controller.handle(unlock);assert.equal(calls,1);assert.equal(message,'changed');
  assert.equal(controller.handle(button('data-unrelated')),false);
});

test('reset uses the isolated test adapter and respects saving and connection guards',()=>{
  let enabled=true,status={connected:true},commands=[];
  const controller=createRestaurantStaffDebugger({enabled:()=>enabled,availability:()=>status,run:command=>{commands.push(command);return {ok:true};}});
  const reset=button('data-r-debug-reset');
  for(const blocked of [{connected:false},{connected:true,saving:true},{connected:true,pending:true}]){status=blocked;assert.equal(controller.handle(reset),true);}
  status={connected:true};enabled=false;controller.handle(reset);assert.deepEqual(commands,[]);
  enabled=true;controller.handle(reset);assert.deepEqual(commands,[{mode:'reset'}]);
  const empty=restaurantTerminalPanel(restaurantInfo(initialState(NOW),NOW),{icon:()=>'',staffTesting:true});
  assert.match(empty,/data-r-debug-reset[^>]*>/);assert.ok(!/data-r-debug-reset[^>]*disabled/.test(empty),'an empty restaurant can still be reset');
});
