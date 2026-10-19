"""Crop/align the new generated sheets with the same established v4 pipeline."""
import importlib.util
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/restaurant/kitchen-v5'
spec = importlib.util.spec_from_file_location('kitchen_sheet', Path(__file__).with_name('prepare-restaurant-kitchen-v4.py'))
sheet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sheet)
sheet.OUT = OUT


def trim_atlas_fragments(cell):
    """Crop only tiny disconnected slivers touching a sprite-cell boundary.

    Unlike a blanket inset this preserves the complete vessel silhouette.
    Generated source sheets are never changed.
    """
    alpha = cell.getchannel('A').tobytes()
    seen = bytearray(512 * 512)
    for index, value in enumerate(alpha):
        if value < 48 or seen[index]:
            continue
        stack = [index]
        seen[index] = 1
        left = right = index % 512
        top = bottom = index // 512
        area = 0
        while stack:
            current = stack.pop()
            x, y = current % 512, current // 512
            left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
            area += 1
            neighbors = []
            if x: neighbors.append(current - 1)
            if x < 511: neighbors.append(current + 1)
            if y: neighbors.append(current - 512)
            if y < 511: neighbors.append(current + 512)
            for neighbor in neighbors:
                if not seen[neighbor] and alpha[neighbor] >= 48:
                    seen[neighbor] = 1
                    stack.append(neighbor)
        if area < 1500 and (left <= 1 or right >= 510 or top <= 1 or bottom >= 510):
            cell.paste((0, 0, 0, 0), (max(0, left-3), max(0, top-3), min(512, right+4), min(512, bottom+4)))
    return cell


def main():
    record = json.loads(Path(sys.argv[1]).read_text())
    for directory in ['props', 'animations', 'sources']:
        (OUT / directory).mkdir(parents=True, exist_ok=True)
    manifest = dict(version=5, mode='built-in-imagegen', frameDurationMs=170,
                    props=[], animations=[], reuse={
                        'mix-waffle-batter': '../kitchen-v4/animations/mix-pancake-batter.webp',
                        'wash-strawberries': 'animations/wash-waffle-berries.webp',
                        'season-gold-salmon': '../kitchen-v2/season.webp',
                    })
    finals = {'udon-plating', 'waffle-plating', 'strawberrymilk-finish', 'salmon-gold-leaf'}
    qa = Image.new('RGB', (6 * 220, math.ceil(len(record['assets']) / 6) * 245), '#fff7e7')
    draw = ImageDraw.Draw(qa)
    for index, asset in enumerate(record['assets']):
        frames = sheet.frames_from_sheet(asset['sourcePath'], cell_filter=trim_atlas_fragments)
        Image.open(asset['sourcePath']).save(OUT / 'sources' / f"{asset['id']}.webp", quality=88, method=4)
        animation = OUT / 'animations' / f"{asset['animationId']}.webp"
        frames[0].save(animation, save_all=True, append_images=frames[1:], duration=170, loop=0, quality=86, method=4)
        manifest['animations'].append(dict(id=asset['animationId'], sourceId=asset['id'], **sheet.describe(animation)))
        if asset['id'] not in finals:
            prop = OUT / 'props' / f"{asset['id']}.webp"
            frames[2].resize((512, 512), Image.Resampling.LANCZOS).save(prop, quality=89, method=4)
            manifest['props'].append(dict(id=asset['id'], **sheet.describe(prop)))
        x, y = index % 6 * 220, index // 6 * 245
        tile = frames[2].resize((210, 210), Image.Resampling.LANCZOS)
        qa.paste(tile, (x + 5, y), tile)
        draw.text((x + 8, y + 215), asset['animationId'], fill='#74563b')
        print(asset['animationId'], flush=True)
    qa.save(OUT / 'qa-props.webp', quality=92)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'generation-record.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(props=len(manifest['props']), animations=len(manifest['animations']),
                          bytes=sum(p['bytes'] for p in manifest['props'] + manifest['animations']))))


if __name__ == '__main__':
    main()
