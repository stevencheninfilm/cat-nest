const HEARTS = '.growth-heart, .growth-heart-art, .growth-heart-canvas';
const containsHeart = node => node.nodeType === 1 && (node.matches?.(HEARTS) || node.querySelector?.(HEARTS));

/** Typing, counters and unrelated effects must not trigger a page-wide layout scan. */
export function growthArtworkChanged(records) {
  return records.some(record => record.type === 'attributes'
    ? record.attributeName === 'open' && record.target.matches?.('dialog')
      || record.attributeName === 'hidden' && containsHeart(record.target)
      || record.attributeName === 'class' && record.target.matches?.('.nest')
    : [...record.addedNodes, ...record.removedNodes].some(containsHeart));
}

/** Healthy reference images need neither canvas measurement nor a WebGL fallback. */
export function visibleGrowthFallbacks(root, { width, height }) {
  const result = [];
  for (const image of root.querySelectorAll('.growth-heart-art')) {
    image.parentElement.classList.toggle('has-artwork', image.complete && image.naturalWidth > 0);
  }
  for (const canvas of root.querySelectorAll('.growth-heart-canvas')) {
    const image = canvas.parentElement.querySelector('.growth-heart-art');
    if (image && (!image.complete || image.naturalWidth > 0)) continue;
    if (!canvas.getClientRects().length) continue;
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue;
    result.push(canvas);
  }
  return result;
}

/** One scan per browser frame, even when a claim replaces several artwork slots. */
export function observeGrowthArtwork({ root = document, view = window, scan, needsLayout = () => true }) {
  let frame = null, disposed = false;
  const schedule = () => {
    if (disposed || root.hidden || frame !== null) return;
    frame = view.requestAnimationFrame(() => { frame = null; if (!disposed && !root.hidden) scan(); });
  };
  const cancel = () => { if (frame !== null) view.cancelAnimationFrame(frame); frame = null; };
  const observer = new view.MutationObserver(records => { if (growthArtworkChanged(records)) schedule(); });
  observer.observe(root.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class'] });
  const imageSettled = event => { if (event.target.matches?.('.growth-heart-art')) schedule(); };
  const layoutChanged = () => { if (needsLayout()) schedule(); };
  const visibilityChanged = () => { if (root.hidden) cancel(); else schedule(); };
  root.addEventListener('load', imageSettled, true);
  root.addEventListener('error', imageSettled, true);
  root.addEventListener('scroll', layoutChanged, true);
  root.addEventListener('visibilitychange', visibilityChanged);
  view.addEventListener('resize', layoutChanged);
  view.addEventListener('pagehide', cancel);
  view.addEventListener('pageshow', schedule);
  return { schedule, dispose() {
    disposed = true; cancel(); observer.disconnect();
    root.removeEventListener('load', imageSettled, true);
    root.removeEventListener('error', imageSettled, true);
    root.removeEventListener('scroll', layoutChanged, true);
    root.removeEventListener('visibilitychange', visibilityChanged);
    view.removeEventListener('resize', layoutChanged);
    view.removeEventListener('pagehide', cancel);
    view.removeEventListener('pageshow', schedule);
  } };
}
