import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {catStageFrame,catStageOffset} from '../src/cat-stage-frame.js';
import {createYarnPawRig} from '../src/nest-yarn-paw.js';
import {createCatBehavior} from '../src/cat-behavior.js';
import {yarnPlayPose,YARN_PLAY} from '../src/nest-yarn-play.js';

test('room expansion preserves the cat projection pixel for pixel at different home sizes',()=>{
  for(const [width,height,roomWidth,roomHeight,offsetX,offsetY]of [[320,280,390,844,35,210],[380,400,460,940,40,225],[228,360,320,760,46,180]]){
    const normal=catStageFrame({width,height,halfHeight:1.9}),room=catStageFrame({width,height,halfHeight:1.9,roomWidth,roomHeight,offsetX,offsetY,expanded:true});
    for(const [x,y]of [[0,0],[.8,1],[-1,2],[.2,-.8]]){
      const originalX=(x-normal.left)/(normal.right-normal.left)*width,originalY=(normal.top-y)/(normal.top-normal.bottom)*height;
      const expandedX=(x-room.left)/(room.right-room.left)*roomWidth-offsetX,expandedY=(room.top-y)/(room.top-room.bottom)*roomHeight-offsetY;
      assert.ok(Math.abs(originalX-expandedX)<1e-9);assert.ok(Math.abs(originalY-expandedY)<1e-9);
    }
  }
});
test('free paw pose uses the real weighted bones, leaves the wand and face alone and fully restores after interruption',async()=>{
  const bytes=await readFile(new URL('../public/model/model.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let skin;gltf.scene.traverse(n=>{if(n.isSkinnedMesh&&!skin)skin=n;});
  const bones=skin.skeleton.bones,hand=bones.find(b=>b.name==='Hand_L');
  const mixer=new THREE.AnimationMixer(gltf.scene),idle=gltf.animations.find(c=>c.name.endsWith('|Idle'));mixer.clipAction(idle).play();mixer.update(0);gltf.scene.updateMatrixWorld(true);
  const before=new Map();gltf.scene.traverse(n=>before.set(n,n.quaternion.clone()));
  const palm=hand.getWorldPosition(new THREE.Vector3()),rig=createYarnPawRig(gltf.scene);
  rig.apply({reach:1,swipe:.8});gltf.scene.updateMatrixWorld(true);
  assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(palm)>.08,'the actual paw reaches towards the ball');
  for(const [node,q]of before)if(!/^(Arm_L|Forearm_L)(?:_\d+)?$/.test(node.name))assert.ok(node.quaternion.equals(q),`${node.name} stays untouched`);
  for(let n=0;n<60;n++)rig.apply({reach:1,swipe:.8});
  rig.restore();for(const [node,q]of before)assert.ok(node.quaternion.equals(q),'no accumulated rig drift');
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
});
test('turning and returning preserve the foot contact point, including a previously rotated cat',()=>{
  const anchor={x:.096,z:.65},desired={x:.48,z:0};
  for(const yaw of [0,.8,-1.5,Math.PI])for(const facing of [-1.05,0,.2,1.05]){
    const offset=catStageOffset(anchor,yaw,facing,desired);
    const x=anchor.x*Math.cos(facing)+anchor.z*Math.sin(facing)+offset.x;
    const z=-anchor.x*Math.sin(facing)+anchor.z*Math.cos(facing)+offset.z;
    assert.ok(Math.abs(x-(anchor.x*Math.cos(yaw)+anchor.z*Math.sin(yaw)+desired.x))<1e-9);
    assert.ok(Math.abs(z-(-anchor.x*Math.sin(yaw)+anchor.z*Math.cos(yaw)))<1e-9);
    assert.deepEqual(catStageOffset(anchor,yaw,yaw,{x:0,z:0}),{x:0,z:0});
    const step={x:anchor.x+.6,z:anchor.z+.8},walking=catStageOffset(anchor,yaw,facing,desired,step);
    assert.ok(Math.abs(step.x*Math.cos(facing)+step.z*Math.sin(facing)+walking.x-x)<1e-9,'authored step displacement does not orbit away from the ball');
  }
});
test('the scene sequence yields to care, expressions, sleep and suspension at every phase',()=>{
  const state={hunger:90,mood:90,energy:90,sleeping:false},clock=()=>new Date(2026,9,15,14).valueOf();
  for(const age of [0,YARN_PLAY.flight,2.4,3.4,5.3])for(const interrupt of ['care','expression','sleep','background']){
    const behavior=createCatBehavior({clock,random:()=>.4});behavior.setState(state);behavior.ambientEvent('spill');
    for(let t=0;t<age;t+=1/30)behavior.step(1/30);
    assert.equal(behavior.snapshot().id,'ambientSpill');assert.ok(yarnPlayPose(age).cat);
    if(interrupt==='care')behavior.react('pet',state);
    if(interrupt==='expression')behavior.setExpression('happy');
    if(interrupt==='sleep')behavior.cancel({...state,sleeping:true});
    if(interrupt==='background')behavior.suspend();
    assert.notEqual(behavior.snapshot().id,'ambientSpill');
  }
});
