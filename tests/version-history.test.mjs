import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { VERSION_HISTORY, versionHistoryPanel, versionPosterPanel, createVersionHistory } from '../src/version-history.js';

function fixture() {
  const handlers = new Map(), attributes = new Map(), focused = [];
  const dialog = { scrollTop: 0, setAttribute(name, value) { attributes.set(name, value); } };
  let html = '', rails = [];
  const root = {
    dataset: { view: 'versions' },
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      rails = [...html.matchAll(/data-version-rail="([^"]+)"/g)].map(match => ({ dataset: { versionRail: match[1] }, scrollLeft: 0 }));
    },
    closest() { return dialog; },
    querySelector(selector) { return { focus(options) { focused.push({ selector, options }); } }; },
    querySelectorAll() { return rails; },
    addEventListener(type, handler) { handlers.set(type, handler); },
  };
  const history = createVersionHistory({ root });
  history.open(); root.innerHTML = history.panel();
  function click(dataset, { disabled = false } = {}) {
    const button = { dataset, disabled, hasAttribute(name) { return Object.hasOwn(dataset, name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())); }, closest() { return this; } };
    handlers.get('click')({ target: button });
  }
  function key(key, modifiers = {}) {
    let prevented = false;
    handlers.get('keydown')({ key, ...modifiers, preventDefault() { prevented = true; } });
    return prevented;
  }
  return { root, dialog, attributes, focused, handlers, history, click, key, rails: () => rails };
}

test('history keeps both six-poster releases and the newer diary correction distinct', () => {
  assert.equal(VERSION_HISTORY.length, 4);
  assert.equal(new Set(VERSION_HISTORY.map(version => version.id)).size, 4);
  assert.equal(VERSION_HISTORY.filter(version => version.latest).length, 1);
  assert.equal(VERSION_HISTORY[0].id,'comfortable-companionship');
  assert.match(VERSION_HISTORY[0].changes.join(''),/后台自动保存，保存异常时才提醒/);
  const diary=VERSION_HISTORY.find(v=>v.id==='diary-collection');
  assert.match(diary.changes.join(''), /37 个可收集主题/);
  assert.match(diary.changes.join(''), /日常足迹.*重复升级、重复对局.*时间轴/);
  assert.deepEqual(VERSION_HISTORY.map(version => version.posters.length), [0, 0, 6, 6]);
  const refresh=VERSION_HISTORY.find(v=>v.id==='nest-refresh'),first=VERSION_HISTORY.find(v=>v.id==='first-companionship');
  assert.match(refresh.changes.join(''), /36 只猫猫/);
  assert.match(refresh.changes.join(''), /3D 小屋暂未开放/);
  assert.match(first.changes.join(''), /当时版本包含 18 只图鉴猫猫、6 款小游戏/);
});

test('every archived poster has a lightweight thumbnail and a full shared asset', async () => {
  const paths = new Set(); let thumbs = 0;
  for (const version of VERSION_HISTORY) for (const poster of version.posters) {
    assert.ok(poster.title && poster.caption);
    for (const [key, limit] of [['thumbnail', 180_000], ['image', 800_000]]) {
      const path = poster[key];
      assert.match(path, /^\.\/assets\/version-history\/[a-z-]+\/[a-z0-9-]+\.jpg$/);
      assert.ok(!paths.has(path)); paths.add(path);
      const file = new URL(`../public/${path.slice(2)}`, import.meta.url);
      const bytes = await readFile(file);
      assert.equal(bytes.readUInt16BE(0), 0xffd8, `${path} must be a JPEG`);
      assert.ok((await stat(file)).size < limit, `${path} exceeds its image budget`);
      if (key === 'thumbnail') thumbs += bytes.length;
    }
  }
  assert.equal(paths.size, 24);
  assert.ok(thumbs < 1_200_000);
});

test('the list defers full posters until opened and clearly labels archived descriptions', () => {
  const html = versionHistoryPanel();
  assert.equal((html.match(/data-version-poster=/g) || []).length, 12);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 12);
  assert.equal((html.match(/<img[^>]+src="[^\"]+-thumb.jpg"/g) || []).length, 12);
  assert.doesNotMatch(html, /data-version-full/);
  assert.match(html, /data-open="settings"/);
  assert.match(html, /图中数量与功能以该历史版本为准/);
  const first = versionPosterPanel('nest-refresh', 0), last = versionPosterPanel('nest-refresh', 5);
  assert.match(first, /data-version-step="-1" disabled/);
  assert.match(last, /data-version-step="1" disabled/);
  assert.match(first, /历史宣传图 · 内容以当时版本为准/);
  for (const [id, index] of [['missing', 0], ['nest-refresh', -1], ['nest-refresh', 6], ['nest-refresh', NaN], ['nest-refresh', 1.2], ['nest-refresh', '0']]) assert.equal(versionPosterPanel(id, index), html);
});

