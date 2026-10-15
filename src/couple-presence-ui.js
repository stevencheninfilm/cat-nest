import { COUPLE_ROLES } from './couple-profile.js';

/** A missing live connection means unknown presence, rather than an offline partner. */
export function presenceForRole(role, { members = [], phase = 'solo', configured = false, entered = false, known = false } = {}) {
  if (!configured) return { state:'local', label:'本机' };
  if (!entered) return { state:'unknown', label:'待连接' };
  if (phase === 'connecting') return { state:'unknown', label:'连接中' };
  if (phase !== 'online') return { state:'unknown', label:'重连中' };
  if (!known) return { state:'unknown', label:'同步中' };
  const online = members.some(member => member.id === role.clientId);
  return { state:online ? 'online' : 'offline', label:online ? '在线' : '离线' };
}

export function presenceBadge(role, options) {
  const presence = presenceForRole(role, options);
  return `<span class="presence-indicator" data-presence-role="${role.id}" data-presence-state="${presence.state}"><i aria-hidden="true"></i><span>${presence.label}</span></span>`;
}

export function homePresence(options = {}) {
  return COUPLE_ROLES.map(role => `<span class="partner-presence ${role.id} ${options.entered && options.selectedRole === role.id ? 'is-me' : ''}"><b>${role.name}</b>${options.entered && options.selectedRole === role.id ? '<em>我</em>' : ''}${presenceBadge(role, options)}</span>`).join('');
}

export function rolePicker(options = {}) {
  return `<div class="role-picker-heading"><span aria-hidden="true">🐾</span><h2>谁来陪小猫？</h2><p>选择你的身份，回到共同的小窝</p></div><div class="role-choices" role="group" aria-label="选择男方或女方">${COUPLE_ROLES.map(role => `<button class="role-choice ${role.id} ${options.selectedRole === role.id ? 'remembered' : ''}" data-couple-role="${role.id}" aria-pressed="${options.entered && options.selectedRole === role.id}"><span class="role-portrait" aria-hidden="true">${role.id === 'male' ? '👦🏻' : '👧🏻'}</span><strong>${role.name}</strong>${presenceBadge(role, options)}<span class="role-enter">${options.entered && options.selectedRole === role.id ? '当前身份' : '进入小窝'} <span aria-hidden="true">›</span></span></button>`).join('')}</div><div class="role-connection"><span id="role-connection-status" aria-live="polite"></span>${options.entered && options.configured ? '<button class="text-button" id="retry-cloud" hidden>重新连接</button>' : ''}</div>`;
}

export function connectionSummary({ phase = 'solo', configured = false, entered = false, known = false, members = [], savePhase = 'local' } = {}) {
  if (!configured) return '本机预览';
  if (!entered) return '进入后同步在线状态';
  if (phase === 'connecting') return '正在连接小窝…';
  if (phase !== 'online') return '连接中断 · 在线状态待确认';
  const count = COUPLE_ROLES.filter(role => members.some(member => member.id === role.clientId)).length;
  const connection = known ? `${count} 人在线` : '正在同步';
  const saved = savePhase === 'saving' ? '保存中' : savePhase === 'error' ? '保存待确认' : '互动自动保存';
  return `${connection} · ${saved}`;
}
