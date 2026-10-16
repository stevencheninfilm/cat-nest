import { publicGameHub, reduceGameHub, sanitizeGameAction } from './minigames.js';
import { connect4Cell } from './minigames-extra.js';

const types = new Set(['game-create','game-join','game-cancel','game-next','game-move','game-arcade-ready']);
export function duoPreviewable(state, action) {
  return types.has(action?.type) && (action.type === 'game-create' ? action.mode === 'duo' : state.games?.match?.mode === 'duo');
}
/** Public presentation only. Never run a private reducer with invented secrets,
 * decide a winner, reveal a card, or create a reward before the saved receipt. */
export function previewDuoGameAction(state, supplied, actor, now, operationId) {
  const action = sanitizeGameAction(supplied);
  if (!action || !duoPreviewable(state, action)) return null;
  if (action.type === 'game-create') {
    const games = reduceGameHub(state.games, action, actor, now, operationId, () => .5);
    return games ? { ...state, games:publicGameHub(games) } : null;
  }
  const current = state.games.match;
  if (!current || current.id !== action.gameId || !['active','waiting'].includes(current.status)) return null;
  const m = structuredClone(current), player = m.players.findIndex(p => p.id === actor.id);
  delete m.secret;
  if (action.type === 'game-join') {
    if (m.status !== 'waiting' || player !== -1 || m.players.length !== 1) return null;
    // The public seed defines a blank second run; the start clock is still
    // supplied only by the server after both ready requests are confirmed.
    const games = reduceGameHub(state.games, action, actor, now, operationId);
    return games ? { ...state, games:publicGameHub(games) } : null;
  }
  if (player < 0) return null;
  if (action.type === 'game-cancel') m.status = 'cancelled';
  else if (m.status !== 'active') return null;
  else if (action.type === 'game-arcade-ready') {
    if (m.arcade?.stage !== 'ready' || m.arcade.ready[player]) return null;
    m.arcade.ready[player] = true;
    // Both phones must receive the same server startAt before running.
  } else {
    if (m.arcade || action.step !== (m.game === 'rps' ? m.rounds.length : m.step)) return null;
    if (action.type === 'game-next') {
      if (m.phase !== 'reveal' || now < m.revealUntil || !['rps','memory'].includes(m.game)) return null;
      if (m.game === 'rps') { m.locked = [false,false]; m.phase = 'choose'; }
      else { m.flipped = []; m.cards = m.cards.map((card,n) => m.matched[n] ? card : null); m.phase = 'play'; m.turn = 1-m.turn; }
    } else if (action.type !== 'game-move') return null;
    else if (m.game === 'rps') {
      if (m.phase !== 'choose' || m.locked[player] || !['rock','paper','scissors'].includes(action.move)) return null;
      m.locked[player] = true;
    } else {
      if (m.phase !== 'play' || m.turn !== player || !Number.isSafeInteger(action.move) || action.move < 0) return null;
      if (m.game === 'memory') {
        if (action.move >= 16 || m.matched[action.move] || m.flipped.includes(action.move) || m.flipped.length >= 2) return null;
        // Two choices can queue without a round trip between taps. Unknown
        // faces stay unknown; pairing and the next turn require confirmation.
        m.flipped.push(action.move);
      } else if (m.game === 'guess') {
        if (action.move < m.low || action.move > m.high) return null;
        m.turn = 1-player;
      } else if (['gomoku','tictactoe','connect4'].includes(m.game)) {
        const cell = m.game === 'connect4' ? connect4Cell(m.board,action.move) : action.move;
        if (cell < 0 || cell >= m.board.length || m.board[cell]) return null;
        m.board[cell] = player+1; m.lastMove = cell; m.turn = 1-player;
      } else return null;
    }
  }
  m.step++; m.updatedAt = now;
  return { ...state, games:{ ...state.games, match:m } };
}

/** A partner can advance the same reveal while our identical request waits.
 * Skip only that redundant transition, retaining the following choice. */
export function redundantDuoTransition(state, action, actor) {
  const m=state?.games?.match;
  if (!m || m.mode !== 'duo' || m.id !== action?.gameId || !m.players.some(p=>p.id===actor.id)) return false;
  if (action.type === 'game-join') return m.status === 'active';
  if (action.type === 'game-cancel') return m.status === 'cancelled';
  if (action.type === 'game-arcade-ready') return m.arcade?.ready[m.players.findIndex(p=>p.id===actor.id)] === true;
  return action.type === 'game-next' && m.status === 'active' &&
    (m.game === 'rps' ? m.rounds.length === action.step && m.phase === 'choose' : m.game === 'memory' && m.step > action.step && m.phase === 'play');
}
