import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadWorldCat} from './world-cat.js';
import {WORLD_OBJECTS,ROBOT_HOME,ROBOT_APPROACH,findWorldPath,walkable} from './world-layout.js';
import {createWorldCameraRig} from './world-camera.js';
import {worldTravelStyle,worldTurnStyle,worldInteractionStyle} from './world-animation.js';
import {ARCADE_OBJECTS,ARCADE_OBSTACLES,createArcadePresentation} from './world-arcade.js';
import {normalizeNest,nestObjects,nestObstacles,nestApproach,nestItem,nestLevel,nestPalette,NEST_ITEMS,NEST_SPAWN} from './nest-decor.js';
import {applyNestScene,previewNestPlacement} from './nest-decor-scene.js';
import {createNestEditor} from './nest-decor-ui.js';
import './nest-decor.css';

const BASE=`${import.meta.env.BASE_URL}assets/world/v1/`;
const INFO={home:{name:'猫猫小屋',sub:'A LITTLE HOME TO EXPLORE',hint:'阳光、软垫，还有等你一起玩的小伙伴。'},station:{name:'星际猫猫站',sub:'A SMALL PAW IN A BIG UNIVERSE',hint:'小宇宙已就绪。团团陪你探索每个角落。'},arcade:{name:'Retro Arcade',sub:'ONE MORE PLAY, ONE MORE SMILE',hint:'霓虹亮起，猫爪入场。和团团一起发现今晚的小惊喜。'}};
const EMOJI={robot:'🤖',console:'▤',bed:'☾',charger:'ϟ',sofa:'☁',toy:'✦',door:'⌂'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2;
function disposeTree(root){
  const gs=new Set(),ms=new Set();root?.traverse(n=>{if(n.isMesh){gs.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])ms.add(m);}});
  for(const g of gs)g.dispose();for(const m of ms)m.dispose();
}
/** Local exploration with shared, authoritative decoration actions and explicit furniture care. */
export function createWorldExperience({container,modelAssetBase,initialTheme='home',getPetState=()=>({}),getSaveStatus=()=>({phase:'local'}),onDecorAction=()=>false,onFurnitureUse=()=>false,onRetrySave=()=>{},onBack=()=>{}}){
  let theme=Object.hasOwn(INFO,initialTheme)?initialTheme:'home',active=false,destroyed=false,ready=false,loading=false,revision=0,frame=0,last=0,elapsed=0;
  let renderer,scene,camera,cameraRig,room,robot,cat,observer,robotMixer,robotIdle,robotGreeting,robotNod,keyLight,ambient;
  let path=[],destination=null,interaction=null,actionAge=0,actionDuration=3.6,catYaw=0,targetYaw=0,walkClip=false,travelStyle=null,turn=null,pointer=null,focusId='',pointAge=99,petState={},paused=false;
  let manualReduced=false;const media=matchMedia('(prefers-reduced-motion: reduce)');const reduced=()=>manualReduced || media.matches;
  let furnitureUseRequested=false,arcadePresentation=null;
  const nest=()=>normalizeNest(petState.nest),obstacles=()=>theme==='arcade'?ARCADE_OBSTACLES:nestObstacles(nest());
  const object=id=>theme==='arcade'?ARCADE_OBJECTS.find(o=>o.id===id):id==='door'?WORLD_OBJECTS.find(o=>o.id==='door'):nestObjects(nest()).find(o=>o.id===id);
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),hit=new THREE.Vector3();
  const models=new Map(),disposers=[],particles=[];
  container.classList.add('world-root');container.dataset.theme=theme;container.hidden=true;
  container.innerHTML=`<div class="world-shell"><header class="world-topbar"><button class="world-back" data-world-back aria-label="回到猫猫小窝">‹</button><div class="world-title"><small data-world-sub></small><h1 data-world-title></h1></div><span class="world-online"><i></i><span>一起探索</span></span><button class="world-icon-button world-reduce" data-world-reduce aria-label="减少动态效果" aria-pressed="false">慢</button></header><nav class="world-tabs" aria-label="选择探索场景"><button data-world-theme="home" aria-pressed="true"><span>⌂</span>猫猫小屋</button><button data-world-theme="station" aria-pressed="false"><span>✦</span>科幻空间</button></nav><div class="world-stage"><p class="world-caption"><i>⌖</i> 轻点地板走过去 · 轻点物品发现小惊喜</p><div class="world-focus" hidden></div><div class="world-loading"><span class="world-loading-icon">🐾</span><span data-world-loading-text>正在给小屋点亮灯光…</span><button data-world-retry hidden>重新加载</button></div></div><div class="world-bottom"><section class="world-dialogue" aria-label="探索动态"><span class="world-avatar" aria-hidden="true">🤖</span><div><small data-world-speaker>团团 T-01 · 你的机器人伙伴</small><p data-world-status role="status" aria-live="polite" aria-atomic="true"></p></div></section><nav class="world-actions" aria-label="房间互动"><button data-world-object="robot"><span>🤖</span>找团团</button><button data-world-object="console"><span>▤</span><b data-world-console>听音乐</b></button><button data-world-object="toy"><span>✦</span>玩一会</button><button data-world-object="bed"><span>☾</span>歇歇脚</button><button data-world-center><span>⌖</span>回中间</button></nav><p class="world-footnote">小小脚步，大大的好奇心。</p></div></div>`;
  const $=s=>container.querySelector(s),stage=$('.world-stage'),status=$('[data-world-status]'),focus=$('.world-focus'),loader=$('.world-loading');
  const arcadeTab=document.createElement('button');arcadeTab.dataset.worldTheme='arcade';arcadeTab.setAttribute('aria-pressed','false');arcadeTab.innerHTML='<span>🕹</span>复古街机';$('.world-tabs').append(arcadeTab);
  for(const def of ARCADE_OBJECTS){const button=document.createElement('button');button.dataset.worldObject=def.id;button.hidden=true;button.innerHTML=`<span>${def.icon}</span>${def.label}`;$('.world-actions').append(button);}
  const decorButton=document.createElement('button');decorButton.className='world-icon-button world-decor-button';decorButton.dataset.worldDecor='';decorButton.textContent='布置';decorButton.setAttribute('aria-label','布置共同的小窝');$('.world-topbar').insertBefore(decorButton,$('[data-world-reduce]'));
  const editorNode=document.createElement('section');$('.world-shell').append(editorNode);
  const useButton=document.createElement('button');useButton.className='world-use-furniture';useButton.dataset.worldUse='';useButton.hidden=true;stage.append(useButton);
  const editor=createNestEditor({container:editorNode,getState:getPetState,getSaveStatus,onAction:onDecorAction,onRetry:onRetrySave,
    onUse:id=>useFurniture(id),onClose(){container.classList.remove('is-decorating');decorButton.setAttribute('aria-pressed','false');resize();},
    onSelection(id){if(!ready)return;const p=object(id);if(p){halo.position.set(p.x,.07,p.z);halo.visible=true;halo.material.color.set('#ffe0a5');}},
    onPreview(value){if(!ready)return;if(value){previewNestPlacement(room,value.item,value);halo.position.set(value.x,.07,value.z);halo.visible=true;halo.material.color.set(value.ok?'#b8d6a2':'#e69894');requestFrame();}else{applyNestScene(room,petState.nest);halo.visible=false;halo.material.color.set('#ffe0a5');requestFrame();}},
  });
  const viewButton=document.createElement('button');viewButton.className='world-view';viewButton.dataset.worldView='';viewButton.textContent='⊡ 全景';viewButton.setAttribute('aria-label','切换到房间全景');viewButton.setAttribute('aria-pressed','false');stage.append(viewButton);
  $('.world-caption').textContent='点地板走过去 · 点物品互动';
  for(const [id,label] of [['charger','点亮灯光'],['sofa','蹭蹭抱枕'],['door','按按门铃']]){
    const button=document.createElement('button');button.dataset.worldObject=id;button.innerHTML=`<span>${EMOJI[id]}</span>${label}`;$('.world-actions').append(button);
  }
  const listen=(node,event,fn,opts)=>{node.addEventListener(event,fn,opts);disposers.push(()=>node.removeEventListener(event,fn,opts));};
  const say=(text,speaker='团团 T-01 · 你的机器人伙伴')=>{status.textContent=text;$('[data-world-speaker]').textContent=speaker;};
  function updateThemeUI(){
    container.dataset.theme=theme;$('[data-world-title]').textContent=INFO[theme].name;$('[data-world-sub]').textContent=INFO[theme].sub;$('[data-world-console]').textContent=theme==='home'?'听音乐':'看星图';
    for(const b of container.querySelectorAll('[data-world-theme]'))b.setAttribute('aria-pressed',String(b.dataset.worldTheme===theme));
    decorButton.hidden=theme==='arcade';
    for(const b of container.querySelectorAll('[data-world-object]')){const arcadeItem=ARCADE_OBJECTS.some(o=>o.id===b.dataset.worldObject);if(theme==='arcade')b.hidden=b.dataset.worldObject!=='robot'&&!arcadeItem;else if(arcadeItem)b.hidden=true;else if(b.dataset.worldObject==='door')b.hidden=false;}
  }
  function applyDecoration(){
    if(!ready)return;
    if(theme==='arcade'){container.style.removeProperty('--world-accent');updateThemeUI();if(!walkable(cat.root.position,.22,obstacles()))cat.root.position.set(0,0,1.4);requestFrame();return;}
    applyNestScene(room,petState.nest);const decor=nest(),palette=nestPalette(decor.palette);
    container.dataset.nestLevel=String(decor.level);container.dataset.nestPalette=decor.palette;container.style.setProperty('--world-accent',palette.accent);
    $('[data-world-sub]').textContent=`Lv.${decor.level} ${nestLevel(decor.level).name} · ${decor.owned.length} 件收藏`;
    for(const item of NEST_ITEMS){let button=$(`[data-world-object="${item.id}"]`);if(!button){button=document.createElement('button');button.dataset.worldObject=item.id;button.innerHTML=`<span>${item.icon}</span>${item.name}`;$('.world-actions').append(button);}button.hidden=!decor.placements.some(p=>p.item===item.id);}
    if(!walkable(cat.root.position,.22,obstacles()))cat.root.position.set(NEST_SPAWN.x,0,NEST_SPAWN.z);
    editor.render();requestFrame();
  }
  function openEditor(){if(theme==='arcade')return;resetInteraction();container.classList.add('is-decorating');decorButton.setAttribute('aria-pressed','true');if(cameraRig)cameraRig.setOverview(true);viewButton.textContent='⌖ 跟随';viewButton.setAttribute('aria-label','切换到跟随猫猫');viewButton.setAttribute('aria-pressed','true');editor.open();resize();}
  updateThemeUI();say(INFO[theme].hint);
  $('[data-world-reduce]').setAttribute('aria-pressed',String(reduced()));
  const marker=new THREE.Mesh(new THREE.RingGeometry(.17,.22,36),new THREE.MeshBasicMaterial({color:0xffe0a5,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.visible=false;
  const halo=new THREE.Mesh(new THREE.RingGeometry(.44,.47,40),new THREE.MeshBasicMaterial({color:0xffdfb0,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.visible=false;
  function canFrame(){return active && ready && !paused && !document.hidden && !destroyed;}
  function requestFrame(){if(canFrame() && !frame)frame=requestAnimationFrame(tick);}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function resetInteraction(){
    furnitureUseRequested=false;useButton.hidden=true;
    arcadePresentation?.reset();
    path=[];destination=null;interaction=null;pointer=null;walkClip=false;travelStyle=null;turn=null;targetYaw=catYaw;focusId='';focus.hidden=true;halo.visible=false;marker.visible=false;clearParticles();
    if(cat){playCat('idle',true,petState.sleeping?.25:1);void cat.expression(petState.sleeping?'closed':'basic').catch(()=>{});cat.visual.rotation.set(0,0,0);cat.visual.position.y=0;}
    for(const m of models.values()){
      const toy=m.getObjectByName('ToyBall');if(toy){const p=toy.userData.restY??(m.userData.theme==='station'?.65:.36);toy.position.y=p;}
      const door=m.getObjectByName('DoorPanel');if(door)door.position.x=0;
      for(const n of ['DockRing','MonitorDisplay','WindowGlow']){const mesh=m.getObjectByName(n);if(mesh?.material?.emissive)mesh.material.emissiveIntensity=n==='MonitorDisplay'?0:1.6;}
    }
    if(robot){robot.getObjectByName('Arm_R').rotation.set(0,0,0);robot.getObjectByName('RobotHead').rotation.set(0,0,0);robotFace(false);robotGreeting?.stop();robotNod?.stop();}
    for(const b of container.querySelectorAll('[data-world-object]'))b.setAttribute('aria-pressed','false');
    container.dataset.activity='idle';
  }
  function robotFace(happy){
    if(!robot)return;for(const side of ['L','R']){robot.getObjectByName(`Eye_${side}`).visible=!happy;robot.getObjectByName(`Happy_${side}`).visible=happy;}
  }
  function clearParticles(){for(const p of particles){scene?.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}particles.length=0;}
  function sparkle(point){
    if(reduced())return;
    for(let i=0;i<8;i++){
      const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(.045,0),new THREE.MeshBasicMaterial({color:i%2?0xffdb9c:0xb0f5e4,transparent:true}));
      mesh.position.copy(point);scene.add(mesh);particles.push({mesh,age:0,v:new THREE.Vector3(Math.cos(i*.8)*.45,.6+i%3*.15,Math.sin(i*.8)*.4)});
    }
  }
  function playCat(clip,loop=true,rate=1){container.dataset.catClip=cat.play(clip,loop,rate);}
  function startClip(walking){if(walkClip===walking)return;walkClip=walking;playCat(walking?(travelStyle?.clip || 'walk'):'idle',true,walking?(travelStyle?.rate || 1):1);}
  function go(target,id=null,useCare=false){
    if(!ready || !active || loading)return;
    if(petState.sleeping){say('猫猫正在安静休息，醒来再一起探险吧。');return;}
    const route=findWorldPath({x:cat.root.position.x,z:cat.root.position.z},target,obstacles());
    if(!route){say('这里有家具挡住啦，试试旁边的空地。');return;}
    resetInteraction();furnitureUseRequested=useCare;path=route;destination=id;focusId=id||'';pointAge=0;marker.position.set(target.x,.07,target.z);marker.visible=true;
    container.dataset.activity='walking';container.dataset.destination=id || 'floor';
    if(id){const def=object(id),name=id==='robot'?'团团':def[theme];say(`猫猫正走向${name}，等它靠近一点点。`);focus.textContent=`${EMOJI[id]||def?.icon||'✦'} ${name}`;focus.hidden=false;for(const b of container.querySelectorAll('[data-world-object]'))b.setAttribute('aria-pressed',String(b.dataset.worldObject===id));const item=nestItem(id);if(item?.care&&!useCare){useButton.textContent=`在${item.name}${{pet:'摸摸',play:'玩耍',sleep:'休息'}[item.care]}`;useButton.hidden=false;}}
    else say('收到，朝你点的地方出发。',`${petState.name||'猫猫'} · 探索中`);
    travelStyle=worldTravelStyle(path,cat.root.position,{reducedMotion:reduced(),energy:petState.energy});
    const first=path[0];targetYaw=Math.atan2(first.x-cat.root.position.x,first.z-cat.root.position.z);
    turn=worldTurnStyle(catYaw,targetYaw,{reducedMotion:reduced()});
    if(turn){turn.age=0;turn.duration=cat.duration(turn.clip,turn.rate);playCat(turn.clip,false,turn.rate);container.dataset.activity='turning';}
    else startClip(true);
    requestFrame();
  }
  function approach(id,useCare=false){const def=object(id);if(id!=='robot'&&!def)return;const target=id==='robot'?ROBOT_APPROACH:theme==='arcade'||id==='door'?def.approach:nestApproach(nest(),id,cat.root.position);if(!target){say('这里的通路有点窄，调整家具后再试试。');return;}go(target,id,useCare);}
  function useFurniture(id){if(theme==='arcade')return;const item=nestItem(id);if(!item)return;if(petState.sleeping&&item.care==='sleep'){if(onFurnitureUse(id))say('猫猫醒来啦，小爪子又有力气了。',`${petState.name||'猫猫'} · 睡饱啦`);return;}approach(id,true);}
  function arrive(){
    startClip(false);marker.visible=false;
    if(!destination){container.dataset.activity='idle';say('到啦！这里也要留下一个小小的爪印。',`${petState.name||'猫猫'} · 好奇心满格`);return;}
    interaction=destination;destination=null;actionAge=0;container.dataset.activity=`interact-${interaction}`;
    const plan=worldInteractionStyle(interaction,{reducedMotion:reduced()});actionDuration=Math.max(plan.seconds,plan.clip==='idle'?0:cat.duration(plan.clip,plan.rate)+.2);playCat(plan.clip,plan.clip==='idle',plan.rate);
    const def=object(interaction),target=interaction==='robot'?ROBOT_HOME:def;
    targetYaw=Math.atan2(target.x-cat.root.position.x,target.z-cat.root.position.z);
    if(interaction==='robot')targetYaw=.59+Math.atan2(Math.sin(targetYaw-.59),Math.cos(targetYaw-.59))*.65;
    halo.position.set(target.x,.07,target.z);halo.visible=true;
    void cat.expression(['bed','cushion','booth'].includes(interaction)?'closed':'happy').catch(()=>{});
    if(interaction==='robot'){
      say('接住你的小爪爪！今天也一起当最好的探险搭档。');robotFace(true);
      if(!reduced()){robotGreeting.reset().setLoop(THREE.LoopRepeat,2).play();robotNod.reset().setLoop(THREE.LoopRepeat,2).play();}
      sparkle(new THREE.Vector3(1.55,1.65,1.8));
    }else if(theme==='arcade'){
      say(def.reply);if(interaction!=='booth')sparkle(new THREE.Vector3(target.x,interaction==='pool'?1.35:1.65,target.z));
      if(interaction==='jukebox'&&!reduced()){robotFace(true);robotGreeting.reset().setLoop(THREE.LoopRepeat,2).play();}
    }else{
      const text={console:theme==='home'?'按下小琴键，一段软软的旋律在房间里亮起来。':'爪印认证成功。今天的目的地：一颗装满鱼干的小星球。',bed:theme==='home'?'软垫刚刚好，眯起眼睛歇歇脚。':'休眠舱调成暖暖的温度。休息一下，再去看星星。',charger:theme==='home'?'小夜灯亮啦，把这一小块温暖留给你。':'能量环亮起，猫猫的胡须也染上了一点星光。',sofa:'这只抱枕软乎乎，猫猫用脸颊轻轻蹭了一下。',toy:theme==='home'?'小球骨碌碌，猫爪轻轻一拍，又追上去啦。':'悬浮星球转起来了！猫猫伸爪，接住一颗小宇宙。',door:theme==='home'?'叮咚。欢迎回家，最可爱的小住客。':'舱门收到爪印，咔哒——外面是正在旅行的星光。',cushion:'云朵软垫刚刚好，猫猫把小爪子收起来了。',scratch:'伸伸爪，抓柱上多了一点小小的成就。',plant:'叶子轻轻晃，猫猫凑近闻了闻。',rug:'星星和月亮，都被猫猫踩得软软的。',bookshelf:'一起听个故事，把今天的温柔存起来。',memory:'这两颗小心心，是我们一起布置过的日子。'}[interaction];say(text);
      if(interaction!=='bed')sparkle(new THREE.Vector3(target.x,.9,target.z));
    }
    if(furnitureUseRequested&&nestItem(interaction)?.care){const id=interaction;furnitureUseRequested=false;const accepted=onFurnitureUse(id);say(accepted?`在${nestItem(id).name}收到照顾啦，成长气泡会留在主页等你。`:'这次照顾暂时不可用，先陪猫猫看看小窝，稍后再试。',`${petState.name||'猫猫'} · 小窝日常`);}
  }
  function tick(now){
    frame=0;if(!canFrame())return;if(last && now-last<1000/30){requestFrame();return;}
    const delta=Math.min(.05,last?(now-last)/1000:0);last=now;elapsed+=delta;cat.update(delta);if(!reduced())robotMixer.update(delta);
    if(turn && !loading){
      turn.age+=delta;const progress=clamp(turn.age/turn.duration,0,1);catYaw=turn.from+turn.delta*ease(progress);
      if(progress>=1){turn=null;startClip(true);container.dataset.activity='walking';}
    }else if(path.length && !loading){
      const next=path[0],dx=next.x-cat.root.position.x,dz=next.z-cat.root.position.z,distance=Math.hypot(dx,dz),travel=delta*(travelStyle?.speed || 1.55);
      if(distance<=travel){cat.root.position.x=next.x;cat.root.position.z=next.z;path.shift();if(!path.length)arrive();}
      else{cat.root.position.x+=dx/distance*travel;cat.root.position.z+=dz/distance*travel;targetYaw=Math.atan2(dx,dz);}
    }
    if(!turn){const angle=Math.atan2(Math.sin(targetYaw-catYaw),Math.cos(targetYaw-catYaw));catYaw+=angle*(1-Math.exp(-delta*9));}cat.root.rotation.y=catYaw;
    if(robot){const towardCat=Math.atan2(cat.root.position.x-ROBOT_HOME.x,cat.root.position.z-ROBOT_HOME.z);const look=interaction==='robot'?.35+Math.atan2(Math.sin(towardCat-.35),Math.cos(towardCat-.35))*.45:.35;const diff=Math.atan2(Math.sin(look-robot.rotation.y),Math.cos(look-robot.rotation.y));robot.rotation.y+=diff*(1-Math.exp(-delta*3));}
    if(interaction){
      actionAge+=delta;const gain=reduced()?0:Math.sin(clamp(actionAge/actionDuration,0,1)*Math.PI);
      if(['bed','sofa','booth','jukebox'].includes(interaction)){cat.visual.rotation.z=Math.sin(actionAge*(interaction==='jukebox'?4:2))*.045*gain;cat.visual.position.y=-.035*gain;}
      if(theme==='arcade')arcadePresentation?.update(interaction,actionAge,actionDuration,reduced());
      if(interaction==='toy'){const toy=room.getObjectByName('ToyBall');toy.position.y=(theme==='station'?.65:.36)+Math.abs(Math.sin(actionAge*4))*.3*gain;toy.rotation.z=actionAge*gain;}
      if(interaction==='console'){const display=room.getObjectByName('MonitorDisplay');display.material.emissive.set(theme==='station'?0x63d7d1:0xf2b77d);display.material.emissiveIntensity=1+gain;}
      if(interaction==='charger'){room.getObjectByName('DockRing').material.emissiveIntensity=1.6+gain*2;}
      if(interaction==='door'){room.getObjectByName('DoorPanel').position.x=reduced()?.35:ease(clamp(Math.sin(actionAge/actionDuration*Math.PI)*1.2,0,1))*.72;}
      halo.material.opacity=reduced()?.45:.35+gain*.4;
      if(actionAge>actionDuration){const lastId=interaction;resetInteraction();if(lastId==='robot')say('团团记住这次击掌啦。接下来去哪里？');}
    }
    pointAge+=delta;if(marker.visible){marker.scale.setScalar(reduced()?1:1+Math.sin(pointAge*6)*.12);marker.material.opacity=.5;}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=delta;p.mesh.position.addScaledVector(p.v,delta);p.mesh.material.opacity=Math.max(0,1-p.age/1.4);p.mesh.rotation.y+=delta*2;if(p.age>=1.4){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}}
    const target=focusId==='robot'?ROBOT_HOME:object(focusId);cameraRig.update(delta,{cat:cat.root.position,focus:target,reducedMotion:reduced()});
    if(focusId && !focus.hidden){const def=target;const p=new THREE.Vector3(def.x,focusId==='robot'?2.45:def.labelY??1.65,def.z).project(camera);const w=stage.clientWidth,h=stage.clientHeight;focus.style.left=`${clamp((p.x*.5+.5)*w,75,w-75)}px`;focus.style.top=`${clamp((-p.y*.5+.5)*h,72,h-20)}px`;}
    renderer.render(scene,camera);requestFrame();
  }
  function resize(){
    if(!renderer)return;const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    cameraRig.resize(w,h,{cat:cat?.root.position});renderer.setSize(w,h,false);requestFrame();
  }
  async function loadRoom(id){
    if(models.has(id))return models.get(id);
    const gltf=await new GLTFLoader().loadAsync(`${BASE}${id}.glb?v=1`);if(destroyed){disposeTree(gltf.scene);throw new Error('Closed');}
    const value=gltf.scene;value.userData.theme=id;value.traverse(n=>{if(n.isMesh){n.castShadow=!n.name.startsWith('Floor');n.receiveShadow=true;}});if(id==='arcade')arcadePresentation=createArcadePresentation(value);models.set(id,value);return value;
  }
  async function changeTheme(id){
    if(!Object.hasOwn(INFO,id) || id===theme || loading || !ready)return;
    if(editor.active)editor.close();
    theme=id;updateThemeUI();resetInteraction();loading=true;loader.hidden=false;$('[data-world-loading-text]').textContent='正在打开另一扇小屋的门…';$('[data-world-retry]').hidden=true;
    const version=++revision;
    try{const next=await loadRoom(id);if(destroyed || version!==revision)return;scene.remove(room);room=next;scene.add(room);applyLight();applyDecoration();say(INFO[id].hint);}
    catch{theme=room.userData.theme || 'home';updateThemeUI();applyDecoration();say('这个房间还没准备好，稍后再试试。');}
    finally{if(version===revision){loading=false;loader.hidden=true;requestFrame();}}
  }
  function applyLight(){const sci=theme==='station',retro=theme==='arcade';ambient.color.set(retro?0xf5d0e1:sci?0xd2f7ff:0xfff2dc);ambient.groundColor.set(retro?0x452343:sci?0x405371:0xc09b81);ambient.intensity=retro?2.15:2.7;keyLight.color.set(retro?0xffc4b3:sci?0xc9e8ff:0xffe4bb);keyLight.intensity=retro?3:3.6;scene.background=null;marker.material.color.set(retro?0xffb1b6:sci?0x9ef2dc:0xffdfaa);halo.material.color.copy(marker.material.color);}
  async function init(){
    if(loading || ready || destroyed)return;loading=true;loader.hidden=false;$('[data-world-loading-text]').textContent='正在给小屋点亮灯光…';$('[data-world-retry]').hidden=true;
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
      const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','可探索的3D房间，轻点地板移动猫猫，或使用下方房间互动按钮');stage.prepend(canvas);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,70);cameraRig=createWorldCameraRig(camera);cameraRig.setOverview(viewButton.getAttribute('aria-pressed')==='true');
      ambient=new THREE.HemisphereLight(0xfff2dc,0xc09b81,2.7);scene.add(ambient);
      keyLight=new THREE.DirectionalLight(0xffe4bb,3.6);keyLight.position.set(-3,10,6);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);Object.assign(keyLight.shadow.camera,{left:-6,right:6,top:6,bottom:-6,far:30});keyLight.shadow.bias=-.001;keyLight.shadow.normalBias=.035;scene.add(keyLight);
      const fill=new THREE.DirectionalLight(0xb0e7ea,1.3);fill.position.set(6,5,-3);scene.add(fill);
      scene.add(marker,halo);
      const results=await Promise.allSettled([loadRoom(theme),new GLTFLoader().loadAsync(`${BASE}robot.glb?v=1`),loadWorldCat(modelAssetBase,getPetState().appearance)]);
      const roomResult=results[0],robotResult=results[1],catResult=results[2];
      if(destroyed || results.some(r=>r.status==='rejected')){if(robotResult.status==='fulfilled')disposeTree(robotResult.value.scene);if(catResult.status==='fulfilled')catResult.value.destroy();throw new Error('Model unavailable');}
      room=roomResult.value;robot=robotResult.value.scene;cat=catResult.value;scene.add(room,robot,cat.root);cat.root.position.set(0,0,1.4);robot.position.set(ROBOT_HOME.x,0,ROBOT_HOME.z);robot.rotation.y=.35;robot.scale.setScalar(1.08);container.dataset.catClip='idle';
      robot.traverse(n=>{if(n.isMesh)n.castShadow=true;});robot.userData.interactionId='robot';robotFace(false);
      robotMixer=new THREE.AnimationMixer(robot);robotIdle=robotMixer.clipAction(robotResult.value.animations.find(c=>c.name==='HoverIdle'));robotGreeting=robotMixer.clipAction(robotResult.value.animations.find(c=>c.name==='Greeting'));robotNod=robotMixer.clipAction(robotResult.value.animations.find(c=>c.name==='HappyNod'));robotIdle.play();
      petState=getPetState();playCat('idle',true,petState.sleeping?.25:1);if(petState.sleeping)void cat.expression('closed').catch(()=>{});
      container.dataset.robotHeight=new THREE.Box3().setFromObject(robot).getSize(new THREE.Vector3()).y.toFixed(2);
      ready=true;container.dataset.ready='true';container.dataset.activity='idle';applyLight();applyDecoration();observer=new ResizeObserver(resize);observer.observe(stage);resize();
      listen(canvas,'pointerdown',event=>{if(pointer){pointer.moved=true;return;}if(event.button!==0)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};});
      listen(canvas,'pointermove',event=>{if(pointer?.id===event.pointerId && Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>9)pointer.moved=true;});
      listen(canvas,'pointerup',event=>{if(pointer?.id!==event.pointerId)return;const tap=!pointer.moved;pointer=null;if(!tap || loading || !active)return;
        const rect=canvas.getBoundingClientRect();ndc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);
        const hits=raycaster.intersectObjects([room,robot,cat.root],true);const front=hits.find(h=>{let n=h.object;while(n && n!==scene){if(n.userData.interactionId || n===cat.root)return true;n=n.parent;}return false;});
        if(editor.active){if(front){let node=front.object;while(node&&node!==scene){const id=node.userData.interactionId;if(nestItem(id)){editor.select(id);return;}node=node.parent;}}if(raycaster.ray.intersectPlane(plane,hit))editor.place({x:hit.x,z:hit.z});return;}
        if(front){let node=front.object;while(node && node!==scene){if(node===cat.root){if(petState.sleeping){say('嘘，猫猫正在做一个软软的梦。');return;}resetInteraction();interaction='touch';actionAge=0;actionDuration=3.2;container.dataset.activity='interact-touch';void cat.expression('happy').catch(()=>{});say('喵～探索的时候，也喜欢你轻轻摸摸。',`${petState.name||'猫猫'} · 小小回应`);sparkle(cat.root.position.clone().add(new THREE.Vector3(0,1.6,0)));return;}if(node.userData.interactionId){approach(node.userData.interactionId);return;}node=node.parent;}}
        if(raycaster.ray.intersectPlane(plane,hit) && walkable(hit,.22,obstacles()))go({x:hit.x,z:hit.z});else say('点点房间里的空地，猫猫就能走过去。');
      });
      listen(canvas,'pointercancel',()=>{pointer=null;});listen(window,'pointerup',()=>{pointer=null;});listen(window,'pointercancel',()=>{pointer=null;});listen(window,'blur',()=>{pointer=null;});
      listen(canvas,'keydown',event=>{const directions={ArrowUp:[0,-.65],ArrowDown:[0,.65],ArrowLeft:[-.65,0],ArrowRight:[.65,0]};if(directions[event.key]){event.preventDefault();const [dx,dz]=directions[event.key];go({x:cat.root.position.x+dx,z:cat.root.position.z+dz});}});
      listen(canvas,'webglcontextlost',event=>{event.preventDefault();paused=true;suspend();loader.hidden=false;$('[data-world-loading-text]').textContent='画面暂时休息了，图形恢复后会继续点亮小屋。';});
      listen(canvas,'webglcontextrestored',()=>{paused=false;loader.hidden=true;requestFrame();});
    }catch{if(!destroyed){loader.hidden=false;$('[data-world-loading-text]').textContent='小屋还没加载好，检查网络后再试一次。';$('[data-world-retry]').hidden=false;cat?.destroy();cat=null;robotMixer?.stopAllAction();disposeTree(robot);robot=null;renderer?.dispose();renderer?.domElement.remove();renderer=null;}}
    finally{loading=false;if(ready){loader.hidden=true;requestFrame();}}
  }
  function suspend(){stop();if(ready)resetInteraction();}
  listen(container,'click',event=>{const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-world-back')){api.close();onBack();}
    else if(button.dataset.worldTheme)void changeTheme(button.dataset.worldTheme);
    else if(button.dataset.worldObject)approach(button.dataset.worldObject);
    else if(button.hasAttribute('data-world-decor')){if(editor.active)editor.close();else openEditor();}
    else if(button.hasAttribute('data-world-use')&&focusId)useFurniture(focusId);
    else if(button.hasAttribute('data-world-center'))go({x:0,z:1.4});
    else if(button.hasAttribute('data-world-view') && cameraRig){cameraRig.setOverview(!cameraRig.overview);viewButton.textContent=cameraRig.overview?'⌖ 跟随':'⊡ 全景';viewButton.setAttribute('aria-label',cameraRig.overview?'切换到跟随猫猫':'切换到房间全景');viewButton.setAttribute('aria-pressed',String(cameraRig.overview));requestFrame();}
    else if(button.hasAttribute('data-world-reduce')){manualReduced=!manualReduced;button.setAttribute('aria-pressed',String(reduced()));resetInteraction();say(reduced()?'切换到轻柔模式，脚步慢一点，星光安静一点。':'恢复活泼模式，继续探索吧。');requestFrame();}
    else if(button.hasAttribute('data-world-retry'))void init();
  });
  listen(document,'visibilitychange',()=>{if(document.hidden)suspend();else requestFrame();});listen(window,'pagehide',suspend);listen(window,'pageshow',()=>requestFrame());listen(media,'change',()=>{$('[data-world-reduce]').setAttribute('aria-pressed',String(reduced()));if(ready){resetInteraction();requestFrame();}});
  listen(container,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(editor.active)editor.close();else{api.close();onBack();}}});
  const api={
    open({decorate=false}={}){if(destroyed)return;active=true;paused=false;container.hidden=false;document.body.classList.add('world-mode');petState=getPetState();if(ready){resetInteraction();void cat.setAppearance(petState.appearance).catch(()=>{});applyDecoration();resize();say(INFO[theme].hint);requestFrame();}else void init();if(decorate)openEditor();$('[data-world-back]').focus({preventScroll:true});},
    close(){active=false;editor.close();suspend();container.hidden=true;document.body.classList.remove('world-mode');},
    setState(value){const wasSleeping=petState.sleeping,changed=JSON.stringify(petState.nest)!==JSON.stringify(value.nest);petState=value;if(ready){void cat.setAppearance(value.appearance).catch(()=>{});if(value.sleeping!==wasSleeping||changed)resetInteraction();if(changed)applyDecoration();}editor.render();},
    refreshSaveStatus(){editor.render();},
    get active(){return active;},
    destroy(){if(destroyed)return;api.close();destroyed=true;editor.destroy();revision++;observer?.disconnect();for(const dispose of disposers)dispose();clearParticles();cat?.destroy();robotMixer?.stopAllAction();for(const m of models.values())disposeTree(m);disposeTree(robot);marker.geometry.dispose();marker.material.dispose();halo.geometry.dispose();halo.material.dispose();renderer?.dispose();container.replaceChildren();},
  };return api;
}
