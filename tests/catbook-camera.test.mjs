import test from 'node:test';
import assert from 'node:assert/strict';
import { createYardCamera, isYardPan } from '../src/catbook-camera.js';
import { createCatbook } from '../src/catbook.js';
import { initialState } from '../src/state.js';

const camera=(width=390,height=844)=>({clientWidth:width,clientHeight:height,scrollWidth:height*1.5,scrollLeft:0,scrollTop:0});

test('cat taps tolerate small jitter and vertical hand movement',()=>{
  for(const [dx,dy] of [[0,0],[5,7],[-8,0],[9,3],[2,12],[10,15],[-12,-12]]) assert.equal(isYardPan(dx,dy),false);
});

test('deliberate horizontal drags pan the yard in either direction',()=>{
  for(const [dx,dy] of [[10,0],[-10,2],[25,8],[-100,35]]) assert.equal(isYardPan(dx,dy),true);
});

test('a new yard starts horizontally centered and never restores vertical cropping',()=>{
  const view=createYardCamera(), target=camera();
  target.scrollTop=148;
  view.restore(target,'station');
  assert.equal(target.scrollLeft,438);
  assert.equal(target.scrollTop,0);
});

test('each scene remembers its own horizontal pan after a redraw',()=>{
  const view=createYardCamera(), station=camera();
  view.restore(station,'station');
  station.scrollLeft=219;
  view.remember(station,'station');
  const garden=camera(390,900);
  garden.scrollWidth=426;
  view.restore(garden,'garden');
  assert.equal(garden.scrollLeft,18);
  garden.scrollLeft=36;
  view.remember(garden,'garden');
  const redrawn=camera();
  view.restore(redrawn,'station');
  assert.equal(redrawn.scrollLeft,219);
  view.restore(garden,'garden');
  assert.equal(garden.scrollLeft,36);
});

test('toolbar height changes preserve the pan even if the browser first clamps it',()=>{
  const view=createYardCamera(), target=camera();
  view.restore(target,'station');
  target.scrollLeft=876;
  view.remember(target,'station');
  target.clientHeight=650;
  target.scrollWidth=975;
  target.scrollLeft=585;
  target.scrollTop=80;
  view.remember(target,'station');
  assert.equal(view.resize(target,'station'),true);
  assert.equal(target.scrollLeft,585);
  assert.equal(target.scrollTop,0);
  target.clientHeight=844;
  target.scrollWidth=1266;
  assert.equal(view.resize(target,'station'),true);
  assert.equal(target.scrollLeft,876);
  assert.equal(view.resize(target,'station'),false);
});

test('width changes keep the same relative horizontal framing',()=>{
  const view=createYardCamera(), target=camera();
  view.restore(target,'station');
  target.scrollLeft=219;
  view.remember(target,'station');
  target.clientWidth=460;
  view.resize(target,'station');
  assert.equal(target.scrollLeft,201.5);
});

test('a map that temporarily fits the phone retains its previous pan preference',()=>{
  const view=createYardCamera(), target=camera(390,900);
  target.scrollWidth=426;
  view.restore(target,'garden');
  target.scrollLeft=36;
  view.remember(target,'garden');
  target.clientHeight=700;
  target.clientWidth=331;
  target.scrollWidth=331;
  target.scrollLeft=0;
  view.resize(target,'garden');
  view.remember(target,'garden');
  assert.equal(target.scrollLeft,0);
  target.clientHeight=900;
  target.clientWidth=390;
  target.scrollWidth=426;
  view.resize(target,'garden');
  assert.equal(target.scrollLeft,36);
});

test('vertical drift from focus or elastic scrolling is cleared without changing the horizontal view',()=>{
  const view=createYardCamera(),target=camera();view.restore(target,'station');
  target.scrollLeft=219;target.scrollTop=-72;
  view.remember(target,'station');
  assert.equal(target.scrollTop,0);assert.equal(target.scrollLeft,219);
  target.scrollTop=150;
  assert.equal(view.resize(target,'station'),false,'an unchanged viewport needs no horizontal reframing');
  assert.equal(target.scrollTop,0);assert.equal(target.scrollLeft,219);
  const redrawn=camera();view.restore(redrawn,'station');assert.equal(redrawn.scrollLeft,219);
});

