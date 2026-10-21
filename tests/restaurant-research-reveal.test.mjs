import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { createRestaurantResearchReveal, restaurantResearchRevealResult, restaurantResearchRevealFace, restaurantResearchRevealMarkup } from '../src/restaurant-research-reveal.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
const state=()=>initialState(NOW);
const drawn=()=>reduceAction(state(),{type:'restaurant-research-draw',draw:1},{id:'research-animation',name:'店长'},NOW);
function harness(t,{motion=false,onPhaseChange=()=>{}}={}){
  const oldDocument=globalThis.document,focus={isConnected:true,disabled:false,focus(){this.restored=true;}};
  globalThis.document={activeElement:focus};
  t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;});
  const listeners=new Map(),nodes=new Map(),timers=new Map();let nextId=1;
  const dialog={open:false,dataset:{},innerHTML:'',
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{disabled:true,textContent:'',innerHTML:'',dataset:{},attrs:{},setAttribute(name,value){this.attrs[name]=value;},focus(){}});return nodes.get(selector);},
    addEventListener(name,callback){listeners.set(name,callback);},removeEventListener(name){listeners.delete(name);},
    showModal(){this.open=true;},close(){this.open=false;listeners.get('close')?.();},
  };
  const view=createRestaurantResearchReveal({dialog,onPhaseChange,reducedMotion:()=>motion,schedule:(callback,ms)=>{const id=nextId++;timers.set(id,{callback,ms});return id;},unschedule:id=>timers.delete(id)});
  const tick=()=>{const callbacks=[...timers.values()];timers.clear();for(const {callback} of callbacks)callback();};
  const click=selector=>listeners.get('click')({target:{closest:query=>query===selector?{}:null}});
  return {view,dialog,nodes,timers,tick,click,focus};
}

test('audio phase cues fire once per real transition and close only once',t=>{
  const phases=[],h=harness(t,{onPhaseChange:phase=>phases.push(phase)}),info=restaurantInfo(drawn(),NOW);
  h.view.start(1);h.view.sync(info);h.view.sync(info);h.tick();h.view.sync(info);
  h.click('[data-rr-flip]');h.click('[data-rr-flip]');h.tick();h.view.sync(info);h.view.close();h.view.close();h.view.reset();
  assert.deepEqual(phases,['brewing','ready','flipping','revealed','closed']);
});

test('the mystery face is based on the accepted draw and the dish current quality, not fragment quantity',()=>{
  const accepted=drawn();assert.equal(restaurantResearchRevealResult(restaurantInfo(state(),NOW),1),null);
  assert.equal(restaurantResearchRevealResult(restaurantInfo(accepted,NOW),2),null);
  for(const [index,grade] of ['B','A','S','SS','SSS'].entries()){
    accepted.restaurant.recipeLevels.rice=index+1;
    const info=restaurantInfo(accepted,NOW),before=structuredClone(info),result=restaurantResearchRevealResult(info,1),html=restaurantResearchRevealFace(result);
    assert.equal(result.grade,grade);assert.equal(result.card.amount,3);assert.match(html,new RegExp(`data-r-food-grade="${grade}"`));
    assert.match(html,/菜谱碎片 <b>×3<\/b>/);assert.deepEqual(info,before);
  }
  assert.doesNotMatch(restaurantResearchRevealMarkup(1),/暖暖蛋包饭|碎片 <b>/,'the initial card does not disclose the outcome');
});

test('a card waits for the matching receipt and anticipation, then flips once without another action or debit',t=>{
  const h=harness(t),accepted=drawn(),before=structuredClone(accepted),info=restaurantInfo(accepted,NOW);
  assert.equal(h.view.start(1),true);assert.equal(h.view.start(1),false);assert.equal(h.dialog.dataset.rrPhase,'brewing');
  h.tick();h.view.sync(restaurantInfo(state(),NOW),{connected:false});assert.equal(h.dialog.dataset.rrPhase,'brewing');
  assert.match(h.nodes.get('[data-rr-message]').textContent,/探索已暂存/);
  h.view.sync(info,{connected:true});assert.equal(h.dialog.dataset.rrPhase,'ready');
  assert.equal(h.nodes.get('[data-rr-result]').attrs['aria-hidden'],undefined);
  h.click('[data-rr-flip]');h.click('[data-rr-flip]');assert.equal(h.dialog.dataset.rrPhase,'flipping');assert.equal(h.timers.size,1);
  h.tick();assert.equal(h.dialog.dataset.rrPhase,'revealed');assert.equal(h.dialog.dataset.rQuality,'B');
  assert.equal(h.nodes.get('[data-rr-result]').attrs['aria-hidden'],'false');
  h.view.sync(info);assert.equal(h.timers.size,0);assert.equal(h.dialog.dataset.rrPhase,'revealed');
  h.click('[data-rr-discovery-confirm]');assert.equal(h.dialog.open,false);assert.ok(h.focus.restored);
  h.view.sync(info);assert.equal(h.dialog.open,false,'a normal render does not replay the card');assert.deepEqual(accepted,before);
});

