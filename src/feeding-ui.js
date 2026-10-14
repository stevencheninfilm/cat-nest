import { FOODS, feedingInfo } from './state.js';

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
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export function foodArt(id, className = '') {
  return `<span class="food-sprite ${className}" style="--food-position:${FOOD_DETAILS[id]?.position || '50% 0%'}" aria-hidden="true"></span>`;
}
export function foodPreview(id) {
  const food = FOODS[id] || FOODS.meal;
  return `${foodArt(id)}<span class="food-preview-copy"><small>猫咪小餐桌</small><strong>${food.name}</strong><span>♡ +${food.love} <i>·</i> ${food.cost} 猫爪币</span><em>${Object.keys(FOODS).length} 种食物，挑一份喜欢的 <b>›</b></em></span>`;
}
export function countdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function pairSlots(info, clientId, profileName, members) {
  const other = members.find(member => member.id !== clientId);
  const occupied = !info.mine && info.records.length === 2 && info.records.every(record => record.active);
  const entries = occupied ? info.records.map(record => ({ record, name:record.name, mine:false })) : [
    { record: info.mine, name: profileName, mine: true },
    { record: info.partner, name: info.partner?.name || other?.name || '等一位猫友', mine: false },
  ];
  return entries.map(({ record, name, mine }) => `<article class="feeder-card ${record?.inCurrentWindow ? 'has-fed' : ''}"><span class="feeder-avatar ${mine ? 'mine' : ''}">${escape(name.slice(0, 1))}</span><strong>${escape(name)}${mine ? '<small>我</small>' : ''}</strong>${record ? `${foodArt(record.food, 'feeder-food')}<span class="feeder-food-name">${FOODS[record.food]?.name || '美味小餐'}</span><time ${record.active ? `data-feed-until="${record.expiresAt}"` : ''}>${record.active ? countdown(record.remainingMs) : '本次喂养已结束'}</time><small class="feeder-round-status">${record.inCurrentWindow ? '✓ 本轮已喂养' : '本轮还未喂养'}${record.active && !record.inCurrentWindow ? ' · 上一餐计时' : ''}</small>` : '<span class="empty-feeder">♡</span><span class="feeder-empty-label">本轮还未喂养</span>'}</article>`).join('');
}
export function feedingSheet({ state, selectedFood, tab = 'menu', category = 'all', clientId, profileName, members, saving = false, connected = true }) {
  const food = FOODS[selectedFood] || FOODS.meal;
  const info = feedingInfo(state, clientId);
  const active = info.windowActive;
  const completed = active && info.bonusClaimed;
  const occupied = !info.mine && info.records.length === 2 && info.records.every(record => record.active);
  const canFeed = connected && !saving && state.coins >= food.cost;
  const filters = [['all', '全部'], ['meals', '主食'], ['treats', '小零食'], ['drinks', '饮水']];
  return `<div class="feeding-handle" aria-hidden="true"></div>
    <header class="feeding-sheet-heading"><span>FEED WITH LOVE</span><h2>一起喂养，快乐加倍</h2></header>
    <div class="dish-preview"><span class="dish-time">◷ 4 小时一轮</span><div class="food-dish"></div>${foodArt(selectedFood, 'dish-food')}<div class="dish-caption"><strong>${food.name}</strong><span>${FOOD_DETAILS[selectedFood]?.note || ''}</span></div></div>
    <div class="feeding-tabs" role="tablist" aria-label="喂食页面"><button id="food-menu-tab" role="tab" data-feeding-tab="menu" aria-controls="food-menu-panel" aria-selected="${tab === 'menu'}">挑选食物 <span>${Object.keys(FOODS).length}</span></button><button id="food-pair-tab" role="tab" data-feeding-tab="pair" aria-controls="food-pair-panel" aria-selected="${tab === 'pair'}">双人喂养${completed ? ' ✓' : ''}</button></div>
    <section id="food-menu-panel" role="tabpanel" aria-labelledby="food-menu-tab" ${tab === 'menu' ? '' : 'hidden'}>
      <div class="food-filters" role="group" aria-label="食物分类">${filters.map(([id, label]) => `<button data-food-category="${id}" aria-pressed="${category === id}">${label}</button>`).join('')}</div>
      <div class="pantry-grid" role="group" aria-label="选择喂食的食物">${Object.entries(FOODS).filter(([id]) => category === 'all' || FOOD_DETAILS[id]?.category === category).map(([id, item]) => `<button class="pantry-item ${id === selectedFood ? 'selected' : ''}" data-food="${id}" aria-pressed="${id === selectedFood}" aria-label="${item.name}，亲密度加${item.love}，${item.cost}猫爪币"><span class="pantry-love">♡ +${item.love}</span>${foodArt(id)}<strong>${item.name}</strong><span class="pantry-price">✦ ${item.cost}<span>猫爪币</span></span><span class="pantry-selected" aria-hidden="true">♥</span></button>`).join('')}</div>
    </section>
    <section id="food-pair-panel" role="tabpanel" aria-labelledby="food-pair-tab" ${tab === 'pair' ? '' : 'hidden'}>
      <div class="pair-intro"><strong>${completed ? '这一轮，你们的心意都到啦' : '一人一份，都是对小猫的偏爱'}</strong><span>${active ? `本轮剩余 <time data-feed-until="${info.windowEndsAt}">${countdown(info.windowRemainingMs)}</time>` : '首次喂养后，开启 4 小时双人小任务'}</span></div>
      <div class="feeders-grid">${pairSlots(info, clientId, profileName, members)}</div>
      ${occupied ? '<p class="pair-bonus">两位猫友的餐食仍在计时。新设备喂食照常计入成长，计时结束后可加入双人记录。</p>' : ''}
      <p class="pair-bonus ${completed ? 'earned' : ''}">${completed ? '♥ 双人喂养奖励已获得 +10' : '♥ 本轮两人各喂一次，额外获得 10 亲密度'}</p>
      <button class="pair-invite" id="feeding-invite">邀请猫友一起喂养 <span>↗</span></button>
    </section>
    <footer class="feeding-footer"><button class="serve-food" id="serve-food" ${canFeed ? '' : 'disabled'}>${saving ? '正在保存这份心意…' : !connected ? '正在连接云端小窝…' : state.coins < food.cost ? '猫爪币还不够啦' : `喂这个 <span>♡ +${food.love}</span>`}</button><div class="feeding-balance"><span>✦ ${state.coins.toLocaleString('en-US')} 猫爪币可用</span><small id="feeding-save-status" aria-live="polite"></small></div></footer>`;
}
