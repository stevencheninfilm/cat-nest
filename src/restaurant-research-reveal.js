import { restaurantDishGrade, restaurantResearchCost, restaurantFragmentSurplus, RESTAURANT_DISH_GRADES } from './restaurant-research.js';
import { restaurantQualityAttributes, restaurantQualityFood } from './restaurant-order-tiers-ui.js';
import { restaurantInfo } from './restaurant.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const food=id=>`<span class="r-food r-food-${esc(id)}" aria-hidden="true"></span>`;
const paw='<svg viewBox="0 0 72 72" fill="currentColor" aria-hidden="true"><ellipse cx="20" cy="26" rx="7" ry="10" transform="rotate(-25 20 26)"/><ellipse cx="34" cy="18" rx="7" ry="10"/><ellipse cx="49" cy="23" rx="7" ry="10" transform="rotate(23 49 23)"/><ellipse cx="58" cy="37" rx="6" ry="8" transform="rotate(35 58 37)"/><path d="M20 49c2-12 12-20 20-17 7 2 17 13 17 22 0 12-13 6-20 6-8 1-20 1-17-11Z"/></svg>';

export function restaurantLotteryEffects(){
  return `<div class="rr-lottery-energy" aria-hidden="true"><div class="rr-lottery-nebula"></div><svg class="rr-lottery-streams" viewBox="0 0 400 400"><defs><linearGradient id="rr-lottery-gradient"><stop stop-color="#56d6ff" stop-opacity="0"/><stop offset=".6" stop-color="#35a2ff"/><stop offset="1" stop-color="#e3f7ff"/></linearGradient></defs>${Array.from({length:5},(_,index)=>`<path d="M -35 130 C 85 -30 347 54 228 168 Q 200 192 200 200" transform="rotate(${index*72} 200 200)"/>`).join('')}</svg><div class="rr-lottery-core"></div><div class="rr-lottery-particles">${Array.from({length:12},(_,index)=>`<i style="--energy-angle:${index*137}deg;--energy-distance:${120+index%7*19}px;--energy-delay:${-index%9*.16}s"></i>`).join('')}</div></div><div class="rr-lottery-burst" aria-hidden="true"><svg viewBox="0 0 400 400"><path d="M200 0C211 178 222 187 400 200C222 211 211 222 200 400C189 222 178 211 0 200C178 189 189 178 200 0Z"/></svg><i></i></div><div class="rr-lottery-result-motes" aria-hidden="true">${Array.from({length:8},(_,index)=>`<i style="--mote-angle:${index*20}deg;--mote-distance:${110+index%4*15}px;--mote-delay:${index%5*.06}s"></i>`).join('')}</div>`;
}

export function restaurantResearchRevealMarkup(draw){
  return `<section class="rr-discovery"><header class="rr-discovery-heading"><span>RECIPE ATELIER · ${draw}</span><h2 id="rr-discovery-title">星光里的美味灵感</h2><p>让每一片灵感，成为新的拿手料理</p></header><button class="rr-discovery-close" data-rr-discovery-close aria-label="关闭灵感翻卡">×</button><div class="rr-discovery-center">${restaurantLotteryEffects()}<div class="rr-discovery-halo" aria-hidden="true"></div><span class="rr-discovery-star rr-discovery-star-one" aria-hidden="true">✧</span><span class="rr-discovery-star rr-discovery-star-two" aria-hidden="true">✦</span><button class="rr-discovery-card" data-rr-flip aria-label="灵感正在研发中" disabled><span class="rr-card-flipper"><span class="rr-card-face rr-card-back" aria-hidden="true"><small>小爪爪的灵感手札</small><span class="rr-card-orbit"><span class="rr-card-seal">${paw}</span></span><strong>美味的秘密</strong><em>等待一双小爪爪揭晓</em><i>✦ &nbsp; RECIPE NOTES &nbsp; ✦</i></span><span class="rr-card-face rr-card-front rr-quality-card" data-rr-result aria-hidden="true"></span></span></button><p class="rr-discovery-message" role="status" aria-live="polite" data-rr-message>小爪爪的美味灵感，正在向中心汇聚…</p></div><div class="rr-discovery-kitchen" aria-hidden="true"><div class="rr-discovery-shelf"><span>✦</span><i></i><i></i><i></i><span>✦</span></div><div class="rr-lab-worker rr-lab-worker-chef"><span class="r-cat r-cat-chef"></span><span class="rr-lab-spoon"></span></div><div class="rr-lab-stove"><span class="rr-lab-steam"><i></i><i></i><i></i></span><span class="rr-lab-pot"></span><span class="rr-lab-flame"></span></div><div class="rr-lab-worker rr-lab-worker-writer"><span class="r-cat r-cat-waiter"></span><span class="rr-lab-pencil"></span></div><span class="rr-lab-notebook"><i></i></span><div class="rr-lab-counter"></div><p>小爪爪研发中 <span>· · ·</span></p></div><footer class="rr-discovery-footer"><section class="rr-wait-prompt" data-rr-wait-prompt role="group" aria-label="研发等待提示" hidden><h3>菜品仍在研发中</h3><p>结果还在确认，请稍候。你可以先去经营，也可以留在这里等待。</p><div><button data-rr-wait-leave>先去经营</button><button data-rr-wait-continue>继续等待</button></div></section><button class="rr-discovery-confirm" data-rr-discovery-confirm disabled>灵感汇聚中<span class="rr-brewing-dots"> · · ·</span></button><small data-rr-discovery-note>30 灵感 · 一次新的美味发现</small></footer></section>`;
}

