import { RESTAURANT_STAFF } from './restaurant.js';
import { restaurantStaffRestInfo } from './restaurant-staff-training.js';

const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/staff-rest/${file}.webp`,globalThis.document?.baseURI||import.meta.url).href;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>id==='worker-1'?'橘子主厨':RESTAURANT_STAFF[Number(id?.split('-')[1])-2]?.name||'猫猫员工';
const sprite=id=>id==='worker-1'?'chef':RESTAURANT_STAFF[Number(id?.split('-')[1])-2]?.sprite||'waiter';
export const staffRestCountdown=remainingMs=>{
  const seconds=Math.max(0,Math.ceil(remainingMs/1000));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
};
export function staffRestStatus(worker,now=Date.now()){
  const rest=worker.rest;
  if(!rest)return '';
  if(rest.phase==='exhausted')return '体力耗尽 · 完成本步后去休息';
  if(rest.phase==='walking')return `前往休息室 ${staffRestCountdown(rest.arriveAt-now)}`;
  if(rest.phase==='recovering')return `恢复体力 ${staffRestCountdown(rest.remainingMs)}`;
  return '体力已满 · 等你派工';
}
export function staffRestCompactStatus(worker,now=Date.now()){
  const rest=worker.rest;
  if(!rest)return '';
  if(rest.phase==='exhausted')return '本步后休息';
  if(rest.phase==='walking')return `前往 ${staffRestCountdown(rest.arriveAt-now)}`;
  return rest.phase==='recovering'?`恢复 ${staffRestCountdown(rest.remainingMs)}`:'待派工';
}
export function staffEnergyMarkup(energy,maxEnergy,label='员工体力'){
  const value=Math.max(0,Math.min(maxEnergy,energy)),percent=maxEnergy?value/maxEnergy*100:0;
  return `<span class="rr-energy" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${maxEnergy}" aria-valuenow="${Math.floor(value)}" aria-valuetext="${Math.floor(value)} / ${maxEnergy}"><i style="width:${percent}%"></i></span>`;
}
export function restRoomSceneMarkup(){
  return `<aside class="rr-entrance" aria-label="员工休息室入口"><button class="rr-door" data-r-tab="restroom" aria-label="进入员工休息室"><img src="${asset('door')}" alt="茶杯小牌下的暖木休息室门" draggable="false"/><span>休息室</span></button><details class="rr-rest-summary" data-r-rest-summary hidden><summary aria-label="展开员工休息状态" aria-controls="rr-rest-status"><span>休息</span><b data-r-rest-count>0</b></summary><div class="rr-rest-popover" id="rr-rest-status"><header><strong>员工状态</strong><button data-r-rest-collapse aria-label="收起休息状态">×</button></header><ul data-r-rest-list aria-label="休息员工状态"></ul><button class="rr-room-link" data-r-tab="restroom">查看休息室 ›</button></div></details></aside>`;
}
export function restaurantRestSummaryMarkup(workers,now=Date.now()){
  return workers.filter(worker=>worker.rest&&worker.rest.phase!=='exhausted').map(worker=>`<li data-r-rest-summary-worker="${worker.id}" data-rest-phase="${worker.rest.phase}"><span class="r-cat r-cat-${sprite(worker.id)}" aria-hidden="true"></span><div><strong>${name(worker.id)}</strong><span>${staffRestCompactStatus(worker,now)}</span>${staffEnergyMarkup(worker.energy,worker.maxEnergy,`${name(worker.id)}的体力`)}</div></li>`).join('');
}
export function restaurantRestRoomPanel(info,{now=Date.now()}={}){
  const workers=restaurantStaffRestInfo(info.restaurant,now),inside=workers.filter(worker=>['recovering','ready'].includes(worker.rest?.phase)),walking=workers.filter(worker=>worker.rest?.phase==='walking'),recovering=inside.filter(worker=>worker.rest.phase==='recovering').length,ready=inside.length-recovering;
  return `<section class="rr-lounge" aria-label="员工休息室"><div class="rr-room"><img class="rr-room-art" src="${asset('lounge')}" alt="软垫长椅、温热的茶水和绿植，供员工恢复体力"/><div class="rr-resting-workers ${inside.length>3?'rr-many-workers':''}">${inside.map(worker=>`<div class="rr-resting-worker" data-r-resting-worker="${worker.id}" data-rest-phase="${worker.rest.phase}"><span class="rr-recovery-bubble">${inside.length>3?staffRestCompactStatus(worker,now):staffRestStatus(worker,now)}</span>${staffEnergyMarkup(worker.energy,worker.maxEnergy,`${name(worker.id)}的体力`)}<span class="r-cat r-cat-${sprite(worker.id)}" aria-hidden="true"></span><strong>${name(worker.id)}</strong></div>`).join('')}</div></div><div class="rr-room-toolbar"><div aria-label="休息人数">${inside.length?`<span>恢复中 <b>${recovering}</b></span><span>待派工 <b>${ready}</b></span>`:'<span>暂无休息员工</span>'}</div><button class="rr-training-link" data-r-tab="training">能力升级 ›</button></div>${walking.length?`<p class="rr-room-note">${walking.length} 位正在前往休息室</p>`:''}</section>`;
}

/** Paint only. All energy, journeys and countdowns come from the saved ledger. */
export function paintRestaurantStaffRest(container,restaurant,now=Date.now()){
  const workers=restaurantStaffRestInfo(restaurant,now);
  for(const worker of workers){
    const actor=container.querySelector(`[data-rk-worker="${worker.id}"]`);if(!actor)continue;
    let meter=actor.querySelector('.rr-energy');
    if(!meter){actor.insertAdjacentHTML('beforeend',staffEnergyMarkup(worker.energy,worker.maxEnergy,`${name(worker.id)}的体力`));meter=actor.querySelector('.rr-energy');}
    const energy=Math.max(0,Math.min(worker.maxEnergy,worker.energy));
    meter.setAttribute('aria-valuenow',String(Math.floor(energy)));meter.setAttribute('aria-valuemax',String(worker.maxEnergy));meter.setAttribute('aria-valuetext',`${Math.floor(energy)} / ${worker.maxEnergy}`);
    meter.firstElementChild.style.width=`${energy/worker.maxEnergy*100}%`;
    actor.classList.toggle('is-fatigued',energy===0);
    actor.classList.toggle('rr-is-inside',['recovering','ready'].includes(worker.rest?.phase));
  }
  const summary=container.querySelector('[data-r-rest-summary]');if(!summary)return;
  const active=workers.filter(worker=>worker.rest&&worker.rest.phase!=='exhausted');
  summary.hidden=active.length===0;if(summary.hidden)summary.open=false;
  summary.querySelector('[data-r-rest-count]').textContent=String(active.length);
  summary.querySelector('summary').setAttribute('aria-label',`${active.length} 位员工休息中，点击${summary.open?'收起':'展开'}状态`);
  summary.dataset.state=active.some(worker=>worker.rest.phase==='recovering')?'recovering':active.some(worker=>worker.rest.phase==='walking')?'walking':'ready';
  const list=summary.querySelector('[data-r-rest-list]'),markup=restaurantRestSummaryMarkup(active,now);
  if(list.innerHTML!==markup)list.innerHTML=markup;
}
