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
  }).join('')}<div class="rk-surfaces" aria-hidden="true">${KITCHEN_ZONES.map(zone=>`<span class="rk-surface rk-surface-${zone.id}" data-rk-surface="${zone.id}" style="left:${zone.prop.x}%;top:${zone.prop.y}%;width:${zone.prop.width}%" ${zone.id===10?'':'hidden'}>${zone.id===10?propImage('fridge-closed'):''}</span>`).join('')}<span class="rk-fridge-task" data-rk-fridge-task hidden></span></div><aside class="rk-tutorial-coach" data-rk-guide hidden><div><strong>新手引导</strong><button data-r-kitchen-tutorial-close aria-label="结束厨房新手引导">结束</button></div><p data-rk-guide-text></p><button data-r-kitchen-tutorial-next>下一步 →</button></aside><div class="rk-workers" data-rk-workers></div><div class="rk-next-actions" data-rk-next-actions></div><div class="rk-focus-tools"><button data-r-kitchen-tutorial aria-pressed="false" aria-label="厨房新手引导">操作教程</button></div></div>`;
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
  }).join('')}<li class="rk-final-step"><span class="rk-step-number">↗</span><div><strong>端到客人的餐桌</strong><small>负责送餐的员工按通道返回厨房</small></div></li></ol><p class="r-fine">接下顾客的需求后，每一步都要点击对应食材圈才会开始。完成后员工会停下来等你；最后点顾客头顶的「送餐」。升级冰箱加快取料，升级料理台加快加工。</p>${!active?`<p class="r-fine">${!recipe.unlocked?(recipe.special?'先解锁这份金色招牌':`Lv.${recipe.unlockLevel} 解锁后制作`):'顾客会从已开售菜品中随机点餐。'}</p>`:'<button class="r-primary" data-r-kitchen-watch>回到餐厅继续操作</button>'}`;
}

/** Read-only selection model shared by scene and phone instructions. */
export function kitchenViewModel(restaurant,selectedId=null,now=Date.now(),model=kitchenInfo(restaurant,now)){
  const orders=model.orders;
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
  const queued=phase==='queued',running=queued||['walk','work','delivery'].includes(phase);
  const step=running?active?.currentStep:next;
  // The guest's seat button dispatches delivery. Once dispatched, the dish
  // travels with its worker until it appears at that guest's place setting.
  if(!active||!step||step.id==='delivery'||!running&&!view.waiting)return null;
  const saved=restaurant.orders.find(order=>order.id===active.id)?.workflow;
  const work=saved?.segments?.find(segment=>segment.phase==='work'&&segment.stepId===step.id);
  const counting=phase==='work',moving=running&&!counting&&!queued;
  const startAt=work?.startAt??step.startAt,endAt=work?.endAt??step.endAt;
  const progress=counting&&endAt>startAt?Math.max(0,Math.min(1,(now-startAt)/(endAt-startAt))):0;
  return {order:active,step,phase,running,counting,moving,queued,stationBusy:!running&&stationBusy,progress,seconds:counting?Math.max(0,Math.ceil((endAt-now)/1000)):null};
}

/** During connected automation only confirmed runs own an employee or a station.
 * The order controls still acknowledge a queued command immediately. */
export function kitchenSceneSource(state,confirmed,info,availability,automatic){
  if(automatic && availability.connected && !availability.retrying && confirmed?.restaurant && confirmed!==state){
    return {restaurant:confirmed.restaurant,pendingSteps:availability.pendingKitchenSteps};
  }
  return {restaurant:info.restaurant,model:info.kitchen};
}

/** Every accepted order owns its station bubble, independently of selection. */
export function kitchenActionPresentations(restaurant,now=Date.now(),model=kitchenInfo(restaurant,now)){
  return model.orders.map(order=>kitchenActionPresentation(restaurant,orderViewModel(model,order),now)).filter(Boolean).sort((a,b)=>(a.order.acceptedAt??0)-(b.order.acceptedAt??0)||a.order.seat-b.order.seat||a.order.id.localeCompare(b.order.id));
}

/** Keep station queues in acceptance order: add to the left, then wrap upward.
 * A whole row clears controls together instead of splitting a short queue into
 * several rows while there is still horizontal space. Touch targets stay 44px. */
