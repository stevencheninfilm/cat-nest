# 餐厅装扮场景美术 — A 组

生成日期：2026-10-18。所有三张使用 **内置 ImageGen**，每套独立调用；直接编辑参考为 `public/assets/restaurant/restaurant-scene.webp`，调用前已通过 `view_image` 查看。

原始 PNG 保存在 `artifacts/restaurant-art/decor/<theme>/scene.png`，部署使用同尺寸 `public/assets/restaurant/decor/<theme>/scene.webp`。仅进行格式压缩，未用代码绘制或改造主题。

几何要求：940×1672；六桌、侧凳、门口、厨房与底图一致；中路空；三个模块化摆放位以页面装饰覆盖。目视核验三张主要家具几何与源图接近；生成图的细微笔触不作为定位数据，游戏座位仍由原坐标定义。

## cream-bakery

产物：`public/assets/restaurant/decor/cream-bakery/scene.webp`。

提示词：

```text
Use case: precise-object-edit. Asset type: production background for a portrait 2D mobile cat restaurant game, a complete 940 x 1672 scene.
Input image is the EDIT TARGET and exact layout reference: restaurant-scene.webp. Restyle this entire room into a honey cream bakery while preserving its exact geometry and camera. This is one clean usable game background, no UI or characters.
Primary request: warm honey cream bakery theme. Cream painted wood trim, buttery ivory tables, caramel wood flooring, honey gold brass lamps, pale croissant colored kitchen cabinets, small tasteful sculpted bread motifs built into side-wall trim and shelves. The exterior retains the same green gardens, centered open doors, striped orange cream canopy. The windows, walls, dining tables and kitchen must visibly belong to a full coherent bakery theme. Room color must remain luminous, cozy and readable, hand-painted illustrated game art matching the source with softly shaded objects, defined warm brown outlines.
CRITICAL FIXED GEOMETRY: copy every table silhouette and position from reference. Exactly six table centers as percentage of full canvas width,height: (24.5,31.4), (75.3,31.4), (23.7,43.3), (76.2,43.3), (22.8,55.1), (77.3,55.1). Same oval tabletop size and same two side stools each. Do not move/add/remove furniture. The central walkway x40–60 percent is completely empty. Entrance centered x50 y20 percent and kitchen begins y68 percent, identical partition wall/open center, identical U/L perimeter counter, identical left appliance, two bottom ovens and bottom-right sink. Keep exact edge and corner locations of all large objects. Keep source perspective and framing without crop or zoom.
RESERVED PROP ZONES: leave left window sill x12 y24 percent, right wall shelf x91 y45 percent, and kitchen right corner x88 y78 percent clear and empty for later modular accessories. Existing nearby shelf/structure can remain, don't put extra clutter there.
No humans, no cats, no words, no letters, no signs with text, no food placed on tables or floor, no overlays, no watermark. All new decor is only against the room perimeter, never in walking paths. Full artwork reaches every edge. Match exact portrait aspect 940:1672.
```

## cream-library

产物：`public/assets/restaurant/decor/cream-library/scene.webp`。

提示词：

```text
Use case: precise-object-edit. Asset type: production background for portrait 2D mobile cat restaurant game, complete 940 x 1672 scene.
Input image is the EDIT TARGET and exact layout reference: restaurant-scene.webp. Restyle the whole room into a caramel cream bookshop cafe, keeping exact geometry and camera.
Primary request: coherent cozy caramel cream bookshop theme. Deep warm walnut window frames and wooden furniture bases, cream round tables with very subtle gingham edging and same dimensions, caramel parquet floor, book-filled shallow side-wall shelves that DO NOT project into walkway, tiny framed illustrations of book and steaming cup, brass reading lamps and ivory shades, coffee cream paneled kitchen cabinets with walnut accent. A warm bookish tea room mood, painterly game art, fine warm brown outlines, soft diffuse sunlight. Exterior storefront still has identical garden/exterior/center doors but warm walnut trim, striped ochre cream canopy. No words on book spines.
CRITICAL FIXED GEOMETRY: copy table/stool silhouettes and exact positions from reference. Exactly six table centers in full-canvas percentages: (24.5,31.4), (75.3,31.4), (23.7,43.3), (76.2,43.3), (22.8,55.1), (77.3,55.1). Same oval tabletop size, same two side stools each. Do not move/add/remove furniture. Central walkway x40–60 percent remains completely empty. Entrance centered x50 y20 percent and kitchen starts y68 percent, identical partition wall/open center, identical U/L perimeter counter, left appliance, two bottom ovens and bottom-right sink. Preserve exact large-object silhouettes and positions, perspective, camera, framing, no crop/zoom.
RESERVED EMPTY PROP ZONES: clear surface at left window sill x12 y24 percent; right wall shelf x91 y45 percent; kitchen right corner x88 y78 percent. Leave space there for future modular props.
No humans, no cats, no characters, no text, no signs with letters, no UI, no foods or books on tables or on floor, no watermark. New decor exclusively along side walls/perimeter. All six tabletops are empty. Full canvas artwork, same portrait aspect 940:1672.
```

## mint-greenhouse

产物：`public/assets/restaurant/decor/mint-greenhouse/scene.webp`。

提示词：

```text
Use case: precise-object-edit. Asset type: complete production background for a portrait 2D mobile cat restaurant game, 940 x 1672 exact aspect.
Input image is the EDIT TARGET and exact fixed layout reference: restaurant-scene.webp. Restyle entire room into a pale mint greenhouse cafe with unmistakable cool green theme. Keep the whole floorplan/camera/furniture geometry exactly unchanged.
Primary request: pastel mint-painted window frames and door trim, creamy ivory walls with subtle botanical leaf tracery, mint and white striped top canopy, light bleached oak floorboards, mint trimmed empty oval tables with natural light wood bases/stools, slim brass greenhouse pendant lamps, garden vines hanging ONLY on the room edges, fern and potted herb foliage built into shallow side wall shelving, pale mint/white kitchen checker tiles, sage mint cabinets with brass hardware and cream countertop. Exterior retains identical garden path, benches, trees and centered open doors, brighter garden greenhouse mood. Delicate leaf motifs on frame corners; soft sunlight, hand painted cozy mobile game illustration, warm brown outlines and gentle shading matching original quality. Distinctive mint palette across full environment, not just an overlay.
CRITICAL GEOMETRY LOCK: exactly copy six oval table silhouettes/positions and two side stools per table from original. Six table centers % of canvas width,height: (24.5,31.4), (75.3,31.4), (23.7,43.3), (76.2,43.3), (22.8,55.1), (77.3,55.1). All same sizes. Center walkway x40–60 percent MUST stay empty, no new furniture. Entrance x50 y20 percent, kitchen begins y68 percent with same partition and center opening. Identical perimeter counter, left appliance, bottom two ovens, bottom-right sink, exact positions and silhouettes. Do not shift walls, doorway, table/stool footprints, kitchen geometry. Same perspective, no crop, no zoom.
RESERVED CLEAR PROP POSITIONS: left window sill x12 y24 percent; right wall shelf x91 y45 percent; kitchen right corner x88 y78 percent. Keep those empty for future props.
No characters, no cats or people, no words/text/logos, no UI, no foods on tables or floor, no watermark. All tabletops empty. All plants and new accents remain along edges, never in paths. Art reaches all edges.
```
