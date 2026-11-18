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
