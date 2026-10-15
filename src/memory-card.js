import { MEMORY_ATLAS_URL, MEMORY_PHOTOS, memoryDate, memoryPresentation } from './memory-journal-ui.js';

function rounded(ctx,x,y,w,h,r) { ctx.beginPath();ctx.roundRect(x,y,w,h,r); }
export function wrapMemoryText(ctx,text,width) {
  const lines=[];let line='';
  for(const c of [...text]){if(c==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+c).width>width){lines.push(line);line=c;}else line+=c;}
  if(line)lines.push(line);return lines;
}
function loadPhoto() {
  return new Promise((resolve,reject)=>{
    const image=new Image(),timer=setTimeout(()=>{image.src='';reject(new Error('纪念插画加载有点慢，请稍后重试'));},15_000);
    image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(new Error('暂时没能装好纪念插画，请重试'));};image.src=MEMORY_ATLAS_URL;
  });
}
/** Real, downloadable PNG; no upload, room ID, or private share link is needed. */
export async function createMemoryCard(e) {
  await document.fonts?.ready;
  const photo=await loadPhoto(),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('这个浏览器暂时无法生成图片');
  const p=memoryPresentation(e),colors={honey:['#fff8e9','#e9bf79'],sage:['#f2f5eb','#a5b397'],rose:['#fff1f1','#dca3ac'],lavender:['#f7f0fc','#bba9d1']},[paper,accent]=colors[p.tone];
  ctx.fillStyle=paper;ctx.fillRect(0,0,1080,1440);
  ctx.strokeStyle='#dfd1bd';ctx.lineWidth=2;rounded(ctx,36,36,1008,1368,44);ctx.stroke();
  ctx.fillStyle='#9e8773';ctx.font='500 22px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText('OUR LITTLE MOMENTS',540,104);
  ctx.fillStyle='#765942';ctx.font='600 32px system-ui, sans-serif';ctx.fillText(`${e.catName} · 成长日记`,540,160);
  ctx.save();rounded(ctx,86,204,908,800,26);ctx.clip();
  const [col,row]=MEMORY_PHOTOS[e.photo]||MEMORY_PHOTOS.happy,w=photo.naturalWidth/3,h=photo.naturalHeight/2,crop=h*800/908;
  ctx.drawImage(photo,col*w,row*h+(h-crop)/2,w,crop,86,204,908,800);ctx.restore();
  ctx.fillStyle=accent;rounded(ctx,114,940,220,42,21);ctx.fill();ctx.fillStyle='#624b39';ctx.font='600 20px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText(p.label,224,968);
  ctx.textAlign='left';ctx.fillStyle='#77573e';ctx.font='700 42px system-ui, sans-serif';
  const title=wrapMemoryText(ctx,p.title,890);let y=1080;
  for(const line of title){ctx.fillText(line,94,y);y+=56;}
  ctx.fillStyle='#9c8069';let size=26,lines;
  do{ctx.font=`${size}px system-ui, sans-serif`;lines=wrapMemoryText(ctx,p.description,880);if(y+15+lines.length*(size+12)<=1280)break;size-=1;}while(size>15);
  for(const line of lines){ctx.fillText(line,94,y+15);y+=size+12;}
  ctx.strokeStyle='#dfd1bd';ctx.beginPath();ctx.moveTo(94,1300);ctx.lineTo(986,1300);ctx.stroke();
  ctx.font='23px system-ui, sans-serif';ctx.fillStyle='#9c8069';ctx.fillText(memoryDate(e.at),94,1347);ctx.textAlign='right';ctx.fillText(p.participants,986,1347);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片暂时无法保存，请重试')),'image/png'));
}
