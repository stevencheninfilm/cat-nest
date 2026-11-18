import { supperTeamPreview } from './restaurant-supper-club.js';

const themeDishes = { mains:'rice', desserts:'pancake', drinks:'matcha' };
const number = value => value.toLocaleString('zh-CN');

function bannerUrl(themeId) {
  const base = import.meta.env?.BASE_URL || './';
  return new URL(`${base}assets/restaurant/supper-club/${themeId}.webp`, globalThis.document?.baseURI || import.meta.url).href;
}

export function supperSelection(club, draft = {}) {
  const theme = club.themes.find(item => item.id === draft.themeId) || club.themes[0];
  const hiredIds = club.workers.map(worker => worker.id);
  const preferred = (draft.workerIds || []).filter(id => hiredIds.includes(id));
  const workerIds = [...new Set([...preferred, ...hiredIds])].slice(0, 2);
  return { theme, workerIds };
}

function themeMenu(club, selectedId) {
  return `<div class="rs-theme-menu" role="group" aria-label="选择餐会主题">${club.themes.map(theme =>
    `<button type="button" class="rs-theme" data-r-supper-theme="${theme.id}" aria-pressed="${theme.id === selectedId}">
      <span class="r-food r-food-${themeDishes[theme.id]}" aria-hidden="true"></span>
      <span><strong>${theme.name}</strong><small>已办 ${number(theme.completed)} 场</small></span>
    </button>`).join('')}</div>`;
}

function teamMarkup(club, workerIds, preview) {
  const cards = workerIds.map((id, slot) => {
    const employee = club.workers.find(worker => worker.id === id);
    if (!employee) return '';
    const name = club.active ? `<strong>${employee.name}</strong>` :
      `<select data-r-supper-slot="${slot}" aria-label="选择第${slot + 1}位餐会搭档">${club.workers.map(worker => {
        const used = workerIds.includes(worker.id) && worker.id !== id;
        return `<option value="${worker.id}"${worker.id === id ? ' selected' : ''}${used ? ' disabled' : ''}>${worker.name}</option>`;
      }).join('')}</select>`;
    return `<div class="rs-employee"><span class="r-cat r-cat-${employee.sprite}" aria-hidden="true"></span>
      <div>${name}<small>${employee.role}</small></div>
      <p>${preview.workers.find(worker => worker.id === id).description}</p></div>`;
  }).join('');
  return `<section class="rs-team" aria-label="本场搭档"><h4>本场搭档</h4>
    <div class="rs-crew">${cards}${workerIds.length < 2 ? '<button type="button" class="rs-empty-seat" data-r-tab="staff">招募一位搭档 ↗</button>' : ''}</div></section>`;
}

function signatureMenu(theme, signature, active, roomForBonus) {
  if (!signature) return '';
  const collected = signature.collected || [];
  const bonus = Math.min(signature.bonus, Math.max(0, roomForBonus));
  const dishList = signature.dishes.map(dish => {
    const stamped = collected.includes(dish.id);
    return `<li class="rs-dish" data-collected="${stamped}">
      <span class="r-food r-food-${dish.id}" aria-hidden="true"></span>${dish.name}${stamped ? '<span aria-label="已集到">✓</span>' : ''}
    </li>`;
  }).join('');
  const status = signature.completed ? '已集齐 · 收席发放' : `收席前结清 ${signature.target} 种不同${theme.category}。`;
  return `<section class="rs-signature" aria-label="招牌菜单">
    <header><h4>招牌菜单</h4><span>额外 +${number(bonus)} 灵感</span></header>
    <p>${status}${active ? ` <b>${collected.length} / ${signature.target}</b>` : ''}</p>
    ${dishList ? `<ul aria-label="本主题可集菜品">${dishList}</ul>` : ''}
    ${!signature.available && !signature.completed ? `<small>当前可点的${theme.category}不足 ${signature.target} 种，解锁新菜后可在本场收集。</small>` : ''}
    ${bonus < signature.bonus ? `<small>本档额外奖励为 ${signature.bonus} 灵感，实际按剩余额度入账。</small>` : ''}
  </section>`;
}

function pastSupper(club) {
  const { last } = club;
  if (!last) return '';
  const theme = club.themes.find(item => item.id === last.themeId);
  const signature = last.signature;
  const detail = signature?.completed ? `招牌菜单已集齐 · 其中 ${number(signature.creditedBonus)} 灵感来自集菜` : '已存入菜谱研发室';
  return `<aside class="rs-receipt" aria-label="上场收席记录"><span class="rs-receipt-mark" aria-hidden="true">✓</span>
    <div><strong>${theme.name}已收席</strong><small>${detail}</small></div>
    <b>+${number(last.reward)} <small>灵感</small></b></aside>`;
}

