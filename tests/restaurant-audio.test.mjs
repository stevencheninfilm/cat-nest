import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRestaurantAudio, normalizeRestaurantAudio, RESTAURANT_AUDIO, RESTAURANT_MUSIC_CHOICES, RESTAURANT_EFFECTS, RESTAURANT_AUDIO_KEY, restaurantActionSound } from '../src/restaurant-audio.js';
import { restaurantMarkup } from '../src/restaurant-ui.js';
import { initialState } from '../src/state.js';

const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const defaultTracks={restaurantTrack:'restaurant',researchTrack:'research'};
function harness(t,{fetchImpl,settings}={}){
  const listeners=new Map(),storage=new Map(settings?[[RESTAURANT_AUDIO_KEY,JSON.stringify(settings)]]:[]),sources=[],gains=[],requests=[];
  let constructions=0;
  const param=()=>({value:1,events:[],setTargetAtTime(...args){this.events.push(['target',...args]);},setValueAtTime(...args){this.events.push(['value',...args]);},linearRampToValueAtTime(...args){this.events.push(['ramp',...args]);},cancelScheduledValues(){}});
  const context={currentTime:10,state:'suspended',destination:{},async resume(){this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';},
    createGain(){const gain={gain:param(),connect(){},disconnect(){}};gains.push(gain);return gain;},
    createBufferSource(){const source={loop:false,starts:[],stops:[],connect(){},disconnect(){},start(...args){this.starts.push(args);},stop(...args){this.stops.push(args);if(!args.length)this.onended?.();}};sources.push(source);return source;},
    async decodeAudioData(){return {duration:60};},
  };
  const page={hidden:false,addEventListener:(type,listener)=>listeners.set(type,listener),removeEventListener:type=>listeners.delete(type)};
  const audio=createRestaurantAudio({preferences:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},page,contextFactory:()=>{constructions++;return context;},fetchImpl:async url=>{requests.push(url);return fetchImpl?fetchImpl(url):{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}});
  t.after(()=>audio.destroy());
  return {audio,context,sources,gains,requests,storage,page,listeners,get constructions(){return constructions;}};
}

test('audio is lazy until a user unlocks it, and repeated gestures never duplicate the cafe loop',async t=>{
  const h=harness(t);h.audio.setActive(true);assert.equal(h.constructions,0);assert.equal(h.audio.snapshot().status,'waiting');
  await h.audio.unlock();await flush();assert.equal(h.constructions,1);assert.equal(h.audio.snapshot().status,'playing');
  assert.equal(h.sources.filter(source=>source.loop).length,1);
  for(let i=0;i<4;i++)await h.audio.unlock();await flush();
  assert.equal(h.sources.filter(source=>source.loop).length,1);assert.equal(h.requests.length,1+RESTAURANT_EFFECTS.length,'one cafe loop and cached effects');
});

test('research crossfades independently, then cafe resumes from its prior offset',async t=>{
  const h=harness(t);h.audio.setActive(true);await h.audio.unlock();await flush();
  h.context.currentTime=13;h.audio.setTrack('research');await flush();
  const music=h.sources.filter(source=>source.loop);assert.equal(music.length,2);assert.equal(music[0].stops[0][0],13.65);
  assert.equal(h.audio.snapshot().track,'research');assert.equal(music[1].loopEnd,RESTAURANT_AUDIO.research.seconds);
  h.context.currentTime=17;h.audio.setTrack('restaurant');await flush();
  assert.equal(h.sources.filter(source=>source.loop).at(-1).starts[0][1],3);
  assert.equal(h.requests.filter(url=>url.endsWith('.m4a')).length,2,'both decoded loops are reused');
});

test('late audio fetches cannot start after changing screens or leaving the restaurant',async t=>{
  const pending=new Map();const h=harness(t,{fetchImpl:url=>url.endsWith('.m4a')?new Promise(resolve=>pending.set(url,resolve)):{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}});
  h.audio.setActive(true);await h.audio.unlock();h.audio.setTrack('research');await flush();h.audio.setActive(false);
  for(const resolve of pending.values())resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await flush();
  assert.equal(h.sources.length,0);assert.equal(h.audio.snapshot().status,'paused');
});

test('background suspension, leaving, reopening and destruction stop audio without spawning more contexts',async t=>{
  const h=harness(t);h.audio.setActive(true);await h.audio.unlock();await flush();
  h.page.hidden=true;h.listeners.get('visibilitychange')();await flush();assert.equal(h.context.state,'suspended');assert.equal(await h.audio.play('click'),false);
  h.page.hidden=false;h.listeners.get('visibilitychange')();await flush();assert.equal(h.context.state,'running');assert.equal(h.sources.filter(source=>source.loop).length,1);
  h.audio.setActive(false);await flush();assert.ok(h.sources[0].stops.length);h.audio.setActive(true);await flush();assert.equal(h.constructions,1);assert.equal(h.audio.snapshot().status,'playing');
  h.audio.destroy();await flush();assert.equal(h.context.state,'closed');assert.equal(h.listeners.size,0);assert.equal(await h.audio.unlock(),false);
});

test('volume and mute persist only through the supplied scoped preferences and keep effects separate',async t=>{
  const h=harness(t);h.audio.setActive(true);await h.audio.unlock();await flush();h.audio.setSettings({music:0,effects:.4});await flush();
  assert.equal(h.audio.snapshot().status,'music-off');assert.equal(await h.audio.play('click'),true);
  h.audio.setSettings({muted:true});assert.equal(await h.audio.play('serve'),false);assert.equal(h.audio.snapshot().status,'muted');
  assert.deepEqual(JSON.parse(h.storage.get(RESTAURANT_AUDIO_KEY)),{muted:true,music:0,effects:.4,...defaultTracks});assert.equal(h.storage.size,1);
  assert.deepEqual(normalizeRestaurantAudio({music:20,effects:-1,muted:'false'}),{music:1,effects:0,muted:false,...defaultTracks});
  assert.deepEqual(normalizeRestaurantAudio(null),{music:.32,effects:.65,muted:false,...defaultTracks});
});

test('failed audio loads can retry and do not prevent game interactions',async t=>{
  let fail=true;const h=harness(t,{fetchImpl:async()=>{if(fail)throw new Error('offline');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}});
  h.audio.setActive(true);await h.audio.unlock();await flush();assert.equal(h.audio.snapshot().status,'unavailable');assert.equal(await h.audio.play('click'),false);
  fail=false;await h.audio.unlock();await flush();assert.equal(h.audio.snapshot().status,'playing');assert.equal(await h.audio.play('collect'),true);
});

test('effects cap rapid duplicate clicks and concurrent voices',async t=>{
  const h=harness(t);h.audio.setActive(true);await h.audio.unlock();await flush();
  assert.equal(await h.audio.play('click'),true);assert.equal(await h.audio.play('click'),false);
  for(const id of RESTAURANT_EFFECTS.slice(1))await h.audio.play(id);
  const fx=h.sources.filter(source=>!source.loop);assert.equal(fx.length,RESTAURANT_EFFECTS.length);assert.equal(fx.filter(source=>!source.stops.length).length,6);assert.equal(await h.audio.play('unknown'),false);
});

test('semantic actions map to one effect, and the sound settings are accessible in both UI modes',()=>{
  for(const [action,step,sound] of [['collect',null,'collect'],['serve',null,'serve'],['kitchen-step','delivery','serve'],['kitchen-step','gather','step'],['kitchen-accept',null,'accept'],['train',null,'upgrade'],['upgrade',null,'upgrade'],['recipe',null,'upgrade'],['decoration',null,'decorate'],['theme',null,'decorate'],['palette',null,'decorate'],['premium-decoration',null,'decorate']])assert.equal(restaurantActionSound(action,step),sound);
  for(const isTest of [false,true]){const html=restaurantMarkup(initialState(),{isTest});assert.equal((html.match(/data-r-audio-open/g)||[]).length,1);assert.match(html,/aria-labelledby="ra-title"/);assert.match(html,/aria-label="背景音乐音量"/);assert.match(html,/aria-label="操作音效音量"/);}
});

test('all original audio assets match the manifest, are unclipped and have short loop seams',async()=>{
  const base=new URL('../public/assets/restaurant/audio/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
  assert.equal(manifest.version,1);assert.deepEqual(Object.keys(manifest.effects).sort(),[...RESTAURANT_EFFECTS].sort());
  for(const [id,item] of Object.entries({...manifest.music,...manifest.effects})){
    const bytes=await readFile(new URL(item.file,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.ok(item.peak<.85);assert.ok(item.rms>.01);
    if(Object.hasOwn(manifest.music,id)){assert.equal(item.seconds,RESTAURANT_AUDIO[id].seconds);assert.ok(item.seamDelta<.015);assert.ok(bytes.length<800000);}
    else{assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(24),32000);assert.equal(bytes.readUInt32LE(40)/128000,item.seconds);}
  }
});

test('the four cafe and two research choices are distinct files and old preferences acquire safe defaults',()=>{
  assert.equal(RESTAURANT_MUSIC_CHOICES.restaurant.length,4);assert.equal(RESTAURANT_MUSIC_CHOICES.research.length,2);
  const ids=Object.values(RESTAURANT_MUSIC_CHOICES).flat();assert.equal(new Set(ids).size,6);assert.equal(new Set(ids.map(id=>RESTAURANT_AUDIO[id].file)).size,6);
  assert.deepEqual(normalizeRestaurantAudio({muted:true,music:.2,effects:.7}),{muted:true,music:.2,effects:.7,...defaultTracks});
  assert.deepEqual(normalizeRestaurantAudio({restaurantTrack:'moon',researchTrack:'garden'}),{muted:false,music:.32,effects:.65,...defaultTracks});
});

test('selected music persists per scene and returning from research restores the chosen cafe track',async t=>{
  const h=harness(t);h.audio.setActive(true);await h.audio.unlock();await flush();
  h.audio.setSettings({restaurantTrack:'garden',researchTrack:'moon'});await flush();
  assert.equal(h.audio.snapshot().musicId,'garden');assert.equal(h.audio.snapshot().title,'花园午后');
  h.audio.setTrack('research');await flush();assert.equal(h.audio.snapshot().musicId,'moon');
  h.audio.setTrack('restaurant');await flush();assert.equal(h.audio.snapshot().musicId,'garden');
  const saved=JSON.parse(h.storage.get(RESTAURANT_AUDIO_KEY));assert.equal(saved.restaurantTrack,'garden');assert.equal(saved.researchTrack,'moon');
  const restored=harness(t,{settings:saved});restored.audio.setActive(true);await restored.audio.unlock();await flush();
  assert.equal(restored.audio.snapshot().musicId,'garden');restored.audio.setTrack('research');await flush();assert.equal(restored.audio.snapshot().musicId,'moon');
});

test('previewing a different scene never changes its route and closing preview restores the selected scene',async t=>{
  const h=harness(t);h.audio.setActive(true);await h.audio.unlock();await flush();h.context.currentTime=12;
  h.audio.setSettings({restaurantTrack:'rain'});await flush();h.context.currentTime=14;
  h.audio.previewMusic('moon');await flush();assert.equal(h.audio.snapshot().track,'restaurant');assert.equal(h.audio.snapshot().musicId,'moon');assert.equal(h.audio.snapshot().previewing,true);
  h.audio.stopPreview();await flush();assert.equal(h.audio.snapshot().musicId,'rain');assert.equal(h.audio.snapshot().previewing,false);
  assert.equal(h.sources.filter(source=>source.loop).at(-1).starts[0][1],2,'preview returns to the previous cafe offset');
  h.audio.previewMusic('garden');await flush();h.audio.setTrack('research');await flush();assert.equal(h.audio.snapshot().musicId,'research');assert.equal(h.audio.snapshot().previewing,false);
});

test('rapid song changes discard stale downloads and never start the abandoned preview',async t=>{
  const pending=new Map(),h=harness(t,{fetchImpl:url=>url.endsWith('.m4a')?new Promise(resolve=>pending.set(url,resolve)):{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}});
  h.audio.setActive(true);await h.audio.unlock();h.audio.previewMusic('garden');h.audio.previewMusic('bakery');await flush();
  for(const [url,resolve] of pending)if(!url.includes('paw-bakery'))resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await flush();assert.equal(h.sources.length,0);
  const latest=[...pending].find(([url])=>url.includes('paw-bakery'));latest[1]({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await flush();
  assert.equal(h.sources.length,1);assert.equal(h.audio.snapshot().musicId,'bakery');assert.equal(h.audio.snapshot().status,'playing');
});

test('choosing or previewing music honors mute and resumes the chosen track after unmuting',async t=>{
  const h=harness(t,{settings:{muted:true}});h.audio.setActive(true);await h.audio.unlock();await flush();
  h.audio.setSettings({restaurantTrack:'bakery'});h.audio.previewMusic('moon');await flush();assert.equal(h.sources.length,0);assert.equal(h.audio.snapshot().status,'muted');
  h.audio.stopPreview();h.audio.setSettings({muted:false});await flush();assert.equal(h.audio.snapshot().musicId,'bakery');assert.equal(h.sources.filter(source=>source.loop).length,1);
});

test('the new button sound is a short decaying wooden pop, with both scene selectors in settings',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/assets/restaurant/audio/manifest.json',import.meta.url)));
  assert.equal(manifest.effects.click.file,'click-soft-v2.wav');assert.equal(manifest.effects.click.seconds,.105);assert.ok(manifest.effects.click.rms<.16);
  const html=restaurantMarkup(initialState());assert.match(html,/aria-label="选择营业配乐"/);assert.match(html,/aria-label="选择抽卡配乐"/);
  for(const id of Object.values(RESTAURANT_MUSIC_CHOICES).flat())assert.ok(html.includes(`<option value="${id}">`));
});
