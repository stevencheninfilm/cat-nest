import { FOODS } from './state.js';
import { GROWTH_STAGES, stageStyle } from './growth-stages.js';
import { GAMES } from './minigames.js';

const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const LABELS = { feed:'喂食', pet:'摸摸', play:'玩耍', sleep:'休息', 'restaurant-collect':'餐厅经营经验' };
let artworkId = 0;

/** Reference-matched, pre-rendered 3D artwork is shared by every growth surface.
 * The SVG and mesh canvas remain available if an image cannot be loaded.
 */
export function jellyHeartMarkup(stage = GROWTH_STAGES[0]) {
  const id = `jelly-heart-${++artworkId}`;
  const gem = ['crystal','ruby','sapphire','diamond'].includes(stage.material);
  return `<span class="growth-heart" data-heart-stage="${stage.id}" style="${stageStyle(stage)}" aria-hidden="true"><img class="growth-heart-art" src="./assets/growth-hearts/v1/${stage.id}.webp" width="512" height="512" alt="" decoding="async" loading="lazy" draggable="false"/><canvas class="growth-heart-canvas" data-heart-stage="${stage.id}" width="192" height="192"></canvas><svg class="growth-heart-fallback" viewBox="0 0 100 100"><defs><radialGradient id="${id}-body" cx=".3" cy=".24" r=".8"><stop stop-color="${stage.light}"/><stop offset=".38" stop-color="${stage.color}"/><stop offset=".75" stop-color="${stage.color}"/><stop offset="1" stop-color="${stage.deep}"/></radialGradient><linearGradient id="${id}-shine" x2=".5" y2="1"><stop stop-color="#fffce0" stop-opacity=".98"/><stop offset="1" stop-color="#fffce0" stop-opacity="0"/></linearGradient></defs><path fill="${stage.edge}" d="M51 25C36 5 8 13 8 37C8 60 28 78 52 91C77 80 96 57 96 35C96 11 67 7 51 25Z"/><path fill="url(#${id}-body)" d="M48 20C34 2 5 9 5 33C5 58 23 75 48 87C72 76 92 56 92 31C92 8 63 3 48 20Z"/>${gem ? '<path d="M48 20L24 28L18 49L48 75L78 47L73 24L48 20L48 75M18 49L78 47M24 28L48 43L73 24" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.4"/>' : ''}<ellipse fill="url(#${id}-shine)" cx="23" cy="27" rx="9" ry="15" transform="rotate(28 23 27)"/><path fill="none" stroke="${stage.light}" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round" d="M73 16Q85 21 85 34"/></svg><span class="growth-glint growth-glint-a"></span><span class="growth-glint growth-glint-b"></span></span>`;
}

export function growthLabel(reward) {
  if (reward.kind === 'game') return GAMES[reward.game]?.name || '小游戏';
  return reward.kind === 'feed' ? FOODS[reward.food]?.name || '喂食' : LABELS[reward.kind] || '陪伴';
}

function rewardButton(reward, { blocked = false, claimingRewardId = null, pendingRewardIds = new Set(), detailed = false, stage = GROWTH_STAGES[0] } = {}) {
  const claiming = reward.id === claimingRewardId || pendingRewardIds.has(reward.id);
  const label = growthLabel(reward);
  const multiplier = reward.boosted ? (10 + (reward.boostCount ?? 1)) / 10 : 1;
  return `<button class="growth-bubble ${detailed ? 'growth-bubble-detailed' : ''}" style="${stageStyle(stage)}" data-growth-reward="${escape(reward.id)}" ${blocked || claiming ? 'disabled' : ''} aria-label="领取${escape(label)}的 ${reward.amount} 点成长${reward.boosted ? `，已含好状态 ${multiplier} 倍加成` : ''}" title="${reward.boosted ? `已含好状态 ×${multiplier} 加成；` : ''}点击领取，未领取的气泡会一直保留"><span class="growth-orb" aria-hidden="true">${jellyHeartMarkup(stage)}<strong>+${reward.amount}</strong></span><span class="growth-label">${claiming ? '领取中…' : escape(label)}</span>${detailed ? `<span class="growth-actor">${escape(reward.actor)}的${reward.kind==='restaurant-collect'?'餐厅经营':'陪伴'}${reward.boosted ? ` · 好状态 ×${multiplier}` : ''}</span>` : ''}</button>`;
}

/** Keep existing rewards in their own side slots when another bubble is collected. */
export function growthSideSlots(rewards = [], previous = []) {
  const used = new Set();
  const slots = Array.from({ length:4 }, (_, index) => {
    const reward = previous[index] && rewards.find(item => item.id === previous[index].id);
    if (!reward || used.has(reward.id)) return null;
    used.add(reward.id); return reward;
  });
  for (const reward of rewards) {
    const slot = slots.indexOf(null);
    if (slot < 0) break;
    if (used.has(reward.id)) continue;
    slots[slot] = reward; used.add(reward.id);
  }
  return slots;
}

