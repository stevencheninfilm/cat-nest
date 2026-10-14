import { FOODS, careActionInfo } from './state.js';
import { petNeeds, growthRewardAmount, NEED_KEYS, NEED_LABELS, NEEDS_BOOST_THRESHOLD } from './pet-needs.js';
import { careStatusText, foodDurationText } from './care-ui.js';

export function needButtons() {
  return NEED_KEYS.map(key => `<button type="button" class="need-button" data-open="need-${key}" aria-label="查看${NEED_LABELS[key]}状态和提升方法"><i class="need-dot ${key}" aria-hidden="true"></i>${NEED_LABELS[key]} <b id="${key}">0</b></button>`).join('');
}

export function growthBonusBadge() {
  return '<button type="button" class="needs-boost" id="needs-growth-bonus" data-open="growth-bonus" aria-haspopup="dialog" title="点击查看三项状态的加成和提升方法"><span>成长</span><strong id="needs-growth-multiplier">×1.0</strong></button>';
}

export function growthBonusDetails(state, { now = Date.now() } = {}) {
  const needs = petNeeds(state, now);
  const target = NEEDS_BOOST_THRESHOLD + 1;
  const unmet = NEED_KEYS.filter(key => needs[key] < target);
  const minutes = Math.max(1, Math.ceil((needs.nextDecayAt - now) / 60_000));
  return `<section class="growth-bonus-detail" aria-label="成长加成详情">
    <span class="eyebrow">A LITTLE CARE, EXTRA GROWTH</span><h2>成长加成</h2><p class="bonus-description">每一份好状态，都让陪伴多一点收获。</p>
    <div class="bonus-total"><span>当前总倍率</span><strong>×${needs.multiplier.toFixed(1)}</strong><small>基础 100% + 状态加成 ${needs.boostCount * 10}%</small></div>
    <div class="bonus-status-list" aria-label="三项状态各自提供的加成">${NEED_KEYS.map(key => {
      const ready = needs[key] > NEEDS_BOOST_THRESHOLD;
      const gap = Math.max(0, target - needs[key]);
      return `<button type="button" class="bonus-status-row ${ready ? 'is-ready' : ''}" data-open="need-${key}" aria-label="${NEED_LABELS[key]} ${needs[key]} / 100，成长加成 ${ready ? '10%' : '0%'}，${ready ? '已达标' : `还差 ${gap} 点到 ${target}`}，点击查看提升方法"><i class="need-dot ${key}" aria-hidden="true"></i><span class="bonus-status-copy"><strong>${NEED_LABELS[key]} <small>${needs[key]} / 100</small></strong><span>${ready ? '已达标 · 大于 80' : `还差 ${gap} 点到 ${target}`}</span></span><span class="bonus-status-contribution"><b>+${ready ? 10 : 0}%</b><small>提升方法 ›</small></span></button>`;
    }).join('')}</div>
    <div class="bonus-goal ${unmet.length ? '' : 'is-complete'}"><div><h3>达到最高 ×1.3</h3><b>${needs.boostCount} / 3 项达标</b></div>
      ${unmet.length ? `<p>还差 ${unmet.length} 项达标，把下面的状态提升到 ${target} 即可：</p><div class="bonus-goal-gaps">${unmet.map(key => `<button type="button" data-open="need-${key}">${NEED_LABELS[key]}再 +${target - needs[key]} <span>›</span></button>`).join('')}</div>` : '<p>已达到 1.3 倍！三项状态都大于 80，继续保持这份好状态。</p>'}
    </div>
    <p class="bonus-example">当前摸摸成长：<b>3 → ${growthRewardAmount(3,needs.boostCount)}</b> 点</p>
    <p class="need-decay-note">每项大于 80 提供 +10%，相加后最高为 1.3 倍；80 本身不提供加成。三项每 30 分钟各下降 1 点，约 ${minutes} 分钟后自然下降。倍率按互动开始时的状态确定，已生成的气泡数值不变。</p>
  </section>`;
}

