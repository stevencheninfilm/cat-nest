"""Trace existing pose alpha into code-native SVG outlines; original PNGs stay intact.

Run with Python + Pillow. NODE can select the project's Node runtime.
Crop metadata comes from the same scene module used by the renderer.
"""
import json
import math
import os
from pathlib import Path
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
poses = json.loads(subprocess.check_output([
    os.environ.get('NODE', 'node'), '--input-type=module', '-e',
    'import {COLLECTION_CATS} from "./src/cat-collection.js";'
    'import {sceneCatPlacement,CAT_SCENES} from "./src/catbook-scenes.js";'
    'console.log(JSON.stringify(COLLECTION_CATS.map(cat=>'
    '({id:cat.id,...sceneCatPlacement(CAT_SCENES[0],cat)}))))',
], cwd=ROOT))


def simplify(points, tolerance=1.5):
    """Douglas–Peucker removes the pixel staircase without losing ears or paws."""
    if len(points) <= 2:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    distances = []
    for px, py in points[1:-1]:
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length)) if length else 0
        distances.append(math.hypot(px - ax - t * dx, py - ay - t * dy))
    index = max(range(len(distances)), key=distances.__getitem__) + 1
    if distances[index - 1] <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def trace(alpha):
    width, height = alpha.size
    pixels = alpha.load()
    filled = {(x, y) for y in range(height) for x in range(width) if pixels[x, y] >= 96}
    edges = {}

    def edge(start, end):
        edges.setdefault(start, set()).add(end)

    for x, y in filled:
        if (x, y - 1) not in filled:
            edge((x, y), (x + 1, y))
        if (x + 1, y) not in filled:
            edge((x + 1, y), (x + 1, y + 1))
        if (x, y + 1) not in filled:
            edge((x + 1, y + 1), (x, y + 1))
        if (x - 1, y) not in filled:
            edge((x, y + 1), (x, y))

    paths = []
    while edges:
        start = min(edges)
        points = [start]
        current = start
        while current in edges:
            following = min(edges[current])
            edges[current].remove(following)
            if not edges[current]:
                del edges[current]
            points.append(following)
            current = following
            if current == start:
                break
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:]))) / 2
        if area < 20:
            continue
        # Split a closed loop in two so the simplifier has distinct endpoints.
        middle = len(points) // 2
        outline = simplify(points[:middle + 1])[:-1] + simplify(points[middle:])[:-1]
        paths.append('M' + 'L'.join(f'{x},{y}' for x, y in outline) + 'Z')
    if not paths:
        raise ValueError('Empty silhouette')
    return ''.join(paths)


silhouettes = {}
for pose in poses:
    image = Image.open(ROOT / 'public/assets/catbook' / f'{pose.get("texture", "scene-poses")}.png')
    width, height = map(int, pose['ratio'].split('/'))
    pos_x, pos_y = (float(part.rstrip('%')) / 100 for part in pose['backgroundPosition'].split())
    x, y = round(pos_x * (image.width - width)), round(pos_y * (image.height - height))
    alpha = image.getchannel('A').crop((x, y, x + width, y + height))
    silhouettes[pose['id']] = {'viewBox': f'0 0 {width} {height}', 'path': trace(alpha)}

target = ROOT / 'src/catbook-silhouettes.js'
target.write_text('// Generated from existing pose alpha by scripts/build-catbook-silhouettes.py.\n'
                  '// Paths share the live pose crop, so locked and invited cats align exactly.\n'
                  'export const CAT_SILHOUETTES = Object.freeze(' +
                  json.dumps(silhouettes, ensure_ascii=False, indent=2) + ');\n')
print(f'Traced {len(silhouettes)} cat silhouettes → {target.relative_to(ROOT)}')
