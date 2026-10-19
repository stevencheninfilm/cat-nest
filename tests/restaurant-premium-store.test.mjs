import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubStore, sanitizeAction } from '../server/github-store.mjs';
import { initialState, levelStartXp } from '../src/state.js';
import { validRestaurant } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES } from '../src/restaurant-economy.js';
import { normalizeStaffTraining } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
function mockGitHub() {
  const files=new Map();let nextSha=0,putGate=null;
  const controls={loseAcknowledgment:false,conflicts:0,gateNextTwoWrites(){let release;const ready=new Promise(resolve=>{release=resolve;});putGate={remaining:2,ready,release};}};
  const fetchImpl=async(url,options)=>{
    const id=new URL(url).pathname.split('/').at(-1).replace('.json','');
    if(options.method==='GET') {
      const previous=files.get(id);
      if(!previous)return new Response('{}',{status:404});
      if(options.headers['If-None-Match']===previous.sha)return new Response(null,{status:304});
      return Response.json({sha:previous.sha,encoding:'base64',content:Buffer.from(JSON.stringify(previous.room)).toString('base64')},{headers:{etag:previous.sha}});
    }
    // Make both independent stores read the same revision before either writes.
    // Re-read the file AFTER the gate so the second write gets a real CAS 409.
    const gate=putGate;
    if(gate){gate.remaining--;if(gate.remaining===0){putGate=null;gate.release();}await gate.ready;}
    const previous=files.get(id),body=JSON.parse(options.body);
    if(previous&&previous.sha!==body.sha){controls.conflicts++;return new Response('{}',{status:409});}
    files.set(id,{sha:`premium-sha-${++nextSha}`,room:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    if(controls.loseAcknowledgment){controls.loseAcknowledgment=false;throw new Error('lost acknowledgment');}
    return new Response('{}',{status:previous?200:201});
  };
  return {files,controls,fetchImpl};
}
const makeStore=(mock,now=()=>NOW)=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl:mock.fetchImpl,now});
const payload=(type,extra={},id='premium-operation-one',clientId='premium-client-one')=>({operationId:id,clientId,name:'店长',action:{type,...extra}});
function funded({coins=1200,goldFish=20,level=50,served=0,speed=1,skill=1}={}) {
  const state=initialState(NOW);state.coins=coins;state.goldFish=goldFish;
  state.restaurant.stats.experience=levelStartXp(level);
  state.restaurant.stats.served=served;state.restaurant.stats.ordinaryServed=served;
  state.restaurant.nextOrderId=state.restaurant.stats.served+1;
  state.restaurant.staffTraining=normalizeStaffTraining(state.restaurant.staffTraining,NOW,state.restaurant.staff);
  state.restaurant.staffTraining['worker-1'].levels.speed=speed;
  state.restaurant.staffTraining['worker-1'].levels.skill=skill;
  return state;
}

test('a legacy cloud wallet migrates missing gold to zero while preserving room, ordinary wallet and saved progress',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom({initialState:funded({coins:417,goldFish:9,speed:3,served:6})});
  const file=mock.files.get(room.roomId);delete file.room.state.goldFish;file.sha='premium-legacy-sha';
  const before=structuredClone(file.room),reader=makeStore(mock),legacy=await reader.getRoom(room.roomId);
  assert.equal(legacy.roomId,room.roomId);assert.equal(legacy.state.goldFish,0);assert.equal(legacy.state.coins,417);
  assert.equal(legacy.state.xp,room.state.xp);assert.equal(legacy.state.restaurant.stats.served,6);
  assert.equal(legacy.state.restaurant.staffTraining['worker-1'].levels.speed,3);
  assert.deepEqual(file.room,before,'reading a migration never rewrites the cloud file');
  const changed=await reader.applyAction(room.roomId,payload('restaurant-train',{workerId:'worker-1',statId:'skill'},'premium-legacy-save'));
  assert.equal(changed.state.goldFish,0);assert.equal(changed.state.coins,337);
  assert.equal(mock.files.get(room.roomId).room.state.goldFish,0);assert.equal(mock.files.size,1);
});

test('cloud files with a negative, fractional or overflowing gold wallet fail closed',async()=>{
  for(const balance of [-1,.5,999999.5,1000000,'5',null]) {
    const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom();
    const file=mock.files.get(room.roomId);file.room.state.goldFish=balance;file.sha=`premium-corrupt-${String(balance)}`;
    await assert.rejects(makeStore(mock).getRoom(room.roomId),error=>error.code==='STORAGE_CORRUPT',`balance ${String(balance)} must be rejected rather than reset`);
    assert.equal(mock.files.get(room.roomId).room.state.goldFish,balance);
  }
});

