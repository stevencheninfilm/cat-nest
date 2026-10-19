# 餐厅装扮美术 — B 组

- 生成工具：内置 `image_gen.imagegen`，每套独立调用。
- 输入图角色：`public/assets/restaurant/restaurant-scene.webp` 为直接编辑目标与几何参考，已先用 `view_image` 检查。
- 输出尺寸：三套均原生生成 **940 × 1672**，无裁切、无拉伸；仅使用 Pillow 以 quality=91 / method=6 编码 WebP。
- 目检：六桌、桌椅尺寸、入口、中央通道、隔墙开口、厨房设备分区均保留；无角色、文字、UI。
- 三个主题均完整替换桌椅、窗框、墙灯、厨柜与地面；原图保留于 `artifacts/restaurant-art/decor/<theme>/scene-original.png`。

## mint-seaside

- 最终资源：`public/assets/restaurant/decor/mint-seaside/scene.webp`
- 原始输出：Generated images are saved to /Users/stevenchen/.codex/generated_images/01a14e40-49e0-7593-9ffb-da0c6d8857d2 as /Users/stevenchen/.codex/generated_images/01a14e40-49e0-7593-9ffb-da0c6d8857d2/exec-1da0fd28-4166-4b97-a07d-b1060d4d9c7a.png by default.
If you need to use a generated image at another path, copy it and leave the original in place unless the user explicitly asks you to delete it.
The generated image is already displayed to the user. There is no need to render it in the final response as a Markdown image or file link.

```text
Use case: precise-object-edit
Asset type: production game environment background, a single complete fully decorated portrait 2D restaurant scene for a mobile browser game.
Input image: the attached existing restaurant-scene.webp is the EDIT TARGET and exact geometry reference. Preserve its camera, perspective, room outline and gameplay layout precisely.
Primary request: Create the MINT SEASIDE edition: a charming little mint and sea-salt seaside cat restaurant, with complete coherent themed tables, chairs, floors, walls, light fixtures, windows, kitchen cabinets, small plants, wall ornaments and kitchen hardware.
Style/medium: match the source's polished cozy hand-painted 2D illustration with clean rounded edges, fine warm outlines, soft shaded surfaces and legible game-sized props.
Theme: pale mint green, ivory, seafoam and restrained marine blue; whitewashed warm timber dining floor, sea-glass green window trim, striped blue-ivory entrance awning, views of a soft turquoise sea beyond the upper facade windows, small shells and rope ornaments ON walls and shelves, frosted shell-shaped warm sconces, light mint ceramic table tops, upholstered ivory stools, pale turquoise cabinets with brass handles, cream and aqua checker kitchen tile, pale blue espresso machine. Keep ornaments small and charming. This is a full actual themed environment, not a color filter.
Critical locked geometry: match the entire reference composition edge to edge in 940 x 1672 portrait proportion. Upper exterior facade occupies y=0–15%, inside dining room y=15–67%, kitchen y=68–94%, bottom cabinetry y=85–95%. The inner entrance gap is centered x=50% at y=17%, directly between the two glass wall/window spans. Exactly SIX oval tables with two small round stools per table, with table centers at percentage coordinates (24.5,31.4), (75.3,31.4), (23.7,43.3), (76.2,43.3), (22.8,55.1), (77.3,55.1). Keep table dimensions identical to the reference, width about 15%; do not invent other tables. Central walking corridor x=40–60% remains open and empty for animated cats. Keep the lower centered dining-to-kitchen opening at y=64–68%. Kitchen retains the source's exact U/L counter shapes: slim vertical work counters down left and right, horizontal bottom worktop, paired ovens bottom center, sink bottom right, coffee machine left; keep the inside kitchen floor open.
Reserve three overlay ornament slots with only quiet matching background: left inner window sill at x12%,y24%; right wall shelf at x91%,y45%; kitchen right corner at x88%,y78%. No large props in those slots.
Text: none. No typography, signs, logos, poster captions or UI.
Avoid: cats, people, characters, animals, customer bubbles, food orders, floating coins, construction tools, game controls, screen frames, mockup devices, arrows, readable text. Do not zoom, rotate, reframe, crop, change table count, block walkways, move furniture or add a scenic foreground. Output the scene only, fully fills image.
```

