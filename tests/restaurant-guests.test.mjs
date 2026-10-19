import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { RESTAURANT_ARRIVAL_MS, restaurantSeat, restaurantGuestRoute, restaurantGuestMotion, restaurantArrivalPlan } from '../src/restaurant-guests.js';
import { restaurantGuestTables, restaurantTerminalPanel } from '../src/restaurant-guests-ui.js';
import { restaurantMarkup } from '../src/restaurant-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),alice={id:'client-alice',name:'猫友'},bob={id:'client-bobby',name:'伙伴'};
const act=(state,action,now=NOW,actor=alice)=>reduceAction(state,action,actor,now);
const arrive=(state=initialState(NOW),partySize=2,now=NOW)=>act(state,{type:'restaurant-arrive',partySize},now);
function collect(state,id){
  let at=Math.max(NOW,state.updatedAt),order=restaurantInfo(state,at).orders.find(order=>order.id===id);
  const commit=(action,time)=>{state=act(state,action,time,bob);assert.ok(state,`${action.type} should succeed`);at=time;order=restaurantInfo(state,at).orders.find(order=>order.id===id);};
  at=Math.max(at,order.createdAt,...Object.values(state.restaurant.staffTraining??{}).map(worker=>worker.rest?.fullAt??0));
  if([2,3,4].includes(order.workflow?.version)){
    if(order.workflow.acceptedAt===null)commit({type:'restaurant-kitchen-accept',orderId:id},at);
    for(const step of KITCHEN_FLOWS[order.recipeId].slice(order.workflow.runs.length)){
      at=Math.max(at,order.workflow.runs.at(-1)?.endAt??at,order.workflow.runs.at(-1)?.rest?.fullAt??0);commit({type:'restaurant-kitchen-step',orderId:id,stepId:step.id},at);
    }
    if(order.workflow.servedAt===null)commit({type:'restaurant-kitchen-step',orderId:id,stepId:'delivery'},Math.max(at,order.workflow.runs.at(-1).endAt,order.workflow.runs.at(-1).rest?.fullAt??0));
  }else if(order.autoServeAt===null)commit({type:'restaurant-serve',orderId:id},Math.max(at,order.readyAt));
  commit({type:'restaurant-collect',orderId:id},Math.max(at,order.collectAt));
  return state;
}

test('a pair reserves one table and two distinct orders; detailed dishes wait for seating and a player request',()=>{
  const state=arrive(),info=restaurantInfo(state,NOW),party=info.parties[0];
  assert.equal(validRestaurant(state.restaurant),true);assert.equal(info.availableTables,1);assert.equal(info.guestCount,2);
  assert.equal(party.members.length,2);assert.equal(party.seatedAt,NOW+RESTAURANT_ARRIVAL_MS);
  assert.equal(new Set(party.members.map(member=>member.cat)).size,2);
  assert.equal(new Set(info.orders.map(order=>order.recipeId)).size,2);
  assert.deepEqual(info.orders.map(order=>[order.table,order.seat,order.status]),[[0,0,'arriving'],[0,1,'arriving']]);
  assert.ok(info.orders.every(order=>order.createdAt===party.seatedAt&&([2,3,4].includes(order.workflow?.version)?order.readyAt===party.seatedAt:order.readyAt>party.seatedAt)));
  assert.equal(state.coins,100);assert.equal(state.xp,86);
  assert.equal(restaurantInfo(state,party.seatedAt-1).parties[0].status,'arriving');
  assert.equal(restaurantInfo(state,party.seatedAt).parties[0].status,'seated');
  const seated=restaurantInfo(state,party.seatedAt);
  for(const order of seated.orders)assert.equal(order.status,[2,3,4].includes(order.workflow?.version)?'requested':'cooking');
  for(const order of restaurantInfo(state,party.seatedAt+100000).orders.filter(order=>[2,3,4].includes(order.workflow?.version))){assert.equal(order.status,'requested');assert.equal(order.workflow.runs.length,0);assert.equal(order.workflow.workerId,null);}
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)),NOW+2000).restaurant,state.restaurant);
});

