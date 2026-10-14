import { catbookMarkup, collectionScene } from './catbook-ui.js';
import { canInviteCat } from './cat-collection.js';
import { levelInfo } from './state.js';

export function createCatbook({ container, getState, getAvailability, onAction, onBack, initialScene='garden', onSceneChange }) {
  let tab='book', catId='bandit', sceneId=initialScene, panel=null, detailOrigin=null;
  let trigger=null, drag=null, petTap=null, blockCatClickUntil=0;
  const petTapDuration=620;
  const cameras=new Map(), sheetScroll=new Map();
  const token = element => {
    const key=['bookCat','bookTab','bookScene','bookInvite','bookOpen'].find(key => element?.dataset?.[key]);
    const origin=element?.closest('.book-game-menu') ? 'menu' : element?.closest('.book-game-topbar') ? 'top' : element?.closest('.book-yard-camera') ? 'yard' : null;
    return key ? { key, value:element.dataset[key], page:element.dataset.bookPage, origin } : null;
  };
  function findToken(scope, value) {
    return value && [...scope.querySelectorAll('button')].find(button => !button.disabled && button.dataset[value.key] === value.value && (!value.page || button.dataset.bookPage === value.page) && (!value.origin || token(button)?.origin === value.origin));
  }
  function render({ restore=false, heading=false } = {}) {
    cancelPetTap();
    if (container.hidden) return;
    const focus=token(document.activeElement);
    const previousCamera=container.querySelector('.book-yard-camera');
    const previousScene=container.querySelector('[data-scene-id]')?.dataset.sceneId;
    if (previousCamera && previousScene) cameras.set(previousScene,{ x:previousCamera.scrollLeft, y:previousCamera.scrollTop });
    const previousSheet=container.querySelector('dialog[open]');
    if (previousSheet) sheetScroll.set(previousSheet.dataset.bookSheet,previousSheet.querySelector('.book-sheet-scroll').scrollTop);
    const state=getState();
    sceneId=collectionScene(sceneId,state.collection.invited.length).id;
    container.innerHTML=catbookMarkup(state,{ tab, catId, sceneId, detailFromCatalog:detailOrigin === 'catalog', ...getAvailability() });
    const camera=container.querySelector('.book-yard-camera');
    const position=cameras.get(sceneId);
    camera.scrollLeft=position?.x ?? (camera.scrollWidth-camera.clientWidth)/2;
    camera.scrollTop=position?.y ?? (camera.scrollHeight-camera.clientHeight)*.55;
    if (panel) {
      const dialog=container.querySelector(`[data-book-sheet="${panel}"]`);
      dialog.showModal();
      dialog.querySelector('.book-sheet-scroll').scrollTop=sheetScroll.get(panel) || 0;
      const target=heading ? dialog.querySelector('.book-detail h2') : findToken(dialog,focus);
      (target || (panel === 'detail' ? dialog.querySelector('.book-detail h2') : dialog.querySelector('[data-book-dismiss]')))?.focus({ preventScroll:true });
    } else if (restore) {
      (findToken(container,trigger) || container.querySelector('[data-catbook-back]'))?.focus({ preventScroll:true });
    } else findToken(container,focus)?.focus({ preventScroll:true });
  }
  function cancelPetTap() {
    if (!petTap) return;
    clearTimeout(petTap.timer);
    petTap.button.classList.remove('is-petted');
    petTap=null;
  }
  function openCat(button) {
    detailOrigin=panel === 'catalog' ? 'catalog' : null;
    if (!panel) trigger=token(button);
    catId=button.dataset.bookCat; panel='detail'; sheetScroll.set('detail',0); render({ heading:true });
  }
  function petCat(button) {
    cancelPetTap();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { openCat(button); return; }
    // Restart the response on every tap, including repeated taps on the same cat.
    void button.offsetWidth;
    button.style.setProperty('--pet-tap-duration',`${petTapDuration}ms`);
    button.classList.add('is-petted');
    petTap={ button, timer:setTimeout(() => {
      const active=button.isConnected && !container.hidden && !panel;
      cancelPetTap();
      if (active) openCat(button);
    },petTapDuration) };
  }
  function dismiss() { panel=null; detailOrigin=null; render({ restore:true }); }
  container.addEventListener('click', event => {
    if (event.target.matches('dialog.book-sheet')) {
      const bounds=event.target.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      return;
    }
    const button=event.target.closest('button');
    if (!button || !container.contains(button) || button.disabled) return;
    if (button.dataset.bookCat && button.closest('.book-yard-camera') && Date.now() < blockCatClickUntil) return;
    if (button.hasAttribute('data-catbook-back')) { cancelPetTap(); onBack(); return; }
    if (button.hasAttribute('data-book-dismiss')) { dismiss(); return; }
    if (button.hasAttribute('data-book-detail-back')) {
      if (detailOrigin === 'catalog') { panel='catalog'; render(); findToken(container.querySelector('[data-book-sheet="catalog"]'),{key:'bookCat',value:catId})?.focus({preventScroll:true}); }
      else dismiss();
      return;
    }
    if (button.dataset.bookOpen) {
      trigger=token(button); panel=button.dataset.bookOpen;
      if (button.dataset.bookPage) tab=button.dataset.bookPage;
      render(); return;
    }
    if (button.dataset.bookTab) { tab=button.dataset.bookTab; sheetScroll.set('catalog',0); render(); return; }
    if (button.dataset.bookCat) {
      if (button.closest('.book-yard-camera')) petCat(button);
      else openCat(button);
      return;
    }
    if (button.dataset.bookScene) {
      sceneId=button.dataset.bookScene; onSceneChange?.(sceneId); dismiss(); return;
    }
    if (button.dataset.bookInvite) {
      const state=getState(), availability=getAvailability();
      if (!availability.saving && availability.connected && canInviteCat(button.dataset.bookInvite,state.collection,levelInfo(state.xp).level)) onAction({ type:'invite-cat', catId:button.dataset.bookInvite });
    }
  });
  container.addEventListener('cancel', event => { event.preventDefault(); dismiss(); },true);
  container.addEventListener('keydown', event => {
    if (!event.ctrlKey && !event.metaKey && event.target.dataset.bookTab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      tab=event.key === 'Home' ? 'book' : event.key === 'End' ? 'achievements' : tab === 'book' ? 'achievements' : 'book';
      sheetScroll.set('catalog',0); render(); container.querySelector(`[data-book-tab="${tab}"]`).focus({preventScroll:true});
    }
    if (event.key === 'Escape') { event.preventDefault(); cancelPetTap(); if (panel) dismiss(); else onBack(); }
  });
  // Touch uses native scrolling. Mouse dragging pans without opening a cat.
  container.addEventListener('pointerdown', event => {
    const camera=event.target.closest('.book-yard-camera');
    if (!camera) return;
    cancelPetTap();
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag={ camera, id:event.pointerId, x:event.clientX, y:event.clientY, left:camera.scrollLeft, top:camera.scrollTop, moved:false };
  });
  container.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId || !drag.camera.isConnected) return;
    const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy) < 6) return;
    if (!drag.moved) { drag.moved=true; drag.camera.setPointerCapture(event.pointerId); drag.camera.classList.add('is-dragging'); }
    drag.camera.scrollLeft=drag.left-dx;
  });
  const stopDrag=() => {
    if (!drag) return;
    if (drag.moved) blockCatClickUntil=Date.now()+200;
    drag.camera.classList.remove('is-dragging'); drag=null;
  };
  container.addEventListener('pointerup',stopDrag);
  container.addEventListener('pointercancel',stopDrag);
  return { render, open() { panel=null; detailOrigin=null; container.hidden=false; render(); container.querySelector('[data-catbook-back]').focus({preventScroll:true}); }, close() { cancelPetTap(); panel=null; container.querySelector('dialog[open]')?.close(); container.hidden=true; } };
}
