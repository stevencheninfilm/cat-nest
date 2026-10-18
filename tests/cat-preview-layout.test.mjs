import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catPreviewLayout, applyCatPreviewLayout } from '../src/cat-preview-layout.js';

const epsilon = 1e-6;
const bounds = box => ({ ...box, right: box.left + box.width, bottom: box.top + box.height });
function verify(viewport, room) {
  const layout = catPreviewLayout({ viewport, room });
  assert.ok(layout);
  const panel = bounds(layout.panel), cat = bounds({ ...layout.cat, left: layout.cat.left + room.left, top: layout.cat.top + room.top });
  const visible = bounds({ left: 0, top: 0, ...viewport });
  for (const [name, box] of [['cat', cat], ['panel', panel]]) {
    assert.ok(box.width > 0 && box.height > 0, `${name} has positive dimensions`);
    assert.ok(box.left >= visible.left && box.right <= visible.right + epsilon, `${name} stays within horizontal viewport`);
    assert.ok(box.top >= visible.top && box.bottom <= visible.bottom + epsilon, `${name} stays within vertical viewport`);
  }
  assert.ok(cat.left >= room.left && cat.right <= room.left + room.width + epsilon);
  assert.ok(cat.top >= room.top && cat.bottom <= room.top + room.height + epsilon);
  assert.ok(cat.bottom + 12 <= panel.top + epsilon || cat.right + 12 <= panel.left + epsilon, 'the controls never cover the cat preview');
  return layout;
}

test('portrait phone sizes reserve separate areas for the whole cat and controls', () => {
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [414, 896], [430, 932], [390, 640], [375, 500]]) {
    const layout = verify({ width, height }, { left: 0, top: 0, width, height });
    assert.equal(layout.orientation, 'portrait');
    assert.ok(layout.cat.height >= 170, `${width}×${height} keeps a usable cat preview`);
    assert.ok(layout.panel.height <= 300);
  }
});

test('landscape phones place controls beside the cat instead of squeezing them over its face', () => {
  for (const [width, height] of [[844, 390], [932, 430], [667, 375], [568, 320]]) {
    const roomWidth = Math.min(width, width <= 600 ? 520 : 460), inset = width <= 600 ? 0 : 16;
    const layout = verify({ width, height }, { left: (width - roomWidth) / 2, top: inset, width: roomWidth, height: height - inset * 2 });
    assert.equal(layout.orientation, 'landscape');
    assert.ok(layout.cat.width >= 240);
  }
});

test('Safari visible viewport offsets and toolbar changes keep both surfaces visible', () => {
  const room = { left: 0, top: 0, width: 390, height: 844 };
  for (const [top, height] of [[0, 844], [0, 640], [40, 600], [90, 550]]) verify({ left: 0, top, width: 390, height }, room);
  verify({ left: 8, top: 30, width: 375, height: 700 }, room);
  verify({ width: 390, height: 844 }, { left: 0, top: 0, width: 390, height: 650 });
  assert.equal(catPreviewLayout({ viewport: { width: 1440, height: 900 }, room }), null);
  assert.equal(catPreviewLayout({ viewport: { width: 0, height: 844 }, room }), null);
});

function surface(rect, size = {}) {
  const classes = new Set(), properties = new Map(); let measures = 0;
  return { open: true, dataset: {}, clientLeft: 0, clientTop: 0, clientWidth: rect.width, clientHeight: rect.height, ...size,
    getBoundingClientRect() { measures++; return rect; },
    classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }, remove(name) { classes.delete(name); } },
    style: { setProperty(name, value) { properties.set(name, value); } }, classes, properties, measures: () => measures };
}

test('opening either panel applies the same safe preview and closing restores the ordinary home', () => {
  const nest = surface({ left: 0, top: 0, width: 390, height: 844 }), dialog = surface({ left: 0, top: 0, width: 0, height: 0 });
  const viewport = { width: 390, height: 844 };
  for (const panel of ['expressions', 'appearance']) {
    applyCatPreviewLayout({ dialog, nest, panel, viewport });
    assert.ok(dialog.classes.has('cat-preview-sheet')); assert.ok(nest.classes.has('cat-preview-open'));
    assert.equal(dialog.properties.get('--cat-panel-height'), '300px');
    assert.equal(dialog.dataset.previewOrientation, 'portrait');
    dialog.open = false; const before = nest.measures();
    applyCatPreviewLayout({ dialog, nest, panel, viewport });
    assert.equal(nest.measures(), before, 'closed panels perform no layout read');
    assert.equal(dialog.classes.size, 0); assert.equal(nest.classes.size, 0);
    dialog.open = true;
  }
  applyCatPreviewLayout({ dialog, nest, panel: 'settings', viewport });
  assert.equal(nest.classes.size, 0);
  applyCatPreviewLayout({ dialog, nest, panel: 'expressions', viewport: { width: 1440, height: 900 } });
  assert.equal(nest.classes.size, 0); assert.equal(dialog.classes.size, 0);
});

test('preview uses the bordered room interior and follows a live portrait-to-landscape change', () => {
  const nest = surface({ left: 190, top: 16, width: 464, height: 358 }, { clientLeft: 2, clientTop: 2, clientWidth: 460, clientHeight: 354 });
  const dialog = surface({ left: 0, top: 0, width: 0, height: 0 });
  applyCatPreviewLayout({ dialog, nest, panel: 'appearance', viewport: { width: 844, height: 390 } });
  assert.equal(dialog.dataset.previewOrientation, 'landscape');
  assert.equal(nest.properties.get('--cat-preview-left'), '12px');
});

test('mobile panels scroll their own controls while leaving the model preview and save handlers intact', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /window.visualViewport\?\.addEventListener\('resize',positionCatPanels\)/);
  assert.match(main, /window.visualViewport\?\.addEventListener\('scroll',positionCatPanels/);
  assert.match(main, /getBoundingClientRect\(\).bottom\+gap/,'the desktop palette keeps its existing positioning fallback');
  assert.match(main, /catModel\?\.setAppearance\(appearanceDraft\)/);
  assert.match(main, /dispatch\(\{type:'dress',appearance:\{\.\.\.appearanceDraft\}\}\)/);
  const css = await readFile(new URL('../src/cat-preview.css', import.meta.url), 'utf8');
  assert.match(css, /\.cat-preview-sheet \.modal-content\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.cat-preview-sheet \.expression-grid\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.scene > \.cat-button\s*\{[^}]*height:\s*100%/);
  assert.match(css, /\.nest.cat-preview-open \.growth-rewards/);
  assert.match(css, /\.nest.cat-preview-open \.speech-bubble/);
});
