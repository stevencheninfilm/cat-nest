import { ARCADE_GAMES } from './minigames-arcade-rules.js';
import { connect4Cell } from './minigames-extra.js';
/** Rendering keys exclude the advancing clock, except actual unlock edges. */
export function gamePanelSignature({state,clientId,saving,connected,multiplayer,lobby,selectedGame,selectedCell,localPreview,pendingAction,now=Date.now()}) {
  const match=state.games.match;
  return JSON.stringify([state.games,state.xp,clientId,saving,connected,multiplayer,lobby,selectedGame,localPreview,pendingAction,
    state.pendingGrowth.some(r=>r.id===`game:${match?.id}`),Math.floor((now+8*3600_000)/86400_000),Boolean(match&&now>=match.revealUntil)]);
}
/** Moving the local draft changes two cells, never rebuilds a 225-cell board. */
export function paintGameSelection(root,match,clientId,selectedCell,busy) {
  if(!match||!['gomoku','tictactoe','connect4'].includes(match.game))return;
  const player=match.players.findIndex(p=>p.id===clientId),canMove=!busy&&match.status==='active'&&match.phase==='play'&&player===match.turn;
  let cell=selectedCell;
  if(!Number.isSafeInteger(cell)||cell<0)cell=null;
  else if(match.game==='connect4')cell=connect4Cell(match.board,cell);
  if(cell!==null&&(cell<0||cell>=match.board.length||match.board[cell]))cell=null;
  for(const node of root.querySelectorAll('.gomoku-cell.is-selected,.tic-cell.is-selected,.connect-column.is-selected,.connect-hole.is-draft')){
    node.classList.remove('is-selected','is-draft');node.querySelector('.draft-stone,.tic-draft,.connect-hole>i')?.remove();
  }
  if(canMove&&cell!==null){
    const target=root.querySelector(match.game==='connect4'?`.connect-hole:nth-child(${cell+1})`:`[data-game-cell="${cell}"]`);
    if(target){
      target.classList.add(match.game==='connect4'?'is-draft':'is-selected');
      target.innerHTML=match.game==='gomoku'?`<i class="gomoku-stone stone-${player+1} draft-stone"></i>`:match.game==='tictactoe'?`<span class="tic-draft">${player===0?'×':'○'}</span>`:`<i class="connect-draft-${player+1}"></i>`;
    }
    if(match.game==='connect4')root.querySelector(`[data-game-column="${selectedCell}"]`)?.classList.add('is-selected');
  }
  const confirm=root.querySelector('[data-game-confirm]');
  if(confirm){confirm.disabled=!canMove||cell===null;confirm.textContent=match.game==='gomoku'?`确认落子${cell===null?'':` · ${Math.floor(cell/15)+1}行 ${cell%15+1}列`}`:match.game==='tictactoe'?'确认放棋子':`确认落子${cell===null?'':` · 第 ${selectedCell+1} 列`}`;}
}
export function keepArcadeBoard({match,previousId,lobby,board}) {
  return Boolean(!lobby&&match?.id===previousId&&ARCADE_GAMES.includes(match.game)&&match.status==='active'&&match.arcade.stage==='running'&&board?.dataset.arcadeId===match.id);
}
export function computerTurnDelay(match,now=Date.now(),lastAttemptAt) {
  return Math.max(0,(match.phase==='reveal'?match.revealUntil:match.botReadyAt||match.updatedAt+700)-now,
    lastAttemptAt===undefined?0:lastAttemptAt+1000-now);
}
/** Feedback displays the submitted choice, never hidden cards or a result. */
export function pendingGameFeedback(match,action,clientId) {
  if(!match||match.status!=='active'||action?.type!=='game-move'||action.gameId!==match.id||action.step!==(match.game==='rps'?match.rounds.length:match.step))return null;
  const player=match.players.findIndex(p=>p.id===clientId);
  if(player<0||match.game!=='rps'&&player!==match.turn||match.game==='rps'&&match.locked[player])return null;
  const move=action.move;
  if(match.game==='rps')return ['rock','paper','scissors'].includes(move)?{move,message:'已出手，正在同步这一轮…'}:null;
  if(!Number.isSafeInteger(move)||move<0)return null;
  if(match.game==='memory')return move<16&&!match.matched[move]&&!match.flipped.includes(move)?{move,message:'正在翻开这张卡片…'}:null;
  if(['gomoku','tictactoe','connect4'].includes(match.game)) {
    const cell=match.game==='connect4'?connect4Cell(match.board,move):move;
    if(cell<0||cell>=match.board.length||match.board[cell])return null;
    return {move,cell,message:'已落子，正在同步棋盘…'};
  }
  if(match.game==='guess'&&move>=match.low&&move<=match.high)return {move,message:`已猜 ${move}，正在等待提示…`};
  return null;
}
