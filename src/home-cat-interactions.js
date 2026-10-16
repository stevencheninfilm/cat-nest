import { createArcadeController } from './minigames-arcade-client.js';
import { TOUCH_GAMES, TOUCH_INFO, touchPoint, CAT_PLAY_UNLOCK_LEVEL, catPlayUnlocked } from './minigames-touch-rules.js';
import { touchSurfaceMarkup, toyGuideMarkup } from './minigames-touch-ui.js';
import { arcadeCountdownMarkup } from './minigames-arcade-ui.js';
import { bindCatGestures } from './home-cat-gestures.js';
import { catActionPortrait } from './cat-actions.js';
import { levelInfo } from './state.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createHomeCatInteractions({nest,scene,cat,getState,getClientId,getModel,canInteract,isCompanion,isSaving,isConnected,getSaveStatus,storage,dispatch,onPet,onVisual,onClaim,onOpen,onRestore,toast}){
  let pending=null,session=null,tutorial=null,stamp='',readyRequested=false,lastScore=0,lastPoint='',lastMotion=0,destroyed=false,accessKey='';
  const disposers=[],inertBefore=new Map();
  const entry=document.createElement('button');entry.type='button';entry.id='cat-play';entry.className='cat-rhythm home-cat-play';entry.setAttribute('aria-expanded','false');entry.setAttribute('aria-controls','home-cat-choices');scene.append(entry);
  const choices=document.createElement('div');choices.id='home-cat-choices';choices.className='home-cat-choices';choices.hidden=true;choices.setAttribute('role','group');choices.setAttribute('aria-label','在小窝陪猫猫玩');scene.append(choices);
  const stage=document.createElement('section');stage.className='home-cat-session';stage.hidden=true;stage.setAttribute('aria-label','在小窝和猫猫玩');nest.append(stage);
  const listen=(node,type,fn,opts)=>{node.addEventListener(type,fn,opts);disposers.push(()=>node.removeEventListener(type,fn,opts));};
  const match=()=>getState().games.match;
  const visible=()=>!destroyed&&Boolean(session)&&!nest.hidden&&!document.querySelector('dialog[open]');
  const controller=createArcadeController({root:stage,getMatch:match,getClientId,isSaving,isConnected,dispatch,storage,isVisible:visible,onFrame:frame});
  let frameSurface=null,frameArea=null,frameTransform='';
  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>{frameArea=null;}):null;
  listen(window,'resize',()=>{frameArea=null;});
  function closeChoices(){choices.hidden=true;nest.classList.remove('home-cat-choosing');entry.setAttribute('aria-expanded','false');}
  const unlocked=()=>catPlayUnlocked(levelInfo(getState().xp).level);
  function renderAccess(){const allowed=unlocked(),key=String(allowed);if(key===accessKey)return;accessKey=key;entry.dataset.locked=String(!allowed);entry.setAttribute('aria-disabled',String(!allowed));entry.setAttribute('aria-label',allowed?'陪玩，和猫猫在小窝一起玩':`陪玩，Lv.${CAT_PLAY_UNLOCK_LEVEL} 解锁`);entry.title=allowed?'和猫猫玩逗猫棒、接零食、找玩具':`猫猫达到 Lv.${CAT_PLAY_UNLOCK_LEVEL} 后解锁陪玩`;entry.innerHTML=`${catActionPortrait('run')}${allowed?'':'<span class="home-cat-play-lock" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" stroke-width="1.5"/></svg></span>'}<small>陪玩${allowed?'':`<em>Lv.${CAT_PLAY_UNLOCK_LEVEL} 解锁</em>`}</small>`;if(!allowed)closeChoices();}
  function requireUnlock(){if(unlocked())return true;toast(`猫猫达到 Lv.${CAT_PLAY_UNLOCK_LEVEL} 就能解锁陪玩，一起喂食、摸摸，陪它慢慢长大吧。`);return false;}
  function resumable(){const m=match();return m&&TOUCH_GAMES.includes(m.game)&&m.mode==='solo'&&m.players[0].id===getClientId()&&m.status==='active';}
  function showChoices(){
    if(!canInteract()||session||pending||isCompanion())return;
    if(!resumable()&&!requireUnlock())return;
    const m=match(),resume=resumable();
    choices.innerHTML=`<div><small>在这里，陪猫猫玩一会儿</small><button data-home-cat-menu-close aria-label="收起陪玩气泡">×</button></div><nav>${TOUCH_GAMES.map(id=>`<button data-home-cat-game="${id}"><span aria-hidden="true">${TOUCH_INFO[id].emoji}</span><strong>${TOUCH_INFO[id].name}</strong><small>${resume&&m.game===id?'继续这一局':`${TOUCH_INFO[id].duration} 秒 · +${TOUCH_INFO[id].xp} 成长`}</small></button>`).join('')}</nav>`;
    choices.hidden=false;nest.classList.add('home-cat-choosing');entry.setAttribute('aria-expanded','true');onOpen();
  }
  function closeChoices(){choices.hidden=true;nest.classList.remove('home-cat-choosing');entry.setAttribute('aria-expanded','false');}
  function quietHome(value){
    nest.classList.toggle('home-playing',value);document.body.classList.toggle('home-cat-playing',value);
    const elements=nest.querySelectorAll('.side-actions,.wallet,.together,.partner-update,.pet-card,.feeding-preview,.feed-button,.bottom-nav,.topbar,.growth-rewards,#cat-rhythm');
    if(value){for(const e of elements){if(!inertBefore.has(e))inertBefore.set(e,e.inert);e.inert=true;}getModel()?.setEngaged(true);}
    else{for(const [e,previous]of inertBefore)e.inert=previous;inertBefore.clear();cat.style.removeProperty('transform');getModel()?.setEngaged(false);if(!destroyed)onRestore();}
  }
  function reset(){controller.suspend();closeChoices();pending=null;session=null;tutorial=null;stamp='';readyRequested=false;stage.hidden=true;stage.innerHTML='';quietHome(false);}
  function drawTutorial(){stage.innerHTML=`<header class="home-cat-guide-title"><h2>陪猫猫找小鱼玩具</h2><p>先试一次，学会后再开始计时</p></header>${toyGuideMarkup(tutorial.phase,tutorial.wrong)}<button class="home-cat-end" data-home-cat-leave>回到小窝</button>`;}
  function start(game,skipGuide=false){
    if(!TOUCH_GAMES.includes(game)||!canInteract())return;
    if(getState().sleeping){toast('猫猫还在睡，先轻点它叫醒，再一起玩。');return;}
    const m=match();
    if(m&&['waiting','active'].includes(m.status)){
      if(m.mode==='solo'&&TOUCH_GAMES.includes(m.game)&&m.players[0].id===getClientId()){
        tutorial=null;session={id:m.id,game:m.game};closeChoices();onOpen();quietHome(true);stage.hidden=false;sync();return;
      }
      toast('游戏屋还有一局正在进行，先完成或结束那一局，再来陪猫猫玩。');return;
    }
    if(!requireUnlock())return;
    if(!isConnected()||isSaving()){toast('小窝正在同步，等保存好就能一起玩。');return;}
    if(game==='hide-toy'&&!skipGuide){tutorial={phase:'look',wrong:null};closeChoices();onOpen();quietHome(true);cat.style.transform='translateY(-32%) scale(.48)';stage.hidden=false;drawTutorial();return;}
    tutorial=null;
    pending={game,previousId:m?.id??null};closeChoices();onOpen();quietHome(true);stage.hidden=false;
    stage.innerHTML='<div class="home-cat-preparing" role="status">猫猫准备小玩具中…</div><button class="home-cat-end" data-home-cat-leave>回到小窝</button>';
    if(!dispatch({type:'game-create',game,mode:'solo',previousId:pending.previousId})){reset();toast('这次没能开始，稍后再试试。');}
  }
  function frame({game,run,enabled}){
    if(!session)return;
    const surface=stage.querySelector('[data-touch-surface]');
    if(surface!==frameSurface){resizeObserver?.disconnect();frameSurface=surface;frameArea=null;frameTransform='';if(surface)resizeObserver?.observe(surface);}
    if(surface&&!frameArea)frameArea=surface.getBoundingClientRect();
    const area=frameArea;let transform='';
    if(game==='teaser'&&area){const p=touchPoint(run.point);transform=`translate(${(p.x/31-.5)*area.width}px,${(p.y/31-.55)*area.height}px) scale(.65)`;}
    else if(game==='treats'&&area)transform=`translate(${(run.basket/31-.5)*area.width}px,0) scale(.68)`;
    else if(game==='hide-toy')transform='translateY(-25%) scale(.58)';
    if(transform&&transform!==frameTransform){frameTransform=transform;cat.style.transform=transform;}
    const point=game==='teaser'?run.point:run.basket;
    if(enabled&&point!==lastPoint&&Date.now()-lastMotion>1400){lastMotion=Date.now();lastPoint=point;if(game==='teaser')getModel()?.playAction('walk');}
    if(run.score>lastScore){onVisual(game==='teaser'?'play':game==='treats'?'feed':'pet');}
    lastScore=run.score;
    const end=stage.querySelector('[data-home-cat-end]');if(end)end.disabled=isSaving()||!isConnected();
  }
  function sync(){
    if(destroyed)return;
    renderAccess();
    const m=match();
    if(pending){
      if(m?.id!==pending.previousId&&m?.game===pending.game&&m.mode==='solo'&&m.players[0].id===getClientId()){
        session={id:m.id,game:m.game};pending=null;quietHome(true);
      }else if(getSaveStatus().phase==='error'&&!isSaving()){reset();toast('这次陪玩没能保存，请再试一次。');}
    }
    if(!session)return;
    if(!m||m.id!==session.id||m.players[0].id!==getClientId()){reset();return;}
    const reward=getState().pendingGrowth.find(r=>r.id===`game:${m.id}`);
    const key=`${m.id}:${m.status}:${m.arcade.stage}:${Boolean(reward)}`;
    if(stamp!==key){
      stamp=key;controller.suspend();lastScore=0;lastPoint='';stage.hidden=false;
      if(['finished','cancelled'].includes(m.status)){
        cat.style.transform='scale(.72)';onRestore();
        stage.innerHTML=`<div class="home-cat-finish" role="status"><small>${escape(TOUCH_INFO[m.game].name)}</small><h2>${m.status==='cancelled'?'下次再来陪猫猫玩':'谢谢你陪我玩 ♡'}</h2><p>${m.status==='cancelled'?'这次提前结束，没有消耗照顾次数。':m.reward?`本次 ${m.scores[0]} 分 · 为猫猫带来 ${m.reward} 点成长`:m.arcade.rewardEligible===false?'这次还没达到目标，下次再试试。':'今日小游戏成长已达上限，陪伴也很开心。'}</p>${reward?'<button data-home-cat-claim>收下成长，回到小窝</button>':''}<button data-home-cat-leave>回到小窝</button></div>`;
      }else if(m.arcade.stage==='ready')stage.innerHTML='<div class="home-cat-preparing" role="status">准备好啦，马上开始陪玩…</div><button class="home-cat-end" data-home-cat-end>结束陪玩</button>';
      else stage.innerHTML=`<section data-arcade-id="${m.id}" class="home-cat-stage"><h2>${escape(TOUCH_INFO[m.game].name)}</h2><div class="arcade-hud"><span>剩余 <b data-arcade-time>—</b></span><strong><b data-arcade-score>0</b> 分</strong></div><p data-arcade-status class="home-cat-countdown" role="status"></p>${touchSurfaceMarkup(m.game,{home:true})}${arcadeCountdownMarkup()}<p class="arcade-sync" data-arcade-sync-status></p><button class="home-cat-end" data-home-cat-end>结束陪玩</button></section>`;
    }
    if(m.status==='active'&&m.arcade.stage==='ready'&&!readyRequested&&!isSaving()&&isConnected()){
      readyRequested=true;if(!dispatch({type:'game-arcade-ready',gameId:m.id}))readyRequested=false;
    }
    controller.sync();
  }
  disposers.push(bindCatGestures({cat,canInteract:()=>!session&&!pending&&!tutorial&&canInteract(),onTap:onPet,onStart:closeChoices,consumeModelTap:()=>getModel()?.consumeTap()}));
  listen(entry,'click',()=>{if(choices.hidden)showChoices();else closeChoices();});
  listen(choices,'click',event=>{const b=event.target.closest('button');if(b?.dataset.homeCatGame)start(b.dataset.homeCatGame);else if(b?.hasAttribute('data-home-cat-menu-close'))closeChoices();});
  listen(stage,'click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-home-cat-leave'))reset();else if(tutorial&&b.hasAttribute('data-toy-guide-cover')){tutorial={phase:'find',wrong:null};drawTutorial();}else if(tutorial&&tutorial.phase==='find'&&b.dataset.toyGuideCell!==undefined){const cell=Number(b.dataset.toyGuideCell);tutorial=cell===1?{phase:'done',wrong:null}:{phase:'find',wrong:cell};if(cell===1)onVisual('pet');drawTutorial();}else if(tutorial&&b.hasAttribute('data-toy-guide-start'))start('hide-toy',true);else if(b.hasAttribute('data-home-cat-claim')){const reward=getState().pendingGrowth.find(r=>r.id===`game:${session?.id}`);if(reward&&onClaim(reward.id,b))reset();}else if(b.hasAttribute('data-home-cat-end')&&session&&!isSaving()){if(!dispatch({type:'game-cancel',gameId:session.id}))toast('正在保存操作，稍等一下再结束。');}});
  listen(document,'pointerdown',event=>{if(!event.target.closest('.home-cat-choices,#cat,#cat-play'))closeChoices();});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&!choices.hidden){event.preventDefault();closeChoices();}});
  renderAccess();
  return {sync,start,closeChoices,serverTime:controller.serverTime,get canRotate(){return !destroyed&&!session&&!pending&&!tutorial;},get active(){return Boolean(session||pending||tutorial);},dismiss(){if(pending||session||tutorial)reset();else closeChoices();},destroy(){destroyed=true;reset();resizeObserver?.disconnect();for(const d of disposers)d();entry.remove();choices.remove();stage.remove();}};
}