// Exercise the actual pointer handlers without a browser or a saved room.
function pointerHarness(t) {
  const values={Image:class {},window:{addEventListener(){},matchMedia:()=>({matches:false})},document:{addEventListener(){}}};
  for(const [key,value] of Object.entries(values)) {
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>original ? Object.defineProperty(globalThis,key,original) : delete globalThis[key]);
  }
  const classes=new Set(),captures=[],listeners=new Map();let petResponses=0;
  const target={...camera(),isConnected:true,setPointerCapture:id=>captures.push(id),
    classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)}};
  const button={dataset:{bookCat:'bandit'},disabled:false,hasAttribute:()=>false,matches:()=>false,offsetWidth:44,
    style:{setProperty(){}},classList:{add(name){if(name==='is-petted')petResponses++;},remove(){}},
    closest:selector=>selector==='.book-yard-camera' ? target : selector==='button' ? button : null};
  const container={hidden:false,addEventListener:(name,handler)=>listeners.set(name,handler),contains:()=>true,
    querySelector:()=>null,querySelectorAll:()=>[]};
  const book=createCatbook({container,getState:()=>initialState(),getAvailability:()=>({connected:true,saving:false}),onAction(){},onBack(){}});
  t.after(()=>book.close());
  const send=(name,{x=200,y=200,id=1,type='touch',primary=true}={})=>{
    const event={target:button,pointerId:id,pointerType:type,button:0,isPrimary:primary,clientX:x,clientY:y,detail:1,cancelable:true,
      defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
    listeners.get(name)(event);return event;
  };
  return {target,classes,captures,send,petResponses:()=>petResponses};
}

test('touch, pen and mouse drags all move the actual map horizontally while pinning its vertical origin',t=>{
  const h=pointerHarness(t);
  for(const [index,type] of ['touch','pen','mouse'].entries()) {
    h.target.scrollLeft=200;h.target.scrollTop=37;
    h.send('pointerdown',{x:220,y:200,id:index+1,type});
    const move=h.send('pointermove',{x:80,y:250,id:index+1,type});
    assert.equal(h.target.scrollLeft,340,`${type} takes ownership of horizontal movement`);
    assert.equal(h.target.scrollTop,0,`${type} cannot drag the map down`);
    assert.equal(move.defaultPrevented,true);
    assert.equal(h.classes.has('is-dragging'),true);
    h.send('pointerup',{x:80,y:250,id:index+1,type});
    assert.equal(h.classes.has('is-dragging'),false);
    assert.doesNotThrow(()=>h.send('click'),'releasing a drag never opens or speaks to the cat underneath');
    assert.equal(h.petResponses(),0);
  }
  assert.deepEqual(h.captures,[1,2,3]);
});

test('a vertical finger swipe is ignored and never becomes a cat tap',t=>{
  const h=pointerHarness(t);h.target.scrollLeft=200;
  h.send('pointerdown',{x:180,y:160});
  h.send('pointermove',{x:184,y:320});
  h.send('pointerup',{x:184,y:320});
  assert.equal(h.target.scrollLeft,200);assert.equal(h.target.scrollTop,0);
  assert.deepEqual(h.captures,[]);
  assert.doesNotThrow(()=>h.send('click'),'the ignored vertical swipe is also suppressed as a click');
  assert.equal(h.petResponses(),0);
});

test('a finger tap with small jitter still reaches the cat normally',t=>{
  const h=pointerHarness(t);
  h.send('pointerdown',{x:180,y:160});
  h.send('pointermove',{x:184,y:166});
  h.send('pointerup',{x:184,y:166});h.send('click');
  assert.equal(h.petResponses(),1);assert.deepEqual(h.captures,[]);
});

test('a second finger cannot take over a horizontal drag and pointer cancellation ends it',t=>{
  const h=pointerHarness(t);h.target.scrollLeft=200;
  h.send('pointerdown',{x:200,id:1});
  h.send('pointerdown',{x:100,id:2,primary:false});
  h.send('pointermove',{x:20,id:2,primary:false});
  assert.equal(h.target.scrollLeft,200);
  h.send('pointermove',{x:120,id:1});assert.equal(h.target.scrollLeft,280);
  h.send('pointercancel',{id:1});
  h.send('pointermove',{x:40,id:1});assert.equal(h.target.scrollLeft,280);
  assert.equal(h.classes.has('is-dragging'),false);
});
