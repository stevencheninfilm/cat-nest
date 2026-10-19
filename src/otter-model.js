import * as THREE from 'three';

export const OTTER_MODEL_PATH='pets/baby-otter-v1/model.glb';
export const OTTER_CLIPS=['idle','walk','run','attack','special_attack','hurt','death','turn_left','turn_right'];
// The cat's 3-unit frame includes its tall hat; the seated otter is all body.
export const OTTER_DISPLAY_HEIGHT=2.15;
const OTTER_CLOSED_EYE_AMOUNT=.55;

export function prepareOtterModel(gltf) {
  const {scene:model,animations}=gltf;
  const clips=new Set(animations.map(clip=>clip.name.toLowerCase()));
  if(!OTTER_CLIPS.every(name=>clips.has(name)))throw new Error('水獭动作文件不完整');
  let skin;model.traverse(node=>{if(node.isSkinnedMesh&&!skin)skin=node;});
  if(!skin?.skeleton.bones.some(bone=>bone.name==='Head'))throw new Error('水獭骨骼文件不完整');
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y;
  if(!(height>0&&Number.isFinite(height)))throw new Error('水獭尺寸无效');
  const scale=OTTER_DISPLAY_HEIGHT/height;model.scale.multiplyScalar(scale);
  model.position.x-=(box.min.x+box.max.x)/2*scale;model.position.z-=(box.min.z+box.max.z)/2*scale;model.position.y-=box.min.y*scale;
  model.traverse(node=>{if(node.isMesh){node.frustumCulled=false;for(const material of Array.isArray(node.material)?node.material:[node.material]){material.side=THREE.FrontSide;if(material.normalScale)material.normalScale.set(.7,.7);}}});
  return {model,clips:animations};
}

/** Otter eyelids are mesh shapes, independent from the cat's painted face. */
export function updateOtterExpression(model,eyes) {
  // The purchased face has embedded eyes, not the cat's replaceable eye planes.
  // Full collapse hides them inside the face. Keep happy eyes open and retain
  // visible pupils even during a blink, wink, or a sleepy expression.
  const both=eyes==='closed'?OTTER_CLOSED_EYE_AMOUNT:eyes==='tired'?.2:0;
  const left=eyes==='wink'?OTTER_CLOSED_EYE_AMOUNT:both,right=both;
  model.traverse(node=>{
    if(!node.morphTargetDictionary)return;
    for(const [name,value]of [['Blink_L',left],['Blink_R',right]]){
      const index=node.morphTargetDictionary[name];if(index!==undefined)node.morphTargetInfluences[index]=value;
    }
  });
}

export function disposeOtterModel({model}) {
  const resources=new Set();model.traverse(node=>{
    if(!node.isMesh)return;resources.add(node.geometry);
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
      resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
    }
  });
  const images=new Set();
  for(const resource of resources){if(resource.isTexture&&resource.source?.data)images.add(resource.source.data);resource.dispose();}
  for(const image of images)image.close?.();
}
