/** Local rules, not an external AI service. Memory decisions intentionally read
 * only previously observed cards, never the hidden shuffled deck. */
export function gomokuWinner(board, cell, piece) {
  const row=Math.floor(cell/15),col=cell%15;
  for(const [dy,dx] of [[0,1],[1,0],[1,1],[1,-1]]) {
    let count=1;
    for(const sign of [-1,1]) for(let n=1;n<5;n++) {
      const r=row+dy*n*sign,c=col+dx*n*sign;
      if(r<0||r>=15||c<0||c>=15||board[r*15+c]!==piece)break;
      count++;
    }
    if(count>=5)return true;
  }
  return false;
}
export function gomokuWinningCells(board,piece) {
  const copy=[...board],cells=[];
  for(let cell=0;cell<225;cell++) {
    if(copy[cell])continue;
    copy[cell]=piece;if(gomokuWinner(copy,cell,piece))cells.push(cell);copy[cell]=0;
  }
  return cells;
}
const pick=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
function lineValue(board,cell,piece) {
  const row=Math.floor(cell/15),col=cell%15;
  let value=0;
  for(const [dy,dx] of [[0,1],[1,0],[1,1],[1,-1]]) {
    let count=1,open=0;
    for(const sign of [-1,1]) {
      for(let n=1;n<6;n++) {
        const r=row+dy*n*sign,c=col+dx*n*sign;
        if(r<0||r>=15||c<0||c>=15)break;
        const at=board[r*15+c];
        if(at===piece){count++;continue;}
        if(at===0)open++;break;
      }
    }
    if(count>=5)value+=100000;
    else if(open===2)value+=[0,2,70,800,9000][count]||0;
    else if(open===1)value+=[0,1,12,120,1800][count]||0;
  }
  return value;
}
export function chooseComputerGomoku(board,random=Math.random) {
  const wins=gomokuWinningCells(board,2);if(wins.length)return pick(wins,random);
  const blocks=gomokuWinningCells(board,1);if(blocks.length)return pick(blocks,random);
  if(board.every(v=>v===0))return 112;
  let best=-Infinity,candidates=[];
  for(let cell=0;cell<225;cell++) {
    if(board[cell])continue;
    const row=Math.floor(cell/15),col=cell%15;
    let nearby=false;
    for(let y=Math.max(0,row-2);y<=Math.min(14,row+2);y++)for(let x=Math.max(0,col-2);x<=Math.min(14,col+2);x++)if(board[y*15+x])nearby=true;
    if(!nearby)continue;
    const score=lineValue(board,cell,2)*1.1+lineValue(board,cell,1)+(14-Math.abs(row-7)-Math.abs(col-7))*.1;
    if(score>best){best=score;candidates=[cell];}else if(score===best)candidates.push(cell);
  }
  return candidates.length?pick(candidates,random):board.findIndex(v=>v===0);
}
export function chooseComputerCard(match,random=Math.random) {
  const memory=match.secret.botMemory;
  const available=Array.from({length:16},(_,n)=>n).filter(n=>!match.matched[n]&&!match.flipped.includes(n));
  if(match.flipped.length) {
    const known=available.find(n=>memory[n]!==null&&memory[n]===memory[match.flipped[0]]);
    if(known!==undefined)return known;
  }else {
    for(const first of available) {
      if(memory[first]===null)continue;
      if(available.some(second=>second!==first&&memory[second]===memory[first]))return first;
    }
  }
  const unseen=available.filter(n=>memory[n]===null);
  return pick(unseen.length?unseen:available,random);
}
export const GOMOKU_CHALLENGES=Object.freeze([
  {black:[110,111,112,113],white:[109,170,171,172]},
  {black:[53,68,83,98],white:[38,170,171,172]},
  {black:[64,80,96,112],white:[48,170,171,172]},
]);
export function createGomokuPuzzle(index) {
  const board=Array(225).fill(0),puzzle=GOMOKU_CHALLENGES[index];
  for(const cell of puzzle.black)board[cell]=1;
  for(const cell of puzzle.white)board[cell]=2;
  return board;
}
