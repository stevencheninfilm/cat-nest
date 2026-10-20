import { normalizeCoupleCare } from './couple-care.js';
import { GAMES } from './minigames.js';

const DAY = 86_400_000, OFFSET = 8 * 60 * 60_000;
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const time = v => Number.isSafeInteger(v) && v >= 0 && v <= 8_640_000_000_000_000;
const idPattern = /^[a-zA-Z0-9_.:-]{1,240}$/;
const kinds = new Set(['adoption','anniversary','level','first','together','fun','legacy','game']);
const photos = new Set(['happy','calm','hungry','tired','sleeping']);
const firsts = new Set(['feed','pet','play','sleep','dress','rename']);
const pairs = new Set(['meal','relay','goodnight']);
const actors = new Set(['partner-male','partner-female','other']);
const name = v => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16) || '糯米' : '糯米';
export const memoryDay = at => Math.floor((at + OFFSET) / DAY);
export const validMemoryId = value => typeof value === 'string' && idPattern.test(value);
export function memoryHash(value) { let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0; }

function validEntry(e) {
  if(!plain(e) || !validMemoryId(e.id) || !kinds.has(e.kind) || !time(e.at) || e.catName!==name(e.catName) || !photos.has(e.photo))return false;
  if(Object.keys(e).some(k=>!['id','kind','at','catName','photo','actorId','occasion','level','year','variant','sourceId','text'].includes(k)))return false;
  if(e.actorId!==undefined && !actors.has(e.actorId))return false;
  if(e.kind==='adoption')return e.id==='adoption';
  if(e.kind==='anniversary')return Number.isInteger(e.year) && e.year>0 && e.year<=9999 && e.id===`anniversary:${e.year}`;
  if(e.kind==='level')return Number.isSafeInteger(e.level) && e.level>=2 && e.id===`level:${e.level}`;
  if(e.kind==='first')return firsts.has(e.occasion) && e.id===`first:${e.occasion}`;
  if(e.kind==='game')return Object.hasOwn(GAMES,e.occasion) && validMemoryId(e.sourceId) && e.id===`game:${e.sourceId}`;
  if(e.kind==='together')return pairs.has(e.occasion) && e.id===`together:${e.occasion}:${memoryDay(e.at)}`;
  if(e.kind==='fun')return Number.isInteger(e.variant) && e.variant>=0 && e.variant<12 && validMemoryId(e.sourceId) && e.id===`fun:${memoryDay(e.at)}`;
  return typeof e.text==='string' && e.text.length>0 && e.text.length<=200 && !/[\u0000-\u001f\u007f]/.test(e.text) && e.id.startsWith('legacy:');
}
// A collection card represents a theme, while the ledger keeps every occurrence.
export const MEMORY_CARD_THEME_TOTAL = 1 + firsts.size + pairs.size + Object.keys(GAMES).length + 12 + 2;
export function memoryCardThemeId(e) {
  if(['adoption','level','anniversary'].includes(e?.kind))return e.kind;
  if(e?.kind==='first' && firsts.has(e.occasion))return `first:${e.occasion}`;
  if(e?.kind==='together' && pairs.has(e.occasion))return `together:${e.occasion}`;
  if(e?.kind==='game' && Object.hasOwn(GAMES,e.occasion))return `game:${e.occasion}`;
  if(e?.kind==='fun' && Number.isInteger(e.variant) && e.variant>=0 && e.variant<12)return `fun:${e.variant}`;
  return null;
}
/** Read-only collection projection. Prefer a saved favorite, then the first occurrence. */
export function memoryCollectionCards(value,{favoritesOnly=false}={}) {
  if(value?.version!==1 || !Array.isArray(value.entries))return [];
  const favorites=new Set(Array.isArray(value.favorites)?value.favorites:[]),themes=new Map();
  for(const e of value.entries) {
    if(!validEntry(e) || favoritesOnly&&!favorites.has(e.id))continue;
    const theme=memoryCardThemeId(e);if(!theme)continue;
    const previous=themes.get(theme),star=favorites.has(e.id),previousStar=previous&&favorites.has(previous.id);
    if(!previous || star&&!previousStar || star===previousStar&&(e.at<previous.at || e.at===previous.at&&e.id<previous.id))themes.set(theme,e);
  }
  return [...themes.values()].sort((a,b)=>b.at-a.at || a.id.localeCompare(b.id));
}
/** All collection progress, including catbook goals, uses these same distinct themes. */
export function unlockedMemoryCardCount(value) { return memoryCollectionCards(value).length; }
/** Old imported moments belong with daily footprints, without deleting their saved ledger. */
export function memoryDailyFootprints(value,history=[]) {
  const recent=(Array.isArray(history)?history:[]).filter(e=>time(e?.at)&&typeof e.actor==='string'&&typeof e.text==='string').slice().sort((a,b)=>b.at-a.at).slice(0,40);
  const legacy=(Array.isArray(value?.entries)?value.entries:[]).filter(e=>validEntry(e)&&e.kind==='legacy').map(e=>({at:e.at,text:e.text,actor:e.actorId==='partner-male'?'男方':e.actorId==='partner-female'?'女方':'我们的小窝'}));
  const seen=new Set();
  return [...recent,...legacy].filter(e=>{const key=JSON.stringify([e.at,e.actor,e.text]);if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>b.at-a.at);
}
export function validMemoryJournal(value) {
  if(!plain(value) || value.version!==1 || !time(value.adoptedAt) || !Array.isArray(value.entries) || !Array.isArray(value.favorites) || Object.keys(value).some(k=>!['version','adoptedAt','entries','favorites'].includes(k)))return false;
  const ids=new Set(),favorites=new Set();
  return value.entries.every(e=>validEntry(e) && !ids.has(e.id) && ids.add(e.id))
    && value.favorites.every(id=>ids.has(id) && !favorites.has(id) && favorites.add(id));
}
const photoFor = kind => kind==='sleep' ? 'sleeping' : kind==='feed' ? 'hungry' : 'happy';
const entry = (kind,id,at,state,extra={}) => ({id,kind,at,catName:name(state?.name),photo:'happy',...extra});
export function emptyMemoryJournal(at=Date.now(),state={}) {
  return {version:1,adoptedAt:at,entries:[entry('adoption','adoption',at,state,{photo:'calm'})],favorites:[]};
}
function anniversaryTimes(adoptedAt,now) {
  const birth=new Date(adoptedAt+OFFSET),today=new Date(now+OFFSET),result=[];
  const year=birth.getUTCFullYear(),month=birth.getUTCMonth(),date=birth.getUTCDate();
  for(let y=year+1;y<=Math.min(today.getUTCFullYear(),9999);y++) {
    // February 29 is celebrated on February 28 in a non-leap year.
    const last=new Date(Date.UTC(y,month+1,0)).getUTCDate();
    const at=Date.UTC(y,month,Math.min(date,last))-OFFSET;
    if(at<=now)result.push({at,year:y-year});
  }
  return result;
}

/** Optional, permanent ledger. Old state fields are never replaced or reseeded. */
export function normalizeMemoryJournal(value,state={},now=Date.now(),adoptedAt) {
  const known=[state.updatedAt,...(state.history||[]).map(e=>e?.at),...(state.coupleCare?.records||[]).map(e=>e?.at)].filter(v=>time(v)&&v<=now);
  const start=time(state.homeBond?.adoptedAt) ? state.homeBond.adoptedAt : time(adoptedAt) ? adoptedAt : known.length ? Math.min(...known) : now;
  const next=plain(value)&&value.version===1&&time(value.adoptedAt)
    ? {version:1,adoptedAt:value.adoptedAt,entries:[],favorites:[]}
    : emptyMemoryJournal(start,state);
  const ids=new Set(next.entries.map(e=>e.id));
  for(const e of Array.isArray(value?.entries)?value.entries:[])if(validEntry(e)&&!ids.has(e.id)){next.entries.push({...e});ids.add(e.id);}
  const add=e=>{if(!ids.has(e.id)){next.entries.push(e);ids.add(e.id);}};
  add(entry('adoption','adoption',next.adoptedAt,state,{photo:'calm'}));
  // Import only known, timestamped events; never invent a date for past levels.
  if(!value || value.version!==1)for(const h of (state.history||[]).filter(h=>h&&time(h.at)&&typeof h.text==='string')) {
    const text=h.text.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200);if(!text)continue;
    add(entry('legacy',`legacy:${h.at}:${memoryHash(h.actor+text)}`,h.at,state,{photo:'calm',text,actorId:h.actor==='男方'?'partner-male':h.actor==='女方'?'partner-female':'other'}));
  }
  for(const m of normalizeCoupleCare(state.coupleCare,now).moments)add(entry('together',`together:${m.kind}:${memoryDay(m.at)}`,m.at,state,{occasion:m.kind,photo:m.kind==='goodnight'?'sleeping':'happy'}));
  for(const a of anniversaryTimes(next.adoptedAt,now))add(entry('anniversary',`anniversary:${a.year}`,a.at,state,{year:a.year}));
  next.entries.sort((a,b)=>b.at-a.at || a.id.localeCompare(b.id));
  next.favorites=[...new Set(Array.isArray(value?.favorites)?value.favorites:[])].filter(id=>ids.has(id));
  return next;
}

