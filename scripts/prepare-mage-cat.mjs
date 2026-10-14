/** Deterministic conversion of a purchased FBX. Never commit the source or outputs.
 * Usage: node scripts/prepare-mage-cat.mjs <private-source-dir> <private-output-dir>
 * Requires three and sharp; SHARP_MODULE_ROOT can point to a bundled runtime.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAGE_CAT_FILES, EYE_EXPRESSIONS, UNIVERSAL_EYES, MOUTHS } from '../src/mage-cat-config.js';
const source=path.resolve(process.argv[2] || 'artifacts/licensed/mage-cat');
const output=path.resolve(process.argv[3] || `${source}/processed`);
const require=createRequire(process.env.SHARP_MODULE_ROOT ? path.join(process.env.SHARP_MODULE_ROOT,'package.json') : import.meta.url);
const sharp=require('sharp');
await fs.mkdir(output,{recursive:true});
const manager=new THREE.LoadingManager();
manager.addHandler(/.*/, {path:'',setPath(value){this.path=value;return this;},load(name){const t=new THREE.Texture();t.name=name;return t;}});
const raw=await fs.readFile(path.join(source,'mage_cat.fbx'));
const model=new FBXLoader(manager).parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const originalMaterials=new Map();let meshes=0,triangles=0;
model.traverse(node=>{
  if (!node.isMesh) return;
  meshes++;
  node.geometry=mergeVertices(node.geometry);
  triangles+=node.geometry.index.count/3;
  if(node.isSkinnedMesh)node.normalizeSkinWeights();
  const convert=old=>{
    if(originalMaterials.has(old.name))return originalMaterials.get(old.name);
    const face=/Eye|Mouth/i.test(old.name);
    const m=new THREE.MeshStandardMaterial({name:old.name,color:0xffffff,roughness:face?.94:.78,metalness:0,transparent:face,depthWrite:!face,side:THREE.FrontSide});
    originalMaterials.set(old.name,m);return m;
  };
  node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);
});
const clips=model.animations.filter(clip=>clip.duration>0).map(clip=>clip.clone().optimize());
if(clips.length!==9)throw new Error(`Expected the author's 9 motions; found ${clips.length}`);
// GLTFExporter only needs FileReader for binary packaging here, with no browser or image synthesis.
class BinaryReader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
}
globalThis.FileReader=BinaryReader;
const binary=await new GLTFExporter().parseAsync(model,{binary:true,animations:clips,onlyVisible:false,trs:true,copyright:'Nekueda. Licensed Fab asset incorporated into Cat Nest. No standalone redistribution.'});
await fs.writeFile(path.join(output,'model.glb'),Buffer.from(binary));
const textures=path.join(source,'mage_cat_textures','Mage_Cat_Textures');
const jobs=[];
const image=(input,name,size,alpha=false)=>jobs.push(sharp(path.join(textures,input)).resize(size,size,{fit:'inside',withoutEnlargement:true}).webp(alpha?{lossless:true,effort:6}:{quality:92,effort:6}).toFile(path.join(output,name)));
for(let i=0;i<5;i++)image(i?`Mage Cat_Variation${i}_Base_color.png`:'Mage Cat_Base_color.png',`coat-${i}.webp`,1024);
image('Mage Cat_Normal_OpenGL.png','body-normal.webp',1024);
image('Mage Cat_Mixed_AO.png','body-ao.webp',1024);
for(let i=0;i<3;i++){
 image(i?`Wand/Mage Cat_Wand_Variation_Base_color_0${i}.png`:'Wand/Mage_Cat_Wand_albedo.jpg',`wand-${i}.webp`,512);
 image(i?`Wand/Mage Cat_Wand_Variation_Emissive_0${i}.png`:'Wand/Mage_Cat_Wand_emissive.jpg',`wand-emissive-${i}.webp`,512);
 const color=['Orange','Blue','Green'][i];
 for(const expression of EYE_EXPRESSIONS){
  const title=expression[0].toUpperCase()+expression.slice(1);
  image(`Eyes/${color}/Eye_${title}${i?`_Variation${i}`:''}.png`,`eyes-${i}-${expression}.webp`,512,true);
 }
}
for(const expression of UNIVERSAL_EYES)image(`Eyes/Eye_${expression[0].toUpperCase()+expression.slice(1)}.png`,`eyes-${expression}.webp`,512,true);
for(const mouth of MOUTHS)image(`Mouths/Mouth_${mouth[0].toUpperCase()+mouth.slice(1)}.png`,`mouth-${mouth}.webp`,512,true);
await Promise.all(jobs);
const files=await Promise.all(MAGE_CAT_FILES.map(async name=>({name,bytes:(await fs.stat(path.join(output,name))).size})));
const report={author:'Nekueda',sourceBytes:raw.length,modelBytes:binary.byteLength,meshes,triangles,lods:[0,1,2],clips:clips.map(c=>({name:c.name,seconds:c.duration,tracks:c.tracks.length})),files,totalBytes:files.reduce((a,f)=>a+f.bytes,0)};
await fs.writeFile(path.join(source,'conversion-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({modelBytes:report.modelBytes,totalBytes:report.totalBytes,meshes,triangles,animationCount:clips.length,files:files.length}));
