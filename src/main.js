import './style.css';
import { createIcons, PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, Copy, Check, Link, ArrowRight } from 'lucide';
import { FOODS, initialState, normalizeState, reduceAction, levelInfo } from './state';
import { createRoomSync } from './realtime';

const ICONS = { PawPrint, Coins, Heart, Sparkles, Settings2, Hand, WandSparkles, Moon, NotebookPen, ChevronRight, UsersRound, X, Pencil, House, Gavel, Volume2, VolumeX, Copy, Check, Link, ArrowRight };
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const $ = s => document.querySelector(s);
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing can disable storage */ } }
function randomId() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), x => x.toString(16).padStart(2,'0')).join(''); }
const params = new URLSearchParams(location.search);
const requestedRoom = params.get('room');
let roomId = /^[a-z0-9]{6,12}$/.test(requestedRoom || '') ? requestedRoom : read('catnest.room', null) || randomId();
let clientId = sessionStorage.getItem('catnest.client') || randomId();
try { sessionStorage.setItem('catnest.client', clientId); } catch {}
let profile = read('catnest.profile', { name: '铲屎官' });
if (!profile || typeof profile.name !== 'string') profile = { name: '铲屎官' };
let state = normalizeState(read(`catnest.state.${roomId}`, initialState()));
let selectedFood = 'meal';
let sound = read('catnest.sound', false);
let sync = null;
let shared = Boolean(requestedRoom && /^[a-z0-9]{6,12}$/.test(requestedRoom));
let status = { phase: 'solo', role: null, message: '邀请一位猫友，一起照顾小猫' };
let members = [];
let actionLocked = false;
let reactionTimer, toastTimer;
save('catnest.room', roomId);

const fishArt = `<svg viewBox="0 0 120 85" class="food-art" aria-hidden="true"><defs><linearGradient id="fish-g" x2="0" y2="1"><stop stop-color="#e7b77d"/><stop offset="1" stop-color="#c68648"/></linearGradient></defs><ellipse cx="61" cy="70" rx="47" ry="10" fill="#bd744c" opacity=".15"/><ellipse cx="60" cy="62" rx="49" ry="13" fill="#f6b7a6"/><ellipse cx="60" cy="58" rx="43" ry="11" fill="#ffe1d3"/><path d="M28 38 13 25 14 49 28 43Q54 64 91 42Q56 15 28 38Z" fill="url(#fish-g)" stroke="#b37b47" stroke-width="1.5"/><circle cx="77" cy="37" r="3" fill="#9e6639"/><path d="m49 34-2 13m12-15-1 15" stroke="#bc854b" stroke-width="3" stroke-linecap="round"/></svg>`;
const bowlArt = `<svg viewBox="0 0 120 85" class="food-art" aria-hidden="true"><defs><linearGradient id="bowl-g" x2="0" y2="1"><stop stop-color="#fff5df"/><stop offset="1" stop-color="#e5b88f"/></linearGradient></defs><ellipse cx="60" cy="74" rx="45" ry="8" fill="#bd744c" opacity=".18"/><path d="m24 32-7 32q43 25 86 0l-7-32Z" fill="url(#bowl-g)" stroke="#d8a77c"/><ellipse cx="60" cy="32" rx="36" ry="14" fill="#bd8a5e" stroke="#fff5e5" stroke-width="6"/><g fill="#aa6334" stroke="#ce925b" stroke-width="1.5"><ellipse cx="41" cy="28" rx="8" ry="5" transform="rotate(-20 41 28)"/><ellipse cx="58" cy="25" rx="8" ry="5"/><ellipse cx="76" cy="29" rx="9" ry="5" transform="rotate(20 76 29)"/><ellipse cx="49" cy="36" rx="8" ry="5"/><ellipse cx="67" cy="36" rx="8" ry="5"/></g><g fill="#c7874f"><ellipse cx="61" cy="61" rx="8" ry="6"/><ellipse cx="49" cy="52" rx="3" ry="4"/><ellipse cx="57" cy="49" rx="3" ry="4"/><ellipse cx="65" cy="49" rx="3" ry="4"/><ellipse cx="73" cy="53" rx="3" ry="4"/></g></svg>`;
const canArt = `<svg viewBox="0 0 120 85" class="food-art" aria-hidden="true"><defs><linearGradient id="can-g" x2="1" y2="0"><stop stop-color="#e79c78"/><stop offset=".5" stop-color="#ffc8a0"/><stop offset="1" stop-color="#dc8b67"/></linearGradient></defs><ellipse cx="60" cy="73" rx="40" ry="7" fill="#bd744c" opacity=".16"/><path d="M26 31v32q34 19 68 0V31Z" fill="url(#can-g)" stroke="#ce8f6f"/><ellipse cx="60" cy="31" rx="34" ry="12" fill="#e7c1a0" stroke="#ffe6c8" stroke-width="4"/><ellipse cx="60" cy="31" rx="27" ry="8" fill="#b65c42"/><path d="M50 23q13-22 35-5" fill="none" stroke="#fff2dc" stroke-width="5"/><path d="m45 50 8-6q19-4 27 6-10 11-27 5l-8 7Z" fill="#fff2d9"/><circle cx="70" cy="49" r="2" fill="#dc936e"/></svg>`;

