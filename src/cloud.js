import { validRestaurantGuestConditions } from './restaurant-customers.js';
import { growthClaimIds } from './restaurant-income-growth.js';
import { restaurantGuestHasNextCourse } from './restaurant-guest-service.js';
import { getCoupleProfile } from './couple-profile.js';
import { duoPreviewable, previewDuoGameAction, redundantDuoTransition } from './minigames-duo-preview.js';
import { validRestaurant, restaurantUpgradeCurrentLevel } from './restaurant.js';
import { isInteractiveWorkflow, interactiveWorkerReservations } from './restaurant-kitchen-interactive.js';

// Random cards and arrival IDs still come from the server. Deterministic
// upgrades immediately project the exact target clicked and reserve its cost.
// A first-course collection allocates the next order ID, so it waits for that
// canonical receipt while unrelated kitchen commands continue to preview.
const RESTAURANT_PREVIEWS=new Set(['restaurant-kitchen-accept','restaurant-kitchen-step','restaurant-serve','restaurant-collect','restaurant-upgrade','restaurant-recipe','restaurant-train','restaurant-hire','restaurant-unlock-special','restaurant-research-fuse']);
const restaurantPreview=action=>RESTAURANT_PREVIEWS.has(action?.type);
const restaurantAction=action=>typeof action?.type==='string'&&action.type.startsWith('restaurant-');
const restaurantWorkerClocks=(state,order)=>Object.fromEntries([...new Set((order?.workflow?.runs??[]).map(run=>run.workerId??order.workflow.workerId))].filter(id=>state.restaurant.staffTraining?.[id]).map(id=>[id,structuredClone(state.restaurant.staffTraining[id])]));

