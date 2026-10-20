import { restaurantResearchTestControls } from './restaurant-recipe-celebration.js';
import { restaurantTierFood, restaurantTierName, restaurantGuestTestButtons, restaurantOrderOddsMarkup } from './restaurant-order-tiers-ui.js';
import { restaurantGuestTier } from './restaurant-order-probabilities.js';
import { restaurantGuestSprite as guestSprite } from './restaurant-customer-art.js';
import { kitchenTerminalMarkup } from './restaurant-kitchen-terminal.js';
import { restaurantStaffTerminal } from './restaurant-staff-terminal.js';
import { RESTAURANT_DECORATIONS } from './restaurant-decor.js';
import { KITCHEN_CIRCLE_PALETTES } from './restaurant-circle-palettes.js';
import { RESTAURANT_TABLES, RESTAURANT_GUESTS, restaurantSeat, restaurantGuestMotion, RESTAURANT_PAIR_CHANCE } from './restaurant-guests.js';

const goldDropArt=new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/gold-v1/gold-fish.webp`,globalThis.document?.baseURI||import.meta.url).href;
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

export function restaurantGuestTables(info,{icon,food,blocked=false,replaying=[],pendingCourses=[]}={}){
  return Array.from({length:Math.max(6,info.capacity)},(_,table)=>{
    const position=RESTAURANT_TABLES[table],party=info.parties.find(party=>party.table===table);
    const base=`--tx:${position.x}%;--ty:${position.y}%`;
    if(table>=info.capacity)return `<button class="r-locked-table" style="${base}" data-r-tab="upgrades" aria-label="扩建餐厅，解锁更多餐桌">${icon('lock')}<small>扩建解锁</small></button>`;
    const extra=table>=6?`<div class="rg-added-table" style="${base}" aria-hidden="true"></div>`:'';
    if(!party)return `${extra}<span class="rg-empty-table" style="${base}">${table+1} 号 · 空桌</span>`;
    if(party.status==='arriving'||replaying.includes(party.id))return `${extra}<span class="rg-arrival-label" style="${base}" data-r-party="${party.id}"><i></i>${party.members.length} 位客人正在入座</span>`;
    return extra+`<span class="rg-table-number" style="${base}">${table+1} 号${party.members.length===2?' · 双人桌':''}</span>`+party.members.map(member=>{
      const seat=restaurantSeat(table,member.seat),order=member.order,status=order?.status||'paid';
      const tier=order?.guestTier??member.service?.tier,course=order?.course??member.service?.round,rounds=order?.courses??member.service?.rounds,waiting=Boolean(order?.hasNextCourse&&pendingCourses.includes(order.id));
      const dish=id=>restaurantTierFood(id,tier,food,order?.recipeLevel);
      const action=waiting?null:status==='requested'?'kitchen-accept':status==='dish-ready'?'kitchen-step':status==='ready'?'serve':status==='collectible'?'collect':null;
      const selectable=['awaiting','preparing'].includes(status)&&[2,3,4].includes(order?.workflow?.version);
      const kitchen=info.kitchen?.orders.find(item=>item.id===order?.id);
      const text={requested:'想吃这份',awaiting:'继续制作',cooking:'制作中',preparing:'厨房忙碌中','dish-ready':'送餐啦',ready:'送餐啦',delivering:'正在送餐',dining:'好好吃喵',paid:'已结账'}[status];
      const label=waiting?`${table+1}号桌${member.seat===0?'左':'右'}座，正在看菜单，思考第二道餐中，请稍候`:action==='kitchen-accept'?`接单 · ${order.recipe.name}`:action==='kitchen-step'||action==='serve'?`送餐 · ${order.recipe.name}`:action==='collect'?`收取 ${order.rewardCoins} 小鱼干和 ${order.rewardXp} 点成长${order.hasNextCourse?'，吃完第一餐，再点第二餐':''}${order.rewardGuestGold?`，额外 ${order.rewardGuestGold} 金鱼干`:''}`:selectable?`查看${order.recipe.name}，${kitchen?.currentStep?.label||text}`:`${table+1}号桌${member.seat===0?'左':'右'}座 · ${status==='paid'?'等待伙伴':text}`;
      let content;
      if(status==='paid')content='<span><strong>已结账 ♡</strong><small>等伙伴一起回家</small></span>';
      else if(waiting)content=`<span class="rg-menu-icon" aria-hidden="true">${icon('book')}</span><span><strong>正在看菜单…</strong><small>思考第二道餐中</small></span>`;
      else if(status==='collectible'&&tier)content=`${dish(order.recipe.id)}<span><strong>${order.hasNextCourse?'再点一道':`+${order.rewardCoins}`}</strong><small>${order.hasNextCourse?`第 1 餐吃完 · 收 ${order.rewardCoins}`:'收小鱼干'}</small>${order.rewardGuestGold?`<em class="rg-bonus-gold" data-r-gold-drop="${order.rewardGuestGold}"><img src="${goldDropArt}" alt="" draggable="false"/>额外 +${order.rewardGuestGold} 金鱼干</em>`:''}</span>`;
      else if(status==='collectible')content=`<span class="r-collect-fish">${icon('fish')}</span><strong>+${order.rewardCoins}</strong><small>收小鱼干</small>`;
      else content=`${dish(order.recipe.id)}<span><strong>${text}</strong><small data-r-countdown="${order.id}">${status==='requested'?'点击记下点餐需求':kitchen&&['awaiting','preparing'].includes(status)?esc(kitchen.currentStep.label):status==='cooking'?`${Math.ceil(order.remainingMs/1000)}秒`:['ready','dish-ready'].includes(status)?'点击端到餐桌':status==='delivering'?'员工端餐过来啦':'用餐中…'}</small></span>`;
      if(!waiting&&status==='collectible'&&order.rewardInspiration>0)content+=`<em class="rr-order-inspiration">💡 +${order.rewardInspiration}</em>`;
      const progress=waiting?'<span class="rg-menu-progress" role="progressbar" aria-label="思考第二道餐中" aria-valuetext="正在看菜单，请稍候"><i></i></span>':['cooking','preparing'].includes(status)?`<i class="r-order-progress" style="--progress:${order.progress}" data-r-progress="${order.id}"></i>`:'';
      return `<div class="r-table-guest rg-order-seat is-${status}${waiting?' is-course-thinking':''}" data-r-seat="${member.seat}"${tier?` data-r-guest-tier="${tier}"`:""} style="--tx:${seat.x}%;--ty:${seat.y}%" data-r-order="${order?.id||member.orderId}"><button class="r-order-bubble" ${action?`data-r-action="${action}" data-r-order-id="${order.id}"${action==='kitchen-step'?' data-r-step="delivery"':''}`:selectable?`data-r-kitchen-select="${order.id}"`:''} ${(!action&&!selectable)||blocked||waiting?'disabled':''} ${waiting?'aria-busy="true" ':''}aria-label="${esc(label)}">${tier?`<em class="rg-course-tag">${restaurantTierName(tier)} · ${waiting?'第二餐':`${course}/${rounds} 餐`}</em>`:""}${content}${progress}</button></div>${status==='dining'?`<span class="rg-dining-food" style="--tx:${position.x+(member.seat===0?-4.2:4.2)}%;--ty:${position.y}%">${dish(order.recipe.id)}</span>`:''}`;
    }).join('');
  }).join('');
}

export function restaurantTerminalPanel(info,{auto=true,logs=[],icon,unlockDecorations=false,staffTesting=false}={}){
  const autoLabel=`自然来客${auto?'已开启，点击暂停':'已暂停，点击恢复'}`;
  return `<div class="rg-terminal-actions" role="group" aria-label="来客控制"><button data-r-debug-arrive="1" aria-label="来一位顾客" title="来一位顾客">${icon('cat')}<span>+1</span></button><button data-r-debug-arrive="2" aria-label="来两位顾客，同桌两座两份菜" title="两位顾客，同桌两座">${icon('cat')}<span>+2</span></button><button data-r-debug-arrive="random" aria-label="随机来一桌" title="随机来一桌，${Math.round(RESTAURANT_PAIR_CHANCE*100)}% 概率双人">${icon('spark')}<span>随机</span></button><button data-r-debug-auto aria-pressed="${auto}" aria-label="${autoLabel}" title="${autoLabel}">${icon(auto?'pause':'play')}<span>${auto?'暂停':'继续'}</span></button><button data-r-debug-reset aria-label="重置餐厅顾客和订单" title="清空顾客和订单，暂停自然来客，等待选择单菜测试" ${!staffTesting?'disabled':''}>${icon('clock')}<span>重置</span></button></div><div class="rg-debug-stats" aria-label="餐厅状态"><span>桌 <b>${info.capacity-info.availableTables}/${info.capacity}</b></span><span>客 <b>${info.guestCount}</b></span><span>单 <b>${info.orders.length}</b></span></div>${kitchenTerminalMarkup(info)}${restaurantStaffTerminal(info,{enabled:staffTesting})}${unlockDecorations?`<button class="rd-terminal-unlock" data-r-debug-unlock-decor>解锁全部装扮 · ${RESTAURANT_DECORATIONS.length} 套场景 + 高级装扮 + ${KITCHEN_CIRCLE_PALETTES.length} 款配色</button>`:''}${staffTesting?`<button class="rd-terminal-unlock" data-r-debug-unlock-staff>解锁全部员工 · ${info.progression.catalog.filter(item=>item.kind==='staff'&&item.id!=='chef').length} 位伙伴</button><button class="rd-terminal-unlock" data-r-debug-unlock-recipes>解锁全部菜谱 · ${info.progression.catalog.filter(item=>item.kind==='recipe').length} 道料理</button>`:''}${restaurantGuestTestButtons({enabled:staffTesting})}${restaurantOrderOddsMarkup(info)}${restaurantResearchTestControls(staffTesting)}${restaurantCustomerCatalog(info)}<button class="rg-terminal-guide" data-r-tab="help">玩法与教材 →</button><details class="rg-terminal-details"><summary>详情<span>${auto?'自动来客中':'自动已暂停'}</span></summary><div class="rg-debug-parties">${info.parties.length?info.parties.map(party=>`<p><b>${party.table+1}号桌 · ${party.members.length}位 · ${party.status==='arriving'?'入座中':'已入座'}</b><span>${party.members.map(member=>`${catNames[member.cat]}：${member.order?esc(member.order.recipe.name):'已结账'}`).join(' / ')}</span></p>`).join(''):'<p>暂无顾客</p>'}</div><ol class="rg-debug-log" aria-label="最近操作">${logs.length?logs.slice(-4).reverse().map(log=>`<li><time>${esc(log.time)}</time><span>${esc(log.text)}</span></li>`).join(''):'<li>等待操作</li>'}</ol></details>`;
}

/** Actor nodes survive order/state redraws, so saving never restarts a walk. */
export function createRestaurantGuests({container,onChange=()=>{}}){
  const actors=new Map();let running=false,frame=0;
  const removeEntryForeground=createEntryForeground(container);
  const reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  function paint(now=Date.now()){
    for(const [key,actor] of actors){
      const motion=restaurantGuestMotion(actor.party,actor.seat,now,{replayAt:actor.replayAt,departAt:actor.departAt,reducedMotion:reducedMotion(),layoutCapacity:actor.layoutCapacity});
      if(motion.phase==='gone'){actor.element.remove();actors.delete(key);continue;}
      const element=actor.element;
      element.style.left=`${motion.x}%`;element.style.top=`${motion.y}%`;
      element.style.zIndex=String(20+Math.round(motion.y*10));
      element.dataset.facing=motion.facing;
      if(element.dataset.phase!==motion.phase){element.dataset.phase=motion.phase;element.setAttribute('aria-label',`${catNames[actor.cat]}，${actor.party.table+1}号桌${actor.seat===0?'左':'右'}座，${{arriving:'进店中',seated:'已入座',leaving:'正在离店'}[motion.phase]}`);}
      if(actor.replayAt!==null&&motion.phase==='seated'){actor.replayAt=null;onChange();}
    }
  }
  function tick(){if(!running)return;if(!document.hidden)paint();frame=requestAnimationFrame(tick);}
  function sync(info){
    const live=new Set();
    for(const party of info.parties)for(const member of party.members){
      const key=`${party.id}:${member.seat}`;live.add(key);
      let actor=actors.get(key);
      if(!actor){const element=document.createElement('span');element.className='rg-guest-actor';element.dataset.guest=key;element.dataset.rGuestTier=restaurantGuestTier(member.cat);element.setAttribute('role','img');element.innerHTML=`<span class="rg-entry-aura" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></span><span class="rg-facing">${guestSprite(member.cat)}</span>`;container.append(element);actor={element,party,seat:member.seat,cat:member.cat,layoutCapacity:info.capacity,replayAt:null,departAt:null};actors.set(key,actor);}
      actor.party=party;actor.departAt=null;
    }
    for(const [key,actor] of actors)if(!live.has(key)&&actor.departAt===null){actor.departAt=Date.now();actor.replayAt=null;}
    paint();
  }
  function start(){if(running)return;running=true;paint();frame=requestAnimationFrame(tick);}
  function stop(){running=false;cancelAnimationFrame(frame);}
  return {sync,start,stop,replay(){const now=Date.now();let count=0;for(const actor of actors.values())if(actor.departAt===null){actor.replayAt=now;count++;}paint(now);return count;},replaying(){return [...new Set([...actors.values()].filter(actor=>actor.replayAt!==null).map(actor=>actor.party.id))];},destroy(){stop();removeEntryForeground();for(const actor of actors.values())actor.element.remove();actors.clear();}};
}
