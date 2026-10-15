import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {normalizeAppearance} from './mage-cat-config.js';
import {createMageAnimationPlayer} from './mage-cat-player.js';
import {clipKey} from './mage-cat-animation.js';

/** Reuses the existing licensed cat, textures and authored clips, without editing its rig. */
export async function loadWorldCat(assetBase,appearance){
  const base=assetBase.replace(/\/$/,''),gltf=await new GLTFLoader().loadAsync(`${base}/model.glb`);
  const model=gltf.scene,root=new THREE.Group(),visual=new THREE.Group();root.name='ExploringCat';root.add(visual);visual.add(model);
  const materials=new Map(),textures=new Map(),geometries=new Set();let revision=0,disposed=false,token=0,mood='',currentAppearance;
  function texture(file){
    if(!textures.has(file))textures.set(file,new THREE.TextureLoader().loadAsync(`${base}/${file}`).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=true;if(disposed)t.dispose();return t;}));
    return textures.get(file);
  }
  model.traverse(n=>{
    if(!n.isMesh)return;geometries.add(n.geometry);n.frustumCulled=false;n.castShadow=!/Eye|Mouth/.test(n.name);n.receiveShadow=true;
    const lod=n.name.match(/_LOD([0-2])$/);if(lod)n.visible=Number(lod[1])===1;
    const replace=old=>{
      if(materials.has(old.name))return materials.get(old.name);
      const face=/Eye|Mouth/.test(old.name),m=face?new THREE.MeshBasicMaterial({name:old.name,transparent:true,depthWrite:false,toneMapped:false}):new THREE.MeshStandardMaterial({name:old.name,roughness:.85});
      old.dispose();materials.set(m.name,m);return m;
    };n.material=Array.isArray(n.material)?n.material.map(replace):replace(n.material);if(/Eye|Mouth/.test(n.name))n.renderOrder=3;
  });
  const mixer=new THREE.AnimationMixer(model),player=createMageAnimationPlayer(mixer,gltf.animations),clips=new Map(gltf.animations.map(clip=>[clipKey(clip.name),clip]));
  const duration=(clip,rate=1)=>(clips.get(clip)?.duration || clips.get('idle')?.duration || 2.333)/Math.max(.1,rate);
  const play=(clip,loop=true,rate=1)=>{const key=clips.has(clip)?clip:'idle';player.sync({clip:key,loop,rate,token:++token});return key;};
  play('idle');player.update(0);
  const bounds=new THREE.Box3().setFromObject(model),scale=1.9/(bounds.max.y-bounds.min.y);model.scale.multiplyScalar(scale);
  model.position.set(-(bounds.min.x+bounds.max.x)*scale/2,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*scale/2);
  async function expression(value='basic'){
    const selected=currentAppearance || normalizeAppearance(appearance),key=`${selected.eyes}:${value}`;if(mood===key)return;mood=key;
    const [eyes,mouth]=await Promise.all([texture(value==='happy'?'eyes-happy.webp':value==='closed'?'eyes-closed.webp':`eyes-${selected.eyes}-basic.webp`),texture(value==='happy'?'mouth-happy.webp':'mouth-basic.webp')]);
    if(disposed || mood!==key)return;
    for(const name of ['Mage_Cat_Eye_L','Mage_Cat_Eye_R'])if(materials.get(name)){materials.get(name).map=eyes;materials.get(name).needsUpdate=true;}
    if(materials.get('Mage Cat_Mouth')){materials.get('Mage Cat_Mouth').map=mouth;materials.get('Mage Cat_Mouth').needsUpdate=true;}
  }
  async function setAppearance(value){
    const selected=normalizeAppearance(value);if(JSON.stringify(selected)===JSON.stringify(currentAppearance))return;
    currentAppearance=selected;const version=++revision;
    const maps=await Promise.all([texture(`coat-${selected.body}.webp`),texture(`coat-${selected.clothes}.webp`),texture(`wand-${selected.wand}.webp`),texture(`wand-emissive-${selected.wand}.webp`)]);
    if(disposed || version!==revision)return;
    for(const [i,name]of ['Mage_Cat','Mage_Cat_Clothes','Mage_Cat_Wand'].entries()){const m=materials.get(name);if(m){m.map=maps[i];if(i===2){m.emissiveMap=maps[3];m.emissive.setHex(0xffffff);m.emissiveIntensity=.8;}m.needsUpdate=true;}}
    mood='';await expression();
  }
  function destroy(){disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();for(const t of textures.values())t.then(value=>value.dispose()).catch(()=>{});}
  try{await setAppearance(appearance);}catch(error){destroy();throw error;}
  return {root,visual,play,duration,expression,setAppearance,update:delta=>player.update(delta),destroy};
}
