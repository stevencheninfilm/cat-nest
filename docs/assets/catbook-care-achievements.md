# 日常成就猫友

在 18 只猫的车站版本之后新增 6 只日常成就猫友，图鉴总数为 24。继续使用手机庭院、横向拖动、未邀请灰度、点按动作和确认后的入场动画。

## 新猫与成就

| 猫友 | 成就 | 达成条件 |
| --- | --- | --- |
| 曦曦 Sunshine | 满格好状态 | 激活 ×1.3 成长加成，三项状态均严格大于 80 |
| 豆豆 Sprout | 今日玩耍家 | 同一个北京时间自然日逗猫 10 次 |
| 绒绒 Velvet | 换装初体验 | 成功保存一次与当前外观不同的装扮 |
| 吐司 Toast | 今日开饭啦 | 同一个北京时间自然日喂食 10 次 |
| 薄荷 Mint | 今日温柔时光 | 同一个北京时间自然日摸摸 10 次 |
| 月牙 Luna | 今日安心好梦 | 同一个北京时间自然日陪小猫入睡 3 次 |

喂食每日额度从 6 次提高为 10 次，以支持用户明确提出的单日喂食 10 次条件。仍按上一份食物进行各自冷却，其他照顾冷却、每日额度和最多 3 轮双人喂养奖励保持现行规则。

## 保存与解锁

可选的 `collection.achievements` 记录最高加成档位、是否实际换装以及四种照顾的单日最高记录，数据量固定。日常成就比较同一天的成功次数，不累计两个不同日期的次数；界面明确显示「单日最高」。达成记录永久保留，午夜归零照顾额度后仍可邀请，不需要赶在午夜前邀请。

照顾操作通过冷却、资源和每日额度校验后，才更新成就。×1.3 的判定同时考虑操作前实际使用的加成，以及照顾后新激活的加成；不能把三项分别达到过 80 拼成满状态。打开、取消换装或保存相同外观均不计入换装成就。叫醒不计入入睡次数。

邀请前后均使用服务端校验与现有永久回执。庭院只观察确认存档，乐观显示不会提前发送解锁或入场事件；失败云端写入、请求重试和 HTTP/SSE 重复回执不会制造额外奖励。达成后仍需免费邀请，成功保存后自动前往猫猫车站并走到自己的家具位置。入场只移动水平镜头，保留完整庭院的高度构图。游戏猫与日常成就猫主要在车站；墨影另在日式庭院石灯右侧相遇，其余新猫只在车站。

旧存档没有新成就字段时，只从仍可核验的资料迁移：原始已保存的三项状态、带档位的成长奖励、明确的 ×1.3 照顾日记、当前非默认的已保存装扮，以及一个有效的单日照顾台账。不能从累积照顾次数推测单日成就，也不能从仅保存相同外观的换装日记猜测真实变化。旧猫友、游戏胜局和累计照顾记录保留。畸形的新字段在正式存档中被拒绝。

## 素材

使用内置 imagegen，未使用项目 API 或 API 密钥。原始生成图保留，透明 alpha 不经改写；CSS 根据连通透明边界取图，不切入相邻角色。车站为全部 24 只猫提供独立落点；日式庭院另有墨影的指定落点，西部露台、暖暖雪庭保留原 12 只猫。车站全部猫的尺寸随后按用户参考图逐只校准，头部与家具保持协调；静态与行走分别设置宽度，帽子、围巾和长尾不再导致整只猫过大。

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `public/assets/catbook/achievement-cats-v1.png` | 1254 × 1254，RGBA | 3 列 × 2 行，坐姿、玩球、进食、伸懒腰与蜷睡 |
| `public/assets/catbook/achievement-walking-v1.png` | 1086 × 1448，RGBA | 3 列 × 4 行，六只猫的步态 A / B |
| `src/catbook-achievement-sprites.js` | — | 独立取图矩形、共同脚底和两个步态位置 |

## 验证与版本范围

- 新增 11 项成就测试，覆盖四类真实单日操作、跨日保持、不能拼接日期、时钟回退、换装真实性、×1.3 严格边界、迁移、非法数据、服务端邀请和失败写入。
- 云确认测试增加单日喂食与失败换装，确保只在确认后提示解锁。
- 90 项相关成就、猫友、云同步、状态与存档测试通过。
- Node 22 完整回归：420 项中 419 通过、0 失败；1 项真实 PostgreSQL 测试因未配置测试数据库跳过。
- 生产构建通过；手机浏览器检查新头像、灰度、六只新猫点击响应和四座庭院。
- 现有 5174 本地 API 已载入新猫规则；复用已保存操作编号的校验请求按预期返回冲突错误，未写入存档。
- `artifacts/catbook-all-cats-preview.html` 继续提供仅内存中的全猫布局预览，不改变真实存档。
- 本次为本地开发更新。合并对话指定截止时间前已完成的 18 猫版本另存于 `/private/tmp/catbook-18-completed-cutoff-20261014`，含校验清单、可应用补丁与集成说明；该导出不含这批新猫、成就字段或喂食上限调整。本任务未推送或部署。

