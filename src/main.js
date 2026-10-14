import './style.css';
import './feeding.css';
import { createIcons, PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, Check, ArrowRight, Shirt } from 'lucide';
import { FOODS, initialState, normalizeState, reduceAction, levelInfo } from './state';
import { COUPLE_ROLES, normalizeCoupleRole, getCoupleProfile } from './couple-profile.js';
import { createCloudRoom } from './cloud';
import { INTERACTION_MODES, normalizeInteractionMode, resolveInteraction, getInteractionHint } from './interaction-mode';
import { foodPreview, feedingSheet, countdown } from './feeding-ui';
import { APPEARANCE_OPTIONS, normalizeAppearance, MAGE_CAT_VERSION, MAGE_CAT_AUTHOR } from './mage-cat-config.js';

const ICONS = { PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, Check, ArrowRight, Shirt };
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const $ = s => document.querySelector(s);
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing can disable storage */ } }
const params = new URLSearchParams(location.search);
// A remembered role is only a hint; every visit begins with an explicit choice.
let coupleRole = normalizeCoupleRole(read('catnest.role', null));
let roleEntered = false;
let profile = getCoupleProfile(coupleRole) || { name:'请选择身份' };
let clientId = profile.clientId || '';
const cachedRoom = read('catnest.couple.room', null) || read('catnest.room', null);
let roomId = /^[a-f0-9]{32}$/.test(cachedRoom || '') ? cachedRoom : 'couple-local';
let state = normalizeState(read(`catnest.state.${roomId}`, initialState()));
const cleanUrl = new URL(location.href);
cleanUrl.searchParams.delete('room');
history.replaceState(null, '', cleanUrl);
let selectedFood = read('catnest.food', 'meal');
if (!Object.hasOwn(FOODS, selectedFood)) selectedFood = 'meal';
let feedingTab = 'menu', foodCategory = 'all';
let interactionMode = normalizeInteractionMode(read('catnest.interactionMode', 'random'));
let catModel = null;
let appearanceDraft=normalizeAppearance(state.appearance),appearanceTab='body',appearanceSubmitting=false;
let sound = read('catnest.sound', false);
let cloud = null;
const apiBase = import.meta.env.VITE_API_URL || (location.hostname.endsWith('.onrender.com') ? location.origin : '');
let cloudConfigured = Boolean(apiBase);
const modelAssetBase=import.meta.env.VITE_MODEL_URL || `${apiBase || location.origin}/api/pet-model/${MAGE_CAT_VERSION}`;
let saveStatus = { phase:'local', message:'本机预览 · 云端待连接' };
let status = { phase:'solo', message:'选择身份，回到你们的小窝' };
let members = [];
let actionLocked = false;
let reactionTimer, toastTimer;



