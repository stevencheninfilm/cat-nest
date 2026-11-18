import { isInteractiveWorkflow } from './restaurant-kitchen-interactive.js';
import { restaurantResearchTestControls } from './restaurant-recipe-celebration.js';
import { restaurantTierFood, restaurantTierName, restaurantGuestTestButtons, restaurantOrderOddsMarkup } from './restaurant-order-tiers-ui.js';
import { restaurantGuestTier } from './restaurant-order-probabilities.js';
import { restaurantGuestSprite as guestSprite } from './restaurant-customer-art.js';
import { kitchenTerminalMarkup } from './restaurant-kitchen-terminal.js';
import { restaurantMaxLevelTerminal, restaurantStaffTerminal } from './restaurant-staff-terminal.js';
import { RESTAURANT_DECORATIONS } from './restaurant-decor.js';
import { KITCHEN_CIRCLE_PALETTES } from './restaurant-circle-palettes.js';
import { RESTAURANT_TABLES, RESTAURANT_GUESTS, restaurantGuestMotion, RESTAURANT_PAIR_CHANCE } from './restaurant-guests.js';

const catNames=Object.fromEntries(RESTAURANT_GUESTS.map(guest=>[guest.id,guest.name]));
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function restaurantCustomerCatalog(info){
  const book=info?.customerBook;
  return `<details class="rg-customer-catalog"><summary>顾客图鉴<span>${book?`${book.seen} / `:''}${RESTAURANT_GUESTS.length} 种</span></summary><p>高级猫友需满足全部来访条件。点击图鉴查看还差什么。</p><button class="rc-open-book" data-r-tab="customers">打开完整图鉴 →</button><ul>${RESTAURANT_GUESTS.map(guest=>`<li>${guestSprite(guest.id)}<span>${guest.name}${guest.advanced?' ✦':''}</span></li>`).join('')}</ul></details>`;
}

/** Reuse the active scene's two entrance walls, leaving the doorway open.
 * The sign follows them in DOM order, while tables keep their background layer. */
function createEntryForeground(container){
  const stage=container.closest('.r-stage'),scene=stage?.querySelector('.r-scene-art');
  if(!scene)return ()=>{};
  const sign=stage.querySelector('.r-shop-sign');
  const walls=['left','right'].map(side=>{
    const wall=scene.cloneNode(false);
    wall.classList.add('rg-entry-wall',`rg-entry-wall-${side}`);
    wall.alt='';wall.setAttribute('aria-hidden','true');
    stage.insertBefore(wall,sign);return wall;
  });
  const observer=new MutationObserver(()=>{for(const wall of walls)wall.src=scene.src;});
  observer.observe(scene,{attributes:true,attributeFilter:['src']});
  return ()=>{observer.disconnect();for(const wall of walls)wall.remove();};
}

// Interactive delivery may finish locally while its last station commands are
// still uploading. Each table can settle as soon as its own delivery is saved.
export function unconfirmedRestaurantDeliveries(displayed, confirmed, connected) {
  if (!connected || displayed === confirmed) return [];
  return displayed.orders.filter(({id,workflow}) => {
    if (!isInteractiveWorkflow(workflow) || workflow.servedAt == null) return false;
    const saved = confirmed?.orders.find(order => order.id === id);
    const deliveredAt = isInteractiveWorkflow(saved?.workflow) ? saved.workflow.servedAt : saved?.servedAt ?? saved?.workflow?.servedAt;
    return deliveredAt == null;
  }).map(order => order.id);
}

export function restaurantGuestTables(info, options) {
  return Array.from({length:Math.max(6,info.capacity)}, (_,table) =>
    restaurantGuestTable(info, table, options)).join('');
}

const ticketStatus = {
  requested:'想吃这份', awaiting:'等待厨师继续制作', preparing:'厨师制作中', cooking:'制作中',
  'dish-ready':'送餐啦', ready:'送餐啦', delivering:'正在送餐', dining:'用餐中', paid:'已结账',
};
const ticketCaption = {
  requested:'接单', awaiting:'待制作', preparing:'制作中', cooking:'制作中',
  'dish-ready':'送餐', ready:'送餐', delivering:'送餐中', dining:'用餐中', paid:'已结账',
};

