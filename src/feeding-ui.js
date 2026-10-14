import { FOODS, feedingInfo, careActionInfo } from './state.js';
import { COUPLE_ROLES } from './couple-profile.js';
import { foodRemainingPortion } from './food-portions.js';
import { countdown, foodDurationText, careStatusText, careRuleText } from './care-ui.js';
import { petNeeds, growthRewardAmount } from './pet-needs.js';

export { countdown } from './care-ui.js';

const FOOD_DETAILS = {
  snack: { category: 'treats', note: '酥酥脆脆的小奖励', position: '0% 0%' },
  meal: { category: 'meals', note: '每天都爱的营养一餐', position: '50% 0%' },
  fish: { category: 'meals', note: '开罐就闻到鲜香啦', position: '100% 0%' },
  chicken: { category: 'meals', note: '软嫩鸡肉，满满心意', position: '0% 50%' },
  shrimp: { category: 'meals', note: '一口一个鲜鲜小虾仁', position: '50% 50%' },
  salmon: { category: 'meals', note: '今天也要好好吃饭', position: '100% 50%' },
  mousse: { category: 'meals', note: '绵密细腻的小猫慕斯', position: '0% 100%' },
  treat: { category: 'treats', note: '舔一舔，快乐多一点', position: '50% 100%' },
  water: { category: 'drinks', note: '咕嘟咕嘟，补点水吧', position: '100% 100%' },
};
const selectedMeal = id => Object.hasOwn(FOODS, id) ? id : 'meal';