## 实际执行的提示词

### 六只新猫姿势

```text
Use case: identity-preserve. Asset type: a transparent six-cat sprite atlas for this existing cat-collecting game. The input image is a STYLE REFERENCE ONLY: preserve its soft rounded hand-drawn bodies, bold black outlines, opaque white fur, simple expressive faces, flat warm colors and clean edges, but replace all six characters with NEW characters described below. Do not reuse the cowboy, ninja, chef or green-cape identities.
Composition: exactly 3 columns by 2 rows, six separate full-body cats in row-major order, one character per equal square cell, broad transparent margins (15% on every side). No cats touch or overlap. Align paws / resting bottoms to a consistent lower baseline inside each cell. Shapes comfortably occupy 60-70% cell width. Truly transparent alpha everywhere outside cats and their SMALL held accessory. No background, ground shadows, checkerboard, lettering, numbers, brands, frame, decorations between cells.
Characters in exact row-major order:
1 Sunshine: creamy white cat with golden-orange ears and pale golden tail, small sun-shaped gold collar charm; cheerful quiet SITTING pose, all four paws visible, no hat.
2 Sprout: orange striped tabby, bright green bow-tie, PLAYFUL pose seated with one front paw raised to bat a tiny yellow yarn ball beside that paw.
3 Velvet: smoky lilac-gray cat with white chest and white paws, soft lavender beret and a small rose-pink bow on chest; elegant SITTING pose, curled fluffy tail.
4 Toast: pale orange and cream cat with red gingham bib, slightly leaning down in an EATING pose toward a small plain cream food bowl with kibble. Full head, body, four paws and tail visible.
5 Mint: snowy white cat with cool gray ear tips and tail stripes, mint-green bandana; comfortable full-body STRETCHING pose with front paws reaching forward and tail up.
6 Luna: dark navy-blue-gray cat with white cheek patch, thin midnight-blue collar and a tiny silver crescent charm; curled LOAF / SLEEPING pose, eyes closed.
Every cat is distinct in silhouette and accessory, matches this game's existing art exactly, is friendly and believable. Keep all pixels of white fur opaque. Generate clean true transparency; do not draw a texture or dark haze outside outlines.
```

### 六只新猫两帧步态

```text
Use case: identity-preserve. Asset type: transparent TWO-FRAME WALKING animation atlas for six existing illustrated cat characters.
Input image is the exact identity and style reference. Preserve all six cats' fur markings, face design, outline style and accessories, but create a SIDE VIEW walking pose with FOUR distinct short legs, facing RIGHT, instead of their existing rest poses.
Composition: exactly 3 columns by 4 rows, 12 separate sprites, transparent alpha outside the cats. Equal cells and wide transparent margins at least 12%. Every cat entirely inside its own cell, no overlap, no text, numbers, borders, grid, ground, shadows or background texture.
Rows 1-2 = phase A for cats 1-6 in row-major order; rows 3-4 = phase B for the SAME cats 1-6 in the SAME order.
Exact identity order: 1 Sunshine creamy white with golden ears and pale golden striped tail, gold sun collar charm. 2 Sprout orange striped tabby with green bow-tie. 3 Velvet smoky lilac-gray with white chest/paws, lavender beret and rose-pink bow. 4 Toast pale orange and cream, red gingham bib. 5 Mint white and cool-gray striped tail, mint bandana. 6 Luna navy-blue-gray with white cheek patch, blue collar and small silver crescent charm.
All are walking calmly to find their place in a courtyard. No yarn ball or food bowl in WALKING sprites; retain wearable accessories. Every paired cat must match body proportions, face, tail, clothing and baseline exactly; only leg stride changes: phase A near front paw forward/near hind paw back, phase B reverse. Paws at identical baseline, four legs unambiguous, natural rounded bodies.
Flat cozy hand-drawn game art, thick clean black outlines matching reference. Opaque white fur inside cats. Background truly clear transparent alpha, no fake transparency checkerboard, glow or dark haze.
```