$('#app').innerHTML = `
<main class="nest" aria-label="猫猫小窝养成游戏">
  <div class="room-backdrop"></div><div class="warm-overlay"></div><div class="sun-dust" aria-hidden="true"></div>
  <header class="topbar"><a class="brand" href="./" aria-label="猫猫小窝首页"><span class="brand-mark">${icon('paw-print')}</span><span>猫猫小窝<small>A LITTLE HOME, A LOT OF LOVE</small></span></a><button class="round-button settings-button" data-open="settings" aria-label="设置">${icon('settings-2')}</button></header>
  <div class="wallet" aria-label="养成资源"><div class="currency"><span class="coin-icon">${icon('paw-print')}</span><strong id="coins">1,200</strong><span class="currency-label">猫爪币</span></div><div class="currency"><span class="heart-icon">${icon('heart')}</span><strong id="love">86</strong><span class="currency-label">亲密度</span></div><button class="currency level-currency" data-open="guide" aria-label="查看成长指南"><span class="star-icon">${icon('sparkles')}</span><strong id="top-level">Lv.1</strong><span class="currency-label">成长</span></button></div>
  <button class="together" data-open="roles" aria-label="查看或切换男方女方身份"><span class="together-avatars"><span class="male-avatar">男</span><span class="female-avatar">女</span></span><span id="together-label">一只小猫，两个人的家</span><span class="together-link" id="together-cta">选择身份 ›</span></button>
  <div class="scene"><div class="speech-bubble" id="speech" role="status">今天也想和你贴贴喵～<span>♡</span></div><button class="cat-button" id="cat" aria-label="摸摸糯米"><img class="kitten" src="./assets/kitten.webp" alt="坐在暖暖房间里的橘色小猫糯米" fetchpriority="high" draggable="false"/></button><button class="model-status" id="retry-cat-model" disabled aria-live="polite">小猫正在回家…</button><div class="cat-shadow"></div><div id="particles" aria-hidden="true"></div></div>
  <div class="side-actions left-actions"><button data-action="pet" aria-label="摸摸小猫"><span>${icon('hand')}</span><small>摸摸</small></button><button data-action="play" aria-label="用逗猫棒陪小猫玩"><span>${icon('wand-sparkles')}</span><small>逗猫</small></button></div>
  <div class="side-actions right-actions"><button data-open="diary" aria-label="查看养猫日记"><span>${icon('notebook-pen')}</span><small>日记</small></button><button data-action="sleep" id="sleep-button" aria-label="让小猫休息"><span>${icon('moon')}</span><small>休息</small></button><button data-open="appearance" aria-label="给小猫换装扮"><span>${icon('shirt')}</span><small>装扮</small></button></div>
  <section class="pet-card glass" aria-label="小猫状态"><div class="pet-title"><button class="pet-name" data-open="rename"><strong id="pet-name">糯米</strong>${icon('pencil')}</button><button class="mode-selector" data-open="modes" aria-label="选择互动模式">${icon('sparkles')}<span id="mode-label">随心互动</span>${icon('chevron-right')}</button><b id="level">Lv.1</b></div><div class="xp-row">${icon('heart')}<div class="progress-track"><div id="xp-bar"></div></div><span id="xp">86 / 120</span></div><div class="needs"><span><i class="need-dot hunger"></i>饱饱 <b id="hunger">68</b></span><span><i class="need-dot mood"></i>开心 <b id="mood">82</b></span><span><i class="need-dot energy"></i>活力 <b id="energy">76</b></span></div></section>
  <button class="feeding-preview glass" data-open="feeding" aria-label="打开食物菜单，选择猫粮">${foodPreview(selectedFood)}</button>
  <button class="feed-button" id="feed-button">${icon('paw-print')}<span>喂食</span><span class="feed-love">+25 ${icon('heart')}</span><span class="button-sparkle">✦</span></button>
  <nav class="bottom-nav" aria-label="小窝导航"><button class="nav-entry judge" data-open="judge"><span class="nav-icon">${icon('gavel')}</span><span>猫猫判官<small>CAT JUDGE</small></span></button><span class="home-note">${icon('heart')}<span id="save-status" aria-live="polite">本机预览 · 云端待连接</span></span><button class="nav-entry home" data-open="home"><span class="nav-icon">${icon('house')}</span><span>我的小窝<small>MY HOME</small></span></button></nav>
  <div class="connection-note" id="connection-note" aria-live="polite"></div>
</main>
<dialog id="modal"><div class="modal-content" id="modal-content"></div><button class="modal-close round-button" id="modal-close" aria-label="关闭弹窗">${icon('x')}</button></dialog>
<div class="toast" id="toast" role="status"></div>`;
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
  catModel?.setState({ sleeping:state.sleeping, appearance:$('#modal').open && $('#modal-content').dataset.view==='appearance' ? appearanceDraft : state.appearance });
  $('.nest').classList.toggle('sleeping', state.sleeping);
  $('#sleep-button small').textContent = state.sleeping ? '叫醒' : '休息';
  $('#sleep-button').setAttribute('aria-label', state.sleeping ? '轻轻叫醒小猫' : '让小猫休息');
  save(`catnest.state.${roomId}`, state);
  $('.feeding-preview').innerHTML = foodPreview(selectedFood);
  refreshFeedingSheet();
}
function renderConnection() {
  const online = status.phase === 'online';
  const together = online && COUPLE_ROLES.every(role => members.some(member => member.id === role.clientId));
  $('.together').classList.toggle('connected', together);
  for (const role of COUPLE_ROLES) {
    const avatar = $(`.${role.id}-avatar`);
    avatar.classList.toggle('is-me', roleEntered && coupleRole === role.id);
    avatar.classList.toggle('is-online', online && members.some(member => member.id === role.clientId));
  }
  $('#together-label').textContent = together ? '你们正在一起照顾小猫' : status.phase === 'connecting' ? '正在连接你们的小窝…' : '一只小猫，两个人的家';
  $('#together-cta').textContent = roleEntered ? `我是${profile.name}${together ? ' · 2 人在线' : ''} ›` : '选择身份 ›';
  $('#save-status').textContent = saveStatus.message;
  $('#save-status').className = saveStatus.phase;
  $('#connection-note').textContent = roleEntered && cloudConfigured && ['error','offline','full'].includes(status.phase) ? '云端连接中断 · 点击身份栏重试，原存档会保留' : '';
  const roleStatus = $('#role-save-status');
  if (roleStatus) roleStatus.textContent = saveStatus.message;
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
  if (mine && action.type==='dress') {
    if(appearanceSubmitting && JSON.stringify(action.appearance)===JSON.stringify(appearanceDraft)){appearanceSubmitting=false;closeModal();}
    toast(`小猫换好新装扮啦 · ${cloudConfigured?'已保存到云端':'已留在小窝'}`);
  }
  const messages = { dress:'换个小魔法，心情也亮晶晶 ♡', feed: `好好吃！谢谢${mine ? '你' : actor.name}喵～`, pet: '呼噜呼噜…最喜欢摸摸啦 ♡', play: '抓到啦！再陪我玩一会儿嘛～', sleep: state.sleeping ? '晚安，梦里也要有你喵…' : '睡饱啦！又可以一起玩了～', rename: `以后我就叫${state.name}啦，喵！` };
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
  if (!roleEntered) { openModal('roles'); return false; }
  if (actionLocked) return false;
  if (action.type === 'feed' && (!Object.hasOwn(FOODS, action.food) || state.coins < FOODS[action.food].cost)) { toast('猫爪币不够啦，陪小猫玩一会儿赚 10 币吧'); return false; }
  if (action.type === 'play' && state.energy < 8) { toast('小猫有点累，先让它休息一下吧'); return false; }
  if (cloudConfigured) {
    if (!cloud || status.phase !== 'online' || !cloud.dispatch(action)) { toast('正在连接云端小窝，连上后就可以继续照顾小猫'); return false; }
    actionLocked = true; setTimeout(() => actionLocked = false, 650); return true;
  }
  const actor = { id:clientId, name:profile.name };
  state = reduceAction(state, action, actor); render(); react(action, actor);
  actionLocked = true; setTimeout(() => actionLocked = false, 650);
  return true;
}
function startCloud() {
  if (!roleEntered || !cloudConfigured) return;
  cloud?.destroy(); members=[];
  const chosenRole = coupleRole;
  const pendingKey = `catnest.pending.couple.${chosenRole}`;
  cloud=createCloudRoom({ apiBase, coupleRole:chosenRole, initialState:state,
    pending:read(pendingKey,[]),
    onRoom(id) { roomId=id; save('catnest.couple.room',id); save('catnest.room',id); },
    onState(next) { state=normalizeState(next); render(); },
    onAction:react,
    onPresence(next) { members=next; renderConnection(); },
    onStatus(next) { status=next; renderConnection(); },
    onSaveStatus(next) { saveStatus=next; if(next.phase==='error'){appearanceSubmitting=false;refreshAppearanceSheet();} renderConnection(); },
    onPending(queue) { save(pendingKey,queue); },
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
  if (changed || !cloud || status.phase !== 'online') startCloud();
  if (params.has('court') || params.get('mode') === 'judge') { params.delete('court'); params.delete('mode'); showCourt(); }
}
function openModal(view) {
  if (!roleEntered && view !== 'roles') view='roles';
  if (view === 'judge') { closeModal(); showCourt(); return; }
  if(view==='appearance' && (!$('#modal').open || $('#modal-content').dataset.view!=='appearance')){appearanceDraft=normalizeAppearance(state.appearance);appearanceSubmitting=false;}
  $('#modal-content').dataset.view = view;
  $('#modal').classList.toggle('appearance-sheet',view==='appearance');
  $('#modal-close').hidden = view === 'roles' && !roleEntered;
  $('#modal').classList.toggle('role-dialog', view === 'roles');
  $('#modal').classList.toggle('interaction-sheet', view === 'modes');
  $('#modal').classList.toggle('feeding-sheet', view === 'feeding');
  $('.nest').classList.toggle('feeding-open', view === 'feeding');
  if (view === 'feeding') $('#speech').textContent = '一起喂养，升级更快 ♡';
  const header = (emoji, eyebrow, title, body='') => `<div class="modal-illustration">${emoji}</div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2>${body ? `<p class="modal-description">${body}</p>` : ''}`;
  const templates = {
    appearance: () => appearanceSheet(),
    feeding: () => feedingSheet(feedingSheetOptions()),
    modes: () => `<div class="sheet-handle" aria-hidden="true"></div><span class="eyebrow">LITTLE MOMENTS, LOTS OF LOVE</span><h2>今天，怎么陪小猫？</h2><p class="modal-description">选好模式，点点小猫就能互动。<br/>左右滑动小猫，还能转着看它。</p><div class="mode-grid" role="group" aria-label="选择小猫互动模式">${INTERACTION_MODES.map(mode => `<button class="mode-card ${mode.id === interactionMode ? 'selected' : ''}" data-mode="${mode.id}" aria-pressed="${mode.id === interactionMode}"><span class="mode-card-icon ${mode.id}">${icon(mode.icon)}</span><strong>${mode.label}</strong><small>${mode.description}</small><span class="mode-check">${icon('check')}</span></button>`).join('')}</div><button class="primary modal-primary mode-start" id="mode-start">${icon('paw-print')} 开始互动</button><button class="text-button" id="reset-cat-view">回到正面 ${icon('arrow-right')}</button>`,
    roles: () => `${header('🐾','OUR HOME, JUST US TWO','今天是谁来陪小猫？','选好你的身份，就回到你们共同的小窝。')}<div class="role-choices" role="group" aria-label="选择男方或女方">${COUPLE_ROLES.map(role => `<button class="role-choice ${role.id} ${coupleRole === role.id ? 'remembered' : ''}" data-couple-role="${role.id}"><span class="role-portrait" aria-hidden="true">${role.id === 'male' ? '👦🏻' : '👧🏻'}<i>♡</i></span><strong>我是${role.name}</strong><small>${role.id === 'male' ? '带一点温柔，回家陪它' : '带一点心意，回家抱它'}</small><span class="role-enter">进入小窝 ${icon('arrow-right')}</span></button>`).join('')}</div><p class="role-note">你们的每一次陪伴，都留在同一只小猫身边。</p>${roleEntered && cloudConfigured ? '<button class="text-button" id="retry-cloud">重新连接云端小窝</button><p id="role-save-status" class="fine-print"></p>' : ''}`,
    rename: () => `${header('🐈','HELLO, LITTLE ONE','给小猫起个名字','每一个小名字，都是一份偏爱。')}<form id="rename-form"><label for="cat-name">小猫的名字</label><input id="cat-name" name="name" value="${esc(state.name)}" maxlength="16" required/><button class="primary modal-primary" type="submit">就叫这个名字</button></form>`,
    settings: () => `${header('🧶','MAKE YOURSELF AT HOME','小窝设置')}<button class="identity-setting" data-open="roles"><span class="identity-avatar ${coupleRole}" aria-hidden="true">${coupleRole === 'male' ? '👦🏻' : '👧🏻'}</span><span><small>当前身份</small><strong>${profile.name}</strong></span><b>切换身份 ${icon('chevron-right')}</b></button><button class="setting-row" data-open="appearance"><span>${icon('shirt')} 小猫装扮</span><b>换个小魔法 ${icon('chevron-right')}</b></button><button class="setting-row" id="toggle-sound"><span>${icon(sound ? 'volume-2' : 'volume-x')} 互动音效</span><b>${sound ? '已开启' : '已关闭'}</b></button><p class="fine-print">${cloudConfigured ? '小猫的互动与成长会自动保存到 GitHub 私有云存档。下次打开网站，选择你的身份就能继续。请等页面显示「已保存」再离开。' : '当前为本机预览，云端服务还未连接。进度会保存在这个浏览器。'}</p>`,
    diary: () => `${header('📔','OUR LITTLE MOMENTS','养猫日记','那些微小的陪伴，小猫都有好好记住。')}<div class="diary-list">${state.history.length ? state.history.map(item => `<article class="diary-item"><span>${icon('heart')}</span><div><b>${esc(item.actor)}</b><p>${esc(item.text)}</p></div><time>${new Date(item.at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</time></article>`).join('') : '<div class="empty-diary">还没有记录，摸摸小猫<br/>写下你们的第一个小瞬间吧 ♡</div>'}</div>`,
    guide: () => `${header('✨','GROW WITH LOVE','每一点爱，都算数','照顾小猫可以积累成长值，每 120 点升一级。')}<div class="guide-list"><div>🐟 9 种美味食物 <b>+5～50 成长</b></div><div>🤍 温柔摸摸 <b>+3 成长 · +6 开心</b></div><div>🪄 陪它玩耍 <b>+8 成长 · +10 猫爪币</b></div><div>🌙 休息一下 <b>+4 成长 · +20 活力</b></div><div>🐾 本轮双人喂养 <b>额外 +10 亲密度和成长</b></div></div><p class="fine-print">首次喂食开启 4 小时一轮的双人小任务，两位猫友在本轮各喂一次，即可获得一次奖励。猫爪币通过逗猫免费获得。</p>`,
    home: () => `${header('🏡','YOUR COZY CORNER','欢迎回到小窝',`这里是${esc(state.name)}的家，也是你每天可以放松一下的地方。`)}<div class="home-summary"><div><strong>${levelInfo(state.xp).level}</strong><span>小猫等级</span></div><div><strong>${state.love}</strong><span>积攒的爱</span></div><div><strong>${state.history.length}</strong><span>近期陪伴</span></div></div><button class="primary modal-primary" data-open="roles">${icon('users-round')} 查看或切换身份</button>`,
  };
  $('#modal-content').innerHTML = (templates[view] || templates.home)();
  renderIcons(); renderConnection();
  if (!$('#modal').open) $('#modal').showModal();
  updateFeedingSaveStatus();
  updateModelPause();
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
function closeModal() { if (roleEntered && !appearanceSubmitting) $('#modal').close(); }
function updateModelPause() { catModel?.setPaused(document.hidden || ($('#modal').open && !['feeding','appearance'].includes($('#modal-content').dataset.view)) || $('.nest').hidden); }
async function initializeCatModel() {
  catModel?.destroy();
  $('#retry-cat-model').textContent='小猫正在回家…';$('#retry-cat-model').disabled=true;
  try {
    const { createCatModel } = await import('./cat-model.js');
    catModel = createCatModel({ container: $('#cat'), assetBase:modelAssetBase, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onReady() { $('#retry-cat-model').hidden=true; queueMicrotask(() => { catModel?.setState(state); updateModelPause(); }); },
      onError() { $('#retry-cat-model').hidden=false;$('#retry-cat-model').disabled=false;$('#retry-cat-model').textContent='小猫还没加载好，点这里重试'; },
    });
    catModel.setState(state);
    updateModelPause();
  } catch { /* Keep the illustrated fallback if the 3D module cannot load. */ }
}
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el) return;
  if (el.id==='retry-cat-model'){initializeCatModel();return;}
  if (el.dataset.appearanceTab){appearanceTab=el.dataset.appearanceTab;refreshAppearanceSheet();return;}
  if (el.dataset.appearanceChoice!==undefined && !appearanceSubmitting){appearanceDraft={...appearanceDraft,[appearanceTab]:Number(el.dataset.appearanceChoice)};catModel?.setAppearance(appearanceDraft);refreshAppearanceSheet();return;}
  if (el.id==='apply-appearance' && !appearanceSubmitting){if(JSON.stringify(appearanceDraft)===JSON.stringify(state.appearance)){closeModal();return;}appearanceSubmitting=true;if(!dispatch({type:'dress',appearance:{...appearanceDraft}}))appearanceSubmitting=false;refreshAppearanceSheet();return;}
  if (el.dataset.coupleRole) { enterRole(el.dataset.coupleRole); return; }
  if (el.id === 'retry-cloud') { startCloud(); return; }
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
  if (el.id === 'feeding-role') { openModal('roles'); return; }
  if (el.id === 'toggle-sound') { sound = !sound; save('catnest.sound',sound); openModal('settings'); chime(); return; }
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  const name = new FormData(form).get('name')?.trim();
  if (form.id === 'rename-form') { if (name && dispatch({ type:'rename', name })) closeModal(); }
});
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const box=$('#modal').getBoundingClientRect(); if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) closeModal(); } });
$('#modal').addEventListener('cancel', event => { if (!roleEntered || appearanceSubmitting) event.preventDefault(); });
$('#modal').addEventListener('close', () => {
  if (!roleEntered) { queueMicrotask(() => { if (!roleEntered && !$('#modal').open) $('#modal').showModal(); }); return; }
  $('.nest').classList.remove('feeding-open'); catModel?.setState(state); updateModelPause();
});
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
render(); renderConnection(); initializeCatModel(); openModal('roles');
window.addEventListener('pagehide', () => { cloud?.destroy(); catModel?.setPaused(true); });
window.addEventListener('pageshow', e => { if (e.persisted) { if (roleEntered && cloudConfigured) startCloud(); updateModelPause(); } });
