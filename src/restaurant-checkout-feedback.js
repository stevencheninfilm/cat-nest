const GOLD_ART = `${import.meta.env?.BASE_URL || './'}assets/restaurant/gold-v1/gold-fish.webp`;
const number = new Intl.NumberFormat('zh-CN');
const center = box => ({x: box.left + box.width / 2, y: box.top + box.height / 2});
const amount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const label = (name, value) => `${name} +${number.format(value)}`;
const emptyTotals = () => ({coins: 0, goldFish: 0, inspiration: 0, commissionCoins: 0});

function flightFrames(from, to, index) {
  const control = {x: from.x + (to.x - from.x) * .35 + (index - 2) * 17, y: Math.min(from.y, to.y) - 28};
  return Array.from({length: 13}, (_, step) => {
    const t = step / 12, u = 1 - t;
    const x = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
    const y = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
    return {transform: `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${160 * t}deg) scale(${1 - .35 * t})`, opacity: 1 - .5 * t};
  });
}

/** Visual feedback for receipts from a local tap. The wallet renders saved values independently. */
export function createRestaurantCheckoutFeedback({layer, status, fishTarget, goldTarget}) {
  const origins = new Map(), animations = new Set(), timers = new Set();
  let totals = emptyTotals(), dismiss;
  const view = layer.ownerDocument.defaultView;

  function remember(orderId, element) {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return;
    origins.set(orderId, center(box));
    if (origins.size > 24) origins.delete(origins.keys().next().value);
  }

  function land(reward) {
    for (const key of Object.keys(totals)) totals[key] += reward[key];
    status.textContent = [
      label('小鱼干', totals.coins) + (totals.commissionCoins ? `（含委托奖励 ${number.format(totals.commissionCoins)}）` : ''),
      totals.goldFish && label('金鱼干', totals.goldFish),
      totals.inspiration && label('灵感', totals.inspiration),
    ].filter(Boolean).join(' · ');
    status.classList.toggle('has-gold', totals.goldFish > 0);
    view.clearTimeout(dismiss);
    dismiss = view.setTimeout(() => {
      status.textContent = '';
      totals = emptyTotals();
    }, 2000);
  }

  function flight(from, target, count, gold) {
    const box = target.getBoundingClientRect();
    if (!box.width || !box.height) return 0;
    const to = center(box), duration = 470, stagger = 29;
    const art = gold ? `<img src="${GOLD_ART}" alt="" draggable="false">` : fishTarget.innerHTML;
    let last = 0;
    for (let index = 0; index < count && animations.size < 20; index++) {
      const token = layer.ownerDocument.createElement('span');
      token.className = `r-checkout-token${gold ? ' is-gold' : ''}`;
      token.innerHTML = art;
      layer.append(token);
      let motion;
      try {
        motion = token.animate(flightFrames(from, to, index), {
          duration, delay: stagger * index, easing: 'cubic-bezier(.32,.12,.25,1)', fill: 'both',
        });
      } catch {
        token.remove();
        break;
      }
      animations.add(motion);
      const finish = () => { animations.delete(motion); token.remove(); };
      motion.finished.then(finish, finish);
      last = duration + stagger * index;
    }
    return last;
  }

  function confirm(orderId, receipt) {
    const from = origins.get(orderId);
    origins.delete(orderId);
    if (!from || !amount(receipt?.coins)) return false;
    const reward = {coins: receipt.coins, goldFish: amount(receipt.goldFish), inspiration: amount(receipt.inspiration), commissionCoins: amount(receipt.commissionCoins)};
    let duration = 0;
    if (!view.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof layer.animate === 'function') {
      duration = flight(from, fishTarget, 6, false);
      if (reward.goldFish) duration = Math.max(duration, flight(from, goldTarget, Math.min(2, reward.goldFish), true));
    }
    if (!duration) land(reward);
    else {
      const timer = view.setTimeout(() => { timers.delete(timer); land(reward); }, duration);
      timers.add(timer);
    }
    return true;
  }

  function reset() {
    origins.clear();
    for (const timer of timers) view.clearTimeout(timer);
    timers.clear();
    for (const motion of animations) motion.cancel();
    animations.clear();
    layer.replaceChildren();
    view.clearTimeout(dismiss);
    totals = emptyTotals();
    status.textContent = '';
  }
  return {remember, confirm, cancel: id => origins.delete(id), reset};
}
