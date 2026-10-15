import { FOODS, careActionInfo } from './state.js';
import { petNeeds, growthRewardAmount, NEED_KEYS, NEED_LABELS, NEEDS_BOOST_THRESHOLD } from './pet-needs.js';
import { careStatusText, foodDurationText } from './care-ui.js';

export function needButtons() {
  return NEED_KEYS.map(key => `<button type="button" class="need-button" data-open="need-${key}" aria-label="查看${NEED_LABELS[key]}状态和提升方法"><i class="need-dot ${key}" aria-hidden="true"></i>${NEED_LABELS[key]} <b id="${key}">0</b><span class="need-delta" data-need-delta="${key}" aria-hidden="true" hidden></span></button>`).join('');
}

export function growthBonusBadge() {
  return '<button type="button" class="needs-boost" id="needs-growth-bonus" data-open="growth-bonus" aria-haspopup="dialog" title="点击查看三项状态的加成和提升方法"><span>成长</span><strong id="needs-growth-multiplier">×1.0</strong></button>';
}

export function growthBonusDetails(state, { now = Date.now() } = {}) {
  const needs = petNeeds(state, now);
  const target = NEEDS_BOOST_THRESHOLD + 1;
  const minutes = Math.max(1, Math.ceil((needs.nextDecayAt - now) / 60_000));
  return `<section class="growth-bonus-detail" aria-label="成长加成详情">
    <header class="bonus-heading"><h2>成长加成</h2><p>每项状态大于 80，成长 +10%</p></header>
    <div class="bonus-total"><span>当前总倍率</span><strong>×${needs.multiplier.toFixed(1)}</strong><small>基础 100% + 状态加成 ${needs.boostCount * 10}%</small></div>
    <div class="bonus-section-heading"><h3>状态贡献</h3><span>点选查看提升方法</span></div>
    <div class="bonus-status-list" aria-label="三项状态各自提供的加成">${NEED_KEYS.map(key => {
      const ready = needs[key] > NEEDS_BOOST_THRESHOLD;
      const gap = Math.max(0, target - needs[key]);
      return `<button type="button" class="bonus-status-row ${ready ? 'is-ready' : ''}" data-open="need-${key}" aria-label="${NEED_LABELS[key]} ${needs[key]} / 100，成长加成 ${ready ? '10%' : '0%'}，${ready ? '已达标' : `还差 ${gap} 点到 ${target}`}，点击查看提升方法"><i class="need-dot ${key}" aria-hidden="true"></i><span class="bonus-status-copy"><strong>${NEED_LABELS[key]} <small>${needs[key]} / 100</small></strong><span>${ready ? '已达标' : `还差 ${gap} 点到 ${target}`}</span></span><span class="bonus-status-contribution"><b>+${ready ? 10 : 0}%</b><i aria-hidden="true">›</i></span></button>`;
    }).join('')}</div>
    <p class="bonus-example">当前摸摸成长：<b>3 → ${growthRewardAmount(3,needs.boostCount)}</b> 点</p>
    <p class="bonus-notes">状态每 30 分钟各下降 1 点，约 ${minutes} 分钟后下降。<br/>按互动时状态计算，已生成的气泡数值不变。</p>
  </section>`;
}

const COPY = {
  hunger:{ title:'饱饱', good:'吃得饱饱，陪伴更有劲', low:'肚子有点空，来一份小餐吧', action:'feeding', cta:'去挑一份小餐', hint:'喂食恢复饱饱，每份食物还会增加 4 点开心。', note:'陪玩每次消耗 3 点饱饱；喝水不增加饱饱。' },
  mood:{ title:'开心', good:'心情很好，想把快乐分给你', low:'来陪它一会儿，让心情亮起来', action:'pet', cta:'温柔摸摸 · 开心 +6', methods:[['温柔摸摸',6],['逗猫棒陪玩',10],['每次喂食',4]], note:'陪玩同时消耗 8 点活力和 3 点饱饱。' },
  energy:{ title:'活力', good:'精神满满，准备好一起玩了', low:'有点累了，陪它休息一下吧', action:'sleep', cta:'陪它休息 · 活力 +20', methods:[['开始休息',20]], hint:'开始休息立即恢复 20 点活力。', note:'陪玩每次消耗 8 点活力，低于 8 点时需先休息。叫醒不增加活力或成长。' },
};

