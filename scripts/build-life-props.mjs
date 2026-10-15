import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createYarnModel,createGiftModel,createPaperCupModel,disposeLifeModel} from '../src/nest-life-props.js';

globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const folder=new URL('../public/assets/nest-life/v1/',import.meta.url);await mkdir(folder,{recursive:true});
for(const [name,create]of Object.entries({yarn:createYarnModel,gift:createGiftModel,cup:createPaperCupModel})) {
  const model=create(),bytes=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:false});
  await writeFile(new URL(`${name}.glb`,folder),Buffer.from(bytes));disposeLifeModel(model);
  console.log(`${name}.glb: ${bytes.byteLength.toLocaleString()} bytes`);
}