export function restaurantGuestTable(info, table, {icon,food,blocked=false,replaying=[],pendingCourses=[],pendingAccepts=[],pendingDeliveries=[]}={}) {
  const position=RESTAURANT_TABLES[table];
  const party=info.parties.find(party=>party.table===table);
  const base=`data-r-table="${table}" style="--tx:${position.x}%;--ty:${position.y}%"`;
  if(table>=info.capacity)return `<button class="r-locked-table" ${base} data-r-tab="upgrades" aria-label="扩建餐厅，解锁更多餐桌">${icon('lock')}<small>扩建解锁</small></button>`;
  const extra=table>=6?`<div class="rg-added-table" ${base} aria-hidden="true"></div>`:'';
  if(!party)return `${extra}<span class="rg-empty-table" ${base}>${table+1} 号 · 空桌</span>`;
  if(party.status==='arriving'||replaying.includes(party.id))return `${extra}<span class="rg-arrival-label" ${base} data-r-party="${party.id}"><i></i>${party.members.length} 位客人正在入座</span>`;

  const signature=info.supperClub?.active?.signature;
  // In the eight-table room the outside pairs sit slightly outboard of their
  // tabletop centres, leaving the centre table its own two touch targets.
  const lane=info.capacity>6 && table<6 ? (table%2===0?20:80) : position.x;
  const tickets=party.members.map(member=>{
    const order=member.order;
    const pendingDelivery=order?.status==='collectible' && pendingDeliveries.includes(order.id) && !pendingCourses.includes(order.id);
    const status=pendingDelivery?'delivering':order?.status||'paid';
    const tier=order?.guestTier??member.service?.tier;
    const course=order?.course??member.service?.round, rounds=order?.courses??member.service?.rounds;
    const collecting=Boolean(status==='collectible' && pendingCourses.includes(order.id));
    const waiting=collecting && order.hasNextCourse;
    const acceptPending=pendingAccepts.includes(order?.id) && ['requested','awaiting','preparing'].includes(status);
    const action=collecting||acceptPending&&status==='requested'?null:status==='requested'?'kitchen-accept':status==='dish-ready'?'kitchen-step':status==='ready'?'serve':status==='collectible'?'collect':null;
    const selectable=['awaiting','preparing'].includes(status) && [2,3,4].includes(order?.workflow?.version);
    const dish=id=>restaurantTierFood(id,tier,food,order?.recipeLevel);
    const location=`${table+1}号桌${member.seat===0?'左':'右'}座`;
    const label=acceptPending?`${order.recipe.name}，本机已接单，待同步${status==='preparing'?'，厨师制作中':''}`:collecting&&!waiting?`${location}，正在收款…这笔小鱼干已记下`:waiting?`${location}，正在看菜单…思考第二道餐中，请稍候`:action==='kitchen-accept'?`接单 · ${order.recipe.name}`:action==='kitchen-step'||action==='serve'?`送餐 · ${order.recipe.name}`:action==='collect'?`收取 ${order.rewardCoins} 小鱼干和 ${order.rewardXp} 点成长${order.hasNextCourse?'，吃完第一餐，再点第二餐':''}${order.rewardGuestGold?`，额外 ${order.rewardGuestGold} 金鱼干`:''}`:order?`${order.recipe.name}，${ticketStatus[status]}`:`${location}，已结账，等待伙伴`;
    const stamp=!collecting && signature && !signature.completed && signature.dishes.some(dish=>dish.id===order?.recipe.id && !signature.collected.includes(dish.id));
    const description=[location,order?.recipe.name,tier&&`${restaurantTierName(tier)} · ${course}/${rounds} 餐`,ticketStatus[status],stamp&&'结账可为招牌菜单集章'].filter(Boolean).join(' · ');
    const disabled=(!action&&!selectable)||blocked||collecting;
    const command=action?`data-r-action="${action}" data-r-order-id="${order.id}"${action==='kitchen-step'?' data-r-step="delivery"':''}`:selectable?`data-r-kitchen-select="${order.id}"`:'';
    let content;
    if(waiting)content='<strong>看菜单</strong><span class="rg-menu-progress" role="progressbar" aria-label="思考第二道餐中" aria-valuetext="正在看菜单，请稍候"><i></i></span>';
    else if(collecting)content='<strong>收款中</strong>';
    else if(status==='collectible')content=`<span class="r-collect-fish">${icon('fish')}</span><strong>${order.rewardCoins<1000?`+${order.rewardCoins}`:'收款'}</strong>`;
    else if(acceptPending)content='<strong>已接单</strong><span class="rg-accept-sync-note">待同步</span>';
    else if(action)content=`${dish(order.recipe.id)}<strong>${ticketCaption[status]}</strong>`;
    else content=`<strong>${ticketCaption[status]}</strong>${status==='cooking'?`<span data-r-countdown="${order.id}"></span>`:''}`;
    if(['cooking','preparing'].includes(status))content+=`<i class="r-order-progress" data-r-progress="${order.id}"></i>`;
    const classes=`rg-order-seat is-${status}${waiting?' is-course-thinking':''}${acceptPending?' is-accept-pending':''}`;
    const button=`<button class="r-order-bubble" ${command} ${disabled?'disabled':''} ${collecting||pendingDelivery?'aria-busy="true" ':''}aria-label="${esc(label)}${stamp?'，结账可为招牌菜单集章':''}" title="${esc(description)}"><span class="rg-ticket-face">${content}${tier&&!collecting?`<em class="rg-ticket-course" aria-hidden="true">${course}/${rounds}</em>`:''}${stamp?'<em class="rs-order-stamp" aria-hidden="true">集章</em>':''}</span></button>`;
    const item=`<div class="r-table-guest ${classes}" data-r-table="${table}" data-r-seat="${member.seat}"${party.members.length===1?' data-r-single':''}${tier?` data-r-guest-tier="${tier}"`:''} style="--tx:${lane}%;--ty:${position.y}%" data-r-order="${order?.id||member.orderId}">${button}</div>`;
    if(status!=='dining')return item;
    return item+`<span class="rg-dining-food" data-r-table="${table}" style="--tx:${position.x+(member.seat===0?-4.2:4.2)}%;--ty:${position.y}%">${dish(order.recipe.id)}</span>`;
  }).join('');
  return extra+`<span class="rg-table-number" ${base}>${table+1} 号</span>`+tickets;
}

