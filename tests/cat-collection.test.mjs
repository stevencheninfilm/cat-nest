import { invitedEverywhere } from './catbook-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, initialState, normalizeState, reduceAction, levelInfo, levelStartXp, CARE_LIMITS } from '../src/state.js';
import { COLLECTION_CATS, emptyCollection, canInviteCat, validCollection, collectionCatProgress, getCollectionCat } from '../src/cat-collection.js';
import { catbookMarkup, collectionScene } from '../src/catbook-ui.js';
import { CAT_SCENES, collectionSceneProgress, sceneAllowsCat } from '../src/catbook-scenes.js';
import { sanitizeAction } from '../server/github-store.mjs';
import { validateAction } from '../src/realtime.js';
import { formalMemoryEntries } from './memory-fixtures.mjs';
const start=Date.UTC(2026,9,14,0);
const actor={ id:'partner-male', name:'男方' };
const act=(state, action, now=start, id=`collection-${action.type}-${now}`) => reduceAction(state, action, actor, now, id);
const starter=()=>{const state=initialState(start);state.collection.stats.pet=5;return state;};
const completed=()=>{const state=initialState(start);state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};state.collection.foods=Object.keys(FOODS);state.collection.wins={rps:12,memory:12,gomoku:12};state.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:10,play:10,sleep:3}};state.xp=levelStartXp(120);return state;};

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
  assert.equal(canInviteCat('gozer',allFoods.collection,levelInfo(allFoods.xp).level),false,'food variety alone no longer unlocks the cat');
  state=allFoods;
  while(state.collection.stats.feed<53) state=act(state,{type:'feed',food:'water'},start+(130+state.collection.stats.feed)*86400_000,`collection-repeat-food-${state.collection.stats.feed}`);
  assert.equal(canInviteCat('gozer',state.collection,1),false);
  state=act(state,{type:'feed',food:'water'},start+200*86400_000,'collection-54th-feed');
  assert.equal(canInviteCat('gozer',state.collection,1),true);
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
  paired.collection.stats.pair=95;
  paired=act(paired,{type:'feed',food:'meal'},start+86400_000,'collection-pair-male-last');
  assert.equal(canInviteCat('lexy',paired.collection,1),false);
  paired=reduceAction(paired,{type:'feed',food:'fish'},{id:'partner-female',name:'女方'},start+86400_000+1,'collection-pair-female-last');
  assert.equal(paired.collection.stats.pair,96);
  assert.equal(canInviteCat('lexy',paired.collection,1),true);
});

test('invitation requires its achievement, preserves all resources, and stays collected after reload', () => {
  const before=initialState(start);
  assert.equal(act(before,{type:'invite-cat',catId:'bolt'}),null);
  assert.equal(act(before,{type:'invite-cat',catId:'unknown-cat'}),null);
  let met=before;
  for(let day=0;day<30;day++) met=act(met,{type:'feed',food:'meal'},start+day*86400_000,`collection-bolt-feed-${day}`);
  const metAt=start+29*86400_000;
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
  const before={...initialState(start),xp:levelStartXp(40)-1,love:99999};
  const fed=act(before,{type:'feed',food:'meal'});
  assert.equal(act(fed,{type:'invite-cat',catId:'dottie'},start+1),null);
  const claimed=act(fed,{type:'claim-growth',rewardId:fed.pendingGrowth[0].id},start+2);
  assert.equal(levelInfo(claimed.xp).level,40);
  assert.ok(act(claimed,{type:'invite-cat',catId:'dottie'},start+3));
});

