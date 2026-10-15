import { GAMES, GAME_DAILY_LIMIT, GAME_HANDS, GAME_MODES, normalizeGameHub } from './minigames.js';
import { COLLECTION_CATS } from './cat-collection.js';
import { catSprite } from './catbook-ui.js';
import { EXTRA_GAMES } from './minigames-extra.js';
import { extraBoardMarkup, extraSoloResult, extraScoreLabel } from './minigames-extra-ui.js';
const esc = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const disabled = value => value ? 'disabled':'';
const handName = hand => ({rock:'石头',paper:'布',scissors:'剪刀'}[hand] || '');
const soloDescription = {rps:'看提示选克制手势，完成 3 题。',memory:'凭记忆找齐 8 对猫猫。',gomoku:'一手成五，完成 3 关。',tictactoe:'一手连成三个，完成 3 关。',connect4:'一手连成四个，完成 3 关。',guess:'根据大小提示，7 次内猜中数字。'};
const cover = (game, size = 80) => `<img src="./assets/minigames/covers/${game}-v1.webp" width="${size}" height="${size}" alt="" draggable="false" decoding="async"/>`;

function catalog({ title,quota,invite,connection }) {
  const cards=Object.entries(GAMES).map(([key,g])=>`<li><button class="game-tile" data-game-select="${key}" aria-label="打开${g.name}"><span class="game-tile-cover" aria-hidden="true">${cover(key)}</span><strong>${g.name}</strong><span class="game-tile-play">开始玩</span></button></li>`).join('');
  return `${title}${quota}${invite}<ul class="game-catalog" aria-label="小游戏列表">${cards}</ul><div class="game-lobby-footer"><details class="game-help"><summary>玩法与奖励</summary><div class="game-help-content"><p>点击游戏选择单人挑战、对战电脑或双人联机，具体玩法在开局前显示。</p><p>双人联机：两台手机打开小窝，分别选择男方和女方，一人发起，另一人加入。</p><p>完成后点击成长气泡领取奖励。双人完成额外 +5 成长，每日小窝合计上限 ${GAME_DAILY_LIMIT} 点，北京时间 0 点重置；中途退出不发奖。</p></div></details><button class="game-share" data-game-copy>邀请猫友 ↗</button></div>${connection}`;
}
function modePicker(game,{invite,busy,running,multiplayer,connection}) {
  const g=GAMES[game];
  const hints={solo:soloDescription[game],computer:game==='guess'?'轮流猜数字，先猜中获胜。':game==='rps'?'和电脑猜拳，三局两胜。':'和电脑猫猫轮流比拼。',duo:'模拟伙伴会自动加入并回应。'};
  return `<button class="game-back" data-game-lobby>‹ 返回游戏屋</button><div class="game-picker-heading"><span class="game-picker-cover" aria-hidden="true">${cover(game,96)}</span><h2>${g.name}</h2><p>${g.description}</p></div>${invite}<div class="game-mode-picker" aria-label="选择${g.name}玩法">${Object.entries(GAME_MODES).map(([mode,label])=>`<button data-game-create="${game}" data-game-mode="${mode}" ${disabled(busy||running||mode==='duo'&&!multiplayer)}><span class="game-mode-symbol" aria-hidden="true">${mode==='solo'?'🐾':mode==='computer'?'🤖':'♡'}</span><span class="game-mode-copy"><strong>${label}</strong><small>${hints[mode]}</small></span><span class="game-mode-reward">+${g.xp+(mode==='duo'?5:0)}<small>成长</small></span><span class="game-mode-arrow" aria-hidden="true">›</span></button>`).join('')}</div>${connection}`;
}
function resultPanel(m,state,busy) {
  if(m.status==='cancelled')return '<div class="game-result"><h3>这局已结束</h3><p>中途退出不发奖励，随时可以重新开局。</p><button class="primary" data-game-lobby>挑一个小游戏</button></div>';
  if(m.status!=='finished')return '';
  const title=m.mode==='solo'?(EXTRA_GAMES.includes(m.game)?extraSoloResult(m):m.game==='memory'?'八对猫猫都找到了！':`挑战完成 · ${m.game==='rps'?'答对':'完成'} ${m.scores[0]} / 3 ${m.game==='rps'?'题':'关'}`):m.winner===-1?'平局，也是一份好时光！':`${esc(m.players[m.winner].name)}赢啦！`;
  return `<div class="game-result" role="status"><span>✦</span><h3>${title}</h3><p>${m.reward?`这局为猫猫带来 ${m.reward} 点成长 ♡`:'今天已获得 50 点小游戏成长，明天再来收小心意吧。'}</p>${m.reward&&state.pendingGrowth.some(r=>r.id===`game:${m.id}`)?'<button class="primary" data-open="growth">领取成长气泡</button>':m.reward?'<small>这局的成长已经收好啦 ♡</small>':''}<button class="game-secondary" data-game-create="${m.game}" data-game-mode="${m.mode}" ${disabled(busy)}>再玩一局</button></div>`;
}
function rpsBoard(m,player,busy,now) {
  const active=m.status==='active',round=m.rounds.at(-1),revealing=m.phase==='reveal';
  const hands=[0,1].map(n=>{
    const hand=revealing&&round?round.hands[n]:m.mode==='solo'&&n===1?m.challengeHand:null;
    const label=hand?handName(hand):m.locked[n]?(m.mode==='computer'&&n===1?'电脑已准备好':'已出手'):'正在想一想';
    return `<div><span>${hand?GAME_HANDS[hand]:m.locked[n]?'🔒':'❔'}</span><small>${label}</small></div>`;
  }).join('<b>VS</b>');
  let status;
  if(!active)status=m.mode==='solo'?'三题挑战 · 已完成':'三局两胜 · 对局已结算';
  else if(revealing)status=m.mode==='solo'?(round.winner===0?'答对啦！你选中了克制手势。':`这题的正确手势是${handName({rock:'paper',paper:'scissors',scissors:'rock'}[round.hands[1]])}`):round.winner===-1?'这一轮平手，再来一次！':`${esc(m.players[round.winner].name)}拿下一分！`;
  else if(player<0)status='正在观战';
  else if(m.mode==='solo')status=`第 ${m.rounds.length+1} / 3 题 · 选能赢过提示的手势`;
  else if(m.locked[player])status='已锁定你的选择，等对方出手…';
  else status=m.mode==='computer'?'电脑已锁定出手，选好你的手势就揭晓':'一起出手吧，双方选择后才揭晓';
  const choices=active&&!revealing?`<div class="rps-choices">${Object.entries(GAME_HANDS).map(([hand,emoji])=>`<button data-game-move="${hand}" ${disabled(busy||player<0||m.locked[player])}><span>${emoji}</span><strong>${handName(hand)}</strong></button>`).join('')}</div>`:'';
  const next=active&&revealing?`<button class="primary game-next" data-game-next ${disabled(busy||player<0||now<m.revealUntil)}>${m.mode==='solo'?'下一题':'下一轮'}</button>`:'';
  return `<div class="rps-stage"><div class="rps-hands">${hands}</div><p class="game-turn" role="status">${status}</p>${choices}${next}</div>`;
}
function memoryBoard(m,player,busy,now) {
  const active=m.status==='active';
  let status;
  if(!active)status='八对猫猫 · 对局已结束';
  else if(m.phase==='reveal')status=m.mode==='solo'?'记住这两只猫猫的位置，再试一次':m.mode==='computer'&&m.turn===1?'电脑没配对成功，马上轮到你':'记住这两只猫猫，再换一位来找';
  else if(m.mode==='computer'&&m.turn===1)status='电脑猫猫正在翻牌…';
  else if(m.mode==='solo')status=`已找到 ${m.scores[0]} / 8 对，加油呀`;
  else status=`${player===m.turn?'轮到你':'轮到'+esc(m.players[m.turn]?.name)}翻牌 · 配对成功可以继续翻`;
  const cards=m.cards.map((card,n)=>`<button class="memory-card ${card!==null?'is-face-up':''} ${m.matched[n]?'is-matched':''}" data-game-move="${n}" aria-label="第${n+1}张，${card===null?'未翻开':COLLECTION_CATS[card].name}${m.matched[n]?'，已配对':''}" ${disabled(busy||!active||player!==m.turn||m.phase!=='play'||m.matched[n]||m.flipped.includes(n))}>${card!==null?`${catSprite(COLLECTION_CATS[card])}<small>${COLLECTION_CATS[card].name}</small>`:'<span class="card-paw">🐾</span><small>MEOW</small>'}</button>`).join('');
  const nextLabel=m.mode==='solo'?'收起卡片，再试一次':m.mode==='computer'?(m.turn===0?'收起卡片，让电脑来':'收起卡片，轮到你'):'收起卡片，换对方来';
  const next=active&&m.phase==='reveal'?`<button class="primary game-next" data-game-next ${disabled(busy||player<0||now<m.revealUntil)}>${nextLabel}</button>`:'';
  return `<p class="game-turn" role="status">${status}</p><div class="memory-board" aria-label="猫猫翻牌，十六张卡片">${cards}</div>${next}${m.mode==='computer'?'<p class="game-mode-note game-fair-play">电脑只记住翻开过的牌，暗牌对它也保密。</p>':''}`;
}
function gomokuBoard(m,player,busy,now,selectedCell) {
  const active=m.status==='active',solo=m.mode==='solo',canMove=active&&player===m.turn&&!busy&&m.phase==='play';
  let status;
  if(!active)status='对局已结束';
  else if(solo)status=m.phase==='reveal'?(m.challengeCorrect?'这一手成五啦！': '绿色圆圈是能一手成五的位置'): `第 ${m.puzzleIndex+1} / 3 关 · 选一个能让黑棋一手成五的位置`;
  else if(m.mode==='computer'&&m.turn===1)status='电脑猫猫正在想一想…';
  else status=`${player===m.turn?'轮到你':'轮到'+esc(m.players[m.turn]?.name)}下${m.turn===0?'黑':'白'}棋 · 选位置，再确认落子`;
  const cells=m.board.map((piece,n)=>`<button class="gomoku-cell ${n===m.lastMove?'last-move':''} ${n===selectedCell?'is-selected':''} ${solo&&m.phase==='reveal'&&m.solutions.includes(n)?'is-solution':''}" data-game-cell="${n}" aria-label="第${Math.floor(n/15)+1}行第${n%15+1}列，${piece===1?'黑棋':piece===2?'白棋':'空位'}" ${disabled(!canMove||piece)}>${piece?`<i class="gomoku-stone stone-${piece}"></i>`:n===selectedCell?`<i class="gomoku-stone stone-${player+1} draft-stone"></i>`:''}</button>`).join('');
  const confirm=active&&m.phase==='play'?`<button class="primary game-next" data-game-confirm ${disabled(!canMove||selectedCell===null)}>确认落子${selectedCell!==null?` · ${Math.floor(selectedCell/15)+1}行 ${selectedCell%15+1}列`:''}</button>`:'';
  const next=active&&solo&&m.phase==='reveal'?`<button class="primary game-next" data-game-next ${disabled(busy||player<0||now<m.revealUntil)}>下一关</button>`:'';
  return `<p class="game-turn" role="status">${status}</p><div class="gomoku-board" role="group" aria-label="十五乘十五五子棋棋盘">${cells}</div>${confirm}${next}<p class="gomoku-rule">${solo?'每关一手 · 绿色圆圈展示答案 · 完成三关结算':'黑棋先行 · 连成五子即获胜 · 无禁手'}</p>`;
}
export function minigamesPanel({ state,clientId,saving=false,connected=true,multiplayer=true,lobby=true,selectedGame=null,selectedCell=null,localPreview=false,now=Date.now() }) {
  const hub=normalizeGameHub(state.games,now),m=hub.match,busy=saving||!connected;
  const title='<div class="game-heading"><span class="game-heading-icon" aria-hidden="true"><img src="./assets/minigames/game-entry-v1.webp" width="55" height="55" alt="" draggable="false" decoding="async"/></span><h2>猫猫游戏屋</h2></div>';
  const quota=`<div class="game-quota"><span>今日成长</span><div class="game-quota-track" role="progressbar" aria-label="今日小游戏成长" aria-valuemin="0" aria-valuemax="${GAME_DAILY_LIMIT}" aria-valuenow="${hub.earned}"><i style="width:${hub.earned/GAME_DAILY_LIMIT*100}%"></i></div><strong>${hub.earned}<small> / ${GAME_DAILY_LIMIT}</small></strong></div>`;
  const connection=`<p class="game-connection" role="status">${saving?'正在保存这一回合…':connected?!multiplayer?'单人和电脑可玩 · 双人联机暂不可用':localPreview?'演示接口 · 仅本机保存':'已连接小窝 · 实时同步':'正在连接小窝…'}</p>`;
  if(lobby||!m) {
    const running=m&&['waiting','active'].includes(m.status);
    const label=m?.status==='waiting'?`${esc(m.players[0].name)}邀请你玩${GAMES[m.game].name}`:m?.status==='finished'?`${GAMES[m.game].name}已完成`:`${m?GAMES[m.game].name:''}正在进行 · ${m?GAME_MODES[m.mode]:''}`;
    const invite=running||m?.status==='finished'?`<div class="game-invitation"><div><strong>${label}</strong>${m.status==='finished'?`<small>本局 +${m.reward} 成长</small>`:''}</div><button data-game-open ${disabled(busy)}>${m.status==='waiting'?'查看邀请':m.status==='finished'?'查看结算':'继续游戏'} ›</button></div>`:'';
    if(Object.hasOwn(GAMES,selectedGame))return modePicker(selectedGame,{invite:running?invite:'',busy,running,multiplayer,connection});
    return catalog({title,quota,invite,connection});
  }
  const player=m.players.findIndex(p=>p.id===clientId),active=m.status==='active';
  const header=`<button class="game-back" data-game-lobby>‹ 返回游戏屋</button><div class="game-match-heading"><h2>${GAMES[m.game].emoji} ${GAMES[m.game].name}</h2><span>${GAME_MODES[m.mode]}</span></div>`;
  const players=`<div class="game-players">${[0,1].filter(n=>m.mode!=='solo'||n===0).map(n=>`<div class="game-player ${m.players[n]?.id===clientId?'is-me':''} ${active&&m.game!=='rps'&&n===m.turn?'has-turn':''}"><span>${m.players[n]?.computer?'🤖':n===0?'🐱':'🐾'}</span><strong>${esc(m.players[n]?.name||'等待猫友')} ${m.players[n]?.id===clientId?'<small>你</small>':''}</strong><b>${EXTRA_GAMES.includes(m.game)?extraScoreLabel(m,n):m.game==='gomoku'?(m.mode==='solo'?`已过 ${m.scores[0]} 关`:n===0?'黑棋':'白棋'):`${m.scores[n]} ${m.game==='memory'?'对':m.mode==='solo'?'题':'胜'}`}</b></div>`).join('')}</div>`;
  if(m.status==='waiting')return `${header}${players}<div class="game-waiting"><div aria-hidden="true">🐱 <span>♡</span> 🐾</div><h3>${player===-1?'收到一份一起玩的邀请':'等另一位猫友来玩'}</h3><p>模拟伙伴正在加入，<br/>稍后就可以一起开始这一局。</p>${player===-1?`<button class="primary" data-game-join ${disabled(busy)}>加入对局</button>`:'<button class="primary" data-game-copy>复制小窝链接</button>'}</div>${player>=0?`<button class="game-cancel" data-game-cancel ${disabled(busy)}>取消邀请</button>`:''}${connection}`;
  const board=m.game==='rps'?rpsBoard(m,player,busy,now):m.game==='memory'?memoryBoard(m,player,busy,now):EXTRA_GAMES.includes(m.game)?extraBoardMarkup(m,player,busy,now,selectedCell):gomokuBoard(m,player,busy,now,selectedCell);
  return `${header}${players}${board}${resultPanel(m,state,busy)}${active&&player>=0?`<details class="game-exit"><summary>结束这一局</summary><p>中途退出不发成长奖励，随时可以重新开局。</p><button data-game-cancel class="game-cancel" ${disabled(busy)}>确认结束对局</button></details>`:''}${connection}`;
}