test('two pairs occupy two tables and four orders; a full restaurant cannot seat another party',()=>{
  const first=arrive(),second=arrive(first,2,NOW+1),info=restaurantInfo(second,NOW+2);
  assert.equal(info.capacity,2);assert.equal(info.orders.length,4);assert.equal(info.guestCount,4);assert.equal(info.availableTables,0);
  assert.equal(new Set(info.parties.map(party=>party.table)).size,2);
  assert.equal(arrive(second,1,NOW+2),null);
  assert.equal(validRestaurant(second.restaurant),true);
});

test('each guest pays once, waits for the companion, and only the final payment releases the table',()=>{
  let state=arrive();const original=restaurantInfo(state,NOW),ids=original.orders.map(order=>order.id);
  state=collect(state,ids[0]);
  const half=restaurantInfo(state,NOW+100000);
  assert.equal(half.parties.length,1);assert.equal(half.parties[0].members.length,2);assert.equal(half.parties[0].members[0].order,null);
  assert.equal(half.orders.length,1);assert.equal(half.availableTables,1);
  assert.equal(act(state,{type:'restaurant-collect',orderId:ids[0]},NOW+100000),null);
  state=collect(state,ids[1]);
  assert.equal(state.restaurant.parties.length,0);assert.equal(state.restaurant.orders.length,0);
  assert.equal(state.restaurant.stats.served,2);
  assert.equal(state.coins,100+original.orders.reduce((sum,order)=>sum+order.rewardCoins,0));
  assert.equal(state.xp,86);assert.equal(state.pendingGrowth.reduce((sum,r)=>sum+r.amount,0),original.orders.reduce((sum,order)=>sum+order.rewardXp,0));
});

test('legacy saves gain one stable table per existing order without changing order snapshots or wallet',()=>{
  let state=act(initialState(NOW),{type:'restaurant-start',recipeId:'sandwich'});
  state=act(state,{type:'restaurant-start',recipeId:'donut'});
  const saved=structuredClone(state);delete saved.restaurant.parties;
  const restored=normalizeState(saved,NOW+1000);
  assert.deepEqual(restored.restaurant.orders,saved.restaurant.orders);
  assert.deepEqual(restored.restaurant.parties.map(party=>[party.table,party.arrivedAt,party.seatedAt]),[[0,NOW,NOW],[1,NOW,NOW]]);
  assert.equal(restored.coins,saved.coins);assert.equal(restored.xp,saved.xp);
  assert.equal(validRestaurant(saved.restaurant),true);
  assert.equal(validRestaurant(restored.restaurant),true);
});

test('party validation rejects conflicting seats, duplicate ownership, missing orders and forged arrival clocks',()=>{
  const good=arrive(arrive(),1,NOW+1).restaurant;
  for(const mutate of [
    r=>r.parties[1].table=r.parties[0].table,
    r=>r.parties[0].members[1].orderId=r.parties[0].members[0].orderId,
    r=>r.parties[0].seatedAt+=1,
    r=>r.parties[0].members[0].cat='unknown',
    r=>r.parties[0].members=[],
    r=>r.parties[0].members[0].orderId='table-999',
    r=>r.parties[0].table=8,
    r=>r.parties[0].members.push({...r.parties[0].members[0]}),
  ]){const bad=structuredClone(good);mutate(bad);assert.equal(validRestaurant(bad),false);}
  for(const action of [{type:'restaurant-arrive',partySize:0},{type:'restaurant-arrive',partySize:3},{type:'restaurant-arrive',seatedAt:0},{type:'restaurant-arrive',table:0},{type:'restaurant-arrive',amount:100},{type:'restaurant-arrive',recipeId:'missing'}])assert.equal(sanitizeRestaurantAction(action),null);
});

