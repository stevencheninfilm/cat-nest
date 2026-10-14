import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeAppearance, MAGE_CAT_VERSION } from './mage-cat-config.js';
import { clipKey, chooseMageClip, mageExpression, MAGE_REACTION_SECONDS } from './mage-cat-animation.js';

/** Nekueda's licensed Mage Cat, with its original skeleton, LODs, motions and textures. */
export function createCatModel({container,assetBase,onReady,onError,reducedMotion=false}={}) {
  const base=(assetBase || `${import.meta.env.BASE_URL}api/pet-model/${MAGE_CAT_VERSION}`).replace(/\/$/,'');
  let renderer,scene,camera,pivot,model,mixer,head;
  let frame=0,lastFrame=0,destroyed=false,paused=false,ready=false,failed=false;
  let sleeping=false,reaction='',reactionTime=100,elapsed=0,yaw=0,targetYaw=0;
  let pointer=null,didDrag=false,observer,currentClip,currentExpression='',textureRevision=0;
  let appearance=normalizeAppearance();
  let baseHalfHeight=1.72,viewHalfHeight=1.72,viewCenter=1.5;
  const materials=new Map(),geometries=new Set(),texturePromises=new Map(),clips=new Map(),disposers=[];
  const listen=(node,type,handler,options)=>{node.addEventListener(type,handler,options);disposers.push(()=>node.removeEventListener(type,handler,options));};
  const api={
    react(type,state={}) {
      if(type && typeof type==='object')type=type.type;
      if(typeof state.sleeping==='boolean')sleeping=state.sleeping;
      else if(type==='sleep')sleeping=!sleeping;
      reaction=MAGE_REACTION_SECONDS[type]?type:'';reactionTime=0;
      if(ready){playClip(chooseMageClip(reducedMotion?undefined:type,sleeping,[...clips.keys()]));updateExpression();}
      startFrame();
    },
    setState(state={}) {
      const before=sleeping;
      if(typeof state.sleeping==='boolean')sleeping=state.sleeping;
      if(state.appearance)api.setAppearance(state.appearance);
      if(ready && before!==sleeping){reaction='';reactionTime=100;playClip('idle');updateExpression();startFrame();}
    },
    setAppearance(value) {
      const next=normalizeAppearance(value);
      if(JSON.stringify(next)===JSON.stringify(appearance))return;
      appearance=next;
      if(ready)applyAppearance().catch(fail);
    },
    setPaused(value){paused=Boolean(value);lastFrame=0;if(paused){cancelAnimationFrame(frame);frame=0;}else startFrame();},
    consumeTap(){const result=didDrag;didDrag=false;return result;},
    resetView(){targetYaw=0;startFrame();},
    destroy(){destroyed=true;cancelAnimationFrame(frame);observer?.disconnect();for(const dispose of disposers)dispose();mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();for(const promise of texturePromises.values())promise.then(t=>t.dispose()).catch(()=>{});renderer?.dispose();renderer?.domElement.remove();container?.classList.remove('has-cat-model');},
  };
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
    const duration=MAGE_REACTION_SECONDS[reaction] || 1;
    const phase=reactionTime/duration;
    const blink=!sleeping && !reaction && elapsed%4.8>4.55;
    const pose=blink?{eyes:'closed',mouth:'basic'}:mageExpression(reaction,sleeping,phase);
    const key=`${appearance.eyes}:${pose.eyes}:${pose.mouth}`;
    if(key===currentExpression)return;
    currentExpression=key;
    const eyeFile=['closed','happy','panic','tired','wink'].includes(pose.eyes)?`eyes-${pose.eyes}.webp`:`eyes-${appearance.eyes}-${pose.eyes}.webp`;
    try{
      const [eye,mouth]=await Promise.all([texture(eyeFile),texture(`mouth-${pose.mouth}.webp`)]);
      if(destroyed || currentExpression!==key)return;
      for(const name of ['Mage_Cat_Eye_L','Mage_Cat_Eye_R']){const m=materials.get(name);m.map=eye;m.needsUpdate=true;}
      const m=materials.get('Mage Cat_Mouth');m.map=mouth;m.needsUpdate=true;
      startFrame();
    }catch(error){fail(error);}
  }
  function playClip(key){
    key=clips.has(key)?key:'idle';if(!mixer || !clips.has(key))return;
    if(currentClip===key)return;
    const before=currentClip && mixer.clipAction(clips.get(currentClip));
    const next=mixer.clipAction(clips.get(key));next.reset();next.enabled=true;
    next.setLoop(key==='idle'?THREE.LoopRepeat:THREE.LoopOnce,key==='idle'?Infinity:1);next.clampWhenFinished=key!=='idle';
    next.setEffectiveTimeScale(key==='idle' && sleeping?.25:1);
    next.setEffectiveWeight(1);next.play();if(before)before.crossFadeTo(next,.22,false);
    currentClip=key;
  }
  function resize(){
    if(destroyed || !renderer || !camera)return;
    const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight),aspect=width/height;
    baseHalfHeight=Math.max(1.72,1.65/Math.max(.65,aspect));viewHalfHeight=baseHalfHeight;
    camera.left=-viewHalfHeight*aspect;camera.right=viewHalfHeight*aspect;camera.top=viewHalfHeight;camera.bottom=-viewHalfHeight;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    if(model){const lod=width<275?1:0;model.traverse(n=>{if(n.isMesh){const match=n.name.match(/_LOD([0-2])$/);if(match)n.visible=Number(match[1])===lod;}});}
    if(ready)renderer.render(scene,camera);
    startFrame();
  }
  function startFrame(){if(!destroyed && !failed && !paused && ready && !frame)frame=requestAnimationFrame(animate);}
  function animate(now){
    frame=0;if(destroyed || failed || paused || !ready)return;
    if(lastFrame && now-lastFrame<1000/30){frame=requestAnimationFrame(animate);return;}
    const delta=Math.min(.075,lastFrame?(now-lastFrame)/1000:0);lastFrame=now;elapsed+=delta;reactionTime+=delta;
    const duration=MAGE_REACTION_SECONDS[reaction]||0;
    if(reaction && reactionTime>=duration){reaction='';playClip('idle');}
    if(currentClip==='idle')mixer.clipAction(clips.get('idle')).setEffectiveTimeScale(sleeping?.25:reducedMotion?.45:1);
    mixer.update(delta);
    const magic=reaction==='play' && !reducedMotion;
    const ease=1-Math.exp(-delta*10);
    viewHalfHeight+=((magic?baseHalfHeight*1.32:baseHalfHeight)-viewHalfHeight)*ease;
    viewCenter+=((magic?1.85:1.5)-viewCenter)*ease;
    const aspect=Math.max(1,container.clientWidth)/Math.max(1,container.clientHeight);
    camera.left=-viewHalfHeight*aspect;camera.right=viewHalfHeight*aspect;camera.top=viewHalfHeight;camera.bottom=-viewHalfHeight;camera.updateProjectionMatrix();camera.position.y=viewCenter+.15;camera.lookAt(0,viewCenter,0);
    yaw+=(targetYaw-yaw)*(1-Math.exp(-delta*8));pivot.rotation.y=yaw;
    pivot.rotation.z=sleeping?Math.sin(elapsed*1.2)*.008:0;
    if(head){
      const strength=duration && reactionTime<duration?Math.sin(Math.PI*reactionTime/duration):0;
      const nod=reaction==='feed'?(.10+Math.sin(reactionTime*9)*.055)*strength:0;
      const tilt=reaction==='pet'?Math.sin(reactionTime*4)*.10*strength:0;
      const gain=reducedMotion?.25:1;
      const supplement=new THREE.Quaternion().setFromEuler(new THREE.Euler((sleeping?.08:nod)*gain,0,tilt*gain));
      head.quaternion.multiply(supplement);
    }
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
      scene.add(new THREE.HemisphereLight(0xfff8ee,0xb6aaae,2));
      const key=new THREE.DirectionalLight(0xfff0e1,2.25);key.position.set(-3,5,7);scene.add(key);
      const fill=new THREE.DirectionalLight(0xffffff,1.1);fill.position.set(4,2,3);scene.add(fill);
      const gltf=await new GLTFLoader().loadAsync(`${base}/model.glb`);
      if(destroyed)return;
      model=gltf.scene;pivot=new THREE.Group();pivot.add(model);scene.add(pivot);mixer=new THREE.AnimationMixer(model);
      for(const clip of gltf.animations)clips.set(clipKey(clip.name),clip);
      if(!clips.has('idle'))throw new Error('The authored idle animation is missing');
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
      playClip('idle');mixer.update(0);
      // Frame the author’s idle pose, including the hat and wand, without altering its proportions.
      const box=new THREE.Box3().setFromObject(model);const height=box.max.y-box.min.y;const scale=3/height;
      model.scale.multiplyScalar(scale);model.position.x-=((box.min.x+box.max.x)/2)*scale;model.position.y-=box.min.y*scale;
      model.position.z-=((box.min.z+box.max.z)/2)*scale;
      head=model.getObjectByName('Head');
      const [normal,ao]=await Promise.all([texture('body-normal.webp',false),texture('body-ao.webp',false)]);
      for(const name of ['Mage_Cat','Mage_Cat_Clothes']){const m=materials.get(name);m.normalMap=normal;m.normalScale.set(.45,.45);m.aoMap=ao;m.aoMapIntensity=.35;}
      await applyAppearance();
      if(destroyed)return;
      ready=true;container.classList.add('has-cat-model');container.dataset.modelPhase='ready';container.setAttribute('aria-busy','false');
      observer=new ResizeObserver(resize);observer.observe(container);resize();renderer.render(scene,camera);
      listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();fail(new Error('Graphics context lost'));});
      listen(container,'pointerdown',event=>{if(event.button!==0 || pointer)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,horizontal:false};didDrag=false;});
      listen(container,'pointermove',event=>{
        if(pointer?.id!==event.pointerId)return;
        const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
        if(!pointer.horizontal && Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)*1.15){pointer.horizontal=true;didDrag=true;try{container.setPointerCapture(event.pointerId);}catch{}}
        if(pointer.horizontal){event.preventDefault();targetYaw+=(event.clientX-pointer.lastX)*.012;}
        pointer.lastX=event.clientX;
      },{passive:false});
      const end=event=>{if(pointer?.id!==event.pointerId)return;try{if(container.hasPointerCapture(event.pointerId))container.releasePointerCapture(event.pointerId);}catch{}pointer=null;};
      listen(container,'pointerup',end);listen(container,'pointercancel',end);
      onReady?.();startFrame();
    }catch(error){fail(error);}
  }
  void load();return api;
}
