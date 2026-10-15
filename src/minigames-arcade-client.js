import { ARCADE_GAMES, ARCADE_DURATION, advanceArcadeRun, applyArcadeEvent, reactionCue, whackTarget } from './minigames-arcade-rules.js';
import { TOUCH_GAMES, encodeTouchPoint, touchPoint } from './minigames-touch-rules.js';
import { drawTouchGame, touchStatusText } from './minigames-touch-ui.js';
/** Render immediately; submit bounded input logs for authoritative replay. */
export function createArcadeController({root,getMatch,getClientId,isSaving,isConnected,dispatch,storage,isVisible=()=>true,onFrame=()=>{}}) {
  let match=null,player=-1,run=null,queue=[],inFlight=null,lastSend=0,lastSync=0,raf=0,offset=0,storageKey='',stamp='',swipe=null;
  let touchDrag=null,touchEndTimer,viewing=false;
  const cache=storage;
  const now=()=>Date.now()+offset;
  const persist=()=>{try{cache?.setItem(storageKey,JSON.stringify({seq:match.arcade.runs[player].seq,queue,inFlight}));}catch{}};
  function serverTime(value){if(Number.isSafeInteger(value))offset=value-Date.now();}
  function sync() {
    const next=getMatch(),index=next?.players.findIndex(p=>p.id===getClientId())??-1;
    if(!isVisible()||!next||!ARCADE_GAMES.includes(next.game)||index<0||!root.querySelector('[data-arcade-id]')){suspend();return;}
    viewing=true;
    const source=next.arcade.runs[index],key=`${next.id}:${source.seq}:${next.status}`;
    if(match?.id!==next.id){queue=[];inFlight=null;stamp='';touchDrag=null;storageKey=`catnest.arcade.${next.id}.${getClientId()}`;try{const saved=JSON.parse(cache?.getItem(storageKey)||'null');if(Array.isArray(saved?.queue)&&saved.queue.length<=2048&&saved.queue.every(e=>Array.isArray(e)&&e.length===2&&Number.isSafeInteger(e[0])&&e[0]>=0&&Number.isSafeInteger(e[1])&&e[1]>=0&&e[1]<=1023)){if(saved.seq===source.seq){queue=saved.queue;inFlight=saved.inFlight;}else if(saved.inFlight&&saved.seq+1===source.seq)queue=saved.queue.slice(saved.inFlight.count);}}catch{}}
    match=next;player=index;
    if(key!==stamp) {
      if(inFlight&&source.seq>inFlight.seq){queue.splice(0,inFlight.count);inFlight=null;}
      queue=queue.filter(e=>e[0]>=source.elapsed&&e[0]<ARCADE_DURATION[next.game]);
      run=structuredClone(source);for(const event of queue)applyArcadeEvent(match.game,run,event,match.arcade.seed);
      stamp=key;persist();
    }
    if(next.status!=='active'){queue=[];inFlight=null;touchDrag=null;try{cache?.removeItem(storageKey);}catch{}}
    if(!raf)raf=requestAnimationFrame(frame);
    draw();
  }
  function input(move) {
    if(!viewing||!isVisible()||document.hidden||!match||match.status!=='active'||match.arcade.stage!=='running'||!isConnected()||now()<match.arcade.startAt||run.finished||queue.length>=2048)return;
    const elapsed=Math.max(run.elapsed,Math.min(ARCADE_DURATION[match.game],Math.floor(now()-match.arcade.startAt)));
    const event=[elapsed,move];
    if(applyArcadeEvent(match.game,run,event,match.arcade.seed)){queue.push(event);persist();draw();if(match.game==='reaction')flush(true);}
  }
  function flush(force=false) {
    if(!match||match.status!=='active'||isSaving()||!isConnected()||now()<match.arcade.startAt)return;
    if(inFlight){if(Date.now()-inFlight.sentAt<20000)return;inFlight=null;}
    if(!force&&Date.now()-lastSend<2500&&queue.length<12&&!run.finished)return;
    const source=match.arcade.runs[player];
    if(source.finished){if(Date.now()-lastSync>3000){lastSync=Date.now();dispatch({type:'game-arcade-sync',gameId:match.id});}return;}
    const count=Math.min(queue.length,256),events=queue.slice(0,count),until=count<queue.length?events.at(-1)[0]:run.elapsed;
    if(until<=source.elapsed&&!events.length)return;
    inFlight={seq:source.seq,count,sentAt:Date.now()};lastSend=Date.now();persist();
    if(!dispatch({type:'game-arcade-input',gameId:match.id,seq:source.seq,events,until})){inFlight=null;persist();}
  }
  function frame() {
    raf=0;
    if(!isVisible()||!match||!root.querySelector('[data-arcade-id]')||document.hidden)return;
    if(match.status==='active'&&match.arcade.stage==='running') {
      advanceArcadeRun(match.game,run,Math.max(0,now()-match.arcade.startAt));flush();
    }
    draw();if(match.status==='active')raf=requestAnimationFrame(frame);
  }
  function draw() {
    const stage=root.querySelector('[data-arcade-id]');if(!stage||!run)return;
    const duration=ARCADE_DURATION[match.game],elapsed=Math.max(0,Math.min(duration,now()-match.arcade.startAt)),countdown=Math.ceil((match.arcade.startAt-now())/1000);
    const counting=countdown>0&&match.status==='active',countdownNode=stage.querySelector('[data-arcade-countdown]');
    if(countdownNode){countdownNode.hidden=!counting;stage.querySelector('[data-arcade-countdown-number]').textContent=String(Math.max(1,countdown));}
    stage.classList.toggle('is-counting-down',counting);
    stage.querySelector('[data-arcade-time]').textContent=`${Math.ceil((duration-elapsed)/1000)}s`;
    stage.querySelector('[data-arcade-score]').textContent=run.score;
    const status=stage.querySelector('[data-arcade-status]');
    const statusText=match.status==='cancelled'?'本局已结束':counting?'准备好，马上开始':match.status==='finished'?'本局已结算':run.finished?'已完成，正在同步比分…':TOUCH_GAMES.includes(match.game)?touchStatusText(match.game,run,elapsed):match.game==='snake'?`🐟 ${run.fish} 条鱼 · 碰撞 ${run.crashes} 次`:match.game==='merge2048'?`最大数字 ${run.maxTile} · ${run.moves} 次移动`:match.game==='whack'?`击中 ${run.hits} · 点错 ${run.misses}`:`第 ${Math.min(5,Math.floor(elapsed/5000)+1)} / 5 轮`;
    if(status.textContent!==statusText)status.textContent=statusText;
    stage.querySelector('[data-arcade-sync-status]').textContent=!isConnected()?'连接中，等待恢复同步…':inFlight?'正在同步比分':queue.length?'操作已暂存，等待同步':'';
    const enabled=countdown<=0&&!run.finished&&match.status==='active'&&isConnected();
    stage.querySelectorAll('button').forEach(b=>b.disabled=!enabled);
    if(TOUCH_GAMES.includes(match.game)){
      drawTouchGame(stage,match.game,run,elapsed,match.arcade.seed,enabled);
      root.querySelectorAll('.game-player b').forEach((node,n)=>node.textContent=`${n===player?run.score:match.scores[n]||0} 分`);
      const connection=root.querySelector('.game-connection');if(connection)connection.textContent=!isConnected()?'正在连接小窝…':isSaving()?'正在保存这段陪伴…':'已连接小窝 · 实时同步';
    }
    if(match.game==='merge2048')stage.querySelectorAll('.merge-tile').forEach((el,n)=>{const v=run.tiles[n];el.textContent=v||'';el.dataset.value=v;el.style.setProperty('--tile-hue',v?Math.max(20,48-Math.log2(v)*3):40);});
    if(match.game==='reaction') {
      const round=Math.min(4,Math.floor(elapsed/5000)),result=run.reactions[round],green=elapsed>=reactionCue(match.arcade.seed,round),pad=stage.querySelector('.reaction-pad');
      pad.classList.toggle('is-green',enabled&&green&&!result);pad.disabled=!enabled||!!result;
      stage.querySelector('[data-reaction-icon]').textContent=result?'✨':green?'⚡':'🐾';
      stage.querySelector('[data-reaction-label]').textContent=countdown>0?'准备…':run.finished?'挑战完成':result?result.kind==='hit'?`${result.ms} ms`:result.kind==='early'?'抢跑啦':'错过啦':green?'现在点击！':'等绿灯…';
      stage.querySelector('[data-reaction-detail]').textContent=run.finished?'五轮成绩已记录':result?'等待下一轮':'绿灯亮起再出手';
      stage.querySelector('[data-reaction-rounds]').innerHTML=run.reactions.map((r,n)=>`<span>${n+1}<b>${r?r.kind==='hit'?r.ms+'ms':r.kind==='early'?'抢跑':'漏点':'—'}</b></span>`).join('');
    }
    if(match.game==='whack') {
      const slot=Math.floor(elapsed/850),target=whackTarget(match.arcade.seed,slot),visible=enabled&&elapsed%850<650&&!run.attempted.includes(slot);
      stage.querySelectorAll('[data-arcade-move]').forEach((b,n)=>{const hit=visible&&target.cell===n;b.firstElementChild.textContent=hit?target.cat?'🐱':'🐹':'·';b.classList.toggle('is-up',hit);b.setAttribute('aria-label',`第${n+1}个洞，${hit?target.cat?'猫猫':'地鼠':'空洞'}`);});
    }
    if(match.game==='snake') {
      const canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d'),size=40;ctx.clearRect(0,0,480,480);ctx.fillStyle='#edf1e1';ctx.fillRect(0,0,480,480);
      ctx.strokeStyle='#dce5cc';for(let n=0;n<13;n++){ctx.beginPath();ctx.moveTo(n*size,0);ctx.lineTo(n*size,480);ctx.moveTo(0,n*size);ctx.lineTo(480,n*size);ctx.stroke();}
      run.body.forEach((cell,n)=>{ctx.fillStyle=n?'#a6bd7e':'#6e965c';ctx.beginPath();ctx.roundRect(cell%12*size+3,Math.floor(cell/12)*size+3,34,34,n?10:12);ctx.fill();});
      ctx.font='29px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';if(run.food>=0)ctx.fillText('🐟',run.food%12*size+20,Math.floor(run.food/12)*size+21);ctx.fillText('🐱',run.body[0]%12*size+20,Math.floor(run.body[0]/12)*size+20);
      canvas.setAttribute('aria-label',`贪吃蛇棋盘，蛇头第${Math.floor(run.body[0]/12)+1}行第${run.body[0]%12+1}列，${run.fish}条鱼`);
    }
    onFrame({game:match.game,run,elapsed,countdown,enabled});
  }
  function suspend(){cancelAnimationFrame(raf);clearTimeout(touchEndTimer);raf=0;viewing=false;touchDrag=null;swipe=null;}
  root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-arcade-ready')){const m=getMatch();dispatch({type:'game-arcade-ready',gameId:m.id});return;}if(b.hasAttribute('data-arcade-tap'))input(Math.min(4,Math.floor(Math.max(0,now()-match.arcade.startAt)/5000)));else if(b.dataset.arcadeMove!==undefined)input(Number(b.dataset.arcadeMove));});
  document.addEventListener('keydown',event=>{if(!viewing||!isVisible()||!root.querySelector('[data-arcade-id]')||event.target.matches('input,select,textarea'))return;const direction={ArrowUp:0,w:0,ArrowRight:1,d:1,ArrowDown:2,s:2,ArrowLeft:3,a:3}[event.key];if(direction===undefined)return;if(['teaser','treats'].includes(match?.game)){event.preventDefault();if(match.game==='treats'){if(direction===1||direction===3)input(Math.max(0,Math.min(31,run.basket+(direction===1?3:-3))));}else{const p=touchPoint(run.point);input(encodeTouchPoint(p.x+[0,4,0,-4][direction],p.y+[-4,0,4,0][direction]));}}else if(['snake','merge2048'].includes(match?.game)){event.preventDefault();input(direction);}});
  function dragInput(event){if(!touchDrag||touchDrag.id!==event.pointerId)return;const rect=touchDrag.node.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*31,y=(event.clientY-rect.top)/rect.height*31,move=match.game==='teaser'?encodeTouchPoint(x,y):Math.max(0,Math.min(31,Math.round(x)));input(move);return move;}
  root.addEventListener('pointerdown',event=>{const surface=event.target.closest('[data-touch-surface]');if(!surface||event.button!==0||event.isPrimary===false||touchDrag)return;event.preventDefault();clearTimeout(touchEndTimer);touchDrag={id:event.pointerId,node:surface};surface.focus({preventScroll:true});surface.setPointerCapture?.(event.pointerId);dragInput(event);});
  root.addEventListener('pointermove',dragInput);
  root.addEventListener('pointerup',event=>{if(touchDrag?.id===event.pointerId){const move=dragInput(event),id=match?.id;touchDrag=null;clearTimeout(touchEndTimer);touchEndTimer=setTimeout(()=>{if(match?.id===id&&root.querySelector('[data-touch-surface]'))input(move);},65);}});
  root.addEventListener('pointercancel',event=>{if(touchDrag?.id===event.pointerId)touchDrag=null;});
  root.addEventListener('pointerdown',event=>{if(event.target.closest('[data-arcade-surface]'))swipe={x:event.clientX,y:event.clientY};});
  root.addEventListener('pointerup',event=>{if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24||!['snake','merge2048'].includes(match?.game))return;input(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);});
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():sync());
  return {sync,suspend,serverTime};
}
