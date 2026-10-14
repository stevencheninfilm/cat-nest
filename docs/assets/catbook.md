# 猫猫图鉴素材

参考：用户提供的 [Neko Atsume 2 PV](https://www.youtube.com/watch?v=WI8KGvArWbI) 和八张猫咪、庭院图片。本次使用内置 imagegen 工具整理素材，没有调用项目的 OpenAI API 或使用 API 密钥。

素材保存在 `public/assets/catbook/`，不依赖临时目录或默认生成目录：

| 文件 | 输出尺寸 | 用途 | 输入 |
| --- | --- | --- | --- |
| `garden.png` | 1483 × 1061 | 默认日式庭院，已清除固定猫咪 | 用户图 8 |
| `western.png` | 1539 × 1022 | 邀请 3 位猫友后的西部露台 | 用户图 3 |
| `snow.png` | 1402 × 1122 | 邀请 6 位猫友后的雪庭 | 用户图 4 |
| `cats.png` | 1448 × 1086 | 透明猫猫图集，4 列 × 3 行 | 用户图 2 的前 12 只猫 |
| `scene-poses.png` | 1448 × 1086 | 场景专用的 12 种透明姿势，圆润手绘风格 | 原猫猫图集 + 用户图 8 和图 3 |

图 1 和图 6 用作整体猫猫收集场景参考，图 5 和图 7 用作家具、猫爬架和猫猫摆放参考。猫咪图集的顺序为 Bandit、Bolt、Breezy、Callie、Cocoa、Dottie、Fred、Gabriel、Ginger、Gozer、Lexy、Mack。中文名称、性格和邀请成就定义在 `src/cat-collection.js`。

`cats.png` 保留透明 alpha，用于图鉴头像和入口。庭院使用独立的 `scene-poses.png`，按参考图片改为圆润手绘猫猫，不再把同一张坐姿头像放到所有家具上。背景清除固定猫后，程序只渲染已邀请的访客。

场景姿势包括蜷睡、揣爪打盹、枕爪趴卧、背对抓柱、猫窝探头、伸爪玩球、低头吃饭、安静坐着、翻肚皮玩球、翘尾看风景和伸懒腰。三种场景分别设置家具位置和尺寸；雪庭没有抓柱，花花在窗边伸懒腰。探头的可可只有头和前爪，放在猫窝洞口，不会露出穿过家具的完整身体。玩耍猫的毛线球单独绘制并轻微滚动。

姿势图集的透明边界已逐只测量，`src/catbook-scenes.js` 用独立矩形取图并保留透明边距，避免生成图的单元格偏差把相邻猫切进来。脚底锚点按每只姿势的实际高度校准，访客按场景纵向位置控制前后层次。呼吸、挠爪、探头、拨球、进食和伸懒腰各有轻微动画，系统减少动态效果设置会停用所有场景猫和玩具动画。图鉴在手机和宽屏上统一使用 460 像素以内的手机单列布局。

## 实际处理提示词

日式庭院：

```text
Use case: precise-object-edit. Asset type: interactive cat-collecting game background. Edit target: the attached Japanese cartoon cat garden image. Remove EVERY cat from the entire image, including cats inside cubbies and cardboard houses, cats sleeping on platforms, cats at the tree stump, cat at the foreground food bowl, all cats sitting on the porch and cat trees. Carefully reconstruct the empty furniture and ground behind them. Keep ALL other scene content unchanged: exact hand-drawn flat colors and bold black outlines, original perspective and composition, garden pond, bamboo fence, shrubs, wooden porch and walkways, two climbing cat trees with empty platforms and empty black cubby holes, food bowls, toys, orange and blue cube houses, round stump, lamp. No animals anywhere. No people, no text or UI, no logos. Preserve the composition and aspect ratio of this supplied garden. This image will be used as a game scene with separate unlocked cat sprites placed on top, so it must be an EMPTY garden.
```

透明猫猫图集（`transparent_background: true`）：

```text
Use case: background-extraction. Asset type: game cat sprite atlas. Input image is the cat source reference. Extract the FIRST TWELVE cats from the supplied sheet, preserving each exact original pixel-art design, fur colors, face, sitting pose, black outlines, and tail. Cats in row order: Bandit dark tortoiseshell orange markings; Bolt golden striped tabby; Breezy white with golden top; Callie white calico; Cocoa brown and white; Dottie all-white; Fred golden orange; Gabriel black and white tuxedo; Ginger rust-red tabby; Gozer white and orange; Lexy silver-gray and white; Mack white with gray patches. Organize these 12 cats into an exact uniform 4-column by 3-row grid, one cat per equal square cell, in this exact row-major order. Each cat is centered with its paws resting at the same baseline, occupies about 65 percent of its cell width and 65 percent of its cell height, generous transparent margins between cats, no overlap, no clipping. All twelve cats must be present and distinct. Preserve true white pixels INSIDE white cats and black pixels inside dark cats. Entire background outside cats is truly transparent alpha. Remove ALL text, names, captions, gridlines, borders, shadows, and labels. Only the twelve separate pixel cats on a transparent background. Landscape 4:3 atlas proportions.
```

西部露台和雪庭分别使用各自输入图片，以同一提示词处理（`transparent_background: false`）：

```text
Use case: precise-object-edit. Asset type: interactive cat-collection game scene. Edit target is this supplied cartoon cat yard. Remove EVERY cat, including any cat sitting, lying, hiding in a cube, sleeping on a platform, climbing a scratching tree, eating near a food bowl, playing with a toy, lying in a fabric bag, and all partially cropped cats at the edges. Reconstruct the empty floor, furniture, platforms, and black cubby holes behind the removed cats. Preserve exactly the original overall hand-drawn flat illustration style with bold black outlines, colors, scene perspective, background and furniture composition, and season. Keep all other objects including food bowls, toys, plant pots, tables, cubbies, scratching trees, wooden porch and all furnishings unchanged. Empty beds, empty cat houses, empty platforms only. No animals, no people, no text or UI. The whole scene must be entirely empty of cats so separate unlocked cat sprites can be overlaid by the game. Preserve original image aspect ratio.
```

场景姿势图集（本次使用内置 imagegen，`transparent_background: true`）：

```text
Use case: stylized-concept.
Asset type: transparent sprite atlas for an interactive cat garden.
Input images: image 1 is the 12-cat identity reference (fur colors and exact row-major cat order only); image 2 and image 3 are the reference for rounded hand-drawn cats, natural furniture poses and bold outlines.
Primary request: Draw twelve DISTINCT cats in natural poses matching the provided Neko Atsume garden references, replacing the rigid identical sitting poses. Use smooth, rounded, hand-drawn flat-color cartoon linework matching the garden reference, NOT pixel art. Black outlines, small relaxed faces, stubby paws, no gradients.
Composition: one sprite per equal square cell in a precise 4-column by 3-row grid, landscape 4:3 canvas. All cells have the same size, transparent padding of at least 12% on every side, no overlap. Cats roughly 68% of cell width. Place the bottom of each sprite at 83% of its cell height, including lying and head-only cats. No cell borders or labels. Truly transparent alpha outside the animals. Keep white fur solid opaque white.
Exact row-major cat order and pose:
Row 1 col 1 Bandit, dark charcoal tortoiseshell with orange patches: curled up sleeping, tail tucked around its body, face resting sideways, eyes closed.
Row 1 col 2 Bolt, golden tabby with darker stripes: compact loaf with paws tucked, relaxed closed eyes, body horizontal.
Row 1 col 3 Breezy, mostly white with gold forehead and golden tabby patches: lying low along a platform, head resting on front paws, relaxed.
Row 1 col 4 Callie, white calico with orange and black patches: BACK VIEW, standing upright with both front paws raised to scratch a post, face hidden, tail to the side. Draw only the cat, no post.
Row 2 col 1 Cocoa, brown-and-white cat with white muzzle: ONLY the round head and two tiny front paws peeking out of a cat-house opening. No torso, no house, no surrounding disc; head and paws are a single compact sprite.
Row 2 col 2 Dottie, all-white cat: playfully lying on its side, one front paw reaching outward to bat a toy, tail up, no toy.
Row 2 col 3 Fred, orange-golden tabby: crouched down eating with head lowered toward the floor and tail curved behind, side view facing left. Cat only, no food or bowl.
Row 2 col 4 Gabriel, black-and-white tuxedo with white chest and yellow eyes: calm seated front-facing pose with soft rounded body and paws, tail visible.
Row 3 col 1 Ginger, rust-orange tabby with white paws: belly-up rolling playfully, front paws raised, round visible belly, playful little face, no toy.
Row 3 col 2 Gozer, white and golden-orange cat: BACK VIEW on all four legs, tail upright, head turned slightly to side.
Row 3 col 3 Lexy, silver-gray and white cat: curled compactly sleeping sideways, tail wrapping along the body, eyes closed.
Row 3 col 4 Mack, white with gray patches and stripes: front legs stretched forward, rear raised, a long relaxed stretching pose with closed eyes.
Constraints: ONLY these twelve cats, no backgrounds, no furniture, no toys, no ground, no text, no watermark, no decorative elements. Every identity and every specified pose must be clearly recognizable. Each sprite must stay wholly within its cell with generous transparent margins. Preserve the 4x3 equal square-cell layout exactly.
```

## 存档和校验

版本一存档新增可选 `collection` 字段，包含累计照顾统计 `stats`、已喂过的食物 `foods`、永久入住记录及操作回执 `invited`。界面展示与服务器校验使用同一份成就定义；邀请不修改资源或成长。

服务端拒绝未知猫 ID、附加客户端解锁字段、未达成成就和重复入住。邀请回执与小窝状态在同一 GitHub 提交中保存，失败不确认成功；回执保留操作 ID 与邀请者 ID，操作日志滚动后仍可识别原请求。旧存档仅补入仍可核对的历史下限，不自动邀请猫咪。可选字段存在但格式损坏时，存储层拒绝读写，避免静默清空收藏。
