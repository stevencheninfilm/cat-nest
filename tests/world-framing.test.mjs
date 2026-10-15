import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorldCameraRig} from '../src/world-camera.js';
import {worldTravelStyle,worldTurnStyle,worldInteractionStyle} from '../src/world-animation.js';
import {ROBOT_APPROACH,ROBOT_HOME} from '../src/world-layout.js';

const cat={x:0,z:1.4},robot={x:2.05,z:1.85};
function projected(camera,point){return new THREE.Vector3(point.x,point.y,point.z).project(camera);}
test('phone follow framing keeps both characters visible at useful size',()=>{
  for(const [width,height]of [[320,505],[390,606],[430,660]]){
    const camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,70),rig=createWorldCameraRig(camera);rig.resize(width,height,{cat});
    const foot=projected(camera,{...cat,y:0}),head=projected(camera,{...cat,y:1.9});
    assert.ok((foot.y-head.y)*-height/2>=100,'cat must remain legible');
    for(const p of [{...cat,y:0},{...cat,y:1.9},{...robot,y:0},{...robot,y:2.22}]){const screen=projected(camera,p);assert.ok(Math.abs(screen.x)<.9 && Math.abs(screen.y)<.95,'character outside phone view');}
    const closeHeight=head.y-foot.y;rig.setOverview(true);rig.update(0,{cat,snap:true});
    assert.ok(closeHeight/(projected(camera,{...cat,y:1.9}).y-projected(camera,{...cat,y:0}).y)>2,'follow should visibly enlarge the scene');
    rig.setOverview(false);rig.update(0,{cat:ROBOT_APPROACH,focus:ROBOT_HOME,snap:true});
    const catFace=projected(camera,{...ROBOT_APPROACH,y:1.5}),robotFace=projected(camera,{...ROBOT_HOME,y:1.65});
    assert.ok(Math.abs(catFace.x-robotFace.x)*width/2>70,'both faces must remain distinct during interaction');
    assert.ok(Math.abs(catFace.x)<.9 && Math.abs(robotFace.x)<.9);
  }
});
test('overview fits the floor and wall tops after portrait/landscape resize',()=>{
  const camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,70),rig=createWorldCameraRig(camera);rig.setOverview(true);
  for(const [w,h]of [[320,505],[390,606],[1000,410]]){
    rig.resize(w,h);const corners=[];for(const x of [-4.35,4.35])for(const z of [-3.8,3.8])corners.push({x,y:-.4,z});for(const x of [-4.35,4.35])corners.push({x,y:2.7,z:-3.8});
    for(const p of corners){const v=projected(camera,p);assert.ok(Math.abs(v.x)<=1 && Math.abs(v.y)<=1);}
  }
});
test('follow approaches the new target smoothly and can snap for reduced motion',()=>{
  const camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,70),rig=createWorldCameraRig(camera);rig.resize(390,606,{cat});
  const pose={cat:{x:1.05,z:1.8},focus:robot};const before=rig.update(.016,{cat}).center.x,after=rig.update(.016,pose).center.x;
  assert.ok(after>before && after<1.55);assert.ok(Math.abs(rig.update(.016,{...pose,reducedMotion:true}).center.x-1.55)<1e-9);
});
test('locomotion selects authored run only for sufficiently long, energetic travel',()=>{
  const far=[{x:0,z:-2.5}];assert.equal(worldTravelStyle(far,cat).clip,'run');assert.equal(worldTravelStyle(far,cat,{energy:20}).clip,'walk');assert.equal(worldTravelStyle(far,cat,{reducedMotion:true}).clip,'walk');assert.equal(worldTravelStyle([{x:1,z:1.5}],cat).clip,'walk');
  assert.equal(worldTurnStyle(Math.PI-.02,-Math.PI+.02),null);assert.equal(worldTurnStyle(0,1.5).clip,'turn_left');assert.equal(worldTurnStyle(0,-1.5).clip,'turn_right');assert.equal(worldTurnStyle(0,2,{reducedMotion:true}),null);
});
test('interactions use distinct original clips and quiet mode uses idle',()=>{
  assert.equal(worldInteractionStyle('console').clip,'special_attack');assert.equal(worldInteractionStyle('toy').clip,'attack');assert.equal(worldInteractionStyle('robot').clip,'attack');
  for(const id of ['console','toy','robot','bed','charger','sofa','door']){assert.ok(!['hurt','death'].includes(worldInteractionStyle(id).clip));assert.equal(worldInteractionStyle(id,{reducedMotion:true}).clip,'idle');}
});