export function layoutKitchenActions(actions,{width=480,height=960,obstacles=[],previous=new Map()}={}){
  width=Math.max(60,width);height=Math.max(80,height);
  const placed=[],points=new Map(),groups=new Map();
  const intersects=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
  const box=(x,y)=>({left:x-28,right:x+28,top:y-30,bottom:y+40});
  for(const action of actions){
    const key=action.step.zoneId??`table:${action.order.seat}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(action);
    const saved=previous.get(action.order.id);
    if(!saved)continue;
    const x=saved.x*width/100,y=saved.y*height/100,bounds=box(x,y);
    if(x<28||x>width-28||y<29||y>height-39||[...placed,...obstacles].some(other=>intersects(bounds,other)))continue;
    placed.push(bounds);
    points.set(action.order.id,{orderId:action.order.id,x:saved.x,y:saved.y});
  }
  const pinned=points.size;
  for(const group of groups.values()){
    const first=group[0],zone=KITCHEN_ZONES.find(zone=>zone.id===first.step.zoneId),table=KITCHEN_TABLE_POSITIONS[first.order.seat];
    const anchor=zone?{x:zone.prop.x,y:zone.id===10?60.3:zone.prop.y-6}:{x:table.x,y:table.y-4.4};
    let right=Math.max(29,Math.min(width-29,anchor.x*width/100)),y=Math.max(30,Math.min(height-40,anchor.y*height/100)),index=0;
    while(index<group.length){
      const columns=Math.min(group.length-index,Math.floor((right-29)/58)+1),xs=Array.from({length:columns},(_,i)=>right-i*58);
      // Existing targets stay under the same finger as other dishes change.
      const fresh=xs.filter((_,offset)=>!points.has(group[index+offset].order.id));
      const blockers=[...placed,...obstacles].filter(rect=>fresh.some(x=>x+28>rect.left&&x-28<rect.right));
      const clear=row=>blockers.every(rect=>row+40<=rect.top||row-30>=rect.bottom);
      if(!clear(y)){
        const above=blockers.map(rect=>rect.top-42).filter(row=>row>=30&&row<y&&clear(row));
        const below=blockers.map(rect=>rect.bottom+32).filter(row=>row<=height-40&&row>y&&clear(row));
        // A kitchen station blocked by a table should open towards the kitchen.
        const atTable=zone&&blockers.some(rect=>rect.ticket&&y+40>rect.top&&y-30<rect.bottom);
        if(below.length&&(atTable||!above.length))y=Math.min(...below);
        else if(above.length)y=Math.max(...above);
        else {
          // On short screens an entire column can be occupied. Seat and
          // station edges are the only places where a free interval begins.
          const occupied=[...placed,...obstacles],anchor=xs[0];
          const xsToTry=[29,width-29,...occupied.flatMap(r=>[r.left-30,r.right+30])];
          const ysToTry=[y,30,height-40,...occupied.flatMap(r=>[r.top-42,r.bottom+32])];
          let closest=null,distance=Infinity;
          for(const row of ysToTry)for(const col of xsToTry){
            const dx=col-anchor,cost=dx*dx+(row-y)**2;
            if(row<30||row>height-40||cost>=distance||xs.some(x=>x+dx<28||x+dx>width-28))continue;
            if(fresh.some(x=>occupied.some(r=>intersects(box(x+dx,row),r))))continue;
            closest={dx,row};distance=cost;
          }
          if(closest){
            for(let i=0;i<xs.length;i++)xs[i]+=closest.dx;
            y=closest.row;
          }else if(pinned)return layoutKitchenActions(actions,{width,height,obstacles});
        }
      }
      for(const x of xs){
        const id=group[index++].order.id;
        if(points.has(id))continue;
        placed.push(box(x,y));points.set(id,{orderId:id,x:x/width*100,y:y/height*100});
      }
      right=width-29;y=Math.max(30,y-72);
    }
  }
  return actions.map(action=>points.get(action.order.id));
}
function stationKey(action, compact) {
  const zone=action.step.zoneId;
  if(!compact)return zone?'station:'+zone:'table:'+action.order.seat;
  // A very short phone cannot fit a separate pager for each of ten counters
  // alongside the full dining room. Nearby counters share a paged control.
  if(!zone)return 'area:送餐';
  if(zone<=2)return 'area:饮品';
  if(zone<=5)return 'area:热厨';
  return 'area:备菜';
}

/** Busy stations have a single paged control. Small queues keep the individual circles. */
export function kitchenPromptGroups(actions,choices=new Map(),compact=false){
  const atStation=new Map();
  for(const action of actions){
    const key=stationKey(action,compact);
    if(!atStation.has(key))atStation.set(key,[]);
    atStation.get(key).push(action);
  }
  const groups=[];
  for(const [key,items] of atStation){
    if(actions.length<5 && items.length>1){
      for(const selected of items)groups.push({key:`order:${selected.order.id}`,items:[selected],selected});
    }else{
      const selected=items.find(item=>item.order.id===choices.get(key))??items.find(item=>item.counting)??items[0];
      groups.push({key,items,selected});
    }
  }
  return groups;
}

/** Only phase boundaries require projecting every order and employee again. */
export function nextKitchenBoundary(restaurant,now){
  let next=Infinity;
  function include(at){if(at>now&&at<next)next=at;}
  for(const order of restaurant.orders){
    const flow=order.workflow;
    if(!flow)continue;
    include(flow.createdAt);
    // Saved segments are in chronological order, including future reservations.
    const segment=flow.segments.find(item=>item.phase!=='rest-walk'&&item.endAt>now);
    if(segment){include(segment.startAt);include(segment.endAt);}
  }
  for(const record of Object.values(restaurant.staffTraining??{})){
    if(!record.rest)continue;
    include(record.rest.fullAt);
    const segment=record.rest.segments.find(item=>item.endAt>now);
    if(segment){include(segment.startAt);include(segment.endAt);}
  }
  return next;
}

const positionTransform=point=>`translate3d(${point.x}cqw,${point.y}cqh,0) translate(-50%,-93.75%)`;

const guidePages=[
  '① 先回到餐桌，点击顾客头上的点餐需求。这里只记下订单，员工还不会自行开工。',
  '② 接单后，冰箱上方会出现食材圈。点一下，员工才会去拿食材；走到工位后开始倒计时，蓝色圆环显示加工进度。',
  '③ 每一步结束后都会停下来。继续点洗菜、打蛋、切肉等下一处气泡；同一个工位同时只能一位员工操作。',
  '④ 装盘完成后，点顾客头顶的「送餐」把菜送出。客人用餐后再收小鱼干，同时获得成长。',
];

/** A frame only paints saved runs. It never submits a cooking action. */
export function createKitchenScene({container,getRestaurant,palette='cream'}){
  let snapshot=null,selectedId=null,running=false,lastSignature='',lastLayout='',tutorial=false,guideIndex=0,blocked=false;
  let timer=0,nextBoundary=Infinity,clocks=[],groups=[],currentPalette=null,pendingSteps=[];
  const actors=new Map(),props=new Map(),prompts=new Map(),choices=new Map(),root=container.closest('.restaurant');
  const workerLayer=container.querySelector('[data-rk-workers]'),actionLayer=container.querySelector('[data-rk-next-actions]');
  const stations=new Map(KITCHEN_ZONES.map(zone=>[zone.id,{
    element:container.querySelector(`[data-r-kitchen-zone="${zone.id}"]`),surface:container.querySelector(`[data-rk-surface="${zone.id}"]`),
  }]));
  const fridgeTask=container.querySelector('[data-rk-fridge-task]'),guideButton=container.querySelector('[data-r-kitchen-tutorial]');
  function setPalette(id){
    const next=kitchenCirclePalette(id).id;if(currentPalette===next)return;
    currentPalette=next;container.dataset.rkPalette=next;container.style.cssText=kitchenCircleStyle(next);
  }
  setPalette(palette);
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  function actor(id){
    if(actors.has(id))return actors.get(id);
    const index=Math.max(0,Number(String(id).match(/\d+$/)?.[0]??1)-1),character=index===0?'chef':RESTAURANT_STAFF[index-1]?.sprite||'waiter';
    const element=document.createElement('div');element.className='rk-worker';element.dataset.rkWorker=id;
    element.innerHTML=`<span class="rk-worker-body"><span class="r-cat r-cat-${character}" aria-hidden="true"></span><span class="rk-carried" hidden></span></span><span class="rk-worker-progress" hidden>${ring()}</span><span class="rk-worker-thought" hidden></span>`;
    const record={element,carry:element.querySelector('.rk-carried'),head:element.querySelector('.rk-worker-progress'),thought:element.querySelector('.rk-worker-thought')};
    workerLayer.append(element);actors.set(id,record);return record;
  }
  function positionWorker(record,item,moving,now){
    const {element}=record,end=moving?item.endAt:null,destination=moving?item.to:item.position;
    const transform=positionTransform(destination);
    const key=[item.phase,moving?item.startAt:0,end,transform,moving?positionTransform(item.from):''].join('|');
    if(record.motion===key)return;
    record.motion=key;
    // The saved kitchen route begins and ends in the aisle. Join the idle
    // formation on that same patch of floor without jumping to the aisle origin.
    let from=item.from,start=item.startAt,finish=end;
    const leavingIdle=moving&&record.phase==='idle'&&now-start<250;
    const settling=item.phase==='idle'&&record.phase==='return'&&record.leg&&now-record.leg.end<250;
    if(leavingIdle||settling){
      const previous=record.leg;
      const t=previous&&previous.end>previous.start?Math.min(1,Math.max(0,(now-previous.start)/(previous.end-previous.start))):1;
      from=previous?{x:previous.from.x+t*(previous.to.x-previous.from.x),y:previous.from.y+t*(previous.to.y-previous.from.y)}:record.destination;
      start=now;if(settling)finish=now+360;
    }
    record.phase=item.phase;record.destination=destination;record.leg=null;
    record.walk?.cancel();element.style.transform=transform;
    if(finish>now){
      record.leg={from,to:destination,start,end:finish};
      const duration=finish-start;
      record.walk=element.animate([{transform:positionTransform(from)},{transform}],{
        duration,delay:Math.min(0,start-now),easing:reduced?`steps(${Math.max(1,Math.ceil(duration/250))},end)`:'linear',
      });
    }
  }
  let layoutWidth=0,layoutHeight=0;
  function fitPrompts(){
    if(!running||!groups.length)return;
    const bounds=container.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    const localRect=element=>{
      const r=element.getBoundingClientRect();
      return {left:r.left-bounds.left,right:r.right-bounds.left,top:r.top-bounds.top,bottom:r.bottom-bounds.top};
    };
    const obstacles=[localRect(guideButton)];
    for(const seat of container.closest('.r-stage')?.querySelectorAll('.rg-order-seat')??[]){
      const target=localRect(seat);
      // The queue switch extends above the circle; keep it clear as well.
      obstacles.push({...target,top:target.top-5,bottom:target.bottom+10,ticket:true});
    }
    const actions=groups.map(({selected})=>selected);
    const previous=new Map();
    if(layoutWidth===bounds.width&&layoutHeight===bounds.height){
      for(const {key,selected} of groups){
        const record=prompts.get(key),station=selected.step.zoneId??`table:${selected.order.seat}`;
        if(record.station===station)previous.set(selected.order.id,record.point);
      }
    }
    layoutWidth=bounds.width;layoutHeight=bounds.height;
    for(const [index,point] of layoutKitchenActions(actions,{width:bounds.width,height:bounds.height,obstacles,previous}).entries()){
      const {key,selected}=groups[index],record=prompts.get(key);
      record.point=point;record.station=selected.step.zoneId??`table:${selected.order.seat}`;
      record.element.style.left=`${point.x}%`;record.element.style.top=`${point.y}%`;
    }
  }
  let compactStations=false;
  const resize=new ResizeObserver(entries=>{
    const scene=entries.find(entry=>entry.target===container);
    const compact=scene ? scene.contentRect.width>0 && scene.contentRect.width<265 : compactStations;
    if(compact!==compactStations){
      compactStations=compact;
      if(running)update(Date.now());
    }
    fitPrompts();
  });
  function schedule(now){
    clearTimeout(timer);
    if(!running||document.hidden)return;
    let wake=nextBoundary;
    for(const clock of clocks){
      const seconds=Math.max(0,Math.ceil((clock.end-now)/1000)),label=`${seconds}s`;
      if(clock.counter.textContent!==label)clock.counter.textContent=label;
      if(clock.button)clock.button.setAttribute('aria-label',`${clock.label}，还剩 ${seconds} 秒`);
      if(seconds)wake=Math.min(wake,clock.end-(seconds-1)*1000);
    }
    if(Number.isFinite(wake))timer=setTimeout(()=>{
      const time=Date.now();
      if(time>=nextBoundary)update(time);else schedule(time);
    },Math.max(1,Math.min(2147483647,wake-Date.now())));
  }
  function progressClock(host,fill,counter,start,end,now,length,extra={}){
    const key=`${start}/${end}`;
    if(host.progressKey!==key){
      host.progressKey=key;host.fill?.cancel();
      host.fill=fill.animate([{strokeDashoffset:String(length)},{strokeDashoffset:'0'}],{
        duration:end-start,delay:Math.min(0,start-now),easing:'linear',fill:'forwards',
      });
    }
    clocks.push({counter,end,...extra});
  }
  function setGuide(value){
    tutorial=value;container.classList.toggle('is-tutorial',value);
    for(const element of container.querySelectorAll('[data-r-kitchen-zone]')){element.setAttribute('aria-hidden',String(!value));element.tabIndex=value?0:-1;}
    container.querySelector('[data-r-kitchen-tutorial]').setAttribute('aria-pressed',String(value));
    const guide=root.querySelector('[data-rk-guide]');guide.hidden=!value;
    if(value){guideIndex=0;paintGuide();}
  }
  function paintGuide(){
    root.querySelector('[data-rk-guide-text]').textContent=guidePages[guideIndex];
    root.querySelector('[data-r-kitchen-tutorial-next]').textContent=guideIndex===guidePages.length-1?'开始营业':'下一步 →';
  }
  function update(now,model){
    const restaurant=snapshot||getRestaurant();if(!restaurant||!running||document.hidden)return;
    const view=kitchenViewModel(restaurant,selectedId,now,model);
    const {active,phase,next}=view;
    model=view.model;
    const actions=kitchenActionPresentations(restaurant,now,model);
    nextBoundary=nextKitchenBoundary(restaurant,now);
    clocks=[];
    if(active)selectedId=active.id;
    for(const item of model.workers){
      const record=actor(item.id),{element,carry,head,thought}=record,moving=['walk','delivery','return','rest-walk'].includes(item.phase);
      positionWorker(record,item,moving,now);
      const depth=String(10+Math.round(item.position.y));
      if(element.style.zIndex!==depth)element.style.zIndex=depth;
      const back=moving&&item.to.y<item.from.y-.1||item.phase==='work'&&item.step?.zoneId===10;
      const showHead=item.step?.id!=='delivery'&&['walk','work'].includes(item.phase)&&!actions.some(action=>action.order.id===item.orderId&&action.running);
      const showThought=['awaiting','wait','queue'].includes(item.phase)&&actions.length<5;
      const state=[item.phase,back,item.step?.label,item.carrying,showHead,showThought].join('|');
      if(record.state!==state){
        record.state=state;element.dataset.phase=item.phase;
        element.classList.toggle('is-moving',moving);element.classList.toggle('is-working',item.phase==='work');element.classList.toggle('is-back',back);
        if(carry.dataset.item!==String(item.carrying)){carry.innerHTML=item.carrying?propImage(item.carrying):'';carry.dataset.item=String(item.carrying);}
        carry.hidden=!item.carrying||!moving;head.hidden=!showHead;
        thought.hidden=!showThought;
        thought.textContent=item.phase==='awaiting'?'等你点下一步':item.phase==='wait'?'等工位空闲':'等待上一单';
        element.setAttribute('aria-label',`${workerName(item.id)}，${item.phase==='awaiting'?'等待玩家点击下一步':item.step?.label||phaseText(item.phase)}`);
      }
      if(showHead){
        const counter=head.querySelector('b');
        if(item.phase==='work')progressClock(record,head.querySelector('.rk-ring-fill'),counter,item.startAt,item.endAt,now,100.531);
        else{
          if(record.fill){record.fill.cancel();record.fill=null;record.progressKey=null;}
          head.querySelector('.rk-ring').style.setProperty('--rk-progress',item.progress);
          if(counter.textContent!=='→')counter.textContent='→';
        }
      }
    }
    for(const [id,record] of actors)if(!model.workers.some(worker=>worker.id===id)){record.element.remove();actors.delete(id);}
    for(const zone of model.zones){
      const occupant=zone.occupant,{element,surface}=stations.get(zone.id);
      const label=`${zone.id}号${zone.name}，${occupant?`${workerName(occupant.workerId)}操作中`:'空闲'}`;
      if(element.getAttribute('aria-label')!==label){element.setAttribute('aria-label',label);element.classList.toggle('is-active',Boolean(occupant));}
      const working=occupant&&model.workers.find(worker=>worker.orderId===occupant.orderId),workingOrder=occupant&&model.orders.find(order=>order.id===occupant.orderId);
      const process=working?.step,id=zone.id===10?occupant?'fridge-open':'fridge-closed':process?reduced?process.prop:kitchenAnimationId(process.id,workingOrder?.recipeId):null;
      const hidden=zone.id!==10&&!occupant;
      if(surface.hidden!==hidden)surface.hidden=hidden;
      const source=zone.id===10||reduced?'static':'loop',key=`${source}:${id}`;
      if(props.get(zone.id)!==key){surface.innerHTML=id?(source==='loop'?`<img class="rk-prop rk-loop" src="${animationAsset(id)}" alt="" draggable="false"/>`:propImage(id)):'';props.set(zone.id,key);}
      if(zone.id===10){
        const task=fridgeTask,taskId=occupant?kitchenAnimationId('gather',workingOrder?.recipeId):null;
        if(task.hidden!==!occupant)task.hidden=!occupant;
        if(task.dataset.asset!==String(taskId)){task.innerHTML=taskId?(reduced?propImage(process.prop):`<img class="rk-prop rk-loop" src="${animationAsset(taskId)}" alt="" draggable="false"/>`):'';task.dataset.asset=String(taskId);}
      }
    }
    groups=kitchenPromptGroups(actions,choices,compactStations);
    for(const [key,id] of choices)if(!actions.some(action=>stationKey(action,compactStations)===key&&action.order.id===id))choices.delete(key);
    // A queue can expand into individual controls at four outstanding steps.
    // Carry the displayed order's slot across that change of DOM identity.
    const retired=new Map();
    for(const [key,record] of prompts)if(!groups.some(group=>group.key===key)){
      retired.set(record.element.dataset.rkNextAction,record);
      record.element.remove();
      prompts.delete(key);
    }
    for(const {key,items,selected:action} of groups){
      let record=prompts.get(key);
      if(!record){
        const element=document.createElement('div'),switcher=document.createElement('button');
        element.className='rk-next-action';switcher.className='rk-queue-next';switcher.type='button';switcher.dataset.rkQueue=key;
        const prior=retired.get(action.order.id);
        element.append(switcher);actionLayer.append(element);
        record={element,switcher,station:prior?.station,point:prior?.point};prompts.set(key,record);
      }
      const {element,switcher}=record,grouped=items.length>1;
      if(element.dataset.rkNextAction!==action.order.id||element.dataset.step!==action.step.id){
        record.fill?.cancel();record.fill=null;record.progressKey=null;record.button?.remove();record.state=null;
        element.insertAdjacentHTML('afterbegin',actionMarkup(action.order,action.step));
        record.button=element.firstElementChild;record.counter=record.button.querySelector('.rk-action-countdown');
        element.dataset.rkNextAction=action.order.id;element.dataset.step=action.step.id;
      }
      const dispatched=!action.running&&pendingSteps.includes(`${action.order.id}:${action.step.id}`);
      const index=items.indexOf(action),button=record.button,caption=dispatched?'已派工':action.queued?'排队中':action.moving?'前往中':shortStep(action.step.id);
      const disabled=action.running||dispatched||blocked||action.stationBusy;
      const party=grouped?restaurant.parties?.find(party=>party.table===action.order.seat):null;
      const seat=party?.members.length>1?['左座','右座'][party.members.findIndex(member=>member.orderId===action.order.id)]??'':'';
      const tableLabel=`${action.order.seat+1}桌${seat}`;
      const orderLabel=actions.length>1?`${action.order.seat+1}号桌${seat}，`:'';
      const state=[action.phase,action.step.id,disabled,dispatched,actions.length>1,action.stationBusy,grouped,index,items.length,seat].join('|');
      if(record.state!==state){
        record.state=state;button.disabled=disabled;
        button.classList.toggle('is-running',action.running);button.classList.toggle('is-counting',action.counting);
        record.counter.hidden=!action.counting;
        button.querySelector('.rk-action-order').hidden=actions.length<2||grouped;
        button.querySelector('.rk-action-caption').textContent=grouped?`${tableLabel} · ${caption}`:caption;
        button.setAttribute('aria-label',orderLabel+(dispatched?`${action.step.label}，已派工，等待确认`:action.queued?`${action.step.label}，已排队，等待前序工序或员工空闲`:action.moving?`${action.step.label}，员工正在前往工位`:`${action.step.label}，点击开始${disabled?'，暂时不可操作':''}`));
        element.setAttribute('aria-label',action.queued?'已排队，等待开始':action.counting?'当前工序进度':action.moving?'员工正在前往工位':action.stationBusy?'工位正在使用，等空闲后继续':'点击开始下一步');
        switcher.hidden=!grouped;
        if(grouped){
          switcher.textContent=`${index+1}/${items.length} ›`;
          switcher.setAttribute('aria-label',`${key.startsWith('area:')?key.slice(5):zoneName(action.step.zoneId)}第 ${index+1} 份，共 ${items.length} 份，查看下一份工序`);
        }
      }
      if(action.counting){
        progressClock(record,button.querySelector('.rk-action-fill'),record.counter,action.step.startAt,action.step.endAt,now,169.646,{button,label:orderLabel+action.step.label});
      }
    }
    const layoutKey=groups.map(({key,selected})=>`${key}/${selected.step.zoneId??selected.order.seat}`).join('|');
    if(lastLayout!==layoutKey){lastLayout=layoutKey;fitPrompts();}
    const signature=JSON.stringify([active?.id,phase,next?.id]);
    if(signature!==lastSignature){
      lastSignature=signature;
      container.dispatchEvent(new CustomEvent('kitchen:step',{bubbles:true,detail:{orderId:active?.id,phase}}));
    }
    schedule(now);
    return model;
  }
  function cycle(event){
    const switcher=event.target.closest('[data-rk-queue]');if(!switcher)return;
    const group=groups.find(item=>item.key===switcher.dataset.rkQueue);if(!group||group.items.length<2)return;
    const next=group.items[(group.items.indexOf(group.selected)+1)%group.items.length];
    choices.set(group.key,next.order.id);update(Date.now());
  }
  function visibility(){
    if(document.hidden){clearTimeout(timer);return;}
    if(!running)return;
    for(const record of actors.values()){record.motion=null;record.progressKey=null;}
    for(const record of prompts.values())record.progressKey=null;
    update(Date.now());
  }
  actionLayer.addEventListener('click',cycle);
  document.addEventListener('visibilitychange',visibility);
  return {
    sync(restaurant,options={}){snapshot=restaurant;blocked=options.blocked===true;pendingSteps=options.pendingSteps??[];return update(options.now??Date.now(),options.model);},
    select(orderId){selectedId=orderId;const group=groups.find(item=>item.items.some(action=>action.order.id===orderId));if(group)choices.set(stationKey(group.selected),orderId);update(Date.now());},
    fitPrompts,
    get selectedId(){return selectedId;},get palette(){return currentPalette;},setPalette,
    toggleTutorial(){setGuide(!tutorial);},endTutorial(){setGuide(false);},
    nextTutorial(){if(guideIndex===guidePages.length-1)setGuide(false);else{guideIndex++;paintGuide();}},
    toggleZones(){setGuide(!tutorial);},
    open(){if(!running){running=true;resize.observe(container);resize.observe(guideButton);timer=setTimeout(()=>update(Date.now()),0);}},
    close(){running=false;clearTimeout(timer);resize.disconnect();},
    destroy(){running=false;clearTimeout(timer);resize.disconnect();document.removeEventListener('visibilitychange',visibility);actionLayer.removeEventListener('click',cycle);actors.clear();for(const record of prompts.values())record.element.remove();prompts.clear();},
  };
}
