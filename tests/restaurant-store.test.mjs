import { restaurantGuestDebugResult } from '../demo/restaurant-guests.js';
import { restaurantResearchDebugResult } from '../demo/restaurant-research.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { RESTAURANT_DINING_MS, RESTAURANT_NEW_RECIPE_IDS, validRestaurant, restaurantInfo } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
function mockGitHub() {
  const files=new Map();let nextSha=0;
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
    files.set(id,{sha:`sha-${++nextSha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    if(controls.loseAcknowledgment){controls.loseAcknowledgment=false;throw new Error('lost acknowledgment');}
    return new Response('{}',{status:previous?200:201});
  };
  return {files,controls,fetchImpl};
}
const makeStore=(mock,now)=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now});
const payload=(type,extra={},id='restaurant-operation-one',clientId='client-one')=>({operationId:id,clientId,name:'猫友',action:{type,...extra}});

test('two cloud clients and a retried receipt cannot duplicate research cards or spend a second draw',async()=>{
  const mock=mockGitHub(),first=makeStore(mock,()=>NOW),second=makeStore(mock,()=>NOW),room=await first.createRoom();
  const intents=[payload('restaurant-research-draw',{draw:1},'research-draw-a'),payload('restaurant-research-draw',{draw:1},'research-draw-b','client-two')];
  const results=await Promise.allSettled(intents.map((intent,index)=>(index?second:first).applyAction(room.roomId,intent)));
  assert.equal(results.filter(item=>item.status==='fulfilled').length,1);
  const winner=results.findIndex(item=>item.status==='fulfilled');
  assert.equal((await first.applyAction(room.roomId,intents[winner])).duplicate,true);
  const loaded=await makeStore(mock,()=>NOW).getRoom(room.roomId);
  assert.equal(loaded.state.restaurant.research.draws,1);assert.equal(loaded.state.restaurant.research.fragments.rice,3);
  assert.equal(restaurantInfo(loaded.state,NOW).research.availableDraws,2);
  for(const key of ['coins','goldFish','xp'])assert.equal(loaded.state[key],room.state[key]);
  assert.equal(mock.files.size,1);assert.equal(validRestaurant(loaded.state.restaurant),true);
});

test('concurrent fragment fusions and lost receipts return inspiration exactly once',async()=>{
  const mock=mockGitHub(),first=makeStore(mock,()=>NOW),second=makeStore(mock,()=>NOW),room=await first.createRoom();
  const seeded=restaurantResearchDebugResult(room.state,{mode:'research-fusion'},NOW);assert.ok(seeded.ok);
  const file=mock.files.get(room.roomId);file.room.state=seeded.state;file.sha='fusion-seeded';
  const fields={recipeId:'rice',amount:9,expectedFragments:40,expectedFusion:0};
  const requests=[payload('restaurant-research-fuse',fields,'fusion-one-a'),payload('restaurant-research-fuse',fields,'fusion-one-b','client-two')];
  const results=await Promise.allSettled(requests.map((request,index)=>(index?second:first).applyAction(room.roomId,request)));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const winner=results.findIndex(result=>result.status==='fulfilled');assert.equal((await first.applyAction(room.roomId,requests[winner])).duplicate,true);
  const saved=await makeStore(mock,()=>NOW).getRoom(room.roomId);assert.equal(saved.state.restaurant.research.fragments.rice,31);
  assert.equal(saved.state.restaurant.research.fusion.inspiration,9);assert.equal(saved.state.restaurant.research.inspirationEarned,seeded.state.restaurant.research.inspirationEarned+9);
  const rare=payload('restaurant-research-fuse',{recipeId:'cocoa',amount:5,expectedFragments:5,expectedFusion:1},'fusion-lost-rare');
  mock.controls.loseAcknowledgment=true;await assert.rejects(first.applyAction(room.roomId,rare),error=>error.code==='STORAGE_UNAVAILABLE');
  const retry=await first.applyAction(room.roomId,rare);assert.equal(retry.duplicate,true);assert.equal(retry.state.restaurant.research.fusion.inspiration,34);
  const rolled=mock.files.get(room.roomId);rolled.room.operations=[];rolled.sha='fusion-journal-rolled';
  await assert.rejects(makeStore(mock,()=>NOW).applyAction(room.roomId,rare),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  const done=await makeStore(mock,()=>NOW).getRoom(room.roomId);assert.equal(done.state.restaurant.research.fragments.cocoa,0);assert.equal(done.state.restaurant.research.fusion.inspiration,34);assert.ok(validRestaurant(done.state.restaurant));
  for(const key of ['coins','goldFish','xp'])assert.equal(done.state[key],room.state[key]);
});

test('two cloud clients cannot duplicate a first-course transition or the final gold guest bonus',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const room=await makeStore(mock,()=>clock).createRoom();
  const seeded=restaurantGuestDebugResult(room.state,{mode:'guest',guestId:'guest-dawn-duke'},clock);assert.ok(seeded.ok);
  const file=mock.files.get(room.roomId);file.room.state=seeded.state;file.sha='gold-guest-seeded';
  const first=makeStore(mock,()=>clock),second=makeStore(mock,()=>clock);
  let start=restaurantInfo(seeded.state,clock).orders[0];
  start=await deliverInteractiveOrder(first,room.roomId,start,{getNow:()=>clock,setNow:at=>clock=at,prefix:'gold-guest-first-clicked'});
  clock=start.workflow.servedAt+RESTAURANT_DINING_MS;
  const prepared=await first.getRoom(room.roomId),firstGift=restaurantInfo(prepared.state,clock).orders.find(order=>order.id===start.id).rewardInspiration;
  const requests=[payload('restaurant-collect',{orderId:start.id},'gold-course-one-a'),payload('restaurant-collect',{orderId:start.id},'gold-course-one-b','client-two')];
  const outcomes=await Promise.allSettled(requests.map((request,index)=>(index?second:first).applyAction(room.roomId,request)));
  assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);
  const winner=outcomes.findIndex(item=>item.status==='fulfilled');assert.equal((await first.applyAction(room.roomId,requests[winner])).duplicate,true);
  const half=await makeStore(mock,()=>clock).getRoom(room.roomId),member=half.state.restaurant.parties[0].members[0];
  assert.equal(half.state.restaurant.nextOrderId,3);assert.equal(member.service.round,2);assert.equal(member.service.history.length,1);
  assert.equal(half.state.restaurant.research.inspirationEarned,seeded.state.restaurant.research.inspirationEarned+firstGift);
  assert.equal(half.state.goldFish,seeded.state.goldFish);assert.equal(half.state.restaurant.stats.served,1);assert.equal(half.state.restaurant.orders.length,1);
  let next=half.state.restaurant.orders[0];
  if(next.workflow){next=await deliverInteractiveOrder(first,room.roomId,next,{getNow:()=>clock,setNow:at=>clock=at,prefix:'gold-guest-second-clicked'});clock=next.workflow.servedAt+RESTAURANT_DINING_MS;}
  else clock=restaurantInfo(half.state,clock).orders[0].collectAt;
  const beforeFinal=await first.getRoom(room.roomId),finalGift=restaurantInfo(beforeFinal.state,clock).orders.find(order=>order.id===next.id).rewardInspiration;
  const finalRequests=[payload('restaurant-collect',{orderId:next.id},'gold-course-two-a'),payload('restaurant-collect',{orderId:next.id},'gold-course-two-b','client-two')];
  const finalOutcomes=await Promise.allSettled(finalRequests.map((request,index)=>(index?second:first).applyAction(room.roomId,request)));
  assert.equal(finalOutcomes.filter(item=>item.status==='fulfilled').length,1);
  const done=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.equal(done.state.restaurant.orders.length,0);assert.equal(done.state.restaurant.parties.length,0);assert.equal(done.state.restaurant.stats.served,2);
  assert.equal(done.state.restaurant.research.inspirationEarned,half.state.restaurant.research.inspirationEarned+finalGift);
  assert.equal(done.state.goldFish,seeded.state.goldFish+2);assert.equal(mock.files.size,1);assert.ok(validRestaurant(done.state.restaurant));
  assert.ok(done.state.restaurant.seenGuests.includes('guest-dawn-duke'));
});

/** Advance the mock server clock, never action payload timestamps. Every real
 * detailed operation is accepted separately and every next step is clicked. */
async function deliverInteractiveOrder(store,roomId,order,{getNow,setNow,prefix,clientId='client-one'}){
  assert.ok([2,3,4].includes(order.workflow.version));
  const commit=async(type,fields,suffix)=>{
    const result=await store.applyAction(roomId,payload(type,fields,`${prefix}-${suffix}`,clientId));
    order=result.state.restaurant.orders.find(saved=>saved.id===order.id);assert.ok(order);assert.equal(validRestaurant(result.state.restaurant),true);
  };
  const current=await store.getRoom(roomId);
  setNow(Math.max(getNow(),order.createdAt,order.workflow.runs.at(-1)?.endAt??0,...Object.values(current.state.restaurant.staffTraining??{}).map(worker=>worker.rest?.fullAt??0)));
  if(order.workflow.acceptedAt===null)await commit('restaurant-kitchen-accept',{orderId:order.id},'accept');
  for(const step of KITCHEN_FLOWS[order.recipeId].slice(order.workflow.runs.length)){
    setNow(Math.max(getNow(),order.workflow.runs.at(-1)?.endAt??0,order.workflow.runs.at(-1)?.rest?.fullAt??0));
    await commit('restaurant-kitchen-step',{orderId:order.id,stepId:step.id},step.id);
  }
  if(order.workflow.servedAt===null){setNow(Math.max(getNow(),order.workflow.runs.at(-1).endAt,order.workflow.runs.at(-1).rest?.fullAt??0));await commit('restaurant-kitchen-step',{orderId:order.id,stepId:'delivery'},'delivery');}
  return order;
}

test('the cloud accepts restaurant intents but rejects client-provided currency and timestamps',()=>{
  assert.deepEqual(sanitizeAction({type:'restaurant-start',recipeId:'rice'}),{type:'restaurant-start',recipeId:'rice'});
  assert.equal(sanitizeAction({type:'restaurant-collect',orderId:'table-1',amount:10000}),null);
  assert.equal(sanitizeAction({type:'restaurant-start',recipeId:'rice',now:NOW+100000}),null);
  assert.deepEqual(sanitizeAction({type:'restaurant-arrive',partySize:2}),{type:'restaurant-arrive',partySize:2});
  assert.equal(sanitizeAction({type:'restaurant-arrive',partySize:3}),null);
  assert.equal(sanitizeAction({type:'restaurant-arrive',partySize:2,seatedAt:NOW}),null);
  assert.deepEqual(sanitizeAction({type:'restaurant-kitchen-accept',orderId:'table-1'}),{type:'restaurant-kitchen-accept',orderId:'table-1'});
  assert.deepEqual(sanitizeAction({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'}),{type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather'});
  for(const extra of [{workerId:'worker-2'},{now:NOW},{amount:99},{workflow:{}},{durationMs:0}])assert.equal(sanitizeAction({type:'restaurant-kitchen-step',orderId:'table-1',stepId:'gather',...extra}),null);
});

test('a shared two-guest arrival survives reload and pays each order once before freeing its table',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const first=makeStore(mock,()=>clock),room=await first.createRoom();
  const request=payload('restaurant-arrive',{partySize:2,recipeId:'sandwich'},'restaurant-pair-arrival');
  const arrival=await first.applyAction(room.roomId,request);
  const party=arrival.state.restaurant.parties[0],orders=arrival.state.restaurant.orders;
  assert.equal(party.members.length,2);assert.equal(orders.length,2);
  const seen=party.members.map(member=>member.cat);
  assert.deepEqual(arrival.state.restaurant.seenGuests,seen);
  assert.equal(party.seatedAt,NOW+6000);
  assert.equal(arrival.state.coins,room.state.coins);assert.equal(arrival.state.xp,room.state.xp);
  const duplicate=await first.applyAction(room.roomId,request);
  assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.state.restaurant.seenGuests,seen);
  assert.equal((await makeStore(mock,()=>clock).getRoom(room.roomId)).state.restaurant.orders.length,2);
  await assert.rejects(first.applyAction(room.roomId,payload('restaurant-collect',{orderId:orders[0].id},'restaurant-pair-early')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  const delivered=[];
  for(const order of orders){
    if([2,3,4].includes(order.workflow?.version)){const served=await deliverInteractiveOrder(first,room.roomId,order,{getNow:()=>clock,setNow:at=>clock=at,prefix:`restaurant-pair-${order.id}`});delivered.push(served.workflow.servedAt);clock=served.workflow.completedAt;}
    else {clock=Math.max(clock,order.readyAt);await first.applyAction(room.roomId,payload('restaurant-serve',{orderId:order.id},`restaurant-pair-serve-${order.id}`));delivered.push(clock);}
  }
  clock=Math.max(clock,...delivered.map(at=>at+RESTAURANT_DINING_MS));
  const second=makeStore(mock,()=>clock);
  const collected=await first.applyAction(room.roomId,payload('restaurant-collect',{orderId:orders[0].id},'restaurant-pair-collect-first'));
  assert.equal(collected.state.restaurant.parties[0].members.length,2,'paid guest stays with their companion');
  assert.equal(collected.state.restaurant.orders.length,1);
  const results=await Promise.allSettled([
    first.applyAction(room.roomId,payload('restaurant-collect',{orderId:orders[1].id},'restaurant-pair-collect-last-a')),
    second.applyAction(room.roomId,payload('restaurant-collect',{orderId:orders[1].id},'restaurant-pair-collect-last-b','client-two')),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const loaded=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.equal(loaded.state.restaurant.parties.length,0);assert.equal(loaded.state.restaurant.orders.length,0);
  assert.equal(loaded.state.restaurant.stats.served,2);
  assert.deepEqual(loaded.state.restaurant.seenGuests,seen,'cloud retains encounters after the final guest leaves');
  assert.equal(loaded.state.coins,room.state.coins+loaded.state.restaurant.stats.earned);
  assert.equal(loaded.state.xp,room.state.xp);assert.equal(loaded.state.pendingGrowth.reduce((sum,r)=>sum+r.amount,0),loaded.state.restaurant.stats.experience);
  assert.equal(mock.files.size,1);assert.equal(validRestaurant(loaded.state.restaurant),true);
});

test('restaurant orders serialize with the same room and reward the same wallet and growth total',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const store=makeStore(mock,()=>clock),room=await store.createRoom();
  const start=await store.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'rice'},'restaurant-start-one'));
  const order=start.state.restaurant.orders[0];
  await assert.rejects(store.applyAction(room.roomId,payload('restaurant-serve',{orderId:order.id},'restaurant-early-serve')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  const delivered=await deliverInteractiveOrder(store,room.roomId,order,{getNow:()=>clock,setNow:at=>clock=at,prefix:'restaurant-clicked-one'});
  clock=delivered.workflow.servedAt;
  await assert.rejects(store.applyAction(room.roomId,payload('restaurant-serve',{orderId:order.id},'restaurant-serve-one','client-two')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  clock+=RESTAURANT_DINING_MS;
  const collect=await store.applyAction(room.roomId,payload('restaurant-collect',{orderId:order.id},'restaurant-collect-one'));
  assert.equal(collect.state.coins,room.state.coins+24);assert.equal(collect.state.xp,room.state.xp);assert.equal(collect.state.pendingGrowth[0].amount,6);
  assert.equal(mock.files.size,1);assert.equal(collect.roomId,room.roomId);
  assert.equal(validRestaurant(mock.files.get(room.roomId).room.state.restaurant),true);
  const reloaded=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.deepEqual(reloaded.state.restaurant,collect.state.restaurant);
  assert.equal(reloaded.state.xp,collect.state.xp);
});

test('simultaneous collections from two store instances cannot duplicate a shared order reward',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const first=makeStore(mock,()=>clock),second=makeStore(mock,()=>clock),room=await first.createRoom();
  const start=await first.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'rice'},'restaurant-race-start'));
  const order=start.state.restaurant.orders[0];
  const delivered=await deliverInteractiveOrder(first,room.roomId,order,{getNow:()=>clock,setNow:at=>clock=at,prefix:'restaurant-race-clicked'});
  clock=delivered.workflow.servedAt+RESTAURANT_DINING_MS;
  const results=await Promise.allSettled([
    first.applyAction(room.roomId,payload('restaurant-collect',{orderId:order.id},'restaurant-race-collect-a')),
    second.applyAction(room.roomId,payload('restaurant-collect',{orderId:order.id},'restaurant-race-collect-b','client-two')),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'RESTAURANT_ACTION_REJECTED');
  const loaded=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.equal(loaded.state.restaurant.stats.served,1);assert.equal(loaded.state.coins,124);assert.equal(loaded.state.xp,86);assert.equal(loaded.state.pendingGrowth[0].amount,6);
});

test('lost acknowledgments and journal rollover never recreate a collected order',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const store=makeStore(mock,()=>clock),room=await store.createRoom();
  const start=await store.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'rice'},'restaurant-lost-start'));
  const order=start.state.restaurant.orders[0];
  const delivered=await deliverInteractiveOrder(store,room.roomId,order,{getNow:()=>clock,setNow:at=>clock=at,prefix:'restaurant-lost-clicked'});
  clock=delivered.workflow.servedAt+RESTAURANT_DINING_MS;
  const request=payload('restaurant-collect',{orderId:order.id},'restaurant-lost-collect');
  const expectedGift=restaurantInfo((await store.getRoom(room.roomId)).state,clock).orders.find(item=>item.id===order.id).rewardInspiration;
  mock.controls.loseAcknowledgment=true;
  await assert.rejects(store.applyAction(room.roomId,request),error=>error.code==='STORAGE_UNAVAILABLE');
  const retry=await store.applyAction(room.roomId,request);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.coins,124);assert.equal(retry.state.restaurant.research.inspirationEarned,90+expectedGift);
  const file=mock.files.get(room.roomId);file.room.operations=[];file.sha='journal-rolled-over';
  const rolledRetry=await makeStore(mock,()=>clock).applyAction(room.roomId,request);
  assert.equal(rolledRetry.duplicate,true);assert.equal(rolledRetry.state.pendingGrowth.length,1);
  assert.equal(mock.files.get(room.roomId).room.state.coins,124);assert.equal(mock.files.get(room.roomId).room.state.restaurant.research.inspirationEarned,90+expectedGift);
});

test('old cloud rooms migrate only an empty restaurant and corrupt restaurant saves fail closed',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const store=makeStore(mock,()=>clock),room=await store.createRoom();
  const file=mock.files.get(room.roomId);file.room.state.coins=1200;delete file.room.state.restaurant;file.sha='legacy-sha';
  const legacy=await makeStore(mock,()=>clock).getRoom(room.roomId);
  assert.equal(legacy.state.restaurant.orders.length,0);assert.equal(legacy.state.coins,1200);assert.equal(legacy.state.xp,86);
  assert.equal(file.room.state.restaurant,undefined,'reading does not write a replacement cloud save');
  const started=await makeStore(mock,()=>clock).applyAction(room.roomId,payload('restaurant-start',{recipeId:'rice'},'restaurant-migration-start'));
  assert.equal(started.state.restaurant.orders.length,1);
  const saved=mock.files.get(room.roomId);saved.room.state.restaurant.orders[0].readyAt=0;saved.sha='corrupt-sha';
  await assert.rejects(makeStore(mock,()=>clock).getRoom(room.roomId),error=>error.code==='STORAGE_CORRUPT');
});

test('an existing six-dish cloud save adds the new menu without replacing its room, active order or wallet',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const store=makeStore(mock,()=>clock),room=await store.createRoom();
  const seeded=mock.files.get(room.roomId);seeded.room.state.restaurant.stats.experience=levelStartXp(10);seeded.room.state.restaurant.research={version:1,startedServed:0,draws:1,fragments:{rice:3},lastDraw:{draw:1,recipeId:'rice',amount:3}};seeded.sha='restaurant-research-eligible';
  await store.applyAction(room.roomId,payload('restaurant-recipe',{recipeId:'rice'},'restaurant-old-research'));
  const started=await store.applyAction(room.roomId,payload('restaurant-start',{recipeId:'rice'},'restaurant-old-start'));
  const file=mock.files.get(room.roomId),oldOrder=structuredClone(started.state.restaurant.orders[0]);
  for(const id of RESTAURANT_NEW_RECIPE_IDS)delete file.room.state.restaurant.recipeLevels[id];
  delete file.room.state.restaurant.progression;file.sha='six-dish-legacy';
  const before=structuredClone(file.room),reader=makeStore(mock,()=>clock);
  const loaded=await reader.getRoom(room.roomId);
  assert.equal(loaded.roomId,room.roomId);assert.equal(loaded.state.coins,started.state.coins);
  assert.equal(loaded.state.xp,started.state.xp);assert.equal(loaded.state.restaurant.recipeLevels.rice,2);
  assert.equal(Object.keys(loaded.state.restaurant.recipeLevels).length,18);
  assert.deepEqual(loaded.state.restaurant.orders,[oldOrder]);assert.deepEqual(file.room,before,'GET does not rewrite the cloud file');
  const extra=await reader.applyAction(room.roomId,payload('restaurant-start',{recipeId:'donut'},'restaurant-new-donut'));
  assert.equal(extra.state.restaurant.orders.length,2);assert.deepEqual(extra.state.restaurant.orders[0],oldOrder);
  const donut=extra.state.restaurant.orders[1];clock=donut.readyAt;
  await reader.applyAction(room.roomId,payload('restaurant-serve',{orderId:donut.id},'restaurant-new-donut-serve'));
  clock+=RESTAURANT_DINING_MS;
  const completed=await reader.applyAction(room.roomId,payload('restaurant-collect',{orderId:donut.id},'restaurant-new-donut-collect','client-two'));
  assert.equal(completed.state.coins,started.state.coins+30);assert.equal(completed.state.xp,started.state.xp);assert.equal(completed.state.pendingGrowth.at(-1).amount,7);
  assert.deepEqual(completed.state.restaurant.orders,[oldOrder]);assert.equal(mock.files.size,1);
});

test('independent cloud clients click each operation while one employee stays assigned through waits and delivery',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const first=makeStore(mock,()=>clock),second=makeStore(mock,()=>clock),room=await first.createRoom();
  await first.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'rice'},'kitchen-rice-client-one'));
  const arrival=await second.applyAction(room.roomId,payload('restaurant-arrive',{partySize:1,recipeId:'coffee'},'kitchen-coffee-client-two','client-two'));
  const [rice,coffee]=arrival.state.restaurant.orders;clock=rice.createdAt;
  await first.applyAction(room.roomId,payload('restaurant-kitchen-accept',{orderId:rice.id},'kitchen-rice-accept-one'));
  await second.applyAction(room.roomId,payload('restaurant-kitchen-accept',{orderId:coffee.id},'kitchen-coffee-accept-two','client-two'));
  const gathering=await first.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:rice.id,stepId:'gather'},'kitchen-rice-gather-one'));
  const currentRice=gathering.state.restaurant.orders.find(order=>order.id===rice.id),currentCoffee=gathering.state.restaurant.orders.find(order=>order.id===coffee.id);
  assert.equal(currentRice.workflow.workerId,'worker-1');assert.equal(currentCoffee.workflow.workerId,null);
  await assert.rejects(second.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:coffee.id,stepId:'gather'},'kitchen-coffee-busy-two','client-two')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  clock=currentRice.workflow.runs[0].endAt+10000;
  await assert.rejects(second.applyAction(room.roomId,payload('restaurant-kitchen-step',{orderId:coffee.id,stepId:'gather'},'kitchen-coffee-waiting-two','client-two')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  await assert.rejects(first.applyAction(room.roomId,payload('restaurant-collect',{orderId:rice.id},'kitchen-collect-before-preparation')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  const prepared=await deliverInteractiveOrder(first,room.roomId,currentRice,{getNow:()=>clock,setNow:at=>clock=at,prefix:'kitchen-rice-continued'});
  clock++;
  await assert.rejects(first.applyAction(room.roomId,payload('restaurant-collect',{orderId:rice.id},'kitchen-collect-before-delivery')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  clock=prepared.workflow.servedAt+RESTAURANT_DINING_MS-1;
  await assert.rejects(second.applyAction(room.roomId,payload('restaurant-collect',{orderId:rice.id},'kitchen-collect-before-dining','client-two')),error=>error.code==='RESTAURANT_ACTION_REJECTED');
  clock++;
  const collected=await second.applyAction(room.roomId,payload('restaurant-collect',{orderId:rice.id},'kitchen-collect-after-dining','client-two'));
  assert.equal(collected.state.coins,room.state.coins+24);
  assert.deepEqual(collected.state.restaurant.orders[0].workflow,currentCoffee.workflow,'collecting never creates an unclicked next operation');
  assert.equal(validRestaurant(collected.state.restaurant),true);
  const reload=await makeStore(mock,()=>clock).getRoom(room.roomId);assert.deepEqual(reload.state.restaurant.orders,collected.state.restaurant.orders);
  const servedCoffee=await deliverInteractiveOrder(second,room.roomId,reload.state.restaurant.orders[0],{getNow:()=>clock,setNow:at=>clock=at,prefix:'kitchen-coffee-clicked',clientId:'client-two'});
  assert.equal(servedCoffee.workflow.workerId,prepared.workflow.workerId);assert.ok(servedCoffee.workflow.runs[0].startAt>=prepared.workflow.completedAt);
  clock=servedCoffee.workflow.servedAt+RESTAURANT_DINING_MS;
  const completed=await first.applyAction(room.roomId,payload('restaurant-collect',{orderId:coffee.id},'kitchen-coffee-complete'));
  assert.equal(completed.state.coins,room.state.coins+24+32);assert.equal(completed.state.xp,room.state.xp);assert.deepEqual(completed.state.pendingGrowth.map(r=>r.amount),[6,7]);assert.equal(completed.state.restaurant.orders.length,0);
});

test('home XP claims survive lost acknowledgments, concurrent partners and receipt journal rollover',async()=>{
  const mock=mockGitHub();let clock=NOW;
  const first=makeStore(mock,()=>clock),room=await first.createRoom();
  const started=await first.applyAction(room.roomId,payload('restaurant-start',{recipeId:'sandwich'},'home-bridge-order'));
  const order=started.state.restaurant.orders[0];clock=order.readyAt;
  await first.applyAction(room.roomId,payload('restaurant-serve',{orderId:order.id},'home-bridge-deliver'));
  clock+=RESTAURANT_DINING_MS;
  const request=payload('restaurant-collect',{orderId:order.id},'home-bridge-collect');
  mock.controls.loseAcknowledgment=true;
  await assert.rejects(first.applyAction(room.roomId,request),error=>error.code==='STORAGE_UNAVAILABLE');
  const retry=await first.applyAction(room.roomId,request);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.coins,128);assert.equal(retry.state.xp,86);
  assert.equal(retry.state.pendingGrowth.length,1);assert.equal(retry.state.pendingGrowth[0].amount,6);
  const second=makeStore(mock,()=>clock),rewardId=retry.state.pendingGrowth[0].id;
  const claims=[payload('claim-growth',{rewardId},'home-bridge-claim-one'),payload('claim-growth',{rewardId},'home-bridge-claim-two','client-two')];
  const outcomes=await Promise.allSettled(claims.map((claim,index)=>(index?second:first).applyAction(room.roomId,claim)));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const file=mock.files.get(room.roomId);file.room.operations=[];file.sha='home-bridge-rolled-over';
  const reloaded=makeStore(mock,()=>clock),duplicate=await reloaded.applyAction(room.roomId,request);
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.state.coins,128);assert.equal(duplicate.state.xp,92);assert.equal(duplicate.state.restaurant.stats.experience,6);
  assert.deepEqual(duplicate.state.pendingGrowth,[]);
  await assert.rejects(reloaded.applyAction(room.roomId,{...request,action:{type:'restaurant-collect',orderId:'table-2'}}),error=>error.code==='OPERATION_CONFLICT');
  await assert.rejects(reloaded.applyAction(room.roomId,payload('claim-growth',{rewardId},'home-bridge-late-claim')),error=>error.code==='REWARD_ALREADY_CLAIMED');
  assert.equal(file.room.claimedGrowth.length,1);assert.equal(mock.files.size,1);
});
