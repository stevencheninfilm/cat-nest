import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage, DEMO_PREFERENCES_PREFIX } from '../demo/storage.js';
import { loadGameGuide } from '../src/game-guide.js';
import { loadRestaurantGuide } from '../src/restaurant-guide.js';

function browserStorage(t, local, session = createMemoryStorage()) {
  for (const [name, value] of Object.entries({ localStorage: local, sessionStorage: session })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  }
}

test('returning demo visitors see both tours again without changing saved homes or old guide records', async t => {
  const raw = createMemoryStorage();
  const records = {
    'catnest.state.private-room': 'original pet progress',
    'catnest.pending.private-room.male': 'pending original actions',
    'catnest.handbook.v1.male': JSON.stringify({ version: 1, tourComplete: true }),
    'catnest.restaurant-guide.v1.male': JSON.stringify({ version: 1, step: 'welcome', phase: 'paused' }),
  };
  for (const role of ['male', 'female']) {
    records[`${DEMO_PREFERENCES_PREFIX}catnest.handbook.v1.${role}`] = JSON.stringify({ version: 1, tourStarted: true, tourComplete: true });
    records[`${DEMO_PREFERENCES_PREFIX}catnest.restaurant-guide.v1.${role}`] = JSON.stringify({ version: 1, step: 'welcome', phase: 'completed' });
  }
  for (const [key, value] of Object.entries(records)) raw.setItem(key, value);
  browserStorage(t, raw);

  const first = await import('../demo/storage.js?guide-visit=first');
  for (const role of ['male', 'female']) {
    assert.equal(loadGameGuide(first.demoPreferences, role).tourStarted, false);
    assert.equal(loadRestaurantGuide(first.demoPreferences, role).phase, 'new');
    first.demoPreferences.setItem(`catnest.handbook.v1.${role}`, JSON.stringify({ version: 1, tourStarted: true }));
    first.demoPreferences.setItem(`catnest.restaurant-guide.v1.${role}`, JSON.stringify({ version: 1, step: 'welcome', phase: 'paused' }));
    assert.equal(loadGameGuide(first.demoPreferences, role).tourStarted, true, 'dismissal lasts for this visit');
    assert.equal(loadRestaurantGuide(first.demoPreferences, role).phase, 'paused');
  }

  const reopened = await import('../demo/storage.js?guide-visit=reopened');
  for (const role of ['male', 'female']) {
    assert.equal(loadGameGuide(reopened.demoPreferences, role).tourStarted, false);
    assert.equal(loadRestaurantGuide(reopened.demoPreferences, role).phase, 'new');
  }
  for (const [key, value] of Object.entries(records)) assert.equal(raw.getItem(key), value, key);
});

test('demo guides remain available when browser storage is blocked', async t => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  browserStorage(t, blocked, blocked);
  const { demoPreferences } = await import('../demo/storage.js?guide-visit=blocked');
  assert.equal(loadGameGuide(demoPreferences, 'male').tourStarted, false);
  assert.equal(loadRestaurantGuide(demoPreferences, 'female').phase, 'new');
  assert.doesNotThrow(() => demoPreferences.setItem('catnest.handbook.v1.male', '{}'));
});
