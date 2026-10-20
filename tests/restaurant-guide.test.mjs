import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRestaurantGuide,loadRestaurantGuide,restaurantGuideLayout} from '../src/restaurant-guide.js';
import {RESTAURANT_TOUR,RESTAURANT_KITCHEN_TOUR,restaurantGuideRoute} from '../src/restaurant-guide-content.js';
import {createMemoryStorage} from '../demo/storage.js';
import {scopedStorage} from '../src/home-storage.js';
import {HOME_ENTRIES} from '../src/home-context.js';
const key=role=>`catnest.restaurant-guide.v1.${role}`,tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness(t,{storage=createMemoryStorage(),navigate}={}){
  const saved=new Map(['document','requestAnimationFrame','cancelAnimationFrame'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const events=new Map(),frames=new Map(),style=new Map(),classes=new Set(),destinations=[],writes=[],listeners=new Map();let sequence=0,closed=0;
  const context={role:'male',active:true,entered:true,ready:true,available:true},blocker={open:false};
  const target={getBoundingClientRect:()=>({top:300,bottom:340,left:40,right:220,width:180,height:40}),getClientRects:()=>[{}],closest:()=>null,scrollIntoView(){}};
  const dialog={open:false,innerHTML:'',clientWidth:390,clientHeight:844,style:{setProperty:(name,value)=>style.set(name,value)},classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}},setAttribute(){},getBoundingClientRect:()=>({top:0,left:0}),querySelector:selector=>selector==='.guide-tour-card'?{offsetHeight:230}:{focus(){}},showModal(){this.open=true;},close(){this.open=false;events.get('close')?.();},remove(){this.removed=true;},addEventListener:(name,fn)=>events.set(name,fn)};
  const document={activeElement:null,body:{append(){}},createElement:()=>dialog,querySelector:()=>blocker.open?{}:null,querySelectorAll:()=>[target]};
  for(const [name,value]of Object.entries({document,requestAnimationFrame:fn=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>frames.delete(id)}))Object.defineProperty(globalThis,name,{configurable:true,value});
  t.after(()=>{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];});
  const guide=createRestaurantGuide({storage:{getItem:k=>storage.getItem(k),setItem(k,v){writes.push(k);storage.setItem(k,v);}},getContext:()=>context,navigate:async view=>{destinations.push(view);return navigate?.(view);},onClose:()=>closed++,view:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}});
  const click=async(action,step)=>{events.get('click')({target:{closest:()=>({disabled:false,dataset:{restaurantGuide:action,restaurantGuideStep:step}})}});await tick();};
  const frame=()=>{const entry=frames.entries().next().value;if(entry){frames.delete(entry[0]);entry[1]();}};
  return {guide,storage,context,dialog,blocker,target,frames,classes,style,destinations,writes,listeners,click,frame,get closed(){return closed;}};
}

test('the player tour covers the live meal and business loop without tutorial-only currencies or actions',()=>{
  assert.equal(new Set(RESTAURANT_TOUR.map(s=>s.id)).size,RESTAURANT_TOUR.length);
  for(const id of ['orders','ingredients','timing','serving','checkout','menu','research','staff','rest','upgrades','decor'])assert.ok(RESTAURANT_TOUR.some(s=>s.id===id));
  assert.deepEqual(restaurantGuideRoute('kitchen').map(s=>s.id),RESTAURANT_KITCHEN_TOUR);
  assert.ok(RESTAURANT_TOUR.every(s=>s.title&&s.body&&s.target&&['business','kitchen','recipes','research','training','upgrades','themes'].includes(s.view)));
  assert.match(RESTAURANT_TOUR.find(s=>s.id==='decor').body,/解锁后属性常驻累计/);
  assert.match(RESTAURANT_TOUR.find(s=>s.id==='staff').body,/顾客走路不会/);
  assert.match(RESTAURANT_TOUR.find(s=>s.id==='rest').hint,/30 分钟/);
});

test('progress is isolated by registered save and identity, separate from home tour and gameplay keys',()=>{
  const raw=createMemoryStorage(),steven=scopedStorage(raw,HOME_ENTRIES.find(h=>h.id==='steven')),evian=scopedStorage(raw,HOME_ENTRIES.find(h=>h.id==='evian'));
  steven.setItem(key('male'),JSON.stringify({version:1,step:'timing',phase:'paused'}));steven.setItem('catnest.handbook.v1.male',JSON.stringify({version:1,tourComplete:true}));
  assert.equal(loadRestaurantGuide(steven,'male').step,'timing');assert.equal(loadRestaurantGuide(steven,'female').phase,'new');assert.equal(loadRestaurantGuide(evian,'male').phase,'new');
  for(const value of ['bad',JSON.stringify({version:2,step:'timing',phase:'paused'}),JSON.stringify({version:1,step:'missing',phase:'shown'}),JSON.stringify({version:1,step:'rest',phase:'unknown'})]){evian.setItem(key('female'),value);assert.equal(loadRestaurantGuide(evian,'female').phase,'new');}
  assert.equal(loadRestaurantGuide(steven,'unknown').phase,'new');assert.equal(loadRestaurantGuide({getItem(){throw Error('blocked');}},'male').phase,'new');
});

test('short-screen cards leave room for the pause toolbar and stay inside the visible height',()=>{
  for(const [width,height]of [[320,568],[390,844],[844,390]]){
    const cardHeight=height<500?210:287,layout=restaurantGuideLayout({top:60,bottom:140,left:width-60,right:width-10},width,height,cardHeight);
    assert.ok(layout.cardTop>=58);assert.ok(layout.cardTop+cardHeight<=height-12);
  }
});

