const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/** Reserve disjoint regions for the cat and controls within Safari's visible viewport. */
export function catPreviewLayout({ viewport, room }) {
  const { width, height } = viewport;
  if (!(width > 0 && height > 0) || width > 600 && height > 600) return null;
  const left = viewport.left || 0, top = viewport.top || 0;
  const margin = width <= 360 ? 8 : 12, gap = 12;
  const landscape = width >= 520 && width > height * 1.25;
  const panelWidth = landscape ? Math.min(300, Math.max(240, width * .36)) : Math.min(460, room.width, width - margin * 2);
  const panelHeight = landscape ? height - margin * 2 : Math.min(300, Math.floor(height * .46));
  const panelLeft = landscape ? left + width - margin - panelWidth : clamp(room.left + (room.width - panelWidth) / 2, left + margin, left + width - margin - panelWidth);
  const panelTop = landscape ? top + margin : top + height - margin - panelHeight;
  const catLeft = Math.max(left + margin, room.left + margin);
  const catRight = Math.min(left + width - margin, room.left + room.width - margin, landscape ? panelLeft - gap : Infinity);
  const catTop = Math.max(top, room.top) + Math.min(72, Math.max(56, height * .12));
  const catBottom = Math.min(room.top + room.height - margin, landscape ? top + height - margin : panelTop - gap);
  return {
    orientation: landscape ? 'landscape' : 'portrait',
    panel: { left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight },
    cat: { left: catLeft - room.left, top: catTop - room.top, width: Math.max(1, catRight - catLeft), height: Math.max(1, catBottom - catTop) },
  };
}

/** Position changes affect presentation only, never the selected expression or outfit. */
export function applyCatPreviewLayout({ dialog, nest, panel, viewport }) {
  if (!dialog.open || !['expressions', 'appearance'].includes(panel)) {
    dialog.classList.remove('cat-preview-sheet'); nest.classList.remove('cat-preview-open'); return null;
  }
  const box = nest.getBoundingClientRect();
  const room = { left: box.left + nest.clientLeft, top: box.top + nest.clientTop, width: nest.clientWidth, height: nest.clientHeight };
  const layout = catPreviewLayout({ viewport, room });
  dialog.classList.toggle('cat-preview-sheet', Boolean(layout));
  nest.classList.toggle('cat-preview-open', Boolean(layout));
  if (!layout) return null;
  for (const [key, value] of Object.entries(layout.panel)) dialog.style.setProperty(`--cat-panel-${key}`, `${value}px`);
  for (const [key, value] of Object.entries(layout.cat)) nest.style.setProperty(`--cat-preview-${key}`, `${value}px`);
  dialog.dataset.previewOrientation = layout.orientation;
  return layout;
}
