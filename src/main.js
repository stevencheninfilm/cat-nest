import './style.css';
import './feeding.css';
import './home-ui.css';
import './growth.css';
import './growth-stages.css';
import './cat-speech.css';
import './cat-behavior.css';
import './companion.css';
import './catbook.css';
import './growth-bars.css';
import './pet-needs.css';
import './diary.css';
import './couple-presence.css';
import './minigames.css';
import { createIcons, PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, ArrowRight, Shirt, EyeOff } from 'lucide';
import { FOODS, initialState, normalizeState, reduceAction, levelInfo, careActionInfo } from './state';
import { petNeeds, growthRewardAmount, NEED_KEYS, NEED_LABELS } from './pet-needs.js';
import { needButtons, needDetails, growthBonusBadge, growthBonusDetails } from './pet-needs-ui.js';
import { createNeedsFeedback } from './pet-needs-feedback.js';
import { COUPLE_ROLES, normalizeCoupleRole, getCoupleProfile } from './couple-profile.js';
import { presenceForRole, homePresence, rolePicker, connectionSummary } from './couple-presence-ui.js';
import { createCloudRoom } from './cloud';
import { homeContext, homeStorageKey, initialHomeState } from './home-context.js';
import { createCatSpeech } from './cat-speech.js';
import { catTemperament } from './cat-behavior.js';
import { resolveInteraction, getInteractionHint } from './interaction-mode';
import { feedingHome, feedingSheet, feedingButtonContent, countdown, updateFoodPortions } from './feeding-ui';
import { careQuotaText, careStatusText, careBlockedMessage, careRuleText } from './care-ui.js';
import { growthBubbles, growthTray, growthLabel, jellyHeartMarkup } from './growth-ui.js';
import { growthStageForXp, getGrowthStageById, stageStyle, growthUpgrade } from './growth-stages.js';
import { growthStagesPanel, growthUpgradePanel } from './growth-stage-ui.js';
import { APPEARANCE_OPTIONS, normalizeAppearance, MAGE_CAT_VERSION, MAGE_CAT_AUTHOR } from './mage-cat-config.js';
import { createCompanionMode } from './companion-mode.js';
import { createCatbook } from './catbook.js';
import { getCollectionCat } from './cat-collection.js';
import { catSprite } from './catbook-ui.js';
import { diaryTimeline } from './diary-ui.js';
import { minigamesPanel } from './minigames-ui.js';

const ICONS = { PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, ArrowRight, Shirt, EyeOff };
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const $ = s => document.querySelector(s);
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const home = homeContext(location.pathname);
if (home.id === 'steven') document.title = 'Steven · 猫猫小窝';
if (home.id === 'evian') document.title = 'Evian · 猫猫小窝';
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(homeStorageKey(key,home))) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(homeStorageKey(key,home), JSON.stringify(value)); } catch { /* private browsing can disable storage */ } }
const params = new URLSearchParams(location.search);
// A remembered role is only a hint; every visit begins with an explicit choice.
let coupleRole = normalizeCoupleRole(read('catnest.role', null));
let roleEntered = false;
let profile = getCoupleProfile(coupleRole) || { name:'请选择身份' };
let clientId = profile.clientId || '';
const cachedRoom = read('catnest.couple.room', null) || read('catnest.room', null);
let roomId = home.roomId || (/^[a-f0-9]{32}$/.test(cachedRoom || '') ? cachedRoom : 'couple-local');
let state = normalizeState(read(`catnest.state.${roomId}`, initialHomeState(home)));
let confirmedState = state;
const cleanUrl = new URL(location.href);
cleanUrl.searchParams.delete('room');
history.replaceState(null, '', cleanUrl);
let selectedFood = read('catnest.food', 'meal');
if (!Object.hasOwn(FOODS, selectedFood)) selectedFood = 'meal';
let feedingTab = 'menu', foodCategory = 'all';
let catModel = null;
let catbook = null;
let appearanceDraft=normalizeAppearance(state.appearance),appearanceTab='body',appearanceSubmitting=false;
let sound = read('catnest.sound', false);
let cloud = null;
const localPetPreview = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PET_PREVIEW === true;
const apiBase = import.meta.env.VITE_API_URL || (localPetPreview || location.hostname.endsWith('.onrender.com') ? location.origin : '');
let cloudConfigured = Boolean(apiBase);
const modelAssetBase=import.meta.env.VITE_MODEL_URL || `${apiBase || location.origin}/api/pet-model/${MAGE_CAT_VERSION}`;
let saveStatus = { phase:'local', message:'本机预览 · 云端待连接' };
let status = { phase:'solo', message:'选择身份，回到你们的小窝' };
let members = [];
let presenceKnown = false;
let actionLocked = false;
let pendingCloudActions = 0;
let pendingGrowthClaims = new Set();
let toastTimer;
let gameLobby = true, gameSelectedGame = null, gameSelectedCell = null, gameSelectionStep = null, gameLastMarkup = '', gameRenderedId = '';
let computerTurnTimer = null, computerTurnKey = '';

let careFeedbackKey = '', careFeedbackAt = 0;
let growthPage = 0, claimingRewardId = null, growthGlowTimer;
let stagePreviewId = null, pendingUpgrade = null, upgradeTimer, lastCelebratedStage = 0;
const rewardVisuals = new Map();
const claimOrigins = new Map();



