import { levelInfo } from './state.js';
import { COLLECTION_CATS, collectionCatProgress, getCollectionCat, collectionSceneInvitation } from './cat-collection.js';
import { CAT_SCENES, DEFAULT_CAT_SCENE, collectionScene, collectionSceneProgress, sceneCatPlacement, sceneCatClipPath, sceneCatGlassShapes, sceneAllowsCat, catArrivalScene, catPoseSprite } from './catbook-scenes.js';
import { GAME_CAT_WALKS } from './catbook-game-sprites.js';
import { ACHIEVEMENT_CAT_WALKS } from './catbook-achievement-sprites.js';
import { WALKING_CATS } from './catbook-walking.js';
import { CAT_SILHOUETTES } from './catbook-silhouettes.js';
import { REFERENCE_CAT_WALKS } from './catbook-reference-sprites.js';
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
  train:'<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M8 21l2-3m6 3-2-3M9 14h.1M15 14h.1"/>',
};
export const bookIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.paw}</svg>`;
export function catSprite(cat, extraClass = '') {
  if(cat.index >= 12) {
    const sprite=catPoseSprite(cat);
    return `<span class="book-cat-sprite is-game-cat ${extraClass}" aria-hidden="true"><span class="book-game-portrait" style="background-image:url('${asset(sprite.texture)}');width:${sprite.portraitWidth}%;aspect-ratio:${sprite.ratio};background-size:${sprite.backgroundSize};background-position:${sprite.backgroundPosition}"></span></span>`;
  }
  return `<span class="book-cat-sprite ${extraClass}" style="--cat-x:${cat.index % 4 / 3 * 100}%;--cat-y:${Math.floor(cat.index / 4) / 2 * 100}%" aria-hidden="true"></span>`;
}
const walkingSprite=cat=>cat.index < 12 ? WALKING_CATS[cat.index] : cat.index < 18 ? GAME_CAT_WALKS[cat.index-12] : cat.index < 24 ? ACHIEVEMENT_CAT_WALKS[cat.index-18] : REFERENCE_CAT_WALKS[cat.index-24];
export function catArrivalMarkup(cat,direction) {
  const walk=walkingSprite(cat), baseline=(1-4/Number(walk.ratio.split('/')[1]))*100;
  return `<div class="book-arrival" data-arriving-cat="${cat.id}" aria-hidden="true"><div class="book-arrival-facing" style="--walk-direction:${direction};--walking-baseline:${baseline}%"><span class="book-walking-cat" style="${walk.texture ? `background-image:url('${asset(walk.texture)}');` : ''}aspect-ratio:${walk.ratio};background-size:${walk.backgroundSize};--walk-a:${walk.a};--walk-b:${walk.b}"></span></div></div>`;
}
export function collectionNoticeMarkup(event,{sceneId=DEFAULT_CAT_SCENE,settled=false,age=0}={}) {
  const currentScene=CAT_SCENES.find(scene=>scene.id===(event.type === 'scene-unlocked' ? event.id : sceneId)) || CAT_SCENES[0];
  const cat=getCollectionCat(event.id);
  const arrived=event.type === 'cat-arrived', unlocked=event.type === 'cat-unlocked';
  const scene=arrived && cat ? catArrivalScene(currentScene,cat) : currentScene;
  const title=cat ? arrived ? `欢迎${cat.name}来到${scene.name}` : `${cat.name}可以邀请啦！` : `新场景解锁 · ${scene.name}`;
  const description=cat ? arrived ? settled ? `已经在${sceneCatPlacement(scene,cat).surface}安顿好啦 ♡` : '正在寻找自己的小角落…' : `达成「${cat.achievement}」，新朋友正等着你` : `${scene.min} 位猫友的进阶陪伴成就已达成，去逛逛吧`;
  const action=unlocked ? `<button data-book-reward-cat="${cat.id}">去邀请 ${bookIcon('paw')}</button>` : !cat ? `<button data-book-reward-scene="${scene.id}">去看看 ${bookIcon(scene.icon)}</button>` : '';
  const art=cat ? catSprite(cat,unlocked ? 'undiscovered' : '') : `<img src="${asset(scene.asset || scene.id)}" alt=""/>`;
  return `<section class="book-reward" aria-label="${arrived ? '新猫猫入场' : '解锁提示'}" style="--reward-age:${-age}ms"><span class="book-reward-art ${cat ? '' : 'is-scene'}">${art}<span class="book-reward-sparkles" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i style="--spark:${i}">✦</i>`).join('')}</span></span><div class="book-reward-copy"><div role="status" aria-live="polite" aria-atomic="true"><small>${arrived ? '新的相遇' : '陪伴的礼物'}</small><strong>${title}</strong><p>${description}</p></div>${action}</div><button class="book-reward-close" data-book-reward-dismiss aria-label="关闭解锁提示">${bookIcon('close')}</button></section>`;
}
const dailyLabels={feed:'喂食',pet:'摸摸',play:'逗猫',sleep:'陪小猫入睡'};
function condition(cat) {
  return cat.requirements.map(({metric,target}) => {
    if(metric === 'boost')return '激活 ×1.3 成长加成（饱饱、开心、活力均大于 80）';
    if(metric === 'dress')return `成功切换装扮 ${target} 次`;
    if(metric.startsWith('daily-'))return `当日${dailyLabels[metric.slice(6)]} ${target} 次`;
    if(metric.startsWith('win-'))return `${{rps:'石头剪刀布',memory:'猫猫翻牌',gomoku:'五子棋'}[metric.slice(4)]}累计获胜 ${target} 局`;
    if(metric === 'diary-cards')return `解锁猫猫日记中的 ${target} 张卡片`;
    if(metric === 'level')return `小猫成长到 Lv.${target}`;
    if(metric === 'foods')return `喂过 ${target} 种不同的食物`;
    if(metric === 'care')return `累计照顾小猫 ${target} 次（喂食、摸摸、玩耍或哄睡）`;
    return `累计${{feed:'喂食',pet:'摸摸',play:'玩耍',sleep:'陪小猫入睡',pair:'完成双人喂养'}[metric]} ${target} ${metric === 'pair' ? '轮' : '次'}`;
  }).join('，并');
}
function status(progress) { return progress.invited ? '已入住' : progress.complete ? '可邀请' : '待相遇'; }
function progressText(cat, progress) {
  const counts=progress.requirements.map(({metric,current,target}) => {
    if(metric === 'diary-cards')return `日记卡片 ${Math.min(current,target)} / ${target} 张`;
    if(metric === 'boost')return `最高记录 ×${((10+current)/10).toFixed(1)} / ×1.3`;
    if(metric.startsWith('daily-'))return `${Math.min(current,target)} / ${target} · 单日最高`;
    return metric === 'level' ? `Lv.${current} / Lv.${target}` : `${progress.requirements.length > 1 ? {feed:'喂食 ',foods:'食物 '}[metric] || '' : ''}${Math.min(current,target)} / ${target}`;
  }).join(' · ');
  return progress.invited && !progress.achieved ? `已收集，陪伴记录保留 · 进阶 ${counts}` : counts;
}
function unlockHelp(cat,progress) {
  if(progress.invited)return '';
  if(progress.complete)return '<section class="book-unlock-help is-ready"><h3>已经可以邀请啦</h3><p>解锁条件已达成，点击下方邀请按钮，免费迎接这位新朋友。</p></section>';
  const remaining=progress.requirements.filter(r=>!r.complete).map(({metric,current,target})=>{
    const left=target-current;
    const number=`<strong>${left}</strong>`;
    if(metric==='boost')return '尚未激活 <strong>×1.3</strong> 成长加成';
    if(metric==='dress')return `还需成功更换装扮 ${number} 次`;
    if(metric==='diary-cards')return `还需解锁 ${number} 张猫猫日记卡片`;
    if(metric==='level')return `还需升 ${number} 级，达到 Lv.${target}`;
    if(metric==='foods')return `还需尝过 ${number} 种不同的食物`;
    if(metric.startsWith('daily-'))return `最高单日${dailyLabels[metric.slice(6)]}记录还差 ${number} 次`;
    if(metric.startsWith('win-'))return `还需赢得${{rps:'石头剪刀布',memory:'猫猫翻牌',gomoku:'五子棋'}[metric.slice(4)]} ${number} 局`;
    return `还需${{care:'照顾小猫',feed:'喂食',pet:'摸摸',play:'逗猫',sleep:'陪小猫入睡',pair:'完成双人喂养'}[metric]} ${number} ${metric==='pair'?'轮':'次'}`;
  });
  const careTips={feed:'回小窝，点击「喂食」并选择食物。',pet:'回小窝，点击「摸摸」或直接摸摸小猫。',play:'回小窝，点击「逗猫」和小猫玩耍。',sleep:'回小窝，点击「休息」陪小猫入睡。',care:'回小窝，喂食、摸摸、逗猫或陪小猫入睡均可。'};
  const tips=new Set(cat.requirements.map(({metric,target})=>{
    if(metric.startsWith('daily-'))return `${careTips[metric.slice(6)]}需在同一天完成 ${target} 次，跨日次数不相加；达成后记录永久保留。`;
    if(metric.startsWith('win-'))return `回小窝，打开「小游戏」中的「${{rps:'石头剪刀布',memory:'猫猫翻牌',gomoku:'五子棋'}[metric.slice(4)]}」，完成整局并获胜。单人挑战成功、战胜电脑或双人中任一真人获胜都计入。`;
    if(metric==='diary-cards')return '打开「日记 → 待解锁」查看达成方法。照顾、成长里程碑和双人互动会自动留下卡片；按时光轴中的正式卡片累计，同一卡片收藏或生成纪念卡不会重复计数。';
    if(metric==='foods')return '回小窝，点击「喂食」，选择还没喂过的食物，每种食物只计一次。';
    if(metric==='pair')return '回小窝，打开「喂食」，两位主人在同一轮各喂一份，完成一次双人喂养。';
    if(metric==='level')return '回小窝照顾小猫，领取成长气泡来升级。';
    if(metric==='dress')return '回小窝，点击「装扮」，给小猫换一个不同的装扮并保存，单纯预览不计入。';
    if(metric==='boost')return '回小窝，通过喂食、摸摸和休息，让饱饱、开心、活力都大于 80，获得 ×1.3 成长加成。';
    return `${careTips[metric]}两位主人的有效次数会共同累计。`;
  }));
  return `<section class="book-unlock-help" aria-label="如何解锁${cat.name}"><div class="book-unlock-remaining"><h3>还差多少</h3><ul>${remaining.map(text=>`<li>${text}</li>`).join('')}</ul></div><div class="book-unlock-steps"><h3>如何完成</h3>${[...tips].map(text=>`<p>${text}</p>`).join('')}</div></section>`;
}

