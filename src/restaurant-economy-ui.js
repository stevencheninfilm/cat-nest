import { restaurantRecipePreview } from './restaurant-recipe-detail.js';
import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { RESTAURANT_STEP_ENERGY_MAX } from './restaurant-recipe-energy.js';
import { restaurantQualityAttributes } from './restaurant-order-tiers-ui.js';
import { RESTAURANT_STAFF } from './restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES, PREMIUM_RESTAURANT_THEMES } from './restaurant-economy.js';
import { STAFF_IDLE_RECOVERY_MS, staffTrainingInfo, workerStepEnergyCost } from './restaurant-staff-training.js';
import { restaurantResourceLevel } from './restaurant-progression.js';
import { equippedPremiumDecorations, premiumDecorationArt, PREMIUM_SCENE_PATCHES, PREMIUM_SCENE_VARIANTS } from './restaurant-premium-decorations.js';
import { staffAbilityEffectsMarkup, restaurantUpgradeHelpLink } from './restaurant-upgrade-ui.js';
import { restaurantTipsMultiplier, restaurantTableIncomeMultiplier } from './restaurant-facilities.js';

const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/gold-v1/${file}.webp`,globalThis.document?.baseURI||import.meta.url).href;
const decorationAsset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/${file}`,globalThis.document?.baseURI||import.meta.url).href;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value||0).toLocaleString('zh-CN');
const coinPrice=value=>`<span class="r-price"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M17 12c-4-8-12-6-15 0 3 6 11 8 15 0Zm0 0 5-5v10l-5-5Z"/><circle cx="7" cy="11" r=".8"/></svg>${number(value)}</span>`;
export const goldImage=(file='gold-fish',cls='')=>`<img class="re-art ${cls}" src="${asset(file)}" alt="" draggable="false"/>`;
export const goldPrice=value=>`<span class="re-gold-price" aria-label="${value} 金鱼干">${goldImage()}${number(value)}</span>`;
export const employeeName=id=>id==='worker-1'?'橘子主厨':RESTAURANT_STAFF[Number(id?.split('-')[1])-2]?.name||'猫猫员工';
const employeeSprite=id=>id==='worker-1'?'chef':RESTAURANT_STAFF[Number(id?.split('-')[1])-2]?.sprite||'waiter';
export function goldWalletMarkup(balance=0){return `<button class="re-wallet" data-r-tab="gold" aria-label="金鱼干 ${number(balance)}，查看获取和用途">${goldImage()}<span><small>金鱼干</small><strong data-r-gold>${number(balance)}</strong></span></button>`;}

