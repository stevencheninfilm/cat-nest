import { STAFF_IDLE_RECOVERY_MS } from './restaurant-staff-training.js';
import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { createRestaurantRecipeCelebration } from './restaurant-recipe-celebration.js';
import { createRestaurantDailyLogin, restaurantDailyLoginMarkup, restaurantDailyLoginDialog } from './restaurant-daily-login-ui.js';
import { createRestaurantResearchReveal } from './restaurant-research-reveal.js';
import { createRestaurantAudioUI, restaurantAudioIcon, restaurantAudioMarkup } from './restaurant-audio-ui.js';
import { createRestaurantGuide } from './restaurant-guide.js';
import { restaurantActionSound } from './restaurant-audio.js';
import { createRestaurantResearchShowcase, restaurantResearchShortcut } from './restaurant-research-hero.js';
import { restaurantResearchPanel } from './restaurant-research-ui.js';
import { restaurantQualityAttributes } from './restaurant-order-tiers-ui.js';
import { restaurantCustomersPanel, restaurantCustomerDetail } from './restaurant-customers-ui.js';
import { restaurantInfo, restaurantActionResult, RESTAURANT_RECIPE_CATEGORIES, RESTAURANT_STAFF } from './restaurant.js';
import { levelInfo } from './state.js';
import { KITCHEN_FLOWS } from './restaurant-kitchen.js';
import { restaurantGuestTables, restaurantTerminalPanel, createRestaurantGuests } from './restaurant-guests-ui.js';
import { createRestaurantArrivalRhythm } from './restaurant-street.js';
import { restaurantStreetMarkup, createRestaurantStreet } from './restaurant-street-ui.js';
import { kitchenSceneMarkup, kitchenFlowPanel, createKitchenScene } from './restaurant-kitchen-ui.js';
import { kitchenGuideMarkup, paintKitchenTerminal } from './restaurant-kitchen-terminal.js';
import { restaurantRecipeMenuOrder } from './restaurant-recipe-order.js';
import { restaurantRecipePreview, restaurantRecipeDetailMarkup } from './restaurant-recipe-detail.js';
import { kitchenWorkflowBoardMarkup, paintKitchenWorkflowBoard } from './restaurant-kitchen-board.js';
import { kitchenCirclePalette, kitchenPaletteMarkup } from './restaurant-kitchen-colors.js';
import { restaurantDecorationsPanel, decorationBuffLabels, decorationSceneMarkup, createRestaurantDecorationScene } from './restaurant-decor-ui.js';
import { goldWalletMarkup, goldPrice, restaurantTrainingPanel, restaurantGoldPanel, premiumThemesMarkup, premiumSceneMarkup, paintPremiumScene, preloadPremiumScene, specialRecipeCardsMarkup } from './restaurant-economy-ui.js';
import { createRestaurantStaffDebugger } from './restaurant-staff-terminal.js';
import { restaurantResourceLevel } from './restaurant-progression.js';
import { restaurantProgressionPanel, progressionEntryMarkup } from './restaurant-progression-ui.js';
import { createRestaurantExperience } from './restaurant-experience-ui.js';
import { restaurantFacilityCards, restaurantUpgradeHelp } from './restaurant-upgrade-ui.js';
import { restaurantTipsMultiplier, restaurantTableIncomeMultiplier } from './restaurant-facilities.js';
import { applyRestaurantGrowthStage, restaurantStageStars } from './restaurant-growth-stage-ui.js';
import { restRoomSceneMarkup, restaurantRestRoomPanel, paintRestaurantStaffRest } from './restaurant-staff-rest-ui.js';

