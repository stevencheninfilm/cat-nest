import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ARCADE_OBJECTS,ARCADE_OBSTACLES,ARCADE_ANIMATED_NODES,createArcadePresentation} from '../src/world-arcade.js';
import {findWorldPath,walkable,ROBOT_APPROACH} from '../src/world-layout.js';
import {worldInteractionStyle} from '../src/world-animation.js';

const bytes=await readFile(new URL('../public/assets/world/v1/arcade.glb',import.meta.url));
const load=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const snapshot=node=>({position:node.position.toArray(),rotation:node.rotation.toArray(),scale:node.scale.toArray(),visible:node.visible,emissive:node.material?.emissiveIntensity});
test('arcade spawn and every pair of interaction approaches have safe routes',()=>{
  const points=[{x:0,z:1.4},ROBOT_APPROACH,...ARCADE_OBJECTS.map(o=>o.approach)];
  for(const start of points)for(const end of points){
    const path=findWorldPath(start,end,ARCADE_OBSTACLES);assert.ok(path?.length,JSON.stringify({start,end}));let previous=start;
    for(const next of path){const steps=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.z-previous.z)/.04));for(let i=0;i<=steps;i++)assert.ok(walkable({x:previous.x+(next.x-previous.x)*i/steps,z:previous.z+(next.z-previous.z)*i/steps},.22,ARCADE_OBSTACLES));previous=next;}
  }
  for(const o of ARCADE_OBSTACLES)assert.equal(walkable(o,.22,ARCADE_OBSTACLES),false);
});
test('exported arcade retains clickable prop parents and all dynamic nodes',async()=>{
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.ok(json.buffers.every(b=>!b.uri));assert.ok(!json.images?.length);
  const {scene}=await load();for(const o of ARCADE_OBJECTS){const prop=scene.getObjectByName(`Prop_${o.id}`);assert.equal(prop?.userData.interactionId,o.id);assert.equal(prop.position.x,o.x);assert.equal(prop.position.z,o.z);}
  for(const name of ARCADE_ANIMATED_NODES)assert.ok(scene.getObjectByName(name),name);
});
test('props animate and restore exactly, including hidden drink stream and scale',async()=>{
  const {scene}=await load(),presentation=createArcadePresentation(scene),rest=new Map(ARCADE_ANIMATED_NODES.map(name=>[name,snapshot(scene.getObjectByName(name))]));
  for(let cycle=0;cycle<10;cycle++)for(const id of ARCADE_OBJECTS.map(o=>o.id)){
    presentation.update(id,1.1,3.6);presentation.update(id,2.2,3.6);presentation.reset();
    for(const [name,before]of rest)assert.deepEqual(snapshot(scene.getObjectByName(name)),before,`${id}:${name}`);
  }
  presentation.update('claw',1.1,3.2);assert.notEqual(scene.getObjectByName('ClawRig').position.y,rest.get('ClawRig').position[1]);presentation.reset();
  presentation.update('pool',1.1,3.6);assert.notDeepEqual(scene.getObjectByName('PoolBall_0').position.toArray(),rest.get('PoolBall_0').position);presentation.reset();
  presentation.update('drinks',1.1,3.4);assert.equal(scene.getObjectByName('DrinkStream').visible,true);presentation.reset();assert.equal(scene.getObjectByName('DrinkStream').visible,false);
});
test('reduced motion keeps prop rest transforms and uses gentle cat idle',async()=>{
  const {scene}=await load(),presentation=createArcadePresentation(scene),rest=new Map(ARCADE_ANIMATED_NODES.map(name=>[name,snapshot(scene.getObjectByName(name))]));
  for(const o of ARCADE_OBJECTS){presentation.update(o.id,1.1,3.6,true);for(const [name,before]of rest)assert.deepEqual(snapshot(scene.getObjectByName(name)),before,name);assert.equal(worldInteractionStyle(o.id,{reducedMotion:true}).clip,'idle');}
});
