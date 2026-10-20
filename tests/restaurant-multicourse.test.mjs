import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant, sanitizeRestaurantAction, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { RESTAURANT_GUESTS, eligibleRestaurantGuestCats } from '../src/restaurant-customers.js';
import { GOLD_FISH_MAX, restaurantGoldReward } from '../src/restaurant-economy.js';
import { restaurantGuestDebugResult } from '../demo/restaurant-guests.js';
import { restaurantGuestTables, restaurantTerminalPanel } from '../src/restaurant-guests-ui.js';
import { restaurantCustomersPanel, restaurantCustomerDetail } from '../src/restaurant-customers-ui.js';
import { restaurantGuestSprite } from '../src/restaurant-customer-art.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'multicourse-owner',name:'店长'};
const advanced=RESTAURANT_GUESTS.filter(guest=>guest.advanced);
function fixture(id='guest-baker'){
  const result=restaurantGuestDebugResult(initialState(NOW),{mode:'guest',guestId:id},NOW);
  assert.ok(result.ok,result.message);return result.state;
}
const act=(state,action,now)=>reduceAction(state,action,actor,now);
/** Use the same clicked workflow and rest rules as real orders. The clock is
 * authoritative test time; no durations or rewards enter an action payload. */
function readyToCollect(state,id){
  let at=Math.max(NOW,state.updatedAt),order=restaurantInfo(state,at).orders.find(item=>item.id===id);
  const commit=(action,time)=>{state=act(state,action,time);assert.ok(state,action.type);assert.ok(validRestaurant(state.restaurant));at=time;order=restaurantInfo(state,at).orders.find(item=>item.id===id);};
  at=Math.max(at,order.createdAt,...Object.values(state.restaurant.staffTraining??{}).map(worker=>worker.rest?.fullAt??0));
  if(order.workflow){
    if(order.workflow.acceptedAt===null)commit({type:'restaurant-kitchen-accept',orderId:id},at);
    for(const step of KITCHEN_FLOWS[order.recipeId].slice(order.workflow.runs.length)){
      at=Math.max(at,order.workflow.runs.at(-1)?.endAt??at,order.workflow.runs.at(-1)?.rest?.fullAt??0);
      commit({type:'restaurant-kitchen-step',orderId:id,stepId:step.id},at);
    }
    if(order.workflow.servedAt===null)commit({type:'restaurant-kitchen-step',orderId:id,stepId:'delivery'},Math.max(at,order.workflow.runs.at(-1).endAt,order.workflow.runs.at(-1).rest?.fullAt??0));
  }else if(order.autoServeAt===null)commit({type:'restaurant-serve',orderId:id},Math.max(at,order.readyAt));
  at=Math.max(at,order.collectAt);order=restaurantInfo(state,at).orders.find(item=>item.id===id);
  assert.equal(order.status,'collectible');return {state,order,at};
}

test('exactly eight silver and eight gold advanced cats have two courses and the intended fixed bonuses',()=>{
  assert.equal(advanced.length,16);assert.deepEqual(advanced.map(guest=>guest.tier),[...Array(8).fill('silver'),...Array(8).fill('gold')]);
  assert.ok(advanced.every(guest=>guest.courses===2&&guest.bonusGold===(guest.tier==='silver'?1:2)));
});

