import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const sharp=require('/Users/stevenchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const generated='/Users/stevenchen/.codex/generated_images/01a14df7-7763-7211-a943-2bc65c48e469';
const crewSource=path.join(generated,'exec-5960f3a7-0238-442c-9170-3a65a3d429fc.png');
const propsSource=path.join(generated,'exec-4471bc5a-d66d-4238-b0af-fb3707506d61.png');
const destination=path.join(root,'public/assets/restaurant/decor');
const sets=['cream-bakery','cream-library','mint-greenhouse','mint-seaside','sakura-teahouse','sakura-evening'];
const crew=['builder-orange','builder-orange-back','builder-gray','builder-gray-back'];
const propNames=['window','wall','counter'];
const metadata={version:1,tool:'built-in image_gen',cellSize:256,crew:{},sets:{}};

async function cell(source,col,row,cols,rows,size=256){
  const {width,height}=await sharp(source).metadata();
  const left=Math.round(col*width/cols),top=Math.round(row*height/rows);
  const extracted=await sharp(source).extract({left,top,width:Math.round((col+1)*width/cols)-left,height:Math.round((row+1)*height/rows)-top}).toBuffer();
  const tile=await sharp(extracted).trim({background:'#00000000',threshold:8}).toBuffer();
  const resized=await sharp(tile).resize({width:size-32,height:size-32,fit:'inside'}).toBuffer({resolveWithObject:true});
  return sharp({create:{width:size,height:size,channels:4,background:'#00000000'}}).composite([{input:resized.data,left:Math.round((size-resized.info.width)/2),top:size-16-resized.info.height}]).png().toBuffer();
}
await fs.mkdir(path.join(destination,'crew'),{recursive:true});
await fs.mkdir(path.join(root,'artifacts/restaurant-art/decor'),{recursive:true});
await fs.copyFile(crewSource,path.join(root,'artifacts/restaurant-art/decor/crew-source.png'));
await fs.copyFile(propsSource,path.join(root,'artifacts/restaurant-art/decor/props-source.png'));
const crewCells=[];
for(const [i,id] of crew.entries()){
  const tile=await cell(crewSource,i%2,Math.floor(i/2),2,2);
  await sharp(tile).webp({quality:90,alphaQuality:100}).toFile(path.join(destination,'crew',`${id}.webp`));
  crewCells.push({input:tile,left:i%2*256,top:Math.floor(i/2)*256});
  metadata.crew[id]={file:`crew/${id}.webp`,anchor:{x:.5,y:.9375}};
}
await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite(crewCells).webp({quality:90,alphaQuality:100}).toFile(path.join(destination,'crew/atlas.webp'));
for(const [column,id] of sets.entries()){
  await fs.mkdir(path.join(destination,id),{recursive:true});
  const props=[];
  for(const [row,name] of propNames.entries()){
    const tile=await cell(propsSource,column,row,6,3);
    await sharp(tile).webp({quality:90,alphaQuality:100}).toFile(path.join(destination,id,`${name}.webp`));
    props.push({id:name,file:`${name}.webp`,...([{x:12,y:24,width:9},{x:91,y:45,width:11},{x:88,y:78,width:9}][row]),anchor:{x:.5,y:.9375}});
  }
  metadata.sets[id]={scene:`${id}/scene.webp`,props};
}
await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Prepared 18 transparent decorations and 2 construction cats with front/back sprites.');
