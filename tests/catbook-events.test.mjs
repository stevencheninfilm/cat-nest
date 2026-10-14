import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionEvents, catArrivalRoute } from '../src/catbook-events.js';
import { COLLECTION_CATS } from '../src/cat-collection.js';
import { CAT_SCENES, sceneCatPlacement } from '../src/catbook-scenes.js';
import { initialState, reduceAction, levelStartXp, FOODS } from '../src/state.js';
const now=Date.UTC(2026,9,14);
const actor={id:'preview-partner',name:'猫友'};
const invite=(state,id)=>reduceAction(state,{type:'invite-cat',catId:id},actor,now,`event-invite-${id}`);
const completed=()=>{const state=initialState(now);state.xp=levelStartXp(120);state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};state.collection.foods=Object.keys(FOODS);return state;};

test('opening or reloading an existing save produces no retroactive unlocks or entrances',()=>{
  let state=completed();
  for(const cat of COLLECTION_CATS) state=invite(state,cat.id);
  const events=createCollectionEvents(state);
  assert.deepEqual(events.observe(structuredClone(state)),[]);
});

test('a new achievement produces one unlock, while an invitation produces a separate confirmed entrance',()=>{
  const state=initialState(now);state.collection.stats.feed=29;
  const events=createCollectionEvents(state);
  assert.deepEqual(events.observe(state),[]);
  state.collection.stats.feed=30;
  assert.deepEqual(events.observe(state),[{type:'cat-unlocked',id:'bolt'}]);
  assert.deepEqual(events.observe(structuredClone(state)),[]);
  const invited=invite(state,'bolt');
  assert.deepEqual(events.observe(invited),[{type:'cat-arrived',id:'bolt'}]);
  assert.deepEqual(events.observe(invited),[]);
});

test('rejected or pending requests without a changed snapshot never show successful arrivals',()=>{
  const state=initialState(now), events=createCollectionEvents(state);
  assert.equal(invite(state,'bolt'),null);
  for(let update=0;update<4;update++) assert.deepEqual(events.observe(state),[]);
});

test('scene unlocks happen at four and eight confirmed invitations, after the new cat entrance',()=>{
  let state=completed();
  for(const cat of COLLECTION_CATS.slice(0,3)) state=invite(state,cat.id);
  const events=createCollectionEvents(state);
  state=invite(state,'callie');
  assert.deepEqual(events.observe(state),[{type:'cat-arrived',id:'callie'},{type:'scene-unlocked',id:'western'}]);
  assert.deepEqual(events.observe(state),[]);
  for(const cat of COLLECTION_CATS.slice(4,7)) {state=invite(state,cat.id);assert.deepEqual(events.observe(state),[{type:'cat-arrived',id:cat.id}]);}
  state=invite(state,'gabriel');
  assert.deepEqual(events.observe(state),[{type:'cat-arrived',id:'gabriel'},{type:'scene-unlocked',id:'snow'}]);
});

test('one shared update may add several cats and scenes without duplicate achievement notices',()=>{
  const state=completed(), events=createCollectionEvents(state);
  let next=state;
  for(const cat of COLLECTION_CATS) next=invite(next,cat.id);
  const batch=events.observe(next);
  assert.equal(batch.filter(event=>event.type==='cat-arrived').length,12);
  assert.deepEqual(batch.filter(event=>event.type==='scene-unlocked').map(event=>event.id),['western','snow']);
  assert.equal(batch.filter(event=>event.type==='cat-unlocked').length,0);
  assert.deepEqual(events.observe(next),[]);
});

test('older snapshots followed by reconnects do not replay already observed celebrations',()=>{
  const state=initialState(now);state.collection.stats.pet=99;
  const events=createCollectionEvents(state), next=structuredClone(state);
  next.collection.stats.pet=100;
  assert.deepEqual(events.observe(next),[{type:'cat-unlocked',id:'breezy'}]);
  assert.deepEqual(events.observe(state),[]);
  assert.deepEqual(events.observe(next),[]);
});

test('old owned cats only unlock a new scene when enough increased achievements are really met',()=>{
  let state=completed();for(const cat of COLLECTION_CATS) state=invite(state,cat.id);
  state.collection.stats={feed:30,pet:99,play:49,sleep:30,pair:95};
  state.xp=levelStartXp(39);
  const events=createCollectionEvents(state);
  assert.deepEqual(events.observe(state),[]);
  state.collection.stats.play=50;
  assert.deepEqual(events.observe(state),[{type:'scene-unlocked',id:'western'}]);
  state.collection.stats.feed=180;state.collection.stats.pet=600;state.collection.stats.play=300;state.collection.stats.pair=96;state.xp=levelStartXp(120);
  assert.deepEqual(events.observe(state),[{type:'scene-unlocked',id:'snow'}]);
  assert.deepEqual(events.observe(structuredClone(state)),[]);
});

test('every entrance route starts beyond a viewport edge and lands on each scene foot anchor',()=>{
  for(const scene of CAT_SCENES) for(const cat of COLLECTION_CATS) {
    const geometry={width:527,height:1114,left:68,top:148,viewWidth:390,viewHeight:844};
    const route=catArrivalRoute(scene,cat,geometry), place=sceneCatPlacement(scene,cat);
    assert.deepEqual(route.target,{x:geometry.width*place.x/100,y:geometry.height*place.y/100});
    assert.equal(route.frames.at(-1).transform,`translate(${route.target.x}px, ${route.target.y}px)`);
    assert.equal(route.frames[0].offset,0);
    assert.equal(route.frames.at(-1).offset,1);
    for(let index=1;index<route.frames.length;index++) assert.ok(route.frames[index].offset>route.frames[index-1].offset);
    const startX=Number(route.frames[0].transform.match(/translate\(([-\d.]+)px/)[1]);
    assert.ok(startX<geometry.left || startX>geometry.left+geometry.viewWidth);
  }
});
