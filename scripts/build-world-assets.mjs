import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRobotAsset,createRobotClips,createRoomAsset} from '../src/world-assets.js';
import {createArcadeRoomAsset} from '../src/world-arcade-assets.js';
import {ARCADE_ANIMATED_NODES} from '../src/world-arcade.js';
// GLTFExporter only needs the Blob reader in Node; no browser or image service.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const folder=new URL('../public/assets/world/v1/',import.meta.url);await mkdir(folder,{recursive:true});
function batchStaticMeshes(root){
  const animated=new Set(['ToyBall','ToyOrbit','DoorPanel','MonitorDisplay','DockRing','WindowGlow',...ARCADE_ANIMATED_NODES]);
  const parents=[];root.traverse(n=>{if(n.isGroup)parents.push(n);});
  for(const parent of parents){
    const batches=new Map();for(const child of [...parent.children]){
      if(!child.isMesh || animated.has(child.name) || Array.isArray(child.material))continue;
      const batch=batches.get(child.material)||[];batch.push(child);batches.set(child.material,batch);
    }
    for(const [material,meshes]of batches){
      if(meshes.length<2)continue;
      const geometries=meshes.map(mesh=>{mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(!g.index)return g;const flat=g.toNonIndexed();g.dispose();return flat;});
      const merged=mergeGeometries(geometries),indexed=mergeVertices(merged);merged.dispose();for(const g of geometries)g.dispose();
      const mesh=new THREE.Mesh(indexed,material);mesh.name=meshes.every(n=>n.name==='FloorTile')?'FloorTiles':`Static_${parent.name}`;mesh.castShadow=meshes.some(n=>n.castShadow);mesh.receiveShadow=true;
      parent.add(mesh);for(const old of meshes){parent.remove(old);old.geometry.dispose();}
    }
  }
}
const requested=process.argv.slice(2),ids=requested.length?[...new Set(requested)]:['robot','home','station','arcade'];
if(ids.some(id=>!['robot','home','station','arcade'].includes(id)))throw new Error('Unknown world asset');
for(const id of ids){
  const asset=id==='robot'?createRobotAsset():id==='arcade'?createArcadeRoomAsset():createRoomAsset(id);
  if(id!=='robot')batchStaticMeshes(asset);
  const animations=id==='robot'?createRobotClips(asset):[];
  const bytes=await new GLTFExporter().parseAsync(asset,{binary:true,animations,onlyVisible:false});
  await writeFile(new URL(`${id}.glb`,folder),Buffer.from(bytes));
  console.log(`${id}.glb: ${bytes.byteLength.toLocaleString()} bytes`);
  const geometries=new Set(),materials=new Set();asset.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