test('all sixteen advanced cats finish two meals in the same seat and receive the completion bonus exactly once',()=>{
  for(const guest of advanced){
    const original=fixture(guest.id),initialParty=original.restaurant.parties[0],firstId=initialParty.members[0].orderId;
    const first=readyToCollect(original,firstId),firstGold=restaurantGoldReward({ordinaryServed:first.state.restaurant.stats.ordinaryServed,recipeId:first.order.recipeId}).amount;
    assert.equal(firstGold,0);assert.equal(first.order.rewardGold,0);assert.equal(first.order.rewardGuestGold,0);assert.equal(first.order.course,1);assert.equal(first.order.guestTier,guest.tier);
    assert.equal(act(first.state,{type:'restaurant-collect',orderId:firstId},first.order.servedAt+RESTAURANT_DINING_MS-1),null);
    const secondState=act(first.state,{type:'restaurant-collect',orderId:firstId},first.at);
    assert.ok(secondState);assert.ok(validRestaurant(secondState.restaurant));
    const party=secondState.restaurant.parties[0],member=party.members[0],second=restaurantInfo(secondState,first.at).orders[0];
    assert.equal(party.id,initialParty.id);assert.equal(party.table,initialParty.table);assert.equal(party.seatedAt,initialParty.seatedAt);assert.equal(party.arrivedAt,initialParty.arrivedAt);
    assert.equal(member.cat,guest.id);assert.equal(member.service.round,2);assert.equal(member.service.history.length,1);assert.equal(second.createdAt,first.at);
    assert.notEqual(second.id,firstId);assert.notEqual(second.recipeId,first.order.recipeId);assert.equal(secondState.goldFish,original.goldFish+firstGold);
    assert.equal(secondState.coins,original.coins+first.order.rewardCoins);assert.equal(secondState.xp,original.xp);assert.equal(secondState.pendingGrowth.at(-1).amount,first.order.rewardXp);
    assert.equal(second.rewardGuestGold,guest.bonusGold);assert.equal(second.hasNextCourse,false);assert.notEqual(second.status,'arriving');
    if(second.workflow){assert.equal(second.workflow.version,4);assert.equal(second.workflow.layoutCapacity,2*secondState.restaurant.levels.tables);assert.equal(second.workflow.runs.length,0);assert.equal(second.status,'requested');}
    assert.equal(act(secondState,{type:'restaurant-collect',orderId:firstId},first.at+1),null);
    const reloaded=normalizeState(JSON.parse(JSON.stringify(secondState)),first.at+1000);assert.deepEqual(reloaded.restaurant,secondState.restaurant);
    const final=readyToCollect(reloaded,second.id),finalGold=restaurantGoldReward({ordinaryServed:final.state.restaurant.stats.ordinaryServed,recipeId:second.recipeId}).amount;
    const done=act(final.state,{type:'restaurant-collect',orderId:second.id},final.at);
    assert.ok(done);assert.ok(validRestaurant(done.restaurant));assert.equal(done.restaurant.orders.length,0);assert.equal(done.restaurant.parties.length,0);
    assert.equal(finalGold,0);assert.equal(final.order.rewardGold,guest.bonusGold);assert.equal(done.restaurant.stats.served,2);assert.equal(done.goldFish,original.goldFish+guest.bonusGold);
    assert.equal(done.coins,original.coins+first.order.rewardCoins+final.order.rewardCoins);assert.equal(done.xp,original.xp);assert.equal(Math.round(done.pendingGrowth.reduce((sum,r)=>sum+r.amount,0)*10),Math.round((first.order.rewardXp+final.order.rewardXp)*10));
    assert.equal(act(done,{type:'restaurant-collect',orderId:second.id},final.at+1),null);
  }
});

test('a paid ordinary companion stays through the advanced guest second course and the table frees only once',()=>{
  let state=fixture();state=act(state,{type:'restaurant-arrive',partySize:1,recipeId:'donut'},NOW);
  const extra=state.restaurant.parties.pop().members[0];extra.cat='orange';delete extra.service;
  state.restaurant.parties[0].members.push(extra);assert.ok(validRestaurant(state.restaurant));
  const originalParty=structuredClone(state.restaurant.parties[0]);
  const companion=readyToCollect(state,extra.orderId);state=act(companion.state,{type:'restaurant-collect',orderId:extra.orderId},companion.at);
  assert.equal(state.restaurant.parties.length,1);assert.equal(state.restaurant.parties[0].members.length,2);assert.equal(restaurantInfo(state,companion.at).parties[0].members[1].order,null);
  const first=readyToCollect(state,originalParty.members[0].orderId);state=act(first.state,{type:'restaurant-collect',orderId:first.order.id},first.at);
  assert.equal(state.restaurant.parties[0].id,originalParty.id);assert.equal(state.restaurant.parties[0].members.length,2);
  const second=readyToCollect(state,state.restaurant.parties[0].members[0].orderId);state=act(second.state,{type:'restaurant-collect',orderId:second.order.id},second.at);
  assert.equal(state.restaurant.parties.length,0);assert.equal(state.restaurant.stats.served,3);assert.ok(validRestaurant(state.restaurant));
});