test('train and special-unlock cloud intents reject forged price, level, wallet, reward and clock fields',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom({initialState:funded()});
  const intents=[{type:'restaurant-train',workerId:'worker-1',statId:'speed'},{type:'restaurant-unlock-special',recipeId:'gold-salmon'}];
  let index=0;
  for(const intent of intents) {
    assert.deepEqual(sanitizeAction(intent),intent);
    for(const extra of [{amount:0},{cost:0},{price:0},{goldFish:999},{level:10},{energy:999},{reward:999},{now:NOW+86400000}]) {
      const forged={...intent,...extra};assert.equal(sanitizeAction(forged),null);
      await assert.rejects(store.applyAction(room.roomId,{...payload(forged.type,{},`premium-forged-${++index}`),action:forged}),error=>error.code==='INVALID_ACTION');
    }
  }
  assert.equal(sanitizeAction({type:'restaurant-train',workerId:'worker-1',statId:'coins'}),null);
  assert.equal(sanitizeAction({type:'restaurant-unlock-special',recipeId:'rice'}),null);
  const loaded=await makeStore(mock).getRoom(room.roomId);
  assert.equal(loaded.revision,room.revision);assert.equal(loaded.state.goldFish,room.state.goldFish);assert.equal(loaded.state.coins,room.state.coins);
  assert.deepEqual(loaded.state.restaurant.staffTraining,room.state.restaurant.staffTraining);
});

test('server calculates both training currencies and the special recipe purchase price from trusted rules',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom({initialState:funded({goldFish:100,speed:7})});
  const ordinary=await store.applyAction(room.roomId,payload('restaurant-train',{workerId:'worker-1',statId:'skill'},'premium-coin-training'));
  assert.equal(ordinary.state.coins,room.state.coins-80);assert.equal(ordinary.state.goldFish,100);
  assert.equal(ordinary.state.restaurant.staffTraining['worker-1'].levels.skill,2);
  const advanced=await store.applyAction(room.roomId,payload('restaurant-train',{workerId:'worker-1',statId:'speed'},'premium-gold-training'));
  assert.equal(advanced.state.goldFish,98);assert.equal(advanced.state.coins,ordinary.state.coins);
  assert.equal(advanced.state.restaurant.staffTraining['worker-1'].levels.speed,8);
  const recipe=SPECIAL_RESTAURANT_RECIPES.find(recipe=>recipe.id==='gold-salmon');
  const unlocked=await store.applyAction(room.roomId,payload('restaurant-unlock-special',{recipeId:recipe.id},'premium-special-purchase'));
  assert.equal(unlocked.state.goldFish,98-recipe.unlockGold);assert.equal(unlocked.state.coins,advanced.state.coins);
  assert.ok(unlocked.state.restaurant.ownedSpecialRecipes.includes(recipe.id));assert.equal(validRestaurant(unlocked.state.restaurant),true);
  const reloaded=await makeStore(mock).getRoom(room.roomId);
  assert.equal(reloaded.state.goldFish,unlocked.state.goldFish);
  assert.deepEqual(reloaded.state.restaurant.staffTraining,unlocked.state.restaurant.staffTraining);
  assert.deepEqual(reloaded.state.restaurant.ownedSpecialRecipes,unlocked.state.restaurant.ownedSpecialRecipes);
});

test('retrying a gold-funded operation after a lost acknowledgment never charges or upgrades twice',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom({initialState:funded({goldFish:10,speed:7})});
  const request=payload('restaurant-train',{workerId:'worker-1',statId:'speed'},'premium-lost-training');
  mock.controls.loseAcknowledgment=true;
  await assert.rejects(store.applyAction(room.roomId,request),error=>error.code==='STORAGE_UNAVAILABLE');
  assert.equal(mock.files.get(room.roomId).room.state.goldFish,8,'the cloud accepted the write before losing its acknowledgment');
  const retry=await makeStore(mock).applyAction(room.roomId,request);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.goldFish,8);assert.equal(retry.state.restaurant.staffTraining['worker-1'].levels.speed,8);
  assert.equal(retry.revision,room.revision+1);
  const again=await store.applyAction(room.roomId,request);assert.equal(again.duplicate,true);assert.equal(again.state.goldFish,8);
  await assert.rejects(makeStore(mock).applyAction(room.roomId,{...request,action:{type:'restaurant-train',workerId:'worker-1',statId:'skill'}}),error=>error.code==='OPERATION_CONFLICT');
  assert.equal(mock.files.get(room.roomId).room.state.goldFish,8);
});

