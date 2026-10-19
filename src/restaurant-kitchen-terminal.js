import { KITCHEN_FLOWS, KITCHEN_ZONES } from './restaurant-kitchen.js';
import { kitchenRecipesInMenuOrder } from './restaurant-kitchen-recipes-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const detailedOrders=info=>info.orders.filter(order=>order.workflow);

export function kitchenTerminalState(info,{orderId=null,now=Date.now()}={}) {
  const orders=detailedOrders(info);
  const order=orders.find(order=>order.id===orderId)||orders.find(order=>order.status!=='collectible')||orders[0];
  if(!order)return {orderId:'',title:'暂无测试订单',step:'选择一道料理，观察取料、排队与送餐。',meta:`${info.restaurant.staff+1} 位员工 · ${info.availableTables} 张空桌`,progress:0,action:null};
  const flow=info.kitchen.orders.find(flow=>flow.id===order.id),phase=flow?.phase,step=flow?.currentStep;
  const labels={arriving:'客人正在入座',requested:'等待接单',awaiting:`待点击 · ${step?.label||'下一步'}`,'awaiting-delivery':'已装盘，等待点击送餐',walk:'正在前往工位',wait:'正在等待工位',queue:'等待员工接单',queued:'等待员工接单',delivery:'正在送到餐桌',return:'正在返回厨房'};
  const finished=phase==='complete'||phase==='completed';
  const label=order.status==='arriving'?labels.arriving:finished?(order.status==='collectible'?'已用餐，等待收款':'已送达，客人正在用餐'):phase==='work'?step.label:labels[phase]||'料理制作中';
  const endAt=order.status==='arriving'?order.createdAt:phase==='work'||phase==='wait'?step?.endAt:phase==='queue'?flow?.queuedUntil:phase==='delivery'?order.workflow.servedAt:phase==='return'?order.workflow.completedAt:null;
  const seconds=endAt>now?Math.ceil((endAt-now)/1000):null;
  const workerId=flow?.workerId||order.workflow.workerId,workerLabel=flow?.handoffReady?'等待空闲员工接手':workerId?`${Number(workerId.slice(7))} 号员工`:'待安排员工';
  const action=phase==='requested'?{type:'kitchen-accept',label:'接下这份订单'}:['awaiting','awaiting-delivery'].includes(phase)&&flow.nextStep?{type:'kitchen-step',stepId:flow.nextStep.id,label:`开始${flow.nextStep.label}`} :null;
  return {orderId:order.id,title:order.recipe.name,step:label,meta:`${workerLabel}${step?.zoneId?` · ${step.zoneId} 号工位`:''}${seconds===null?'':` · ${seconds} 秒`}`,progress:phase==='work'?step.progress:flow?.progress??0,action};
}

function kitchenOrderTerminalMarkup(info) {
  const recipes=kitchenRecipesInMenuOrder(info),orders=detailedOrders(info);
  return `<details class="rk-terminal-kitchen"><summary><strong>单菜测试</strong><span>${orders.length} 份流程订单</span></summary><div class="rk-terminal-dishes" role="group" aria-label="单独测试菜品">${recipes.map(recipe=>`<button data-r-debug-dish="${recipe.id}" aria-label="单独测试${esc(recipe.name)}" ${!info.availableTables||!recipe.unlocked?'disabled':''}><span class="r-food r-food-${recipe.id}" aria-hidden="true"></span><strong>${esc(recipe.name)}</strong></button>`).join('')}</div><label class="rk-terminal-order">查看订单<select data-r-debug-kitchen-order aria-label="选择要查看的菜品订单" ${!orders.length?'disabled':''}>${orders.length?orders.map(order=>`<option value="${order.id}">${esc(order.recipe.name)} · ${order.workflow.workerId?`${order.workflow.workerId.slice(7)}号员工`:'待安排'} · ${order.id.slice(6)}号单</option>`).join(''):'<option value="">暂无订单</option>'}</select></label><div class="rk-terminal-monitor" data-r-kitchen-monitor><strong data-r-kitchen-monitor-title></strong><p data-r-kitchen-monitor-step></p><small data-r-kitchen-monitor-meta></small><span class="rk-terminal-progress"><i data-r-kitchen-monitor-progress></i></span><button class="rk-terminal-step" data-r-kitchen-monitor-action hidden disabled></button></div><p class="rg-staff-note">${info.availableTables?'':'餐桌已满，先完成结账或切换测试预设。'}每次测试迎接一位顾客，并暂停自然来客。通过上方按钮或场景食材圈逐步推进；工序说明在「玩法与教材」后部。</p></details>`;
}

export function kitchenTerminalMarkup(info){return `<button class="rk-board-entry" data-r-tab="workflows"><strong>菜品工序后台 →</strong><small>${kitchenRecipesInMenuOrder(info).length} 道菜 · 横向流程</small></button>`+kitchenOrderTerminalMarkup(info)+'<button class="rk-board-entry" data-r-tab="themes" data-r-theme-view="colors"><strong>操作圈配色 →</strong><small>装扮 · 等级解锁</small></button>';}

export function paintKitchenTerminal(root,info,options={}) {
  const monitor=root?.querySelector('[data-r-kitchen-monitor]');
  if(!monitor)return;
  const state=kitchenTerminalState(info,options);
  for(const [key,value] of [['title',state.title],['step',state.step],['meta',state.meta]])monitor.querySelector(`[data-r-kitchen-monitor-${key}]`).textContent=value;
  monitor.querySelector('[data-r-kitchen-monitor-progress]').style.width=`${Math.max(0,Math.min(1,state.progress))*100}%`;
  const button=monitor.querySelector('[data-r-kitchen-monitor-action]');
  if(button){
    button.hidden=!state.action;button.disabled=options.blocked||!state.action;
    if(state.action){button.textContent=state.action.label;button.dataset.rAction=state.action.type;button.dataset.rOrderId=state.orderId;if(state.action.stepId)button.dataset.rStep=state.action.stepId;else delete button.dataset.rStep;}
  }
  const select=root.querySelector('[data-r-debug-kitchen-order]');
  if(select&&select.value!==state.orderId)select.value=state.orderId;
}

export function kitchenGuideMarkup(info) {
  return `<section class="rk-guide" aria-label="料理工序教材"><h3>料理工序教材</h3><p>先点击客人的需求接单，再逐步点击食材圈推进；每一步完成后，员工会等你继续操作，最后点击餐桌送餐。员工体力耗尽会在本步完成后去休息，点击下一步可让空闲员工接手。工位一次只接待一位员工，送餐后返回厨房。</p>${kitchenRecipesInMenuOrder(info).map(({id,name})=>{const steps=KITCHEN_FLOWS[id];return `<details><summary>${esc(name)} · ${steps.length} 道工序</summary><ol>${steps.map(step=>`<li><b>${step.zoneId}号 · ${esc(KITCHEN_ZONES.find(zone=>zone.id===step.zoneId).name)}</b><span>${esc(step.label)}</span></li>`).join('')}<li><b>送餐与返回</b><span>料理装好后点击餐桌送出，客人用餐后结账，员工返回厨房。</span></li></ol></details>`;}).join('')}</section>`;
}
