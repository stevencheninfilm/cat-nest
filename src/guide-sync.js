// Guide metadata has its own durable outbox; it never uses the gameplay action queue.
const phases=['unknown','legacy','shown','paused','completed'];
export const validRemoteGuide = value => value && Number.isSafeInteger(value.generation)&&value.generation>=0&&phases.includes(value.phase);
const queueKey=role=>`catnest.guide-report.v1.${role}`;
export function createGuideSync({home,storage,fetchImpl=globalThis.fetch,apiBase='',applyRemote=()=>{},getLocal=()=>({}),onReady=()=>{},view=globalThis.window,makeId=()=>globalThis.crypto.randomUUID(),retryMs=8000}={}) {
  const visits=new Map(),draining=new Set(),timers=new Map();let destroyed=false;
  const read=role=>{try{const item=JSON.parse(storage.getItem(queueKey(role)));return validRemoteGuide(item)&&typeof item.operationId==='string'?item:null;}catch{return null;}};
  const write=(role,item)=>{try{if(item)storage.setItem(queueKey(role),JSON.stringify(item));else storage.removeItem(queueKey(role));}catch{}};
  const url=role=>`${apiBase.replace(/\/$/,'')}/api/guides/${encodeURIComponent(home)}/${role}`;
  const request=async(role,input)=>{
    const response=await fetchImpl(url(role),{method:input?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(6000),...(input?{headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})});
    if(!response.ok)throw Error('Guide sync unavailable');
    const data=await response.json();if(!validRemoteGuide(data.record))throw Error('Invalid guide record');return data;
  };
  function retry(role,task){clearTimeout(timers.get(role));const timer=setTimeout(()=>{timers.delete(role);if(!destroyed)void task();},retryMs);timer.unref?.();timers.set(role,timer);}
  async function drain(role){
    if(destroyed||draining.has(role))return;
    draining.add(role);
    try {
      let item;
      while(!destroyed&&(item=read(role))) {
        const result=await request(role,item);
        if(destroyed)return;
        if(read(role)?.operationId===item.operationId)write(role,null);
        // A reset made during play is left for the next entry, never interrupt this visit.
        // Only this exact report is removed; a newer queued report may belong to
        // the just-reset generation and must still be uploaded.
      }
    } catch {retry(role,()=>drain(role));}
    finally{draining.delete(role);}
  }
  function report({role,phase,generation=0}) {
    if(destroyed||!['male','female'].includes(role)||!phases.slice(1).includes(phase))return;
    const old=read(role);
    if(old&&old.generation===generation&&phases.indexOf(old.phase)>=phases.indexOf(phase))return;
    write(role,{generation,phase,operationId:makeId()});void drain(role);
  }
  function sync(role) {
    if(destroyed||!['male','female'].includes(role))return;
    if(visits.has(role))return;
    const visit={ready:false};visits.set(role,visit);
    void(async()=>{
      try {
        const {record}=await request(role);
        if(destroyed)return;
        const queued=read(role);
        // Preserve an unconfirmed completion on this device until its report is saved.
        if(!queued||queued.generation!==record.generation)applyRemote(record,role);
        const local=getLocal(role);
        if(record.phase==='unknown'&&local.tourStarted&&local.resetGeneration===record.generation&&!read(role))report({role,phase:'legacy',generation:record.generation});
        void drain(role);
      } catch { /* Gameplay and the local first-visit guide remain usable offline. */ }
      finally {if(!destroyed){visit.ready=true;onReady();}}
    })();
  }
  const online=()=>{for(const role of ['male','female'])if(read(role))void drain(role);};
  view?.addEventListener('online',online);
  return {sync,report,ready:role=>visits.get(role)?.ready===true,destroy(){destroyed=true;for(const timer of timers.values())clearTimeout(timer);view?.removeEventListener('online',online);}};
}
