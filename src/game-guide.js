import { gameGuideChapters, guideCatalog, searchGuide, GUIDE_ASSET_ROOT } from './game-guide-content.js';
import { GAME_TOUR, PANEL_TOURS, guideTourRoute, tourStepForChapter, tourLayout } from './game-guide-tour.js';

const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blank=()=>({version:1,chapter:'welcome',seen:[],tour:0,tourComplete:false,tourStarted:false,resetGeneration:0,panels:{}});
export function loadGameGuide(storage,role) {
  try {
    const value=JSON.parse(storage.getItem(`catnest.handbook.v1.${role}`));
    if(value?.version!==1)return blank();
    const panels=Object.fromEntries(Object.keys(PANEL_TOURS).filter(key=>value.panels?.[key]?.seen===true).map(key=>[key,{seen:true,complete:value.panels[key].complete===true,step:PANEL_TOURS[key].includes(value.panels[key].step)?value.panels[key].step:PANEL_TOURS[key][0]}]));
    return { ...blank(),resetGeneration:Number.isSafeInteger(value.resetGeneration)&&value.resetGeneration>=0?value.resetGeneration:0,chapter:typeof value.chapter==='string'?value.chapter:'welcome',seen:Array.isArray(value.seen)?value.seen.filter(id=>typeof id==='string').slice(0,100):[],tour:Number.isInteger(value.tour)?Math.max(0,Math.min(GAME_TOUR.length-1,value.tour)):0,tourComplete:value.tourComplete===true,tourStarted:value.tourStarted===true||value.tourComplete===true||Number.isInteger(value.tour)&&value.tour>0,panels };
  } catch { return blank(); }
}

