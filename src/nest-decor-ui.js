import { NEST_ITEMS, NEST_LEVELS, NEST_PALETTES, nestItem, nestLevel, normalizeNest, nestActionResult, placementResult, suggestNestPlacement } from './nest-decor.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snap=v=>Math.round(v*4)/4;
export function createNestEditor({container,getState,getSaveStatus=()=>({phase:'local'}),onAction,onUse=()=>{},onClose=()=>{},onSelection=()=>{},onPreview=()=>{},onRetry=()=>{}}){
  let active=false,tab='furniture',selected='toy',notice='',drag=null,seenRevision=-1;
  container.classList.add('nest-editor');container.hidden=true;container.setAttribute('aria-label','共同布置小窝');
  const state=()=>getState(),decor=()=>normalizeNest(state().nest);
  function attempt(action){
    const result=nestActionResult(state(),action);if(!result.ok){notice=result.reason;render();return false;}
    if(!onAction(action)){notice='这次布置还没保存，连接恢复后再试一次。';render();return false;}
    notice=result.text;render();return true;
  }
  function map(nest){
    return `<svg class="nest-floorplan" data-nest-map viewBox="0 0 800 680" role="img" aria-label="小窝平面图，选择家具后点击空地摆放"><defs><pattern id="nest-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" stroke-opacity=".1" stroke-width="1"/></pattern></defs><rect x="35" y="25" width="730" height="610" rx="24" fill="url(#nest-grid)" stroke="currentColor" stroke-opacity=".2"/>${nest.placements.map(p=>{const item=nestItem(p.item),w=(p.rotation%2?item.depth:item.width)*100,h=(p.rotation%2?item.width:item.depth)*100;return `<g data-nest-map-item="${p.item}" class="${selected===p.item?'selected':''}"><rect x="${(p.x+4)*100-w/2}" y="${(p.z+3.3)*100-h/2}" width="${w}" height="${h}" rx="13"/><text x="${(p.x+4)*100}" y="${(p.z+3.3)*100+9}" text-anchor="middle">${item.icon}</text></g>`;}).join('')}<text x="400" y="485" class="nest-plan-cat" text-anchor="middle">🐾</text><text x="605" y="525" class="nest-plan-robot" text-anchor="middle">团团</text><text x="535" y="60" class="nest-plan-door" text-anchor="middle">门口</text></svg>`;
  }
  function render(){
    if(!active||drag)return;const s=state(),nest=decor(),level=nestLevel(nest.level),item=nestItem(selected),placed=nest.placements.find(p=>p.item===selected),save=getSaveStatus();
    if(nest.revision!==seenRevision){notice='';seenRevision=nest.revision;}
    const scroll=container.querySelector('.nest-editor-content')?.scrollTop||0,focus=document.activeElement?.dataset.nestFocus;
    const phase=save.phase||'local',label={saving:'正在保存…',error:'尚未保存',offline:'等待连接',loading:'正在读取…',saved:'已保存',local:'已存本机'}[phase]||'等待连接';
    container.innerHTML=`<header class="nest-editor-header"><div><small>两个人，一点点布置</small><h2>我们的小窝 <span>Lv.${nest.level}</span></h2></div><button data-nest-close aria-label="收起布置面板">×</button></header><div class="nest-editor-summary"><span>${level.name} · ${nest.placements.length}/${level.slots} 件</span><span class="nest-save" data-phase="${phase}" role="status">${label}</span></div><nav class="nest-editor-tabs" aria-label="布置分类">${[['furniture','家具'],['collection','收藏'],['palette','配色'],['upgrade','升级']].map(([id,name])=>`<button data-nest-tab="${id}" data-nest-focus="tab-${id}" aria-pressed="${tab===id}">${name}</button>`).join('')}</nav><div class="nest-editor-content">${tab==='furniture'?`
      <p class="nest-editor-tip">点家具，再点平面图或房间地板摆放；也可以拖动图上的家具。</p>${map(nest)}
      <div class="nest-owned" aria-label="已收藏家具">${NEST_ITEMS.filter(i=>nest.owned.includes(i.id)).map(i=>`<button data-nest-select="${i.id}" data-nest-focus="select-${i.id}" aria-pressed="${selected===i.id}"><span>${i.icon}</span>${i.name}<small>${nest.placements.some(p=>p.item===i.id)?'已摆放':'已收纳'}</small></button>`).join('')}</div>
      <section class="nest-selected"><div><h3>${item.name}</h3><p>${item.purpose}</p></div><div class="nest-placement-actions">${placed?'<button data-nest-rotate data-nest-focus="rotate">↻ 转向</button>':'<button data-nest-auto>找个空位</button>'}<button data-nest-store ${placed?'':'disabled'}>收纳</button><button data-nest-use ${placed?'':'disabled'}>${s.sleeping&&item.care==='sleep'?'叫醒猫猫':'猫猫来用'}</button></div><div class="nest-nudge" aria-label="微调家具位置"><button data-nest-nudge="0,-0.25" aria-label="家具向后移动">↑</button><button data-nest-nudge="-0.25,0" aria-label="家具向左移动">←</button><button data-nest-nudge="0,0.25" aria-label="家具向前移动">↓</button><button data-nest-nudge="0.25,0" aria-label="家具向右移动">→</button><span>${placed?'每次移动一小格':'点图上的空地摆放'}</span></div>${item.care?'<small class="nest-care-note">使用家具沿用摸摸、逗猫或休息的次数与冷却，成长仍需点击领取。</small>':''}</section>`:''}
      ${tab==='collection'?`<p class="nest-editor-tip">猫爪币慢慢攒，喜欢的小物一起收藏。已有 ${nest.owned.length}/${NEST_ITEMS.length} 件 · 余额 ${s.coins} 币</p><div class="nest-shop">${NEST_ITEMS.filter(i=>!i.base).map(i=>{const owned=nest.owned.includes(i.id),locked=nest.level<i.level;return `<article><span class="nest-shop-art">${i.icon}</span><h3>${i.name}</h3><p>${i.purpose}</p><button data-nest-buy="${i.id}" ${owned||locked||s.coins<i.cost?'disabled':''}>${owned?'已收藏':locked?`${nestLevel(i.level).name}解锁`:`${i.cost} 币 · 收藏`}</button>${owned?`<button class="nest-shop-place" data-nest-select="${i.id}">去摆放 ›</button>`:''}</article>`;}).join('')}</div>`:''}
      ${tab==='palette'?`<p class="nest-editor-tip">选一种今天喜欢的颜色，墙面、木色和软装会一起变换。配色免费。</p><div class="nest-palettes">${NEST_PALETTES.map(p=>`<button data-nest-palette="${p.id}" data-nest-focus="palette-${p.id}" aria-pressed="${nest.palette===p.id}"><span>${[p.wall,p.floor,p.fabric,p.trim].map(c=>`<i style="background:${c}"></i>`).join('')}</span><strong>${p.name}</strong><small>${nest.palette===p.id?'正在使用':'换上这个配色'}</small></button>`).join('')}</div>`:''}
      ${tab==='upgrade'?`<p class="nest-editor-tip">现在是${level.name}，两人的布置都会留在这里。余额 ${s.coins} 币</p><div class="nest-upgrades">${NEST_LEVELS.map(l=>`<article class="${l.level<=nest.level?'unlocked':''}"><span>0${l.level}</span><div><h3>${l.name}</h3><p>${l.detail}</p><small>可摆 ${l.slots} 件家具和装饰</small></div><button data-nest-upgrade="${l.level}" ${l.level!==nest.level+1||s.coins<l.cost?'disabled':''}>${l.level<=nest.level?'已点亮':l.level===nest.level+1?`${l.cost} 币 · 升级`:'下一阶段'}</button></article>`).join('')}</div>`:''}
      </div><footer class="nest-editor-footer"><p role="status" aria-live="polite">${esc(notice|| (nest.lastEdit?`${nest.lastEdit.actor} · ${nest.lastEdit.text}`:'每次修改会自动保存，两个人都能接着布置。'))}</p>${['error','offline'].includes(phase)?'<button data-nest-retry>重试保存</button>':''}</footer>`;
    const content=container.querySelector('.nest-editor-content');content.scrollTop=scroll;
    if(focus)container.querySelector(`[data-nest-focus="${focus}"]`)?.focus({preventScroll:true});
  }
  function select(id){if(!decor().owned.includes(id))return;selected=id;tab='furniture';notice='';render();container.querySelector('.nest-editor-content').scrollTop=0;onSelection(id);}
  function place(point){if(!active||tab!=='furniture')return false;const nest=decor(),p=nest.placements.find(p=>p.item===selected),pose={x:snap(point.x),z:snap(point.z),rotation:p?.rotation||0};const valid=placementResult(nest,selected,pose);onPreview(null);if(!valid.ok){notice=valid.reason;render();return true;}attempt({type:'nest-place',item:selected,...pose});return true;}
  const click=event=>{const b=event.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-nest-close'))api.close();
    else if(b.dataset.nestTab){tab=b.dataset.nestTab;notice='';render();container.querySelector('.nest-editor-content').scrollTop=0;}
    else if(b.dataset.nestSelect)select(b.dataset.nestSelect);
    else if(b.dataset.nestBuy)attempt({type:'nest-buy',item:b.dataset.nestBuy});
    else if(b.dataset.nestPalette)attempt({type:'nest-palette',palette:b.dataset.nestPalette});
    else if(b.dataset.nestUpgrade)attempt({type:'nest-upgrade',level:Number(b.dataset.nestUpgrade)});
    else if(b.hasAttribute('data-nest-store'))attempt({type:'nest-store',item:selected});
    else if(b.hasAttribute('data-nest-auto')){const pose=suggestNestPlacement(decor(),selected);if(pose)attempt({type:'nest-place',item:selected,...pose});else{notice='暂时找不到合适的空位，先收纳一件家具试试。';render();}}
    else if(b.hasAttribute('data-nest-retry'))onRetry();
    else if(b.hasAttribute('data-nest-use')){api.close();onUse(selected);}
    else if(b.hasAttribute('data-nest-rotate')){const p=decor().placements.find(p=>p.item===selected);if(p)attempt({type:'nest-place',item:selected,x:p.x,z:p.z,rotation:(p.rotation+1)%4});else{notice='先点空地把家具摆好，再转个方向。';render();}}
    else if(b.dataset.nestNudge){const p=decor().placements.find(p=>p.item===selected);if(p){const [dx,dz]=b.dataset.nestNudge.split(',').map(Number);attempt({type:'nest-place',item:selected,x:Math.round((p.x+dx)*100)/100,z:Math.round((p.z+dz)*100)/100,rotation:p.rotation});}}
  };
  function mapPoint(event,node){const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(node.getScreenCTM().inverse());return {x:point.x/100-4,z:point.y/100-3.3};}
  const down=event=>{const map=event.target.closest('[data-nest-map]');if(!map||event.button!==0)return;if(drag){drag.cancelled=true;return;}const id=event.target.closest('[data-nest-map-item]')?.dataset.nestMapItem;drag={id:event.pointerId,node:map,x:event.clientX,y:event.clientY,item:id,moved:false};if(id){selected=id;onSelection(id);}map.setPointerCapture?.(event.pointerId);};
  const move=event=>{if(drag?.id!==event.pointerId)return;drag.moved||=Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5;if(drag.moved&&drag.item){const point=mapPoint(event,drag.node),p=decor().placements.find(p=>p.item===selected),pose={x:snap(point.x),z:snap(point.z),rotation:p?.rotation||0};onPreview({item:selected,...pose,ok:placementResult(decor(),selected,pose,{paths:false}).ok});}};
  const up=event=>{if(drag?.id!==event.pointerId)return;const d=drag,point=mapPoint(event,d.node);drag=null;if(d.cancelled){onPreview(null);render();return;}if(d.item&&!d.moved){select(d.item);onPreview(null);}else place(point);};
  const cancel=()=>{drag=null;onPreview(null);render();};
  container.addEventListener('click',click);container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);container.addEventListener('pointerup',up);container.addEventListener('pointercancel',cancel);
  const api={open(){active=true;container.hidden=false;render();onSelection(selected);},close(){active=false;drag=null;container.hidden=true;onPreview(null);onClose();},render,select,place,get active(){return active;},destroy(){api.close();container.removeEventListener('click',click);container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);container.removeEventListener('pointerup',up);container.removeEventListener('pointercancel',cancel);container.replaceChildren();}};
  return api;
}
