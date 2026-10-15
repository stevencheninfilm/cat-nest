import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionFeedback } from '../src/interaction-feedback.js';

function fixture() {
  let clock = 0, timerId = 0, reduced = false, allowed = true;
  const timers = new Map(), motions = [], vibrations = [];
  const events = () => ({ listeners:new Map(), addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name,new Set()); this.listeners.get(name).add(callback); }, removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }, emit(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback(event); } });
  class Element {
    constructor(tag = 'span') { this.tag=tag;this.children=[];this.style={};this.className='';this.id='';this.isConnected=true;this.attrs={};this.classes=new Set();this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)}; }
    get childElementCount() { return this.children.length; }
    append(child) { this.children.push(child);child.parent=this;child.isConnected=true; }
    remove() { if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.isConnected=false; }
    setAttribute(name,value) { this.attrs[name]=value; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    getBoundingClientRect() { return {left:40,top:80,width:160,height:220,right:200,bottom:300}; }
    matches(selector) { return selector.split(',').some(part=>part.trim()===`#${this.id}` || part.trim()==='button' && this.tag==='button'); }
    closest() { return this.tag==='button'?this:null; }
    querySelector() { return null; }
    animate(frames,options) {
      let resolve,reject,settled=false;
      const motion={element:this,frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){this.cancelled=true;if(!settled){settled=true;reject(new Error('cancelled'));}},finish(){if(!settled){settled=true;resolve();}}};
      motions.push(motion);return motion;
    }
  }
  const preference=events(), root={...events(),body:new Element('body'),hidden:false,createElement:tag=>new Element(tag),querySelector:()=>null};
  const view={...events(),performance:{now:()=>clock},navigator:{vibrate:duration=>vibrations.push(duration)},matchMedia:()=>preference,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)};
  const cat=new Element('button');cat.id='cat';
  const feedback=createInteractionFeedback({root,view,getCat:()=>cat,canPresent:()=>allowed,reducedMotion:()=>reduced,now:()=>clock});
  const advance=async ms=>{const end=clock+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();await Promise.resolve();}clock=end;await Promise.resolve();};
  return {feedback,root,view,preference,cat,timers,motions,vibrations,layer:root.body.children[0],advance,element:tag=>new Element(tag),reduce(value){reduced=value;preference.emit('change');},allowed(value){allowed=value;}};
}

test('one operation presents once and rollback cancels only that operation', async () => {
  const f=fixture();f.feedback.care('pet',{operationId:'first'});
  const count=f.layer.childElementCount;assert.ok(count>0);
  f.feedback.care('pet',{operationId:'first'});assert.equal(f.layer.childElementCount,count);
  f.feedback.care('play',{operationId:'second'});const both=f.layer.childElementCount;
  f.feedback.rollback('first');assert.equal(f.layer.childElementCount,both-count);
  await f.advance(2000);assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);
  f.feedback.destroy();
});

test('rolling back a food flight prevents its delayed arrival particles', async () => {
  const f=fixture();f.feedback.care('feed',{operationId:'food'});assert.ok(f.layer.childElementCount>0);
  f.feedback.rollback('food');await f.advance(3000);
  assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);
  f.feedback.destroy();
});

test('collect arrival pulses its target, while cancelled collection never does', async () => {
  for(const cancel of [false,true]){
    const f=fixture(),target=f.element('div');
    f.feedback.collect({origin:{left:0,top:0,width:30,height:30},target,operationId:'claim'});
    if(cancel)f.feedback.rollback('claim');
    await f.advance(2000);
    assert.equal(f.motions.some(motion=>motion.element===target),!cancel);
    assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);f.feedback.destroy();
  }
});

test('rapid touch input stays within the particle budget and cleans up', async () => {
  const f=fixture();for(let i=0;i<100;i++)f.feedback.care('touch');
  assert.ok(f.layer.childElementCount<=36);await f.advance(2500);
  assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);f.feedback.destroy();
});

test('reduced motion and hidden updates do not create effects or vibrate', async () => {
  const f=fixture();f.reduce(true);f.feedback.care('pet');f.feedback.panel(f.cat);
  assert.equal(f.motions.length,0);assert.equal(f.vibrations.length,0);
  f.reduce(false);f.root.hidden=true;f.feedback.care('pet',{operationId:'hidden'});
  f.root.hidden=false;f.feedback.care('pet',{operationId:'hidden'});
  assert.equal(f.layer.childElementCount,0,'a hidden event cannot replay after returning');
  f.feedback.care('pet',{local:false});assert.equal(f.vibrations.length,0,'partner activity does not trigger local haptics');
  f.root.hidden=true;f.root.emit('visibilitychange');await f.advance(2500);
  assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);f.feedback.destroy();
});

test('scrolling cancels button compression without triggering a release bounce', () => {
  const f=fixture(),button=f.element('button');
  const input={target:button,button:0,isPrimary:true,pointerId:1,clientX:50,clientY:60};
  f.root.emit('pointerdown',input);assert.equal(f.motions.length,1);
  f.root.emit('pointermove',{...input,clientY:90});f.root.emit('pointerup',input);
  assert.equal(f.motions.length,1);assert.equal(f.motions[0].cancelled,true);assert.equal(button.classes.size,0);
  button.disabled=true;f.root.emit('pointerdown',input);assert.equal(f.motions.length,1);f.feedback.destroy();
});

test('preference changes, view exits and destroy release timers, nodes and listeners', () => {
  const f=fixture();f.feedback.care('play');f.reduce(true);
  assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);
  f.reduce(false);f.feedback.care('pet');f.view.emit('pagehide');
  assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);
  f.feedback.care('touch');f.feedback.destroy();
  assert.equal(f.root.body.childElementCount,0);assert.equal(f.timers.size,0);
  for(const owner of [f.root,f.view,f.preference])assert.ok([...owner.listeners.values()].every(set=>set.size===0));
  const before=f.motions.length;f.feedback.care('pet');assert.equal(f.motions.length,before);
});

test('an unavailable animation engine cannot interrupt the interaction or leave particles behind', () => {
  const f=fixture();
  f.root.createElement=tag=>{const node=f.element(tag);node.animate=()=>{throw new Error('animation unavailable');};return node;};
  assert.doesNotThrow(()=>f.feedback.care('pet'));
  assert.equal(f.layer.childElementCount,0);assert.equal(f.timers.size,0);f.feedback.destroy();
});
