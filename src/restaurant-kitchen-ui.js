import { KITCHEN_FLOWS, KITCHEN_TABLE_POSITIONS, kitchenInfo } from './restaurant-kitchen.js';
import { INTERACTIVE_KITCHEN_ZONES as KITCHEN_ZONES } from './restaurant-kitchen-layout.js';
import { RESTAURANT_STAFF } from './restaurant.js';
import { kitchenCirclePalette, kitchenCircleStyle } from './restaurant-kitchen-colors.js';

import { kitchenPropUrl as asset, kitchenAnimationUrl as animationAsset, kitchenAnimationId, KITCHEN_FOOD_PROPS } from './restaurant-kitchen-assets.js';
import { kitchenRecipesInMenuOrder, KITCHEN_RECIPE_DETAILS, kitchenShortStep as shortStep } from './restaurant-kitchen-recipes-ui.js';
export { kitchenAnimationId } from './restaurant-kitchen-assets.js';
const esc = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const workerName = id => id?`${Number(String(id).match(/\d+$/)?.[0]??1)} 号员工`:'等待安排员工';
const zoneName = id => KITCHEN_ZONES.find(zone=>zone.id===Number(id))?.name || '餐桌';
const phaseText = phase => ({arriving:'等待客人入座',requested:'等待接单',awaiting:'等待你的点击','awaiting-delivery':'等待点击送餐',walk:'前往工位',wait:'等待工位',queue:'等待员工',queued:'等待员工',work:'加工中',delivery:'送餐中',deliver:'送餐中',return:'返回厨房',idle:'等待新订单',complete:'制作完成',completed:'制作完成'})[phase] || '准备中';
const propImage = (id,cls='') => KITCHEN_FOOD_PROPS.includes(id)?`<span class="rk-prop rk-food-prop r-food r-food-${id} ${cls}" aria-hidden="true"></span>`:`<img class="rk-prop ${cls}" src="${asset(id)}" alt="" draggable="false"/>`;
const ring = (progress=0,label='') => `<span class="rk-ring" style="--rk-progress:${Math.max(0,Math.min(1,progress))}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="rk-ring-track" cx="20" cy="20" r="16"/><circle class="rk-ring-fill" cx="20" cy="20" r="16"/></svg><b>${esc(label)}</b></span>`;

export function kitchenSceneMarkup(){
  return `<div class="rk-scene" data-rk-scene aria-label="十个独立厨房工作区">${KITCHEN_ZONES.map(zone=>{
    const b=zone.bounds;
    return `<button class="rk-zone rk-zone-${zone.id}" data-r-kitchen-zone="${zone.id}" style="--zx:${b.x}%;--zy:${b.y}%;--zw:${b.w}%;--zh:${b.h}%" aria-label="${zone.id}号${esc(zone.name)}，空闲" aria-hidden="true" tabindex="-1"><span class="rk-zone-tag"><b>${zone.id}</b><span>${esc(zone.name)}</span></span></button>`;
  }).join('')}<div class="rk-surfaces" aria-hidden="true">${KITCHEN_ZONES.map(zone=>`<span class="rk-surface rk-surface-${zone.id}" data-rk-surface="${zone.id}" style="left:${zone.prop.x}%;top:${zone.prop.y}%;width:${zone.prop.width}%" ${zone.id===10?'':'hidden'}>${zone.id===10?propImage('fridge-closed'):''}</span>`).join('')}<span class="rk-fridge-task" data-rk-fridge-task hidden></span></div><aside class="rk-tutorial-coach" data-rk-guide hidden><div><strong>新手引导</strong><button data-r-kitchen-tutorial-close aria-label="结束厨房新手引导">结束</button></div><p data-rk-guide-text></p><button data-r-kitchen-tutorial-next>下一步 →</button></aside><div class="rk-workers" data-rk-workers></div><div class="rk-next-actions" data-rk-next-actions></div><div class="rk-focus-tools"><button data-r-kitchen-focus aria-label="切换餐厅全景和厨房视角">查看厨房</button><button data-r-kitchen-tutorial aria-pressed="false" aria-label="厨房新手引导">操作教程</button></div></div>`;
}

