import { COLLECTION_CATS, collectionCatProgress } from './cat-collection.js';
import { GAME_CAT_POSES } from './catbook-game-sprites.js';
import { ACHIEVEMENT_CAT_POSES } from './catbook-achievement-sprites.js';
import { REFERENCE_CAT_POSES } from './catbook-reference-sprites.js';
import { REFERENCE_CAT_DEFINITIONS } from './catbook-reference-cats.js';
export const DEFAULT_CAT_SCENE='station';
// Scene sprites use rounded reference poses; original cats keep their pixel portraits.
// Tight source rectangles avoid neighbouring sprites bleeding across generated atlas cells.
const atlasWidth = 1448, atlasHeight = 1086, padding = 4;
const pose = (name, motion, bounds) => {
  const [left, top, right, bottom] = bounds;
  const x = left - padding, y = top - padding;
  const width = right - left + padding * 2, height = bottom - top + padding * 2;
  return Object.freeze({ name, motion, ratio:`${width} / ${height}`,
    baseline:(height - padding) / height * 100,
    backgroundSize:`${atlasWidth / width * 100}% ${atlasHeight / height * 100}%`,
    backgroundPosition:`${x / (atlasWidth - width) * 100}% ${y / (atlasHeight - height) * 100}%` });
};
export const SCENE_CAT_POSES = Object.freeze([
  pose('蜷着尾巴睡觉', 'sleep', [64,189,341,361]),
  pose('揣着小爪打盹', 'loaf', [424,197,686,359]),
  pose('枕着爪爪趴卧', 'rest', [762,224,1060,367]),
  pose('背对着挠挠爪', 'scratch', [1145,95,1388,373]),
  pose('探出脑袋张望', 'peek', [103,518,296,666]),
  pose('伸爪拨弄毛线球', 'play', [417,450,702,677]),
  pose('低头认真吃饭', 'eat', [778,463,1039,683]),
  pose('坐着静静看风景', 'sit', [1151,441,1366,679]),
  pose('翻着肚皮玩球', 'roll', [59,799,361,1002]),
  pose('翘着尾巴看风景', 'watch', [458,742,678,997]),
  pose('团成一团午睡', 'sleep', [768,832,1034,1003]),
  pose('舒舒服服伸懒腰', 'stretch', [1127,741,1386,1006]),
]);
const spot = (x, y, size, surface, options = {}) => Object.freeze({ x, y, size, surface, ...options });
// Reference station cats share roughly 3–3.6% world-width heads. Resting and
// walking silhouettes have different crops, so calibrate their widths separately.
const stationSpot=(x,y,size,walkSize,surface,options={})=>spot(x,y,size,surface,{walkSize,...options});
const referenceSlots=rows=>Object.freeze(Object.fromEntries(rows.flatMap((row,index)=>row ? [[REFERENCE_CAT_DEFINITIONS[index].id,spot(...row)]] : [])));
const referenceSceneSlots={
  station:referenceSlots([
    [21,82.5,4.3,'车站前的小路上',{walkSize:6}],
    [18.2,68.6,3.1,'车厢前排右侧座椅上',{walkSize:6,window:[[259,625],[301,637],[301,704],[259,692]]}],
    [37.55,57.4,2.6,'车厢再右侧的车窗中间',{walkSize:6,window:[[562,514],[592,498],[592,576],[562,592]]}],
    [60.2,61,4.5,'小伞的伞面上',{walkSize:6}],
    [25.8,84.5,4.3,'冰激凌左下的小路上',{walkSize:6}],
    [66,83.5,5.7,'小伞右下的绿色草地上',{walkSize:6.4}],
    [44.8,87.5,4.7,'草坪前方的小路上',{walkSize:6}],
    [73.5,69,3.4,'灌木丛下沿',{walkSize:5.6}],
    [87.6,68.3,3.1,'蓝色小桶里',{walkSize:5.7}],
    [86.5,62,3.3,'左侧的小木箱里',{walkSize:5.8}],
    [91.3,56.6,3.3,'右侧的高木箱里',{walkSize:5.8}],
    [81.5,14.7,4.2,'烟囱顶上',{walkSize:5.8}],
  ]),
  garden:referenceSlots([
    null,[11.6,46.2,10,'橙色猫屋里',{opening:{cx:90,cy:811,rx:35,ry:33}}],
    [43.6,54,10,'左侧木制猫窝里',{opening:{cx:369,cy:960,rx:28,ry:32}}],[54.8,37.2,12,'桥下的小路上'],
    [87,84.8,12,'树桩右侧的草地上'],[53.5,29,16,'小桥上'],
    [32,64.2,15,'红色平台上'],[24,16.4,11,'树枝旁'],
    [58.5,64.5,10,'蓝色猫屋里'],[90.4,49.8,9.5,'右侧小猫窝里',{opening:{cx:780,cy:880,rx:27,ry:27}}],
    [83,72.4,10,'骰子猫窝里',{opening:{cx:704,cy:1295,rx:39,ry:44}}],[35,20.3,12,'桥边猫屋顶上'],
  ]),
  western:referenceSlots([
    [66,87,12,'露台前的空地上'],[52,39.8,10,'骰子猫窝里'],
    [33.5,45.6,9.5,'露台上的纸箱里'],[48,54.9,12,'木露台中间'],
    [48,74.8,12,'台阶旁的空地上'],[26,83.7,17,'仙人掌右边',{occluders:[[[130,1600],[130,1516],[137,1502],[144,1487],[154,1476],[165,1469],[176,1467],[187,1470],[198,1477],[207,1487],[213,1502],[216,1530],[216,1562],[195,1600]]]}],
    [48,85,14,'露台前的小路上'],[41,21.5,11,'左侧白色栏杆上'],
    [86.6,49.8,9,'右侧木制猫窝里'],[48,62,9.5,'台阶旁的小纸箱里',{prop:'box'}],
    [80,78.6,10,'三角猫屋里'],[66,21.1,11,'右上方的白色栏杆上'],
  ]),
  snow:referenceSlots([
    [48,80.5,12,'木廊下方'],
    [13.4,31.3,9,'左侧柜门后',{window:[[88,451],[139,451],[139,582],[88,582]],glass:[
      {fill:'#fcf9f1',opacity:.78,points:[[88,537],[139,495],[139,506],[88,548]]},
      {fill:'#fcf7eb',opacity:.6,points:[[88,562],[139,520],[139,582],[88,582]]},
    ]}],
    [25.4,31.3,9,'右侧柜门后',{window:[[190,453],[237,453],[237,582],[190,582]],glass:[
      {fill:'#fcf9f1',opacity:.78,points:[[190,536],[237,497],[237,508],[190,547]]},
      {fill:'#fcf7eb',opacity:.6,points:[[190,562],[237,523],[237,582],[190,582]]},
    ]}],
    [56.8,45.7,12,'小伞的伞面上'],[60,70.2,11,'木廊中间'],
    [47.5,65.5,16,'小伞前的木地板上'],[27.5,83,13,'木廊的台阶上'],
    [87,24,10,'雪树旁的灌木里'],[66,83.5,9.5,'小路边的蓝色桶里',{prop:'bucket'}],
    [24,59.5,9.5,'猫屋旁的小纸箱上',{prop:'box',propTop:53.5}],
    [34.5,30.5,8.8,'柜子旁的小箱子里',{prop:'box'}],
    [47.2,33.2,11,'木廊旁的墙面上',{name:'贴着墙静静守望'}],
  ]),
};
export const CAT_SCENES = Object.freeze([
  { id:'station', asset:'station-large-v1', name:'猫猫车站', subtitle:'第一座大庭院，左右探索小镇', min:0, icon:'train', ratio:'1536 / 1024', slots:[
    stationSpot(28,47.7,4.8,6.7,'电车车顶上'), stationSpot(41.2,38.5,4.9,6.3,'电车高台上'),
    stationSpot(77,24.6,5.4,6,'红屋顶上'), stationSpot(81.4,65,5.2,6.2,'灯柱旁'),
    stationSpot(15.2,67.3,3.1,6.1,'车厢前排椅子上',{window:[[207,610],[250,623],[250,692],[207,679]]}), stationSpot(44.3,80.3,6.5,7,'草坪上',{toy:true}),
    stationSpot(49.5,73,6.4,6.9,'点心角'), stationSpot(27.3,65.8,4,6,'车厢里的绿色座椅上',{window:[[393,609],[438,584],[438,654],[393,679]]}),
    stationSpot(54.2,77.7,6.2,7,'草坪左边的树桩上',{toy:true}), stationSpot(76,52,5,6.4,'围墙木栏上'),
    stationSpot(47.1,61.7,6,6.8,'绿色沙发上'), stationSpot(65.5,78.2,5.6,7.1,'小伞下面'),
    stationSpot(20,48.4,4.1,6.2,'电车车顶上'), stationSpot(12.5,78.2,4.8,5.9,'电车前的踏台上'),
    stationSpot(69,38.2,4.3,5.8,'红屋左侧的屋檐上'), stationSpot(38.1,83.5,4.9,6.4,'冰激凌右边的草坪上'),
    stationSpot(78.5,43.6,5,5.7,'红屋檐边',{occluders:[[[1230,390],[1278,390],[1278,465],[1230,465]]]}), stationSpot(88.5,74.5,5.4,6.1,'小水桶旁'),
    stationSpot(58.5,44,4,5.3,'围墙木栏上'), stationSpot(35,45.2,4.6,5.3,'电车车顶上'),
    stationSpot(63.2,45.4,4.3,5.3,'黄色猫猫旁的围墙木栏上'), stationSpot(60.5,87,5.1,6,'树桩右下的草地上'),
    stationSpot(91.2,34.5,4.3,5.5,'红屋露台上'), stationSpot(35.5,33.5,4.6,5.4,'电车高台上',{occluders:[
      [[566,250],[576,253],[525,329],[551,367],[543,371],[516,337],[458,323],[458,315],[516,329]],
    ]}),
  ], extraSlots:referenceSceneSlots.station },
  { id:'garden', asset:'garden-portrait', name:'日式庭院', subtitle:'十位猫友，庭院初相逢', min:10, icon:'leaf', ratio:'863 / 1823', slots:[
    spot(65.5,78,24,'树桩上'), spot(29,35.7,20,'左侧高台上'),
    spot(78,28.7,20,'最高的猫爬架上'), spot(32.5,57,12,'抓柱旁'),
    spot(75.2,39.4,10,'右侧猫窝里'), spot(23,75.8,20,'红色软台上',{ toy:true }),
    spot(56.5,68.8,20,'食盆旁'), spot(62,60.5,14,'蓝色猫屋顶上'),
    spot(43,79,18,'木廊上',{ toy:true }), spot(44.6,44.7,15,'左侧台面上'),
    spot(73.5,49,18,'右侧圆台上'), spot(83.5,67,16,'骰子猫窝顶上'),
  ], extraSlots:{onyx:spot(30,86,16,'石灯右侧的草地上'),maple:spot(69,23.2,15,'池塘中央的石头上'),...referenceSceneSlots.garden} },
  { id:'western', asset:'western-portrait', name:'西部露台', subtitle:'十五位猫友的露台小聚', min:15, icon:'sun', ratio:'863 / 1822', slots:[
    spot(52,34.5,18,'骰子猫窝顶上'), spot(66.8,49.3,18,'圆形小台上'),
    spot(76.7,25.3,20,'高处的台面上'), spot(78,60.8,11.5,'抓柱旁'),
    spot(74,35.1,10,'高处猫窝里'), spot(22,52.5,20,'露台上',{ toy:true }),
    spot(35,35.2,17,'食盆旁'), spot(61,71,12,'阶梯旁'),
    spot(33,60,20,'逗猫棒旁',{ toy:true }), spot(90,44.8,14,'右侧猫窝顶上'),
    spot(92,55.4,14,'右侧圆台上'), spot(16,69,19,'软软的猫床里'),
  ], extraSlots:referenceSceneSlots.western },
  { id:'snow', asset:'snow-portrait', name:'暖暖雪庭', subtitle:'二十位猫友，一场暖雪', min:20, icon:'snow', ratio:'863 / 1823', slots:[
    spot(58,60,21,'小伞下面'), spot(38,59,16,'小伞下面'),
    spot(70,29.5,19,'雪庭高台上'), spot(44.5,44,13,'窗边',{ motion:'stretch', name:'背对着伸个懒腰' }),
    spot(14.5,56.4,9.5,'橙色猫窝里'), spot(28,71.4,22,'红色软垫上',{ toy:true }),
    spot(85,76.7,19,'食盆旁'), spot(8,44,11,'室内木地板上'),
    spot(84,64.5,20,'雪庭小路旁',{ toy:true }), spot(82.5,39.3,12.5,'铃铛小台上'),
    spot(14.5,50.2,18,'猫窝顶上'), spot(59,36.2,13,'栏杆台面上'),
  ], extraSlots:referenceSceneSlots.snow },
].map(scene => Object.freeze({ ...scene, slots:Object.freeze(scene.slots), extraSlots:Object.freeze(scene.extraSlots || {}) })));
export function collectionSceneProgress(scene, collection, level, diary) {
  // Old invitations stay owned, but new yards require the increased care achievements.
  const current = COLLECTION_CATS.filter(cat => collection.invited.some(record => record.id === cat.id)
    && collectionCatProgress(cat, collection, level, diary).achieved).length;
  return { current, target:scene.min, complete:current >= scene.min };
}
export function collectionScene(id, collection, level, diary) {
  return CAT_SCENES.find(scene => scene.id === id && collectionSceneProgress(scene, collection, level, diary).complete) || CAT_SCENES[0];
}
const sceneSpot=(scene,cat)=>scene.extraSlots[cat.id] || scene.slots[cat.index];
export const sceneAllowsCat=(scene,cat)=>Boolean(sceneSpot(scene,cat));
export function catArrivalScene(scene,cat) {
  return sceneAllowsCat(scene,cat) ? scene : CAT_SCENES.find(option=>sceneAllowsCat(option,cat));
}
export const catPoseSprite=cat=>cat.index < 12 ? SCENE_CAT_POSES[cat.index] : cat.index < 18 ? GAME_CAT_POSES[cat.index-12] : cat.index < 24 ? ACHIEVEMENT_CAT_POSES[cat.index-18] : REFERENCE_CAT_POSES[cat.index-24];
export function sceneCatPlacement(scene, cat) {
  if(!sceneAllowsCat(scene,cat)) return null;
  const sprite = catPoseSprite(cat);
  const placement = sceneSpot(scene,cat);
  return { ...sprite, ...placement, activity:`${placement.surface}${placement.name || sprite.name}` };
}

