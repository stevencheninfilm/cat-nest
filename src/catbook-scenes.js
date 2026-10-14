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
  { id:'garden', name:'日式庭院', subtitle:'把小日子过成花园', min:0, icon:'leaf', ratio:'1483 / 1061', slots:[
    spot(65,88,19,'树桩上'), spot(23,33,16,'左侧高台上'),
    spot(78,14,14,'最高的猫爬架上'), spot(22.5,67,13,'抓柱旁'),
    spot(92.2,48.4,7.8,'右侧猫窝里'), spot(34,82,15,'木廊上',{ toy:true }),
    spot(61,61,16,'食盆旁'), spot(61,42,12,'蓝色猫屋顶上'),
    spot(47,83,15,'木廊上',{ toy:true }), spot(38,43,13,'左侧台面上'),
    spot(77,47,15,'右侧圆台上'), spot(88,71,14,'骰子猫窝顶上'),
  ] },
  { id:'western', name:'西部露台', subtitle:'三位猫友的小聚会', min:3, icon:'sun', ratio:'1539 / 1022', slots:[
    spot(52,36,15,'骰子猫窝顶上'), spot(69,66,15,'圆形小台上'),
    spot(77,29,15,'高处的台面上'), spot(73.3,84,10,'抓柱旁'),
    spot(73.5,46.5,7.3,'高处猫窝里'), spot(18,68,16,'露台上',{ toy:true }),
    spot(31,37,16,'食盆旁'), spot(64,85,10,'阶梯旁'),
    spot(31,75,17,'逗猫棒旁',{ toy:true }), spot(91,57,12,'右侧猫窝顶上'),
    spot(83,68,14,'右侧圆台上'), spot(22,91,15,'软软的猫床里'),
  ] },
  { id:'snow', name:'暖暖雪庭', subtitle:'六份陪伴，一场暖雪', min:6, icon:'snow', ratio:'1402 / 1122', slots:[
    spot(52,76,18,'小伞下面'), spot(39,76,14,'小伞下面'),
    spot(70,34,16,'雪庭高台上'), spot(37,55,12,'窗边',{ motion:'stretch', name:'背对着伸个懒腰' }),
    spot(17,82,8.7,'橙色猫窝里'), spot(28,92,16,'红色软垫上',{ toy:true }),
    spot(74,91,17,'食盆旁'), spot(10,61,10,'室内木地板上'),
    spot(82,84,16,'雪庭小路旁',{ toy:true }), spot(88,47,12,'铃铛小台上'),
    spot(23,71,15,'猫窝顶上'), spot(54,46,14,'栏杆台面上'),
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
