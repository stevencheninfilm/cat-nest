import { formatAffection } from './affection.js';
import './local-save-monitor.css';
import { guideMonitorMarkup } from './monitor-guide-ui.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(value) ? new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(value) : '—';
const date=value=>Number.isFinite(value) ? new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(value) : '暂无记录';
const short=value=>value ? escape(value.slice(0,7)) : '未读取';
const root=document.querySelector('#monitor');
root.innerHTML=`<main class="observatory">
  <header class="monitor-header"><div><p class="eyebrow">CAT NEST · OBSERVATORY</p><h1><span class="brand-paw" aria-hidden="true">✿</span>小窝观察台</h1><p class="intro">线上存档近况与新手向导管理。</p></div><span class="local-badge"><i></i>本机专用 · 进度只读</span></header>
  <section class="monitor-summary" aria-label="存档概况" id="monitor-summary"><article><span>存档入口</span><strong>—</strong><small>正在读取配置</small></article><article><span>云端可读</span><strong>—</strong><small>正在连接</small></article><article><span>待领取气泡</span><strong>—</strong><small>不会自动领取</small></article><article><span>需要照顾</span><strong>—</strong><small>正在检查小猫状态</small></article></section>
  <section class="version-strip" id="monitor-version" aria-label="共用版本"><span class="status-dot loading"></span><span>正在核对共用版本…</span></section>
  <section class="monitor-toolbar" aria-label="筛选存档"><div class="toolbar-title"><h2>所有小窝</h2><span id="home-count"></span></div><div class="toolbar-controls"><label class="monitor-search"><span aria-hidden="true">⌕</span><input id="monitor-search" placeholder="搜索小窝或猫咪" aria-label="搜索小窝或猫咪" type="search"></label><select id="monitor-sort" aria-label="排序"><option value="registry">默认顺序</option><option value="level">等级从高到低</option><option value="recent">最近有更新</option></select><button class="refresh-button" id="monitor-refresh">刷新数据 <span aria-hidden="true">↻</span></button></div></section>
  <div class="monitor-filters" role="group" aria-label="状态筛选"><button data-filter="all" aria-pressed="true">全部</button><button data-filter="attention" aria-pressed="false">需要照顾</button><button data-filter="error" aria-pressed="false">读取异常</button><span id="monitor-time" role="status" aria-live="polite">首次采集约需几秒</span></div>
  <p class="monitor-error" id="monitor-error" role="alert" hidden></p>
  <section class="home-grid" id="home-grid" aria-label="存档列表" aria-busy="true"><div class="monitor-empty"><span class="loader"></span><h3>正在看看小猫们…</h3><p>只读取线上已保存的数据。</p></div></section>
  <footer class="monitor-footer"><span><i></i>每分钟自动刷新 · 云端快照缓存 30 秒</span><span>关闭此页后停止采集 · 时间使用设备时区</span></footer>
</main>`;

let snapshot=null,busy=false,timer=null,filter='all',search='',sort='registry';
let armedGuide=null,resettingGuide=null,resetOperation=null;
const statusLabel={ready:'云端可读',stale:'快照已过期',error:'暂不可读',temporary:'浏览器临时存档'};
const label={hunger:'饱饱',mood:'开心',energy:'活力'};
const icon={steven:'S',evian:'E',todd:'T',test:'✧'};

