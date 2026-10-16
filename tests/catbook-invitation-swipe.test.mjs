import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvitationSwipe} from '../src/catbook-invitation-swipe.js';

function harness() {
  const handlers=new Map(),steps=[],captured=[],released=[];
  let available=true;
  const card={isConnected:true,setPointerCapture:id=>captured.push(id),releasePointerCapture:id=>released.push(id)};
  const button={closest:selector=>selector==='[data-book-invitation-carousel]' ? card : null};
  const background={scrollLeft:218,scrollTop:0,closest:()=>null};
  const container={addEventListener(type,fn,capture=false){const list=handlers.get(type)||[];list.push({fn,capture});handlers.set(type,list);}};
  const swipe=createInvitationSwipe({container,canSwipe:()=>available,onStep:step=>steps.push(step)});
  let mapDrag=null;
  container.addEventListener('pointerdown',event=>{if(event.target===background)mapDrag={x:event.clientX,left:background.scrollLeft};});
  container.addEventListener('pointermove',event=>{if(mapDrag)background.scrollLeft=mapDrag.left+mapDrag.x-event.clientX;});
  container.addEventListener('pointerup',()=>{mapDrag=null;});
  const send=(type,{x=200,y=120,id=1,primary=true,target=button,detail=1,pointerType='touch'}={})=>{
    const event={target,pointerId:id,isPrimary:primary,pointerType,button:0,clientX:x,clientY:y,cancelable:true,detail,
      defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    for(const entry of [...(handlers.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))) {
      entry.fn(event);if(event.stopped)break;
    }
    return event;
  };
  return {steps,captured,released,card,background,send,swipe,setAvailable:value=>{available=value;}};
}

test('finger swipes switch once on release in either direction and retain the background position',()=>{
  const h=harness();
  h.send('pointerdown');
  assert.equal(h.send('pointermove',{x:130,y:125,target:h.background}).defaultPrevented,true);
  h.send('pointermove',{x:110,y:125});assert.deepEqual(h.steps,[]);
  const end=h.send('pointerup',{x:110,y:125,target:h.background});
  assert.equal(end.defaultPrevented,true);assert.deepEqual(h.steps,[1]);
  assert.deepEqual([h.background.scrollLeft,h.background.scrollTop],[218,0]);
  h.send('pointerdown',{x:100});h.send('pointermove',{x:180});h.send('pointerup',{x:180});
  assert.deepEqual(h.steps,[1,-1]);assert.deepEqual(h.captured,[1,1]);assert.deepEqual(h.released,[1,1]);
});

test('arrow and invite taps, including small finger jitter, retain ordinary click activation',()=>{
  const h=harness();h.send('pointerdown');
  assert.equal(h.send('pointermove',{x:205,y:126}).defaultPrevented,false);
  assert.equal(h.send('pointerup',{x:205,y:126}).defaultPrevented,false);
  assert.equal(h.send('click').defaultPrevented,false);assert.deepEqual(h.steps,[]);
});

test('a swipe that begins on a button never activates that button or the replacement card after release',()=>{
  const h=harness();h.send('pointerdown');h.send('pointermove',{x:120});h.send('pointerup',{x:120});
  h.card.isConnected=false; // The carousel redraws after changing its selected cat.
  assert.equal(h.send('click',{target:{closest:()=>null}}).defaultPrevented,true);
  h.card.isConnected=true;h.send('pointerdown');h.send('pointerup');
  assert.equal(h.send('click').defaultPrevented,false,'the next intentional tap remains usable');
});

test('short, vertical and diagonal drags cannot switch or accidentally invite a cat',()=>{
  for(const [x,y] of [[175,120],[203,200],[150,170]]) {
    const h=harness();h.send('pointerdown');h.send('pointermove',{x,y});h.send('pointerup',{x,y});
    assert.deepEqual(h.steps,[]);assert.equal(h.send('click').defaultPrevented,true);
    assert.deepEqual([h.background.scrollLeft,h.background.scrollTop],[218,0]);
  }
});

test('a gesture that starts vertically stays cancelled even if the finger turns horizontally',()=>{
  const h=harness();h.send('pointerdown');h.send('pointermove',{x:203,y:165});
  h.send('pointermove',{x:110,y:125});h.send('pointerup',{x:110,y:125});assert.deepEqual(h.steps,[]);
});

test('pointer cancellation, losing capture and redraws never finish an interrupted swipe',()=>{
  for(const ending of ['pointercancel','lostpointercapture','redraw']) {
    const h=harness();h.send('pointerdown');h.send('pointermove',{x:120});
    if(ending==='redraw')h.swipe.cancel();else h.send(ending);
    h.send('pointerup',{x:110});assert.deepEqual(h.steps,[]);
    assert.equal(h.send('click').defaultPrevented,true);
  }
});

test('a second finger cancels the card gesture and cannot take over its selection',()=>{
  const h=harness();h.send('pointerdown');h.send('pointermove',{x:180});
  h.send('pointerdown',{id:2,primary:false});h.send('pointermove',{id:2,primary:false,x:100});
  h.send('pointerup',{id:2,primary:false,x:100});h.send('pointerup',{x:100});assert.deepEqual(h.steps,[]);
});

test('a gesture beginning on the map keeps normal map panning and never switches cards',()=>{
  const h=harness();h.send('pointerdown',{target:h.background});h.send('pointermove',{x:120,target:h.background});
  h.send('pointerup',{x:120,target:h.background});assert.equal(h.background.scrollLeft,298);assert.deepEqual(h.steps,[]);
});

test('single-card, hidden or otherwise unavailable carousels do not consume ordinary button taps',()=>{
  const h=harness();h.setAvailable(false);h.send('pointerdown');h.send('pointermove',{x:120});h.send('pointerup',{x:120});
  assert.deepEqual(h.steps,[]);assert.equal(h.send('click').defaultPrevented,false);
});

test('pen and mouse drags follow the same directions while keyboard activation is never swallowed',()=>{
  for(const pointerType of ['mouse','pen']) {
    const h=harness();h.send('pointerdown',{pointerType});h.send('pointermove',{x:120,pointerType});h.send('pointerup',{x:120,pointerType});
    assert.deepEqual(h.steps,[1]);assert.equal(h.send('click',{detail:0}).defaultPrevented,false);
  }
});
