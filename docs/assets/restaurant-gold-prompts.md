# 餐厅金鱼干与高级解锁美术 · v1

生成模式：内置 ImageGen。每件独立生成，并在工作区保存透明 WebP；只进行保留 alpha 的尺寸与编码整理，未用程序绘制替代美术。

## 参考输入

- 用户金鱼干参考：`/var/folders/99/d_hn_8rd37d0k1mdjkf20y7m0000gn/T/codex-clipboard-36180a03-481e-4326-a458-d24dc06bc026.png`，实际传入金鱼干生成，提取金色鱼形与闪光特征。
- 既有场景：`public/assets/restaurant/restaurant-scene.webp`，实际传入全部七件生成以匹配奶油、暖金与鼠尾草绿的手绘风。
- 既有食物图集：`public/assets/restaurant/food-sprites.webp`，实际传入三件高级菜品生成。

## 资源与用途

| 文件 | 用途 |
| --- | --- |
| `gold-fish.webp` | 稀有货币金鱼干 |
| `special-salmon.webp` | 黄金三文鱼饭 |
| `special-sundae.webp` | 金箔草莓圣代 |
| `special-latte.webp` | 皇家鱼鱼拿铁 |
| `theme-starlight.webp` | 星光金叶灯 |
| `theme-glass.webp` | 樱花琉璃窗 |
| `theme-royal.webp` | 皇家猫爪招牌 |

所有资源位于 `public/assets/restaurant/gold-v1/`，正方形 512 px 透明画布，适合菜单、奖励、货币栏与装扮面板。`contact-sheet.webp` 为检视缩略图，`manifest.json` 记录原始输出和尺寸。

## 最终提示词

### gold-fish

```text
Use case: stylized-concept. Asset type: ONE isolated transparent rare-currency sprite for a mobile cat restaurant game. Input images: image 1 is the user's direct design reference for golden dried fish currency (small golden fish silhouette with bright twinkles in the shop cards); image 2 is the restaurant's material and cozy color reference. Primary request: create a single plump curved GOLDEN DRIED FISH currency token, clear fish head at left with one tiny brown dot eye, tiny rounded fins and short fork tail at right. Match reference golden fish motif, but polished warm hand-painted game asset with clean deep brown outline, buttery gold body, amber lower shading, soft cream reflective highlights, 3 small four-point gold sparkles around it. Cute rounded proportions; silhouette unmistakable at 24px. Composition: centered full token occupying 75% canvas, 12% clear padding. Camera front-facing icon slightly tilted upward. Background: genuine transparent alpha. No coin disc, no card, no scene, no text, no number, no watermark, no people or cats.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-5325a236-6533-4698-bd68-91eed99d3e54.png`

### special-salmon

```text
Use case: stylized-concept. Asset type: ONE isolated transparent premium food icon for the existing mobile cat restaurant. Input images: image 1 is the existing restaurant environment color/material reference; image 2 is the game's current food sprite style reference. Style: appealing ROUND soft plump hand-painted 2D food, deep warm brown clean outlines, warm cozy highlights, cute mobile game proportions, soft texture and clear silhouettes. Camera: elevated three-quarter top-down matching food icons; whole object centered, 12% transparent safety padding. Background: genuine transparent alpha, no environment. No text, numbers, labels, watermark, people, cats, floating UI, card frame. Primary request: A premium golden salmon rice bowl. One shallow ivory ceramic bowl with a thin ornate gold rim, fluffy warm white rice, 3 thick grilled salmon slices with golden seared edges, a tiny edible gold leaf on the salmon, 2 small broccoli florets and a lemon wedge to one side. Clearly a rice dish; delicious glossy orange salmon is the focus. A small golden fish-shaped biscuit rests near the rice edge as the special currency motif.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-d063343a-5bbb-4f4e-9801-08fac5244ea0.png`

### special-sundae

```text
Use case: stylized-concept. Asset type: ONE isolated transparent premium food icon for the existing mobile cat restaurant. Input images: image 1 is the existing restaurant environment color/material reference; image 2 is the game's current food sprite style reference. Style: appealing ROUND soft plump hand-painted 2D food, deep warm brown clean outlines, warm cozy highlights, cute mobile game proportions, soft texture and clear silhouettes. Camera: elevated three-quarter top-down matching food icons; whole object centered, 12% transparent safety padding. Background: genuine transparent alpha, no environment. No text, numbers, labels, watermark, people, cats, floating UI, card frame. Primary request: A premium gold leaf strawberry ice cream sundae. One elegant footed glass dessert cup with rosy strawberry layers, big rounded vanilla soft serve swirl, three plump red strawberry halves, tiny gold leaf flakes and a small golden fish-shaped biscuit topper. Gold trim on the foot and rim. Sweet cream and vivid strawberry pink, visibly premium and charming.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-ce9e67e2-7705-49f6-859a-7699a925ea67.png`

