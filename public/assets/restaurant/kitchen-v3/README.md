# 猫爪三明治与柠檬气泡茶 · 厨房美术 v3

使用内置 ImageGen，12 个独立新资产分别调用；每次均实际输入已 inspect 的本地食物、厨房道具、原场景为参考。11 个新透明静态 props 为 512×512，13 个真正循环 WebP 为 384×384，83 ms/帧、loop=0。两张切片案板由新生图静态素材与既有独立 knife.webp 合成切菜动画；最终三明治切开/装盘复用原 foods/sandwich.webp 与同一独立刀，其余十个循环直接来自新生成的六帧动作原画。

静态资产/动画 API 与每帧 bbox、alpha、尺寸、帧数、时长、字节、实际文件路径见 manifest.json。recipeSteps 给出菜谱步骤对照。所有 bbox 是 [left,top,rightExclusive,bottomExclusive]。动画整段使用同一最终 alpha bbox 变换，主体居中；生成图的容器底部逐帧先对齐。

## 最终提示词与实际参考

### ingredients-sandwich

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/sandwich.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/ingredients-omurice.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. A small low oval cream ingredient tray carrying two white square bread slices, folded cooked pink ham, a square cheddar cheese slice, two bright green lettuce leaves and one red whole tomato, all only these sandwich ingredients. Animate ingredient pickup: across six frames the top bread slice clearly lifts up from bread stack, floats 25% of its height above tray, shifts slightly toward viewer, then settles back while rest of tray/ingredients stay locked. This is a clean cyclical pick-up motion. No raw meat, no eggs or rice, no completed sandwich.
```

原始生成文件：`exec-1d04c5e4-9d4e-4f06-8dae-1f56cea8059c.png`，项目压缩副本：`sources/ingredients-sandwich-sheet.webp`。

### washing-salad

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/sandwich.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/washing-vegetables.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. The same sage green metal colander style as reference but filled ONLY with whole fresh green lettuce leaves and red tomatoes. No carrots, onions or peppers. Colander stays locked. A short clean blue water stream pours into vegetables; six visibly different water ripple/splash poses and moving droplets and bubbles wash leaves and tomato surfaces. Water droplets lift, fall, vanish cyclically. Keep the full water stream inside every cell. No faucet, only colander, vegetables and short stream.
```

原始生成文件：`exec-dce678c0-9ec7-4eac-ae79-90e6b3a86784.png`，项目压缩副本：`sources/washing-salad-sheet.webp`。

### board-salad

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/sandwich.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/board-chicken.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. ONE single static prop centered with 12% padding: low rectangular honey-colored cutting board with rounded corners. Whole ripe red tomato on upper right, a neat row of thin round red tomato slices with visible seeds in center, chopped bright green lettuce ribbons grouped left and one folded lettuce leaf at back. All ingredients clean and appetizing. No meat, no carrots, no onion, no knife and no utensils; a separate existing animated knife will be placed over the board.
```

原始生成文件：`exec-08153275-b723-4d30-86f1-e4b7bbdd0d4e.png`，项目压缩副本：`sources/board-salad-source.webp`。

### toast-bread

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/sandwich.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/bowl-empty.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. A small charming sage green and cream two-slot toaster with brass lever on right, two sandwich bread slices in slots. Six successive frames show an actual toasting cycle: bread starts low inside toaster with visible pale tops, warm amber glow brightens in slots, bread visibly rises halfway, then two golden toasted slices pop higher with tiny soft steam wisps and settle back toward slots to loop. Bread has one subtle toasted paw impression, matching final sandwich identity. Toaster body stays perfectly locked. No electrical wires, floor, countertop, hands, text or face.
```

原始生成文件：`exec-ed12a339-beff-4b8d-90d5-4374444b5a86.png`，项目压缩副本：`sources/toast-bread-sheet.webp`。

### sandwich-sauce

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/sandwich.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/knife.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. One low warm wooden sandwich prep board holds a square golden toasted bread slice, and a tiny cream ramekin of pale mayonnaise at back left. A short rounded butter knife with wooden handle is actively spreading pale creamy sauce over the bread: across six successive frames knife tip clearly sweeps left to right and back, leaving and smoothing glossy curved sauce streaks on toast. The bread/board/ramekin stay locked. Butter knife is visibly moving independently, not the entire board shaking. Toast has no other fillings yet, no tomatoes/lettuce/ham. No ketchup or raw meat.
```

原始生成文件：`exec-8029e90b-f1d2-4d8b-9d87-8bb13140b67d.png`，项目压缩副本：`sources/sandwich-sauce-sheet.webp`。

### sandwich-assembly

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/sandwich.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/bowl-empty.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. One low warm wooden prep board with a square golden toast base being assembled into the final sandwich from reference. Six successive animation frames: bright green lettuce descends onto bottom toast, cooked pink ham and a square yellow cheese slice settle next, thin red tomato slices join, then the top golden toast with a small toasted paw impression moves downward to close the sandwich, then lifts slightly back to a ready pose so the short action can loop. The changing independent layers and descending top toast must be very obvious; same board/base position and camera in all cells. No knife, no raw meat, no egg, no plate, no hands.
```

原始生成文件：`exec-077d83da-0c1c-4204-b355-f29bf8cdf8f2.png`，项目压缩副本：`sources/sandwich-assembly-sheet.webp`。

