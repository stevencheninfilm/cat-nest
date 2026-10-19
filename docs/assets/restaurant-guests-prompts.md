# 顾客扩充 v1：12 种服装顾客

使用内置 `image_gen` 生成，直接将用户提供的三张游戏截图作为 reference：
- codex-clipboard-0099576e-a1dd-4996-bb90-8a3f97b4406a.png
- codex-clipboard-eba408ca-ad74-4e68-b59b-25dc84b5d3a6.png
- codex-clipboard-de25fb5a-8c38-41a0-8fee-fb5d8e3996ed.png

原 4 种顾客与旧存档 ID 保留。新增草帽钓客、花衬衫猫、眼镜教授、蓝帽列车长、侦探猫、耳机猫、小皇冠猫、墨镜明星、水手猫、毛线帽猫、鲨鱼帽猫和花帽猫，均有独立正背面。自然到店从 16 种造型随机选择，双人同桌不会重复造型。终端的「顾客图册」可直接预览全部顾客。

最终资源在 `public/assets/restaurant/guests-v1/`：24 张透明 WebP、`atlas.webp`（1024×1536，4 列×6 行，每格 256px）和 `manifest.json`。每两行是一组的正、背面，脚底基线统一为 y=240。`scripts/prepare-restaurant-guest-art.mjs` 按实际透明分隔带切行，避免生成图未精确等分导致帽子或脚被截断；只做裁切、缩放与图集拼装，保留生成透明度。生成原图已复制到工作区 `artifacts/restaurant-art/guests-v1/source-{1,2,3}.png`。

三个最终提示词如下。

## 图集 1

```text
Use case: stylized-concept. Asset type: production transparent 2D customer sprite atlas for a mobile cat restaurant game.
Input images 1, 2, 3 are USER-PROVIDED STYLE AND CHARACTER REFERENCES, NOT edit targets. Study the SMALL IN-GAME CUSTOMER CATS, not the typography, food, or promotional framing. Recreate their exceptionally ROUND, SQUAT, head-and-torso-as-one-ball bodies, tiny feet, short ears, tiny mitten paws, plump tails, sweet simple faces, warm dark-brown chunky outlines, flat pastel color fills and minimal cel shading. Body wider than tall, head merges directly into belly, NO neck, NO tall humanoid body, NO long legs. These need to look like the provided customers.
Create exactly ONE clean sprite sheet with FOUR equally sized columns and TWO equally sized rows, landscape aspect 2:1, ideally 2048x1024. Eight isolated sprites total, one centered in each invisible equal square cell. Top row: each of the 4 cats in a front three-quarter view gently FACING LEFT with the tail to the RIGHT. Bottom row: exact corresponding SAME CAT and SAME clothing from behind, three-quarter rear view, tail still on the RIGHT, matching colors, costume and size. Camera slightly elevated like the reference game, entire character from ears/hat to feet. Resting upright squat idle stance, arms close to body. Uniform foot baseline 92% of each cell, all characters same body scale; hats fit inside the cell. Generous transparent empty margins, no sprite overlaps a neighboring cell. Actual fully TRANSPARENT alpha background.
No scenery, no floor, no cast shadow, no labels, no text, no watermark, no grid lines, no panels, no white outlines, no food, no thought bubbles. Draw ONLY the 8 complete individual character sprites.
The four columns LEFT TO RIGHT:
1. A gray-and-cream tabby fishing visitor, wide straw sunhat with lime-green ribbon, bright light lime Hawaiian shirt with yellow flowers, dark green shorts. No fishing rod.
2. A ginger cream tabby on vacation, aqua turquoise open Hawaiian shirt with white leaf patterns, short purple trousers and small orange hibiscus flower necklace.
3. A white-and-gray elderly professor cat, square black spectacles, cream shirt, beige waistcoat with dark-brown bow tie, brown short trousers. A little paper book tucked at side, no readable writing.
4. A chubby white cat with gray ear patch in a blue conductor's jacket, navy peaked conductor cap with tiny gold badge and navy short trousers.
```

## 图集 2

