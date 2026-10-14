/** GitHub-backed authoritative rooms. Browser sees only room access keys, never a GitHub token. */
export function createCloudRoom({ apiBase, roomId, clientId, name, initialState, pending = [], onRoom, onState, onAction, onPresence, onStatus, onSaveStatus, onPending }) {
  const base = apiBase.replace(/\/$/, '');
  let room = /^[a-f0-9]{32}$/.test(roomId || '') ? roomId : null;
  let queue = [...pending];
  let revision = -1;
  let source, poll, retry, destroyed = false, draining = false, ready = false;
  const seen = new Set();
  const me = { id: clientId, name };
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 95000);
    try {
      const res = await fetch(`${base}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
      const data = await res.json();
      if (!res.ok) { const error = new Error(data.error?.message || '云端暂时没有响应'); error.status = res.status; throw error; }
      return data;
    } finally { clearTimeout(timeout); }
  }
  function apply(data) {
    if (destroyed || !data?.state || !Number.isFinite(data.revision)) return;
    if (data.revision >= revision) { revision=data.revision; onState(data.state); }
    if (data.event && !seen.has(data.event.operationId)) {
      seen.add(data.event.operationId); if (seen.size > 200) seen.delete(seen.values().next().value);
      onAction(data.event.action, data.event.actor);
    }
  }
  function saveQueue() { onPending(queue.map(item => ({ ...item }))); }
  async function drain() {
    if (draining || !ready || destroyed) return;
    draining = true;
    while (queue.length && !destroyed) {
      onSaveStatus({ phase:'saving', message:'正在保存到云端…' });
      const item=queue[0];
      try {
        const data=await request(`/api/rooms/${room}/actions`, { method:'POST', body:JSON.stringify(item) });
        if (destroyed) break;
        apply(data); queue.shift(); saveQueue();
        onSaveStatus({ phase:queue.length ? 'saving':'saved', message:queue.length ? '正在保存到云端…':'已保存到 GitHub 云端', at:Date.now() });
      } catch (error) {
        if (destroyed) break;
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          queue.shift(); saveQueue(); onSaveStatus({ phase:'error', message:error.message });
          if (queue.length) continue;
        } else {
          onSaveStatus({ phase:'error', message:'云端保存失败，将自动重试；请暂时保留本页' });
          clearTimeout(retry); retry=setTimeout(drain, 8000);
        }
        break;
      }
    }
    draining=false;
  }
  function subscribe() {
    if (destroyed) return;
    source?.close();
    source = new EventSource(`${base}/api/rooms/${room}/events?clientId=${encodeURIComponent(me.id)}&name=${encodeURIComponent(me.name)}`);
    source.addEventListener('state', event => { try { apply(JSON.parse(event.data)); } catch {} });
    source.addEventListener('action', event => { try { apply(JSON.parse(event.data)); } catch {} });
    source.addEventListener('presence', event => { try { onPresence(JSON.parse(event.data)); } catch {} });
    source.addEventListener('full', () => { ready=false; source.close(); onStatus({phase:'full',role:null,message:'这个猫窝已有两位猫友在线，请稍后再来'}); });
    source.onopen=() => { if (destroyed) return; ready=true; onStatus({phase:'online',role:'cloud',message:'已连接云端小窝，互动会自动保存到 GitHub'}); drain(); };
    source.onerror=() => { if (!destroyed) onStatus({phase:'offline',role:'cloud',message:'实时连接正在恢复，已保存的云端存档仍然保留'}); };
    clearInterval(poll); poll=setInterval(async () => { if (destroyed) return; try { apply(await request(`/api/rooms/${room}`)); } catch {} }, 20000);
  }
  async function start() {
    onStatus({phase:'connecting',role:'cloud',message:'正在唤醒云端小窝，首次连接可能需要约一分钟…'});
    onSaveStatus({phase:'loading',message:'正在读取云端存档…'});
    try {
      const data = room ? await request(`/api/rooms/${room}`) : await request('/api/rooms', {method:'POST',body:JSON.stringify({name:me.name,initialState})});
      if (destroyed) return;
      room=data.roomId; onRoom(room); apply(data);
      onSaveStatus({phase:'saved',message:'已读取 GitHub 云端存档',at:Date.now()});
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
      queue.push({operationId:crypto.randomUUID(),clientId:me.id,name:me.name,action}); saveQueue(); drain(); return true;
    },
    updateName(next) { me.name=next; if(room&&ready) subscribe(); },
    destroy() { destroyed=true; source?.close(); clearInterval(poll); clearTimeout(retry); },
  };
}
