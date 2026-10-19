import { RESTAURANT_DECORATION_MAX_COOK_SPEED } from './restaurant-decor.js';
import { isInteractiveWorkflow, validInteractiveWorkflow, interactiveOrderProjection, interactiveWorkerProjection, interactiveWorkerReservations } from './restaurant-kitchen-interactive.js';
import { INTERACTIVE_KITCHEN_ZONES } from './restaurant-kitchen-layout.js';
import { RESTAURANT_FACILITY_MAX_LEVEL, restaurantFacilityTimeMultiplier, restaurantTableCapacity } from './restaurant-facilities.js';
export { createInteractiveWorkflow, acceptInteractiveWorkflow, advanceInteractiveWorkflow, isInteractiveWorkflow, interactiveOrderStatus } from './restaurant-kitchen-interactive.js';
import { normalizeStaffTraining, workerAbilitySnapshot, workerDurationMultipliers, workerOrderEnergyCost, workerEnergyReadyAt, restaurantStaffRestInfo } from './restaurant-staff-training.js';

/** Deterministic, shared kitchen rules. Coordinates are percentages of the full
 * restaurant stage; worker positions refer to the centre of their feet.
 * This module contains no timers or rendering code. */
const freezePoint = point => Object.freeze(point);
const defineZone = (id,name,bounds,work) => Object.freeze({id,name,bounds:Object.freeze(bounds),work:freezePoint(work)});
export const KITCHEN_ORIGIN=freezePoint({x:50,y:76});
export const KITCHEN_TABLE_POSITIONS=Object.freeze([
  [24.5,35.8],[75.3,35.8],[23.7,47.7],[76.2,47.7],
  [22.8,59.5],[77.3,59.5],[48,34],[48,56],
].map(([x,y])=>freezePoint({x,y})));
export const KITCHEN_ZONES=Object.freeze([
  defineZone(1,'饮品与冰激凌',{x:10,y:67,w:11,h:9},{x:25,y:72}),
  defineZone(2,'饮品打包',{x:10,y:76,w:11,h:8.5},{x:25,y:79.5}),
  defineZone(3,'装盘与其他操作',{x:21,y:85,w:18,h:8},{x:32,y:84}),
  defineZone(4,'炖煮台',{x:39,y:85,w:12,h:8},{x:47,y:84}),
  defineZone(5,'炒菜台',{x:51,y:85,w:13,h:8},{x:59,y:84}),
  defineZone(6,'切菜台',{x:64,y:85,w:14,h:8},{x:71,y:84}),
  defineZone(7,'洗菜池',{x:78,y:85,w:12,h:8},{x:82,y:84}),
  defineZone(8,'备菜台',{x:84,y:76,w:7,h:8},{x:80,y:78}),
  defineZone(9,'调料台',{x:84,y:68,w:7,h:8},{x:80,y:71}),
  defineZone(10,'冰箱',{x:77,y:61,w:14,h:8},{x:75,y:71}),
]);
const step = (id,zoneId,label,durationMs,prop,carrying=prop)=>Object.freeze({id,zoneId,label,durationMs,prop,carrying});
export const KITCHEN_FLOWS=Object.freeze({
  rice:Object.freeze([
    step('gather',10,'取鸡蛋、米饭、鸡腿肉和蔬菜',4000,'ingredients-omurice'),
    step('wash',7,'清洗洋葱、青椒和胡萝卜',3000,'washing-vegetables'),
    step('beat-eggs',8,'把鸡蛋打入碗中搅匀',3000,'bowl-eggs'),
    step('chop-chicken',6,'切鸡腿肉',4000,'board-chicken'),
    step('mix-vegetables',8,'切配蔬菜、混合备菜',2500,'vegetables-basket'),
    step('season',9,'加入调料',1500,'seasonings'),
    step('fry-rice',5,'翻炒鸡肉蔬菜米饭',5000,'wok-fried-rice'),
    step('wrap-omelette',5,'煎蛋皮、包起炒饭',3000,'wok-fried-rice'),
    step('plate',3,'装盘，准备送餐',1800,'rice','rice'),
  ]),
  coffee:Object.freeze([
    step('gather',10,'取牛奶和咖啡豆',3000,'ingredients-latte'),
    step('espresso',1,'磨豆，萃取浓缩咖啡',4000,'coffee-espresso'),
    step('steam-milk',1,'加热牛奶、打出绵密奶泡',3500,'milk-pitcher'),
    step('package',2,'拉花，装杯打包',2500,'drink-packaging','coffee'),
  ]),
  sandwich:Object.freeze([
    step('gather',10,'取吐司、熟火腿、芝士、生菜和番茄',3000,'ingredients-sandwich'),
    step('wash-salad',7,'清洗生菜和番茄',2500,'washing-salad'),
    step('slice-salad',6,'切番茄、整理生菜',3000,'board-salad'),
    step('toast-bread',3,'烘烤吐司',3000,'toast-bread'),
    step('spread-sauce',9,'涂抹沙拉酱',1800,'sandwich-sauce'),
    step('assemble-sandwich',8,'叠放火腿、芝士与蔬菜',3000,'sandwich-assembly'),
    step('plate-sandwich',3,'对切三明治、装盘',2200,'sandwich','sandwich'),
  ]),
  lemontea:Object.freeze([
    step('gather',10,'取柠檬、茶叶、蜂蜜、冰块和气泡水',3000,'ingredients-lemontea'),
    step('wash-lemon',7,'清洗柠檬',2200,'washing-lemon'),
    step('slice-lemon',6,'柠檬切片',2500,'board-lemon'),
    step('brew-tea',4,'冲泡茶底',3500,'tea-pot'),
    step('mix-lemontea',1,'加入柠檬、蜂蜜、冰块和气泡水',3000,'lemontea-mixing'),
    step('package-lemontea',2,'装杯、加柠檬片',1800,'lemontea','lemontea'),
  ]),
  donut:Object.freeze([
    step('gather',10,'取面粉、酵母、牛奶、鸡蛋、黄油、草莓和糖粉',3000,'ingredients-donut'),
    step('wash-donut-strawberries',7,'洗净草莓，沥去表面水分',2200,'washing-berries'),
    step('slice-donut-strawberries',6,'草莓去蒂，切小块并留一颗作装饰',2800,'board-strawberries'),
    step('knead-donut-dough',8,'面粉、酵母加牛奶、蛋液和黄油，揉成柔软面团',3500,'pizza-kneading'),
    step('proof-donut-dough',8,'盖上布巾，发酵至面团蓬松',5000,'pizza-proofing'),
    step('shape-donut-rings',6,'轻压排气、擀成厚片，用圆模压出甜甜圈',3000,'donut-shaping'),
    step('fry-donut-rings',5,'放入热油，翻面炸至两面金黄后捞出',5000,'donut-frying'),
    step('cool-donut-rings',8,'放上网架沥油，晾至糖霜不会融化的温度',3000,'donut-cooling'),
    step('mash-donut-strawberries',8,'草莓小块加少量糖压成果泥',2800,'strawberry-puree'),
    step('mix-donut-glaze',9,'草莓果泥分次拌入糖粉，调成浓稠粉色糖霜',2800,'donut-glaze'),
    step('dip-donut-glaze',3,'将甜甜圈表面蘸入糖霜，提起沥掉多余糖霜',2800,'donut-dipping'),
    step('finish-donut',3,'撒彩色爱心糖，摆草莓，待糖霜定型后装盘',2200,'donut','donut'),
  ]),
  pancake:Object.freeze([
    step('gather',10,'取面粉、鸡蛋、牛奶、黄油和蜂蜜',3000,'ingredients-pancake'),
    step('mix-pancake-batter',8,'筛入面粉，加入蛋奶搅匀面糊',3500,'sweet-batter'),
    step('grease-pancake-pan',5,'预热平底锅、抹上黄油',1800,'butter-pan'),
    step('pour-pancake-batter',5,'舀入面糊、摊成圆饼',2200,'pancake-pouring'),
    step('flip-pancakes',5,'煎至起泡、翻面煎成金黄',4500,'pancake-griddle'),
    step('plate-pancake',3,'叠放松饼、淋蜂蜜、放上黄油',2200,'pancake','pancake'),
  ]),
  pudding:Object.freeze([
    step('gather',10,'取鸡蛋、牛奶、砂糖、奶油和樱桃',3000,'ingredients-pudding'),
    step('cook-caramel',4,'砂糖加水熬成琥珀色焦糖',3500,'caramel-pot'),
    step('mix-custard',8,'鸡蛋、牛奶和砂糖搅成布丁液',3000,'sweet-batter'),
    step('strain-custard',8,'模具铺焦糖，过滤倒入布丁液',2500,'custard-molds'),
    step('steam-pudding',4,'隔水蒸至布丁凝固',5000,'pudding-steamer'),
    step('plate-pudding',3,'放凉脱模、挤奶油、点缀樱桃',3000,'pudding','pudding'),
  ]),
  matcha:Object.freeze([
    step('gather',10,'取抹茶粉、牛奶、奶油、奶酪和冰块',3000,'ingredients-matcha'),
    step('sift-matcha',8,'把抹茶粉过筛到茶碗',2200,'matcha-sifting'),
    step('warm-matcha-milk',4,'温热牛奶、准备奶底',2800,'milk-pitcher'),
    step('whisk-matcha',1,'注入温水，用茶筅打匀抹茶',3500,'matcha-whisking'),
    step('whip-milk-cap',8,'奶油、奶酪加糖打成绵密奶盖',3500,'cream-whipping'),
    step('mix-matcha-milk',1,'杯中放冰块、牛奶和抹茶液',2500,'matcha-mixing'),
    step('package-matcha',2,'铺上奶盖、撒抹茶粉、装杯',2200,'matcha','matcha'),
  ]),
  burger:Object.freeze([
    step('gather',10,'取面包胚、牛肉、生菜、番茄和芝士',3000,'ingredients-burger'),
    step('wash-burger-salad',7,'清洗生菜和番茄',2500,'washing-salad'),
    step('slice-burger-salad',6,'切番茄、整理生菜',3000,'board-salad'),
    step('shape-burger-patty',8,'牛肉调味、压成肉饼',3000,'burger-patty'),
    step('toast-burger-buns',3,'烘烤芝麻面包胚的切面',2500,'burger-buns'),
    step('grill-cheese-patty',5,'煎熟牛肉饼、盖芝士融化',5000,'burger-grill'),
    step('assemble-burger',8,'面包抹酱、叠放蔬菜和芝士肉饼',3000,'burger-assembly'),
    step('plate-burger',3,'盖上面包、整理汉堡装盘',1800,'burger','burger'),
  ]),
  udon:Object.freeze([
    step('gather',10,'取乌冬、鲜虾、鸡蛋、豌豆、鸣门卷和高汤',3000,'ingredients-udon'),
    step('rinse-udon-toppings',7,'冲洗鲜虾和豌豆',2200,'rinsing-udon'),
    step('prep-udon-shrimp',6,'鲜虾去壳去虾线、鸣门卷切片',3200,'board-shrimp'),
    step('simmer-udon-broth',4,'高汤加酱油，煮开汤底',3200,'udon-broth'),
    step('boil-udon',4,'放入乌冬，煮至柔韧',4200,'udon-pot'),
    step('cook-udon-shrimp',5,'把鲜虾和豌豆炒熟',3500,'shrimp-pan'),
    step('boil-udon-egg',4,'煮熟鸡蛋、捞出剥壳',4000,'egg-pot'),
    step('plate-udon',3,'盛汤面，摆鲜虾、半颗蛋、豌豆和鸣门卷',2500,'udon','udon'),
  ]),
  waffle:Object.freeze([
    step('gather',10,'取面粉、蛋奶、黄油、莓果和奶油',3000,'ingredients-waffle'),
    step('wash-waffle-berries',7,'清洗草莓和蓝莓',2200,'washing-berries'),
    step('mix-waffle-batter',8,'面粉加蛋奶和融化黄油，搅匀面糊',3500,'sweet-batter'),
    step('fill-waffle-iron',3,'华夫饼机预热抹油、倒入面糊',2500,'waffle-pouring'),
    step('bake-waffle',3,'合盖烘烤，开盖取出金黄华夫饼',5000,'waffle-baking'),
    step('plate-waffle',3,'叠放华夫饼，挤奶油、摆莓果和薄荷',2500,'waffle','waffle'),
  ]),
  strawberrymilk:Object.freeze([
    step('gather',10,'取新鲜草莓、牛奶、砂糖和冰块',3000,'ingredients-strawberrymilk'),
    step('wash-strawberries',7,'清洗新鲜草莓',2200,'washing-berries'),
    step('slice-strawberries',6,'草莓去蒂，切片切丁',2800,'board-strawberries'),
    step('macerate-strawberries',8,'草莓加糖压拌，保留果肉颗粒',3000,'strawberry-puree'),
    step('mix-strawberrymilk',1,'杯中放草莓果肉和冰块，倒入牛奶',3000,'strawberrymilk-pouring'),
    step('package-strawberrymilk',2,'轻轻搅匀，杯沿挂上新鲜草莓',1800,'strawberrymilk','strawberrymilk'),
  ]),
  'gold-salmon':Object.freeze([
    step('gather',10,'取大米、三文鱼、西兰花、柠檬和食用金箔',3200,'ingredients-gold-salmon'),
    step('wash-salmon-rice',7,'淘洗大米，清洗西兰花和柠檬',2800,'rinsing-rice'),
    step('steam-salmon-rice',4,'米加水入锅，蒸成松软米饭',5000,'rice-cooker'),
    step('cut-salmon',6,'三文鱼切厚块，柠檬切角',3200,'board-salmon'),
    step('season-gold-salmon',9,'给三文鱼刷上酱汁调味',2000,'seasonings'),
    step('sear-salmon',5,'煎熟鱼块两面，收汁至表面金黄',5000,'salmon-pan'),
    step('blanch-salmon-broccoli',4,'西兰花焯熟、沥水',3000,'broccoli-pot'),
    step('assemble-salmon-bowl',8,'盛饭摆鱼，配西兰花、柠檬、葱花和鱼形饼干',3000,'salmon-bowl-assembly'),
    step('finish-gold-salmon',3,'用镊子轻放食用金箔，整理出餐',2200,'gold-salmon','gold-salmon'),
  ]),
  sushi:Object.freeze([
    step('gather',10,'取寿司米、刺身用三文鱼、黄瓜、海苔、米醋和食用樱花',3200,'ingredients-sushi'),
    step('wash-sushi-rice',7,'淘洗寿司米，洗净黄瓜',2800,'sushi-rinsing'),
    step('steam-sushi-rice',4,'米加水蒸熟，焖成松软米饭',5000,'rice-cooker'),
    step('mix-sushi-vinegar',9,'米醋加糖和盐，搅拌溶解',2000,'sushi-vinegar'),
    step('fold-sushi-rice',8,'淋入寿司醋，翻拌米饭并散热',3000,'sushi-rice'),
    step('slice-sushi-filling',6,'三文鱼切薄片与条，黄瓜切条',3200,'sushi-salmon-board'),
    step('roll-sushi-maki',8,'海苔铺醋饭、三文鱼和黄瓜，用竹帘卷紧',3500,'sushi-rolling'),
    step('slice-sushi-maki',6,'卷寿司切成整齐小段',2600,'sushi-maki-board'),
    step('shape-sushi-nigiri',8,'捏出椭圆饭团，盖上三文鱼片',3000,'sushi-nigiri'),
    step('plate-sushi',3,'摆握寿司与卷寿司，点缀紫苏叶和食用樱花',2400,'sushi','sushi'),
  ]),
  pizza:Object.freeze([
    step('gather',10,'取面粉、酵母、番茄、罗勒、马苏里拉和番茄酱',3000,'ingredients-pizza'),
    step('wash-pizza-vegetables',7,'洗净番茄与罗勒叶',2200,'pizza-washing'),
    step('slice-pizza-tomatoes',6,'番茄切薄片，摘好罗勒叶',2800,'pizza-board'),
    step('knead-pizza-dough',8,'面粉加酵母、水和橄榄油，揉成柔软面团',3500,'pizza-kneading'),
    step('proof-pizza-dough',8,'盖上布巾，静置发酵至蓬松',5000,'pizza-proofing'),
    step('stretch-pizza-base',8,'擀开面团，留出蓬松饼边',3000,'pizza-stretching'),
    step('spread-pizza-sauce',9,'从中间向外抹匀番茄酱',2200,'pizza-sauce'),
    step('top-pizza',8,'铺马苏里拉芝士和番茄片',3000,'pizza-toppings'),
    step('bake-pizza',3,'送入烤箱，烤至芝士融化、饼边金黄',5500,'pizza-baking'),
    step('slice-pizza',3,'撒新鲜罗勒，轮刀分切后装盘',2200,'pizza','pizza'),
  ]),
  grape:Object.freeze([
    step('gather',10,'取葡萄、黑珍珠、茶叶、牛奶、奶油和冰块',3000,'ingredients-grape'),
    step('wash-grapes',7,'清洗葡萄，摘下果粒',2200,'grape-washing'),
    step('crush-grapes',8,'葡萄去皮去籽，压出果汁与果肉',3000,'grape-crushing'),
    step('boil-grape-pearls',4,'煮熟黑珍珠，捞出沥水',4500,'grape-pearls'),
    step('brew-grape-tea',4,'热水浸泡茶叶，滤出茶汤放凉',3500,'tea-pot'),
    step('mix-grape-milk-tea',1,'葡萄汁、茶汤与牛奶搅拌调匀',3000,'grape-milk-tea'),
    step('whip-grape-cream',8,'打发奶油至细腻蓬松',3500,'cream-whipping'),
    step('assemble-grape-boba',1,'杯底放珍珠、葡萄果肉和冰块，倒入葡萄奶茶',2500,'grape-assembling'),
    step('package-grape',2,'挤奶油花，摆葡萄和绿叶装杯',2200,'grape','grape'),
  ]),
  parfait:Object.freeze([
    step('gather',10,'取新鲜莓果、草莓冰淇淋、奶油、莓果酱和薄荷',3000,'ingredients-parfait'),
    step('wash-parfait-berries',7,'清洗莓果，沥去水分',2200,'washing-berries'),
    step('slice-parfait-strawberries',6,'草莓去蒂，切片与切丁',2800,'board-strawberries'),
    step('macerate-parfait-berries',8,'莓果加糖压拌成果肉酱',3000,'strawberry-puree'),
    step('whip-parfait-cream',8,'打发奶油至能挤出花纹',3500,'cream-whipping'),
    step('layer-parfait',2,'杯中交替铺莓果酱、草莓丁和奶油',3000,'parfait-layers'),
    step('scoop-parfait',1,'挖出圆润的草莓冰淇淋球，放入杯中',2800,'parfait-scooping'),
    step('finish-parfait',2,'摆草莓片，淋莓果酱、挤奶油并点缀薄荷',2200,'parfait','parfait'),
  ]),
  "gold-sundae":Object.freeze([
    step("gather",10,"取草莓、冰淇淋、奶油、饼干原料、金鱼模具和食用金箔",3200,"ingredients-gold-sundae"),
    step("wash-gold-sundae-berries",7,"清洗新鲜莓果，沥干水分",2200,"washing-berries"),
    step("slice-gold-sundae-berries",6,"草莓去蒂，切片与切丁",2800,"board-strawberries"),
    step("macerate-gold-sundae-sauce",8,"莓果加糖压拌，调成果肉酱",3000,"strawberry-puree"),
    step("mix-fish-cookie-dough",8,"黄油加糖、蛋液和面粉，拌成饼干面团",3500,"fish-cookie-dough"),
    step("stamp-fish-cookies",8,"擀开面团，用金鱼模具压出鱼形饼干",3000,"fish-cookie-stamping"),
    step("bake-fish-cookies",3,"烤至饼干金黄，取出放凉",5000,"fish-cookie-baking"),
    step("whip-gold-sundae-cream",8,"打发奶油，装入裱花袋",3500,"cream-whipping"),
    step("layer-gold-sundae",2,"金边杯中交替铺奶油、莓果酱和草莓片",3000,"gold-sundae-layers"),
    step("scoop-gold-sundae",1,"挖草莓冰淇淋球，放入分层杯中",2800,"gold-sundae-scooping"),
    step("decorate-gold-sundae",2,"挤奶油花，摆草莓片并插上金鱼饼干",3000,"gold-sundae-decorating"),
    step("finish-gold-sundae",3,"轻放食用金箔，检查金鱼圣代出餐",2200,"gold-sundae","gold-sundae"),
  ]),
  "cheesecake":Object.freeze([
    step("gather",10,"取奶油奶酪、鸡蛋、奶油、糖、面粉和莓果",3200,"ingredients-cheesecake"),
    step("beat-cheesecake-cheese",8,"奶油奶酪回软，加糖搅打至顺滑",3500,"cheesecake-cheese"),
    step("mix-cheesecake-eggs",8,"分次加入蛋液，每次搅拌均匀",3000,"cheesecake-eggs"),
    step("fold-cheesecake-batter",8,"倒入奶油，筛入少量面粉，翻拌顺滑",3200,"cheesecake-batter"),
    step("pour-cheesecake-mold",3,"模具铺烘焙纸，过滤倒糊并轻震排泡",2800,"cheesecake-mold"),
    step("bake-cheesecake",3,"烤箱预热，高温烤出焦褐表面与柔软内芯",6500,"cheesecake-baking"),
    step("chill-cheesecake",10,"出炉先放凉，再冷藏使蛋糕定型",4500,"cheesecake-chilling"),
    step("wash-cheesecake-berries",7,"洗净装饰莓果，沥干水分",2200,"washing-berries"),
    step("slice-cheesecake",6,"揭纸脱模，切成整齐三角块",3200,"cheesecake-slicing"),
    step("plate-cheesecake",3,"装盘，点缀草莓、蓝莓与薄荷",2200,"cheesecake","cheesecake"),
  ]),
  "gold-latte":Object.freeze([
    step("gather",10,"取咖啡豆、牛奶、金边杯碟、金匙和食用金箔",3000,"ingredients-gold-latte"),
    step("warm-gold-latte-cup",4,"用热水温杯，倒出温杯水",2000,"gold-latte-cup"),
    step("extract-gold-latte",1,"咖啡豆研磨压粉，萃取浓缩咖啡",4000,"coffee-espresso"),
    step("steam-gold-latte-milk",1,"加热牛奶，打出绵密细奶泡",3500,"milk-pitcher"),
    step("pour-gold-latte",1,"先注入细奶泡，与浓缩咖啡融合",3000,"gold-latte-pouring"),
    step("draw-gold-latte-art",2,"以细奶泡绘出招牌金鱼拉花",3000,"gold-latte-art"),
    step("apply-gold-latte-leaf",3,"用镊子在奶泡边轻放食用金箔",2000,"gold-latte-leaf"),
    step("plate-gold-latte",2,"擦净杯沿，配金边碟与金匙出杯",1800,"gold-latte","gold-latte"),
  ]),
  "cocoa":Object.freeze([
    step("gather",10,"取可可粉、黑巧克力、牛奶、糖和棉花糖",3000,"ingredients-cocoa"),
    step("sift-cocoa",8,"将可可粉过筛，去除小结块",2000,"cocoa-sifting"),
    step("chop-cocoa-chocolate",6,"黑巧克力切成细碎小块",2800,"cocoa-chocolate-board"),
    step("warm-cocoa-milk",4,"温热牛奶，准备可可奶底",2800,"milk-pitcher"),
    step("melt-cocoa-chocolate",4,"热奶加入巧克力、可可粉和糖，轻煮融化",4000,"cocoa-melting"),
    step("whisk-cocoa",1,"充分搅拌，调成细腻热可可",2800,"cocoa-whisking"),
    step("pour-cocoa",1,"把热可可倒入猫爪粉杯",2500,"cocoa-pouring"),
    step("finish-cocoa",2,"放三颗棉花糖，筛少许可可粉出杯",2200,"cocoa","cocoa"),
  ]),
});
export const KITCHEN_WALK_MS_PER_UNIT=45;
const MAX=Number.MAX_SAFE_INTEGER;
const integer=(value,min=0,max=MAX)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const pointEqual=(a,b)=>a.x===b.x&&a.y===b.y;
const validPoint=value=>exact(value,['x','y'])&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.x<=100&&value.y>=0&&value.y<=100;
const clonePoint=point=>({x:point.x,y:point.y});
const clamp=value=>Math.min(1,Math.max(0,value));
const safeTime=now=>integer(now)?now:0;
const workerId=index=>`worker-${index+1}`;
export function kitchenWorkerIdlePoint(index,total=1){
  const row=Math.floor(index/4),rows=Math.ceil(total/4),columns=Math.min(4,total-row*4);
  return {x:KITCHEN_ORIGIN.x+(index%4-(columns-1)/2)*16,y:KITCHEN_ORIGIN.y+(row-(rows-1)/2)*10};
}
const idlePoint=kitchenWorkerIdlePoint;
const kitchenZone=id=>KITCHEN_ZONES.find(zone=>zone.id===id);
const TRAINING_KEYS=Object.freeze(['speed','stamina','endurance','skill']);
const validWorkerLevels=levels=>exact(levels,TRAINING_KEYS)&&Object.values(levels).every(level=>integer(level,1,10));
const validWorker=(id,staff)=>typeof id==='string'&&/^worker-[1-9][0-9]*$/.test(id)&&integer(Number(id.slice(7)),1,staff+1);
/** An immutable order keeps its own ability levels after an employee upgrades. */
export function kitchenWorkerMultipliers(levels=null) {
  return workerDurationMultipliers(levels);
}
export function kitchenStepDuration(step,kitchenLevel=1,fridgeLevel=1,workerLevels=null,cookSpeedBp=0) {
  const abilities=kitchenWorkerMultipliers(workerLevels);
  const base=Math.round(step.durationMs*restaurantFacilityTimeMultiplier(step.zoneId===10?fridgeLevel:kitchenLevel));
  // Pickup includes physically gathering ingredients, so employee speed helps
  // at the fridge as well as on the walk. Other processing uses skill alone.
  return Math.max(600,Math.round(base*abilities.workMsMultiplier*(step.zoneId===10?abilities.walkMsMultiplier:1)/(1+cookSpeedBp/10000)));
}
const walkDuration=(from,to,workerLevels=null)=>Math.max(180,Math.round(Math.round((Math.abs(to.x-from.x)+Math.abs(to.y-from.y))*KITCHEN_WALK_MS_PER_UNIT)*kitchenWorkerMultipliers(workerLevels).walkMsMultiplier));
function corridorPath(from,to) {
  if(pointEqual(from,to))return [];
  if(from.x===to.x)return [to];
  return [{x:from.x,y:76},{x:to.x,y:76},to].filter((point,index,points)=>!pointEqual(point,index?points[index-1]:from));
}
function diningPath(from,to) {
  return [{x:from.x,y:76},{x:50,y:76},{x:50,y:to.y},to].filter((point,index,points)=>!pointEqual(point,index?points[index-1]:from));
}
const intervalsOverlap=(a,b)=>a.startAt<b.endAt&&b.startAt<a.endAt;
function firstFreeAt(startAt,duration,blocks) {
  for(const block of blocks) {
    if(startAt+duration<=block.startAt)break;
    if(startAt<block.endAt&&startAt+duration>block.startAt)startAt=block.endAt;
  }
  return startAt;
}
function reservations(restaurant) {
  return (restaurant?.orders||[]).filter(order=>order.workflow).flatMap(order=>order.workflow.segments.filter(segment=>segment.phase==='work'));
}

