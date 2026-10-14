import './style.css';
import './feeding.css';
import { createIcons, PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, Copy, Check, Link, ArrowRight } from 'lucide';
import { FOODS, initialState, normalizeState, reduceAction, levelInfo } from './state';
import { createRoomSync } from './realtime';
import { createCloudRoom } from './cloud';
import { INTERACTION_MODES, normalizeInteractionMode, resolveInteraction, getInteractionHint } from './interaction-mode';
import { foodPreview, feedingSheet, countdown } from './feeding-ui';

const ICONS = { PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, Copy, Check, Link, ArrowRight };
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const $ = s => document.querySelector(s);
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing can disable storage */ } }
function randomId() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), x => x.toString(16).padStart(2,'0')).join(''); }
const params = new URLSearchParams(location.search);
const requestedRoom = params.get('room');
const validRoom = value => /^(?:[a-z0-9]{6,12}|[a-f0-9]{32})$/.test(value || '');
let roomId = validRoom(requestedRoom) ? requestedRoom : read('catnest.room', null) || randomId();
let sessionClientId;
try { sessionClientId = sessionStorage.getItem('catnest.client'); } catch {}
let clientId = read('catnest.client', null) || sessionClientId || randomId();
if (!/^[a-zA-Z0-9_-]{6,80}$/.test(clientId)) clientId = randomId();
save('catnest.client', clientId);
try { sessionStorage.setItem('catnest.client', clientId); } catch {}
let profile = read('catnest.profile', { name: '铲屎官' });
if (!profile || typeof profile.name !== 'string') profile = { name: '铲屎官' };
let state = normalizeState(read(`catnest.state.${roomId}`, initialState()));
let selectedFood = read('catnest.food', 'meal');
if (!Object.hasOwn(FOODS, selectedFood)) selectedFood = 'meal';
let feedingTab = 'menu', foodCategory = 'all';
let interactionMode = normalizeInteractionMode(read('catnest.interactionMode', 'random'));
let catModel = null;
let sound = read('catnest.sound', false);
let sync = null;
let shared = Boolean(requestedRoom && validRoom(requestedRoom));
let cloud = null;
const apiBase = import.meta.env.VITE_API_URL || (location.hostname.endsWith('.onrender.com') ? location.origin : '');
let cloudConfigured = Boolean(apiBase);
let saveStatus = { phase:'local', message:'本机预览 · 云端待连接' };
let status = { phase: 'solo', role: null, message: '邀请一位猫友，一起照顾小猫' };
let members = [];
let actionLocked = false;
let reactionTimer, toastTimer;
save('catnest.room', roomId);


