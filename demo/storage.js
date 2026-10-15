export const DEMO_PREFIX = 'catnest.demo.v1.';

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
export const demoLocalStorage = namespacedStorage(browserStorage('localStorage'));
export const demoSessionStorage = namespacedStorage(browserStorage('sessionStorage'));