test('every cat requires every condition, including the starter and the compound food achievement', () => {
  const setRequirement=(state,{metric,target},below=false,catId)=>{
    if(metric.startsWith('daily-'))state.collection.achievements.daily[metric.slice(6)]=target-(below?1:0);
    else if(['boost','dress'].includes(metric))state.collection.achievements[metric]=target-(below?1:0);
    else if(metric.startsWith('win-')) state.collection.wins[metric.slice(4)]=target-(below?1:0);
    else if(metric === 'diary-cards')state.diary.entries=formalMemoryEntries(start).slice(0,target-(below?1:0));
    else if(metric === 'level') state.xp=levelStartXp(target)-(below?1:0);
    else if(metric === 'foods') state.collection.foods=Object.keys(FOODS).slice(0,target-(below?1:0));
    else state.collection.stats[metric === 'care' ? 'pet' : metric]=target-(below?1:0);
  };
  for(const cat of COLLECTION_CATS) {
    const state=initialState(start);
    for(const requirement of cat.requirements) setRequirement(state,requirement,false,cat.id);
    for(const requirement of cat.requirements) {
      const below=structuredClone(state);setRequirement(below,requirement,true,cat.id);
      assert.equal(act(below,{type:'invite-cat',catId:cat.id}),null,`${cat.id}: ${requirement.metric} below threshold`);
    }
    const before=structuredClone(state);
    const invited=act(state,{type:'invite-cat',catId:cat.id});
    assert.ok(invited?.collection.invited.some(record=>record.id===cat.id),`${cat.id} at threshold`);
    assert.deepEqual(state,before);
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
  assert.match(html,/已收集，陪伴记录保留 · 进阶 1 \/ 30 · 闪电已入住/);
  assert.match(html,/<button class="book-achievement-row complete" data-book-cat="bolt"[^>]*><span class="book-achievement-art"><span class="book-cat-sprite "/);
});

test('uninvited portraits stay gray in the catalog, achievements and details, even when ready', () => {
  let state=act(starter(),{type:'invite-cat',catId:'bandit'});
  state.collection.stats.feed=30;
  const card=(html,id)=>html.match(new RegExp(`<button class="book-(?:cat-card|achievement-row)[^>]*data-book-cat="${id}"[^>]*>.*?</button>`))[0];
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
  const invited=act(starter(),{type:'invite-cat',catId:'bandit'}).collection;
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

test('the scene contains exactly the invited cats and requires enough invited cats meeting the increased goals', () => {
  let state=initialState(start);
  const empty=catbookMarkup(state);
  assert.match(empty,/正等着第一位朋友/);
  assert.equal((empty.match(/class="book-yard-cat\b/g)||[]).length,0);
  assert.match(empty,/data-book-scene="western"[^>]*disabled/);
  assert.match(empty,/data-book-scene="snow"[^>]*disabled/);
  state=completed();
  for(const cat of COLLECTION_CATS)if(canInviteCat(cat.id,state.collection,120,undefined,state.diary))state=act(state,{type:'invite-cat',catId:cat.id},start,`collection-invite-${cat.id}`);
  assert.equal((catbookMarkup(state,{sceneId:'snow'}).match(/class="book-yard-cat\b/g)||[]).length,0,'legacy invitations belong to station only');
  const full=catbookMarkup(invitedEverywhere(state),{sceneId:'snow'});
  assert.equal((full.match(/class="book-yard-cat\b/g)||[]).length,state.collection.invited.filter(record=>sceneAllowsCat(CAT_SCENES.find(scene=>scene.id==='snow'),getCollectionCat(record.id))).length);
  assert.match(full,/data-scene-id="snow"/);
  assert.doesNotMatch(full,/data-book-scene="(?:western|snow)"[^>]*disabled/);
  const atCount=count=>({...state.collection,invited:state.collection.invited.slice(0,count)});
  assert.equal(collectionScene('western',atCount(3),120).id,'station');
  assert.equal(collectionScene('western',atCount(4),120).id,'western');
  assert.equal(collectionScene('snow',atCount(7),120).id,'station');
  assert.equal(collectionScene('snow',atCount(8),120).id,'snow');
  assert.equal(collectionScene('fake',atCount(12),120).id,'station');
  state.collection.stats={feed:30,pet:99,play:50,sleep:6,pair:12};state.xp=levelStartXp(15);state.collection.wins={rps:0,memory:0,gomoku:0};state.collection.invited=state.collection.invited.slice(0,12);
  assert.equal(collectionScene('western',state.collection,15).id,'station','old receipts cannot bypass the increased scene goals');
  assert.equal(collectionSceneProgress(CAT_SCENES.find(scene=>scene.id==='western'),state.collection,15).current,3);
  assert.equal(collectionScene('snow',state.collection,15).id,'station');
  const legacy=catbookMarkup(state,{sceneId:'snow'});
  assert.match(legacy,/data-scene-id="station"/);
  assert.match(legacy,/4 位已入住猫友达成进阶陪伴成就（3 \/ 4）/);
  assert.match(legacy,/8 位已入住猫友达成进阶陪伴成就（3 \/ 8）/);
  assert.equal((legacy.match(/class="book-yard-cat\b/g)||[]).length,12,'all previously owned cats remain in the garden');
});

test('locked invitations, saving and disconnected states disable inviting, and names cannot inject HTML', () => {
  const state={...initialState(start),name:'<img src=x onerror=alert(1)>'};
  assert.match(catbookMarkup(state,{catId:'bolt'}),/data-book-invite="bolt"[^>]* disabled/);
  assert.match(catbookMarkup(state,{saving:true}),/data-book-invite="bandit"[^>]* disabled/);
  assert.match(catbookMarkup(state,{connected:false}),/data-book-invite="bandit"[^>]* disabled/);
  assert.match(catbookMarkup(state),/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(catbookMarkup(state),/<img src=x/);
  const snapshot=structuredClone(state);
  catbookMarkup(state,{tab:'achievements'});
  assert.deepEqual(state,snapshot,'previewing cats and scenes never writes a save');
  assert.equal(collectionCatProgress(getCollectionCat('bandit'),state.collection,1).complete,false);
});

test('difficulty rises by five to eight times without exceeding the available food varieties',()=>{
  assert.deepEqual(COLLECTION_CATS.slice(0,18).map(cat=>[cat.id,cat.metric,cat.target]),[
    ['bandit','care',5],['bolt','feed',30],['breezy','pet',100],['callie','play',50],['cocoa','sleep',30],['dottie','level',40],
    ['fred','feed',180],['gabriel','pet',600],['ginger','play',300],['gozer','feed',54],['lexy','pair',96],['mack','level',120],
    ['scout','win-rps',5],['mochi','win-memory',5],['onyx','win-gomoku',5],['biscuit','win-rps',12],['maple','win-memory',12],['pearl','win-gomoku',12],
  ]);
  for(const cat of COLLECTION_CATS.slice(0,18)) {
    assert.ok(cat.difficultyMultiplier>=5 && cat.difficultyMultiplier<=8);
    for(const requirement of cat.requirements) if(requirement.metric==='foods') assert.ok(requirement.target<=Object.keys(FOODS).length);
  }
  const state=initialState(start);state.collection.stats.pair=5;
  assert.equal(canInviteCat('bandit',state.collection,1),false,'pair bonuses do not double-count the five starter care actions');
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
