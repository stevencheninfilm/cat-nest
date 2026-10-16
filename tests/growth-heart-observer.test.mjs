import test from 'node:test';
import assert from 'node:assert/strict';
import { growthArtworkChanged, visibleGrowthFallbacks, observeGrowthArtwork } from '../src/growth-heart-observer.js';

const node = (kind = 'other', nested = false) => ({ nodeType: kind === 'text' ? 3 : 1,
  matches: selector => selector === 'dialog' ? kind === 'dialog' : selector === '.nest' ? kind === 'nest' : selector.includes('growth-heart') && kind === 'heart',
  querySelector: () => nested ? {} : null,
});
const mutation = (...nodes) => ({ type: 'childList', addedNodes: nodes, removedNodes: [] });

test('speech typing, status counters and flying particles do not invalidate growth artwork', () => {
  for (let i = 0; i < 1000; i++) {
    assert.equal(growthArtworkChanged([mutation(node('text'))]), false);
    assert.equal(growthArtworkChanged([mutation(node('other'))]), false);
    assert.equal(growthArtworkChanged([{ type: 'attributes', attributeName: 'class', target: node('heart') }]), false);
  }
  assert.equal(growthArtworkChanged([mutation(node('heart'))]), true);
  assert.equal(growthArtworkChanged([mutation(node('other', true))]), true);
  assert.equal(growthArtworkChanged([{ type: 'childList', addedNodes: [], removedNodes: [node('heart')] }]), true);
  for (const record of [
    { attributeName: 'open', target: node('dialog') },
    { attributeName: 'hidden', target: node('other', true) },
    { attributeName: 'class', target: node('nest') },
  ]) assert.equal(growthArtworkChanged([{ type: 'attributes', ...record }]), true);
});

test('loaded or still-loading artwork performs zero layout reads or canvas work', () => {
  for (const complete of [false, true]) {
    let reads = 0;
    const image = { complete, naturalWidth: complete ? 512 : 0 };
    const parent = { classList: { toggle() {} }, querySelector: () => image }; image.parentElement = parent;
    const canvas = { parentElement: parent, getClientRects() { reads++; return [{}]; }, getBoundingClientRect() { reads++; return { top: 0, left: 0, bottom: 100, right: 100 }; } };
    const root = { querySelectorAll: selector => selector === '.growth-heart-art' ? [image] : [canvas] };
    for (let i = 0; i < 100; i++) assert.deepEqual(visibleGrowthFallbacks(root, { width: 390, height: 844 }), []);
    assert.equal(reads, 0);
  }
});

test('a failed image still gets a fallback only while its canvas is visible', () => {
  const image = { complete: true, naturalWidth: 0 };
  const parent = { classList: { toggle() {} }, querySelector: () => image }; image.parentElement = parent;
  const visible = { parentElement: parent, getClientRects: () => [{}], getBoundingClientRect: () => ({ top: 20, left: 10, bottom: 80, right: 90 }) };
  const hidden = { ...visible, getClientRects: () => [] };
  const offscreen = { ...visible, getBoundingClientRect: () => ({ top: 900, bottom: 980, left: 0, right: 50 }) };
  const root = { querySelectorAll: selector => selector === '.growth-heart-art' ? [image] : [visible, hidden, offscreen] };
  assert.deepEqual(visibleGrowthFallbacks(root, { width: 390, height: 844 }), [visible]);
});

function fixture() {
  const events = () => ({ listeners: new Map(), addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }, removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }, emit(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn(event); } });
  let observer, serial = 0, scans = 0, layout = true;
  const frames = new Map(), root = { ...events(), body: {}, hidden: false };
  const view = { ...events(), MutationObserver: class { constructor(callback) { observer = this; this.callback = callback; } observe() {} disconnect() { this.disconnected = true; } },
    requestAnimationFrame(fn) { const id = ++serial; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); } };
  const controller = observeGrowthArtwork({ root, view, scan() { scans++; }, needsLayout: () => layout });
  return { root, view, frames, observer, controller, scans: () => scans, layout(value) { layout = value; }, flush() { const work = [...frames.values()]; frames.clear(); for (const fn of work) fn(); } };
}

test('100 rapid claim mutations schedule one scan per frame; unrelated updates schedule none', () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) f.observer.callback([mutation(node('text'))]);
  assert.equal(f.frames.size, 0);
  for (let i = 0; i < 100; i++) f.observer.callback([mutation(node('heart'))]);
  assert.equal(f.frames.size, 1); f.flush(); assert.equal(f.scans(), 1);
  f.layout(false); for (let i = 0; i < 100; i++) f.root.emit('scroll');
  assert.equal(f.frames.size, 0);
  f.layout(true); f.view.emit('resize'); f.root.emit('scroll');
  assert.equal(f.frames.size, 1); f.flush(); assert.equal(f.scans(), 2);
  f.controller.dispose();
});

test('hidden pages and disposal cancel pending scans and detach every listener', () => {
  const f = fixture();
  f.controller.schedule(); f.root.hidden = true; f.root.emit('visibilitychange'); assert.equal(f.frames.size, 0);
  f.controller.schedule(); assert.equal(f.frames.size, 0);
  f.root.hidden = false; f.root.emit('visibilitychange'); assert.equal(f.frames.size, 1);
  f.controller.dispose(); f.flush(); assert.equal(f.scans(), 0); assert.equal(f.observer.disconnected, true);
  f.controller.schedule(); assert.equal(f.frames.size, 0);
  for (const owner of [f.root, f.view]) for (const listeners of owner.listeners.values()) assert.equal(listeners.size, 0);
});
