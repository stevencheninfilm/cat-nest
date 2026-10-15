import { WORLD_BOUNDS, WORLD_OBJECTS, ROBOT_HOME, ROBOT_APPROACH, findWorldPath, walkable } from './world-layout.js';

export const NEST_LEVELS = Object.freeze([
  { level:1, name:'暖心角落', cost:0, slots:7, detail:'把喜欢的小物，慢慢放进共同的家。' },
  { level:2, name:'星光小窝', cost:280, slots:10, detail:'点亮星光灯串，解锁地毯和故事书架。' },
  { level:3, name:'我们的家', cost:650, slots:12, detail:'挂上双人纪念牌，收藏一起走过的日子。' },
]);
export const NEST_PALETTES = Object.freeze([
  { id:'honey', name:'奶油暖木', wall:'#edcda9', floor:'#ca9d75', trim:'#ae7953', fabric:'#ddb1ac', cream:'#fff0d3', accent:'#dba65f' },
  { id:'mint', name:'薄荷森林', wall:'#dbe5cc', floor:'#b5b795', trim:'#7d9578', fabric:'#abc8ad', cream:'#fff5dc', accent:'#80a48d' },
  { id:'lilac', name:'星夜薰衣草', wall:'#d9d0e4', floor:'#b7a5b5', trim:'#8e7f9e', fabric:'#b9a8d0', cream:'#f8eddf', accent:'#a091bc' },
  { id:'peach', name:'蜜桃日落', wall:'#f0d1bd', floor:'#d4a482', trim:'#b98271', fabric:'#e7ada1', cream:'#fff1df', accent:'#d69a87' },
]);
const base = {console:{care:'play',icon:'♫',purpose:'弹弹小琴键，陪猫猫玩一会'},bed:{care:'sleep',icon:'☾',purpose:'在软床边休息，恢复活力'},charger:{icon:'☼',purpose:'点亮小夜灯，留一盏暖光'},sofa:{care:'pet',icon:'☁',purpose:'蹭蹭抱枕，收到一次温柔摸摸'},toy:{care:'play',icon:'✦',purpose:'追追小球，开心玩耍'}};
export const NEST_ITEMS = Object.freeze([
  ...WORLD_OBJECTS.filter(o=>base[o.id]).map(o=>({id:o.id,name:o.home,width:o.width,depth:o.depth,level:1,cost:0,base:true,blocks:true,...base[o.id]})),
  {id:'cushion',name:'云朵软垫',width:.8,depth:.8,level:1,cost:100,blocks:true,care:'sleep',icon:'☁',purpose:'在软垫边打个盹，恢复活力'},
  {id:'scratch',name:'猫爪抓柱',width:.75,depth:.75,level:1,cost:160,blocks:true,care:'play',icon:'♧',purpose:'伸伸爪，玩一次抓柱小游戏'},
  {id:'plant',name:'薄荷盆栽',width:.65,depth:.65,level:1,cost:120,blocks:true,icon:'❧',purpose:'闻闻叶子，给小窝添一点绿意'},
  {id:'rug',name:'星月地毯',width:2,depth:1.5,level:2,cost:180,blocks:false,icon:'☽',purpose:'留一块柔软的地面，让猫猫自由走过'},
  {id:'bookshelf',name:'故事书架',width:1.1,depth:.6,level:2,cost:260,blocks:true,care:'pet',icon:'▥',purpose:'陪猫猫听个故事，收到一次温柔摸摸'},
  {id:'memory',name:'双人纪念架',width:.85,depth:.6,level:3,cost:360,blocks:true,icon:'♡',purpose:'收藏两个人的陪伴，看小猫留下爪印'},
].map(Object.freeze));
const plain = v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact = (v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const finite = n=>Number.isFinite(n)&&Math.abs(n)<100;
export const nestItem = id=>NEST_ITEMS.find(item=>item.id===id)||null;
export const nestLevel = level=>NEST_LEVELS.find(item=>item.level===level)||NEST_LEVELS[0];
export const nestPalette = id=>NEST_PALETTES.find(item=>item.id===id)||NEST_PALETTES[0];
export const NEST_SPAWN = Object.freeze({x:0,z:1.4});
export function emptyNest() {
  return {version:1,level:1,palette:'honey',owned:NEST_ITEMS.filter(i=>i.base).map(i=>i.id),placements:WORLD_OBJECTS.filter(i=>base[i.id]).map(i=>({item:i.id,x:i.x,z:i.z,rotation:0})),revision:0,lastEdit:null};
}
export function nestObjects(nest) {
  return nest.placements.map(p=>{const item=nestItem(p.item),odd=p.rotation%2;return {...item,...p,id:p.item,home:item.name,station:item.name,width:odd?item.depth:item.width,depth:odd?item.width:item.depth};});
}
export function nestObstacles(nest) { return [...nestObjects(nest).filter(i=>i.blocks),{...ROBOT_HOME,width:.85,depth:.85}]; }
export function nestApproach(nest,id,start=NEST_SPAWN) {
  const item=nestObjects(nest).find(i=>i.id===id);if(!item)return null;
  const obstacles=nestObstacles(nest),legacy=WORLD_OBJECTS.find(i=>i.id===id);
  const candidates=[];
  if(legacy){const dx=legacy.approach.x-legacy.x,dz=legacy.approach.z-legacy.z,a=item.rotation*Math.PI/2;candidates.push({x:item.x+dx*Math.cos(a)+dz*Math.sin(a),z:item.z-dx*Math.sin(a)+dz*Math.cos(a)});}
  const w=item.width/2+.48,d=item.depth/2+.48;
  for(const [dx,dz]of [[0,d],[-w,0],[w,0],[0,-d],[-w,d],[w,d],[-w,-d],[w,-d]])candidates.push({x:item.x+dx,z:item.z+dz});
  return candidates.find(p=>walkable(p,.22,obstacles)&&findWorldPath(start,p,obstacles))||null;
}
function geometryReason(nest) {
  const items=nestObjects(nest);
  if(items.length>nestLevel(nest.level).slots)return '这一阶段的小窝已经放满啦，先收纳一件或升级小窝。';
  for(const item of items) {
    if(item.x-item.width/2<WORLD_BOUNDS.minX||item.x+item.width/2>WORLD_BOUNDS.maxX||item.z-item.depth/2<WORLD_BOUNDS.minZ||item.z+item.depth/2>WORLD_BOUNDS.maxZ)return '家具要完整放在房间里。';
    if(!item.blocks)continue;
    for(const point of [NEST_SPAWN,ROBOT_HOME,ROBOT_APPROACH,{x:1.35,z:-2.65}])if(Math.abs(item.x-point.x)<item.width/2+.35&&Math.abs(item.z-point.z)<item.depth/2+.35)return '给猫猫、团团和门口留一点通路吧。';
    for(const other of items)if(other.id!==item.id&&other.blocks&&Math.abs(item.x-other.x)<(item.width+other.width)/2+.06&&Math.abs(item.z-other.z)<(item.depth+other.depth)/2+.06)return '这里和另一件家具重叠了，换个位置试试。';
  }
  return null;
}
export function placementResult(nest,item,pose,{paths=true}={}) {
  if(!nestItem(item)||!nest.owned.includes(item))return {ok:false,reason:'先收藏这件家具，再把它放进小窝。'};
  if(!exact(pose,['x','z','rotation'])||!finite(pose.x)||!finite(pose.z)||!Number.isInteger(pose.rotation)||pose.rotation<0||pose.rotation>3)return {ok:false,reason:'这个摆放位置无效。'};
  const next={...nest,placements:[...nest.placements.filter(p=>p.item!==item),{item,...pose}]};
  let reason=geometryReason(next);
  if(!reason&&paths) {
    const obstacles=nestObstacles(next);
    if(!findWorldPath(NEST_SPAWN,ROBOT_APPROACH,obstacles)||!findWorldPath(NEST_SPAWN,{x:1.35,z:-2.65},obstacles)||nestObjects(next).some(i=>i.blocks&&!nestApproach(next,i.id)))reason='这个位置会挡住通路，猫猫需要走到家具旁边。';
  }
  return reason?{ok:false,reason}:{ok:true,nest:next};
}
export function suggestNestPlacement(nest,item) {
  const points=nestItem(item)?.blocks?[[3,2.5],[-1.25,2.5],[0,0],[-1,-1],[1.25,1]]:[[0,.5],[0,0]];
  for(let z=-2.5;z<=2.5;z+=.5)for(let x=-3;x<=3;x+=.5)points.push([x,z]);
  for(const [x,z]of points){const pose={x,z,rotation:0};if(placementResult(nest,item,pose,{paths:false}).ok&&placementResult(nest,item,pose).ok)return pose;}
  return null;
}
export function validNest(value) {
  if(!exact(value,['version','level','palette','owned','placements','revision','lastEdit'])||value.version!==1||!NEST_LEVELS.some(i=>i.level===value.level)||!NEST_PALETTES.some(i=>i.id===value.palette)||!Number.isSafeInteger(value.revision)||value.revision<0)return false;
  if(!Array.isArray(value.owned)||value.owned.length>NEST_ITEMS.length||new Set(value.owned).size!==value.owned.length||!NEST_ITEMS.filter(i=>i.base).every(i=>value.owned.includes(i.id))||value.owned.some(id=>!nestItem(id)||nestItem(id).level>value.level))return false;
  if(!Array.isArray(value.placements)||new Set(value.placements.map(p=>p?.item)).size!==value.placements.length||value.placements.some(p=>!exact(p,['item','x','z','rotation'])||!value.owned.includes(p.item)||!finite(p.x)||!finite(p.z)||!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3))return false;
  if(value.lastEdit!==null&&(!exact(value.lastEdit,['actor','actorId','at','text'])||typeof value.lastEdit.actor!=='string'||value.lastEdit.actor.length>20||/[\u0000-\u001f\u007f]/.test(value.lastEdit.actor)||typeof value.lastEdit.actorId!=='string'||!/^[a-zA-Z0-9_-]{6,80}$/.test(value.lastEdit.actorId)||!Number.isSafeInteger(value.lastEdit.at)||value.lastEdit.at<0||typeof value.lastEdit.text!=='string'||value.lastEdit.text.length>100))return false;
  return !geometryReason(value);
}
export function normalizeNest(value) { return validNest(value)?structuredClone(value):emptyNest(); }
export function sanitizeNestAction(value) {
  if(!plain(value))return null;
  if(['nest-buy','nest-store'].includes(value.type)&&exact(value,['type','item'])&&nestItem(value.item))return {...value};
  if(value.type==='nest-place'&&exact(value,['type','item','x','z','rotation'])&&nestItem(value.item)&&finite(value.x)&&finite(value.z)&&Number.isInteger(value.rotation)&&value.rotation>=0&&value.rotation<=3)return {...value};
  if(value.type==='nest-palette'&&exact(value,['type','palette'])&&NEST_PALETTES.some(i=>i.id===value.palette))return {...value};
  if(value.type==='nest-upgrade'&&exact(value,['type','level'])&&NEST_LEVELS.some(i=>i.level===value.level&&i.level>1))return {...value};
  return null;
}
export function nestActionResult(state,action,actor={name:'猫友',id:'local-care'},now=Date.now()) {
  if(!sanitizeNestAction(action))return {ok:false,reason:'这项布置操作无效。'};
  let nest=normalizeNest(state.nest),coins=state.coins,text;const item=nestItem(action.item);
  if(action.type==='nest-buy') {
    if(nest.owned.includes(item.id))return {ok:false,reason:'已经收藏这件小物啦。'};
    if(nest.level<item.level)return {ok:false,reason:`升级到${nestLevel(item.level).name}后就能收藏。`};
    if(coins<item.cost)return {ok:false,reason:`还差 ${item.cost-coins} 猫爪币，陪猫猫玩耍慢慢攒吧。`};
    coins-=item.cost;nest.owned.push(item.id);text=`收藏了${item.name}`;
  }else if(action.type==='nest-place') {
    const result=placementResult(nest,item.id,{x:action.x,z:action.z,rotation:action.rotation});if(!result.ok)return result;
    nest=result.nest;text=`摆好了${item.name}`;
  }else if(action.type==='nest-store') {
    if(!nest.placements.some(p=>p.item===item.id))return {ok:false,reason:'这件家具已经收纳好了。'};
    nest.placements=nest.placements.filter(p=>p.item!==item.id);text=`收纳了${item.name}`;
  }else if(action.type==='nest-palette') {
    if(action.palette===nest.palette)return {ok:false,reason:'小窝已经是这个配色啦。'};
    nest.palette=action.palette;text=`把小窝换成了${nestPalette(action.palette).name}`;
  }else {
    if(action.level!==nest.level+1)return {ok:false,reason:'按顺序慢慢把小窝升起来吧。'};
    const target=nestLevel(action.level);if(coins<target.cost)return {ok:false,reason:`升级还差 ${target.cost-coins} 猫爪币。`};
    coins-=target.cost;nest.level=target.level;text=`一起把小窝升级为${target.name}`;
  }
  if(nest.revision>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'暂时无法更新这份布置。'};
  nest.revision++;nest.lastEdit={actor:String(actor.name||'猫友').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,20),actorId:actor.id||'local-care',at:now,text};
  return {ok:true,nest,coins,text};
}
export function validFurnitureCare(action) { return Boolean(nestItem(action?.furniture)?.care===action?.type&&nestItem(action?.furniture)?.care); }
