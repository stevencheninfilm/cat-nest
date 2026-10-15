import test from 'node:test';
import assert from 'node:assert/strict';
import { homeLoadingMarkup, homeLoadingState, updateHomeLoading } from '../src/home-loading.js';

const online={entered:true,configured:true,phase:'online',snapshotReady:true,modelPhase:'ready'};

function fixture() {
  const classes=new Set(),nodes=new Map();
  for(const key of ['icon','title','detail','track','retry']) {
    const attributes=new Map();
    let text='',writes=0;
    nodes.set(`.home-loading-${key}`,{
      hidden:false,
      get textContent(){return text;},set textContent(value){text=value;writes++;},get writes(){return writes;},
      getAttribute:name=>attributes.get(name)??null,setAttribute:(name,value)=>attributes.set(name,value),
    });
  }
  const element={hidden:true,dataset:{},querySelector:selector=>nodes.get(selector),closest:()=>({classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);}}})};
  return {element,classes,node:key=>nodes.get(`.home-loading-${key}`)};
}

test('waiting feedback begins after role selection and tracks the saved snapshot and live connection',()=>{
  assert.equal(homeLoadingState({...online,entered:false,phase:'connecting'}),null);
  const waiting=homeLoadingState({...online,phase:'connecting',snapshotReady:false});
  assert.equal(waiting.state,'connecting');assert.match(waiting.detail,/首次连接可能需要约一分钟/);
  assert.equal(homeLoadingState({...online,phase:'connecting'}).state,'syncing');
  assert.equal(homeLoadingState({...online,snapshotReady:false}).state,'syncing');
  assert.equal(homeLoadingState(online),null);
});

test('the loader waits for both cloud and model in either completion order',()=>{
  assert.equal(homeLoadingState({...online,phase:'connecting',modelPhase:'ready'}).state,'syncing');
  assert.equal(homeLoadingState({...online,modelPhase:'loading'}).state,'model');
  assert.equal(homeLoadingState({...online,phase:'connecting',snapshotReady:false,modelPhase:'loading'}).state,'connecting');
  assert.equal(homeLoadingState(online),null);
});

test('initial connection failure stops the bar and offers retry rather than waiting forever',()=>{
  const f=fixture();
  updateHomeLoading(f.element,{...online,phase:'error',snapshotReady:false});
  assert.equal(f.element.hidden,false);assert.equal(f.element.dataset.state,'error');
  assert.equal(f.node('track').hidden,true);assert.equal(f.node('retry').hidden,false);
  assert.match(f.node('detail').textContent,/原存档会保留/);
  updateHomeLoading(f.element,{...online,phase:'connecting',snapshotReady:false});
  assert.equal(f.node('track').hidden,false);assert.equal(f.node('retry').hidden,true);
  updateHomeLoading(f.element,online);
  assert.equal(f.element.hidden,true);assert.equal(f.classes.size,0);
});

test('a lost connection or full room has clear recovery feedback',()=>{
  const offline=homeLoadingState({...online,phase:'offline'});
  assert.equal(offline.retry,true);assert.match(offline.title,/恢复连接/);
  const full=homeLoadingState({...online,phase:'full'});
  assert.equal(full.state,'error');assert.match(full.detail,/已有两位猫友在线/);
});

test('model failure releases the loading overlay for the fallback and existing model retry',()=>{
  const f=fixture();
  updateHomeLoading(f.element,{...online,configured:false,modelPhase:'loading'});
  assert.equal(f.element.dataset.state,'model');assert.ok(f.classes.has('is-home-loading'));
  updateHomeLoading(f.element,{...online,configured:false,modelPhase:'error'});
  assert.equal(f.element.hidden,true);assert.equal(f.classes.size,0);
  assert.equal(homeLoadingState({...online,modelPhase:'error'}),null);
});

test('indeterminate progress has an accessible stage, no invented percentage and no repeated announcements',()=>{
  const markup=homeLoadingMarkup();
  assert.match(markup,/role="status" aria-live="polite" aria-atomic="true" hidden/);
  assert.match(markup,/role="progressbar" aria-label="小窝加载进度"/);
  assert.doesNotMatch(markup,/aria-valuenow|\d+%/);
  const f=fixture(),options={...online,phase:'connecting',snapshotReady:false};
  updateHomeLoading(f.element,options);
  assert.equal(f.node('track').getAttribute('aria-valuetext'),'正在连接小窝…');
  const writes=f.node('title').writes;
  updateHomeLoading(f.element,options);
  assert.equal(f.node('title').writes,writes);
});
