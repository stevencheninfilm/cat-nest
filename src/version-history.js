const art = (set, file, title, caption) => ({
  title, caption,
  thumbnail: `./assets/version-history/${set}/${file}-thumb.jpg`,
  image: `./assets/version-history/${set}/${file}.jpg`,
});

// Historical snapshots: keep old artwork and counts attached to their own release.
// These are player-facing milestones, not invented semantic version numbers.
export const VERSION_HISTORY = [
  {
    id: 'comfortable-companionship', date: '2026-10-18', label: '陪伴更从容', latest: true,
    title: '认识小窝，也更自在地陪伴',
    description: '新手指引、历史画报和手机预览一起更新，照顾与小游戏继续在后台静默保存。',
    tags: ['图文新手指引', '手机预览优化', '后台静默保存'],
    changes: [
      '跟着猫猫认识小窝，或随时打开图文手册查阅玩法；新手指引不会替你花币、开局或提交判官案件。',
      '设置新增版本历史，保留之前的宣传图，点开可以放大翻看。',
      '手机打开表情和装扮时，小猫与操作面板分开显示；庭院左右拖动更稳定。',
      '日常操作即时反馈，后台自动保存，保存异常时才提醒；已有小窝进度继续保留。',
    ],
    posters: [],
  },
  {
    id: 'diary-collection', date: '2026-10-15', label: '日记整理',
    title: '把陪伴，收进一本清楚的卡册',
    description: '正式卡片和日常记录各有归处，收集的每一步都看得见。',
    tags: ['37 个正式主题', '收集进度统一'],
    changes: [
      '正式卡册按主题去重，共 37 个可收集主题；已收集和待解锁使用同一套统计。',
      '旧「瞬间」归入日常足迹，重复升级、重复对局继续保留在时间轴。',
      '已有日记与共同收藏继续保留，回忆不会因为整理而丢失。',
    ],
    posters: [],
  },
  {
    id: 'nest-refresh', date: '2026-10-15', label: '小窝焕新',
    title: '更多猫友，更多一起玩的理由',
    description: '记录当天 14:11 后上线的新内容：猫猫图鉴、庭院、小游戏，还有会回应的日常。',
    tags: ['36 只图鉴猫猫', '照顾新节奏'],
    changes: [
      '图鉴扩展至 36 只猫猫，庭院可分别邀请猫友，并触发猫友间的对话。',
      '游戏屋加入新游戏与猫猫陪玩；摸摸、动作、昼夜氛围和随机小事让小窝更有生气。',
      '饱饱、开心、活力每 30 分钟各下降 1 点，离线也按同样节奏计算。3D 小屋暂未开放。',
    ],
    posters: [
      art('nest-refresh', '01-overview', '更新总览', '这次小窝更新了什么，一张画报先认识。'),
      art('nest-refresh', '02-catbook', '36 只猫猫图鉴', '认识更多猫友，慢慢点亮自己的猫猫图鉴。'),
      art('nest-refresh', '03-courtyard', '庭院邀请与对话', '各个庭院分别邀请，听听猫友们的小小对话。'),
      art('nest-refresh', '04-games', '游戏屋上新', '和猫友对局，也和自己的小猫玩一会儿。'),
      art('nest-refresh', '05-living-nest', '会回应的小窝', '摸摸、动作与昼夜，让每天的陪伴有不同回应。'),
      art('nest-refresh', '06-needs', '三项状态新节奏', '三项状态每 30 分钟各下降 1 点，照顾更从容。'),
    ],
  },
  {
    id: 'first-companionship', date: '2026-10-15', label: '陪伴初版',
    title: '从一只猫，开始我们的小窝',
    description: '第一组功能宣传图，留下双人陪伴刚刚开始的样子。',
    tags: ['双人照顾', '第一组宣传图'],
    changes: [
      '两位主人一起照顾小猫，查看彼此的在线与喂养状态。',
      '9 种食物、4 小时双人喂养、点击才领取的成长气泡，以及逐步变化的成长外观。',
      '当时版本包含 18 只图鉴猫猫、6 款小游戏和猫猫判官。',
    ],
    posters: [
      art('first-companionship', '01-together', '双人陪伴', '把两个人的日常，放进同一个温暖小窝。'),
      art('first-companionship', '02-feeding', '双人喂养', '一起选食物，一眼看到彼此有没有喂过。'),
      art('first-companionship', '03-growth', '爱心成长', '照顾后留下成长气泡，亲手点击领取。'),
      art('first-companionship', '04-catbook', '初版猫猫图鉴', '初版 18 只猫猫的收集回忆。'),
      art('first-companionship', '05-games', '初版六款小游戏', '最早的 6 款小游戏，一起玩也能陪猫猫成长。'),
      art('first-companionship', '06-court', '猫猫判官', '让小猫听听双方的说法，帮忙整理和好的方向。'),
    ],
  },
];

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