$('#app').innerHTML = `
<main class="nest" aria-label="猫猫小窝养成游戏">
  <div class="room-backdrop"></div><div class="warm-overlay"></div><div class="sun-dust" aria-hidden="true"></div>
  <header class="topbar"><a class="brand" href="${home.href}" aria-label="猫猫小窝首页"><span class="brand-mark">${icon('paw-print')}</span><span>猫猫小窝<small>A LITTLE HOME, A LOT OF LOVE</small></span></a><div class="topbar-actions"><button class="companion-entry" data-companion-enter aria-label="沉浸陪伴，隐藏全部界面" title="隐藏全部界面，安静陪猫猫">${icon('eye-off')}<span>沉浸陪伴</span></button><button class="round-button settings-button" data-open="settings" aria-label="设置">${icon('settings-2')}</button></div></header>
  <div class="wallet" aria-label="养成资源"><div class="currency"><span class="coin-icon">${icon('paw-print')}</span><strong id="coins">1,200</strong><span class="currency-label">猫爪币</span></div><div class="currency"><span class="heart-icon">${icon('heart')}</span><strong id="love">86</strong><span class="currency-label">亲密度</span></div><button class="currency level-currency" data-open="stages" aria-label="查看全部成长阶段"><span class="level-heart" data-live-growth-heart></span><strong id="top-level">Lv.1</strong><span class="currency-label">成长</span></button></div>
  <button class="together" data-open="roles" aria-label="查看双方在线状态和切换身份"><span class="together-presence" id="together-presence"></span><span class="together-link" id="together-cta">进入 ›</span></button>
  <div class="scene"><div class="speech-bubble" id="speech" role="status" aria-live="polite" aria-atomic="true" hidden><span class="speech-speaker" aria-hidden="true">${icon('paw-print')}<span class="speech-name"></span><span class="speech-dots"><i></i><i></i><i></i></span></span><span class="speech-text" aria-hidden="true"><span class="speech-content"></span></span><span class="sr-only speech-announcement"></span></div><button class="cat-button" id="cat" aria-label="摸摸糯米"><img class="kitten" src="./assets/kitten.webp" alt="坐在暖暖房间里的橘色小猫糯米" fetchpriority="high" draggable="false"/></button><button class="model-status" id="retry-cat-model" disabled aria-live="polite">小猫正在回家…</button><div class="cat-shadow"></div><div id="particles" aria-hidden="true"></div><div class="growth-rewards" id="growth-rewards" role="group" aria-label="待领取的成长气泡"></div></div>
  <div class="side-actions left-actions"><button data-action="pet" aria-label="摸摸小猫"><span>${icon('hand')}</span><small>摸摸</small><em class="care-badge" data-care-badge="pet"></em></button><button data-action="play" aria-label="用逗猫棒陪小猫玩"><span>${icon('wand-sparkles')}</span><small>逗猫</small><em class="care-badge" data-care-badge="play"></em></button><button class="game-entry" data-open="games" aria-label="小游戏，进入猫猫游戏屋"><span><img src="./assets/minigames/game-entry-v1.webp" width="44" height="44" alt="" aria-hidden="true" draggable="false" decoding="async"/></span><small>小游戏</small></button></div>
  <div class="side-actions right-actions"><button data-open="diary" aria-label="查看养猫日记"><span>${icon('notebook-pen')}</span><small>日记</small></button><button data-action="sleep" id="sleep-button" aria-label="让小猫休息"><span>${icon('moon')}</span><small>休息</small><em class="care-badge" data-care-badge="sleep"></em></button><button data-open="appearance" aria-label="给小猫换装扮"><span>${icon('shirt')}</span><small>装扮</small></button></div>
  <section class="pet-card glass" aria-label="小猫状态"><div class="pet-title"><button class="pet-name" data-open="rename"><strong id="pet-name">糯米</strong>${icon('pencil')}</button><span class="level-badge"><span class="level-badge-heart" data-live-growth-heart></span><b id="level">Lv.1</b></span>${growthBonusBadge()}</div><div class="xp-row"><span class="xp-stage-heart" data-live-growth-heart></span><div class="progress-track" role="progressbar" aria-label="小猫成长进度" aria-valuemin="0"><div id="xp-bar"></div></div><span id="xp">86 / 120</span></div><div class="needs" aria-label="小猫状态，点击查看详情">${needButtons()}</div></section>
  <button class="feeding-preview glass" data-open="feeding" aria-label="查看当前餐食和双方喂养状态">${feedingHome({ state, clientId, members, selectedFood })}</button>
  <button class="feed-button" id="feed-button">${icon('paw-print')}<span>喂食</span><span class="feed-love">+25 ${icon('heart')}</span><span class="button-sparkle">✦</span><small class="feed-care-badge" data-care-status="feed" data-care-compact="true"></small></button>
  <nav class="bottom-nav" aria-label="小窝导航"><button class="nav-entry judge" data-open="judge"><span class="nav-icon">${icon('gavel')}</span><span>猫猫判官<small>CAT JUDGE</small></span></button><span class="home-note">${icon('heart')}<span id="save-status" aria-live="polite">本机预览 · 云端待连接</span></span><button class="nav-entry home catbook-entry" data-open="collection" aria-label="猫猫图鉴，查看成就和邀请新猫猫"><span class="nav-icon book-nav-icon">${catSprite(getCollectionCat('bandit'))}<b class="book-nav-count" id="catbook-nav-count" aria-hidden="true" hidden></b></span><span>猫猫图鉴<small>CAT BOOK</small></span></button></nav>
  <div class="connection-note" id="connection-note" aria-live="polite"></div>
  <div class="companion-controls" id="companion-controls" hidden><button class="companion-exit" data-companion-exit>${icon('x')}<span>退出沉浸</span></button><p class="companion-hint" id="companion-hint"><strong>只留下你和猫猫</strong>点点猫猫，继续互动<br/>轻点空白处显示退出按钮 · Esc 返回小窝</p></div>
</main>
<dialog id="modal"><button class="modal-close round-button" id="modal-close" aria-label="关闭弹窗">${icon('x')}</button><div class="modal-content" id="modal-content"></div></dialog>
<div class="toast" id="toast" role="status"></div>`;
const catSpeech = createCatSpeech({
  element:$('#speech'), getState:() => ({ ...state, ...petNeeds(state), behaviorPeriod:catTemperament(state).period }),
  canSpeak:() => roleEntered && !document.hidden && !$('.nest').hidden && !$('.nest').classList.contains('is-companion') && (!$('#modal').open || $('#modal-content').dataset.view === 'feeding'),
  reducedMotion:() => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});
