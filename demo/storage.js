export const DEMO_PREFIX = 'catnest.demo.v1.';
export const DEMO_PREFERENCES_PREFIX = 'catnest.demo.ui.v1.';

// Each document receives new maps. Refreshing or reopening cannot resume play.
export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
  };
}

export function clearLegacyDemoProgress(storage) {
  try {
    const keys = [];
    for (let index=0;index<storage.length;index++) {
      const key=storage.key(index);
      if (key?.startsWith(DEMO_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch { /* Storage may be blocked; progress never depends on it. */ }
}

// Explicit adapters: never replace the browser's global Storage object.
export function namespacedStorage(storage, prefix = DEMO_PREFIX) {
  const fallback = new Map();
  return {
    getItem(key) { try { return storage?.getItem(prefix + key) ?? fallback.get(key) ?? null; } catch { return fallback.get(key) ?? null; } },
    setItem(key, value) { fallback.set(key, String(value)); try { storage?.setItem(prefix + key, String(value)); } catch {} },
    removeItem(key) { fallback.delete(key); try { storage?.removeItem(prefix + key); } catch {} },
  };
}
function browserStorage(name) { try { return globalThis[name]; } catch { return null; } }
const local = browserStorage('localStorage'), session = browserStorage('sessionStorage');
// Keep only the already-read guide preference, separately from all play data.
export const demoPreferences = namespacedStorage(local, DEMO_PREFERENCES_PREFIX);
try {
  if (local?.getItem(`${DEMO_PREFIX}onboarding.welcome.v1`)==='done') demoPreferences.setItem('welcome','done');
} catch {}
clearLegacyDemoProgress(local);
clearLegacyDemoProgress(session);
export const demoLocalStorage = createMemoryStorage();
export const demoSessionStorage = createMemoryStorage();
