import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeAppearance, appearanceCharacter, MAGE_CAT_VERSION } from './mage-cat-config.js';
import { createCharacterSwitch } from './pet-character-switch.js';
import { OTTER_MODEL_PATH, prepareOtterModel, updateOtterExpression, disposeOtterModel } from './otter-model.js';
import { advanceMagePose } from './mage-cat-animation.js';
import { createCatBehavior } from './cat-behavior.js';
import { createMageAnimationPlayer } from './mage-cat-player.js';
import { NEST_PERIODS } from './nest-life.js';
import { catStageFrame, catStageOffset } from './cat-stage-frame.js';
import { createYarnPawRig } from './nest-yarn-paw.js';
const PERIOD_LIGHTS=Object.fromEntries(Object.entries(NEST_PERIODS).map(([id,p])=>[id,{...p,skyColor:new THREE.Color(p.sky),keyColor:new THREE.Color(p.tint)}]));

/** Nekueda's licensed Mage Cat, with its original skeleton, LODs, motions and textures. */
export function createCatModel({container,assetBase,onReady,onError,onCharacterStatus,reducedMotion=false,decorateScene,onBehaviorChange,autonomous=true,random=Math.random,clock=Date.now,canRotate=()=>true}={}) {
  const base=(assetBase || `${import.meta.env.BASE_URL}api/pet-model/${MAGE_CAT_VERSION}`).replace(/\/$/,'');
  let renderer,scene,camera,pivot,model,mixer,player,decoration,ambientLight,keyLight;
  let frame=0,lastFrame=0,destroyed=false,paused=false,ready=false,failed=false;
  let elapsed=0,yaw=0,targetYaw=0,behaviorKey='';
  let engagementYaw=null;
  const behavior=createCatBehavior({random,clock,reducedMotion,autonomous});
  let pose=behavior.snapshot();
  let pointer=null,didDrag=false,observer,currentExpression='',textureRevision=0;
  let appearance=normalizeAppearance();
  let baseHalfHeight=1.72,viewHalfHeight=1.72,viewCenter=1.5;
  let roomView=false,layout,stageFrame,pawRig;
  let catSlot,currentCharacter='cat';
  const stageAnchor=new THREE.Vector3(),stageFoot=new THREE.Vector3(),footSample=new THREE.Vector3();let stageFeet=[];
  const materials=new Map(),geometries=new Set(),texturePromises=new Map(),disposers=[];
  const characterSwitch=createCharacterSwitch({
    load:async id=>{
      if(id==='cat')return catSlot;
      const gltf=await new GLTFLoader().loadAsync(new URL(OTTER_MODEL_PATH,document.baseURI).href);
      try{return prepareOtterModel(gltf);}catch(error){disposeOtterModel({model:gltf.scene});throw error;}
    },
    apply(slot,id){
      pawRig?.restore();decoration?.destroy?.();mixer.stopAllAction();pivot.remove(model);
      model=slot.model;mixer=slot.mixer??=new THREE.AnimationMixer(model);player=createMageAnimationPlayer(mixer,slot.clips);
      currentCharacter=id;behavior.setClips(slot.clips);pivot.add(model);pivot.position.set(0,0,0);pivot.rotation.set(0,yaw,0);pivot.scale.setScalar(1);
      player.sync(pose);mixer.update(0);setStageFeet();pawRig=createYarnPawRig(model);
      decoration=decorateScene?.({scene,model,pivot,camera,renderer,reducedMotion,getStageFrame:()=>stageFrame,setRoomView});
      currentExpression='';void updateExpression();container.dataset.petCharacter=id;resize();publishBehavior();startFrame();
    },
    onStatus(status){if(destroyed)return;container.dataset.characterPhase=status.phase;onCharacterStatus?.(status);},
    dispose(slot,id){if(id!=='cat'){slot.mixer?.stopAllAction();slot.mixer?.uncacheRoot(slot.model);disposeOtterModel(slot);}},
  });
  const listen=(node,type,handler,options)=>{node.addEventListener(type,handler,options);disposers.push(()=>node.removeEventListener(type,handler,options));};
  const api={
    canAmbientEvent(){return ready&&!paused&&!pointer&&engagementYaw===null&&behavior.canAmbientEvent();},
    ambientEvent(kind){if(!api.canAmbientEvent())return false;const next=behavior.ambientEvent(kind);if(!next)return false;pose=next;player.sync(pose);updateExpression();publishBehavior();startFrame();return true;},
    react(type,state={}) {
      if(type && typeof type==='object')type=type.type;
      pose=behavior.react(type,state);
      if(ready){player.sync(pose);updateExpression();publishBehavior();}
      startFrame();
    },
    cancelReaction(state={}) {
      pose=behavior.cancel(state);
      if(ready){player.sync(pose);updateExpression();publishBehavior();startFrame();}
    },
    setState(state={}) {
      pose=behavior.setState(state);
      if(state.appearance)api.setAppearance(state.appearance);
      if(ready){player.sync(pose);updateExpression();publishBehavior();startFrame();}
    },
    setExpression(value) {
      pose=behavior.setExpression(value);
      if(ready){player.sync(pose);updateExpression();publishBehavior();startFrame();}
    },
    playAction(value) {
      pose=behavior.playAction(value);
      if(ready){player.sync(pose);updateExpression();publishBehavior();startFrame();}
    },
    setAppearance(value) {
      const next=normalizeAppearance(value);
      if(JSON.stringify(next)===JSON.stringify(appearance))return;
      appearance=next;
      if(ready){if(appearanceCharacter(appearance)==='cat')applyAppearance().catch(fail);void characterSwitch.select(appearanceCharacter(appearance));}
    },
    retryCharacter(){if(ready)void characterSwitch.select(appearanceCharacter(appearance));},
    setPaused(value){const next=Boolean(value);if(paused===next)return;paused=next;lastFrame=0;if(paused){decoration?.act?.({type:'life-hide'});cancelAnimationFrame(frame);frame=0;behavior.suspend();pose=behavior.snapshot();}else startFrame();},
    consumeTap(){const result=didDrag;didDrag=false;return result;},
    resetView(){targetYaw=0;startFrame();},
    setEngaged(value){if(value&&engagementYaw===null){engagementYaw=targetYaw;targetYaw=0;pointer=null;}else if(!value&&engagementYaw!==null){targetYaw=engagementYaw;engagementYaw=null;}startFrame();},
    stageAction(action){const result=decoration?.act?.(action);startFrame();return result;},
    destroy(){destroyed=true;characterSwitch.destroy();cancelAnimationFrame(frame);observer?.disconnect();for(const dispose of disposers)dispose();pawRig?.restore();decoration?.destroy?.();mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);catSlot?.mixer?.stopAllAction();if(catSlot)catSlot.mixer.uncacheRoot(catSlot.model);for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();for(const promise of texturePromises.values())promise.then(t=>t.dispose()).catch(()=>{});renderer?.dispose();renderer?.domElement.remove();container?.classList.remove('has-cat-model');},
  };
  function publishBehavior(){
    container.dataset.catMood=pose.mood;container.dataset.catPeriod=pose.period;container.dataset.catAction=pose.id;container.dataset.catClip=pose.clip;container.dataset.catExpressionMode=pose.expression;
    const key=`${pose.mood}:${pose.period}:${pose.id}:${pose.source}:${pose.expression}:${pose.token}`;
    if(key!==behaviorKey){behaviorKey=key;onBehaviorChange?.(pose);}
  }
  function fail(error){if(destroyed || failed)return;failed=true;cancelAnimationFrame(frame);frame=0;container?.classList.remove('has-cat-model');container?.setAttribute('aria-busy','false');if(container)container.dataset.modelPhase='error';onError?.(error);}
  function texture(file,color=true){
    if(!texturePromises.has(file))texturePromises.set(file,new THREE.TextureLoader().loadAsync(`${base}/${file}`).then(t=>{t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=true;t.anisotropy=Math.min(renderer?.capabilities.getMaxAnisotropy()||1,4);return t;}));
    return texturePromises.get(file);
  }
  async function applyAppearance(){
    const id=++textureRevision;const selected={...appearance};
    const [body,clothes,wand,emissive]=await Promise.all([texture(`coat-${selected.body}.webp`),texture(`coat-${selected.clothes}.webp`),texture(`wand-${selected.wand}.webp`),texture(`wand-emissive-${selected.wand}.webp`)]);
    if(destroyed || id!==textureRevision)return;
    if(JSON.stringify(selected)!==JSON.stringify(appearance)){await applyAppearance();return;}
    materials.get('Mage_Cat').map=body;materials.get('Mage_Cat_Clothes').map=clothes;
    const wandMaterial=materials.get('Mage_Cat_Wand');wandMaterial.map=wand;wandMaterial.emissiveMap=emissive;wandMaterial.emissive.setHex(0xffffff);wandMaterial.emissiveIntensity=.8;
    for(const m of materials.values())m.needsUpdate=true;
    currentExpression='';await updateExpression();
    startFrame();
  }
  async function updateExpression(){
    if(currentCharacter==='otter'){updateOtterExpression(model,pose.eyes);container.dataset.catExpression=`${pose.eyes}:${pose.mouth}`;return;}
    const key=`${appearance.eyes}:${pose.eyes}:${pose.mouth}`;
    if(key===currentExpression)return;
    currentExpression=key;
    const eyeFile=['closed','happy','panic','tired','wink'].includes(pose.eyes)?`eyes-${pose.eyes}.webp`:`eyes-${appearance.eyes}-${pose.eyes}.webp`;
    try{
      const [eye,mouth]=await Promise.all([texture(eyeFile),texture(`mouth-${pose.mouth}.webp`)]);
      if(destroyed || currentCharacter!=='cat' || currentExpression!==key)return;
      for(const name of ['Mage_Cat_Eye_L','Mage_Cat_Eye_R']){const m=materials.get(name);m.map=eye;m.needsUpdate=true;}
      const m=materials.get('Mage Cat_Mouth');m.map=mouth;m.needsUpdate=true;
      container.dataset.catExpression=`${pose.eyes}:${pose.mouth}`;
      startFrame();
    }catch(error){fail(error);}
  }
  function setStageFeet(){
    model.updateWorldMatrix(true,true);let skin;model.traverse(n=>{if(n.isSkinnedMesh&&!skin)skin=n;});
    stageFeet=skin?.skeleton.bones.filter(b=>['Foot_L','Foot_R'].includes(b.name))??[];stageAnchor.set(0,0,0);
    for(const foot of stageFeet)stageAnchor.add(pivot.worldToLocal(foot.getWorldPosition(footSample)));
    if(stageFeet.length)stageAnchor.divideScalar(stageFeet.length);
  }
  function updateCamera(){
    if(!layout)return;
    stageFrame=catStageFrame({...layout,halfHeight:viewHalfHeight,expanded:roomView});
    for(const edge of ['left','right','top','bottom'])camera[edge]=stageFrame[edge];
    camera.position.y=viewCenter+.15;camera.lookAt(0,viewCenter,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function setRoomView(value){
    if(roomView===Boolean(value))return;roomView=Boolean(value);
    if(!roomView){pawRig?.restore();if(pivot){pivot.position.set(0,0,0);pivot.rotation.set(0,yaw,0);}}
    resize();
  }
  function resize(){
    if(destroyed || !renderer || !camera)return;
    const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight),aspect=width/height;
    const room=container.closest('.nest'),rect=container.getBoundingClientRect(),roomRect=room?.getBoundingClientRect();
    layout={width,height,roomWidth:room?.clientWidth??width,roomHeight:room?.clientHeight??height,offsetX:roomRect?rect.left-roomRect.left-room.clientLeft:0,offsetY:roomRect?rect.top-roomRect.top-room.clientTop:0};
    baseHalfHeight=Math.max(1.72,1.65/Math.max(.65,aspect));viewHalfHeight=baseHalfHeight;
    updateCamera();renderer.setSize(stageFrame.width,stageFrame.height,false);
    const style=renderer.domElement.style;
    if(roomView){style.left=`${-stageFrame.offsetX}px`;style.top=`${-stageFrame.offsetY}px`;style.width=`${stageFrame.width}px`;style.height=`${stageFrame.height}px`;}
    else for(const key of ['left','top','width','height'])style.removeProperty(key);
    if(model){const lod=width<275?1:0;model.traverse(n=>{if(n.isMesh){const match=n.name.match(/_LOD([0-2])$/);if(match)n.visible=Number(match[1])===lod;}});}
    decoration?.resize?.({width,height});
    if(ready)renderer.render(scene,camera);
    startFrame();
  }
  function startFrame(){if(!destroyed && !failed && !paused && ready && !frame)frame=requestAnimationFrame(animate);}
  function animate(now){
    frame=0;if(destroyed || failed || paused || !ready)return;
    if(lastFrame && now-lastFrame<1000/30){frame=requestAnimationFrame(animate);return;}
    const delta=Math.min(.075,lastFrame?(now-lastFrame)/1000:0);lastFrame=now;elapsed+=delta;
    pose=pointer?behavior.snapshot():behavior.step(delta);
    if(decoration?.catPose?.()&&pose.id!=='ambientSpill')decoration.act({type:'life-hide'});
    if(decoration?.catPose)decoration.update(delta,{elapsed,reducedMotion});
    const staged=pose.id==='ambientSpill'&&pose.source==='ambient'?decoration?.catPose?.():null;
    const playback=staged?.blend?{...pose,clip:staged.clip,token:`${pose.token}:${staged.phase}`,rate:staged.clip==='run'?1.1:.9,loop:true}:pose;
    player.sync(playback);publishBehavior();
    const magic=pose.wide;
    const ease=1-Math.exp(-delta*10);
    viewHalfHeight+=((magic?baseHalfHeight*1.32:baseHalfHeight)-viewHalfHeight)*ease;
    viewCenter+=((magic?1.85:1.5)-viewCenter)*ease;
    updateCamera();
    yaw+=(targetYaw-yaw)*(1-Math.exp(-delta*8));
    const reaction=['feed','savor'].includes(pose.id)?'feed':['pet','nuzzle','comfort','gentle','ambientAffection'].includes(pose.id)?'pet':'';
    pawRig?.restore();
    advanceMagePose(player,pivot,delta,{sleeping:pose.sleeping || pose.id==='doze',reaction,reactionTime:pose.time,activityDuration:pose.duration,elapsed,yaw:staged?yaw*(1-staged.blend)+staged.yaw*staged.blend:yaw,reducedMotion});
    stageFoot.copy(stageAnchor);
    if(staged&&stageFeet.length){stageFoot.set(0,0,0);for(const foot of stageFeet)stageFoot.add(pivot.worldToLocal(foot.getWorldPosition(footSample)));stageFoot.divideScalar(stageFeet.length);}
    const offset=staged?catStageOffset(stageAnchor,yaw,pivot.rotation.y,staged,stageFoot):{x:0,z:0};
    pivot.position.x=offset.x;pivot.position.z=offset.z;pivot.position.y+=staged?.y??0;
    pawRig?.apply(staged??{});
    if(roomView)container.dataset.yarnPhase=staged?.phase??'rest';else delete container.dataset.yarnPhase;
    const lighting=autonomous?PERIOD_LIGHTS[pose.period]:null;
    ambientLight.intensity+=((lighting?.ambient??2)-ambientLight.intensity)*ease;
    keyLight.intensity+=((lighting?.key??2.25)-keyLight.intensity)*ease;
    if(lighting){ambientLight.color.lerp(lighting.skyColor,ease);keyLight.color.lerp(lighting.keyColor,ease);}
    if(!decoration?.catPose)decoration?.update?.(delta,{elapsed,reducedMotion});
    void updateExpression();
    try{renderer.render(scene,camera);}catch(error){fail(error);return;}
    frame=requestAnimationFrame(animate);
  }
  async function load(){
    try{
      if(!container)throw new Error('A cat container is required');
      container.dataset.modelPhase='loading';container.setAttribute('aria-busy','true');
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
      renderer.domElement.className='cat-model-canvas';renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.style.pointerEvents='none';container.append(renderer.domElement);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);camera.position.set(0,1.65,8);camera.lookAt(0,1.5,0);
      ambientLight=new THREE.HemisphereLight(0xfff8ee,0xb6aaae,2);scene.add(ambientLight);
      keyLight=new THREE.DirectionalLight(0xfff0e1,2.25);keyLight.position.set(-3,5,7);scene.add(keyLight);
      const fill=new THREE.DirectionalLight(0xffffff,1.1);fill.position.set(4,2,3);scene.add(fill);
      const gltf=await new GLTFLoader().loadAsync(`${base}/model.glb`);
      if(destroyed)return;
      model=gltf.scene;pivot=new THREE.Group();pivot.add(model);scene.add(pivot);mixer=new THREE.AnimationMixer(model);
      if(!gltf.animations.some(clip=>clip.name.split('|').at(-1).toLowerCase()==='idle'))throw new Error('The authored idle animation is missing');
      behavior.setClips(gltf.animations);player=createMageAnimationPlayer(mixer,gltf.animations);
      model.traverse(n=>{
        if(!n.isMesh)return;
        geometries.add(n.geometry);n.frustumCulled=false;
        const replace=old=>{
          if(materials.has(old.name))return materials.get(old.name);
          const face=/Eye|Mouth/.test(old.name);
          const m=face?new THREE.MeshBasicMaterial({name:old.name,color:0xffffff,transparent:true,depthWrite:false,side:THREE.FrontSide,toneMapped:false}):new THREE.MeshStandardMaterial({name:old.name,color:0xffffff,roughness:.85,metalness:0});
          materials.set(old.name,m);old.dispose();return m;
        };
        n.material=Array.isArray(n.material)?n.material.map(replace):replace(n.material);
        if(/Eye|Mouth/.test(n.name))n.renderOrder=3;
      });
      for(const name of ['Mage_Cat','Mage_Cat_Clothes','Mage_Cat_Wand','Mage_Cat_Eye_L','Mage_Cat_Eye_R','Mage Cat_Mouth'])if(!materials.has(name))throw new Error(`Missing authored material: ${name}`);
      player.sync({...pose,clip:'idle',loop:true});mixer.update(0);
      // Frame the author’s idle pose, including the hat and wand, without altering its proportions.
      const box=new THREE.Box3().setFromObject(model);const height=box.max.y-box.min.y;const scale=3/height;
      model.scale.multiplyScalar(scale);model.position.x-=((box.min.x+box.max.x)/2)*scale;model.position.y-=box.min.y*scale;
      model.position.z-=((box.min.z+box.max.z)/2)*scale;
      model.updateWorldMatrix(true,true);
      setStageFeet();
      const [normal,ao]=await Promise.all([texture('body-normal.webp',false),texture('body-ao.webp',false)]);
      for(const name of ['Mage_Cat','Mage_Cat_Clothes']){const m=materials.get(name);m.normalMap=normal;m.normalScale.set(.45,.45);m.aoMap=ao;m.aoMapIntensity=.35;}
      await applyAppearance();
      if(destroyed)return;
      catSlot={model,mixer,clips:gltf.animations};container.dataset.petCharacter='cat';
      pawRig=createYarnPawRig(model);
      decoration=decorateScene?.({scene,model,pivot,camera,renderer,reducedMotion,getStageFrame:()=>stageFrame,setRoomView});
      ready=true;container.classList.add('has-cat-model');container.dataset.modelPhase='ready';container.setAttribute('aria-busy','false');publishBehavior();
      observer=new ResizeObserver(resize);observer.observe(container);resize();renderer.render(scene,camera);
      listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();fail(new Error('Graphics context lost'));});
      listen(container,'pointerdown',event=>{if(event.button!==0 || pointer||!canRotate()||engagementYaw!==null)return;behavior.suspend();pose=behavior.snapshot();pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,horizontal:false};didDrag=false;});
      listen(container,'pointermove',event=>{
        if(pointer?.id!==event.pointerId)return;
        const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
        if(!pointer.horizontal && Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)*1.15){pointer.horizontal=true;didDrag=true;container.classList.add('cat-view-hint-dismissed');try{container.setPointerCapture(event.pointerId);}catch{}}
        if(pointer.horizontal){event.preventDefault();targetYaw+=(event.clientX-pointer.lastX)*.012;}
        pointer.lastX=event.clientX;
      },{passive:false});
      const end=event=>{if(pointer?.id!==event.pointerId)return;try{if(container.hasPointerCapture(event.pointerId))container.releasePointerCapture(event.pointerId);}catch{}pointer=null;};
      listen(container,'pointerup',end);listen(container,'pointercancel',end);
      listen(window,'pointerup',end);listen(window,'pointercancel',end);listen(window,'blur',()=>{pointer=null;});
      onReady?.();void characterSwitch.select(appearanceCharacter(appearance));startFrame();
    }catch(error){fail(error);}
  }
  void load();return api;
}