test('natural arrival has a repeatable thirty-percent pair chance and chooses only unlocked dishes',()=>{
  const state=initialState(NOW),info=restaurantInfo(state,NOW);let pairs=0;
  for(let i=0;i<600;i++){
    const plan=restaurantArrivalPlan(info.restaurant,info.recipes.filter(recipe=>recipe.unlocked),{},alice,NOW+i);
    const again=restaurantArrivalPlan(info.restaurant,info.recipes.filter(recipe=>recipe.unlocked),{},alice,NOW+i);
    assert.deepEqual(plan,again);pairs+=plan.members.length===2?1:0;
    assert.ok(plan.members.every(member=>member.recipe.unlockLevel<=1));
  }
  assert.ok(pairs>120&&pairs<240,`pair samples: ${pairs}/600`);
});

test('every guest follows street and doorway to its exact chair, continuously and without replaying on redraw',()=>{
  for(const layoutCapacity of [2,4,6,8])for(let table=0;table<layoutCapacity;table++)for(let seat=0;seat<2;seat++){
    const party={table,arrivedAt:NOW,seatedAt:NOW+RESTAURANT_ARRIVAL_MS},target=restaurantSeat(table,seat),route=restaurantGuestRoute(table,seat,{layoutCapacity});
    const motion=(at,options={})=>restaurantGuestMotion(party,seat,at,{layoutCapacity,...options});
    assert.deepEqual(route[0],{x:-9,y:14.6});assert.deepEqual(route[2],{x:50,y:22});
    let last=motion(NOW);
    for(let elapsed=20;elapsed<=RESTAURANT_ARRIVAL_MS;elapsed+=20){
      const next=motion(NOW+elapsed);assert.ok(Math.hypot(next.x-last.x,next.y-last.y)<2);
      if(layoutCapacity<=6&&next.y>22&&next.y<target.y)assert.equal(next.x,50,'an open central aisle must be crossed in a straight line');
      last=next;
    }
    assert.equal(last.phase,'seated');assert.equal(last.x,target.x);assert.equal(last.y,target.y);
    const middle=motion(NOW+3000);
    assert.deepEqual(restaurantGuestMotion(structuredClone(party),seat,NOW+3000,{layoutCapacity}),middle);
    const exit=motion(NOW+RESTAURANT_ARRIVAL_MS*2,{departAt:NOW+RESTAURANT_ARRIVAL_MS});
    assert.equal(exit.phase,'gone');assert.equal(exit.x,-9);
    assert.equal(motion(NOW,{reducedMotion:true}).phase,'seated');
  }
});

test('order bubbles appear after seating, and the terminal exposes deterministic arrivals and a test-only reset',()=>{
  const state=arrive(),icon=()=>'',food=id=>`<i>${id}</i>`;
  const walking=restaurantGuestTables(restaurantInfo(state,NOW),{icon,food});
  assert.equal((walking.match(/class="r-order-bubble"/g)||[]).length,0);assert.ok(walking.includes('2 位客人正在入座'));
  const seated=restaurantGuestTables(restaurantInfo(state,NOW+RESTAURANT_ARRIVAL_MS),{icon,food});
  assert.equal((seated.match(/class="r-order-bubble"/g)||[]).length,2);
  const terminal=restaurantTerminalPanel(restaurantInfo(state,NOW),{icon,auto:false,staffTesting:true});
  assert.ok(terminal.includes('data-r-debug-arrive="1"'));assert.ok(terminal.includes('data-r-debug-arrive="2"'));assert.ok(terminal.includes('data-r-debug-arrive="random"'));
  assert.ok(terminal.includes('data-r-debug-reset'));assert.ok(terminal.includes('重置餐厅顾客和订单'));assert.ok(!terminal.includes('重播'));assert.ok(terminal.includes('已暂停'));
  assert.match(restaurantTerminalPanel(restaurantInfo(state,NOW),{icon}),/data-r-debug-reset[^>]+disabled/);
  assert.ok(restaurantMarkup(state,{isTest:true,debugEnabled:true}).includes('打开餐厅控制终端'));
  assert.ok(!restaurantMarkup(state,{debugEnabled:false}).includes('打开餐厅控制终端'));
});
