import test from 'node:test';
import assert from 'node:assert/strict';
import {FEATURE_UNLOCKS,isFeatureUnlocked,featureStatus,featureUnlockMessage} from '../src/feature-unlocks.js';
import {featureLockPanel,updateFeatureEntry} from '../src/feature-unlocks-ui.js';
import {catExpressionsPanel} from '../src/cat-expressions-ui.js';
import {CAT_EXPRESSIONS} from '../src/cat-expressions.js';
import {CAT_ACTIONS} from '../src/cat-actions.js';
import {createDiaryController} from '../src/diary-controller.js';
import {initialState,normalizeState,reduceAction,levelStartXp,levelInfo} from '../src/state.js';

const now=Date.UTC(2026,9,15),actor={id:'partner-male',name:'男方'};
test('features unlock exactly at levels 2, 3, 5 and 6, including fractional XP boundaries',()=>{
  assert.deepEqual(Object.fromEntries(Object.entries(FEATURE_UNLOCKS).map(([id,r])=>[id,r.level])),{collection:2,diary:3,expressions:5,actions:6});
  for(const [feature,{level}]of Object.entries(FEATURE_UNLOCKS)){
    const threshold=levelStartXp(level);
    assert.equal(isFeatureUnlocked(feature,levelInfo(threshold-.1).level),false,feature);
    assert.equal(isFeatureUnlocked(feature,levelInfo(threshold).level),true,feature);
    assert.equal(isFeatureUnlocked(feature,120),true);
    for(const bad of [NaN,Infinity,undefined,'6',0])assert.equal(isFeatureUnlocked(feature,bad),false);
    assert.match(featureUnlockMessage(feature),new RegExp(`Lv\\.${level}`));
  }
  assert.equal(isFeatureUnlocked('unknown',99),false);
});

test('pending growth and cached high levels cannot unlock cloud features before a confirmed ready snapshot',()=>{
  for(const [feature,{level}]of Object.entries(FEATURE_UNLOCKS)){
    assert.equal(featureStatus(feature,{level:level+1,confirmedLevel:level-1,cloud:true}).unlocked,false);
    assert.equal(featureStatus(feature,{level:99,cloud:true}).unlocked,false,'missing confirmation fails closed');
    assert.equal(featureStatus(feature,{level:99,confirmedLevel:99,cloud:true,ready:false}).unlocked,false);
    assert.equal(featureStatus(feature,{level:level-1,confirmedLevel:level,cloud:true}).unlocked,true);
    assert.equal(featureStatus(feature,{level,cloud:false}).unlocked,true);
  }
});

test('locked entry keeps a clickable level explanation and reuses its badge when an upgrade confirms',()=>{
  const attrs=new Map(),classes=new Set(),children=[];
  const button={disabled:false,title:'',classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)},setAttribute:(k,v)=>attrs.set(k,v),querySelector:()=>children[0]||null,append:n=>children.push(n),ownerDocument:{createElement:()=>({dataset:{},setAttribute(){}})}};
  updateFeatureEntry(button,featureStatus('diary',{level:2}),'猫猫日记');
  assert.equal(button.disabled,false);assert.equal(attrs.get('aria-disabled'),'true');assert.match(attrs.get('aria-label'),/Lv\.3/);assert.equal(children[0].hidden,false);
  const badge=children[0];updateFeatureEntry(button,featureStatus('diary',{level:3}),'猫猫日记');
  assert.equal(children[0],badge);assert.equal(children.length,1);assert.equal(badge.hidden,true);assert.equal(attrs.get('aria-disabled'),'false');assert.equal(attrs.get('aria-label'),'猫猫日记');assert.equal(classes.has('is-level-locked'),false);
});

