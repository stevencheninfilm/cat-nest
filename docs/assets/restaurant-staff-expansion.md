# 圆润员工美术与显示修复

新增布丁（甜点师）、薄荷（饮品师）、栗子（传菜员），保留原有三位员工和已雇佣数量。正面、背面分别放在 atlas 上下两行；角色保持用户参考图的圆团身体、短爪与粗巧克力色描边。

- 成品：`public/assets/restaurant/staff-expansion-v1.webp`，768 × 512，3 列 × 2 行，每格 256 × 256。
- 单图：`public/assets/restaurant/characters/staff-{pudding,mint,chestnut}[-back].webp`。
- 元数据：`public/assets/restaurant/sprites.json` 的 `staffCharacters` 与 `staffExpansionAtlas`。
- 所有角色脚底统一锚点 `(0.5, 0.9375)`；每格至少留 15 px 透明边距。
- 原始生成：`/Users/stevenchen/.codex/generated_images/01a14df9-a948-7002-8428-978ca4046c89/exec-b7007996-9400-462d-8a6c-3dcfb9e0a881.png`。
- 原图保留于 `artifacts/restaurant-art/staff-expansion-v1-source.png`；白底预览为 `artifacts/restaurant-art/staff-expansion-preview.png`。

## 参考输入

1. `public/assets/restaurant/cat-sprites.png`（现有角色风格）。
2. 用户原始截图 `codex-clipboard-f3f9928e-e347-4802-824c-6fdd3a8fbf95.png`（圆润比例和俯视游戏视角）。

使用内置 imagegen，`transparent_background: true`。后处理仅裁切、等比缩放、透明排版与无损 WebP 打包，无重绘。

## 生成提示词

```text
Use case: stylized-concept. Asset type: transparent employee sprite atlas for a cute mobile cat restaurant game. Input image 1 is the existing project's CHARACTER STYLE REFERENCE; input image 2 is the user's gameplay reference for extreme round chubby proportions, NOT an edit target. Generate THREE NEW distinctive employees with front and back views. Keep the same round dumpling/bowling-ball body, head merges into body, very short legs, tiny paws, big cheeks, thick dark chocolate outlines, simple soft cel shading, cute dots eyes, expressive tails; no tall body or human proportions. Real alpha transparency. One sprite atlas, exactly 3 columns by 2 rows, 6 equal square cells, landscape 3:2. Top row: front views of the 3 employees. Bottom row: corresponding back views, same column, same outfit, same proportions. Character identities: column 1 Pudding, a warm cream calico pastry chef with peach and caramel patches, pink beret, dusty rose apron, holding a little whisk close to the body. Column 2 Mint, a silver-gray and white barista cat with mint green visor, mint apron, small leaf badge, holding a small cream tea cup. Column 3 Chestnut, a brown tabby delivery cat with beige muzzle, blue cap and blue checked vest, carrying a small cream serving tray with a pastry; looped brown tail. Full bodies including ears, hats, paws and tails entirely inside each cell; each sprite at most 76% cell width and 85% cell height, 10% transparent padding, feet on identical baseline. All six stand in matching slightly overhead 3/4 game-camera view, not side view. No background, no floor, no grid, no text, numbers, names or watermarks. Avoid food and utensils extending into neighboring cells. These must be 3 new employees, not recolors of the exact existing cats. Clean production game sprites readable at 64 pixels.
```

## 面板修复

旧 `.r-staff-portrait > span` 同时命中气泡与角色 sprite，把角色也设为绝对定位，造成容器高度塌陷和气泡遮挡。角色恢复正常文档流，气泡改为独立 `.r-staff-speech` 段落。面板按三列、两排展示六位员工，点击名片只切换预览，不改变顺序雇佣的目标。厨房中的员工按稳定 `worker-1` 至 `worker-7` 对应主厨、原三位与新增三位。

## 验证

`node --test tests/restaurant-staff.test.mjs` 的 8 项测试通过，覆盖六位雇佣上限与扣费、旧三人存档及订单保留、新员工订单结算、七位厨房 worker、角色预览、正背面素材与云端重试幂等。测试按 `costCurrency` 验证扣费，兼容最终后三位用金鱼干的统一规则。

手机浏览器在共享 `5174` 预览验收：390 px 和 320 px 均无横向溢出；角色区高度从 0 恢复为 128 px，角色为正常布局，气泡不与角色或后续标题相交。三位角色可逐一预览，测试存档可雇佣至 6/6，厨房显示主厨与六位员工，共 7 个独立角色。

最终共用构建再次验证：新增三位的金鱼干费用为 5 / 8 / 12，角色预览与下方员工能力训练区域共存，角色区仍为 128 px，无气泡或标题交叠。最终截图为 `artifacts/restaurant-art/screenshots/staff-final-mobile.jpg`。

其余截图：`artifacts/restaurant-art/screenshots/staff-before-fix.jpg`、`staff-pudding-390.jpg`、`staff-mint-390.jpg`、`staff-chestnut-320.jpg`。测试环境刷新恢复默认；不修改真实小窝存档。
