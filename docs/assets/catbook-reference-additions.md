# 参考图新增猫友 · 红色轮廓核对版

2026-10-15，用户标注的 11 处包含 12 只猫，第二处为两只车厢乘客。图鉴从 24 只扩展为 36 只；最初本轮 12 只进入全部四个场景；后续日式庭院布局核对时移除了金铃，另外三个场景保留它。之前的游戏、日常猫友仍按原场景归属展示，墨影保留日式庭院的单独落点。

## 对照

| 标注 | 参考图坐标 | 猫友 / ID | 保留的辨识特征 |
| --- | --- | --- | --- |
| 1 | 23.7%, 81.4% | 金铃 / porter | 金色虎斑、站长帽、黑白条纹长外套 |
| 2a | 16.8%, 63.3% | 麦麦 / wheat | 金色虎斑乘客、探头和前爪 |
| 2b | 同上，两只分别加入 | 石头 / pebble | 灰色虎斑乘客、探头和前爪 |
| 3 | 55%, 70% | 铃铛 / chime | 白色三花、金色铃铛、端坐 |
| 4 | 36.7%, 74.8% | 抹茶 / matcha | 灰白猫、红白高帽、绿色围裙、茶杯 |
| 5 | 46.5%, 77.6% | 纸团 / crinkle | 脑袋钻进棕色纸袋、露出白色后腿和尾巴 |
| 6 | 50.1%, 91.6% | 云帽 / cloudcap | 灰斑白纸袋帽、低头四足姿势 |
| 7 | 77.7%, 64.4% | 松果 / acorn | 棕色背影、翘尾钻灌木 |
| 8 | 90.3%, 68.5% | 泡泡 / bubble | 白色脑袋和前爪，在车站原蓝桶中探头 |
| 9 | 87.3%, 59.2% | 蛋挞 / tart | 金色虎斑，在小木箱中探头 |
| 10 | 93.9%, 57.5% | 灰豆 / ashbean | 灰色虎斑，在高木箱中打盹 |
| 11 | 83%, 9.7% | 夜巡 / nightwatch | 白脸蓝耳、深蓝忍者装、蹲坐烟囱顶 |

参考图坐标用来确认角色；落点按项目现有空场景家具重新安排。两只乘客在车站使用车窗四边形遮挡，点按按钮保留原尺寸。箱子原来的枫糖、绒绒分别移到红屋檐和围墙木栏，给两只新箱中猫腾出位置。其他庭院的探头猫放进现有猫窝，少数位置增加代码绘制的小纸箱或水桶。

只有编号 25–36 的未邀请猫友使用红色虚线剪影，保留灰色填充；已入住后恢复正常原图，不带红色核对边框。旧猫继续普通形象或灰色虚线。标记属于渲染定义，不写入收藏存档，不影响猫友身份或邀请回执。

## 素材与接入

使用内置 imagegen 技能和工具，未调用 CLI/API，也未使用 API 密钥。项目素材均已复制进工作区，原 PNG 与 alpha 保持不变：

- `public/assets/catbook/reference-cats-v1.png`：1254 × 1254 RGBA，4 列 × 3 行，12 个正式场景姿势及头像。
- `public/assets/catbook/reference-walking-v1.png`：1024 × 1536 RGBA，4 列 × 6 行，12 个角色各两帧独立步态。
- `scripts/build-catbook-reference-sprites.py` 从透明行带及每列测量紧边界，输出 `src/catbook-reference-sprites.js`；行走 A/B 帧共用宽高和脚底锚点。脚本只生成取图元数据，不改 PNG。
- `scripts/build-catbook-silhouettes.py` 同步生成 36 只角色的矢量剪影。

编号 25–36 按用户更正，改为依次解锁猫猫日记中的 3、6、9……36 张正式卡片后可邀请，不附加图鉴入住数量、等级、照顾或游戏胜场条件。数量从已有日记时光轴按卡片 ID 去重计算，没有新增存档格式或自动发放收藏；编号 36 达到 36 张日记卡片即可邀请，无需等待新增猫猫。条件见 `src/catbook-reference-cats.js`，已有正式邀请回执继续保留。旧 24 只猫的 ID、顺序和条件不变。全部入口共用同一套代码和构建，预览仍只使用 5174，全部收藏预览与入场预览只修改内存快照。

## 静态素材的最终生成提示词

```text
Use case: background-extraction / identity-preserve.
Asset type: transparent hand-drawn CAT SPRITE ATLAS for an existing cat-collecting game.
Input reference: the user's pink Neko Atsume station poster.
Recreate ONLY the twelve specified cats, matching reference identities, costumes,
short rounded proportions, thick smooth dark outlines and flat colors.
Exactly 12 isolated sprites, 4 columns × 3 rows, square transparent canvas.
Each centered in its equal cell with transparent margins; opaque white interiors;
no neighbors touching, scenery, flooring, text, watermark, grid or red outlines.
Row 1: golden tabby stationmaster with dark cap and black/white striped long coat;
golden tabby passenger head/shoulders/front paws; silver-gray tabby passenger
head/shoulders/front paws; upright white calico with yellow bell collar.
Row 2: gray-white waiter in tall red/white hat and green apron holding a white cup;
white cat prone with HEAD HIDDEN IN a crumpled brown grocery bag, rear paws and
raised tail showing; white cat wearing a gray-patched WHITE PAPER BAG HOOD,
bent low on four legs with face concealed; rear view of a brown cat climbing
headfirst away, rounded hindquarters and high curved tail, no bush.
Row 3: white black-ear-tipped kitten head and front paws, no bucket;
sleepy golden tabby head, shoulders and front paws, no box;
sleepy gray tabby head, shoulders and front paws, no box;
white blue-eared ninja in indigo suit and scarf with folded arms, squatting,
full body and feet, no chimney.
Preserve distinctive poses and source character proportions, not generic seated
cats. True alpha and crisp clean edges. Exactly this row-major order, once each.
```

