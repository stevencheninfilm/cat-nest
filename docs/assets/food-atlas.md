# Feeding food atlas

- Production asset: `public/assets/food-atlas.webp`
- Generation: built-in imagegen tool, transparent background enabled; generated 2026-10-13.
- Dimensions: 1254 × 1254 pixels, PNG with alpha, 3 × 3 equal cells of 418 × 418 pixels.
- Lossless WebP copy: `public/assets/food-atlas.webp`, 1,130,200 bytes versus PNG 1,659,888 bytes (31.9% smaller). Encoded using bundled Pillow with lossless, quality 100, method 6 and exact enabled. Decoded RGBA, alpha, and all visible pixels were verified identical; no resizing or cropping.
- Source output retained at `/Users/stevenchen/.codex/generated_images/01a138b2-4d81-7281-a4c6-03963bb6673e/exec-a8708717-a17e-45c4-a379-faf415704fb9.png`.
- CSS extraction: `background-size: 300% 300%`; x/y positions use `0%`, `50%`, `100%`.

| Row | Left | Center | Right |
| --- | --- | --- | --- |
| 1 | Freeze-dried fish | Dry kibble bowl | Tuna cat-food tin |
| 2 | Chicken cubes | Cooked shrimp | Salmon cubes |
| 3 | Cat mousse bowl | Cat treat tubes | Clear fresh water |

## Final generation prompt

Use case: stylized-concept
Asset type: ONE production UI sprite atlas for a mobile cat-care game.
Primary request: A square transparent-background 3 by 3 sprite atlas with exactly nine premium rounded 3D food icons. Divide canvas invisibly into nine identical square cells. Each icon centered EXACTLY at its cell center, with at least 20% empty transparent margin on all four edges of each cell. Equal visual size, coherent camera perspective, no icon crossing a cell boundary.
The nine icons, strict row-major order:
Row 1 left: three golden freeze-dried tiny fish snacks with visible fish shape; middle: a cream ceramic cat-food bowl filled with golden brown dry kibble, with one tiny raised paw motif and no lettering; right: an opened silver fish cat-food tin filled with pale tuna flakes, detached lid resting diagonally behind the tin.
Row 2 left: a small neat pile of cooked ivory chicken breast cubes; middle: three plump pink-orange peeled cooked shrimp curls; right: three glossy coral-orange salmon cubes with cream marbling.
Row 3 left: a tiny cream ceramic bowl of smooth pale rose cat mousse; middle: two unbranded soft salmon-colored cat treat tubes, with one tube open and a tiny curl of creamy treat on the tip (plain packaging, no letters, no logo); right: a short rounded transparent glass containing clear fresh water with subtle light-blue reflections.
Style/medium: polished cute game 3D product render, soft rounded forms, appetizing tactile materials, warm soft studio lighting, consistent slightly elevated three-quarter front camera. High detail suitable for enlarged hero food preview as well as tiny selection icons. Strong clean silhouette and gently beveled edges.
Scene/backdrop: actual transparent alpha, no background, no ground plane.
Constraints: ONE square canvas, exactly 3 rows and 3 columns, mathematically even cell placement. No drawn grid, no dividers, no border, no text or numbers anywhere, no labels, no logos, no watermark, no characters, no cats, no plates or serving platters. The two specifically requested small bowls and one food tin are allowed. No human spicy snacks, no drinks other than the one clear-water cup. No broad opaque shadows; keep any self shadow localized within the object. Preserve all nine complete icons without cropping.
