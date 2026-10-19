// Assemble unaltered live phone screenshots, joining the scrolled scene section
// once so the full kitchen is visible while fixed header/footer occur only once.
import { createRequire } from 'node:module';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RESTAURANT_DECORATIONS } from '../src/restaurant-decor.js';
import { decorationBuffLabels } from '../src/restaurant-decor-ui.js';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require('/Users/stevenchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}
const folder=path.resolve(process.argv[2]||'artifacts/restaurant-art/decor/effects');
const order=['cream-bakery','mint-greenhouse','sakura-teahouse','cream-library','mint-seaside','sakura-evening'];
const tiles=[];
for(const [index,id] of order.entries()){
  const layout=JSON.parse(await readFile(path.join(folder,`${id}-layout.json`),'utf8'));
  if(layout.before.scene!==id||layout.after.scene!==id||layout.before.scroll!==0||layout.after.scroll<=0)throw Error(`Incomplete screenshot pair: ${id}`);
  const top=await readFile(path.join(folder,`${id}-top.jpg`)),bottom=await readFile(path.join(folder,`${id}-bottom.jpg`));
  const {width,height}=await sharp(top).metadata(),cut=Math.floor(layout.before.viewport.bottom),extra=Math.round(layout.after.scroll);
  const first=await sharp(top).extract({left:0,top:0,width,height:cut}).toBuffer();
  const last=await sharp(bottom).extract({left:0,top:cut-extra,width,height:height-cut+extra}).toBuffer();
  const stitched=await sharp({create:{width,height:height+extra,channels:3,background:'#fff8e9'}}).composite([{input:first,left:0,top:0},{input:last,left:0,top:cut}]).jpeg({quality:95}).toBuffer();
  await writeFile(path.join(folder,`${id}-full.jpg`),stitched);
  const suite=RESTAURANT_DECORATIONS.find(item=>item.id===id),x=24+(index%3)*414,y=100+Math.floor(index/3)*1006;
  const label=Buffer.from(`<svg width="390" height="58"><style>text{font-family:PingFang SC,Arial,sans-serif}</style><text x="195" y="23" text-anchor="middle" font-size="19" font-weight="700" fill="#76553d">${suite.name}</text><text x="195" y="45" text-anchor="middle" font-size="12" fill="#7d8c65">${decorationBuffLabels(suite.buffs).join(' · ')}</text></svg>`);
  tiles.push({input:label,left:x,top:y},{input:stitched,left:x,top:y+60});
}
const title=Buffer.from('<svg width="1266" height="85"><style>text{font-family:PingFang SC,Arial,sans-serif}</style><text x="633" y="38" text-anchor="middle" font-size="28" font-weight="700" fill="#76553d">猫猫餐厅 · 三种场景，六套装扮</text><text x="633" y="65" text-anchor="middle" font-size="14" fill="#9a8568">共享本地预览实机截图 · 手机全景拼接 · 含已安置道具与营业中的猫猫</text></svg>');
await sharp({create:{width:1266,height:2122,channels:3,background:'#f3eddc'}}).composite([{input:title,left:0,top:8},...tiles]).jpeg({quality:94}).toFile(path.join(folder,'six-scenes-review.jpg'));
console.log(path.join(folder,'six-scenes-review.jpg'));
