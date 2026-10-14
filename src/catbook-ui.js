import { levelInfo } from './state.js';
import { COLLECTION_CATS, collectionCatProgress, getCollectionCat } from './cat-collection.js';
import { CAT_SCENES, collectionScene, collectionSceneProgress, sceneCatPlacement } from './catbook-scenes.js';
import { WALKING_CATS } from './catbook-walking.js';
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
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/>',
};
export const bookIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.paw}</svg>`;
export function catSprite(cat, extraClass = '') {
  return `<span class="book-cat-sprite ${extraClass}" style="--cat-x:${cat.index % 4 / 3 * 100}%;--cat-y:${Math.floor(cat.index / 4) / 2 * 100}%" aria-hidden="true"></span>`;
}
export function catArrivalMarkup(cat,direction) {
  const walk=WALKING_CATS[cat.index], baseline=(1-4/Number(walk.ratio.split('/')[1]))*100;
  return `<div class="book-arrival" data-arriving-cat="${cat.id}" aria-hidden="true"><div class="book-arrival-facing" style="--walk-direction:${direction};--walking-baseline:${baseline}%"><span class="book-walking-cat" style="aspect-ratio:${walk.ratio};background-size:${walk.backgroundSize};--walk-a:${walk.a};--walk-b:${walk.b}"></span></div></div>`;
}
export function collectionNoticeMarkup(event,{sceneId='garden',settled=false,age=0}={}) {
  const scene=CAT_SCENES.find(scene=>scene.id===(event.type === 'scene-unlocked' ? event.id : sceneId)) || CAT_SCENES[0];
  const cat=getCollectionCat(event.id);
  const arrived=event.type === 'cat-arrived', unlocked=event.type === 'cat-unlocked';
  const title=cat ? arrived ? `欢迎${cat.name}来到庭院` : `${cat.name}可以邀请啦！` : `新场景解锁 · ${scene.name}`;
  const description=cat ? arrived ? settled ? `已经在${sceneCatPlacement(scene,cat).surface}安顿好啦 ♡` : '正在寻找自己的小角落…' : `达成「${cat.achievement}」，新朋友正等着你` : `${scene.min} 位猫友的进阶陪伴成就已达成，去逛逛吧`;
  const action=unlocked ? `<button data-book-reward-cat="${cat.id}">去邀请 ${bookIcon('paw')}</button>` : !cat ? `<button data-book-reward-scene="${scene.id}">去看看 ${bookIcon(scene.icon)}</button>` : '';
  const art=cat ? catSprite(cat,unlocked ? 'undiscovered' : '') : `<img src="${asset(scene.asset || scene.id)}" alt=""/>`;
  return `<section class="book-reward" aria-label="${arrived ? '新猫猫入场' : '解锁提示'}" style="--reward-age:${-age}ms"><span class="book-reward-art ${cat ? '' : 'is-scene'}">${art}<span class="book-reward-sparkles" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i style="--spark:${i}">✦</i>`).join('')}</span></span><div class="book-reward-copy"><div role="status" aria-live="polite" aria-atomic="true"><small>${arrived ? '新的相遇' : '陪伴的礼物'}</small><strong>${title}</strong><p>${description}</p></div>${action}</div><button class="book-reward-close" data-book-reward-dismiss aria-label="关闭解锁提示">${bookIcon('close')}</button></section>`;
}
function condition(cat) {
  return cat.requirements.map(({metric,target}) => metric === 'level' ? `小猫成长到 Lv.${target}` : metric === 'foods' ? `喂过 ${target} 种不同的食物` : metric === 'care' ? `累计照顾小猫 ${target} 次（喂食、摸摸、玩耍或哄睡）` : `累计${{feed:'喂食',pet:'摸摸',play:'玩耍',sleep:'陪小猫入睡',pair:'完成双人喂养'}[metric]} ${target} ${metric === 'pair' ? '轮' : '次'}`).join('，并');
}
function status(progress) { return progress.invited ? '已入住' : progress.complete ? '可邀请' : '待相遇'; }
function progressText(cat, progress) {
  const counts=progress.requirements.map(({metric,current,target}) => metric === 'level' ? `Lv.${current} / Lv.${target}` : `${progress.requirements.length > 1 ? {feed:'喂食 ',foods:'食物 '}[metric] || '' : ''}${Math.min(current,target)} / ${target}`).join(' · ');
  return progress.invited && !progress.achieved ? `已收集，陪伴记录保留 · 进阶 ${counts}` : counts;
}

