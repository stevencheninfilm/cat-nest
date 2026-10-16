import { ARCADE_GAMES, ARCADE_DURATION, advanceArcadeRun, applyArcadeEvent } from './minigames-arcade-rules.js';
import { TOUCH_GAMES, encodeTouchPoint, touchPoint } from './minigames-touch-rules.js';
import { createArcadeView } from './minigames-arcade-view.js';
/** Render immediately; submit bounded input logs for authoritative replay. */
export function createArcadeController({root,getMatch,getClientId,isSaving,isConnected,dispatch,storage,isVisible=()=>true,onFrame=()=>{}}) {
  let match=null,player=-1,run=null,queue=[],inFlight=null,lastSend=0,lastSync=0,retryAt=0,raf=0,offset=0,storageKey='',stamp='',swipe=null;
  let touchDrag=null,touchEndTimer,viewing=false,persistTimer,visualMove=null,lastServerTime=null;
  let dirty=false,checkedTiles=null;
  const cache=storage;
  const now=()=>Date.now()+offset;
  // Reaction times are verified at server receipt. Other deterministic games
  // can keep their bounded replay locally through a brief network interruption.
  const canInput=()=>isConnected()||match?.mode==='duo'&&match.game!=='reaction';
  function persistNow(){clearTimeout(persistTimer);persistTimer=null;if(!dirty||!storageKey||!match)return;dirty=false;try{cache?.setItem(storageKey,JSON.stringify({seq:match.arcade.runs[player].seq,queue,inFlight}));}catch{}}
  function persist(){dirty=true;if(!persistTimer)persistTimer=setTimeout(persistNow,100);}
  function serverTime(value){if(Number.isSafeInteger(value)&&value!==lastServerTime){offset=value-Date.now();lastServerTime=value;}}
  function sync() {
    const next=getMatch(),index=next?.players.findIndex(p=>p.id===getClientId())??-1;
    if(!isVisible()||!next||!ARCADE_GAMES.includes(next.game)||index<0||!root.querySelector('[data-arcade-id]')){suspend();return;}
    viewing=true;
    const source=next.arcade.runs[index],key=`${next.id}:${source.seq}:${next.status}`;
    if(match?.id!==next.id){persistNow();queue=[];inFlight=null;stamp='';touchDrag=null;visualMove=null;storageKey=`catnest.arcade.${next.id}.${getClientId()}`;try{const saved=JSON.parse(cache?.getItem(storageKey)||'null');if(Array.isArray(saved?.queue)&&saved.queue.length<=2048&&saved.queue.every(e=>Array.isArray(e)&&e.length===2&&Number.isSafeInteger(e[0])&&e[0]>=0&&Number.isSafeInteger(e[1])&&e[1]>=0&&e[1]<=1023)){if(saved.seq===source.seq){queue=saved.queue;inFlight=saved.inFlight;}else if(saved.inFlight&&saved.seq+1===source.seq)queue=saved.queue.slice(saved.inFlight.count);}}catch{}}
    match=next;player=index;
    if(key!==stamp) {
      if(inFlight&&source.seq>inFlight.seq){queue.splice(0,inFlight.count);inFlight=null;}
      queue=queue.filter(e=>e[0]>=source.elapsed&&e[0]<ARCADE_DURATION[next.game]);
      run=structuredClone(source);for(const event of queue)applyArcadeEvent(match.game,run,event,match.arcade.seed);
      stamp=key;persist();
    }
    if(next.status!=='active'){clearTimeout(persistTimer);persistTimer=null;dirty=false;queue=[];inFlight=null;touchDrag=null;try{cache?.removeItem(storageKey);}catch{}}
    if(!raf)raf=requestAnimationFrame(frame);
    draw();
  }
  function input(move) {
    if(!viewing||!isVisible()||document.hidden||!match||match.status!=='active'||match.arcade.stage!=='running'||!canInput()||now()<match.arcade.startAt||run.finished||queue.length>=2048)return;
    const elapsed=Math.max(run.elapsed,Math.min(ARCADE_DURATION[match.game],Math.floor(now()-match.arcade.startAt)));
    const event=[elapsed,move];
    if(applyArcadeEvent(match.game,run,event,match.arcade.seed)){queue.push(event);persist();draw();if(match.game==='reaction')flush(true);}
  }
  function flush(force=false) {
    if(!match||match.status!=='active'||isSaving()||!isConnected()||now()<match.arcade.startAt||Date.now()<retryAt)return;
    if(inFlight){if(Date.now()-inFlight.sentAt<20000)return;inFlight=null;}
    if(!force&&Date.now()-lastSend<2500&&queue.length<12&&!run.finished)return;
    const source=match.arcade.runs[player];
    if(source.finished){if(Date.now()-lastSync>3000){lastSync=Date.now();dispatch({type:'game-arcade-sync',gameId:match.id});}return;}
    const count=Math.min(queue.length,256),events=queue.slice(0,count),until=count<queue.length?events.at(-1)[0]:run.elapsed;
    if(until<=source.elapsed&&!events.length)return;
    inFlight={seq:source.seq,count,sentAt:Date.now()};lastSend=Date.now();dirty=true;persistNow();
    if(!dispatch({type:'game-arcade-input',gameId:match.id,seq:source.seq,events,until})){inFlight=null;retryAt=Date.now()+500;persist();}
  }
  function frame() {
    raf=0;
    if(!isVisible()||!match||!root.querySelector('[data-arcade-id]')||document.hidden)return;
    if(match.status==='active'&&match.arcade.stage==='running') {
      const elapsed=Math.max(0,now()-match.arcade.startAt);
      // 2048's four-direction game-over search is needed once per changed
      // board, not on every display frame while waiting for the next gesture.
      if(match.game==='merge2048'&&run.tiles===checkedTiles&&!run.finished){run.elapsed=Math.max(run.elapsed,Math.min(ARCADE_DURATION[match.game],Math.floor(elapsed)));if(run.elapsed>=ARCADE_DURATION[match.game])run.finished=true;}
      else {advanceArcadeRun(match.game,run,elapsed);if(match.game==='merge2048')checkedTiles=run.tiles;}
      flush();
    }
    draw();if(match.status==='active')raf=requestAnimationFrame(frame);
  }
  const view=createArcadeView(root,getClientId);
  function draw(){
    // The pointer follows every frame; scoring still replays the bounded 60ms
    // input log. Visual movement never changes run, XP or the reward ledger.
    const display=visualMove!==null&&match&&['teaser','treats'].includes(match.game)?{...run,[match.game==='teaser'?'point':'basket']:visualMove}:run;
    const result=view.draw({match,run:display,now:now(),connected:isConnected(),saving:isSaving(),inFlight,queued:queue.length});if(result)onFrame(result);
  }
  function suspend(){persistNow();cancelAnimationFrame(raf);clearTimeout(touchEndTimer);raf=0;viewing=false;touchDrag=null;visualMove=null;swipe=null;}
  root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-arcade-ready')){const m=getMatch();dispatch({type:'game-arcade-ready',gameId:m.id});return;}if(b.hasAttribute('data-arcade-tap'))input(Math.min(4,Math.floor(Math.max(0,now()-match.arcade.startAt)/5000)));else if(b.dataset.arcadeMove!==undefined)input(Number(b.dataset.arcadeMove));});
  document.addEventListener('keydown',event=>{if(!viewing||!isVisible()||!root.querySelector('[data-arcade-id]')||event.target.matches('input,select,textarea'))return;const direction={ArrowUp:0,w:0,ArrowRight:1,d:1,ArrowDown:2,s:2,ArrowLeft:3,a:3}[event.key];if(direction===undefined)return;if(['teaser','treats'].includes(match?.game)){event.preventDefault();if(match.game==='treats'){if(direction===1||direction===3)input(Math.max(0,Math.min(31,run.basket+(direction===1?3:-3))));}else{const p=touchPoint(run.point);input(encodeTouchPoint(p.x+[0,4,0,-4][direction],p.y+[-4,0,4,0][direction]));}}else if(['snake','merge2048'].includes(match?.game)){event.preventDefault();input(direction);}});
  function dragInput(event){if(!touchDrag||touchDrag.id!==event.pointerId||!match)return;const rect=touchDrag.rect;if(!rect.width||!rect.height)return;const x=(event.clientX-rect.left)/rect.width*31,y=(event.clientY-rect.top)/rect.height*31,move=match.game==='teaser'?encodeTouchPoint(x,y):Math.max(0,Math.min(31,Math.round(x)));if(viewing&&canInput()&&!run.finished&&queue.length<2048&&now()>=match.arcade.startAt)visualMove=move;input(move);return move;}
  root.addEventListener('pointerdown',event=>{const surface=event.target.closest('[data-touch-surface]');if(!surface||event.button!==0||event.isPrimary===false||touchDrag)return;event.preventDefault();clearTimeout(touchEndTimer);touchDrag={id:event.pointerId,node:surface,rect:surface.getBoundingClientRect()};surface.focus({preventScroll:true});surface.setPointerCapture?.(event.pointerId);dragInput(event);});
  root.addEventListener('pointermove',dragInput);
  root.addEventListener('pointerup',event=>{if(touchDrag?.id===event.pointerId){const move=dragInput(event),id=match?.id;touchDrag=null;clearTimeout(touchEndTimer);touchEndTimer=setTimeout(()=>{if(Number.isSafeInteger(move)&&match?.id===id&&root.querySelector('[data-touch-surface]')){visualMove=null;input(move);}},65);}});
  root.addEventListener('pointercancel',event=>{if(touchDrag?.id===event.pointerId){touchDrag=null;visualMove=null;}});
  root.addEventListener('pointerdown',event=>{if(event.target.closest('[data-arcade-surface]'))swipe={x:event.clientX,y:event.clientY};});
  root.addEventListener('pointerup',event=>{if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24||!['snake','merge2048'].includes(match?.game))return;input(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);});
  globalThis.addEventListener?.('pagehide',suspend);
  globalThis.addEventListener?.('resize',()=>{if(touchDrag)touchDrag.rect=touchDrag.node.getBoundingClientRect();});
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():sync());
  return {sync,suspend,serverTime};
}
