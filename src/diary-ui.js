import { COUPLE_ROLES } from './couple-profile.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Group saved moments by the same device-local calendar day used for their times. */
export function diaryTimeline(history, { now = Date.now() } = {}) {
  const entries = (Array.isArray(history) ? history : []).filter(item => item && typeof item.actor === 'string' && typeof item.text === 'string' && Number.isFinite(item.at) && !Number.isNaN(new Date(item.at).getTime())).slice().sort((a, b) => b.at - a.at);
  if (!entries.length) return '<div class="empty-diary">还没有记录，摸摸小猫<br/>写下你们的第一个小瞬间吧 ♡</div>';

  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const days = new Map();
  for (const entry of entries) {
    const key = dateKey(new Date(entry.at));
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(entry);
  }
  return `<div class="diary-list diary-timeline" aria-label="按天排列的养猫时间轴">${[...days].map(([key, moments]) => {
    const date = new Date(moments[0].at);
    const label = key === dateKey(today) ? '今天' : key === dateKey(yesterday) ? '昨天' : date.toLocaleDateString('zh-CN', { ...(date.getFullYear() !== today.getFullYear() ? { year:'numeric' } : {}), month:'long', day:'numeric' });
    const caption = date.toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'short' });
    return `<section class="diary-day" data-diary-date="${key}" aria-label="${key}的陪伴记录"><header class="diary-day-heading"><div><h3>${label}</h3><span>${caption}</span></div><small>${moments.length} 条记录</small></header><div class="diary-day-events">${moments.map(item => {
      const role = COUPLE_ROLES.find(profile => profile.name === item.actor)?.id || 'other';
      const time = new Date(item.at);
      return `<article class="diary-event" data-diary-role="${role}"><time class="diary-time" datetime="${time.toISOString()}">${time.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })}</time><span class="diary-marker" aria-hidden="true"></span><div class="diary-event-content"><b class="diary-actor">${escape(item.actor)}</b><p>${escape(item.text)}</p></div></article>`;
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}
