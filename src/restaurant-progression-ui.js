import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
/** Read-only roadmap. The rules layer supplies eligibility and ownership;
 * every button here only navigates to an existing management panel. */
import { restaurantGrowthStage, restaurantGrowthStageStyle } from './restaurant-growth-stages.js';
import { restaurantStageStars } from './restaurant-growth-stage-ui.js';
import { kitchenCircleStyle } from './restaurant-kitchen-colors.js';
import { premiumRestaurantTheme } from './restaurant-premium-decorations.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>(Number.isFinite(value)?value:0).toLocaleString('zh-CN',{maximumFractionDigits:1});
const level=value=>Number.isSafeInteger(value)&&value>0?value:1;
const slug=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]+$/.test(value)?value:null;
const asset=file=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/${file}`,globalThis.document?.baseURI||import.meta.url).href;
const CATEGORIES=Object.freeze([
  ['all','全部'],['feature','功能'],['recipe','菜谱'],['staff','员工'],['facility','设施'],
  ['research','研发'],['training','训练'],['decoration','装扮'],['station','厨房'],
]);
const LABELS=Object.fromEntries(CATEGORIES);
const PANELS=Object.freeze({feature:'business',recipe:'recipes',staff:'staff',facility:'upgrades',research:'research',training:'training',decoration:'themes',station:'flow'});
const PANEL_NAMES=Object.freeze({business:'营业',recipes:'菜谱',research:'研发室',staff:'员工',upgrades:'设施',training:'训练',themes:'装扮',flow:'厨房',gold:'金色招牌'});
const ICONS=Object.freeze({
  feature:'<path d="M7 14C-2 12 4 2 9 5c3-7 11-3 10 2 7 2 4 9-2 8v6H7v-7Zm0 3h10"/>',
  star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  recipe:'<path d="M12 5C8 3 4 4 4 4v15s4-1 8 1c4-2 8-1 8-1V4s-4-1-8 1Zm0 0v15"/>',
  staff:'<path d="m5 10-1-7 6 4h4l6-4-1 7c5 14-19 14-14 0Z"/><path d="M8 13h.1M16 13h.1m-6 4 2-1 2 1"/>',
  facility:'<path d="M5 4h14v16H5zM5 10h14M9 7h.1M9 13v3M15 13v3"/>',
  research:'<path d="M9 3h6m-5 0v6l-5 9c-1 2 0 3 2 3h10c2 0 3-1 2-3l-5-9V3M8 14h8"/>',
  training:'<path d="m4 15 5-5 4 4 7-9m-6 0h6v6M5 21h14"/>',
  decoration:'<path d="M12 8c-7-9-13 2-6 5-6 6 3 12 6 5 3 7 12 1 6-5 7-3 1-14-6-5Z"/><circle cx="12" cy="13" r="3"/>',
  station:'<path d="M4 5v5c0 3 5 3 5 0V5M6.5 5v16M17 3v18m0-18c-5 2-5 10 0 10"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  lock:'<rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
});
const icon=id=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]||ICONS.star}</svg>`;
const goldFiles=Object.freeze({'gold-salmon':'special-salmon','gold-sundae':'special-sundae','gold-latte':'special-latte',starlight:'theme-starlight',glass:'theme-glass',royal:'theme-royal'});
const kitchenPreviews=Object.freeze({'station:1':'coffee-espresso','station:2':'drink-packaging','station:3':'bowl-empty','station:4':'wok-fried-rice','station:5':'wok-fried-rice','station:6':'board-chicken','station:7':'washing-vegetables','station:8':'bowl-eggs','station:9':'seasonings','station:10':'fridge-closed','facility:fridge':'fridge-closed','facility:kitchen':'wok-fried-rice'});
function preview(item){
  const type=item.preview?.type,id=slug(item.preview?.id);
  if(type==='premium-decoration'&&premiumRestaurantTheme(id))return `<img src="${asset(premiumRestaurantTheme(id).art)}" alt="" loading="lazy" draggable="false"/>`;
  const prop=type==='icon'?kitchenPreviews[`${item.kind}:${item.id}`]:null;
  if(prop)return `<img src="${asset(`kitchen-v1/${prop}.webp`)}" alt="" loading="lazy" draggable="false"/>`;
  if(type==='food'&&id)return `<span class="r-food r-food-${id}" aria-hidden="true"></span>`;
  if(type==='cat'&&id)return `<span class="r-cat r-cat-${id}" aria-hidden="true"></span>`;
  if(type==='palette'&&id)return `<span class="rk-palette-sample" style="${kitchenCircleStyle(id)}" aria-hidden="true"><img src="${asset('kitchen-v1/seasonings.webp')}" alt="" loading="lazy" draggable="false"/><svg viewBox="0 0 60 60"><circle class="rk-palette-track" cx="30" cy="30" r="27"/><circle class="rk-palette-fill" cx="30" cy="30" r="27"/></svg></span>`;
  if(type==='gold'){
    const file=goldFiles[id]||(['gold-fish','special-salmon','special-sundae','special-latte','theme-starlight','theme-glass','theme-royal'].includes(id)?id:'gold-fish');
    return `<img src="${asset(`gold-v1/${file}.webp`)}" alt="" loading="lazy" draggable="false"/>`;
  }
  if(type==='decoration'&&id){
    const file=goldFiles[id]||(['theme-starlight','theme-glass','theme-royal'].includes(id)?id:null);
    return `<img class="rp-decoration-preview" src="${asset(file?`gold-v1/${file}.webp`:`decor/${id}/scene.webp`)}" alt="" loading="lazy" draggable="false"/>`;
  }
  return icon(type==='icon'&&id&&ICONS[id]?id:item.kind);
}
function route(item){if(item.kind==='staff'&&item.id==='chef')return 'training';return item.kind==='recipe'&&(item.currency==='goldFish'||String(item.id).startsWith('gold-'))?'gold':PANELS[item.kind]||'recipes';}
function status(item){return ['owned','available','locked'].includes(item.status)?item.status:item.owned?'owned':item.available?'available':'locked';}
function price(item,state){
  if(state==='owned'||!Number.isFinite(item.cost)||item.cost<=0)return '';
  return `<span class="rp-price ${item.currency==='goldFish'?'is-gold':''}"><b>${number(item.cost)}</b> ${item.currency==='goldFish'?'金鱼干':'小鱼干'}</span>`;
}
function resourceDescription(item){
  if(item.kind==='feature'||item.cost===null)return item.description;
  if(item.kind==='training')return '每人每项';
  if((item.kind==='facility'&&item.cost>0)||(item.kind==='decoration'&&item.currency==='goldFish'))return item.description;
  return '';
}
function resourceMarkup(item){
  const state=status(item),tab=route(item),opened=level(item.level),target=Number.isSafeInteger(item.targetLevel)&&item.targetLevel>0?item.targetLevel:null;
  const label=item.kind==='feature'?(state==='locked'?'未到级':'已解锁'):{owned:'已拥有',available:'可购买',locked:'未到级'}[state];
  const name=target?String(item.name??'').replace(new RegExp(`\\s*(?:可升至|至)?\\s*Lv\\.\\s*${target}\\s*$`),'').trim():item.name;
  const description=resourceDescription(item);
  return `<article class="rp-resource is-${state}" data-r-progression-key="${esc(item.key)}" data-r-progression-kind="${esc(item.kind)}" data-r-resource-level="${opened}" ${restaurantLockedAttributes(state!=='owned')}><span class="rp-preview">${preview(item)}</span><div class="rp-resource-copy"><div class="rp-resource-heading"><h4>${esc(name)}</h4>${target?`<small class="rp-target" data-r-target-level="${target}" aria-label="${item.kind==='training'?'能力':'目标'}等级 ${target}">Lv.${target}</small>`:''}</div>${description?`<p>${esc(description)}</p>`:''}<div class="rp-resource-bottom"><span class="rp-status">${state==='owned'?icon('check'):restaurantLockIcon()}${label}</span>${price(item,state)}</div></div><button class="rp-resource-link" type="button" data-r-tab="${tab}" data-r-progression-resource="${esc(item.key)}" aria-label="前往${PANEL_NAMES[tab]}查看${esc(item.name)}">${icon('arrow')}</button></article>`;
}

