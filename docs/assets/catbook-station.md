# 猫猫车站与游戏猫友

用户要求：把电车与红屋庭院作为第一座大场景，增加通过小游戏胜利解锁的新猫友。场景和角色采用用户提供的粉色 Neko Atsume 参考图片，并沿用本项目已生成的圆润手绘猫风格。

本次使用内置 imagegen，未调用项目 API，也未使用 API 密钥。三个 PNG 保留生成结果，透明角色保持原始 alpha；取图只调整 CSS 的矩形、脚底锚点和帧位置，没有修改原图像素。旧的像素头像、场景和行走图集保留。

## 素材

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `public/assets/catbook/station-large-v1.png` | 1536 × 1024 | 无固定猫咪的电车、红屋、沙发、遮阳伞和草坪大场景 |
| `public/assets/catbook/game-cats-v1.png` | 1254 × 1254，RGBA | 3 列 × 2 行，6 只穿戴不同的新猫；用于头像和场景姿势 |
| `public/assets/catbook/game-walking-v1.png` | 1024 × 1536，RGBA | 3 列 × 4 行，前两行步态 A，后两行步态 B |

图集实际边界在 `src/catbook-game-sprites.js`。行走帧使用同一角色共同的宽高和脚底，减少切帧抖动。

## 场景和角色

猫猫车站排在场景列表第一位，也是无偏好时的默认场景，免费开放。原日式庭院仍可直接选择；西部露台与暖暖雪庭保持 4 / 8 位已入住且实际满足当前成就门槛的猫友条件。已有有效场景偏好保留。后续布局修订将游戏猫和日常成就猫集中到车站，全部猫的静态与行走尺寸按用户车站参考图逐只校准；日式庭院保留原 12 只猫，并按后续指定加入石灯右侧的墨影；西部露台与暖暖雪庭保留原 12 只猫。车站现有 24 个落点，画布按屏幕高度完整显示并可横向拖动；宽屏继续使用手机布局。

| 猫友 | 外观 | 解锁条件 |
| --- | --- | --- |
| 栗栗 Scout | 牛仔帽、红围巾 | 石头剪刀布累计获胜 5 局 |
| 年糕 Mochi | 薄荷围巾、猫爪卡片 | 猫猫翻牌累计获胜 5 局 |
| 墨影 Onyx | 深色忍者围巾 | 五子棋累计获胜 5 局 |
| 饼饼 Biscuit | 厨师帽、蓝围裙 | 石头剪刀布累计获胜 12 局 |
| 枫糖 Maple | 绿色斗篷、星星项链 | 猫猫翻牌累计获胜 12 局 |
| 珍珠 Pearl | 粉蝴蝶结、叶子耳饰 | 五子棋累计获胜 12 局 |

原 12 只猫的成就、回执和提高后的门槛保持有效。新猫在图鉴、成就和详情统一使用未邀请灰度；达到胜利条件后免费邀请，保存确认后走入庭院、跳到自己的家具位置，再切回相应姿势。点庭院猫猫只播放动作回应，详情从图鉴打开。

## 胜利保存

`collection.wins` 独立保存猜拳、翻牌与五子棋的累计胜局。旧存档缺少这个可选字段时补入三个零值，保留已有猫友和照顾进度，不推测旧小游戏的胜负。

只有服务器接受从未结束到正式终局的操作、并判定人类玩家获胜，才增加该游戏一次胜利。单人挑战、电脑对战和双人联机均可累计；双人任一真人获胜为共同小窝计一局。单轮猜拳、电脑胜利、失败挑战、平局和取消均不累计。小游戏每日 50 点成长上限不会限制胜局；历史日记超过 40 条或午夜重置也不会清空胜局。客户端不能提交胜局、胜负或任意进度。邀请仍由服务端检查条件；GitHub 写入失败与重复操作不能制造额外胜利。

本次更新须与小游戏前后端代码一起发布，Docker 运行阶段包含小游戏规则及其依赖。这里只更新共享本地开发版本；本任务未触发线上部署，先前第二版已冻结的发布快照不会自动包含这次新增内容。

## 验证和预览

- Node 22：猫友、场景事件、云同步、胜利、GitHub 存档与小游戏相关 88 项测试全部通过。
- Node 22 完整回归：377 项，376 通过，0 失败；1 项真实 PostgreSQL 集成测试因本机无测试数据库而跳过。
- Vite 生产构建通过。
- 按 Docker 运行阶段的实际复制清单构造隔离目录，Node 22 成功导入宠物 API、存档和全部小游戏规则；未运行 Docker 镜像构建。
- 390 × 844 手机浏览器核对新场景、全部 18 只猫、六只新猫点按动作、未邀请灰度与新猫确认后入场。
- `artifacts/catbook-all-cats-preview.html?scene=station`：内存中的全猫布局预览，复用 5174，不修改真实存档。
- `artifacts/catbook-station-arrival-preview.html?scene=station&arrival=scout`：缺少栗栗的内存存档，可从图鉴邀请并观察走入。确认延迟仅用于本地预览，不调用云端。

## 实际执行的提示词

### 空白猫猫车站

