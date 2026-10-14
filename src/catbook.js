import { catbookMarkup, collectionScene } from './catbook-ui.js';
import { canInviteCat } from './cat-collection.js';
import { levelInfo } from './state.js';

export function createCatbook({ container, getState, getAvailability, onAction, onBack, initialScene='garden', onSceneChange }) {
  let tab='book', catId='bandit', sceneId=initialScene;
  function render() {
    if (container.hidden) return;
    const focus = document.activeElement;
    const key = ['bookCat','bookTab','bookScene','bookInvite'].find(key => focus?.dataset?.[key]);
    const value = key ? focus.dataset[key] : null;
    const scroll = window.scrollY;
    const state = getState();
    sceneId = collectionScene(sceneId, state.collection.invited.length).id;
    container.innerHTML = catbookMarkup(state, { tab, catId, sceneId, ...getAvailability() });
    if (key) {
      const target = [...container.querySelectorAll('button')].find(button => button.dataset[key] === value && !button.disabled);
      (target || (key === 'bookInvite' ? container.querySelector('.book-detail h2') : null))?.focus({ preventScroll:true });
    }
    window.scrollTo(0, scroll);
  }
  container.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !container.contains(button) || button.disabled) return;
    if (button.hasAttribute('data-catbook-back')) { onBack(); return; }
    if (button.dataset.bookTab) { tab=button.dataset.bookTab; render(); return; }
    if (button.dataset.bookCat) {
      catId=button.dataset.bookCat; render();
      container.querySelector('.book-detail').scrollIntoView({ block:'nearest', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    if (button.dataset.bookScene) { sceneId=button.dataset.bookScene; onSceneChange?.(sceneId); render(); return; }
    if (button.dataset.bookInvite) {
      const state = getState();
      if (!getAvailability().saving && getAvailability().connected && canInviteCat(button.dataset.bookInvite, state.collection, levelInfo(state.xp).level)) onAction({ type:'invite-cat', catId:button.dataset.bookInvite });
    }
  });
  container.addEventListener('keydown', event => {
    if (event.target.dataset.bookTab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      tab = event.key === 'Home' ? 'book' : event.key === 'End' ? 'achievements' : tab === 'book' ? 'achievements' : 'book';
      render(); container.querySelector(`[data-book-tab="${tab}"]`).focus();
    }
    if (event.key === 'Escape') { event.preventDefault(); onBack(); }
  });
  return { render, open() { container.hidden=false; render(); container.querySelector('[data-catbook-back]').focus({ preventScroll:true }); }, close() { container.hidden=true; } };
}
