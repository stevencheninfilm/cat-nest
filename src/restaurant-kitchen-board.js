import { recipeStepEnergyBase } from './restaurant-recipe-energy.js';
import { KITCHEN_FLOWS } from './restaurant-kitchen.js';
import { INTERACTIVE_KITCHEN_ZONES } from './restaurant-kitchen-layout.js';
import { kitchenPropUrl, kitchenAnimationId, kitchenAnimationUrl } from './restaurant-kitchen-assets.js';
import { kitchenRecipesInMenuOrder, KITCHEN_RECIPE_DETAILS, kitchenShortStep } from './restaurant-kitchen-recipes-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zoneName=id=>INTERACTIVE_KITCHEN_ZONES.find(zone=>zone.id===id)?.name||'餐桌';
const phases={arriving:'客人正在入座',requested:'等待玩家接单',awaiting:'等待点击下一步','awaiting-delivery':'等待点击送餐',walk:'正在前往工位',wait:'等待工位空闲',queue:'等待员工',queued:'等待员工',work:'加工中',delivery:'正在送餐',return:'返回厨房','rest-walk':'前往休息室',complete:'已送达餐桌'};
function currentOrder(info,id){return info.orders.find(order=>order.recipeId===id&&order.workflow&&!['collectible','dining'].includes(order.status))||info.orders.find(order=>order.recipeId===id&&order.workflow)||null;}

export function kitchenWorkflowBoardState(info,recipeId,now=Date.now()){
  const order=currentOrder(info,recipeId),flow=info.kitchen.orders.find(item=>item.id===order?.id);
  const current=flow?.currentStep,phase=flow?.phase,accepted=order?.workflow.version===1||order?.workflow.acceptedAt!==null&&order?.workflow.acceptedAt!==undefined;
  const worker=info.kitchen.workers.find(item=>item.id===flow?.workerId),resting=['resting','rest-walk'].includes(worker?.phase);
  const cards=[{id:'request',state:!flow?'pending':phase==='requested'?'next':accepted?'done':'pending',progress:0,seconds:null}];
  for(const step of KITCHEN_FLOWS[recipeId]||[]){
    const projected=flow?.steps.find(item=>item.id===step.id),isCurrent=current?.id===step.id;
    const state=projected?.status==='complete'?'done':isCurrent&&phase==='work'?'work':isCurrent&&['walk','wait','queue','queued'].includes(phase)?phase:flow?.nextStep?.id===step.id?'next':'pending';
    cards.push({id:step.id,state,progress:state==='work'?projected.progress:state==='done'?1:0,seconds:state==='work'?Math.max(0,Math.ceil((projected.endAt-now)/1000)):null});
  }
  const served=order?.servedAt!==null&&order?.servedAt!==undefined&&now>=order.servedAt;
  cards.push({id:'delivery',state:served?'done':phase==='delivery'?'work':phase==='awaiting-delivery'?'next':'pending',progress:0,seconds:null});
  cards.push({id:'return',state:phase==='complete'?'done':phase==='return'?'walk':'pending',progress:0,seconds:null});
  const action=phase==='requested'?{type:'kitchen-accept',label:'接下订单'}:flow?.nextStep?{type:'kitchen-step',stepId:flow.nextStep.id,label:`开始${kitchenShortStep(flow.nextStep.id)}`} :null;
  const activity=flow?.handoffReady?'等待空闲员工接手':resting?worker.phase==='rest-walk'?'前往休息室':`恢复体力 · ${Math.max(0,Math.ceil((worker.rest.fullAt-now)/1000))} 秒`:phases[phase]||'制作中';
  return {order,phase,action,cards,status:flow?`${flow.workerId?`${flow.workerId.slice(7)}号员工 · `:''}${activity}`:'尚未开始 · 点击单菜测试迎接顾客'};
}

const stateLabel=state=>({done:'已完成',next:'等待点击',work:'制作中',walk:'走位中',wait:'工位排队',queue:'员工排队',queued:'员工排队',pending:'待制作'})[state]||'待制作';
function stepCard(recipe,step,index){
  const image=kitchenPropUrl(step.prop),loop=kitchenAnimationUrl(kitchenAnimationId(step.id,recipe.id));
  return `<li class="rk-board-card" data-r-board-step="${esc(step.id)}" data-state="pending"><span class="rk-board-index">${String(index+1).padStart(2,'0')}</span><span class="rk-board-state">待制作</span><button class="rk-board-preview" data-r-board-animate aria-pressed="false" aria-label="预览${esc(recipe.name)}的${esc(kitchenShortStep(step.id))}动画" data-static="${esc(image)}" data-loop="${esc(loop)}"><img src="${esc(image)}" alt="${esc(step.label)}" loading="lazy" draggable="false"/><span>▶ 动画</span><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="rk-board-track" cx="20" cy="20" r="18"/><circle class="rk-board-fill" cx="20" cy="20" r="18"/></svg><b class="rk-board-countdown" hidden></b></button><strong>${esc(kitchenShortStep(step.id))}</strong><p>${esc(step.label)}</p><small><b>${step.zoneId}号</b> ${esc(zoneName(step.zoneId))}</small><time>基础 ${(step.durationMs/1000).toFixed(1).replace(/\.0$/,'')} 秒</time></li>`;
}
function bookend(id,label,description,symbol){return `<li class="rk-board-card rk-board-bookend" data-r-board-step="${id}" data-state="pending"><span class="rk-board-state">待制作</span><span class="rk-board-symbol" aria-hidden="true">${symbol}</span><strong>${label}</strong><p>${description}</p><small>${id==='return'?'中央门洞 · 返程通道':'玩家点击推进'}</small></li>`;}

