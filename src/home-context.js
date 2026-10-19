import homes from '../config/homes.json' with { type:'json' };
import { initialState } from './state.js';

export function validateHomes(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('至少需要一个存档入口');
  const ids=new Set(),prefixes=new Set(),rooms=new Set();
  let original=0,test=0;
  for(const item of entries) {
    if(!item || !/^[a-z][a-z0-9-]{0,39}$/i.test(item.id) || ['assets','api','model','index','404','monitor'].includes(item.id.toLowerCase()) || ids.has(item.id.toLowerCase()))throw new Error('存档网址无效或重复');
    if(typeof item.label!=='string' || !item.label.trim() || !['couple','room','test'].includes(item.source))throw new Error('存档配置无效');
    if(item.title!==undefined && (typeof item.title!=='string' || !item.title.trim()))throw new Error('存档标题无效');
    if(typeof item.storagePrefix!=='string' || prefixes.has(item.storagePrefix) || (item.id==='steven' ? item.storagePrefix!=='' : item.storagePrefix!==`${item.id}:`))throw new Error('存档缓存空间无效或重复');
    if(item.source==='couple') { if(item.id!=='steven' || item.roomId!==null)throw new Error('原存档绑定不可替换'); original++; }
    else if(!/^[a-f0-9]{32}$/.test(item.roomId) || rooms.has(item.roomId))throw new Error('存档房间无效或重复');
    if(item.source==='test') { if(item.id!=='test')throw new Error('测试空间必须使用 test 入口');test++; }
    ids.add(item.id.toLowerCase());prefixes.add(item.storagePrefix);if(item.roomId)rooms.add(item.roomId);
  }
  if(original!==1 || test!==1)throw new Error('必须保留原存档和测试入口');
  return entries;
}
export const HOME_ENTRIES=Object.freeze(validateHomes(homes).map(item=>Object.freeze({...item,href:`./${item.id}/`,isTest:item.source==='test'})));
export const EVIAN_ROOM_ID=HOME_ENTRIES.find(item=>item.id==='evian').roomId;
export function homeTitle(context) {
  return context.title || (context.id==='steven' ? `${context.label} 猫猫小窝` : `${context.label} · 猫猫小窝`);
}
const main=Object.freeze({id:'main',href:'./',roomId:null,storagePrefix:''});
const unknown=Object.freeze({id:'unknown',href:'./',roomId:null,storagePrefix:null});

// Unknown URLs must never silently enter Steven's save.
export function homeContext(pathname='') {
  const path=pathname.replace(/^\/cat-nest(?=\/|$)/,'').replace(/\/index\.html$/,'/');
  if(path==='' || path==='/')return main;
  const match=/^\/([a-z][a-z0-9-]{0,39})\/?$/i.exec(path);
  return match ? HOME_ENTRIES.find(item=>item.id===match[1]) || unknown : unknown;
}
export function homeStorageKey(key,context) {
  if(typeof context?.storagePrefix!=='string')throw new Error('未知存档不能读取浏览器数据');
  return context.storagePrefix+key;
}
export function initialHomeState(context,now=Date.now()) {
  const state=initialState(now);
  return context.source==='room' ? {...state,love:0,xp:0} : state;
}