export function kitchenFlowPanel(info,{orderId=null,recipeId='rice',zoneId=null,now=Date.now()}={}){
  const model=kitchenInfo(info.restaurant,now);
  if(zoneId){
    const zone=model.zones.find(item=>item.id===Number(zoneId));
    if(!zone)return '<p class="r-panel-intro">工位正在准备。</p>';
    const active=zone.occupant,worker=active&&model.workers.find(item=>item.id===active.workerId);
    const uniqueQueue=[...new Map((zone.queue||[]).filter(item=>item.orderId!==active?.orderId).map(item=>[item.orderId,item])).values()];
    const uses=Object.entries(KITCHEN_FLOWS).flatMap(([id,steps])=>steps.filter(step=>step.zoneId===zone.id).map(step=>({recipe:kitchenRecipesInMenuOrder(info).find(recipe=>recipe.id===id)?.name,step})));
    return `<div class="rk-station-detail"><span class="rk-large-number">${zone.id}</span><div><h3>${esc(zone.name)}</h3><p>${active?`${workerName(active.workerId)} · 正在${esc(worker?.step?.label||'操作')}`:'工位空闲，可以接待下一位员工'}</p></div></div><div class="rk-occupancy ${active?'is-occupied':''}">${ring(active?.progress||0,active?'操作中':'空闲')}<div><strong>同一时间只接待一位员工</strong><p>${active?'其他员工会在工位外等待，前一位完成后再进入。':'移动途中不占用工位，加工时才占用。'}</p></div></div>${uniqueQueue.length?`<div class="rk-reservations"><h3>后续预约 · ${uniqueQueue.length} 单</h3>${uniqueQueue.map(item=>`<p><b>${workerName(item.workerId)}</b><span>${esc(info.orders.find(order=>order.id===item.orderId)?.recipe.name||'制作订单')}</span><time>${Math.max(0,Math.ceil((item.startAt-now)/1000))} 秒后</time></p>`).join('')}</div>`:''}<h3 class="rk-section-title">这个工位负责</h3><div class="rk-station-uses">${uses.length?uses.map(({recipe,step})=>`<p><strong>${esc(recipe)}</strong><span>${esc(step.label)}</span></p>`).join(''):'<p>预留给其他料理，后续逐步补齐工序。</p>'}</div><button class="r-primary" data-r-flow="${esc(orderId||'')}">查看完整料理流程</button>`;
  }
  const active=model.orders.find(order=>order.id===orderId),saved=info.orders.find(order=>order.id===orderId);
  const id=saved?.recipeId || recipeId,flow=KITCHEN_FLOWS[id] || KITCHEN_FLOWS.rice,recipe=kitchenRecipesInMenuOrder(info).find(item=>item.id===id) || info.recipes.find(item=>item.id==='rice');
  const steps=active?.steps || flow.map(step=>({...step,status:'pending',progress:0}));
  const employee=active?model.workers.find(worker=>worker.id===active.workerId&&worker.orderId===active.id):null;
  return `<div class="rk-flow-tabs" role="group" aria-label="选择预演料理">${kitchenRecipesInMenuOrder(info).map(item=>`<button data-r-flow-recipe="${item.id}" class="${recipe.id===item.id?'selected':''}" aria-pressed="${recipe.id===item.id}">${esc(item.name)}</button>`).join('')}</div><div class="rk-flow-intro"><div><small>${active?`${workerName(active.workerId)} · ${phaseText(employee?.phase||active.phase)}`:'从食材开始，好好做一份料理'}</small><h3>${esc(recipe.name)}</h3><p>${esc(KITCHEN_RECIPE_DETAILS[recipe.id]?.ingredients||'')}</p></div>${propImage(flow[0].prop)}</div><ol class="rk-step-list">${steps.map((step,index)=>{
    const status=step.status||'pending',done=['done','complete','completed'].includes(status),current=['active','work','working'].includes(status);
    const seconds=step.endAt&&step.startAt?Math.max(0,Math.ceil((step.endAt-(current?now:step.startAt))/1000)):Math.max(1,Math.round(step.durationMs/1000));
    return `<li class="${done?'is-done':current?'is-current':''}" data-rk-step="${esc(step.id)}"><button class="rk-step-number" data-r-kitchen-zone="${step.zoneId}" aria-label="查看${step.zoneId}号${zoneName(step.zoneId)}">${done?'✓':step.zoneId}</button><div><strong>${esc(step.label)}</strong><small>${esc(zoneName(step.zoneId))}${current?` · ${seconds}秒`:done?' · 已完成':step.startAt&&step.startAt>now?' · 等待前序工序':` · 约${seconds}秒`}</small>${current?`<span class="rk-inline-progress"><i style="width:${step.progress*100}%"></i></span>`:''}</div>${propImage(step.prop,'rk-step-prop')}</li>`;
  }).join('')}<li class="rk-final-step"><span class="rk-step-number">↗</span><div><strong>端到客人的餐桌</strong><small>负责送餐的员工按通道返回厨房</small></div></li></ol><p class="r-fine">接下顾客的需求后，每一步都要点击对应食材圈才会开始。完成后员工会停下来等你；最后再点击餐桌送餐。升级冰箱加快取料，升级料理台加快加工。</p>${!active?`<p class="r-fine">${!recipe.unlocked?(recipe.special?'先解锁这份金色招牌':`Lv.${recipe.unlockLevel} 解锁后制作`):'顾客会从已开售菜品中随机点餐。'}</p>`:'<button class="r-primary" data-r-kitchen-watch>回厨房继续操作</button>'}`;
}

