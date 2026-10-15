# 猫猫图鉴素材

参考：用户提供的 [Neko Atsume 2 PV](https://www.youtube.com/watch?v=WI8KGvArWbI) 和八张猫咪、庭院图片。本次使用内置 imagegen 工具整理素材，没有调用项目的 OpenAI API 或使用 API 密钥。

素材保存在 `public/assets/catbook/`，不依赖临时目录或默认生成目录：

| 文件 | 输出尺寸 | 用途 | 输入 |
| --- | --- | --- | --- |
| `garden.png` | 1483 × 1061 | 日式庭院，已清除固定猫咪 | 用户图 8 |
| `western.png` | 1539 × 1022 | 4 位已入住猫友达成新成就后的西部露台 | 用户图 3 |
| `snow.png` | 1402 × 1122 | 8 位已入住猫友达成新成就后的雪庭 | 用户图 4 |
| `cats.png` | 1448 × 1086 | 透明猫猫图集，4 列 × 3 行 | 用户图 2 的前 12 只猫 |
| `scene-poses.png` | 1448 × 1086 | 场景专用的 12 种透明姿势，圆润手绘风格 | 原猫猫图集 + 用户图 8 和图 3 |
| `walking-cats.png` | 1024 × 1536 | 12 只猫的两帧走路姿势，4 列 × 6 行，透明 alpha | `scene-poses.png` 风格与 `cats.png` 花色参考 |
| `garden-portrait.png` | 863 × 1823 | 沉浸式手机日式庭院 | 现有空白 `garden.png` |
| `western-portrait.png` | 863 × 1822 | 沉浸式手机西部露台 | 现有空白 `western.png` |
| `snow-portrait.png` | 863 × 1823 | 沉浸式手机雪庭 | 现有空白 `snow.png` |

图 1 和图 6 用作整体猫猫收集场景参考，图 5 和图 7 用作家具、猫爬架和猫猫摆放参考。猫咪图集的顺序为 Bandit、Bolt、Breezy、Callie、Cocoa、Dottie、Fred、Gabriel、Ginger、Gozer、Lexy、Mack。中文名称、性格和邀请成就定义在 `src/cat-collection.js`。

`cats.png` 保留透明 alpha，用于图鉴头像和入口。庭院使用独立的 `scene-poses.png`，按参考图片改为圆润手绘猫猫，不再把同一张坐姿头像放到所有家具上。背景清除固定猫后，程序只渲染已邀请的访客。

场景姿势包括蜷睡、揣爪打盹、枕爪趴卧、背对抓柱、猫窝探头、伸爪玩球、低头吃饭、安静坐着、翻肚皮玩球、翘尾看风景和伸懒腰。原三种场景分别设置家具位置和尺寸；雪庭没有抓柱，花花在窗边伸懒腰。探头的可可只有头和前爪，放在猫窝洞口，不会露出穿过家具的完整身体。玩耍猫的毛线球单独绘制并轻微滚动。

姿势图集的透明边界已逐只测量，`src/catbook-scenes.js` 用独立矩形取图并保留透明边距，避免生成图的单元格偏差把相邻猫切进来。脚底锚点按每只姿势的实际高度校准，访客按场景纵向位置控制前后层次。呼吸、挠爪、探头、拨球、进食和伸懒腰各有轻微动画，系统减少动态效果设置会停用所有场景猫和玩具动画。庭院默认铺满手机画面，宽屏也保持手机宽度居中；介绍、图鉴、成就、场景选择和猫猫详情都在点按后打开手机底部抽屉。图鉴为三列，成就为单列。原横向场景保留作素材来源，实际游戏使用重新构图的竖屏背景，所有猫猫落点已重新校准。

场景按屏幕高度放大为可横向移动的画布，手机原生横向滑动和鼠标拖动均可浏览画面两侧，悬浮菜单保持固定。鼠标从猫猫身上拖动超过阈值后会捕获拖动并阻止误触；轻点只会播放约 0.6 秒的姿势回应，保持在庭院，不打开档案；睡卧猫伸身、坐姿猫轻跳、探头猫晃头，玩球猫和毛线球一起摆动。重复点按重新播放，点其他猫、拖动、打开菜单、返回或存档重绘会取消上一次动作反馈。减少动态效果时不播放动作，仍保持在庭院。图鉴和成就中的卡片可以直接打开档案。窗口内维护各庭院的位置、抽屉滚动与返回焦点，存档刷新不会丢失当前打开的抽屉；主动邀请确认后会自动回到庭院观看入场。Esc 先关闭抽屉，再次按下才返回小窝。

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

## 沉浸式竖屏背景提示词

本轮仍使用内置 imagegen 工具，不使用 API 密钥。三个背景作为独立的新文件保存，没有覆盖原始场景。各提示词的输入为对应的现有空白场景，`transparent_background: false`。

### garden-portrait.png

```text
Use case: precise-object-edit. Asset type: portrait mobile cat-collecting game background.
Edit target: this existing EMPTY cat garden image. Recompose its familiar environment into a tall PORTRAIT 9:19 mobile game background, intended to fill an entire phone screen. Preserve the hand-drawn flat illustration, bold black outlines, original furniture designs, colors, materials and cozy mood. Rearrange the furniture into vertical layers with clear empty places for separate cat sprites. This must be a NEW PORTRAIT composition, not a landscape screenshot with padding. Every pixel of the full tall canvas is illustrated scenery. No borders.
Scene and furniture layout: Japanese garden. Keep bamboo fence, pond, shrubs, bridge, wooden porch/walkways, orange cube house, blue cube house, white dice cube house, round stump, and two scratching towers. Arrange objects vertically, not horizontally. Upper 0-20%: bamboo fence and calm garden foliage, with no furniture at extreme top. Pond and small bridge around 20-30%, a striped cube house beside bridge around x38% y25%. Main cat tower on left: top platform centered x24% y38%, lower platform centered x34% y56%, scratching post x25% spanning y40-60%. Taller right tower: top platform x76% y27%, cubby with dark round FRONT opening x76% y42%, middle round platform x78% y55%. Orange cube house on stone x16% y53%. Blue cube house x69% y62%, clear flat roof. Wooden walkway at y64-87%, a yellow food bowl x41% y71%. White dice house centered x84% y78%, clear flat roof. Large round stump x54% y83%, broad visible flat top. Lower-left walkway at x25% y77% and x29% y85% has clear empty space for two playing cats. Bottom 90-100% contains only quiet foreground grass and little plants; leave furniture and cat resting locations above 88%.
Use the reference's gentle slightly elevated three-quarter perspective. Cat platforms, beds, house tops and openings need clearly visible landing surfaces. Leave uncluttered scenery at the extreme top and bottom for small floating game buttons added later in code. Do not draw buttons or UI into the art.
Constraints: Empty environment only, NO CATS or other animals ANYWHERE, including inside houses or on platforms. All cubby holes are empty dark holes. No people. No text, numbers, logos, labels, watermark, phone frame or interface. No photographic detail, no gradients, no blur. Rounded hand-drawn game artwork, uniform outline thickness. Tall portrait 9:19 proportions.
```

### western-portrait.png

```text
Use case: precise-object-edit. Asset type: portrait mobile cat-collecting game background.
Edit target: this existing EMPTY cat garden image. Recompose its familiar environment into a tall PORTRAIT 9:19 mobile game background, intended to fill an entire phone screen. Preserve the hand-drawn flat illustration, bold black outlines, original furniture designs, colors, materials and cozy mood. Rearrange the furniture into vertical layers with clear empty places for separate cat sprites. This must be a NEW PORTRAIT composition, not a landscape screenshot with padding. Every pixel of the full tall canvas is illustrated scenery. No borders.
Scene and furniture layout: Western wooden porch. Keep warm mustard plank wall, cacti, railing, green arched door, wagon wheel, dice cube house, cardboard box, fabric cat bed, scratching towers and food bowls. Arrange as a tall vertical porch. Top 0-20% has warm wall, hanging lamp and wagon-wheel decoration with no interactive resting location at extreme top. Main left porch at x12-59%, y27-73% with a white dice house centered x43% y36% and a food bowl on a crate x24% y42%. Right cat tower: top platform x76% y29%, dark front cubby opening x75% y44%, middle round platform x70% y59%, another cubby at x87% y61%, with a small flat top at y55%. Front scratching post at x73% y68-81%; base at x73% y82%. Short steps from porch into warm sandy ground around x51% y72%. Empty fabric cat bed x20% y80%. Empty floor at x25% y64% and x32% y71% for two playful cats. Small food bowl x57% y83%. Bottom 90-100% quiet foreground cactus/sand texture only. No animals anywhere.
Use the reference's gentle slightly elevated three-quarter perspective. Cat platforms, beds, house tops and openings need clearly visible landing surfaces. Leave uncluttered scenery at the extreme top and bottom for small floating game buttons added later in code. Do not draw buttons or UI into the art.
Constraints: Empty environment only, NO CATS or other animals ANYWHERE, including inside houses or on platforms. All cubby holes are empty dark holes. No people. No text, numbers, logos, labels, watermark, phone frame or interface. No photographic detail, no gradients, no blur. Rounded hand-drawn game artwork, uniform outline thickness. Tall portrait 9:19 proportions.
```

### snow-portrait.png

```text
Use case: precise-object-edit. Asset type: portrait mobile cat-collecting game background.
Edit target: this existing EMPTY cat garden image. Recompose its familiar environment into a tall PORTRAIT 9:19 mobile game background, intended to fill an entire phone screen. Preserve the hand-drawn flat illustration, bold black outlines, original furniture designs, colors, materials and cozy mood. Rearrange the furniture into vertical layers with clear empty places for separate cat sprites. This must be a NEW PORTRAIT composition, not a landscape screenshot with padding. Every pixel of the full tall canvas is illustrated scenery. No borders.
Scene and furniture layout: Cozy snowy Japanese porch. Keep warm wooden interior on left, cabinet, plants, fish bowl, orange cube cat house on round green mat, red cushion, tricolor parasol, wooden deck, snowy shrubs, white elevated platforms, little bell, play track and bowls. Arrange vertically. Top 0-22%: cream wall, green leaves and snowy shrub silhouettes. Interior on upper left at x0-42% and y22-55%; fish bowl x25% y49%, clear wooden floor x12% y53% and by the window x37% y49%. Snowy garden right. Higher white platform with empty green bowl x70% y30%; lower white platform with tiny bell x85% y43%. Snow-topped wood railing across x46-66% at y43%. Orange cube house at x18% y62% with visible dark front round opening at x18% y64%, flat clear roof at y58%. Tricolor parasol around x49% y60%, lower deck in its shade at y72%, space for TWO separate resting cats at x38% and x57%. Red cushion on lower-left wooden deck at x26% y82%. Empty wooden deck at x52% y83%. Play track on right at x83% y77%. Food bowl on grass at x74% y85%. Bottom 91-100% peaceful snow, grass and wood foreground, no furniture resting spots. No cats.
Use the reference's gentle slightly elevated three-quarter perspective. Cat platforms, beds, house tops and openings need clearly visible landing surfaces. Leave uncluttered scenery at the extreme top and bottom for small floating game buttons added later in code. Do not draw buttons or UI into the art.
Constraints: Empty environment only, NO CATS or other animals ANYWHERE, including inside houses or on platforms. All cubby holes are empty dark holes. No people. No text, numbers, logos, labels, watermark, phone frame or interface. No photographic detail, no gradients, no blur. Rounded hand-drawn game artwork, uniform outline thickness. Tall portrait 9:19 proportions.
```

## 收集难度与场景解锁

| 猫友 | 新邀请条件 | 难度倍率 |
| --- | --- | --- |
| 斑斑 | 累计照顾小猫 5 次（喂食、摸摸、玩耍或哄睡） | 从初次到访即领改为 5 次有效照顾 |
| 闪电 | 累计喂食 30 次 | 5 倍 |
| 微风 | 累计摸摸 100 次 | 5 倍 |
| 花花 | 累计玩耍 50 次 | 5 倍 |
| 可可 | 累计陪小猫入睡 30 次 | 5 倍 |
| 小雪 | 小猫成长到 Lv.40 | 等级门槛 5 倍 |
| 奶糖 | 累计喂食 180 次 | 6 倍 |
| 芝麻 | 累计摸摸 600 次 | 6 倍 |
| 姜姜 | 累计玩耍 300 次 | 6 倍 |
| 布丁 | 累计喂食 54 次，并喂过全部 9 种不同食物 | 原 9 次尝鲜提高为 54 次，同时保留全部品种要求 |
| 银杏 | 累计完成双人喂养 96 轮 | 8 倍 |
| 云朵 | 小猫成长到 Lv.120 | 等级门槛 8 倍 |

免费开放猫猫车站和日式庭院，默认进入猫猫车站；西部露台需要 4 位已入住猫友达到新的进阶陪伴成就，暖暖雪庭需要 8 位达标。所有计入场景的猫友都按上表提高后的门槛检查，旧入住回执不能代替实际达标记录。未解锁场景使用灰色预览、锁图标、明确条件和当前达标进度，并禁止切换；旧场景偏好若不满足新条件，回到猫猫车站。达成成就但尚未邀请的猫友不计入场景解锁数量。

所有尚未邀请的猫猫在图鉴、陪伴成就和详情使用同一个灰色头像样式，包括达成条件等待邀请的猫。邀请成功后点亮头像并进入庭院。新门槛使用已有累计记录，不清空进度；旧存档已入住的猫猫继续保留、保持成就完成状态，无需重新达成。其实际累计记录低于新门槛时显示“已收集，陪伴记录保留”。

## 存档和校验

版本一存档新增可选 `collection` 字段，包含累计照顾统计 `stats`、已喂过的食物 `foods`、永久入住记录及操作回执 `invited`。界面展示与服务器校验使用同一份成就定义；邀请不修改资源或成长。

服务端拒绝未知猫 ID、附加客户端解锁字段、未达成成就和重复入住。邀请回执与小窝状态在同一 GitHub 提交中保存，失败不确认成功；回执保留操作 ID 与邀请者 ID，操作日志滚动后仍可识别原请求。旧存档仅补入仍可核对的历史下限，不自动邀请猫咪。可选字段存在但格式损坏时，存储层拒绝读写，避免静默清空收藏。

## 解锁提示和入场素材

新素材保存在 `public/assets/catbook/walking-cats.png`，由内置 imagegen 生成，没有使用 API 密钥；保留原始透明 alpha，不覆盖场景姿势或像素头像。12 个角色各有两帧，前 3 行为步态 A，后 3 行为步态 B。每个步态的主要透明边界已测量，`src/catbook-walking.js` 为同一猫使用共同的取图宽高与爪底位置，减少切帧抖动。

`src/catbook-events.js` 只比较确认后的存档，分别识别成就达成、真实邀请和 4/8 位已入住猫友进阶成就达标的场景门槛。已入住数量不变、但照顾或等级达到新条件时，也会产生一次场景解锁提示。打开已有存档不补播旧奖励，同一个确认更新不重复播放；多次同步按顺序展示。图鉴尚未邀请的猫猫继续使用灰色头像，解锁提示也保持灰色；成功入住才点亮。

邀请成功后自动关闭详情，镜头定位新猫位置。猫猫先用独立走路素材从可见画面边缘进入，交替步态并轻轻起伏，再沿家具层次跳到落点；3.2 秒后恢复原参考姿势并显示“安顿好啦”。原家具姿势在走路时隐藏，避免出现两只同名猫。后续场景奖励在入场之后提示，可用“去看看”直接切换场景，并有短暂场景亮起效果。失败或尚未确认的请求不播放入场。

存档同步重绘保留入场进度；返回小窝或切到后台时保留未看完的入场，回到庭院再播放。离开庭院时达成的成就会排队等下次进入。主要控制器在首次照顾操作前建立比较基线，走路纹理在打开庭院时预加载。用户开启减少动态效果时不播放走路、跳跃、闪光或镜头动画，直接落位并保留文字通知。

生成提示词（内置 imagegen，`transparent_background: true`）：

```text
Use case: stylized-concept.
Asset type: transparent two-frame walking sprite atlas for the existing hand-drawn cat collecting game.
Input images: image 1 (scene-poses.png) is the rounded hand-drawn style reference and exact 12 fur identities in row-major order; image 2 (cats.png) is supporting exact fur-color identity reference only, do NOT use its pixel-art style.
Primary request: create full-body SIDE-VIEW WALKING sprites for ALL 12 of these cats, in TWO phases of the same walk cycle. These sprites are used only while newly invited cats walk into the courtyard, before switching to the existing furniture resting pose.
Composition: exact 4 columns by 6 rows of equal square cells, tall 2:3 canvas. 24 isolated cat sprites total. Each cell has generous truly transparent padding, cat centered horizontally, paws baseline at 82% of cell height, occupies about 72% of width. No touching other cells. Every cat faces RIGHT with visible full body on all four feet and a gently raised curved tail. NO sitting, sleeping, head-only, back view, or belly-up poses.
Top three rows contain walking phase A, 12 cats in the exact identity order below. Bottom three rows repeat the SAME 12 identities in EXACTLY the SAME order, phase B. Match each repeated pair in face, body size, proportions, fur markings, outline and baseline; only the leg stride changes. Phase A near front leg forward and near hind leg backward; phase B near front leg backward and near hind leg forward. Four short distinct legs, opposite paws lifted by a small amount so switching A/B reads as walking.
Exact identity order in EACH group of three rows, 4 per row:
Row 1: Bandit dark charcoal tortoiseshell with orange patches; Bolt golden striped tabby; Breezy mostly white with gold forehead and gold tabby patches; Callie white calico with orange AND charcoal patches.
Row 2: Cocoa warm brown and white with white muzzle; Dottie ALL WHITE; Fred orange-golden tabby; Gabriel charcoal black and white tuxedo with white muzzle/chest/paws and yellow eyes.
Row 3: Ginger rust-orange tabby with white paws/muzzle; Gozer white and orange-gold tabby with a dark spot on head; Lexy silver-gray and white with a gray face patch; Mack white with light gray stripes and patches.
Style: preserve scene reference's smooth rounded flat-color cartoon linework, bold black outlines, stubby paws, small relaxed faces. No pixel art, photographic detail, gradients or texture. The cats should look like the same characters moving, not a new art style.
Constraints: Only the twenty-four sprites. True transparent alpha outside each animal; opaque white INSIDE white cats. No background, checkerboard drawing, ground, shadows, furniture, toys, decorations, text, labels, watermark or grid lines. Exact 4x6 equal square grid.
```

## 猫猫车站大场景与游戏猫友

新增第一座大场景猫猫车站与 6 只游戏成就猫友，合计 18 只。四座庭院为全部猫友提供独立落点；原手机布局、横向拖动、灰度收藏和点按动作保留。新猫头像、场景姿势与走路使用独立的透明图集。实际素材、5 / 12 胜局条件、迁移与验证，以及内置 imagegen 的三条完整提示词见 [猫猫车站说明](catbook-station.md)。