/** The entry can be mounted before restaurantInfo is available. */
export function progressionEntryMarkup(info){
  const progression=info?.progression,current=level(progression?.level);
  const stage=restaurantGrowthStage(current);
  return `<button class="rp-entry" type="button" data-r-tab="progression" data-r-growth-stage="${stage.id}" style="${restaurantGrowthStageStyle(current)}" aria-label="查看小馆成长与资源开放路线"><span class="rp-entry-icon">${restaurantStageStars(current,{compact:true})}</span><span><strong>小馆成长路线</strong><small>${progression?`${stage.title} · Lv.${current}`:'看看接下来开放的资源'}</small></span>${icon('arrow')}</button>`;
}

export function restaurantProgressionPanel(info,{category='all'}={}){
  const progression=info?.progression;
  if(!progression)return '<section class="rp-progression rp-empty" aria-label="小馆成长路线"><p>小馆成长路线正在整理，稍后再来看看。</p></section>';
  if(!CATEGORIES.some(([id])=>id===category))category='all';
  const current=level(progression.level),next=level(progression.nextLevel??current+1);
  const stage=restaurantGrowthStage(current);
  const milestones=Array.isArray(progression.milestones)?progression.milestones:[];
  const catalog=Array.isArray(progression.catalog)?progression.catalog:milestones.flatMap(milestone=>milestone.items||[]);
  const entries=catalog.filter(item=>item&&typeof item==='object');
  const filtered=entries.filter(item=>category==='all'||item.kind===category);
  const levels=[...new Set([...milestones.map(milestone=>level(milestone.level)),...filtered.map(item=>level(item.level))])].sort((a,b)=>a-b);
  const progress=Number.isFinite(progression.progress)?Math.min(1,Math.max(0,progression.progress)):0;
  const segment=Number.isFinite(progression.levelExperience)&&Number.isFinite(progression.levelTarget)?`${number(progression.levelExperience)} / ${number(progression.levelTarget)}`:`${number(progression.experience)} / ${number(progression.target)}`;
  const lastResourceLevel=Math.max(0,...entries.map(item=>level(item.level)));
  const availableCount=entries.filter(item=>item.available).length,ownedCount=entries.filter(item=>item.owned).length;
  const nextItems=entries.filter(item=>level(item.level)===next);
  const reachedAll=lastResourceLevel>0&&current>=lastResourceLevel;
  const nextLabel=`<div class="rp-next-label"><span>下一站</span><b>Lv.${next}</b>${nextItems.length>1?`<small>${nextItems.length} 项</small>`:''}</div>`;
  const nextStop=nextItems.length?`<aside class="rp-next-stop" aria-label="下一站资源预告">${nextLabel}<div class="rp-next-items" ${nextItems.length>1?`tabindex="0" aria-label="横向滑动查看 ${nextItems.length} 项下级资源"`:''}>${nextItems.map(item=>`<div class="rp-next-item" ${restaurantLockedAttributes(!item.owned)}><span class="rp-preview">${preview(item)}</span>${!item.owned?restaurantLockIcon():''}<strong>${esc(item.name)}</strong></div>`).join('')}</div></aside>`:`<aside class="rp-next-stop is-continuing" aria-label="下一站资源预告">${nextLabel}<p>${reachedAll?'现有资源门槛均已达到，经验继续增长。':'这一站没有新增资源，继续积攒经验。'}</p></aside>`;
  const milestoneMarkup=itemLevel=>{
    const items=filtered.filter(item=>level(item.level)===itemLevel);if(!items.length)return '';
    const milestone=milestones.find(item=>level(item.level)===itemLevel),isCurrent=milestone?.current??itemLevel===current,isNext=itemLevel===next,available=milestone?.available??itemLevel<=current;
    return `<details class="rp-milestone ${isCurrent?'is-current':isNext?'is-next':''} ${available?'is-reached':'is-future'}" data-r-progression-level="${itemLevel}" open><summary><h3>Lv.${itemLevel}${isCurrent||isNext?`<small>${isCurrent?'当前':'下一站'}</small>`:''}</h3><span class="rp-milestone-count">${items.length} 项</span><span class="rp-expand" aria-hidden="true">${icon('arrow')}</span></summary><div class="rp-level-resources">${items.map(resourceMarkup).join('')}</div></details>`;
  };
  const visibleLevels=levels.filter(itemLevel=>filtered.some(item=>level(item.level)===itemLevel));
  const lastMilestoneLevel=Math.max(0,...levels);
  const rangeMarkup=start=>{
    const end=Math.min(start+9,lastMilestoneLevel),isCurrent=current>=start&&current<=end,isNext=next>=start&&next<=end;
    const items=filtered.filter(item=>level(item.level)>=start&&level(item.level)<=end);
    const milestonesInRange=visibleLevels.filter(itemLevel=>itemLevel>=start&&itemLevel<=end);
    const chapterStage=restaurantGrowthStage(start);
    return `<details class="rp-chapter ${isCurrent?'is-current':isNext?'is-next':''}" data-r-progression-range="${start}-${end}" data-r-growth-stage="${chapterStage.id}" style="${restaurantGrowthStageStyle(start)}" open><summary><div class="rp-chapter-title"><h3>Lv.${start}–${end}</h3><div><strong>${chapterStage.title}</strong>${restaurantStageStars(start)}</div></div>${isCurrent?'<small class="rp-chapter-current">当前阶段</small>':''}<span class="rp-chapter-count">${items.length} 项</span><span class="rp-expand" aria-hidden="true">${icon('arrow')}</span></summary><div class="rp-chapter-body">${milestonesInRange.map(milestoneMarkup).join('')}</div></details>`;
  };
  const ranges=[...new Set(visibleLevels.map(itemLevel=>Math.floor((itemLevel-1)/10)*10+1))];
  const roadmap=(lastMilestoneLevel>12?ranges.map(rangeMarkup):visibleLevels.map(milestoneMarkup)).join('')||'<p class="rp-filter-empty" role="status">这个分类暂时没有资源。</p>';
  return `<section class="rp-progression" data-r-progression-current-level="${current}" data-r-growth-stage="${stage.id}" style="${restaurantGrowthStageStyle(current)}" aria-label="小馆成长路线"><header class="rp-hero"><div class="rp-title"><div><strong>${stage.title}</strong>${restaurantStageStars(current)}</div><h3>Lv.${current}</h3></div><div class="rp-experience"><div><span>本级经验</span><strong>${segment}</strong></div><div class="rp-experience-track" role="progressbar" aria-label="小馆本级经验进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress*100)}" aria-valuetext="距离 Lv.${next} 还差 ${number(progression.remaining)} 经验"><i style="width:${progress*100}%"></i></div></div></header>${nextStop}<p class="rp-catalog-summary" aria-label="资源开放与拥有统计">已开放 <b>${availableCount}/${entries.length}</b> 项 · 已拥有 <b>${ownedCount}</b> 项</p><div class="rp-filters" role="group" aria-label="筛选成长路线资源">${CATEGORIES.map(([id,label])=>`<button type="button" data-r-progression-category="${id}" aria-pressed="${category===id}" class="${category===id?'selected':''}">${label}<small>${id==='all'?entries.length:entries.filter(item=>item.kind===id).length}</small></button>`).join('')}</div><div class="rp-roadmap" data-r-progression-list>${roadmap}</div></section>`;
}