function sheet(id, title, content, backLabel) {
  return `<dialog class="book-sheet book-sheet-${id}" data-book-sheet="${id}" aria-labelledby="book-sheet-${id}-title"><div class="book-sheet-handle" aria-hidden="true"></div><header class="book-sheet-header">${backLabel ? `<button class="book-sheet-back" data-book-detail-back aria-label="${backLabel}">${bookIcon('back')}</button>` : ''}<h2 id="book-sheet-${id}-title">${title}</h2><button class="book-sheet-close" data-book-dismiss aria-label="关闭${title}">${bookIcon('close')}</button></header><div class="book-sheet-scroll">${content}</div></dialog>`;
}

export function catbookMarkup(state, { tab='book', catId='bandit', sceneId='garden', saving=false, connected=true, detailFromCatalog=false, arrivingCatId=null, settlingCatId=null, arrivalAge=0 } = {}) {
  const level = levelInfo(state.xp).level;
  const ledger = state.collection;
  const invitedCount = ledger.invited.length;
  const ready = COLLECTION_CATS.filter(cat => { const progress = collectionCatProgress(cat, ledger, level); return progress.complete && !progress.invited; }).length;
  const selected = getCollectionCat(catId) || COLLECTION_CATS[0];
  const selectedProgress = collectionCatProgress(selected, ledger, level);
  const scene = collectionScene(sceneId, ledger, level);
  const [sceneWidth, sceneHeight] = scene.ratio.split('/').map(Number);
  const canInvite = selectedProgress.complete && !selectedProgress.invited && !saving && connected;
  const visitors = COLLECTION_CATS.filter(cat => ledger.invited.some(record => record.id === cat.id));
  const sceneChoices = `<div class="book-scene-choices" role="group" aria-label="选择猫猫场景">${CAT_SCENES.map(option => {
    const progress=collectionSceneProgress(option,ledger,level);
    return `<button data-book-scene="${option.id}" class="book-scene-choice ${option.id === scene.id ? 'selected' : ''}" aria-pressed="${option.id === scene.id}" ${progress.complete ? '' : 'disabled'}><span class="book-scene-preview" style="background-image:url('${asset(option.asset || option.id)}')" aria-hidden="true"></span><span class="book-scene-copy"><strong>${option.name}</strong><small>${progress.complete ? option.subtitle : `未解锁 · ${option.min} 位已入住猫友达成进阶陪伴成就（${progress.current} / ${progress.target}）`}</small></span>${bookIcon(!progress.complete ? 'lock' : option.id === scene.id ? 'check' : option.icon)}</button>`;
  }).join('')}</div><p class="book-about-note">场景进度只统计达到当前陪伴成就门槛的已入住猫友。已收集的猫猫会继续留在庭院中。</p>`;
  const detail = `<article class="book-detail" aria-label="${selected.name}的图鉴详情"><span class="book-detail-number">CAT NO.${String(selected.index + 1).padStart(2,'0')}<b class="book-state ${status(selectedProgress) === '可邀请' ? 'ready' : ''}">${status(selectedProgress)}</b></span><div class="book-detail-art">${catSprite(selected, selectedProgress.invited ? '' : 'undiscovered')}</div><h2 tabindex="-1">${selected.name}<span>${selected.english}</span></h2><p class="book-personality">${selected.personality}</p><div class="book-achievement-card"><span>${bookIcon('trophy')} ${selected.achievement}</span><p>${condition(selected)}</p><div class="book-achievement-progress"><i style="width:${selectedProgress.fraction * 100}%"></i></div><small>${progressText(selected, selectedProgress)}${selectedProgress.achieved ? ' · 已达成' : selectedProgress.invited ? ' · 场景进阶未达标' : ''}</small></div><button class="book-invite" data-book-invite="${selected.id}" ${canInvite ? '' : 'disabled'}>${bookIcon(selectedProgress.invited ? 'check' : 'paw')} ${selectedProgress.invited ? '已经在庭院等你啦' : saving ? '正在保存这次相遇…' : !connected ? '等待小窝连接' : selectedProgress.complete ? `邀请${selected.name}加入庭院` : '完成成就后可邀请'}</button><p class="book-detail-note">${selectedProgress.invited ? `${new Date(selectedProgress.invited.at).toLocaleDateString('zh-CN', { month:'long', day:'numeric' })} · 第一次来到你们的庭院` : '邀请免费 · 相遇与成就会留在小窝存档中'}</p></article>`;
  const catalog = `<section class="book-catalog"><div class="book-catalog-heading"><div class="book-tabs" role="tablist" aria-label="图鉴和成就"><button role="tab" id="book-tab-book" data-book-tab="book" aria-controls="book-panel" aria-selected="${tab === 'book'}" tabindex="${tab === 'book' ? 0 : -1}">${bookIcon('book')} 猫猫图鉴</button><button role="tab" id="book-tab-achievements" data-book-tab="achievements" aria-controls="book-panel" aria-selected="${tab === 'achievements'}" tabindex="${tab === 'achievements' ? 0 : -1}">${bookIcon('trophy')} 陪伴成就</button></div><span class="book-ready-count">${ready ? `${bookIcon('sparkle')} ${ready} 位新朋友等你邀请` : '小小陪伴，慢慢收集'}</span></div><div id="book-panel" role="tabpanel" aria-labelledby="book-tab-${tab}" class="${tab === 'book' ? 'book-cat-grid' : 'book-achievement-grid'}">${COLLECTION_CATS.map(cat => {
    const progress = collectionCatProgress(cat, ledger, level);
    return tab === 'book' ? `<button class="book-cat-card ${cat.id === selected.id ? 'selected' : ''} ${progress.invited ? 'collected' : progress.complete ? 'ready' : 'locked'}" data-book-cat="${cat.id}" aria-pressed="${cat.id === selected.id}" aria-label="查看${cat.name}，${status(progress)}"><span class="book-card-number">${String(cat.index + 1).padStart(2,'0')}</span>${catSprite(cat, progress.invited ? '' : 'undiscovered')}<strong>${cat.name}</strong><small>${cat.english}</small><span class="book-card-status">${bookIcon(progress.invited ? 'check' : progress.complete ? 'sparkle' : 'lock')}${status(progress)}</span></button>` : `<button class="book-achievement-row ${progress.complete ? 'complete' : ''}" data-book-cat="${cat.id}" aria-label="${cat.achievement}，${condition(cat)}，${progressText(cat, progress)}"><span class="book-achievement-art">${catSprite(cat, progress.invited ? '' : 'undiscovered')}</span><span class="book-achievement-copy"><strong>${cat.achievement}</strong><small>${condition(cat)}</small><span class="book-achievement-progress"><i style="width:${progress.fraction * 100}%"></i></span><em>${progressText(cat, progress)} · ${progress.invited ? `${cat.name}已入住` : progress.complete ? `可邀请${cat.name}` : `将遇见${cat.name}`}</em></span><span class="book-achievement-mark">${bookIcon(progress.complete ? 'check' : 'lock')}</span></button>`;
  }).join('')}</div></section>`;
  const about = `<section class="book-intro"><span class="book-eyebrow">LITTLE PAWS, BIG LITTLE WORLD</span><h3>把陪伴，变成新的相遇</h3><p>和${esc(state.name)}一起，邀请更多猫猫来做客。</p><div class="book-about-collection"><span>${bookIcon('paw')} 已相遇的猫友</span><strong>${invitedCount}<small> / ${COLLECTION_CATS.length}</small></strong></div><ol class="book-about-steps"><li><strong>一点点照顾</strong><p>回到小窝，喂食、摸摸、玩耍，慢慢完成陪伴成就。</p></li><li><strong>邀请新朋友</strong><p>打开图鉴，找到达成条件的猫猫，邀请它加入庭院。</p></li><li><strong>自在地待着</strong><p>左右拖动庭院，看看猫猫晒太阳、打盹、玩耍。点点它，猫猫会动一动，再翻开它的小档案。</p></li></ol><p class="book-about-note">${saving ? '正在保存这次相遇…' : connected ? '每一次相遇，都会留在你们的小窝里。' : '小窝连接后，就可以邀请新的猫友。'}</p></section>`;
  return `<main class="catbook" aria-label="猫猫沉浸式庭院" style="--scene-ratio:${scene.ratio};--scene-aspect:${sceneWidth / sceneHeight}"><section class="book-yard-section" aria-label="猫猫庭院"><div class="book-yard-camera" role="region" aria-label="${scene.name}，左右拖动浏览庭院" tabindex="0"><div class="book-yard" data-scene-id="${scene.id}"><img class="book-yard-background" src="${asset(scene.asset || scene.id)}" alt="${scene.name}，只有已邀请的猫猫会出现在场景中" draggable="false"/><div class="book-visitors" role="group" aria-label="已入住的猫猫">${visitors.map(cat => {
    const placement = sceneCatPlacement(scene, cat);
    return `<button class="book-yard-cat pose-${placement.motion} ${cat.id === arrivingCatId ? 'is-arriving' : cat.id === settlingCatId ? 'is-new-arrival' : ''}" ${cat.id === arrivingCatId ? 'disabled aria-busy="true"' : ''} data-book-cat="${cat.id}" aria-label="查看${cat.name}，已加入${scene.name}，${placement.activity}" style="--slot-x:${placement.x}%;--slot-y:${placement.y}%;--cat-size:${placement.size}%;--cat-baseline:${placement.baseline}%;--pose-ratio:${placement.ratio};--idle-delay:${cat.index * -.4}s;--arrival-age:${-arrivalAge}ms;z-index:${Math.round(placement.y)}"><span class="book-scene-cat" style="background-size:${placement.backgroundSize};background-position:${placement.backgroundPosition}" aria-hidden="true"></span>${placement.toy ? '<span class="book-yarn-ball" aria-hidden="true"></span>' : ''}<span class="book-visitor-name">${cat.name}</span></button>`;
  }).join('')}</div><div class="book-arrivals" aria-hidden="true"></div></div></div>${!visitors.length ? `<div class="book-empty-yard" aria-label="这里，正等着第一位朋友"><button data-book-cat="bandit">${bookIcon('paw')} 邀请斑斑来做客</button></div>` : ''}</section><header class="book-game-topbar"><button class="book-game-round" data-catbook-back aria-label="返回小窝">${bookIcon('back')}</button><button class="book-location" data-book-open="scenes" aria-label="切换庭院，当前${scene.name}">${bookIcon(scene.icon)}<span>${scene.name}</span></button><button class="book-game-round" data-book-open="about" aria-label="庭院介绍">${bookIcon('info')}</button></header><nav class="book-game-menu" aria-label="庭院菜单"><button data-book-open="catalog" data-book-page="book" aria-label="打开猫猫图鉴，已入住${invitedCount}只猫猫"><span>${bookIcon('book')}${ready ? `<i class="book-menu-badge">${ready}</i>` : ''}</span><strong>猫猫图鉴</strong><small>${invitedCount} / ${COLLECTION_CATS.length}</small></button><button data-book-open="catalog" data-book-page="achievements" aria-label="打开陪伴成就"><span>${bookIcon('trophy')}</span><strong>陪伴成就</strong></button><button data-book-open="scenes" aria-label="选择庭院场景"><span>${bookIcon(scene.icon)}</span><strong>切换场景</strong></button></nav>${sheet('about','庭院介绍',about)}${sheet('catalog','猫友手账',catalog)}${sheet('detail','猫猫详情',detail,detailFromCatalog ? '返回图鉴' : '返回庭院')}${sheet('scenes','选择庭院',sceneChoices)}</main>`;
}
