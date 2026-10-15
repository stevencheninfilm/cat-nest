import { COLLECTION_CATS, collectionCatProgress } from './cat-collection.js';
import { GAME_CAT_POSES } from './catbook-game-sprites.js';
import { ACHIEVEMENT_CAT_POSES } from './catbook-achievement-sprites.js';
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
export const CAT_SCENES = Object.freeze([
  { id:'station', asset:'station-large-v1', name:'猫猫车站', subtitle:'第一座大庭院，左右探索小镇', min:0, icon:'train', ratio:'1536 / 1024', slots:[
    spot(28,47.7,6.5,'电车车顶上'), spot(41.2,38.5,6,'电车高台上'),
    spot(77,24.6,6.5,'红屋顶上'), spot(81.4,65,4,'灯柱旁'),
    spot(16.8,64.7,3.6,'电车窗边'), spot(39,76,6,'草坪上',{toy:true}),
    spot(49.5,73,5.8,'点心角'), spot(31,63.5,3.8,'电车座位上'),
    spot(58.5,79,6,'中央草坪上',{toy:true}), spot(74,48.5,4.2,'屋前露台上'),
    spot(47.1,61.7,6.2,'绿色沙发上'), spot(65.5,78.2,6.1,'小伞下面'),
    spot(20,48.4,4.8,'电车车顶上'), spot(53,78.8,4.8,'草坪入口'),
    spot(84.2,39,4.8,'红屋露台上'), spot(41,70.5,4.5,'点心柜台旁'),
    spot(89.1,61.8,5.8,'木箱上'), spot(88.5,74.5,6,'小水桶旁'),
    spot(58.5,44,4.2,'围墙木栏上'), spot(35,45.2,4.2,'电车车顶上'),
    spot(89.8,56,4.2,'高处木箱上'), spot(45,79.8,4.3,'草坪点心角'),
    spot(91.2,34.5,4.8,'红屋露台上'), spot(35.5,33.5,5.2,'电车高台上'),
  ] },
  { id:'garden', asset:'garden-portrait', name:'日式庭院', subtitle:'把小日子过成花园', min:0, icon:'leaf', ratio:'863 / 1823', slots:[
    spot(65.5,78,24,'树桩上'), spot(29,35.7,20,'左侧高台上'),
    spot(78,28.7,20,'最高的猫爬架上'), spot(32.5,57,12,'抓柱旁'),
    spot(75.2,39.4,10,'右侧猫窝里'), spot(23,75.8,20,'红色软台上',{ toy:true }),
    spot(56.5,68.8,20,'食盆旁'), spot(62,60.5,14,'蓝色猫屋顶上'),
    spot(43,79,18,'木廊上',{ toy:true }), spot(44.6,44.7,15,'左侧台面上'),
    spot(73.5,49,18,'右侧圆台上'), spot(83.5,67,16,'骰子猫窝顶上'),
    spot(39,26,10,'桥边猫屋前'), spot(11,52.4,10,'橙色猫屋旁'),
    spot(91,80,9,'木廊边'), spot(36,67.3,10,'点心碗旁'),
    spot(55.5,31.5,14,'池塘边'), spot(12,68,13,'前院草地上'),
    spot(57,39,10,'桥边小路上'), spot(24,62.5,10,'红色软台上'),
    spot(90,44.5,10,'右侧猫窝顶上'), spot(45,72,10,'木廊点心角'),
    spot(53,49.5,12,'木廊台阶旁'), spot(11,41.5,12,'橙色猫屋顶上'),
  ] },
  { id:'western', asset:'western-portrait', name:'西部露台', subtitle:'四位猫友的小聚会', min:4, icon:'sun', ratio:'863 / 1822', slots:[
    spot(52,34.5,18,'骰子猫窝顶上'), spot(66.8,49.3,18,'圆形小台上'),
    spot(76.7,25.3,20,'高处的台面上'), spot(78,60.8,11.5,'抓柱旁'),
    spot(74,35.1,10,'高处猫窝里'), spot(22,52.5,20,'露台上',{ toy:true }),
    spot(35,35.2,17,'食盆旁'), spot(61,71,12,'阶梯旁'),
    spot(33,60,20,'逗猫棒旁',{ toy:true }), spot(90,44.8,14,'右侧猫窝顶上'),
    spot(92,55.4,14,'右侧圆台上'), spot(16,69,19,'软软的猫床里'),
    spot(33.7,44.6,10,'木箱上'), spot(42,54,10,'露台中间'),
    spot(88,72.5,9,'抓柱底座旁'), spot(62,77.5,10,'点心碗旁'),
    spot(49,64,13,'阶梯上'), spot(45,79,15,'前院沙地上'),
    spot(14,43,10,'木箱旁'), spot(46,70,10,'阶梯下面'),
    spot(90,32,10,'木桶上'), spot(23,73,10,'露台点心角'),
    spot(76,67.5,12,'抓柱底座旁'), spot(20,36.5,12,'食盆木台上'),
  ] },
  { id:'snow', asset:'snow-portrait', name:'暖暖雪庭', subtitle:'八位猫友，一场暖雪', min:8, icon:'snow', ratio:'863 / 1823', slots:[
    spot(58,60,21,'小伞下面'), spot(38,59,16,'小伞下面'),
    spot(70,29.5,19,'雪庭高台上'), spot(44.5,44,13,'窗边',{ motion:'stretch', name:'背对着伸个懒腰' }),
    spot(14.5,56.4,9.5,'橙色猫窝里'), spot(28,71.4,22,'红色软垫上',{ toy:true }),
    spot(85,76.7,19,'食盆旁'), spot(8,44,11,'室内木地板上'),
    spot(84,64.5,20,'雪庭小路旁',{ toy:true }), spot(82.5,39.3,12.5,'铃铛小台上'),
    spot(14.5,50.2,18,'猫窝顶上'), spot(59,36.2,13,'栏杆台面上'),
    spot(19,35.2,10,'室内柜台前'), spot(49,77,10,'木廊前端'),
    spot(89,49,9,'雪庭小路上'), spot(25,48.5,10,'室内点心角'),
    spot(62,76.5,13,'前院草地上'), spot(8,76,14,'木廊边'),
    spot(66,51,10,'小伞顶上'), spot(50,67,10,'木廊中央'),
    spot(30,24.5,10,'室内柜台上'), spot(14,62,10,'橙色猫窝旁'),
    spot(70,36.4,9,'栏杆台面上'), spot(89,34.8,9,'铃铛平台角落'),
  ] },
].map(scene => Object.freeze({ ...scene, slots:Object.freeze(scene.slots) })));
export function collectionSceneProgress(scene, collection, level) {
  // Old invitations stay owned, but new yards require the increased care achievements.
  const current = COLLECTION_CATS.filter(cat => collection.invited.some(record => record.id === cat.id)
    && collectionCatProgress(cat, collection, level).achieved).length;
  return { current, target:scene.min, complete:current >= scene.min };
}
export function collectionScene(id, collection, level) {
  return CAT_SCENES.find(scene => scene.id === id && collectionSceneProgress(scene, collection, level).complete) || CAT_SCENES[0];
}
export function sceneCatPlacement(scene, cat) {
  const sprite = cat.index < 12 ? SCENE_CAT_POSES[cat.index] : cat.index < 18 ? GAME_CAT_POSES[cat.index-12] : ACHIEVEMENT_CAT_POSES[cat.index-18];
  const placement = scene.slots[cat.index];
  return { ...sprite, ...placement, activity:`${placement.surface}${placement.name || sprite.name}` };
}