### special-latte

```text
Use case: stylized-concept. Asset type: ONE isolated transparent premium food icon for the existing mobile cat restaurant. Input images: image 1 is the existing restaurant environment color/material reference; image 2 is the game's current food sprite style reference. Style: appealing ROUND soft plump hand-painted 2D food, deep warm brown clean outlines, warm cozy highlights, cute mobile game proportions, soft texture and clear silhouettes. Camera: elevated three-quarter top-down matching food icons; whole object centered, 12% transparent safety padding. Background: genuine transparent alpha, no environment. No text, numbers, labels, watermark, people, cats, floating UI, card frame. Primary request: One royal fish latte in a plump ivory porcelain cup and matching saucer with a thin gold rim, tiny crown-shaped gold accent on the cup front. On warm brown coffee, creamy milk foam clearly depicts a simple plump fish with one tiny dot eye and forked tail; a few gold leaf flakes. Small gold spoon on saucer, luxurious cozy caramel and cream colors, no additional dishes.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-027f343c-99a7-4c2c-a51a-9623aaba752c.png`

### theme-starlight

```text
Use case: stylized-concept. Asset type: ONE isolated transparent restaurant decoration / unlockable premium game item icon. Input image 1: existing restaurant scene as exact material, camera, color, art style reference. Match warm finely hand-painted 2D storybook mobile game objects, rounded corners and friendly plump proportions, clear deep warm brown outline, soft cream golden highlights and sage accents. Composition: whole single object centered with 12% safe transparent margin, elevated front view, clean silhouette readable when small. Background: genuine transparent alpha. No scene, wall, floor, card, text, labels, numbers, watermark, characters or cats. Primary request: One charming small standing STARLIGHT GOLD LEAF LAMP for the restaurant. A rounded sturdy antique-brass base, sage green stem bending gracefully, two thick golden ginkgo-like leaves and one downward hanging round warm honey glass lantern shaped like a plump glowing star. Cozy botanical premium furniture, a single complete lamp; no wires or people.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-2151b579-7fe0-45ea-960f-feeb864bd909.png`

### theme-glass

```text
Use case: stylized-concept. Asset type: ONE isolated transparent restaurant decoration / unlockable premium game item icon. Input image 1: existing restaurant scene as exact material, camera, color, art style reference. Match warm finely hand-painted 2D storybook mobile game objects, rounded corners and friendly plump proportions, clear deep warm brown outline, soft cream golden highlights and sage accents. Composition: whole single object centered with 12% safe transparent margin, elevated front view, clean silhouette readable when small. Background: genuine transparent alpha. No scene, wall, floor, card, text, labels, numbers, watermark, characters or cats. Primary request: One premium CHERRY BLOSSOM STAINED GLASS WINDOW, presented as an isolated complete decorative window frame for the restaurant. Rounded arched top and warm wood and thin brass border, pastel aqua and rose glass panes, a graceful cherry blossom branch with 3 plump pink sakura flowers across the glass, soft glass highlights. Wide rounded rectangular silhouette, whole frame clearly visible. No wall around it.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-1c9dc4ae-4ea0-411c-bee5-c2648c9d16ea.png`

### theme-royal

```text
Use case: stylized-concept. Asset type: ONE isolated transparent restaurant decoration / unlockable premium game item icon. Input image 1: existing restaurant scene as exact material, camera, color, art style reference. Match warm finely hand-painted 2D storybook mobile game objects, rounded corners and friendly plump proportions, clear deep warm brown outline, soft cream golden highlights and sage accents. Composition: whole single object centered with 12% safe transparent margin, elevated front view, clean silhouette readable when small. Background: genuine transparent alpha. No scene, wall, floor, card, text, labels, numbers, watermark, characters or cats. Primary request: One premium ROYAL CAT PAW RESTAURANT SIGN. An oval ivory enamel hanging shop sign with thick antique gold scalloped border, crowned by one small rounded golden crown, central large simple gold cat paw emblem with four toe beans; two short gold chains above and a sage ribbon accent below with no lettering. Charming soft handcrafted proportions. Entire sign and chains visible; no text, no wall, no lamp.
```

原始输出：`/Users/stevenchen/.codex/generated_images/01a14e16-4694-76e3-8db4-36f4a767e639/exec-2965f5c9-f789-4d63-8eb9-d40a7a571ecf.png`