function sheet(id, title, content, backLabel) {
  return `<dialog class="book-sheet book-sheet-${id}" data-book-sheet="${id}" aria-labelledby="book-sheet-${id}-title"><div class="book-sheet-handle" aria-hidden="true"></div><header class="book-sheet-header">${backLabel ? `<button class="book-sheet-back" data-book-detail-back aria-label="${backLabel}">${bookIcon('back')}</button>` : ''}<h2 id="book-sheet-${id}-title">${title}</h2><button class="book-sheet-close" data-book-dismiss aria-label="关闭${title}">${bookIcon('close')}</button></header><div class="book-sheet-scroll">${content}</div></dialog>`;
}
const yardPosition = placement => `--slot-x:${placement.x}%;--slot-y:${placement.y}%;--cat-size:${placement.size}%;--cat-baseline:${placement.baseline}%;--pose-ratio:${placement.ratio};`;
function yardResidentArt(cat,placement,patrolling) {
  if(patrolling) {
    const walk=walkingSprite(cat);
    return `<span class="book-cat-patrol"><span class="book-cat-patrol-facing"><span class="book-scene-cat" style="background-image:url('${asset(walk.texture)}');aspect-ratio:${walk.ratio};background-size:${walk.backgroundSize};background-position:var(--walk-a);--walk-a:${walk.a};--walk-b:${walk.b}" aria-hidden="true"></span></span></span>`;
  }
  return `<span class="book-scene-cat" style="${placement.texture ? `background-image:url('${asset(placement.texture)}');` : ''}background-size:${placement.backgroundSize};background-position:${placement.backgroundPosition}" aria-hidden="true"></span>`;
}
function yardCatArt(markup, scene, placement) {
  const clip=sceneCatClipPath(scene,placement);
  const glass=sceneCatGlassShapes(scene,placement);
  const foreground=glass.length ? `<svg class="book-cat-glass" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${glass.map(shape=>`<polygon points="${shape.points}" fill="${shape.fill}" fill-opacity="${shape.opacity ?? .96}"/>`).join('')}</svg>` : '';
  const prop=placement.prop ? `<span class="book-cat-prop" ${Number.isFinite(placement.propTop) ? `style="top:${placement.propTop}%"` : ''} aria-hidden="true"><svg viewBox="0 0 100 85" fill="none" stroke="#44382f" stroke-width="3.5" stroke-linejoin="round">${placement.prop === 'bucket' ? '<path d="M12 18 21 73Q50 87 79 73L88 18" fill="#6fb4d9"/><ellipse cx="50" cy="18" rx="38" ry="13" fill="#a2cee4"/><path d="M19 24q31 13 62 0M24 33q-8 40 21 41"/>' : '<path d="M5 17 48 5 95 20 54 36Z" fill="#d9b16a"/><path d="M5 17v49l49 16V36Z" fill="#bb8f4d"/><path d="M54 36v46l41-19V20Z" fill="#d1a357"/><path d="m18 23 32 11 30-11"/>'}</svg></span>` : '';
  return prop+(clip ? `<span class="book-cat-window" style="clip-path:${clip}">${markup}${foreground}</span>` : markup);
}
function yardSilhouette(cat, scene, placement, collected=false) {
  const silhouette=CAT_SILHOUETTES[cat.id];
  const width=Number(silhouette.viewBox.split(' ')[2]);
  const art=`<svg class="book-cat-silhouette" viewBox="${silhouette.viewBox}" fill="#bcbdb9" fill-opacity=".9" stroke="${cat.reviewOutline ? '#e74f46' : '#525952'}" stroke-width="${width * .028}" stroke-dasharray="${width * .07} ${width * .055}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${silhouette.path}" fill-rule="evenodd"/></svg>`;
  return `<button type="button" class="book-yard-placeholder ${cat.reviewOutline ? 'is-reference-addition' : ''}" data-book-locked-cat="${cat.id}" data-book-cat="${cat.id}" ${cat.reviewOutline ? 'data-book-new="true"' : ''} aria-haspopup="dialog" aria-label="查看${cat.name}的${collected ? '场景邀请，尚未来访' : '解锁条件，尚未入住'}，${placement.surface}的未解锁轮廓${cat.reviewOutline ? '，本轮新增' : ''}" title="${collected ? `邀请${cat.name}来${scene.name}` : `点击查看${cat.name}的解锁条件`}" style="${yardPosition(placement)}z-index:${Math.round(placement.y)}">${yardCatArt(art,scene,placement)}</button>`;
}