/** Order prompts redraw as the clock and server receipts advance. Keep transient
 * feedback outside that subtree, and play each entry or confirmation only once. */
export function createRestaurantGuestFeedback(container) {
  const doc = container.ownerDocument;
  const view = doc.defaultView;
  const preference = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const records = new Map();
  let announcement = null;

  const isVisible = () => !container.hidden && !doc.hidden && !container.querySelector('dialog[open]');
  function sync(orders, pendingAccepts = []) {
    if (!announcement?.isConnected) {
      const stage = container.querySelector('.r-stage');
      if (stage) {
        announcement = doc.createElement('div');
        announcement.className = 'rg-order-announcement';
        announcement.setAttribute('role', 'status');
        stage.append(announcement);
      }
    }
    const rows = new Map(Array.from(container.querySelectorAll('.rg-order-seat[data-r-order]'), row => [row.dataset.rOrder, row]));
    const orderIds = new Set(orders.map(order => order.id));
    const visible = isVisible();
    const canAnimate = visible && !preference?.matches;
    for (const id of records.keys()) if (!orderIds.has(id)) records.delete(id);
    for (const order of orders) {
      const last = records.get(order.id);
      const previous = last?.createdAt === order.createdAt ? last : null;
      const row = rows.get(order.id);
      const button = row?.querySelector('button');
      const acceptPending = pendingAccepts.includes(order.id);
      const firstRequest = button && order.status === 'requested' && !acceptPending && !previous?.requested;
      const ready = button && ['dish-ready', 'ready'].includes(order.status);
      const justReady = ready && previous && !previous.ready;
      const detail = `${order.table+1}号桌${order.seat===0?'左':'右'}座 · ${order.recipe.name}`;
      records.set(order.id, {
        createdAt:order.createdAt,
        detail,
        accepted:Number.isSafeInteger(order.workflow?.acceptedAt),
        requested:Boolean(firstRequest || previous?.requested || button && acceptPending),
        acceptPending,
        ready:Boolean(ready || previous?.ready),
        confirmed:previous?.confirmed === true,
        button,
      });
      if (announcement && button && visible) {
        if (acceptPending && !previous?.acceptPending) announcement.textContent = `${detail}本机已接单，待同步`;
        if (previous?.acceptPending && !acceptPending && order.status === 'requested') announcement.textContent = `${detail}接单未完成，可以重新接单`;
      }
      if (!canAnimate || !button?.animate) continue;
      if (firstRequest || justReady) button.animate(
        [{opacity:.65},{opacity:1}], {duration:160, easing:'ease-out'});

    }
  }

  function confirm(orderId) {
    const order = records.get(orderId);
    if (!order?.accepted || !order.requested || order.confirmed) return;
    order.confirmed = true;
    if (!order.button?.isConnected || !isVisible()) return;
    if (!preference?.matches) order.button.animate?.([{opacity:.65},{opacity:1}], {duration:160});
    if (announcement) announcement.textContent = `${order.detail}已接单，等待厨房制作`;
  }

  function reset() {
    records.clear();
    if (announcement) announcement.textContent = '';
  }

  return {sync, confirm, reset, destroy() {
    reset();
    announcement?.remove();
  }};
}