/** Read-only selection model shared by scene and phone instructions. */
export function kitchenViewModel(restaurant,selectedId=null,now=Date.now()){
  const model=kitchenInfo(restaurant,now),orders=model.orders;
  const active=orders.find(order=>order.id===selectedId)||orders.find(order=>!['complete','completed'].includes(order.phase))||orders[0]||null;
  return orderViewModel(model,active);
}
function orderViewModel(model,active){
  const worker=active?model.workers.find(worker=>worker.orderId===active.id)||null:null;
  const phase=active?.phase||'idle',next=active?.nextStep||null,step=worker?.step||active?.currentStep;
  const finished=['complete','completed'].includes(phase),waiting=['awaiting','awaiting-delivery'].includes(phase);
  const label=finished?'已送达餐桌，客人正在享用':phase==='requested'?'先点顾客的点餐需求':waiting?`等待点击：${next?.label||step?.label||'下一步'}`:step?.label||phaseText(phase);
  const busyZone=next?.zoneId?model.zones.find(zone=>zone.id===next.zoneId)?.occupant:null;
  return {model,active,worker,phase,next,step,finished,waiting,label,stationBusy:Boolean(busyZone&&busyZone.orderId!==active?.id)};
}
const actionMarkup=(order,step)=>`<button class="rk-action-circle" data-r-action="kitchen-step" data-r-order-id="${esc(order.id)}" data-r-step="${esc(step.id)}">${propImage(step.prop)}<svg class="rk-action-progress" viewBox="0 0 60 60" aria-hidden="true"><circle class="rk-action-track" cx="30" cy="30" r="27"/><circle class="rk-action-fill" cx="30" cy="30" r="27"/></svg><b class="rk-action-countdown" aria-hidden="true" hidden></b><span class="rk-action-order" aria-hidden="true" hidden>${order.seat+1}桌</span><span class="rk-action-caption">${esc(shortStep(step.id))}</span></button>`;

/** One station bubble survives the click, the walk and the complete work run. */
export function kitchenActionPresentation(restaurant,view,now=Date.now()){
  const {active,phase,next,stationBusy}=view;
  const running=['walk','work','delivery'].includes(phase);
  const step=running?active?.currentStep:next;
  if(!active||!step||!running&&!view.waiting)return null;
  const saved=restaurant.orders.find(order=>order.id===active.id)?.workflow;
  const work=saved?.segments?.find(segment=>segment.phase==='work'&&segment.stepId===step.id);
  const counting=phase==='work',moving=running&&!counting;
  const startAt=work?.startAt??step.startAt,endAt=work?.endAt??step.endAt;
  const progress=counting&&endAt>startAt?Math.max(0,Math.min(1,(now-startAt)/(endAt-startAt))):0;
  return {order:active,step,phase,running,counting,moving,stationBusy:!running&&stationBusy,progress,seconds:counting?Math.max(0,Math.ceil((endAt-now)/1000)):null};
}

/** Every accepted order owns its station bubble, independently of selection. */
export function kitchenActionPresentations(restaurant,now=Date.now(),model=kitchenInfo(restaurant,now)){
  return model.orders.map(order=>kitchenActionPresentation(restaurant,orderViewModel(model,order),now)).filter(Boolean).sort((a,b)=>a.order.seat-b.order.seat||a.order.id.localeCompare(b.order.id));
}