### ingredients-lemontea

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/lemontea.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/ingredients-latte.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. A low oval cream ingredient tray holds exactly: two whole yellow lemons, a tiny cream bowl of loose black tea leaves, one small clear golden honey jar with blank lid, a tiny clear bowl of ice cubes, and one small clear unbranded sparkling water bottle with green cap. Six poses show one whole lemon visibly lifting from tray, floating upward by 25% of its height, moving toward front, then settling back, while other ingredients and tray remain locked. No milk, no coffee beans, no complete drink, no written labels.
```

原始生成文件：`exec-60d7e678-3faa-40dd-a8a0-0d4ef25a407a.png`，项目压缩副本：`sources/ingredients-lemontea-sheet.webp`。

### washing-lemon

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/lemontea.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/washing-vegetables.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. The SAME sage green metal kitchen colander with brass handles, now containing ONLY three whole yellow lemons, no green vegetables, tomatoes or carrots. Bowl and lemons remain locked. A short clean blue stream pours onto lemons and changes visibly across six successive frames: ripples and small splashes advance, shiny water droplets move down lemon skins, clear bubbles lift/fall/vanish cyclically around rim. Full water stream fits inside each cell with transparent margin. No faucet, only bowl/lemons/short stream.
```

原始生成文件：`exec-744118e2-b2a5-41d1-8e71-3c08c994b31b.png`，项目压缩副本：`sources/washing-lemon-sheet.webp`。

### board-lemon

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/lemontea.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/board-chicken.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. ONE single static prop centered with 12% padding: a low rectangular warm honey wooden cutting board with rounded corners. A whole yellow lemon at back right, one cut lemon half showing juicy pale yellow flesh at center, and a neat row of thin round yellow lemon slices with translucent segments at front left. No other food, no knife, no hands or tools; separate existing animated knife will be added. No oranges, vegetables, milk or meat.
```

原始生成文件：`exec-3a47c3ae-df53-4de2-ad16-65e970f9a54f.png`，项目压缩副本：`sources/board-lemon-source.webp`。

### tea-pot

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/lemontea.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/bowl-empty.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. One small round sage green enamel tea saucepan with brass rim and short wooden handle pointing lower right, open top clearly showing rich amber tea and a few black tea leaves inside. Six successive phases of simmering/brewing: small surface bubbles clearly appear, enlarge, pop and recur in different positions; two cream translucent steam curls rise, change shape and fade. Pot body/rim/handle remain locked with identical size and camera. No fire or stove, no tea bags outside, no lemon yet, no milk, no complete glass drink.
```

原始生成文件：`exec-480b20d8-b0ce-4ab0-a0cc-91d450f53bf4.png`，项目压缩副本：`sources/tea-pot-sheet.webp`。

### lemontea-mixing

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/lemontea.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/milk-pitcher.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. One short stout CLEAR GLASS MIXING PITCHER with rounded handle at right and pouring spout left, containing golden amber black tea, round lemon slices and clear ice cubes. A slim silver long spoon stirs in a clear circular movement across six successive frames; lemon slices and ice rotate around spoon, a small stream of golden honey drizzles from a tiny honey spoon above left in first three frames, and soda fizz bubbles visibly rise, spread and pop across all six frames. Glass pitcher stays locked. Motion must clearly be stirring/fizzing ingredients inside, not shaking the entire vessel. No milk or coffee, no cream, no fruit other than lemon. No text or hands.
```

原始生成文件：`exec-b6890bf3-4b55-403d-ae3c-342318bed3ae.png`，项目压缩副本：`sources/lemontea-mixing-sheet.webp`。

### lemontea-pouring

输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/foods/lemontea.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/latte-cup.webp`
- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/restaurant-scene.webp`

```text
Use case: stylized-concept. Asset type: transparent hand-painted cooking prop for a mobile cat restaurant. References: image 1 is the exact finished-food identity and warm rounded style; image 2 is matching existing kitchen cookware/materials; image 3 is the clean restaurant background for top-down camera and golden light. Match these actual references. Fine warm brown contours, creamy highlights, sage green / honey wood accent colors, appealing rounded edible forms, elevated three-quarter top-down angle, clean cutout, no room, counter, cats, hands, text, labels, numbers, watermark or panel borders. Genuine transparent alpha. Output ONE SIX-FRAME ANIMATION SPRITE SHEET: exact 3 columns by 2 rows, SIX equal square cells, read left-to-right then second row. Same stationary main vessel/board at identical center, baseline, scale and camera in all six cells. Six successive different poses of the action, not six duplicate static pictures. No grid/borders/numbers. 12% transparent padding in EVERY cell, do not touch cell boundaries. The sixth frame returns near the first for a smooth loop. The SAME clear rounded serving glass and green-and-white striped straw, yellow lemon slice, mint garnish and clear ice cubes as finished lemontea reference, positioned lower center. A small clear mixing pitcher is held tilted at upper right with spout pointing into glass and pours a clearly visible thin golden amber tea stream into serving glass. Six successive frames show the stream bending/rippling, ice cubes bobbing, fresh soda bubbles rising in glass, pouring pitcher tilting slightly then returning near initial pose to loop. Serving glass/base/handle-free shape stays locked, fill level varies only slightly and never overflows. Golden lemon tea, not milk, not latte, no coffee foam art, no additional objects, no hands or countertop.
```

原始生成文件：`exec-ec38393e-494a-4bdc-ad2d-d988d5161526.png`，项目压缩副本：`sources/lemontea-pouring-sheet.webp`。

## 验证

每个输出 WebP 均重新读取。动画要求实际 ANIM/ANMF 多帧、>=6帧、loop=0、每帧83ms、每帧真实透明 alpha，以及至少6个不同解码帧。静态逐项检查 alpha min=0 / max=255、全透明像素>30%。QA 图仅用于核对，运行时使用 props/ 与 animations/。
