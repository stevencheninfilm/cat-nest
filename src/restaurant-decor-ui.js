import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { RESTAURANT_DECORATIONS, restaurantDecoration } from './restaurant-decor.js';

const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/decor/${file}`,globalThis.document?.baseURI||import.meta.url).href;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=n=>Math.min(1,Math.max(0,n));
export const DECORATION_PROP_SLOTS=Object.freeze([
  {id:'entry',file:'window.webp',x:12,y:24,width:9},
  {id:'dining',file:'wall.webp',x:91,y:45,width:11},
  {id:'kitchen',file:'counter.webp',x:88,y:78,width:9},
]);
export function decorationBuffLabels(buffs={}) {
  return [['coins','收入'],['experience','成长'],['cookSpeed','制作速度']].filter(([key])=>buffs[key]>0).map(([key,label])=>`${label} +${Number((buffs[key]/100).toFixed(2))}%`);
}
export function restaurantDecorationsPanel(info) {
  const decor=info.decorationInfo,job=decor.construction;
  return `<p class="r-panel-caption">解锁后加成常驻叠加 · 布置约 12 秒</p>${job?`<p class="rd-panel-notice" role="status">正在布置「${esc(restaurantDecoration(job.toDecorationId).name)}」 · ${Math.ceil(job.remainingMs/1000)} 秒</p>`:''}<div class="rd-groups"><div class="rd-cards">${decor.decorations.map(suite=>`<article class="rd-card ${suite.equipped?'is-equipped':''}" data-r-decoration-card="${suite.id}" ${restaurantLockedAttributes(!suite.owned)} title="${esc(suite.description)}"><div class="rd-preview"><img src="${asset(`${suite.id}/scene.webp`)}" alt="${esc(suite.name)}完整场景" loading="lazy"/></div><div class="rd-card-copy"><h4>${esc(suite.name)}</h4><div class="rd-buffs">${decorationBuffLabels(suite.buffs).map(label=>`<span>${label}</span>`).join('')}</div><button class="r-small-primary" data-r-action="decoration" data-r-decoration="${suite.id}" aria-label="${esc(suite.name)}，${suite.equipped?'已布置':suite.owned?'免费布置':`解锁并布置需 ${suite.cost} 小鱼干`}" ${job||suite.equipped||!suite.unlocked?'disabled':''}>${!suite.owned?restaurantLockIcon():''}${job?.toDecorationId===suite.id?'施工中…':suite.equipped?'已布置':!suite.unlocked?`Lv.${suite.unlockLevel} 开放`:suite.owned?'免费布置':`解锁 ${suite.cost}`}</button></div></article>`).join('')}</div></div>`;
}
export function decorationSceneMarkup() {
  return `<div class="rd-props" data-r-decor-props aria-hidden="true"></div><div class="rd-construction" data-r-construction hidden aria-label="两位猫猫施工队员正在布置小馆"><div class="rd-work-sites">${DECORATION_PROP_SLOTS.map(slot=>`<span class="rd-work-site" data-r-build-slot="${slot.id}" style="left:${slot.x}%;top:${slot.y}%"><i>✦</i><b>布置中</b></span>`).join('')}</div><div class="rd-worker" data-r-builder="0"><span class="rd-worker-shadow"></span><img alt="黄帽橘猫施工队员" draggable="false"/><i>✦</i></div><div class="rd-worker" data-r-builder="1"><span class="rd-worker-shadow"></span><img alt="橙帽灰猫施工队员" draggable="false"/><i>✦</i></div></div><div class="rd-scene-status" data-r-decor-status role="status" hidden></div>`;
}

// Stage coordinates are feet anchors. Every segment shares an endpoint, so a
// refresh or a late cloud confirmation resumes the same route without teleporting.
const ROUTES=[
  [[0,49,20],[2000,18,26],[4400,18,26],[4900,49,27],[5400,49,39],[6100,84,45],[9500,84,45],[10100,51,40],[11300,51,25],[12000,49,20]],
  [[0,53,20],[650,52,45],[1400,52,68],[2000,80,78],[9500,80,78],[10100,53,69],[11300,53,30],[12000,53,20]],
];
export function constructionWorkerMotion(job,index,now) {
  const elapsed=Math.max(0,now-job.startedAt),route=ROUTES[index];
  let segment=route.findIndex((point,i)=>i<route.length-1&&elapsed<route[i+1][0]);
  if(segment<0)segment=route.length-2;
  const [a,b]=[route[segment],route[segment+1]],p=clamp((elapsed-a[0])/(b[0]-a[0]));
  const moving=a[1]!==b[1]||a[2]!==b[2],back=moving&&b[2]<a[2];
  return {x:a[1]+(b[1]-a[1])*p,y:a[2]+(b[2]-a[2])*p,moving,back,building:!moving&&elapsed>=2000&&elapsed<9500,opacity:Math.min(clamp(elapsed/250),clamp((12000-elapsed)/350))};
}

export function createRestaurantDecorationScene({container,onComplete=()=>{},onSceneChange=()=>{},onScenePrepare=()=>{}}) {
  const root=container.closest('.restaurant'),art=container.querySelector('.r-scene-art'),props=container.querySelector('[data-r-decor-props]'),crew=container.querySelector('[data-r-construction]'),status=container.querySelector('[data-r-decor-status]');
  const workers=[...container.querySelectorAll('[data-r-builder]')],sites=[...container.querySelectorAll('[data-r-build-slot]')];
  let current=null,raf=null,opened=false,signature='',statusSignature='',lastJob=null,seenJobs=new Set(),preloaded=new Set();
  function preload(id){if(!id||preloaded.has(id))return;preloaded.add(id);const image=new Image();image.src=asset(`${id}/scene.webp`);onScenePrepare(id);}
  function update(now=Date.now()) {
    if(!current)return;
    const job=current.construction,activeJob=job&&now<job.finishAt?job:null;
    const suite=job&&now>=job.installAt?restaurantDecoration(job.toDecorationId):current.decoration;
    const key=suite?.id||'';
    if(key!==signature){
      signature=key;
      const url=suite?asset(`${suite.id}/scene.webp`):new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/restaurant-scene.webp`,document.baseURI).href;
      if(art.src!==url){art.src=url;art.alt=suite?`${suite.name}，包含窗边、用餐区与厨房的完整小馆`: '暖暖的猫猫小馆';}
      if(suite)root.dataset.decoration=suite.id;else delete root.dataset.decoration;
      props.innerHTML=suite?DECORATION_PROP_SLOTS.map(slot=>`<img class="rd-prop" data-r-decor-slot="${slot.id}" src="${asset(`${suite.id}/${slot.file}`)}" alt="" draggable="false" style="left:${slot.x}%;top:${slot.y}%;width:${slot.width}%" hidden/>`).join(''):'';
      onSceneChange(suite?.id||'default');
    }
    [...props.children].forEach((prop,i)=>{const installing=activeJob&&now>=activeJob.installAt,installed=!installing||now>=activeJob.installAt+i*800;prop.hidden=!installed;if(installing&&installed)prop.classList.add('is-installed');});
    crew.hidden=!activeJob;
    root.classList.toggle('rd-is-building',!!activeJob);
    if(activeJob){
      workers.forEach((worker,index)=>{const motion=constructionWorkerMotion(activeJob,index,now),name=index?'builder-gray':'builder-orange',url=asset(`crew/${name}${motion.back?'-back':''}.webp`),image=worker.querySelector('img');
        worker.style.left=`${motion.x}%`;worker.style.top=`${motion.y}%`;worker.style.opacity=motion.opacity;worker.style.zIndex=Math.round(motion.y);
        worker.classList.toggle('is-walking',motion.moving);worker.classList.toggle('is-hammering',motion.building);if(image.src!==url)image.src=url;
      });
      sites.forEach((site,i)=>{const installed=now>=activeJob.installAt+i*800;site.classList.toggle('is-finished',installed);site.querySelector('b').textContent=installed?'安置完成':'布置中';});
      const phase=now<activeJob.buildAt?'施工队到店啦':now<activeJob.installAt?'窗边 · 墙边 · 厨房施工中':now<activeJob.leaveAt?'新装扮陆续安置':'收拾工具，准备收工';
      const statusKey=`${activeJob.id}:${phase}:${Math.ceil((activeJob.finishAt-now)/1000)}`;
      status.hidden=false;status.classList.add('is-construction');
      if(statusSignature!==statusKey){statusSignature=statusKey;status.innerHTML=`<strong>${phase}</strong><span>${esc(restaurantDecoration(activeJob.toDecorationId).name)} · ${Math.ceil((activeJob.finishAt-now)/1000)} 秒</span><i></i>`;}
      status.querySelector('i').style.setProperty('--rd-progress',clamp((now-activeJob.startedAt)/12000));
    }else{
      status.classList.remove('is-construction');
      status.hidden=true;statusSignature='';status.innerHTML='';
      const finished=lastJob&&now>=lastJob.finishAt?lastJob:null;
      if(finished&&!seenJobs.has(finished.id)){seenJobs.add(finished.id);onComplete(restaurantDecoration(finished.toDecorationId));}
    }
  }
  function frame(){raf=null;if(!opened)return;update();if(current?.construction&&Date.now()<current.construction.finishAt)raf=requestAnimationFrame(frame);}
  function start(){if(!opened)return;update();if(raf===null&&current?.construction&&Date.now()<current.construction.finishAt)raf=requestAnimationFrame(frame);}
  return {
    sync(info){current=info.decorationInfo;if(current.construction){lastJob=current.construction;preload(current.construction.toDecorationId);}start();},
    open(){opened=true;start();},close(){opened=false;if(raf!==null)cancelAnimationFrame(raf);raf=null;},
    destroy(){this.close();current=null;seenJobs.clear();},
  };
}
