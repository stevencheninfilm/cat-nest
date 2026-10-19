import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { gameGuideChapters, guideCatalog, searchGuide, GUIDE_IMAGES } from '../src/game-guide-content.js';
import { createGameGuide, loadGameGuide } from '../src/game-guide.js';
import { GAME_TOUR, PANEL_TOURS, OVERVIEW_TOUR, guideTourRoute, tourLayout } from '../src/game-guide-tour.js';
import { GAMES } from '../src/minigames.js';
import { FOODS } from '../src/state.js';
import { createMemoryStorage } from '../demo/storage.js';
import { scopedStorage } from '../src/home-storage.js';
import { HOME_ENTRIES } from '../src/home-context.js';

test('handbook covers real modules and finds individual games and foods',()=>{
  const chapters=gameGuideChapters();
  for(const id of ['identity','feeding','care','needs','growth','games','court','diary','catbook','appearance','companion','settings'])assert.ok(chapters.some(c=>c.id===id),id);
  assert.equal(new Set(chapters.map(c=>c.id)).size,chapters.length);
  assert.equal(searchGuide(chapters,'五子棋')[0].id,'games');
  assert.equal(searchGuide(chapters,'三文鱼块')[0].id,'feeding');
  assert.equal(searchGuide(chapters,'不存在的关键词').length,0);
  assert.equal(guideCatalog('games').length,Object.keys(GAMES).length);
  assert.equal(guideCatalog('foods').length,Object.keys(FOODS).length);
  assert.ok(chapters.every(c=>c.steps.length>=3&&c.entry&&c.tip));
});

test('quick overview defers games, court and appearance details until their panel opens',()=>{
  for(const ids of Object.values(PANEL_TOURS))for(const id of ids)assert.ok(!OVERVIEW_TOUR.includes(id),id);
  for(const id of ['games-entry','court-entry','appearance-entry']){
    assert.ok(OVERVIEW_TOUR.includes(id));
    assert.equal(GAME_TOUR.find(step=>step.id===id).view,'home');
  }
  assert.deepEqual(guideTourRoute('games'),['games','games-touch']);
  assert.deepEqual(guideTourRoute('judge'),['court']);
  assert.deepEqual(guideTourRoute('appearance'),['appearance']);
  assert.ok(GAME_TOUR.find(s=>s.id==='together').target.includes('.shared-tabs'));
});

test('all generated illustrations, including the transparent mascot, are packaged in the shared app',async()=>{
  for(const id of [...GUIDE_IMAGES,'mascot']){
    const path=new URL(`../public/assets/game-guide/v1/${id}-v1.webp`,import.meta.url);
    const bytes=await readFile(path);assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.ok((await stat(path)).size>10000,id);
  }
});

test('guide preferences remain scoped by home and identity, and malformed preferences recover safely',()=>{
  const raw=createMemoryStorage(),a=scopedStorage(raw,HOME_ENTRIES.find(h=>h.id==='steven')),b=scopedStorage(raw,HOME_ENTRIES.find(h=>h.id==='evian'));
  a.setItem('catnest.handbook.v1.male',JSON.stringify({version:1,tour:7,panels:{games:{seen:true,step:'games-touch',complete:false}}}));
  assert.equal(loadGameGuide(a,'male').tour,7);
  assert.equal(loadGameGuide(a,'male').panels.games.step,'games-touch');
  assert.deepEqual(loadGameGuide(a,'female').panels,{});
  assert.deepEqual(loadGameGuide(b,'male').panels,{});
  a.setItem('catnest.handbook.v1.male','bad json');assert.equal(loadGameGuide(a,'male').tour,0);
});

test('mobile coachmark stays on screen and uses fresh target geometry after the sheet moves',()=>{
  const width=436,height=831,cardHeight=225;
  const before=tourLayout({top:388,bottom:425,left:15,right:421},width,height,cardHeight);
  const after=tourLayout({top:377,bottom:414,left:15,right:421},width,height,cardHeight);
  assert.equal(after.top,377);assert.equal(before.top-after.top,11);
  assert.ok(after.cardTop>=12&&after.cardTop+cardHeight<=height-12);
  for(const size of [[320,568],[390,844],[436,831],[844,390]]){
    const layout=tourLayout({top:size[1]-90,bottom:size[1]-40,left:20,right:size[0]-20},...size,200);
    assert.ok(layout.cardTop>=12&&layout.cardTop+200<=size[1]-12);
  }
});

