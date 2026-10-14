import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,normalizeState,reduceAction} from '../src/state.js';
import {APPEARANCE_OPTIONS,normalizeAppearance,validAppearance,MAGE_CAT_FILES} from '../src/mage-cat-config.js';
import {chooseMageClip,mageExpression,clipKey} from '../src/mage-cat-animation.js';
import {sanitizeAction} from '../server/github-store.mjs';
test('old cloud progress gains an original appearance without losing feeding, history or resources',()=>{
 const old=initialState(1000);delete old.appearance;old.coins=850;old.history=[{text:'喂了小猫',actor:'女方',at:900}];
 const next=normalizeState(old,1000);assert.equal(next.coins,850);assert.deepEqual(next.history,old.history);assert.deepEqual(next.appearance,{body:0,clothes:0,eyes:0,wand:0});
});
test('a full authored appearance saves atomically, has no currency or growth reward, and survives unrelated actions',()=>{
 const before=initialState(1000);const appearance={body:4,clothes:2,eyes:1,wand:2};
 const changed=reduceAction(before,{type:'dress',appearance},{id:'partner-male',name:'男方'},1100);
 assert.deepEqual(changed.appearance,appearance);for(const key of ['coins','love','xp','hunger','mood','energy'])assert.equal(changed[key],before[key]);assert.equal(changed.history[0].actor,'男方');
 const fed=reduceAction(changed,{type:'feed',food:'meal'},{id:'partner-female',name:'女方'},1200);assert.deepEqual(fed.appearance,appearance);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(fed)),1300).appearance,appearance);
 assert.deepEqual(before.appearance,{body:0,clothes:0,eyes:0,wand:0});
});
test('invalid, incomplete and extended dressing payloads cannot mutate a save',()=>{
 const before=initialState(1000);
 for(const appearance of [null,[],{body:1},{body:5,clothes:0,eyes:0,wand:0},{body:0,clothes:0,eyes:3,wand:0},{body:0,clothes:0,eyes:0,wand:0,extra:1}]){
  assert.equal(validAppearance(appearance),false);assert.equal(sanitizeAction({type:'dress',appearance}),null);assert.equal(reduceAction(before,{type:'dress',appearance}),null);
 }
 assert.equal(sanitizeAction({type:'dress',appearance:normalizeAppearance(),extra:1}),null);
});
test('manifest retains the five coat choices, three eye colors, three wand colors and every facial texture',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(APPEARANCE_OPTIONS).map(([k,v])=>[k,v.length])),{body:5,clothes:5,eyes:3,wand:3});
 assert.equal(new Set(MAGE_CAT_FILES).size,MAGE_CAT_FILES.length);assert.ok(MAGE_CAT_FILES.every(f=>/^[a-z0-9-]+\.(glb|webp)$/.test(f)));assert.ok(!MAGE_CAT_FILES.some(f=>/fbx|zip|unitypackage|pdf/.test(f)));
});
test('pet interactions use authored idle or magic clips and never disguise death or hurt as resting',()=>{
 const available=['Armature Mage Cat|Death','Armature Mage Cat|Hurt','Armature Mage Cat|Idle','Armature Mage Cat|Special_Attack'];
 assert.equal(chooseMageClip('sleep',true,['Death','Hurt']),null);assert.equal(chooseMageClip('play',false,available),'special_attack');for(const type of ['pet','feed','sleep'])assert.equal(chooseMageClip(type,true,available),'idle');
 assert.deepEqual(mageExpression('feed',true),{eyes:'closed',mouth:'basic'});assert.deepEqual(mageExpression('pet',false,.5),{eyes:'happy',mouth:'happy'});assert.deepEqual(mageExpression('feed',false,2),{eyes:'basic',mouth:'basic'});assert.equal(clipKey('Armature Mage Cat|Turn_Left'),'turn_left');
});
