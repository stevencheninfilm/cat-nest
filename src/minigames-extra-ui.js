import { connect4Cell } from './minigames-extra.js';
const disabled = value => value ? 'disabled' : '';
const esc = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function extraSoloResult(m) {
  if (m.game !== 'guess') return `挑战完成 · 完成 ${m.scores[0]} / 3 关`;
  return m.winner === 0 ? `猜中啦！用了 ${m.guesses.length} 次` : `挑战完成 · 答案是 ${m.answer}`;
}
export function extraScoreLabel(m, n) {
  if (m.game === 'guess') return `猜了 ${m.scores[n]} 次`;
  if (m.mode === 'solo') return `已过 ${m.scores[0]} 关`;
  return m.game === 'tictactoe' ? n === 0 ? '叉叉 ×' : '圆圈 ○' : n === 0 ? '珊瑚棋' : '金色棋';
}
function turnText(m, player) {
  if (m.status !== 'active') return '对局已结束';
  if (m.mode === 'solo') {
    if (m.phase === 'reveal') return m.challengeCorrect ? '这一手连成啦！' : '绿色标记是这一关的正确位置';
    return `第 ${m.puzzleIndex + 1} / 3 关 · ${m.game === 'tictactoe' ? '用叉叉一手连成三个' : '落下一子，一手连成四个'}`;
  }
  if (player < 0) return '正在观战';
  if (m.mode === 'computer' && m.turn === 1) return '电脑猫猫正在想一想…';
  return `${player === m.turn ? '轮到你' : '轮到'+esc(m.players[m.turn]?.name)} · 选位置，再确认`;
}
export function extraBoardMarkup(m, player, busy, now, selectedCell) {
  if (m.game === 'guess') return numberBoard(m,player,busy);
  const canMove = m.status === 'active' && m.phase === 'play' && player === m.turn && !busy;
  const selected = m.game === 'connect4' && selectedCell !== null ? connect4Cell(m.board,selectedCell) : selectedCell;
  const next = m.status === 'active' && m.phase === 'reveal' ? `<button class="primary game-next" data-game-next ${disabled(busy || player < 0 || now < m.revealUntil)}>下一关</button>` : '';
  const confirm = m.status === 'active' && m.phase === 'play' ? `<button class="primary game-next" data-game-confirm ${disabled(!canMove || selectedCell === null)}>确认${m.game === 'connect4' ? `落子${selectedCell === null ? '' : ' · 第 '+(selectedCell+1)+' 列'}` : '放棋子'}</button>` : '';
  if (m.game === 'tictactoe') {
    const cells = m.board.map((piece,n) => `<button class="tic-cell ${n === selected ? 'is-selected' : ''} ${m.mode === 'solo' && m.phase === 'reveal' && m.solutions.includes(n) ? 'is-solution' : ''} ${piece ? 'tic-piece-'+piece : ''}" data-game-cell="${n}" aria-label="第${Math.floor(n/3)+1}行第${n%3+1}列，${piece === 1 ? '叉叉' : piece === 2 ? '圆圈' : '空位'}" ${disabled(!canMove || piece)}>${piece ? piece === 1 ? '×' : '○' : n === selected ? '<span class="tic-draft">'+(player === 0 ? '×' : '○')+'</span>' : ''}</button>`).join('');
    return `<p class="game-turn" role="status">${turnText(m,player)}</p><div class="tic-board" role="group" aria-label="井字棋九宫格">${cells}</div>${confirm}${next}<p class="gomoku-rule">${m.mode === 'solo' ? '三关挑战 · 每关选择一次' : '叉叉先行 · 横竖斜连成三个获胜'}</p>`;
  }
  const columns = Array.from({length:7},(_,n) => `<button class="connect-column ${n === selectedCell ? 'is-selected' : ''} ${m.mode === 'solo' && m.phase === 'reveal' && m.solutions.includes(n) ? 'is-solution' : ''}" data-game-column="${n}" aria-label="选第${n+1}列" ${disabled(!canMove || connect4Cell(m.board,n) < 0)}>${n+1}<span aria-hidden="true">↓</span></button>`).join('');
  const cells = m.board.map((piece,n) => `<span class="connect-hole ${piece ? 'connect-piece-'+piece : ''} ${n === m.lastMove ? 'last-move' : ''} ${n === selected ? 'is-draft' : ''}" aria-label="第${Math.floor(n/7)+1}行第${n%7+1}列，${piece === 1 ? '珊瑚棋' : piece === 2 ? '金色棋' : '空位'}">${n === selected && !piece ? '<i class="connect-draft-'+(player+1)+'"></i>' : ''}</span>`).join('');
  return `<p class="game-turn" role="status">${turnText(m,player)}</p><div class="connect-columns" role="group" aria-label="四子棋落子列">${columns}</div><div class="connect-board" role="group" aria-label="六行七列四子棋棋盘">${cells}</div>${confirm}${next}<p class="gomoku-rule">${m.mode === 'solo' ? '三关挑战 · 棋子落到该列最下方空位' : '珊瑚棋先行 · 横竖斜连成四个获胜'}</p>`;
}
function numberBoard(m, player, busy) {
  const active = m.status === 'active', canMove = active && player === m.turn && !busy;
  const latest = m.guesses.at(-1);
  const status = !active ? '对局已结束' : m.mode === 'computer' && m.turn === 1 ? '电脑猫猫正在猜…' : player < 0 ? '正在观战' : m.mode === 'solo' ? `还有 ${7-m.guesses.length} 次机会` : player === m.turn ? '轮到你猜一个数字' : `轮到${esc(m.players[m.turn]?.name)}猜数字`;
  const history = m.guesses.map(g => `<li><span>${esc(m.players[g.player].name)}</span><strong>${g.number}</strong><b>${g.hint === 0 ? '猜中啦' : g.hint === -1 ? '偏小 ↑' : '偏大 ↓'}</b></li>`).join('');
  return `<p class="game-turn" role="status">${status}</p><div class="guess-range"><span>${active ? '答案就在这个范围' : '秘密数字'}</span><strong>${active ? `${m.low}<small>—</small>${m.high}` : m.answer}</strong><p>${latest ? latest.hint === 0 ? '找到猫猫藏起来的数字啦！' : `${latest.number} ${latest.hint === -1 ? '偏小，再猜大一点' : '偏大，再猜小一点'}` : '先试一个数字，猫猫会提示大小。'}</p></div>${active ? `<form class="guess-form" data-game-guess><label for="game-guess-input">你的猜测</label><div><input id="game-guess-input" name="guess" type="number" inputmode="numeric" min="${m.low}" max="${m.high}" step="1" placeholder="${m.low}–${m.high}" required ${disabled(!canMove)}/><button type="submit" class="primary" ${disabled(!canMove)}>猜一下</button></div></form>` : ''}${history ? `<ol class="guess-history" aria-label="猜测记录">${history}</ol>` : ''}<p class="gomoku-rule">${m.mode === 'solo' ? '1–100 · 七次机会找到答案' : '两人轮流猜 · 先猜中获胜 · 最多二十次'}</p>${m.mode === 'computer' ? '<p class="game-fair-play">电脑只看大小提示，也不知道答案。</p>' : ''}`;
}
