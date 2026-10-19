# 员工休息室美术资源

生成日期：2026-10-18。工具：内置 `image_gen.imagegen`；两个资源分别调用生成，未使用 CLI/API。生成前已通过 `view_image` 查看参考。

## 参考图角色

- `public/assets/restaurant/decor/cream-bakery/scene.webp`：餐厅材质、暖光和2D游戏场景风格参考。
- `public/assets/restaurant/cat-sprites.webp`：仅作为圆润造型与柔和描边风格参考；两件最终资源均无角色。

## 资源与锚点

| 资源 | 尺寸 / 格式 | 大小 | 放置建议 |
| --- | --- | --- | --- |
| `public/assets/restaurant/staff-rest/door.webp` | 384×768 RGBA WebP | 51,894 bytes | 场景右墙 x94%、y47% 附近，宽约场景8–10%；底边锚点 `(0.5,0.979167)` |
| `public/assets/restaurant/staff-rest/lounge.webp` | 960×600 RGB WebP | 90,690 bytes | 员工休息面板整幅背景；下部中央空地用于代码放置休息员工 |

门图透明检查：四角 alpha 均为0，29.78%像素完全透明；非透明边界 [12,16,372,751]，没有触及画布边缘。门牌仅有茶杯/月亮图案；“休息室”文字由代码添加。

休息室为暖木长椅、奶油与薄荷软垫、左侧茶桌、右后方饮水站、绿植和暖灯；无猫、无文字或UI。下方中央保持空地。

## 原始产物与处理

门图原始来源：`/Users/stevenchen/.codex/generated_images/01a14e3f-73d0-7fd2-9006-eab7bbe549ab/exec-6f79a244-8af3-427d-8b93-d2af79602fb7.png`（937×1678，RGBA）。完整原稿副本：`artifacts/restaurant-art/staff-rest/door-original.png`。

休息室原始来源：`/Users/stevenchen/.codex/generated_images/01a14e3f-73d0-7fd2-9006-eab7bbe549ab/exec-fc4e05ee-1816-45db-afc6-d6643a542b34.png`（1586×992，RGB）。完整原稿副本：`artifacts/restaurant-art/staff-rest/lounge-original.png`。

门图仅以Sharp按透明边trim（threshold=8），主体等比缩放到最大368×736，水平居中并在透明384×768画布底部保留16px，再以WebP quality=90、alphaQuality=100、effort=6编码。休息室以Sharp按 `fit:cover, position:centre` 适配960×600（原图比例与目标极接近），WebP quality=90、effort=6编码。没有以代码绘制或替换任何美术内容。

## 门图完整调用提示词

`transparent_background: true`，`referenced_image_paths` 为上述两个参考图。

```text
Use case: stylized-concept. Asset type: one isolated transparent game prop, a narrow staff lounge doorway placed on the right side wall of a cozy portrait cat restaurant game.
Input image 1 cream-bakery/scene.webp is the material, lighting and perspective reference. Input image 2 cat-sprites.webp is ONLY a rounded playful style reference; do not put any cat or character in the output.
Primary request: one beautiful compact warm honey wood arched staff lounge door, viewed from the same slightly elevated 2D game camera as the side-wall furniture in image 1. Door is gently ajar showing a softly lit cream interior sliver. Rounded cream inset door panel, caramel oak frame, little brass round handle, one small warm brass wall lantern mounted tightly above the left upper door edge. Above the arch, a tiny oval wooden plaque carved with a simple steaming tea-cup and crescent-moon symbol, absolutely no letters or words. The plaque is small and integrated in the door silhouette. A few tiny green leaves decorate the top-right frame edge. Keep its entire silhouette narrow and tall, aspect about 1:1.8, designed to remain readable when shown at 8–10 percent of a 940px wide game scene. No broad porch, no steps projecting forward, no large scenery.
Style: polished cozy hand-painted 2D mobile game illustration, softly rounded corners, clean warm brown outlines, creamy warm highlights, subtle wood grain and gentle illustrated shading matching image 1. Cheerful restful mood, no photorealism.
Composition: full prop centered in a portrait canvas with generous transparent padding; complete lantern, plaque, frame and door base visible. Front visible face very slightly turned left to sit on the restaurant RIGHT wall, no extreme perspective.
Background must be genuinely transparent with alpha, no room, no wall rectangle, no floor, no ground shadow outside silhouette, no checkerboard painted in. No cats, people, letters, text, UI or watermark. Only ONE door assembly.
```

## 休息室完整调用提示词

`transparent_background: false`，`referenced_image_paths` 为上述两个参考图。

```text
Use case: stylized-concept. Asset type: complete landscape staff lounge interior background for a mobile cat restaurant game's rest panel; exact 960 x 600 aspect ratio.
Input image 1 cream-bakery/scene.webp is the warm environment/material and game illustration style reference. Input image 2 cat-sprites.webp is ONLY the playful rounded shape style reference; do NOT draw any cat, animal or human.
Primary request: a cozy little employees-only staff rest lounge behind the honey cream bakery, complete environment without interface. Warm honey oak timber, creamy plaster walls, soft sage and gingham cushions, sunlight from a small upper window with thin white curtains, warm brass wall lamps, little green plants. A long low wooden bench with plump cream and sage seat cushions runs along the BACK wall, empty and wide enough for multiple very round cats. On the rear right is a compact water/tea station, rounded ceramic water pitcher, cups and a simple drinking water dispenser on a small wood cabinet. On the rear left a short little wall shelf has folded towels and a tiny potted plant. A small low round tea table is offset toward the LEFT near the bench, holding one cream teapot and cups. A pair of soft neutral floor pillows near the extreme right wall. Every object must be charming, rounded, high-quality hand-painted 2D game illustration with warm brown outlines, gently shaded materials, coherent cozy restaurant art.
Composition: slightly elevated front view of the entire small room, beautiful complete illustration fills entire 960:600 landscape frame with no border. Keep furniture and accessory silhouettes mostly in upper 65 percent and at extreme side edges. The lower 35 percent is open, unobstructed warm wooden floor with a very subtle small cream oval rug at back edge only, reserved for placing animated resting staff characters in code. Do NOT put the table or props in the lower central foreground. No giant foreground items, no doors blocking scene, no dark corners.
Mood: welcoming, peaceful, soft golden afternoon light and reassuring warm lamps. Clear readable at phone-panel scale, no photorealism, no excessive tiny clutter.
No cats, animals, people, characters, visible writing, numbers, letters, signs, UI, speech bubbles, progress bars, phone frame, watermark. No empty graphic UI boxes. This is a real fully painted environment background.
```
