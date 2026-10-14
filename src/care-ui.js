import { CARE_LIMITS } from './state.js';

const LABELS = { feed:'喂食', pet:'摸摸', play:'逗猫', sleep:'休息', pair:'双人奖励' };

export function countdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function careQuotaText(action, info, compact = false) {
  if (info.dailyLimit === null) return '';
  return `${compact ? '剩余' : `今日${LABELS[action] || ''}剩余`} ${info.remaining}/${info.dailyLimit}`;
}

export function careStatusText(action, info, compact = false) {
  if (info.isWake) return compact ? '叫醒不计成长' : `${careQuotaText(action, info)} · 叫醒不计成长`;
  const quota = careQuotaText(action, info, compact);
  if (info.reason === 'daily_limit') return `${quota} · ${compact ? '今日已满' : '次数北京时间 0 点重置'}`;
  return info.reason === 'cooldown' ? `${quota} · ${countdown(info.remainingMs)} 后可用` : quota;
}

export function careBlockedMessage(action, info) {
  if (info.reason === 'daily_limit') return `小窝今日${LABELS[action]}已达 ${info.dailyLimit} 次上限，次数北京时间 0 点重置`;
  if (info.reason === 'cooldown') return `${action === 'feed' ? '你的喂食' : LABELS[action]}还需等 ${countdown(info.remainingMs)}，稍后再来陪它`;
  return '这次互动暂时不能完成，请稍后再试';
}

export function careRuleText(action) {
  const rule = CARE_LIMITS[action];
  if (!rule) return '';
  const cooldownMinutes = rule.cooldownMs / 60_000;
  const interval = cooldownMinutes >= 60 ? `${cooldownMinutes / 60} 小时` : `${cooldownMinutes} 分钟`;
  return `每日 ${rule.dailyLimit} 次${rule.cooldownMs ? ` · ${action === 'feed' ? '每人间隔' : '间隔'} ${interval}` : ''}`;
}