export function restaurantTerminalPanel(info,{auto=true,logs=[],icon,unlockDecorations=false,staffTesting=false}={}){
  const autoLabel=`自然来客${auto?'已开启，点击暂停':'已暂停，点击恢复'}`;
  return `<div class="rg-terminal-actions" role="group" aria-label="来客控制"><button data-r-debug-arrive="1" aria-label="来一位顾客" title="来一位顾客">${icon('cat')}<span>+1</span></button><button data-r-debug-arrive="2" aria-label="来两位顾客，同桌两座两份菜" title="两位顾客，同桌两座">${icon('cat')}<span>+2</span></button><button data-r-debug-arrive="random" aria-label="随机来一桌" title="随机来一桌，${Math.round(RESTAURANT_PAIR_CHANCE*100)}% 概率双人">${icon('spark')}<span>随机</span></button><button data-r-debug-auto aria-pressed="${auto}" aria-label="${autoLabel}" title="${autoLabel}">${icon(auto?'pause':'play')}<span>${auto?'暂停':'继续'}</span></button><button data-r-debug-reset aria-label="重置餐厅顾客和订单" title="清空顾客和订单，暂停自然来客，等待选择单菜测试" ${!staffTesting?'disabled':''}>${icon('clock')}<span>重置</span></button></div><div class="rg-debug-stats" aria-label="餐厅状态"><span>桌 <b>${info.capacity-info.availableTables}/${info.capacity}</b></span><span>客 <b>${info.guestCount}</b></span><span>单 <b>${info.orders.length}</b></span></div>${restaurantMaxLevelTerminal(info,{enabled:staffTesting})}${kitchenTerminalMarkup(info)}${restaurantStaffTerminal(info,{enabled:staffTesting})}${unlockDecorations?`<button class="rd-terminal-unlock" data-r-debug-unlock-decor>解锁全部装扮 · ${RESTAURANT_DECORATIONS.length} 套场景 + 高级装扮 + ${KITCHEN_CIRCLE_PALETTES.length} 款配色</button>`:''}${staffTesting?`<button class="rd-terminal-unlock" data-r-debug-unlock-staff>解锁全部员工 · ${info.progression.catalog.filter(item=>item.kind==='staff'&&item.id!=='chef').length} 位伙伴</button><button class="rd-terminal-unlock" data-r-debug-unlock-recipes>解锁全部菜谱 · ${info.progression.catalog.filter(item=>item.kind==='recipe').length} 道料理</button>`:''}${restaurantGuestTestButtons({enabled:staffTesting})}${restaurantOrderOddsMarkup(info)}${restaurantResearchTestControls(staffTesting)}${restaurantCustomerCatalog(info)}<button class="rg-terminal-guide" data-r-tab="help">玩法与教材 →</button><details class="rg-terminal-details"><summary>详情<span>${auto?'自动来客中':'自动已暂停'}</span></summary><div class="rg-debug-parties">${info.parties.length?info.parties.map(party=>`<p><b>${party.table+1}号桌 · ${party.members.length}位 · ${party.status==='arriving'?'入座中':'已入座'}</b><span>${party.members.map(member=>`${catNames[member.cat]}：${member.order?esc(member.order.recipe.name):'已结账'}`).join(' / ')}</span></p>`).join(''):'<p>暂无顾客</p>'}</div><ol class="rg-debug-log" aria-label="最近操作">${logs.length?logs.slice(-4).reverse().map(log=>`<li><time>${esc(log.time)}</time><span>${esc(log.text)}</span></li>`).join(''):'<li>等待操作</li>'}</ol></details>`;
}

