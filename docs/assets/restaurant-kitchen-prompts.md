# 餐厅厨房流程美术 · v1

生成模式：内置 ImageGen，未使用 CLI/API fallback。每个道具独立生成。所有输出都有真实透明 alpha；只做基于已有 alpha 的切边、统一画布、缩放与 WebP 编码，未程序绘制替代生图。

## 参考输入

- 用户厨房分区截图：`/Users/stevenchen/Downloads/截屏2026-10-18 上午12.51.10.png`。实际传入每次新道具生成，并明确忽略红色手写编号。
- 原背景：`public/assets/restaurant/restaurant-scene.webp`。实际传入每次新道具生成，用于匹配俯视角度、奶油/鼠尾草绿家具与暖光。
- 冰箱开门帧以本次生成的关闭帧为首要编辑目标，同时传入用户截图。
- 小猫角色继续沿用现有图集，没有重画。

## 交付

位置：`public/assets/restaurant/kitchen-v1/`。

| id | 文件 | 画布 | alpha 范围 | 全透明像素 |
|---|---|---|---|---|
| fridge-closed | fridge-closed.webp | 512 × 640 | 0–255 | 57.8% |
| ingredients-omurice | ingredients-omurice.webp | 512 × 512 | 0–255 | 72.8% |
| vegetables-basket | vegetables-basket.webp | 512 × 512 | 0–255 | 54.7% |
| bowl-empty | bowl-empty.webp | 512 × 512 | 0–255 | 50.8% |
| bowl-eggs | bowl-eggs.webp | 512 × 512 | 0–255 | 47.1% |
| whisk | whisk.webp | 512 × 512 | 0–255 | 80.8% |
| board-chicken | board-chicken.webp | 512 × 512 | 0–255 | 58.4% |
| knife | knife.webp | 512 × 512 | 0–255 | 83.7% |
| washing-vegetables | washing-vegetables.webp | 512 × 512 | 0–255 | 62.2% |
| wok-fried-rice | wok-fried-rice.webp | 512 × 512 | 0–255 | 54.0% |
| seasonings | seasonings.webp | 512 × 512 | 0–255 | 68.8% |
| ingredients-latte | ingredients-latte.webp | 512 × 512 | 0–255 | 62.1% |
| coffee-espresso | coffee-espresso.webp | 512 × 512 | 0–255 | 50.1% |
| milk-pitcher | milk-pitcher.webp | 512 × 512 | 0–255 | 45.7% |
| latte-cup | latte-cup.webp | 512 × 512 | 0–255 | 49.8% |
| drink-packaging | drink-packaging.webp | 512 × 512 | 0–255 | 60.6% |
| fridge-open | fridge-open.webp | 512 × 640 | 0–255 | 46.7% |

### 动画接入约定

- `fridge-closed` 和 `fridge-open` 同为 512 × 640，箱体左缘、顶端和大小对齐。可直接换帧；共同箱体锚点为画布的 (38%, 47.2%)。开门延伸到画布右侧。
- `knife.webp` 是独立刀，可叠于 `board-chicken.webp` 上做 CSS 切菜位移/转动。
- `whisk.webp` 是独立打蛋器，可叠于 `bowl-eggs.webp` 上做 CSS 打蛋转动。
- `washing-vegetables.webp` 含菜篮、流水和泡泡。
- 所有 512 × 512 道具按真实 alpha 边界切出，再等比缩至 448 范围并居中到透明画布；不会出现白底。
- `contact-sheet.webp` 按上表顺序六列排列，供美术 QA；`manifest.json` 记录尺寸、字节数与逐文件 alpha 验证。

## 最终完整提示词

### fridge-closed