export function supperServiceFeedback(previousRun, club) {
  if (!previousRun) return '';
  if (club.active?.run === previousRun) return `餐会进度 ${club.active.progress} / ${club.active.target}`;
  if (club.last?.run === previousRun) return `餐会圆满 · 研发灵感 +${number(club.last.reward)}`;
  return '';
}

function startControls(club, theme, workerIds, reward, coins) {
  const shortfall = Math.max(0, theme.cost - coins);
  let notice = '';
  if (!club.unlocked) notice = `小馆 Lv.${club.unlockLevel} 开放主题餐会`;
  else if (workerIds.length < 2) notice = '需两位已入职的猫猫一起开席';
  else if (shortfall) notice = `还差 ${number(shortfall)} 小鱼干`;
  else if (reward > club.inspirationRoom) notice = '累计灵感剩余额度不足以开办这一场';
  return `<div class="rs-price"><span>开办费 <strong>${number(theme.cost)} 小鱼干</strong></span><small>持有 ${number(coins)}</small></div>
    <p class="rs-notice">${theme.tier < club.maxTier ? '办成后本主题升一档，下场费用、目标和回报提高。' : '本主题已达最高档，可反复开席。'}</p>
    ${notice ? `<p id="rs-start-notice">${notice}</p>` : ''}
    <button type="button" class="rs-start" data-r-action="supper-start" data-r-supper-run="${club.nextRun}" data-r-supper-theme-id="${theme.id}" data-r-supper-workers="${workerIds.join(',')}"${notice ? ' disabled aria-describedby="rs-start-notice"' : ''}>开办${theme.name}</button>`;
}

export function restaurantSupperPanel(club, { draft, coins = 0, offline = false } = {}) {
  const { active } = club;
  const selection = supperSelection(club, active || draft);
  const { theme } = selection;
  const workerIds = active?.workerIds || selection.workerIds;
  const preview = supperTeamPreview(theme, workerIds);
  const target = active?.target ?? theme.target;
  const reward = active ? Math.min(active.reward, club.inspirationRoom) : preview.reward;
  const milestone = theme.favoriteUnlocked
    ? `主题偏好已解锁 · 本主题开席时，新来的普通顾客抽到${theme.category}的权重 ×2。`
    : `再办成 ${club.favoriteUnlockCompletions - theme.completed} 场，新来的普通顾客在本主题餐会上抽到${theme.category}的权重 ×2。`;
  return `<section class="rs-club" data-theme="${theme.id}" data-state="${active ? 'serving' : 'planning'}" aria-label="主题餐会">
    ${!active ? pastSupper(club) + themeMenu(club, theme.id) : ''}
    <div class="rs-invitation">
      <header class="rs-cover"><img src="${bannerUrl(theme.id)}" alt="" decoding="async" width="720" height="480">
        <div class="rs-cover-caption"><small>第 ${active?.tier ?? theme.tier} 档 · ${active ? '进行中' : '待开席'}</small><h3>${theme.name}</h3></div>
      </header>
      <div class="rs-service"><div class="rs-totals">
        <div><small>${active ? '餐会进度' : '收席目标'}</small><strong>${active ? `${number(active.progress)} <i>/</i> ` : ''}${number(target)} <em>点</em></strong></div>
        <div><small>收席奖励</small><strong>${number(reward)} <em>研发灵感</em></strong></div>
      </div>
      ${active ? `<progress aria-label="餐会进度" max="${target}" value="${active.progress}">${active.progress} / ${target}</progress>` : ''}
      <p>每结清一道菜 +1 点，${theme.category}额外 +1 点。</p></div>
    </div>
    ${signatureMenu(theme, active ? active.signature : theme.signature, active, club.inspirationRoom - reward)}
    ${teamMarkup(club, workerIds, preview)}
    <p class="rs-perk">${milestone}</p>
    <footer class="rs-footer">${active ? '<button type="button" class="rs-start" data-r-dismiss data-r-supper-return>回餐厅接单</button>' : startControls(club, theme, workerIds, reward, coins)}
      ${offline ? '<p class="rs-notice" role="status">离线中 · 操作暂存在本机，联网后同步</p>' : ''}
    </footer></section>`;
}
