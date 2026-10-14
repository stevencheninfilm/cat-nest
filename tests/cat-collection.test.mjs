import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, initialState, normalizeState, reduceAction, levelInfo, levelStartXp, CARE_LIMITS } from '../src/state.js';
import { COLLECTION_CATS, emptyCollection, canInviteCat, validCollection, collectionCatProgress, getCollectionCat } from '../src/cat-collection.js';
import { catbookMarkup, collectionScene } from '../src/catbook-ui.js';
import { sanitizeAction } from '../server/github-store.mjs';
import { validateAction } from '../src/realtime.js';
const start=Date.UTC(2026,9,14,0);
const actor={ id:'partner-male', name:'男方' };
const act=(state, action, now=start, id=`collection-${action.type}-${now}`) => reduceAction(state, action, actor, now, id);

test('each achievement counts accepted care once, while retries, rejected actions, and waking award nothing', () => {
  const before=initialState(start);
  const fed=act(before,{ type:'feed',food:'meal' });
  assert.equal(fed.collection.stats.feed,1);
  assert.equal(before.collection.stats.feed,0,'the original snapshot is immutable');
  assert.equal(act(fed,{ type:'feed',food:'fish' },start+1),null);
  assert.deepEqual(fed.collection.foods,['meal']);
  const asleep=act(fed,{type:'sleep'});
  assert.equal(asleep.collection.stats.sleep,1);
  const awake=act(asleep,{type:'sleep'},start+1);
  assert.equal(awake.collection.stats.sleep,1);
  const renamed=act(awake,{type:'rename',name:'团子'},start+2);
  const dressed=act(renamed,{type:'dress',appearance:renamed.appearance},start+3);
  const claimed=act(dressed,{type:'claim-growth',rewardId:fed.pendingGrowth[0].id},start+4);
  assert.deepEqual(claimed.collection,dressed.collection,'claiming XP and cosmetic actions never count as care');
});

test('lifetime counters and distinct foods survive midnight, more than forty diary entries, and reload', () => {
  let state=initialState(start);
  for(let day=0;day<50;day++) state=act(state,{type:'pet'},start+day*86400_000,`collection-pet-${day}`);
  assert.equal(state.history.length,40);
  assert.equal(state.collection.stats.pet,50);
  for(const [index,food] of ['meal','fish','water','meal'].entries()) state=act(state,{type:'feed',food},start+(51+index)*86400_000,`collection-feed-${index}`);
  const restored=normalizeState(JSON.parse(JSON.stringify(state)),start+100*86400_000);
  assert.equal(restored.careLimits.counts.feed,0);
  assert.equal(restored.collection.stats.pet,50);
  assert.equal(restored.collection.stats.feed,4);
  assert.deepEqual(restored.collection.foods,['meal','fish','water']);
  assert.equal(canInviteCat('gozer',restored.collection,levelInfo(restored.xp).level),false);
  for(const [index,food] of Object.keys(FOODS).filter(food=>!state.collection.foods.includes(food)).entries()) state=act(state,{type:'feed',food},start+(101+index)*86400_000,`collection-new-food-${index}`);
  const allFoods=normalizeState(JSON.parse(JSON.stringify(state)),start+120*86400_000);
  assert.equal(allFoods.collection.foods.length,9);
  assert.equal(canInviteCat('gozer',allFoods.collection,levelInfo(allFoods.xp).level),true);
});

test('the pair achievement requires an actual shared feeding reward and never repeats within the same round', () => {
  const first=act(initialState(start),{type:'feed',food:'meal'});
  let paired=reduceAction(first,{type:'feed',food:'fish'},{id:'partner-female',name:'女方'},start+1,'collection-paired-feed');
  assert.equal(first.collection.stats.pair,0);
  assert.equal(paired.collection.stats.pair,1);
  assert.equal(canInviteCat('lexy',paired.collection,1),false);
  const next=act(paired,{type:'feed',food:'meal'},start+CARE_LIMITS.feed.cooldownMs,'collection-later-feed');
  assert.equal(next.collection.stats.pair,1);
  paired=next;
  for(let round=1;round<12;round++) {
    const now=start+round*86400_000;
    paired=act(paired,{type:'feed',food:'meal'},now,`collection-pair-male-${round}`);
    paired=reduceAction(paired,{type:'feed',food:'fish'},{id:'partner-female',name:'女方'},now+1,`collection-pair-female-${round}`);
  }
  assert.equal(paired.collection.stats.pair,12);
  assert.equal(canInviteCat('lexy',paired.collection,1),true);
});

