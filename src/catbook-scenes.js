// Scene sprites use rounded reference poses; the collection keeps its pixel portraits.
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
  { id:'garden', asset:'garden-portrait', name:'日式庭院', subtitle:'把小日子过成花园', min:0, icon:'leaf', ratio:'863 / 1823', slots:[
    spot(65.5,78,24,'树桩上'), spot(29,35.7,20,'左侧高台上'),
    spot(78,28.7,20,'最高的猫爬架上'), spot(32.5,57,12,'抓柱旁'),
    spot(75.2,39.4,10,'右侧猫窝里'), spot(23,75.8,20,'红色软台上',{ toy:true }),
    spot(56.5,68.8,20,'食盆旁'), spot(62,60.5,14,'蓝色猫屋顶上'),
    spot(43,79,18,'木廊上',{ toy:true }), spot(44.6,44.7,15,'左侧台面上'),
    spot(73.5,49,18,'右侧圆台上'), spot(83.5,67,16,'骰子猫窝顶上'),
  ] },
  { id:'western', asset:'western-portrait', name:'西部露台', subtitle:'八位猫友的小聚会', min:8, icon:'sun', ratio:'863 / 1822', slots:[
    spot(52,34.5,18,'骰子猫窝顶上'), spot(66.8,49.3,18,'圆形小台上'),
    spot(76.7,25.3,20,'高处的台面上'), spot(78,60.8,11.5,'抓柱旁'),
    spot(74,35.1,10,'高处猫窝里'), spot(22,52.5,20,'露台上',{ toy:true }),
    spot(35,35.2,17,'食盆旁'), spot(61,71,12,'阶梯旁'),
    spot(33,60,20,'逗猫棒旁',{ toy:true }), spot(90,44.8,14,'右侧猫窝顶上'),
    spot(92,55.4,14,'右侧圆台上'), spot(16,69,19,'软软的猫床里'),
  ] },
  { id:'snow', asset:'snow-portrait', name:'暖暖雪庭', subtitle:'集齐猫友，一场暖雪', min:12, icon:'snow', ratio:'863 / 1823', slots:[
    spot(58,60,21,'小伞下面'), spot(38,59,16,'小伞下面'),
    spot(70,29.5,19,'雪庭高台上'), spot(44.5,44,13,'窗边',{ motion:'stretch', name:'背对着伸个懒腰' }),
    spot(14.5,56.4,9.5,'橙色猫窝里'), spot(28,71.4,22,'红色软垫上',{ toy:true }),
    spot(85,76.7,19,'食盆旁'), spot(8,44,11,'室内木地板上'),
    spot(84,64.5,20,'雪庭小路旁',{ toy:true }), spot(82.5,39.3,12.5,'铃铛小台上'),
    spot(14.5,50.2,18,'猫窝顶上'), spot(59,36.2,13,'栏杆台面上'),
  ] },
].map(scene => Object.freeze({ ...scene, slots:Object.freeze(scene.slots) })));
export function collectionScene(id, count) {
  return CAT_SCENES.find(scene => scene.id === id && count >= scene.min) || CAT_SCENES[0];
}
export function sceneCatPlacement(scene, cat) {
  const sprite = SCENE_CAT_POSES[cat.index];
  const placement = scene.slots[cat.index];
  return { ...sprite, ...placement, activity:`${placement.surface}${placement.name || sprite.name}` };
}