export function versionHistoryPanel() {
  return `<section class="version-history" aria-labelledby="version-history-title">
    <header class="version-history-heading">
      <button class="version-back" data-open="settings" aria-label="返回设置">‹ <span>设置</span></button>
      <span class="version-history-mark" aria-hidden="true">✦</span>
      <p class="version-eyebrow">OUR LITTLE UPDATES</p>
      <h2 id="version-history-title" tabindex="-1">版本历史</h2>
      <p>小窝在慢慢长大，每一次变化都留在这里。</p>
    </header>
    <ol class="version-timeline">${VERSION_HISTORY.map(version => `<li class="version-milestone${version.latest ? ' is-latest' : ''}">
      <article aria-labelledby="version-title-${version.id}">
        <div class="version-date"><time datetime="${version.date}">${version.date.replaceAll('-', '.')}</time><span>${version.latest ? '最新更新' : '历史回顾'} · ${version.label}</span></div>
        <h3 id="version-title-${version.id}">${version.title}</h3>
        <p class="version-intro">${version.description}</p>
        <div class="version-tags">${version.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
        <ul class="version-changes">${version.changes.map(change => `<li>${change}</li>`).join('')}</ul>
        ${version.posters.length ? `<div class="version-gallery-label"><strong>这一版的宣传图</strong><span>${version.posters.length} 张 · 点开放大</span></div>
        <ul class="version-posters" data-version-rail="${version.id}" aria-label="${version.label}宣传图">${version.posters.map((poster, index) => `<li><button data-version-poster="${version.id}" data-version-index="${index}" aria-label="查看${esc(poster.title)}宣传图，第 ${index + 1} 张，共 ${version.posters.length} 张"><img src="${poster.thumbnail}" width="360" height="540" alt="${esc(poster.title)}" loading="lazy" decoding="async" draggable="false"/><span><small>${String(index + 1).padStart(2, '0')}</small>${poster.title}</span></button></li>`).join('')}</ul>
        <p class="version-archive-note">宣传图保留当时版本的介绍，图中数量与功能以该历史版本为准。</p>` : ''}
      </article>
    </li>`).join('')}</ol>
    <p class="version-history-footer">谢谢你，和猫猫一起把日子过成回忆 ♡</p>
  </section>`;
}

export function versionPosterPanel(id, index) {
  const version = VERSION_HISTORY.find(item => item.id === id), poster = version?.posters[index];
  if (!poster || !Number.isInteger(index)) return versionHistoryPanel();
  return `<section class="version-poster-view" aria-labelledby="version-poster-title">
    <header class="version-poster-heading"><button class="version-back" data-version-back aria-label="返回版本历史">‹ <span>版本历史</span></button><span>${version.label} · ${version.date.replaceAll('-', '.')}</span></header>
    <h2 id="version-poster-title" tabindex="-1">${poster.title}</h2>
    <figure class="version-poster-stage" data-phase="loading">
      <div class="version-poster-state" role="status"><span>正在展开这张更新画报…</span><button data-version-retry hidden>重新加载</button></div>
      <img data-version-full src="${poster.image}" width="1024" height="1536" alt="${esc(poster.title)}：${esc(poster.caption)}" decoding="async" draggable="false"/>
    </figure>
    <div class="version-poster-navigation" aria-label="宣传图翻页"><button data-version-step="-1" ${index === 0 ? 'disabled' : ''} aria-label="上一张宣传图">‹ 上一张</button><span role="status" aria-live="polite" aria-atomic="true">${index + 1} / ${version.posters.length}</span><button data-version-step="1" ${index === version.posters.length - 1 ? 'disabled' : ''} aria-label="下一张宣传图">下一张 ›</button></div>
    <p class="version-poster-caption">${poster.caption}</p>
    <p class="version-archive-note">历史宣传图 · 内容以当时版本为准</p>
  </section>`;
}

// Presentation-only navigation: no save state, storage, or network mutations.
export function createVersionHistory({ root }) {
  let selected = null, index = 0, originIndex = 0, listScroll = 0;
  const railPositions = new Map();
  const dialog = () => root.closest('dialog');
  const active = () => root.dataset.view === 'versions';
  const panel = () => selected ? versionPosterPanel(selected, index) : versionHistoryPanel();
  function draw({ scroll = 0, focus } = {}) {
    root.innerHTML = panel();
    if (dialog()) {
      dialog().scrollTop = scroll;
      dialog().setAttribute('aria-labelledby', selected ? 'version-poster-title' : 'version-history-title');
    }
    if (!selected) for (const rail of root.querySelectorAll('[data-version-rail]')) rail.scrollLeft = railPositions.get(rail.dataset.versionRail) || 0;
    root.querySelector(focus || (selected ? '#version-poster-title' : '#version-history-title'))?.focus({ preventScroll: true });
  }
  function back() {
    if (!active() || !selected) return false;
    const selector = `[data-version-poster="${selected}"][data-version-index="${originIndex}"]`;
    selected = null;
    draw({ scroll: listScroll, focus: selector });
    return true;
  }
  function step(amount) {
    const version = VERSION_HISTORY.find(item => item.id === selected);
    if (!version || ![-1, 1].includes(amount) || !version.posters[index + amount]) return;
    index += amount; draw();
  }
  root.addEventListener('click', event => {
    if (!active()) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.versionPoster) {
      const version = VERSION_HISTORY.find(item => item.id === button.dataset.versionPoster), next = Number(button.dataset.versionIndex);
      if (!Number.isInteger(next) || !version?.posters[next]) return;
      listScroll = dialog()?.scrollTop || 0;
      for (const rail of root.querySelectorAll('[data-version-rail]')) railPositions.set(rail.dataset.versionRail, rail.scrollLeft);
      selected = version.id; index = originIndex = next; draw();
    } else if (button.hasAttribute('data-version-back')) back();
    else if (button.hasAttribute('data-version-retry') && selected) draw();
    else if (button.dataset.versionStep) step(Number(button.dataset.versionStep));
  });
  root.addEventListener('keydown', event => {
    if (!active() || !selected || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  for (const type of ['load', 'error']) root.addEventListener(type, event => {
    if (!active() || !event.target.hasAttribute?.('data-version-full')) return;
    const stage = event.target.closest('.version-poster-stage');
    if (!stage) return;
    stage.dataset.phase = type === 'load' ? 'ready' : 'error';
    stage.querySelector('.version-poster-state span').textContent = type === 'load' ? '' : '画报暂时没加载出来，再试一次吧。';
    stage.querySelector('[data-version-retry]').hidden = type === 'load';
  }, true);
  return { panel, back, open() { selected = null; index = originIndex = 0; listScroll = 0; railPositions.clear(); } };
}
