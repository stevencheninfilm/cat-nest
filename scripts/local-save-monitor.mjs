import { HOME_ENTRIES } from '../src/home-context.js';
import { FOODS, feedingInfo, levelInfo } from '../src/state.js';
import { petNeeds } from '../src/pet-needs.js';
import { normalizeHomeBond } from '../src/home-bond.js';
import { COUPLE_ROLES } from '../src/couple-profile.js';

const API = 'https://cat-nest-api.onrender.com';
const SITE = 'https://stevencheninfilm.com/cat-nest/';
const round = value => Math.round(value * 10) / 10;

/** Only an allowlist of metrics leaves this local read-only collector. */
export function summarizeHome(home, room, now = Date.now()) {
  const state = room?.state;
  if (!state || !Number.isFinite(state.xp) || state.xp < 0 || !Number.isFinite(state.coins) || !Number.isSafeInteger(room.revision)) throw new Error('Invalid cloud snapshot');
  const pending = Array.isArray(state.pendingGrowth) ? state.pendingGrowth : [];
  const needs = petNeeds(state, now);
  const feeding = feedingInfo(state, 'partner-male', now);
  const bond = normalizeHomeBond(state.homeBond, state);
  return {
    id:home.id, label:home.label, href:`${SITE}${home.id}/`, status:'ready', sampledAt:now,
    revision:room.revision, updatedAt:Number.isSafeInteger(state.updatedAt) ? state.updatedAt : null,
    name:typeof state.name === 'string' ? state.name.slice(0,20) : '未命名',
    xp:state.xp, level:levelInfo(state.xp), coins:state.coins, love:Number.isFinite(state.love) ? state.love : 0,
    needs:{hunger:needs.hunger,mood:needs.mood,energy:needs.energy}, sleeping:state.sleeping === true,
    pending:{count:pending.length,amount:round(pending.reduce((sum,item)=>sum+(Number.isFinite(item.amount) && item.amount>0 ? item.amount : 0),0))},
    cats:Array.isArray(state.collection?.invited) ? state.collection.invited.length : 0,
    owners:COUPLE_ROLES.map(role=>({label:role.name,joined:bond.owners.some(owner=>owner.id===role.clientId)})),
    meals:COUPLE_ROLES.map(role=>{
      const record=feeding.records.find(item=>item.actorId===role.clientId);
      return {label:role.name,fed:record?.inCurrentWindow === true,food:record?.active ? FOODS[record.food]?.name || '食物' : null,expiresAt:record?.active ? record.expiresAt : null};
    }),
    attention:Object.values({hunger:needs.hunger,mood:needs.mood,energy:needs.energy}).some(value=>value<30),
  };
}

export function createMonitorService({homes=HOME_ENTRIES,fetchImpl=globalThis.fetch,now=Date.now,cacheMs=30_000,timeoutMs=8_000}={}) {
  let cached=null,inFlight=null;
  const good=new Map();
  async function getJson(url) {
    // Release manifests may be cached by the static host for an hour.
    if(url.endsWith('/version.json'))url+=`?monitor=${Math.floor(now()/30_000)}`;
    const response=await fetchImpl(url,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
    if (!response.ok) throw new Error('Cloud unavailable');
    return response.json();
  }
  async function collect() {
    const at=now();
    const rows=homes.map(async home=>{
      const base={id:home.id,label:home.label,href:`${SITE}${home.id}/`};
      if(home.isTest || home.source==='test')return {...base,status:'temporary',note:'每次访问重置，数据仅属于当前浏览器；没有统一的云端等级。'};
      try {
        const room=await getJson(home.source==='couple' ? `${API}/api/couple/home` : `${API}/api/rooms/${home.roomId}`);
        if(home.source==='room' && room.roomId!==home.roomId)throw new Error('Unexpected home');
        const row=summarizeHome(home,room,at);good.set(home.id,row);return row;
      } catch {
        const previous=good.get(home.id);
        return {...(previous || base),status:previous ? 'stale':'error',note:previous ? '云端暂不可读，显示最近一次成功快照。':'暂时无法读取云端存档，请稍后刷新。'};
      }
    });
    const healthTask=getJson(`${API}/api/health`).then(value=>({ok:value.ok===true})).catch(()=>({ok:false}));
    const versionTask=Promise.allSettled([getJson(`${SITE}version.json`),getJson(`${API}/version.json`)]).then(results=>{
      const versions=results.map(result=>result.status==='fulfilled' ? result.value : null);
      const valid=value=>typeof value?.release==='string' && /^[a-f0-9]{40}$/.test(value.release) && Array.isArray(value.entries);
      const covers=value=>valid(value) && homes.every(home=>value.entries.includes(home.id));
      return {frontend:valid(versions[0]) ? versions[0].release : null,backend:valid(versions[1]) ? versions[1].release : null,
        synced:covers(versions[0]) && covers(versions[1]) && versions[0].release===versions[1].release};
    });
    const [entries,health,version]=await Promise.all([Promise.all(rows),healthTask,versionTask]);
    return {generatedAt:at,refreshAfter:at+cacheMs,entries,health,version};
  }
  return {
    async snapshot() {
      if(cached && now()>=cached.generatedAt && now()<cached.refreshAfter)return cached;
      if(!inFlight)inFlight=collect().then(value=>(cached=value)).finally(()=>{inFlight=null;});
      return inFlight;
    },
  };
}

function localRequest(request) {
  const address=request.socket?.remoteAddress;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))return false;
  try {
    const target=new URL(`http://${request.headers.host}`);
    if(!['127.0.0.1','localhost','[::1]'].includes(target.hostname) || target.port!=='5174')return false;
    if(request.headers.origin && request.headers.origin!==target.origin)return false;
    return !request.headers['sec-fetch-site'] || request.headers['sec-fetch-site']!=='cross-site';
  } catch {return false;}
}

const html='<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>小窝观察台 · 本机监测</title></head><body><div id="monitor"></div><script type="module" src="/src/local-save-monitor.js"></script></body></html>';

export function createMonitorHandler({service=createMonitorService(),transformHtml=async value=>value}={}) {
  return async (request,response,next=()=>{})=>{
    const path=new URL(request.url,'http://localhost').pathname;
    if(!['/monitor','/monitor/','/__monitor/snapshot'].includes(path))return next();
    const send=(status,content,type='application/json; charset=utf-8')=>{
      response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'});
      response.end(request.method==='HEAD' ? undefined : typeof content==='string' ? content : JSON.stringify(content));
    };
    if(!localRequest(request))return send(403,{error:'监测后台仅限本机访问。'});
    if(!['GET','HEAD'].includes(request.method))return send(405,{error:'监测后台只支持读取。'});
    try {
      if(path==='/__monitor/snapshot')return send(200,await service.snapshot());
      return send(200,await transformHtml(html),'text/html; charset=utf-8');
    } catch {return send(503,{error:'监测暂不可用，请稍后刷新。'});}
  };
}

/** Development middleware on the existing preview; no new port or public API. */
export function localSaveMonitor() {
  return {name:'cat-nest-local-save-monitor',apply:'serve',configureServer(server){
    server.middlewares.use(createMonitorHandler({transformHtml:value=>server.transformIndexHtml('/monitor/',value)}));
  }};
}
