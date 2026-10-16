import test from 'node:test';
import assert from 'node:assert/strict';
import { createArcadeController } from '../src/minigames-arcade-client.js';
import { createArcadeRun } from '../src/minigames-arcade-rules.js';
import { createMemoryStorage } from '../demo/storage.js';

function rig(t,game='merge2048') {
  const start=Date.UTC(2026,9,16);let time=start+100,connected=false,frame,lastFrame;
  t.mock.method(Date,'now',()=>time);t.mock.timers.enable({apis:['setTimeout']});
  const previous=new Map(['document','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const listeners=new Map(),nodes=new Map(),storage=createMemoryStorage(),sent=[];
  const node=()=>({textContent:'',dataset:{},disabled:false,style:{setProperty(){}},classList:{toggle(){},add(){},remove(){}},setAttribute(){},getAttribute(){},matches:()=>false,getContext:()=>({clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},roundRect(){},fill(){},fillText(){}})});
  const buttons=Array.from({length:4},node),stage=node();stage.querySelector=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);};stage.querySelectorAll=key=>key==='button'?buttons:[];
  const root={querySelector:key=>key==='[data-arcade-id]'?stage:null,querySelectorAll:()=>[],addEventListener:(key,fn)=>{const list=listeners.get(key)||[];list.push(fn);listeners.set(key,list);}};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,addEventListener(){}}});
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:fn=>{frame=fn;return 1;}});
  Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:()=>{}});
  const source=createArcadeRun(game,42),match={id:`duo-offline-${game}`,game,mode:'duo',status:'active',players:[{id:'partner-male'},{id:'partner-female'}],scores:[0,0],arcade:{stage:'running',seed:42,startAt:start,runs:[source,createArcadeRun(game,42)]}};
  const controller=createArcadeController({root,getMatch:()=>match,getClientId:()=> 'partner-male',isSaving:()=>false,isConnected:()=>connected,dispatch:action=>{sent.push(action);return true;},storage,onFrame:next=>{lastFrame=next;}});
  t.after(()=>{controller.suspend();for(const [key,value]of previous)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
  const click=move=>{const button={disabled:false,hasAttribute:()=>false,dataset:{arcadeMove:String(move)}};for(const fn of listeners.get('click')||[])fn({target:{closest:()=>button}});};
  const persist=()=>{t.mock.timers.tick(100);return JSON.parse(storage.getItem(`catnest.arcade.${match.id}.partner-male`));};
  return {controller,match,sent,buttons,click,persist,get current(){return lastFrame;},set connected(value){connected=value;},advance(ms){time+=ms;frame?.();}};
}

test('duo 2048 stays interactive offline, persists locally, and uploads its bounded replay after reconnecting',t=>{
  const h=rig(t);h.controller.sync();assert.equal(h.current.enabled,true);assert.ok(h.buttons.every(b=>!b.disabled));
  for(let n=0;n<8;n++){h.click(n%4);h.advance(100);}
  assert.ok(h.current.run.inputs>0);assert.equal(h.match.arcade.runs[0].inputs,0);assert.equal(h.sent.length,0);const saved=h.persist();assert.ok(saved.queue.length>0);
  h.connected=true;h.advance(3000);assert.equal(h.sent.length,1);assert.equal(h.sent[0].type,'game-arcade-input');assert.deepEqual(h.sent[0].events,saved.queue);assert.ok(h.sent[0].events.length<=256);
  h.advance(100);assert.equal(h.sent.length,1,'an in-flight checkpoint never duplicates the input batch');assert.ok(h.current.run.inputs>0);
});

test('offline background/return restores accepted input without modifying either authoritative run',t=>{
  const h=rig(t);h.controller.sync();h.click(0);h.advance(100);h.click(1);h.controller.suspend();
  const count=h.persist().queue.length;assert.ok(count>0);h.controller.sync();assert.equal(h.current.run.inputs,count);assert.equal(h.match.arcade.runs[0].inputs,0);assert.equal(h.match.arcade.runs[1].inputs,0);assert.equal(h.sent.length,0);
});

test('reaction scoring still requires a connection and never invents server receipt times offline',t=>{
  const h=rig(t,'reaction');h.controller.sync();assert.equal(h.current.enabled,false);h.click(0);assert.equal(h.current.run.inputs,0);assert.equal(h.sent.length,0);
  h.connected=true;h.controller.sync();assert.equal(h.current.enabled,true);
});

test('repainting the same server snapshot cannot rewind the running local clock',t=>{
  const h=rig(t);h.controller.serverTime(h.match.arcade.startAt+100);h.controller.sync();h.advance(1000);
  const elapsed=h.current.elapsed;h.controller.serverTime(h.match.arcade.startAt+100);h.advance(1);
  assert.ok(h.current.elapsed>=elapsed,'a local pending/status repaint must not reset the offset to an old serverNow');
});