test('a fast receipt does not skip the card back, and closing early cancels animation without losing shards',t=>{
  const h=harness(t),accepted=drawn(),info=restaurantInfo(accepted,NOW);
  h.view.start(1);h.view.sync(info);assert.equal(h.dialog.dataset.rrPhase,'brewing');
  h.click('[data-rr-flip]');assert.equal(h.dialog.dataset.rrPhase,'brewing');
  h.tick();assert.equal(h.dialog.dataset.rrPhase,'ready');h.click('[data-rr-flip]');
  h.view.close();assert.equal(h.timers.size,0);h.tick();assert.equal(h.dialog.open,false);
  assert.equal(info.research.fragments.rice,3);assert.equal(info.research.inspiration,60);
  h.view.sync(info);assert.equal(h.dialog.open,false);
});

test('submission errors never reveal invented rewards, and reduced motion bypasses timed flourishes',t=>{
  const h=harness(t,{motion:true});h.view.start(1);assert.equal([...h.timers.values()][0].ms,0);
  h.view.sync(restaurantInfo(state(),NOW),{savePhase:'error',refusedResearchDraw:1});assert.equal(h.dialog.dataset.rrPhase,'error');assert.equal(h.timers.size,0);
  h.view.sync(restaurantInfo(drawn(),NOW));assert.equal(h.dialog.dataset.rrPhase,'error');
  assert.equal(h.dialog.querySelector('[data-rr-result]').innerHTML,'');h.click('[data-rr-discovery-confirm]');
  h.view.start(1);h.view.sync(restaurantInfo(drawn(),NOW));h.tick();h.click('[data-rr-discovery-confirm]');
  assert.equal([...h.timers.values()][0].ms,0);h.tick();assert.equal(h.dialog.dataset.rrPhase,'revealed');
  h.view.destroy();assert.equal(h.dialog.open,false);assert.equal(h.timers.size,0);
});

test('destroying during preparation cancels all callbacks, and a newer receipt cannot reveal the wrong draw',t=>{
  const h=harness(t);h.view.start(1);assert.equal(h.timers.size,1);h.view.destroy();
  assert.equal(h.timers.size,0);h.tick();assert.equal(h.dialog.open,false);
  const other=harness(t),accepted=reduceAction(drawn(),{type:'restaurant-research-draw',draw:2},{id:'research-animation',name:'店长'},NOW+1000);
  other.view.start(1);other.view.sync(restaurantInfo(accepted,NOW));assert.equal(other.dialog.dataset.rrPhase,'error');
  assert.match(other.nodes.get('[data-rr-message]').textContent,/更新的灵感/);
});

test('terminal previews all five materials without altering inspiration, shards or saved recipe levels',t=>{
  const h=harness(t),info=restaurantInfo(state(),NOW),before=structuredClone(info);
  assert.equal(h.view.preview('<script>',info),false);assert.equal(h.dialog.open,false);
  for(const grade of ['B','A','S','SS','SSS']){
    assert.equal(h.view.preview(grade,info),true);h.tick();h.click('[data-rr-flip]');h.tick();
    assert.equal(h.dialog.dataset.rQuality,grade);assert.match(h.nodes.get('[data-rr-discovery-note]').textContent,/不增加碎片/);
    h.view.close();
  }
  assert.deepEqual(info,before);
});

test('the video-inspired sequence automatically reveals only a matching receipt and clears its auto timer on manual skip',t=>{
  const h=harness(t),info=restaurantInfo(drawn(),NOW),before=structuredClone(info);
  h.view.start(1);h.tick();assert.equal(h.dialog.dataset.rrPhase,'brewing');assert.equal(h.timers.size,0,'network delay cannot fabricate the card');
  h.view.sync(info);assert.equal(h.dialog.dataset.rrPhase,'ready');assert.equal([...h.timers.values()][0].ms,650);
  h.tick();assert.equal(h.dialog.dataset.rrPhase,'flipping');h.tick();assert.equal(h.dialog.dataset.rrPhase,'revealed');assert.equal(h.timers.size,0);
  h.view.close();h.view.start(1);h.view.sync(info);h.tick();h.click('[data-rr-discovery-confirm]');assert.equal(h.timers.size,1,'manual reveal cancels the scheduled automatic reveal');
  h.view.close();assert.equal(h.timers.size,0);h.tick();assert.equal(h.dialog.open,false);assert.deepEqual(info,before);
});

test('a queued discovery can be dismissed immediately and unrelated save failures never cancel it',t=>{
  const h=harness(t);h.view.start(1);
  assert.equal(h.nodes.get('[data-rr-discovery-confirm]').disabled,false);
  assert.match(h.nodes.get('[data-rr-discovery-confirm]').textContent,/先去经营/);
  h.view.sync(restaurantInfo(state(),NOW),{savePhase:'error',refusedResearchDraw:2});
  assert.equal(h.dialog.dataset.rrPhase,'brewing');assert.equal(h.nodes.get('[data-rr-result]')?.innerHTML??'','');
  h.click('[data-rr-discovery-confirm]');assert.equal(h.dialog.open,false);assert.equal(h.timers.size,0);
  h.view.sync(restaurantInfo(drawn(),NOW));assert.equal(h.dialog.open,false,'a later receipt cannot reopen a dismissed modal');
});
