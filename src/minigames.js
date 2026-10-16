/** Authoritative rules shared by the API and local preview. Hidden hands and
 * card order are persisted, but publicGameHub never sends them to a player. */
import { gomokuWinner, gomokuWinningCells, chooseComputerGomoku, chooseComputerCard, createGomokuPuzzle } from './minigames-computer.js';
import { EXTRA_GAMES, PUZZLE_GAMES, boardLength, createExtraBoard, extraMatchFields, validExtraMatch, chooseExtraComputer, nextExtraPuzzle, reduceExtraMove } from './minigames-extra.js';
import { ARCADE_GAMES, sanitizeArcadeAction, createArcadeMatch, validArcadeMatch, joinArcadeMatch, reduceArcadeAction } from './minigames-arcade.js';
import { TOUCH_INFO } from './minigames-touch-rules.js';
export const GAMES = Object.freeze({
  ...Object.fromEntries(Object.entries(TOUCH_INFO).map(([id,{name,emoji,xp,description}])=>[id,{name,emoji,xp,description}])),
  rps: { name:'石头剪刀布', emoji:'✊', xp:5, description:'三局两胜，看看今天谁的运气更好。' },
  memory: { name:'猫猫翻牌', emoji:'🐱', xp:10, description:'记住猫猫的位置，找出八对小伙伴。' },
  gomoku: { name:'五子棋', emoji:'⚫', xp:10, description:'一人一步，先连成五颗棋子就赢啦。' },
  tictactoe: { name:'井字棋', emoji:'⭕', xp:5, description:'在九宫格中，先连成三个棋子。' },
  connect4: { name:'四子棋', emoji:'🔴', xp:10, description:'棋子向下落，横竖斜连成四个获胜。' },
  guess: { name:'猜数字', emoji:'🔢', xp:5, description:'根据大小提示，找到 1 到 100 的秘密数字。' },
  reaction: { name:'反应力对决', emoji:'⚡', xp:5, description:'等绿灯亮起再点击，五轮比比谁更快。' },
  merge2048: { name:'2048', emoji:'🧩', xp:10, description:'滑动合并相同数字，三分钟冲击高分。' },
  snake: { name:'贪吃蛇', emoji:'🐍', xp:10, description:'带猫猫蛇吃小鱼，一分钟比拼得分。' },
  whack: { name:'猫猫打地鼠', emoji:'🔨', xp:5, description:'三十秒抓地鼠，记得放过小猫。' },
});
export const GAME_DAILY_LIMIT = 50;
export const GAME_HANDS = { rock:'✊', paper:'🖐️', scissors:'✌️' };
export const GAME_MODES = Object.freeze({solo:'单人挑战',computer:'对战电脑',duo:'双人联机'});
export const COMPUTER_ID = 'computer-cat';
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{8,170}$/.test(value);
const actorId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{6,80}$/.test(value);
const integer = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
export const gameDay = now => Math.floor((now + 8 * 3600_000) / 86400_000);
export const emptyGameHub = now => ({ day:gameDay(now), earned:0, match:null });
export function sanitizeGameAction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort().join(',');
  if(value.type==='game-create'&&keys==='difficulty,game,mode,previousId,type'&&ARCADE_GAMES.includes(value.game)&&value.mode==='computer'&&['easy','normal','hard'].includes(value.difficulty)&&(value.previousId===null||id(value.previousId)))return {type:value.type,game:value.game,mode:value.mode,previousId:value.previousId,difficulty:value.difficulty};
  if(typeof value.type==='string'&&value.type.startsWith('game-arcade-')&&id(value.gameId))return sanitizeArcadeAction(value,keys);
  if (value.type === 'game-create' && keys === 'game,mode,previousId,type' && Object.hasOwn(GAMES,value.game) && Object.hasOwn(GAME_MODES,value.mode) && (value.previousId === null || id(value.previousId))) return { type:value.type, game:value.game, mode:value.mode, previousId:value.previousId };
  if (['game-join','game-cancel'].includes(value.type) && keys === 'gameId,type' && id(value.gameId)) return { type:value.type, gameId:value.gameId };
  if (['game-next','game-bot'].includes(value.type) && keys === 'gameId,step,type' && id(value.gameId) && integer(value.step)) return { type:value.type, gameId:value.gameId, step:value.step };
  if (value.type === 'game-move' && keys === 'gameId,move,step,type' && id(value.gameId) && integer(value.step) && (Object.hasOwn(GAME_HANDS,value.move) || integer(value.move,224))) return { type:value.type, gameId:value.gameId, step:value.step, move:value.move };
  return null;
}
export function validGameHub(hub, { privateState = false } = {}) {
  if (!hub || !integer(hub.day) || !integer(hub.earned,GAME_DAILY_LIMIT)) return false;
  if(hub.localReceipts!==undefined&&(!Array.isArray(hub.localReceipts)||hub.localReceipts.some(r=>!r||Object.keys(r).sort().join(',')!=='actorId,id,reward'||!id(r.id)||!actorId(r.actorId)||!integer(r.reward,15))||new Set(hub.localReceipts.map(r=>r.id)).size!==hub.localReceipts.length))return false;
  const m = hub.match;
  if (m === null) return true;
  if (!m || !id(m.id) || !Object.hasOwn(GAMES,m.game) || !Object.hasOwn(GAME_MODES,m.mode) || !['waiting','active','finished','cancelled'].includes(m.status) || !integer(m.step) || !integer(m.createdAt) || !integer(m.updatedAt) || !integer(m.turn,1) || !integer(m.reward,15) || ![-1,0,1,null].includes(m.winner)) return false;
  if (!Array.isArray(m.players) || m.players.length < 1 || m.players.length > 2 || new Set(m.players.map(p => p.id)).size !== m.players.length || m.players.some(p => !actorId(p.id) || typeof p.name !== 'string' || !p.name.length || p.name.length > 20)) return false;
  if (m.mode === 'solo' && m.players.length !== 1 || m.status === 'active' && m.mode === 'duo' && m.players.length !== 2) return false;
  if (m.mode === 'computer' && (m.players.length !== 2 || m.players[0].id === COMPUTER_ID || m.players[0].computer || m.players[1].id !== COMPUTER_ID || m.players[1].computer !== true)) return false;
  if (m.mode !== 'computer' && m.players.some(p=>p.computer || p.id===COMPUTER_ID)) return false;
  if (m.status === 'waiting' && m.mode !== 'duo') return false;
  if (m.mode==='computer' && !integer(m.botReadyAt) || m.botReadyAt !== undefined && !integer(m.botReadyAt)) return false;
  if (m.mode === 'solo' && m.game === 'rps' && !Object.hasOwn(GAME_HANDS,m.challengeHand)) return false;
  if (m.mode === 'solo' && m.game === 'gomoku' && (!integer(m.puzzleIndex,2) || ![null,true,false].includes(m.challengeCorrect) || !Array.isArray(m.solutions) || m.solutions.length>2 || m.solutions.some(v=>!integer(v,224)))) return false;
  if (!Array.isArray(m.scores) || m.scores.length !== 2 || m.scores.some(s => !integer(s,ARCADE_GAMES.includes(m.game)?1e9:20))) return false;
  if(!validArcadeMatch(m))return false;
  if (!['choose','reveal','play'].includes(m.phase) || !integer(m.revealUntil) || !Array.isArray(m.rounds) || m.rounds.length > 20 || !Array.isArray(m.locked) || m.locked.length !== 2 || m.locked.some(v => typeof v !== 'boolean')) return false;
  if (m.rounds.some(r => !r || !Array.isArray(r.hands) || r.hands.length !== 2 || r.hands.some(h => !Object.hasOwn(GAME_HANDS,h)) || ![-1,0,1].includes(r.winner))) return false;
  if (!Array.isArray(m.board) || m.board.length !== boardLength(m.game) || m.board.some(v => !integer(v,2))) return false;
  if (!validExtraMatch(m)) return false;
  if (!Array.isArray(m.matched) || m.matched.length !== (m.game === 'memory' ? 16 : 0) || m.matched.some(v => typeof v !== 'boolean') || !Array.isArray(m.flipped) || m.flipped.length > 2 || m.flipped.some(v => !integer(v,15)) || new Set(m.flipped).size !== m.flipped.length) return false;
  if (!Array.isArray(m.cards) || m.cards.length !== (m.game === 'memory' ? 16 : 0) || m.cards.some(v => v !== null && !integer(v,7)) || (m.lastMove !== null && !integer(m.lastMove,224))) return false;
  if (privateState && !m.secret) return false;
  if (m.secret) {
    if (!Array.isArray(m.secret.hands) || m.secret.hands.length !== 2 || m.secret.hands.some(h => h !== null && !Object.hasOwn(GAME_HANDS,h))) return false;
    if (!Array.isArray(m.secret.deck) || m.secret.deck.length !== (m.game === 'memory' ? 16 : 0) || m.secret.deck.some(v => !integer(v,7))) return false;
    if (m.game === 'memory' && Array.from({length:8},(_,n) => m.secret.deck.filter(v => v === n).length).some(n => n !== 2)) return false;
    if (m.mode === 'computer' && m.game === 'memory' && (!Array.isArray(m.secret.botMemory) || m.secret.botMemory.length !== 16 || m.secret.botMemory.some(v=>v!==null&&!integer(v,7)))) return false;
  }
  return true;
}
export function normalizeGameHub(value, now) {
  if (!validGameHub(value)) return emptyGameHub(now);
  const hub = structuredClone(value);
  delete hub.serverNow;
  if(hub.match?.arcade)delete hub.match.arcade.serverNow;
  if (gameDay(now) > hub.day) { hub.day = gameDay(now); hub.earned = 0; }
  return hub;
}
export function publicGameHub(hub) {
  const next = structuredClone(hub);
  if (next?.match) delete next.match.secret;
  if(next.match?.arcade)next.match.arcade.serverNow=Date.now();
  return next;
}
export function publicGameEvent(event) {
  const next = structuredClone(event);
  if(next?.action?.type==='game-local-finish'&&next.action.session)next.action={type:'game-local-finish',sessionId:next.action.session.id};
  if (next?.action?.type === 'game-move') delete next.action.move;
  if(next?.action?.type==='game-arcade-input')delete next.action.events;
  return next;
}
function shuffledDeck(random = Math.random) {
  const deck = Array.from({length:16},(_,n) => n % 8);
  for (let n = deck.length - 1; n > 0; n--) { const j = Math.floor(random() * (n + 1)); [deck[n],deck[j]] = [deck[j],deck[n]]; }
  return deck;
}
function newMatch(action, actor, now, operationId, random) {
  const match={ id:operationId, game:action.game, mode:action.mode, players:[{ id:actor.id, name:actor.name.slice(0,20) }], status:action.mode === 'duo' ? 'waiting':'active', turn:0, step:0, phase:action.game === 'rps' ? 'choose':'play', scores:[0,0], rounds:[], locked:[false,false], board:action.game === 'gomoku' ? action.mode === 'solo' ? createGomokuPuzzle(0):Array(225).fill(0):createExtraBoard(action.game,action.mode), matched:action.game === 'memory' ? Array(16).fill(false):[], flipped:[], cards:action.game === 'memory' ? Array(16).fill(null):[], lastMove:null, secret:{ hands:[null,null], deck:action.game === 'memory' ? shuffledDeck(random):[], ...(action.mode==='computer'&&action.game==='memory'?{botMemory:Array(16).fill(null)}:{}), ...(action.game==='guess'?{target:1+Math.min(99,Math.floor(random()*100))}:{}) }, winner:null, reward:0, revealUntil:0, createdAt:now, updatedAt:now, botReadyAt:0, ...(action.mode==='solo'&&action.game==='gomoku'?{puzzleIndex:0,challengeCorrect:null,solutions:[]}:{}), ...extraMatchFields(action.game,action.mode) };
  if(action.mode==='computer')match.players.push({id:COMPUTER_ID,name:'电脑猫猫',computer:true});
  createArcadeMatch(match,action,random);
  if(action.game==='rps'&&action.mode!=='duo')prepareComputerHand(match,random);
  return match;
}
function prepareComputerHand(match,random) {
  const hand=Object.keys(GAME_HANDS)[Math.min(2,Math.floor(random()*3))];
  match.secret.hands[1]=hand;match.locked[1]=true;
  if(match.mode==='solo')match.challengeHand=hand;
}
/** Invalid/stale inputs do not change state. Finished sessions cannot be moved
 * again; a new session requires its predecessor ID, preventing old start replay. */