export function kitchenWorkflowBoardMarkup(info){
  const recipes=kitchenRecipesInMenuOrder(info);
  return `<section class="rk-workflow-board" aria-label="菜品制作工序后台"><div class="rk-board-heading"><div><small>KITCHEN WORKFLOWS</small><h3>${recipes.length} 道菜品 · 完整制作工序</h3><p>菜品顺序与菜谱同步，每一行向右查看。点击图片可播放循环动画。</p></div><span>● 蓝色加工中 <i>✓ 已完成</i></span></div><div class="rk-board-rules"><span>逐步点击</span><span>到工位才倒计时</span><span>一人一工位</span><span>送达后再结算</span></div>${recipes.map(recipe=>{
    const flow=KITCHEN_FLOWS[recipe.id],state=kitchenWorkflowBoardState(info,recipe.id);
    const energyBase=state.order?(state.order.workflow.stepEnergyBase??10):recipeStepEnergyBase(recipe.id,recipe.level??1);
    const energyText=state.order&&state.order.workflow.version<3?'旧订单沿用原体力规则':`每步基准 ${energyBase} 体力 · 耐力可减耗`;
    const action=state.action,button=state.order?`data-r-action="${action?.type||'kitchen-step'}" data-r-order-id="${esc(state.order.id)}" ${action?.stepId?`data-r-step="${esc(action.stepId)}"`:''} ${action?'':'disabled'}`:`data-r-debug-dish="${esc(recipe.id)}" ${!info.availableTables||!recipe.unlocked?'disabled':''}`;
    return `<article class="rk-board-row" data-r-board-recipe="${esc(recipe.id)}"><header><img src="${kitchenPropUrl(recipe.id)}" alt=""/><div><h4>${esc(recipe.name)}</h4><small>${flow.length} 道工序 · ${Math.round(flow.reduce((sum,step)=>sum+step.durationMs,0)/100)/10} 秒基础加工</small><small class="rk-board-energy" title="基准乘以耐力系数，实际消耗向上取整">${energyText}</small></div><p>${esc(KITCHEN_RECIPE_DETAILS[recipe.id]?.ingredients)}</p><button class="rk-board-test" ${button} aria-label="${state.order?action?.label||'工序正在执行':`单独测试${esc(recipe.name)}`}">${state.order?action?.label||'工序正在执行':'单菜测试 ↗'}</button><span class="rk-board-live" data-r-board-live>${esc(state.status)}</span></header><ol class="rk-board-rail" tabindex="0" aria-label="${esc(recipe.name)}横向工序">${bookend('request','顾客点餐','先点击点餐需求，记录订单。','♡')}${flow.map((step,index)=>stepCard(recipe,step,index)).join('')}${bookend('delivery','端到餐桌','点击送餐，按出餐通道端给顾客。','↗')}${bookend('return','返回厨房','沿返程通道穿过门洞；体力耗尽则前往休息室。','↙')}</ol></article>`;
  }).join('')}<p class="rk-board-footer">蓝色圆环仅计算到达工位后的加工时间；走位与排队另计。设施与员工升级可缩短实际耗时。动画预览只展示美术，不推进订单。</p></section>`;
}

/** Paint the existing board nodes, keeping row scroll and playing loops intact. */
export function paintKitchenWorkflowBoard(root,info,{now=Date.now(),blocked=false}={}){
  if(!root)return;
  for(const row of root.querySelectorAll('[data-r-board-recipe]')){
    const model=kitchenWorkflowBoardState(info,row.dataset.rBoardRecipe,now);
    row.querySelector('[data-r-board-live]').textContent=model.status;
    const button=row.querySelector('.rk-board-test');
    if(model.order){
      delete button.dataset.rDebugDish;button.dataset.rOrderId=model.order.id;
      button.disabled=blocked||!model.action;
      button.textContent=model.action?.label||'工序正在执行';
      button.setAttribute('aria-label',button.textContent);
      if(model.action){button.dataset.rAction=model.action.type;if(model.action.stepId)button.dataset.rStep=model.action.stepId;else delete button.dataset.rStep;}
      else{delete button.dataset.rAction;delete button.dataset.rStep;}
    }
    for(const card of row.querySelectorAll('[data-r-board-step]')){
      const state=model.cards.find(item=>item.id===card.dataset.rBoardStep);if(!state)continue;
      card.dataset.state=state.state;card.style.setProperty('--rk-board-progress',state.progress);
      card.querySelector('.rk-board-state').textContent=stateLabel(state.state);
      const counter=card.querySelector('.rk-board-countdown');if(counter){counter.hidden=state.seconds===null;counter.textContent=state.seconds===null?'':`${state.seconds}s`;}
    }
  }
}
