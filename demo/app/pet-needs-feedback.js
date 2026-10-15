import { NEED_KEYS } from './pet-needs.js';

const COUNT_MS = 320;
const DELTA_ENTER_MS = 100;
const DELTA_HOLD_MS = 2000;
const DELTA_FADE_MS = 800;

/** Presentation only: compare displayed snapshots, never calculate care rewards.
 * Repeated confirmations leave an in-flight transition alone; hydration and
 * rollback use reset() so they cannot masquerade as another care action.
 */
export function createNeedsFeedback({ root, canAnimate = () => true,
  reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  frame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id),
  setTimer = (callback, delay) => setTimeout(callback, delay), clearTimer = id => clearTimeout(id),
  now = () => performance.now(),
}) {
  const items = NEED_KEYS.map(key => ({ key, number:root.querySelector(`#${key}`),
    delta:root.querySelector(`[data-need-delta="${key}"]`), target:null, displayed:null,
    frame:null, timer:null, deltaMotion:null, numberMotion:null, total:0, expiresAt:0 }));
  let destroyed = false;

  function clear(item) {
    if (item.frame !== null) cancelFrame(item.frame);
    if (item.timer !== null) clearTimer(item.timer);
    item.frame = item.timer = null;
    item.deltaMotion?.cancel(); item.numberMotion?.cancel();
    item.deltaMotion = item.numberMotion = null;
    item.total = item.expiresAt = 0;
    item.delta.hidden = true;
    item.delta.textContent = '';
  }
  function write(item, value) {
    item.displayed = value;
    item.number.textContent = String(Math.round(value));
  }
  function update(needs, { animate = true } = {}) {
    if (destroyed) return;
    const visible = animate && canAnimate();
    for (const item of items) {
      const value = needs[item.key];
      if (!visible || item.target === null) {
        clear(item); item.target = value; write(item, value); continue;
      }
      if (value === item.target) continue;
      const time = now(), difference = value - item.target, from = item.displayed;
      const continuing = time < item.expiresAt && !item.delta.hidden;
      const total = (continuing ? item.total : 0) + difference;
      clear(item); item.target = value;
      const reduce = reducedMotion();
      const enterMs = continuing ? 0 : DELTA_ENTER_MS;
      const duration = enterMs + DELTA_HOLD_MS + DELTA_FADE_MS;
      if (total !== 0) {
        item.total = total; item.expiresAt = time + duration;
        item.delta.textContent = `${total > 0 ? '+' : '−'}${Math.abs(total)}`;
        item.delta.className = `need-delta ${total > 0 ? 'is-positive' : 'is-negative'}`;
        item.delta.hidden = false;
      }
      if (reduce) write(item, value);
      else {
        if (total !== 0) item.deltaMotion = item.delta.animate([
          { opacity:continuing ? .96 : 0, transform:`translateY(${continuing ? 0 : 1}px)`, easing:'ease-out' },
          { opacity:.96, transform:'translateY(0)', offset:enterMs / duration },
          { opacity:.96, transform:'translateY(0)', offset:(enterMs + DELTA_HOLD_MS) / duration, easing:'ease-in-out' },
          { opacity:0, transform:'translateY(-2px)' },
        ], { duration, easing:'linear', fill:'both' });
        item.numberMotion = item.number.animate([
          { opacity:.65, transform:'translateY(1px)' },
          { opacity:1, transform:'translateY(-1px)', offset:.6 },
          { opacity:1, transform:'none' },
        ], { duration:COUNT_MS, easing:'ease-out' });
        const start = now();
        const tick = () => {
          const progress = Math.min(1, Math.max(0, (now() - start) / COUNT_MS));
          write(item, from + (value - from) * (1 - (1 - progress) ** 3));
          if (progress < 1) item.frame = frame(tick);
          else item.frame = null;
        };
        item.frame = frame(tick);
      }
      item.timer = setTimer(() => { clear(item); write(item, item.target); }, duration);
    }
  }
  return {
    update,
    reset(needs) { update(needs, { animate:false }); },
    destroy() { for (const item of items) clear(item); destroyed = true; },
  };
}