export function catbookMarkup(state, { tab='book', catId='bandit', sceneId=DEFAULT_CAT_SCENE, saving=false, connected=true, detailFromCatalog=false, arrivingCatId=null, settlingCatId=null, arrivalAge=0 } = {}) {
  const level = levelInfo(state.xp).level;
  const ledger = state.collection;
  const invitedCount = ledger.invited.length;
  const selected = getCollectionCat(catId) || COLLECTION_CATS[0];
  const selectedProgress = collectionCatProgress(selected, ledger, level, state.diary);
  const scene = collectionScene(sceneId, ledger, level, state.diary);
  const invitationScene=catArrivalScene(scene,selected);
  const selectedVisit=collectionSceneInvitation(ledger,selected.id,invitationScene.id);
  const residences = CAT_SCENES.filter(option=>sceneAllowsCat(option,selected));
  const exclusiveScene = residences.length === 1 ? residences[0] : null;
  const residenceNote = exclusiveScene ? `常驻${exclusiveScene.name} · 邀请后前往车站相遇` : residences.length < CAT_SCENES.length ? `可在${residences.map(option=>option.name).join('、')}相遇` : '';
  const [sceneWidth, sceneHeight] = scene.ratio.split('/').map(Number);
  const canInvite = selectedProgress.complete && !selectedVisit && !saving && connected;
  const invitedIds = new Set(COLLECTION_CATS.filter(cat=>collectionSceneInvitation(ledger,cat.id,scene.id)).map(cat=>cat.id));
  const residents = COLLECTION_CATS.filter(cat=>sceneAllowsCat(scene,cat));
  const ready=residents.filter(cat=>collectionCatProgress(cat,ledger,level,state.diary).complete && !invitedIds.has(cat.id)).length;
  const visitors = residents.filter(cat=>invitedIds.has(cat.id));
  const silhouettes = residents.filter(cat=>!invitedIds.has(cat.id));
  const sceneChoices = `<div class="book-scene-choices" role="group" aria-label="选择猫猫场景">${CAT_SCENES.map(option => {
    const progress=collectionSceneProgress(option,ledger,level,state.diary);
    return `<button data-book-scene="${option.id}" class="book-scene-choice ${option.id === scene.id ? 'selected' : ''}" aria-pressed="${option.id === scene.id}" ${progress.complete ? '' : 'disabled'}><span class="book-scene-preview" style="background-image:url('${asset(option.asset || option.id)}')" aria-hidden="true"></span><span class="book-scene-copy"><strong>${option.name}</strong><small>${progress.complete ? option.subtitle : `未解锁 · ${option.min} 位已入住猫友达成进阶陪伴成就（${progress.current} / ${progress.target}）`}</small></span>${bookIcon(!progress.complete ? 'lock' : option.id === scene.id ? 'check' : option.icon)}</button>`;
  }).join('')}</div><p class="book-about-note">场景进度只统计达到当前陪伴成就门槛的已入住猫友。游戏和日常猫友主要在车站相遇，墨影和枫糖也会来日式庭院；金铃会出现在车站、西部露台和暖暖雪庭。</p>`;
  const detail = `<article class="book-detail" aria-label="${selected.name}的图鉴详情"><span class="book-detail-number">CAT NO.${String(selected.index + 1).padStart(2,'0')}<b class="book-state ${status(selectedProgress) === '可邀请' ? 'ready' : ''}">${selectedProgress.invited ? '已收集' : status(selectedProgress)}</b></span><div class="book-detail-art">${catSprite(selected, selectedProgress.invited ? '' : 'undiscovered')}</div><h2 tabindex="-1">${selected.name}<span>${selected.english}</span></h2><p class="book-personality">${selected.personality}</p>${selectedProgress.invited && !selectedVisit ? `<section class="book-unlock-help is-ready"><h3>邀请老朋友来${invitationScene.name}</h3><p>图鉴已经收集，免费邀请它来这里做客吧。</p></section>` : unlockHelp(selected,selectedProgress)}<div class="book-achievement-card"><span>${bookIcon('trophy')} ${selected.achievement}</span><p>${condition(selected)}</p><div class="book-achievement-progress"><i style="width:${selectedProgress.fraction * 100}%"></i></div><small>${progressText(selected, selectedProgress)}${selectedProgress.achieved ? ' · 已达成' : selectedProgress.invited ? ' · 场景进阶未达标' : ''}</small></div><button class="book-invite" data-book-invite="${selected.id}" data-book-invite-scene="${invitationScene.id}" ${canInvite ? '' : 'disabled'}>${bookIcon(selectedVisit ? 'check' : 'paw')} ${selectedVisit ? `已经在${invitationScene.name}等你啦` : saving ? '正在保存这次相遇…' : !connected ? '等待小窝连接' : selectedProgress.complete ? `邀请${selected.name}加入${invitationScene.name}` : '完成成就后可邀请'}</button><div class="book-scene-visits">${residences.map(option=>`<span class="${collectionSceneInvitation(ledger,selected.id,option.id) ? 'visited' : ''}">${option.name} · ${collectionSceneInvitation(ledger,selected.id,option.id) ? '已邀请' : '尚未邀请'}</span>`).join('')}</div><p class="book-detail-note">图鉴只收集一次，每个场景需要单独邀请，邀请免费。<br>${residenceNote ? `${residenceNote}<br>` : ''}${selected.metric.startsWith('daily-') ? '每日成就由小窝共享，需在同一天达成；记录永久保留，跨日不会重新上锁。<br>' : ''}${selectedProgress.invited ? `${new Date(selectedProgress.invited.at).toLocaleDateString('zh-CN', { month:'long', day:'numeric' })} · 第一次来到你们的庭院` : '邀请免费 · 相遇与成就会留在小窝存档中'}</p></article>`;
  const catalog = `<section class="book-catalog"><div class="book-catalog-heading"><div class="book-tabs" role="tablist" aria-label="图鉴和成就"><button role="tab" id="book-tab-book" data-book-tab="book" aria-controls="book-panel" aria-selected="${tab === 'book'}" tabindex="${tab === 'book' ? 0 : -1}">${bookIcon('book')} 猫猫图鉴</button><button role="tab" id="book-tab-achievements" data-book-tab="achievements" aria-controls="book-panel" aria-selected="${tab === 'achievements'}" tabindex="${tab === 'achievements' ? 0 : -1}">${bookIcon('trophy')} 陪伴成就</button></div><span class="book-ready-count">${ready ? `${bookIcon('sparkle')} ${ready} 位新朋友等你邀请` : '小小陪伴，慢慢收集'}</span></div><div id="book-panel" role="tabpanel" aria-labelledby="book-tab-${tab}" class="${tab === 'book' ? 'book-cat-grid' : 'book-achievement-grid'}">${COLLECTION_CATS.map(cat => {
    const progress = collectionCatProgress(cat, ledger, level, state.diary);
    const localStatus=!sceneAllowsCat(scene,cat) ? '在其他庭院相遇' : invitedIds.has(cat.id) ? '本场景已邀请' : progress.complete ? '本场景可邀请' : '待相遇';
    return tab === 'book' ? `<button class="book-cat-card ${cat.id === selected.id ? 'selected' : ''} ${progress.invited ? 'collected' : progress.complete ? 'ready' : 'locked'}" data-book-cat="${cat.id}" aria-pressed="${cat.id === selected.id}" aria-label="查看${cat.name}，${status(progress)}，${localStatus}"><span class="book-card-number">${String(cat.index + 1).padStart(2,'0')}</span>${catSprite(cat, progress.invited ? '' : 'undiscovered')}<strong>${cat.name}</strong><small>${cat.english}</small><span class="book-card-status">${bookIcon(progress.invited ? 'check' : progress.complete ? 'sparkle' : 'lock')}${status(progress)}</span><span class="book-card-visit">${localStatus}</span></button>` : `<button class="book-achievement-row ${progress.complete ? 'complete' : ''}" data-book-cat="${cat.id}" aria-label="${cat.achievement}，${condition(cat)}，${progressText(cat, progress)}"><span class="book-achievement-art">${catSprite(cat, progress.invited ? '' : 'undiscovered')}</span><span class="book-achievement-copy"><strong>${cat.achievement}</strong><small>${condition(cat)}</small><span class="book-achievement-progress"><i style="width:${progress.fraction * 100}%"></i></span><em>${progressText(cat, progress)} · ${progress.invited ? `${cat.name}已入住` : progress.complete ? `可邀请${cat.name}` : `将遇见${cat.name}`}</em></span><span class="book-achievement-mark">${bookIcon(progress.complete ? 'check' : 'lock')}</span></button>`;
  }).join('')}</div></section>`;
  const about = `<section class="book-intro"><span class="book-eyebrow">LITTLE PAWS, BIG LITTLE WORLD</span><h3>把陪伴，变成新的相遇</h3><p>和${esc(state.name)}一起，邀请更多猫猫来做客。</p>${!visitors.length ? `<div class="book-empty-yard" aria-label="这里，正等着第一位朋友"><button data-book-cat="bandit">${bookIcon('paw')} 邀请斑斑来${scene.name}</button></div>` : ''}<div class="book-about-collection"><span>${bookIcon('paw')} 已相遇的猫友</span><strong>${invitedCount}<small> / ${COLLECTION_CATS.length}</small></strong></div><ol class="book-about-steps"><li><strong>一点点照顾</strong><p>回到小窝，照顾、换装、激活成长加成，也可以赢得小游戏，慢慢邀请新猫友。</p></li><li><strong>邀请新朋友</strong><p>打开图鉴或点击虚线轮廓，邀请猫猫加入当前庭院。同一只猫在每个场景都需要单独邀请，图鉴只收集一次。新猫友主要在车站相遇，墨影和枫糖也会来日式庭院。</p></li><li><strong>自在地待着</strong><p>左右拖动庭院，看看猫猫晒太阳、打盹、玩耍。虚线轮廓是等待相遇的朋友；编号 25–36 用红色虚线标记。点击可以查看解锁条件和进度，邀请后会点亮。点点已邀请的猫猫，它会动一动、说句话。特别的朋友会聊天，点击任意猫猫继续下一句；睡觉的猫猫会轻轻打呼。想了解它时，可以从猫猫图鉴打开小档案。</p></li></ol><p class="book-about-note">${saving ? '正在保存这次相遇…' : connected ? '每一次相遇，都会留在你们的小窝里。' : '小窝连接后，就可以邀请新的猫友。'}</p></section>`;
  return `<main class="catbook" aria-label="猫猫沉浸式庭院" style="--scene-ratio:${scene.ratio};--scene-aspect:${sceneWidth / sceneHeight}"><section class="book-yard-section" aria-label="猫猫庭院"><div class="book-yard-camera" role="region" aria-label="${scene.name}，左右拖动浏览庭院" tabindex="0"><div class="book-yard" data-scene-id="${scene.id}"><img class="book-yard-background" src="${asset(scene.asset || scene.id)}" alt="${scene.name}，已入住猫猫与等待相遇的灰色轮廓" draggable="false"/><div class="book-visitors" role="group" aria-label="已入住猫猫与未解锁猫猫轮廓">${silhouettes.map(cat=>yardSilhouette(cat,scene,sceneCatPlacement(scene,cat),ledger.invited.some(record=>record.id===cat.id))).join('')}${visitors.map(cat => {
    const placement = sceneCatPlacement(scene, cat);
    const patrolling=cat.id === 'cloudcap' && cat.id !== arrivingCatId && cat.id !== settlingCatId;
    return `<button class="book-yard-cat pose-${placement.motion} ${patrolling ? 'is-patrolling' : ''} ${cat.reviewOutline ? 'is-reference-addition' : ''} ${cat.id === arrivingCatId ? 'is-arriving' : cat.id === settlingCatId ? 'is-new-arrival' : ''}" ${cat.id === arrivingCatId ? 'disabled aria-busy="true"' : ''} data-book-cat="${cat.id}" ${cat.reviewOutline ? 'data-book-new="true"' : ''} aria-label="摸摸${cat.name}，已加入${scene.name}，${placement.activity}${cat.reviewOutline ? '，本轮新增' : ''}" style="${yardPosition(placement)}--idle-delay:${cat.index * -.4}s;--arrival-age:${-arrivalAge}ms;z-index:${Math.round(placement.y)}">${yardCatArt(yardResidentArt(cat,placement,patrolling),scene,placement)}${placement.toy ? '<span class="book-yarn-ball" aria-hidden="true"></span>' : ''}<span class="book-visitor-name">${cat.name}</span></button>`;
  }).join('')}</div><div class="book-arrivals" aria-hidden="true"></div></div></div></section><header class="book-game-topbar"><button class="book-game-round" data-catbook-back aria-label="返回小窝">${bookIcon('back')}</button><button class="book-location" data-book-open="scenes" aria-label="切换庭院，当前${scene.name}">${bookIcon(scene.icon)}<span>${scene.name}</span></button><button class="book-game-round" data-book-open="about" aria-label="庭院介绍">${bookIcon('info')}</button></header><nav class="book-game-menu" aria-label="庭院菜单"><button data-book-open="catalog" data-book-page="book" aria-label="打开猫猫图鉴，已收集${invitedCount}只猫猫，本场景已邀请${visitors.length}只"><span>${bookIcon('book')}${ready ? `<i class="book-menu-badge">${ready}</i>` : ''}</span><strong>猫猫图鉴</strong><small>${visitors.length} / ${residents.length}</small></button><button data-book-open="catalog" data-book-page="achievements" aria-label="打开陪伴成就"><span>${bookIcon('trophy')}</span><strong>陪伴成就</strong></button><button data-book-open="scenes" aria-label="选择庭院场景"><span>${bookIcon(scene.icon)}</span><strong>切换场景</strong></button></nav>${sheet('about','庭院介绍',about)}${sheet('catalog','猫友手账',catalog)}${sheet('detail','猫猫详情',detail,detailFromCatalog ? '返回图鉴' : '返回庭院')}${sheet('scenes','选择庭院',sceneChoices)}</main>`;
}