/** Reserve a whole order at acceptance time. Later orders cannot steal a worker
 * or a workstation already reserved by an earlier order, including after reload. */
export function createKitchenWorkflow(restaurant,recipeId,now,{orderId,seat=0,kitchenLevel=restaurant?.levels?.kitchen??1,fridgeLevel=restaurant?.levels?.fridge??1,staff=restaurant?.staff??0,cookSpeedBp=0}={}) {
  const flow=KITCHEN_FLOWS[recipeId];
  if(!flow||!integer(now)||!integer(seat,0,KITCHEN_TABLE_POSITIONS.length-1)||!integer(kitchenLevel,1,RESTAURANT_FACILITY_MAX_LEVEL)||!integer(fridgeLevel,1,RESTAURANT_FACILITY_MAX_LEVEL)||!integer(staff)||!integer(cookSpeedBp,0,RESTAURANT_DECORATION_MAX_COOK_SPEED)||typeof orderId!=='string')return null;
  const existing=(restaurant?.orders||[]).filter(order=>order.workflow).map(order=>order.workflow);
  const training=restaurant?.staffTraining?normalizeStaffTraining(restaurant.staffTraining,now,staff):null;
  // With N live orders, one of the first N + 1 workers must be free. Avoid
  // allocating an array from a saved headcount, and allow later roster growth.
  // Trained employees may need real rest even when their last collected order
  // is no longer in the live order list; that reservation lives in the ledger.
  const candidateCount=training?1+staff:Math.min(1+staff,existing.length+1);
  const workers=Array.from({length:candidateCount},(_,index)=>{
    const id=workerId(index),freeAt=Math.max(now,...existing.flatMap(workflow=>isInteractiveWorkflow(workflow)?interactiveWorkerReservations(workflow).filter(window=>window.workerId===id).map(window=>window.endAt):workflow.workerId===id?[workflow.completedAt]:[]));
    if(!training)return {id,index,freeAt,workerLevels:null,energyCost:null};
    const abilities=workerAbilitySnapshot(id,training,now),energyCost=workerOrderEnergyCost(flow,abilities),plan=workerEnergyReadyAt(training[id],freeAt,energyCost);
    return {id,index,freeAt:plan?.startAt??MAX,workerLevels:abilities.levels,energyCost};
  });
  workers.sort((a,b)=>a.freeAt-b.freeAt||a.index-b.index);
  const worker=workers[0],segments=[],blocks=reservations(restaurant);
  if(!worker||worker.freeAt===MAX)return null;
  let cursor=now,position=clonePoint(KITCHEN_ORIGIN),carrying=null;
  const append=(phase,endAt,to,zoneId=null,stepId=null,held=carrying)=>{
    if(endAt===cursor)return;
    segments.push({phase,startAt:cursor,endAt,from:clonePoint(position),to:clonePoint(to),zoneId,stepId,carrying:held});
    cursor=endAt;position=clonePoint(to);
  };
  if(worker.freeAt>cursor)append('wait',worker.freeAt,position,null,flow[0].id);
  for(const work of flow) {
    const target=kitchenZone(work.zoneId).work,path=corridorPath(position,target);
    const duration=kitchenStepDuration(work,kitchenLevel,fridgeLevel,worker.workerLevels,cookSpeedBp);
    const travelMs=path.reduce((total,point,index)=>total+walkDuration(index?path[index-1]:position,point,worker.workerLevels),0);
    const startAt=firstFreeAt(cursor+travelMs,duration,blocks.filter(block=>block.zoneId===work.zoneId).sort((a,b)=>a.startAt-b.startAt));
    // Wait in the aisle before approaching an occupied work surface.
    if(startAt>cursor+travelMs)append('wait',cursor+(startAt-cursor-travelMs),position,work.zoneId,work.id);
    for(const point of path)append('walk',cursor+walkDuration(position,point,worker.workerLevels),point,work.zoneId,work.id);
    append('work',cursor+duration,target,work.zoneId,work.id,work.carrying);
    carrying=work.carrying;
  }
  const readyAt=cursor,table=KITCHEN_TABLE_POSITIONS[seat];
  for(const point of diningPath(position,table))append('delivery',cursor+walkDuration(position,point,worker.workerLevels),point,null,'delivery',recipeId);
  const servedAt=cursor;
  for(const point of [{x:50,y:table.y},KITCHEN_ORIGIN])if(!pointEqual(position,point))append('return',cursor+walkDuration(position,point,worker.workerLevels),point,null,'return',null);
  const completedAt=cursor;
  if(!integer(completedAt))return null;
  return {version:1,recipeId,orderId,workerId:worker.id,seat,kitchenLevel,fridgeLevel,staffLevel:staff,createdAt:now,readyAt,servedAt,completedAt,segments,...(training?{workerLevels:{...worker.workerLevels},energyCost:worker.energyCost}:{}),...(cookSpeedBp?{cookSpeedBp}:{})};
}

