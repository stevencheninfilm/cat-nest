const SPRING = 'cubic-bezier(.2,.8,.25,1)';
const CARE_TYPES = new Set(['feed', 'pet', 'touch', 'play', 'sleep']);
const MAX_NODES = 36;

/** Presentation only. Never dispatches actions, calculates rewards or saves state. */
export function createInteractionFeedback({
  root = document, view = window, getCat = () => root.querySelector('#cat'),
  canPresent = () => true,
  reducedMotion = () => view.matchMedia('(prefers-reduced-motion: reduce)').matches,
  now = () => view.performance.now(),
} = {}) {
  const layer = root.createElement('div');
  layer.className = 'nest-motion-layer'; layer.setAttribute('aria-hidden', 'true');
  root.body.append(layer);
  const active = new Set(), presses = new Map(), pointers = new Map(), seen = new Set(), listeners = [];
  let lastInput = null, serial = 0, destroyed = false;
  const visible = () => !destroyed && !root.hidden && canPresent();
  const moving = () => visible() && !reducedMotion();
  const listen = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  };
  const rect = element => {
    if (!element?.isConnected) return null;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 ? box : null;
  };
  const point = (box, x = .5, y = .5) => ({ x: box.left + box.width * x, y: box.top + box.height * y });
  function once(kind, operationId) {
    if (!operationId) return true;
    const key = `${kind}:${operationId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (seen.size > 160) seen.delete(seen.values().next().value);
    return true;
  }
  function animate(element, frames, options, { remove = false, operationId, done, hold = false } = {}) {
    if (!moving() || !element?.animate) { if (remove) element.remove(); return null; }
    let motion;
    try { motion = element.animate(frames, { fill: 'both', ...options }); }
    catch { if (remove) element.remove(); return null; }
    const item = { element, motion, operationId, remove, timer: null };
    active.add(item);
    let settled = false;
    const finish = completed => {
      if (settled) return;
      settled = true;
      view.clearTimeout(item.timer); active.delete(item);
      motion.cancel();
      if (remove) element.remove();
      if (completed && moving()) done?.();
    };
    item.cancel = () => finish(false);
    // The timer also releases disconnected buttons when a view is replaced.
    item.timer = view.setTimeout(() => finish(!hold), hold ? 5000 : (options.delay || 0) + options.duration + 100);
    motion.finished.then(() => { if (!hold) finish(true); }, () => finish(false));
    return item;
  }
  function node(className, at, text) {
    if (layer.childElementCount >= MAX_NODES) return null;
    const element = root.createElement('span');
    element.className = className;
    element.style.left = `${at.x}px`; element.style.top = `${at.y}px`;
    if (text) element.textContent = text;
    layer.append(element); return element;
  }
  function pulse(element, operationId) {
    if (!rect(element)) return null;
    return animate(element, [
      { scale: '1', opacity: 1 }, { scale: '1.035', opacity: .86, offset: .36 }, { scale: '1', opacity: 1 },
    ], { duration: 360, easing: SPRING }, { operationId });
  }
  function burst(at, kind, operationId, count = 6) {
    const hearts = kind === 'pet' || kind === 'touch';
    for (let index = 0; index < count; index += 1) {
      const particle = node(`nest-motion-particle ${hearts ? 'is-heart' : 'is-star'}`, at, hearts ? '♥' : '✦');
      if (!particle) break;
      const angle = (index / count * 1.2 + .9) * Math.PI;
      const distance = 24 + index % 3 * 11;
      const dx = Math.cos(angle) * distance, dy = Math.sin(angle) * distance - 30;
      animate(particle, [
        { opacity: 0, transform: 'translate3d(-50%,-50%,0) scale(.35)' },
        { opacity: .95, transform: `translate3d(calc(-50% + ${dx * .35}px),calc(-50% + ${dy * .3}px),0) scale(1)`, offset: .22 },
        { opacity: 0, transform: `translate3d(calc(-50% + ${dx}px),calc(-50% + ${dy}px),0) scale(.65) rotate(${index % 2 ? 15 : -15}deg)` },
      ], { duration: hearts ? 820 : 650, delay: index * 22, easing: 'ease-out' }, { remove: true, operationId });
    }
  }
  function ring(at, operationId) {
    const element = node('nest-motion-ring', at);
    if (element) animate(element, [
      { opacity: .6, transform: 'translate(-50%,-50%) scale(.35)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' },
    ], { duration: 450, easing: 'ease-out' }, { remove: true, operationId });
  }
  const buttonFrom = event => event.target?.closest?.('button, a[role="button"]');
  const enabled = button => button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  function release(button, bounce = true) {
    presses.get(button)?.cancel(); presses.delete(button);
    button?.classList.remove('has-motion-press');
    if (bounce && enabled(button) && moving()) animate(button, [
      { scale: '.965' }, { scale: '1.018', offset: .55 }, { scale: '1' },
    ], { duration: 260, easing: SPRING });
  }
  listen(root, 'pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const button = buttonFrom(event);
    if (!enabled(button) || !moving()) return;
    pointers.set(event.pointerId, { button, x: event.clientX, y: event.clientY });
    // Cat rotation and drag gestures keep their existing transform ownership.
    if (button.matches('#cat, .catbook-actor')) return;
    release(button, false); button.classList.add('has-motion-press');
    const item = animate(button, [{ scale: '1' }, { scale: '.965' }], { duration: 90, easing: 'ease-out' }, { hold: true });
    if (item) presses.set(button, item);
  }, { passive: true, capture: true });
  listen(root, 'pointermove', event => {
    const input = pointers.get(event.pointerId);
    if (input && Math.hypot(event.clientX - input.x, event.clientY - input.y) > 10) {
      release(input.button, false); pointers.delete(event.pointerId);
    }
  }, { passive: true, capture: true });
  listen(root, 'pointerup', event => {
    const input = pointers.get(event.pointerId);
    if (input) { release(input.button, !input.button.matches('#cat, .catbook-actor')); pointers.delete(event.pointerId); }
  }, { passive: true, capture: true });
  listen(root, 'pointercancel', event => {
    const input = pointers.get(event.pointerId);
    if (input) { release(input.button, false); pointers.delete(event.pointerId); }
  }, { passive: true, capture: true });
  listen(root, 'click', event => {
    const button = buttonFrom(event);
    if (!enabled(button)) return;
    const box = rect(button);
    lastInput = { at: now(), point: event.detail && box ? { x:event.clientX, y:event.clientY } : box ? point(box) : null, catTouch:button.id === 'cat', food: null };
    if (button.id === 'serve-food') {
      const dish = root.querySelector('.dish-food');
      if (rect(dish)) lastInput.food = { box: rect(dish), art: dish.cloneNode(true) };
    }
    if (event.detail === 0 && !button.matches('#cat, .catbook-actor')) release(button);
  }, { capture: true });

  function clear(operationId) {
    for (const item of [...active]) if (operationId === undefined || item.operationId === operationId) item.cancel();
    if (operationId === undefined) {
      for (const button of presses.keys()) button.classList.remove('has-motion-press');
      presses.clear(); pointers.clear(); lastInput = null;
    }
  }
  listen(root, 'visibilitychange', () => { if (root.hidden) clear(); });
  listen(view, 'pagehide', () => clear());
  listen(view, 'blur', () => clear());
  listen(view, 'resize', () => clear());
  const preference = view.matchMedia('(prefers-reduced-motion: reduce)');
  listen(preference, 'change', () => { if (reducedMotion()) clear(); });

  return {
    care(type, { local = true, sleeping = false, operationId, foodMarkup = '' } = {}) {
      if (!CARE_TYPES.has(type) || !once('care', operationId) || !moving()) return;
      const box = rect(getCat()); if (!box) return;
      const at = point(box, .5, type === 'feed' ? .66 : .4);
      if (local && ['touch', 'pet'].includes(type) && lastInput?.catTouch && lastInput.point && now() - lastInput.at < 1400) {
        at.x = Math.max(box.left + 15, Math.min(box.right - 15, lastInput.point.x));
        at.y = Math.max(box.top + 15, Math.min(box.bottom - 15, lastInput.point.y));
      }
      if (type === 'feed') {
        const food = local && lastInput && now() - lastInput.at < 1400 ? lastInput.food : null;
        const from = food ? point(food.box) : point(box, .5, .95);
        const dish = node('nest-motion-food', from);
        if (dish) {
          if (food) dish.append(food.art);
          else if (foodMarkup) dish.innerHTML = foodMarkup;
          else dish.textContent = '♡';
          animate(dish, [
            { opacity: 0, transform: 'translate(-50%,-50%) scale(.7)' },
            { opacity: 1, transform: `translate(calc(-50% + ${(at.x - from.x) * .45}px),calc(-50% + ${(at.y - from.y) * .45 - 22}px)) scale(1.05) rotate(-6deg)`, offset: .45 },
            { opacity: 0, transform: `translate(calc(-50% + ${at.x - from.x}px),calc(-50% + ${at.y - from.y}px)) scale(.28)` },
          ], { duration: 540, easing: SPRING }, { remove: true, operationId, done() { ring(at, operationId); burst(at, type, operationId); } });
        }
      }
      if (!sleeping && type !== 'feed') { ring(at, operationId); burst(at, type, operationId, type === 'touch' ? 3 : 6); }
      else if (type === 'sleep') {
        const moon = node('nest-motion-sleep', point(box, .7, .22), '☾');
        if (moon) animate(moon, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: .85, offset: .25 }, { opacity: 0, transform: 'translateY(-18px)' }], { duration: 1000, easing: 'ease-out' }, { remove: true, operationId });
      }
      if (local && view.navigator?.vibrate) view.navigator.vibrate(8);
    },
    collect({ origin, target, artwork, operationId } = {}) {
      if (!once('collect', operationId) || !moving()) return;
      const end = rect(target); if (!origin || !end) return;
      const from = point(origin), to = point(end);
      const group = operationId || `local-collect-${++serial}`;
      ring(from, group);
      for (let index = 0; index < 3; index += 1) {
        const heart = node('nest-motion-reward', from); if (!heart) break;
        if (artwork) {
          const image = root.createElement('img'); image.src = artwork; image.alt = ''; image.draggable = false; heart.append(image);
        } else heart.textContent = '♥';
        animate(heart, [
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.7)' },
          { opacity: 1, offset: .12 },
          { opacity: 1, transform: `translate(calc(-50% + ${(to.x - from.x) * .46 + (index - 1) * 14}px),calc(-50% + ${(to.y - from.y) * .46 - 36}px)) scale(1.06) rotate(-8deg)`, offset: .48 },
          { opacity: 0, transform: `translate(calc(-50% + ${to.x - from.x}px),calc(-50% + ${to.y - from.y}px)) scale(.25)` },
        ], { duration: 690, delay: index * 55, easing: SPRING }, { remove: true, operationId: group, done: index === 2 ? () => pulse(target, group) : undefined });
      }
    },
    panel(element) {
      if (moving()) animate(element, [{ opacity: 0, transform: 'translateY(9px) scale(.99)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 230, easing: SPRING });
    },
    selection(element) { if (moving()) pulse(element); },
    rewardReady(element, operationId) {
      if (!once('reward', operationId) || !rect(element) || !moving()) return;
      animate(element.querySelector('.growth-orb') || element, [
        { opacity: 0, scale: '.65', translate: '0 5px' },
        { opacity: 1, scale: '1.055', translate: '0 -1px', offset: .65 },
        { opacity: 1, scale: '1', translate: '0 0' },
      ], { duration: 420, easing: SPRING }, { operationId });
    },
    rollback(operationId) { if (operationId) clear(operationId); },
    clear,
    destroy() { clear(); destroyed = true; listeners.forEach(remove => remove()); layer.remove(); },
  };
}