function homeCard(home) {
  const header=`<header class="home-card-header"><span class="home-avatar ${escape(home.id)}">${escape(icon[home.id] || home.label.slice(0,1))}</span><div><h3>${escape(home.label)}<span class="home-path">/${escape(home.id)}/</span></h3><span class="home-status ${escape(home.status)}"><i></i>${statusLabel[home.status] || '未知状态'}</span></div><a class="visit-link" href="${escape(home.href)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${escape(home.label)} 小窝">↗</a></header>`;
  if(home.status==='temporary')return `<article class="home-card temporary">${header}<div class="temporary-art" aria-hidden="true">✧<span>⌁</span>✧</div><h4>每次打开，都是新的开始</h4><p class="temporary-note">${escape(home.note)}</p><div class="temporary-meta"><span>同版功能</span><span>刷新重置</span><span>不写入云端</span></div></article>`;
  if(!home.level)return `<article class="home-card unavailable">${header}<div class="unavailable-body"><span aria-hidden="true">☁</span><h4>暂时联系不上这个小窝</h4><p>${escape(home.note)}</p><small>读取失败不会将原存档显示成 0 级或重置数据。</small></div>${guideMonitorMarkup(home,{enabled:snapshot.guideControl===true,armed:armedGuide,busy:resettingGuide})}</article>`;
  const progress=Math.max(0,Math.min(100,home.level.progress/home.level.target*100));
  return `<article class="home-card ${home.status==='stale' ? 'stale':''}" data-home="${escape(home.id)}">${header}
    ${home.status==='stale' ? `<p class="stale-note">${escape(home.note)} 采集于 ${date(home.sampledAt)}</p>`:''}
    <div class="pet-overview"><div><span class="small-label">${escape(home.name)}${home.sleeping ? ' · 休息中':''}</span><strong class="level-number"><small>Lv.</small>${number(home.level.level)}</strong></div><div class="coin-total"><span class="coin-icon" aria-hidden="true">✦</span><strong>${number(home.coins)}</strong><small>猫爪币</small></div></div>
    <div class="xp-caption"><span>等级进度</span><strong>${number(home.level.progress)} <span>/ ${number(home.level.target)}</span></strong></div><div class="xp-track" role="progressbar" aria-label="等级进度" aria-valuemin="0" aria-valuemax="${home.level.target}" aria-valuenow="${home.level.progress}"><span style="width:${progress}%"></span></div>
    <div class="pet-needs">${Object.entries(home.needs).map(([key,value])=>`<div class="need ${value<30 ? 'low':''}"><span>${label[key]}</span><strong>${number(value)}<small>/100</small></strong><div><i style="width:${value}%"></i></div></div>`).join('')}</div>
    <div class="home-small-stats"><span>已领取成长<strong>${number(home.xp)}</strong></span><span>亲密度<strong>${formatAffection(home.love)}</strong></span><span>图鉴入住<strong>${number(home.cats)}</strong></span><span>待领取<strong class="pending-amount">${number(home.pending.count)} 个<small> +${number(home.pending.amount)}</small></strong></span></div>
    <div class="home-meals">${home.meals.map(meal=>`<span><b>${escape(meal.label)}</b><span class="${meal.fed ? 'fed':''}">${meal.fed ? '本轮已喂':meal.food ? '上餐未结束':'本轮未喂'}</span><small>${meal.food ? `${escape(meal.food)} · ${Math.max(0,Math.ceil((meal.expiresAt-Date.now())/60_000))} 分钟`:'餐盘空空'}</small></span>`).join('')}</div>
    ${guideMonitorMarkup(home,{enabled:snapshot.guideControl===true,armed:armedGuide,busy:resettingGuide})}
    <footer class="home-card-footer"><span>照顾者 ${home.owners.filter(owner=>owner.joined).length}/2 · 修订 ${number(home.revision)}</span><time title="最后保存时间">${date(home.updatedAt)}</time></footer>
  </article>`;
}

