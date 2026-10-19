export const RESTAURANT_AUDIO = Object.freeze({
  restaurant:{file:'cafe-little-sunshine.m4a',title:'小馆的晴天',description:'温暖 · 钢琴与拨弦',seconds:41.739125,gain:1},
  research:{file:'research-starlit-recipe.m4a',title:'星光里的秘密食谱',description:'星光 · 空灵八音盒',seconds:49.230781,gain:.7},
  garden:{file:'garden-afternoon.m4a',title:'花园午后',description:'圆舞曲 · 轻笛与拨弦',seconds:34.285719,gain:.7},
  rain:{file:'rain-window-coffee.m4a',title:'雨窗慢咖啡',description:'慢节奏 · 柔音钢琴',seconds:40,gain:.82},
  bakery:{file:'paw-bakery-parade.m4a',title:'猫爪烘焙舞',description:'轻快 · 跳跃八音盒',seconds:35.555563,gain:.73},
  moon:{file:'moonlit-recipe-notes.m4a',title:'月光手札',description:'梦幻 · 月夜八音盒',seconds:38.918906,gain:.74},
});
export const RESTAURANT_MUSIC_CHOICES=Object.freeze({restaurant:Object.freeze(['restaurant','garden','rain','bakery']),research:Object.freeze(['research','moon'])});
export const RESTAURANT_EFFECTS = Object.freeze(['click','accept','step','complete','serve','collect','draw','flip','reveal','upgrade','decorate','decoration-complete']);
export const RESTAURANT_AUDIO_KEY = 'catnest.restaurant.audio.v1';
const defaults={muted:false,music:.32,effects:.65,restaurantTrack:'restaurant',researchTrack:'research'};
const volume=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
export function normalizeRestaurantAudio(value={}) {
  return {muted:value?.muted===true,music:volume(value?.music,defaults.music),effects:volume(value?.effects,defaults.effects),...Object.fromEntries(Object.entries(RESTAURANT_MUSIC_CHOICES).map(([scene,ids])=>[`${scene}Track`,ids.includes(value?.[`${scene}Track`])?value[`${scene}Track`]:defaults[`${scene}Track`]]))};
}
const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/audio/${file}`,globalThis.document?.baseURI||import.meta.url).href;
const effectFile=id=>id==='click'?'click-soft-v2.wav':`${id}.wav`;

// One context per restaurant, created/resumed only from a real UI gesture.
export function createRestaurantAudio({preferences=null,contextFactory=()=>{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;return Context?new Context():null;},fetchImpl=(...args)=>fetch(...args),page=globalThis.document,onChange=()=>{}}={}) {
  let settings;
  try{settings=normalizeRestaurantAudio(JSON.parse(preferences?.getItem(RESTAURANT_AUDIO_KEY)||'null'));}catch{settings=normalizeRestaurantAudio();}
  let context=null,musicGain=null,effectsGain=null,active=false,unlocked=false,destroyed=false,track='restaurant',preview=null,current=null,epoch=0,failed=false;
  const buffers=new Map(),voices=new Set(),musicVoices=new Set(),offsets=new Map(),lastEffect=new Map(),loads=new Set();
  const visible=()=>!page?.hidden;
  const allowed=()=>active&&unlocked&&visible()&&!settings.muted&&!destroyed;
  const emit=()=>onChange(snapshot());
  const stop=source=>{try{source.stop();}catch{}};
  const selected=()=>preview||settings[`${track}Track`];
  function snapshot(){const musicId=selected();return {...settings,track,musicId,previewing:!!preview,title:RESTAURANT_AUDIO[musicId].title,status:!active||!visible()?'paused':settings.muted?'muted':failed?'unavailable':!unlocked?'waiting':current?.track===musicId&&context?.state==='running'?'playing':settings.music===0?'music-off':'loading'};}
  function applyVolumes(){if(!context)return;musicGain.gain.setTargetAtTime(settings.muted?0:settings.music,context.currentTime,.035);effectsGain.gain.setTargetAtTime(settings.muted?0:settings.effects,context.currentTime,.015);}
  async function load(file){
    if(buffers.has(file))return buffers.get(file);
    const abort=new AbortController(),request={abort,timer:setTimeout(()=>abort.abort(),12000)};loads.add(request);
    const promise=(async()=>{try{const response=await fetchImpl(asset(file),{signal:abort.signal});if(!response.ok)throw new Error('audio unavailable');const data=await response.arrayBuffer();return await context.decodeAudioData(data);}finally{clearTimeout(request.timer);loads.delete(request);}})();
    buffers.set(file,promise);
    try{return await promise;}catch(error){buffers.delete(file);throw error;}
  }
  function stopMusic(immediate=false){
    if(current){offsets.set(current.track,((context.currentTime-current.startedAt)+current.offset)%current.duration);current=null;}
    for(const voice of musicVoices){
      if(immediate){stop(voice.source);musicVoices.delete(voice);}
      else{voice.gain.gain.cancelScheduledValues(context.currentTime);voice.gain.gain.setTargetAtTime(0,context.currentTime,.13);try{voice.source.stop(context.currentTime+.65);}catch{}}
    }
  }
  async function syncMusic(){
    const ticket=++epoch;
    if(!allowed()||settings.music===0){stopMusic(true);emit();return;}
    const next=selected();
    if(current?.track===next){emit();return;}
    try{
      const buffer=await load(RESTAURANT_AUDIO[next].file);
      if(ticket!==epoch||!allowed()||settings.music===0)return;
      failed=false;stopMusic();
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;source.loop=true;source.loopEnd=Math.min(buffer.duration,RESTAURANT_AUDIO[next].seconds);
      source.connect(gain);gain.connect(musicGain);gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(RESTAURANT_AUDIO[next].gain,context.currentTime+.65);
      const voice={source,gain,track:next,startedAt:context.currentTime,offset:(offsets.get(next)||0)%source.loopEnd,duration:source.loopEnd};
      source.onended=()=>{musicVoices.delete(voice);source.disconnect();gain.disconnect();};
      source.start(0,voice.offset);musicVoices.add(voice);current=voice;emit();
    }catch{if(ticket===epoch&&!destroyed){failed=true;emit();}}
  }
  async function unlock(){
    if(destroyed||!active)return false;
    try{
      if(!context){context=contextFactory();if(!context){failed=true;emit();return false;}musicGain=context.createGain();effectsGain=context.createGain();musicGain.connect(context.destination);effectsGain.connect(context.destination);applyVolumes();}
      if(context.state!=='running')await context.resume();
      if(context.state!=='running')return false;
      const first=!unlocked;unlocked=true;failed=false;void syncMusic();
      if(first)for(const id of RESTAURANT_EFFECTS)void load(effectFile(id)).catch(()=>{});
      emit();return true;
    }catch{failed=true;emit();return false;}
  }
  async function play(id){
    if(!RESTAURANT_EFFECTS.includes(id)||!allowed()||settings.effects===0||context?.state!=='running')return false;
    const now=context.currentTime;
    if(now-(lastEffect.get(id)??-Infinity)<.055)return false;
    lastEffect.set(id,now);
    try{
      const buffer=await load(effectFile(id));
      if(!allowed()||settings.effects===0||context.state!=='running'||context.currentTime-now>.35)return false;
      while(voices.size>=6){const oldest=voices.values().next().value;stop(oldest);voices.delete(oldest);}
      const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value={click:.42,step:.55,accept:.7,complete:.65,serve:.7,collect:.65,draw:.65,flip:.5,reveal:.7,upgrade:.65,decorate:.6,'decoration-complete':.65}[id];source.connect(gain);gain.connect(effectsGain);voices.add(source);
      source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start();return true;
    }catch{return false;}
  }
  function setActive(value){active=!!value;++epoch;if(!active){preview=null;stopMusic(true);for(const voice of voices)stop(voice);voices.clear();void context?.suspend().catch(()=>{});}else if(unlocked&&visible()){void context.resume().then(syncMusic).catch(()=>{});}emit();}
  function visibility(){++epoch;if(!visible()){for(const voice of voices)stop(voice);voices.clear();void context?.suspend().catch(()=>{});emit();}else if(active&&unlocked){void context.resume().then(syncMusic).catch(()=>{failed=true;emit();});}}
  page?.addEventListener('visibilitychange',visibility);
  return {
    unlock,play,snapshot,setActive,
    setTrack(value){const next=Object.hasOwn(RESTAURANT_MUSIC_CHOICES,value)?value:'restaurant';if(next===track&&!preview)return;track=next;preview=null;void syncMusic();emit();},
    previewMusic(id){if(!Object.hasOwn(RESTAURANT_AUDIO,id))return;preview=id;void syncMusic();emit();},
    stopPreview(){if(!preview)return;preview=null;void syncMusic();emit();},
    setSettings(patch){settings=normalizeRestaurantAudio({...settings,...patch});try{preferences?.setItem(RESTAURANT_AUDIO_KEY,JSON.stringify(settings));}catch{}if(settings.muted||settings.effects===0){for(const voice of voices)stop(voice);voices.clear();}applyVolumes();void syncMusic();emit();},
    destroy(){setActive(false);destroyed=true;++epoch;page?.removeEventListener('visibilitychange',visibility);for(const request of loads){clearTimeout(request.timer);request.abort.abort();}loads.clear();buffers.clear();void context?.close().catch(()=>{});},
  };
}

export function restaurantActionSound(type,stepId){
  if(type==='collect')return 'collect';
  if(type==='serve'||type==='kitchen-step'&&stepId==='delivery')return 'serve';
  if(type==='kitchen-accept')return 'accept';
  if(type==='kitchen-step')return 'step';
  if(['upgrade','train','recipe'].includes(type))return 'upgrade';
  if(['decoration','theme','palette','premium-decoration'].includes(type))return 'decorate';
  if(['research-fuse','hire','unlock-special'].includes(type))return 'complete';
  return 'click';
}
