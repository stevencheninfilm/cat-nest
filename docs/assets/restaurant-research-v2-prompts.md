# 研发工坊舞台背景

生成方式：内置 ImageGen。最终资源：`public/assets/restaurant/research-v2/atelier.jpg`。由原生生成 PNG 转为 JPEG 用于手机背景；卡牌、食品、猫猫员工、文字和抽奖光效全部独立渲染，没有烘焙进背景。

参考图 1：用户提供的「大盛グルメ食堂」封面，取餐厅环绕构图与暖金氛围；参考图 2：现有 `cat-sprites.webp`，匹配圆润角色所在世界的配色与线条。背景本身不含人物、文字或卡牌。

原始生成提示词：

> Use case: illustration-story. Asset type: production background for a mobile cat restaurant recipe-research lottery hero panel. Reference image 1 is composition reference ONLY: cheerful isometric restaurant, warm golden light, polished festive presentation, food along top and a ring of chefs near the bottom. Do NOT reproduce its text, logo, pixel art or humans. Reference image 2 defines the existing game's art style: very round plump cats, soft clean hand-drawn outlines, cream/ochre/mint palette. Create the BACKGROUND ONLY: an exquisitely illustrated cozy open-plan cat culinary research atelier, slightly elevated isometric view, detailed cream counters and warm wooden cabinets framing the left and right, small copper pans, glass ingredient jars, recipe books, mint-green tiled accents, tiny warm pendant lights. Landscape composition, 3:2. Leave a large open softly lit oval floor/plinth in the CENTER (about central 55% width and 65% height) completely empty for live animated recipe cards. Reserve a clean thin upper band for runtime orbiting food sprites and a clean low foreground curved wooden laboratory counter for runtime round cat chef sprites. No characters, no food dishes in the open center, no cards, no symbols, no logos, no lettering, no watermark. Soft dimensional shadows, warm luminous golden cream, refined and lush, readable at 360px, decorative details concentrated at the edges. The central empty stage and bottom counter must stay unobstructed.

抽奖动画参考本地视频的视觉节奏：流光沿弧线聚向暗色光心 → 旋涡蓄能 → 四角星芒爆发 → 粒子凝成卡片 → 结果停留。未复制视频帧进入运行时。抽帧联系表仅存于 `artifacts/restaurant-research-v2/video-reference/` 用于本地比对。
