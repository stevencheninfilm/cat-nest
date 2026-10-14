import { FOODS } from './state.js';

const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const LABELS = { feed:'喂食', pet:'摸摸', play:'玩耍', sleep:'休息' };

export function growthLabel(reward) {
  return reward.kind === 'feed' ? FOODS[reward.food]?.name || '喂食' : LABELS[reward.kind] || '陪伴';
}

function rewardButton(reward, { blocked = false, claimingRewardId = null, detailed = false } = {}) {
  const claiming = reward.id === claimingRewardId;
  const label = growthLabel(reward);
  return `<button class="growth-bubble ${detailed ? 'growth-bubble-detailed' : ''}" data-growth-reward="${escape(reward.id)}" ${blocked ? 'disabled' : ''} aria-label="领取${escape(label)}的 ${reward.amount} 点成长" title="点击领取，未领取的气泡会一直保留"><span class="growth-orb" aria-hidden="true"><span class="growth-heart">♥</span><strong>+${reward.amount}</strong></span><span class="growth-label">${claiming ? '领取中…' : escape(label)}</span>${detailed ? `<span class="growth-actor">${escape(reward.actor)}的陪伴</span>` : ''}</button>`;
}

export function growthBubbles(rewards = [], options = {}) {
  if (!rewards.length) return '';
  return `<div class="growth-bubble-row">${rewards.slice(0, 3).map(reward => rewardButton(reward, options)).join('')}${rewards.length > 3 ? `<button class="growth-more" data-open="growth" aria-label="查看全部 ${rewards.length} 个待领取成长气泡"><strong>+${rewards.length - 3}</strong><span>更多</span></button>` : ''}</div><span class="growth-tap-hint">点击气泡，收下成长</span>`;
}

export function growthTray(rewards = [], options = {}) {
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(rewards.length / pageSize));
  const page = Math.min(pageCount - 1, Math.max(0, options.page || 0));
  const items = rewards.slice(page * pageSize, (page + 1) * pageSize);
  return `<div class="growth-tray-heading"><span class="eyebrow">LITTLE HEARTS, READY FOR YOU</span><h2>把这份成长收下吧</h2><p>每一次陪伴，都变成了一颗小心意。<br/>点击气泡才计入成长，未领取会一直保留。</p></div>${rewards.length ? `<div class="growth-tray-count">${rewards.length} 个气泡 · 共 ${rewards.reduce((sum, reward) => sum + reward.amount, 0)} 点待领取</div><div class="growth-tray-grid">${items.map(reward => rewardButton(reward, { ...options, detailed:true })).join('')}</div>${pageCount > 1 ? `<div class="growth-tray-pages"><button data-growth-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>上一页</button><span>${page + 1} / ${pageCount}</span><button data-growth-page="${page + 1}" ${page === pageCount - 1 ? 'disabled' : ''}>下一页</button></div>` : ''}` : '<p class="growth-empty">小心意都收好啦 ♡<br/>下一次陪伴，会再带来新的成长气泡。</p>'}`;
}
