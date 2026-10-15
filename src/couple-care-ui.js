import { FOODS, careActionInfo } from './state.js';
import { COUPLE_ROLES } from './couple-profile.js';
import { COOPERATION_RULES, normalizeCoupleCare, cooperationTasks, COUPLE_RECORD_LIMIT } from './couple-care.js';
import { presenceBadge, presenceForRole } from './couple-presence-ui.js';
import * as needRules from './pet-needs.js';
const { petNeeds } = needRules;
const playEnergyCost = Reflect.get(needRules, 'PLAY_ENERGY_COST') ?? 8;

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const roleFor = id => COUPLE_ROLES.find(role => role.clientId === id);
const labels = { pet:'温柔地摸了摸小猫', play:'陪小猫玩了逗猫棒', sleep:'陪小猫休息了', wake:'轻轻叫醒了小猫', dress:'给小猫换了新装扮', rename:'给小猫起了新名字' };
const shortLabels = { pet:'摸摸', play:'逗猫', sleep:'哄睡', wake:'叫醒', dress:'换装', rename:'取名' };
const shortFoods = { snack:'冻干', meal:'猫粮', fish:'罐罐', chicken:'鸡肉', shrimp:'虾虾', salmon:'三文鱼', mousse:'慕斯', treat:'肉条', water:'饮水' };
const clock = at => new Date(at).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
const timeLeft = ms => { const minutes = Math.max(1, Math.ceil(ms / 60_000)); return minutes < 60 ? `${minutes}分钟` : `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分` : ''}`; };
export const careDescription = record => record.type === 'feed' ? `送上${FOODS[record.food]?.name || '一份小餐'}` : labels[record.type] || '陪伴了小猫';
export function careRelativeTime(at, now = Date.now()) {
  const age = Math.max(0, now - at);
  if (age < 60_000) return '刚刚';
  if (age < 60 * 60_000) return `${Math.floor(age / 60_000)} 分钟前`;
  if (new Date(at).toDateString() === new Date(now).toDateString()) return `今天 ${clock(at)}`;
  return `${new Date(at).toLocaleDateString('zh-CN', { month:'numeric', day:'numeric' })} ${clock(at)}`;
}

/** Legacy text can be shown as history, but never awards a new cooperation memory. */
export function careRecords(state, now = Date.now()) {
  const records = normalizeCoupleCare(state.coupleCare, now).records;
  const signatures = new Set(records.map(record => `${record.actorId}:${record.type}:${record.at}`));
  for (const entry of Array.isArray(state.history) ? state.history : []) {
    const role = COUPLE_ROLES.find(profile => profile.name === entry.actor);
    if (!role || !Number.isSafeInteger(entry.at) || entry.at < 0 || entry.at > now + 60_000 || typeof entry.text !== 'string') continue;
    const text = entry.text;
    const type = text.startsWith('喂了一份') ? 'feed' : text.startsWith('温柔地摸了摸') ? 'pet' : text.startsWith('陪小猫玩了') ? 'play'
      : text.startsWith('陪小猫打了个盹') ? 'sleep' : text.startsWith('轻轻叫醒') ? 'wake' : text.startsWith('给小猫换上') ? 'dress' : text.startsWith('给小猫取名') ? 'rename' : null;
    const signature = `${role.clientId}:${type}:${entry.at}`;
    if (!type || signatures.has(signature)) continue;
    signatures.add(signature);
    const food = type === 'feed' ? Object.entries(FOODS).find(([,item]) => text.startsWith(`喂了一份${item.name}`))?.[0] : undefined;
    records.push({ id:`legacy:${role.clientId}:${entry.at}:${type}`, actorId:role.clientId, type, ...(food ? { food } : {}), at:entry.at, legacy:true });
  }
  return records.sort((a,b) => b.at - a.at);
}

export function partnerUpdate(state, clientId, { now = Date.now(), ready = true } = {}) {
  const partner = COUPLE_ROLES.find(role => role.clientId !== clientId);
  const latest = careRecords(state, now).find(record => record.actorId === partner?.clientId);
  const task = cooperationTasks(state, clientId, now).find(item => !item.completed && item.first && !item.waiting);
  const title = ready && latest ? `${partner.name} · ${latest.type === 'feed' ? shortFoods[latest.food] || '喂食' : shortLabels[latest.type]}` : '伙伴动态';
  const detail = !ready ? '正在读取小窝' : task ? '有一份接力等你' : latest ? careRelativeTime(latest.at, now) : '一起留下陪伴';
  const description = ready && latest ? `${partner.name}${careDescription(latest)}，${careRelativeTime(latest.at, now)}。查看双方照顾记录与合作接力` : '查看双方照顾记录与合作接力';
  return { description, html:`<span class="partner-update-icon" aria-hidden="true">♡</span><span class="partner-update-copy"><b>${escape(title)}</b><small>${escape(detail)}</small></span><span class="partner-update-arrow" aria-hidden="true">›</span>` };
}

function profiles(state, options) {
  const records = careRecords(state, options.now);
  return `<div class="shared-profiles">${COUPLE_ROLES.map(role => {
    const latest = records.find(record => record.actorId === role.clientId);
    const empty = role.clientId === options.clientId ? '摸摸它，留下一份陪伴' : presenceForRole(role, options).state === 'online' ? '伙伴在这里，来一起照顾' : '等另一位主人回家';
    return `<article class="shared-person ${role.id}"><div class="shared-person-heading"><span class="shared-avatar" aria-hidden="true">${role.id === 'male' ? '👦🏻' : '👧🏻'}</span><strong>${role.name}${role.clientId === options.clientId ? '<em>我</em>' : ''}</strong>${presenceBadge(role, options)}</div><p>${latest ? escape(careDescription(latest)) : '还没有照顾足迹'}</p><small>${latest ? careRelativeTime(latest.at, options.now) : empty}</small></article>`;
  }).join('')}</div>`;
}

function activityPanel(state, options) {
  const all = careRecords(state, options.now), pages = Math.max(1, Math.ceil(all.length / 20));
  const page = Math.max(0, Math.min(pages - 1, options.activityPage || 0));
  const records = all.slice(page * 20, (page + 1) * 20);
  return `${profiles(state, options)}<div class="shared-section-heading"><h3>小窝里的照顾足迹</h3><button data-shared-tab="tasks">去接力 ›</button></div>${records.length ? `<div class="shared-activities">${records.map(record => {
    const role = roleFor(record.actorId);
    return `<article class="shared-activity ${role.id}"><span class="shared-activity-dot" aria-hidden="true"></span><div><b>${role.name}</b><span>${escape(careDescription(record))}</span></div><time datetime="${new Date(record.at).toISOString()}">${careRelativeTime(record.at, options.now)}</time></article>`;
  }).join('')}</div>${pageButtons('activity', page, pages)}` : '<div class="shared-empty">♡<strong>从第一份陪伴开始</strong><p>摸摸、喂食、逗猫或休息后，<br>另一位主人会看见你为小猫做的事。</p></div>'}<p class="shared-footnote">近期足迹保留最近 ${COUPLE_RECORD_LIMIT} 次照顾，共同纪念一直留在小窝。</p>`;
}

function pageButtons(kind, page, pages) {
  return pages <= 1 ? '' : `<nav class="shared-pagination" aria-label="${kind === 'activity' ? '照顾足迹' : '共同回忆'}翻页"><button data-shared-page="${page - 1}" data-shared-page-kind="${kind}" ${page === 0 ? 'disabled' : ''}>上一页</button><span>${page + 1} / ${pages}</span><button data-shared-page="${page + 1}" data-shared-page-kind="${kind}" ${page >= pages - 1 ? 'disabled' : ''}>下一页</button></nav>`;
}

export function cooperationButton(task, state, options) {
  if (task.completed) return { disabled:true, label:'今日已完成' };
  if (task.waiting) return { disabled:true, label:`等${COUPLE_ROLES.find(role => role.clientId !== options.clientId)?.name || '伙伴'}接力` };
  if (!options.ready) return { disabled:true, label:'正在读取小窝' };
  if (options.configured && options.phase !== 'online') return { disabled:true, label:'连接后继续' };
  if (options.saving) return { disabled:true, label:'正在保存陪伴' };
  if (task.action.type === 'sleep' && state.sleeping) return { disabled:true, label:'等小猫醒来再接力' };
  const info = careActionInfo(state, task.action, options.clientId, options.now);
  if (!info.allowed) return { disabled:true, label:info.reason === 'daily_limit' ? '今日照顾次数已满' : `${timeLeft(info.remainingMs)}后可接力` };
  if (task.action.type === 'feed') return { disabled:false, label:task.first ? '我来喂一份' : '先挑一份食物' };
  if (task.action.type === 'play' && petNeeds(state, options.now).energy < playEnergyCost) return { disabled:true, label:'小猫有点累，先休息' };
  return { disabled:false, label:task.first ? `接上${shortLabels[task.action.type]}` : '我先温柔摸摸' };
}

function tasksPanel(state, options) {
  const tasks = cooperationTasks(state, options.clientId, options.now);
  return `<p class="shared-intro">两个人接上彼此的照顾，就能留下专属纪念。<small>照顾仍按原有次数和冷却进行。</small></p><div class="cooperation-tasks">${tasks.map(task => {
    const button = cooperationButton(task, state, options);
    const firstRole = roleFor(task.first?.actorId);
    const progress = task.completed ? '两份陪伴都收到了' : task.first ? `${firstRole.name}已${careDescription(task.first)} · 还可接力 ${timeLeft(task.expiresAt - options.now)}` : '还没开始 · 你们都可以先来';
    return `<article class="cooperation-task ${task.completed ? 'is-complete' : ''}"><div class="cooperation-task-heading"><span aria-hidden="true">${task.icon}</span><div><h3>${task.name}</h3><p>${task.hint}</p></div><b>${task.completed ? '2/2' : task.first ? '1/2' : '0/2'}</b></div><div class="cooperation-progress" aria-label="${escape(progress)}"><i class="${task.first || task.completed ? 'filled' : ''}"></i><i class="${task.completed ? 'filled' : ''}"></i></div><p class="cooperation-detail">${escape(progress)}</p><button data-coop-kind="${task.id}" ${button.disabled ? 'disabled' : ''}>${button.label}${button.disabled ? '' : ' ♡'}</button></article>`;
  }).join('')}</div><p class="shared-footnote">每项每天可留下一次纪念，按北京时间 0 点开启新一天。<br>合作纪念不额外发放成长，已有双人喂养奖励照常保留。</p>`;
}

function memoriesPanel(state, options) {
  const care = normalizeCoupleCare(state.coupleCare, options.now);
  const pages = Math.max(1, Math.ceil(care.moments.length / 20)), page = Math.max(0, Math.min(pages - 1, options.memoriesPage || 0));
  return care.moments.length ? `<p class="shared-intro">你们一起完成的事，小窝会记得。<small>已留下 ${care.moments.length} 个共同纪念</small></p><button class="shared-diary-link" data-open="diary" data-diary-filter="together">打开双人回忆相册 · 收藏与制作纪念卡 ›</button><div class="shared-memories">${care.moments.slice(page * 20, (page + 1) * 20).map(moment => {
    const rule = COOPERATION_RULES.find(item => item.id === moment.kind);
    return `<article class="shared-memory"><span aria-hidden="true">${rule.icon}</span><div><h3>${rule.name}</h3><p><b class="male">男方</b><i>♡</i><b class="female">女方</b><span>一起完成</span></p><time datetime="${new Date(moment.at).toISOString()}">${new Date(moment.at).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })} · ${clock(moment.at)}</time></div></article>`;
  }).join('')}</div>${pageButtons('memories', page, pages)}` : '<div class="shared-empty">♡ ♡<strong>等你们的第一份默契</strong><p>一人摸摸、另一人逗猫，<br>就能留下你们的第一份接力纪念。</p><button data-shared-tab="tasks">一起试试 ›</button></div>';
}

export function sharedCarePanel(state, options = {}) {
  options = { now:Date.now(), tab:'activity', ready:true, ...options };
  const content = options.tab === 'tasks' ? tasksPanel(state, options) : options.tab === 'memories' ? memoriesPanel(state, options) : activityPanel(state, options);
  const notice = options.notice?.until > options.now ? `<div class="shared-notice" role="status"><b>${escape(options.notice.title)}</b><span>${escape(options.notice.text)}</span></div>` : '';
  return `<div class="shared-care-heading"><span aria-hidden="true">♡</span><div><h2>我们一起养${escape(state.name)}</h2><p>看看彼此做过什么，接上另一份陪伴。</p></div></div>${notice}<div class="shared-tabs" role="tablist" aria-label="双人共同养成">${[['activity','照顾足迹'],['tasks','默契接力'],['memories','共同回忆']].map(([id,label]) => `<button role="tab" data-shared-tab="${id}" aria-selected="${options.tab === id}" aria-controls="shared-care-content" id="shared-tab-${id}">${label}</button>`).join('')}</div><section id="shared-care-content" role="tabpanel" aria-labelledby="shared-tab-${options.tab}">${content}</section>`;
}
