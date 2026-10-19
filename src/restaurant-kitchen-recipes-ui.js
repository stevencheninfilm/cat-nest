import { KITCHEN_FLOWS } from './restaurant-kitchen.js';
import { restaurantRecipeMenuOrder } from './restaurant-recipe-order.js';

export const KITCHEN_RECIPE_DETAILS=Object.freeze({
  rice:Object.freeze({ingredients:'鸡蛋 · 米饭 · 鸡腿肉 · 洋葱 · 青椒 · 胡萝卜'}),
  coffee:Object.freeze({ingredients:'鲜牛奶 · 咖啡豆'}),
  sandwich:Object.freeze({ingredients:'吐司 · 熟火腿 · 芝士 · 生菜 · 番茄 · 沙拉酱'}),
  lemontea:Object.freeze({ingredients:'柠檬 · 茶叶 · 蜂蜜 · 冰块 · 气泡水'}),
  donut:Object.freeze({ingredients:'面粉 · 酵母 · 牛奶 · 鸡蛋 · 黄油 · 草莓 · 糖粉 · 食用油 · 彩色爱心糖'}),
  pancake:Object.freeze({ingredients:'面粉 · 鸡蛋 · 牛奶 · 黄油 · 蜂蜜'}),
  pudding:Object.freeze({ingredients:'鸡蛋 · 牛奶 · 砂糖 · 奶油 · 樱桃'}),
  matcha:Object.freeze({ingredients:'抹茶粉 · 牛奶 · 奶油 · 奶酪 · 砂糖 · 冰块'}),
  burger:Object.freeze({ingredients:'芝麻面包胚 · 牛肉 · 生菜 · 番茄 · 芝士 · 汉堡酱'}),
  udon:Object.freeze({ingredients:'乌冬 · 鲜虾 · 鸡蛋 · 豌豆 · 鸣门卷 · 高汤 · 酱油'}),
  waffle:Object.freeze({ingredients:'面粉 · 鸡蛋 · 牛奶 · 黄油 · 草莓 · 蓝莓 · 奶油 · 薄荷'}),
  strawberrymilk:Object.freeze({ingredients:'新鲜草莓 · 牛奶 · 砂糖 · 冰块'}),
  'gold-salmon':Object.freeze({ingredients:'大米 · 三文鱼 · 西兰花 · 柠檬 · 酱汁 · 葱花 · 鱼形饼干 · 食用金箔'}),
  sushi:Object.freeze({ingredients:'寿司米 · 刺身用三文鱼 · 黄瓜 · 海苔 · 米醋 · 糖盐 · 紫苏 · 食用樱花'}),
  pizza:Object.freeze({ingredients:'面粉 · 酵母 · 番茄 · 罗勒 · 马苏里拉芝士 · 番茄酱 · 橄榄油'}),
  grape:Object.freeze({ingredients:'葡萄 · 黑珍珠 · 茶叶 · 牛奶 · 奶油 · 冰块'}),
  parfait:Object.freeze({ingredients:'新鲜莓果 · 草莓冰淇淋 · 奶油 · 莓果酱 · 砂糖 · 薄荷'}),
  "gold-sundae":Object.freeze({ingredients:"草莓 · 草莓冰淇淋 · 奶油 · 黄油 · 鸡蛋 · 面粉 · 砂糖 · 金鱼饼干 · 食用金箔"}),
  "cheesecake":Object.freeze({ingredients:"奶油奶酪 · 鸡蛋 · 奶油 · 砂糖 · 面粉 · 草莓 · 蓝莓 · 薄荷"}),
  "gold-latte":Object.freeze({ingredients:"咖啡豆 · 牛奶 · 食用金箔 · 金边杯碟 · 金匙"}),
  "cocoa":Object.freeze({ingredients:"可可粉 · 黑巧克力 · 牛奶 · 砂糖 · 棉花糖"}),
});
export const kitchenRecipesInMenuOrder=info=>{
  // Match the menu's combined catalog, including an unowned premium preview.
  // Seeing a process never grants the recipe or bypasses its purchase gate.
  const catalog=[...new Map([...info.recipes,...(info.specialRecipes||[])].map(recipe=>[recipe.id,recipe])).values()];
  return restaurantRecipeMenuOrder(catalog.filter(recipe=>KITCHEN_FLOWS[recipe.id]).map(recipe=>recipe.special?{...recipe,unlocked:recipe.unlocked&&Boolean(recipe.owned??info.restaurant?.ownedSpecialRecipes?.includes(recipe.id))}:recipe));
};
export const kitchenShortStep=id=>({"wash-donut-strawberries":"洗净草莓","slice-donut-strawberries":"草莓切块","knead-donut-dough":"揉甜面团","proof-donut-dough":"面团发酵","shape-donut-rings":"压出圆圈","fry-donut-rings":"炸至金黄","cool-donut-rings":"沥油冷却","mash-donut-strawberries":"压草莓泥","mix-donut-glaze":"调草莓糖霜","dip-donut-glaze":"蘸粉色糖霜","finish-donut":"装饰装盘","wash-gold-sundae-berries":"洗净莓果","slice-gold-sundae-berries":"草莓切片丁","macerate-gold-sundae-sauce":"调莓果酱","mix-fish-cookie-dough":"拌饼干面团","stamp-fish-cookies":"压金鱼饼干","bake-fish-cookies":"烤金鱼饼干","whip-gold-sundae-cream":"打发奶油","layer-gold-sundae":"金边杯分层","scoop-gold-sundae":"挖冰淇淋球","decorate-gold-sundae":"挤花插金鱼","finish-gold-sundae":"点缀食用金箔","beat-cheesecake-cheese":"搅打奶酪","mix-cheesecake-eggs":"分次加蛋","fold-cheesecake-batter":"筛粉拌奶油","pour-cheesecake-mold":"铺纸滤糊入模","bake-cheesecake":"高温焦烤","chill-cheesecake":"放凉冷藏","wash-cheesecake-berries":"洗装饰莓果","slice-cheesecake":"脱模切三角","plate-cheesecake":"摆莓果装盘","warm-gold-latte-cup":"温热金边杯","extract-gold-latte":"研磨萃取","steam-gold-latte-milk":"打绵密奶泡","pour-gold-latte":"注奶融合","draw-gold-latte-art":"绘金鱼拉花","apply-gold-latte-leaf":"轻放金箔","plate-gold-latte":"配金匙出杯","sift-cocoa":"过筛可可粉","chop-cocoa-chocolate":"切碎巧克力","warm-cocoa-milk":"温热牛奶","melt-cocoa-chocolate":"融巧煮可可","whisk-cocoa":"搅匀热可可","pour-cocoa":"倒入猫爪杯","finish-cocoa":"摆棉花糖",'wash-sushi-rice':'淘米洗黄瓜','steam-sushi-rice':'蒸寿司米','mix-sushi-vinegar':'调寿司醋','fold-sushi-rice':'拌醋饭散热','slice-sushi-filling':'切鱼与黄瓜','roll-sushi-maki':'卷海苔寿司','slice-sushi-maki':'切卷寿司','shape-sushi-nigiri':'捏握寿司','plate-sushi':'樱花摆盘','wash-pizza-vegetables':'洗番茄罗勒','slice-pizza-tomatoes':'番茄切片','knead-pizza-dough':'揉披萨面团','proof-pizza-dough':'静置发酵','stretch-pizza-base':'擀开饼底','spread-pizza-sauce':'抹番茄酱','top-pizza':'铺芝士番茄','bake-pizza':'入炉烘烤','slice-pizza':'撒罗勒分切','wash-grapes':'洗净葡萄','crush-grapes':'去皮压果肉','boil-grape-pearls':'煮黑珍珠','brew-grape-tea':'泡茶放凉','mix-grape-milk-tea':'调葡萄奶茶','whip-grape-cream':'打发奶油','assemble-grape-boba':'加珍珠冰块','package-grape':'挤奶油摆葡萄','wash-parfait-berries':'洗净莓果','slice-parfait-strawberries':'草莓切片丁','macerate-parfait-berries':'压拌莓果酱','whip-parfait-cream':'打发奶油','layer-parfait':'分层铺酱奶油','scoop-parfait':'挖冰淇淋球','finish-parfait':'淋酱摆莓果',gather:'取食材',wash:'洗菜','beat-eggs':'打蛋','chop-chicken':'切鸡腿肉','mix-vegetables':'配菜',season:'调味','fry-rice':'炒饭','wrap-omelette':'包蛋',plate:'装盘',espresso:'萃取咖啡','steam-milk':'打奶泡',package:'拉花出杯','wash-salad':'洗蔬菜','slice-salad':'切配菜','toast-bread':'烤吐司','spread-sauce':'抹酱','assemble-sandwich':'叠放馅料','plate-sandwich':'对切装盘','wash-lemon':'洗柠檬','slice-lemon':'切柠檬','brew-tea':'泡茶','mix-lemontea':'调气泡茶','package-lemontea':'装杯','mix-pancake-batter':'调面糊','grease-pancake-pan':'抹黄油','pour-pancake-batter':'摊圆饼','flip-pancakes':'翻面煎饼','plate-pancake':'淋蜜装盘','cook-caramel':'熬焦糖','mix-custard':'调布丁液','strain-custard':'过滤入模','steam-pudding':'隔水蒸制','plate-pudding':'放凉脱模','sift-matcha':'筛抹茶粉','warm-matcha-milk':'温热牛奶','whisk-matcha':'打匀抹茶','whip-milk-cap':'打发奶盖','mix-matcha-milk':'调抹茶奶','package-matcha':'铺奶盖','wash-burger-salad':'洗蔬菜','slice-burger-salad':'切配菜','shape-burger-patty':'压牛肉饼','toast-burger-buns':'烤面包胚','grill-cheese-patty':'煎肉融芝士','assemble-burger':'叠放汉堡','plate-burger':'整理装盘','rinse-udon-toppings':'冲洗配料','prep-udon-shrimp':'鲜虾切配','simmer-udon-broth':'煮高汤','boil-udon':'煮乌冬','cook-udon-shrimp':'炒熟虾仁','boil-udon-egg':'煮鸡蛋','plate-udon':'盛面摆配料','wash-waffle-berries':'洗莓果','mix-waffle-batter':'调面糊','fill-waffle-iron':'预热倒糊','bake-waffle':'合盖烘烤','plate-waffle':'奶油莓果装盘','wash-strawberries':'洗草莓','slice-strawberries':'草莓切丁','macerate-strawberries':'压拌果肉','mix-strawberrymilk':'倒奶调匀','package-strawberrymilk':'装杯挂草莓','wash-salmon-rice':'淘米洗配菜','steam-salmon-rice':'蒸米饭','cut-salmon':'三文鱼切块','season-gold-salmon':'刷酱调味','sear-salmon':'煎鱼收汁','blanch-salmon-broccoli':'焯西兰花','assemble-salmon-bowl':'盛饭摆鱼','finish-gold-salmon':'轻放金箔',delivery:'端到餐桌'})[id]||'继续';
