import { tourLayout } from './game-guide-tour.js';
import { RESTAURANT_TOUR, restaurantGuideRoute } from './restaurant-guide-content.js';

const blank=()=>({version:1,step:'welcome',phase:'new'});
const keyFor=role=>`catnest.restaurant-guide.v1.${role}`;
const validRole=role=>['male','female'].includes(role);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function restaurantGuideLayout(rect,width,height,cardHeight){
  const layout=tourLayout(rect,width,height,cardHeight);
  return {...layout,cardTop:Math.min(height-cardHeight-12,Math.max(58,layout.cardTop))};
}
export function loadRestaurantGuide(storage,role){
  if(!validRole(role))return blank();
  try{
    const value=JSON.parse(storage?.getItem(keyFor(role)));
    return value?.version===1&&RESTAURANT_TOUR.some(step=>step.id===value.step)&&['shown','paused','completed'].includes(value.phase)?{version:1,step:value.step,phase:value.phase}:blank();
  }catch{return blank();}
}

/** A read-only tour. Storage is the existing home-scoped preference adapter. */
export function createRestaurantGuide({storage,getContext,navigate,onClose=()=>{},assetBase='./',view=window}){
  const dialog=document.createElement('dialog');dialog.className='game-guide-dialog is-tour restaurant-guide-dialog';dialog.setAttribute('aria-labelledby','restaurant-guide-title');document.body.append(dialog);
  let progress=blank(),role=null,route=restaurantGuideRoute(),index=0,kind='all',opener=null,open=false,busy=false,destroyed=false,queued=false,changing=false,serial=0,frame=0,lastGeometry='',toc=false;
  const sessionSeen=new Set(),sessionProgress=new Map();
  const stepNow=()=>route[index];
  function read(role){return sessionProgress.get(role)||loadRestaurantGuide(storage,role);}
  function remember(){if(!validRole(role))return;sessionProgress.set(role,{...progress});try{storage?.setItem(keyFor(role),JSON.stringify(progress));}catch{/* Blocked preferences must not block the game. */}}
  function targetFor(step){
    for(const selector of Array.isArray(step.target)?step.target:[step.target]){
      const target=[...document.querySelectorAll(`#restaurant-root ${selector}`)].find(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&node.getClientRects().length;});
      if(target)return target;
    }
    return null;
  }
  function position(){
    if(!open||!dialog.open||toc)return;
    const card=dialog.querySelector('.guide-tour-card');if(!card)return;
    const origin=dialog.getBoundingClientRect(),target=targetFor(stepNow()),r=target?.getBoundingClientRect(),width=dialog.clientWidth,height=dialog.clientHeight;
    const rect=r?{top:r.top-origin.top,bottom:r.bottom-origin.top,left:r.left-origin.left,right:r.right-origin.left}:null;
    const shown=rect&&rect.bottom>8&&rect.top<height-8&&rect.right>0&&rect.left<width;
    const signature=JSON.stringify([rect,width,height,card.offsetHeight]);if(signature===lastGeometry)return;lastGeometry=signature;
    const layout=restaurantGuideLayout(shown?rect:null,width,height,card.offsetHeight);
    for(const [name,value]of Object.entries({top:Math.max(0,layout.top-4),left:Math.max(0,layout.left-4),right:Math.min(width,layout.right+4),bottom:Math.min(height,layout.bottom+4),'card-top':layout.cardTop,'arrow-x':Math.max(28,Math.min(width-28,(layout.left+layout.right)/2))}))dialog.style.setProperty(`--tour-${name}`,`${value}px`);
    dialog.style.setProperty('--tour-arrow-y',`${layout.arrowBelow?layout.bottom+8:Math.max(42,layout.top-50)}px`);
    dialog.classList.toggle('tour-arrow-below',layout.arrowBelow);dialog.classList.toggle('tour-target-missing',!shown);
  }
  function track(){cancelAnimationFrame(frame);const tick=()=>{if(!open||destroyed)return;const context=getContext();if(!context.active||context.role!==role){close();return;}position();frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}
  function render(){
    const step=stepNow();lastGeometry='';dialog.classList.toggle('restaurant-guide-toc',toc);
    const copy=(full,compact)=>compact?`<span class="restaurant-guide-copy-full">${esc(full)}</span><span class="restaurant-guide-copy-short">${esc(compact)}</span>`:esc(full);
    const controls=`<div class="guide-tour-controls"><button data-restaurant-guide="prev" ${index===0?'disabled':''}>上一步</button><button class="guide-primary" data-restaurant-guide="next">${esc(index===route.length-1?(kind==='kitchen'?'开始制作吧':step.next||'一起开张吧'):step.next||'知道啦，下一步')} <span aria-hidden="true">›</span></button></div>`;
    const content=toc?`<h1 id="restaurant-guide-title" tabindex="-1">想先了解哪一部分？</h1><nav class="restaurant-guide-index" aria-label="餐厅指引目录">${route.map((item,n)=>`<button data-restaurant-guide-step="${item.id}" ${n===index?'aria-current="step"':''}><span>${String(n+1).padStart(2,'0')}</span>${esc(item.label)}</button>`).join('')}</nav><button class="restaurant-guide-return" data-restaurant-guide="toc">继续刚才的指引 →</button>`:`<span class="guide-tour-speaker">${kind==='kitchen'?'厨房小课堂':'小馆向导'}<small>${index+1} / ${route.length}</small></span><div class="restaurant-guide-progress" role="progressbar" aria-label="餐厅指引进度" aria-valuemin="1" aria-valuemax="${route.length}" aria-valuenow="${index+1}">${route.map((_,n)=>`<i class="${n<=index?'is-lit':''}"></i>`).join('')}</div><h1 id="restaurant-guide-title" tabindex="-1">${esc(step.title)}</h1><p>${copy(step.body,step.compactBody)}</p>${step.hint?`<small class="guide-tour-hint">${copy(step.hint,step.compactHint)}</small>`:''}${controls}`;
    dialog.innerHTML=`<div class="guide-tour-shade shade-top"></div><div class="guide-tour-shade shade-left"></div><div class="guide-tour-shade shade-right"></div><div class="guide-tour-shade shade-bottom"></div><button class="guide-tour-target" data-restaurant-guide="next" aria-label="我找到这个位置了，继续"></button><span class="guide-tour-arrow" aria-hidden="true">↓</span><div class="guide-tour-toolbar"><button data-restaurant-guide="toc" aria-expanded="${toc}">☷ 指引目录</button><button data-restaurant-guide="close" aria-label="暂停餐厅新手引导">稍后继续 ×</button></div><section class="guide-tour-card"><img class="guide-tour-mascot" src="${assetBase}assets/game-guide/v1/mascot-v1.webp" alt="指路的小猫向导" width="1024" height="1536"/><div class="guide-tour-speech">${content}</div></section>`;
    dialog.querySelector('#restaurant-guide-title')?.focus({preventScroll:true});position();
  }
  async function show(next){
    const token=++serial;busy=true;index=Math.max(0,Math.min(route.length-1,next));toc=false;
    if(kind==='all'){progress={version:1,step:stepNow().id,phase:'shown'};remember();}
    changing=true;if(dialog.open)dialog.close();
    try{
      const result=await navigate(stepNow().view);
      if(destroyed||token!==serial)return false;
      if(getContext().role!==role||!getContext().active){close();return false;}
      if(result===false){close();return false;}
      const target=targetFor(stepNow());
      // Keep fixed HUD/nav in place. Only scroll the scene or current sheet.
      if(target&&!target.closest('.r-hud,.r-header,.r-nav'))target.scrollIntoView?.({block:dialog.clientHeight<=680&&target.closest('.r-stage')?'start':'center',behavior:'instant'});
      render();dialog.showModal();dialog.querySelector('#restaurant-guide-title')?.focus({preventScroll:true});position();track();return true;
    }catch{
      if(!destroyed&&token===serial)close();return false;
    }finally{if(token===serial){busy=false;changing=false;}}
  }
  async function start({restart=false,section='all'}={}){
    const context=getContext();if(destroyed||!context.active||!context.entered||context.ready===false||!validRole(context.role))return false;
    opener=document.activeElement;role=context.role;progress=read(role);kind=section==='kitchen'?'kitchen':'all';route=restaurantGuideRoute(kind);open=true;sessionSeen.add(role);
    const saved=route.findIndex(step=>step.id===progress.step);
    return show(kind==='kitchen'||restart||progress.phase==='completed'?0:Math.max(0,saved));
  }
  function sync(){
    if(destroyed||open||busy||queued)return;
    const context=getContext();if(!context.active||!context.entered||context.ready===false||context.available===false||!validRole(context.role)||sessionSeen.has(context.role)||read(context.role).phase!=='new')return;
    const requested=context.role;queued=true;
    queueMicrotask(()=>{queued=false;const next=getContext();if(!destroyed&&!open&&!busy&&next.active&&next.entered&&next.ready!==false&&next.available!==false&&next.role===requested&&!document.querySelector('dialog[open]')&&read(requested).phase==='new')void start();});
  }
  function close({completed=false}={}){
    if(!open&&!busy)return;
    if(kind==='all'){progress={...progress,phase:completed?'completed':'paused'};remember();}
    ++serial;open=false;busy=false;changing=false;cancelAnimationFrame(frame);dialog.close();onClose();
    if(opener?.isConnected&&!opener.closest('dialog,[hidden]'))opener.focus({preventScroll:true});
  }
  async function next(){if(busy)return;if(index===route.length-1){close({completed:true});return;}await show(index+1);}
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled||busy)return;
    const action=button.dataset.restaurantGuide;
    if(action==='close')close();else if(action==='next')void next();else if(action==='prev')void show(index-1);else if(action==='toc'){toc=!toc;render();}
    else if(button.dataset.restaurantGuideStep){const nextIndex=route.findIndex(step=>step.id===button.dataset.restaurantGuideStep);if(nextIndex>=0)void show(nextIndex);}
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(!changing&&!dialog.open&&open)close();});
  view.addEventListener('resize',position);view.visualViewport?.addEventListener('resize',position);
  return {start,sync,close,isOpen:()=>open||busy,destroy(){close();destroyed=true;++serial;cancelAnimationFrame(frame);view.removeEventListener('resize',position);view.visualViewport?.removeEventListener('resize',position);dialog.remove();}};
}