export function reduceGameHub(value, supplied, actor, now, operationId, random = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) {
  let action = sanitizeGameAction(supplied);
  if (!action || !actorId(actor?.id) || actor.id===COMPUTER_ID || !id(operationId)) return null;
  const hub = normalizeGameHub(value,now);
  let m = hub.match;
  if (action.type === 'game-create') {
    if (operationId === m?.id || action.previousId !== (m?.id ?? null) || m && ['waiting','active'].includes(m.status)) return null;
    hub.match = newMatch(action,actor,now,operationId,random);
    return hub;
  }
  if (!m || action.gameId !== m.id) return null;
  let player = m.players.findIndex(p => p.id === actor.id);
  if(m.mode==='computer'&&player!==0)return null;
  if (action.type === 'game-join') {
    if (m.status !== 'waiting' || m.mode !== 'duo' || player !== -1 || m.players.length !== 1) return null;
    m.players.push({id:actor.id,name:actor.name.slice(0,20)}); m.status = 'active';
    joinArcadeMatch(m);
  } else {
    if (player < 0 || !['waiting','active'].includes(m.status)) return null;
    if (action.type === 'game-cancel') { m.status = 'cancelled'; if (m.secret) m.secret.hands = [null,null]; }
    else {
      if (m.status !== 'active' || !m.secret) return null;
      if(ARCADE_GAMES.includes(m.game)) {if(!reduceArcadeAction(m,action,player,now))return null;}
      else {
      if(action.type==='game-bot') {
        if(m.mode!=='computer'||m.game==='rps'||m.turn!==1||m.phase!=='play'||now<m.botReadyAt)return null;
        player=1;
        action={...action,type:'game-move',move:m.game==='memory'?chooseComputerCard(m,random):m.game==='gomoku'?chooseComputerGomoku(m.board,random):chooseExtraComputer(m,random)};
      }
      // Both RPS players submit against the same round number, even if the
      // other's request arrived first; all other games use a strict revision.
      const expected = m.game === 'rps' ? m.rounds.length : m.step;
      if (action.step !== expected) return null;
      if (action.type === 'game-next') {
        if (m.phase !== 'reveal' || PUZZLE_GAMES.includes(m.game) && m.mode!=='solo' || now < m.revealUntil) return null;
        if (m.game === 'rps') { m.secret.hands = [null,null]; m.locked = [false,false]; m.phase = 'choose'; if(m.mode!=='duo')prepareComputerHand(m,random); }
        else if(m.game==='gomoku') {if(m.puzzleIndex>=2)return null;m.puzzleIndex++;m.board=createGomokuPuzzle(m.puzzleIndex);m.phase='play';m.lastMove=null;m.challengeCorrect=null;m.solutions=[];}
        else if(EXTRA_GAMES.includes(m.game)) { if(!nextExtraPuzzle(m))return null; }
        else { m.flipped = []; m.phase = 'play'; m.turn = m.mode !== 'solo' ? 1 - m.turn : 0; }
      } else if (m.game === 'rps') {
        if (m.phase !== 'choose' || m.locked[player] || !Object.hasOwn(GAME_HANDS,action.move)) return null;
        m.secret.hands[player] = action.move; m.locked[player] = true;
        if (m.locked.every(Boolean)) {
          const [a,b] = m.secret.hands;
          const winner = a === b ? -1 : ({rock:'scissors',paper:'rock',scissors:'paper'}[a] === b ? 0:1);
          m.rounds.push({hands:[a,b],winner}); if(m.mode==='solo')m.scores[winner===0?0:1]++;else if (winner >= 0) m.scores[winner]++;
          m.phase = 'reveal'; m.revealUntil = now + 900;
          if (m.mode==='solo' ? m.rounds.length>=3 : m.scores.some(s => s >= 2) || m.rounds.length >= 20) { m.status = 'finished'; m.winner = m.scores[0] === m.scores[1] ? -1 : m.scores[0] > m.scores[1] ? 0:1; }
        }
      } else if (m.game === 'memory') {
        if (player !== m.turn || m.phase !== 'play' || !integer(action.move,15) || m.matched[action.move] || m.flipped.includes(action.move)) return null;
        m.flipped.push(action.move);
        if(m.mode==='computer')m.secret.botMemory[action.move]=m.secret.deck[action.move];
        if (m.flipped.length === 2) {
          const [a,b] = m.flipped;
          if (m.secret.deck[a] === m.secret.deck[b]) { m.matched[a] = m.matched[b] = true; m.scores[player]++; m.flipped = []; }
          else { m.phase = 'reveal'; m.revealUntil = now + 1200; }
          if (m.matched.every(Boolean)) { m.status = 'finished'; m.winner = m.mode === 'solo' ? 0 : m.scores[0] === m.scores[1] ? -1 : m.scores[0] > m.scores[1] ? 0:1; }
        }
      } else if (EXTRA_GAMES.includes(m.game)) {
        if (!reduceExtraMove(m,action.move,player,now)) return null;
      } else {
        if (player !== m.turn || m.phase!=='play' || !integer(action.move,224) || m.board[action.move]) return null;
        if(m.mode==='solo')m.solutions=gomokuWinningCells(m.board,1);
        m.board[action.move] = player + 1; m.lastMove = action.move;
        if(m.mode==='solo') {
          m.challengeCorrect=gomokuWinner(m.board,action.move,1);m.scores[m.challengeCorrect?0:1]++;
          m.phase='reveal';m.revealUntil=now+900;
          if(m.puzzleIndex===2){m.status='finished';m.winner=m.scores[0]===3?0:1;}
        } else if (gomokuWinner(m.board,action.move,player + 1)) { m.status = 'finished'; m.winner = player; }
        else if (m.board.every(Boolean)) { m.status = 'finished'; m.winner = -1; }
        else m.turn = 1 - m.turn;
      }
      }
    }
  }
  m.step++; m.updatedAt = now;
  if(m.mode==='computer'&&m.turn===1&&m.phase==='play')m.botReadyAt=now+700;
  if (m.game === 'memory' && m.secret) m.cards = m.secret.deck.map((v,n) => m.matched[n] || m.flipped.includes(n) ? v:null);
  if (m.status === 'finished') { m.reward = m.arcade?.rewardEligible===false?0:Math.min(GAMES[m.game].xp + (m.mode === 'duo' ? 5:0), GAME_DAILY_LIMIT - hub.earned); hub.earned += m.reward; }
  return hub;
}