test('invitation requires its achievement, preserves all resources, and stays collected after reload', () => {
  const before=initialState(start);
  assert.equal(act(before,{type:'invite-cat',catId:'bolt'}),null);
  assert.equal(act(before,{type:'invite-cat',catId:'unknown-cat'}),null);
  let met=before;
  for(let day=0;day<6;day++) met=act(met,{type:'feed',food:'meal'},start+day*86400_000,`collection-bolt-feed-${day}`);
  const metAt=start+5*86400_000;
  const invited=act(met,{type:'invite-cat',catId:'bolt'},metAt+1,'collection-bolt-invite');
  assert.deepEqual(invited.collection.invited,[{id:'bolt',at:metAt+1,operationId:'collection-bolt-invite',actorId:actor.id}]);
  for(const key of ['coins','love','xp','hunger','mood','energy','careLimits','pendingGrowth']) assert.deepEqual(invited[key],met[key],key);
  assert.equal(met.collection.invited.length,0);
  assert.equal(act(invited,{type:'invite-cat',catId:'bolt'},metAt+2),null);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(invited)),metAt+20*86400_000).collection,invited.collection);
  const welcome=act(invited,{type:'invite-cat',catId:'bandit'},metAt+3);
  assert.equal(welcome.collection.invited.length,2);
});

test('level invitations require claimed growth, not pending rewards or the pet affection count', () => {
  const before={...initialState(start),xp:levelStartXp(8)-1,love:99999};
  const fed=act(before,{type:'feed',food:'meal'});
  assert.equal(act(fed,{type:'invite-cat',catId:'dottie'},start+1),null);
  const claimed=act(fed,{type:'claim-growth',rewardId:fed.pendingGrowth[0].id},start+2);
  assert.equal(levelInfo(claimed.xp).level,8);
  assert.ok(act(claimed,{type:'invite-cat',catId:'dottie'},start+3));
});

test('every later cat rejects an invitation below its threshold and accepts it at the exact boundary', () => {
  for(const cat of COLLECTION_CATS.filter(cat=>cat.metric !== 'welcome')) {
    const state=initialState(start);
    if(cat.metric === 'level') state.xp=levelStartXp(cat.target)-1;
    else if(cat.metric === 'foods') state.collection.foods=Object.keys(FOODS).slice(0,cat.target-1);
    else state.collection.stats[cat.metric]=cat.target-1;
    assert.equal(act(state,{type:'invite-cat',catId:cat.id}),null,`${cat.id} below threshold`);
    if(cat.metric === 'level') state.xp=levelStartXp(cat.target);
    else if(cat.metric === 'foods') state.collection.foods=Object.keys(FOODS).slice(0,cat.target);
    else state.collection.stats[cat.metric]=cat.target;
    const invited=act(state,{type:'invite-cat',catId:cat.id});
    assert.equal(invited?.collection.invited[0].id,cat.id,`${cat.id} at threshold`);
    assert.equal(state.collection.invited.length,0);
  }
});

test('existing invitations remain collected after harder requirements and reload', () => {
  const state=initialState(start);
  state.collection.invited=[{id:'bolt',at:start,operationId:'legacy-bolt-invitation',actorId:actor.id}];
  state.collection.stats.feed=1;
  const restored=normalizeState(JSON.parse(JSON.stringify(state)),start+86400_000);
  assert.deepEqual(restored.collection,state.collection);
  const progress=collectionCatProgress(getCollectionCat('bolt'),restored.collection,1);
  assert.equal(progress.complete,true);
  assert.equal(progress.fraction,1);
  assert.equal(canInviteCat('bolt',restored.collection,1),false);
  const html=catbookMarkup(restored,{tab:'achievements'});
  assert.match(html,/已收集，陪伴记录保留 · 闪电已入住/);
  assert.match(html,/<button class="book-achievement-row complete" data-book-cat="bolt"[^>]*><span class="book-achievement-art"><span class="book-cat-sprite "/);
});

test('uninvited portraits stay gray in the catalog, achievements and details, even when ready', () => {
  let state=act(initialState(start),{type:'invite-cat',catId:'bandit'});
  state.collection.stats.feed=6;
  const card=(html,id)=>html.match(new RegExp(`<button[^>]*data-book-cat="${id}"[^>]*>.*?</button>`))[0];
  for(const tab of ['book','achievements']) {
    const html=catbookMarkup(state,{tab,catId:'bolt'});
    assert.match(card(html,'bolt'),/book-cat-sprite undiscovered/,'ready but not invited');
    assert.match(card(html,'breezy'),/book-cat-sprite undiscovered/,'locked');
    assert.doesNotMatch(card(html,'bandit'),/undiscovered/,'collected');
    assert.match(html,/book-detail-art"><span class="book-cat-sprite undiscovered/);
  }
  state=act(state,{type:'invite-cat',catId:'bolt'},start+1);
  for(const tab of ['book','achievements']) assert.doesNotMatch(card(catbookMarkup(state,{tab}),'bolt'),/undiscovered/);
});

test('legacy migration uses known records as lower bounds and never duplicates them on repeated normalization', () => {
  const legacy=act(initialState(start),{type:'feed',food:'fish'});
  delete legacy.collection;
  legacy.history.push({text:'温柔地摸了摸小猫',actor:'男方',at:start});
  legacy.careLimits.counts.pet=3;
  const migrated=normalizeState(legacy,start+86400_000);
  assert.equal(migrated.collection.stats.feed,1);
  assert.equal(migrated.collection.stats.pet,3);
  assert.deepEqual(migrated.collection.foods,['fish']);
  assert.equal(migrated.careLimits.counts.pet,0);
  assert.deepEqual(normalizeState(migrated,start+2*86400_000).collection,migrated.collection);
  assert.equal(migrated.collection.invited.length,0,'migration never silently invites a cat');
});