## 行走素材的最终生成提示词

```text
Use case: identity-preserve.
Asset type: TWO-FRAME WALKING ATLAS for all twelve cats in the attached new atlas.
Preserve each cat's colors, costume, accessories, short proportions and dark
hand-drawn contours. Portrait 2:3 canvas, exactly 4 columns × 6 rows, 24 isolated
sprites. Rows 1–3: twelve source identities in source row-major order, phase A.
Rows 4–6: SAME twelve identities, SAME order, phase B. All face RIGHT in readable
walking/stepping poses; change near/far leg stride for B. Equal cells with true
transparent margins, common paw baseline around 85%, opaque white bodies.
No grid, text, borders, shadows or scenery.
Identity order per phase:
Row 1: golden tabby stationmaster in cap and striped coat; full-body golden tabby
passenger; full-body silver tabby passenger; white calico with yellow bell.
Row 2: waiter in striped tall hat and green apron carrying cup; white cat walking
with brown paper bag OVER HEAD; white cat walking in gray-patched white paper
hood; chestnut brown cat with high curved tail walking on four paws.
Row 3: white black-ear-tipped kitten walking full body; sleepy golden tabby walking
full body; sleepy gray tabby walking full body; white ninja in indigo suit and
scarf stepping with arms tucked. Dressed upright characters may use two back
paws; regular cats use four legs. Head-only source cats receive matching bodies.
Only walking poses, no static sitting, lying or portrait-only cells. Exactly 24.
```

## 验证

覆盖 12 个独立 ID、车厢遮挡、四场景归属、只标红新增猫、未邀请灰色剪影、独立双帧步态、确认邀请后入场、不重播旧邀请，以及旧存档无损读取。手机预览同时检查车站横向画面和三个竖版场景；点按只播放动作，不弹详情。

## 车站批注调整与云帽巡游（2026-10-15）

纸团移到小伞右下的绿色草地，石头移到右侧绿色坐垫后的车窗内，沿用固定窗框遮挡。饼饼下移到牌子下方；姜姜躺到树桩顶；松果下移到灌木下沿；绒绒挪到左侧黄色猫猫旁；墨影改在左侧屋檐。

已入住的云帽在四个场景中使用原有两帧行走素材，14 秒自动往返一次，步态与转身同时循环。点击时暂停路线并播放回应，随后继续；未解锁、入场中及刚落地时不播放巡游，减少动态效果偏好下停止动画。仅修正行走图集的云帽裁切元数据以排除相邻尾巴碎片，不改原始 PNG、存档或解锁条件。

## 日式庭院洞口遮挡与池塘落点（2026-10-15）

麦麦、石头、蛋挞、灰豆在各自猫窝内使用按底图像素定位的椭圆洞口，猫窝边缘遮住部分耳朵与面部；遮挡层保持固定，呼吸和点按动画在洞口内播放，灰色未解锁剪影共用同一裁切，外层点击区域不裁切。

金铃仅从日式庭院场景移除，图鉴、已收集回执及其他三个场景保留；枫糖新增日式庭院的池塘石头落点，使用原有披斗篷趴卧姿势。枫糖仍按原成就邀请，只有已确认邀请后才显示或入场，未解锁时显示灰色轮廓。没有增加收藏 ID、改写存档或调整解锁条件。

第二轮落点核对：麦麦、石头和蛋挞各下移底图高度的 0.6%，洞口保持原位；云帽上移到红色平台内（y=64.2%），保留原有自动往返与点击回应。

车站后续核对：石头移到相邻右侧车窗的水平中间，裁切同步对齐该窗框，下沿仍遮住部分爪爪；铃铛从草地移到伞面顶端。仅修改车站落点，其他场景保持原布局。

西部露台核对：松果下移到左侧白色栏杆顶，夜巡向右上方移动并对齐白色栏杆上沿，灰豆在三角猫屋内向左下微调；云帽与纸团交换落点，各自尺寸、造型和云帽的自动巡游保留。仅修改西部露台，不改其他庭院与存档。

雪庭核对：麦麦和石头收进各自柜门的内框，柜门玻璃的斜向反光与浅色下半部覆盖在猫脸前，并与底图保持固定位置；未解锁轮廓使用相同遮挡。夜巡上移贴住墙面，铃铛站到伞面，蛋挞头部下移而盒子保持原位，抹茶向木廊左侧挪动，云帽往右下方台阶移动。尺寸、自动巡游、点按回应与存档条件均保留。