/** Validate immutable snapshots structurally, including exact work and walking
 * durations. Waits may outlive the other order which originally caused them;
 * cross-order checks below still reject every live worker/station overlap. */
export function validKitchenWorkflow(workflow,order,restaurant) {
  if(isInteractiveWorkflow(workflow))return validInteractiveWorkflow(workflow,order,restaurant);
  const keys=['version','recipeId','orderId','workerId','seat','kitchenLevel','fridgeLevel','staffLevel','createdAt','readyAt','servedAt','completedAt','segments'];
  if(!exact(workflow,[...keys,...(Object.hasOwn(workflow||{},'workerLevels')?['workerLevels','energyCost']:[]),...(Object.hasOwn(workflow||{},'cookSpeedBp')?['cookSpeedBp']:[])])||workflow.version!==1)return false;
  if(!integer(workflow.cookSpeedBp??0,0,RESTAURANT_DECORATION_MAX_COOK_SPEED)||(workflow.cookSpeedBp??0)!==(order.decorationSnapshot?.cookSpeed??0))return false;
  const flow=KITCHEN_FLOWS[workflow.recipeId];
  if(!flow||workflow.recipeId!==order.recipeId||workflow.orderId!==order.id||workflow.createdAt!==order.createdAt||workflow.readyAt!==order.readyAt||workflow.kitchenLevel!==order.kitchenLevel||workflow.staffLevel!==order.staffLevel||!integer(workflow.fridgeLevel,1,restaurant.levels.fridge??1)||!integer(workflow.seat,0,Math.min(KITCHEN_TABLE_POSITIONS.length,restaurantTableCapacity(restaurant.levels.tables))-1)||!validWorker(workflow.workerId,order.staffLevel))return false;
  if(Object.hasOwn(workflow,'workerLevels')) {
    const current=restaurant.staffTraining?.[workflow.workerId]?.levels;
    if(!validWorkerLevels(workflow.workerLevels)||!validWorkerLevels(current)||TRAINING_KEYS.some(key=>workflow.workerLevels[key]>current[key])||workflow.energyCost!==workerOrderEnergyCost(flow,kitchenWorkerMultipliers(workflow.workerLevels)))return false;
  }
  if(![workflow.createdAt,workflow.readyAt,workflow.servedAt,workflow.completedAt].every(time=>integer(time))||workflow.readyAt<=workflow.createdAt||workflow.servedAt<=workflow.readyAt||workflow.completedAt<=workflow.servedAt||workflow.completedAt>workflow.servedAt+4500)return false;
  if(order.servedAt!==null&&order.servedAt!==workflow.servedAt||!Array.isArray(workflow.segments)||workflow.segments.length<flow.length||workflow.segments.length>100)return false;
  let cursor=order.createdAt,position=KITCHEN_ORIGIN,index=0,mode='prepare',carrying=null;
  for(const segment of workflow.segments) {
    if(!exact(segment,['phase','startAt','endAt','from','to','zoneId','stepId','carrying'])||!integer(segment.startAt)||!integer(segment.endAt)||segment.startAt!==cursor||segment.endAt<=segment.startAt||!validPoint(segment.from)||!validPoint(segment.to)||!pointEqual(segment.from,position))return false;
    const work=flow[index];
    if(mode==='prepare') {
      if(!work)return false;
      if(segment.phase==='work') {
        if(segment.stepId!==work.id||segment.zoneId!==work.zoneId||!pointEqual(segment.to,kitchenZone(work.zoneId).work)||!pointEqual(segment.from,segment.to)||segment.endAt-segment.startAt!==kitchenStepDuration(work,order.kitchenLevel,workflow.fridgeLevel,workflow.workerLevels,workflow.cookSpeedBp??0)||segment.carrying!==work.carrying)return false;
        carrying=work.carrying;index++;
        if(index===flow.length){mode='delivery';if(segment.endAt!==workflow.readyAt)return false;}
      }else if(segment.phase==='walk'||segment.phase==='wait') {
        if(segment.stepId!==work.id||segment.zoneId!==work.zoneId&&!(index===0&&segment.phase==='wait'&&segment.zoneId===null)||segment.carrying!==carrying)return false;
        if(segment.phase==='wait'&&!pointEqual(segment.from,segment.to))return false;
        if(segment.phase==='walk'&&(segment.from.x!==segment.to.x&&segment.from.y!==segment.to.y||segment.endAt-segment.startAt!==walkDuration(segment.from,segment.to,workflow.workerLevels)||segment.from.x!==segment.to.x&&segment.from.y!==76))return false;
      }else return false;
    }else if(mode==='delivery') {
      if(segment.phase!=='delivery'||segment.stepId!=='delivery'||segment.zoneId!==null||segment.carrying!==order.recipeId||segment.endAt-segment.startAt!==walkDuration(segment.from,segment.to,workflow.workerLevels)||segment.from.x!==segment.to.x&&segment.from.y!==segment.to.y)return false;
      if(segment.endAt===workflow.servedAt) {
        if(!pointEqual(segment.to,KITCHEN_TABLE_POSITIONS[workflow.seat]))return false;
        mode='return';
      }else if(segment.endAt>workflow.servedAt)return false;
    }else {
      if(segment.phase!=='return'||segment.stepId!=='return'||segment.zoneId!==null||segment.carrying!==null||segment.endAt-segment.startAt!==walkDuration(segment.from,segment.to,workflow.workerLevels)||segment.from.x!==segment.to.x&&segment.from.y!==segment.to.y)return false;
    }
    cursor=segment.endAt;position=segment.to;
  }
  if(index!==flow.length||mode!=='return'||cursor!==workflow.completedAt||!pointEqual(position,KITCHEN_ORIGIN))return false;
  // Rebuild every route, preserving only observed queue waits. This rejects
  // shortcuts through counters or a modified delivery/return path.
  // Rebuild with exactly this order's snapshotted ability levels. Giving every
  // candidate the same full-energy record keeps route reconstruction separate
  // from the later training ledger and other orders' queue reservations.
  const staffTraining=workflow.workerLevels?Object.fromEntries(Array.from({length:1+order.staffLevel},(_,index)=>[workerId(index),{levels:workflow.workerLevels,energy:100,energyAt:order.createdAt}])):null;
  const expected=createKitchenWorkflow({levels:restaurant.levels,staff:order.staffLevel,orders:[],...(staffTraining?{staffTraining}:{})},order.recipeId,order.createdAt,{orderId:order.id,seat:workflow.seat,kitchenLevel:order.kitchenLevel,fridgeLevel:workflow.fridgeLevel,staff:order.staffLevel,cookSpeedBp:workflow.cookSpeedBp??0});
  if(!expected)return false;
  const actualSegments=workflow.segments.filter(segment=>segment.phase!=='wait'),expectedSegments=expected.segments;
  return actualSegments.length===expectedSegments.length&&actualSegments.every((segment,i)=>{
    const check=expectedSegments[i];
    return segment.phase===check.phase&&segment.stepId===check.stepId&&segment.zoneId===check.zoneId&&pointEqual(segment.from,check.from)&&pointEqual(segment.to,check.to)&&segment.endAt-segment.startAt===check.endAt-check.startAt&&segment.carrying===check.carrying;
  });
}

