import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { RESTAURANT_GUESTS } from '../src/restaurant-customers.js';
import { RESTAURANT_EXTRA_CUSTOMER_ROWS } from '../src/restaurant-customer-expansion.js';

const require=createRequire(import.meta.url);
let sharp;
try{sharp=require('sharp');}catch{sharp=require('/Users/stevenchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}
const args=process.argv.slice(2),setIndex=args.indexOf('--set');
const assetSet=setIndex>=0?args.splice(setIndex,2)[1]:'guests-v1';
if(!['guests-v1','guests-v2','guests-v3'].includes(assetSet))throw new Error('Unknown customer asset set');
const sources=args;
const packs=assetSet==='guests-v3'?1:3,rows=packs*2;
if(sources.length!==packs)throw new Error(`Pass ${packs} ImageGen 4-column × 2-row customer sheets.`);
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=path.join(root,'public/assets/restaurant',assetSet);
const originals=path.join(root,'artifacts/restaurant-art',assetSet);
await fs.mkdir(destination,{recursive:true});await fs.mkdir(originals,{recursive:true});
const customers=assetSet==='guests-v3'?RESTAURANT_EXTRA_CUSTOMER_ROWS.map(([suffix,name],atlasIndex)=>({id:`guest-${suffix}`,name,atlasIndex})):RESTAURANT_GUESTS.filter(guest=>guest.atlasSet===assetSet),tiles=[];
const manifest={version:1,tool:'built-in image_gen',atlas:{file:'atlas.webp',width:1024,height:256*rows,columns:4,rows,cellSize:256},customers:{}};

async function rowDivider(source){
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bands=[];let start=null;
  for(let y=Math.floor(info.height*.36);y<info.height*.66;y++){
    let occupied=false;for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>24){occupied=true;break;}
    if(!occupied)start??=y;
    else if(start!==null){if(y-start>=4)bands.push([start,y]);start=null;}
  }
  bands.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
  if(!bands.length)throw new Error(`The two sprite rows overlap: ${source}`);
  return Math.round((bands[0][0]+bands[0][1])/2);
}
async function boundedCell(source,column,row,divider){
  const meta=await sharp(source).metadata();
  if(!meta.hasAlpha)throw new Error(`Transparent source required: ${source}`);
  const left=Math.round(column*meta.width/4),top=row?divider:0;
  const width=Math.round((column+1)*meta.width/4)-left,height=(row?meta.height:divider)-top;
  const {data,info}=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=width,y0=height,x1=-1,y1=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<0)throw new Error('Empty character cell');
  return {data,info,box:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}};
}
for(const [pack,source] of sources.entries()){
  await fs.copyFile(source,path.join(originals,`source-${pack+1}.png`));
  const divider=await rowDivider(source);
  for(let col=0;col<4;col++){
    const guest=customers[pack*4+col],pair=await Promise.all([0,1].map(row=>boundedCell(source,col,row,divider)));
    const scale=Math.min(224/Math.max(...pair.map(cell=>cell.box.width)),224/Math.max(...pair.map(cell=>cell.box.height)));
    for(let row=0;row<2;row++){
      const cell=pair[row],width=Math.round(cell.box.width*scale),height=Math.round(cell.box.height*scale);
      const resized=await sharp(cell.data,{raw:cell.info}).extract(cell.box).resize(width,height).png().toBuffer();
      const tile=await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}}).composite([{input:resized,left:Math.round((256-width)/2),top:240-height}]).webp({quality:90,alphaQuality:100}).toBuffer();
      const file=`${guest.id}${row?'-back':''}.webp`;
      await fs.writeFile(path.join(destination,file),tile);
      tiles.push({input:tile,left:col*256,top:(pack*2+row)*256});
    }
    manifest.customers[guest.id]={name:guest.name,column:col,row:pack*2,backRow:pack*2+1,front:`${guest.id}.webp`,back:`${guest.id}-back.webp`,anchor:{x:.5,y:.9375}};
  }
}
await sharp({create:{width:1024,height:256*rows,channels:4,background:'#00000000'}}).composite(tiles).webp({quality:90,alphaQuality:100}).toFile(path.join(destination,'atlas.webp'));
await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${customers.length} customer pairs and one transparent atlas.`);
