import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// ImageGen supplies the artwork; this only crops, scales and packs its alpha.
const require=createRequire(import.meta.url);
let sharp;
try{sharp=require('sharp');}catch{sharp=require('/Users/stevenchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}
const source=process.argv[2];
if(!source)throw new Error('Pass the transparent ImageGen front/back sheet.');
const root=fileURLToPath(new URL('../',import.meta.url));
const art=`${root}public/assets/restaurant/`,archive=`${root}artifacts/restaurant-art/staff-milky-v1/`;
await fs.mkdir(archive,{recursive:true});
await fs.copyFile(source,`${archive}source.png`);
const meta=await sharp(source).metadata();
if(!meta.hasAlpha)throw new Error('The generated source must have true alpha.');
const pair=[];
for(let side=0;side<2;side++){
  const left=Math.round(side*meta.width/2),width=Math.round((side+1)*meta.width/2)-left;
  const {data,info}=await sharp(source).extract({left,top:0,width,height:meta.height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=width,y0=meta.height,x1=-1,y1=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<0)throw new Error('Empty character view.');
  pair.push({data,info,box:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}});
}
const scale=Math.min(224/Math.max(...pair.map(c=>c.box.width)),224/Math.max(...pair.map(c=>c.box.height))),tiles=[];
for(const [row,cell] of pair.entries()){
  const width=Math.round(cell.box.width*scale),height=Math.round(cell.box.height*scale);
  const input=await sharp(cell.data,{raw:cell.info}).extract(cell.box).resize(width,height).png().toBuffer();
  const tile=await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}}).composite([{input,left:Math.round((256-width)/2),top:240-height}]).webp({lossless:true}).toBuffer();
  await fs.writeFile(`${art}characters/staff-milky${row?'-back':''}.webp`,tile);
  tiles.push(tile);
}
await sharp({create:{width:256,height:512,channels:4,background:'#00000000'}}).composite(tiles.map((input,row)=>({input,left:0,top:row*256}))).webp({lossless:true}).toFile(`${art}staff-milky-v1.webp`);
await sharp({create:{width:768,height:256,channels:4,background:'#fff8e8'}}).composite([{input:await fs.readFile(`${art}characters/chef.webp`),left:0,top:0},...tiles.map((input,i)=>({input,left:(i+1)*256,top:0}))]).png().toFile(`${archive}comparison.png`);
const manifest=JSON.parse(await fs.readFile(`${art}sprites.json`,'utf8'));
manifest.staffMilkyAtlas={path:'/assets/restaurant/staff-milky-v1.webp',width:256,height:512,cols:1,rows:2,cellWidth:256,cellHeight:256};
for(let row=0;row<2;row++){
  const id=`staff-milky${row?'-back':''}`;
  manifest.characters[id]={x:0,y:row*256,width:256,height:256,col:0,row,atlas:'staff-milky-v1.webp',path:`/assets/restaurant/characters/${id}.webp`,anchor:{x:.5,y:.9375}};
}
await fs.writeFile(`${art}sprites.json`,JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared Milky front/back tiles, transparent atlas, metadata and chef comparison.');