## sakura-teahouse

- 最终资源：`public/assets/restaurant/decor/sakura-teahouse/scene.webp`
- 原始输出：Generated images are saved to /Users/stevenchen/.codex/generated_images/01a14e40-49e0-7593-9ffb-da0c6d8857d2 as /Users/stevenchen/.codex/generated_images/01a14e40-49e0-7593-9ffb-da0c6d8857d2/exec-d2a89ea5-c13c-4e37-850f-9f3afdb2a31f.png by default.
If you need to use a generated image at another path, copy it and leave the original in place unless the user explicitly asks you to delete it.
The generated image is already displayed to the user. There is no need to render it in the final response as a Markdown image or file link.

```text
Use case: precise-object-edit
Asset type: production game environment background, a single complete fully decorated portrait 2D restaurant scene for a mobile browser game.
Input image: the attached existing restaurant-scene.webp is the EDIT TARGET and exact geometry reference. Preserve its camera, perspective, room outline and gameplay layout precisely.
Primary request: Create the SAKURA TEAHOUSE daytime edition: a cozy Japanese cherry-blossom tea and dessert house, with complete themed tables, chairs, floors, walls, light fixtures, windows, kitchen cabinets, small plants, wall ornaments and kitchen hardware.
Style/medium: match the source's polished cozy hand-painted 2D illustration with clean rounded edges, fine warm outlines, soft shaded surfaces and legible game-sized props.
Theme: blush sakura pink and cream with warm honey cedar wood, Japanese paper-and-wood lattice window trim, small cherry trees and flowering bushes outdoors above the facade, soft pink and ivory striped entrance awning, delicate cherry branch wall art and subtle pink petal motif glazed tabletop surfaces, cream seat cushions with tiny plum trim, warm paper lantern sconces and hanging lanterns where source light fixtures sit, pale pink tea jars and ceramic cups on existing kitchen shelves, light cedar cabinets with round brass handles, cream and soft pink checker kitchen tile, dusty pink espresso machine and pastel kitchen equipment. Paper lattice details fit within existing window rectangles, do not close entrance. This is a complete beautiful usable environment, not a filter.
Critical locked geometry: match the entire reference composition edge to edge in 940 x 1672 portrait proportion. Upper exterior facade occupies y=0–15%, inside dining room y=15–67%, kitchen y=68–94%, bottom cabinetry y=85–95%. The inner entrance gap is centered x=50% at y=17%, directly between the two glass wall/window spans. Exactly SIX oval tables with two small round stools per table, with table centers at percentage coordinates (24.5,31.4), (75.3,31.4), (23.7,43.3), (76.2,43.3), (22.8,55.1), (77.3,55.1). Keep table dimensions identical to the reference, width about 15%; do not invent other tables. Central walking corridor x=40–60% remains open and empty for animated cats. Keep the lower centered dining-to-kitchen opening at y=64–68%. Kitchen retains the source's exact U/L counter shapes: slim vertical work counters down left and right, horizontal bottom worktop, paired ovens bottom center, sink bottom right, coffee machine left; keep the inside kitchen floor open.
Reserve three overlay ornament slots with only quiet matching background: left inner window sill at x12%,y24%; right wall shelf at x91%,y45%; kitchen right corner at x88%,y78%. No large props in those slots.
Lighting/mood: fresh bright soft morning sunshine, warm welcoming tea-house light; do not darken.
Text: none. No typography, signs, logos, poster captions or UI.
Avoid: cats, people, characters, animals, customer bubbles, food orders, floating coins, construction tools, game controls, screen frames, mockup devices, arrows, readable text, torii gates, giant bonsai, extra furniture. Do not zoom, rotate, reframe, crop, change table count, block walkways, move furniture or add a scenic foreground. Output the scene only, fully fills image.
```

## sakura-evening