```text
Use case: precise-object-edit.
Asset type: wide, horizontally pannable EMPTY illustrated game world for a phone cat-collecting game.
Input image 1 is the scene reference and edit target. Rebuild its charming isometric train-and-red-roof-cat-house courtyard as an EMPTY LANDSCAPE 3:2 background, at high resolution. Preserve the warm flat hand-drawn colors, dark rounded outlines, pink paw-pattern backdrop, brown vintage tram on the left, tall beige house with red roof and terraces on the right, central green lawn, cat sofa, tricolor parasol, small food bowls and wooden platforms. Keep the recognizable connected miniature-world composition. Do not draw a phone, frame, menu or interface.
Remove EVERY existing cat, including cats inside tram windows, houses, bowls and shrubbery. All platform surfaces, sofa cushions, house openings, window ledges, terrace railings and roof landing places must be clearly empty so separate cat sprites can be placed there in code.
Composition: use the full 3:2 canvas; the miniature world should occupy most of it. Broad continuous pink paw-pattern background behind the world. Clear large landing areas for 18 small cats. Keep primary furniture and all useful resting spots between y22% and y80%; above y20% leave pink background and quiet roof silhouette, below y86% leave only quiet foreground. Tram at x7–49%, roof landing deck around y42%, front tram body y47–74%. House at x59–91%, empty roof landing y29%, terraces y46% and y59%. Central sofa around x46% y59%; parasol x65% y64%; central grass y63–80%. Also keep empty entrance paths at both left and right edges, a small empty booth near x85% y74%, and empty open space on wood/lawn for playful costume cats. Gentle slightly elevated three-quarter perspective with coherent surfaces.
Constraints: only the EMPTY background. NO ANIMALS anywhere, no cat faces painted on items, no text, letters, logo, signature, copyright notice or watermark. No photographic texture, gradients or UI. Do not flatten the miniature environment into a simple frontal scene.
```

### 六只新猫姿势

```text
Use case: stylized-concept.
Asset type: transparent six-character sprite atlas for a cat-collecting game.
Input image 1 is the hand-drawn style reference for the existing 12 cats. Input image 2 is only inspiration for cheerful costume variety. Create SIX NEW distinct cats in the same rounded, flat-color, bold black-outline visual style as image 1, not pixel art. Arrange a precise 3 columns by 2 rows grid on a transparent square canvas, one isolated character per cell. Generous transparent spacing. Every character stays inside its cell. Each is a relaxed full-body sitting/standing/resting scene pose with its paw/ground baseline at 82% cell height.
Row 1 col 1 'Scout': golden tabby wearing a soft brown cowboy hat and red neckerchief, sitting contentedly, tail beside paws.
Row 1 col 2 'Mochi': white cat with tiny pink ears, mint scarf, holding one blue paw-print card near the chest, rounded seated pose, no surrounding card pile.
Row 1 col 3 'Onyx': dark charcoal cat with a white muzzle, simple indigo ninja scarf, sitting upright, alert golden eyes; no weapons.
Row 2 col 1 'Biscuit': cream-and-orange cat wearing a small white chef hat and pale blue apron, standing happily with visible stubby paws.
Row 2 col 2 'Maple': chestnut tabby with a yellow star-shaped neck tag and a green travel cape, compact sleepy loaf pose, eyes closed.
Row 2 col 3 'Pearl': silver-and-white cat wearing a soft pink ribbon and a tiny leaf accessory above one ear, stretched comfortably on front paws, peaceful face.
Only the six cats and their worn accessories. NO scenery, furniture, shadow, labels, text, decorative stars outside the character, trophy, grid borders or watermark. True transparent alpha outside the cats. White fur and white clothing must remain solid opaque white.
```

### 六只新猫两帧走路

```text
Use case: stylized-concept.
Asset type: transparent two-frame SIDE-VIEW WALKING sprite atlas for SIX new costume cats.
Input image 1 is the exact identity, fur colors, costumes, outlines and hand-drawn style reference. Preserve these six characters faithfully. Generate 12 isolated full-body sprites in an EXACT 3 columns by 4 rows grid on a tall 2:3 transparent canvas. Every cat faces RIGHT on all four feet, not a seated/resting pose. Generous transparent margins and consistent paw baseline at 82% of each cell. Two walking phases: near front leg forward / near hind leg back in A; opposite stride in B. Match paired character proportions and baseline.
Row 1 (phase A): cowboy golden-tabby Scout with brown cowboy hat/red scarf; white Mochi with mint scarf/blue paw card hanging at chest; charcoal-white Onyx with indigo ninja scarf.
Row 2 (phase A): cream-orange Biscuit with white chef hat and blue apron; chestnut Maple with green cape and star neck tag; silver-white Pearl with pink ribbon and leaf ear accessory.
Row 3 (phase B) repeats row 1 in EXACT same order.
Row 4 (phase B) repeats row 2 in EXACT same order.
The walking cats must clearly be the same six cats from the reference. Maple and Pearl WALK, instead of keeping their resting reference pose. Keep white fur and clothing opaque.
Constraints: ONLY twelve cats and their worn accessories. True transparent alpha outside. No backgrounds, floor, furniture, shadow, text, labels, watermark, grid lines or extra animals. No pixel art. No cell overlap.
```
## 车站落点微调（2026-10-15）

按用户的 7 条场景标注调整可可、芝麻、饼饼、小雪、吐司、布丁和墨影。可可往左下趴在前排椅子上，芝麻往左坐在车厢绿色座椅上；两只猫的图像按底图车窗的四边形开口裁切，窗框和斜向窗台遮住部分身体。裁切层固定，猫猫点按或呼吸动画在层内播放；外层按钮保留原有最小点击区域，未解锁的灰色轮廓也使用同一裁切。

饼饼在冰激凌右边的草坪，小雪移到右下草坪，吐司移到树桩右下方空草地；布丁脚底贴住围墙木栏，墨影移离灯柱并上移到红屋屋檐。只改车站的场景落点和画面遮挡，不改其他庭院、收集记录或入场流程；入场落点自动读取同一份位置定义。
