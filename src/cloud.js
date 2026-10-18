import { getCoupleProfile } from './couple-profile.js';
import { duoPreviewable, previewDuoGameAction, redundantDuoTransition } from './minigames-duo-preview.js';

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
  const liveReceipts = new Map();
  const previewTypes = new Set(['feed', 'pet', 'play', 'sleep', 'claim-growth', 'dress', 'rename','diary-favorite','invite-cat','nest-buy','nest-place','nest-store','nest-palette','nest-upgrade']);
  let authoritativeState = null, displayedState = null;
  const me = profile ? { id: profile.clientId, name: profile.name } : { id: clientId, name };
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), optimisticReducer && options.method === 'POST' && path.endsWith('/actions') ? 15000 : 95000);
    try {
      const res = await fetchImpl(`${base}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
      const data = await res.json();
      if (!res.ok) { const error = new Error(data.error?.message || '云端暂时没有响应'); error.status = res.status; error.code = data.error?.code; throw error; }
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
    let display = authoritativeState, optimistic = false;
    const pendingGames = [];
    const withdrawn = [];
    for (const item of queue) {
      const preview = previews.get(item.operationId);
      if (!preview?.active) continue;
      // A state-only live snapshot can already contain this care operation.
      if (authoritativeState.pendingGrowth?.some(reward => reward.id === item.operationId)) continue;
      if (seen.has(item.operationId) || redundantDuoTransition(authoritativeState,item.action,me)) continue;
      const game = duoPreviewable(display,item.action);
      preview.game=game;
      const next = game ? previewDuoGameAction(display,item.action,me,preview.at,item.operationId) : optimisticReducer(display, item.action, me, preview.at, item.operationId);
      if (next) { display = next; optimistic = true; if(game)pendingGames.push(item.action); }
      else { preview.active = false; withdrawn.push(item); }
    }
    displayedState = display;
    onState(display, { confirmedState: authoritativeState, optimistic, pendingGames });
    for (const item of withdrawn) onRollback(item.action, me, { operationId:item.operationId, reason:'conflict' });
  }
  function rollback(item, error) {
    const preview = previews.get(item.operationId);
    if (!preview?.active) return;
    preview.active = false;
    publishState();
    onRollback(item.action, me, { operationId:item.operationId, reason:'rejected', code:error.code });
  }
  function apply(data, acknowledgement) {
    if (destroyed || !data?.state || !Number.isFinite(data.revision)) return;
    const event = data.event || (optimisticReducer && acknowledgement ? { operationId:acknowledgement.operationId, action:acknowledgement.action, actor:me } : null);
    const preview = previews.get(event?.operationId || acknowledgement?.operationId);
    const previousXp = authoritativeState?.xp;
    if (event) previews.delete(event.operationId);
    if (acknowledgement) previews.delete(acknowledgement.operationId);
    // HTTP and live receipts often deliver the same confirmed revision. Keep
    // queue acknowledgement, but do not normalize and redraw that snapshot twice.
    if (data.revision === revision && event && seen.has(event.operationId) && !preview) return;
    const changed = data.revision >= revision;
    if (changed) { revision=data.revision; authoritativeState=data.state; }
    if (changed || preview) publishState();
    if (event && !seen.has(event.operationId)) {
      seen.add(event.operationId); if (seen.size > 200) seen.delete(seen.values().next().value);
      onAction(event.action, event.actor, { operationId:event.operationId, optimistic:false, previewed:Boolean(preview?.animated), previousXp, confirmedXp:authoritativeState?.xp });
    }
    if(event)liveReceipts.get(event.operationId)?.(data);
    // A late durable receipt also releases a queue waiting for its retry timer.
    if (!draining && queue[0] && seen.has(queue[0].operationId)) {
      retryAt=0; clearTimeout(retry); queueMicrotask(drain);
    }
  }
  function saveQueue() { onPending(queue.map(item => ({ ...item }))); }
  async function drain() {
    if (draining || !ready || destroyed) return;
    if (Date.now() < retryAt) return;
    clearTimeout(retry);
    draining = true;
    while (queue.length && !destroyed) {
      const item=queue[0];
      if (seen.has(item.operationId) || redundantDuoTransition(authoritativeState,item.action,me)) {
        previews.delete(item.operationId); queue.shift(); saveQueue(); publishState();
        onSaveStatus({phase:queue.length?'saving':'saved',message:queue.length?'正在保存到云端…':`已保存到 ${storageLabel}`,at:Date.now()});
        continue;
      }
      onSaveStatus({ phase:'saving', message:'正在保存到云端…' });
      try {
        // An SSE receipt already confirms the durable write. Release the next
        // queued move immediately rather than waiting for its duplicate HTTP
        // response (which can be much slower on a phone).
        const live = new Promise(resolve=>liveReceipts.set(item.operationId,resolve));
        const data=await Promise.race([request(`/api/rooms/${room}/actions`, { method:'POST', body:JSON.stringify(item) }),live]);
        liveReceipts.delete(item.operationId);
        if (destroyed) break;
        if (optimisticReducer && (!data?.state || typeof data.state !== 'object' || Array.isArray(data.state) || !Number.isSafeInteger(data.revision) || data.revision < 0)) throw new Error('云端确认结果不完整');
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
        if (error.status >= 400 && error.status < 500 && ![408,429].includes(error.status)) {
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
          onSaveStatus({ phase:'error', message:error.message });
          if (queue.length) continue;
        } else {
          // An unknown upload result is not a rejection. Keep the local result
          // and original operation ID until a durable receipt or refusal arrives.
          onSaveStatus({ phase:'error', message:'保存暂未确认，操作已暂存在本机，将自动重试；请勿清除浏览器数据' });
          retryAt=Date.now()+8000;
          clearTimeout(retry); retry=setTimeout(()=>{retryAt=0;void drain();}, 8000);
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
      if (!ready || destroyed || queue.length >= 20) return false;
      if (action?.type === 'claim-growth' && queue.some(item => item.action?.type === 'claim-growth' && item.action.rewardId === action.rewardId)) return false;
      const item = {operationId:crypto.randomUUID(),clientId:me.id,name:me.name,action};
      const game=optimisticReducer&&duoPreviewable(displayedState||authoritativeState,action);
      const at=Date.now(), previewable=optimisticReducer&&(game||previewTypes.has(action?.type));
      const previewBase=displayedState||authoritativeState;
      // Validate against every preceding local choice before reserving queue
      // space. Cooldowns, balances and reward IDs still prevent repeated taps.
      const projected=previewable ? (game ? previewDuoGameAction : optimisticReducer)(previewBase,action,me,at,item.operationId) : null;
      if(previewable&&!projected)return false;
      if(action?.type==='game-arcade-input'&&queue.some(next=>next.action?.type===action.type&&next.action.gameId===action.gameId&&next.action.seq===action.seq))return false;
      if(action?.type==='game-arcade-sync'&&queue.some(next=>next.action?.type===action.type&&next.action.gameId===action.gameId))return false;
      queue.push(item);
      if (previewable) previews.set(item.operationId, { at, active:true, animated:false, game });
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
    updateName(next) { if (coupleMode) return; me.name=next; if(room&&ready) subscribe(); },
    destroy() { destroyed=true; source?.close(); clearInterval(poll); clearTimeout(retry); },
  };
}
