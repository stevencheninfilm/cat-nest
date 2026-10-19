// Prepare generated atlases and room edits; never change the original scenes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {PREMIUM_RESTAURANT_THEMES,PREMIUM_SCENE_PATCHES} from '../src/restaurant-premium-decorations.js';
const sharp=createRequire(import.meta.url)('/Users/stevenchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const records=JSON.parse(await fs.readFile(path.join(root,'artifacts/restaurant-themed-decor/generation-records.json'),'utf8'));
const output=path.join(root,'public/assets/restaurant/premium-themed-v1');
const manifest={version:1,canvas:{width:940,height:1672},sets:{}};
// Atlases can contain a few pixels from a neighboring cell. Crop around the
// largest connected silhouette while keeping detached details inside its bounds.
async function subjectCrop(input){
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let largest=null;
  for(let start=0;start<w*h;start++){
    if(seen[start]||data[start*4+3]<48)continue;
    let read=0,write=1,left=w,top=h,right=0,bottom=0;queue[0]=start;seen[start]=1;
    while(read<write){const at=queue[read++],x=at%w,y=Math.floor(at/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of [x>0?at-1:-1,x<w-1?at+1:-1,y>0?at-w:-1,y<h-1?at+w:-1])if(next>=0&&!seen[next]&&data[next*4+3]>=48){seen[next]=1;queue[write++]=next;}
    }
    if(!largest||write>largest.count)largest={count:write,left,top,right,bottom};
  }
  if(!largest)throw Error('Generated sprite has no opaque subject');
  const left=Math.max(0,largest.left-8),top=Math.max(0,largest.top-8),right=Math.min(w-1,largest.right+8),bottom=Math.min(h-1,largest.bottom+8);
  return sharp(input).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
}
await fs.mkdir(output,{recursive:true});
for(const record of records){
  const dir=path.join(output,record.id);await fs.mkdir(path.join(dir,'integrated'),{recursive:true});
  const pack=manifest.sets[record.id]={name:record.name,style:record.style,tool:'built-in image_gen',icons:{},patches:{}};
  const {width,height}=await sharp(record.path).metadata();
  for(const [i,theme] of PREMIUM_RESTAURANT_THEMES.entries()){
    const column=i%3,row=Math.floor(i/3),left=Math.round(column*width/3),top=Math.round(row*height/3);
    const extracted=await sharp(record.path).extract({left,top,width:Math.round((column+1)*width/3)-left,height:Math.round((row+1)*height/3)-top}).png().toBuffer();
    const trimmed=await subjectCrop(extracted);
    const tile=await sharp(trimmed).resize(472,472,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
    await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input:tile.data,left:Math.round((512-tile.info.width)/2),top:492-tile.info.height}]).webp({quality:92,alphaQuality:100}).toFile(path.join(dir,`${theme.id}.webp`));
    pack.icons[theme.id]={file:`${record.id}/${theme.id}.webp`,source:record.path,width:512,height:512,alpha:true};
  }
  if(record.integration){
    const resized=await sharp(record.integration).resize(940,1672,{fit:'fill'}).png().toBuffer();
    const composites=[];
    for(const [id,bounds] of Object.entries(PREMIUM_SCENE_PATCHES)){
      const {width:w,height:h,left,top}=bounds;
      const alpha=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const edge=Math.min(left===0?7:x,w-1-x,y,h-1-y),a=Math.round(255*Math.min(1,Math.max(0,edge/7))),offset=(y*w+x)*4;
        alpha[offset]=alpha[offset+1]=alpha[offset+2]=255;alpha[offset+3]=a;
      }
      const override=record.patchSources?.[id];
      const crop=override?await sharp(override).resize(w,h,{fit:'fill'}).png().toBuffer():await sharp(resized).extract({left,top,width:w,height:h}).png().toBuffer();
      const file=`${record.id}/integrated/${id}.webp`;
      await sharp(crop).ensureAlpha().composite([{input:alpha,raw:{width:w,height:h,channels:4},blend:'dest-in'}]).webp({quality:94,alphaQuality:100}).toFile(path.join(output,file));
      pack.patches[id]={file,source:override||record.integration,bounds};composites.push({input:await fs.readFile(path.join(output,file)),left,top});
    }
    const combined=await sharp(path.join(root,'public/assets/restaurant/decor',record.id,'scene.webp')).composite(composites).png().toBuffer();
    await sharp(combined).resize(470,836).png().toFile(path.join(root,'artifacts/restaurant-themed-decor',`${record.id}-room-review.png`));
  }
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${Object.keys(manifest.sets).length} themed collections.`);