$('#app').innerHTML = `
<main class="nest" aria-label="猫猫小窝养成游戏">
  <div class="room-backdrop"></div><div class="warm-overlay"></div><div class="sun-dust" aria-hidden="true"></div>
  <header class="topbar"><a class="brand" href="./" aria-label="猫猫小窝首页"><span class="brand-mark">${icon('paw-print')}</span><span>猫猫小窝<small>A LITTLE HOME, A LOT OF LOVE</small></span></a><button class="round-button settings-button" data-open="settings" aria-label="设置">${icon('settings-2')}</button></header>
  <div class="wallet" aria-label="养成资源"><div class="currency"><span class="coin-icon">${icon('paw-print')}</span><strong id="coins">1,200</strong><span class="currency-label">猫爪币</span></div><div class="currency"><span class="heart-icon">${icon('heart')}</span><strong id="love">86</strong><span class="currency-label">亲密度</span></div><button class="currency level-currency" data-open="guide" aria-label="查看成长指南"><span class="star-icon">${icon('sparkles')}</span><strong id="top-level">Lv.1</strong><span class="currency-label">成长</span></button></div>
  <button class="together" data-open="together"><span class="together-avatars"><span>我</span><span class="friend-avatar">${icon('plus')}</span></span><span id="together-label">一只小猫，两个人的家</span><span class="together-link" id="together-cta">邀请一起养 ${icon('chevron-right')}</span></button>
  <div class="scene"><div class="speech-bubble" id="speech" role="status">今天也想和你贴贴喵～<span>♡</span></div><button class="cat-button" id="cat" aria-label="摸摸糯米"><img class="kitten" src="./assets/kitten.webp" alt="坐在暖暖房间里的橘色小猫糯米" fetchpriority="high" draggable="false"/></button><div class="cat-shadow"></div><div id="particles" aria-hidden="true"></div></div>
  <div class="side-actions left-actions"><button data-action="pet" aria-label="摸摸小猫"><span>${icon('hand')}</span><small>摸摸</small></button><button data-action="play" aria-label="用逗猫棒陪小猫玩"><span>${icon('wand-sparkles')}</span><small>逗猫</small></button></div>
  <div class="side-actions right-actions"><button data-open="diary" aria-label="查看养猫日记"><span>${icon('notebook-pen')}</span><small>日记</small></button><button data-action="sleep" id="sleep-button" aria-label="让小猫休息"><span>${icon('moon')}</span><small>休息</small></button></div>
  <section class="pet-card glass" aria-label="小猫状态"><div class="pet-title"><button class="pet-name" data-open="rename"><strong id="pet-name">糯米</strong>${icon('pencil')}</button><button class="mode-selector" data-open="modes" aria-label="选择互动模式">${icon('sparkles')}<span id="mode-label">随心互动</span>${icon('chevron-right')}</button><b id="level">Lv.1</b></div><div class="xp-row">${icon('heart')}<div class="progress-track"><div id="xp-bar"></div></div><span id="xp">86 / 120</span></div><div class="needs"><span><i class="need-dot hunger"></i>饱饱 <b id="hunger">68</b></span><span><i class="need-dot mood"></i>开心 <b id="mood">82</b></span><span><i class="need-dot energy"></i>活力 <b id="energy">76</b></span></div></section>
  <button class="feeding-preview glass" data-open="feeding" aria-label="打开食物菜单，选择猫粮">${foodPreview(selectedFood)}</button>
  <button class="feed-button" id="feed-button">${icon('paw-print')}<span>喂食</span><span class="feed-love">+25 ${icon('heart')}</span><span class="button-sparkle">✦</span></button>
  <nav class="bottom-nav" aria-label="小窝导航"><button class="nav-entry judge" data-open="judge"><span class="nav-icon">${icon('gavel')}</span><span>猫猫判官<small>CAT JUDGE</small></span></button><span class="home-note">${icon('heart')}<span id="save-status" aria-live="polite">本机预览 · 云端待连接</span></span><button class="nav-entry home" data-open="home"><span class="nav-icon">${icon('house')}</span><span>我的小窝<small>MY HOME</small></span></button></nav>
  <div class="connection-note" id="connection-note" aria-live="polite"></div>
</main>
<dialog id="modal"><div class="modal-content" id="modal-content"></div><button class="modal-close round-button" id="modal-close" aria-label="关闭弹窗">${icon('x')}</button></dialog>
<div class="toast" id="toast" role="status"></div>`;
// Use a plus sign within the invite avatar to keep the icon set small.
$('.friend-avatar').innerHTML = '+';
function renderIcons() { createIcons({ icons: ICONS, attrs: { 'stroke-width': 1.8 } }); }
renderIcons();
function render() {
  const level = levelInfo(state.xp);
  $('#coins').textContent = state.coins.toLocaleString('en-US');
  $('#love').textContent = state.love.toLocaleString('en-US');
  $('#top-level').textContent = `Lv.${level.level}`;
  $('#level').textContent = `Lv.${level.level}`;
  $('#pet-name').textContent = state.name;
  const currentMode = INTERACTION_MODES.find(mode => mode.id === interactionMode);
  $('#cat').setAttribute('aria-label', `和${state.name}互动：${currentMode.label}`);
  $('#mode-label').textContent = currentMode.label;
  $('#cat').title = getInteractionHint(interactionMode, state);
  $('.kitten').alt = `坐在暖暖房间里的橘色小猫${state.name}`;
  $('#xp').textContent = `${level.progress} / ${level.target}`;
  $('#xp-bar').style.width = `${level.progress / level.target * 100}%`;
  for (const key of ['hunger', 'mood', 'energy']) $(`#${key}`).textContent = state[key];
  catModel?.setState({ sleeping: state.sleeping });
  $('.nest').classList.toggle('sleeping', state.sleeping);
  $('#sleep-button small').textContent = state.sleeping ? '叫醒' : '休息';
  $('#sleep-button').setAttribute('aria-label', state.sleeping ? '轻轻叫醒小猫' : '让小猫休息');
  save(`catnest.state.${roomId}`, state);
  $('.feeding-preview').innerHTML = foodPreview(selectedFood);
  refreshFeedingSheet();
}
function renderConnection() {
  const online = status.phase === 'online';
  const together = online && members.length > 1;
  $('.together').classList.toggle('connected', together);
  $('.friend-avatar').textContent = together ? (members.find(x => x.id !== clientId)?.name || '友').slice(0,1) : '+';
  $('#together-label').textContent = together ? '你们正在一起照顾小猫' : status.phase === 'connecting' ? '正在连接你们的小窝…' : '一只小猫，两个人的家';
  $('#together-cta').textContent = together ? '2 人在线 ›' : shared && online ? '等猫友加入 ›' : status.phase === 'connecting' ? '连接中' : '邀请一起养 ›';
  $('#save-status').textContent = saveStatus.message;
  $('#save-status').className = saveStatus.phase;
  $('#connection-note').textContent = shared && ['error', 'offline', 'full'].includes(status.phase) ? '双人连接中断 · 点击上方邀请栏查看' : '';
  if ($('#modal').open && $('#modal-content').dataset.view === 'together') updateInviteStatus();
  refreshFeedingSheet();
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
function chime() {
  if (!sound) return;
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35); const osc = ctx.createOscillator(); osc.connect(gain); osc.type = 'sine'; osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + .1); osc.start(); osc.stop(ctx.currentTime + .35); osc.onended = () => ctx.close(); } catch {}
}
function react(action, actor) {
  const mine = actor.id === clientId;
  if (mine && action.type === 'feed') toast(`${state.name}吃到${FOODS[action.food]?.name || '美味小餐'}啦 · 已${cloudConfigured ? '保存到云端' : '记录在小窝'}`);
  const messages = { feed: `好好吃！谢谢${mine ? '你' : actor.name}喵～`, pet: '呼噜呼噜…最喜欢摸摸啦 ♡', play: '抓到啦！再陪我玩一会儿嘛～', sleep: state.sleeping ? '晚安，梦里也要有你喵…' : '睡饱啦！又可以一起玩了～', rename: `以后我就叫${state.name}啦，喵！` };
  $('#speech').textContent = !mine ? `${actor.name}来${action.type === 'feed' ? '喂我' : action.type === 'play' ? '陪我玩' : action.type === 'pet' ? '摸摸我' : '照顾我'}啦 ♡` : messages[action.type] || '喵～';
  $('.kitten').classList.remove('react-pet','react-feed','react-play');
  void $('.kitten').offsetWidth;
  $('.kitten').classList.add(`react-${action.type}`);
  catModel?.react(action.type, { sleeping: state.sleeping });
  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => { $('#speech').textContent = state.sleeping ? 'Z z z … 做个好梦喵' : getInteractionHint(interactionMode, state); }, 3800);
  if (!state.sleeping) {
    $('#particles').innerHTML = Array.from({ length:6 }, (_, i) => `<span style="--i:${i};--x:${18+i*12}%">${i%2 ? '✦' : '♥'}</span>`).join('');
    setTimeout(() => { $('#particles').innerHTML = ''; }, 1400);
  }
  chime(); if (mine && navigator.vibrate) navigator.vibrate(12);
}
function dispatch(action) {
  if (actionLocked) return false;
  if (action.type === 'feed' && (!Object.hasOwn(FOODS, action.food) || state.coins < FOODS[action.food].cost)) { toast('猫爪币不够啦，陪小猫玩一会儿赚 10 币吧'); return false; }
  if (action.type === 'play' && state.energy < 8) { toast('小猫有点累，先让它休息一下吧'); return false; }
  if (cloudConfigured) {
    if (!cloud || status.phase !== 'online' || !cloud.dispatch(action)) { toast('正在连接云端小窝，连上后就可以继续照顾小猫'); return false; }
    actionLocked = true; setTimeout(() => actionLocked = false, 650); return true;
  }
  if (shared && (!sync || status.phase !== 'online')) { toast('双人小窝还未连上，请等连接成功或切回单人模式'); return false; }
  const actor = { id: clientId, name: profile.name };
  if (shared) { if (!sync.dispatch(action)) { toast('连接暂时中断，请稍后再试'); return false; } }
  else { state = reduceAction(state, action, actor); render(); react(action, actor); }
  actionLocked = true; setTimeout(() => actionLocked = false, 650);
  return true;
}
function startSync() {
  if (cloudConfigured) { if (!cloud || ['error','offline'].includes(status.phase)) startCloud(); return; }
  sync?.destroy(); shared = true;
  const url = new URL(location.href); url.searchParams.set('room', roomId); history.replaceState(null, '', url);
  sync = createRoomSync({ roomId, clientId, name: profile.name, initialState: state, reduceAction,
    onState(next) { state = normalizeState(next); render(); },
    onAction(action, actor) { react(action, actor); },
    onPresence(next) { members = next; renderConnection(); },
    onStatus(next) { status = next; renderConnection(); },
  });
  sync.start();
}
function startCloud() {
  cloud?.destroy(); sync?.destroy(); sync=null; shared=true;
  cloud=createCloudRoom({ apiBase, roomId, clientId, name:profile.name, initialState:state,
    pending:read(`catnest.pending.${roomId}`,[]),
    onRoom(id) { roomId=id; save('catnest.room',id); const url=new URL(location.href); url.searchParams.set('room',id); history.replaceState(null,'',url); },
    onState(next) { state=normalizeState(next); render(); },
    onAction:react,
    onPresence(next) { members=next; renderConnection(); },
    onStatus(next) { status=next; renderConnection(); },
    onSaveStatus(next) { saveStatus=next; renderConnection(); },
    onPending(queue) { save(`catnest.pending.${roomId}`,queue); },
  });
  cloud.start();
}
function inviteUrl() { const url = new URL(location.href); url.searchParams.set('room', roomId); return url.href; }
function updateInviteStatus() {
  const statusEl = $('#invite-status');
  if (statusEl) { statusEl.textContent = status.message; statusEl.className = `invite-status ${status.phase}`; }
}
function openModal(view) {
  if (view === 'judge') { closeModal(); showCourt(); return; }
  $('#modal-content').dataset.view = view;
  $('#modal').classList.toggle('interaction-sheet', view === 'modes');
  $('#modal').classList.toggle('feeding-sheet', view === 'feeding');
  $('.nest').classList.toggle('feeding-open', view === 'feeding');
  if (view === 'feeding') $('#speech').textContent = '一起喂养，升级更快 ♡';
  const header = (emoji, eyebrow, title, body='') => `<div class="modal-illustration">${emoji}</div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2>${body ? `<p class="modal-description">${body}</p>` : ''}`;
  const templates = {
    feeding: () => feedingSheet(feedingSheetOptions()),
    modes: () => `<div class="sheet-handle" aria-hidden="true"></div><span class="eyebrow">LITTLE MOMENTS, LOTS OF LOVE</span><h2>今天，怎么陪小猫？</h2><p class="modal-description">选好模式，点点小猫就能互动。<br/>左右滑动小猫，还能转着看它。</p><div class="mode-grid" role="group" aria-label="选择小猫互动模式">${INTERACTION_MODES.map(mode => `<button class="mode-card ${mode.id === interactionMode ? 'selected' : ''}" data-mode="${mode.id}" aria-pressed="${mode.id === interactionMode}"><span class="mode-card-icon ${mode.id}">${icon(mode.icon)}</span><strong>${mode.label}</strong><small>${mode.description}</small><span class="mode-check">${icon('check')}</span></button>`).join('')}</div><button class="primary modal-primary mode-start" id="mode-start">${icon('paw-print')} 开始互动</button><button class="text-button" id="reset-cat-view">回到正面 ${icon('arrow-right')}</button>`,
    together: () => `${header('🐾','A HOME FOR TWO','一起，把小猫养大','把邀请链接发给喜欢的人。进入同一个猫窝，就能实时看到彼此的喂食、摸摸和逗猫。')}<div class="room-code"><small>你们的猫窝暗号</small><strong>${roomId}</strong></div><div id="invite-status" class="invite-status"></div><button class="primary modal-primary" id="invite-copy">${icon('copy')} 复制邀请链接</button><button class="text-button" id="invite-share">用手机分享给对方 ${icon('arrow-right')}</button><details class="join-details"><summary>我有猫窝暗号</summary><form id="join-form"><label for="join-code">输入对方的猫窝暗号</label><div class="input-row"><input id="join-code" name="code" placeholder="粘贴猫窝暗号" pattern="[a-z0-9]{6,32}" minlength="6" maxlength="32" required autocomplete="off"/><button class="primary" type="submit">加入</button></div></form></details><p class="fine-print">${cloudConfigured ? '互动会自动保存到云端，关闭网页后存档仍然保留。请收藏猫窝链接，以便换设备找回。' : '当前为本机预览，云端服务还未连接。请保留此浏览器存档。'}链接请只分享给信任的人。</p>${shared && !cloudConfigured ? '<button class="text-button muted" id="go-solo">断开双人连接，继续单人养猫</button>' : ''}`,
    rename: () => `${header('🐈','HELLO, LITTLE ONE','给小猫起个名字','每一个小名字，都是一份偏爱。')}<form id="rename-form"><label for="cat-name">小猫的名字</label><input id="cat-name" name="name" value="${esc(state.name)}" maxlength="16" required/><button class="primary modal-primary" type="submit">就叫这个名字</button></form>`,
    settings: () => `${header('🧶','MAKE YOURSELF AT HOME','小窝设置')}<form id="profile-form"><label for="your-name">你的昵称 · 猫友会看到</label><input id="your-name" name="name" value="${esc(profile.name)}" maxlength="16" required/><button class="primary modal-primary" type="submit">保存昵称</button></form><button class="setting-row" id="toggle-sound"><span>${icon(sound ? 'volume-2' : 'volume-x')} 互动音效</span><b>${sound ? '已开启' : '已关闭'}</b></button><p class="fine-print">${cloudConfigured ? '小猫的互动与成长会自动保存到 GitHub 私有云存档。关闭页面后，用同一猫窝链接即可回来。请等页面显示「已保存」再离开。' : '当前为本机预览，云端服务还未连接。进度会保存在这个浏览器。'}</p>`,
    diary: () => `${header('📔','OUR LITTLE MOMENTS','养猫日记','那些微小的陪伴，小猫都有好好记住。')}<div class="diary-list">${state.history.length ? state.history.map(item => `<article class="diary-item"><span>${icon('heart')}</span><div><b>${esc(item.actor)}</b><p>${esc(item.text)}</p></div><time>${new Date(item.at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</time></article>`).join('') : '<div class="empty-diary">还没有记录，摸摸小猫<br/>写下你们的第一个小瞬间吧 ♡</div>'}</div>`,
    guide: () => `${header('✨','GROW WITH LOVE','每一点爱，都算数','照顾小猫可以积累成长值，每 120 点升一级。')}<div class="guide-list"><div>🐟 9 种美味食物 <b>+5～50 成长</b></div><div>🤍 温柔摸摸 <b>+3 成长 · +6 开心</b></div><div>🪄 陪它玩耍 <b>+8 成长 · +10 猫爪币</b></div><div>🌙 休息一下 <b>+4 成长 · +20 活力</b></div><div>🐾 本轮双人喂养 <b>额外 +10 亲密度和成长</b></div></div><p class="fine-print">首次喂食开启 4 小时一轮的双人小任务，两位猫友在本轮各喂一次，即可获得一次奖励。猫爪币通过逗猫免费获得。</p>`,
    home: () => `${header('🏡','YOUR COZY CORNER','欢迎回到小窝',`这里是${esc(state.name)}的家，也是你每天可以放松一下的地方。`)}<div class="home-summary"><div><strong>${levelInfo(state.xp).level}</strong><span>小猫等级</span></div><div><strong>${state.love}</strong><span>积攒的爱</span></div><div><strong>${state.history.length}</strong><span>近期陪伴</span></div></div><button class="primary modal-primary" data-open="together">${icon('users-round')} 邀请一个人一起住</button>`,
  };
  $('#modal-content').innerHTML = (templates[view] || templates.home)();
  renderIcons(); updateInviteStatus();
  if (!$('#modal').open) $('#modal').showModal();
  updateFeedingSaveStatus();
  updateModelPause();
}
function feedingSheetOptions() {
  return { state, selectedFood, tab:feedingTab, category:foodCategory, clientId, profileName:profile.name, members,
    saving:saveStatus.phase === 'saving', connected:!cloudConfigured || status.phase === 'online' };
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
const feedingClock = setInterval(() => {
  if (document.hidden || !$('#modal').open || $('#modal-content').dataset.view !== 'feeding') return;
  let expired = false;
  document.querySelectorAll('[data-feed-until]').forEach(element => {
    const remaining = Number(element.dataset.feedUntil) - Date.now();
    if (remaining <= 0) expired = true;
    else element.textContent = countdown(remaining);
  });
  if (expired) refreshFeedingSheet();
}, 1000);
function closeModal() { $('#modal').close(); }
function updateModelPause() { catModel?.setPaused(document.hidden || ($('#modal').open && $('#modal-content').dataset.view !== 'feeding') || $('.nest').hidden); }
async function initializeCatModel() {
  try {
    const { createCatModel } = await import('./cat-model.js');
    catModel = createCatModel({ container: $('#cat'), reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onReady() { queueMicrotask(() => { catModel?.setState({ sleeping: state.sleeping }); updateModelPause(); }); },
      onError() { /* The illustrated cat remains interactive when WebGL is unavailable. */ },
    });
    catModel.setState({ sleeping: state.sleeping });
    updateModelPause();
  } catch { /* Keep the illustrated fallback if the 3D module cannot load. */ }
}
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el) return;
  if (el.dataset.open) { openModal(el.dataset.open); return; }
  if (el.dataset.close !== undefined || el.id === 'modal-close') { closeModal(); return; }
  if (el.dataset.action) { dispatch({ type: el.dataset.action }); return; }
  if (el.id === 'cat') { const dragged=catModel?.consumeTap(); if (event.detail === 0 || !dragged) dispatch(resolveInteraction(interactionMode, state)); return; }
  if (el.dataset.mode) {
    interactionMode=normalizeInteractionMode(el.dataset.mode); save('catnest.interactionMode',interactionMode); render();
    document.querySelectorAll('[data-mode]').forEach(button => { const selected=button.dataset.mode===interactionMode; button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',selected); });
    return;
  }
  if (el.id === 'mode-start') { closeModal(); dispatch(resolveInteraction(interactionMode,state)); return; }
  if (el.id === 'reset-cat-view') { catModel?.resetView(); closeModal(); return; }
  if (el.dataset.feedingTab) { feedingTab = el.dataset.feedingTab; refreshFeedingSheet(); return; }
  if (el.dataset.foodCategory) { foodCategory = el.dataset.foodCategory; refreshFeedingSheet(); return; }
  if (el.dataset.food) {
    if (!Object.hasOwn(FOODS, el.dataset.food)) return;
    selectedFood = el.dataset.food;
    save('catnest.food', selectedFood); render(); return;
  }
  if (el.id === 'feed-button') { feedingTab='menu'; openModal('feeding'); return; }
  if (el.id === 'serve-food') { if (dispatch({ type:'feed', food:selectedFood })) { closeModal(); if (cloudConfigured) toast('正在送上这份心意，保存后小猫就开饭啦…'); } return; }
  if (el.id === 'feeding-invite') { shareInvite(true); return; }
  if (el.id === 'toggle-sound') { sound = !sound; save('catnest.sound',sound); openModal('settings'); chime(); return; }
  if (el.id === 'invite-copy' || el.id === 'invite-share') { shareInvite(el.id === 'invite-share'); return; }
  if (el.id === 'go-solo') {
    if (cloudConfigured) { closeModal(); toast('云端小窝会自动保存，你可以直接关闭网页'); return; }
    sync?.destroy(); sync = null; shared = false; members = []; status = { phase:'solo', role:null, message:'单人小窝' };
    const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null,'',url); renderConnection(); closeModal(); toast('已回到单人小窝，当前存档已保留');
  }
});
async function shareInvite(nativeShare) {
  if (!shared || ['error','offline','full'].includes(status.phase)) startSync();
  if (cloudConfigured && !/^[a-f0-9]{32}$/.test(roomId)) { toast('云端小窝还在连接，连上后再发送邀请吧'); return; }
  updateInviteStatus();
  const url = inviteUrl();
  if (nativeShare && navigator.share) {
    try { await navigator.share({ title:'来和我一起养猫吧 🐾', text:`这是${state.name}的小窝，等你一起喂猫、摸摸！`, url }); } catch(error) { if (error.name !== 'AbortError') toast('分享没有完成，可以复制邀请链接'); }
  } else {
    try { await navigator.clipboard.writeText(url); toast('邀请链接已复制，发给猫友一起养猫吧'); }
    catch { const input = document.createElement('input'); input.value=url; $('#modal-content').append(input); input.select(); toast('请长按链接复制并分享给猫友'); }
  }
}
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  const name = new FormData(form).get('name')?.trim();
  if (form.id === 'rename-form') { if (name && dispatch({ type:'rename', name })) closeModal(); }
  if (form.id === 'profile-form' && name) { profile.name=name.slice(0,16); save('catnest.profile',profile); sync?.updateName(profile.name); cloud?.updateName(profile.name); closeModal(); toast('昵称已保存'); }
  if (form.id === 'join-form') { const code=new FormData(form).get('code')?.trim().toLowerCase(); if (validRoom(code)) { const url=new URL(location.href); url.searchParams.set('room',code); location.assign(url); } }
});
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const box=$('#modal').getBoundingClientRect(); if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) closeModal(); } });
$('#modal').addEventListener('close', () => { $('.nest').classList.remove('feeding-open'); updateModelPause(); });
document.addEventListener('visibilitychange', updateModelPause);
const courtContainer = document.createElement('section');
courtContainer.id = 'court-root';
courtContainer.hidden = true;
$('#app').append(courtContainer);
let court;
async function showCourt() {
  try {
    if (!court) {
      const { createCourt } = await import('./court.js');
      court=createCourt({ container:courtContainer, profileName:profile.name, toast, onBack() { court.close(); $('.nest').hidden=false; document.body.classList.remove('court-mode'); updateModelPause(); } });
    }
    $('.nest').hidden=true; document.body.classList.add('court-mode'); court.open();
    updateModelPause();
  } catch { toast('猫猫判官正在准备中，稍后就能见面啦'); }
}
render(); renderConnection(); if (cloudConfigured) startCloud(); else if (shared) startSync();
initializeCatModel();
if (params.has('court') || params.get('mode') === 'judge') showCourt();
window.addEventListener('pagehide', () => { sync?.destroy(); cloud?.destroy(); catModel?.setPaused(true); });
window.addEventListener('pageshow', e => { if (e.persisted) { if (cloudConfigured) startCloud(); else if (shared) startSync(); updateModelPause(); } });