export function restaurantTrainingPanel(info,{workerId='worker-1',now=Date.now()}={}){
  const workers=staffTrainingInfo(info.restaurant,now),worker=workers.find(item=>item.workerId===workerId)||workers[0];
  const partners=workers.filter(item=>item.workerId!=='worker-1');
  const workerButton=item=>`<button data-r-training-worker="${item.workerId}" aria-pressed="${item.workerId===worker.workerId}" class="${item.workerId===worker.workerId?'selected':''}"><span class="r-cat r-cat-${employeeSprite(item.workerId)}" aria-hidden="true"></span><strong>${employeeName(item.workerId)}</strong></button>`;
  const roster=`<div class="re-training-roster"><div class="re-training-chief"><div class="re-roster-label"><strong>主厨</strong><span>1 位</span></div><div class="re-worker-tabs" role="group" aria-label="选择主厨">${workerButton(workers[0])}</div></div><div class="re-training-partners"><div class="re-roster-label"><strong>伙伴</strong><span>${partners.length} / ${RESTAURANT_STAFF.length}</span></div><div class="re-worker-tabs" role="group" aria-label="选择伙伴">${partners.map(workerButton).join('')||'<span class="re-roster-empty">等待伙伴加入</span>'}</div></div></div>`;
  const energy=Math.floor(worker.energy),rest=worker.rest;
  const restLabel=rest?.phase==='recovering'?`休息恢复中 · ${Math.max(0,Math.ceil(rest.remainingMs/1000))} 秒`:rest?.phase==='walking'?'正在前往休息室':rest?.phase==='ready'?'体力已满 · 等待派工':rest?.phase==='exhausted'?'体力耗尽 · 完成本步后休息':'';
  return `<section class="re-training" aria-label="员工能力训练">${roster}<div class="re-energy"><div><strong>${employeeName(worker.workerId)}的体力</strong><span>${energy} / ${worker.maxEnergy}</span></div><div class="re-energy-track" role="meter" aria-label="员工体力储备" aria-valuemin="0" aria-valuemax="${worker.maxEnergy}" aria-valuenow="${energy}"><i style="width:${energy/worker.maxEnergy*100}%"></i></div><p data-r-step-energy>每道工序 ${worker.stepEnergyCost}–${workerStepEnergyCost(worker.levels,RESTAURANT_STEP_ENERGY_MAX)} 点体力 · 随菜谱和品质缓增</p><p>离线或餐厅闲置 ${STAFF_IDLE_RECOVERY_MS/60_000} 分钟，员工体力自动回满</p>${restLabel?`<p>${restLabel}</p>`:''}</div><div class="re-ability-list">${worker.stats.map(stat=>{const unlockLevel=restaurantResourceLevel('training',stat.id,stat.cost?.targetLevel??stat.level),locked=Boolean(stat.cost&&info.level<unlockLevel);return `<article class="re-ability" data-r-ability="${stat.id}" ${restaurantLockedAttributes(locked)}><span class="re-ability-mark">${{speed:'↗',stamina:'♡',endurance:'♧',skill:'✦'}[stat.id]}</span><div class="re-ability-head"><h4>${stat.name}</h4><p title="${esc(stat.description)}">${{speed:'行走、取料、送餐',stamina:'提升体力上限',endurance:'减少工序耗能',skill:'加工与品质'}[stat.id]}</p><small class="re-ability-level">Lv.${stat.level}</small></div><span class="re-skill-segments" role="progressbar" aria-label="${stat.name}等级" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${stat.level}" aria-valuetext="${stat.level} / 10">${Array.from({length:10},(_,index)=>`<i class="${index<stat.level?'is-lit':''}" aria-hidden="true"></i>`).join('')}</span>${staffAbilityEffectsMarkup(stat)}<button class="r-buy" data-r-action="train" data-r-worker="${worker.workerId}" data-r-stat="${stat.id}" ${stat.cost&&!locked?'':'disabled'}>${stat.cost?`${stat.cost.currency==='goldFish'?goldPrice(stat.cost.amount):coinPrice(stat.cost.amount)}<small>${locked?restaurantLockIcon():''}${locked?`Lv.${unlockLevel} 开放`:`升至 ${stat.cost.targetLevel} 级`}</small>`:'已满级'}</button></article>`}).join('')}</div>${restaurantUpgradeHelpLink()}</section>`;
}

export function specialRecipeCardsMarkup(info,{recipes=info.specialRecipes}={}) {
  return recipes.map(recipe=>{
    const owned=info.restaurant.ownedSpecialRecipes?.includes(recipe.id),available=owned||info.level>=recipe.unlockLevel;
    return `<article class="r-recipe-card rr-quality-card r-special-dish ${available&&owned?'':'is-locked'}" data-r-dish="${recipe.id}" ${restaurantLockedAttributes(!owned)} ${restaurantQualityAttributes(recipe.grade)}><span class="r-signature-mark" role="img" aria-label="金色招牌" title="金色招牌">✦</span>${restaurantRecipePreview(recipe)}<b class="r-recipe-sale"><small>售价</small>${coinPrice(Math.round(recipe.price*(1+.3*((recipe.level??1)-1))*restaurantTipsMultiplier(info.restaurant.levels.tips)*restaurantTableIncomeMultiplier(info.restaurant.levels.tables)))}</b>${!available?`<span class="r-recipe-availability">${restaurantLockIcon()} Lv.${recipe.unlockLevel} 解锁</span>`:''}${owned?'':`<div><button class="r-small-primary" data-r-action="unlock-special" data-r-recipe="${recipe.id}" aria-label="解锁${recipe.name}，${recipe.unlockGold} 金鱼干，小馆 ${recipe.unlockLevel} 级" ${available?'':'disabled'}>${restaurantLockIcon()}${goldPrice(recipe.unlockGold)} 解锁</button></div>`}</article>`;
  }).join('');
}

export function restaurantGoldPanel(info,state){
  return `<div class="re-earn-card"><div><strong>持有 ${number(state.goldFish)} 金鱼干</strong><b>银级与金级猫友的用餐谢礼</b></div><span>${goldImage()}</span><div class="re-guest-gold-rules"><span>银级猫友<strong>+1 金鱼干</strong></span><span>金级猫友<strong>+2 金鱼干</strong></span></div><p>仅银级、金级顾客完成两餐后掉落，结账时收取。每位来访顾客仅赠送一次。</p><button class="re-gold-guests" data-r-tab="customers">查看高级顾客与解锁条件 →</button></div><h3 class="r-mini-heading">金色招牌 <small>永久解锁配方</small></h3><div class="r-recipe-grid re-special-grid">${specialRecipeCardsMarkup(info)}</div>`;
}