/** Use the existing 44px touch targets. Nearby orders spread around their
 * station without covering each other or the kitchen view/tutorial controls. */
export function layoutKitchenActions(actions,{width=480,height=960,obstacles=[]}={}){
  width=Math.max(60,width);height=Math.max(80,height);
  const placed=[],intersects=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
  return actions.map(action=>{
    const zone=KITCHEN_ZONES.find(zone=>zone.id===action.step.zoneId),table=KITCHEN_TABLE_POSITIONS[action.order.seat];
    const anchor=zone?{x:zone.prop.x,y:zone.id===10?60.3:zone.prop.y-6}:{x:table.x,y:table.y-4.4};
    const x=anchor.x*width/100,y=anchor.y*height/100,inward=x<width/2?1:-1,offsets=[[0,0]];
    for(let row=0;row<8;row++)for(const dy of row?[-row*72,row*72]:[0])for(const dx of [0,inward*58,-inward*58,inward*116,-inward*116,inward*174,-inward*174])if(dx||dy)offsets.push([dx,dy]);
    let point,rect;
    for(const [dx,dy] of offsets){
      const next={x:Math.max(29,Math.min(width-29,x+dx)),y:Math.max(30,Math.min(height-40,y+dy))},box={left:next.x-28,right:next.x+28,top:next.y-30,bottom:next.y+40};
      if(placed.some(other=>intersects(box,other))||obstacles.some(other=>intersects(box,other)))continue;
      point=next;rect=box;break;
    }
    point??={x:Math.max(29,Math.min(width-29,x)),y:Math.max(30,Math.min(height-40,y))};
    placed.push(rect??{left:point.x-28,right:point.x+28,top:point.y-30,bottom:point.y+40});
    return {orderId:action.order.id,x:point.x/width*100,y:point.y/height*100};
  });
}
const guidePages=[
  '① 先回到餐桌，点击顾客头上的点餐需求。这里只记下订单，员工还不会自行开工。',
  '② 接单后，冰箱上方会出现食材圈。点一下，员工才会去拿食材；走到工位后开始倒计时，蓝色圆环显示加工进度。',
  '③ 每一步结束后都会停下来。继续点洗菜、打蛋、切肉等下一处气泡；同一个工位同时只能一位员工操作。',
  '④ 装盘完成后，点击餐桌上的料理把它送出。客人用餐后再收小鱼干，同时获得成长。',
];