function catArtFrame(scene,placement) {
  const [worldWidth,worldHeight]=scene.ratio.split('/').map(Number);
  const [poseWidth,poseHeight]=placement.ratio.split('/').map(Number);
  const width=worldWidth*placement.size/100, height=width*poseHeight/poseWidth;
  const left=worldWidth*placement.x/100-width/2, top=worldHeight*placement.y/100-height*placement.baseline/100;
  return {width,height,left,top};
}
/** Furniture apertures use source-map pixels and stay fixed while the cat animates. */
export function sceneCatClipPath(scene, placement) {
  if(!placement.window && !placement.opening && !placement.occluders) return null;
  const {width,height,left,top}=catArtFrame(scene,placement);
  if(placement.occluders) {
    const origin='-15% -15%';
    const outline=[origin,'115% -15%','115% 115%','-15% 115%',origin];
    // Walk to each fixed foreground contour and back over the same bridge.
    // Even-odd fill removes its interior without repainting the background.
    for(const polygon of placement.occluders) {
      const points=polygon.map(([x,y])=>`${((x-left)/width*100).toFixed(4)}% ${((y-top)/height*100).toFixed(4)}%`);
      outline.push(...points,points[0],origin);
    }
    return `polygon(evenodd,${outline.join(',')})`;
  }
  if(placement.opening) {
    const {cx,cy,rx,ry}=placement.opening;
    return `ellipse(${(rx/width*100).toFixed(4)}% ${(ry/height*100).toFixed(4)}% at ${((cx-left)/width*100).toFixed(4)}% ${((cy-top)/height*100).toFixed(4)}%)`;
  }
  return `polygon(${placement.window.map(([x,y])=>`${((x-left)/width*100).toFixed(4)}% ${((y-top)/height*100).toFixed(4)}%`).join(',')})`;
}

export function sceneCatGlassShapes(scene,placement) {
  if(!placement.glass) return [];
  const {width,height,left,top}=catArtFrame(scene,placement);
  return placement.glass.map(shape=>({fill:shape.fill,opacity:shape.opacity,points:shape.points.map(([x,y])=>`${((x-left)/width*100).toFixed(4)},${((y-top)/height*100).toFixed(4)}`).join(' ')}));
}