test('automatic first visit waits for identity, loaded state, visible restaurant and other dialogs, then starts only once',async t=>{
  const h=harness(t);
  for(const field of ['active','entered','ready','available']){h.context[field]=false;h.guide.sync();await tick();assert.equal(h.dialog.open,false);h.context[field]=true;}
  h.blocker.open=true;h.guide.sync();await tick();assert.equal(h.dialog.open,false);
  h.blocker.open=false;h.guide.sync();h.guide.sync();await tick();assert.equal(h.dialog.open,true);assert.equal(loadRestaurantGuide(h.storage,'male').phase,'shown');assert.deepEqual(h.destinations,['business']);
  await h.click('close');h.guide.sync();await tick();assert.equal(h.dialog.open,false);assert.equal(h.frames.size,0);
  assert.ok(h.writes.every(k=>k===key('male')));
});

test('pausing and reopening resumes the same target, completing stops auto popups, and replay can be paused again',async t=>{
  const h=harness(t);await h.guide.start();await h.click('next');await h.click('next');await h.click('close');assert.equal(loadRestaurantGuide(h.storage,'male').step,'orders');
  await h.guide.start();assert.match(h.dialog.innerHTML,/看到“想吃这份”/);
  await h.click(undefined,'finish');await h.click('next');assert.equal(loadRestaurantGuide(h.storage,'male').phase,'completed');assert.equal(h.dialog.open,false);
  h.guide.sync();await tick();assert.equal(h.dialog.open,false);
  await h.guide.start();assert.match(h.dialog.innerHTML,/欢迎来到/);await h.click('next');await h.click('close');await h.guide.start();assert.match(h.dialog.innerHTML,/小鱼干和金鱼干/);
});

test('the full tour and directory navigate only live views, preserve saved gameplay and keep the target aligned',async t=>{
  const h=harness(t);h.storage.setItem('catnest.pet','original home');h.storage.setItem('catnest.pending','queued original operations');
  await h.guide.start();h.frame();assert.equal(h.style.get('--tour-top'),'296px');assert.equal(h.style.get('--tour-left'),'36px');
  h.target.getBoundingClientRect=()=>({top:250,bottom:290,left:50,right:230,width:180,height:40});h.frame();assert.equal(h.style.get('--tour-top'),'246px');
  await h.click('toc');assert.match(h.dialog.innerHTML,/餐厅指引目录/);await h.click(undefined,'ingredients');assert.equal(h.destinations.at(-1),'kitchen');
  for(const step of RESTAURANT_TOUR){await h.click(undefined,step.id);assert.match(h.dialog.innerHTML,new RegExp(step.title));}
  await h.click('next');assert.equal(h.frames.size,0);assert.equal(h.storage.getItem('catnest.pet'),'original home');assert.equal(h.storage.getItem('catnest.pending'),'queued original operations');
  assert.ok(h.writes.every(k=>k===key('male')));assert.ok(!h.destinations.includes('terminal'));
});

test('the short kitchen class leaves the overview pause position intact',async t=>{
  const h=harness(t);h.storage.setItem(key('male'),JSON.stringify({version:1,step:'staff',phase:'paused'}));const before=h.storage.getItem(key('male'));
  await h.guide.start({section:'kitchen'});assert.match(h.dialog.innerHTML,/厨房小课堂/);assert.equal(h.destinations.at(-1),'kitchen');
  for(let n=0;n<RESTAURANT_KITCHEN_TOUR.length;n++)await h.click('next');
  assert.equal(h.dialog.open,false);assert.equal(h.storage.getItem(key('male')),before);assert.equal(h.writes.length,0);
});

test('changing identity or leaving the restaurant closes tracking and never saves under the new identity',async t=>{
  const h=harness(t);await h.guide.start();await h.click('next');h.context.role='female';h.frame();assert.equal(h.dialog.open,false);assert.equal(h.frames.size,0);assert.equal(loadRestaurantGuide(h.storage,'male').phase,'paused');assert.equal(loadRestaurantGuide(h.storage,'female').phase,'new');
  h.guide.sync();await tick();assert.equal(h.dialog.open,true);assert.equal(loadRestaurantGuide(h.storage,'female').step,'welcome');
  h.context.active=false;h.frame();assert.equal(h.dialog.open,false);assert.equal(h.frames.size,0);
});

test('failed or interrupted navigation releases the overlay and does not leave the restaurant inert',async t=>{
  const h=harness(t,{navigate:()=>{throw Error('view unavailable');}});assert.equal(await h.guide.start(),false);assert.equal(h.dialog.open,false);assert.equal(h.guide.isOpen(),false);assert.equal(h.frames.size,0);
  h.guide.destroy();assert.equal(h.dialog.removed,true);assert.equal(h.listeners.size,0);assert.equal(await h.guide.start(),false);
});

test('main runtime uses the existing scoped preference adapter for the live guide, and keeps a player entry in both help and info',async()=>{
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8'),ui=await readFile(new URL('../src/restaurant-ui.js',import.meta.url),'utf8');
  assert.match(main,/guidePreferences:runtime\.guidePreferences\|\|runtime\.localStorage/);assert.match(main,/getGuideContext:.*role:coupleRole,entered:roleEntered/);
  assert.match(ui,/r-wallet-guide[^>]*data-r-guide-open/);assert.match(ui,/function restaurantInfoPanel[\s\S]*?restaurantGuideEntryMarkup\(\)/);assert.match(ui,/restaurantGuideEntryMarkup\(\)\}<div class="r-help-hero"/);
});