/** A frame only paints saved runs. It never submits a cooking action. */
export function createKitchenScene({container,getRestaurant,onFocus=()=>{},palette='cream'}){
  let snapshot=null,selectedId=null,frame=0,running=false,lastFrame=0,lastSignature='',lastLayout='',focused=false,tutorial=false,guideIndex=0,blocked=false;
  const actors=new Map(),props=new Map(),prompts=new Map(),root=container.closest('.restaurant');
  let currentPalette=kitchenCirclePalette(palette).id;
  function setPalette(id){currentPalette=kitchenCirclePalette(id).id;container.dataset.rkPalette=currentPalette;container.style.cssText=kitchenCircleStyle(currentPalette);}
  setPalette(currentPalette);
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  function actor(id){
    if(actors.has(id))return actors.get(id);
    const index=Math.max(0,Number(String(id).match(/\d+$/)?.[0]??1)-1),character=index===0?'chef':RESTAURANT_STAFF[index-1]?.sprite||'waiter';
    const element=document.createElement('div');element.className='rk-worker';element.dataset.rkWorker=id;
    element.innerHTML=`<span class="rk-worker-body"><span class="r-cat r-cat-${character}" aria-hidden="true"></span><span class="rk-carried" hidden></span></span><span class="rk-worker-progress" hidden>${ring()}</span><span class="rk-worker-thought" hidden></span>`;
    container.querySelector('[data-rk-workers]').append(element);actors.set(id,element);return element;
  }
  function setGuide(value){
    tutorial=value;container.classList.toggle('is-tutorial',value);
    for(const element of container.querySelectorAll('[data-r-kitchen-zone]')){element.setAttribute('aria-hidden',String(!value));element.tabIndex=value?0:-1;}
    container.querySelector('[data-r-kitchen-tutorial]').setAttribute('aria-pressed',String(value));
    const guide=root.querySelector('[data-rk-guide]');guide.hidden=!value;
    if(value){guideIndex=0;paintGuide();focus(true);}
  }
  function paintGuide(){
    root.querySelector('[data-rk-guide-text]').textContent=guidePages[guideIndex];
    root.querySelector('[data-r-kitchen-tutorial-next]').textContent=guideIndex===guidePages.length-1?'开始营业':'下一步 →';
  }
  function update(now){
    const restaurant=snapshot||getRestaurant();if(!restaurant)return;
    const view=kitchenViewModel(restaurant,selectedId,now),{model,active,worker,phase,next,step,finished,waiting,label,stationBusy}=view;
    const actions=kitchenActionPresentations(restaurant,now,model);
    if(active)selectedId=active.id;
    for(const item of model.workers){
      const element=actor(item.id),moving=['walk','delivery','return','rest-walk'].includes(item.phase);
      element.style.left=`${item.position.x}%`;element.style.top=`${item.position.y}%`;element.style.zIndex=String(10+Math.round(item.position.y));
      element.dataset.phase=item.phase;element.classList.toggle('is-moving',moving);element.classList.toggle('is-working',item.phase==='work');
      element.classList.toggle('is-back',moving&&item.to.y<item.from.y-.1||item.phase==='work'&&item.step?.zoneId===10);
      const carry=element.querySelector('.rk-carried'),carrying=item.carrying;
      if(carry.dataset.item!==String(carrying)){carry.innerHTML=carrying?propImage(carrying):'';carry.dataset.item=String(carrying);}
      carry.hidden=!carrying||!moving;
      const head=element.querySelector('.rk-worker-progress');head.hidden=!['walk','work','delivery'].includes(item.phase)||actions.some(action=>action.order.id===item.orderId&&action.running);
      if(!head.hidden){head.querySelector('.rk-ring').style.setProperty('--rk-progress',item.progress);head.querySelector('b').textContent=item.phase==='work'?`${Math.max(0,Math.ceil((item.endAt-now)/1000))}s`:'→';}
      const thought=element.querySelector('.rk-worker-thought'),awaiting=['awaiting','wait','queue'].includes(item.phase);
      thought.hidden=!awaiting;thought.textContent=item.phase==='awaiting'?'等你点下一步':item.phase==='wait'?'等工位空闲':'等待上一单';
      element.setAttribute('aria-label',`${workerName(item.id)}，${item.phase==='awaiting'?'等待玩家点击下一步':item.step?.label||phaseText(item.phase)}`);
    }
    for(const [id,element] of actors)if(!model.workers.some(worker=>worker.id===id)){element.remove();actors.delete(id);}
    for(const zone of model.zones){
      const occupant=zone.occupant,element=container.querySelector(`[data-r-kitchen-zone="${zone.id}"]`),surface=container.querySelector(`[data-rk-surface="${zone.id}"]`);
      element.classList.toggle('is-active',Boolean(occupant));element.setAttribute('aria-label',`${zone.id}号${zone.name}，${occupant?`${workerName(occupant.workerId)}操作中`:'空闲'}`);
      const working=occupant&&model.workers.find(worker=>worker.orderId===occupant.orderId),workingOrder=occupant&&model.orders.find(order=>order.id===occupant.orderId);
      const process=working?.step,id=zone.id===10?occupant?'fridge-open':'fridge-closed':process?reduced?process.prop:kitchenAnimationId(process.id,workingOrder?.recipeId):null;
      surface.hidden=zone.id!==10&&!occupant;
      const source=zone.id===10||reduced?'static':'loop',key=`${source}:${id}`;
      if(props.get(zone.id)!==key){surface.innerHTML=id?(source==='loop'?`<img class="rk-prop rk-loop" src="${animationAsset(id)}" alt="" draggable="false"/>`:propImage(id)):'';props.set(zone.id,key);}
      if(zone.id===10){
        const task=container.querySelector('[data-rk-fridge-task]'),taskId=occupant?kitchenAnimationId('gather',workingOrder?.recipeId):null;
        task.hidden=!occupant;
        if(task.dataset.asset!==String(taskId)){task.innerHTML=taskId?(reduced?propImage(process.prop):`<img class="rk-prop rk-loop" src="${animationAsset(taskId)}" alt="" draggable="false"/>`):'';task.dataset.asset=String(taskId);}
      }
    }
    for(const [id,prompt] of prompts)if(!actions.some(action=>action.order.id===id)){prompt.remove();prompts.delete(id);}
    for(const action of actions){
      let prompt=prompts.get(action.order.id);
      if(!prompt){prompt=document.createElement('div');prompt.className='rk-next-action';prompt.dataset.rkNextAction=action.order.id;container.querySelector('[data-rk-next-actions]').append(prompt);prompts.set(action.order.id,prompt);}
      if(prompt.dataset.step!==action.step.id){prompt.innerHTML=actionMarkup(action.order,action.step);prompt.dataset.step=action.step.id;}
      const button=prompt.querySelector('button'),countdown=button.querySelector('.rk-action-countdown');
      button.disabled=action.running||blocked||action.stationBusy;
      button.classList.toggle('is-running',action.running);
      button.classList.toggle('is-counting',action.counting);
      button.style.setProperty('--rk-progress',action.progress);
      countdown.hidden=!action.counting;countdown.textContent=action.counting?`${action.seconds}s`:'';
      button.querySelector('.rk-action-order').hidden=actions.length<2;
      button.querySelector('.rk-action-caption').textContent=action.moving?(action.phase==='delivery'?'送餐中':'前往中'):shortStep(action.step.id);
      const orderLabel=actions.length>1?`${action.order.seat+1}号桌，`:'';
      button.setAttribute('aria-label',orderLabel+(action.counting?`${action.step.label}，还剩 ${action.seconds} 秒`:action.moving?`${action.step.label}，员工正在前往${action.phase==='delivery'?'餐桌':'工位'}`:`${action.step.label}，点击开始${blocked||action.stationBusy?'，暂时不可操作':''}`));
      prompt.setAttribute('aria-label',action.counting?'当前工序进度':action.moving?'员工正在前往工位':action.stationBusy?'工位正在使用，等空闲后继续':'点击开始下一步');
    }
    const width=container.clientWidth||480,height=container.clientHeight||960,layoutKey=JSON.stringify([width,height,actions.map(action=>[action.order.id,action.step.id,action.step.zoneId])]);
    if(lastLayout!==layoutKey){
      lastLayout=layoutKey;
      const bounds=container.getBoundingClientRect(),obstacles=Array.from(container.querySelectorAll('.rk-focus-tools>button')).map(button=>{const r=button.getBoundingClientRect();return {left:r.left-bounds.left,right:r.right-bounds.left,top:r.top-bounds.top,bottom:r.bottom-bounds.top};});
      for(const point of layoutKitchenActions(actions,{width,height,obstacles})){const prompt=prompts.get(point.orderId);prompt.style.left=`${point.x}%`;prompt.style.top=`${point.y}%`;}
    }
    const signature=JSON.stringify([active?.id,phase,next?.id]);
    if(signature!==lastSignature){
      lastSignature=signature;
      if(phase==='awaiting-delivery'&&focused)focus(false);
      container.dispatchEvent(new CustomEvent('kitchen:step',{bubbles:true,detail:{orderId:active?.id,phase}}));
    }
    return model;
  }
  function loop(time){if(!running)return;if(time-lastFrame>(reduced?250:45)){lastFrame=time;update(Date.now());}frame=requestAnimationFrame(loop);}
  function focus(value=true){focused=value;root.classList.toggle('is-kitchen-focus',value);container.querySelector('[data-r-kitchen-focus]').textContent=value?'返回全景':'查看厨房';onFocus(value);}
  return {
    sync(restaurant,options={}){snapshot=restaurant;blocked=options.blocked===true;return update(Date.now());},
    select(orderId){selectedId=orderId;update(Date.now());},
    get selectedId(){return selectedId;},get palette(){return currentPalette;},setPalette,focus,toggleFocus(){focus(!focused);},
    toggleTutorial(){setGuide(!tutorial);},endTutorial(){setGuide(false);},
    nextTutorial(){if(guideIndex===guidePages.length-1)setGuide(false);else{guideIndex++;paintGuide();}},
    toggleZones(){setGuide(!tutorial);},
    open(){if(!running){running=true;frame=requestAnimationFrame(loop);}},close(){running=false;cancelAnimationFrame(frame);},
    destroy(){running=false;cancelAnimationFrame(frame);actors.clear();for(const prompt of prompts.values())prompt.remove();prompts.clear();},
  };
}
