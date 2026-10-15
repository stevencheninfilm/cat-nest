import { localNestTime, LIFE_EVENTS, lifeEventText, createLifeScheduler } from './nest-life.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function lifeDiaryMarkup(records,now=Date.now()) {
  const time=localNestTime(now);
  return `<section class="life-diary"><header><span aria-hidden="true">${time.icon}</span><div><h3>小窝小事</h3><p>${time.description}</p></div></header>${records.length?`<ul>${records.slice(0,6).map(event=>`<li><span aria-hidden="true">${LIFE_EVENTS[event.kind].icon}</span><div><time datetime="${new Date(event.at).toISOString()}">${new Date(event.at).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})} · ${localNestTime(event.at).clock}</time><p>${escape(lifeEventText(event))}</p></div></li>`).join('')}</ul><small>这台设备留下的小小日常</small>`:'<p class="life-empty">偶尔会有一点小惊喜，慢慢陪它就好。</p>'}</section>`;
}
export function createNestLife({nest,scene,storage,key,canEvent,onCatEvent,showProp=()=>false,hideProp=()=>{},clock=Date.now,random=Math.random}) {
  let previewHour=null,timeKey='';const fallback=new Map();
  const atmosphere=document.createElement('div');atmosphere.className='nest-atmosphere';atmosphere.setAttribute('aria-hidden','true');atmosphere.innerHTML='<i class="nest-moon"></i><i class="nest-window-stars">✧ · ✦</i>';nest.insertBefore(atmosphere,nest.querySelector('.topbar'));
  const moment=document.createElement('div');moment.className='nest-moment';moment.hidden=true;
  moment.innerHTML='<div class="nest-moment-copy" role="status" aria-live="polite" aria-atomic="true"></div><div class="nest-moment-prop" aria-hidden="true"></div>';scene.append(moment);
  const now=()=>{const date=new Date(clock());if(previewHour!==null)date.setHours(previewHour,0,0,0);return date.valueOf();};
  const scheduler=createLifeScheduler({clock,random,canEvent,read(){const scoped=key();try{const raw=storage.getItem(scoped);if(raw)return JSON.parse(raw);}catch{}return fallback.get(scoped)||{version:1,day:localNestTime(clock()).day,count:0,checkedAt:0,lastAt:0,records:[]};},write(value){fallback.set(key(),value);try{storage.setItem(key(),JSON.stringify(value));}catch{}},
    onEvent(event,{preview}) {
      if(onCatEvent(event.kind)===false)return false;
      const definition=LIFE_EVENTS[event.kind];moment.dataset.kind=event.kind;moment.hidden=false;
      moment.querySelector('.nest-moment-copy').innerHTML=`<small>${preview?'氛围预览 · ':''}${definition.title}</small><span>${lifeEventText(event)}</span>`;
      const physical=event.kind==='spill'||event.kind==='gift',three=physical&&showProp(event)===true;
      moment.dataset.propRenderer=three?'three':physical?'fallback':'hearts';
      moment.querySelector('.nest-moment-prop').innerHTML=three?'':physical?`<i class="life-prop-fallback">${event.kind==='gift'?'🎁':event.variant===2?'☕':'🧶'}</i>`:'<i class="life-heart">♡</i><i class="life-heart second">♡</i>';
      return true;
    },onEnd(){hideProp();moment.hidden=true;moment.querySelector('[role=status]').textContent='';moment.querySelector('.nest-moment-prop').textContent='';},
  });
  function updateTime(){const time=localNestTime(now()),signature=`${time.day}:${time.period}:${time.clock}`;if(signature===timeKey)return;timeKey=signature;nest.dataset.nestPeriod=time.period;const label=nest.querySelector('[data-nest-time]');label.textContent=`${time.icon} ${time.label} · ${time.clock}`;label.title=`设备本地时间 · ${time.range}\n${time.description}`;label.setAttribute('aria-label',`设备本地时间 ${time.clock}，${time.label}`);}
  return {now,tick(){updateTime();scheduler.tick();},interrupt:scheduler.interrupt,diary:()=>lifeDiaryMarkup(scheduler.records(),now()),
    preview({hour,event}={}){if(hour===null||[8,14,19,23].includes(hour)){previewHour=hour;timeKey='';updateTime();}if(event)scheduler.preview(event,now());},
    destroy(){scheduler.interrupt();atmosphere.remove();moment.remove();},
  };
}
