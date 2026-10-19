/** Bake the licensed cat's world-space joint motion, including its FBX helper chains.
 * Private intermediate only; prepare-baby-otter.py applies rest-pose correction.
 */
import fs from 'node:fs/promises';
import * as THREE from 'three';
const input=process.argv[2]||'public/model/model.glb';
const output=process.argv[3]||'artifacts/licensed/baby-otter/cat-motion.json';
const raw=await fs.readFile(input),length=raw.readUInt32LE(12);
const gltf=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length);
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function accessor(index){
 const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],width=widths[a.type];
 if(a.componentType!==5126)throw new Error('Motion data must use float32');
 const values=[];for(let i=0;i<a.count;i++){
  const row=[];for(let c=0;c<width;c++)row.push(bin.readFloatLE((view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||width*4)+c*4));values.push(row);
 }return values;
}
const nodes=gltf.nodes.map(n=>{
 const o=new THREE.Object3D();
 if(n.matrix)new THREE.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);
 else {if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}
 return o;
});
gltf.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
const roots=nodes.filter(n=>!n.parent);
const names=['Hips','Spine_03','Spine_02','Spine_01','Neck','Head','Clavicle_L','Arm_L','Forearm_L','Hand_L','Clavicle_R','Arm_R','Forearm_R','Hand_R','Hind_Leg_L','Lower__Leg_L','Foot_L','Hind_Leg_R','Lower__Leg_R','Foot_R','Tail_01','Tail_07'];
const joints=Object.fromEntries(names.map(name=>[name,gltf.skins[0].joints.find(i=>gltf.nodes[i].name===name)]));
if(Object.values(joints).some(i=>i===undefined))throw new Error('Missing source joint');
const rest=nodes.map(n=>({p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));
const cache=new Map(),data=i=>{if(!cache.has(i))cache.set(i,accessor(i));return cache.get(i);};
const v=new THREE.Vector3(),q=new THREE.Quaternion(),p=new THREE.Vector3();
function sample(animation,time){
 nodes.forEach((n,i)=>{n.position.copy(rest[i].p);n.quaternion.copy(rest[i].q);n.scale.copy(rest[i].s);});
 for(const channel of animation.channels){
  const sampler=animation.samplers[channel.sampler],times=data(sampler.input),values=data(sampler.output),node=nodes[channel.target.node];
  let i=0;while(i+1<times.length&&times[i+1][0]<=time)i++;
  const next=Math.min(i+1,times.length-1),alpha=sampler.interpolation==='STEP'?0:(time-times[i][0])/(times[next][0]-times[i][0]||1);
  if(channel.target.path==='rotation')node.quaternion.fromArray(values[i]).slerp(q.fromArray(values[next]),alpha);
  else if(['translation','scale'].includes(channel.target.path))node[channel.target.path==='translation'?'position':'scale'].fromArray(values[i]).lerp(v.fromArray(values[next]),alpha);
 }
 roots.forEach(n=>n.updateMatrixWorld(true));
 return Object.fromEntries(Object.entries(joints).map(([name,i])=>[name,{q:nodes[i].getWorldQuaternion(q).toArray(),p:nodes[i].getWorldPosition(p).toArray()}]));
}
const idle=gltf.animations.find(a=>a.name.endsWith('|Idle'));
const reference=sample(idle,0),fps=24;
const clips=gltf.animations.map(a=>{
 const duration=Math.max(...a.samplers.map(s=>data(s.input).at(-1)[0])),count=Math.ceil(duration*fps);
 return {name:a.name.split('|').at(-1),duration,frames:Array.from({length:count+1},(_,i)=>({time:i/count*duration,joints:sample(a,i/count*duration)}))};
});
await fs.writeFile(output,JSON.stringify({fps,reference,clips}));
console.log(JSON.stringify({joints:names.length,clips:clips.map(c=>({name:c.name,seconds:c.duration,frames:c.frames.length}))}));
