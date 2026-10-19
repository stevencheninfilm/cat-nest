import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, normalizeState, reduceAction, levelStartXp } from '../src/state.js';
import { RESTAURANT_STAFF, restaurantInfo, validRestaurant, RESTAURANT_DINING_MS } from '../src/restaurant.js';
import { restaurantStaffPanel } from '../src/restaurant-ui.js';
import { kitchenInfo, createKitchenWorkflow } from '../src/restaurant-kitchen.js';
import { createGitHubStore } from '../server/github-store.mjs';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'client-staff-test',name:'店长'};
const act=(state,type,extra={},now=NOW)=>reduceAction(state,{type,...extra},actor,now);
const funded=()=>{const state={...initialState(NOW),coins:50000,goldFish:1000};state.restaurant.stats.experience=levelStartXp(50);return state;};
function hireAll(state=funded()) {
  for(const employee of RESTAURANT_STAFF){
    const currency=employee.costCurrency==='goldFish'?'goldFish':'coins',before=state[currency];
    const next=act(state,'restaurant-hire');
    assert.ok(next,`${employee.name} can join`);
    assert.equal(next[currency],before-employee.cost);
    state=next;
  }
  return state;
}

test('three new employees have stable identities and original recruitment order stays intact',()=>{
  assert.equal(RESTAURANT_STAFF.length,6);
  assert.deepEqual(RESTAURANT_STAFF.slice(0,3).map(employee=>[employee.id,employee.cost]),[['shadow',220],['milky',650],['sesame',1400]]);
  assert.deepEqual(RESTAURANT_STAFF.filter(employee=>employee.isNew).map(employee=>[employee.id,employee.name,employee.role,employee.sprite]),[
    ['pudding','布丁','甜点师','staff-pudding'],['mint','薄荷','饮品师','staff-mint'],['chestnut','栗子','传菜员','staff-chestnut'],
  ]);
  assert.equal(new Set(RESTAURANT_STAFF.map(employee=>employee.id)).size,6);
  assert.equal(new Set(RESTAURANT_STAFF.map(employee=>employee.sprite)).size,6,'each hired partner has a distinct character');
});

test('Sesame has independent front and rear art while Xiaohei retains the red delivery uniform',async()=>{
  const root=new URL('../public/assets/restaurant/',import.meta.url),manifest=JSON.parse(await readFile(new URL('sprites.json',root),'utf8'));
  assert.equal(RESTAURANT_STAFF.find(employee=>employee.id==='shadow').sprite,'waiter');
  assert.equal(RESTAURANT_STAFF.find(employee=>employee.id==='sesame').sprite,'staff-sesame');
  assert.deepEqual([manifest.staffSesameAtlas.width,manifest.staffSesameAtlas.height],[256,512]);
  const images=[];
  for(const suffix of ['','-back']){
    const cell=manifest.characters[`staff-sesame${suffix}`],bytes=await readFile(new URL(`characters/staff-sesame${suffix}.webp`,root));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(cell.atlas,'staff-sesame-v1.webp');assert.equal(cell.anchor.y,.9375);
    assert.deepEqual([cell.x,cell.y,cell.width,cell.height],[0,suffix?256:0,256,256]);images.push(bytes);
    assert.notDeepEqual(bytes,await readFile(new URL(`characters/waiter${suffix}.webp`,root)));
  }
  assert.notDeepEqual(...images);
});

test('hiring all six charges the displayed currency once each and the team has a real ceiling',()=>{
  const state=hireAll(),before=structuredClone(state);
  assert.equal(state.restaurant.staff,6);assert.equal(restaurantInfo(state,NOW).hireCost,null);
  assert.equal(validRestaurant(state.restaurant),true);
  assert.equal(act(state,'restaurant-hire'),null);
  assert.deepEqual(state,before);
  for(let count=3;count<6;count++){
    const poor=funded();poor.restaurant.staff=count;poor.coins=0;poor.goldFish=0;
    assert.equal(act(poor,'restaurant-hire'),null);
    assert.equal(poor.restaurant.staff,count);
  }
});

test('a saved three-person team keeps its active order and progress when the fourth employee joins',()=>{
  let state=funded();
  for(let i=0;i<3;i++)state=act(state,'restaurant-hire');
  state=act(state,'restaurant-start',{recipeId:'sandwich'});
  const oldOrder=structuredClone(state.restaurant.orders[0]),legacy=structuredClone(state);
  delete legacy.restaurant.parties;delete legacy.restaurant.progression;
  const restored=normalizeState(legacy,NOW+1000);
  assert.equal(restored.restaurant.staff,3);assert.deepEqual(restored.restaurant.orders,[oldOrder]);
  assert.equal(restored.coins,state.coins);assert.equal(restored.xp,state.xp);
  const hired=act(restored,'restaurant-hire',{},NOW+1000);
  assert.equal(hired.restaurant.staff,4);assert.deepEqual(hired.restaurant.orders,[oldOrder]);
  assert.equal(hired.restaurant.orders[0].staffLevel,3);
});

