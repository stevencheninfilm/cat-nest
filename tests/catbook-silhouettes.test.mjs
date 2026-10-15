import { invitedEverywhere } from './catbook-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_CATS } from '../src/cat-collection.js';
import { CAT_SCENES, sceneAllowsCat, sceneCatPlacement } from '../src/catbook-scenes.js';
import { CAT_SILHOUETTES } from '../src/catbook-silhouettes.js';
import { catbookMarkup } from '../src/catbook-ui.js';
import { initialState, levelStartXp, FOODS } from '../src/state.js';

const start=Date.UTC(2026,9,15);
const lockedIds=html=>[...html.matchAll(/data-book-locked-cat="([^"]+)"/g)].map(match=>match[1]);
const visitorIds=html=>[...html.matchAll(/class="book-yard-cat\b[^>]*data-book-cat="([^"]+)"/g)].map(match=>match[1]);
function completed() {
  const state=initialState(start);
  state.xp=levelStartXp(120);
  state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};
  state.collection.foods=Object.keys(FOODS);
  state.collection.wins={rps:12,memory:12,gomoku:12};
  state.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:10,play:10,sleep:3}};
  return state;
}
const invite=cat=>({id:cat.id,at:start,operationId:`silhouette-${cat.id}`,actorId:'silhouette-test'});

test('an untouched collection shows clickable unlock silhouettes without colored sprites or invitation actions',()=>{
  const state=initialState(start), before=structuredClone(state);
  const html=catbookMarkup(state), yard=html.split('</div><div class="book-arrivals"')[0];
  assert.deepEqual(lockedIds(yard),COLLECTION_CATS.map(cat=>cat.id));
  assert.deepEqual(visitorIds(yard),[]);
  assert.equal((yard.match(/class="book-cat-silhouette"/g)||[]).length,COLLECTION_CATS.length);
  assert.equal((yard.match(/class="book-cat-silhouette"[^>]*fill="#bcbdb9"[^>]*stroke="#525952"[^>]*stroke-dasharray="[\d.]+ [\d.]+"/g)||[]).length,COLLECTION_CATS.filter(cat=>!cat.reviewOutline).length);
  assert.doesNotMatch(yard,/class="book-scene-cat"|<image\b|<rect\b|background-image|data-book-invite=/);
  const buttons=[...yard.matchAll(/<button\b[^>]*data-book-locked-cat="([^"]+)"[^>]*>/g)];
  assert.equal(buttons.length,COLLECTION_CATS.length);
  for(const [,id] of buttons)assert.match(yard,new RegExp(`data-book-locked-cat="${id}" data-book-cat="${id}"`));
  for(const [button]of buttons){assert.match(button,/aria-haspopup="dialog"/);assert.doesNotMatch(button,/disabled|role="img"/);}
  assert.match(yard,/尚未入住[^>]*未解锁轮廓/);
  assert.deepEqual(state,before,'rendering silhouettes must never alter saved progress');
});

test('awaiting invitation keeps its silhouette until the invitation is confirmed, including during a pending save',()=>{
  const state=completed(), cat=COLLECTION_CATS[0];
  for(const options of [{},{saving:true,arrivingCatId:cat.id}]) {
    const html=catbookMarkup(invitedEverywhere(state),options);
    assert.ok(lockedIds(html).includes(cat.id));
    assert.ok(!visitorIds(html).includes(cat.id));
  }
  state.collection.invited=[invite(cat)];
  for(const options of [{},{arrivingCatId:cat.id},{settlingCatId:cat.id}]) {
    const html=catbookMarkup(invitedEverywhere(state),options);
    assert.ok(!lockedIds(html).includes(cat.id),'confirmed arrivals must not have a duplicate outline');
    assert.deepEqual(visitorIds(html),[cat.id]);
  }
  assert.match(catbookMarkup(invitedEverywhere(state),{arrivingCatId:cat.id}),/class="book-yard-cat[^>]*is-arriving[^>]*disabled aria-busy="true"/);
});

test('mixed collections partition scene residents into owned cats and silhouettes using the existing scene rules',()=>{
  const state=completed();
  // Enough qualified friends to access both gated yards; leave some of each pose family unowned.
  state.collection.invited=COLLECTION_CATS.filter(cat=>cat.index%3 !== 1).map(invite);
  const before=structuredClone(state), owned=new Set(state.collection.invited.map(record=>record.id));
  for(const scene of CAT_SCENES) {
    const html=catbookMarkup(invitedEverywhere(state),{sceneId:scene.id});
    const residents=COLLECTION_CATS.filter(cat=>sceneAllowsCat(scene,cat));
    assert.deepEqual(lockedIds(html),residents.filter(cat=>!owned.has(cat.id)).map(cat=>cat.id));
    assert.deepEqual(visitorIds(html),residents.filter(cat=>owned.has(cat.id)).map(cat=>cat.id));
  }
  assert.deepEqual(state,before);
});

test('silhouettes and their invited counterparts use exactly the same scale, pose and landing anchor',()=>{
  const state=completed();
  state.collection.invited=COLLECTION_CATS.slice(0,8).map(invite);
  for(const scene of CAT_SCENES) for(const cat of COLLECTION_CATS.filter(cat=>sceneAllowsCat(scene,cat))) {
    const unowned=structuredClone(state);
    unowned.collection.invited=unowned.collection.invited.filter(record=>record.id !== cat.id);
    // Garden and station are free; gated scenes are already covered by the partition test.
    if(scene.min) continue;
    const locked=catbookMarkup(invitedEverywhere(unowned),{sceneId:scene.id}).match(new RegExp(`data-book-locked-cat="${cat.id}"[^>]*style="([^"]+)"`))[1];
    unowned.collection.invited.push(invite(cat));
    const visible=catbookMarkup(invitedEverywhere(unowned),{sceneId:scene.id}).match(new RegExp(`class="book-yard-cat[^>]*data-book-cat="${cat.id}"[^>]*style="([^"]+)"`))[1];
    assert.equal(locked.split('z-index')[0],visible.split('--idle-delay')[0]);
  }
});

test('every cat has an actual vector contour registered to its current sprite crop',()=>{
  assert.deepEqual(Object.keys(CAT_SILHOUETTES),COLLECTION_CATS.map(cat=>cat.id));
  for(const cat of COLLECTION_CATS) {
    const shape=CAT_SILHOUETTES[cat.id], pose=sceneCatPlacement(CAT_SCENES[0],cat);
    assert.equal(shape.viewBox,`0 0 ${pose.ratio.split('/').map(value=>Number(value.trim())).join(' ')}`);
    assert.match(shape.path,/^M[\d,]+L[\d,LZM]+Z$/);
    assert.ok(shape.path.split('L').length>20,`${cat.id} must follow its pose, not a bounding rectangle`);
  }
});

test('a fully owned collection has no locked silhouettes in any accessible scene',()=>{
  const state=completed();
  state.collection.invited=COLLECTION_CATS.map(invite);
  for(const scene of CAT_SCENES) assert.deepEqual(lockedIds(catbookMarkup(invitedEverywhere(state),{sceneId:scene.id})),[]);
});
