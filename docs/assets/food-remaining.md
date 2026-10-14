# 食物剩余量素材

内置 `image_gen` 编辑现有原创 `public/assets/food-atlas.webp`，为九种食物增加 75%、50%、25% 三档，共 27 个剩余量画面。生成时没有使用购买的猫猫模型。满份仍使用原始素材。

| 剩余档位 | 已保存文件 | 尺寸 | 文件大小 |
| --- | --- | --- | --- |
| 75% | `public/assets/food-remaining-v1/food-atlas-75.webp` | 1254 × 1254 | 1,010,308 字节 |
| 50% | `public/assets/food-remaining-v1/food-atlas-50.webp` | 1254 × 1254 | 959,700 字节 |
| 25% | `public/assets/food-remaining-v1/food-atlas-25.webp` | 1254 × 1254 | 723,358 字节 |

三张图均为透明背景、3 × 3 等分图集，沿用原始食物位置。第一行：冻干小鱼、营养猫粮、鲜鱼罐罐；第二行：鸡胸肉、鲜虾小餐、三文鱼块；第三行：幼猫慕斯、猫咪肉条、清清饮水。食物数量、容器内食物或水位逐档减少，容器保留。

生成提示词集合保存在 [food-remaining-prompts.json](food-remaining-prompts.json)。25% 档鸡胸肉修订为一小块带咬痕的鸡肉，修订提示词及最终源文件记录在 [food-remaining-repair.json](food-remaining-repair.json)。

## 生成源文件

- 75%：`/Users/stevenchen/.codex/generated_images/01a13862-8e7d-7471-8d4e-5fd735f57faf/exec-379896c6-6efa-4f60-99bb-34cf9d44ef34.png`
- 50%：`/Users/stevenchen/.codex/generated_images/01a13862-8e7d-7471-8d4e-5fd735f57faf/exec-aa8e680d-85d7-44d8-87b8-5a3a7eb9e877.png`
- 25% 最终：`/Users/stevenchen/.codex/generated_images/01a13862-8e7d-7471-8d4e-5fd735f57faf/exec-7cb8d0b8-8006-4bc7-8dcd-88c53ff986e0.png`

使用 Pillow 以 lossless WebP、`exact=True` 编码，未裁剪、缩放或重绘；逐一解码后，RGBA 字节与生成源 PNG 完全一致。

## 页面切换

以每个人已保存的本餐食物及到期时间计算剩余比例，分别使用该食物的冷却时长。大于 75% 显示满份；剩余时间到达 75%、50%、25% 时切换对应画面；到期后主页该侧不再显示食物。挑选菜单和待喂预览保持满份。

主页及保持打开的喂养详情复用现有每秒计时更新；关闭后重新打开仍按已有存档和当前时间计算，无新增存档字段或后台写入。共享盘子的尺寸、两侧食物位置及各自倒计时布局不变。

## 验证

- `tests/food-portions.test.mjs` 验证九种食物各自的准确阈值、到期、双人不同档位及恢复存档。
- 与 `tests/feeding-ui.test.mjs`、`tests/food-cooldowns.test.mjs` 一起通过 33 项测试。
- 同一个 `http://127.0.0.1:5174/` 服务下的本地 `artifacts/food-portions-preview.html` 可查看四档对照及点击模拟阈值。该预览页面不访问存档或云端，仅供本地验收，`artifacts/` 不进入发布。
- 浏览器已验证现有食物节点在三个阈值更新正确的素材 URL，并检查九种食物的透明边缘及逐档变化。
