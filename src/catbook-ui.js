import { levelInfo } from './state.js';
import { COLLECTION_CATS, collectionCatProgress, getCollectionCat } from './cat-collection.js';
import { CAT_SCENES, collectionScene, sceneCatPlacement } from './catbook-scenes.js';
export { CAT_SCENES, collectionScene } from './catbook-scenes.js';

const asset = name => `${import.meta.env?.BASE_URL || './'}assets/catbook/${name}.png`;
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const paths = {
  paw:'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="20.5" cy="12" r="1.5"/><path d="M7 17c0-3 2-5 5-5s5 2 5 5c0 5-3 2-5 2s-5 3-5-2Z"/>',
  back:'<path d="m14 6-6 6 6 6M8 12h13"/>',
  trophy:'<path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12v7m-4 2h8"/>',
  book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  sparkle:'<path d="m12 3 2 6 7 3-7 3-2 6-2-6-7-3 7-3 2-6Z"/>',
  leaf:'<path d="M20 4C5 2 2 9 5 16s13 5 15-12ZM4 21 16 9"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/>',
};
export const bookIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.paw}</svg>`;
export function catSprite(cat, extraClass = '') {
  return `<span class="book-cat-sprite ${extraClass}" style="--cat-x:${cat.index % 4 / 3 * 100}%;--cat-y:${Math.floor(cat.index / 4) / 2 * 100}%" aria-hidden="true"></span>`;
}
function condition(cat) {
  return cat.metric === 'welcome' ? '第一次来到猫猫庭院，就可以邀请它' : cat.metric === 'level' ? `小猫成长到 Lv.${cat.target}` : cat.metric === 'foods' ? `喂过 ${cat.target} 种不同的食物` : `累计${{feed:'喂食',pet:'摸摸',play:'玩耍',sleep:'陪小猫入睡',pair:'完成双人喂养'}[cat.metric]} ${cat.target} ${cat.metric === 'pair' ? '轮' : '次'}`;
}
function status(progress) { return progress.invited ? '已入住' : progress.complete ? '可邀请' : '待相遇'; }
function progressText(cat, progress) {
  return cat.metric === 'welcome' ? '见面礼已备好' : cat.metric === 'level' ? `Lv.${progress.current} / Lv.${progress.target}` : `${Math.min(progress.current, progress.target)} / ${progress.target}`;
}

export function catbookMarkup(state, { tab='book', catId='bandit', sceneId='garden', saving=false, connected=true } = {}) {
  const cats = COLLECTION_CATS;
  const level = levelInfo(state.xp).level;
  const ledger = state.collection;
  const invitedCount = ledger.invited.length;
  const ready = cats.filter(cat => { const progress = collectionCatProgress(cat, ledger, level); return progress.complete && !progress.invited; }).length;
  const selected = getCollectionCat(catId) || cats[0];
  const selectedProgress = collectionCatProgress(selected, ledger, level);
  const scene = collectionScene(sceneId, invitedCount);
  const canInvite = selectedProgress.complete && !selectedProgress.invited && !saving && connected;
  const visitors = cats.filter(cat => ledger.invited.some(record => record.id === cat.id));
  return `<main class="catbook" aria-label="猫猫图鉴与成就庭院">
    <header class="book-topbar"><button class="book-back" data-catbook-back>${bookIcon('back')}<span>返回小窝</span></button><span class="book-brand">${bookIcon('paw')} 猫猫图鉴</span><span class="book-save">${saving ? '正在保存…' : connected ? '每一次相遇，都被记住' : '连接后可邀请猫猫'}</span></header>
    <section class="book-intro"><div><span class="book-eyebrow">LITTLE PAWS, BIG LITTLE WORLD</span><h1>把陪伴，变成新的相遇</h1><p>和${esc(state.name)}一起，邀请更多猫猫来做客。</p></div><div class="book-counter"><strong>${String(invitedCount).padStart(2,'0')}<span> / ${cats.length}</span></strong><small>猫猫已入住</small><span class="book-counter-track"><i style="width:${invitedCount / cats.length * 100}%"></i></span></div></section>
    <div class="book-garden-layout"><section class="book-yard-section" aria-label="猫猫庭院">
      <div class="book-yard" style="aspect-ratio:${scene.ratio}"><img class="book-yard-background" src="${asset(scene.id)}" alt="${scene.name}，只有已邀请的猫猫会出现在场景中" draggable="false"/><div class="book-visitors" role="group" aria-label="已入住的猫猫">${visitors.map(cat => {
        const placement = sceneCatPlacement(scene, cat);
        return `<button class="book-yard-cat pose-${placement.motion}" data-book-cat="${cat.id}" aria-label="查看${cat.name}，已加入${scene.name}，${placement.activity}" style="--slot-x:${placement.x}%;--slot-y:${placement.y}%;--cat-size:${placement.size}%;--cat-baseline:${placement.baseline}%;--pose-ratio:${placement.ratio};--idle-delay:${cat.index * -.4}s;z-index:${Math.round(placement.y)}"><span class="book-scene-cat" style="background-size:${placement.backgroundSize};background-position:${placement.backgroundPosition}" aria-hidden="true"></span>${placement.toy ? '<span class="book-yarn-ball" aria-hidden="true"></span>' : ''}<span class="book-visitor-name">${cat.name} · ${placement.activity}</span></button>`;
      }).join('')}</div>${!visitors.length ? `<div class="book-empty-yard">${bookIcon('paw')}<strong>这里，正等着第一位朋友</strong><span>邀请斑斑，一起把庭院填满吧</span></div>` : ''}</div><span class="book-yard-caption">${bookIcon(scene.icon)} ${scene.name}<span>${visitors.length} 位猫友在这里</span></span>
      <div class="book-scene-choices" role="group" aria-label="选择猫猫场景">${CAT_SCENES.map(option => `<button data-book-scene="${option.id}" class="book-scene-choice ${option.id === scene.id ? 'selected' : ''}" aria-pressed="${option.id === scene.id}" ${invitedCount < option.min ? 'disabled' : ''}><span>${bookIcon(invitedCount < option.min ? 'lock' : option.icon)}</span><strong>${option.name}</strong><small>${invitedCount < option.min ? `邀请 ${option.min} 位猫友解锁` : option.subtitle}</small></button>`).join('')}</div>
    </section><aside class="book-detail" aria-label="${selected.name}的图鉴详情"><span class="book-detail-number">CAT NO.${String(selected.index + 1).padStart(2,'0')}<b class="book-state ${status(selectedProgress) === '可邀请' ? 'ready' : ''}">${status(selectedProgress)}</b></span><div class="book-detail-art">${catSprite(selected, !selectedProgress.complete && !selectedProgress.invited ? 'undiscovered' : '')}</div><h2 tabindex="-1">${selected.name}<span>${selected.english}</span></h2><p class="book-personality">${selected.personality}</p><div class="book-achievement-card"><span>${bookIcon('trophy')} ${selected.achievement}</span><p>${condition(selected)}</p><div class="book-achievement-progress"><i style="width:${selectedProgress.fraction * 100}%"></i></div><small>${progressText(selected, selectedProgress)}${selectedProgress.complete ? ' · 已达成' : ''}</small></div><button class="book-invite" data-book-invite="${selected.id}" ${canInvite ? '' : 'disabled'}>${bookIcon(selectedProgress.invited ? 'check' : 'paw')} ${selectedProgress.invited ? '已经在庭院等你啦' : saving ? '正在保存这次相遇…' : !connected ? '等待小窝连接' : selectedProgress.complete ? `邀请${selected.name}加入庭院` : '完成成就后可邀请'}</button><p class="book-detail-note">${selectedProgress.invited ? `${new Date(selectedProgress.invited.at).toLocaleDateString('zh-CN', { month:'long', day:'numeric' })} · 第一次来到你们的庭院` : '邀请免费 · 相遇与成就会留在小窝存档中'}</p></aside></div>
    <section class="book-catalog"><div class="book-catalog-heading"><div class="book-tabs" role="tablist" aria-label="图鉴和成就"><button role="tab" id="book-tab-book" data-book-tab="book" aria-controls="book-panel" aria-selected="${tab === 'book'}" tabindex="${tab === 'book' ? 0 : -1}">${bookIcon('book')} 猫猫图鉴</button><button role="tab" id="book-tab-achievements" data-book-tab="achievements" aria-controls="book-panel" aria-selected="${tab === 'achievements'}" tabindex="${tab === 'achievements' ? 0 : -1}">${bookIcon('trophy')} 陪伴成就</button></div><span class="book-ready-count">${ready ? `${bookIcon('sparkle')} ${ready} 位新朋友等你邀请` : '小小陪伴，慢慢收集'}</span></div><div id="book-panel" role="tabpanel" aria-labelledby="book-tab-${tab}" class="${tab === 'book' ? 'book-cat-grid' : 'book-achievement-grid'}">${cats.map(cat => {
      const progress = collectionCatProgress(cat, ledger, level);
      return tab === 'book' ? `<button class="book-cat-card ${cat.id === selected.id ? 'selected' : ''} ${progress.invited ? 'collected' : progress.complete ? 'ready' : 'locked'}" data-book-cat="${cat.id}" aria-pressed="${cat.id === selected.id}" aria-label="查看${cat.name}，${status(progress)}"><span class="book-card-number">${String(cat.index + 1).padStart(2,'0')}</span>${catSprite(cat, !progress.complete && !progress.invited ? 'undiscovered' : '')}<strong>${cat.name}</strong><small>${cat.english}</small><span class="book-card-status">${bookIcon(progress.invited ? 'check' : progress.complete ? 'sparkle' : 'lock')}${status(progress)}</span></button>` : `<button class="book-achievement-row ${progress.complete ? 'complete' : ''}" data-book-cat="${cat.id}" aria-label="${cat.achievement}，${condition(cat)}，${progressText(cat, progress)}"><span class="book-achievement-art">${catSprite(cat)}</span><span class="book-achievement-copy"><strong>${cat.achievement}</strong><small>${condition(cat)}</small><span class="book-achievement-progress"><i style="width:${progress.fraction * 100}%"></i></span><em>${progressText(cat, progress)} · ${progress.invited ? `${cat.name}已入住` : progress.complete ? `可邀请${cat.name}` : `将遇见${cat.name}`}</em></span><span class="book-achievement-mark">${bookIcon(progress.complete ? 'check' : 'lock')}</span></button>`;
    }).join('')}</div></section><footer class="book-footer">${bookIcon('paw')} 完成照顾，积攒成就。每一位新朋友，都是陪伴的回响。</footer>
  </main>`;
}