test('orders accepted with six employees survive reload and award the shared wallet and experience',()=>{
  const staff=hireAll(),started=act(staff,'restaurant-start',{recipeId:'sandwich'}),order=started.restaurant.orders[0];
  assert.equal(order.staffLevel,6);assert.equal(validRestaurant(started.restaurant),true);
  const restored=normalizeState(JSON.parse(JSON.stringify(started)),NOW+500);
  assert.equal(restored.restaurant.staff,6);assert.deepEqual(restored.restaurant.orders,[order]);
  const projected=restaurantInfo(restored,NOW).orders[0];
  const completed=act(restored,'restaurant-collect',{orderId:order.id},projected.autoServeAt+RESTAURANT_DINING_MS);
  assert.equal(completed.coins,restored.coins+projected.rewardCoins);assert.equal(completed.xp,restored.xp);assert.equal(completed.pendingGrowth.at(-1).amount,projected.rewardXp);
  assert.equal(completed.restaurant.staff,6);
});

test('the kitchen accepts all six hired partners and exposes seven individually identified workers',()=>{
  const state=hireAll();
  const workflow=createKitchenWorkflow(state.restaurant,'rice',NOW,{orderId:'table-1',seat:0});
  assert.ok(workflow);assert.equal(workflow.staffLevel,6);
  const workers=kitchenInfo(state.restaurant,NOW).workers;
  assert.equal(workers.length,7);assert.equal(new Set(workers.map(worker=>worker.id)).size,7);
  assert.deepEqual(workers.map(worker=>worker.id),Array.from({length:7},(_,index)=>`worker-${index+1}`));
});

test('the staff sheet previews every new employee without changing the next recruitment target',()=>{
  const info=restaurantInfo(initialState(NOW),NOW);
  for(const employee of RESTAURANT_STAFF.filter(employee=>employee.isNew)){
    const markup=restaurantStaffPanel(info,{staffId:employee.id});
    assert.equal((markup.match(/data-r-staff-preview=/g)||[]).length,6);
    assert.ok(markup.includes(`data-r-staff-detail="${employee.id}"`));
    assert.ok(markup.includes(`r-cat-${employee.sprite}`));
    assert.ok(markup.includes(employee.description));
    assert.doesNotMatch(markup,/data-r-action="train"|r-staff-speech/);
    assert.ok(markup.includes(`${employee.name} · ${employee.role}</h3>`));
    assert.ok(markup.includes('雇佣下一位 · 小黑'));
    assert.ok(markup.includes('0 / 6'));
  }
  assert.equal(info.restaurant.staff,0);
});

test('every new employee ships distinct front and back images with bounded feet-aligned atlas cells',async()=>{
  const root=new URL('../public/assets/restaurant/',import.meta.url),manifest=JSON.parse(await readFile(new URL('sprites.json',root),'utf8'));
  assert.deepEqual([manifest.staffExpansionAtlas.width,manifest.staffExpansionAtlas.height],[768,512]);
  assert.equal(Object.keys(manifest.staffCharacters).length,6);
  for(const employee of RESTAURANT_STAFF.filter(employee=>employee.isNew))for(const suffix of ['','-back']){
    const id=employee.sprite+suffix,cell=manifest.staffCharacters[id],bytes=await readFile(new URL(`characters/${id}.webp`,root));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(cell.x>=0&&cell.x+cell.width<=768&&cell.y>=0&&cell.y+cell.height<=512);
    assert.equal(cell.anchor.y,.9375);assert.equal(cell.row,suffix?1:0);
  }
});

test('a real room persists the sixth hire and duplicate operation retries never charge twice',async()=>{
  let file=null,serial=0;
  const fetchImpl=async(url,options)=>{
    if(options.method==='GET')return file?Response.json({sha:file.sha,encoding:'base64',content:Buffer.from(JSON.stringify(file.room)).toString('base64')},{headers:{etag:file.sha}}):new Response('{}',{status:404});
    const body=JSON.parse(options.body);
    if(file&&body.sha!==file.sha)return new Response('{}',{status:409});
    file={sha:`staff-sha-${++serial}`,room:JSON.parse(Buffer.from(body.content,'base64').toString())};
    return new Response('{}',{status:201});
  };
  const makeStore=()=>createGitHubStore({token:'test-token',repository:'test/cat-data',fetchImpl,now:()=>NOW});
  const store=makeStore(),room=await store.createRoom();
  file.room.state.coins=50000;file.room.state.goldFish=1000;file.room.state.restaurant.stats.experience=levelStartXp(50);file.sha='staff-funded';
  let latest,request;
  for(let i=0;i<6;i++){
    request={operationId:`staff-recruit-operation-${i}`,clientId:actor.id,name:actor.name,action:{type:'restaurant-hire'}};
    latest=await store.applyAction(room.roomId,request);
  }
  const retry=await makeStore().applyAction(room.roomId,request);
  assert.equal(retry.duplicate,true);assert.equal(retry.state.coins,latest.state.coins);
  assert.equal(retry.state.goldFish,latest.state.goldFish);
  const restored=await makeStore().getRoom(room.roomId);
  assert.equal(restored.roomId,room.roomId);assert.equal(restored.state.restaurant.staff,6);
  assert.equal(validRestaurant(restored.state.restaurant),true);
});
