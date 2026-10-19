# 厨房操作循环动画 · v2

生成模式：内置 ImageGen 生成 6 套八帧透明原画，再裁帧/对齐/缩放/编码。打蛋、切肉、取料、调味和装盘复用 v1 / foods 中的真实生图，通过确定性旋转/位移逐帧组装；没有程序绘制替代美术。

所有运行时文件为真实 animated WebP，统一 512 × 512，83 ms/帧（约 12.05 fps），loop=0 无限循环。主体内容的合并 bbox 居中于 (256,256)，逐帧 bbox 和 alpha 验证见同目录 manifest.json。请只在员工实际操作时挂载，离开/行走时卸载。

`wrap-omelette.webp` 按本轮允许的范围明确复用 `fry-rice.webp` 循环；装盘使用既有蛋包饭成品轻微转动。

## 文件 API

| step / recipe | 文件 | 帧数 | 时长 | 内容 bbox | 字节 |
|---|---|---:|---:|---|---:|
| mix-vegetables | mix-vegetables.webp | 14 | 1162 ms | 55, 57, 458, 455 | 493906 |
| wash | wash.webp | 14 | 1162 ms | 58, 61, 455, 452 | 625666 |
| fry-rice | fry-rice.webp | 14 | 1162 ms | 57, 64, 455, 448 | 558032 |
| espresso | espresso.webp | 14 | 1162 ms | 57, 33, 455, 480 | 508608 |
| steam-milk | steam-milk.webp | 14 | 1162 ms | 52, 42, 460, 471 | 484628 |
| package | package.webp | 14 | 1162 ms | 57, 39, 455, 473 | 460978 |
| beat-eggs | beat-eggs.webp | 24 | 1992 ms | 53, 39, 459, 473 | 324900 |
| chop-chicken | chop-chicken.webp | 16 | 1328 ms | 53, 82, 459, 430 | 143060 |
| gather-rice | gather-rice.webp | 16 | 1328 ms | 67, 168, 445, 345 | 231380 |
| gather-coffee | gather-coffee.webp | 16 | 1328 ms | 64, 112, 448, 401 | 258650 |
| season | season.webp | 16 | 1328 ms | 65, 148, 447, 364 | 282976 |
| plate-rice | plate-rice.webp | 16 | 1328 ms | 67, 125, 446, 388 | 386294 |
| wrap-omelette | wrap-omelette.webp | 14 | 1162 ms | 57, 64, 455, 448 | 558032 |

## 实际 ImageGen 参考输入及最终完整提示词

新截图：`/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`。每次生成均实际传入对应 v1 道具和此截图。

### mix-vegetables

实际输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/bowl-eggs.webp`
- `/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT EIGHT-FRAME SPRITE SHEET for ONE looping cooking animation in a mobile cat restaurant. Reference image 1 is the exact existing hand-painted prop style/identity; reference image 2 is the user's current kitchen screenshot to match camera and warm light (ignore all UI, text, color annotations and cats). Output image: exact 4 columns by 2 rows of EIGHT equal-size square cells, read left-to-right top row then bottom row. Each cell is an animation frame showing the SAME stationary prop at IDENTICAL SCALE and IDENTICAL CENTER/BASELINE, with the SAME camera, shape and colors. Absolutely NO panel borders, NO grid lines, NO text, NO numbering, NO backdrop; genuine transparent alpha everywhere except prop pixels. The eight frames are equally spaced poses of a seamless looping action; pose 8 leads naturally back into pose 1. Prop stays entirely inside its cell with generous 12% padding on all sides; nothing touches another frame. Keep prop size consistent across frames. Warm painterly 2D, rounded cream and sage green cookware, clean fine brown contours, soft golden highlights. Top-down elevated angle matching reference, not flat icons, not photorealistic. No characters, hands, floor, countertop, room or extra objects. Primary animation: A cream ceramic mixing bowl with sage green exterior containing chopped orange carrot cubes, green pepper cubes and white onion pieces. One wooden spoon stirs clockwise through the chopped vegetables, making a small circle across eight frames; vegetables turn and rise a little around spoon. Bowl itself must remain exactly locked in all eight frames. No egg yolks, no meat, no whisk. All eight frames show stirring, not a recipe montage.
```

原始生成：`exec-5d5ece9f-a836-424b-92e4-9eb712a49c4a.png`；压缩原画保存为 `sources/mix-vegetables-sheet.webp`。

### wash

实际输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/washing-vegetables.webp`
- `/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT EIGHT-FRAME SPRITE SHEET for ONE looping cooking animation in a mobile cat restaurant. Reference image 1 is the exact existing hand-painted prop style/identity; reference image 2 is the user's current kitchen screenshot to match camera and warm light (ignore all UI, text, color annotations and cats). Output image: exact 4 columns by 2 rows of EIGHT equal-size square cells, read left-to-right top row then bottom row. Each cell is an animation frame showing the SAME stationary prop at IDENTICAL SCALE and IDENTICAL CENTER/BASELINE, with the SAME camera, shape and colors. Absolutely NO panel borders, NO grid lines, NO text, NO numbering, NO backdrop; genuine transparent alpha everywhere except prop pixels. The eight frames are equally spaced poses of a seamless looping action; pose 8 leads naturally back into pose 1. Prop stays entirely inside its cell with generous 12% padding on all sides; nothing touches another frame. Keep prop size consistent across frames. Warm painterly 2D, rounded cream and sage green cookware, clean fine brown contours, soft golden highlights. Top-down elevated angle matching reference, not flat icons, not photorealistic. No characters, hands, floor, countertop, room or extra objects. Primary animation: The SAME sage green colander and onion, green pepper, carrot as reference. Bowl, vegetables and handles are LOCKED. Water pours from just above colander in a short continuous clear-blue stream, rippling and gently swaying across eight frames; a few droplets and tiny clean water bubbles move cyclically around rim, each droplet disappears before next loop. The whole prop includes colander and water, but NO faucet. Keep short water stream and leaves entirely within each frame. This is a stable wash action loop, not a different bowl per cell.
```

