import { RESTAURANT_STAFF } from './restaurant.js';

export function restaurantStaffTerminal(info,{enabled=false}={}) {
  if(!enabled)return '';
  const count=info.restaurant.staff;
  return `<details class="rg-staff-debug"><summary><strong>员工测试</strong><span>主厨 + ${count} 位员工</span></summary><div class="rg-staff-presets" role="group" aria-label="员工在场预设">${[[0,'仅主厨'],[3,'原班 4 人'],[6,'全员 7 人']].map(([staff,label])=>`<button data-r-debug-staff-preset="${staff}" aria-label="切换${label}，清空测试订单">${label}</button>`).join('')}</div><p class="rg-staff-note">点击下方员工，按雇佣顺序免费解锁到该位；已接订单继续保留。</p><div class="rg-staff-unlocks" role="group" aria-label="逐位解锁员工">${RESTAURANT_STAFF.map((employee,index)=>`<button data-r-debug-staff-unlock="${employee.id}" aria-label="解锁至${employee.name}，共 ${index+2} 人在场" ${count>index?'disabled':''}><span class="r-cat r-cat-${employee.sprite}" aria-hidden="true"></span><strong>${employee.name}</strong><small>${count>index?'已在场':`解锁 · ${index+2} 人`}</small></button>`).join('')}</div><button class="rg-staff-rehearse" data-r-debug-staff-rehearse>全员动线演练 · 7 人 7 单</button><button class="rg-staff-rehearse" data-r-debug-staff-stamina>主厨体力耗尽测试</button><button class="rg-staff-rehearse" data-r-debug-staff-rest-six>6 位员工同时休息</button><p class="rg-staff-note">主厨空闲时设为 1 点体力，下一道工序触发休息。预设和演练会清空测试订单、恢复员工体力，并暂停自然来客。演练临时开满 8 桌；仅影响本次测试存档。</p></details>`;
}

export function restaurantStaffDebugCommand(button) {
  if(button.hasAttribute('data-r-debug-unlock-staff'))return {mode:'unlock',staffId:RESTAURANT_STAFF.at(-1).id};
  if(button.hasAttribute('data-r-debug-unlock-recipes'))return {mode:'recipes'};
  if(button.hasAttribute('data-r-debug-guest'))return {mode:'guest',guestId:button.dataset.rDebugGuest};
  if(button.hasAttribute('data-r-debug-reset'))return {mode:'reset'};
  if(button.hasAttribute('data-r-debug-staff-unlock'))return {mode:'unlock',staffId:button.dataset.rDebugStaffUnlock};
  if(button.hasAttribute('data-r-debug-staff-preset'))return {mode:'preset',staff:Number(button.dataset.rDebugStaffPreset)};
  if(button.hasAttribute('data-r-debug-staff-stamina'))return {mode:'stamina'};
  if(button.hasAttribute('data-r-debug-staff-rest-six'))return {mode:'rest-six'};
  if(button.hasAttribute('data-r-debug-staff-rehearse'))return {mode:'rehearse'};
  return null;
}

/** UI adapter only; the isolated test engine owns the actual fixture mutation. */
export function createRestaurantStaffDebugger({enabled,availability,run,beforeChange=()=>{},afterChange=()=>{},message=()=>{}}) {
  return {handle(button){
    const command=restaurantStaffDebugCommand(button);
    if(!command)return false;
    if(!enabled()||typeof run!=='function')return true;
    const status=availability();
    if(status.pending||status.saving||!status.connected){message('上一项操作正在保存或连接尚未恢复，请稍后再测试。');return true;}
    beforeChange(command);
    let result;
    try{result=run(command);}catch{result={ok:false,message:'餐厅测试没有完成，请稍后重试。'};}
    if(result?.ok)afterChange(command,result);
    message(result?.message||'这项员工测试操作暂不可用。');
    return true;
  }};
}