export function premiumThemesMarkup(info){
  const active=equippedPremiumDecorations(info.restaurant),variant=info.decorationInfo?.decoration?.id||'default';
  return `<section class="re-premium-collection"><h3 class="r-mini-heading">珍藏装扮 <small>可同时摆放多件</small></h3><div class="r-theme-list">${PREMIUM_RESTAURANT_THEMES.map(theme=>{
    const owned=info.restaurant.ownedThemes.includes(theme.id),selected=active.includes(theme.id),unlockLevel=restaurantResourceLevel('theme',theme.id),locked=!owned&&info.level<unlockLevel;
    return `<button class="r-theme-card re-theme theme-${theme.id} ${selected?'selected':''}" data-r-action="premium-decoration" data-r-theme="${theme.id}" data-r-equipped="${!selected}" data-r-theme-active="${selected}" ${restaurantLockedAttributes(!owned)} aria-label="${esc(theme.name)}，${selected?'已摆放，点击收起':owned?'未摆放，点击摆放':locked?`Lv.${unlockLevel} 开放`:`${theme.priceGold} 金鱼干解锁并摆放`}" aria-pressed="${selected}" ${locked||info.restaurant.construction?'disabled':''}><img class="re-art" src="${decorationAsset(premiumDecorationArt(theme.id,variant))}" alt="" loading="lazy" draggable="false"/><span><strong>${theme.name}</strong><em>${theme.propName}</em></span>${!owned?`<small>${restaurantLockIcon()}${locked?`Lv.${unlockLevel} 开放`:goldPrice(theme.priceGold)}</small>`:''}</button>`;
  }).join('')}</div></section>`;
}

export function premiumSceneMarkup(){return `<div class="re-decor-layer" aria-hidden="true">${PREMIUM_RESTAURANT_THEMES.map(theme=>{
  const patch=PREMIUM_SCENE_PATCHES[theme.id],rect=patch?{left:patch.left/940*100,top:patch.top/1672*100,width:patch.width/940*100,height:patch.height/1672*100}:theme.scene;
  const geometry=`left:${rect.left}%;top:${rect.top}%;width:${rect.width}%;${rect.height?`height:${rect.height}%;object-fit:${patch?'fill':'contain'};`:''}`;
  const src=decorationAsset(patch?`premium-integrated-v1/default/${theme.id}.webp`:theme.art);
  const prop=`<img class="re-art re-decor re-decor-${theme.id} ${patch?'re-integrated':''}" data-r-premium-prop="${theme.id}" src="${src}" alt="" draggable="false" style="${geometry}z-index:${patch?2:theme.id==='glass'?4:5};display:none"/>`;
  // The lower replacement belongs behind guests. Only the part inside the
  // entrance wall mask is repeated above that wall, never over a seated cat.
  const wallBottom=1672*.246,visible=patch?Math.max(0,Math.min(patch.height,wallBottom-patch.top)):0;
  return prop+(visible?`<img class="re-art re-decor re-integrated re-wall-fragment" data-r-premium-wall="${theme.id}" src="${src}" alt="" draggable="false" style="${geometry}clip-path:inset(0 0 ${100-visible/patch.height*100}% 0);z-index:4;display:none"/>`:'');
}).join('')}</div>`;}

const preloadedPremiumArt=new Set();
export function preloadPremiumScene(variant,restaurant){
  for(const id of equippedPremiumDecorations(restaurant)){
    const url=decorationAsset(premiumDecorationArt(id,variant,{integrated:true}));
    if(preloadedPremiumArt.has(url))continue;
    preloadedPremiumArt.add(url);const image=new Image();image.src=url;
  }
}

export function paintPremiumScene(container,restaurant){
  const layer=container.querySelector('.re-decor-layer');
  if(!layer)return;
  const active=equippedPremiumDecorations(restaurant),url=container.querySelector('.r-scene-art')?.getAttribute('src')||'';
  const candidate=url.match(/decor\/([a-z-]+)\/scene\.webp/)?.[1],variant=PREMIUM_SCENE_VARIANTS.includes(candidate)?candidate:'default';
  const signature=JSON.stringify([variant,[...active].sort()]);
  if(layer.dataset.premiumSignature===signature)return;
  layer.dataset.premiumSignature=signature;
  for(const prop of layer.querySelectorAll('[data-r-premium-prop], [data-r-premium-wall]')){
    const id=prop.dataset.rPremiumProp||prop.dataset.rPremiumWall;
    prop.src=decorationAsset(premiumDecorationArt(id,variant,{integrated:true}));
    prop.dataset.sceneStyle=variant;
    prop.style.display=active.includes(id)?'block':'none';
  }
}
