import { NEED_KEYS } from './pet-needs.js';

const COUNT_MS = 320;
const DELTA_ENTER_MS = 100;
const DELTA_HOLD_MS = 2000;
const DELTA_FADE_MS = 800;
const DELTA_MS = DELTA_ENTER_MS + DELTA_HOLD_MS + DELTA_FADE_MS;

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
    frame:null, timer:null, deltaMotion:null, numberMotion:null }));
  let destroyed = false;

  function clear(item) {
    if (item.frame !== null) cancelFrame(item.frame);
    if (item.timer !== null) clearTimer(item.timer);
    item.frame = item.timer = null;
    item.deltaMotion?.cancel(); item.numberMotion?.cancel();
    item.deltaMotion = item.numberMotion = null;
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
      const difference = value - item.target, from = item.displayed;
      clear(item); item.target = value;
      const reduce = reducedMotion();
      item.delta.textContent = `${difference > 0 ? '+' : '−'}${Math.abs(difference)}`;
      item.delta.className = `need-delta ${difference > 0 ? 'is-positive' : 'is-negative'}`;
      item.delta.hidden = false;
      if (reduce) write(item, value);
      else {
        item.deltaMotion = item.delta.animate([
          { opacity:0, transform:'translateY(1px)', easing:'ease-out' },
          { opacity:.96, transform:'translateY(0)', offset:DELTA_ENTER_MS / DELTA_MS },
          { opacity:.96, transform:'translateY(0)', offset:(DELTA_ENTER_MS + DELTA_HOLD_MS) / DELTA_MS, easing:'ease-in-out' },
          { opacity:0, transform:'translateY(-2px)' },
        ], { duration:DELTA_MS, easing:'linear', fill:'both' });
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
      item.timer = setTimer(() => { clear(item); write(item, item.target); }, DELTA_MS);
    }
  }
  return {
    update,
    reset(needs) { update(needs, { animate:false }); },
    destroy() { for (const item of items) clear(item); destroyed = true; },
  };
}