test('the bounded collection ledger rejects duplicate cats, invalid counters, foods, and forged receipt fields', () => {
  const invited=act(initialState(start),{type:'invite-cat',catId:'bandit'}).collection;
  assert.equal(validCollection(invited,Object.keys(FOODS)),true);
  for(const invalid of [
    {...invited,stats:{...invited.stats,feed:-1}},
    {...invited,stats:{...invited.stats,pet:Infinity}},
    {...invited,foods:['meal','meal']},
    {...invited,foods:['unknown']},
    {...invited,invited:[...invited.invited,...invited.invited]},
    {...invited,invited:[{...invited.invited[0],id:'unknown'}]},
    {...invited,invited:[{...invited.invited[0],operationId:'short'}]},
    {...invited,invited:[{...invited.invited[0],actorId:'bad'}]},
    {...invited,allUnlocked:true},
  ]) assert.equal(validCollection(invalid,Object.keys(FOODS)),false);
  assert.deepEqual(normalizeState({...initialState(start),collection:{allUnlocked:true}},start).collection,emptyCollection());
});

test('both shared transport validators accept only known invitations with the exact payload', () => {
  for(const validate of [sanitizeAction,validateAction]) {
    assert.deepEqual(validate({type:'invite-cat',catId:'bandit'}),{type:'invite-cat',catId:'bandit'});
    for(const action of [{type:'invite-cat',catId:'unknown'},{type:'invite-cat',catId:'bandit',unlocked:true},{type:'invite-cat'}, {type:'invite-cat',catId:12}]) assert.equal(validate(action),null);
  }
});

test('the scene contains exactly the invited cats and unlocks extra yards only after enough invitations', () => {
  let state=initialState(start);
  const empty=catbookMarkup(state);
  assert.match(empty,/正等着第一位朋友/);
  assert.equal((empty.match(/class="book-yard-cat\b/g)||[]).length,0);
  assert.match(empty,/data-book-scene="western"[^>]*disabled/);
  assert.match(empty,/data-book-scene="snow"[^>]*disabled/);
  state.collection.stats={feed:30,pet:100,play:50,sleep:6,pair:12};
  state.collection.foods=Object.keys(FOODS);
  state.xp=levelStartXp(15);
  for(const cat of COLLECTION_CATS) state=act(state,{type:'invite-cat',catId:cat.id},start,`collection-invite-${cat.id}`);
  const full=catbookMarkup(state,{sceneId:'snow'});
  assert.equal((full.match(/class="book-yard-cat\b/g)||[]).length,12);
  assert.match(full,/data-scene-id="snow"/);
  assert.doesNotMatch(full,/data-book-scene="(?:western|snow)"[^>]*disabled/);
  assert.equal(collectionScene('western',6).id,'garden');
  assert.equal(collectionScene('western',7).id,'garden');
  assert.equal(collectionScene('western',8).id,'western');
  assert.equal(collectionScene('snow',6).id,'garden');
  assert.equal(collectionScene('snow',11).id,'garden');
  assert.equal(collectionScene('snow',12).id,'snow');
  assert.equal(collectionScene('fake',12).id,'garden');
});

test('locked invitations, saving and disconnected states disable inviting, and names cannot inject HTML', () => {
  const state={...initialState(start),name:'<img src=x onerror=alert(1)>'};
  assert.match(catbookMarkup(state,{catId:'bolt'}),/data-book-invite="bolt" disabled/);
  assert.match(catbookMarkup(state,{saving:true}),/data-book-invite="bandit" disabled/);
  assert.match(catbookMarkup(state,{connected:false}),/data-book-invite="bandit" disabled/);
  assert.match(catbookMarkup(state),/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(catbookMarkup(state),/<img src=x/);
  const snapshot=structuredClone(state);
  catbookMarkup(state,{tab:'achievements'});
  assert.deepEqual(state,snapshot,'previewing cats and scenes never writes a save');
  assert.equal(collectionCatProgress(getCollectionCat('bandit'),state.collection,1).complete,true);
});

test('the default screen is the yard and information is only available through closed drawers', () => {
  const html=catbookMarkup(initialState(start));
  const yard=html.split('<dialog')[0];
  assert.match(yard,/aria-label="猫猫沉浸式庭院"/);
  assert.match(yard,/data-book-open="about"/);
  assert.match(yard,/data-book-page="book"/);
  assert.match(yard,/data-book-page="achievements"/);
  assert.doesNotMatch(yard,/把陪伴，变成新的相遇|class="book-detail"|class="book-catalog"/);
  for (const id of ['about','catalog','detail','scenes']) assert.match(html,new RegExp(`<dialog[^>]*data-book-sheet="${id}"`));
  assert.doesNotMatch(html,/<dialog[^>]*\sopen(?:\s|=|>)/);
});
