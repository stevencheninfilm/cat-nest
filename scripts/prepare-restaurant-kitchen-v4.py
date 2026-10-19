"""Package generated 3x2 kitchen sheets as transparent runtime WebP assets.

Run with the bundled Python/Pillow runtime and a generation-record.json path.
Only crops, scales, aligns and encodes generated artwork; source PNGs are kept.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/restaurant/kitchen-v4'


def frames_from_sheet(path, trim_bottom=0, cell_filter=None):
    sheet = Image.open(path).convert('RGBA')
    assert sheet.size == (1536, 1024), (path, sheet.size)
    cells = [sheet.crop((x * 512, y * 512, (x + 1) * 512, (y + 1) * 512))
             for y in range(2) for x in range(3)]
    if cell_filter:
        cells = [cell_filter(cell) for cell in cells]
    if trim_bottom:
        # Pudding's first row contains a ten-pixel sliver of the next row.
        # Trim that sheet gutter before vessel alignment and encoding.
        for cell in cells:
            cell.paste((0, 0, 0, 0), (0, 512 - trim_bottom, 512, 512))
    bounds, anchors = [], []
    for cell in cells:
        alpha = cell.getchannel('A')
        assert alpha.getextrema()[0] == 0, f'No transparent background: {path}'
        mask = alpha.point(lambda a: 255 if a >= 48 else 0)
        box = mask.getbbox()
        assert box, path
        left, top, right, bottom = box
        base = mask.crop((0, round(top + (bottom - top) * .78), 512, bottom)).getbbox()
        anchors.append(((base[0] + base[2]) / 2, bottom))
        bounds.append(box)
    # The vessel/board base stays planted while ingredients and tools move.
    left = max(a[0] - b[0] for a, b in zip(anchors, bounds))
    right = max(b[2] - a[0] for a, b in zip(anchors, bounds))
    height = max(b[3] - b[1] for b in bounds)
    scale = min(164 / max(left, right), 324 / height)
    result = []
    for cell, anchor in zip(cells, anchors):
        resized = cell.resize((round(512 * scale), round(512 * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (384, 384))
        frame.alpha_composite(resized, (round(192 - anchor[0] * scale), round(350 - anchor[1] * scale)))
        result.append(frame)
    return result


def describe(path):
    image = Image.open(path)
    frames = [frame.convert('RGBA').copy() for frame in ImageSequence.Iterator(image)]
    alpha = frames[0].getchannel('A')
    return dict(file=str(path.relative_to(OUT)), width=image.width, height=image.height,
                frames=len(frames), bytes=path.stat().st_size,
                loop=image.info.get('loop'),
                durations=[170] * len(frames) if len(frames) > 1 else [],
                alphaMin=alpha.getextrema()[0],
                transparentFraction=round(alpha.histogram()[0] / (image.width * image.height), 4),
                distinctDecodedFrames=len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}))


def main():
    record = json.loads(Path(sys.argv[1]).read_text())
    for directory in ['props', 'animations', 'sources']:
        (OUT / directory).mkdir(parents=True, exist_ok=True)
    manifest = dict(version=4, mode='built-in-imagegen', frameDurationMs=170,
                    props=[], animations=[], reuse={
                        'mix-custard': 'mix-pancake-batter',
                        'warm-matcha-milk': '../kitchen-v2/steam-milk.webp',
                        'wash-burger-salad': '../kitchen-v3/animations/wash-salad.webp',
                        'slice-burger-salad': '../kitchen-v3/animations/slice-salad.webp',
                    })
    qa = Image.new('RGB', (6 * 220, 4 * 245), '#fff7e7')
    draw = ImageDraw.Draw(qa)
    for index, asset in enumerate(record['assets']):
        frames = frames_from_sheet(asset['sourcePath'], 12 if asset['id'] == 'pudding-unmold' else 0)
        Image.open(asset['sourcePath']).save(OUT / 'sources' / f"{asset['id']}.webp", quality=90, method=6)
        animation = OUT / 'animations' / f"{asset['animationId']}.webp"
        frames[0].save(animation, save_all=True, append_images=frames[1:], duration=170, loop=0, quality=87, method=6)
        manifest['animations'].append(dict(id=asset['animationId'], sourceId=asset['id'], **describe(animation)))
        if asset['id'] not in ['pancake-honey', 'pudding-unmold', 'matcha-cap']:
            prop = OUT / 'props' / f"{asset['id']}.webp"
            frames[2].resize((512, 512), Image.Resampling.LANCZOS).save(prop, quality=90, method=6)
            manifest['props'].append(dict(id=asset['id'], **describe(prop)))
        if asset['id'] == 'burger-assembly':
            # The final assembly frames also show the finished burger settling.
            plate = OUT / 'animations/plate-burger.webp'
            settle = [frames[i] for i in [4, 5, 4, 3, 4, 5]]
            settle[0].save(plate, save_all=True, append_images=settle[1:], duration=170, loop=0, quality=87, method=6)
            manifest['animations'].append(dict(id='plate-burger', sourceId=asset['id'], **describe(plate)))
        x, y = index % 6 * 220, index // 6 * 245
        tile = frames[2].resize((210, 210), Image.Resampling.LANCZOS)
        qa.paste(tile, (x + 5, y), tile)
        draw.text((x + 8, y + 215), asset['animationId'], fill='#74563b')
    qa.save(OUT / 'qa-props.webp', quality=92)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'generation-record.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(props=len(manifest['props']), animations=len(manifest['animations']),
                          bytes=sum(p['bytes'] for p in manifest['props'] + manifest['animations']))))


if __name__ == '__main__':
    main()
