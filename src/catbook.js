import { catbookMarkup, collectionScene, catArrivalMarkup, collectionNoticeMarkup } from './catbook-ui.js';
import { canInviteCat, getCollectionCat } from './cat-collection.js';
import { sceneCatPlacement } from './catbook-scenes.js';
import { createCollectionEvents, catArrivalRoute, CAT_ARRIVAL_MS } from './catbook-events.js';
import { levelInfo } from './state.js';

export function createCatbook({ container, getState, getAvailability, onAction, onBack, initialScene='garden', onSceneChange }) {
  let tab='book', catId='bandit', sceneId=initialScene, panel=null, detailOrigin=null;
  let trigger=null, drag=null, petTap=null, blockCatClickUntil=0;
  let presentation=null, ownInvitation=null, ownInvitationSaving=false, sceneRevealAt=0;
  const events=createCollectionEvents(getState()), rewards=[];
  const walkingImage=new Image();
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
    const state=getState(), updates=events.observe(state);
    rewards.push(...updates);
    for(let index=rewards.length-1;index>=0;index--) {
      if(rewards[index].type === 'cat-unlocked' && state.collection.invited.some(cat=>cat.id === rewards[index].id)) rewards.splice(index,1);
    }
    const welcomed=updates.find(event=>event.type === 'cat-arrived' && event.id === ownInvitation);
    const availability=getAvailability();
    if(ownInvitation && availability.saving) ownInvitationSaving=true;
    if(ownInvitationSaving && !availability.saving && !welcomed) { ownInvitation=null;ownInvitationSaving=false; }
    if(welcomed) {
      stopPresentation();
      panel=null; detailOrigin=null; ownInvitation=null;ownInvitationSaving=false;
      trigger={key:'bookCat',value:welcomed.id,origin:'yard'};
      rewards.splice(rewards.indexOf(welcomed),1); rewards.unshift(welcomed);
    }
    if (container.hidden) return;
    const focus=token(document.activeElement);
    const previousCamera=container.querySelector('.book-yard-camera');
    const previousScene=container.querySelector('[data-scene-id]')?.dataset.sceneId;
    if (previousCamera && previousScene) cameras.set(previousScene,{ x:previousCamera.scrollLeft, y:previousCamera.scrollTop });
    const previousSheet=container.querySelector('dialog[open]');
    if (previousSheet) sheetScroll.set(previousSheet.dataset.bookSheet,previousSheet.querySelector('.book-sheet-scroll').scrollTop);
    sceneId=collectionScene(sceneId,state.collection,levelInfo(state.xp).level).id;
    startPresentation();
    const age=presentation ? performance.now()-presentation.startedAt : 0;
    const arriving=presentation?.event.type === 'cat-arrived';
    const walking=arriving && age < presentation.travelMs;
    container.innerHTML=catbookMarkup(state,{ tab, catId, sceneId, detailFromCatalog:detailOrigin === 'catalog', arrivingCatId:walking ? presentation.event.id : null, settlingCatId:arriving && !walking ? presentation.event.id : null, arrivalAge:arriving ? Math.max(0,age-presentation.travelMs) : 0, ...getAvailability() });
    const camera=container.querySelector('.book-yard-camera');
    const position=cameras.get(sceneId);
    camera.scrollLeft=position?.x ?? (camera.scrollWidth-camera.clientWidth)/2;
    camera.scrollTop=position?.y ?? (camera.scrollHeight-camera.clientHeight)*.55;
    if(walking) renderArrival(camera,age);
    if(sceneRevealAt && performance.now()-sceneRevealAt < 900) {
      container.querySelector('.book-yard-background').classList.add('is-scene-revealing');
      container.querySelector('.book-yard-background').style.animationDelay=`${sceneRevealAt-performance.now()}ms`;
    }
    if (panel) {
      const dialog=container.querySelector(`[data-book-sheet="${panel}"]`);
      dialog.showModal();
      dialog.querySelector('.book-sheet-scroll').scrollTop=sheetScroll.get(panel) || 0;
      const target=heading ? dialog.querySelector('.book-detail h2') : findToken(dialog,focus);
      (target || (panel === 'detail' ? dialog.querySelector('.book-detail h2') : dialog.querySelector('[data-book-dismiss]')))?.focus({ preventScroll:true });
    } else if (restore) {
      (findToken(container,trigger) || container.querySelector('[data-catbook-back]'))?.focus({ preventScroll:true });
    } else findToken(container,focus)?.focus({ preventScroll:true });
    if(presentation && !presentation.dismissed) {
      const layer=document.createElement('div');
      layer.className=`book-reward-layer${panel ? ' in-sheet' : ''}`;
      layer.innerHTML=collectionNoticeMarkup(presentation.event,{sceneId,settled:arriving && !walking,age});
      if(panel) container.querySelector('dialog[open] .book-sheet-header').after(layer);
      else container.querySelector('.catbook').append(layer);
    }
    if(presentation?.event.type === 'scene-unlocked') {
      for(const target of container.querySelectorAll(`[data-book-scene="${presentation.event.id}"], [data-book-open="scenes"]`)) {
        target.classList.add('is-unlocked');target.style.setProperty('--reward-age',`${-age}ms`);
      }
    }
  }
  function startPresentation() {
    if(presentation || document.hidden) return;
    const index=rewards.findIndex(event=>!panel || event.type !== 'cat-arrived');
    if(index<0) return;
    const event=rewards.splice(index,1)[0];
    const travelMs=event.type === 'cat-arrived' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? CAT_ARRIVAL_MS : 0;
    presentation={event,startedAt:performance.now(),travelMs,route:null};
    presentation.timer=setTimeout(()=>{stopPresentation();render();},event.type === 'cat-arrived' ? travelMs+1600 : 6500);
    if(travelMs) presentation.settleTimer=setTimeout(()=>render(),travelMs);
  }
  function stopPresentation({pause=false,pauseAll=false}={}) {
    if(!presentation) return;
    clearTimeout(presentation.timer);clearTimeout(presentation.settleTimer);
    presentation.animation?.cancel();
    if(pauseAll || (pause && presentation.event.type === 'cat-arrived' && performance.now()-presentation.startedAt < presentation.travelMs)) rewards.unshift(presentation.event);
    presentation=null;
  }
  function renderArrival(camera,age) {
    const state=getState(), scene=collectionScene(sceneId,state.collection,levelInfo(state.xp).level), cat=getCollectionCat(presentation.event.id);
    const yard=container.querySelector('.book-yard'), width=yard.clientWidth, height=yard.clientHeight;
    if(!presentation.route) {
      const place=sceneCatPlacement(scene,cat);
      camera.scrollLeft=Math.max(0,Math.min(width-camera.clientWidth,width*place.x/100-camera.clientWidth/2));
      camera.scrollTop=Math.max(0,Math.min(height-camera.clientHeight,height*place.y/100-camera.clientHeight*.5));
      presentation.route=catArrivalRoute(scene,cat,{width,height,left:camera.scrollLeft,top:camera.scrollTop,viewWidth:camera.clientWidth,viewHeight:camera.clientHeight});
    }
    presentation.animation?.cancel();
    const layer=container.querySelector('.book-arrivals');
    layer.innerHTML=catArrivalMarkup(cat,presentation.route.direction);
    const traveller=layer.querySelector('.book-arrival');
    traveller.style.width=`${Math.max(55,Math.min(88,width*.16))}px`;
    presentation.animation=traveller.animate(presentation.route.frames,{duration:CAT_ARRIVAL_MS,easing:'linear',fill:'both'});
    presentation.animation.currentTime=age;
  }
  function cancelPetTap() {
    if (!petTap) return;
    clearTimeout(petTap.timer);
    petTap.button.classList.remove('is-petted');
    petTap=null;
  }
  function openCat(button) {
    if(presentation?.event.type === 'cat-arrived') stopPresentation();
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
    if(button.hasAttribute('data-book-reward-dismiss')) {
      if(presentation?.event.type === 'cat-arrived') presentation.dismissed=true;
      else stopPresentation();
      render();return;
    }
    if(button.dataset.bookRewardCat) {
      const id=button.dataset.bookRewardCat;
      stopPresentation();catId=id;detailOrigin=panel === 'catalog' ? 'catalog' : null;
      trigger={key:'bookOpen',value:'catalog',page:'book',origin:'menu'};
      panel='detail';sheetScroll.set('detail',0);render({heading:true});return;
    }
    if(button.dataset.bookRewardScene) {
      sceneId=button.dataset.bookRewardScene;stopPresentation();sceneRevealAt=performance.now();
      onSceneChange?.(sceneId);dismiss();return;
    }
    if (button.dataset.bookCat && button.closest('.book-yard-camera') && Date.now() < blockCatClickUntil) return;
    if (button.hasAttribute('data-catbook-back')) { cancelPetTap(); onBack(); return; }
    if (button.hasAttribute('data-book-dismiss')) { dismiss(); return; }
    if (button.hasAttribute('data-book-detail-back')) {
      if (detailOrigin === 'catalog') { panel='catalog'; render(); findToken(container.querySelector('[data-book-sheet="catalog"]'),{key:'bookCat',value:catId})?.focus({preventScroll:true}); }
      else dismiss();
      return;
    }
    if (button.dataset.bookOpen) {
      if(presentation?.event.type === 'cat-arrived') stopPresentation();
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
      stopPresentation();sceneId=button.dataset.bookScene;sceneRevealAt=performance.now(); onSceneChange?.(sceneId); dismiss(); return;
    }
    if (button.dataset.bookInvite) {
      const state=getState(), availability=getAvailability();
      if (!availability.saving && availability.connected && canInviteCat(button.dataset.bookInvite,state.collection,levelInfo(state.xp).level)) {
        ownInvitation=button.dataset.bookInvite;
        ownInvitationSaving=false;
        if(onAction({ type:'invite-cat', catId:ownInvitation }) === false) ownInvitation=null;
      }
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
  window.addEventListener('resize',()=>{if(!container.hidden && presentation?.event.type === 'cat-arrived'){presentation.route=null;render();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden) stopPresentation({pauseAll:true});else if(!container.hidden) render();});
  return { render, open() { if(!walkingImage.src) walkingImage.src=new URL('../public/assets/catbook/walking-cats.png',import.meta.url).href; panel=null; detailOrigin=null; container.hidden=false; render(); container.querySelector('[data-catbook-back]').focus({preventScroll:true}); }, close() { cancelPetTap(); stopPresentation({pause:true}); panel=null; container.querySelector('dialog[open]')?.close(); container.hidden=true; } };
}