test('Lv.5 opens expressions while actions remain a lock card until Lv.6',()=>{
  const defaultPanel=catExpressionsPanel();assert.match(defaultPanel,/Lv\.5 解锁/);assert.doesNotMatch(defaultPanel,/data-expression-choice=/);
  const expressions=catExpressionsPanel('expressions',{level:5});
  assert.equal((expressions.match(/data-expression-choice=/g)||[]).length,CAT_EXPRESSIONS.length);
  assert.match(expressions,/🔒 Lv\.6/);
  const lockedActions=catExpressionsPanel('actions',{level:5});assert.match(lockedActions,/小猫动作在 Lv\.6 解锁/);assert.doesNotMatch(lockedActions,/data-cat-animation=|data-expression-greet/);
  const actions=catExpressionsPanel('actions',{level:6});assert.equal((actions.match(/data-cat-animation=/g)||[]).length,CAT_ACTIONS.length);assert.doesNotMatch(actions,/feature-lock-card/);
});

test('locked diary refuses stale panel events without projecting, exporting, favoriting or losing stored data',async t=>{
  let allowed=false,reads=0,writes=0,click;
  const notices=[],root={dataset:{view:'diary'},closest:()=>({open:true}),addEventListener(type,fn){if(type==='click')click=fn;},set innerHTML(_){writes++;}};
  const controller=createDiaryController({root,canOpen:()=>allowed,lockedPanel:()=>featureLockPanel('diary'),getState(){reads++;throw Error('locked journal must not be read');},dispatch(){assert.fail('locked diary cannot write');},toast:m=>notices.push(m)});
  t.after(()=>controller.close());
  assert.equal(controller.open(),false);assert.match(controller.panel(),/Lv\.3 解锁/);controller.refresh();
  await click({target:{closest:()=>({dataset:{memoryFavorite:'adoption'}})}});
  assert.equal(reads,0);assert.equal(writes,0);assert.equal(notices.length,1);
  allowed=true;assert.equal(controller.open(),true,'the existing journal becomes accessible at the gate');
});

test('authoritative invitations and favorites reject below-level requests even when their achievements exist',()=>{
  const state={...initialState(now),xp:levelStartXp(2)-.1};state.collection.stats.pet=5;
  state.pendingGrowth=[{id:'large-pending-growth',kind:'feed',food:'fish',amount:50,actorId:actor.id,actor:actor.name,at:now}];
  const original=structuredClone(state),invite={type:'invite-cat',catId:'bandit'};
  assert.equal(reduceAction(state,invite,actor,now,'locked-invitation'),null);assert.deepEqual(state,original);
  const invited=reduceAction({...state,xp:levelStartXp(2)},invite,actor,now,'unlocked-invitation');assert.equal(invited.collection.invited[0].id,'bandit');assert.equal(invited.xp,levelStartXp(2));
  const favorite={type:'diary-favorite',memoryId:'adoption',favorite:true};
  assert.equal(reduceAction({...invited,xp:levelStartXp(3)-.1},favorite,actor,now,'locked-favorite'),null);
  const saved=reduceAction({...invited,xp:levelStartXp(3)},favorite,actor,now,'unlocked-favorite');assert.deepEqual(saved.diary.favorites,['adoption']);assert.equal(saved.xp,levelStartXp(3));
});

test('care and level milestones are recorded before diary unlock; existing low-level collections and favorites survive',()=>{
  const before={...initialState(now),xp:119};
  const cared=reduceAction(before,{type:'pet'},actor,now,'before-diary-care');assert.ok(cared.diary.entries.some(e=>e.id==='first:pet'));
  const claimed=reduceAction(cared,{type:'claim-growth',rewardId:'before-diary-care'},actor,now+1,'before-diary-claim');
  assert.equal(levelInfo(claimed.xp).level,2);assert.ok(claimed.diary.entries.some(e=>e.id==='level:2'));
  const old={...claimed,xp:0};old.diary.favorites=['adoption'];old.collection.invited=[{id:'bandit',at:now,operationId:'old-collected-cat',actorId:actor.id}];
  const restored=normalizeState(structuredClone(old),now+1);
  assert.deepEqual(restored.diary,old.diary);assert.deepEqual(restored.collection.invited,old.collection.invited);
  assert.ok(restored.pendingGrowth.length===0);
});
