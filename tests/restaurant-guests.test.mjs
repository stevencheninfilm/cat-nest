import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { RESTAURANT_ARRIVAL_MS, restaurantSeat, restaurantGuestRoute, restaurantGuestMotion, restaurantArrivalPlan } from '../src/restaurant-guests.js';
import { unconfirmedRestaurantDeliveries, restaurantGuestTable, restaurantGuestTables, restaurantTerminalPanel } from '../src/restaurant-guests-ui.js';
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

test('a kitchen intent normalizes legacy fields and rechecks other seats on every invocation',()=>{
  const state=arrive(), at=state.restaurant.parties[0].seatedAt;
  const [first,second]=state.restaurant.orders;
  delete state.restaurant.levels.fridge;
  delete state.restaurant.waitingParties;
  const accept={type:'restaurant-kitchen-accept',orderId:first.id};
  const before=structuredClone(state);
  const accepted=act(state,accept,at);
  assert.ok(accepted);
  assert.deepEqual(accepted,normalizeState(accepted,at));
  assert.deepEqual(accepted,act(normalizeState(state,at),accept,at));
  assert.deepEqual(state,before);
  second.workflow.acceptedAt=second.createdAt-1;
  assert.equal(act(state,accept,at),null);
  assert.equal(accepted.restaurant.orders[1].workflow.acceptedAt,null);
});

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

test('online checkout waits only for its own saved delivery, while an offline tap can still queue',()=>{
  const state=arrive(),info=restaurantInfo(state,NOW+RESTAURANT_ARRIVAL_MS);
  const [first,second]=info.parties[0].members.map(member=>member.order);
  // Both local plates finished, but only the neighbouring seat's delivery is saved.
  const confirmed=structuredClone(state.restaurant);
  for(const order of [first,second]){
    order.workflow={...order.workflow,servedAt:NOW};
    order.status='collectible';
  }
  confirmed.orders[1].workflow.servedAt=NOW;
  const displayed={...state.restaurant,orders:[first,second]};
  const render=(connected,pendingCourses=[])=>restaurantGuestTables(info,{
    icon:()=>'',food:()=>'',pendingCourses,
    pendingDeliveries:unconfirmedRestaurantDeliveries(displayed,confirmed,connected),
  });
  const collectFor=order=>`data-r-action="collect" data-r-order-id="${order.id}"`;
  let html=render(true);
  assert.ok(!html.includes(collectFor(first)));
  assert.match(html,/disabled[^>]*aria-busy="true"[^>]*aria-label="[^"]*正在送餐/);
  assert.ok(html.includes(collectFor(second)));
  assert.ok(render(false).includes(collectFor(first)));
  first.hasNextCourse=true;
  assert.match(render(true,[first.id]),/正在看菜单/,'a first course already queued offline retains its acknowledgement');
  confirmed.orders[0].workflow.servedAt=NOW+200;
  assert.ok(render(true).includes(collectFor(first)));
  confirmed.orders.shift();
  assert.ok(!render(true).includes(collectFor(first)),'a missing or already cleared order cannot be collected from a stale ticket');
  confirmed.orders.push({id:first.id,servedAt:null});
  assert.ok(!render(true).includes(collectFor(first)),'an incomplete legacy snapshot does not confirm the delivery');
  confirmed.orders.at(-1).servedAt=NOW;
  assert.ok(render(true).includes(collectFor(first)),'a legacy, explicitly saved delivery is sufficient');
  const legacy={orders:[{id:first.id,workflow:{version:1,servedAt:NOW}}]};
  assert.deepEqual(unconfirmedRestaurantDeliveries(legacy,{orders:[{id:first.id,workflow:{version:1,servedAt:null}}]},true),[]);
});