test('special recipe operation IDs deduplicate the same purchase and preserve its original gold cost',async()=>{
  const mock=mockGitHub(),store=makeStore(mock),room=await store.createRoom({initialState:funded({goldFish:100})});
  const request=payload('restaurant-unlock-special',{recipeId:'gold-salmon'},'premium-special-once');
  const purchase=await store.applyAction(room.roomId,request),retry=await makeStore(mock).applyAction(room.roomId,request);
  assert.equal(purchase.state.goldFish,70);assert.equal(retry.duplicate,true);assert.equal(retry.state.goldFish,70);
  assert.deepEqual(retry.state.restaurant.ownedSpecialRecipes,['gold-salmon']);assert.equal(retry.revision,purchase.revision);
});

test('concurrent independent clients re-read the shared gold balance after a conflict and reject overspending',async()=>{
  const mock=mockGitHub(),first=makeStore(mock),second=makeStore(mock),room=await first.createRoom({initialState:funded({goldFish:3,speed:7,skill:7})});
  mock.controls.gateNextTwoWrites();
  const results=await Promise.allSettled([
    first.applyAction(room.roomId,payload('restaurant-train',{workerId:'worker-1',statId:'speed'},'premium-race-speed')),
    second.applyAction(room.roomId,payload('restaurant-train',{workerId:'worker-1',statId:'skill'},'premium-race-skill','premium-client-two')),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'RESTAURANT_ACTION_REJECTED');
  assert.equal(mock.controls.conflicts,1,'the loser must actually retry after a SHA conflict');
  const loaded=await makeStore(mock).getRoom(room.roomId),levels=loaded.state.restaurant.staffTraining['worker-1'].levels;
  assert.equal(loaded.state.goldFish,1);assert.equal(loaded.state.coins,room.state.coins);
  assert.deepEqual([levels.speed,levels.skill].sort(),[7,8]);assert.equal(loaded.revision,room.revision+1);
  assert.equal(validRestaurant(loaded.state.restaurant),true);
});

test('gold-funded recipe and training purchases cannot spend the same balance in a cross-feature race',async()=>{
  const mock=mockGitHub(),first=makeStore(mock),second=makeStore(mock),room=await first.createRoom({initialState:funded({goldFish:30,speed:7})});
  mock.controls.gateNextTwoWrites();
  const results=await Promise.allSettled([
    first.applyAction(room.roomId,payload('restaurant-unlock-special',{recipeId:'gold-salmon'},'premium-cross-recipe')),
    second.applyAction(room.roomId,payload('restaurant-train',{workerId:'worker-1',statId:'speed'},'premium-cross-training','premium-client-two')),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'RESTAURANT_ACTION_REJECTED');
  const loaded=await makeStore(mock).getRoom(room.roomId),ownsRecipe=loaded.state.restaurant.ownedSpecialRecipes.includes('gold-salmon'),upgraded=loaded.state.restaurant.staffTraining['worker-1'].levels.speed===8;
  assert.notEqual(ownsRecipe,upgraded,'exactly one purchase commits');
  assert.equal(loaded.state.goldFish,ownsRecipe?0:28);assert.equal(loaded.state.coins,room.state.coins);
});

test('two homes keep independent gold balances, training and operation journals',async()=>{
  const mock=mockGitHub(),store=makeStore(mock);
  const first=await store.createRoom({initialState:funded({goldFish:8,speed:7})}),second=await store.createRoom({initialState:funded({goldFish:6,speed:7})});
  const request=payload('restaurant-train',{workerId:'worker-1',statId:'speed'},'premium-same-id-distinct-homes');
  const changed=await store.applyAction(first.roomId,request),untouched=await makeStore(mock).getRoom(second.roomId);
  assert.equal(changed.state.goldFish,6);assert.equal(changed.state.restaurant.staffTraining['worker-1'].levels.speed,8);
  assert.equal(untouched.state.goldFish,6);assert.equal(untouched.state.restaurant.staffTraining['worker-1'].levels.speed,7);
  assert.equal(untouched.revision,second.revision);assert.equal(mock.files.get(second.roomId).room.operations.length,0);
  const other=await makeStore(mock).applyAction(second.roomId,request);
  assert.notEqual(other.duplicate,true,'the same operation ID in another room is a separate operation');
  assert.equal(other.state.goldFish,4);assert.equal(other.state.restaurant.staffTraining['worker-1'].levels.speed,8);
  assert.equal((await makeStore(mock).getRoom(first.roomId)).state.goldFish,6);assert.equal(mock.files.size,2);
});