原始生成：`exec-9d908ad0-21ea-4d37-a454-84a869b065b3.png`；压缩原画保存为 `sources/wash-sheet.webp`。

### fry-rice

实际输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/wok-fried-rice.webp`
- `/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT EIGHT-FRAME SPRITE SHEET for ONE looping cooking animation in a mobile cat restaurant. Reference image 1 is the exact existing hand-painted prop style/identity; reference image 2 is the user's current kitchen screenshot to match camera and warm light (ignore all UI, text, color annotations and cats). Output image: exact 4 columns by 2 rows of EIGHT equal-size square cells, read left-to-right top row then bottom row. Each cell is an animation frame showing the SAME stationary prop at IDENTICAL SCALE and IDENTICAL CENTER/BASELINE, with the SAME camera, shape and colors. Absolutely NO panel borders, NO grid lines, NO text, NO numbering, NO backdrop; genuine transparent alpha everywhere except prop pixels. The eight frames are equally spaced poses of a seamless looping action; pose 8 leads naturally back into pose 1. Prop stays entirely inside its cell with generous 12% padding on all sides; nothing touches another frame. Keep prop size consistent across frames. Warm painterly 2D, rounded cream and sage green cookware, clean fine brown contours, soft golden highlights. Top-down elevated angle matching reference, not flat icons, not photorealistic. No characters, hands, floor, countertop, room or extra objects. Primary animation: The SAME charcoal gray wok and golden egg fried rice, diced chicken, green pepper, carrot and onion, wooden handle lower right. One short cream wooden spatula stirs continuously in an oval and scoops the rice slightly, a few grains lift then settle back. Eight successive phases of ONE gentle stir-fry/toss cycle; warm steam curls change slightly. Wok body itself stays almost stationary (at most subtle 2 degree rocking), handle and camera identical. No fire or stove. No montage of different dishes.
```

原始生成：`exec-6bd52b52-e13d-4cc1-a890-7ab3cd39d602.png`；压缩原画保存为 `sources/fry-rice-sheet.webp`。

### espresso

实际输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/coffee-espresso.webp`
- `/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT EIGHT-FRAME SPRITE SHEET for ONE looping cooking animation in a mobile cat restaurant. Reference image 1 is the exact existing hand-painted prop style/identity; reference image 2 is the user's current kitchen screenshot to match camera and warm light (ignore all UI, text, color annotations and cats). Output image: exact 4 columns by 2 rows of EIGHT equal-size square cells, read left-to-right top row then bottom row. Each cell is an animation frame showing the SAME stationary prop at IDENTICAL SCALE and IDENTICAL CENTER/BASELINE, with the SAME camera, shape and colors. Absolutely NO panel borders, NO grid lines, NO text, NO numbering, NO backdrop; genuine transparent alpha everywhere except prop pixels. The eight frames are equally spaced poses of a seamless looping action; pose 8 leads naturally back into pose 1. Prop stays entirely inside its cell with generous 12% padding on all sides; nothing touches another frame. Keep prop size consistent across frames. Warm painterly 2D, rounded cream and sage green cookware, clean fine brown contours, soft golden highlights. Top-down elevated angle matching reference, not flat icons, not photorealistic. No characters, hands, floor, countertop, room or extra objects. Primary animation: The exact SAME cream espresso cup, sage handle right, and cream-and-sage saucer as reference, locked to a fixed position. One small warm silver espresso portafilter nozzle is visible just above cup at upper center, NOT an entire machine. Fresh brown espresso pours from nozzle as two short fine brown streams into cup. Across eight equally spaced frames streams ripple, coffee surface crema swirls and a few bubbles move cyclically, never overfilling. Tiny steam puff rises, vanishes and renews. Cup, saucer and nozzle stay totally locked in place. No spoon. Continuous extraction loop.
```

原始生成：`exec-347c37df-94fe-4573-a50e-ca6a85edbde8.png`；压缩原画保存为 `sources/espresso-sheet.webp`。

### steam-milk

