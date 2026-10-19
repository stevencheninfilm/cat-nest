# 餐厅装扮美术资产检查

检查日期：2026-10-18。范围为当前共享应用使用的 `public/assets/restaurant/decor/`。本次只读检查采用 bundled Sharp 读取元数据、解码 alpha 像素并核对 manifest；没有重新生成或改写图片。

## 结果

通过：**6 张完整场景、18 件透明装饰、4 帧施工猫和 1 张施工图集，共 29 张部署图片**。文件均可解码；总大小 **2,132,202 bytes（2.03 MiB）**，含备用 atlas。

`manifest.json` 的 6 个场景引用、18 个装饰引用、4 个施工帧引用均存在且与目录一致。全部场景为 940×1672 的同一纵向比例；全部独立道具和施工帧为 256×256 RGBA WebP。

## 场景底图

以下路径均为 `public/assets/restaurant/decor/<套装>/scene.webp`。

| 套装 | 尺寸 | 通道 | 文件大小 |
| --- | --- | --- | --- |
| cream-bakery | 940×1672 | RGB / 不透明 | 220.7 KiB |
| cream-library | 940×1672 | RGB / 不透明 | 213.3 KiB |
| mint-greenhouse | 940×1672 | RGB / 不透明 | 256.7 KiB |
| mint-seaside | 940×1672 | RGB / 不透明 | 283.3 KiB |
| sakura-teahouse | 940×1672 | RGB / 不透明 | 288.3 KiB |
| sakura-evening | 940×1672 | RGB / 不透明 | 287.8 KiB |

三组各两套：奶油（烘焙／书房）、薄荷（花房／海盐）、樱花（日间茶屋／夜樱）。每张都是包含地面、窗墙、灯具、六桌桌椅及厨房的大场景。A、B 两组提示词文件记录了固定布局要求与逐套目视检查；本次机器检查确认尺寸、格式和可用路径，不据此推断像素级几何相同。

## 模块装饰

每套含 `window.webp`、`wall.webp`、`counter.webp` 三件。**18/18** 具备 alpha 通道且存在非透明主体；四角均 alpha=0。下表透明比例只计 alpha=0 像素，半透明边缘仍保留。

| 套装 | 窗边道具 | 墙边道具 | 厨房道具 |
| --- | --- | --- | --- |
| cream-bakery | window.webp：27.6 KiB，透明 56.86% | wall.webp：23.2 KiB，透明 49.38% | counter.webp：23.1 KiB，透明 53.06% |
| cream-library | window.webp：24.7 KiB，透明 48.71% | wall.webp：25.1 KiB，透明 41.52% | counter.webp：17.9 KiB，透明 49.62% |
| mint-greenhouse | window.webp：22.8 KiB，透明 53.74% | wall.webp：24.2 KiB，透明 61.13% | counter.webp：30.5 KiB，透明 41.43% |
| mint-seaside | window.webp：22.8 KiB，透明 60.9% | wall.webp：22.7 KiB，透明 59.69% | counter.webp：26.3 KiB，透明 45.84% |
| sakura-teahouse | window.webp：29.9 KiB，透明 54.04% | wall.webp：30.0 KiB，透明 49.02% | counter.webp：19.4 KiB，透明 55.89% |
| sakura-evening | window.webp：16.7 KiB，透明 55.91% | wall.webp：21.2 KiB，透明 62.55% | counter.webp：16.0 KiB，透明 62.33% |

全部道具非透明像素边界在 [16,239] 内，画布四周至少保留 16 px 空间，未触及输出画布边缘。底部锚点统一 `(0.5,0.9375)`。manifest 摆放位：窗边 `(12%,24%)` 宽 9%；墙边 `(91%,45%)` 宽 11%；厨房 `(88%,78%)` 宽 9%。这些坐标以整个场景为基准。

## 猫猫施工队

两个独立圆润角色，各含正面和背面；atlas 是四帧的 2×2 合集。全部 RGBA，四角 alpha=0，主体不触及画布边缘。

| 文件（crew/） | 尺寸 | 文件大小 | 全透明像素 |
| --- | --- | --- | --- |
| builder-orange.webp | 256×256 | 14.3 KiB | 60.02% |
| builder-orange-back.webp | 256×256 | 14.1 KiB | 54.4% |
| builder-gray.webp | 256×256 | 13.4 KiB | 61.34% |
| builder-gray-back.webp | 256×256 | 12.7 KiB | 54.39% |
| atlas.webp | 512×512 | 53.5 KiB | 57.54% |

橙猫：黄色安全帽、蓝色工装、木槌。灰猫：橙色安全帽、薄荷工装、滚刷。角色参考既有 `public/assets/restaurant/cat-sprites.png` 系列。正背面只表达方向，移动、敲打和安置由应用动画驱动，资源本身是静态帧。

## 原始图与处理

- 施工队保留原图：`artifacts/restaurant-art/decor/crew-source.png`，1448×1086 RGBA PNG。
- 道具保留原图：`artifacts/restaurant-art/decor/props-source.png`，1774×887 RGBA PNG。
- 原图与 ImageGen 默认目录中的两个指定源文件逐字节 SHA-256 对比一致。
- 可重复处理流程：`scripts/prepare-restaurant-decor-art.mjs`，按图集网格切分、透明边裁切、等比缩放并在透明 256×256 画布底部对齐，再编码 WebP（quality=90、alphaQuality=100）。本次审计未执行该脚本，避免重写产物。
- 场景 PNG 原稿分别保留在 `artifacts/restaurant-art/decor/<套装>/scene.png`（A 组）与 `scene-original.png`（B 组）。

## 生成记录

- [A 组完整场景提示词](assets/restaurant-decor-a-prompts.md)
- [B 组完整场景提示词](assets/restaurant-decor-b-prompts.md)
- [施工队与模块装饰来源及整理版提示词](assets/restaurant-decor-extra-prompts.md)
