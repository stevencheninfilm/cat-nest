import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction, FOODS, levelStartXp } from '../src/state.js';
import { COLLECTION_CATS, collectionSceneInvitation, collectionCatProgress } from '../src/cat-collection.js';
import { CAT_SCENES, sceneAllowsCat } from '../src/catbook-scenes.js';
import { catbookMarkup } from '../src/catbook-ui.js';

const now=Date.UTC(2026,9,15),actor={id:'invitation-hint-tester',name:'猫友'};
function prepared() {
  const state=initialState(now);state.xp=levelStartXp(120);
  state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};
  state.collection.foods=Object.keys(FOODS);state.collection.wins={rps:12,memory:12,gomoku:12};
  state.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:10,play:10,sleep:3}};
  state.collection.invited=COLLECTION_CATS.slice(0,24).map(cat=>({id:cat.id,at:now,operationId:`hint-prior-${cat.id}`,actorId:actor.id}));
  return state;
}
const readyIds=html=>[...html.matchAll(/class="book-yard-placeholder[^\"]*is-invite-ready[^>]*data-book-cat="([^\"]+)"/g)].map(match=>match[1]);
const card=(html,id)=>html.match(new RegExp(`<button class="book-cat-card[^>]*data-book-cat="${id}"[^>]*>[\\s\\S]*?<\\/button>`))[0];
const sceneChoice=(html,id)=>html.match(new RegExp(`<button data-book-scene="${id}"[^>]*>[\\s\\S]*?<\\/button>`))[0];

test('already collected cats get visible invitation hints independently in every unlocked new map',()=>{
  const state=prepared(),before=structuredClone(state);
  for(const scene of CAT_SCENES) {
    const html=catbookMarkup(state,{sceneId:scene.id});
    const expected=COLLECTION_CATS.filter(cat=>sceneAllowsCat(scene,cat) && collectionCatProgress(cat,state.collection,120,state.diary).complete && !collectionSceneInvitation(state.collection,cat.id,scene.id)).map(cat=>cat.id);
    assert.deepEqual(readyIds(html),expected,scene.id);
    assert.equal((html.match(/class="book-yard-invite-hint"/g)||[]).length,expected.length);
    for(const id of expected) {
      assert.match(card(html,id),/can-invite-here/);
      assert.match(card(html,id),/book-card-status[^>]*>[\s\S]*可以邀请了/);
    }
    if(expected.length)assert.match(html,new RegExp(`可以邀请了 · ${expected.length}只`));
  }
  assert.deepEqual(state,before,'opening a map never writes invitation receipts');
});

test('a ready marker remains during save and disappears only for the map with a confirmed invitation',()=>{
  const state=prepared(),before=catbookMarkup(state,{sceneId:'garden'}),pending=catbookMarkup(state,{sceneId:'garden',saving:true});
  assert.ok(readyIds(before).includes('bandit'));assert.ok(readyIds(pending).includes('bandit'));
  const saved=reduceAction(state,{type:'invite-cat',catId:'bandit',sceneId:'garden'},actor,now,'hint-confirmed-garden');
  const garden=catbookMarkup(saved,{sceneId:'garden'}),snow=catbookMarkup(saved,{sceneId:'snow'});
  assert.ok(!readyIds(garden).includes('bandit'));
  assert.doesNotMatch(card(garden,'bandit'),/can-invite-here|可以邀请了/);
  assert.match(card(garden,'bandit'),/本场景已邀请/);
  assert.ok(readyIds(snow).includes('bandit'),'another map still needs its own invitation');
  assert.equal(saved.collection.invited.length,state.collection.invited.length);
  assert.deepEqual([saved.coins,saved.xp],[state.coins,state.xp]);
});

test('locked cats and cats belonging to another map never receive the current-map ready marker',()=>{
  const state=prepared(),html=catbookMarkup(state,{sceneId:'garden'});
  assert.doesNotMatch(card(html,'nightwatch'),/can-invite-here|可以邀请了/);
  assert.doesNotMatch(card(html,'scout'),/can-invite-here|可以邀请了/);
  assert.match(card(html,'scout'),/在其他庭院相遇/);
  assert.ok(!readyIds(html).includes('scout'));
});

test('map choices show their own invitation count and locked map choices do not advertise available invitations',()=>{
  const state=prepared(),html=catbookMarkup(state);
  assert.doesNotMatch(sceneChoice(html,'station'),/可以邀请了/);
  assert.match(sceneChoice(html,'garden'),/可以邀请了 · \d+ 只猫猫/);
  assert.match(sceneChoice(html,'western'),/可以邀请了 · \d+ 只猫猫/);
  assert.match(sceneChoice(html,'snow'),/可以邀请了 · \d+ 只猫猫/);
  state.collection.invited=state.collection.invited.slice(0,1);
  const locked=catbookMarkup(state);
  assert.match(sceneChoice(locked,'western'),/disabled/);
  assert.doesNotMatch(sceneChoice(locked,'western'),/可以邀请了/);
});