/** Actor nodes survive order/state redraws, so saving never restarts a walk. */
export function createRestaurantGuests({container,onChange=()=>{}}){
  const actors=new Map();
  let running=false,frame=null;
  const removeEntryForeground=createEntryForeground(container);
  const motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  function paint(now=Date.now()){
    let moving=false,finishedReplay=false;
    for(const [key,actor] of actors){
      if(actor.settled)continue;
      const motion=restaurantGuestMotion(actor.party,actor.seat,now,{replayAt:actor.replayAt,departAt:actor.departAt,reducedMotion:motionPreference?.matches===true,layoutCapacity:actor.layoutCapacity});
      if(motion.phase==='gone'){actor.element.remove();actors.delete(key);continue;}
      const element=actor.element;
      if(actor.x!==motion.x){element.style.left=`${motion.x}%`;actor.x=motion.x;}
      if(actor.y!==motion.y){element.style.top=`${motion.y}%`;element.style.zIndex=String(20+Math.round(motion.y*10));actor.y=motion.y;}
      if(element.dataset.facing!==motion.facing)element.dataset.facing=motion.facing;
      if(element.dataset.phase!==motion.phase){element.dataset.phase=motion.phase;element.setAttribute('aria-label',`${catNames[actor.cat]}，${actor.party.table+1}号桌${actor.seat===0?'左':'右'}座，${{arriving:'进店中',seated:'已入座',leaving:'正在离店'}[motion.phase]}`);}
      actor.settled=motion.phase==='seated';
      if(!actor.settled)moving=true;
      else if(actor.replayAt!==null){actor.replayAt=null;finishedReplay=true;}
    }
    if(finishedReplay)onChange();
    if(running&&moving&&frame===null)frame=requestAnimationFrame(tick);
  }
  function tick(){frame=null;if(running)paint();}
  function sync(info){
    const live=new Set();
    for(const party of info.parties)for(const member of party.members){
      const key=`${party.id}:${member.seat}`;live.add(key);
      let actor=actors.get(key);
      if(!actor){const element=document.createElement('span');element.className='rg-guest-actor';element.dataset.guest=key;element.dataset.rGuestTier=restaurantGuestTier(member.cat);element.setAttribute('role','img');element.innerHTML=`<span class="rg-entry-aura" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></span><span class="rg-facing">${guestSprite(member.cat)}</span>`;container.append(element);actor={element,party,seat:member.seat,cat:member.cat,layoutCapacity:info.capacity,replayAt:null,departAt:null};actors.set(key,actor);}
      if(actor.departAt!==null||actor.party.table!==party.table||actor.party.arrivedAt!==party.arrivedAt||actor.party.seatedAt!==party.seatedAt)actor.settled=false;
      actor.party=party;actor.departAt=null;
    }
    for(const [key,actor] of actors)if(!live.has(key)&&actor.departAt===null){actor.departAt=Date.now();actor.replayAt=null;actor.settled=false;}
    paint();
  }
  function start(){if(running)return;running=true;paint();}
  function stop(){running=false;if(frame!==null)cancelAnimationFrame(frame);frame=null;}
  return {sync,start,stop,replay(){const now=Date.now();let count=0;for(const actor of actors.values())if(actor.departAt===null){actor.replayAt=now;actor.settled=false;count++;}paint(now);return count;},replaying(){return [...new Set([...actors.values()].filter(actor=>actor.replayAt!==null).map(actor=>actor.party.id))];},destroy(){stop();removeEntryForeground();for(const actor of actors.values())actor.element.remove();actors.clear();}};
}
