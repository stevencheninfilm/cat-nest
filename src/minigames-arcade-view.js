import { ARCADE_DURATION, reactionCue, whackTarget } from './minigames-arcade-rules.js';
import { TOUCH_GAMES } from './minigames-touch-rules.js';
import { drawTouchGame, touchStatusText } from './minigames-touch-ui.js';
const text=(node,value)=>{if(node&&String(node.textContent)!==String(value))node.textContent=value;};
const attribute=(node,key,value)=>{if(node.getAttribute?.(key)!==value)node.setAttribute(key,value);};
/** One cached playfield per mounted board. Never replace active controls. */
export function createArcadeView(root,clientId){
  let previous=null,visual='',snake='',rounds='';
  const nodes=new Map(),lists=new Map(),headers=new Map();
  const headerAll=selector=>{if(!headers.has(selector))headers.set(selector,root.querySelectorAll(selector));return headers.get(selector);};
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,previous.querySelector(selector));return nodes.get(selector);};
  const all=selector=>{if(!lists.has(selector))lists.set(selector,previous.querySelectorAll(selector));return lists.get(selector);};
  function draw({match,run,now,connected,saving,inFlight,queued}) {
    const element=root.querySelector('[data-arcade-id]');if(!element||!run)return false;
    if(element!==previous){previous=element;nodes.clear();lists.clear();headers.clear();visual='';snake='';rounds='';}
    const stage={querySelector:get,querySelectorAll:all,classList:element.classList,dataset:element.dataset};
    const duration=ARCADE_DURATION[match.game],elapsed=Math.max(0,Math.min(duration,now-match.arcade.startAt)),countdown=Math.ceil((match.arcade.startAt-now)/1000);
    const counting=countdown>0&&match.status==='active';
    // Clock edges and actual board changes drive painting; 120 Hz screens do
    // not need 120 copies of an unchanged board or accessibility announcement.
    const key=JSON.stringify([match.status,countdown>0?countdown:0,Math.ceil((duration-elapsed)/1000),run.score,run.inputs,run.finished,connected,saving,Boolean(inFlight),Boolean(queued),match.scores,
      match.game==='snake'?run.tick:match.game==='reaction'?[Math.min(4,Math.floor(elapsed/5000)),elapsed>=reactionCue(match.arcade.seed,Math.min(4,Math.floor(elapsed/5000))),run.reactions]:match.game==='whack'?[Math.floor(elapsed/850),elapsed%850<650]:match.game==='teaser'?[Math.floor(elapsed/1500),run.point]:match.game==='treats'?[Math.floor(elapsed/(1000/60)),run.basket]:match.game==='hide-toy'?[Math.floor(elapsed/5000),Math.ceil((2000-elapsed%5000)/1000),elapsed%5000>=4800]:null]);
    if(key===visual)return false;visual=key;
    const countdownNode=get('[data-arcade-countdown]');
    if(countdownNode){if(countdownNode.hidden!==!counting)countdownNode.hidden=!counting;text(get('[data-arcade-countdown-number]'),String(Math.max(1,countdown)));}
    stage.classList.toggle('is-counting-down',counting);
    text(get('[data-arcade-time]'),`${Math.ceil((duration-elapsed)/1000)}s`);
    text(get('[data-arcade-score]'),run.score);
    const status=stage.querySelector('[data-arcade-status]');
    const statusText=match.status==='cancelled'?'本局已结束':counting?'准备好，马上开始':match.status==='finished'?'本局已结算':run.finished?'已完成，正在同步比分…':TOUCH_GAMES.includes(match.game)?touchStatusText(match.game,run,elapsed):match.game==='snake'?`🐟 ${run.fish} 条鱼 · 碰撞 ${run.crashes} 次`:match.game==='merge2048'?`最大数字 ${run.maxTile} · ${run.moves} 次移动`:match.game==='whack'?`击中 ${run.hits} · 点错 ${run.misses}`:`第 ${Math.min(5,Math.floor(elapsed/5000)+1)} / 5 轮`;
    if(status.textContent!==statusText)status.textContent=statusText;
    text(get('[data-arcade-sync-status]'),!connected?'连接中，等待恢复同步…':inFlight?'正在同步比分':queued?'操作已暂存，等待同步':'');
    const enabled=countdown<=0&&!run.finished&&match.status==='active'&&connected;
    all('button').forEach(b=>{if(b.matches?.('.reaction-pad')||match.game==='hide-toy'&&b.hasAttribute?.('data-arcade-move'))return;if(b.disabled!==!enabled)b.disabled=!enabled;});
    {
      if(TOUCH_GAMES.includes(match.game))drawTouchGame(stage,match.game,run,elapsed,match.arcade.seed,enabled);
      headerAll('.game-player b').forEach((node,n)=>text(node,`${n===match.players.findIndex(p=>p.id===clientId())?run.score:match.scores[n]||0} 分`));
      if(!headers.has('.game-connection'))headers.set('.game-connection',root.querySelector('.game-connection'));
      const connection=headers.get('.game-connection');if(connection)text(connection,!connected?'正在连接小窝…':saving?'正在保存这段陪伴…':'已连接小窝 · 实时同步');
      headerAll('[data-game-cancel]').forEach(b=>{if(b.disabled!==(saving||!connected))b.disabled=saving||!connected;});
    }
    if(match.game==='merge2048')stage.querySelectorAll('.merge-tile').forEach((el,n)=>{const v=run.tiles[n];if(String(el.dataset.value)===String(v))return;text(el,v||'');el.dataset.value=v;el.style.setProperty('--tile-hue',v?Math.max(20,48-Math.log2(v)*3):40);});
    if(match.game==='reaction') {
      const round=Math.min(4,Math.floor(elapsed/5000)),result=run.reactions[round],green=elapsed>=reactionCue(match.arcade.seed,round),pad=stage.querySelector('.reaction-pad');
      pad.classList.toggle('is-green',enabled&&green&&!result);pad.disabled=!enabled||!!result;
      text(get('[data-reaction-icon]'),result?'✨':green?'⚡':'🐾');
      text(get('[data-reaction-label]'),countdown>0?'准备…':run.finished?'挑战完成':result?result.kind==='hit'?`${result.ms} ms`:result.kind==='early'?'抢跑啦':'错过啦':green?'现在点击！':'等绿灯…');
      text(get('[data-reaction-detail]'),run.finished?'五轮成绩已记录':result?'等待下一轮':'绿灯亮起再出手');
      const nextRounds=run.reactions.map((r,n)=>`<span>${n+1}<b>${r?r.kind==='hit'?r.ms+'ms':r.kind==='early'?'抢跑':'漏点':'—'}</b></span>`).join('');if(nextRounds!==rounds){rounds=nextRounds;get('[data-reaction-rounds]').innerHTML=nextRounds;}
    }
    if(match.game==='whack') {
      const slot=Math.floor(elapsed/850),target=whackTarget(match.arcade.seed,slot),visible=enabled&&elapsed%850<650&&!run.attempted.includes(slot);
      stage.querySelectorAll('[data-arcade-move]').forEach((b,n)=>{const hit=visible&&target.cell===n;text(b.firstElementChild,hit?target.cat?'🐱':'🐹':'·');b.classList.toggle('is-up',hit);attribute(b,'aria-label',`第${n+1}个洞，${hit?target.cat?'猫猫':'地鼠':'空洞'}`);});
    }
    if(match.game==='snake'&&snake!==`${run.body.join(',')}:${run.food}:${run.fish}`) {
      snake=`${run.body.join(',')}:${run.food}:${run.fish}`;
      const canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d'),size=40;ctx.clearRect(0,0,480,480);ctx.fillStyle='#edf1e1';ctx.fillRect(0,0,480,480);
      ctx.strokeStyle='#dce5cc';for(let n=0;n<13;n++){ctx.beginPath();ctx.moveTo(n*size,0);ctx.lineTo(n*size,480);ctx.moveTo(0,n*size);ctx.lineTo(480,n*size);ctx.stroke();}
      run.body.forEach((cell,n)=>{ctx.fillStyle=n?'#a6bd7e':'#6e965c';ctx.beginPath();ctx.roundRect(cell%12*size+3,Math.floor(cell/12)*size+3,34,34,n?10:12);ctx.fill();});
      ctx.font='29px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';if(run.food>=0)ctx.fillText('🐟',run.food%12*size+20,Math.floor(run.food/12)*size+21);ctx.fillText('🐱',run.body[0]%12*size+20,Math.floor(run.body[0]/12)*size+20);
      canvas.setAttribute('aria-label',`贪吃蛇棋盘，蛇头第${Math.floor(run.body[0]/12)+1}行第${run.body[0]%12+1}列，${run.fish}条鱼`);
    }
    return {game:match.game,run,elapsed,countdown,enabled};
  }
  return {draw};
}
