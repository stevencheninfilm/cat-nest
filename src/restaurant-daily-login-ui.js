const giftImage=new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/daily-login-v1/daily-gift.webp`,globalThis.document?.baseURI||import.meta.url).href;
export const restaurantDailyLoginMarkup=()=>`<button class="rdl-entry" data-r-daily-open aria-label="每日开店礼，领取 300 小鱼干" hidden><span aria-hidden="true">✦</span><strong>每日礼</strong><i></i></button>`;
export const restaurantDailyLoginDialog=()=>`<dialog class="rdl-dialog" aria-labelledby="rdl-title" aria-describedby="rdl-description"><button class="rdl-close" data-r-daily-close aria-label="关闭每日开店礼">×</button><small class="rdl-eyebrow">A LITTLE GIFT, EVERY DAY</small><h2 id="rdl-title">每日开店礼</h2><p id="rdl-description">今天也来开小馆呀</p><div class="rdl-art"><div class="rdl-halo" aria-hidden="true"></div><img src="${giftImage}" width="768" height="512" alt="圆滚滚的小厨师，抱着装满小鱼金币的礼物袋" draggable="false"></div><div class="rdl-reward"><span aria-hidden="true">✦</span><strong>+300</strong><span>小鱼干</span></div><p class="rdl-wallet-note">也为小窝添上 300 金币</p><p class="rdl-message" data-r-daily-message role="status" aria-live="polite"></p><button class="rdl-claim" data-r-daily-claim>领取 300 小鱼干</button><p class="rdl-rule">每天北京时间 00:00 刷新<br>同一小窝，两位主人共享一份</p></dialog>`;

/** Currency always comes from saved state. A submitted claim can remain in
 * the durable queue while this popup closes and ordinary play continues. */
export function createRestaurantDailyLogin({dialog,entry,onAction,onCollect=()=>{},onClick=()=>{},preferences=null}){
  let info=null,availability={},shownDay=null,submittedDay=null,pendingDay=null,restoreFocus=null,paintKey='',failed=false;
  const $=selector=>dialog.querySelector(selector);
  function paint(){
    if(!info)return;
    const waiting=pendingDay!==null&&!info.claimed,success=info.claimed&&submittedDay===info.day;
    const key=JSON.stringify([info.day,info.claimed,waiting,success,availability.ready,availability.connected,availability.retrying,failed]);
    entry.hidden=false;entry.dataset.state=info.claimed?'claimed':waiting?'pending':'available';
    entry.setAttribute('aria-label',info.claimed?'每日开店礼，今日已领取':waiting?'每日开店礼，等待同步':'每日开店礼，领取 300 小鱼干');
    if(key===paintKey)return;paintKey=key;
    dialog.dataset.state=info.claimed?'claimed':waiting?'pending':'available';
    $('[data-r-daily-message]').textContent=info.claimed?(success?'300 小鱼干已到账，开店加油！':'今天的礼物已经领取，明天再来呀'):waiting?(availability.retrying||!availability.connected?'已排队，联网后自动领取':'礼物正在送达…'):failed?'未能领取，请重试；奖励仍为你保留。':'';
    const button=$('[data-r-daily-claim]');
    button.disabled=waiting||(!info.claimed&&availability.ready===false);
    button.textContent=info.claimed?(success?'开心收下':'好，明天再来'):waiting?'正在领取…':'领取 300 小鱼干';
  }
  function open(){
    if(!info||dialog.open)return;
    shownDay=info.day;
    try{preferences?.setItem('catnest.restaurant.dailyGiftSeen',String(info.day));}catch{}
    restoreFocus=globalThis.document?.activeElement;paint();dialog.showModal();
    $('[data-r-daily-claim]').disabled?$('[data-r-daily-close]').focus({preventScroll:true}):$('[data-r-daily-claim]').focus({preventScroll:true});
  }
  function close(){if(dialog.open)dialog.close();}
  function closed(){if(restoreFocus?.isConnected&&!restoreFocus.disabled)restoreFocus.focus({preventScroll:true});restoreFocus=null;}
  function click(event){
    if(event.target.closest('[data-r-daily-close]')){event.stopPropagation();onClick();close();return;}
    if(!event.target.closest('[data-r-daily-claim]'))return;
    event.stopPropagation();
    if(info?.claimed){onClick();close();return;}
    if(!info||pendingDay!==null||availability.ready===false)return;
    onClick();submittedDay=info.day;pendingDay=info.day;failed=false;paint();
    if(onAction({type:'restaurant-daily-login',day:info.day})===false){pendingDay=null;submittedDay=null;failed=true;paint();}
  }
  function cancel(event){event.preventDefault();event.stopPropagation();close();}
  function keydown(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}
  function backdrop(event){if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}
  dialog.addEventListener('click',click);dialog.addEventListener('click',backdrop);dialog.addEventListener('cancel',cancel);dialog.addEventListener('keydown',keydown);dialog.addEventListener('close',closed);
  return {
    sync(next,available,{autoShow=true}={}){
      info=next;availability=available;
      const queuedDay=available.pendingDailyLoginDay??null;
      if(queuedDay!==null){pendingDay=queuedDay;submittedDay??=queuedDay;}
      if(info.claimed&&pendingDay!==null){if(pendingDay===info.day)onCollect();pendingDay=null;}
      else if(pendingDay!==null&&queuedDay===null&&available.savePhase==='error'){pendingDay=null;failed=true;}
      // A stale day's request is rejected rather than consuming today's gift.
      if(submittedDay!==null&&submittedDay!==info.day&&pendingDay===null){submittedDay=null;failed=false;}
      paint();
      let seen=null;try{seen=Number(preferences?.getItem('catnest.restaurant.dailyGiftSeen'));}catch{}
    if(autoShow&&(available.ready??available.connected)!==false&&info.available&&shownDay!==info.day&&seen!==info.day)open();
    },open,close,
    reset(){restoreFocus=null;close();},
    destroy(){restoreFocus=null;close();dialog.removeEventListener('click',click);dialog.removeEventListener('click',backdrop);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('keydown',keydown);dialog.removeEventListener('close',closed);},
  };
}
