import { getCoupleProfile } from './couple-profile.js';
import { homeBinding, homeInviteUrl, isNewPet } from './home-bond.js';
import { normalizeAppearance } from './mage-cat-config.js';
import { catExpressionPortrait } from './cat-expressions.js';

const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadGuide(storage, role) {
  try { const value=JSON.parse(storage.getItem(`catnest.onboarding.v2.${role}`));return value?.version===2 && ['name','care','claim','invite','done'].includes(value.step) ? value : null; } catch { return null; }
}
export function invitationModel({state,members,known,ready,role}) {
  const binding=homeBinding(state,members,known);
  return {...binding,ready,role,owners:binding.owners.map(owner=>({...owner,label:!ready ? '同步后确认' : !owner.joined ? '等待加入' : owner.online===null ? '已加入 · 状态同步中' : `已加入 · ${owner.online?'在线':'离线'}`}))};
}
export function invitationMarkup(model,{isTest=false,copied=false,error='',url='',finished=false}={}) {
  const cards=`<div class="onboarding-pair" aria-label="双人绑定状态">${model.owners.map(owner=>`<div class="onboarding-owner ${owner.id} ${owner.joined&&model.ready?'is-joined':''}"><span aria-hidden="true">${owner.id==='male'?'👦🏻':'👧🏻'}</span><strong>${owner.name}${owner.id===model.role?' · 我':''}</strong><small>${esc(owner.label)}</small></div>`).join('')}<span class="onboarding-pair-heart" aria-hidden="true">♡</span></div><p class="onboarding-binding" role="status">${!model.ready?'正在确认主人信息…':model.complete?'两位主人已加入，同一只小猫一起养':`${model.count}/2 位主人已加入 · 等另一位回家`}</p>`;
  if(finished&&model.complete)return cards+'<p class="onboarding-note">以后每一份陪伴，都留在同一只小猫身边。</p>';
  const info=isTest?'<p class="onboarding-note">这里是演示小窝，另一位主人由系统模拟。</p>':`<p class="onboarding-note">对方打开链接，选择${model.role==='male'?'女方':'男方'}，就能加入同一个小窝。</p><label class="onboarding-link-label" for="onboarding-invite-url">邀请链接</label><input id="onboarding-invite-url" class="onboarding-link" value="${esc(url)}" readonly/>`;
  const actions=isTest?'<button type="button" class="onboarding-primary" data-onboarding="simulate">试试另一位主人加入</button>':'<button type="button" class="onboarding-primary" data-onboarding="copy">复制邀请链接</button><button type="button" class="onboarding-secondary" data-onboarding="share">分享给另一位主人</button>';
  return cards+info+`<div class="onboarding-invite-actions">${actions}</div><p class="onboarding-feedback" aria-live="polite">${esc(error || (copied?'链接已复制，对方实际加入后会更新绑定状态。':''))}</p>`;
}