const COPY = {
  hunger:{ title:'饱饱', icon:'🐟', good:'吃得饱饱，陪伴更有劲', low:'肚子有点空，来一份小餐吧', action:'feeding', cta:'去挑一份小餐', methods:'喂食可以恢复饱饱，每份食物同时增加 4 点开心。陪玩每次会消耗 3 点饱饱；喝水不增加饱饱。' },
  mood:{ title:'开心', icon:'🤍', good:'心情很好，想把快乐分给你', low:'来陪它一会儿，让心情亮起来', action:'pet', cta:'温柔摸摸 · 开心 +6', methods:'温柔摸摸 +6 开心；逗猫棒陪玩 +10 开心；每次喂食 +4 开心。陪玩会消耗 8 点活力和 3 点饱饱。' },
  energy:{ title:'活力', icon:'🌙', good:'精神满满，准备好一起玩了', low:'有点累了，陪它休息一下吧', action:'sleep', cta:'陪它休息 · 活力 +20', methods:'开始休息立即恢复 20 点活力；叫醒不增加活力或成长。逗猫棒陪玩每次消耗 8 点活力，低于 8 点时需要先休息。' },
};

export function needDetails(state, key = 'hunger', { now = Date.now(), clientId } = {}) {
  key = Object.hasOwn(COPY, key) ? key : 'hunger';
  const copy = COPY[key], needs = petNeeds(state, now), value = needs[key];
  const healthy = value > NEEDS_BOOST_THRESHOLD;
  const minutes = Math.max(1, Math.ceil((needs.nextDecayAt - now) / 60_000));
  const unmet = NEED_KEYS.filter(name => needs[name] <= NEEDS_BOOST_THRESHOLD).map(name => `${NEED_LABELS[name]}还需 +${81 - needs[name]}`).join('，');
  const action = key === 'hunger' ? null : careActionInfo(state, {type:copy.action}, clientId, now);
  const wake = key === 'energy' && state.sleeping;
  return `<section class="need-detail need-detail-${key}" aria-label="${copy.title}状态详情">
    <span class="need-detail-icon" aria-hidden="true">${copy.icon}</span><span class="eyebrow">LITTLE DAILY CARE</span>
    <h2>${copy.title}状态</h2><p class="need-detail-subtitle">${healthy ? copy.good : copy.low}</p>
    <div class="need-detail-value"><strong>${value}</strong><span>/ 100</span><em>${healthy ? '本项 +10% 成长' : '本项暂无加成'}</em></div>
    <div class="need-detail-meter" role="progressbar" aria-label="${copy.title}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%"></span><i aria-hidden="true"></i></div>
    <div class="need-bonus ${needs.boosted ? 'is-active' : ''}"><div><strong>好状态加成</strong><b>${needs.boostCount === 3 ? '满状态' : needs.boosted ? '已开启' : '当前'} ×${needs.multiplier.toFixed(1)}</b></div>
      <p>每一项状态<strong>大于 80</strong>，新产生的成长气泡增加 10%：一项 ×1.1，两项 ×1.2，三项 ×1.3。</p>
      <div class="need-bonus-checks">${NEED_KEYS.map(name => `<span class="${needs[name] > 80 ? 'is-ready' : ''}">${needs[name] > 80 ? '✓' : '○'} ${NEED_LABELS[name]} ${needs[name]}</span>`).join('')}</div>
      <small>${needs.boostCount === 3 ? '三项都达标，摸摸 3 → 3.9 点成长。' : `${unmet}，可继续提高加成。`} 按互动开始时的状态计算，已生成的气泡数值不变。</small>
      <button type="button" class="bonus-overview-link" data-open="growth-bonus">查看全部成长加成 ›</button>
    </div>
    <div class="need-methods"><h3>怎么提升${copy.title}</h3><p>${copy.methods}</p>
      ${key === 'hunger' ? `<div class="need-foods">${Object.entries(FOODS).filter(([,food])=>food.hunger>0).map(([id,food])=>`<span>${food.name}<b>+${food.hunger}</b><small>冷却 ${foodDurationText(id)}</small></span>`).join('')}</div>` : ''}
    </div>
    <p class="need-decay-note">三项状态每 30 分钟各下降 1 点，最低为 0。离线也会计算；约 ${minutes} 分钟后自然下降。所有提升最高到 100。</p>
    ${wake ? '<p class="need-action-note">小猫正在休息。叫醒不会再次恢复活力，下一次休息仍需等待冷却。</p>' : `<button class="primary modal-primary" ${action && !action.allowed ? 'disabled' : ''} ${key === 'hunger' ? 'data-open="feeding"' : `data-need-action="${copy.action}"`}>${copy.cta}</button>`}
    ${action ? `<p class="need-action-note">${careStatusText(copy.action,action)}</p>` : '<p class="need-action-note">每日喂食次数由两人共享，每人按上一份食物分别计算冷却。</p>'}
  </section>`;
}
