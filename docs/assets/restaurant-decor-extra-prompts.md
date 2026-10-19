# 餐厅施工队与模块装饰 — 来源及提示词整理

日期：2026-10-18。生成工具为内置 `image_gen.imagegen`。两张原图及透明通道已实际查看；裁切与格式流程依据 `scripts/prepare-restaurant-decor-art.mjs` 记录。

**记录精度说明：以下提示词为依据本轮任务要求、已生成图片及处理脚本整理的可复现规格，不是原始调用提示词的逐字全文。** 未从现有记录取得的具体措辞或调用参数不作补写。场景 A/B 的逐套完整提示词另见同目录对应文档。

## 施工队员图集

参考角色：项目既有 `public/assets/restaurant/cat-sprites` 猫咪图集；延续圆形头身、短四肢、圆尾巴、深棕描边、清晰色块和柔和阴影。

原始来源：`/Users/stevenchen/.codex/generated_images/01a14df7-7763-7211-a943-2bc65c48e469/exec-5960f3a7-0238-442c-9170-3a65a3d429fc.png`。

保留副本：`artifacts/restaurant-art/decor/crew-source.png`（1448×1086，RGBA PNG）。SHA-256：`ed0b174380a6b2573f60feae7f8d22ffb7ca2763a051a4fa8534c35c0d8e4ca6`。

整理版提示词：

```text
Asset type: transparent sprite atlas for a mobile cat restaurant game.
Reference: the existing cat-sprites atlas is the character style and proportion reference. Match its very round, chubby cats, short legs and clean brown outlines.
Primary request: two adorable construction cats, each in front and back view, arranged in a clear 2-column × 2-row grid with generous transparent gutters. Top-left: orange tabby facing front, wearing a yellow safety helmet and blue overalls, holding a wooden mallet. Top-right: the same orange tabby from the back. Bottom-left: gray tabby facing front, wearing an orange safety helmet and mint overalls, holding a paint roller. Bottom-right: the same gray tabby from the back.
Keep each cat's helmet, outfit, colors and body shape consistent across both directions. Full bodies visible. Cute friendly expressions, rounded silhouette, polished 2D game illustration, soft shading, no ground scene.
Genuinely transparent background. No labels, grid lines, text, UI, watermark, scenery, extra cats or extra poses.
```

图集映射：左上 `builder-orange`、右上 `builder-orange-back`、左下 `builder-gray`、右下 `builder-gray-back`。运行时单帧为 `public/assets/restaurant/decor/crew/<id>.webp`；合集 `crew/atlas.webp` 为 512×512。

## 六套模块装饰图集

原始来源：`/Users/stevenchen/.codex/generated_images/01a14df7-7763-7211-a943-2bc65c48e469/exec-4471bc5a-d66d-4238-b0af-fb3707506d61.png`。

保留副本：`artifacts/restaurant-art/decor/props-source.png`（1774×887，RGBA PNG）。SHA-256：`34169aaced510c81d4ec06bdc797c95ba57153400950613f806ffe0d21ed3efa`。

整理版提示词：

```text
Asset type: genuinely transparent atlas of 18 modular decorations for six themed mobile cat restaurant environments.
Composition: exactly 6 columns × 3 rows. Each column belongs to one complete theme in this order: cream bakery; cream library; mint greenhouse; mint seaside; sakura daytime teahouse; sakura evening. Row 1 is a small windowsill ornament, row 2 is a narrow wall-side shelf or standing ornament, row 3 is a compact kitchen counter accessory. Every item is isolated and fully visible with generous transparent space around it, consistent perspective and comparable scale.
Style: cozy polished hand-painted 2D game assets, warm clean outlines, soft shading, readable rounded shapes, materials matching each restaurant scene. Cream and honey wood for bakery; caramel walnut and cream for library; pale mint and leaves for greenhouse; seafoam, ivory and small shells for seaside; blush pink, cream and cedar for daytime sakura; deeper rose, lantern warmth and subtle gold for evening sakura.
No floor, room, characters, cats, people, text, labels, grid lines, UI, watermark or decorative backdrop. Actual transparent background, not a painted checkerboard. Do not connect neighboring items.
```

图集实际可见内容：

| 列 | 套装 | 第1行 window | 第2行 wall | 第3行 counter |
| --- | --- | --- | --- | --- |
| 1 | cream-bakery | 麦穗白花陶壶 | 面包擀面杖小架 | 厨具筒与格纹巾 |
| 2 | cream-library | 书叠与白花 | 木书架与绿植 | 陶罐与食谱册 |
| 3 | mint-greenhouse | 玻璃小温室 | 藤蔓花架 | 盆栽香草组合 |
| 4 | mint-seaside | 海贝玻璃瓶 | 舵轮海贝小架 | 水壶与贝壳碟 |
| 5 | sakura-teahouse | 樱枝白花瓶 | 樱花盆景 | 樱花茶壶茶杯托盘 |
| 6 | sakura-evening | 圆形樱花纸灯 | 木框樱花灯 | 樱花茶罐与烛灯 |

运行时路径：`public/assets/restaurant/decor/<套装>/{window,wall,counter}.webp`，共 18 件，均为 256×256。

## 原稿处理流程

脚本：`scripts/prepare-restaurant-decor-art.mjs`。此脚本的工作是图集切分与编码，不生成绘画内容。

1. 读取原图尺寸；按施工队 2×2、道具 6×3 网格，用分数位置四舍五入计算各格边界。
2. 用 Sharp 提取单格；以透明背景、threshold=8 裁去外部空白。
3. 将主体等比缩放到最大 224×224，保持宽高比。
4. 合成到透明 256×256 画布，水平居中、底部留 16 px；锚点 `(0.5,0.9375)`。
5. 单件以 WebP quality=90、alphaQuality=100 编码，保留生成图自身的 alpha；同时输出施工队 512×512 图集。
6. 保留两张完整原稿副本；写入 `public/assets/restaurant/decor/manifest.json` 的文件、锚点与场景摆放坐标。

原始默认目录图片与项目保留副本已核对 SHA-256 一致。透明性、尺寸和文件检查详见 [资源检查报告](../restaurant-decor-assets.md)。
