import { homeStorageKey } from './home-context.js';

/** Cache, preferences, drafts and unacknowledged operations use one save scope. */
export function scopedStorage(storage,home) {
  const fallback=new Map();
  return {
    getItem(key) { const scoped=homeStorageKey(key,home);try{return storage ? storage.getItem(scoped) : fallback.get(scoped) ?? null;}catch{return fallback.get(scoped) ?? null;} },
    setItem(key,value) { const scoped=homeStorageKey(key,home);fallback.set(scoped,String(value));try{storage?.setItem(scoped,String(value));}catch{} },
    removeItem(key) { const scoped=homeStorageKey(key,home);fallback.delete(scoped);try{storage?.removeItem(scoped);}catch{} },
  };
}