test('the combined gold cap is atomic and forged tier, skipped receipts or current-order clocks fail closed',()=>{
  const first=readyToCollect(fixture('guest-dawn-duke'),'table-1');
  const second=act(first.state,{type:'restaurant-collect',orderId:first.order.id},first.at);
  const final=readyToCollect(second,second.restaurant.orders[0].id);final.state.goldFish=GOLD_FISH_MAX-1;
  const before=structuredClone(final.state);
  assert.equal(act(final.state,{type:'restaurant-collect',orderId:final.order.id},final.at),null);assert.deepEqual(final.state,before);
  const gold=restaurantGoldReward({ordinaryServed:final.state.restaurant.stats.ordinaryServed,recipeId:final.order.recipeId}).amount;
  final.state.goldFish=GOLD_FISH_MAX-2-gold;
  assert.equal(act(final.state,{type:'restaurant-collect',orderId:final.order.id},final.at).goldFish,GOLD_FISH_MAX);
  for(const mutate of [r=>r.parties[0].members[0].service.tier='silver',r=>r.parties[0].members[0].service.history=[],r=>r.parties[0].members[0].service.history[0].collectedAt--,r=>r.orders[0].createdAt++,r=>r.stats.served=0]){
    const bad=structuredClone(second.restaurant);mutate(bad);assert.equal(validRestaurant(bad),false);
  }
  for(const fields of [{tier:'gold'},{round:2},{nextRecipeId:'coffee'},{bonusGold:100},{now:NOW}])assert.equal(sanitizeRestaurantAction({type:'restaurant-collect',orderId:'table-1',...fields}),null);
});

test('legacy active advanced visitors gain a first-course snapshot without changing their current meal or wallet',()=>{
  const state=fixture(),saved=structuredClone(state);delete saved.restaurant.parties[0].members[0].service;
  assert.ok(validRestaurant(saved.restaurant));const restored=normalizeState(saved,NOW+1000);
  assert.deepEqual(restored.restaurant.orders,saved.restaurant.orders);assert.equal(restored.coins,saved.coins);assert.equal(restored.goldFish,saved.goldFish);assert.equal(restored.xp,saved.xp);
  assert.equal(restored.restaurant.parties[0].members[0].service.round,1);assert.equal(restored.restaurant.parties[0].members[0].service.tier,'silver');
});

test('table overlays, course labels, waiting feedback, catalog rewards and isolated test controls are visible',()=>{
  const first=readyToCollect(fixture('guest-dawn-duke'),'table-1'),info=restaurantInfo(first.state,first.at),icon=()=>'',food=id=>`<i class="food-${id}"></i>`;
  const html=restaurantGuestTables(info,{icon,food});assert.ok(!html.includes('gold-overlay.webp'));assert.match(html,/r-collect-fish/);assert.ok(html.includes('金级 · 1/2 餐'));assert.ok(html.includes(`+${first.order.rewardCoins}`));assert.ok(!html.includes('额外 +2 金鱼干'));
  assert.ok(restaurantGuestTables(info,{icon,food,pendingCourses:['table-1']}).includes('正在看菜单…'));
  const next=act(first.state,{type:'restaurant-collect',orderId:'table-1'},first.at),final=readyToCollect(next,next.restaurant.orders[0].id);
  const finalHtml=restaurantGuestTables(restaurantInfo(final.state,final.at),{icon,food});assert.ok(finalHtml.includes('金级 · 2/2 餐'));assert.ok(finalHtml.includes('额外 2 金鱼干'));assert.ok(!finalHtml.includes('rg-bonus-gold'));assert.ok(!finalHtml.includes('收小鱼干'));
  const book=restaurantCustomersPanel(info,{selectedId:'guest-dawn-duke'});assert.ok(!book.includes('data-r-customer-detail'));
  const detail=restaurantCustomerDetail(info,{selectedId:'guest-dawn-duke',testing:true,food});assert.ok(detail.includes('完成两餐，额外 +2 金鱼干'));assert.ok(detail.includes('data-r-debug-guest="guest-dawn-duke"'));
  assert.ok(!restaurantCustomerDetail(info,{selectedId:'guest-dawn-duke',food}).includes('data-r-debug-guest'));
  assert.ok(restaurantTerminalPanel(info,{icon,staffTesting:true}).includes('高级顾客测试'));assert.ok(!restaurantTerminalPanel(info,{icon,staffTesting:false}).includes('高级顾客测试'));
});