export function validKitchenReservations(restaurant) {
  const workflows=restaurant.orders.filter(order=>order.workflow).map(order=>order.workflow);
  for(let i=0;i<workflows.length;i++)for(let j=i+1;j<workflows.length;j++) {
    const a=workflows[i],b=workflows[j];
    if(a.seat===b.seat&&!(restaurant.parties||[]).some(party=>party.table===a.seat&&party.members.some(member=>member.orderId===a.orderId)&&party.members.some(member=>member.orderId===b.orderId)))return false;
    // The worker belongs to the order once it actually departs, not while that
    // order waits in the unassigned queue at the kitchen origin.
    const busy=workflow=>isInteractiveWorkflow(workflow)?[...interactiveWorkerReservations(workflow),...workflow.runs.filter(run=>run.rest).map(run=>({workerId:run.workerId??workflow.workerId,startAt:run.endAt,endAt:run.rest.fullAt}))]:[{workerId:workflow.workerId,startAt:workflow.segments.find(segment=>segment.phase!=='wait')?.startAt??workflow.createdAt,endAt:workflow.completedAt}];
    for(const left of busy(a))for(const right of busy(b))if(left.workerId===right.workerId&&intervalsOverlap(left,right))return false;
    for(const left of a.segments.filter(segment=>segment.phase==='work'))for(const right of b.segments.filter(segment=>segment.phase==='work'))if(left.zoneId===right.zoneId&&intervalsOverlap(left,right))return false;
  }
  return true;
}