test('table-edge tickets keep independent seat actions and explicit dish descriptions',()=>{
  const state=arrive(arrive(),2,NOW+1);
  const info=restaurantInfo(state,NOW+RESTAURANT_ARRIVAL_MS+1);
  const buttonRows=markup=>Array.from(markup.matchAll(/<div class="r-table-guest rg-order-seat[^]*?<\/button><\/div>/g),row=>row[0]);
  const render=options=>buttonRows(restaurantGuestTables(info,{icon:()=>'',food:id=>`<i>${id}</i>`,...options}));
  const requested=render();
  assert.equal(requested.length,4);
  for (const row of requested) {
    assert.match(row,/data-r-action="kitchen-accept"/);
    assert.match(row,/<strong>接单<\/strong>/);
    assert.match(row,/title="[^"]+号桌[左右]座 · [^"]+/);
  }
  const first=info.parties[1].members[0].order;
  const next=info.parties[1].members[1].order;
  first.status='dish-ready';
  next.status='collectible';next.rewardInspiration=7;
  const mixed=render();
  assert.equal(mixed.length,4);
  assert.match(mixed[0],/<strong>接单<\/strong>/);
  assert.match(mixed[1],/<strong>接单<\/strong>/);
  assert.match(mixed[2],/data-r-action="kitchen-step"[^>]*data-r-step="delivery"/);
  assert.match(mixed[3],/data-r-action="collect"[^>]*收取/);
  assert.doesNotMatch(mixed[3],/灵感/,'inspiration appears only on the actual checkout receipt');
  const pending=render({pendingCourses:[next.id]});
  assert.match(pending[3],/disabled[^>]*aria-busy="true"/);
});

test('sixteen table-edge tickets keep unique seat actions and a stable row as cooking time advances',()=>{
  const first=restaurantInfo(arrive(),NOW+RESTAURANT_ARRIVAL_MS);
  const options={icon:()=>'',food:id=>`<i>${id}</i>`};
  const info={...first,capacity:8,parties:Array.from({length:8},(_,table)=>({
    ...first.parties[0],id:`party-${table+1}`,table,
    members:first.parties[0].members.map((member,seat)=>({...member,order:{
      ...member.order,id:`table-${table*2+seat+1}`,status:'requested',
    }})),
  }))};
  const all=restaurantGuestTables(info,options);
  assert.equal((all.match(/class="rg-ticket-face"/g)||[]).length,16);
  for(const party of info.parties) {
    const table=restaurantGuestTable(info,party.table,options);
    assert.ok(all.includes(table));
    for(const member of party.members) {
      assert.ok(table.includes(`data-r-table="${party.table}" data-r-seat="${member.seat}"`));
      assert.ok(table.includes(`data-r-action="kitchen-accept" data-r-order-id="${member.order.id}"`));
    }
  }
  const order=info.parties[6].members[1].order;
  order.status='cooking';order.remainingMs=1200;order.progress=.2;
  const cooking=restaurantGuestTable(info,6,options);
  order.remainingMs=200;order.progress=.9;
  assert.equal(restaurantGuestTable(info,6,options),cooking);
  assert.ok(cooking.includes(`data-r-progress="${order.id}"`));
  assert.ok(cooking.includes(`data-r-countdown="${order.id}"`));
});

test('an admitted local acceptance updates its bubble immediately and a rollback restores the accept button',()=>{
  const original=arrive(),seatedAt=NOW+RESTAURANT_ARRIVAL_MS;
  const before=restaurantInfo(original,seatedAt);
  const order=before.orders.find(item=>item.status==='requested');
  assert.ok(order);
  const action={type:'restaurant-kitchen-accept',orderId:order.id};
  const queued=act(original,action,seatedAt);
  assert.ok(queued);
  const after=restaurantInfo(queued,seatedAt);
  const render=(info,pendingAccepts=[])=>restaurantGuestTables(info,{icon:()=>'',food:id=>`<i>${id}</i>`,pendingAccepts});

  // The action lives in the local queue even when there is no server receipt.
  const pending=render(after,[order.id]);
  assert.match(pending,/is-accept-pending/);
  assert.match(pending,/本机已接单，待同步/);
  assert.match(pending,/<strong>已接单<\/strong><span class="rg-accept-sync-note">待同步<\/span>/);
  assert.match(pending,new RegExp(`data-r-kitchen-select="${order.id}"`));
  assert.doesNotMatch(pending,new RegExp(`data-r-action="kitchen-accept" data-r-order-id="${order.id}"`));

  const cooking=act(queued,{type:'restaurant-kitchen-step',orderId:order.id,stepId:KITCHEN_FLOWS[order.recipeId][0].id},seatedAt);
  assert.ok(cooking);
  const active=render(restaurantInfo(cooking,seatedAt),[order.id]);
  assert.match(active,/本机已接单，待同步，厨师制作中/);
  assert.match(active,/<strong>已接单<\/strong>/);

  // The brief queue/state repaint race must not allow a duplicate click.
  const beforeProjection=render(before,[order.id]);
  assert.doesNotMatch(beforeProjection,new RegExp(`data-r-action="kitchen-accept" data-r-order-id="${order.id}"`));

  const confirmed=render(after);
  assert.doesNotMatch(confirmed,/待同步/);
  assert.match(confirmed,/等待厨师继续制作/);
  const rejected=render(before);
  assert.doesNotMatch(rejected,/已接单|待同步/);
  assert.match(rejected,new RegExp(`data-r-action="kitchen-accept" data-r-order-id="${order.id}"`));
});