```text
Use case: stylized-concept. Asset type: a transparent game prop sprite for the existing mobile cat restaurant. Input images: image 1 is the user's exact kitchen scene and position/perspective reference; ignore all red handwritten labels; image 2 is the clean full restaurant background and material/light reference. Primary request: isolate and generate ONE CLOSED SMALL REFRIGERATOR, mint sage green body, warm cream inset front, one vertically oriented brass handle, rounded corners, short legs. It will stand near the upper right wall of this kitchen. A compact two-door retro refrigerator with upper freezer and lower main door, no food visible, both doors fully closed. Style: warm finely hand-painted 2D storybook game environment, clean brown outlines, soft gentle shading, rounded charming proportions, matching the original furniture. Camera: elevated top-down view matching reference kitchen, see top surface and front surface, vertical edges nearly vertical, front facing toward viewer, no strong diagonal isometric view. Frame centered full object with 10% transparent padding, no cropped edges, no other props. Background: genuine transparent alpha. No text, no numbers, no watermark, no characters, no room/background floor or cast shadow extending beyond a tiny contact shadow.
```

原始生成文件：`exec-9ab1f237-37f7-4ab3-9168-7774b0f3144d.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### ingredients-omurice

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: One low oval cream ceramic ingredient tray holding three whole eggs grouped on left, a small neat mound of white cooked rice in the center, and one raw pink boneless chicken thigh on right. Distinguishable ingredients with warm illustrated gentle texture, no knives or tools, fully contained on one tray.
```

原始生成文件：`exec-d5d1dfae-1886-4db1-b59f-49eeedcd45b5.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### vegetables-basket

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: One low woven round produce basket containing a small onion, one green bell pepper and one orange carrot with short leaves, grouped tightly. Rounded juicy vegetables with no face, all vegetables fully contained on one basket.
```

原始生成文件：`exec-68b1208a-5df8-473d-a637-06fdff276aef.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### bowl-empty

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: One empty rounded cream ceramic mixing bowl with a soft mint green exterior band and pale cream inner surface. Bowl opening clear and large, no utensils, no food, one object only.
```

原始生成文件：`exec-44d0e5a7-6f69-4183-83c1-2ba1445300f3.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### bowl-eggs

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: One rounded cream ceramic mixing bowl with a soft mint green exterior band. It contains fresh golden-yellow egg mixture with two rounded orange yolks beginning to blend and a small circular liquid swirl. NO whisk, NO hands, NO utensils. One bowl only.
```

原始生成文件：`exec-ce805e09-3e70-4b40-8784-ff9ec513f7f7.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### whisk

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: One small balloon wire whisk, cream wood handle at upper right and rounded steel wire balloon at lower left, diagonally oriented. Clean continuous wire loops readable at small scale, no bowl, no food, no hands. One separate utensil only.
```

原始生成文件：`exec-52a4c554-8f4f-4f12-a514-ecff142329b7.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### board-chicken

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One low rectangular honey-colored wooden chopping board with rounded corners, seen from above at same kitchen angle. A neat pile of small diced pink chicken thigh pieces at center with one slightly larger raw chicken piece to the right. NO knife, NO utensils, NO hands, NO blood. Designed for a separate animated knife overlay.
```

原始生成文件：`exec-005b9f9e-75a2-4b3d-89c2-69e25a34a13c.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### knife

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One isolated small kitchen chef knife: warm brown wooden handle at upper right, short broad clean silver blade descending toward lower left. Seen from above at kitchen counter angle. This knife is a separate animated chopping sprite; no board, no food, no hands, no motion lines, no extra objects.
```

原始生成文件：`exec-c84b6185-de72-4bb7-b39f-bbfbb1825015.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### washing-vegetables

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One mint green metal kitchen colander containing a small onion, green bell pepper and orange carrot, sparkling with 3 tiny clean blue water droplets and a few little soap-free clear water bubbles around the rim. A short narrow blue stream of water pours into it from top, but NO faucet included. Self-contained compact washing prop, no sink or counter.
```

原始生成文件：`exec-5936028f-192a-4d21-8b8a-6008dd64eeed.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### wok-fried-rice

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One rounded charcoal-gray stir-fry wok with wooden handle pointing to lower right, filled with golden egg fried rice, small diced chicken, orange carrot, green pepper, and white onion. One short cream wooden spatula resting inside at upper right. Low warm steam puff above rice included but no fog/glow. No stove, no fire, no background.
```

原始生成文件：`exec-65e95e66-98a3-490c-843d-9dbcead204bb.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### seasonings

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One small oval honey-wood condiment tray, holding one rounded soy sauce bottle with a tiny red lid, one salt shaker with cream white cap, one small olive oil glass bottle with green cap. All unbranded, label-free, cream/sage/amber palette. No additional objects.
```

