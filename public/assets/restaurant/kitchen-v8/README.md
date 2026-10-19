# 草莓甜甜圈工序素材

使用内置 imagegen，以已有甜甜圈成品、揉面碗和配料托盘作为风格参考生成。完整提示词、参考路径与来源见 `generation-record.json`；原始 PNG 副本保留于 `artifacts/restaurant-art/kitchen-v8/sources/`。

七组新六帧图：取料、压圈、油炸、沥油冷却、调草莓糖霜、蘸糖霜、装饰装盘。每组按 3×2 布局生成，裁分、对齐后编码为 384×384、每帧 170ms、无限循环 WebP；另导出六张 512×512 静态工序图。成品继续使用已有 `foods/donut.webp`。

复用五组动画：洗净草莓、草莓切块、揉面、发酵、压草莓果泥。对应原素材及相对路径记录在 `manifest.json` 的 `reuse` 字段。没有用其他自动计时菜替代甜甜圈测试。

打包命令：使用工作区内置 Python/Pillow 运行 `scripts/prepare-restaurant-kitchen-v8.py artifacts/restaurant-art/kitchen-v8/generation-record.json`。脚本只裁分、缩放、对齐和编码生成素材，不重绘原图。

`qa-props.webp` 为七组素材的检视拼图；`manifest.json` 记录透明比例、实际帧数、帧差异和文件大小。运行时新静态图与动画合计约 1.64 MB。
