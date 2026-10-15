import { homeBinding } from './home-bond.js';
import { COUPLE_ROLES } from './couple-profile.js';

/** A missing live connection means unknown presence, rather than an offline partner. */
export function presenceForRole(role, { members = [], phase = 'solo', configured = false, entered = false, known = false, binding = null } = {}) {
  if (!configured) return { state:'local', label:'本机' };
  if (!entered) return { state:'unknown', label:'待连接' };
  if (phase === 'connecting') return { state:'unknown', label:'连接中' };
  if (phase !== 'online') return { state:'unknown', label:'重连中' };
  if (!known) return { state:'unknown', label:'同步中' };
  const online = members.some(member => member.id === role.clientId);
  if(!online && binding && !binding.owners.some(owner=>owner.id===role.id&&owner.joined))return {state:'unbound',label:'待加入'};
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
  const invited=COUPLE_ROLES.find(role=>role.id===options.invitedRole);
  const binding=homeBinding(options.state||{});
  const status=options.ready ? `${binding.count}/2 位主人已加入${binding.complete?' · 已一起养猫':''}` : options.newVisitor ? '选好身份，约 1 分钟就能上手' : '选择身份后同步你们的小窝';
  return `<div class="role-picker-heading"><span aria-hidden="true">🐾</span><h2>${invited?'另一位主人在等你':'谁来陪小猫？'}</h2><p>${invited?`选择${invited.name}，加入同一个小窝`:'一只小猫，两个人慢慢养大'}</p></div><div class="role-choices" role="group" aria-label="选择男方或女方">${COUPLE_ROLES.map(role => `<button class="role-choice ${role.id} ${invited?.id===role.id?'is-invited':''} ${options.selectedRole === role.id ? 'remembered' : ''}" data-couple-role="${role.id}" aria-pressed="${options.entered && options.selectedRole === role.id}"><span class="role-portrait" aria-hidden="true">${role.id === 'male' ? '👦🏻' : '👧🏻'}</span><strong>${role.name}</strong>${presenceBadge(role, options)}<span class="role-enter">${options.entered && options.selectedRole === role.id ? '当前身份' : '进入小窝'} <span aria-hidden="true">›</span></span></button>`).join('')}</div><p class="onboarding-role-note">${status}</p>${options.entered?'<button type="button" class="onboarding-role-invite" data-open="invite">♡ 查看双人绑定 · 邀请另一位主人</button>':''}<div class="role-connection"><span id="role-connection-status" aria-live="polite"></span>${options.entered && options.configured ? '<button class="text-button" id="retry-cloud" hidden>重新连接</button>' : ''}</div>`;
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