```text
Use case: stylized-concept. Asset type: production transparent 2D customer sprite atlas for a mobile cat restaurant game.
Input images 1, 2, 3 are USER-PROVIDED STYLE AND CHARACTER REFERENCES, NOT edit targets. Study the SMALL IN-GAME CUSTOMER CATS, not the typography, food, or promotional framing. Recreate their exceptionally ROUND, SQUAT, head-and-torso-as-one-ball bodies, tiny feet, short ears, tiny mitten paws, plump tails, sweet simple faces, warm dark-brown chunky outlines, flat pastel color fills and minimal cel shading. Body wider than tall, head merges directly into belly, NO neck, NO tall humanoid body, NO long legs. These need to look like the provided customers.
Create exactly ONE clean sprite sheet with FOUR equally sized columns and TWO equally sized rows, landscape aspect 2:1, ideally 2048x1024. Eight isolated sprites total, one centered in each invisible equal square cell. Top row: each of the 4 cats in a front three-quarter view gently FACING LEFT with the tail to the RIGHT. Bottom row: exact corresponding SAME CAT and SAME clothing from behind, three-quarter rear view, tail still on the RIGHT, matching colors, costume and size. Camera slightly elevated like the reference game, entire character from ears/hat to feet. Resting upright squat idle stance, arms close to body. Uniform foot baseline 92% of each cell, all characters same body scale; hats fit inside the cell. Generous transparent empty margins, no sprite overlaps a neighboring cell. Actual fully TRANSPARENT alpha background.
No scenery, no floor, no cast shadow, no labels, no text, no watermark, no grid lines, no panels, no white outlines, no food, no thought bubbles. Draw ONLY the 8 complete individual character sprites.
The four columns LEFT TO RIGHT:
1. Ginger tabby detective cat in a brown checked deerstalker cap, caramel rust trench coat and dark short trousers, small round spectacles; hands empty.
2. Cream and ginger music-lover cat with bright red round over-ear headphones, cream hoodie with a tiny red accent and slate blue short trousers.
3. A very round fluffy white princess cat with a tiny gold crown, lilac purple capelet and purple puffball dress, tiny pink cheeks, elegant but cheerful.
4. A charcoal black-and-white tuxedo cat with dark sunglasses, burgundy jacket with mustard gold trim and small round gold pendant, short black trousers. NOT a human.
```

## 图集 3

```text
Use case: stylized-concept. Asset type: production transparent 2D customer sprite atlas for a mobile cat restaurant game.
Input images 1, 2, 3 are USER-PROVIDED STYLE AND CHARACTER REFERENCES, NOT edit targets. Study the SMALL IN-GAME CUSTOMER CATS, not the typography, food, or promotional framing. Recreate their exceptionally ROUND, SQUAT, head-and-torso-as-one-ball bodies, tiny feet, short ears, tiny mitten paws, plump tails, sweet simple faces, warm dark-brown chunky outlines, flat pastel color fills and minimal cel shading. Body wider than tall, head merges directly into belly, NO neck, NO tall humanoid body, NO long legs. These need to look like the provided customers.
Create exactly ONE clean sprite sheet with FOUR equally sized columns and TWO equally sized rows, landscape aspect 2:1, ideally 2048x1024. Eight isolated sprites total, one centered in each invisible equal square cell. Top row: each of the 4 cats in a front three-quarter view gently FACING LEFT with the tail to the RIGHT. Bottom row: exact corresponding SAME CAT and SAME clothing from behind, three-quarter rear view, tail still on the RIGHT, matching colors, costume and size. Camera slightly elevated like the reference game, entire character from ears/hat to feet. Resting upright squat idle stance, arms close to body. Uniform foot baseline 92% of each cell, all characters same body scale; hats fit inside the cell. Generous transparent empty margins, no sprite overlaps a neighboring cell. Actual fully TRANSPARENT alpha background.
No scenery, no floor, no cast shadow, no labels, no text, no watermark, no grid lines, no panels, no white outlines, no food, no thought bubbles. Draw ONLY the 8 complete individual character sprites.
The four columns LEFT TO RIGHT:
1. Cream tabby sailor customer wearing a soft white sailor beret with blue ribbon, blue and white striped shirt, navy sailor collar and navy short trousers.
2. A gray tabby with a pumpkin orange knitted beanie and pumpkin orange cable-knit sweater, blue short trousers, small soft smile.
3. A white cat in a cute powder-blue SHARK COSTUME hoodie, face visible inside round hood rim with a few tiny white triangular teeth, little blue fin on back, white belly, blue stumpy legs. Still unmistakably a round CAT, no pet sidekick.
4. A cream white florist cat with peach ear patches, pale pink sunhat with one small daisy, strawberry-pink puffball dress with a white collar and tiny flower pattern.
```
