import test from 'node:test';
import assert from 'node:assert/strict';
import { createYardCamera, isYardPan } from '../src/catbook-camera.js';

const camera=(width=390,height=844)=>({clientWidth:width,clientHeight:height,scrollWidth:height*1.5,scrollLeft:0,scrollTop:0});

test('cat taps tolerate small jitter and vertical hand movement',()=>{
  for(const [dx,dy] of [[0,0],[5,7],[-8,0],[9,3],[2,12],[10,15],[-12,-12]]) assert.equal(isYardPan(dx,dy),false);
});

test('deliberate horizontal drags pan the yard in either direction',()=>{
  for(const [dx,dy] of [[10,0],[-10,2],[25,8],[-100,35]]) assert.equal(isYardPan(dx,dy),true);
});

test('a new yard starts horizontally centered and never restores vertical cropping',()=>{
  const view=createYardCamera(), target=camera();
  target.scrollTop=148;
  view.restore(target,'station');
  assert.equal(target.scrollLeft,438);
  assert.equal(target.scrollTop,0);
});

test('each scene remembers its own horizontal pan after a redraw',()=>{
  const view=createYardCamera(), station=camera();
  view.restore(station,'station');
  station.scrollLeft=219;
  view.remember(station,'station');
  const garden=camera(390,900);
  garden.scrollWidth=426;
  view.restore(garden,'garden');
  assert.equal(garden.scrollLeft,18);
  garden.scrollLeft=36;
  view.remember(garden,'garden');
  const redrawn=camera();
  view.restore(redrawn,'station');
  assert.equal(redrawn.scrollLeft,219);
  view.restore(garden,'garden');
  assert.equal(garden.scrollLeft,36);
});

test('toolbar height changes preserve the pan even if the browser first clamps it',()=>{
  const view=createYardCamera(), target=camera();
  view.restore(target,'station');
  target.scrollLeft=876;
  view.remember(target,'station');
  target.clientHeight=650;
  target.scrollWidth=975;
  target.scrollLeft=585;
  target.scrollTop=80;
  view.remember(target,'station');
  assert.equal(view.resize(target,'station'),true);
  assert.equal(target.scrollLeft,585);
  assert.equal(target.scrollTop,0);
  target.clientHeight=844;
  target.scrollWidth=1266;
  assert.equal(view.resize(target,'station'),true);
  assert.equal(target.scrollLeft,876);
  assert.equal(view.resize(target,'station'),false);
});

test('width changes keep the same relative horizontal framing',()=>{
  const view=createYardCamera(), target=camera();
  view.restore(target,'station');
  target.scrollLeft=219;
  view.remember(target,'station');
  target.clientWidth=460;
  view.resize(target,'station');
  assert.equal(target.scrollLeft,201.5);
});

test('a map that temporarily fits the phone retains its previous pan preference',()=>{
  const view=createYardCamera(), target=camera(390,900);
  target.scrollWidth=426;
  view.restore(target,'garden');
  target.scrollLeft=36;
  view.remember(target,'garden');
  target.clientHeight=700;
  target.clientWidth=331;
  target.scrollWidth=331;
  target.scrollLeft=0;
  view.resize(target,'garden');
  view.remember(target,'garden');
  assert.equal(target.scrollLeft,0);
  target.clientHeight=900;
  target.clientWidth=390;
  target.scrollWidth=426;
  view.resize(target,'garden');
  assert.equal(target.scrollLeft,36);
});
