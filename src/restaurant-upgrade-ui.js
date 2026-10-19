import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { restaurantFacilityEffect, RESTAURANT_FACILITY_MAX_LEVEL } from './restaurant-facilities.js';
import { staffAbilityLevelEffects, staffTrainingUpgradeCost, STAFF_TRAINING_MAX_LEVEL, STAFF_TRAINING_STATS } from './restaurant-staff-training.js';
import { restaurantResourceLevel } from './restaurant-progression.js';

const number=value=>value.toLocaleString('zh-CN',{maximumFractionDigits:1});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=(value,sign='+')=>`${value===0?'':sign}${number(value)}%`;
const coin=value=>`<span class="r-price"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M17 12c-4-8-12-6-15 0 3 6 11 8 15 0Zm0 0 5-5v10l-5-5Z"/></svg>${number(value)}</span>`;
const marks={kitchen:'♨',fridge:'❄',tables:'♧',tips:'♡'};
export function facilityEffectCopy(id,level){
  const effect=restaurantFacilityEffect(id,level);
  if(!effect)return {primary:'',secondary:''};
  if(effect.kind==='time-reduction')return {primary:`${id==='fridge'?'取料':'加工'}基础耗时 ${percent(effect.percent,'−')}`,secondary:''};
  if(effect.kind==='income')return {primary:`小鱼干收入 ${percent(effect.percent)}`,secondary:''};
  return {primary:`${effect.capacity} 张餐桌${effect.percent?` · 舒适收益 ${percent(effect.percent)}`:''}`,secondary:''};
}
export function staffEffectCopy(id,level){
  const effect=staffAbilityLevelEffects(id,level);
  if(!effect)return {primary:'',secondary:''};
  if(id==='speed')return {primary:`行走与取料速度 ${percent(effect.ratePercent)}`,secondary:`基础耗时 ${percent(effect.timeReductionPercent,'−')}`};
  if(id==='stamina')return {primary:`体力上限 ${percent(effect.capacityPercent)}`,secondary:`上限 ${effect.maxEnergy} 点`};
  if(id==='skill')return {primary:`加工速度 ${percent(effect.ratePercent)}`,secondary:`基础耗时 ${percent(effect.timeReductionPercent,'−')} · 售价 ${percent(effect.incomePercent)}`};
  return {primary:`耗能系数 ${percent(effect.factorReductionPercent,'−')}`,secondary:`每步 ${effect.stepEnergyCost} 点 · 实际耗能 ${percent(effect.actualReductionPercent,'−')}`};
}
const copyMarkup=copy=>esc(copy.primary);
function compactEffect(id,level){
  const ability=staffAbilityLevelEffects(id,level);
  if(ability){
    if(id==='speed')return percent(ability.ratePercent);
    if(id==='stamina')return percent(ability.capacityPercent);
    if(id==='endurance')return percent(ability.factorReductionPercent,'−');
    return percent(ability.ratePercent);
  }
  const effect=restaurantFacilityEffect(id,level);
  if(effect.kind==='tables')return `${effect.capacity} 桌${effect.percent?` · 收益 ${percent(effect.percent)}`:''}`;
  return percent(effect.percent,effect.kind==='income'?'+':'−');
}
function effectSummary(id,current,max){
  return `<div class="ru-effects" data-r-upgrade-effects="${id}"><div><span>当前</span><strong>${compactEffect(id,current)}</strong></div>${current<max?`<div class="ru-next"><span>下一级</span><strong>${compactEffect(id,current+1)}</strong></div>`:''}<div class="ru-max"><span>Lv.${max} 满级</span><strong>${compactEffect(id,max)}</strong></div></div>`;
}
function levelTable({id,name,current,max,kind,copy,cost}){
  return `<details class="ru-level-details" data-r-upgrade-detail="${kind}:${id}"><summary><strong>${esc(name)}</strong><small>Lv.1–${max}</small><span aria-hidden="true">⌄</span></summary><table><caption>相对 Lv.1 的累计效果</caption><thead><tr><th scope="col">等级 / 开放</th><th scope="col">能力增益</th></tr></thead><tbody>${Array.from({length:max},(_,i)=>{
    const target=i+1,price=target===1?null:cost(target),required=restaurantResourceLevel(kind,id,target);
    return `<tr data-r-effect-level="${target}"${target===current?' aria-current="true"':''}><th scope="row">Lv.${target}${target===current?'<b>当前</b>':''}<small>${target===1?'初始拥有':`小馆 Lv.${required} · ${number(price?.amount??price??0)} ${price?.currency==='goldFish'?'金鱼干':'小鱼干'}`}</small></th><td>${copyMarkup(copy(id,target))}</td></tr>`;
  }).join('')}</tbody></table></details>`;
}
export function staffAbilityEffectsMarkup(stat){
  return effectSummary(stat.id,stat.level,STAFF_TRAINING_MAX_LEVEL);
}
export const restaurantUpgradeHelpLink=()=>'<button class="ru-help-link" data-r-tab="help" data-r-upgrade-help-link>升级帮助 <span aria-hidden="true">↗</span></button>';
export function restaurantUpgradeHelp(info){
  return `<section class="ru-upgrade-guide" data-r-upgrade-help aria-label="升级帮助"><h3>升级帮助</h3><h4>设施升级</h4>${info.upgrades.map(upgrade=>levelTable({id:upgrade.id,name:upgrade.name,current:upgrade.level,max:upgrade.maxLevel,kind:'facility',copy:facilityEffectCopy,cost:target=>upgrade.costs[target-2]})).join('')}<h4>员工能力</h4><p>每位员工独立培养，升级从下一道工序生效；8–10 级使用金鱼干。</p>${STAFF_TRAINING_STATS.map(stat=>levelTable({id:stat.id,name:stat.name,max:STAFF_TRAINING_MAX_LEVEL,kind:'training',copy:staffEffectCopy,cost:target=>staffTrainingUpgradeCost(stat.id,target-1)})).join('')}</section>`;
}
export function restaurantFacilityCards(info){
  const metrics={kitchen:'加工耗时',fridge:'取料耗时',tables:'桌位',tips:'收入'};
  const rowValue=(id,target,current)=>id==='tables'?(current<4?String(restaurantFacilityEffect(id,target).capacity):percent(restaurantFacilityEffect(id,target).percent)):compactEffect(id,target);
  return `<div class="ru-facility-list" aria-label="设施升级">${info.upgrades.map(upgrade=>`<article class="ru-facility ru-facility-row" data-r-facility="${upgrade.id}" ${restaurantLockedAttributes(upgrade.cost!==null&&!upgrade.unlocked)}><span class="ru-mark" aria-hidden="true">${marks[upgrade.id]}</span><div class="ru-facility-copy"><header><h3>${esc(upgrade.name)}</h3><small>Lv.${upgrade.level} / ${RESTAURANT_FACILITY_MAX_LEVEL}</small></header><span class="re-skill-segments" role="progressbar" aria-label="${esc(upgrade.name)}等级" aria-valuemin="1" aria-valuemax="${upgrade.maxLevel}" aria-valuenow="${upgrade.level}">${Array.from({length:upgrade.maxLevel},(_,i)=>`<i class="${i<upgrade.level?'is-lit':''}" aria-hidden="true"></i>`).join('')}</span><p class="ru-facility-effect" data-r-upgrade-effects="${upgrade.id}"><span class="ru-facility-current">${upgrade.id==='tables'&&upgrade.level>=4?'收益':metrics[upgrade.id]} <strong>${rowValue(upgrade.id,upgrade.level,upgrade.level)}</strong>${upgrade.level<upgrade.maxLevel?`<span class="ru-facility-next" aria-label="下一级 ${esc(rowValue(upgrade.id,upgrade.level+1,upgrade.level))}"> → ${rowValue(upgrade.id,upgrade.level+1,upgrade.level)}</span>`:''}</span>${upgrade.level<upgrade.maxLevel?`<small class="ru-facility-max">满级 ${upgrade.id==='tables'?`${restaurantFacilityEffect('tables',upgrade.maxLevel).capacity}桌/收益 ${percent(restaurantFacilityEffect('tables',upgrade.maxLevel).percent)}`:compactEffect(upgrade.id,upgrade.maxLevel)}</small>`:''}</p></div><button class="r-buy" data-r-action="upgrade" data-r-upgrade="${upgrade.id}" ${upgrade.cost===null||!upgrade.unlocked?'disabled':''}>${upgrade.cost===null?'已满级':`${coin(upgrade.cost)}<small>${!upgrade.unlocked?restaurantLockIcon():''}${!upgrade.unlocked?`小馆 Lv.${upgrade.unlockLevel}`:`升至 ${upgrade.level+1} 级`}</small>`}</button></article>`).join('')}</div>${restaurantUpgradeHelpLink()}`;
}
