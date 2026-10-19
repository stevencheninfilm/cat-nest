"""Crop, align and encode the generated donut sheets; never redraw source art."""
import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/restaurant/kitchen-v8'
spec = importlib.util.spec_from_file_location('kitchen_v5', Path(__file__).with_name('prepare-restaurant-kitchen-v5.py'))
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)
pipeline.sheet.OUT = OUT


def main():
    record = json.loads(Path(sys.argv[1]).read_text())
    for directory in ['props', 'animations', 'sources']:
        (OUT / directory).mkdir(parents=True, exist_ok=True)
    manifest = dict(version=8, mode='built-in-imagegen', recipe='donut', frameDurationMs=170,
                    props=[], animations=[], reuse={
                        'wash-donut-strawberries': '../kitchen-v5/animations/wash-waffle-berries.webp',
                        'slice-donut-strawberries': '../kitchen-v5/animations/slice-strawberries.webp',
                        'knead-donut-dough': '../kitchen-v6/animations/knead-pizza-dough.webp',
                        'proof-donut-dough': '../kitchen-v6/animations/proof-pizza-dough.webp',
                        'mash-donut-strawberries': '../kitchen-v5/animations/macerate-strawberries.webp',
                    })
    qa = Image.new('RGB', (4 * 220, 2 * 245), '#fff7e7')
    draw = ImageDraw.Draw(qa)
    for index, asset in enumerate(record['assets']):
        frames = pipeline.sheet.frames_from_sheet(asset['sourcePath'], cell_filter=pipeline.trim_atlas_fragments)
        Image.open(asset['sourcePath']).save(OUT / 'sources' / f"{asset['id']}.webp", quality=88, method=4)
        animation = OUT / 'animations' / f"{asset['animationId']}.webp"
        frames[0].save(animation, save_all=True, append_images=frames[1:], duration=170, loop=0, quality=86, method=4)
        manifest['animations'].append(dict(id=asset['animationId'], sourceId=asset['id'], **pipeline.sheet.describe(animation)))
        if asset['id'] != 'donut-finish':
            prop = OUT / 'props' / f"{asset['id']}.webp"
            frames[2].resize((512, 512), Image.Resampling.LANCZOS).save(prop, quality=89, method=4)
            manifest['props'].append(dict(id=asset['id'], **pipeline.sheet.describe(prop)))
        x, y = index % 4 * 220, index // 4 * 245
        tile = frames[2].resize((210, 210), Image.Resampling.LANCZOS)
        qa.paste(tile, (x + 5, y), tile)
        draw.text((x + 8, y + 215), asset['animationId'], fill='#74563b')
        print(asset['animationId'], flush=True)
    qa.save(OUT / 'qa-props.webp', quality=92)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'generation-record.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(props=len(manifest['props']), animations=len(manifest['animations']),
                          runtimeBytes=sum(p['bytes'] for p in manifest['props'] + manifest['animations']))))


if __name__ == '__main__':
    main()