实际输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/milk-pitcher.webp`
- `/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT EIGHT-FRAME SPRITE SHEET for ONE looping cooking animation in a mobile cat restaurant. Reference image 1 is the exact existing hand-painted prop style/identity; reference image 2 is the user's current kitchen screenshot to match camera and warm light (ignore all UI, text, color annotations and cats). Output image: exact 4 columns by 2 rows of EIGHT equal-size square cells, read left-to-right top row then bottom row. Each cell is an animation frame showing the SAME stationary prop at IDENTICAL SCALE and IDENTICAL CENTER/BASELINE, with the SAME camera, shape and colors. Absolutely NO panel borders, NO grid lines, NO text, NO numbering, NO backdrop; genuine transparent alpha everywhere except prop pixels. The eight frames are equally spaced poses of a seamless looping action; pose 8 leads naturally back into pose 1. Prop stays entirely inside its cell with generous 12% padding on all sides; nothing touches another frame. Keep prop size consistent across frames. Warm painterly 2D, rounded cream and sage green cookware, clean fine brown contours, soft golden highlights. Top-down elevated angle matching reference, not flat icons, not photorealistic. No characters, hands, floor, countertop, room or extra objects. Primary animation: The exact SAME squat rounded stainless-steel milk pitcher with handle right and milk foam as reference. A short slim angled silver steam wand reaches into milk from upper left. Show eight successive phases of milk-frothing: small foam bubbles move in a circular whirlpool around wand tip and two soft steam curls rise and disappear, milk surface gently swirls and changes. Metal pitcher, handle and steam wand are locked in position and size. No hands, no machine. No milk spilling. Continuous frothing loop.
```

原始生成：`exec-70ffc016-fc9c-4093-858f-3d0c9614d496.png`；压缩原画保存为 `sources/steam-milk-sheet.webp`。

### package

实际输入：

- `/Users/stevenchen/.codex/worktrees/de22/猫猫判官/public/assets/restaurant/kitchen-v1/latte-cup.webp`
- `/Users/stevenchen/Downloads/截屏2026-10-18 上午10.45.21.png`

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT EIGHT-FRAME SPRITE SHEET for ONE looping cooking animation in a mobile cat restaurant. Reference image 1 is the exact existing hand-painted prop style/identity; reference image 2 is the user's current kitchen screenshot to match camera and warm light (ignore all UI, text, color annotations and cats). Output image: exact 4 columns by 2 rows of EIGHT equal-size square cells, read left-to-right top row then bottom row. Each cell is an animation frame showing the SAME stationary prop at IDENTICAL SCALE and IDENTICAL CENTER/BASELINE, with the SAME camera, shape and colors. Absolutely NO panel borders, NO grid lines, NO text, NO numbering, NO backdrop; genuine transparent alpha everywhere except prop pixels. The eight frames are equally spaced poses of a seamless looping action; pose 8 leads naturally back into pose 1. Prop stays entirely inside its cell with generous 12% padding on all sides; nothing touches another frame. Keep prop size consistent across frames. Warm painterly 2D, rounded cream and sage green cookware, clean fine brown contours, soft golden highlights. Top-down elevated angle matching reference, not flat icons, not photorealistic. No characters, hands, floor, countertop, room or extra objects. Primary animation: The exact SAME cream-and-sage green latte cup and saucer, handle right, as reference. A small rounded stainless-steel milk pitcher hovers and tilts at upper right with spout pointing into cup, pouring a thin white milk stream. In eight successive positions the pitcher spout gently moves left-right over coffee, stream changes slightly and a small clean foam heart with subtle rings ripples on the surface; finish returns to a matching start pose, a continuous decorative latte pour loop, no abrupt change in container shape. Cup and saucer stay completely locked; no hands, no written labels, no giant additional objects.
```

原始生成：`exec-6d99b28d-7f1c-420c-a023-0806bbb99a24.png`；压缩原画保存为 `sources/package-sheet.webp`。

## 复用变换

- beat-eggs：固定蛋液碗；独立打蛋器 24 帧椭圆运动（水平 ±11 px、垂直 ±7 px）与 ±11° 摆动。
- chop-chicken：固定切肉案板；刀 16 帧两个上抬/下切周期（最高抬 25 px），水平 ±6 px 与 ±7° 摆动。
- gather-rice / gather-coffee：既有取料托盘 16 帧 ±2.4° 轻摆，垂直 ±9 / ±8 px。
- season：既有调料托盘 16 帧 ±3.2° 轻晃，垂直 ±3 px。
- plate-rice：既有 foods/rice.webp 蛋包饭成品 16 帧 ±2.6° 轻转，垂直 ±3 px。
- 所有变换最后对整段动画使用共同 alpha 合并边界与同一画布变换，避免逐帧独立裁切造成位置跳动。

## 校验

- 每个文件用 animated decode 重新读取，验证页面数、512 高帧、loop=0 和所有 delay=83 ms。
- 每帧检查 alpha min=0 / max≥250，且至少 4 个不同 decoded SHA256；防止静态图误标循环。
- qa-filmstrip.webp 每行依上表顺序给出四个四分之一周期采样，供布局核对。
