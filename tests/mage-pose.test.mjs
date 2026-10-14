import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {advanceMagePose,MAGE_REACTION_SECONDS} from '../src/mage-cat-animation.js';

function rig() {
  const pivot=new THREE.Group();
  const authoredHead=new THREE.Bone();authoredHead.name='Head_25';pivot.add(authoredHead);
  // The exported face attachment is not an animated skin bone. Its local pose must stay intact.
  const faceAnchor=new THREE.Bone();faceAnchor.name='Head';faceAnchor.rotation.set(.03,.02,-.01);authoredHead.add(faceAnchor);
  const eye=new THREE.Object3D();eye.position.set(.18,.1,.4);faceAnchor.add(eye);
  const hat=new THREE.Object3D();hat.position.set(0,.45,.05);authoredHead.add(hat);
  const clip=new THREE.AnimationClip('Idle',1,[new THREE.QuaternionKeyframeTrack('Head_25.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);
  const mixer=new THREE.AnimationMixer(pivot);mixer.clipAction(clip).play();mixer.update(0);pivot.updateMatrixWorld(true);
  return {pivot,mixer,faceAnchor,authoredHead,eye,hat,facePose:faceAnchor.quaternion.clone(),eyePose:authoredHead.worldToLocal(eye.getWorldPosition(new THREE.Vector3())),hatPose:authoredHead.worldToLocal(hat.getWorldPosition(new THREE.Vector3()))};
}
function attached(r) {
  r.pivot.updateMatrixWorld(true);
  assert.ok(r.faceAnchor.quaternion.angleTo(r.facePose)<1e-7,'face attachment rotation must not accumulate');
  assert.ok(r.authoredHead.worldToLocal(r.eye.getWorldPosition(new THREE.Vector3())).distanceTo(r.eyePose)<1e-7,'eye must stay attached to the authored head');
  assert.ok(r.authoredHead.worldToLocal(r.hat.getWorldPosition(new THREE.Vector3())).distanceTo(r.hatPose)<1e-7,'hat and facial planes must keep their original relative pose');
}

test('continuous rest never rotates untracked face attachments away from skin and hat',()=>{
  for(const fps of [30,60]) {
    const r=rig();
    for(let i=0;i<fps*120;i++)advanceMagePose(r.mixer,r.pivot,1/fps,{sleeping:true,elapsed:i/fps,yaw:Math.PI/2});
    attached(r);
    advanceMagePose(r.mixer,r.pivot,1/fps,{sleeping:false});
    attached(r);assert.equal(r.pivot.scale.x,1);assert.equal(r.pivot.position.y,0);assert.equal(r.pivot.rotation.z,0);
  }
});

test('repeated feeding and pet reactions return to the exact neutral outer pose',()=>{
  const r=rig();let elapsed=0;
  for(let cycle=0;cycle<30;cycle++)for(const reaction of ['feed','pet']) {
    const duration=MAGE_REACTION_SECONDS[reaction];
    for(let i=0;i<=Math.ceil(duration*30);i++) {
      elapsed+=1/30;
      advanceMagePose(r.mixer,r.pivot,1/30,{reaction,reactionTime:i/30,elapsed,yaw:-Math.PI/2});
      assert.ok(r.pivot.position.y>=0 && r.pivot.position.y<=.025,'feeding bounce must remain above the floor');
    }
    attached(r);
    advanceMagePose(r.mixer,r.pivot,1/30,{yaw:-Math.PI/2,elapsed});
    assert.equal(r.pivot.position.y,0);assert.equal(r.pivot.rotation.y,-Math.PI/2);assert.equal(r.pivot.scale.x,1);
  }
});

test('rest wins over an interrupted reaction and reduced motion keeps the same authored attachments',()=>{
  const r=rig();
  advanceMagePose(r.mixer,r.pivot,1/30,{sleeping:true,reaction:'feed',reactionTime:1,elapsed:1,yaw:1,reducedMotion:true});
  attached(r);assert.equal(r.pivot.position.y,0);assert.equal(r.pivot.rotation.y,1);
  advanceMagePose(r.mixer,r.pivot,1/30,{reaction:'feed',reactionTime:1});const normal=r.pivot.position.y;
  advanceMagePose(r.mixer,r.pivot,1/30,{reaction:'feed',reactionTime:1,reducedMotion:true});
  assert.equal(r.pivot.position.y,normal*.25);attached(r);
});
