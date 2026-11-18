export function supperShortcut(icon) {
  return `<button type="button" class="rs-shortcut" data-r-tab="supper" aria-haspopup="dialog" aria-controls="r-panel-dialog">
    <img src="${icon}" alt="" draggable="false" width="44" height="42">
    <strong>主题餐会</strong><small data-r-supper-status>常驻活动</small>
  </button>`;
}

export function supperGarlands() {
  const strand = '<span><i></i><i></i><i></i><i></i><i></i></span>';
  return `<div class="rs-garlands" aria-hidden="true" hidden>${strand}${strand}</div>`;
}

export function paintSupperScene(shortcut, garlands, club) {
  const active = club.active;
  const theme = active?.themeId || '';
  const status = active ? `${active.progress}/${active.target}` : club.unlocked ? '常驻活动' : `Lv.${club.unlockLevel} 开席`;
  const hint = active ? `${club.themes.find(item => item.id === theme).name}，进度 ${status}` : status;
  const label = `查看主题餐会，${hint}`;
  if (shortcut.getAttribute('aria-label') !== label) {
    shortcut.setAttribute('aria-label',label);
    shortcut.querySelector('[data-r-supper-status]').textContent = status;
    shortcut.dataset.theme = theme;
  }
  if (garlands.hidden !== !active || garlands.dataset.theme !== theme) {
    garlands.hidden = !active;
    garlands.dataset.theme = theme;
  }
}

// The same seat can fall under the control on a tall phone but clear it on
// a desktop. Keep the order and its sibling reachable at their actual sizes.
export function fitSupperOrders(stage, shortcut) {
  const seats = [...stage.querySelectorAll('[data-r-supper-front-seat]')];
  if (!seats.length) return;
  for (const seat of seats) {
    if (seat.hasAttribute('data-supper-clearance')) {
      seat.removeAttribute('data-supper-clearance');
      seat.firstElementChild.style.removeProperty('margin-left');
    }
  }
  let obstacle = shortcut.getBoundingClientRect();
  for (const seat of seats) {
    const bubble = seat.firstElementChild;
    const bounds = bubble.getBoundingClientRect();
    if (bounds.top >= obstacle.bottom || bounds.bottom <= obstacle.top || bounds.left >= obstacle.right + 4 || bounds.right <= obstacle.left) break;
    seat.setAttribute('data-supper-clearance','');
    const compact = bubble.getBoundingClientRect();
    const shift = Math.max(0, Math.ceil(obstacle.right + 5 - compact.left));
    bubble.style.marginLeft = `${shift}px`;
    obstacle = {top:compact.top,bottom:compact.bottom,left:compact.left+shift,right:compact.right+shift};
  }
}