export function createGameGuide({storage,getContext,navigate,onClose=()=>{},onStatus=()=>{},isTest=false,assetBase='./',view=window,autoStart=false}) {
  const chapters=gameGuideChapters({isTest});
  const dialog=document.createElement('dialog');
  dialog.className='game-guide-dialog';
  document.body.append(dialog);
  let progress=blank(),role,mode='book',current=chapters[0],query='',toc=false,opener=null,busy=false,serial=0,frame=0,destroyed=false,changing=false;
  let route=guideTourRoute(),routeIndex=0,panel=null,lastGeometry='',autoQueued=false;
  const automaticSeen=new Set();
  let overviewActive=false,shown=false;
  function report(phase){try{onStatus({role,phase,generation:progress.resetGeneration});}catch{}}
  function applyRemote(record,requestedRole){
    if(dialog.open||busy||!['male','female'].includes(requestedRole))return false;
    const saved=loadGameGuide(storage,requestedRole);
    if(record.generation<saved.resetGeneration)return false;
    const next=record.generation>saved.resetGeneration?{...blank(),resetGeneration:record.generation}:saved;
    if(record.generation>saved.resetGeneration)automaticSeen.delete(requestedRole);
    if(record.phase!=='unknown'){next.tourStarted=true;next.tourComplete=record.phase==='completed'||next.tourComplete;}
    try{storage.setItem(`catnest.handbook.v1.${requestedRole}`,JSON.stringify(next));}catch{}
    return true;
  }
  const stepNow=()=>GAME_TOUR.find(step=>step.id===route[routeIndex]);
  const asset=name=>`${assetBase}${GUIDE_ASSET_ROOT}${name}-v1.webp`;
  function remember(){if(role)try{storage.setItem(`catnest.handbook.v1.${role}`,JSON.stringify(progress));}catch{/* Reading also works without local preferences. */}}
  function mark(id){progress.chapter=id;if(!progress.seen.includes(id))progress.seen.push(id);remember();}
  function load(){role=getContext().role;progress=loadGameGuide(storage,role);current=chapters.find(c=>c.id===progress.chapter)||chapters[0];}
  function catalogMarkup(chapter){const items=guideCatalog(chapter.catalog);return items.length?`<details class="guide-catalog"><summary>${chapter.catalog==='foods'?'查看全部食物与冷却':'查看全部小游戏玩法'} <span>${items.length}</span></summary><dl>${items.map(item=>`<div><dt>${esc(item.name)}${item.note?`<small>${esc(item.note)}</small>`:''}</dt><dd>${esc(item.body)}</dd></div>`).join('')}</dl></details>`:'';}
  function navMarkup(){
    const found=searchGuide(chapters,query),groups=[...new Set(chapters.map(c=>c.group))];
    return found.length?groups.map(group=>{const items=found.filter(c=>c.group===group);return items.length?`<div class="guide-nav-group"><p>${esc(group)}</p>${items.map(chapter=>`<button data-guide-chapter="${chapter.id}" ${current.id===chapter.id?'aria-current="page"':''}><span class="guide-nav-symbol" aria-hidden="true">${chapter.icon}</span><span>${chapter.short}</span><small aria-label="${progress.seen.includes(chapter.id)?'已浏览':'未浏览'}">${progress.seen.includes(chapter.id)?'✓':'›'}</small></button>`).join('')}</div>`:'';}).join(''):'<p class="guide-no-result" role="status">没找到这个关键词。试试「喂食」「判官」或「小游戏」。</p>';
  }
  function renderBook(focus=false){
    cancelAnimationFrame(frame);
    mode='book';dialog.className='game-guide-dialog';dialog.setAttribute('aria-labelledby','game-guide-title');
    const index=chapters.indexOf(current);mark(current.id);
    dialog.innerHTML=`<header class="guide-header"><span class="guide-brand">✧ 猫猫新手手册<small>跟着小猫，慢慢认识这个家</small></span><button class="guide-close" data-guide-action="close" aria-label="关闭新手手册">×</button></header>
      <div class="guide-layout ${toc?'is-toc':''}"><aside class="guide-sidebar" aria-label="手册目录"><label class="guide-search">⌕ <input type="search" placeholder="搜索功能或玩法" aria-label="搜索手册" maxlength="60" value="${esc(query)}"/></label><nav class="guide-nav" aria-label="新手手册章节">${navMarkup()}</nav></aside>
      <main class="guide-reading"><div class="guide-art"><img src="${asset(current.art)}" alt="${esc(current.short)}主题小猫插画" width="1536" height="1024" decoding="async"/><span>小窝课堂 · ${String(index+1).padStart(2,'0')}</span></div><article class="guide-article"><p class="guide-eyebrow">${esc(current.group)}</p><h1 id="game-guide-title" tabindex="-1">${esc(current.title)}</h1><p class="guide-lead">${esc(current.summary)}</p><div class="guide-entry"><b>从这里进入</b><span>${esc(current.entry)}</span></div><ol class="guide-steps">${current.steps.map((item,n)=>`<li><span>${n+1}</span><div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p></div></li>`).join('')}</ol>${catalogMarkup(current)}<aside class="guide-tip"><b>小猫提醒</b><p>${esc(current.tip)}</p></aside><div class="guide-chapter-actions"><button class="guide-primary" data-guide-action="tour-chapter">跟我看实景指引 ↗</button>${current.links.filter(link=>link.view).map(link=>`<button data-guide-view="${link.view}">${esc(link.label)} ›</button>`).join('')}</div><p class="guide-art-note">配图为小猫课堂插画，具体操作以当前游戏界面为准。</p></article></main></div>
      <footer class="guide-footer"><button class="guide-toc-toggle" data-guide-action="toc" aria-expanded="${toc}">☷ ${toc?'返回正文':'目录'}</button><span class="guide-reading-progress">已浏览 ${chapters.filter(c=>progress.seen.includes(c.id)).length}/${chapters.length}</span><div><button data-guide-action="prev" ${index===0?'disabled':''} aria-label="上一章">‹</button><button class="guide-primary" data-guide-action="next">${index===chapters.length-1?'回到小窝':'下一章 ›'}</button></div></footer>`;
    if(focus)dialog.querySelector('#game-guide-title')?.focus({preventScroll:true});
  }
  function renderTour(){
    const step=stepNow();mode='tour';lastGeometry='';dialog.className='game-guide-dialog is-tour';dialog.setAttribute('aria-labelledby','game-tour-title');
    dialog.innerHTML=`<div class="guide-tour-shade shade-top"></div><div class="guide-tour-shade shade-left"></div><div class="guide-tour-shade shade-right"></div><div class="guide-tour-shade shade-bottom"></div><button class="guide-tour-target" data-guide-action="target" aria-label="${step.activate?esc(step.next):'我找到这个位置了，继续'}"><span class="guide-target-cue">${step.activate?'点这里':'看这里'}</span></button><span class="guide-tour-arrow" aria-hidden="true">↓</span>
      <div class="guide-tour-toolbar"><button data-guide-action="book">☷ 图文手册</button><button data-guide-action="close">稍后继续 ×</button></div>
      <section class="guide-tour-card"><img class="guide-tour-mascot" src="${asset('mascot')}" alt="指路的小魔法猫" width="1024" height="1536"/><div class="guide-tour-speech"><span class="guide-tour-speaker">${panel?'板块小课堂':'小猫向导'} <small>${routeIndex+1} / ${route.length}</small></span><h1 id="game-tour-title" tabindex="-1">${esc(step.title)}</h1><p>${esc(step.body)}</p>${step.hint?`<small class="guide-tour-hint">${esc(step.hint)}</small>`:''}<div class="guide-tour-controls"><button data-guide-action="tour-prev" ${routeIndex===0?'disabled':''}>上一步</button><button class="guide-primary" data-guide-action="tour-next">${esc(routeIndex===route.length-1&&panel?'知道啦，开始体验':step.next||'知道啦，下一步')} <span aria-hidden="true">›</span></button></div></div></section>`;
    dialog.querySelector('#game-tour-title')?.focus({preventScroll:true});
    positionTour();
  }
  function visibleTarget(selector){return [...document.querySelectorAll(selector)].find(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&node.getClientRects().length;});}
  function positionTour(){
    if(!dialog.open||mode!=='tour')return;
    const width=dialog.clientWidth,height=dialog.clientHeight,card=dialog.querySelector('.guide-tour-card');if(!card)return;
    const step=stepNow(),target=visibleTarget(step.target),raw=target?.getBoundingClientRect(),origin=dialog.getBoundingClientRect();
    const rect=raw?{top:raw.top-origin.top,bottom:raw.bottom-origin.top,left:raw.left-origin.left,right:raw.right-origin.left}:null;
    const shown=rect&&rect.bottom>8&&rect.top<height-8;
    const geometry=JSON.stringify([rect,width,height,card.offsetHeight]);if(geometry===lastGeometry)return;lastGeometry=geometry;
    const layout=tourLayout(shown?rect:null,width,height,card.offsetHeight);
    const {top,left,right,bottom}=layout;
    for(const [name,value]of Object.entries({top:Math.max(0,top-4),left:Math.max(0,left-4),right:Math.min(width,right+4),bottom:Math.min(height,bottom+4),width,height,'card-top':layout.cardTop,'arrow-x':Math.max(28,Math.min(width-28,(left+right)/2))}))dialog.style.setProperty(`--tour-${name}`,`${value}px`);
    dialog.classList.toggle('tour-arrow-below',layout.arrowBelow);dialog.classList.toggle('tour-target-missing',!shown);
    dialog.style.setProperty('--tour-arrow-y',`${layout.arrowBelow?bottom+8:Math.max(42,top-50)}px`);
  }
  function trackTour(){
    cancelAnimationFrame(frame);
    const tick=()=>{if(!dialog.open||mode!=='tour'||destroyed)return;positionTour();frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);
  }
  async function showTour(index=routeIndex){
    const token=++serial;busy=true;routeIndex=Math.max(0,Math.min(route.length-1,index));
    const step=stepNow();
    if(panel)progress.panels[panel]={seen:true,complete:false,step:step.id};else progress.tour=GAME_TOUR.indexOf(step);
    remember();mode='tour';cancelAnimationFrame(frame);
    // The real page opens first, then the coachmark returns to the top layer.
    changing=true;if(dialog.open)dialog.close();
    try {
      const opened=await navigate(step.view);
      if(destroyed||token!==serial)return;
      if(opened===false){current=chapters.find(c=>c.id===step.chapter)||current;renderBook();dialog.showModal();return;}
      const target=visibleTarget(step.target);
      if(target&&step.view!=='home'&&step.view!=='collection')target.scrollIntoView?.({block:'center',behavior:'instant'});
      renderTour();dialog.showModal();positionTour();
      if(overviewActive&&!shown){shown=true;report('shown');}
      dialog.querySelector('#game-tour-title')?.focus({preventScroll:true});trackTour();
    } catch {
      if(!destroyed&&token===serial){current=chapters.find(c=>c.id===step.chapter)||current;renderBook();if(!dialog.open)dialog.showModal();}
    } finally {if(token===serial){busy=false;changing=false;}}
  }
  async function start({book=false,chapter,restart=false,panel:requestedPanel}={}){
    if(!getContext().entered||destroyed)return false;
    opener=document.activeElement;load();query='';toc=false;
    if(chapter)current=chapters.find(c=>c.id===chapter)||current;
    if(book){++serial;changing=true;if(dialog.open)dialog.close();renderBook();dialog.showModal();changing=false;}
    else {
      panel=Object.hasOwn(PANEL_TOURS,requestedPanel||'')?requestedPanel:null;
      overviewActive=!panel;shown=false;
      route=guideTourRoute(panel).filter(id=>getContext().canOpen?.(GAME_TOUR.find(step=>step.id===id).view)!==false);
      if(!route.length){renderBook();if(!dialog.open)dialog.showModal();return true;}
      const saved=panel?progress.panels[panel]?.step:GAME_TOUR[progress.tour]?.id;
      const complete=panel?progress.panels[panel]?.complete:progress.tourComplete;
      if(!panel){progress.tourStarted=true;automaticSeen.add(role);if(restart||complete)progress.tourComplete=false;}
      const firstChapter=chapter?GAME_TOUR[tourStepForChapter(chapter)]?.id:null;
      await showTour(restart||complete?0:Math.max(0,route.indexOf(firstChapter||saved)));
    }
    return true;
  }
  function sync(){
    if(!autoStart||destroyed||autoQueued||dialog.open||busy)return;
    const context=getContext();
    if(!context.entered||context.ready===false||context.available===false)return;
    const saved=loadGameGuide(storage,context.role);
    if(automaticSeen.has(context.role)||saved.tourStarted||saved.tourComplete)return;
    const requestedRole=context.role;autoQueued=true;
    queueMicrotask(()=>{
      autoQueued=false;const next=getContext();
      if(destroyed||next.role!==requestedRole||!next.entered||next.ready===false||next.available===false||dialog.open||busy||document.querySelector('dialog[open]'))return;
      const latest=loadGameGuide(storage,next.role);
      if(!latest.tourStarted&&!latest.tourComplete)void start();
    });
  }
  function close(){if(overviewActive&&shown){report(progress.tourComplete?'completed':'paused');overviewActive=false;}++serial;busy=false;dialog.close();}
  function onDialogClose(){
    if(changing||dialog.open)return;
    cancelAnimationFrame(frame);remember();onClose();
    if(opener?.isConnected&&!opener.closest('dialog')&&!opener.closest('[hidden]'))opener.focus({preventScroll:true});
  }
  async function nextTour(){
    if(busy)return;
    if(routeIndex===route.length-1){if(panel)progress.panels[panel]={seen:true,complete:true,step:stepNow().id};else progress.tourComplete=true;remember();close();return;}
    await showTour(routeIndex+1);
  }
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled||busy)return;
    const action=button.dataset.guideAction;
    if(action==='close'){close();return;}
    if(action==='tour-next'||action==='target'){void nextTour();return;}
    if(action==='tour-prev'){void showTour(routeIndex-1);return;}
    if(action==='book'){current=chapters.find(c=>c.id===stepNow().chapter)||chapters[0];renderBook(true);return;}
    if(action==='tour-chapter'){const requested={games:'games',court:'judge',appearance:'appearance'}[current.id];void start({chapter:current.id,panel:requested,restart:!!requested});return;}
    if(button.dataset.guideChapter){current=chapters.find(c=>c.id===button.dataset.guideChapter)||current;toc=false;renderBook(true);return;}
    if(button.dataset.guideView){const destination=button.dataset.guideView;close();void navigate(destination);return;}
    if(action==='toc'){toc=!toc;renderBook();return;}
    if(action==='prev'||action==='next'){
      const index=chapters.indexOf(current)+(action==='next'?1:-1);
      if(index>=chapters.length){close();void navigate('home');return;}
      current=chapters[Math.max(0,index)];toc=false;renderBook(true);
    }
  });
  dialog.addEventListener('input',event=>{if(event.target.matches('.guide-search input')){query=event.target.value;dialog.querySelector('.guide-nav').innerHTML=navMarkup();}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',onDialogClose);
  const reposition=()=>{if(mode==='tour')positionTour();};
  view.addEventListener('resize',reposition);view.addEventListener('scroll',reposition,true);view.visualViewport?.addEventListener('resize',reposition);
  const panelClick=event=>{const button=event.target.closest('[data-guide-panel]');if(button)void start({panel:button.dataset.guidePanel,restart:true});};
  document.addEventListener('click',panelClick);
  function panelOpened(name){
    if(name!=='judge')document.querySelector('#modal > .guide-panel-help')?.remove();
    if(!Object.hasOwn(PANEL_TOURS,name))return;
    const host=name==='judge'?document.querySelector('.court-topbar'):document.querySelector('#modal');
    if(host&&!host.querySelector(`[data-guide-panel="${name}"]`)){
      const button=document.createElement('button');button.className=`guide-panel-help ${name==='judge'?'is-court':''}`;button.type='button';button.dataset.guidePanel=name;button.textContent='?';button.setAttribute('aria-label',`查看${{games:'小游戏',judge:'判官',appearance:'装扮'}[name]}指引`);host.append(button);
    }
    if(dialog.open||busy||!getContext().entered)return;
    const saved=loadGameGuide(storage,getContext().role);if(saved.panels[name]?.seen)return;
    queueMicrotask(()=>{if(!destroyed&&!dialog.open&&!busy)void start({panel:name});});
  }
  return {start,sync,applyRemote,panelOpened,isOpen:()=>dialog.open||busy,destroy(){destroyed=true;++serial;cancelAnimationFrame(frame);document.removeEventListener('click',panelClick);view.removeEventListener('resize',reposition);view.removeEventListener('scroll',reposition,true);view.visualViewport?.removeEventListener('resize',reposition);dialog.remove();}};
}
