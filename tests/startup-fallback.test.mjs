import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {namedHomeHtml} from '../scripts/named-home-entry.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function startup(){
  const message={textContent:'正在打开小窝…'};
  const retry={hidden:true,addEventListener:(name,fn)=>{retry.click=fn;}};
  const listeners={},timers=[];let alive=true,reloads=0;
  vm.runInNewContext(inline,{document:{getElementById:id=>alive?({'app-startup-message':message,'app-startup-retry':retry}[id]):null},location:{reload:()=>reloads++},window:{setTimeout:(fn,ms)=>timers.push({fn,ms}),addEventListener:(name,fn)=>listeners[name]=fn}});
  return {message,retry,listeners,timers,reloads:()=>reloads,ready:()=>{alive=false;}};
}
test('a slow or failed entry offers a manual same-save reload without clearing storage',()=>{
  const app=startup();assert.equal(app.retry.hidden,true);
  assert.equal(app.timers[0].ms,12000);app.timers[0].fn();
  assert.equal(app.retry.hidden,false);assert.match(app.message.textContent,/加载较慢/);
  assert.equal(app.reloads(),0);app.retry.click();assert.equal(app.reloads(),1);
  assert.doesNotMatch(inline,/localStorage|sessionStorage|location\.replace|location\.assign/);
  for(const event of [{target:{id:'app-entry'}},{target:{tagName:'LINK'}},{error:new Error('module failed')}]){
    const failed=startup();failed.listeners.error(event);assert.equal(failed.retry.hidden,false);
  }
  const rejected=startup();rejected.listeners.unhandledrejection();assert.equal(rejected.retry.hidden,false);
});
test('finished application cannot be replaced by an old timeout or unrelated runtime error',()=>{
  const app=startup();app.ready();app.timers[0].fn();app.listeners.error({error:new Error('later')});
  app.listeners.unhandledrejection();assert.equal(app.retry.hidden,true);assert.equal(app.reloads(),0);
});
test('startup shell is shared by named entries and fonts require no Google runtime host',()=>{
  assert.match(html,/<main id="app-startup"[\s\S]*正在打开小窝/);
  assert.match(namedHomeHtml(html),/<base href="\.\.\/">/);
  assert.doesNotMatch(html,/href=""/,'retry must not navigate through the named-entry base URL');
  const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(css,/font-display:swap/);assert.match(css,/nunito-latin-variable\.woff2/);
  assert.match(readFileSync(new URL('../src/assets/fonts/Nunito-OFL.txt',import.meta.url),'utf8'),/SIL OPEN FONT LICENSE/);
});
