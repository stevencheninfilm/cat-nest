const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseLabel={unknown:'未上报',legacy:'曾看过 · 旧本机记录',shown:'已弹出',paused:'已暂停 / 跳过',completed:'已完成'};
export function guideMonitorMarkup(home,{enabled=false,armed=null,busy=null}={}) {
  if(home.status==='temporary')return '';
  if(home.guide?.status!=='ready')return '<section class="home-guide"><h4>新手向导</h4><p>向导记录暂不可读，不能据此判断玩家是否看过。</p></section>';
  return `<section class="home-guide" aria-label="新手向导状态"><h4>新手向导 <small>按身份记录</small></h4>${['male','female'].map(role=>{
    const record=home.guide.roles?.[role];if(!record)return '';
    const key=`${home.id}:${role}`,pending=record.generation>0&&record.phase==='unknown',label=role==='male'?'男方':'女方';
    const time=record.shownAt?new Date(record.shownAt).toLocaleString('zh-CN',{hour12:false}):null;
    return `<div class="guide-owner"><div><b>${label}</b><span class="guide-phase ${pending?'pending':''}">${pending?'待重播 · 下次进入':phaseLabel[record.phase]||'未知'}</span>${time?`<small>最近弹出 ${esc(time)}</small>`:''}</div>${armed===key?`<div class="guide-reset-confirm"><p>仅重置${label}的指引，下次进入从头开始，游戏进度保留。</p><button data-guide-reset="confirm" data-home="${esc(home.id)}" data-role="${role}" ${busy?'disabled':''}>${busy===key?'正在保存设定…':'确认，下次重播'}</button><button data-guide-reset="cancel" ${busy?'disabled':''}>取消</button></div>`:`<button data-guide-reset="arm" data-home="${esc(home.id)}" data-role="${role}" ${!enabled||pending||busy?'disabled':''}>${pending?'已安排重播':'下次重新引导'}</button>`}</div>`;
  }).join('')}<p class="guide-record-note">“未上报”不等于没看过；旧设备首次回传后才会补记。${enabled?'':'本机管理密钥未就绪，暂不能重置。'}</p></section>`;
}