test('poster navigation restores the original list, thumbnail scroll and keyboard focus', () => {
  const h = fixture();
  h.dialog.scrollTop = 465; h.rails()[0].scrollLeft = 364;
  h.click({ versionPoster: 'nest-refresh', versionIndex: '3' });
  assert.match(h.root.innerHTML, /游戏屋上新/);
  assert.equal(h.dialog.scrollTop, 0);
  assert.equal(h.attributes.get('aria-labelledby'), 'version-poster-title');
  assert.equal(h.key('ArrowRight'), true);
  assert.match(h.root.innerHTML, /5 \/ 6/);
  h.click({ versionStep: '1' });
  assert.match(h.root.innerHTML, /6 \/ 6/);
  const last = h.root.innerHTML; h.click({ versionStep: '1' }); assert.equal(h.root.innerHTML, last);
  assert.equal(h.history.back(), true);
  assert.match(h.root.innerHTML, /id="version-history-title"/);
  assert.equal(h.dialog.scrollTop, 465);
  assert.equal(h.rails()[0].scrollLeft, 364);
  assert.equal(h.attributes.get('aria-labelledby'), 'version-history-title');
  assert.deepEqual(h.focused.at(-1), { selector: '[data-version-poster="nest-refresh"][data-version-index="3"]', options: { preventScroll: true } });
  assert.equal(h.history.back(), false);
});

test('invalid controls, modifier shortcuts and events in other panels do not navigate', () => {
  const h = fixture(), list = h.root.innerHTML;
  h.click({ versionPoster: 'missing', versionIndex: '0' });
  h.click({ versionPoster: 'nest-refresh', versionIndex: '999' });
  h.click({ versionPoster: 'nest-refresh', versionIndex: 'NaN' });
  h.click({ versionPoster: 'nest-refresh', versionIndex: '0' }, { disabled: true });
  assert.equal(h.root.innerHTML, list);
  assert.equal(h.key('ArrowLeft'), false);
  h.click({ versionPoster: 'first-companionship', versionIndex: '0' });
  const first = h.root.innerHTML;
  h.key('ArrowLeft'); assert.equal(h.root.innerHTML, first);
  assert.equal(h.key('ArrowRight', { ctrlKey: true }), false);
  h.click({ versionStep: '9' }); assert.equal(h.root.innerHTML, first);
  h.root.dataset.view = 'settings';
  assert.equal(h.key('ArrowRight'), false);
  h.click({ versionStep: '1' }); assert.equal(h.root.innerHTML, first);
  assert.equal(h.history.back(), false);
  h.root.dataset.view = 'versions'; h.history.open();
  assert.equal(h.history.panel(), list);
});

test('image failures show a retry and loading completion clears the placeholder', () => {
  const h = fixture(); h.click({ versionPoster: 'nest-refresh', versionIndex: '0' });
  const message = {}, retry = { hidden: true };
  const stage = { dataset: {}, querySelector(selector) { return selector === '[data-version-retry]' ? retry : message; } };
  const image = { hasAttribute: name => name === 'data-version-full', closest: () => stage };
  h.handlers.get('error')({ target: image });
  assert.equal(stage.dataset.phase, 'error'); assert.equal(retry.hidden, false);
  assert.match(message.textContent, /暂时没加载出来/);
  h.click({ versionRetry: '' }); assert.match(h.root.innerHTML, /data-phase="loading"/);
  h.handlers.get('load')({ target: image });
  assert.equal(stage.dataset.phase, 'ready'); assert.equal(retry.hidden, true);
});

test('the common settings routes to history without changing saves or unlocking the 3D house', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /class="setting-row" data-open="versions"/);
  assert.match(main, /versions: \(\) => versionHistory.panel\(\)/);
  assert.match(main, /versionHistory.back\(\).*event.preventDefault/);
  const source = await readFile(new URL('../src/version-history.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|dispatch\(|fetch\(/);
  const flags = await readFile(new URL('../src/feature-availability.js', import.meta.url), 'utf8');
  assert.match(flags, /WORLD_EXPLORATION_ENABLED\s*=\s*false/);
});