function harness(t,{autoStart=false}={}){
  const originals=new Map(['document','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const handlers=new Map(),frames=new Map(),writes=[],destinations=[],style=new Map();let sequence=0;
  const target={getBoundingClientRect:()=>({top:300,bottom:340,left:20,right:150,width:130,height:40}),getClientRects:()=>[{}],scrollIntoView(){}};
  const card={offsetHeight:220},heading={focus(){}};
  const dialog={open:false,innerHTML:'',clientWidth:436,clientHeight:831,className:'',style:{setProperty(key,value){style.set(key,value);}},classList:{toggle(){}},setAttribute(){},getBoundingClientRect:()=>({top:0,left:0}),querySelector(selector){return selector==='.guide-tour-card'?card:selector.includes('title')?heading:null;},showModal(){this.open=true;},close(){this.open=false;},remove(){},addEventListener(type,fn){handlers.set(type,fn);}};
  const blocker={open:false};
  const document={activeElement:null,body:{append(){}},createElement(){return dialog;},querySelector(selector){return selector==='dialog[open]'&&blocker.open?{}:null;},querySelectorAll(){return [target];},addEventListener(){},removeEventListener(){}};
  const storage=createMemoryStorage();
  const context={role:'male',entered:true,ready:true,available:true};
  for(const [key,value]of Object.entries({document,requestAnimationFrame:fn=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>frames.delete(id)}))Object.defineProperty(globalThis,key,{configurable:true,value});
  t.after(()=>{for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  const view={addEventListener(){},removeEventListener(){}};
  const preferences={getItem:key=>storage.getItem(key),setItem(key,value){writes.push(key);storage.setItem(key,value);}};
  const guide=createGameGuide({autoStart,storage:preferences,getContext:()=>context,navigate:async name=>{destinations.push(name);},view});
  const click=async action=>{handlers.get('click')({target:{closest(){return {disabled:false,dataset:{guideAction:action}};}}});await new Promise(resolve=>setImmediate(resolve));};
  const tick=()=>{const [id,callback]=frames.entries().next().value||[];if(callback){frames.delete(id);callback();}};
  return {guide,dialog,storage,context,writes,destinations,click,tick,target,style,frames,blocker};
}

test('guide follows a moving target until closed, and writes only reading preferences',async t=>{
  const h=harness(t);await h.guide.start();h.tick();assert.equal(h.style.get('--tour-top'),'296px');
  h.target.getBoundingClientRect=()=>({top:280,bottom:320,left:20,right:150,width:130,height:40});
  h.tick();assert.equal(h.style.get('--tour-top'),'276px');
  await h.click('tour-next');assert.match(h.dialog.innerHTML,/这三份心意/);
  await h.click('close');h.tick();assert.equal(h.dialog.open,false);assert.equal(h.frames.size,0);
  assert.ok(h.writes.every(key=>key==='catnest.handbook.v1.male'));
  assert.ok(!h.destinations.some(name=>['judge','games','appearance'].includes(name)));
});

test('first panel visit auto starts once; explicit replays remain available and do not lose overview progress',async t=>{
  const h=harness(t);await h.guide.start();await h.click('tour-next');await h.click('close');
  const overview=loadGameGuide(h.storage,'male').tour;
  h.guide.panelOpened('games');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.dialog.innerHTML,/板块小课堂/);assert.match(h.dialog.innerHTML,/先选喜欢的游戏/);
  await h.click('tour-next');assert.match(h.dialog.innerHTML,/三种猫猫触屏/);
  await h.click('tour-next');assert.equal(h.dialog.open,false);
  assert.equal(loadGameGuide(h.storage,'male').tour,overview);
  h.guide.panelOpened('games');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  await h.guide.start({panel:'games',restart:true});assert.match(h.dialog.innerHTML,/先选喜欢的游戏/);
});

test('locked panels are omitted from overview without bypassing the feature gate',async t=>{
  const h=harness(t);h.context.canOpen=name=>!['diary','collection'].includes(name);
  await h.guide.start();
  for(let n=0;n<30&&h.dialog.open;n++)await h.click('tour-next');
  assert.equal(h.dialog.open,false);assert.ok(!h.destinations.includes('diary'));assert.ok(!h.destinations.includes('collection'));
  assert.ok(!h.destinations.includes('games'));assert.ok(!h.destinations.includes('judge'));assert.ok(!h.destinations.includes('appearance'));
});

test('restarting a completed tour can pause and resume at the new reading position',async t=>{
  const h=harness(t);h.storage.setItem('catnest.handbook.v1.male',JSON.stringify({version:1,tour:GAME_TOUR.length-1,tourComplete:true}));
  await h.guide.start();await h.click('tour-next');await h.click('tour-next');await h.click('close');
  await h.guide.start();assert.match(h.dialog.innerHTML,/先认出你和另一位主人/);
});


test('first entry automatically starts the guide after identity, snapshot, and visible UI are ready',async t=>{
  const h=harness(t,{autoStart:true});h.context.entered=false;
  h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  h.context.entered=true;h.context.ready=false;
  h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  h.context.ready=true;h.context.available=false;
  h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  h.context.available=true;h.guide.sync();h.guide.sync();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,true);assert.match(h.dialog.innerHTML,/嗨，我来带你认识这个家/);
  assert.equal(loadGameGuide(h.storage,'male').tourStarted,true);assert.deepEqual(h.destinations,['home']);
  await h.click('close');h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
});

test('automatic guide does not cover another dialog, and retries after the screen is free',async t=>{
  const h=harness(t,{autoStart:true});h.blocker.open=true;h.guide.sync();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);assert.equal(loadGameGuide(h.storage,'male').tourStarted,false);
  h.blocker.open=false;h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,true);
});

test('a previously started or completed guide does not auto restart; another identity has its own first visit',async t=>{
  const h=harness(t,{autoStart:true});
  h.storage.setItem('catnest.handbook.v1.male',JSON.stringify({version:1,tour:0,tourStarted:true,tourComplete:false}));
  h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  h.storage.setItem('catnest.handbook.v1.male',JSON.stringify({version:1,tourComplete:true}));
  h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  h.context.role='female';h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,true);
  assert.equal(loadGameGuide(h.storage,'female').tourStarted,true);
  assert.equal(loadGameGuide(h.storage,'male').tourComplete,true);
});

test('old guide progress is recognized, and failed preference writes do not cause repeated popups in one visit',async t=>{
  const h=harness(t,{autoStart:true});
  h.storage.setItem('catnest.handbook.v1.male',JSON.stringify({version:1,tour:3}));assert.equal(loadGameGuide(h.storage,'male').tourStarted,true);
  h.context.role='female';h.storage.setItem=()=>{throw Error('storage blocked');};
  h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,true);
  await h.click('close');h.guide.sync();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
});

test('a queued first-visit guide is cancelled if the identity changes or the controller is destroyed',async t=>{
  const h=harness(t,{autoStart:true});h.guide.sync();h.context.role='female';
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);
  h.guide.sync();h.guide.destroy();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.dialog.open,false);assert.deepEqual(h.destinations,[]);
});