export function needDetails(state, key = 'hunger', { now = Date.now(), clientId } = {}) {
  key = Object.hasOwn(COPY, key) ? key : 'hunger';
  const copy = COPY[key], needs = petNeeds(state, now), value = needs[key];
  const healthy = value > NEEDS_BOOST_THRESHOLD;
  const minutes = Math.max(1, Math.ceil((needs.nextDecayAt - now) / 60_000));
  const gap = Math.max(0, NEEDS_BOOST_THRESHOLD + 1 - value);
  const action = key === 'hunger' ? null : careActionInfo(state, {type:copy.action}, clientId, now);
  const wake = key === 'energy' && state.sleeping;
  return `<section class="need-detail need-detail-${key}" aria-label="${copy.title}状态详情">
    <header class="need-heading"><h2><i class="need-dot ${key}" aria-hidden="true"></i>${copy.title}状态</h2><p class="need-detail-subtitle">${healthy ? copy.good : copy.low}</p></header>
    <div class="need-current"><span>当前${copy.title}</span><div class="need-detail-value"><strong>${value}</strong><span>/ 100</span></div></div>
    <div class="need-detail-meter" role="progressbar" aria-label="${copy.title}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%" ${value === 0 ? 'hidden' : ''}></span><i aria-hidden="true"></i></div>
    <div class="need-meter-caption"><span>大于 80，成长 +10%</span><b class="${healthy ? 'is-ready' : ''}">${healthy ? '本项 +10%' : `再 +${gap} 达标`}</b></div>
    <div class="need-methods"><div class="need-methods-heading"><h3>怎么提升${copy.title}</h3><span>最高 100</span></div>
      ${copy.hint ? `<p>${copy.hint}</p>` : ''}
      ${key === 'hunger' ? `<div class="need-foods">${Object.entries(FOODS).filter(([,food])=>food.hunger>0).map(([id,food])=>`<div class="need-food"><span>${food.name}<small>冷却 ${foodDurationText(id)}</small></span><b class="need-gain">+${food.hunger}</b></div>`).join('')}</div>` : `<div class="need-method-list">${copy.methods.map(([label,amount])=>`<div class="need-method-row"><span>${label}</span><b class="need-gain">+${amount}</b></div>`).join('')}</div>`}
      <p class="need-method-note">${copy.note}</p>
    </div>
    <button type="button" class="need-bonus-link" data-open="growth-bonus" aria-label="当前成长总倍率 ${needs.multiplier.toFixed(1)}，查看全部成长加成"><span>当前成长倍率</span><b>×${needs.multiplier.toFixed(1)}</b><small>查看详情 <i aria-hidden="true">›</i></small></button>
    <p class="need-decay-note">三项状态每 30 分钟各下降 1 点，最低为 0，离线也计入。约 ${minutes} 分钟后自然下降。</p>
    ${wake ? '<p class="need-action-note">小猫正在休息。叫醒不会再次恢复活力，下一次休息仍需等待冷却。</p>' : `<button class="primary modal-primary" ${action && !action.allowed ? 'disabled' : ''} ${key === 'hunger' ? 'data-open="feeding"' : `data-need-action="${copy.action}"`}>${copy.cta}</button>`}
    ${action ? `<p class="need-action-note">${careStatusText(copy.action,action)}</p>` : '<p class="need-action-note">每日喂食次数由两人共享，每人按上一份食物分别计算冷却。</p>'}
  </section>`;
}
