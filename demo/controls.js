import './demo.css';
import { WORLD_EXPLORATION_ENABLED, WORLD_LOCK_MESSAGE } from '../src/feature-availability.js';
import { demoEngine, demoCourt } from './transport.js';
import { demoLocalStorage, demoSessionStorage, demoPreferences } from './storage.js';

document.documentElement.classList.add('demo-mode');
document.title='测试调试 · 猫猫小窝';
const badge=document.createElement('button');
badge.className='demo-launcher'; badge.type='button';
badge.innerHTML='<span class="demo-launcher-icon" aria-hidden="true">✦</span><span><strong>演示控制台</strong><small>全部玩法 · 一键解锁</small></span><span class="demo-launcher-arrow" aria-hidden="true">›</span>';
badge.setAttribute('aria-label','打开独立演示控制台');
const panel=document.createElement('dialog'); panel.className='demo-console';
panel.setAttribute('aria-label','独立演示控制台');
panel.innerHTML=`<div class="demo-console-heading"><div><small>CAT NEST · DEMO 2026.10.15</small><h2>随时带朋友来看看</h2></div><button data-demo="close" aria-label="关闭演示控制台">×</button></div>
<p class="demo-intro">伙伴是模拟玩家，法庭使用虚构示例。进度仅本次体验有效，刷新或重新进入会恢复默认。</p>
<div class="demo-shortcuts"><button data-shortcut="feeding">🍽️ 喂食</button><button data-shortcut="appearance">🎨 装扮</button><button data-shortcut="nest">🏡 布置小窝</button><button data-shortcut="stages">💛 成长</button><button data-shortcut="games">🎲 小游戏</button><button data-shortcut="shared-care">💑 双人照顾</button><button data-shortcut="collection">🐈 猫猫图鉴</button><button data-shortcut="diary">📔 日记</button></div>
<section><h3>一分钟看效果</h3><div class="demo-buttons"><button data-demo="new-home">从第一次养猫开始</button><button data-demo="unlock">解锁成长与基础图鉴</button><button data-demo="restaurant-decorations">解锁全部餐厅装扮</button><button data-demo="relay">伙伴摸摸 · 你来逗猫</button><button data-demo="feed">伙伴喂一份慕斯</button><button data-demo="portion">食物剩余 25%</button><button data-demo="court">查看示例判词</button><button data-demo="restaurant-income">餐厅经验累计</button><button data-demo="clear-limits">恢复体力与互动次数</button></div><p class="demo-status" role="status" id="demo-status">演示与正式存档完全隔离。</p></section>
<label class="demo-row">示例判词效果<select id="demo-ruling"><option value="similar">共同调整</option><option value="a_more">猫爪方责任较重</option><option value="b_more">鱼干方责任较重</option><option value="undetermined">等待补充证据</option><option value="boundaries">边界优先</option></select></label>
<section><h3>小窝时间与小事</h3><label class="demo-row">氛围预览<select id="demo-life-hour"><option value="auto">跟随设备本地时间</option><option value="8">08:00 · 早晨</option><option value="14">14:00 · 白天</option><option value="19">19:00 · 黄昏</option><option value="23">23:00 · 深夜</option></select></label><div class="demo-buttons"><button data-life-event="spill">预览打翻东西</button><button data-life-event="gift">预览发现礼物</button><button data-life-event="affection">预览突然撒娇</button></div><p class="demo-small">手动预览不写入小事记录。正常游玩时偶尔发生，在忙碌或睡觉时避让。</p></section>
<section><h3>响应调试</h3><label class="demo-row">模拟接口延迟<select id="demo-latency"><option value="0">即时</option><option value="650" selected>650 ms</option><option value="2500">2.5 秒 · 观察先动后存</option><option value="6000">6 秒 · 慢速网络</option></select></label><div class="demo-buttons"><button data-demo="reject">下一次操作失败 · 验证回退</button><button data-demo="offline">模拟断线</button><button data-demo="presence">模拟伙伴离开</button><button data-demo="logs">导出接口诊断</button></div><p class="demo-small">调试使用与正式版相同的互动、动画和请求队列逻辑。模拟接口不写入正式 GitHub 存档，也不调用付费 AI。双人小游戏由模拟伙伴自动接招。</p><pre id="demo-log" aria-label="最近演示接口记录"></pre></section>
<footer><button data-demo="guide">重新查看指引</button><button data-demo="reset">重置演示进度</button><small>宠物模型：Nekueda · Mage Cat · 已购授权运行素材</small></footer>`;
document.body.append(badge,panel);
if (!WORLD_EXPLORATION_ENABLED) {
  const shortcut=panel.querySelector('[data-shortcut="nest"]');
  shortcut.disabled=true; shortcut.textContent=`🔒 ${WORLD_LOCK_MESSAGE}`;
}
function openWelcome(){panel.close();window.dispatchEvent(new CustomEvent('catnest:onboarding',{detail:{restart:true}}));}
const note=text=>panel.querySelector('#demo-status').textContent=text;
badge.addEventListener('click',()=>{ panel.showModal(); updateLog(); });
panel.addEventListener('click',event=>{if(event.target===panel)panel.close();});
panel.querySelector('#demo-latency').addEventListener('change',event=>{demoEngine.controls.latency=Number(event.target.value);note(`接口延迟已设为 ${event.target.value} ms，关闭控制台后进行操作。`);});
panel.querySelector('#demo-life-hour').addEventListener('change',event=>window.dispatchEvent(new CustomEvent('catnest:life-preview',{detail:{hour:event.target.value==='auto'?null:Number(event.target.value)}})));
panel.addEventListener('click',event=>{const kind=event.target.closest('[data-life-event]')?.dataset.lifeEvent;if(!kind)return;panel.close();document.querySelector('#modal[open]')?.close();window.dispatchEvent(new CustomEvent('catnest:life-preview',{detail:{event:kind}}));});
function updateLog() { panel.querySelector('#demo-log').textContent=demoEngine.logs.slice(0,5).map(row=>`${row.method} ${row.path.replace('/api/rooms/','/rooms/').replace(/[a-f0-9]{32}/g,'demo')} → ${row.status}`).join('\n') || '尚无请求；选择身份后开始演示。'; }
panel.addEventListener('click',event=>{
  const target=event.target.closest('button'); if(!target)return;
  if(target.dataset.shortcut) {
    const selector=`[data-open="${target.dataset.shortcut}"]`, entry=document.querySelector(selector);
    if(document.querySelector('#modal[open] [data-couple-role]') || !demoLocalStorage.getItem('catnest.role')){note('先关闭控制台，在身份窗口选一位主人，再打开此入口。');return;}
    panel.close(); document.querySelector('#modal[open]')?.close(); entry?.click(); return;
  }
  const action=target.dataset.demo, role=JSON.parse(demoLocalStorage.getItem('catnest.role') || '"male"');
  if(action==='close'){panel.close();return;}
  if(action==='guide'){openWelcome();return;}
  if(action==='new-home'){if(!demoLocalStorage.getItem('catnest.role')){note('先选择一位主人，再开始新手体验。');return;}note(demoEngine.scenario('new-home',role));openWelcome();return;}
  if(action==='reject'){demoEngine.controls.rejectNext=true;note('已设置下一次请求失败。关闭控制台，点击气泡、摸摸或喂食，观察即时动画和失败回退。');return;}
  if(action==='offline'){demoEngine.setOffline(!demoEngine.controls.offline);target.textContent=demoEngine.controls.offline?'恢复网络':'模拟断线';note(demoEngine.controls.offline?'演示网络已断开。恢复后会自动核对并继续保存。':'演示网络已恢复。');return;}
  if(action==='presence'){demoEngine.controls.partnerOnline=!demoEngine.controls.partnerOnline;demoEngine.presence();target.textContent=demoEngine.controls.partnerOnline?'模拟伙伴离开':'模拟伙伴回家';note('伙伴在线状态已更新。');return;}
  if(action==='reset'){
    demoEngine.reset();
    for(const role of ['male','female'])demoLocalStorage.removeItem(`catnest.pending.preview.${role}`);
    const url=new URL(location.href);url.searchParams.delete('court');location.replace(url);return;
  }
  if(action==='court'){
    const court=demoCourt.showcase(panel.querySelector('#demo-ruling').value);demoSessionStorage.setItem(`catcourt.session.${court.id}`,JSON.stringify({token:'demo-a',role:'a'}));
    const url=new URL(location.href);url.searchParams.set('court',court.id);history.replaceState(null,'',url);
    panel.close();document.querySelector('#modal[open]')?.close();document.querySelector('[data-open="judge"]')?.click();return;
  }
  if(action==='logs'){
    const blob=new Blob([JSON.stringify({environment:'isolated-browser-demo',version:'2026.10.15',controls:demoEngine.controls,requests:demoEngine.logs},null,2)],{type:'application/json'});
    const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='cat-nest-demo-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);note('已导出接口状态和耗时配置，不含陈词、图片或正式存档。');return;
  }
  if(action) { note(demoEngine.scenario(action,role)); updateLog(); }
});
demoEngine.subscribe(()=>{if(panel.open)updateLog();});
// Keep a control entry available inside the app's native modal top layer.
const modal=document.querySelector('#modal');
function addModalEntry() {
  if(!modal)return;
  if(!modal.open || modal.querySelector('[data-demo-console-entry]'))return;
  const entry=document.createElement('button');entry.dataset.demoConsoleEntry='';entry.className='demo-modal-entry';entry.textContent='✦ 演示控制台 · 全部玩法';entry.addEventListener('click',()=>{panel.showModal();updateLog();});modal.append(entry);
}
if(modal){new MutationObserver(addModalEntry).observe(modal,{childList:true,attributes:true,attributeFilter:['open']});addModalEntry();}
// New-user guidance is provided by the shared application.