/** Only a matching, accepted draw supplies the face. Flipping and dismissing
 * are local presentation, and never dispatch, reroll, or spend inspiration. */
export function restaurantResearchRevealResult(info,draw){
  const card=info.research.lastDraw;
  if(!card||card.draw!==draw)return null;
  const recipe=info.recipes.find(recipe=>recipe.id===card.recipeId);
  return recipe?{card:{...card},recipe:{...recipe},grade:restaurantDishGrade(recipe.level)}:null;
}

export function restaurantResearchRevealFace({card,recipe,grade}){
  const ready=recipe.upgradeCost!==null&&recipe.fragments>=recipe.upgradeCost,surplus=restaurantFragmentSurplus(recipe);
  return `<small class="rr-discovery-quality">${grade} 级菜谱 · ${recipe.level===5?'满阶余片可融合':ready?'灵感集齐':'美味积累中'}</small><span class="rr-discovery-dish">${restaurantQualityFood(recipe.id,grade,food)}</span><strong class="rr-discovery-name">${esc(recipe.name)}</strong><span class="rr-discovery-fragments"><i aria-hidden="true">✦</i> 菜谱碎片 <b>×${card.amount}</b></span><span class="rr-discovery-progress">${recipe.upgradeCost===null?`多余 ${surplus.surplus} 枚 · 可融合 ${surplus.surplus*surplus.fusionValue} 灵感`:`已收集 ${recipe.fragments} / ${recipe.upgradeCost} 枚`}</span><em class="rr-discovery-caption">${surplus.surplus?'多余碎片，可以在手账里再次发光':ready?recipe.researchUnlocked?'新的品质，就差最后一步':'带着灵感，等待小馆再长大一点':'每一片灵感，都离美味更近一点'}</em>`;
}

const BREW_MS=700,READY_MS=180,FLIP_MS=420,WAIT_NOTICE_MS=4000;