- 最终资源：`public/assets/restaurant/decor/sakura-evening/scene.webp`
- 原始输出：Generated images are saved to /Users/stevenchen/.codex/generated_images/01a14e40-49e0-7593-9ffb-da0c6d8857d2 as /Users/stevenchen/.codex/generated_images/01a14e40-49e0-7593-9ffb-da0c6d8857d2/exec-7323a7b2-ab93-44bb-9eb6-3b8d1d7a4df8.png by default.
If you need to use a generated image at another path, copy it and leave the original in place unless the user explicitly asks you to delete it.
The generated image is already displayed to the user. There is no need to render it in the final response as a Markdown image or file link.

```text
Use case: precise-object-edit
Asset type: production game environment background, a single complete fully decorated portrait 2D restaurant scene for a mobile browser game.
Input image: the attached existing restaurant-scene.webp is the EDIT TARGET and exact geometry reference. Preserve its camera, perspective, room outline and gameplay layout precisely.
Primary request: Create the SAKURA EVENING edition: an elegant cozy cherry-blossom dessert house at blue-hour dusk, complete with a cohesive new set of tables, chairs, floors, walls, light fixtures, windows, kitchen cabinets, plants, wall ornaments and kitchen hardware. This must feel visibly different from a daytime teahouse.
Style/medium: match the source's polished cozy hand-painted 2D illustration with clean rounded edges, fine warm outlines, soft shaded surfaces and legible game-sized props.
Theme: dusk indigo and dusty lavender OUTDOORS, warm cherry blossom blush and ivory INSIDE, subtle restrained gold accents, rich rosy warm wood. Upper exterior garden and glass views show pink flowering cherry trees against soft periwinkle twilight, a few small string lights only across the exterior garden hedge. Burgundy and ivory striped entrance awning; plum-brown wood window frames with delicate Japanese lattice details inside the existing window rectangles. Hanging and wall-mounted softly glowing warm pink paper lanterns replace the reference light fixtures at the same positions. Six tables use cream pink glazed tabletops with tiny gold petal motifs and walnut pedestals; round stools have dusty rose cushions with pale gold piping. Existing wall shelves hold small pink and ivory dessert ceramics, a cherry blossom branch in one small vase and understated gold ornaments. Kitchen: deep dusty rose cabinets with small brass hardware, ivory and muted lavender checker tile, rose-tinted stone countertop, ivory-gold espresso machine, paired blush and plum ovens at existing positions. The room must remain bright, clean, cozy and readable at mobile game size; warm ambient fill light, no dark vignette. NO floating petals, sparkles or decorations across floor gameplay areas.
Critical locked geometry: match the entire reference composition edge to edge in 940 x 1672 portrait proportion. Upper exterior facade occupies y=0–15%, inside dining room y=15–67%, kitchen y=68–94%, bottom cabinetry y=85–95%. The inner entrance gap is centered x=50% at y=17%, directly between the two glass wall/window spans. Exactly SIX oval tables with two small round stools per table, with table centers at percentage coordinates (24.5,31.4), (75.3,31.4), (23.7,43.3), (76.2,43.3), (22.8,55.1), (77.3,55.1). Keep table dimensions identical to the reference, width about 15%; do not invent other tables. Central walking corridor x=40–60% remains open and empty for animated cats. Keep the lower centered dining-to-kitchen opening at y=64–68%. Kitchen retains the source's exact U/L counter shapes: slim vertical work counters down left and right, horizontal bottom worktop, paired ovens bottom center, sink bottom right, coffee machine left; keep the inside kitchen floor open.
Reserve three overlay ornament slots with only quiet matching background: left inner window sill at x12%,y24%; right wall shelf at x91%,y45%; kitchen right corner at x88%,y78%. No large props in those slots.
Text: none. No typography, signs, logos, poster captions or UI.
Avoid: cats, people, characters, animals, customer bubbles, food orders, floating coins, construction tools, game controls, screen frames, mockup devices, arrows, readable text, giant props. Do not zoom, rotate, reframe, crop, change table count, block walkways, move furniture or add a scenic foreground. Output the scene only, fully fills image.
```