function segmentInfo(workflow,now) {
  const segment=workflow.segments.find(segment=>now<segment.endAt)||workflow.segments.at(-1),active=now<workflow.completedAt;
  const progress=clamp((now-segment.startAt)/(segment.endAt-segment.startAt));
  const position=active?{x:segment.from.x+(segment.to.x-segment.from.x)*progress,y:segment.from.y+(segment.to.y-segment.from.y)*progress}:clonePoint(KITCHEN_ORIGIN);
  const step=KITCHEN_FLOWS[workflow.recipeId].find(step=>step.id===segment.stepId)||{id:segment.stepId,zoneId:null,label:segment.phase==='return'?'回到厨房':'把料理送到客人桌上',prop:workflow.recipeId};
  const phase=segment.phase==='wait'&&segment.zoneId===null?'queue':segment.phase;
  return {...segment,phase,progress,position,step,active};
}

/** Read-only UI projection; calling this never creates orders or grants rewards. */
export function kitchenInfo(restaurant,now=Date.now()) {
  now=safeTime(now);
  const workflows=(restaurant?.orders||[]).filter(order=>order.workflow).map(order=>order.workflow);
  const orders=workflows.map(workflow=>{
    if(isInteractiveWorkflow(workflow))return interactiveOrderProjection(workflow,now);
    const current=segmentInfo(workflow,now);
    const steps=KITCHEN_FLOWS[workflow.recipeId].map(work=>{
      const segment=workflow.segments.find(segment=>segment.phase==='work'&&segment.stepId===work.id);
      const status=now>=segment.endAt?'complete':now>=segment.startAt?'working':'pending';
      return {...work,status,startAt:segment.startAt,endAt:segment.endAt,progress:clamp((now-segment.startAt)/(segment.endAt-segment.startAt))};
    });
    const arriving=now<workflow.createdAt;
    const currentStep=arriving?{id:'arriving',label:'等待客人入座',zoneId:null,prop:null,status:'arriving',startAt:now,endAt:workflow.createdAt,progress:0}:{...current.step,status:current.phase,startAt:current.startAt,endAt:current.endAt,progress:current.progress};
    return {id:workflow.orderId,recipeId:workflow.recipeId,workerId:workflow.workerId,seat:workflow.seat,currentStep,steps,phase:arriving?'arriving':current.active?current.phase:'complete',progress:clamp((now-workflow.createdAt)/(workflow.servedAt-workflow.createdAt)),queuedUntil:workflow.segments.find(segment=>segment.phase!=='wait').startAt};
  });
  const workerCount=1+(restaurant?.staff??0);
  const workerRest=restaurantStaffRestInfo(restaurant,now);
  const workers=Array.from({length:workerCount},(_,index)=>{
    const id=workerId(index);
    const manual=workflows.filter(isInteractiveWorkflow).map(workflow=>interactiveWorkerProjection(workflow,now,id)).find(Boolean);
    if(manual)return manual;
    const candidates=workflows.filter(workflow=>!isInteractiveWorkflow(workflow)&&workflow.workerId===id&&workflow.createdAt<=now&&workflow.completedAt>now).sort((a,b)=>a.completedAt-b.completedAt);
    const workflow=candidates[0];
    if(!workflow)return {id,orderId:null,phase:'idle',position:idlePoint(index,workerCount),from:idlePoint(index,workerCount),to:idlePoint(index,workerCount),startAt:now,endAt:now,progress:0,step:{id:'idle',label:'等待下一份订单',zoneId:null,prop:null},carrying:null};
    const current=segmentInfo(workflow,now);
    return {id,orderId:workflow.orderId,phase:current.phase,position:current.position,from:current.from,to:current.to,startAt:current.startAt,endAt:current.endAt,progress:current.progress,step:current.step,carrying:current.carrying};
  }).map(worker=>{
    const energy=workerRest.find(record=>record.id===worker.id),rest=energy.rest;
    if(rest&&rest.phase!=='exhausted')return {...worker,...energy,phase:rest.phase==='walking'?'rest-walk':rest.phase==='ready'?'rest-ready':'resting',position:rest.position,from:rest.from,to:rest.to,startAt:rest.startAt,endAt:rest.endAt,progress:rest.progress,carrying:null,step:{id:'rest',zoneId:null,label:rest.phase==='walking'?'前往休息室':rest.phase==='ready'?'体力已满，等待下一次指令':'在休息室恢复体力',prop:null}};
    return {...worker,...energy};
  });
  const zones=INTERACTIVE_KITCHEN_ZONES.map(zone=>{
    const work=workflows.flatMap(workflow=>workflow.segments.filter(segment=>segment.phase==='work'&&segment.zoneId===zone.id).map(segment=>({...segment,workerId:isInteractiveWorkflow(workflow)?workflow.runs.find(run=>run.startAt<=segment.startAt&&segment.endAt<=run.endAt)?.workerId??workflow.workerId:workflow.workerId,orderId:workflow.orderId}))).filter(segment=>segment.endAt>now).sort((a,b)=>a.startAt-b.startAt);
    const active=work.find(segment=>segment.startAt<=now);
    const occupant=active?{workerId:active.workerId,orderId:active.orderId,stepId:active.stepId,progress:clamp((now-active.startAt)/(active.endAt-active.startAt)),startAt:active.startAt,endAt:active.endAt}:null;
    return {...zone,occupant,queue:work.filter(segment=>segment.startAt>now).map(({workerId,orderId,stepId,startAt,endAt})=>({workerId,orderId,stepId,startAt,endAt}))};
  });
  return {workers,zones,orders};
}