export function createRestaurantResearchReveal({dialog,schedule=setTimeout,unschedule=clearTimeout,now=Date.now,reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,onPhaseChange=()=>{},onDeferred=()=>{},getInfo=restaurantInfo}){
  let active=null,restoreFocus=null;
  const timers=new Set();
  const $=selector=>dialog.querySelector(selector);
  function later(callback,ms){const session=active,id=schedule(()=>{timers.delete(id);if(active===session&&dialog.open)callback();},ms);timers.add(id);return id;}
  function clearTimers(){for(const id of timers)unschedule(id);timers.clear();}
  function stage(value){if(dialog.dataset.rrPhase===value)return;dialog.dataset.rrPhase=value;if(active)active.phaseAt=now();onPhaseChange(value);}
  function clearWait(){if(active?.waitTimer!==undefined){unschedule(active.waitTimer);timers.delete(active.waitTimer);delete active.waitTimer;}}
  function hideWaitPrompt(){
    const prompt=$('[data-rr-wait-prompt]');
    const focused=prompt.contains?.(document.activeElement);
    prompt.hidden=true;$('[data-rr-discovery-confirm]').hidden=false;
    if(focused)$('[data-rr-discovery-confirm]').focus({preventScroll:true});
  }
  function wait(){
    if(!active||active.result)return;
    stage('waiting');
    $('[data-rr-message]').textContent=active.connected===false?'菜品仍在研发中，连接恢复后会继续确认，请稍候…':'菜品仍在研发中，敬请等待…';
    $('[data-rr-discovery-note]').textContent='结果确认后会自动揭晓 · 可随时先去经营';
    const remaining=Math.max(0,WAIT_NOTICE_MS-(now()-active.startedAt));
    if(!active.waitNoticed){
      if(!remaining){active.waitNoticed=true;clearWait();$('[data-rr-wait-prompt]').hidden=false;$('[data-rr-discovery-confirm]').hidden=true;}
      else if(active.waitTimer===undefined)active.waitTimer=later(()=>{delete active.waitTimer;advance();},remaining);
    }
  }
  // Timers drive the short performance; normal state ticks also reconcile the
  // clock after a suspended tab or a missed callback. Neither path rolls a card.
  function advance(){
    if(!active||!dialog.open||dialog.dataset.rrPhase==='error')return;
    if(!active.brewed&&now()-active.startedAt>=(reducedMotion()?0:BREW_MS))active.brewed=true;
    if(!active.brewed)return;
    if(!active.result){wait();return;}
    ready();
    if(dialog.dataset.rrPhase==='ready'&&now()-active.phaseAt>=(reducedMotion()?0:READY_MS))flip();
    if(dialog.dataset.rrPhase==='flipping'&&now()-active.phaseAt>=(reducedMotion()?0:FLIP_MS))finish();
  }
  function ready(){
    if(!active?.result||!active.brewed||active.revealing)return;
    if(dialog.dataset.rrPhase==='ready')return;
    stage('ready');$('[data-rr-flip]').disabled=false;$('[data-rr-flip]').setAttribute('aria-label','翻开这张灵感卡');
    $('[data-rr-discovery-confirm]').disabled=false;$('[data-rr-discovery-confirm]').textContent='立即揭晓';
    $('[data-rr-message]').textContent='流光凝聚，新的美味灵感即将揭晓…';
    clearWait();hideWaitPrompt();active.autoReveal=later(flip,reducedMotion()?0:READY_MS);
  }
  function finish(){
    if(!active?.result||dialog.dataset.rrPhase!=='flipping')return;
    clearTimers();
    stage('revealed');const {card,recipe,grade}=active.result;
    dialog.dataset.rQuality=grade;$('[data-rr-result]').setAttribute('aria-hidden','false');
    $('[data-rr-flip]').setAttribute('aria-label',`${recipe.name}，${grade} 级菜谱碎片 ${card.amount} 枚`);
    $('[data-rr-discovery-confirm]').disabled=false;$('[data-rr-discovery-confirm]').textContent=active.preview?'完成预览，返回终端':'收好碎片，继续研发';
    $('[data-rr-message]').textContent=`${recipe.name}的美味灵感 +${card.amount}`;
    $('[data-rr-discovery-note]').textContent=active.preview?'只看翻牌效果 · 不消耗灵感，不增加碎片':'碎片已收进手账 · 翻牌不会再次消耗灵感';
  }
  function flip(){
    if(!active?.result||dialog.dataset.rrPhase!=='ready')return;
    if(active.autoReveal!==undefined){unschedule(active.autoReveal);timers.delete(active.autoReveal);delete active.autoReveal;}
    active.revealing=true;stage('flipping');$('[data-rr-discovery-confirm]').disabled=true;
    $('[data-rr-flip]').disabled=true;$('[data-rr-message]').textContent='小爪爪的研究成果，揭晓！';
    later(finish,reducedMotion()?0:FLIP_MS);
  }
  function closed(){
    if(dialog.open)return;
    const wasActive=!!active;
    clearTimers();active=null;dialog.innerHTML='';delete dialog.dataset.rQuality;delete dialog.dataset.rrPhase;
    if(wasActive)onPhaseChange('closed');
    if(restoreFocus?.isConnected&&!restoreFocus.disabled)restoreFocus.focus({preventScroll:true});restoreFocus=null;
  }
  function close(){if(dialog.open)dialog.close();closed();}
  function leave(){const draw=active&&!active.result?active.draw:null;close();if(draw!==null)onDeferred(draw);}
  function click(event){
    if(event.target.closest('[data-rr-discovery-close]')){close();return;}
    if(event.target.closest('[data-rr-wait-leave]')){if(active&&!active.result&&active.waitNoticed)leave();return;}
    if(event.target.closest('[data-rr-wait-continue]')){if(active&&!active.result&&active.waitNoticed)hideWaitPrompt();return;}
    if(event.target.closest('[data-rr-flip]'))flip();
    if(event.target.closest('[data-rr-discovery-confirm]')){if(['brewing','waiting'].includes(dialog.dataset.rrPhase))leave();else if(['revealed','error'].includes(dialog.dataset.rrPhase))close();else flip();}
  }
  function cancel(event){event.preventDefault();event.stopPropagation();close();}
  dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);
  return {
    start(draw){
      if(dialog.open)return false;
      clearTimers();restoreFocus=document.activeElement;active={draw,startedAt:now(),brewed:false,result:null,revealing:false};
      delete dialog.dataset.rQuality;stage('brewing');dialog.innerHTML=restaurantResearchRevealMarkup(draw);dialog.showModal();
      $('[data-rr-discovery-confirm]').disabled=false;$('[data-rr-discovery-confirm]').textContent='先去经营，稍后看结果';
      $('[data-rr-discovery-note]').textContent='探索已记下 · 可随时返回经营，结果会收进手账';
      $('[data-rr-discovery-close]').focus({preventScroll:true});
      later(advance,reducedMotion()?0:BREW_MS);
      return true;
    },
    // Pending ticks need only the receipt number, not a complete restaurant
    // projection or a redraw of the covered kitchen and recipe panels.
    syncState(state,availability={}){
      if(!active||dialog.dataset.rrPhase==='error')return;
      if(active.result){advance();return;}
      const lastDraw=state.restaurant?.research?.lastDraw;
      this.sync(lastDraw?.draw===active.draw?getInfo(state):{research:{lastDraw},recipes:[]},availability);
    },
    sync(info,availability={}){
      if(!active||dialog.dataset.rrPhase==='error')return;
      if(active.result){advance();return;}
      active.connected=availability.connected;
      const result=restaurantResearchRevealResult(info,active.draw);
      if(result){
        active.result=result;clearWait();const front=$('[data-rr-result]');front.dataset.rQuality=result.grade;front.innerHTML=restaurantResearchRevealFace(result);advance();return;
      }
      if(info.research.lastDraw?.draw>active.draw)this.fail('手账已收到更新的灵感，请返回查看最新记录。');
      else if(availability.refusedResearchDraw===active.draw)this.fail('这次探索未能完成，请按手账中的最新灵感继续。');
      else advance();
    },
    preview(grade,info){
      const level=RESTAURANT_DISH_GRADES.indexOf(grade)+1,recipe=info.recipes.find(recipe=>recipe.id==='rice');
      if(!level||!recipe||!this.start(info.research.nextDraw))return false;
      active.preview=true;
      this.sync({research:{lastDraw:{draw:active.draw,recipeId:recipe.id,amount:3}},recipes:[{...recipe,level,grade,fragments:3,upgradeCost:restaurantResearchCost(level)}]});
      $('.rr-discovery-heading>span').textContent='RECIPE ATELIER · 翻卡预览';
      $('[data-rr-discovery-note]').textContent='只看翻牌效果 · 不消耗灵感，不增加碎片';
      return true;
    },
    fail(message='这次探索没有开始，灵感还在手账里。'){
      if(!active)return;clearTimers();hideWaitPrompt();stage('error');$('[data-rr-message]').textContent=message;
      $('[data-rr-discovery-confirm]').disabled=false;$('[data-rr-discovery-confirm]').textContent='返回研发室';
      $('[data-rr-discovery-note]').textContent='可以稍后查看手账中的最新记录';
    },
    close,
    reset(){restoreFocus=null;close();},
    destroy(){restoreFocus=null;close();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);},
  };
}