/** GitHub-backed authoritative rooms. The couple home keeps one existing save. */
export function createCloudRoom(options) {
  const { apiBase, roomId, clientId, name, coupleRole, initialState, pending = [], onRoom, onState, onAction, onPresence, onStatus, onSaveStatus, onPending, optimisticReducer, onRollback = () => {} } = options;
  const storageLabel = options.storageLabel || 'GitHub 云端';
  const fetchImpl=options.fetchImpl || ((...args)=>globalThis.fetch(...args));
  const eventSourceFactory=options.eventSourceFactory || (url=>new globalThis.EventSource(url));
  const base = apiBase.replace(/\/$/, '');
  const coupleMode = Object.hasOwn(options, 'coupleRole');
  const profile = getCoupleProfile(coupleRole);
  const homeRoomId = options.homeRoomId;
  let room = /^[a-f0-9]{32}$/.test(roomId || '') ? roomId : null;
  let queue = [...pending];
  let revision = -1;
  let source, poll, retry, retryAt = 0, destroyed = false, draining = false, ready = false;
  const seen = new Set();
  const previews = new Map();
  // Confirmed local commands keep their visual clock while the authoritative
  // server clock independently gates the next POST. These overlays never become
  // confirmedState and never change the payload sent to the server.
  const restaurantTimelines = new Map();
  const liveReceipts = new Map();
  const previewTypes = new Set(['feed', 'pet', 'play', 'sleep', 'claim-growth', 'claim-restaurant-growth', 'dress', 'rename','diary-favorite','invite-cat','nest-buy','nest-place','nest-store','nest-palette','nest-upgrade']);
  let authoritativeState = null, displayedState = null;
  const me = profile ? { id: profile.clientId, name: profile.name } : { id: clientId, name };
  if(optimisticReducer)for(const item of queue)if(restaurantPreview(item.action)&&(restaurantUpgradeCurrentLevel(null,item.action)===null||item.action.expectedLevel!==undefined)||item.action?.type==='claim-restaurant-growth')previews.set(item.operationId,{at:Number.isSafeInteger(item.restaurantPreviewAt)?item.restaurantPreviewAt:Date.now(),active:true,animated:item.action?.type==='claim-restaurant-growth'});
  const outgoing=item=>restaurantAction(item.action)?{operationId:item.operationId,clientId:item.clientId,name:item.name,action:item.action}:item;
  const restaurantOrder=(state,action)=>state?.restaurant?.orders?.find(order=>order.id===action?.orderId);
  function restaurantAllocatesCourse(state,action){
    return action?.type==='restaurant-collect'&&(state?.restaurant?.parties??[]).some(party=>party.members.some(member=>member.orderId===action.orderId&&restaurantGuestHasNextCourse(member)));
  }
  function restaurantEffectPresent(state,action){
    if(action?.expectedLevel!==undefined)return restaurantUpgradeCurrentLevel(state?.restaurant,action)>=action.expectedLevel;
    if(action?.type==='restaurant-unlock-special')return state?.restaurant?.ownedSpecialRecipes?.includes(action.recipeId)??false;
    if(action?.type==='restaurant-research-fuse')return (state?.restaurant?.research?.fusion?.revision??0)>action.expectedFusion;
    const order=restaurantOrder(state,action),flow=order?.workflow;
    if(action?.type==='restaurant-kitchen-accept')return flow?.acceptedAt!=null;
    if(action?.type==='restaurant-kitchen-step')return flow?.runs?.some(run=>run.stepId===action.stepId)||false;
    if(action?.type==='restaurant-serve')return order?.servedAt!=null;
    if(action?.type==='restaurant-collect')return !order;
    return false;
  }
  function restaurantActionAt(state,action,at){
    const order=restaurantOrder(state,action),flow=order?.workflow;
    if(!order||restaurantEffectPresent(state,action))return at;
    if(action.type==='restaurant-kitchen-accept')return Math.max(at,order.createdAt);
    if(action.type==='restaurant-kitchen-step'){
      const last=flow?.runs?.at(-1);
      let readyAt=Math.max(at,flow?.acceptedAt??0,last?.endAt??0);
      // A completed local delivery can leave a short server-side return in
      // flight. Do not send a new pickup before some employee is actually free.
      if(flow?.workerId===null||last?.rest){
        const free=Array.from({length:1+(state.restaurant.staff??0)},(_,index)=>{
          const id=`worker-${index+1}`,record=state.restaurant.staffTraining?.[id];
          if(record?.energyMode==='rest-room'&&record.energy<=0&&!record.rest)return Infinity;
          const reservations=state.restaurant.orders.filter(next=>next.id!==order.id&&next.workflow).flatMap(next=>isInteractiveWorkflow(next.workflow)?interactiveWorkerReservations(next.workflow).filter(window=>window.workerId===id).map(window=>window.endAt):next.workflow.workerId===id?[next.workflow.completedAt]:[]);
          return Math.max(readyAt,record?.rest?.fullAt??0,...reservations);
        });
        // MAX_SAFE_INTEGER means ownership until another command releases
        // the worker, not a clock to wait for. Let the server settle this
        // intent instead of blocking the delivery queued behind it forever.
        const earliest=Math.min(...free);if(Number.isFinite(earliest)&&earliest<Number.MAX_SAFE_INTEGER)readyAt=earliest;
      }
      return readyAt;
    }
    if(action.type==='restaurant-serve')return Math.max(at,order.readyAt);
    if(action.type==='restaurant-collect'){
      const served=flow?.servedAt??order.servedAt??(order.staffLevel>0?order.readyAt+1500:null);
      return served===null?at:Math.max(at,served+4500);
    }
    return at;
  }
  function rememberRestaurantTimeline(item,preview,data){
    if(!restaurantPreview(item?.action))return;
    const id=item.action.orderId;
    if(item.action.type==='restaurant-collect'){restaurantTimelines.delete(id);return;}
    const local=preview?.order,actual=restaurantOrder(data.state,item.action);
    if(!local?.workflow?.runs||!actual?.workflow?.runs)return;
    restaurantTimelines.set(id,{order:structuredClone(local),training:preview.training?structuredClone(preview.training):null,workers:preview.workers?structuredClone(preview.workers):null});
  }
  function projectRestaurantTimelines(state){
    let display=state;
    for(const [id,local] of restaurantTimelines){
      const actual=display.restaurant?.orders?.find(order=>order.id===id),a=actual?.workflow,b=local.order.workflow;
      const compatible=a?.runs&&a.recipeId===b.recipeId&&a.workerId===b.workerId&&JSON.stringify(a.workerLevels)===JSON.stringify(b.workerLevels)&&a.runs.length===b.runs.length&&a.runs.every((run,index)=>run.stepId===b.runs[index].stepId&&(run.workerId??a.workerId)===(b.runs[index].workerId??b.workerId));
      if(!compatible){restaurantTimelines.delete(id);continue;}
      const next={...display.restaurant,orders:display.restaurant.orders.map(order=>order.id===id?structuredClone(local.order):order)};
      // Preserve current training levels. Only the local command's exertion
      // clock is projected; the real ledger remains in confirmedState.
      const workerClocks=local.workers??(local.training&&b.workerId?{[b.workerId]:local.training}:{});
      for(const [workerId,training] of Object.entries(workerClocks)){
        const current=next.staffTraining?.[workerId],run=a.runs.filter(run=>(run.workerId??a.workerId)===workerId).at(-1);
        // Never replace a ledger already advanced by a later job or training.
        if(!current||!run||current.energyAt>(run.rest?.arriveAt??run.endAt))continue;
        next.staffTraining={...next.staffTraining,[workerId]:{...current,energy:training.energy,energyAt:training.energyAt,...(Object.hasOwn(training,'rest')?{rest:structuredClone(training.rest),energyMode:training.energyMode}:{})}};
      }
      if(validRestaurant(next))display={...display,restaurant:next};
      else restaurantTimelines.delete(id);
    }
    return display;
  }
  function scheduleDrain(delay=8000){const wait=Math.max(1,delay);retryAt=Date.now()+wait;clearTimeout(retry);retry=setTimeout(()=>{retry=null;retryAt=0;void drain();},wait);}
  function queuedStatus(message='餐厅操作已在本机排队，连接恢复后自动保存',retrying=true){onSaveStatus({phase:'queued',message,retrying,pending:queue.length});}
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), optimisticReducer && options.method === 'POST' && path.endsWith('/actions') ? 15000 : 95000);
    try {
      const res = await fetchImpl(`${base}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
      const data = await res.json();
      if (!res.ok) { const error = new Error(data.error?.message || '云端暂时没有响应'); error.status = res.status; error.code = data.error?.code; throw error; }
      if(data?.restaurantGuestConditions!==undefined&&!validRestaurantGuestConditions(data.restaurantGuestConditions))throw new Error('来访条件确认结果不完整');
      return data;
    } finally { clearTimeout(timeout); }
  }
  function publishState(append) {
    if (!authoritativeState) return;
    if (!optimisticReducer) { onState(authoritativeState); return; }
    // Append to the already projected state on a new tap. Replaying every
    // pending action (and its whole diary) on every tap grows quadratically.
    // A new authoritative snapshot still performs the complete conflict rebase.
    if (append && append.base === displayedState) {
      displayedState=append.next;
      const pendingGames=queue.filter(item=>previews.get(item.operationId)?.active && previews.get(item.operationId)?.game).map(item=>item.action);
      onState(displayedState,{confirmedState:authoritativeState,optimistic:true,pendingGames});
      return;
    }
    let display = projectRestaurantTimelines(authoritativeState), optimistic = display!==authoritativeState,heldPurchase=false;
    const pendingGames = [];
    const withdrawn = [];
    for (const item of queue) {
      const preview = previews.get(item.operationId);
      if (!preview?.active) continue;
      // A state-only live snapshot can already contain this care operation.
      if (authoritativeState.pendingGrowth?.some(reward => reward.id === item.operationId)) continue;
      if (seen.has(item.operationId) || redundantDuoTransition(authoritativeState,item.action,me)) continue;
      const game = duoPreviewable(display,item.action),restaurant=restaurantPreview(item.action);
      preview.game=game;
      if(restaurant&&(restaurantEffectPresent(display,item.action)||restaurantAllocatesCourse(display,item.action)))continue;
      const at=restaurant?restaurantActionAt(display,item.action,preview.at):preview.at;
      const next = game ? previewDuoGameAction(display,item.action,me,at,item.operationId) : optimisticReducer(display, item.action, me, at, item.operationId);
      if (next) {
        display = next; optimistic = true;if(game)pendingGames.push(item.action);
        if(restaurant){const order=restaurantOrder(next,item.action);preview.order=order?structuredClone(order):null;preview.training=order?.workflow?.workerId?structuredClone(next.restaurant.staffTraining?.[order.workflow.workerId]):null;preview.workers=restaurantWorkerClocks(next,order);}
      }else if(restaurant&&restaurantUpgradeCurrentLevel(display.restaurant,item.action)!==null){heldPurchase=true;}
      else if(!restaurant&&item.action.type!=='claim-restaurant-growth'){preview.active = false; withdrawn.push(item);}
      // A later authoritative timestamp can temporarily make a restaurant
      // dependency unplayable. Keep its intent and preview active until its
      // own durable receipt or an explicit business refusal resolves it.
    }
    // A competing snapshot is not a refusal of this operation. Keep the local
    // purchase visible until its own receipt or explicit business rejection.
    if(heldPurchase&&displayedState){display=displayedState;optimistic=true;}
    displayedState = display;
    onState(display, { confirmedState: authoritativeState, optimistic, pendingGames });
    for (const item of withdrawn) onRollback(item.action, me, { operationId:item.operationId, reason:'conflict' });
  }
  function rollback(item, error) {
    const preview = previews.get(item.operationId);
    if (!preview?.active) return;
    preview.active = false;
    if(restaurantPreview(item.action))restaurantTimelines.delete(item.action.orderId);
    publishState();
    onRollback(item.action, me, { operationId:item.operationId, reason:'rejected', code:error.code });
  }
  function apply(data, acknowledgement) {
    if (destroyed || !data?.state || !Number.isFinite(data.revision) || data.roomId!==undefined&&data.roomId!==room) return;
    if(data.restaurantGuestConditions!==undefined&&!validRestaurantGuestConditions(data.restaurantGuestConditions))return;
    const incomingState=data.restaurantGuestConditions!==undefined&&data.state.restaurant ? {...data.state,restaurant:{...data.state.restaurant,completedGuestConditions:data.restaurantGuestConditions}} : data.state;
    const event = data.event || (optimisticReducer && acknowledgement ? { operationId:acknowledgement.operationId, action:acknowledgement.action, actor:me } : null);
    const preview = previews.get(event?.operationId || acknowledgement?.operationId);
    const previousXp = authoritativeState?.xp;
    const ownItem=acknowledgement||queue.find(item=>item.operationId===event?.operationId);
    if(ownItem&&preview)rememberRestaurantTimeline(ownItem,preview,data);
    if (event) previews.delete(event.operationId);
    if (acknowledgement) previews.delete(acknowledgement.operationId);
    // HTTP and live receipts often deliver the same confirmed revision. Keep
    // queue acknowledgement, but do not normalize and redraw that snapshot twice.
    if (data.revision === revision && event && seen.has(event.operationId) && !preview) return;
    const changed = data.revision >= revision;
    if (changed) { revision=data.revision; authoritativeState=incomingState; }
    if (changed || preview) publishState();
    if (event && !seen.has(event.operationId)) {
      seen.add(event.operationId); if (seen.size > 200) seen.delete(seen.values().next().value);
      onAction(event.action, event.actor, { operationId:event.operationId, optimistic:false, previewed:Boolean(preview?.animated), previousXp, confirmedXp:authoritativeState?.xp });
    }
    if(event)liveReceipts.get(event.operationId)?.(data);
    // A late durable receipt also releases a queue waiting for its retry timer.
    if (!draining && queue[0] && seen.has(queue[0].operationId)) {
      retryAt=0; clearTimeout(retry);retry=null; queueMicrotask(drain);
    }
  }
  function saveQueue() { onPending(queue.map(item => ({ ...item }))); }
  async function drain() {
    if (draining || !ready || destroyed) return;
    if (Date.now() < retryAt) return;
    clearTimeout(retry);retry=null;
    draining = true;
    while (queue.length && !destroyed && ready) {
      const item=queue[0];
      if (seen.has(item.operationId) || redundantDuoTransition(authoritativeState,item.action,me)) {
        previews.delete(item.operationId); queue.shift(); saveQueue(); publishState();
        onSaveStatus({phase:queue.length?'saving':'saved',message:queue.length?'正在保存到云端…':`已保存到 ${storageLabel}`,at:Date.now()});
        continue;
      }
      if(restaurantPreview(item.action)){
        const at=restaurantActionAt(authoritativeState,item.action,Date.now());
        if(at>Date.now()){queuedStatus('餐厅操作已排队，上一道工序完成后自动同步',false);scheduleDrain(at-Date.now()+25);break;}
      }
      onSaveStatus({ phase:'saving', message:'正在保存到云端…' });
      try {
        // An SSE receipt already confirms the durable write. Release the next
        // queued move immediately rather than waiting for its duplicate HTTP
        // response (which can be much slower on a phone).
        const live = new Promise(resolve=>liveReceipts.set(item.operationId,resolve));
        const data=await Promise.race([request(`/api/rooms/${room}/actions`, { method:'POST', body:JSON.stringify(outgoing(item)) }),live]);
        liveReceipts.delete(item.operationId);
        if (destroyed) break;
        if (optimisticReducer && (data?.roomId!==undefined&&data.roomId!==room||!data?.state || typeof data.state !== 'object' || Array.isArray(data.state) || !Number.isSafeInteger(data.revision) || data.revision < 0)) throw new Error('云端确认结果不完整');
        if(data?.restaurantGuestConditions!==undefined&&!validRestaurantGuestConditions(data.restaurantGuestConditions))throw new Error('来访条件确认结果不完整');
        apply(data, item); queue.shift(); saveQueue();
        onSaveStatus({ phase:queue.length ? 'saving':'saved', message:queue.length ? '正在保存到云端…':`已保存到 ${storageLabel}`, at:Date.now() });
      } catch (error) {
        liveReceipts.delete(item.operationId);
        if (destroyed) break;
        // A confirmed live receipt wins over a lost HTTP response.
        if (optimisticReducer && seen.has(item.operationId)) {
          queue.shift(); saveQueue();
          onSaveStatus({ phase:queue.length ? 'saving':'saved', message:queue.length ? '正在保存到云端…':`已保存到 ${storageLabel}`, at:Date.now() });
          continue;
        }
        const restaurant=restaurantAction(item.action);
        const refusedRestaurant=restaurant&&error.status>=400&&error.status<500&&['RESTAURANT_ACTION_REJECTED','DEMO_ACTION_REJECTED','DEMO_REJECTED','ACTION_REJECTED','INVALID_ACTION','OPERATION_CONFLICT'].includes(error.code);
        if(restaurant&&error.status===409){
          // A conflict can be an uncertain write or a delayed live receipt.
          // Read before judging it; never manufacture another operation ID.
          try{apply(await request(`/api/rooms/${room}`));}catch{}
          if(destroyed)break;
          if(seen.has(item.operationId)){queue.shift();saveQueue();publishState();continue;}
          // The other owner can claim the shared gift first. Only a canonical
          // receipt settles this race; never synthesize currency after a 409.
          if(item.action.type==='restaurant-daily-login'&&authoritativeState?.restaurant?.dailyLogin?.day>=item.action.day){
            queue.shift();saveQueue();publishState();
            onSaveStatus({phase:queue.length?'saving':'saved',message:queue.length?'正在保存到云端…':`已保存到 ${storageLabel}`,at:Date.now()});
            continue;
          }
          const at=restaurantPreview(item.action)?restaurantActionAt(authoritativeState,item.action,Date.now()):Date.now();
          if(at>Date.now()){queuedStatus('餐厅操作已排队，上一道工序完成后自动同步',false);scheduleDrain(at-Date.now()+25);break;}
        }
        if (refusedRestaurant||!restaurant&&error.status >= 400 && error.status < 500 && ![408,429].includes(error.status)&&!(item.action.type==='claim-restaurant-growth'&&error.status===425)) {
          if(error.status===409&&['game-next','game-join','game-cancel','game-arcade-ready'].includes(item.action?.type)) {
            try { apply(await request(`/api/rooms/${room}`)); } catch { /* Fall back to the latest live snapshot. */ }
            if(destroyed)break;
            if(redundantDuoTransition(authoritativeState,item.action,me)) {
              queue.shift(); previews.delete(item.operationId); saveQueue(); publishState();
              onSaveStatus({phase:queue.length?'saving':'saved',message:queue.length?'正在保存到云端…':`已保存到 ${storageLabel}`,at:Date.now()});
              continue;
            }
          }
          queue.shift(); saveQueue();
          if(duoPreviewable(authoritativeState,item.action)) {
            const gameId=item.action.type==='game-create'?item.operationId:item.action.gameId;
            queue=queue.filter(next=>{
              const dependent=next.action?.gameId===gameId||next.action?.type==='game-create'&&next.action.previousId===gameId;
              if(dependent)previews.delete(next.operationId);
              return !dependent;
            });
            saveQueue();
          }
          rollback(item, error); previews.delete(item.operationId);
          // Another device may have collected the same saved reward while our
          // live stream was interrupted. Reconcile from the cloud immediately;
          // never award XP or remove a bubble based only on the rejection.
          if ((optimisticReducer || ['claim-growth','invite-cat'].includes(item.action?.type) || item.action?.type?.startsWith('game-')) && error.status === 409) {
            try { apply(await request(`/api/rooms/${room}`)); } catch { /* The next live snapshot or poll can still reconcile it. */ }
            if (destroyed) break;
          }
          onSaveStatus({ phase:'error', message:error.message, rejected:true, action:item.action, operationId:item.operationId });
          if (queue.length) continue;
        } else {
          // An unknown upload result is not a rejection. Keep the local result
          // and original operation ID until a durable receipt or refusal arrives.
          if(restaurant&&[401,403,404].includes(error.status))onSaveStatus({phase:'error',message:'保存暂未完成，操作已保留在本机，连接恢复后会自动重试',retrying:true});
          else if(restaurant)queuedStatus();
          else if(item.action.type==='claim-restaurant-growth'&&(!error.status||[408,425,429].includes(error.status)))queuedStatus('餐厅经营经验已暂存，连接恢复后自动保存');
          else onSaveStatus({ phase:'error', message:'保存暂未确认，操作已暂存在本机，将自动重试；请勿清除浏览器数据' });
          scheduleDrain();
        }
        break;
      }
    }
    draining=false;
  }
  function subscribe() {
    if (destroyed) return;
    source?.close();
    source = eventSourceFactory(`${base}/api/rooms/${room}/events?clientId=${encodeURIComponent(me.id)}&name=${encodeURIComponent(me.name)}`);
    source.addEventListener('state', event => { try { apply(JSON.parse(event.data)); } catch {} });
    source.addEventListener('action', event => { try { apply(JSON.parse(event.data)); } catch {} });
    source.addEventListener('presence', event => { try { onPresence(JSON.parse(event.data)); } catch {} });
    source.addEventListener('full', () => { ready=false; source.close(); onStatus({phase:'full',role:null,message:'这个猫窝已有两位猫友在线，请稍后再来'}); });
    source.onopen=() => { if (destroyed) return; ready=true; retryAt=0; onStatus({phase:'online',role:'cloud',message:`已连接共同小窝，互动会自动保存到 ${storageLabel}`}); drain(); };
    source.onerror=() => { if (!destroyed) onStatus({phase:'offline',role:'cloud',message:'实时连接正在恢复，已保存的云端存档仍然保留'}); };
    clearInterval(poll); poll=setInterval(async () => { if (destroyed) return; try { apply(await request(`/api/rooms/${room}`)); } catch {} }, 20000);
  }
  async function start() {
    if (coupleMode && !profile) {
      ready=false;
      onStatus({phase:'error',role:'cloud',message:'请选择男方或女方后进入小窝'});
      onSaveStatus({phase:'error',message:'尚未选择身份，云端存档没有被修改'});
      return;
    }
    if (homeRoomId !== undefined && (!coupleMode || typeof homeRoomId !== 'string' || !/^[a-f0-9]{32}$/.test(homeRoomId))) {
      onStatus({phase:'error',role:'cloud',message:'小窝存档配置无效，请联系维护者'});
      onSaveStatus({phase:'error',message:'原存档没有被修改'});
      return;
    }
    onStatus({phase:'connecting',role:'cloud',message:'正在唤醒云端小窝，首次连接可能需要约一分钟…'});
    onSaveStatus({phase:'loading',message:`正在读取 ${storageLabel}存档…`});
    try {
      const data = coupleMode ? await request(homeRoomId ? `/api/rooms/${homeRoomId}` : '/api/couple/home') : room ? await request(`/api/rooms/${room}`) : await request('/api/rooms', {method:'POST',body:JSON.stringify({name:me.name,initialState})});
      if (destroyed) return;
      if (coupleMode && ((homeRoomId !== undefined && data?.roomId !== homeRoomId) || typeof data?.roomId !== 'string' || !/^[a-f0-9]{32}$/.test(data.roomId) || !data.state || typeof data.state !== 'object' || Array.isArray(data.state) || !Number.isSafeInteger(data.revision) || data.revision < 0)) {
        throw new Error('共同小窝存档暂不可用，原存档没有被修改');
      }
      room=data.roomId; onRoom(room); apply(data);
      onSaveStatus({phase:'saved',message:`已读取 ${storageLabel}存档`,at:Date.now()});
      ready=true; subscribe(); drain();
    } catch(error) {
      if (destroyed) return;
      ready=false; onStatus({phase:'error',role:'cloud',message:error.message || '云端连接失败，请稍后重试'});
      onSaveStatus({phase:'error',message:'未能连接云端，存档没有被清除'});
    }
  }
  return {
    start,
    dispatch(action) {
      if (!ready || destroyed || queue.length >= (restaurantAction(action)?200:20)) return false;
      const target=restaurantUpgradeCurrentLevel((displayedState||authoritativeState)?.restaurant,action);
      if(target!==null&&action.expectedLevel===undefined)action={...action,expectedLevel:target+1};
      if(['restaurant-arrive','restaurant-wait'].includes(action?.type)&&queue.some(item=>['restaurant-arrive','restaurant-wait'].includes(item.action?.type)))return false;
      const claimIds = new Set(growthClaimIds(action));
      if (claimIds.size && queue.some(item => growthClaimIds(item.action).some(id => claimIds.has(id)))) return false;
      if(action?.type==='restaurant-kitchen-accept'&&queue.some(item=>item.action?.type===action.type&&item.action.orderId===action.orderId))return false;
      if(action?.type==='restaurant-kitchen-step'&&queue.some(item=>item.action?.type===action.type&&item.action.orderId===action.orderId&&item.action.stepId===action.stepId))return false;
      if(action?.type==='restaurant-collect'&&queue.some(item=>item.action?.type==='restaurant-collect'&&item.action.orderId===action.orderId))return false;
      if(action?.type==='restaurant-daily-login'&&queue.some(item=>item.action?.type==='restaurant-daily-login'&&item.action.day===action.day))return false;
      if(action?.type==='restaurant-research-draw'&&queue.some(item=>item.action?.type==='restaurant-research-draw'&&item.action.draw===action.draw))return false;
      if(action?.type==='restaurant-research-fuse'&&queue.some(item=>item.action?.type==='restaurant-research-fuse'&&item.action.expectedFusion===action.expectedFusion))return false;
      const item = {operationId:crypto.randomUUID(),clientId:me.id,name:me.name,action};
      const at=Date.now(),previewBase=displayedState||authoritativeState;
      const restaurant=optimisticReducer&&restaurantPreview(action)&&!restaurantAllocatesCourse(previewBase,action);
      const game=optimisticReducer&&duoPreviewable(previewBase,action);
      const previewable=optimisticReducer&&(restaurant||game||previewTypes.has(action?.type));
      // Validate against all prior local actions before reserving queue space.
      const projected=previewable?(game?previewDuoGameAction:optimisticReducer)(previewBase,action,me,at,item.operationId):null;
      if(previewable&&!projected)return false;
      if(action?.type==='game-arcade-input'&&queue.some(next=>next.action?.type===action.type&&next.action.gameId===action.gameId&&next.action.seq===action.seq))return false;
      if(action?.type==='game-arcade-sync'&&queue.some(next=>next.action?.type===action.type&&next.action.gameId===action.gameId))return false;
      queue.push(item);
      if (previewable) {
        const preview={at,active:true,animated:false,game};
        if(restaurant){
          item.restaurantPreviewAt=at;
          const order=restaurantOrder(projected,action);
          Object.assign(preview,{order:order?structuredClone(order):null,training:order?.workflow?.workerId?structuredClone(projected.restaurant.staffTraining?.[order.workflow.workerId]):null,workers:restaurantWorkerClocks(projected,order)});
        }
        previews.set(item.operationId,preview);
      }
      saveQueue();
      if (previews.has(item.operationId)) {
        publishState({base:previewBase,next:projected});
        const preview = previews.get(item.operationId);
        if (preview?.active) { preview.animated=true; onAction(action, me, { operationId:item.operationId, optimistic:true, previewed:false }); }
      }
      void drain();
      return true;
    },
    get ready() { return ready && !destroyed; },
    isReady:()=>Boolean(ready&&authoritativeState&&room&&!destroyed),
    getPendingActions:()=>structuredClone(queue),
    retryPending(){if(!ready||destroyed)return false;clearTimeout(retry);retry=null;retryAt=0;void drain();return true;},
    updateName(next) { if (coupleMode) return; me.name=next; if(room&&ready) subscribe(); },
    destroy() { destroyed=true; source?.close(); clearInterval(poll); clearTimeout(retry); },
  };
}
