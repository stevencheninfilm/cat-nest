# 餐厅新菜美术 · 第一次扩充

使用内置 `image_gen`，以现有 `public/assets/restaurant/food-sprites.webp` 作为风格 reference，生成 12 道新菜的一张透明图集。原六道菜不替换。

运行素材：`public/assets/restaurant/food-expansion-v1.webp`（768×1024，3 列 × 4 行，每格 256×256），单图在 `public/assets/restaurant/foods/{id}.webp`。坐标合并进 `public/assets/restaurant/sprites.json`。每格内容最长边 226px，最小透明外边距 15px。

原始生成图保留在本机 `artifacts/restaurant-art/food-expansion-v1-source.png`；裁切脚本和验证报告在同目录的 `pack-food-expansion.cjs` 与 `food-expansion-validation.json`。

| 行 | 第 1 列 | 第 2 列 | 第 3 列 |
|---|---|---|---|
| 1 | sandwich 猫爪三明治 | donut 草莓甜甜圈 | lemontea 柠檬气泡茶 |
| 2 | pudding 焦糖布丁 | matcha 抹茶奶盖 | udon 鲜虾乌冬 |
| 3 | waffle 莓果华夫饼 | strawberrymilk 草莓牛奶 | sushi 樱花寿司 |
| 4 | grape 葡萄啵啵 | cheesecake 巴斯克芝士蛋糕 | cocoa 棉花糖可可 |

## 生图提示词

Use case: stylized-concept. Asset type: transparent food sprite atlas for the existing mobile Cat Restaurant game. The reference image is STYLE REFERENCE ONLY: exactly match its rounded appetizing hand-painted 2D game food, bold dark chocolate outlines, warm amber highlights, soft cel shading, cream dishes, cheerful saturated ingredients. Create 12 NEW distinct food icons, no existing foods repeated. Output one transparent RGBA atlas in exactly 3 columns by 4 rows, 12 equal square cells, portrait 3:4 canvas. Each icon fully inside its own cell, centered, generous transparent margins at least 12% on all sides. No text, labels, numbers, grids, checkerboard, backgrounds or shadows connecting cells. Food views match reference 3/4 overhead, each same visual footprint about 75% of cell, no perspective scene. Cell order MUST be left-to-right top-to-bottom: row 1: (1) club sandwich triangular bread stacked lettuce tomato egg, on cream plate, tiny paw-shaped bread toast mark; (2) strawberry frosted ring doughnut with pink glaze and sprinkles on cream plate; (3) lemon sparkling tea in a round clear glass with lemon slice, mint, pale golden tea. Row 2: (4) caramel custard pudding with amber sauce and cherry, on cream plate; (5) iced matcha cream latte in round clear glass, green bottom white cream cap with a tiny leaf; (6) shrimp udon noodle bowl, blue ceramic bowl with thick noodles, two orange shrimps, scallion and half boiled egg. Row 3: (7) berry waffle on cream plate with strawberries blueberries whipped cream and golden waffle squares; (8) strawberry milk in a short round glass, pastel pink milk, strawberry garnish; (9) sakura sushi platter with three salmon nigiri and two maki rolls, little pink blossom accent, cream oval plate. Row 4: (10) grape boba drink in short round glass with purple grape juice, black pearls, cream cap and two grapes as garnish; (11) Basque cheesecake wedge with toasted dark golden top, cream interior, cream plate and berry; (12) marshmallow hot cocoa in a rounded coral pink mug with three white mini marshmallows and chocolate drizzle. These 12 foods must look like a coherent premium cute cooking-game item set, sufficiently distinct at 48px. Preserve real alpha transparency, do not bake a checkerboard.
