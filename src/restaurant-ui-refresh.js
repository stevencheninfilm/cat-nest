/**
 * 猫猫餐厅 UI 刷新层 · 交互反馈（只做表现）
 *
 * - 不派发任何游戏操作，不计算奖励，不读写存档；只观察 DOM 变化并叠加动效。
 * - 在餐厅根节点上加 data-r-ui="refresh" 以启用新外观（样式见 restaurant-ui-refresh.css）。
 * - 想临时回到旧版外观：localStorage 设置 catnest.restaurant.ui = classic。
 * - 尊重系统“减少动态效果”：只保留状态色，不播放位移、缩放与粒子。
 */
export const RESTAURANT_UI_PREFERENCE = 'catnest.restaurant.ui';

const PRESS_TARGETS = [
  '.r-round', '.r-nav button', '.r-level', '.re-wallet', '.rr-research-shortcut', '.r-order-bubble',
  '.r-locked-table', '.rk-zone', '.rk-action-circle', '.rr-door', '.r-recipe-card', '.r-staff-card',
  '.r-recipe-filters button', '.r-panel-switch button', '.r-info-links button', '.r-info-guide',
].join(',');
// Taps on the restaurant floor get a ring; order and collect taps also get a paw print and a light haptic.
const SCENE_TARGETS = '.r-order-bubble,.rk-zone,.rk-action-circle,.rr-door,.r-locked-table';
const REWARD_TARGETS = '.r-order-bubble';
const parseAmount = text => Number(String(text).replace(/[^\d.-]/g, '')) || 0;

export function restaurantUiRefreshEnabled(preferences) {
  try { return preferences?.getItem(RESTAURANT_UI_PREFERENCE) !== 'classic'; } catch { return true; }
}

export function installRestaurantUiRefresh({ container, preferences = null, root = document, view = window } = {}) {
  if (!container || !restaurantUiRefreshEnabled(preferences)) return { destroy() {} };
  const reduced = () => { try { return view.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const cleanups = [];
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); cleanups.push(() => target.removeEventListener(type, handler, options)); };
  const watched = new WeakSet();
  const values = new WeakMap();
  let lastHaptic = 0;

  function spawn(className, x, y, text = '') {
    if (reduced()) return null;
    const node = root.createElement('span');
    node.className = className; node.setAttribute('aria-hidden', 'true');
    node.style.left = `${x}px`; node.style.top = `${y}px`;
    if (text) node.textContent = text;
    root.body.append(node);
    view.setTimeout(() => node.remove(), 1200);
    return node;
  }
  function restartClass(element, className) {
    if (!element || reduced()) return;
    element.classList.remove(className);
    void element.offsetWidth; // restart the CSS animation
    element.classList.add(className);
    view.setTimeout(() => element.classList.remove(className), 600);
  }
  function haptic() {
    const now = Date.now();
    if (now - lastHaptic < 120 || reduced()) return;
    lastHaptic = now;
    try { view.navigator?.vibrate?.(8); } catch {}
  }

  // 按下缩小，松手回弹（使用独立的 scale 属性，不覆盖元素自身的定位 transform）
  function release(target) {
    if (!target?.classList.contains('rfx-press')) return;
    target.classList.remove('rfx-press');
    if (reduced() || !target.animate) return;
    try { target.animate([{ scale: '.93' }, { scale: '1.06' }, { scale: '1' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' }); } catch {}
  }
  let pressed = null;
  listen(container, 'pointerdown', event => {
    const restaurant = event.target.closest?.('.restaurant[data-r-ui="refresh"]');
    if (!restaurant) return;
    const target = event.target.closest(PRESS_TARGETS);
    if (target && !target.disabled && target.getAttribute('aria-disabled') !== 'true') {
      pressed = target; target.classList.add('rfx-press');
    }
    const scene = event.target.closest(SCENE_TARGETS);
    if (scene && !scene.disabled) {
      spawn('rfx-tap', event.clientX, event.clientY);
      if (scene.matches(REWARD_TARGETS)) { spawn('rfx-tap is-paw', event.clientX, event.clientY - 6); haptic(); }
    }
  }, { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    listen(container, type, () => { release(pressed); pressed = null; }, { passive: true });
  }
  listen(view, 'blur', () => { release(pressed); pressed = null; });

  // 金额增加：数字弹跳 + 飘出 +N（以界面上真实显示的数字为准）
  function watchAmount(element, gold = false) {
    if (!element || watched.has(element)) return;
    watched.add(element); values.set(element, parseAmount(element.textContent));
    const observer = new MutationObserver(() => {
      const before = values.get(element) ?? 0, after = parseAmount(element.textContent);
      values.set(element, after);
      if (!(after > before) || !element.isConnected) return;
      restartClass(element, 'rfx-bump');
      restartClass(element.closest('.r-wallet,.re-wallet'), 'rfx-bump-shell');
      const box = element.getBoundingClientRect(), shell = (element.closest('.r-wallet,.re-wallet') || element).getBoundingClientRect();
      if (box.width) spawn(`rfx-delta${gold ? ' is-gold' : ''}`, box.left + box.width / 2, shell.bottom + 10, `+${(after - before).toLocaleString('zh-CN')}`);
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    cleanups.push(() => observer.disconnect());
  }
  // 场景提示换句时轻轻滑入，提醒“下一步变了”
  function watchHint(element) {
    if (!element || watched.has(element)) return;
    watched.add(element);
    let text = element.textContent;
    const observer = new MutationObserver(() => {
      if (element.textContent === text) return;
      text = element.textContent; restartClass(element, 'rfx-hint-new');
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    cleanups.push(() => observer.disconnect());
  }

  function attach() {
    const restaurant = container.querySelector('.restaurant');
    if (!restaurant) return;
    if (restaurant.dataset.rUi !== 'refresh') restaurant.dataset.rUi = 'refresh';
    watchAmount(restaurant.querySelector('[data-r-wallet]'));
    watchAmount(restaurant.querySelector('[data-r-gold]'), true);
    watchHint(restaurant.querySelector('[data-r-hint]'));
  }
  const mountObserver = new MutationObserver(attach);
  mountObserver.observe(container, { childList: true });
  cleanups.push(() => mountObserver.disconnect());
  attach();

  return { destroy() { cleanups.splice(0).forEach(fn => fn()); } };
}
