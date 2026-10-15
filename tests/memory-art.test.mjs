import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryArtwork } from '../src/memory-art.js';
import { memoryArt, memoryJournalPanel } from '../src/memory-journal-ui.js';
import { demoSeed } from '../demo/engine.js';

test('each first-care and random vignette theme has its own real image asset', async () => {
  const entries = [
    ...['adoption','anniversary','level','game'].map(kind=>({kind})),
    ...['feed','pet','play','sleep','dress','rename'].map(occasion=>({kind:'first',occasion})),
    ...['meal','relay','goodnight'].map(occasion=>({kind:'together',occasion})),
    ...Array.from({length:12},(_,variant)=>({kind:'fun',variant})),
  ];
  const selected=entries.map(memoryArtwork);
  assert.equal(new Set(selected.map(a=>a.src)).size,25);
  for(const art of selected) {
    const bytes=await readFile(new URL(art.src));
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.ok(art.description.length>5);
  }
});

test('timeline, preview and legacy care keep a stable illustration without modifying saved memories', () => {
  const state=demoSeed(Date.parse('2026-10-15T00:00:00Z'));
  const before=structuredClone(state.diary),entries=state.diary.entries;
  assert.equal(new Set(entries.map(e=>memoryArtwork(e).key)).size,entries.length);
  for(const e of entries) assert.ok(memoryArt(e).includes(memoryArtwork(e).src));
  const html=memoryJournalPanel(state);
  assert.match(html,/查看「第一次温柔摸摸」的纪念插画和完整故事/);
  assert.doesNotMatch(html,/expression-atlas|background-position/);
  assert.deepEqual(state.diary,before);
  assert.equal(memoryArtwork({id:'old-food',kind:'legacy',text:'喂了一份幼猫慕斯'}).key,'feed');
  const old={id:'old-moment',kind:'legacy',text:'陪伴的小事'};
  assert.deepEqual(memoryArtwork(old),memoryArtwork(structuredClone(old)));
});