const asset = file => new URL(`${import.meta.env?.BASE_URL || './'}assets/restaurant/${file}`, globalThis.document?.baseURI || import.meta.url).href;
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value).toLocaleString('zh-CN');
// Loaded homes can queue through a lost connection. Another write is not a lock.
export const restaurantInputBlocked = availability => !(availability.ready ?? availability.connected);
export function restaurantSaveLabel(availability,isTest=false){
  if(restaurantInputBlocked(availability))return '正在读取小馆…';
  if(!availability.connected||availability.savePhase==='queued'&&availability.retrying)return '操作已暂存 · 自动重试中';
  if(availability.savePhase==='error')return '保存未完成，请查看提示';
  return isTest?'测试小馆 · 刷新恢复默认':'与小窝同步';
}
const paths = {
  back:'<path d="m14 6-6 6 6 6M8 12h12"/>',
  fish:'<path d="M17 12c-4-8-12-6-15 0 3 6 11 8 15 0Zm0 0 5-5v10l-5-5Z"/><circle cx="7" cy="11" r=".8"/>',
  star:'<path d="m12 2 3 6.2 7 .9-5 4.9 1.2 7-6.2-3.3L5.8 21 7 14l-5-4.9 7-.9L12 2Z"/>',
  store:'<path d="M4 10v10h16V10M3 4h18l-1 6c-1 2-3 2-4 0-1 2-3 2-4 0-1 2-3 2-4 0-1 2-3 2-4 0L3 4Z"/><path d="M9 20v-6h6v6"/>',
  book:'<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/>',
  cat:'<path d="m4 10-1-7 7 4h4l7-4-1 7c5 15-21 15-16 0Z"/><path d="M8 13h.1M16 13h.1m-6 4 2-1 2 1"/>',
  up:'<path d="m3 12 9-9 9 9h-5v9H8v-9H3Z"/>',
  flower:'<path d="M12 8c-8-11-15 2-6 5-8 6 3 14 6 5 3 9 14 1 6-5 9-3 2-16-6-5Z"/><circle cx="12" cy="13" r="3"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 2-1 2m0 3h.01"/>',
  chef:'<path d="M7 14C-2 12 4 2 9 5c3-7 11-3 10 2 7 2 4 9-2 8v6H7v-7Zm0 3h10"/>',
  spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  terminal:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 4 12 8-12 8V4Z"/>',
};
export const restaurantIcon = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.spark}</svg>`;
const food = (id, cls='') => `<span class="r-food r-food-${esc(id)} ${cls}" aria-hidden="true"></span>`;
const cat = (id, cls='') => `<span class="r-cat r-cat-${id} ${cls}" aria-hidden="true"></span>`;
const money = value => `<span class="r-price">${restaurantIcon('fish')}${number(value)}</span>`;
const tabs = [['business','store','营业'],['customers','cat','顾客'],['recipes','book','菜谱'],['staff','cat','员工'],['upgrades','up','升级'],['themes','flower','装扮']];

export function restaurantRecipesPanel(info,{category='all'}={}) {
  const catalog=[...new Map([...info.recipes,...info.specialRecipes].map(recipe=>[recipe.id,recipe])).values()];
  const recipes=restaurantRecipeMenuOrder(catalog.filter(recipe=>category==='all'||recipe.category===category));
  const unlocked=catalog.filter(recipe=>recipe.unlocked&&(!recipe.special||recipe.owned)).length;
  return `<div class="r-catalog-toolbar"><span>已收录 ${unlocked} / ${catalog.length}</span><button data-r-tab="research">✦ 研发室 · ${info.research.availableDraws}</button><button data-r-tab="gold">${restaurantIcon('spark')} 金鱼干</button></div><div class="r-recipe-filters" role="group" aria-label="筛选菜品类别">${['all',...RESTAURANT_RECIPE_CATEGORIES].map(id=>`<button data-r-category="${id}" aria-pressed="${category===id}" ${category===id?'class="selected"':''}>${id==='all'?'全部':id}<small>${id==='all'?catalog.length:catalog.filter(recipe=>recipe.category===id).length}</small></button>`).join('')}</div><div class="r-recipe-grid">${recipes.map(recipe=>{
    if(recipe.special)return specialRecipeCardsMarkup(info,{recipes:[recipe]});
    return `<article class="r-recipe-card rr-quality-card ${recipe.unlocked?'':'is-locked'}" data-r-dish="${recipe.id}" ${restaurantLockedAttributes(!recipe.unlocked)} ${restaurantQualityAttributes(recipe.grade)}>${restaurantRecipePreview(recipe)}<b class="r-recipe-sale"><small>售价</small>${money(Math.round(recipe.price*(1+.3*(recipe.level-1))*restaurantTipsMultiplier(info.restaurant.levels.tips)*restaurantTableIncomeMultiplier(info.restaurant.levels.tables)))}</b>${recipe.unlocked?'':`<span class="r-recipe-availability">${restaurantLockIcon()} Lv.${recipe.unlockLevel} 解锁</span>`}</article>`;
  }).join('')}</div>`;
}

export function restaurantStaffPanel(info,{staffId=null,workerId='worker-1',view='team'}={}) {
  const switcher=`<div class="r-panel-switch" role="group" aria-label="员工面板"><button data-r-tab="staff" aria-pressed="${view==='team'}">伙伴</button><button data-r-tab="training" aria-pressed="${view==='training'}">能力升级</button></div>`;
  if(view==='training')return switcher+restaurantTrainingPanel(info,{workerId});
  const next=RESTAURANT_STAFF[info.restaurant.staff];
  const selected=RESTAURANT_STAFF.find(employee=>employee.id===staffId)||next||RESTAURANT_STAFF.at(-1);
  return `${switcher}<div class="r-staff-count"><strong>猫猫服务队</strong><span>${info.restaurant.staff} / ${RESTAURANT_STAFF.length}</span></div><div class="r-staff-slots">${RESTAURANT_STAFF.map((employee,index)=>`<button class="r-staff-card ${index<info.restaurant.staff?'hired':''} ${index===info.restaurant.staff?'is-next':''} ${selected.id===employee.id?'selected':''}" data-r-staff-preview="${employee.id}" ${restaurantLockedAttributes(index>=info.restaurant.staff)} aria-pressed="${selected.id===employee.id}" aria-label="预览${employee.name}，${employee.role}，${index<info.restaurant.staff?'已入职':index===info.restaurant.staff?'等待加入':'下一位伙伴'}">${cat(employee.sprite)}<strong>${employee.name} · ${employee.role}</strong><small>${index>=info.restaurant.staff?restaurantLockIcon():''}${index<info.restaurant.staff?'已入职':info.level<restaurantResourceLevel('staff',employee.id)?`Lv.${restaurantResourceLevel('staff',employee.id)} 开放`:index===info.restaurant.staff?'等待加入':employee.costCurrency==='goldFish'?goldPrice(employee.cost):`第 ${index+1} 位加入`}</small></button>`).join('')}</div><div class="r-staff-detail" data-r-staff-detail="${selected.id}" ${restaurantLockedAttributes(RESTAURANT_STAFF.indexOf(selected)>=info.restaurant.staff)}>${cat(selected.sprite)}<div><h3>${RESTAURANT_STAFF.indexOf(selected)>=info.restaurant.staff?restaurantLockIcon():''}${selected.name} · ${selected.role}</h3><p>${selected.description}</p></div></div><button class="r-primary r-hire-button" data-r-action="hire" ${!next||!info.hireUnlocked?'disabled':''}>${!next?'伙伴们都到齐啦':!info.hireUnlocked?`雇佣下一位 · ${next.name} · Lv.${info.hireUnlockLevel} 开放`:`雇佣下一位 · ${next.name} ${info.hireCurrency==='goldFish'?goldPrice(info.hireCost):money(info.hireCost)}`}</button>`;
}

export function restaurantUpgradesPanel(info) {
  return restaurantFacilityCards(info);
}

export function restaurantAppearancePanel(info,{view='colors'}={}) {
  const views=[['colors','配色'],['scenes','布置'],['decor','装扮']];
  if(!views.some(([id])=>id===view))view='colors';
  return `<section class="r-appearance" data-r-appearance-view="${view}"><div class="r-panel-switch r-appearance-tabs" role="group" aria-label="装扮分类">${views.map(([id,label])=>`<button data-r-theme-view="${id}" aria-pressed="${view===id}">${label}</button>`).join('')}</div>${view==='colors'?kitchenPaletteMarkup(info):view==='scenes'?restaurantDecorationsPanel(info):premiumThemesMarkup(info)}</section>`;
}

export function restaurantInfoPanel(info,state) {
  return `${restaurantGuideEntryMarkup()}<section class="r-info-stats" aria-label="小馆的营业手账">${[
    ['完成料理',number(info.restaurant.stats.served),'份'],['营业收入',number(info.restaurant.stats.earned),'小鱼干'],
    ['贡献成长',number(info.restaurant.stats.experience),'经验'],['接待容量',info.capacity,'桌'],
    ['在岗伙伴',info.restaurant.staff+1,'位'],['已收录料理',info.recipes.filter(recipe=>recipe.unlocked).length,'道'],
  ].map(([label,value,unit])=>`<div><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`).join('')}</section><section class="r-info-decor" aria-label="已解锁装扮加成"><strong>装扮常驻加成</strong><div class="rd-buffs">${decorationBuffLabels(info.decorationInfo?.activeBuffs).map(label=>`<span>${label}</span>`).join('')}</div></section>${progressionEntryMarkup(info)}<div class="r-info-links"><button data-r-tab="customers">${restaurantIcon('book')} 顾客图鉴</button><button data-r-tab="help">${restaurantIcon('help')} 玩法说明</button><button data-r-tab="gold">${restaurantIcon('spark')} 金鱼干</button></div>`;
}

export function restaurantGuideEntryMarkup(){return `<button class="r-info-guide" data-r-guide-open>${restaurantIcon('book')}<span><strong>餐厅新手引导</strong><small>跟着小猫看实景 · 随时暂停续看</small></span><b aria-hidden="true">›</b></button>`;}

export const restaurantTerminalAllowed=({isTest=false,debugEnabled=isTest}={})=>isTest===true&&debugEnabled===true;
export function restaurantMarkup(state, {isTest=false,debugEnabled=isTest}={}) {
  debugEnabled=restaurantTerminalAllowed({isTest,debugEnabled});
  return `<main class="restaurant" aria-label="猫猫餐厅经营游戏" data-theme="${esc(state.restaurant?.theme || 'cream')}" style="--r-cat-image:url('${asset('cat-sprites.webp')}');--r-food-image:url('${asset('food-sprites.webp')}');--r-food-extra-image:url('${asset('food-expansion-v1.webp')}');--r-staff-image:url('${asset('staff-expansion-v1.webp')}');--r-sesame-image:url('${asset('staff-sesame-v1.webp')}');--r-gold-salmon:url('${asset('gold-v1/special-salmon.webp')}');--r-gold-sundae:url('${asset('gold-v1/special-sundae.webp')}');--r-gold-latte:url('${asset('gold-v1/special-latte.webp')}')">
    ${debugEnabled?`<aside id="rg-terminal" class="rg-terminal-window" aria-labelledby="rg-terminal-title" hidden><header><h2 id="rg-terminal-title">调试终端</h2><button data-r-terminal-close aria-label="关闭餐厅控制终端" title="关闭">${restaurantIcon('close')}</button></header><div data-r-terminal-panel></div></aside>`:''}
    <div class="r-open-sign" role="status"><i></i>营业中</div>
    <div class="r-hud"><div class="r-wallet"><span class="r-fish-medallion">${restaurantIcon('fish')}</span><span><small>小鱼干</small><strong data-r-wallet>${number(state.coins)}</strong></span><button class="round-button r-wallet-guide" data-r-guide-open aria-label="餐厅新手引导" title="餐厅新手引导">${restaurantIcon('book')}</button></div>${goldWalletMarkup(state.goldFish)}<button class="r-level" data-r-tab="progression" aria-label="查看小馆等级和资源解锁进度">${restaurantStageStars(1,{compact:true})}<span class="r-level-copy"><strong data-r-stage-title>小馆</strong><span data-r-level>Lv.1</span><span class="r-level-track" role="progressbar" aria-label="营业经验" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-r-level-bar></i></span><span class="r-level-value" data-r-level-value></span></span></button><aside class="rx-gain" data-r-experience-gain role="status" aria-live="polite" aria-atomic="true" hidden></aside></div>
    <section class="r-viewport" aria-label="完整餐厅全景，顾客与厨房同屏"><div class="r-scene-controls"><button class="r-round r-back" data-r-back aria-label="返回猫猫图鉴">${restaurantIcon('back')}</button>${restaurantResearchShortcut()}</div><aside class="r-header-actions r-tools" aria-label="餐厅工具"><button class="r-round ra-entry" data-r-audio-open aria-label="声音设置" title="声音设置">${restaurantAudioIcon}</button><button class="r-round r-info-entry" data-r-tab="info" aria-label="查看小馆营业信息">${restaurantIcon('info')}</button>${debugEnabled?`<button class="r-round rg-terminal-entry" data-r-tab="terminal" aria-label="打开餐厅控制终端" aria-controls="rg-terminal" aria-expanded="false">${restaurantIcon('terminal')}<small>终端</small></button>`:`<button class="r-round" data-r-tab="help" aria-label="餐厅玩法说明">${restaurantIcon('help')}</button>`}${restaurantDailyLoginMarkup()}</aside><div class="r-stage"><img class="r-scene-art" src="${asset('restaurant-scene.webp')}" alt="暖暖的猫猫小馆，花园旁摆着小餐桌，厨房里亮着灯" draggable="false"/><div class="r-sunlight" aria-hidden="true"></div>
      <div class="r-shop-sign" title="${esc(state.name)}的小食光"><strong>${esc(state.name)}的小食光</strong></div>
      ${restaurantStreetMarkup()}<div class="rg-guest-layer" data-r-guests></div>
      ${decorationSceneMarkup()}${premiumSceneMarkup()}<div class="r-tables" data-r-tables></div>${kitchenSceneMarkup()}${restRoomSceneMarkup()}
      <div class="r-kitchen-label">${restaurantIcon('chef')} 喵喵厨房 <span data-r-kitchen-level>Lv.1</span></div>
      <div class="r-scene-hint" data-r-hint>新客人入座后，主厨就开始制作啦</div>
    </div></section>
    <div class="r-status"><span class="r-status-dot"></span><span data-r-save>${isTest?'测试小馆 · 刷新恢复默认':'与当前小窝同步'}</span><span class="r-growth">${restaurantIcon('spark')}<b data-r-pet-level>成长 Lv.${levelInfo(state.xp).level}</b></span></div>
    <nav class="r-nav" aria-label="餐厅菜单">${tabs.map(([id,icon,label])=>`<button data-r-tab="${id}" class="${id==='business'?'selected':''}" aria-pressed="${id==='business'}"><span>${restaurantIcon(icon)}</span><strong>${label}</strong>${id==='upgrades'?'<i class="r-nav-dot"></i>':''}</button>`).join('')}</nav>
    <dialog class="r-sheet" aria-labelledby="r-panel-title"><div class="r-sheet-handle"></div><header><h2 id="r-panel-title"></h2><button class="r-round" data-r-dismiss aria-label="关闭餐厅面板">${restaurantIcon('close')}</button></header><div class="r-sheet-content" data-r-panel></div></dialog>
    <dialog id="rc-customer-dialog" class="rc-customer-dialog" aria-labelledby="rc-customer-title"></dialog>
    <dialog class="r-recipe-dialog" aria-labelledby="r-recipe-detail-title"></dialog>
    <dialog class="rr-celebration rr-quality-card" aria-labelledby="rr-promotion-title"></dialog>
    <dialog class="rr-draw-scene rr-quality-card" aria-labelledby="rr-discovery-title"></dialog>
    ${restaurantAudioMarkup()}${restaurantDailyLoginDialog()}<div class="r-reward-layer" aria-live="polite" aria-atomic="true"></div>
  </main>`;
}

export function createRestaurant({container,getState,getAvailability=()=>({connected:true,saving:false}),onAction,onBack,toast=()=>{},isTest=false,debugEnabled=isTest,preferences=null,guidePreferences=preferences,getGuideContext=()=>({entered:false}),testActions=null}) {
  debugEnabled=restaurantTerminalAllowed({isTest,debugEnabled});
  let opened=false, panel=null, timer=null, signature='', panelSignature='', mounted=false, pending=false, unlockAnnounced=0, lastEarnings=null, rewardTimer;
  let recipeCategory='all',progressionCategory='all',customerFilter='all',customerSelected=null,customerDialogSignature='';
  let staffPreview=null,trainingWorker='worker-1',lastGold=null,themeView='colors',researchShowcase=null,recipeSelected=null,recipeDetailSignature='';
  let guests=null,street=null,autoGuests=true,kitchenScene=null,flowOrderId=null,flowRecipe='rice',selectedZone=null,pendingKitchenRecipe=null,previousKitchenOrders=new Set();
  const arrivalRhythm=createRestaurantArrivalRhythm();
  const logs=[],pendingCourseOrders=new Set();
  let terminalOpen=false,terminalSignature='',terminalOrderId=null,decorationScene=null,experienceFeedback=null,recipeCelebration=null,researchReveal=null,dailyLogin=null,circlePalette='cream';
  let guide=null,guideReadyForAuto=false;
  try{autoGuests=preferences?.getItem('catnest.restaurant.autoGuests')!=='0';}catch{}
  const $ = selector => container.querySelector(selector);
  const audio=createRestaurantAudioUI({container,preferences});
  function guideNavigate(view){
    dismiss();dismissTerminal();audio.closeSettings();kitchenScene?.endTutorial();
    if(view==='themes')themeView='scenes';
    if(!['business','kitchen'].includes(view))openPanel(view);
    return true;
  }
  function startGuide(options={}){void guide?.start(options).then(started=>{if(!started)toast('正在读取小馆，准备好后就可以查看指引。');});}
  const sound=id=>void audio.unlock().then(()=>audio.play(id));
  function decorationComplete(suite){
    void audio.play('decoration-complete');
    toast(`${suite.name}场景布置完成`);
  }
  function researchAudio(phase){
    audio.setTrack(phase==='closed'?(panel==='research'?'research':'restaurant'):'research');
    if(phase==='brewing')sound('draw');
    if(phase==='flipping')sound('flip');
    if(phase==='revealed')sound('reveal');
  }
  function log(text){logs.push({time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),text});if(logs.length>30)logs.shift();panelSignature='';}
  const staffDebugger=createRestaurantStaffDebugger({
    enabled:()=>isTest&&debugEnabled,availability:()=>({...getAvailability(),pending}),run:testActions?.restaurantStaff,
    beforeChange(command){
      if(['unlock','recipes'].includes(command.mode))return;
      autoGuests=false;try{preferences?.setItem('catnest.restaurant.autoGuests','0');}catch{}
      if(command.mode==='stamina')return;
      arrivalRhythm.reset();street?.reset();
      guests?.destroy();guests=createRestaurantGuests({container:$('[data-r-guests]'),onChange:()=>{signature='';}});
    },
    afterChange(command){
      if(command.mode==='stamina'){signature='';panelSignature='';terminalSignature='';return;}
      staffPreview=null;trainingWorker='worker-1';pendingKitchenRecipe=null;flowOrderId=null;selectedZone=null;terminalOrderId=null;
      signature='';panelSignature='';terminalSignature='';
      if(command.mode==='guest'){dismiss();kitchenScene?.select(null);}
      pendingCourseOrders.clear();
      if(['reset','rest-six'].includes(command.mode)){
        kitchenScene?.endTutorial();kitchenScene?.select(null);
      }
      if(command.mode==='rehearse'){
        const details=$('.rg-staff-debug');if(details)details.open=false;
        kitchenScene?.select(getState().restaurant.orders[0]?.id);kitchenScene?.focus(true);
      }
    },
    message(text){log(text);toast(text);render();},
  });
  function tableMarkup(info,availability){return restaurantGuestTables(info,{icon:restaurantIcon,food,blocked:pending||restaurantInputBlocked(availability),replaying:guests?.replaying()||[],pendingCourses:[...pendingCourseOrders]});}
  function welcomeGuests(size=null,{manual=false,recipeId=null,keepPanel=false,waiting=false}={}){
    const availability=getAvailability(),info=restaurantInfo(getState());
    if(pending||restaurantInputBlocked(availability)){if(manual)toast('小馆正在读取，稍后再迎客');return false;}
    const action=waiting?{type:'restaurant-wait'}:{type:'restaurant-arrive',...(size===null?{}:{partySize:size}),...(recipeId?{recipeId}:{})};
    const result=restaurantActionResult(getState(),action);
    if(!result.ok){if(manual){toast(result.reason);log(result.reason);}return false;}
    pending=true;
    try{
      if(onAction(action)===false){if(manual)log('来客请求暂未接受');return false;}
      log(waiting?'门外有猫猫等位':size===2?'手动迎接双人一桌':size===1?'手动迎接单人一桌':manual?'手动迎接随机一桌':'自然来客');
      arrivalRhythm.defer(Date.now(),waiting);
      if(manual){if(recipeId&&KITCHEN_FLOWS[recipeId]){pendingKitchenRecipe=recipeId;previousKitchenOrders=new Set(info.orders.map(order=>order.id));}if(!keepPanel)dismiss();toast('新客人正在从门外走进来');}
      return true;
    }finally{pending=false;render();}
  }
  function closeRecipeDetails(restoreFocus=true) {
    const dialog=$('.r-recipe-dialog');if(!dialog?.open)return;
    dialog.close();recipeDetailSignature='';
    if(restoreFocus)$('.r-sheet')?.querySelector(`[data-r-recipe-detail="${recipeSelected}"]`)?.focus({preventScroll:true});
  }
  function updateRecipeDetails(info,force=false) {
    const dialog=$('.r-recipe-dialog');if(!dialog||(!dialog.open&&!force))return false;
    const markup=restaurantRecipeDetailMarkup(info,recipeSelected);
    if(!markup){closeRecipeDetails(false);return false;}
    if(!force&&markup===recipeDetailSignature)return true;
    const scroll=dialog.querySelector('.r-recipe-detail-content')?.scrollTop||0,railScroll=dialog.querySelector('.r-recipe-detail-related>div:last-child')?.scrollLeft||0;
    const focus=dialog.contains(document.activeElement),focusedRecipe=focus&&document.activeElement?.dataset.rRecipeDetail;
    recipeDetailSignature=markup;dialog.innerHTML=markup;
    dialog.querySelector('.r-recipe-detail-content').scrollTop=scroll;
    const rail=dialog.querySelector('.r-recipe-detail-related>div:last-child');if(rail)rail.scrollLeft=railScroll;
    if(focus)(focusedRecipe?dialog.querySelector(`[data-r-recipe-detail="${focusedRecipe}"]`):dialog.querySelector('[data-r-recipe-detail-close]'))?.focus({preventScroll:true});
    return true;
  }
  function openRecipeDetails(id) {
    const info=restaurantInfo(getState());
    if(![...info.recipes,...info.specialRecipes].some(recipe=>recipe.id===id))return;
    recipeSelected=id;const dialog=$('.r-recipe-dialog'),alreadyOpen=dialog.open;
    if(!updateRecipeDetails(info,true))return;
    if(!alreadyOpen)dialog.showModal();
    dialog.querySelector('.r-recipe-detail-content').scrollTop=0;
    if(!alreadyOpen)dialog.querySelector('[data-r-recipe-detail-close]').focus({preventScroll:true});
  }
  function closeCustomerDetails(restoreFocus=true) {
    const dialog=$('.rc-customer-dialog');
    if(!dialog?.open)return;
    dialog.close();customerDialogSignature='';
    if(restoreFocus&&panel==='customers')$(`[data-r-customer-id="${customerSelected}"]`)?.focus({preventScroll:true});
  }
  function updateCustomerDetails(info,force=false) {
    const dialog=$('.rc-customer-dialog');
    if(!dialog||(!dialog.open&&!force))return;
    const guest=info.customerBook.customers.find(item=>item.id===customerSelected);
    if(!guest){closeCustomerDetails();return;}
    const key=JSON.stringify(guest);if(!force&&key===customerDialogSignature)return;
    customerDialogSignature=key;
    const scroll=dialog.querySelector('.rc-dialog-content')?.scrollTop||0;
    dialog.innerHTML=`<header><h2 id="rc-customer-title">来访条件</h2><button class="r-round" data-r-customer-close aria-label="关闭顾客详情">${restaurantIcon('close')}</button></header><div class="rc-dialog-content">${restaurantCustomerDetail(info,{selectedId:customerSelected,testing:isTest&&typeof testActions?.restaurantStaff==='function',food})}</div>`;
    dialog.querySelector('.rc-dialog-content').scrollTop=scroll;
    if(pending||restaurantInputBlocked(getAvailability()))for(const button of dialog.querySelectorAll('[data-r-debug-guest]'))button.disabled=true;
  }
  function openCustomerDetails(id) {
    customerSelected=id;const info=restaurantInfo(getState());
    updatePanel(info,getState(),true);updateCustomerDetails(info,true);
    if(!$('.rc-customer-dialog').open)$('.rc-customer-dialog').showModal();
  }
  function panelContent(info,state) {
    if(panel==='workflows'&&debugEnabled)return kitchenWorkflowBoardMarkup(info);
    if(panel==='flow'||panel==='station')return kitchenFlowPanel(info,{orderId:flowOrderId,recipeId:flowRecipe,zoneId:panel==='station'?selectedZone:null});
    if(panel==='customers')return restaurantCustomersPanel(info,{filter:customerFilter,selectedId:customerSelected});
    if(panel==='recipes')return restaurantRecipesPanel(info,{category:recipeCategory});
    if(panel==='research')return restaurantResearchPanel(info,{showcase:researchShowcase});
    if(panel==='progression')return restaurantProgressionPanel(info,{category:progressionCategory});
    if(panel==='gold')return restaurantGoldPanel(info,state);
    if(panel==='training')return restaurantStaffPanel(info,{workerId:trainingWorker,view:'training'});
    if(panel==='info')return restaurantInfoPanel(info,state);
    if(panel==='restroom')return restaurantRestRoomPanel(info);
    if(panel==='upgrades')return restaurantUpgradesPanel(info);
    if(panel==='staff')return restaurantStaffPanel(info,{staffId:staffPreview,workerId:trainingWorker});
    if(panel==='themes')return restaurantAppearancePanel(info,{view:themeView});
    return `${restaurantGuideEntryMarkup()}<div class="r-help-hero">${cat('chef')}<div><small>欢迎光临</small><strong>${esc(state.name)}的小食光</strong></div></div><ol class="r-help-steps"><li><b>迎接猫友</b><span>客人从门外走进来，入座后每人点一道菜；也可能两位朋友同桌。</span></li><li><b>热乎乎出锅</b><span>先点顾客需求接单，再逐步点击食材圈。工位上的蓝色圆环结束后，继续点下一步；装盘后点击餐桌送出。</span></li><li><b>收获好心情</b><span>客人吃完后，点小鱼干结账，金币同步回小窝，并生成餐厅经营经验气泡。</span></li><li><b>小馆慢慢长大</b><span>升级厨房、扩建座位、研发菜谱，还可以雇佣自动送餐的猫猫。</span></li></ol><p class="r-fine">小鱼干与小窝的猫爪币使用同一钱包，结账时小馆获得营业经验，并按 1:1 生成「餐厅经营经验」气泡；回小窝点击气泡，领取同等的小猫成长经验。餐厅首次升级需 60 经验，之后每级增加 15；点击上方小馆等级查看全部解锁路线。营业时空桌会自然迎来新客；已经点击的操作会继续计时，尚未点击的工序会等你回来。离线或餐厅连续 ${STAFF_IDLE_RECOVERY_MS/60_000} 分钟没有操作时，所有员工自动回满体力，菜品保留当前工序。${isTest?'这里是测试小馆，刷新会恢复默认。':'餐厅进度保存在当前小窝，两位主人共同经营。'}</p><button class="r-primary" data-r-dismiss>一起开张吧 ${restaurantIcon('fish')}</button><button class="r-primary" data-r-kitchen-tutorial>厨房新手引导</button>${restaurantUpgradeHelp(info)}${kitchenGuideMarkup(info)}`;
  }
  function updatePanel(info,state,force=false) {
    if(!panel)return;
    $('.r-sheet').dataset.panel=panel;
    const key=JSON.stringify([panel,themeView,recipeCategory,progressionCategory,customerFilter,customerSelected,info.customerBook.customers.map(guest=>[guest.eligible,guest.seen]),staffPreview,trainingWorker,info.restaurant.revision,info.progression.experience,state.coins,state.goldFish,pending,getAvailability(),autoGuests,logs.length,info.parties.map(p=>p.status),(['flow','station','training','restroom'].includes(panel)||panel==='themes'&&info.decorationInfo.construction)?Math.floor(Date.now()/1000):null]);
    if(!force&&panelSignature===key){if(panel==='workflows')paintKitchenWorkflowBoard($('[data-r-panel]'),info,{blocked:pending||restaurantInputBlocked(getAvailability())});return;}panelSignature=key;
    const boardScroll=new Map([...$('[data-r-panel]').querySelectorAll('[data-r-board-recipe]')].map(row=>[row.dataset.rBoardRecipe,row.querySelector('.rk-board-rail').scrollLeft]));
    const scroll=$('[data-r-panel]').scrollTop,workerScroll=$('.re-worker-tabs')?.scrollLeft||0,focus=document.activeElement,focusTab=$('[data-r-panel]').contains(focus)?focus?.dataset.rTab:null,focusThemeView=$('[data-r-panel]').contains(focus)?focus?.dataset.rThemeView:null;
    const progressionOpen=panel==='progression'&&!force&&Number($('.rp-progression')?.dataset.rProgressionCurrentLevel)===info.level
      ?new Map([...$('[data-r-panel]').querySelectorAll('[data-r-progression-range], [data-r-progression-level]')].map(item=>[item.dataset.rProgressionRange?`range:${item.dataset.rProgressionRange}`:`level:${item.dataset.rProgressionLevel}`,item.open])):null;
    const upgradeOpen=new Map([...$('[data-r-panel]').querySelectorAll('[data-r-upgrade-detail]')].map(item=>[item.dataset.rUpgradeDetail,item.open]));
    const action=focus?.dataset.rAction,recipe=focus?.dataset.rRecipe,upgrade=focus?.dataset.rUpgrade,previewId=focus?.dataset.rStaffPreview,worker=focus?.dataset.rWorker,stat=focus?.dataset.rStat,trainingId=focus?.dataset.rTrainingWorker,decorationId=focus?.dataset.rDecoration,paletteId=focus?.dataset.rPalette,themeId=focus?.dataset.rTheme;
    $('#r-panel-title').textContent={customers:'顾客图鉴',research:'菜谱研发室',recipes:'小馆的拿手料理',staff:'猫猫伙伴',upgrades:'设施升级',themes:'小馆装扮',gold:'积攒金色的小幸福',training:'员工升级',restroom:'员工休息室',info:'小馆的营业手账',progression:'小馆成长路线',help:'餐厅玩法与教材',terminal:'餐厅控制终端',flow:'一份料理，逐步制作',station:'厨房工位',workflows:'菜品工序后台'}[panel];
    const oldShowcase=panel==='research'?$('[data-r-research-showcase]'):null;
    $('[data-r-panel]').innerHTML=panelContent(info,state);
    const newShowcase=$('[data-r-research-showcase]');if(oldShowcase&&newShowcase&&oldShowcase.dataset.rResearchShowcase===newShowcase.dataset.rResearchShowcase)newShowcase.replaceWith(oldShowcase);
    if(panel==='workflows'){paintKitchenWorkflowBoard($('[data-r-panel]'),info,{blocked:pending||restaurantInputBlocked(getAvailability())});for(const row of $('[data-r-panel]').querySelectorAll('[data-r-board-recipe]'))row.querySelector('.rk-board-rail').scrollLeft=boardScroll.get(row.dataset.rBoardRecipe)||0;}if($('.re-worker-tabs'))$('.re-worker-tabs').scrollLeft=workerScroll;
    if(progressionOpen)for(const item of $('[data-r-panel]').querySelectorAll('[data-r-progression-range], [data-r-progression-level]')){
      const key=item.dataset.rProgressionRange?`range:${item.dataset.rProgressionRange}`:`level:${item.dataset.rProgressionLevel}`;
      if(progressionOpen.has(key))item.open=progressionOpen.get(key);
    }
    for(const item of $('[data-r-panel]').querySelectorAll('[data-r-upgrade-detail]'))if(upgradeOpen.has(item.dataset.rUpgradeDetail))item.open=upgradeOpen.get(item.dataset.rUpgradeDetail);
    $('[data-r-panel]').scrollTop=scroll;
    if(pending||restaurantInputBlocked(getAvailability()))for(const button of $('[data-r-panel]').querySelectorAll('[data-r-action]'))button.disabled=true;
    if(action){const selector=`[data-r-action="${action}"]${recipe?`[data-r-recipe="${recipe}"]`:upgrade?`[data-r-upgrade="${upgrade}"]`:themeId?`[data-r-theme="${themeId}"]`:paletteId?`[data-r-palette="${paletteId}"]`:decorationId?`[data-r-decoration="${decorationId}"]`:worker?`[data-r-worker="${worker}"][data-r-stat="${stat}"]`:''}`;$('[data-r-panel]').querySelector(selector)?.focus({preventScroll:true});}
    else if(previewId)$(`[data-r-staff-preview="${previewId}"]`)?.focus({preventScroll:true});
    else if(trainingId)$(`[data-r-training-worker="${trainingId}"]`)?.focus({preventScroll:true});
    else if(focusThemeView)$('[data-r-panel]').querySelector(`[data-r-theme-view="${focusThemeView}"]`)?.focus({preventScroll:true});
    else if(focusTab)$('[data-r-panel]').querySelector(`[data-r-tab="${focusTab}"]`)?.focus({preventScroll:true});
  }
  function updateTerminal(info){
    if(!debugEnabled)return;
    $('#rg-terminal').hidden=!terminalOpen;
    $('[aria-controls="rg-terminal"]').setAttribute('aria-expanded',String(terminalOpen));
    if(!terminalOpen)return;
    const key=JSON.stringify([info.restaurant.revision,info.parties.map(p=>p.status),autoGuests,logs.at(-1),pending,getAvailability()]);
    const content=$('[data-r-terminal-panel]');
    if(key===terminalSignature){paintKitchenTerminal(content,info,{orderId:terminalOrderId||kitchenScene?.selectedId,blocked:pending||restaurantInputBlocked(getAvailability()),palette:circlePalette});return;}terminalSignature=key;
    const detailsOpen=content.querySelector('.rg-terminal-details')?.open,staffOpen=content.querySelector('.rg-staff-debug')?.open,kitchenOpen=content.querySelector('.rk-terminal-kitchen')?.open,catalogOpen=content.querySelector('.rg-customer-catalog')?.open,guestTestOpen=content.querySelector('.rg-guest-tests')?.open,researchPreviewOpen=content.querySelector('.rr-terminal-preview')?.open,scroll=$('#rg-terminal').scrollTop,focus=document.activeElement;
    const focused=content.contains(focus)?['data-r-debug-arrive','data-r-debug-auto','data-r-preview-grade','data-r-debug-guest','data-r-debug-reset','data-r-debug-unlock-decor','data-r-debug-unlock-recipes','data-r-debug-unlock-staff','data-r-debug-staff-preset','data-r-debug-staff-unlock','data-r-debug-staff-rehearse','data-r-debug-staff-stamina','data-r-debug-staff-rest-six','data-r-debug-dish','data-r-debug-kitchen-order'].find(name=>focus.hasAttribute(name)):null;
    const focusedValue=focused&&focus.getAttribute(focused);
    content.innerHTML=restaurantTerminalPanel(info,{auto:autoGuests,logs,icon:restaurantIcon,unlockDecorations:isTest&&typeof testActions?.unlockRestaurantDecorations==='function',staffTesting:isTest&&typeof testActions?.restaurantStaff==='function'});
    if(detailsOpen)content.querySelector('.rg-terminal-details').open=true;
    if(staffOpen)content.querySelector('.rg-staff-debug').open=true;
    if(kitchenOpen)content.querySelector('.rk-terminal-kitchen').open=true;
    if(catalogOpen)content.querySelector('.rg-customer-catalog').open=true;
    if(guestTestOpen)content.querySelector('.rg-guest-tests').open=true;
    if(researchPreviewOpen)content.querySelector('.rr-terminal-preview').open=true;
    paintKitchenTerminal(content,info,{orderId:terminalOrderId||kitchenScene?.selectedId,blocked:pending||restaurantInputBlocked(getAvailability()),palette:circlePalette});
    $('#rg-terminal').scrollTop=scroll;
    if(pending||getAvailability().saving||!getAvailability().connected)for(const button of content.querySelectorAll('[data-r-debug-arrive],[data-r-debug-guest],[data-r-debug-reset],[data-r-debug-unlock-recipes],[data-r-debug-unlock-staff],[data-r-debug-staff-preset],[data-r-debug-staff-unlock],[data-r-debug-staff-rehearse],[data-r-debug-staff-stamina],[data-r-debug-staff-rest-six],[data-r-debug-dish]'))button.disabled=true;
    if(focused)content.querySelector(`[${focused}="${focusedValue}"]`)?.focus({preventScroll:true});
  }
  function dismissTerminal(restoreFocus=false){terminalOpen=false;if(debugEnabled&&mounted){$('#rg-terminal').hidden=true;$('[aria-controls="rg-terminal"]').setAttribute('aria-expanded','false');if(restoreFocus)$('[aria-controls="rg-terminal"]').focus({preventScroll:true});}}
  function render() {
    if(!opened)return;
    const state=getState(),info=restaurantInfo(state),availability=getAvailability();
    circlePalette=kitchenCirclePalette(info.restaurant.circlePalette).id;
    if(!mounted){container.innerHTML=restaurantMarkup(state,{isTest,debugEnabled});mounted=true;dailyLogin=createRestaurantDailyLogin({dialog:$('.rdl-dialog'),entry:$('[data-r-daily-open]'),onAction,onCollect:()=>sound('collect'),onClick:()=>sound('click'),preferences});experienceFeedback=createRestaurantExperience({container:$('[data-r-experience-gain]')});recipeCelebration=createRestaurantRecipeCelebration({dialog:$('.rr-celebration')});researchReveal=createRestaurantResearchReveal({dialog:$('.rr-draw-scene'),onPhaseChange:researchAudio});audio.paint();kitchenScene=createKitchenScene({container:$('.rk-scene'),getRestaurant:()=>getState().restaurant,palette:circlePalette});kitchenScene.open();decorationScene=createRestaurantDecorationScene({container:$('.r-stage'),onScenePrepare:variant=>preloadPremiumScene(variant,restaurantInfo(getState()).restaurant),onSceneChange:()=>paintPremiumScene(container,restaurantInfo(getState()).restaurant),onComplete:decorationComplete});decorationScene.open();guests=createRestaurantGuests({container:$('[data-r-guests]'),onChange:()=>{signature='';}});street=createRestaurantStreet({container:$('.r-stage')});}
    if(!guide)guide=createRestaurantGuide({storage:guidePreferences,assetBase:import.meta.env?.BASE_URL||'./',getContext:()=>{const context=getGuideContext(),availability=getAvailability();return {...context,active:opened&&!container.hidden,ready:(availability.ready??availability.connected)&&context.ready!==false,available:guideReadyForAuto&&context.available!==false};},navigate:guideNavigate,onClose(){arrivalRhythm.reset();}});
    if(availability.savePhase==='error')pendingCourseOrders.clear();
    for(const id of pendingCourseOrders)if(!info.orders.some(order=>order.id===id))pendingCourseOrders.delete(id);
    experienceFeedback.sync(info.progression);
    guests.sync(info);guests.start();street.sync(info,{enabled:!panel&&!terminalOpen&&!guide?.isOpen()&&!info.decorationInfo.construction});street.start();kitchenScene.setPalette(circlePalette);kitchenScene.sync(info.restaurant,{blocked:pending||restaurantInputBlocked(availability)});decorationScene.sync(info);paintRestaurantStaffRest(container,info.restaurant);
    if(pendingKitchenRecipe){const order=info.orders.find(order=>order.workflow&&order.recipeId===pendingKitchenRecipe&&!previousKitchenOrders.has(order.id));if(order){terminalOrderId=order.id;if(order.status!=='arriving'){pendingKitchenRecipe=null;kitchenScene.select(order.id);}}}
    if(lastEarnings!==null&&info.restaurant.stats.earned>lastEarnings){
      const layer=$('.r-reward-layer');layer.innerHTML=`<div class="r-reward-pop">${restaurantIcon('fish')}<strong>+${info.restaurant.stats.earned-lastEarnings}</strong>${lastGold!==null&&state.goldFish>lastGold?`<span class="re-reward-gold">金鱼干 +${state.goldFish-lastGold}</span>`:''}${info.research.lastGift?.amount?`<span class="rr-inspiration-award">💡 灵感 +${info.research.lastGift.amount}</span>`:''}</div>`;
      clearTimeout(rewardTimer);rewardTimer=setTimeout(()=>{if(layer.isConnected)layer.innerHTML='';},2200);
    }
    lastEarnings=info.restaurant.stats.earned;lastGold=state.goldFish;
    $('.restaurant').dataset.theme=info.restaurant.theme;paintPremiumScene(container,info.restaurant);
    $('[data-r-wallet]').textContent=number(state.coins);
    const researchCount=$('[data-r-research-count]');researchCount.hidden=info.research.availableDraws===0;researchCount.textContent=info.research.availableDraws>99?'99+':String(info.research.availableDraws);$('.rr-research-shortcut').dataset.rResearchReady=String(info.research.availableDraws>0);$('.rr-research-shortcut').setAttribute('aria-label',`进入菜谱研发室，可探索 ${info.research.availableDraws} 次`);
    $('[data-r-gold]').textContent=number(state.goldFish);
    $('.r-wallet').classList.toggle('is-large',state.coins>=100000);$('.re-wallet').classList.toggle('is-large',state.goldFish>=100000);
    $('.re-wallet').setAttribute('aria-label',`金鱼干 ${number(state.goldFish)}，查看获取和用途`);
    const growthStage=applyRestaurantGrowthStage($('.r-level'),info.level);
    $('[data-r-stage-title]').textContent=growthStage.title;
    $('[data-r-level]').textContent=`Lv.${info.level}`;
    $('[data-r-level-value]').textContent=`${number(info.progression.levelExperience)} / ${number(info.progression.levelTarget)}`;
    const stars=$('.r-level>.rg-stars');
    stars.setAttribute('aria-label',`${growthStage.stars}星${growthStage.title}`);
    stars.querySelector('b').textContent=String(growthStage.stars);
    $('[data-r-level-bar]').style.width=`${info.progression.progress*100}%`;
    const levelTrack=$('[data-r-level-bar]').parentElement;
    levelTrack.setAttribute('aria-valuenow',String(Math.round(info.progression.progress*100)));
    levelTrack.setAttribute('aria-valuetext',`${number(info.progression.levelExperience)} / ${number(info.progression.levelTarget)} 经验`);
    $('[data-r-tab="progression"].r-level').setAttribute('aria-label',`${growthStage.title} Lv.${info.level}，${growthStage.stars}星，还差 ${number(info.progression.remaining)} 经验升级，查看资源解锁进度`);
    $('[data-r-pet-level]').textContent=`成长 Lv.${levelInfo(state.xp).level}`;
    $('[data-r-save]').textContent=restaurantSaveLabel(availability,isTest);
    $('[data-r-kitchen-level]').textContent=`Lv.${info.restaurant.levels.kitchen}`;
    const hint=info.parties.some(p=>p.status==='arriving')?'新客人正在走进小馆，入座后各点一道菜':info.orders.some(o=>o.status==='collectible')?'小鱼干在闪闪发光，点一下收好它':info.orders.some(o=>o.status==='requested')?'点击顾客的菜品需求，接下这一单':info.orders.some(o=>o.status==='awaiting')?'点食材圈，员工才会继续下一步':info.orders.some(o=>['ready','dish-ready'].includes(o.status))?'料理做好啦，点击餐桌送餐':info.orders.some(o=>['cooking','preparing','delivering'].includes(o.status))?'主厨忙碌中，客人正在期待美味':info.orders.some(o=>o.status==='dining')?'吃饱饱，心情也变好啦':`今日已完成 ${info.restaurant.stats.served} 份料理 · ${info.availableTables} 张空桌等待新朋友`;
    $('[data-r-hint]').textContent=hint;
    const nextSignature=JSON.stringify([[...pendingCourseOrders],info.orders.map(o=>[o.id,o.status]),info.parties.map(p=>[p.id,p.status]),info.kitchen?.orders.map(order=>[order.id,order.currentStep.id,order.phase]),guests.replaying(),info.capacity,info.level,info.restaurant.revision,availability,pending]);
    if(nextSignature!==signature){
      signature=nextSignature;const focus=document.activeElement;const orderId=focus?.dataset.rOrderId,recipeId=focus?.dataset.rRecipe;
      $('[data-r-tables]').innerHTML=tableMarkup(info,availability);
      if(orderId)$('[data-r-tables]').querySelector(`[data-r-order-id="${orderId}"]`)?.focus({preventScroll:true});
      else if(recipeId)$('[data-r-tables]').querySelector(`[data-r-recipe="${recipeId}"]`)?.focus({preventScroll:true});
    }
    for(const order of info.orders){const countdown=$(`[data-r-countdown="${order.id}"]`),progress=$(`[data-r-progress="${order.id}"]`);if(countdown&&order.status==='cooking')countdown.textContent=`${Math.ceil(order.remainingMs/1000)}秒`;if(progress)progress.style.setProperty('--progress',order.progress);}
    if(unlockAnnounced&&info.level>unlockAnnounced){void audio.play('upgrade');toast(`小馆升级到 Lv.${info.level}，查看成长路线了解新开放的资源！`);}
    unlockAnnounced=info.level;updatePanel(info,state);updateCustomerDetails(info);updateRecipeDetails(info);updateTerminal(info);recipeCelebration.sync(info);researchReveal.sync(info,availability);
    guideReadyForAuto=!document.hidden&&!panel&&!terminalOpen&&!pending&&!info.decorationInfo.construction;guide.sync();
    dailyLogin.sync(info.dailyLogin,availability,{autoShow:!guide.isOpen()&&!document.hidden&&!panel&&!terminalOpen&&!container.querySelector('dialog[open]:not(.rdl-dialog)')});
    const nextGuest=arrivalRhythm.poll(info,Date.now(),{enabled:autoGuests&&!guide.isOpen()&&!$('.rdl-dialog').open&&!$('.rr-celebration').open&&!$('.rr-draw-scene').open&&!info.decorationInfo.construction&&!panel&&!terminalOpen&&!document.hidden,blocked:availability.saving||pending||!availability.connected||restaurantInputBlocked(availability)});
    if(nextGuest)welcomeGuests(null,{waiting:nextGuest.type==='restaurant-wait'});
  }
  function dismiss() {closeRecipeDetails(false);closeCustomerDetails(false);panel=null;audio.setTrack($('.rr-draw-scene')?.open?'research':'restaurant');panelSignature='';$('.r-sheet')?.close();for(const button of container.querySelectorAll('.r-nav button')){const selected=button.dataset.rTab==='business';button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}}
  function openPanel(id) {closeRecipeDetails(false);closeCustomerDetails(false);if(id==='restroom'){const rest=$('[data-r-rest-summary]');if(rest)rest.open=false;}if(id==='terminal'){if(!debugEnabled)return;dismiss();terminalOpen=!terminalOpen;updateTerminal(restaurantInfo(getState()));return;}dismissTerminal();if(id==='business'){dismiss();return;}const previousPanel=panel;if(id==='research')researchShowcase=createRestaurantResearchShowcase(restaurantInfo(getState()));panel=id;audio.setTrack(id==='research'?'research':'restaurant');updatePanel(restaurantInfo(getState()),getState(),true);const dialog=$('.r-sheet');if(!dialog.open)dialog.showModal();if(previousPanel!==panel)$('[data-r-panel]').scrollTop=0;if(['staff','training'].includes(previousPanel)&&['staff','training'].includes(id))$(`.r-panel-switch [data-r-tab="${id}"]`)?.focus({preventScroll:true});for(const button of container.querySelectorAll('.r-nav button')){const selected=button.dataset.rTab===(id==='training'?'staff':id==='research'?'recipes':id);button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}}
  async function act(button) {
    if(pending)return;
    const fromTerminal=!!button.closest('#rg-terminal,.rk-workflow-board');
    const type=button.dataset.rAction;if(type==='start')return;const action={type:`restaurant-${type}`};
    if(['start','recipe','unlock-special'].includes(type))action.recipeId=button.dataset.rRecipe;
    if(['serve','collect','kitchen-accept','kitchen-step'].includes(type))action.orderId=button.dataset.rOrderId;
    if(type==='kitchen-step')action.stepId=button.dataset.rStep;
    if(type==='research-draw')action.draw=Number(button.dataset.rDraw);
    if(type==='research-fuse'){action.recipeId=button.dataset.rRecipe;action.amount=Number(button.dataset.rFuseAmount);action.expectedFragments=Number(button.dataset.rFuseFragments);action.expectedFusion=Number(button.dataset.rFuseRevision);}
    if(type==='upgrade')action.upgradeId=button.dataset.rUpgrade;
    if(type==='theme'||type==='premium-decoration')action.themeId=button.dataset.rTheme;
    if(type==='premium-decoration')action.equipped=button.dataset.rEquipped==='true';
    if(type==='palette')action.paletteId=button.dataset.rPalette;
    if(type==='decoration')action.decorationId=button.dataset.rDecoration;
    if(type==='train'){action.workerId=button.dataset.rWorker;action.statId=button.dataset.rStat;}
    const before=getState(),info=restaurantInfo(before),availability=getAvailability();
    if(restaurantInputBlocked(availability)){toast('小馆正在读取，稍后就能开始营业');return;}
    const result=restaurantActionResult(before,action);
    if(!result.ok){toast(result.reason);return;}
    if(type==='research-draw'&&!researchReveal.start(action.draw))return;
    pending=true;render();
    try {
      const firstCourse=type==='collect'&&info.orders.find(order=>order.id===action.orderId)?.hasNextCourse;
      if(firstCourse)pendingCourseOrders.add(action.orderId);
      const accepted=onAction(action);
      if(accepted===false){pendingCourseOrders.delete(action.orderId);if(type==='research-draw')researchReveal.fail();return;}
      if(type!=='research-draw')sound(restaurantActionSound(type,action.stepId));
      if(firstCourse)toast('正在结算第一餐，记下第二份料理');
      log(type==='collect'?'提交订单结账':type==='serve'?'提交送餐':`提交${type}操作`);
      if(type==='start'){dismiss();toast('接单成功，主厨开始制作啦');}
      if(type==='decoration'){dismiss();dismissTerminal();toast('两位施工猫带着工具出发啦，约 12 秒完成布置');}
      if(type==='serve')toast('热乎乎的料理送到啦');
      if(type==='kitchen-accept'||type==='kitchen-step'){
        flowOrderId=action.orderId;terminalOrderId=action.orderId;kitchenScene.select(action.orderId);
        if(!fromTerminal){dismiss();dismissTerminal();}
        if(type==='kitchen-accept')toast('点冰箱上的食材圈，员工才会去取料');
      }
      if(['train','unlock-special','hire','theme','recipe','palette','premium-decoration'].includes(type))toast(result.text);
    }catch(error){if(type!=='research-draw')throw error;researchReveal.fail('灵感还在路上，请稍后查看手账中的最新记录。');toast('暂时无法完成探索，请稍后再试');}finally{pending=false;render();}
  }
  container.addEventListener('click',event=>{
    const recipeDialog=$('.r-recipe-dialog');
    if(event.target===recipeDialog){const rect=recipeDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeRecipeDetails();return;}
    const customerDialog=$('.rc-customer-dialog');
    if(event.target===customerDialog){const rect=customerDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeCustomerDetails();return;}
    const button=event.target.closest('button');
    if(!button){const dish=event.target.closest('.r-recipe-card[data-r-dish]');if(dish)openRecipeDetails(dish.dataset.rDish);return;}
    if(button.disabled)return;
    if(!button.dataset.rAction&&!button.hasAttribute('data-rr-flip')&&!button.hasAttribute('data-rr-discovery-confirm'))sound('click');
    if(button.hasAttribute('data-r-daily-open')){dailyLogin.open();return;}
    if(button.hasAttribute('data-r-recipe-detail-close')){closeRecipeDetails();return;}
    if(button.dataset.rRecipeDetail){openRecipeDetails(button.dataset.rRecipeDetail);return;}
    if(button.dataset.rPreviewGrade&&debugEnabled){recipeCelebration.preview(button.dataset.rPreviewGrade,restaurantInfo(getState()));return;}
    if(button.dataset.rPreviewReveal&&debugEnabled){researchReveal.preview(button.dataset.rPreviewReveal,restaurantInfo(getState()));return;}
    if(button.hasAttribute('data-r-debug-research-fusion')){
      if(!isTest||typeof testActions?.restaurantStaff!=='function')return;
      if(pending||getAvailability().saving){toast('等待上一项操作保存后再准备测试');return;}
      recipeCelebration.reset();researchReveal.reset();const result=testActions.restaurantStaff({mode:'research-fusion'});log(result.message);toast(result.message);if(result.ok)openPanel('research');render();return;
    }
    if(button.hasAttribute('data-r-customer-close')){closeCustomerDetails();return;}
    if(button.hasAttribute('data-r-back')){close();onBack();return;}
    if(button.hasAttribute('data-r-terminal-close')){dismissTerminal(true);return;}
    if(button.hasAttribute('data-r-dismiss')){dismiss();return;}
    if(button.hasAttribute('data-r-board-animate')){const playing=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(playing));button.querySelector('img').src=playing?button.dataset.loop:button.dataset.static;button.querySelector('span').textContent=playing?'Ⅱ 停止':'▶ 动画';return;}
    if(button.hasAttribute('data-r-rest-collapse')){const details=button.closest('[data-r-rest-summary]');if(details){details.open=false;details.querySelector('summary')?.focus({preventScroll:true});}return;}
    if(staffDebugger.handle(button))return;
    if(button.hasAttribute('data-r-debug-dish')){
      if(!debugEnabled)return;
      const availability=getAvailability();
      if(pending||availability.saving||!availability.connected){toast('上一项操作正在保存，稍后再测试料理');return;}
      autoGuests=false;try{preferences?.setItem('catnest.restaurant.autoGuests','0');}catch{}
      welcomeGuests(1,{manual:true,recipeId:button.dataset.rDebugDish,keepPanel:!!button.closest('.rk-workflow-board')});return;
    }
    if(button.hasAttribute('data-r-flow')){flowOrderId=button.dataset.rFlow||null;selectedZone=null;kitchenScene.select(flowOrderId);openPanel('flow');return;}
    if(button.hasAttribute('data-r-flow-recipe')){flowRecipe=button.dataset.rFlowRecipe;flowOrderId=null;selectedZone=null;openPanel('flow');return;}
    if(button.hasAttribute('data-r-kitchen-zone')){selectedZone=Number(button.dataset.rKitchenZone);openPanel('station');return;}
    if(button.hasAttribute('data-r-kitchen-select')){flowOrderId=button.dataset.rKitchenSelect;kitchenScene.select(flowOrderId);return;}
    if(button.hasAttribute('data-r-guide-open')){startGuide({restart:button.hasAttribute('data-r-guide-restart')});return;}
    if(button.hasAttribute('data-r-kitchen-tutorial')){startGuide({section:'kitchen'});return;}
    if(button.hasAttribute('data-r-kitchen-tutorial-close')){kitchenScene.endTutorial();return;}
    if(button.hasAttribute('data-r-kitchen-tutorial-next')){kitchenScene.nextTutorial();return;}
    if(button.hasAttribute('data-r-kitchen-zones')){kitchenScene.toggleZones();return;}
    if(button.hasAttribute('data-r-kitchen-watch')){dismiss();return;}

    if(button.dataset.rStaffPreview&&RESTAURANT_STAFF.some(employee=>employee.id===button.dataset.rStaffPreview)){
      staffPreview=button.dataset.rStaffPreview;const index=RESTAURANT_STAFF.findIndex(item=>item.id===staffPreview);if(index<getState().restaurant.staff)trainingWorker=`worker-${index+2}`;updatePanel(restaurantInfo(getState()),getState(),true);
      $('[data-r-panel]').scrollTop=0;$(`[data-r-staff-preview="${staffPreview}"]`)?.focus({preventScroll:true});return;
    }
    if(button.dataset.rCustomerFilter&&['all','advanced','silver','gold','seen','locked'].includes(button.dataset.rCustomerFilter)){customerFilter=button.dataset.rCustomerFilter;updatePanel(restaurantInfo(getState()),getState(),true);$('[data-r-panel]').scrollTop=0;$(`[data-r-customer-filter="${customerFilter}"]`)?.focus({preventScroll:true});return;}
    if(button.dataset.rCustomerId&&restaurantInfo(getState()).customerBook.customers.some(guest=>guest.id===button.dataset.rCustomerId)){openCustomerDetails(button.dataset.rCustomerId);return;}
    if(button.dataset.rProgressionCategory&&['all','recipe','staff','facility','research','training','decoration','station'].includes(button.dataset.rProgressionCategory)){progressionCategory=button.dataset.rProgressionCategory;updatePanel(restaurantInfo(getState()),getState(),true);$('[data-r-panel]').scrollTop=0;return;}
    if(button.dataset.rThemeView&&!button.dataset.rTab&&['colors','scenes','decor'].includes(button.dataset.rThemeView)){themeView=button.dataset.rThemeView;updatePanel(restaurantInfo(getState()),getState(),true);$('[data-r-panel]').scrollTop=0;$(`[data-r-theme-view="${themeView}"]`)?.focus({preventScroll:true});return;}
    if(button.dataset.rTrainingWorker){trainingWorker=button.dataset.rTrainingWorker;updatePanel(restaurantInfo(getState()),getState(),true);return;}
    if(button.hasAttribute('data-r-debug-unlock-decor')){if(isTest&&typeof testActions?.unlockRestaurantDecorations==='function'){const message=testActions.unlockRestaurantDecorations();log(message);toast(message);terminalSignature='';panelSignature='';render();}return;}
    if(button.hasAttribute('data-r-debug-arrive')){if(debugEnabled)welcomeGuests(button.dataset.rDebugArrive==='random'?null:Number(button.dataset.rDebugArrive),{manual:true});return;}if(button.hasAttribute('data-r-debug-auto')){if(debugEnabled){autoGuests=!autoGuests;try{preferences?.setItem('catnest.restaurant.autoGuests',autoGuests?'1':'0');}catch{}arrivalRhythm.reset();log(autoGuests?'恢复自然来客':'暂停自然来客');render();}return;}if(button.dataset.rCategory&&['all',...RESTAURANT_RECIPE_CATEGORIES].includes(button.dataset.rCategory)){
      recipeCategory=button.dataset.rCategory;updatePanel(restaurantInfo(getState()),getState(),true);
      $('[data-r-panel]').scrollTop=0;$(`[data-r-category="${recipeCategory}"]`)?.focus({preventScroll:true});return;
    }
    if(button.dataset.rTab){
      const resource=button.dataset.rProgressionResource&&restaurantInfo(getState()).progression.catalog.find(item=>item.key===button.dataset.rProgressionResource);
      if(resource?.kind==='staff'&&resource.id!=='chef')staffPreview=resource.id;
      if(resource?.kind==='recipe'||resource?.kind==='research')recipeCategory='all';
      if(button.dataset.rTab==='themes'){if(['colors','scenes','decor'].includes(button.dataset.rThemeView))themeView=button.dataset.rThemeView;else if(resource?.kind==='decoration')themeView=resource.key.startsWith('palette:')?'colors':restaurantInfo(getState()).decorationInfo.decorations.some(item=>item.id===resource.id)?'scenes':'decor';}
      openPanel(button.dataset.rTab);
      if(button.hasAttribute('data-r-upgrade-help-link'))$('[data-r-upgrade-help]')?.scrollIntoView({block:'start'});
      if(resource){
        const id=resource.id;
        const selector=resource.kind==='recipe'?`[data-r-dish="${id}"], [data-r-recipe="${id}"]`:resource.kind==='facility'?`[data-r-upgrade="${id}"]`:resource.kind==='decoration'?`[data-r-palette="${id}"], [data-r-decoration-card="${id}"], [data-r-theme="${id}"]`:null;
        if(selector)$('[data-r-panel]').querySelector(selector)?.scrollIntoView({block:'center',behavior:'auto'});
        else if(resource.kind==='staff')$('[data-r-panel]').scrollTop=0;
      }
      return;
    }
    if(button.dataset.rAction)void act(button);
  });
  container.addEventListener('change',event=>{
    const select=event.target.closest('[data-r-debug-kitchen-order]');
    if(!debugEnabled||!select)return;
    const order=restaurantInfo(getState()).orders.find(order=>order.id===select.value&&order.workflow);
    if(!order)return;
    terminalOrderId=order.id;kitchenScene?.select(order.id);paintKitchenTerminal($('[data-r-terminal-panel]'),restaurantInfo(getState()),{orderId:order.id,blocked:pending||restaurantInputBlocked(getAvailability()),palette:circlePalette});
  });
  container.addEventListener('cancel',event=>{if(event.target.matches('.r-recipe-dialog')){event.preventDefault();closeRecipeDetails();return;}if(event.target.matches('.rc-customer-dialog')){event.preventDefault();closeCustomerDetails();return;}if(event.target.matches('.rr-celebration,.rr-draw-scene,.rdl-dialog'))return;event.preventDefault();dismiss();},true);
  container.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if($('.rdl-dialog')?.open){dailyLogin.close();return;}if($('.rr-draw-scene')?.open){researchReveal.close();return;}if($('.rr-celebration')?.open){$('.rr-celebration').close();return;}if($('.r-recipe-dialog')?.open){closeRecipeDetails();return;}if($('.rc-customer-dialog')?.open){closeCustomerDetails();return;}if(terminalOpen)dismissTerminal(true);else if(panel)dismiss();else if($('[data-r-rest-summary]')?.open){$('[data-r-rest-summary]').open=false;$('[data-r-rest-summary]>summary')?.focus({preventScroll:true});}else{close();onBack();}}});
  function open(){opened=true;audio.setActive(true);container.hidden=false;document.body.classList.add('restaurant-mode');signature='';lastEarnings=null;kitchenScene?.open();decorationScene?.open();arrivalRhythm.reset();street?.reset();render();clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)render();},400);if(!$('.rdl-dialog').open)$('[data-r-back]').focus({preventScroll:true});}
  function close(){guide?.close();dailyLogin?.reset();audio.closeSettings();audio.setActive(false);researchReveal?.reset();dismiss();dismissTerminal();opened=false;container.hidden=true;document.body.classList.remove('restaurant-mode');clearInterval(timer);timer=null;guests?.stop();street?.stop();arrivalRhythm.reset();kitchenScene?.close();decorationScene?.close();experienceFeedback?.reset();recipeCelebration?.reset();}
  return {open,close,render,destroy(){close();guide?.destroy();dailyLogin?.destroy();audio.destroy();guests?.destroy();street?.destroy();kitchenScene?.destroy();decorationScene?.destroy();experienceFeedback?.destroy();recipeCelebration?.destroy();researchReveal?.destroy();clearTimeout(rewardTimer);container.innerHTML='';}};
}
