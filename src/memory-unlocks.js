import { normalizeMemoryJournal, memoryDay, nextMemoryAnniversaryGoal } from './memory-journal.js';
import { levelInfo, levelStartXp } from './state.js';
import { cooperationTasks } from './couple-care.js';
import { GAMES } from './minigames.js';

const firstRequirements = {
  feed:'在「喂食」里，成功给小猫喂一份食物。',
  pet:'在「互动」里，温柔摸摸小猫一次。',
  play:'在「互动」里，用逗猫棒陪小猫玩一次。',
  sleep:'让醒着的小猫开始休息一次，唤醒不计入。',
  dress:'在「装扮」里，保存一次小猫的装扮。',
  rename:'点击小猫名字旁的编辑按钮，保存一个名字。',
};
const pairRequirements = {
  meal:'男方、女方在同一轮 4 小时喂食窗口内，各成功喂食一次。',
  relay:'一人摸摸、另一人逗猫，间隔小于 30 分钟，顺序不限。',
  goodnight:'一人先喂食或摸摸，另一人在 30 分钟内让小猫入睡。',
};
const actionNames={feed:'喂食',pet:'摸摸',play:'逗猫',sleep:'陪它入睡'};

/** Read-only expectations, never stored as entries or used to grant rewards.
 * Old saves do not receive made-up historical milestones. Growth shows the
 * next level plus future heart stages; repeatable memories are collected by theme.
 */
export function memoryUnlocks(state,now=Date.now(),journal=normalizeMemoryJournal(state.diary,state,now)) {
  const entries=journal.entries,ids=new Set(entries.map(e=>e.id)),result=[];
  const catName=state.name||'糯米';
  const add=(id,entry,category,requirement,status,progress=null)=>result.push({id,entry:{catName,...entry},category,requirement,status,progress});
  const xp=Number.isFinite(state.xp)?Math.max(0,state.xp):0,currentLevel=levelInfo(xp).level;
  const targets=[...new Set([currentLevel+1,...[11,21,31,41,51].filter(level=>level>currentLevel)])].sort((a,b)=>a-b);
  for(const level of targets) {
    const total=levelStartXp(level),remaining=Math.max(0,Math.round((total-xp)*10)/10);
    add(`level:${level}`,{kind:'level',level},'growth',`领取成长气泡，累计成长达到 ${total.toLocaleString('zh-CN')}，升至 Lv.${level}。`,
      `还差 ${remaining.toLocaleString('zh-CN')} 成长${level%10===1?' · 新爱心阶段':''}`,{value:Math.min(xp,total),max:total});
  }
  for(const [occasion,requirement] of Object.entries(firstRequirements))if(!ids.has(`first:${occasion}`))
    add(`first:${occasion}`,{kind:'first',occasion},'growth',requirement,'下一次成功完成后，自动留下纪念');
  for(const task of cooperationTasks(state,undefined,now)) {
    if(entries.some(e=>e.kind==='together'&&e.occasion===task.id))continue;
    const first=task.first,role=first?.actorId==='partner-male'?'男方':'女方';
    const status=first?`${role}已${actionNames[first.type]} · 等另一人${actionNames[task.action.type]}`:'还未开始 · 两个人各接上一份陪伴';
    add(`together:${task.id}`,{kind:'together',occasion:task.id},'together',pairRequirements[task.id],status,{value:first?1:0,max:2});
  }
  for(const [occasion,game] of Object.entries(GAMES)) {
    if(entries.some(e=>e.kind==='game'&&e.occasion===occasion))continue;
    const match=state.games?.match,active=match?.mode==='duo'&&match.game===occasion;
    const status=active&&match.status==='waiting'?'已发出邀请 · 等另一人加入':active&&match.status==='active'?'正在一起玩 · 完成本局即可留下纪念':'尚未完成双人对局';
    add(`game:${occasion}`,{kind:'game',occasion},'together',`在「小游戏」里选择「双人联机」，两个人完整玩完一局${game.name}。`,status);
  }
  const todayHasFun=entries.some(e=>e.kind==='fun'&&memoryDay(e.at)===memoryDay(now));
  for(let variant=0;variant<12;variant++)if(!entries.some(e=>e.kind==='fun'&&e.variant===variant))
    add(`fun:${variant}`,{kind:'fun',variant},'fun','成功喂食、摸摸、逗猫或让小猫入睡时，有机会随机记录；每天最多一篇，内容随机。',todayHasFun?'今天的随笔已记录 · 明天继续发现':'随机邂逅 · 陪伴时有机会发现');
  const anniversary=nextMemoryAnniversaryGoal(journal,now);
  if(anniversary)add(`anniversary:${anniversary.year}`,{kind:'anniversary',year:anniversary.year},'growth',
    `陪伴到领养的第 ${anniversary.year} 周年；纪念日当天或之后回到小窝，会自动记录。`,
    `还需 ${anniversary.days} 天 · 按北京时间纪念`,null);
  const priority=goal=>goal.id===`level:${currentLevel+1}`?0:goal.entry.kind==='first'?1:goal.entry.kind==='together'?2:goal.entry.kind==='anniversary'?3:goal.entry.kind==='level'?4:goal.entry.kind==='game'?5:6;
  return result.sort((a,b)=>priority(a)-priority(b));
}
