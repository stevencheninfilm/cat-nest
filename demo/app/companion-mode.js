/** Local presentation only: cat interactions keep using the normal care flow. */
export function createCompanionMode({ nest, cat, controls, onChange }) {
  const exitButton = controls.querySelector('[data-companion-exit]');
  const ui = [...nest.children].filter(element => !element.matches('.room-backdrop, .warm-overlay, .sun-dust, .scene, .companion-controls'));
  ui.push(...[...nest.querySelector('.scene').children].filter(element => !element.matches('.cat-button, .cat-shadow, #particles')));
  let active = false, hideTimer, returnFocus;
  const previousInert = new Map();
  const previousDescription = cat.getAttribute('aria-describedby');

  function reveal() {
    if (!active) return;
    clearTimeout(hideTimer);
    controls.classList.add('is-visible');
    hideTimer = setTimeout(() => controls.classList.remove('is-visible'), 3500);
  }

  function enter(trigger, { keyboard = false } = {}) {
    if (active) return;
    returnFocus = trigger;
    active = true;
    for (const element of ui) {
      previousInert.set(element, element.inert);
      element.inert = true;
    }
    document.body.classList.add('companion-mode');
    nest.classList.add('is-companion');
    controls.hidden = false;
    cat.setAttribute('aria-describedby', [previousDescription, 'companion-hint'].filter(Boolean).join(' '));
    if (keyboard) cat.focus({ preventScroll: true });
    reveal();
    onChange?.(active);
  }

  function exit() {
    if (!active) return;
    active = false;
    clearTimeout(hideTimer);
    controls.hidden = true;
    controls.classList.remove('is-visible');
    document.body.classList.remove('companion-mode');
    nest.classList.remove('is-companion');
    for (const [element, inert] of previousInert) element.inert = inert;
    previousInert.clear();
    if (previousDescription === null) cat.removeAttribute('aria-describedby');
    else cat.setAttribute('aria-describedby', previousDescription);
    onChange?.(active);
    const target = returnFocus?.isConnected && !returnFocus.closest('dialog') ? returnFocus : nest.querySelector('[data-companion-enter]');
    target?.focus({ preventScroll: true });
  }

  nest.addEventListener('click', event => {
    if (!event.target.closest('.cat-button, .companion-controls')) reveal();
  });
  controls.addEventListener('focusin', reveal);
  exitButton.addEventListener('click', exit);
  document.addEventListener('keydown', event => {
    if (!active || event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); exit(); }
    else if (event.key === 'Tab') reveal();
  });
  return { get active() { return active; }, enter, exit };
}
