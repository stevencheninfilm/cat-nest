/** Additional games use the same authoritative match, revision and reward ledger. */
export const EXTRA_GAMES = ['tictactoe', 'connect4', 'guess'];
export const PUZZLE_GAMES = ['gomoku', 'tictactoe', 'connect4'];
export const boardLength = game => ({ gomoku:225, tictactoe:9, connect4:42 }[game] || 0);
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

export function lineWinner(board, cell, piece, rows, columns, length) {
  if (board[cell] !== piece) return false;
  const row = Math.floor(cell / columns), column = cell % columns;
  return [[0,1], [1,0], [1,1], [1,-1]].some(([dy, dx]) => {
    let count = 1;
    for (const sign of [-1, 1]) {
      for (let step = 1; step < length; step++) {
        const y = row + dy * step * sign, x = column + dx * step * sign;
        if (y < 0 || y >= rows || x < 0 || x >= columns || board[y * columns + x] !== piece) break;
        count++;
      }
    }
    return count >= length;
  });
}
export function connect4Cell(board, column) {
  if (!integer(column, 6)) return -1;
  for (let row = 5; row >= 0; row--) if (!board[row * 7 + column]) return row * 7 + column;
  return -1;
}
function legalMoves(game, board) {
  return game === 'connect4'
    ? [3,2,4,1,5,0,6].filter(column => connect4Cell(board, column) >= 0)
    : board.flatMap((piece, cell) => piece ? [] : [cell]);
}
function putPiece(game, board, move, piece) {
  const cell = game === 'connect4' ? connect4Cell(board, move) : move;
  if (!integer(cell, board.length - 1) || board[cell]) return -1;
  board[cell] = piece;
  return cell;
}
const won = (game, board, cell, piece) => lineWinner(board, cell, piece, game === 'connect4' ? 6 : 3, game === 'connect4' ? 7 : 3, game === 'connect4' ? 4 : 3);
export function extraWinningMoves(game, board, piece) {
  return legalMoves(game, board).filter(move => {
    const copy = [...board], cell = putPiece(game, copy, move, piece);
    return won(game, copy, cell, piece);
  });
}
const puzzles = {
  tictactoe: [
    { black:[0,1], white:[3,4] },
    { black:[0,3], white:[1,4] },
    { black:[0,4], white:[1,3] },
  ],
  connect4: [
    { black:[35,36,37], white:[40,41] },
    { black:[37,30,23], white:[35,36,39] },
    { black:[35,29,23], white:[36,37,30,38,31,24] },
  ],
};
export function createExtraBoard(game, mode, puzzleIndex = 0) {
  const board = Array(boardLength(game)).fill(0);
  if (mode === 'solo' && puzzles[game]) {
    for (const cell of puzzles[game][puzzleIndex].black) board[cell] = 1;
    for (const cell of puzzles[game][puzzleIndex].white) board[cell] = 2;
  }
  return board;
}
export function extraMatchFields(game, mode) {
  if (game === 'guess') return { low:1, high:100, guesses:[], answer:null };
  return mode === 'solo' && puzzles[game] ? { puzzleIndex:0, challengeCorrect:null, solutions:[] } : {};
}
export function validExtraMatch(m) {
  if (!EXTRA_GAMES.includes(m.game)) return true;
  if (m.game === 'guess') {
    if (!integer(m.low,100) || m.low < 1 || !integer(m.high,100) || m.high < m.low || !Array.isArray(m.guesses) || m.guesses.length > (m.mode === 'solo' ? 7 : 20)) return false;
    if (m.guesses.some(g => !g || !integer(g.player,1) || m.mode === 'solo' && g.player !== 0 || !integer(g.number,100) || g.number < 1 || ![-1,0,1].includes(g.hint))) return false;
    if (m.answer !== null && (!integer(m.answer,100) || m.answer < 1 || m.status !== 'finished')) return false;
    if (m.status === 'finished' && m.answer === null) return false;
    if (m.secret && (!integer(m.secret.target,100) || m.secret.target < m.low || m.secret.target > m.high || m.answer !== null && m.answer !== m.secret.target)) return false;
    return true;
  }
  if (m.game === 'connect4') {
    for (let column = 0; column < 7; column++) {
      let empty = false;
      for (let row = 5; row >= 0; row--) {
        if (!m.board[row * 7 + column]) empty = true;
        else if (empty) return false;
      }
    }
  }
  if (m.mode === 'solo' && (!integer(m.puzzleIndex,2) || ![null,true,false].includes(m.challengeCorrect) || !Array.isArray(m.solutions) || m.solutions.length > 7 || m.solutions.some(move => !integer(move,m.game === 'connect4' ? 6 : 8)))) return false;
  return true;
}