const companion = createCompanionMode({ nest:$('.nest'), cat:$('#cat'), controls:$('#companion-controls'), onChange() {
  clearTimeout(toastTimer); $('#toast').classList.remove('visible');
  render(); updateModelPause(); if (!companion.active) scheduleUpgrade();
} });
function renderIcons() { createIcons({ icons: ICONS, attrs: { 'stroke-width': 1.8 } }); }
const needsFeedback = createNeedsFeedback({ root:$('.needs'), canAnimate:() =>
  roleEntered && !document.hidden && !$('.nest').hidden && !companion.active,
});
renderIcons();
function render() {
  const level = levelInfo(state.xp);
  const stage = growthStageForXp(state.xp);
  // Every device derives the same skin from the authoritative saved XP.
  for (const declaration of stageStyle(stage).split(';')) {
    const separator = declaration.indexOf(':');
    const property = declaration.slice(0, separator), value = declaration.slice(separator + 1);
    document.documentElement.style.setProperty(property,value);
  }
  for (const element of document.querySelectorAll('[data-live-growth-heart]')) {
    if (element.dataset.stage !== stage.id) { element.innerHTML=jellyHeartMarkup(stage); element.dataset.stage=stage.id; }
  }
  $('.level-currency').setAttribute('aria-label', `查看全部成长阶段，当前 ${level.level} 级，${stage.name}`);
  $('#coins').textContent = state.coins.toLocaleString('en-US');
  $('#love').textContent = state.love.toLocaleString('en-US');
  $('#top-level').textContent = `Lv.${level.level}`;
  $('#level').textContent = `Lv.${level.level}`;
  $('#pet-name').textContent = state.name;
  $('#catbook-nav-count').textContent = state.collection.invited.length;
  $('#catbook-nav-count').hidden = state.collection.invited.length === 0;
  $('#cat').setAttribute('aria-label', `和${state.name}互动`);
  if (companion.active) $('#cat').removeAttribute('title');
  else $('#cat').title = getInteractionHint('random', { ...state, ...petNeeds(state) });
  $('.kitten').alt = `坐在暖暖房间里的橘色小猫${state.name}`;
  $('#xp').textContent = `${level.progress} / ${level.target}`;
  $('#xp-bar').style.width = `${level.progress / level.target * 100}%`;
  $('.progress-track').setAttribute('aria-valuenow', level.progress);
  $('.progress-track').setAttribute('aria-valuemax', level.target);
  $('.feed-love').firstChild.textContent = `+${growthRewardAmount(FOODS[selectedFood].love,petNeeds(state).boostCount)} `;
  renderNeeds();
  catModel?.setState({ sleeping:state.sleeping, appearance:$('#modal').open && $('#modal-content').dataset.view==='appearance' ? appearanceDraft : state.appearance });
  $('.nest').classList.toggle('sleeping', state.sleeping);
  $('#sleep-button small').textContent = state.sleeping ? '叫醒' : '休息';
  $('#sleep-button').setAttribute('aria-label', state.sleeping ? '轻轻叫醒小猫' : '让小猫休息');
  save(`catnest.state.${roomId}`, cloudConfigured ? confirmedState : state);
  renderFeedingHome();
  renderGrowth();
  refreshStagesPanel();
  refreshFeedingSheet();
  updateCareControls();
  catbook?.render();
  refreshGames();
}
function renderConnection() {
  refreshGames();
  const options = presenceOptions();
  const together = COUPLE_ROLES.every(role => presenceForRole(role, options).state === 'online');
  $('.together').classList.toggle('connected', together);
  const content = homePresence(options);
  if ($('#together-presence').innerHTML !== content) $('#together-presence').innerHTML = content;
  for (const role of COUPLE_ROLES) {
    const presence = presenceForRole(role, options);
    for (const badge of document.querySelectorAll(`[data-presence-role="${role.id}"]`)) {
      badge.dataset.presenceState = presence.state;
      badge.querySelector('span').textContent = presence.label;
    }
    const choice = $(`[data-couple-role="${role.id}"]`);
    if (choice) choice.setAttribute('aria-label', `${role.name}，${presence.label}，${roleEntered && coupleRole === role.id ? '当前身份' : '进入小窝'}`);
  }
  $('.together').setAttribute('aria-label', `${COUPLE_ROLES.map(role => `${role.name}${presenceForRole(role, options).label}`).join('，')}，${roleEntered ? '切换身份' : '选择身份'}`);
  $('#together-cta').textContent = '›';
  $('#save-status').textContent = saveStatus.message;
  $('#save-status').className = saveStatus.phase;
  $('#connection-note').textContent = roleEntered && cloudConfigured && ['error','offline','full'].includes(status.phase) ? '云端连接中断 · 点击身份栏重试，原存档会保留' : '';
  const roleStatus = $('#role-connection-status');
  if (roleStatus) roleStatus.textContent = connectionSummary({ ...options, savePhase:saveStatus.phase });
  const retry = $('#retry-cloud');
  if (retry) retry.hidden = !['error','offline','full'].includes(status.phase);
  refreshFeedingSheet();
  updateCareControls();
  renderFeedingHome();
  renderGrowth();
  catbook?.render();
}
function presenceOptions() { return { members, phase:status.phase, configured:cloudConfigured, entered:roleEntered, known:presenceKnown, selectedRole:coupleRole }; }
function toast(message) { if (companion.active) return; $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
function renderNeeds(now = Date.now()) {
  const needs = petNeeds(state, now);
  needsFeedback.update(needs);
  catModel?.setState({ ...needs, sleeping:state.sleeping });
  for (const key of NEED_KEYS) {
    const button = $(`[data-open="need-${key}"]`);
    button.classList.toggle('is-healthy', needs[key] > 80);
    button.setAttribute('aria-label', `${NEED_LABELS[key]} ${needs[key]} / 100，点击查看状态和提升方法`);
  }
  $('#needs-growth-bonus').classList.toggle('is-inactive', !needs.boosted);
  $('#needs-growth-multiplier').textContent = `×${needs.multiplier.toFixed(1)}`;
  $('#needs-growth-bonus').setAttribute('aria-label', `当前成长加成 ${needs.multiplier} 倍，${needs.boostCount} 项状态大于 80，点击查看加成详情`);
  const multiplierChanged = $('.nest').dataset.needsMultiplier !== String(needs.multiplier);
  $('.nest').dataset.needsMultiplier = needs.multiplier;
  if (multiplierChanged) refreshFeedingSheet();
  const view = $('#modal-content').dataset.view;
  if ($('#modal').open && (view === 'growth-bonus' || view?.startsWith('need-'))) {
    const content = view === 'growth-bonus' ? growthBonusDetails(state, { now }) : needDetails(state, view.slice(5), { now, clientId });
    if ($('#modal-content').innerHTML !== content) {
      const active = document.activeElement?.closest('[data-need-action], [data-open]');
      const focus = active?.dataset.needAction ? `[data-need-action="${active.dataset.needAction}"]` : active?.dataset.open ? `[data-open="${active.dataset.open}"]` : null;
      $('#modal-content').innerHTML = content;
      if (focus) $('#modal-content').querySelector(focus)?.focus({ preventScroll:true });
    }
  }
}
function renderFeedingHome(now = Date.now()) {
  const home = $('.feeding-preview');
  const content = feedingHome({ state, clientId, members, selectedFood, now });
  if (home.innerHTML !== content) home.innerHTML = content;
}
function renderGrowth() {
  const rewards = state.pendingGrowth || [];
  for (const reward of rewards) rewardVisuals.set(reward.id, { ...reward, visualXp:state.xp });
  if (claimingRewardId && !rewards.some(reward => reward.id === claimingRewardId)) claimingRewardId = null;
  const options = { blocked:cloudConfigured && status.phase !== 'online', claimingRewardId, pendingRewardIds:pendingGrowthClaims, page:growthPage, stage:growthStageForXp(state.xp) };
  $('#growth-rewards').innerHTML = growthBubbles(rewards, options);
  if ($('#modal').open && $('#modal-content').dataset.view === 'growth') {
    const focusedId = document.activeElement?.dataset.growthReward;
    const scroll = $('#modal').scrollTop;
    $('#modal-content').innerHTML = growthTray(rewards, options);
    $('#modal').scrollTop = scroll;
    if (focusedId) Array.from(document.querySelectorAll('[data-growth-reward]')).find(button => button.dataset.growthReward === focusedId)?.focus({ preventScroll:true });
  }
  while (rewardVisuals.size > rewards.length + 100) rewardVisuals.delete(rewardVisuals.keys().next().value);
}
function animateGrowthCollection(rewardId, stage, operationId) {
  const target = $('#xp-bar').getBoundingClientRect();
  const origin = claimOrigins.get(rewardId) || $('#growth-rewards').getBoundingClientRect();
  const startX = origin.left + origin.width / 2, startY = origin.top + origin.height / 2;
  const targetX = target.left + Math.max(10, target.width / 2), targetY = target.top + target.height / 2;
  for (let index = 0; index < 4; index += 1) {
    const heart = document.createElement('span');
    heart.className = 'growth-flight'; heart.style.cssText=stageStyle(stage); heart.innerHTML = jellyHeartMarkup(stage);
    if (operationId) heart.dataset.operationId = operationId;
    heart.style.setProperty('--i', index);
    heart.style.setProperty('--from-x', `${startX - 12}px`);
    heart.style.setProperty('--from-y', `${startY - 12}px`);
    heart.style.setProperty('--to-x', `${targetX - startX + index * 4}px`);
    heart.style.setProperty('--to-y', `${targetY - startY}px`);
    heart.style.setProperty('--arc-x', `${(index - 1.5) * 22}px`);
    heart.style.setProperty('--arc-y', `${-35 - index * 7}px`);
    document.body.append(heart);
    setTimeout(() => heart.remove(), 1400);
  }
  claimOrigins.delete(rewardId);
  $('.pet-card').classList.add('growth-collected');
  clearTimeout(growthGlowTimer);
  growthGlowTimer = setTimeout(() => $('.pet-card').classList.remove('growth-collected'), 1500);
}
function refreshStagesPanel() {
  if (!$('#modal').open || $('#modal-content').dataset.view !== 'stages') return;
  const scroll=$('#modal').scrollTop, focused=document.activeElement?.dataset.stagePreview;
  const previewFocused=document.activeElement?.matches('.stage-preview');
  $('#modal-content').innerHTML=growthStagesPanel(state.xp, stagePreviewId || growthStageForXp(state.xp).id);
  $('#modal').scrollTop=scroll;
  if (focused) $(`[data-stage-preview="${focused}"]`)?.focus({preventScroll:true});
  else if (previewFocused) $('.stage-preview')?.focus({preventScroll:true});
}
function scheduleUpgrade() {
  clearTimeout(upgradeTimer);
  if (!pendingUpgrade) return;
  upgradeTimer=setTimeout(() => {
    if (!pendingUpgrade || !roleEntered || companion.active || $('.nest').hidden || $('#modal').open || document.hidden) return;
    lastCelebratedStage=pendingUpgrade.to.min;
    openModal('stage-upgrade');
    pendingUpgrade=null;
  }, 1150);
}
function chime() {
  if (!sound) return;
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35); const osc = ctx.createOscillator(); osc.connect(gain); osc.type = 'sine'; osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + .1); osc.start(); osc.stop(ctx.currentTime + .35); osc.onended = () => ctx.close(); } catch {}
}
function react(action, actor, { optimistic = false, previewed = false, operationId, previousXp, confirmedXp } = {}) {
  const mine = actor.id === clientId;
  if (action.type?.startsWith('game-')) { refreshGames(); return; }
  if (action.type === 'invite-cat') {
    toast(`${getCollectionCat(action.catId)?.name || '新猫猫'}已加入猫猫庭院，快去看看它吧 ♡`);
    chime();
    return;
  }
  if (action.type === 'claim-growth') {
    const reward = rewardVisuals.get(action.rewardId);
    if (reward) {
      if (!previewed) {
        if (mine && $('#modal').open && $('#modal-content').dataset.view === 'growth') closeModal();
        animateGrowthCollection(action.rewardId, growthStageForXp(reward.visualXp), operationId);
      }
      if (!optimistic) {
        const upgrade=growthUpgrade(previousXp ?? reward.visualXp, confirmedXp ?? state.xp);
        if (upgrade && upgrade.to.min>lastCelebratedStage && (!pendingUpgrade || upgrade.to.min>=pendingUpgrade.to.min)) {
          pendingUpgrade=upgrade; scheduleUpgrade();
        }
        if (mine) toast(`已收下 ${reward.amount} 点成长 ♡`);
        else toast(`${actor.name}收下了 ${reward.amount} 点成长 ♡`);
        rewardVisuals.delete(action.rewardId);
      }
      if (!previewed) catSpeech.say('collect');
    }
    claimingRewardId = null;
    renderGrowth();
    if (!previewed) chime();
    return;
  }
  if (mine && action.type === 'feed') toast(`${state.name}吃到${FOODS[action.food]?.name || '美味小餐'}啦 · ${optimistic ? '正在保存这份心意' : cloudConfigured ? '已保存到云端' : '已记录在小窝'}`);
  if (mine && action.type==='dress') {
    if(appearanceSubmitting && JSON.stringify(action.appearance)===JSON.stringify(appearanceDraft)){appearanceSubmitting=false;closeModal();}
    toast(`小猫换好新装扮啦 · ${optimistic ? '正在保存' : cloudConfigured?'已保存到云端':'已留在小窝'}`);
  }
  if (previewed) return;
  // Let a successful local form submission close its dialog before the cat replies.
  queueMicrotask(() => catSpeech.say(action.type, action, { ...actor, mine }));
  $('.kitten').classList.remove('react-pet','react-feed','react-play');
  void $('.kitten').offsetWidth;
  $('.kitten').classList.add(`react-${action.type}`);
  catModel?.react(action.type, { ...petNeeds(state), sleeping: state.sleeping });
  if (!state.sleeping) {
    $('#particles').innerHTML = Array.from({ length:6 }, (_, i) => `<span style="--i:${i};--x:${18+i*12}%">✦</span>`).join('');
    setTimeout(() => { $('#particles').innerHTML = ''; }, 1400);
  }
  chime(); if (mine && navigator.vibrate) navigator.vibrate(12);
}
function rollbackReaction(action, actor, { operationId }) {
  needsFeedback.reset(petNeeds(state));
  for (const flight of document.querySelectorAll('.growth-flight')) {
    if (flight.dataset.operationId === operationId) flight.remove();
  }
  clearTimeout(growthGlowTimer); $('.pet-card').classList.remove('growth-collected');
  $('.kitten').classList.remove('react-pet', 'react-feed', 'react-play');
  $('#particles').innerHTML = '';
  catModel?.cancelReaction({ ...petNeeds(state), sleeping:state.sleeping });
  catSpeech.say('idle');
  claimingRewardId = null;
  if (action.type === 'claim-growth') claimOrigins.delete(action.rewardId);
  if (action.type === 'dress') appearanceDraft = normalizeAppearance(state.appearance);
}
function careSaving() { return cloudConfigured && (pendingCloudActions > 0 || saveStatus.phase === 'saving'); }
function careNotice(key, message) {
  const now = Date.now();
  if (key !== careFeedbackKey || now - careFeedbackAt >= 5000) { toast(message); careFeedbackKey=key; careFeedbackAt=now; }
}
function currentInteraction() {
  return resolveInteraction('random', { ...state, ...petNeeds(state) }, Math.random, action => careActionInfo(state, action, clientId).allowed);
}
function dispatch(action) {
  if (!roleEntered) { openModal('roles'); return false; }
  if (action?.type?.startsWith('game-') && careSaving()) return false;
  if (actionLocked && !['claim-growth','invite-cat'].includes(action?.type) && !action?.type?.startsWith('game-')) return false;
  if (!action) {
    if (careSaving()) { careNotice('pending', '上一份陪伴正在保存，稍等一下 ♡'); return false; }
    const nearest = ['pet', 'sleep', ...(petNeeds(state).energy >= 8 ? ['play'] : [])].map(type => ({ type, info:careActionInfo(state, { type }, clientId) })).sort((a,b) => a.info.availableAt - b.info.availableAt)[0];
    careNotice(`${nearest.type}:${nearest.info.reason}`, careBlockedMessage(nearest.type, nearest.info));
    return false;
  }
  const care = careActionInfo(state, action, clientId);
  if (action.type === 'invite-cat' && careSaving()) { careNotice('pending', '正在保存上一份陪伴，稍等一下再邀请 ♡'); return false; }
  if (action.type === 'claim-growth') {
    if (pendingGrowthClaims.has(action.rewardId)) return false;
    if (!(state.pendingGrowth || []).some(reward => reward.id === action.rewardId)) return false;
  }
  if (care.dailyLimit !== null && careSaving()) { careNotice('pending', '上一份陪伴正在保存，稍等一下 ♡'); return false; }
  if (!care.allowed) {
    careNotice(`${action.type}:${care.reason}`, careBlockedMessage(action.type, care));
    updateCareControls(); return false;
  }
  if (action.type === 'feed' && (!Object.hasOwn(FOODS, action.food) || state.coins < FOODS[action.food].cost)) { toast('猫爪币不够啦，陪小猫玩一会儿赚 10 币吧'); return false; }
  if (action.type === 'play' && petNeeds(state).energy < 8) { toast('小猫有点累，先让它休息一下吧'); return false; }
  initializeCatbook();
  if (cloudConfigured) {
    if (!cloud || status.phase !== 'online' || !cloud.dispatch(action)) { toast('正在连接云端小窝，连上后就可以继续照顾小猫'); return false; }
    actionLocked = true; setTimeout(() => actionLocked = false, 650); return true;
  }
  const actor = { id:clientId, name:profile.name };
  const next = reduceAction(state, action, actor, Date.now(), crypto.randomUUID());
  if (!next) { toast('这次互动暂时不能完成，请稍后再试'); updateCareControls(); return false; }
  state = next; render(); react(action, actor);
  actionLocked = true; setTimeout(() => actionLocked = false, 650);
  return true;
}
function startCloud() {
  if (!roleEntered || !cloudConfigured) return;
  cloud?.destroy(); members=[]; presenceKnown=false;
  const chosenRole = coupleRole;
  let receivedNeedsState = false;
  needsFeedback.reset(petNeeds(state));
  const pendingKey = `catnest.pending.${localPetPreview ? 'preview':'couple'}.${chosenRole}`;
  const pending = read(pendingKey, []);
  pendingCloudActions = pending.length;
  pendingGrowthClaims = new Set(pending.filter(item => item.action?.type === 'claim-growth').map(item => item.action.rewardId));
  cloud=createCloudRoom({ apiBase, coupleRole:chosenRole, ...(home.roomId ? {homeRoomId:home.roomId} : {}), initialState:state, storageLabel:localPetPreview ? '本地联机预览':'GitHub 云端',
    pending, optimisticReducer:reduceAction, onRollback:rollbackReaction,
    onRoom(id) { roomId=id; save('catnest.couple.room',id); save('catnest.room',id); },
    onState(next, metadata) {
      confirmedState=normalizeState(metadata?.confirmedState || next); state=normalizeState(next);
      if (!receivedNeedsState) { needsFeedback.reset(petNeeds(state)); receivedNeedsState=true; }
      render();
    },
    onAction:react,
    onPresence(next) { members=next; presenceKnown=true; renderConnection(); },
    onStatus(next) { if (next.phase !== 'online') presenceKnown=false; status=next; renderConnection(); },
    onSaveStatus(next) {
      saveStatus=next;
      if (next.phase==='error') {
        // A rejected claim leaves its bubble in the last saved snapshot. Release
        // the click lock so it remains usable; retrying writes stay queue-blocked.
        if (claimingRewardId && pendingCloudActions === 0) {
          claimOrigins.delete(claimingRewardId);
          claimingRewardId = null;
        }
        appearanceSubmitting=false; refreshAppearanceSheet(); toast(next.message);
      }
      renderConnection();
    },
    onPending(queue) { pendingCloudActions=queue.length; pendingGrowthClaims=new Set(queue.filter(item => item.action?.type === 'claim-growth').map(item => item.action.rewardId)); save(pendingKey,queue); refreshFeedingSheet(); updateCareControls(); renderGrowth(); catbook?.render(); refreshGames(); },
  });
  cloud.start();
}
function enterRole(role) {
  const next = getCoupleProfile(role);
  if (!next) return;
  if (roleEntered && role !== coupleRole && saveStatus.phase === 'saving') { toast('这次互动还在保存，请保存完成后切换身份'); return; }
  const changed = coupleRole !== role;
  coupleRole=role; profile=next; clientId=next.clientId; roleEntered=true;
  save('catnest.role',role);
  closeModal(); renderConnection();
  catSpeech.start();
  if (changed || !cloud || status.phase !== 'online') startCloud();
  if (params.has('court') || params.get('mode') === 'judge') { params.delete('court'); params.delete('mode'); showCourt(); }
}
function openModal(view) {
  companion.exit();
  if (!roleEntered && view !== 'roles') view='roles';
  if (view === 'judge') { closeModal(); showCourt(); return; }
  if (view === 'collection') { closeModal(); showCatbook(); return; }
  if(view==='appearance' && (!$('#modal').open || $('#modal-content').dataset.view!=='appearance')){appearanceDraft=normalizeAppearance(state.appearance);appearanceSubmitting=false;}
  if (view === 'games' && (!$('#modal').open || $('#modal-content').dataset.view !== 'games')) { gameLobby = true; gameSelectedGame = null; }
  if (view==='stages' && (!$('#modal').open || $('#modal-content').dataset.view!=='stages')) stagePreviewId=growthStageForXp(state.xp).id;
  $('#modal-content').dataset.view = view;
  $('#modal').classList.toggle('appearance-sheet',view==='appearance');
  $('#modal-close').hidden = view === 'roles' && !roleEntered;
  $('#modal').classList.toggle('role-dialog', view === 'roles');
  $('#modal').classList.toggle('diary-dialog', view === 'diary');
  $('#modal').classList.toggle('game-dialog', view === 'games');
  if (view === 'games') { gameLastMarkup=''; gameRenderedId=''; }
  $('#modal').classList.toggle('feeding-sheet', view === 'feeding');
  $('#modal').classList.toggle('stage-sheet', ['stages','stage-upgrade'].includes(view));
  $('.nest').classList.toggle('feeding-open', view === 'feeding');
  const header = (emoji, eyebrow, title, body='') => `<div class="modal-illustration">${emoji}</div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2>${body ? `<p class="modal-description">${body}</p>` : ''}`;
  const templates = {
    games: () => minigamesPanel(gameOptions()),
    'growth-bonus': () => growthBonusDetails(state),
    ...Object.fromEntries(NEED_KEYS.map(key => [`need-${key}`, () => needDetails(state, key, { clientId })])),
    growth: () => growthTray(state.pendingGrowth || [], { blocked:cloudConfigured && status.phase !== 'online', claimingRewardId, pendingRewardIds:pendingGrowthClaims, page:growthPage, stage:growthStageForXp(state.xp) }),
    stages: () => growthStagesPanel(state.xp, stagePreviewId),
    'stage-upgrade': () => pendingUpgrade ? growthUpgradePanel(pendingUpgrade,state.xp) : growthStagesPanel(state.xp),
    appearance: () => appearanceSheet(),
    feeding: () => feedingSheet(feedingSheetOptions()),
    roles: () => rolePicker(presenceOptions()),
    rename: () => `${header('🐈','HELLO, LITTLE ONE','给小猫起个名字','每一个小名字，都是一份偏爱。')}<form id="rename-form"><label for="cat-name">小猫的名字</label><input id="cat-name" name="name" value="${esc(state.name)}" maxlength="16" required/><button class="primary modal-primary" type="submit">就叫这个名字</button></form>`,
    settings: () => `${header('🧶','MAKE YOURSELF AT HOME','小窝设置')}<button class="identity-setting" data-open="roles"><span class="identity-avatar ${coupleRole}" aria-hidden="true">${coupleRole === 'male' ? '👦🏻' : '👧🏻'}</span><span><small>当前身份</small><strong>${profile.name}</strong></span><b>切换身份 ${icon('chevron-right')}</b></button><button class="setting-row" data-open="appearance"><span>${icon('shirt')} 小猫装扮</span><b>换个小魔法 ${icon('chevron-right')}</b></button><button class="setting-row" id="toggle-sound"><span>${icon(sound ? 'volume-2' : 'volume-x')} 互动音效</span><b>${sound ? '已开启' : '已关闭'}</b></button><p class="fine-print">${cloudConfigured ? '小猫的互动与成长会自动保存到 GitHub 私有云存档。下次打开网站，选择你的身份就能继续。请等页面显示「已保存」再离开。' : '当前为本机预览，云端服务还未连接。进度会保存在这个浏览器。'}</p>`,
    diary: () => `${header('📔','OUR LITTLE MOMENTS','养猫日记','把每天的陪伴，串成我们的小时间轴。')}${diaryTimeline(state.history)}`,
    guide: () => `${header('✨','GROW WITH LOVE','每一点爱，都算数','照顾小猫会产生成长气泡，点击领取才计入成长；升级所需成长逐级增加：120、150、180……每级多 30 点。')}<div class="guide-list"><div><span>🐟 9 种美味食物<small>${careRuleText('feed')}</small></span><b>+5～50 成长</b></div><div><span>🤍 温柔摸摸<small>${careRuleText('pet')}</small></span><b>+3 成长 · +6 开心</b></div><div><span>🪄 陪它玩耍<small>${careRuleText('play')}</small></span><b>+8 成长 · +10 猫爪币</b></div><div><span>🌙 休息一下<small>${careRuleText('sleep')}</small></span><b>+4 成长 · +20 活力</b></div><div><span>🐾 本轮双人喂养<small>${careRuleText('pair')} · 每轮一次</small></span><b>额外 +10 亲密度和成长</b></div></div><p class="guide-limits-note">饱饱、开心、活力每一项大于 80，成长各加 10%；一项 ×1.1，两项 ×1.2，三项 ×1.3（摸摸 3→3.9）；领取时不重复加成。三项状态每 30 分钟各下降 1 点，离线也会计算。点击小猫下方的具体状态可查看提升方法。</p><p class="guide-limits-note">每日次数由两人共享，北京时间（UTC+8）0 点重置。喂食冷却按身份单独计算，摸摸、逗猫和休息共享冷却；跨日仍需等冷却结束。叫醒随时可用，不消耗次数，也不增加成长。</p><p class="fine-print">气泡不会自动消失，刷新或离开小窝也会保留，点击后小爱心会飞入成长条。首次喂食开启 4 小时一轮的双人小任务，两位猫友在本轮各喂一次，额外成长会加入本次喂食气泡。每日双人奖励用完后，喂食仍可在其次数和冷却内进行。猫爪币通过逗猫免费获得。</p>`,
    home: () => `${header('🏡','YOUR COZY CORNER','欢迎回到小窝',`这里是${esc(state.name)}的家，也是你每天可以放松一下的地方。`)}<div class="home-summary"><div><strong>${levelInfo(state.xp).level}</strong><span>小猫等级</span></div><div><strong>${state.love}</strong><span>积攒的爱</span></div><div><strong>${state.history.length}</strong><span>近期陪伴</span></div></div><button class="primary modal-primary" data-open="roles">${icon('users-round')} 查看或切换身份</button>`,
  };
  $('#modal-content').innerHTML = (templates[view] || templates.home)();
  if (view==='guide') $('#modal-content').insertAdjacentHTML('beforeend','<button class="stage-guide-link" data-open="stages">查看全部成长阶段 <span>›</span></button>');
  renderIcons(); renderConnection();
  if (!$('#modal').open) $('#modal').showModal();
  if (view === 'feeding') catSpeech.say('feeding');
  updateFeedingSaveStatus();
  updateModelPause();
}
function gameOptions() { return { state, clientId, saving:careSaving(), multiplayer:cloudConfigured, connected:cloudConfigured ? status.phase === 'online' : true, lobby:gameLobby, selectedGame:gameSelectedGame, selectedCell:gameSelectedCell, localPreview:!cloudConfigured || localPetPreview }; }
function refreshGames() {
  scheduleComputerTurn();
  if (!$('#modal').open || $('#modal-content').dataset.view !== 'games') return;
  const selection = `${state.games.match?.id}:${state.games.match?.step}`;
  if (selection !== gameSelectionStep) { gameSelectionStep=selection; gameSelectedCell=null; }
  const content = minigamesPanel(gameOptions());
  if (content === gameLastMarkup) return;
  gameLastMarkup=content;
  const matchId = state.games.match?.id || '';
  const changedMatch = gameRenderedId !== matchId;
  gameRenderedId=matchId;
  const focus = document.activeElement;
  const cell = focus?.dataset.gameCell, column = focus?.dataset.gameColumn, move = focus?.dataset.gameMove;
  const scroll = changedMatch ? 0 : $('#modal').scrollTop;
  $('#modal-content').innerHTML = content;
  $('#modal').scrollTop = scroll;
  if (cell !== undefined) $(`[data-game-cell="${cell}"]`)?.focus({preventScroll:true});
  else if (column !== undefined) $(`[data-game-column="${column}"]`)?.focus({preventScroll:true});
  else if (move !== undefined) $(`[data-game-move="${move}"]`)?.focus({preventScroll:true});
}
function clearComputerTurn() { clearTimeout(computerTurnTimer); computerTurnTimer=null; computerTurnKey=''; }
function scheduleComputerTurn() {
  const match=state.games.match;
  if (!$('#modal').open || $('#modal-content').dataset.view!=='games' || match?.status!=='active' || match.mode!=='computer' || match.game==='rps' || match.turn!==1 || match.players[0].id!==clientId || cloudConfigured && status.phase!=='online') { clearComputerTurn(); return; }
  if(careSaving()) { clearComputerTurn(); return; }
  const type=match.phase==='reveal'?'game-next':'game-bot';
  const key=`${match.id}:${match.step}:${type}`;
  if(key===computerTurnKey)return;
  clearComputerTurn();computerTurnKey=key;
  computerTurnTimer=setTimeout(()=>{
    computerTurnTimer=null;computerTurnKey='';
    const current=state.games.match;
    if(!$('#modal').open || $('#modal-content').dataset.view!=='games' || !current || `${current.id}:${current.step}:${current.phase==='reveal'?'game-next':'game-bot'}`!==key || current.status!=='active' || careSaving())return;
    dispatch({type,gameId:current.id,step:current.step});
  },match.phase==='reveal'?1400:850);
}
function gameAction(action) {
  gameSelectedCell=null;
  if (dispatch(action)) { gameLobby=false; refreshGames(); }
}
async function copyGameLink() {
  const url = new URL(location.href); url.search=''; url.hash='';
  try { await navigator.clipboard.writeText(url.href); toast('小窝链接已复制，发给另一位猫友就能一起玩'); }
  catch { toast('复制暂不可用，可以直接分享浏览器地址'); }
}
function appearanceSheet() {
  const labels={body:'毛色',clothes:'衣服',eyes:'眼睛',wand:'魔杖'};
  return `<div class="sheet-handle" aria-hidden="true"></div><span class="eyebrow">A LITTLE MAGIC, JUST FOR YOU</span><h2>给小猫换个小魔法</h2><div class="appearance-tabs" role="tablist" aria-label="装扮部位">${Object.entries(labels).map(([key,label])=>`<button role="tab" id="appearance-tab-${key}" data-appearance-tab="${key}" aria-controls="appearance-choices" aria-selected="${key===appearanceTab}">${label}</button>`).join('')}</div><div id="appearance-choices" class="appearance-choices" role="tabpanel" aria-labelledby="appearance-tab-${appearanceTab}">${APPEARANCE_OPTIONS[appearanceTab].map((option,index)=>`<button class="appearance-choice ${appearanceDraft[appearanceTab]===index?'selected':''}" data-appearance-choice="${index}" aria-label="${labels[appearanceTab]}：${option.name}" aria-pressed="${appearanceDraft[appearanceTab]===index}" ${appearanceSubmitting?'disabled':''}><span style="--swatch:${option.color}">${appearanceDraft[appearanceTab]===index?'✓':''}</span><small>${option.name}</small></button>`).join('')}</div><button class="primary modal-primary" id="apply-appearance" ${appearanceSubmitting?'disabled':''}>${appearanceSubmitting?'正在保存这身装扮…':'就穿这一套 ♡'}</button><p class="appearance-note">装扮免费 · 两个人都会看见同一只小猫</p><a class="model-credit" href="${MAGE_CAT_AUTHOR.url}" target="_blank" rel="noopener noreferrer">魔法小猫来自 ${MAGE_CAT_AUTHOR.name}</a>`;
}
function refreshAppearanceSheet() {
  if(!$('#modal').open || $('#modal-content').dataset.view!=='appearance')return;
  const focus=document.activeElement?.dataset.appearanceChoice;
  $('#modal-content').innerHTML=appearanceSheet();
  if(focus!==undefined)$(`[data-appearance-choice="${focus}"]`)?.focus({preventScroll:true});
}
function feedingSheetOptions() {
  return { state, selectedFood, tab:feedingTab, category:foodCategory, clientId, profileName:profile.name, members,
    saving:careSaving(), connected:!cloudConfigured || status.phase === 'online' };
}
function updateFeedingSaveStatus() {
  const element = $('#feeding-save-status');
  if (element) element.textContent = saveStatus.message;
}
function refreshFeedingSheet() {
  if (!$('#modal').open || $('#modal-content').dataset.view !== 'feeding') return;
  const panel = $('#modal-content [role=tabpanel]:not([hidden])');
  const scroll = panel?.scrollTop || 0;
  const focused = document.activeElement;
  const focusId = focused?.id;
  const foodId = focused?.dataset.food;
  const categoryId = focused?.dataset.foodCategory;
  $('#modal-content').innerHTML = feedingSheet(feedingSheetOptions());
  const nextPanel = $('#modal-content [role=tabpanel]:not([hidden])');
  if (nextPanel) nextPanel.scrollTop = scroll;
  const target = focusId ? document.getElementById(focusId) : foodId ? document.querySelector(`[data-food="${foodId}"]`) : categoryId ? document.querySelector(`[data-food-category="${categoryId}"]`) : null;
  target?.focus({ preventScroll:true });
  updateFeedingSaveStatus();
}
function updateCareControls(now = Date.now()) {
  document.querySelectorAll('.side-actions [data-action]').forEach(button => {
    const type = button.dataset.action;
    const info = careActionInfo(state, { type }, clientId, now);
    button.disabled = careSaving() || !info.allowed;
    const label = type === 'sleep' && info.isWake ? '轻轻叫醒小猫' : type === 'sleep' ? '让小猫休息' : type === 'pet' ? '摸摸小猫' : '用逗猫棒陪小猫玩';
    const detail = careStatusText(type, info);
    const description = careSaving() ? '上一份陪伴正在保存' : detail;
    button.title = `${label} · ${description}`;
    button.setAttribute('aria-label', `${label}，${description}`);
    const badge = button.querySelector('[data-care-badge]');
    if (badge) {
      const extra = careSaving() ? '保存中…' : info.isWake ? '叫醒不计成长' : info.reason === 'daily_limit' ? '今日已满' : info.reason === 'cooldown' ? countdown(info.remainingMs) : '';
      if (!badge.firstElementChild) badge.innerHTML = '<span></span><time></time>';
      badge.firstElementChild.textContent = careQuotaText(type, info, true);
      const timer = badge.lastElementChild;
      timer.textContent = extra;
      timer.hidden = !extra;
    }
  });
  document.querySelectorAll('[data-care-status]').forEach(element => {
    const type = element.dataset.careStatus;
    element.textContent = careStatusText(type, careActionInfo(state, { type }, clientId, now), element.dataset.careCompact === 'true');
  });
  const serve = $('#serve-food');
  if (serve) {
    const next = feedingButtonContent({ ...feedingSheetOptions(), now });
    serve.disabled = next.disabled;
    if (serve.innerHTML !== next.content) serve.innerHTML = next.content;
  }
}
const careClock = setInterval(() => {
  refreshGames();
  if (document.hidden) return;
  updateCareControls();
  renderNeeds();
  renderFeedingHome();
  let expired = false;
  updateFoodPortions(document);
  document.querySelectorAll('[data-feed-until]').forEach(element => {
    const remaining = Number(element.dataset.feedUntil) - Date.now();
    if (remaining <= 0) expired = true;
    else element.textContent = countdown(remaining);
  });
  if (expired && $('#modal').open && $('#modal-content').dataset.view === 'feeding') refreshFeedingSheet();
}, 1000);
function closeModal() { if (roleEntered && !appearanceSubmitting) $('#modal').close(); }
function updateModelPause() { catModel?.setPaused(document.hidden || ($('#modal').open && !['feeding','appearance'].includes($('#modal-content').dataset.view)) || $('.nest').hidden); catSpeech.sync(); }
const catRhythm = document.createElement('span');
catRhythm.id='cat-rhythm';catRhythm.className='cat-rhythm';
$('.pet-name').after(catRhythm);
function renderCatBehavior(behavior) {
  $('.nest').dataset.catPeriod=behavior.period;
  $('.nest').dataset.catMood=behavior.mood;
  const time={morning:'☀ 早安',day:'☀ 午后',evening:'☾ 晚间',night:'☾ 深夜'}[behavior.period];
  catRhythm.textContent=`${time} · ${behavior.moodLabel}`;
  catRhythm.title=`${behavior.periodLabel}：${behavior.label}`;
  catRhythm.setAttribute('aria-label', `${behavior.periodLabel}，${behavior.moodLabel}，${behavior.label}`);
}
async function initializeCatModel() {
  catModel?.destroy();
  $('#retry-cat-model').textContent='小猫正在回家…';$('#retry-cat-model').disabled=true;
  try {
    const { createCatModel } = await import('./cat-model.js');
    catModel = createCatModel({ container: $('#cat'), assetBase:modelAssetBase, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, onBehaviorChange:renderCatBehavior,
      onReady() { $('#retry-cat-model').hidden=true; queueMicrotask(() => { catModel?.setState(state); updateModelPause(); }); },
      onError() { $('#retry-cat-model').hidden=false;$('#retry-cat-model').disabled=false;$('#retry-cat-model').textContent='小猫还没加载好，点这里重试'; },
    });
    catModel.setState(state);
    updateModelPause();
  } catch { /* Keep the illustrated fallback if the 3D module cannot load. */ }
}
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el) return;
  if (el.hasAttribute('data-game-copy')) { copyGameLink(); return; }
  if (el.hasAttribute('data-game-lobby')) { gameLobby=true; gameSelectedGame=null; gameSelectedCell=null; refreshGames(); $('#modal').scrollTop=0; return; }
  if (el.dataset.gameSelect) { gameLobby=true; gameSelectedGame=el.dataset.gameSelect; refreshGames(); $('#modal').scrollTop=0; return; }
  if (el.hasAttribute('data-game-open')) { gameLobby=false; refreshGames(); return; }
  if (el.dataset.gameCreate) { gameAction({type:'game-create',game:el.dataset.gameCreate,mode:el.dataset.gameMode,previousId:state.games.match?.id ?? null}); return; }
  const match = state.games.match;
  if (match && el.hasAttribute('data-game-join')) { gameAction({type:'game-join',gameId:match.id}); return; }
  if (match && el.hasAttribute('data-game-cancel')) { gameAction({type:'game-cancel',gameId:match.id}); return; }
  if (match && el.hasAttribute('data-game-next')) { gameAction({type:'game-next',gameId:match.id,step:match.game === 'rps' ? match.rounds.length : match.step}); return; }
  if (match && el.dataset.gameCell !== undefined) { gameSelectedCell=Number(el.dataset.gameCell); gameSelectionStep=`${match.id}:${match.step}`; refreshGames(); return; }
  if (match && el.dataset.gameColumn !== undefined) { gameSelectedCell=Number(el.dataset.gameColumn); gameSelectionStep=`${match.id}:${match.step}`; refreshGames(); return; }
  if (match && el.hasAttribute('data-game-confirm') && gameSelectedCell !== null) { gameAction({type:'game-move',gameId:match.id,step:match.step,move:gameSelectedCell}); return; }
  if (match && el.dataset.gameMove !== undefined) { gameAction({type:'game-move',gameId:match.id,step:match.game === 'rps' ? match.rounds.length : match.step,move:match.game === 'rps' ? el.dataset.gameMove : Number(el.dataset.gameMove)}); return; }
  if (el.hasAttribute('data-companion-enter')) {
    if (!roleEntered) { openModal('roles'); return; }
    if (appearanceSubmitting) return;
    closeModal(); companion.enter(el, { keyboard:event.detail === 0 }); return;
  }
  if (el.dataset.growthReward) {
    const rewardId = el.dataset.growthReward;
    if (pendingGrowthClaims.has(rewardId) || claimingRewardId === rewardId) return;
    claimOrigins.set(rewardId, el.getBoundingClientRect());
    claimingRewardId = rewardId;
    if (!dispatch({ type:'claim-growth', rewardId })) { claimingRewardId=null; claimOrigins.delete(rewardId); }
    renderGrowth(); return;
  }
  if (el.dataset.growthPage !== undefined) { growthPage=Number(el.dataset.growthPage); renderGrowth(); return; }
  if (el.dataset.stagePreview) {
    stagePreviewId=getGrowthStageById(el.dataset.stagePreview).id; refreshStagesPanel();
    $('#modal').scrollTop=0; $('.stage-preview')?.focus({preventScroll:true}); return;
  }
  if (el.id==='retry-cat-model'){initializeCatModel();return;}
  if (el.dataset.appearanceTab){appearanceTab=el.dataset.appearanceTab;refreshAppearanceSheet();return;}
  if (el.dataset.appearanceChoice!==undefined && !appearanceSubmitting){appearanceDraft={...appearanceDraft,[appearanceTab]:Number(el.dataset.appearanceChoice)};catModel?.setAppearance(appearanceDraft);refreshAppearanceSheet();return;}
  if (el.id==='apply-appearance' && !appearanceSubmitting){if(JSON.stringify(appearanceDraft)===JSON.stringify(state.appearance)){closeModal();return;}appearanceSubmitting=true;if(!dispatch({type:'dress',appearance:{...appearanceDraft}}))appearanceSubmitting=false;refreshAppearanceSheet();return;}
  if (el.dataset.coupleRole) { enterRole(el.dataset.coupleRole); return; }
  if (el.id === 'retry-cloud') { startCloud(); return; }
  if (el.dataset.open) { openModal(el.dataset.open); return; }
  if (el.dataset.close !== undefined || el.id === 'modal-close') { closeModal(); return; }
  if (el.dataset.needAction) { if (dispatch({ type:el.dataset.needAction })) closeModal(); return; }
  if (el.dataset.action) { dispatch({ type: el.dataset.action }); return; }
  if (el.id === 'cat') {
    const dragged=catModel?.consumeTap();
    if (event.detail === 0 || !dragged) {
      const action=currentInteraction();
      if (roleEntered && !action) { catModel?.react('touch', { ...petNeeds(state), sleeping:state.sleeping });catSpeech.say('touch'); }
      else dispatch(action);
    }
    return;
  }
  if (el.dataset.feedingTab) { feedingTab = el.dataset.feedingTab; refreshFeedingSheet(); return; }
  if (el.dataset.foodCategory) { foodCategory = el.dataset.foodCategory; refreshFeedingSheet(); return; }
  if (el.dataset.food) {
    if (!Object.hasOwn(FOODS, el.dataset.food)) return;
    selectedFood = el.dataset.food;
    save('catnest.food', selectedFood); render(); return;
  }
  if (el.id === 'feed-button') { feedingTab='menu'; openModal('feeding'); return; }
  if (el.id === 'serve-food') { if (dispatch({ type:'feed', food:selectedFood })) closeModal(); return; }
  if (el.id === 'feeding-role') { openModal('roles'); return; }
  if (el.id === 'toggle-sound') { sound = !sound; save('catnest.sound',sound); openModal('settings'); chime(); return; }
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if (form.hasAttribute('data-game-guess')) {
    const match=state.games.match, input=form.elements.namedItem('guess'), move=Number(input?.value);
    if (match?.game==='guess' && match.status==='active' && match.players[match.turn]?.id===clientId && !careSaving() && input?.value && Number.isInteger(move) && move>=match.low && move<=match.high) gameAction({type:'game-move',gameId:match.id,step:match.step,move});
    return;
  }
  const name = new FormData(form).get('name')?.trim();
  if (form.id === 'rename-form') { if (name && dispatch({ type:'rename', name })) closeModal(); }
});
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const box=$('#modal').getBoundingClientRect(); if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) closeModal(); } });
$('#modal').addEventListener('cancel', event => { if (!roleEntered || appearanceSubmitting) event.preventDefault(); });
$('#modal').addEventListener('close', () => {
  if (!roleEntered) { queueMicrotask(() => { if (!roleEntered && !$('#modal').open) $('#modal').showModal(); }); return; }
  $('.nest').classList.remove('feeding-open'); catModel?.setState(state); updateModelPause(); scheduleUpgrade();
});
document.addEventListener('visibilitychange', () => { updateModelPause(); if (document.hidden) needsFeedback.reset(petNeeds(state)); else { renderNeeds(); updateCareControls(); refreshFeedingSheet(); scheduleUpgrade(); } });
const courtContainer = document.createElement('section');
courtContainer.id = 'court-root';
courtContainer.hidden = true;
$('#app').append(courtContainer);
let court;
const catbookContainer = document.createElement('section');
catbookContainer.id = 'catbook-root';
catbookContainer.hidden = true;
$('#app').append(catbookContainer);
let homeScroll = 0;
function initializeCatbook() {
  if (!catbook) catbook = createCatbook({
    container:catbookContainer,
    getState:() => cloudConfigured ? confirmedState : state,
    getAvailability:() => ({ saving:careSaving(), connected:!cloudConfigured || status.phase === 'online' }),
    onAction:dispatch,
    initialScene:read('catnest.catbook.scene', 'station'),
    onSceneChange:id => save('catnest.catbook.scene', id),
    onBack() {
      catbook.close(); $('.nest').hidden=false; document.body.classList.remove('catbook-mode');
      updateModelPause(); scheduleUpgrade(); window.scrollTo(0, homeScroll);
      $('[data-open="collection"]').focus({ preventScroll:true });
    },
  });
}
function showCatbook() {
  companion.exit();
  initializeCatbook();
  homeScroll = window.scrollY;
  $('.nest').hidden=true; document.body.classList.add('catbook-mode');
  catbook.open(); window.scrollTo(0,0); updateModelPause();
}
async function showCourt() {
  companion.exit();
  try {
    if (!court) {
      const { createCourt } = await import('./court.js');
      court=createCourt({ container:courtContainer, profileName:profile.name, modelAssetBase, getPetAppearance:() => state.appearance, toast, onBack() { court.close(); $('.nest').hidden=false; document.body.classList.remove('court-mode'); updateModelPause(); scheduleUpgrade(); } });
    }
    $('.nest').hidden=true; document.body.classList.add('court-mode'); court.open();
    updateModelPause();
  } catch { toast('猫猫判官正在准备中，稍后就能见面啦'); }
}
render(); renderConnection(); initializeCatModel(); openModal('roles');
import('./growth-heart.js').then(({ createGrowthHeartRenderer }) => createGrowthHeartRenderer()).catch(() => { /* Keep the glossy fallback if 3D rendering is unavailable. */ });
window.addEventListener('pagehide', () => { clearComputerTurn(); needsFeedback.reset(petNeeds(state)); cloud?.destroy(); catModel?.setPaused(true); catSpeech.stop(); });
window.addEventListener('pageshow', e => { if (e.persisted) { if (roleEntered && cloudConfigured) startCloud(); if (roleEntered) catSpeech.start(); updateModelPause(); } });