/** The guide uses ordinary actions and confirmed receipts; it never seeds a room. */
export function createOnboarding({storage,preferences=storage,home,baseUrl,getContext,dispatch,greet,toast=()=>{},returning=false,isTest=false,testActions,onClose=()=>{},onComplete=()=>{},autoStart=true}) {
  const dialog=document.createElement('dialog');dialog.className='onboarding-dialog';dialog.setAttribute('aria-labelledby','onboarding-title');
  document.body.append(dialog);
  let role,progress,pending=null,draft='',appearance,created=false,view='guide',error='',copied=false,signature='',joinPending=false,autoQueued=false,lastRole;
  const remember=()=>{if(role&&progress)storage.setItem(`catnest.onboarding.v2.${role}`,JSON.stringify(progress));};
  const complete=()=>{progress={...progress,step:'done',paused:false};remember();preferences.setItem('onboarding.v2.completed','done');dialog.close();onComplete();};
  function model() { return invitationModel(getContext()); }
  function render(force=false) {
    if(!dialog.open&&!force)return;
    const context=getContext(),binding=model(),step=progress?.step||'name';
    const careType=context.canCare('pet')?'pet':context.canCare('play')?'play':'greet';
    dialog.setAttribute('data-step',step);
    const nextSignature=JSON.stringify([view,step,Boolean(pending),error,copied,careType,binding.owners.map(o=>o.label),context.connected]);
    if(nextSignature===signature&&!force)return;signature=nextSignature;
    const focused=dialog.contains(document.activeElement)&&document.activeElement?.id==='onboarding-name';
    const selection=focused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
    const index=['name','care','claim','invite'].indexOf(step);
    let content='';
    if(view==='invite'||step==='invite') {
      content=`<p class="onboarding-eyebrow">A HOME FOR TWO</p><h2 id="onboarding-title">${binding.complete?'两个人的小窝，凑齐了':'把另一位主人请回家'}</h2>${invitationMarkup(binding,{isTest,copied,error,url:homeInviteUrl(home,baseUrl,role),finished:view==='guide'})}<button type="button" class="${binding.complete?'onboarding-primary':'onboarding-text'}" data-onboarding="finish">${binding.complete?'开始一起养猫':'先陪小猫，稍后再邀请'}</button>`;
    } else if(step==='name') {
      content=`<p class="onboarding-eyebrow">一分钟，和小猫熟起来</p><h2 id="onboarding-title">${created?'领养你的第一只小猫':`认识一下，${esc(context.state.name)}`}</h2><p class="onboarding-description">${created?'先给它取个名字，我们就有家啦。':'这是你们的小猫，原来的成长会一直保留。'}</p><form id="onboarding-name-form"><label for="onboarding-name">小猫的名字</label><input id="onboarding-name" name="name" value="${esc(draft)}" required maxlength="16" autocomplete="off"/>${created?`<div class="onboarding-looks" role="group" aria-label="小猫毛色">${[[2,'奶油白','#eee7dc'],[4,'可可棕','#754637'],[0,'午夜黑','#383744']].map(([body,label,color])=>`<button type="button" data-onboarding-body="${body}" aria-pressed="${appearance.body===body}" style="--fur:${color}"><i aria-hidden="true"></i>${label}</button>`).join('')}</div>`:''}<button class="onboarding-primary" type="submit" ${pending||!context.connected?'disabled':''}>${pending?'正在保存小名字…':created?'取好名字，一起回家':'就叫这个名字'}</button></form><p class="onboarding-feedback" role="status">${esc(error||(!context.connected?'正在连接小窝，小名字会在连接后保存。':''))}</p>`;
    } else {
      const claiming=step==='claim';
      content=`<p class="onboarding-eyebrow">${claiming?'把第一份爱，留在成长里':'它已经认识你啦'}</p><h2 id="onboarding-title">${claiming?'收下这颗成长心':careType==='play'?'陪小猫玩一下':careType==='greet'?'和它打个招呼':'轻轻摸摸它'}</h2><p class="onboarding-description">${claiming?'照顾会产生爱心，收下后才计入成长。':careType==='greet'?'照顾次数恢复前，也可以和小猫打声招呼。':'点一下，看看小猫怎么回应你。'}</p><button type="button" class="onboarding-touch" data-onboarding="${claiming?'claim':'care'}" ${pending||!context.connected?'disabled':''}><span aria-hidden="true">${claiming?'💛':careType==='play'?'🪄':'🤍'}</span>${pending?'正在记住这份陪伴…':claiming?'收下成长，邀请主人':careType==='play'?'逗逗小猫':careType==='greet'?'轻轻打个招呼':'摸摸小猫'}</button><p class="onboarding-feedback" role="status">${esc(error||(!context.connected?'正在连接小窝…':''))}</p>`;
    }
    dialog.innerHTML=`<button type="button" class="onboarding-close" data-onboarding="pause" aria-label="暂时关闭新手引导">×</button>${view==='guide'?`<div class="onboarding-progress" aria-label="新手引导进度">${['认识小猫','第一次互动','一起养猫'].map((label,i)=>`<span class="${i<=(index===3?2:index>0?1:0)?'is-current':''}">${i+1} ${label}</span>`).join('')}</div>`:''}<div class="onboarding-portrait">${catExpressionPortrait('happy')}</div>${content}${view==='guide'&&step!=='invite'?'<button type="button" class="onboarding-text" data-onboarding="pause">先自己逛逛</button>':''}`;
    if(focused){const input=dialog.querySelector('#onboarding-name');input?.focus({preventScroll:true});if(selection)input?.setSelectionRange(...selection);}
  }
  function start({restart=false,invite=false}={}) {
    const context=getContext();if(!context.entered||!context.ready){toast('先选择身份，连上小窝后就能开始');return;}
    role=context.role;
    progress=restart?null:loadGuide(storage,role);
    if(!progress||progress.step==='done')progress={version:2,step:invite?'done':'name',paused:invite};
    progress.paused=false;pending=null;draft=context.state.name;appearance=normalizeAppearance(context.state.appearance);created=isNewPet(context.state);error='';copied=false;view=invite?'invite':'guide';signature='';if(!invite)remember();
    document.querySelector('#modal[open]')?.close();
    render(true);if(!dialog.open)dialog.showModal();
  }
  function send(action) {
    if(pending)return;
    pending=action;error='';render();
    if(!dispatch(action)){pending=null;error='这次还没完成，请稍后重试。';render();}
  }
  function pause() { if(pending){toast('这次操作还在保存，请稍等一下');return;}if(progress){progress.paused=true;remember();}dialog.close(); }
  function sync() {
    const context=getContext();if(!context.entered||!context.ready)return;
    if(lastRole!==context.role){lastRole=context.role;joinPending=false;if(dialog.open)dialog.close();role=context.role;progress=loadGuide(storage,role);}
    const binding=homeBinding(context.state);
    if(context.connected&&!joinPending&&!binding.owners.find(owner=>owner.id===context.role)?.joined){
      joinPending=true;queueMicrotask(()=>{if(!dispatch({type:'join-home'}))joinPending=false;});
    }
    if(autoStart&&context.available!==false&&!autoQueued&&!dialog.open&&!returning&&!progress?.paused&&progress?.step!=='done'&&preferences.getItem('onboarding.v2.completed')!=='done') {
      autoQueued=true;queueMicrotask(()=>{if(!document.querySelector('dialog[open]'))start();else autoQueued=false;});
    }
    render();
  }
  function confirmed(action,actor,metadata={}) {
    if(action.type==='join-home'){if(actor.id===getCoupleProfile(getContext().role)?.clientId)joinPending=false;sync();return;}
    if(!pending||actor.id!==getCoupleProfile(role)?.clientId||metadata.optimistic||JSON.stringify(action)!==JSON.stringify(pending))return;
    pending=null;error='';
    if(['adopt-cat','rename'].includes(action.type))progress.step='care';
    else if(['pet','play'].includes(action.type)) {
      const rewards=getContext().state.pendingGrowth||[];
      const reward=rewards.find(item=>item.id===metadata.operationId)||[...rewards].reverse().find(item=>item.actorId===actor.id&&item.kind===action.type);
      progress={...progress,step:reward?'claim':'invite',rewardId:reward?.id};
    } else if(action.type==='claim-growth')progress.step='invite';
    remember();render();
  }
  async function invite(kind) {
    error='';
    if(kind==='simulate'){testActions?.invitePartner(role);render(true);return;}
    const url=homeInviteUrl(home,baseUrl,role);
    try {
      if(kind==='share'&&navigator.share){await navigator.share({title:`一起来陪${getContext().state.name}`,text:`我是${getCoupleProfile(role).name}，来当小猫的另一位主人吧。`,url});copied=false;toast('邀请已分享，等待对方实际加入');}
      else {if(!navigator.clipboard?.writeText)throw new Error('复制不可用，请长按上面的邀请链接复制。');await navigator.clipboard.writeText(url);copied=true;}
    } catch(cause) { if(cause.name!=='AbortError')error=cause.message||'分享未完成，请复制邀请链接。'; }
    render();
  }
  dialog.addEventListener('input',event=>{if(event.target.id==='onboarding-name')draft=event.target.value;});
  dialog.addEventListener('submit',event=>{
    if(event.target.id!=='onboarding-name-form')return;event.preventDefault();
    const name=draft.trim();if(!name||[...name].length>16||/[\u0000-\u001f\u007f]/.test(name)){error='给小猫取一个 1–16 字的名字吧';render();return;}
    if(created&&!isNewPet(getContext().state)){created=false;draft=getContext().state.name;error='伙伴刚刚给小猫取好了名字，已经为你同步。';render(true);return;}
    if(created)send({type:'adopt-cat',name,appearance});
    else if(name!==getContext().state.name)send({type:'rename',name});
    else {progress.step='care';remember();render();}
  });
  dialog.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target||target.disabled)return;
    if(target.dataset.onboardingBody!==undefined){appearance={...appearance,body:Number(target.dataset.onboardingBody)};render(true);return;}
    const action=target.dataset.onboarding;
    if(action==='pause'){pause();return;}if(action==='finish'){if(view==='guide')complete();else dialog.close();return;}
    if(['copy','share','simulate'].includes(action)){invite(action);return;}
    if(action==='care') {
      const context=getContext(),type=['pet','play'].find(type=>context.canCare(type));
      if(type)send({type});else {greet();progress.step='invite';remember();toast('这会儿先打个招呼，照顾次数恢复后再来 ♡');render();}
    }
    if(action==='claim') {
      if(getContext().state.pendingGrowth?.some(reward=>reward.id===progress.rewardId))send({type:'claim-growth',rewardId:progress.rewardId});
      else {progress.step='invite';remember();render();}
    }
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();pause();});
  dialog.addEventListener('close',onClose);
  return {sync,start,confirmed,isOpen:()=>dialog.open,fail(message){if(pending){pending=null;error=message;render();}},destroy(){dialog.remove();}};
}