function positionValue(board) {
  let score = 0;
  for (let row = 0; row < 6; row++) for (let column = 0; column < 7; column++) {
    const piece = board[row * 7 + column];
    if (column === 3) score += piece === 2 ? 6 : piece === 1 ? -6 : 0;
    for (const [dy,dx] of [[0,1],[1,0],[1,1],[1,-1]]) {
      const endY = row + 3 * dy, endX = column + 3 * dx;
      if (endY < 0 || endY >= 6 || endX < 0 || endX >= 7) continue;
      let human = 0, computer = 0;
      for (let step = 0; step < 4; step++) {
        const value = board[(row + step * dy) * 7 + column + step * dx];
        if (value === 1) human++; else if (value === 2) computer++;
      }
      if (!human) score += [0,1,12,90,10000][computer];
      if (!computer) score -= [0,1,14,110,10000][human];
    }
  }
  return score;
}
function searchBoard(game, board, piece, depth) {
  const moves = legalMoves(game,board);
  if (!moves.length) return 0;
  if (!depth) return game === 'connect4' ? positionValue(board) : 0;
  let best = piece === 2 ? -Infinity : Infinity;
  for (const move of moves) {
    const cell = putPiece(game,board,move,piece);
    const value = won(game,board,cell,piece) ? (piece === 2 ? 100000 + depth : -100000 - depth) : searchBoard(game,board,3-piece,depth-1);
    board[cell] = 0;
    best = piece === 2 ? Math.max(best,value) : Math.min(best,value);
  }
  return best;
}
export function chooseExtraComputer(m, random = Math.random) {
  // The number bot receives exactly the same public bounds as the human.
  if (m.game === 'guess') return Math.floor((m.low + m.high) / 2);
  const wins = extraWinningMoves(m.game,m.board,2);
  if (wins.length) return pick(wins,random);
  const blocks = extraWinningMoves(m.game,m.board,1);
  if (blocks.length) return pick(blocks,random);
  let best = -Infinity, candidates = [];
  const board = [...m.board];
  for (const move of legalMoves(m.game,board)) {
    const cell = putPiece(m.game,board,move,2);
    const value = searchBoard(m.game,board,1,m.game === 'tictactoe' ? 9 : 3);
    board[cell] = 0;
    if (value > best) { best = value; candidates = [move]; }
    else if (value === best) candidates.push(move);
  }
  return pick(candidates,random);
}
export function nextExtraPuzzle(m) {
  if (!puzzles[m.game] || m.mode !== 'solo' || m.puzzleIndex >= 2) return false;
  m.puzzleIndex++;
  m.board = createExtraBoard(m.game,'solo',m.puzzleIndex);
  m.phase = 'play'; m.lastMove = null; m.challengeCorrect = null; m.solutions = [];
  return true;
}
export function reduceExtraMove(m, move, player, now) {
  if (player !== m.turn || m.phase !== 'play') return false;
  if (m.game === 'guess') {
    if (!integer(move,m.high) || move < m.low) return false;
    const hint = move === m.secret.target ? 0 : move < m.secret.target ? -1 : 1;
    m.guesses.push({ player, number:move, hint }); m.scores[player]++;
    if (hint === -1) m.low = move + 1;
    if (hint === 1) m.high = move - 1;
    if (hint === 0 || m.guesses.length >= (m.mode === 'solo' ? 7 : 20)) {
      m.status = 'finished'; m.winner = hint === 0 ? player : -1; m.answer = m.secret.target;
    } else if (m.mode !== 'solo') m.turn = 1 - m.turn;
    return true;
  }
  const maximum = m.game === 'connect4' ? 6 : 8;
  if (!integer(move,maximum)) return false;
  const cell = m.game === 'connect4' ? connect4Cell(m.board,move) : move;
  if (cell < 0 || m.board[cell]) return false;
  if (m.mode === 'solo') m.solutions = extraWinningMoves(m.game,m.board,1);
  m.board[cell] = player + 1; m.lastMove = cell;
  if (m.mode === 'solo') {
    m.challengeCorrect = won(m.game,m.board,cell,1); m.scores[m.challengeCorrect ? 0 : 1]++;
    m.phase = 'reveal'; m.revealUntil = now + 900;
    if (m.puzzleIndex === 2) { m.status = 'finished'; m.winner = m.scores[0] === 3 ? 0 : -1; }
  } else if (won(m.game,m.board,cell,player+1)) { m.status = 'finished'; m.winner = player; }
  else if (m.board.every(Boolean)) { m.status = 'finished'; m.winner = -1; }
  else m.turn = 1 - m.turn;
  return true;
}