function renderHomes() {
  if(!snapshot)return;
  let homes=snapshot.entries.filter(home=>`${home.label} ${home.id} ${home.name || ''}`.toLowerCase().includes(search));
  homes=homes.filter(home=>filter==='all' || (filter==='attention' ? home.attention : ['error','stale'].includes(home.status)));
  homes.sort((a,b)=>Number(a.status==='temporary')-Number(b.status==='temporary') || (sort==='level' ? (b.level?.level || 0)-(a.level?.level || 0) : sort==='recent' ? (b.updatedAt || 0)-(a.updatedAt || 0) : 0));
  document.querySelector('#home-count').textContent=`${homes.length} 个存档`;
  document.querySelector('#home-grid').innerHTML=homes.map(homeCard).join('') || '<div class="monitor-empty"><h3>没有符合条件的小窝</h3><p>试试其他名字或筛选条件。</p></div>';
  for(const button of document.querySelectorAll('[data-filter]'))button.setAttribute('aria-pressed',String(button.dataset.filter===filter));
}
function renderSnapshot() {
  const formal=snapshot.entries.filter(home=>home.status!=='temporary');
  const pending=formal.reduce((sum,home)=>sum+(home.pending?.count || 0),0),attention=formal.filter(home=>home.attention).length,ready=formal.filter(home=>home.status==='ready').length;
  document.querySelector('#monitor-summary').innerHTML=`<article><span>存档入口</span><strong>${snapshot.entries.length}<small>个</small></strong><small>${formal.length} 个云端 · ${snapshot.entries.length-formal.length} 个临时</small></article><article><span>云端可读</span><strong>${ready}<small>/ ${formal.length}</small></strong><small>接口${snapshot.health.ok ? '运行正常':'暂不可用'} · 非玩家在线人数</small></article><article><span>待领取气泡</span><strong>${number(pending)}<small>个</small></strong><small>与已领取成长分别统计</small></article><article class="${attention ? 'has-attention':''}"><span>需要照顾</span><strong>${attention}<small>只</small></strong><small>任一状态低于 30 时提醒</small></article>`;
  const version=snapshot.version;
  document.querySelector('#monitor-version').innerHTML=`<span class="status-dot ${version.synced ? '':'warning'}"></span><strong>${version.synced ? '所有入口使用同一功能版本':'共用版本暂未对齐'}</strong><span class="version-values">前端 <code>${short(version.frontend)}</code><i>·</i>后端 <code>${short(version.backend)}</code></span><span class="version-note">存档数据各自独立</span>`;
  document.querySelector('#monitor-time').textContent=`快照采集 ${date(snapshot.generatedAt)}`;
  renderHomes();
}
function schedule() {clearTimeout(timer);timer=setTimeout(()=>{if(document.hidden)schedule();else refresh();},60_000);}
async function refresh() {
  if(busy||resettingGuide)return;
  busy=true;const button=document.querySelector('#monitor-refresh');button.disabled=true;button.textContent='正在读取…';
  const error=document.querySelector('#monitor-error');error.hidden=true;
  try {
    const response=await fetch('/__monitor/snapshot',{method:'GET',cache:'no-store',signal:AbortSignal.timeout(12_000)});
    if(!response.ok)throw new Error();
    const next=await response.json();if(!Array.isArray(next.entries) || !next.version || !next.health)throw new Error();
    snapshot=next;renderSnapshot();
  } catch {
    error.textContent=snapshot ? '本次刷新失败，正在显示上次采集的快照。可稍后重试。':'暂时无法读取监测数据。请确认共享本地预览仍在运行，然后重试。';error.hidden=false;
    if(!snapshot)document.querySelector('#home-grid').innerHTML='<div class="monitor-empty"><h3>暂未获得存档快照</h3><p>请点击“刷新数据”重试，现有存档不会受到影响。</p></div>';
  } finally {busy=false;button.disabled=false;button.innerHTML='刷新数据 <span aria-hidden="true">↻</span>';document.querySelector('#home-grid').setAttribute('aria-busy','false');schedule();}
}
document.querySelector('#monitor-refresh').addEventListener('click',refresh);
document.querySelector('#home-grid').addEventListener('click',async event=>{
  const button=event.target.closest('[data-guide-reset]');if(!button||button.disabled||resettingGuide||busy)return;
  const action=button.dataset.guideReset;
  if(action==='cancel'){armedGuide=null;resetOperation=null;renderHomes();return;}
  const home=snapshot?.entries.find(home=>home.id===button.dataset.home),role=button.dataset.role;
  const record=home?.guide?.roles?.[role];if(!record||!snapshot.guideControl||home.guide.status!=='ready')return;
  const key=`${home.id}:${role}`;
  if(action==='arm'){armedGuide=key;resetOperation=crypto.randomUUID();renderHomes();return;}
  if(action!=='confirm'||armedGuide!==key||!resetOperation)return;
  resettingGuide=key;renderHomes();const error=document.querySelector('#monitor-error');error.hidden=true;
  try {
    const response=await fetch('/__monitor/guide-reset',{method:'POST',headers:{'Content-Type':'application/json','X-Monitor-Token':document.querySelector('meta[name="monitor-token"]').content},body:JSON.stringify({home:home.id,role,expectedGeneration:record.generation,operationId:resetOperation}),signal:AbortSignal.timeout(25_000)});
    const value=await response.json();if(!response.ok||value.record?.generation!==record.generation+1)throw Error();
    home.guide.roles[role]=value.record;armedGuide=null;resetOperation=null;
    document.querySelector('#monitor-time').textContent=`已安排 ${home.label} · ${role==='male'?'男方':'女方'} 下次进入重新引导`;
  } catch {error.textContent='重播设定尚未确认，请刷新状态再重试；游戏存档没有改动。';error.hidden=false;}
  finally{resettingGuide=null;renderHomes();schedule();}
});
document.querySelector('#monitor-search').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();renderHomes();});
document.querySelector('#monitor-sort').addEventListener('change',event=>{sort=event.target.value;renderHomes();});
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;renderHomes();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden && (!snapshot || Date.now()>=snapshot.refreshAfter))refresh();});
window.addEventListener('pagehide',()=>clearTimeout(timer));
refresh();
