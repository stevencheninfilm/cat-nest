import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCatGestures} from '../src/home-cat-gestures.js';
import {touchSurfaceMarkup,toyGuideMarkup} from '../src/minigames-touch-ui.js';

function gestureHarness(t){
  const target=()=>({listeners:new Map(),addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);},removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);},emit(type,event){for(const fn of this.listeners.get(type)||[])fn(event);}});
  const cat=target(),view=target(),classes=new Set(),captures=new Set();
  let taps=0,starts=0,allowed=true,modelDragged=false;
  cat.classList={add:name=>classes.add(name),remove:name=>classes.delete(name)};
  cat.setPointerCapture=id=>captures.add(id);cat.hasPointerCapture=id=>captures.has(id);cat.releasePointerCapture=id=>captures.delete(id);
  const dispose=bindCatGestures({cat,view,canInteract:()=>allowed,onTap:()=>taps++,onStart:()=>starts++,consumeModelTap:()=>{const moved=modelDragged;modelDragged=false;return moved;}});
  t.after(dispose);
  function send(type,{x=100,y=100,id=1,pointerType='touch',primary=true,detail=1,button=0,outside=false}={}){
    const event={clientX:x,clientY:y,pointerId:id,pointerType,isPrimary:primary,detail,button,defaultPrevented:false,stopPropagation(){},preventDefault(){this.defaultPrevented=true;}};
    (outside?view:cat).emit(type,event);
    if(!outside&&['pointerup','pointercancel'].includes(type))view.emit(type,event);
    return event;
  }
  return {cat,view,classes,captures,send,dispose,taps:()=>taps,starts:()=>starts,allow:value=>allowed=value,modelDrag:()=>modelDragged=true};
}

test('touch, pen and mouse taps pet once even with repeated small finger jitter',t=>{
  const h=gestureHarness(t);
  for(const pointerType of ['touch','pen','mouse']){
    h.send('pointerdown',{pointerType});
    for(let i=0;i<20;i++)h.send('pointermove',{pointerType,x:i%2?103:100,y:104});
    h.send('pointerup',{pointerType,x:103,y:104});
    const before=h.taps();assert.equal(h.captures.size,0);
    h.send('click',{pointerType});assert.equal(h.taps(),before+1);
  }
  assert.equal(h.taps(),3);
});

test('horizontal, vertical and out-and-back drags never become petting on release',t=>{
  const h=gestureHarness(t);
  for(const pointerType of ['touch','pen','mouse'])for(const [x,y]of [[180,100],[100,180],[180,140]]){
    h.send('pointerdown',{pointerType});
    assert.equal(h.send('pointermove',{pointerType,x,y}).defaultPrevented,true);
    assert.equal(h.classes.has('is-rotating'),true);
    h.send('pointermove',{pointerType,x:100,y:100});
    h.send('pointerup',{pointerType});h.modelDrag();
    assert.equal(h.send('click',{pointerType}).defaultPrevented,true);
    assert.equal(h.taps(),0);assert.equal(h.classes.size,0);
  }
  h.send('pointerdown');h.send('pointerup');h.send('click');
  assert.equal(h.taps(),1,'a fresh tap works immediately after a drag');
});

test('drag suppression also works before the model loads and when release is the first large movement',t=>{
  const h=gestureHarness(t);
  h.send('pointerdown');h.send('pointermove',{x:160});h.send('pointerup',{x:160});h.send('click');
  assert.equal(h.taps(),0);
  h.send('pointerdown');h.send('pointerup',{x:160});h.send('click');assert.equal(h.taps(),0);
});

test('cancelled captures, backgrounding, context menus and outside releases never pet',t=>{
  const h=gestureHarness(t);
  for(const [type,outside]of [['pointercancel',false],['lostpointercapture',false],['blur',true],['pagehide',true],['contextmenu',false],['pointerup',true]]){
    h.send('pointerdown');h.send(type,{outside});h.send('click');
    assert.equal(h.taps(),0,type);assert.equal(h.captures.size,0,type);
  }
});

test('secondary fingers cannot take over or turn a multi-touch gesture into petting',t=>{
  const h=gestureHarness(t);
  h.send('pointerdown');h.send('pointerdown',{id:2,primary:false});h.send('pointermove',{id:2,primary:false,x:200});
  h.send('pointerup',{id:2,primary:false});assert.equal(h.captures.has(1),true);
  h.send('pointerup');h.send('click');assert.equal(h.taps(),0);
  h.send('pointerdown',{id:2,primary:false});h.send('click');assert.equal(h.taps(),0);
});

test('keyboard activation keeps working and unavailable views block all petting',t=>{
  const h=gestureHarness(t);
  h.send('pointerdown');h.send('pointercancel');h.modelDrag();h.send('click',{detail:0});assert.equal(h.taps(),1);
  h.allow(false);h.send('pointerdown');h.send('pointerup');h.send('click');h.send('click',{detail:0});
  assert.equal(h.taps(),1);assert.equal(h.starts(),1);
  h.allow(true);h.send('pointerdown');h.allow(false);h.send('pointerup');h.send('click');assert.equal(h.taps(),1);
});

test('disposing gestures releases capture and removes both cat and window listeners',t=>{
  const h=gestureHarness(t);h.send('pointerdown');h.send('pointermove',{x:160});h.dispose();
  assert.equal(h.captures.size,0);assert.equal(h.classes.size,0);
  for(const owner of [h.cat,h.view])assert.ok([...owner.listeners.values()].every(handlers=>handlers.size===0));
  h.send('click');assert.equal(h.taps(),0);
});
test('the toy tutorial explains looking, covering and finding before the timed game',()=>{
  const look=toyGuideMarkup('look'),find=toyGuideMarkup('find',0),done=toyGuideMarkup('done');
  assert.match(look,/不计时练习/);assert.match(look,/记住了，盖起来/);
  assert.equal((look.match(/data-toy-guide-cell="\d" disabled/g)||[]).length,3);
  assert.match(find,/点刚才的软垫/);assert.match(find,/这里空空的，再试试/);
  assert.doesNotMatch(find,/data-toy-guide-cell="\d" disabled/);
  assert.match(done,/开始 40 秒陪玩/);assert.match(done,/10 点成长/);
  for(const html of [look,find,done])assert.doesNotMatch(html,/data-arcade-id|data-arcade-move|data-home-cat-claim/,'practice cannot submit game inputs or rewards');
});
test('room games reuse the real main cat while the game house keeps its own illustration',()=>{
  for(const game of ['teaser','treats','hide-toy']){
    const room=touchSurfaceMarkup(game,{home:true});
    assert.doesNotMatch(room,/touch-kitten-art|touch-room-window|touch-room-rug/);
    assert.match(room,/data-touch-feedback/);
  }
  assert.match(touchSurfaceMarkup('teaser'),/touch-kitten-art/);
  assert.match(touchSurfaceMarkup('treats',{home:true}),/data-touch-catcher/);
  assert.equal((touchSurfaceMarkup('hide-toy',{home:true}).match(/data-arcade-move=/g)||[]).length,6);
});