原始生成文件：`exec-3586921c-ac4f-4988-b9a3-630d4c5f55b1.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### ingredients-latte

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One low cream ceramic ingredient tray holding one little pale mint glass milk bottle with a brass cream-colored cap and a small rounded cream bowl of dark roasted coffee beans. No written labels. Both sit together on this single tray.
```

原始生成文件：`exec-6e541805-f90a-4f96-be3a-d349857d0e8b.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### coffee-espresso

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One tiny rounded cream ceramic espresso cup with mint green handle pointing right and a small matching saucer, filled with rich dark espresso and warm caramel crema. Just a little freshly brewed espresso, no milk, no latte foam art, no coffee machine. No teaspoon.
```

原始生成文件：`exec-74529011-b149-442a-9b1d-6feb682ef33a.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### milk-pitcher

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One squat rounded stainless-steel milk frothing pitcher filled with white frothed milk, spout pointing upper left, loop handle on right. Warm silver with cream reflections, one little mound of milk foam visible inside. No steam wand, no hands, no other objects.
```

原始生成文件：`exec-a3837657-1a14-4533-b9b1-3f624d0485c8.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### latte-cup

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One rounded cream ceramic cup with soft sage green exterior, right-facing handle, matching cream saucer. Filled with warm caramel latte coffee with a clean white milk-foam heart centered on top. Matching existing kitchen ceramic style. No spoon, no other objects.
```

原始生成文件：`exec-f057e313-c1ff-4adb-976b-36401bb5e4b1.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### drink-packaging

```text
Use case: stylized-concept. Asset type: ONE isolated transparent prop sprite for a mobile cat restaurant kitchen. Input images: image 1 is the user's exact kitchen and position/perspective reference; ignore red handwritten labels; image 2 is the clean restaurant background and material/light reference. Style/medium: matching warm finely hand-painted 2D storybook game furniture, soft cozy golden highlights, cream and sage palette accents, clean warm brown edges, rounded appealing forms. Camera: elevated top-down matching the kitchen counter in reference, see top surface and front rim, no strong diagonal isometric angle. Composition: ONE self-contained prop centered, 12% transparent safety margin around all edges, recognizable when small. Background: genuine transparent alpha, no backdrop, no room, no additional objects, no text/numbers/labels/logos/watermarks, no people or cats, no floating sparkles. Primary request: No glow, no outer shadow, crisp alpha-cutout edges, no haze. One compact kraft paper takeaway drink carrier holding ONE cream takeaway cup with a mint sleeve and fitted white lid. A spare separate round white cup lid rests flat directly beside it but contained in same compact cluster. No text, no labels, no logo. Clean simple folds, cute rounded forms.
```

原始生成文件：`exec-cf46b222-a79c-4d8b-93d6-898cd35e77e5.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。

### fridge-open

```text
Use case: precise-object-edit. Asset type: transparent refrigerator open-door animation state for a mobile cat restaurant. Image 1 is the exact CLOSED FRIDGE edit target; Image 2 is the user's kitchen reference, ignore red handwritten labels. Primary request: produce the SAME EXACT mint sage green and warm cream retro refrigerator with the LOWER MAIN DOOR OPEN, swung right to a 65 degree angle around the hinge on its right edge. Upper freezer door stays fully closed. Lower inside has cream shelves with three whole eggs in a tiny carton, one bowl of white rice, a small tray of chicken and vegetables, a milk bottle. Preserve fridge case shape, details, materials, camera angle, top view, warm painted style and same size relative to image canvas. Keep complete open door inside frame; may extend canvas to right for door if needed, do not crop. Only this refrigerator, transparent alpha background, no room, no characters, no text or labels, clean cutout, no glow or backdrop or floor. Existing reference target is a compact front facing refrigerator seen from elevated top-down angle.
```

原始生成文件：`exec-607910a6-92ee-4ea0-8b22-91fbf9038c90.png`（内置 ImageGen 默认 generated_images 目录，工作区已存最终 WebP）。
