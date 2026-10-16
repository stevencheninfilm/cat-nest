import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiaryController } from '../src/diary-controller.js';
import { initialState } from '../src/state.js';

test('growth and presence updates do not project or serialize a closed diary', t => {
  let reads = 0, writes = 0;
  const dialog = { open: false, scrollTop: 0 };
  const root = { dataset: { view: 'diary' }, closest: () => dialog, addEventListener() {}, querySelector: () => null,
    set innerHTML(value) { writes++; } };
  const state = initialState();
  const controller = createDiaryController({ root, getState() { reads++; return state; }, dispatch() { throw Error('read-only refresh must not write'); } });
  t.after(() => controller.close());
  for (let i = 0; i < 1000; i++) controller.refresh();
  assert.equal(reads, 0); assert.equal(writes, 0);
  dialog.open = true; root.dataset.view = 'growth';
  for (let i = 0; i < 1000; i++) controller.refresh();
  assert.equal(reads, 0); assert.equal(writes, 0);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { activeElement: null } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  root.dataset.view = 'diary'; controller.refresh();
  assert.ok(reads > 0); assert.equal(writes, 1, 'opening still renders the latest diary state');
});