export function foodArt(id, className = '', portion = 100, expiresAt) {
  id = selectedMeal(id);
  portion = [0, 25, 50, 75, 100].includes(portion) ? portion : 100;
  const serving = Number.isFinite(expiresAt) && expiresAt >= 0 ? ` data-serving-food="${id}" data-serving-until="${Math.trunc(expiresAt)}"` : '';
  return `<span class="food-sprite ${className}" data-food-portion="${portion}"${serving} style="--food-position:${FOOD_DETAILS[id]?.position || '50% 0%'}" aria-hidden="true"></span>`;
}
export function updateFoodPortions(root, now = Date.now()) {
  for (const art of root.querySelectorAll('.food-sprite[data-serving-until]')) {
    const portion = String(foodRemainingPortion(art.dataset.servingFood, Number(art.dataset.servingUntil) - now));
    if (art.dataset.foodPortion !== portion) art.dataset.foodPortion = portion;
  }
}
/** Kept for callers that only need the menu's selected-food preview. */
export function foodPreview(id) {
  id = selectedMeal(id);
  const food = FOODS[id];
  return `${foodArt(id)}<span class="food-preview-copy"><small>准备喂食 · 尚未上桌</small><strong>${food.name}</strong><span>♡ +${food.love} <i>·</i> ${food.cost} 猫爪币</span><em>点这里，挑一份喜欢的 <b>›</b></em></span>`;
}
function roleRecord(info, role, clientId) {
  // Stable identities are the normal path. Legacy two-person records remain
  // visible until both partners have served a meal with the current identities.
  const exact = info.records.find(item => item.actorId === role.clientId);
  if (exact) return exact;
  const mine = role.clientId === clientId;
  if (!COUPLE_ROLES.some(item => item.clientId === clientId)) return null;
  return mine ? info.mine : info.partner;
}
function statusFor(record, info) {
  if (record?.inCurrentWindow) return { className: 'has-fed', label: '✓ 本轮已喂' };
  if (record?.active) return { className: 'previous-meal', label: '上餐未结束' };
  if (record) return { className: 'meal-ended', label: info.windowActive ? '本轮未喂' : '本餐已结束' };
  return { className: 'not-fed', label: '本轮未喂' };
}
function pairChips(info, clientId, members = []) {
  return `<span class="feeding-pair-chips" aria-label="我和对方的喂食状态">${[...COUPLE_ROLES].sort((a, b) => Number(b.clientId === clientId) - Number(a.clientId === clientId)).map(role => {
    const mine = role.clientId === clientId;
    const record = roleRecord(info, role, clientId);
    const status = statusFor(record, info);
    const online = members.some(member => member.id === role.clientId);
    return `<span class="feeding-status-chip ${status.className}" data-feeder="${role.id}"><b>${mine ? '我' : '对方'}</b><span>${status.label}</span>${online ? '<i class="feeder-online" aria-label="在线"></i>' : ''}</span>`;
  }).join('')}</span>`;
}
function pairSummary(info, clientId, members) {
  return `<section class="feeding-pair-summary" aria-label="本轮双人喂食状态"><div class="feeding-pair-summary-label"><strong>我们的小餐桌</strong><span>${info.windowActive ? `双人窗口剩余 <time data-feed-until="${info.windowEndsAt}">${countdown(info.windowRemainingMs)}</time>` : '本轮尚未开始'}</span></div>${pairChips(info, clientId, members)}</section>`;
}
/** Each side of the shared plate follows that person's meal and expiry time. */
export function feedingHome({ state, clientId, now = Date.now() }) {
  const info = feedingInfo(state, clientId, now);
  return `<span class="home-shared-dish" aria-label="共享餐盘，左边男方，右边女方"><span class="food-dish" aria-hidden="true"></span>${COUPLE_ROLES.map(role => {
    const record = roleRecord(info, role, clientId);
    const active = Boolean(record?.active);
    const status = statusFor(record, info);
    const food = active ? FOODS[record.food] : null;
    const mine = role.clientId === clientId;
    const label = active ? `${food.name}，${status.label}，本餐剩余 ${countdown(record.remainingMs)}` : record ? '本餐已结束' : '还没上桌';
    return `<span class="home-meal-slot ${role.id} ${active ? 'meal-active' : record ? 'meal-ended' : 'meal-empty'}" data-feeder="${role.id}" ${active ? `data-current-food="${record.food}"` : ''} aria-label="${role.name}：${label}${mine ? '，我' : ''}">${active ? `${foodArt(record.food, 'home-serving-food', foodRemainingPortion(record.food, record.remainingMs), record.expiresAt)}<span class="home-meal-meta"><span class="home-meal-timer"><i aria-hidden="true">◷</i><time aria-label="${role.name}本餐剩余" data-feed-until="${record.expiresAt}">${countdown(record.remainingMs)}</time></span></span>` : ''}</span>`;
  }).join('')}</span>`;
}
function pairSlots(info, clientId, members = []) {
  return COUPLE_ROLES.map(role => {
    const record = roleRecord(info, role, clientId);
    const mine = clientId === role.clientId;
    const online = members.some(member => member.id === role.clientId);
    const status = statusFor(record, info);
    return `<article class="feeder-card ${status.className}"><span class="feeder-avatar ${mine ? 'mine' : ''} ${role.id}">${role.id === 'male' ? '👦🏻' : '👧🏻'}</span><strong>${role.name}${mine ? '<small>我</small>' : online ? '<small>在线</small>' : ''}</strong>${record ? `${foodArt(record.food, 'feeder-food', foodRemainingPortion(record.food, record.remainingMs), record.expiresAt)}<span class="feeder-food-name">${FOODS[record.food]?.name || '美味小餐'}</span><time ${record.active ? `data-feed-until="${record.expiresAt}"` : ''}>${record.active ? countdown(record.remainingMs) : '本次喂养已结束'}</time><small class="feeder-round-status">${status.label}${record.active && !record.inCurrentWindow ? ' · 本轮还未喂养' : ''}</small>` : '<span class="empty-feeder">♡</span><span class="feeder-empty-label">本轮还未喂养</span>'}</article>`;
  }).join('');
}
export function feedingButtonContent({ state, selectedFood, clientId, saving = false, connected = true, now = Date.now() }) {
  const food = FOODS[selectedMeal(selectedFood)];
  const growth = growthRewardAmount(food.love, petNeeds(state,now).boostCount);
  const care = careActionInfo(state, { type:'feed' }, clientId, now);
  const disabled = !connected || saving || !care.allowed || state.coins < food.cost;
  const content = saving ? '正在保存这份心意…' : !connected ? '正在连接云端小窝…' : care.reason === 'daily_limit' ? '今日喂食次数已用完' : care.reason === 'cooldown' ? `${countdown(care.remainingMs)} 后可喂食` : state.coins < food.cost ? '猫爪币还不够啦' : `喂这个 <span>成长气泡 +${growth}</span>`;
  return { disabled, content };
}
export function feedingSheet({ state, selectedFood, tab = 'menu', category = 'all', clientId, members = [], saving = false, connected = true, now = Date.now() }) {
  selectedFood = selectedMeal(selectedFood);
  const food = FOODS[selectedFood];
  const needs = petNeeds(state,now);
  const info = feedingInfo(state, clientId, now);
  const care = careActionInfo(state, { type:'feed' }, clientId, now);
  const pairCare = careActionInfo(state, { type:'pair' }, clientId, now);
  const completed = info.windowActive && info.bonusClaimed;
  const serve = feedingButtonContent({ state, selectedFood, clientId, saving, connected, now });
  const filters = [['all', '全部'], ['meals', '主食'], ['treats', '小零食'], ['drinks', '饮水']];
  return `<div class="feeding-handle" aria-hidden="true"></div>
    <header class="feeding-sheet-heading"><span>FEED WITH LOVE</span><h2>一起喂养，快乐加倍</h2></header>
    <div class="dish-preview"><span class="dish-time">◷ 冷却 ${foodDurationText(selectedFood)}</span><div class="food-dish"></div>${foodArt(selectedFood, 'dish-food')}<div class="dish-caption"><strong>${food.name}</strong><span>准备喂食 · 尚未上桌</span></div></div>
    ${pairSummary(info, clientId, members)}
    <div class="feeding-tabs" role="tablist" aria-label="喂食页面"><button id="food-menu-tab" role="tab" data-feeding-tab="menu" aria-controls="food-menu-panel" aria-selected="${tab === 'menu'}">挑选食物 <span>${Object.keys(FOODS).length}</span></button><button id="food-pair-tab" role="tab" data-feeding-tab="pair" aria-controls="food-pair-panel" aria-selected="${tab === 'pair'}">喂养详情${completed ? ' ✓' : ''}</button></div>
    <section id="food-menu-panel" role="tabpanel" aria-labelledby="food-menu-tab" ${tab === 'menu' ? '' : 'hidden'}>
      <div class="food-filters" role="group" aria-label="食物分类">${filters.map(([id, label]) => `<button data-food-category="${id}" aria-pressed="${category === id}">${label}</button>`).join('')}</div>
      <div class="pantry-grid" role="group" aria-label="选择喂食的食物">${Object.entries(FOODS).filter(([id]) => category === 'all' || FOOD_DETAILS[id]?.category === category).map(([id, item]) => `<button class="pantry-item ${id === selectedFood ? 'selected' : ''}" data-food="${id}" aria-pressed="${id === selectedFood}" aria-label="${item.name}，成长气泡加${growthRewardAmount(item.love, needs.boostCount)}，亲密度加${item.love}，${item.cost}猫爪币，冷却${foodDurationText(id)}"><span class="pantry-love"><span>成长 +${growthRewardAmount(item.love, needs.boostCount)}</span><span class="pantry-duration">◷${foodDurationText(id)}</span></span>${foodArt(id)}<strong>${item.name}</strong><span class="pantry-price">✦ ${item.cost}</span><span class="pantry-selected" aria-hidden="true">♥</span></button>`).join('')}</div>
    </section>
    <section id="food-pair-panel" role="tabpanel" aria-labelledby="food-pair-tab" ${tab === 'pair' ? '' : 'hidden'}>
      <div class="pair-intro"><strong>${completed ? '这一轮，你们的心意都到啦' : '一人一份，都是对小猫的偏爱'}</strong><span>${info.windowActive ? '每人的食物时间各自计算，记录会一直保留' : '首次喂养后，开启 4 小时双人小任务'}</span></div>
      <div class="feeders-grid">${pairSlots(info, clientId, members)}</div>
      <p class="pair-bonus ${completed ? 'earned' : ''}">${completed ? '♥ 本轮双人喂养已完成' : pairCare.allowed ? '♥ 本轮两人各喂一次，额外获得 10 亲密度和成长气泡' : '♥ 今日双人奖励已达上限，本轮喂养仍可完成'}<small data-care-status="pair">${careStatusText('pair', pairCare)}</small></p>
    </section>
    <footer class="feeding-footer"><p class="feeding-care-status" data-care-status="feed">${careStatusText('feed', care)}</p><button class="serve-food" id="serve-food" ${serve.disabled ? 'disabled' : ''}>${serve.content}</button><p class="feeding-growth-hint">喂后点击爱心气泡，成长值才会入账<br/>${needs.boosted ? `已含状态 ×${needs.multiplier} 加成` : '当前基础成长 ×1.0'} · 双人额外奖励另计</p><div class="feeding-balance"><span>✦ ${state.coins.toLocaleString('en-US')} 猫爪币</span><details class="feeding-rules"><summary>喂养规则</summary><p class="feeding-care-rule">小窝共享${careRuleText('feed')} · 北京时间 0 点重置次数</p></details></div><small class="feeding-save-status" id="feeding-save-status" aria-live="polite"></small></footer>`;
}
