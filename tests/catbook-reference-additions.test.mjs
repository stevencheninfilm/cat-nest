import { invitedEverywhere } from './catbook-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_CATS, collectionCatProgress, validCollection } from '../src/cat-collection.js';
import { REFERENCE_CAT_DEFINITIONS } from '../src/catbook-reference-cats.js';
import { REFERENCE_CAT_POSES, REFERENCE_CAT_WALKS } from '../src/catbook-reference-sprites.js';
import { CAT_SCENES, sceneCatPlacement, sceneAllowsCat, sceneCatClipPath, catArrivalScene } from '../src/catbook-scenes.js';
import { catbookMarkup, catArrivalMarkup } from '../src/catbook-ui.js';
import { initialState, normalizeState, FOODS, levelStartXp } from '../src/state.js';
import { createCollectionEvents, catArrivalRoute } from '../src/catbook-events.js';

const now=Date.UTC(2026,9,15), additions=COLLECTION_CATS.filter(cat=>cat.reviewOutline);
const receipt=cat=>({id:cat.id,at:now,operationId:`reference-invite-${cat.id}`,actorId:'reference-review'});
function owned() {
  const state=initialState(now); state.xp=levelStartXp(120);
  state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};
  state.collection.foods=Object.keys(FOODS); state.collection.wins={rps:12,memory:12,gomoku:12};
  state.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:10,play:10,sleep:3}};
  state.collection.invited=COLLECTION_CATS.map(receipt); return state;
}

test('the eleven reference marks add twelve distinct cats, including two separate carriage passengers',()=>{
  assert.equal(REFERENCE_CAT_DEFINITIONS.length,12); assert.equal(COLLECTION_CATS.length,36);
  assert.deepEqual(additions.map(cat=>cat.id),REFERENCE_CAT_DEFINITIONS.map(cat=>cat.id));
  assert.equal(new Set(COLLECTION_CATS.map(cat=>cat.id)).size,36);
  for(const id of ['wheat','pebble']) {
    const placement=sceneCatPlacement(CAT_SCENES[0],additions.find(cat=>cat.id===id));
    assert.match(placement.surface,/车厢/); assert.match(sceneCatClipPath(CAT_SCENES[0],placement),/^polygon\(/);
  }
});

test('only the new cohort carries red review markers in all four scenes, both owned and awaiting invitation',()=>{
  const state=owned(), before=structuredClone(state);
  for(const scene of CAT_SCENES) {
    const html=catbookMarkup(invitedEverywhere(state),{sceneId:scene.id});
    const ids=[...html.matchAll(/class="book-yard-cat[^>]*data-book-cat="([^"]+)"[^>]*data-book-new="true"/g)].map(match=>match[1]);
    assert.deepEqual(ids,additions.filter(cat=>!(scene.id === 'garden' && cat.id === 'porter')).map(cat=>cat.id));
    for(const cat of additions) {
      if(scene.id === 'garden' && cat.id === 'porter') {
        assert.equal(sceneAllowsCat(scene,cat),false); assert.equal(catArrivalScene(scene,cat),CAT_SCENES[0]);
        continue;
      }
      assert.equal(sceneAllowsCat(scene,cat),true); assert.equal(catArrivalScene(scene,cat),scene);
      assert.ok(catArrivalRoute(scene,cat,{width:600,height:900,left:0,top:0,viewWidth:390,viewHeight:844}));
    }
  }
  assert.deepEqual(state,before);
  state.collection.invited=[];
  const locked=catbookMarkup(invitedEverywhere(state),{sceneId:'station'});
  assert.equal((locked.match(/stroke="#e74f46"/g)||[]).length,12);
  assert.equal((locked.match(/stroke="#525952"/g)||[]).length,24);
  assert.equal((locked.match(/data-book-new="true"/g)||[]).length,12);
});

test('each new identity has its own pose and two walking frames, including full-body arrivals for head-only passengers',()=>{
  assert.equal(REFERENCE_CAT_POSES.length,12); assert.equal(REFERENCE_CAT_WALKS.length,12);
  for(const [index,cat] of additions.entries()) {
    assert.equal(sceneCatPlacement(CAT_SCENES[0],cat).texture,'reference-cats-v1');
    const walk=REFERENCE_CAT_WALKS[index];
    assert.notEqual(walk.a,walk.b); assert.match(catArrivalMarkup(cat,1),/reference-walking-v1\.png/);
    assert.ok(walk.ratio.split('/').every(value=>Number(value)>0));
  }
});

test('new invitations use confirmed collection receipts and never replay on reload',()=>{
  const next=owned(), cat=additions[0], previous=structuredClone(next);
  previous.collection.invited=previous.collection.invited.filter(record=>record.id !== cat.id);
  const events=createCollectionEvents(previous);
  assert.deepEqual(events.observe(previous),[]);
  assert.deepEqual(events.observe(next),[{type:'cat-arrived',id:cat.id}]);
  assert.deepEqual(events.observe(normalizeState(JSON.parse(JSON.stringify(next)),now)),[]);
});

test('Cloudcap patrols only after settling and locked cats keep their stationary silhouette',()=>{
  const state=owned();
  const button=html=>html.match(/<button class="book-yard-cat[^>]*data-book-cat="cloudcap"[^>]*>[\s\S]*?<\/button>/)[0];
  for(const scene of CAT_SCENES) {
    const settled=button(catbookMarkup(invitedEverywhere(state),{sceneId:scene.id}));
    assert.match(settled,/is-patrolling/);
    assert.match(settled,/class="book-cat-patrol"/);
    assert.match(settled,/reference-walking-v1\.png/);
    assert.match(settled,/--walk-a:[^;]+;--walk-b:/,'the patrol uses both leg poses');
    for(const phase of [{arrivingCatId:'cloudcap'},{settlingCatId:'cloudcap'}]) {
      const entering=button(catbookMarkup(invitedEverywhere(state),{sceneId:scene.id,...phase}));
      assert.doesNotMatch(entering,/is-patrolling|book-cat-patrol/);
      assert.match(entering,/reference-cats-v1\.png/);
    }
  }
  state.collection.invited=state.collection.invited.filter(cat=>cat.id!=='cloudcap');
  const locked=catbookMarkup(invitedEverywhere(state),{sceneId:'station'});
  assert.match(locked,/data-book-locked-cat="cloudcap"/);
  assert.doesNotMatch(locked,/book-cat-patrol/);
});

test('the original collection survives expansion without auto-inviting or modifying resources',()=>{
  const old=owned(); old.collection.invited=old.collection.invited.slice(0,24);
  const before=structuredClone(old), restored=normalizeState(JSON.parse(JSON.stringify(old)),now);
  assert.equal(validCollection(restored.collection,Object.keys(FOODS)),true);
  assert.deepEqual(restored.collection,before.collection);
  assert.equal(restored.coins,before.coins); assert.equal(restored.xp,before.xp);
  for(const cat of additions) assert.equal(collectionCatProgress(cat,restored.collection,120).invited,null);
  assert.deepEqual(createCollectionEvents(restored).observe(restored),[]);
});
