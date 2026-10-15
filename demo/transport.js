import { createDemoEngine, DEMO_ROOM, DEMO_ACTORS } from './engine.js';
import { createDemoCourt } from './court-engine.js';

export const DEMO_ORIGIN = 'https://demo.cat-nest.invalid';
export const demoEngine = createDemoEngine();
export const demoCourt = createDemoCourt(demoEngine);
let partnerTimer;
function schedulePartner(viewerId) {
  clearTimeout(partnerTimer);
  partnerTimer=setTimeout(()=>{
    if(demoEngine.controls.offline || !demoEngine.controls.partnerOnline)return;
    demoEngine.sync();
    const moved=demoEngine.partnerGame(viewerId), match=demoEngine.snapshot().state.games?.match;
    if(moved || match?.phase==='reveal' && match.status==='active')schedulePartner(viewerId);
  },850);
}

function pause(ms, signal) {
  return new Promise((resolve,reject) => {
    if(signal?.aborted) return reject(new DOMException('Aborted','AbortError'));
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted','AbortError')); };
    const timer=setTimeout(() => { signal?.removeEventListener('abort',abort); resolve(); },ms);
    signal?.addEventListener('abort',abort,{once:true});
  });
}
function response(status,data) { return new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json'}}); }
/** Closed transport. Unknown hosts/routes never fall through to real fetch. */
export async function demoFetch(input, options={}) {
  const url=new URL(String(input),DEMO_ORIGIN);
  if (url.origin!==DEMO_ORIGIN) throw new TypeError('演示接口禁止连接正式服务器');
  const method=(options.method || 'GET').toUpperCase(), path=url.pathname;
  const mutating=method!=='GET';
  await pause(mutating ? demoEngine.controls.latency : 35,options.signal);
  if (demoEngine.controls.offline) { demoEngine.log(method,path,'offline'); throw new TypeError('演示：网络已断开'); }
  if (mutating && demoEngine.controls.rejectNext) {
    demoEngine.controls.rejectNext=false; demoEngine.log(method,path,409);
    return response(409,{error:{code:'DEMO_REJECTED',message:'演示：服务器拒绝了这次操作，已恢复原来的状态'}});
  }
  let body={};
  try { body=typeof options.body==='string' ? JSON.parse(options.body):options.body || {}; } catch { return response(400,{error:{message:'演示请求格式错误'}}); }
  demoEngine.sync();
  let result;
  if (path.startsWith('/api/court/')) result=demoCourt.request(path.slice('/api/court'.length)+url.search,method,body,options.headers);
  else if (method==='GET' && (path==='/api/couple/home' || path===`/api/rooms/${DEMO_ROOM}`)) result={data:demoEngine.snapshot()};
  else if (method==='POST' && path===`/api/rooms/${DEMO_ROOM}/actions`) { result=demoEngine.action(body); if(body.action?.type?.startsWith('game-') && result.status===200)schedulePartner(body.clientId); }
  else result={status:404,error:'此接口不属于独立演示环境'};
  const status=result.status || 200; demoEngine.log(method,path,status);
  return response(status,result.error ? {error:{code:'DEMO_ACTION_REJECTED',message:result.error}}:result.data);
}

export class DemoEventSource {
  constructor(input) {
    const url=new URL(input);
    if(url.origin!==DEMO_ORIGIN || url.pathname!==`/api/rooms/${DEMO_ROOM}/events`) throw new TypeError('演示实时连接地址无效');
    this.listeners=new Map(); this.readyState=0; this.closed=false;
    this.me=Object.values(DEMO_ACTORS).find(actor=>actor.id===url.searchParams.get('clientId')) || DEMO_ACTORS.male;
    this.stop=demoEngine.subscribe((type,data) => {
      if(this.closed)return;
      if(type==='disconnect') { this.readyState=0; this.onerror?.({type:'error'}); return; }
      if(type==='reconnect') { this.open(); return; }
      if(type==='presence-refresh') { this.emit('presence',demoEngine.roster(this.me)); return; }
      if(!demoEngine.controls.offline)this.emit(type,data);
    });
    queueMicrotask(()=>this.open());
  }
  open() {
    if(this.closed)return;
    if(demoEngine.controls.offline) { this.onerror?.({type:'error'}); return; }
    this.readyState=1; this.onopen?.({type:'open'});
    this.emit('state',demoEngine.snapshot()); this.emit('presence',demoEngine.roster(this.me));
  }
  emit(type,data) { for(const callback of this.listeners.get(type) || [])callback({type,data:JSON.stringify(data)}); }
  addEventListener(type,callback) { if(!this.listeners.has(type))this.listeners.set(type,new Set()); this.listeners.get(type).add(callback); }
  close() { this.closed=true; this.readyState=2; this.stop(); }
}
