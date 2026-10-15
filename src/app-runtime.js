import { scopedStorage } from './home-storage.js';

let active;
export function createHomeRuntime({home,localStorage,sessionStorage,apiBase='',courtApiBase=apiBase,localPreview=false,fetchImpl=(...args)=>globalThis.fetch(...args),eventSourceFactory=url=>new globalThis.EventSource(url),testAdapter}={}) {
  if(!home || ['main','unknown'].includes(home.id))throw new Error('未选择有效存档');
  const isTest=home.source==='test';
  if(isTest && !testAdapter)throw new Error('测试存档必须使用隔离接口');
  if(!isTest && testAdapter)throw new Error('正式存档不能使用测试接口');
  return Object.freeze({
    home,isTest,localPreview:!isTest && localPreview,
    apiBase:isTest ? testAdapter.apiBase : apiBase,
    courtApi:`${(isTest ? testAdapter.apiBase : courtApiBase).replace(/\/$/,'')}/api/court`,
    localStorage:isTest ? testAdapter.localStorage : scopedStorage(localStorage,home),
    sessionStorage:isTest ? testAdapter.sessionStorage : scopedStorage(sessionStorage,home),
    fetch:isTest ? testAdapter.fetch : fetchImpl,
    eventSourceFactory:isTest ? testAdapter.eventSourceFactory : eventSourceFactory,
    guidePreferences:isTest ? testAdapter.guidePreferences || testAdapter.localStorage : null,
    testActions:isTest ? testAdapter.actions || null : null,
    storageLabel:isTest ? '测试存档' : localPreview ? '本地联机预览' : 'GitHub 云端',
    pendingScope:isTest ? 'test' : localPreview ? 'preview' : 'couple',
  });
}
export function setAppRuntime(runtime) { if(active)throw new Error('页面内不能切换存档');active=runtime; }
export function getAppRuntime() { if(!active)throw new Error('存档尚未初始化');return active; }
