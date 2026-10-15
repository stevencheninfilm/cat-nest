import { catbookMarkup, collectionScene, catArrivalMarkup, collectionNoticeMarkup } from './catbook-ui.js';
import { canInviteCat, getCollectionCat } from './cat-collection.js';
import { sceneCatPlacement, catArrivalScene } from './catbook-scenes.js';
import { createCollectionEvents, catArrivalRoute, CAT_ARRIVAL_MS } from './catbook-events.js';
import { createYardCamera, isYardPan } from './catbook-camera.js';
import { levelInfo } from './state.js';
import { createCatDialogue, catSpeechMarkup, CAT_DIALOGUE_PAIRS } from './catbook-dialogue.js';

export function createCatbook({ container, getState, getAvailability, onAction, onBack, initialScene='station', onSceneChange }) {
  let tab='book', catId='bandit', sceneId=initialScene, panel=null, detailOrigin=null;
  let trigger=null, drag=null, yardTap=null, petTap=null, blockCatClickUntil=0;
  let presentation=null, ownInvitation=null, ownInvitationSaving=false, sceneRevealAt=0;
  const events=createCollectionEvents(getState()), rewards=[];
  const dialogue=createCatDialogue();
  const walkingImage=new Image();
  const gameWalkingImage=new Image();
  const achievementWalkingImage=new Image();
  const referenceWalkingImage=new Image();
  const petTapDuration=620;
  const cameras=createYardCamera(), sheetScroll=new Map();
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
    const welcomed=updates.find(event=>event.type === 'cat-arrived' && event.id === ownInvitation?.id && (event.sceneId || 'station') === ownInvitation?.sceneId);
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
    cameras.remember(previousCamera,previousScene);
    const previousSheet=container.querySelector('dialog[open]');
    if (previousSheet) sheetScroll.set(previousSheet.dataset.bookSheet,previousSheet.querySelector('.book-sheet-scroll').scrollTop);
    sceneId=collectionScene(sceneId,state.collection,levelInfo(state.xp).level,state.diary).id;
    startPresentation();
    const age=presentation ? performance.now()-presentation.startedAt : 0;
    const arriving=presentation?.event.type === 'cat-arrived';
    const walking=arriving && age < presentation.travelMs;
    container.innerHTML=catbookMarkup(state,{ tab, catId, sceneId, detailFromCatalog:detailOrigin === 'catalog', arrivingCatId:walking ? presentation.event.id : null, settlingCatId:arriving && !walking ? presentation.event.id : null, arrivalAge:arriving ? Math.max(0,age-presentation.travelMs) : 0, ...getAvailability() });
    const camera=container.querySelector('.book-yard-camera');
    cameras.restore(camera,sceneId);
    renderSpeech();
    if(walking) renderArrival(camera,age);
    cameras.remember(camera,sceneId);
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
    if(event.type === 'cat-arrived') {
      const state=getState(), current=collectionScene(event.sceneId || 'station',state.collection,levelInfo(state.xp).level,state.diary);
      const destination=catArrivalScene(current,getCollectionCat(event.id));
      if(destination.id !== sceneId) {
        dialogue.clear();sceneId=destination.id;sceneRevealAt=performance.now();onSceneChange?.(sceneId);
      }
    }
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
    const state=getState(), scene=collectionScene(sceneId,state.collection,levelInfo(state.xp).level,state.diary), cat=getCollectionCat(presentation.event.id);
    const yard=container.querySelector('.book-yard'), width=yard.clientWidth, height=yard.clientHeight;
    const place=sceneCatPlacement(scene,cat);
    if(!presentation.route) {
      camera.scrollLeft=Math.max(0,Math.min(width-camera.clientWidth,width*place.x/100-camera.clientWidth/2));
      // Keep the full-yard height framing while the horizontal camera follows the newcomer.
      presentation.route=catArrivalRoute(scene,cat,{width,height,left:camera.scrollLeft,top:camera.scrollTop,viewWidth:camera.clientWidth,viewHeight:camera.clientHeight});
    }
    presentation.animation?.cancel();
    const layer=container.querySelector('.book-arrivals');
    layer.innerHTML=catArrivalMarkup(cat,presentation.route.direction);
    const traveller=layer.querySelector('.book-arrival');
    traveller.style.width=`${place.walkSize ? width*place.walkSize/100 : cat.index >= 12 ? width*place.size/100 : Math.max(55,Math.min(88,width*.16))}px`;
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Restart the response on every tap, including repeated taps on the same cat.
    void button.offsetWidth;
    button.style.setProperty('--pet-tap-duration',`${petTapDuration}ms`);
    button.classList.add('is-petted');
    petTap={ button, timer:setTimeout(cancelPetTap,petTapDuration) };
  }
  function renderSpeech() {
    let layer=container.querySelector('.book-speech-layer');
    for(const cat of container.querySelectorAll('.is-speaking')) cat.classList.remove('is-speaking');
    const turn=dialogue.current();
    if(!turn || turn.sceneId!==sceneId || panel || container.hidden) { layer?.remove();return; }
    const speaker=container.querySelector(`.book-yard-cat[data-book-cat="${turn.speakerId}"]`);
    const root=container.querySelector('.catbook'),camera=container.querySelector('.book-yard-camera');
    if(!speaker || speaker.disabled || !root || !camera) { layer?.remove();return; }
    const bounds=speaker.getBoundingClientRect(),view=camera.getBoundingClientRect(),frame=root.getBoundingClientRect();
    if(bounds.right<view.left || bounds.left>view.right) { layer?.remove();return; }
    if(!layer) {
      layer=document.createElement('div');layer.className='book-speech-layer';
      layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');layer.setAttribute('aria-atomic','true');
      root.append(layer);
    }
    const speechKey=JSON.stringify(turn);
    if(layer.dataset.speechKey!==speechKey) { layer.innerHTML=catSpeechMarkup(turn);layer.dataset.speechKey=speechKey; }
    const bubble=layer.firstElementChild,width=Math.min(220,Math.max(160,frame.width-24));
    bubble.style.width=`${width}px`;
    const height=bubble.getBoundingClientRect().height;
    const left=Math.max(10,Math.min(frame.width-width-10,bounds.left+bounds.width/2-frame.left-width/2));
    const partnerId=CAT_DIALOGUE_PAIRS.find(pair=>pair.id===turn.pairId)?.members.find(id=>id!==turn.speakerId);
    const partner=partnerId && container.querySelector(`.book-yard-cat[data-book-cat="${partnerId}"]`)?.getBoundingClientRect();
    // Keep both friends visible when one sits directly above the other.
    const partnerVisible=partner && partner.right>view.left && partner.left<view.right;
    const anchorTop=partnerVisible ? Math.min(bounds.top,partner.top) : bounds.top;
    const anchorBottom=partnerVisible ? Math.max(bounds.bottom,partner.bottom) : bounds.bottom;
    const below=anchorTop-frame.top-height-12<76;
    const top=Math.max(76,Math.min(frame.height-height-115,below ? anchorBottom-frame.top+10 : anchorTop-frame.top-height-10));
    bubble.style.left=`${left}px`;bubble.style.top=`${top}px`;
    bubble.style.setProperty('--speech-tail',`${Math.max(18,Math.min(width-18,bounds.left+bounds.width/2-frame.left-left))}px`);
    bubble.classList.toggle('is-below',below);
    speaker.classList.add('is-speaking');
  }
  function speakCat(button) {
    const state=getState(),scene=collectionScene(sceneId,state.collection,levelInfo(state.xp).level,state.diary);
    const turn=dialogue.next(scene,getCollectionCat(button.dataset.bookCat),state.collection);
    const speaker=turn && container.querySelector(`.book-yard-cat[data-book-cat="${turn.speakerId}"]`);
    const camera=container.querySelector('.book-yard-camera');
    if(speaker && camera) {
      const bounds=speaker.getBoundingClientRect(),view=camera.getBoundingClientRect();
      if(bounds.left<view.left || bounds.right>view.right) camera.scrollLeft+=bounds.left+bounds.width/2-view.left-view.width/2;
    }
    petCat(button);renderSpeech();
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
      dialogue.clear();sceneId=button.dataset.bookRewardScene;stopPresentation();sceneRevealAt=performance.now();
      onSceneChange?.(sceneId);dismiss();return;
    }
    if (button.dataset.bookCat && button.closest('.book-yard-camera') && event.detail > 0 && Date.now() < blockCatClickUntil) return;
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
      if (button.closest('.book-yard-camera') && !button.hasAttribute('data-book-locked-cat')) speakCat(button);
      else openCat(button);
      return;
    }
    if (button.dataset.bookScene) {
      dialogue.clear();stopPresentation();sceneId=button.dataset.bookScene;sceneRevealAt=performance.now(); onSceneChange?.(sceneId); dismiss(); return;
    }
    if (button.dataset.bookInvite) {
      const state=getState(), availability=getAvailability();
      if (!availability.saving && availability.connected && canInviteCat(button.dataset.bookInvite,state.collection,levelInfo(state.xp).level,button.dataset.bookInviteScene,state.diary)) {
        ownInvitation={id:button.dataset.bookInvite,sceneId:button.dataset.bookInviteScene};
        ownInvitationSaving=false;
        if(onAction({ type:'invite-cat', catId:ownInvitation.id, sceneId:ownInvitation.sceneId }) === false) ownInvitation=null;
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
    // Only suppress the click belonging to the previous drag, never a new tap.
    blockCatClickUntil=0;
    if (event.button !== 0 || !event.isPrimary) return;
    const lockedCat=event.target.closest('[data-book-locked-cat]');
    yardTap=lockedCat ? {id:event.pointerId,button:lockedCat,x:event.clientX,y:event.clientY} : null;
    if (event.pointerType !== 'mouse') return;
    drag={ camera, id:event.pointerId, x:event.clientX, y:event.clientY, left:camera.scrollLeft, moved:false };
  });
  container.addEventListener('pointermove', event => {
    if (yardTap?.id === event.pointerId && Math.hypot(event.clientX-yardTap.x,event.clientY-yardTap.y)>12) yardTap=null;
    if (!drag || drag.id !== event.pointerId || !drag.camera.isConnected) return;
    const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
    if (!drag.moved && !isYardPan(dx,dy)) return;
    if (!drag.moved) { yardTap=null; drag.moved=true; drag.camera.setPointerCapture(event.pointerId); drag.camera.classList.add('is-dragging'); }
    drag.camera.scrollLeft=drag.left-dx;
  });
  const stopDrag=() => {
    if (!drag) return;
    if (drag.moved) blockCatClickUntil=Date.now()+200;
    drag.camera.classList.remove('is-dragging'); drag=null;
  };
  container.addEventListener('pointerup',event=>{
    const tap=yardTap?.id === event.pointerId ? yardTap : null;
    yardTap=null;
    stopDrag();
    if (!tap?.button.isConnected || Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>12) return;
    // Browsers can omit click after a slightly shaky tap. Resolve the locked
    // cat on release; the ordinary click path still supports keyboard input.
    blockCatClickUntil=Date.now()+200;
    event.preventDefault();
    openCat(tap.button);
  });
  container.addEventListener('pointercancel',()=>{yardTap=null;stopDrag();});
  container.addEventListener('scroll',event=>{
    if(event.target.classList?.contains('book-yard-camera')) { cameras.remember(event.target,sceneId); renderSpeech(); }
  },true);
  const resizeCamera=()=>{
    if(container.hidden) return;
    const camera=container.querySelector('.book-yard-camera');
    if(!camera) return;
    renderSpeech();
    if(!cameras.resize(camera,sceneId)) return;
    stopDrag(); cancelPetTap();
    if(presentation?.event.type === 'cat-arrived') { presentation.route=null; render(); }
  };
  // Dynamic viewport units can change with Safari's toolbar without a window resize.
  if(typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCamera).observe(container);
  else window.addEventListener('resize',resizeCamera);
  document.addEventListener('visibilitychange',()=>{if(document.hidden) stopPresentation({pauseAll:true});else if(!container.hidden) render();});
  return { render, open() { if(!walkingImage.src) walkingImage.src=new URL('../public/assets/catbook/walking-cats.png',import.meta.url).href; if(!gameWalkingImage.src) gameWalkingImage.src=`${import.meta.env?.BASE_URL || './'}assets/catbook/game-walking-v1.png`; if(!achievementWalkingImage.src) achievementWalkingImage.src=`${import.meta.env?.BASE_URL || './'}assets/catbook/achievement-walking-v1.png`; if(!referenceWalkingImage.src) referenceWalkingImage.src=`${import.meta.env?.BASE_URL || './'}assets/catbook/reference-walking-v1.png`; panel=null; detailOrigin=null; container.hidden=false; render(); container.querySelector('[data-catbook-back]').focus({preventScroll:true}); }, close() { dialogue.clear(); cancelPetTap(); stopPresentation({pause:true}); panel=null; container.querySelector('dialog[open]')?.close(); container.hidden=true; } };
}