$('#app').innerHTML = `
<main class="nest" aria-label="猫猫小窝养成游戏">
  <div class="room-backdrop"></div><div class="warm-overlay"></div><div class="sun-dust" aria-hidden="true"></div>
  <header class="topbar"><a class="brand" href="./" aria-label="猫猫小窝首页"><span class="brand-mark">${icon('paw-print')}</span><span>猫猫小窝<small>A LITTLE HOME, A LOT OF LOVE</small></span></a><button class="round-button settings-button" data-open="settings" aria-label="设置">${icon('settings-2')}</button></header>
  <div class="wallet" aria-label="养成资源"><div class="currency"><span class="coin-icon">${icon('paw-print')}</span><strong id="coins">1,200</strong><span class="currency-label">猫爪币</span></div><div class="currency"><span class="heart-icon">${icon('heart')}</span><strong id="love">86</strong><span class="currency-label">亲密度</span></div><button class="currency level-currency" data-open="guide" aria-label="查看成长指南"><span class="star-icon">${icon('sparkles')}</span><strong id="top-level">Lv.1</strong><span class="currency-label">成长</span></button></div>
  <button class="together" data-open="together"><span class="together-avatars"><span>我</span><span class="friend-avatar">${icon('plus')}</span></span><span id="together-label">一只小猫，两个人的家</span><span class="together-link" id="together-cta">邀请一起养 ${icon('chevron-right')}</span></button>
  <div class="scene"><div class="speech-bubble" id="speech" role="status">今天也想和你贴贴喵～<span>♡</span></div><button class="cat-button" id="cat" aria-label="摸摸糯米"><img class="kitten" src="./assets/kitten.webp" alt="坐在暖暖房间里的橘色小猫糯米" fetchpriority="high" draggable="false"/></button><div class="cat-shadow"></div><div id="particles" aria-hidden="true"></div></div>
  <div class="side-actions left-actions"><button data-action="pet" aria-label="摸摸小猫"><span>${icon('hand')}</span><small>摸摸</small></button><button data-action="play" aria-label="用逗猫棒陪小猫玩"><span>${icon('wand-sparkles')}</span><small>逗猫</small></button></div>
  <div class="side-actions right-actions"><button data-open="diary" aria-label="查看养猫日记"><span>${icon('notebook-pen')}</span><small>日记</small></button><button data-action="sleep" id="sleep-button" aria-label="让小猫休息"><span>${icon('moon')}</span><small>休息</small></button></div>
  <section class="pet-card glass" aria-label="小猫状态"><div class="pet-title"><button class="pet-name" data-open="rename"><strong id="pet-name">糯米</strong>${icon('pencil')}</button><span class="pet-tag" id="pet-tag">被爱着的小猫</span><b id="level">Lv.1</b></div><div class="xp-row">${icon('heart')}<div class="progress-track"><div id="xp-bar"></div></div><span id="xp">86 / 120</span></div><div class="needs"><span><i class="need-dot hunger"></i>饱饱 <b id="hunger">68</b></span><span><i class="need-dot mood"></i>开心 <b id="mood">82</b></span><span><i class="need-dot energy"></i>活力 <b id="energy">76</b></span></div></section>
  <section class="feeding" aria-label="选择猫粮"><button class="food-card" data-food="snack" aria-pressed="false">${fishArt}<strong>冻干小鱼</strong><span>+10 ${icon('heart')}<em>10 ${icon('coins')}</em></span></button><button class="food-card selected" data-food="meal" aria-pressed="true"><span class="food-recommend">小猫最爱</span>${bowlArt}<strong>营养猫粮</strong><span>+25 ${icon('heart')}<em>20 ${icon('coins')}</em></span></button><button class="food-card" data-food="fish" aria-pressed="false">${canArt}<strong>鲜鱼罐罐</strong><span>+50 ${icon('heart')}<em>40 ${icon('coins')}</em></span></button></section>
  <button class="feed-button" id="feed-button">${icon('paw-print')}<span>喂食</span><span class="feed-love">+25 ${icon('heart')}</span><span class="button-sparkle">✦</span></button>
  <nav class="bottom-nav" aria-label="小窝导航"><button class="nav-entry judge" data-open="judge"><span class="nav-icon">${icon('gavel')}</span><span>猫猫判官<small>CAT JUDGE</small></span></button><span class="home-note">${icon('heart')} 小小的家，满满的爱</span><button class="nav-entry home" data-open="home"><span class="nav-icon">${icon('house')}</span><span>我的小窝<small>MY HOME</small></span></button></nav>
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
  $('#cat').setAttribute('aria-label', `摸摸${state.name}`);
  $('.kitten').alt = `坐在暖暖房间里的橘色小猫${state.name}`;
  $('#xp').textContent = `${level.progress} / ${level.target}`;
  $('#xp-bar').style.width = `${level.progress / level.target * 100}%`;
  for (const key of ['hunger', 'mood', 'energy']) $(`#${key}`).textContent = state[key];
  $('#pet-tag').textContent = state.sleeping ? '正在做一个甜甜的梦' : state.mood >= 80 ? '被爱着的小猫' : '想要你的陪伴';
  $('.nest').classList.toggle('sleeping', state.sleeping);
  $('#sleep-button small').textContent = state.sleeping ? '叫醒' : '休息';
  save(`catnest.state.${roomId}`, state);
}
function renderConnection() {
  const online = status.phase === 'online';
  const together = online && members.length > 1;
  $('.together').classList.toggle('connected', together);
  $('.friend-avatar').textContent = together ? (members.find(x => x.id !== clientId)?.name || '友').slice(0,1) : '+';
  $('#together-label').textContent = together ? '你们正在一起照顾小猫' : status.phase === 'connecting' ? '正在连接你们的小窝…' : '一只小猫，两个人的家';
  $('#together-cta').textContent = together ? '2 人在线 ›' : shared && online ? '等猫友加入 ›' : status.phase === 'connecting' ? '连接中' : '邀请一起养 ›';
  $('#connection-note').textContent = shared && ['error', 'offline', 'full'].includes(status.phase) ? '双人连接中断 · 点击上方邀请栏查看' : '';
  if ($('#modal').open && $('#modal-content').dataset.view === 'together') updateInviteStatus();
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
function chime() {
  if (!sound) return;
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35); const osc = ctx.createOscillator(); osc.connect(gain); osc.type = 'sine'; osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + .1); osc.start(); osc.stop(ctx.currentTime + .35); osc.onended = () => ctx.close(); } catch {}
}
function react(action, actor) {
  const mine = actor.id === clientId;
  const messages = { feed: `好好吃！谢谢${mine ? '你' : actor.name}喵～`, pet: '呼噜呼噜…最喜欢摸摸啦 ♡', play: '抓到啦！再陪我玩一会儿嘛～', sleep: state.sleeping ? '晚安，梦里也要有你喵…' : '睡饱啦！又可以一起玩了～', rename: `以后我就叫${state.name}啦，喵！` };
  $('#speech').textContent = !mine ? `${actor.name}来${action.type === 'feed' ? '喂我' : action.type === 'play' ? '陪我玩' : action.type === 'pet' ? '摸摸我' : '照顾我'}啦 ♡` : messages[action.type] || '喵～';
  $('.kitten').classList.remove('react-pet','react-feed','react-play');
  void $('.kitten').offsetWidth;
  $('.kitten').classList.add(`react-${action.type}`);
  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => { $('#speech').textContent = state.sleeping ? 'Z z z … 做个好梦喵' : '有你在，就是最幸福的事 ♡'; }, 3800);
  if (!state.sleeping) {
    $('#particles').innerHTML = Array.from({ length:6 }, (_, i) => `<span style="--i:${i};--x:${18+i*12}%">${i%2 ? '✦' : '♥'}</span>`).join('');
    setTimeout(() => { $('#particles').innerHTML = ''; }, 1400);
  }
  chime(); if (mine && navigator.vibrate) navigator.vibrate(12);
}
function dispatch(action) {
  if (actionLocked) return false;
  if (action.type === 'feed' && state.coins < FOODS[action.food].cost) { toast('猫爪币不够啦，陪小猫玩一会儿赚 10 币吧'); return false; }
  if (action.type === 'play' && state.energy < 8) { toast('小猫有点累，先让它休息一下吧'); return false; }
  if (shared && (!sync || status.phase !== 'online')) { toast('双人小窝还未连上，请等连接成功或切回单人模式'); return false; }
  const actor = { id: clientId, name: profile.name };
  if (shared) { if (!sync.dispatch(action)) { toast('连接暂时中断，请稍后再试'); return false; } }
  else { state = reduceAction(state, action, actor); render(); react(action, actor); }
  actionLocked = true; setTimeout(() => actionLocked = false, 650);
  return true;
}
function startSync() {
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
function inviteUrl() { const url = new URL(location.href); url.searchParams.set('room', roomId); return url.href; }
function updateInviteStatus() {
  const statusEl = $('#invite-status');
  if (statusEl) { statusEl.textContent = status.message; statusEl.className = `invite-status ${status.phase}`; }
}
function openModal(view) {
  $('#modal-content').dataset.view = view;
  const header = (emoji, eyebrow, title, body='') => `<div class="modal-illustration">${emoji}</div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2>${body ? `<p class="modal-description">${body}</p>` : ''}`;
  const templates = {
    together: () => `${header('🐾','A HOME FOR TWO','一起，把小猫养大','把邀请链接发给喜欢的人。进入同一个猫窝，就能实时看到彼此的喂食、摸摸和逗猫。')}<div class="room-code"><small>你们的猫窝暗号</small><strong>${roomId}</strong></div><div id="invite-status" class="invite-status"></div><button class="primary modal-primary" id="invite-copy">${icon('copy')} 复制邀请链接</button><button class="text-button" id="invite-share">用手机分享给对方 ${icon('arrow-right')}</button><details class="join-details"><summary>我有猫窝暗号</summary><form id="join-form"><label for="join-code">输入对方的猫窝暗号</label><div class="input-row"><input id="join-code" name="code" placeholder="6–12 位字母或数字" pattern="[a-z0-9]{6,12}" minlength="6" maxlength="12" required autocomplete="off"/><button class="primary" type="submit">加入</button></div></form></details><p class="fine-print">双人互动需要双方保持页面打开。存档保存在浏览器，第一位进入者提供猫窝存档；链接请只分享给信任的人。</p>${shared ? '<button class="text-button muted" id="go-solo">断开双人连接，继续单人养猫</button>' : ''}`,
    rename: () => `${header('🐈','HELLO, LITTLE ONE','给小猫起个名字','每一个小名字，都是一份偏爱。')}<form id="rename-form"><label for="cat-name">小猫的名字</label><input id="cat-name" name="name" value="${esc(state.name)}" maxlength="16" required/><button class="primary modal-primary" type="submit">就叫这个名字</button></form>`,
    settings: () => `${header('🧶','MAKE YOURSELF AT HOME','小窝设置')}<form id="profile-form"><label for="your-name">你的昵称 · 猫友会看到</label><input id="your-name" name="name" value="${esc(profile.name)}" maxlength="16" required/><button class="primary modal-primary" type="submit">保存昵称</button></form><button class="setting-row" id="toggle-sound"><span>${icon(sound ? 'volume-2' : 'volume-x')} 互动音效</span><b>${sound ? '已开启' : '已关闭'}</b></button><p class="fine-print">小窝会自动保存在当前浏览器。清除浏览器数据会同时清除本机存档。</p>`,
    diary: () => `${header('📔','OUR LITTLE MOMENTS','养猫日记','那些微小的陪伴，小猫都有好好记住。')}<div class="diary-list">${state.history.length ? state.history.map(item => `<article class="diary-item"><span>${icon('heart')}</span><div><b>${esc(item.actor)}</b><p>${esc(item.text)}</p></div><time>${new Date(item.at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</time></article>`).join('') : '<div class="empty-diary">还没有记录，摸摸小猫<br/>写下你们的第一个小瞬间吧 ♡</div>'}</div>`,
    guide: () => `${header('✨','GROW WITH LOVE','每一点爱，都算数','照顾小猫可以积累成长值，每 120 点升一级。')}<div class="guide-list"><div>🐟 喂食小猫 <b>+10 / 25 / 50 成长</b></div><div>🤍 温柔摸摸 <b>+3 成长 · +6 开心</b></div><div>🪄 陪它玩耍 <b>+8 成长 · +10 猫爪币</b></div><div>🌙 休息一下 <b>+4 成长 · +20 活力</b></div></div><p class="fine-print">猫爪币用于给小猫买食物，通过逗猫免费获得。</p>`,
    judge: () => `${header('⚖️','CAT JUDGE','猫猫判官','小猫法官正在筹备自己的法庭。')}<div class="coming-card">未来在这里，<br/>让猫猫替你评评理。<span>独立网站 · 敬请期待</span></div><button class="primary modal-primary" data-close>先回家陪猫猫</button>`,
    home: () => `${header('🏡','YOUR COZY CORNER','欢迎回到小窝',`这里是${esc(state.name)}的家，也是你每天可以放松一下的地方。`)}<div class="home-summary"><div><strong>${levelInfo(state.xp).level}</strong><span>小猫等级</span></div><div><strong>${state.love}</strong><span>积攒的爱</span></div><div><strong>${state.history.length}</strong><span>近期陪伴</span></div></div><button class="primary modal-primary" data-open="together">${icon('users-round')} 邀请一个人一起住</button>`,
  };
  $('#modal-content').innerHTML = (templates[view] || templates.home)();
  renderIcons(); updateInviteStatus();
  if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() { $('#modal').close(); }
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el) return;
  if (el.dataset.open) { openModal(el.dataset.open); return; }
  if (el.dataset.close !== undefined || el.id === 'modal-close') { closeModal(); return; }
  if (el.dataset.action) { dispatch({ type: el.dataset.action }); return; }
  if (el.id === 'cat') { dispatch({ type: 'pet' }); return; }
  if (el.dataset.food) {
    selectedFood = el.dataset.food;
    document.querySelectorAll('[data-food]').forEach(button => { const selected = button.dataset.food === selectedFood; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
    $('.feed-love').innerHTML = `+${FOODS[selectedFood].love} ${icon('heart')}`; renderIcons(); return;
  }
  if (el.id === 'feed-button') { dispatch({ type: 'feed', food: selectedFood }); return; }
  if (el.id === 'toggle-sound') { sound = !sound; save('catnest.sound',sound); openModal('settings'); chime(); return; }
  if (el.id === 'invite-copy' || el.id === 'invite-share') { shareInvite(el.id === 'invite-share'); return; }
  if (el.id === 'go-solo') {
    sync?.destroy(); sync = null; shared = false; members = []; status = { phase:'solo', role:null, message:'单人小窝' };
    const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null,'',url); renderConnection(); closeModal(); toast('已回到单人小窝，当前存档已保留');
  }
});
async function shareInvite(nativeShare) {
  if (!shared || ['error','offline','full'].includes(status.phase)) startSync();
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
  if (form.id === 'profile-form' && name) { profile.name=name.slice(0,16); save('catnest.profile',profile); sync?.updateName(profile.name); closeModal(); toast('昵称已保存'); }
  if (form.id === 'join-form') { const code=new FormData(form).get('code')?.trim().toLowerCase(); if (/^[a-z0-9]{6,12}$/.test(code)) { const url=new URL(location.href); url.searchParams.set('room',code); location.assign(url); } }
});
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const box=$('#modal').getBoundingClientRect(); if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) closeModal(); } });
render(); renderConnection(); if (shared) startSync();
window.addEventListener('pagehide', () => sync?.destroy());
window.addEventListener('pageshow', e => { if (e.persisted && shared) startSync(); });
