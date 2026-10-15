import * as THREE from 'three';

/** A reversible pose on the free paw only. Restore before the next authored animation update. */
export function createYarnPawRig(model) {
  let skeleton;model?.traverse(n=>{if(n.isSkinnedMesh&&!skeleton)skeleton=n.skeleton;});
  const bones=['Arm_L','Forearm_L'].map(name=>{
    let bone=skeleton?.bones.find(b=>b.name===name);
    // FBX exports include a chain of transform helpers above each weighted joint.
    // Move the whole arm chain, rather than its weighted leaf, so the paw stays attached.
    const family=new RegExp(`^${name}(?:_\\d+)?$`);
    while(bone?.parent&&family.test(bone.parent.name))bone=bone.parent;
    return bone;
  }).filter(Boolean),saved=new Map();
  const z=new THREE.Vector3(0,0,1),y=new THREE.Vector3(0,1,0),parent=new THREE.Quaternion(),delta=new THREE.Quaternion();
  function restore(){for(const [bone,q]of saved)bone.quaternion.copy(q);saved.clear();}
  function turn(bone,axis,angle){bone.parent.getWorldQuaternion(parent);delta.setFromAxisAngle(axis,angle);delta.premultiply(parent.clone().invert()).multiply(parent);bone.quaternion.premultiply(delta);}
  return {restore,apply({reach=0,swipe=0}={}){
    restore();if(!reach||bones.length!==2)return;
    for(const bone of bones)saved.set(bone,bone.quaternion.clone());
    turn(bones[0],y,-.55*reach);turn(bones[0],z,-.4*reach+.22*swipe);
    turn(bones[1],y,-.25*reach);turn(bones[1],z,-.18*swipe);
  }};
}
