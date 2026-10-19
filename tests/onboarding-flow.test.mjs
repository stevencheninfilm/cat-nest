import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnboarding, invitationMarkup, invitationModel } from '../src/onboarding.js';
import { initialState, reduceAction } from '../src/state.js';
import { HOME_ENTRIES } from '../src/home-context.js';
import { createMemoryStorage } from '../demo/storage.js';

function setup(t,{returning=false,established=false,autoStart=true}={}) {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  const events=new Map();
  const dialog={open:false,innerHTML:'',className:'',setAttribute(){},contains(){return false;},querySelector(){return null;},showModal(){this.open=true;},close(){this.open=false;},remove(){},addEventListener(type,handler){events.set(type,handler);}};
  const document={activeElement:null,body:{append(){}},createElement(){return dialog;},querySelector(selector){return selector==='dialog[open]'&&dialog.open?dialog:null;}};
  Object.defineProperty(globalThis,'document',{configurable:true,value:document});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
  const storage=createMemoryStorage(),preferences=createMemoryStorage(),actor={id:'partner-male',name:'男方'},requests=[];
  const context={state:{...initialState(1800000000000),xp:established?400:0},role:'male',entered:true,ready:true,connected:true,members:[actor],known:true,canCare:()=>true};
  if(established)context.state.name='老朋友';
  const guide=createOnboarding({autoStart,storage,preferences,home:HOME_ENTRIES[0],baseUrl:'https://example.test/cat-nest/',returning,getContext:()=>context,dispatch(action){requests.push(action);return true;},greet(){}});
  const click=action=>events.get('click')({target:{disabled:false,dataset:{onboarding:action},closest(){return this;}}});
  const submit=name=>{events.get('input')({target:{id:'onboarding-name',value:name}});events.get('submit')({target:{id:'onboarding-name-form'},preventDefault(){}});};
  function confirm(action,operationId) {
    context.state=reduceAction(context.state,action,actor,1800000000001,operationId);
    guide.confirmed(action,actor,{operationId});
  }
  return {guide,storage,preferences,dialog,context,requests,click,submit,confirm,actor};
}

test('a new owner adopts, interacts, claims real growth, then invites in three short stages',t=>{
  const h=setup(t);h.guide.start();assert.match(h.dialog.innerHTML,/领养你的第一只小猫/);
  h.submit('汤圆');const adoption=h.requests.at(-1);assert.equal(adoption.type,'adopt-cat');
  assert.match(h.dialog.innerHTML,/正在保存小名字/);
  h.guide.confirmed(adoption,h.actor,{optimistic:true});assert.match(h.dialog.innerHTML,/正在保存小名字/);
  h.confirm(adoption,'new-owner-adopts');assert.match(h.dialog.innerHTML,/轻轻摸摸它/);
  h.click('care');const care=h.requests.at(-1);assert.equal(care.type,'pet');
  h.confirm(care,'first-real-care');assert.match(h.dialog.innerHTML,/收下这颗成长心/);
  assert.equal(h.context.state.xp,0);h.click('claim');const claim=h.requests.at(-1);assert.equal(claim.rewardId,'first-real-care');
  h.confirm(claim,'first-real-claim');assert.ok(h.context.state.xp>0);assert.match(h.dialog.innerHTML,/把另一位主人请回家/);
  assert.match(h.dialog.innerHTML,/1\/2 位主人已加入/);h.click('finish');assert.equal(h.dialog.open,false);
  assert.equal(h.preferences.getItem('onboarding.v2.completed'),'done');
});

test('failure retains the entered name and cannot advance the guide or award progress',t=>{
  const h=setup(t);h.guide.start();h.submit('芝麻');h.guide.fail('保存失败，稍后重试');
  assert.match(h.dialog.innerHTML,/value="芝麻"/);assert.match(h.dialog.innerHTML,/保存失败/);assert.match(h.dialog.innerHTML,/领养你的第一只小猫/);
  assert.equal(h.context.state.xp,0);assert.equal(h.context.state.name,'糯米');
  h.submit('芝麻');assert.equal(h.requests.at(-1).name,'芝麻');
});

test('existing owners are not forced to recreate or rename their cat and opening invites keeps a completed guide complete',async t=>{
  const h=setup(t,{returning:true,established:true});h.guide.sync();await Promise.resolve();assert.equal(h.dialog.open,false);
  h.guide.start();assert.match(h.dialog.innerHTML,/认识一下，老朋友/);assert.doesNotMatch(h.dialog.innerHTML,/小猫毛色/);
  h.submit('老朋友');assert.equal(h.requests.filter(item=>item.type==='adopt-cat'||item.type==='rename').length,0);assert.match(h.dialog.innerHTML,/轻轻摸摸/);
  h.click('pause');h.storage.setItem('catnest.onboarding.v2.male',JSON.stringify({version:2,step:'done'}));
  h.guide.start({invite:true});h.click('finish');assert.equal(JSON.parse(h.storage.getItem('catnest.onboarding.v2.male')).step,'done');
});

test('an adoption completed by the other owner is synchronized instead of overwritten',t=>{
  const h=setup(t);h.guide.start();h.submit('小白');h.guide.fail('小窝已更新');
  h.context.state=reduceAction(h.context.state,{type:'adopt-cat',name:'伙伴的名字',appearance:h.context.state.appearance},{id:'partner-female',name:'女方'},1800000000001,'partner-adoption');
  const before=h.requests.length;h.submit('小白');assert.equal(h.requests.length,before);assert.match(h.dialog.innerHTML,/伙伴刚刚给小猫取好了名字/);assert.match(h.dialog.innerHTML,/value="伙伴的名字"/);
});

test('a cooling-down pet action is presented as play and completed binding has one clear next action',t=>{
  const h=setup(t,{established:true});h.context.canCare=type=>type==='play';h.guide.start();h.submit('老朋友');
  assert.match(h.dialog.innerHTML,/逗逗小猫/);h.click('care');assert.equal(h.requests.at(-1).type,'play');
  const both={...h.context.state,homeBond:{version:1,adoptedAt:null,owners:[{id:'partner-male',joinedAt:1},{id:'partner-female',joinedAt:1}]}};
  const summary=invitationMarkup(invitationModel({...h.context,state:both}),{isTest:true,finished:true});
  assert.match(summary,/两位主人已加入/);assert.doesNotMatch(summary,/data-onboarding="simulate"|data-onboarding="copy"/);
});


test('the adoption walkthrough remains available manually when the illustrated guide owns automatic first entry',async t=>{
  const h=setup(t,{autoStart:false});h.guide.sync();await Promise.resolve();assert.equal(h.dialog.open,false);
  h.guide.start();assert.equal(h.dialog.open,true);assert.match(h.dialog.innerHTML,/领养你的第一只小猫/);
});