test('silver and gold guests show an inert menu indicator until the real second order arrives',()=>{
  const icon=()=>'<svg></svg>',food=()=>'<i></i>';
  for(const guest of ['guest-baker','guest-dawn-duke']){
    const first=readyToCollect(fixture(guest),'table-1'),info=restaurantInfo(first.state,first.at);
    const waiting=restaurantGuestTables(info,{icon,food,pendingCourses:['table-1']});
    const bubble=waiting.match(/<button class="r-order-bubble"[^]*?<\/button>/)[0];
    assert.match(bubble,/disabled/);assert.match(bubble,/aria-busy="true"/);
    assert.match(bubble,/正在看菜单…/);assert.match(bubble,/思考第二道餐中/);
    assert.match(bubble,/role="progressbar"/);assert.doesNotMatch(bubble,/aria-valuenow|data-r-action|data-r-order-id|再点一道|rr-order-inspiration/);
    assert.match(waiting,/is-course-thinking/);
    const second=act(first.state,{type:'restaurant-collect',orderId:'table-1'},first.at);
    const ready=restaurantGuestTables(restaurantInfo(second,first.at),{icon,food,pendingCourses:['table-1']});
    assert.doesNotMatch(ready,/is-course-thinking|rg-menu-progress|aria-busy/);
    assert.match(ready,/data-r-action="kitchen-accept" data-r-order-id="table-2"/);
    assert.match(ready,/想吃这份/);
    const final=readyToCollect(second,'table-2');
    assert.doesNotMatch(restaurantGuestTables(restaurantInfo(final.state,final.at),{icon,food,pendingCourses:['table-2']}),/is-course-thinking|rg-menu-progress/,'final collection is not another menu round');
  }
});

test('new four cats use their own two-row atlas and metallic PNG overlays preserve genuine transparency',async()=>{
  const root=new URL('../public/assets/restaurant/',import.meta.url),manifest=JSON.parse(await readFile(new URL('guests-v3/manifest.json',root),'utf8'));
  assert.equal(Object.keys(manifest.customers).length,4);assert.equal(manifest.atlas.rows,2);assert.equal(manifest.atlas.height,512);
  for(const guest of advanced.slice(12)){
    const cell=manifest.customers[guest.id];assert.equal(cell.name,guest.name);assert.equal(cell.row,0);assert.equal(cell.backRow,1);
    const sprite=restaurantGuestSprite(guest.id);assert.ok(sprite.includes('guests-v3/atlas.webp'));assert.ok(sprite.includes('--rg-rows:2'));assert.ok(sprite.includes('--rg-back-y:100%'));
    for(const name of [cell.front,cell.back])assert.ok((await readFile(new URL(`guests-v3/${name}`,root))).length>1000);
  }
  for(const tier of ['gold','silver']){
    const png=await readFile(new URL(`order-tiers-v1/${tier}-overlay.png`,root));assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);assert.equal(png[25],6,'RGBA PNG required');
  }
});

test('test guest preparation satisfies real requirements and leaves both wallets and pet XP untouched',()=>{
  for(const guest of advanced){
    const before=initialState(NOW),result=restaurantGuestDebugResult(before,{mode:'guest',guestId:guest.id},NOW);
    assert.ok(result.ok);assert.equal(result.state.coins,before.coins);assert.equal(result.state.goldFish,before.goldFish);assert.equal(result.state.xp,before.xp);
    assert.ok(eligibleRestaurantGuestCats(result.state.restaurant,NOW).includes(guest.id));assert.equal(result.state.restaurant.parties[0].members[0].cat,guest.id);
    assert.equal(result.state.restaurant.orders[0].recipeId,'donut');assert.ok(validRestaurant(result.state.restaurant));assert.equal(before.restaurant.parties.length,0);
  }
  for(const command of [{mode:'guest',guestId:'orange'},{mode:'guest',guestId:'made-up'},{mode:'guest',guestId:'guest-baker',bonusGold:99}])assert.equal(restaurantGuestDebugResult(initialState(NOW),command,NOW).ok,false);
});