let homeSlots = [];
export function growthBubbles(rewards = [], options = {}) {
  homeSlots = growthSideSlots(rewards, homeSlots);
  if (!rewards.length) return '';
  const side = (name, indices, footer) => `<div class="growth-side growth-side-${name}" role="group" aria-label="小猫${name === 'left' ? '左' : '右'}侧成长气泡">${indices.map(index => `<div class="growth-side-slot" data-growth-slot="${index}">${homeSlots[index] ? rewardButton(homeSlots[index], options) : ''}</div>`).join('')}${footer}</div>`;
  const hint = '<span class="growth-tap-hint">点击气泡<br/>收下成长</span>';
  const more = rewards.length > 4 ? `<button class="growth-more" data-open="growth" aria-label="查看全部 ${rewards.length} 个待领取成长气泡"><strong>+${rewards.length - 4}</strong><span>更多成长</span></button>` : '';
  return `${side('left', [0, 2], hint)}${side('right', [1, 3], more)}`;
}

/** Keep unchanged bubble nodes and decoded artwork alive during rapid claims. */
export function createGrowthBubbleView(root) {
  let slots = [], signatures = [], elements = null, more;
  return {
    render(rewards = [], options = {}) {
      if (!rewards.length) {
        if (elements) root.replaceChildren();
        slots = []; signatures = []; elements = null; more = null; return;
      }
      if (!elements) {
        const side = (name, indices, footer) => `<div class="growth-side growth-side-${name}" role="group" aria-label="小猫${name === 'left' ? '左' : '右'}侧成长气泡">${indices.map(index => `<div class="growth-side-slot" data-growth-slot="${index}"></div>`).join('')}${footer}</div>`;
        root.innerHTML = side('left', [0, 2], '<span class="growth-tap-hint">点击气泡<br/>收下成长</span>') + side('right', [1, 3], '<button class="growth-more" data-open="growth" hidden><strong></strong><span>更多成长</span></button>');
        elements = Array.from({length:4}, (_, index) => root.querySelector(`[data-growth-slot="${index}"]`));
        more = root.querySelector('.growth-more');
      }
      slots = growthSideSlots(rewards, slots);
      slots.forEach((reward, index) => {
        const signature = reward ? JSON.stringify([reward.id,reward.amount,reward.kind,reward.food,reward.game,reward.actor,reward.boosted,reward.boostCount,options.stage?.id]) : '';
        if (signatures[index] !== signature) {
          elements[index].innerHTML = reward ? rewardButton(reward, options) : '';
          signatures[index] = signature;
        }
        if (!reward) return;
        const button = elements[index].querySelector('button');
        const claiming = reward.id === options.claimingRewardId || options.pendingRewardIds?.has(reward.id);
        const disabled = Boolean(options.blocked || claiming);
        if (button.disabled !== disabled) button.disabled = disabled;
        const label = elements[index].querySelector('.growth-label'), text = claiming ? '领取中…' : growthLabel(reward);
        if (label.textContent !== text) label.textContent = text;
      });
      more.hidden = rewards.length <= 4;
      if (!more.hidden) {
        const count = more.querySelector('strong'), text = `+${rewards.length - 4}`;
        if (count.textContent !== text) count.textContent = text;
        more.setAttribute('aria-label', `查看全部 ${rewards.length} 个待领取成长气泡`);
      }
    },
  };
}

export function growthTray(rewards = [], options = {}) {
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(rewards.length / pageSize));
  const page = Math.min(pageCount - 1, Math.max(0, options.page || 0));
  const items = rewards.slice(page * pageSize, (page + 1) * pageSize);
  return `<div class="growth-tray-heading"><span class="eyebrow">LITTLE HEARTS, READY FOR YOU</span><h2>把这份成长收下吧</h2><p>每一次陪伴，都变成了一颗小心意。<br/>点击气泡才计入成长，未领取会一直保留。</p></div>${rewards.length ? `<div class="growth-tray-count">${rewards.length} 个气泡 · 共 ${rewards.reduce((sum, reward) => sum + Math.round(reward.amount * 10), 0) / 10} 点待领取</div><div class="growth-tray-grid">${items.map(reward => rewardButton(reward, { ...options, detailed:true })).join('')}</div>${pageCount > 1 ? `<div class="growth-tray-pages"><button data-growth-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>上一页</button><span>${page + 1} / ${pageCount}</span><button data-growth-page="${page + 1}" ${page === pageCount - 1 ? 'disabled' : ''}>下一页</button></div>` : ''}` : '<p class="growth-empty">小心意都收好啦 ♡<br/>下一次陪伴，会再带来新的成长气泡。</p>'}`;
}
