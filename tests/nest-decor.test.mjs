import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,normalizeState,reduceAction,validPendingGrowth,careActionInfo} from '../src/state.js';
import {emptyNest,validNest,placementResult,nestObjects,nestObstacles,nestApproach,NEST_ITEMS,nestActionResult,suggestNestPlacement} from '../src/nest-decor.js';
import {findWorldPath,walkable,ROBOT_APPROACH} from '../src/world-layout.js';
import {sanitizeAction} from '../server/github-store.mjs';
import {createRoomAsset} from '../src/world-assets.js';
import {applyNestScene,previewNestPlacement} from '../src/nest-decor-scene.js';

const at=Date.parse('2026-10-15T08:00:00Z'),male={id:'partner-male',name:'男方'},female={id:'partner-female',name:'女方'};
const act=(s,a,actor=male,id=`test-${a.type}-${a.item||a.palette||a.level||'care'}`)=>reduceAction(s,a,actor,at,id);
test('old saves receive an independent furnished nest without losing progress, care or appearance',()=>{
  const old=initialState(at);delete old.nest;old.coins=999;old.history=[{actor:'女方',text:'喂了一份罐罐',at}];old.appearance.body=3;
  const next=normalizeState(old,at);assert.equal(validNest(next.nest),true);assert.equal(next.nest.owned.length,5);
  for(const field of ['coins','xp','history','appearance','careLimits','coupleCare'])assert.deepEqual(next[field],old[field]);
  next.nest.placements[0].x=22;assert.equal(emptyNest().placements[0].x,0);
});
test('both players can collect, place, turn, store, recolor and upgrade without generating care rewards',()=>{
  let s=initialState(at);const original=structuredClone(s),owned=act(s,{type:'nest-buy',item:'plant'});
  assert.equal(owned.coins,s.coins-120);assert.equal(owned.nest.placements.some(p=>p.item==='plant'),false);
  s=act(owned,{type:'nest-place',item:'plant',x:3,z:2.6,rotation:0},female);assert.ok(s);assert.equal(s.nest.lastEdit.actor,'女方');
  s=act(s,{type:'nest-place',item:'plant',x:3,z:2.6,rotation:1});assert.equal(s.nest.placements.find(p=>p.item==='plant').rotation,1);
  s=act(s,{type:'nest-store',item:'plant'});assert.ok(s.nest.owned.includes('plant'));
  s=act(s,{type:'nest-palette',palette:'mint'},female);assert.equal(s.nest.palette,'mint');
  s=act(s,{type:'nest-upgrade',level:2});assert.equal(s.nest.level,2);assert.equal(s.coins,800);
  for(const field of ['xp','love','hunger','energy','mood','pendingGrowth','careLimits','collection','coupleCare'])assert.deepEqual(s[field],original[field]);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s)),at).nest,s.nest);assert.equal(s.nest.revision,6);
});
test('ownership, level, money, bounds, overlap and reserved passages are authoritative',()=>{
  const s=initialState(at),before=structuredClone(s);
  for(const action of [{type:'nest-buy',item:'toy'},{type:'nest-buy',item:'bookshelf'},{type:'nest-upgrade',level:3},{type:'nest-place',item:'plant',x:3,z:2,rotation:0},{type:'nest-place',item:'toy',x:100,z:0,rotation:0},{type:'nest-place',item:'toy',x:0,z:1.4,rotation:0},{type:'nest-place',item:'toy',x:-2.95,z:0,rotation:0},{type:'nest-place',item:'bed',x:2.85,z:-.8,rotation:1}])assert.equal(act(s,action),null,JSON.stringify(action));
  assert.equal(act({...s,coins:5},{type:'nest-buy',item:'plant'}),null);
  for(const action of [{type:'nest-place',item:'toy',x:NaN,z:0,rotation:0},{type:'nest-place',item:'toy',x:0,z:0,rotation:4},{type:'nest-palette',palette:'<script>'},{type:'nest-buy',item:'plant',cost:0},{type:'nest-upgrade',level:2,coins:999},{type:'pet',furniture:'bed'},{type:'play',furniture:'toy',reward:99}])assert.equal(sanitizeAction(action),null);
  assert.deepEqual(s,before);
});
test('moving and rotating furniture changes the actual collision map and reachable entrances',()=>{
  const s=initialState(at),pose={x:-1,z:2,rotation:1},result=placementResult(s.nest,'toy',pose);
  assert.equal(result.ok,true);const nest=result.nest,obstacles=nestObstacles(nest);
  assert.equal(walkable({x:-1,z:2},.22,obstacles),false);assert.equal(walkable({x:-2.25,z:2.05},.22,obstacles),true);
  for(const item of nestObjects(nest))assert.ok(nestApproach(nest,item.id),item.id);
  assert.ok(findWorldPath({x:0,z:1.4},ROBOT_APPROACH,obstacles));
  for(const item of NEST_ITEMS.filter(i=>!i.base)){const bought={...s,nest:{...s.nest,level:3,owned:[...s.nest.owned,item.id]}};assert.equal(validNest(bought.nest),true);}
});
test('a suggested empty spot respects ownership, collision, capacity and accessible entrances',()=>{
  const nest=emptyNest();assert.equal(suggestNestPlacement(nest,'plant'),null);
  nest.owned.push('plant');const pose=suggestNestPlacement(nest,'plant');assert.ok(pose);assert.equal(placementResult(nest,'plant',pose).ok,true);
});
test('furniture care uses the existing quota, needs, cooperation and permanent growth receipt',()=>{
  let s=initialState(at);s.mood=40;s.energy=40;
  const pet=act(s,{type:'pet',furniture:'sofa'},female,'nest-sofa-care-001');assert.ok(pet);assert.ok(pet.mood>s.mood);
  assert.equal(pet.careLimits.counts.pet,1);assert.equal(pet.coupleCare.records[0].type,'pet');
  assert.equal(pet.pendingGrowth[0].furniture,'sofa');assert.equal(validPendingGrowth(pet.pendingGrowth),true);
  assert.ok(pet.history[0].text.includes('抱枕沙发'));
  assert.equal(act(pet,{type:'pet'}),null);assert.equal(careActionInfo(pet,{type:'pet',furniture:'sofa'},male.id,at).allowed,false);
  assert.equal(act(s,{type:'sleep',furniture:'cushion'}),null,'unowned or stored objects cannot give care');
  const stored=act(s,{type:'nest-store',item:'sofa'});assert.equal(act(stored,{type:'pet',furniture:'sofa'}),null);
  const sleep=act(s,{type:'sleep',furniture:'bed'},male,'nest-bed-care-0001');assert.equal(sleep.sleeping,true);assert.equal(sleep.energy,80);
  const wake=act(sleep,{type:'sleep',furniture:'bed'},male,'nest-bed-wake-0001');assert.equal(wake.sleeping,false);assert.equal(wake.pendingGrowth.length,1);
  const claimed=act(pet,{type:'claim-growth',rewardId:pet.pendingGrowth[0].id},male,'nest-care-claim-001');assert.ok(claimed.xp>pet.xp);assert.equal(claimed.pendingGrowth.length,0);
});
test('3D props, palette and upgrade details reflect the saved state and restore after a preview',()=>{
  const room=createRoomAsset('home'),nest=emptyNest(),props=applyNestScene(room,nest),toy=props.get('toy');
  previewNestPlacement(room,'toy',{x:-1,z:2,rotation:1});assert.equal(toy.position.x,-1);
  applyNestScene(room,nest);assert.equal(toy.position.x,-2.25);
  const updated={...nest,level:3,palette:'mint',owned:[...nest.owned,'plant'],placements:[...nest.placements,{item:'plant',x:3,z:2.6,rotation:0}]};
  applyNestScene(room,updated);assert.equal(props.get('plant').visible,true);assert.equal(room.getObjectByName('BackWall').material.color.getHexString(),'dbe5cc');
  assert.ok(room.getObjectByName('NestUpgrade').children.length>15);
  const stored={...updated,placements:updated.placements.filter(p=>p.item!=='bed')};applyNestScene(room,stored);assert.equal(props.get('bed').visible,false);
});