export function recordMemoryJournal(value,{before,after,action,actorId,now,id,levelBefore,levelAfter}) {
  const next=normalizeMemoryJournal(value,after,now);
  const ids=new Set(next.entries.map(e=>e.id));
  const add=e=>{if(!ids.has(e.id)){next.entries.unshift(e);ids.add(e.id);}};
  const actor=actors.has(actorId)?actorId:'other';
  if(firsts.has(action.type) && !(action.type==='sleep' && before.sleeping))add(entry('first',`first:${action.type}`,now,after,{occasion:action.type,photo:photoFor(action.type),actorId:actor}));
  if(['claim-growth','claim-restaurant-growth','restaurant-collect'].includes(action.type))for(let level=levelBefore+1;level<=levelAfter;level++)add(entry('level',`level:${level}`,now,after,{level}));
  const game=after.games?.match;
  if(game?.mode==='duo' && game.status==='finished' && before.games?.match?.status!=='finished')add(entry('game',`game:${game.id}`,now,after,{occasion:game.game,sourceId:game.id}));
  // One deterministic vignette per day, only after a successful care action.
  // Replayed operations and optimistic clients derive the same result.
  if(['feed','pet','play','sleep'].includes(action.type) && !(action.type==='sleep'&&before.sleeping) && validMemoryId(id) && memoryHash(id)%5===0) {
    add(entry('fun',`fun:${memoryDay(now)}`,now,after,{sourceId:id,variant:memoryHash(`story:${id}`)%12,photo:photoFor(action.type),actorId:actor}));
  }
  next.entries.sort((a,b)=>b.at-a.at || a.id.localeCompare(b.id));
  return next;
}
export function favoriteMemory(value,id,favorite) {
  if(typeof favorite!=='boolean' || !value.entries.some(e=>e.id===id))return null;
  const favorites=new Set(value.favorites);if(favorite)favorites.add(id);else favorites.delete(id);
  return {...value,favorites:[...favorites]};
}
export function memoryDays(value,now=Date.now()) { return Math.max(1,memoryDay(now)-memoryDay(value.adoptedAt)+1); }
export function nextMemoryAnniversary(value,now=Date.now()) {
  return nextMemoryAnniversaryGoal(value,now)?.days ?? null;
}
export function nextMemoryAnniversaryGoal(value,now=Date.now()) {
  const future=anniversaryTimes(value.adoptedAt,Math.min(now+366*DAY,8_640_000_000_000_000)).find(e=>e.at>now);
  return future ? {...future,days:Math.max(1,memoryDay(future.at)-memoryDay(now))} : null;
}
