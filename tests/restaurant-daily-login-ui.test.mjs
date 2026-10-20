import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestaurantDailyLogin,restaurantDailyLoginDialog} from '../src/restaurant-daily-login-ui.js';
const ready={ready:true,connected:true,savePhase:'saved'},gift=(day=20000,claimed=false)=>({day,claimed,available:!claimed,amount:300});
function harness({onAction=()=>true,preferences=null}={}){
  const listeners=new Map(),nodes=new Map(),attrs=new Map(),actions=[],sounds=[];
  const node=()=>({textContent:'',disabled:false,focusCount:0,focus(){this.focusCount++;}});
  for(const key of ['claim','close','message'])nodes.set(`[data-r-daily-${key}]`,node());
  const dialog={open:false,dataset:{},querySelector:s=>nodes.get(s),showModal(){this.open=true;},close(){this.open=false;listeners.get('close')?.forEach(fn=>fn({}));},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},removeEventListener(type,fn){listeners.set(type,listeners.get(type).filter(f=>f!==fn));}};
  const entry={hidden:true,dataset:{},setAttribute:(key,value)=>attrs.set(key,value)};
  const controller=createRestaurantDailyLogin({dialog,entry,onAction:action=>{actions.push(action);return onAction(action);},onCollect:()=>sounds.push('collect'),preferences});
  const click=key=>listeners.get('click').forEach(fn=>fn({target:{closest:s=>s===`[data-r-daily-${key}]`?{}:null},stopPropagation(){}}));
  return {controller,dialog,entry,actions,sounds,node:key=>nodes.get(`[data-r-daily-${key}]`),click};
}

test('first ready entry shows the gift; dismissal is quiet until tomorrow, with a reachable manual entry',()=>{
  const h=harness();h.controller.sync(gift(),{ready:false,connected:false});assert.equal(h.dialog.open,false);assert.equal(h.actions.length,0);
  h.controller.sync(gift(),ready,{autoShow:false});assert.equal(h.dialog.open,false);
  h.controller.sync(gift(),ready);assert.equal(h.dialog.open,true);assert.equal(h.node('claim').focusCount,1);
  h.click('close');h.controller.sync(gift(),ready);assert.equal(h.dialog.open,false);assert.equal(h.entry.hidden,false);
  h.controller.open();assert.equal(h.dialog.open,true);h.controller.close();h.controller.sync(gift(20001),ready);assert.equal(h.dialog.open,true);
});

test('the claim responds immediately, stays queued while offline and announces only a confirmed saved receipt once',()=>{
  const h=harness();h.controller.sync(gift(),ready);h.click('claim');h.click('claim');
  assert.deepEqual(h.actions,[{type:'restaurant-daily-login',day:20000}]);assert.equal(h.node('claim').disabled,true);assert.equal(h.sounds.length,0);
  h.controller.close();h.controller.sync(gift(),{...ready,connected:false,retrying:true,pendingDailyLoginDay:20000});
  assert.match(h.node('message').textContent,/联网后自动/);assert.equal(h.entry.dataset.state,'pending');
  h.controller.sync(gift(20000,true),ready);h.controller.sync(gift(20000,true),ready);assert.deepEqual(h.sounds,['collect']);
  h.controller.open();assert.equal(h.node('claim').disabled,false);assert.equal(h.node('claim').textContent,'开心收下');
  h.click('claim');assert.equal(h.dialog.open,false);assert.equal(h.actions.length,1);
});

test('restored pending claims stay disabled, explicit failures release the gift, and a new day remains claimable',()=>{
  const h=harness();h.controller.sync(gift(),{...ready,pendingDailyLoginDay:20000});assert.equal(h.node('claim').disabled,true);
  h.controller.sync(gift(),{...ready,savePhase:'error'});assert.equal(h.node('claim').disabled,false);assert.match(h.node('message').textContent,/重试/);
  h.controller.sync(gift(20001),ready);h.click('claim');assert.equal(h.actions[0].day,20001);
  const refusal=harness({onAction:()=>false});refusal.controller.sync(gift(),ready);refusal.click('claim');assert.equal(refusal.node('claim').disabled,false);
});

test('already saved receipts are silent; the per-home display preference is never an award receipt',()=>{
  const memory=new Map(),preferences={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  const a=harness({preferences});a.controller.sync(gift(),ready);a.controller.close();a.controller.destroy();
  const b=harness({preferences});b.controller.sync(gift(),ready);assert.equal(b.dialog.open,false);b.controller.open();b.click('claim');assert.equal(b.actions.length,1);
  const loaded=harness();loaded.controller.sync(gift(20000,true),ready);assert.equal(loaded.dialog.open,false);assert.equal(loaded.actions.length,0);assert.equal(loaded.sounds.length,0);
  loaded.controller.open();assert.equal(loaded.node('claim').textContent,'好，明天再来');
  assert.match(restaurantDailyLoginDialog(),/daily-gift.webp/);assert.match(restaurantDailyLoginDialog(),/aria-labelledby="rdl-title"/);
});
