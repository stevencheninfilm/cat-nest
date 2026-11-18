import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestaurantGuests } from '../src/restaurant-guests-ui.js';
import { RESTAURANT_ARRIVAL_MS } from '../src/restaurant-guests.js';

test('guest animations sleep in a full seated room and resume for replay and departure', t => {
  let now = 50000, nextId = 0, replaysFinished = 0;
  const queue = new Map(), elements = [];
  t.mock.method(Date, 'now', () => now);
  const fakeGlobals = {
    document: { createElement: () => ({ style:{}, dataset:{}, setAttribute(){}, remove(){ this.removed = true; } }) },
    requestAnimationFrame: callback => { queue.set(++nextId, callback); return nextId; },
    cancelAnimationFrame: id => queue.delete(id),
  };
  for (const [key, value] of Object.entries(fakeGlobals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable:true });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  function frameAfter(ms) {
    now += ms;
    const pending = [...queue.values()];
    queue.clear();
    for (const callback of pending) callback();
  }
  const container = { closest:() => null, append:el => elements.push(el) };
  const guests = createRestaurantGuests({ container, onChange:() => replaysFinished++ });
  const parties = Array.from({length:8}, (_, table) => ({
    id:'party-' + table, table, arrivedAt:10000, seatedAt:10000,
    members:[{ cat:'tabby', seat:0 }, { cat:'tabby', seat:1 }],
  }));
  guests.start();
  guests.sync({ parties, capacity:8 });
  guests.sync({ parties:structuredClone(parties), capacity:8 });
  assert.equal(elements.length, 16);
  assert.ok(elements.every(el => el.dataset.phase === 'seated'));
  assert.equal(queue.size, 0);

  assert.equal(guests.replay(), 16);
  assert.equal(queue.size, 1);
  frameAfter(RESTAURANT_ARRIVAL_MS);
  assert.equal(queue.size, 0);
  assert.equal(replaysFinished, 1);
  guests.sync({ parties:parties.slice(1), capacity:8 });
  assert.equal(elements[0].dataset.phase, 'leaving');
  assert.equal(queue.size, 1);
  frameAfter(RESTAURANT_ARRIVAL_MS);
  assert.equal(elements.filter(el => el.removed).length, 2);
  assert.equal(queue.size, 0);
  guests.destroy();
});
