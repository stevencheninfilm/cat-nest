import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoom } from '../src/cloud.js';
import { reduceAction } from '../src/state.js';
import { suggestNestPlacement } from '../src/nest-decor.js';
import { createMemoryStorage } from '../demo/storage.js';
import { createDemoEngine } from '../demo/engine.js';
import { demoEngine, demoFetch, DemoEventSource, DEMO_ORIGIN } from '../demo/transport.js';

test('the shared app decorates through the test adapter, reaches both roles and resets on a fresh visit', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('test decoration must never contact a real server'); });
  demoEngine.reset();
  demoEngine.controls.latency = 0;
  const players = [];
  function player(role) {
    let latest, settled;
    const client = createCloudRoom({
      apiBase:DEMO_ORIGIN, coupleRole:role,
      fetchImpl:demoFetch, eventSourceFactory:url => new DemoEventSource(url),
      optimisticReducer:reduceAction,
      onRoom() {}, onPresence() {}, onStatus() {}, onPending() {}, onAction() {},
      onState(value) { latest = value; },
      onSaveStatus(value) { if (['saved','error'].includes(value.phase)) settled?.(value); },
    });
    t.after(() => client.destroy());
    const result = {
      client, state:() => latest,
      async send(action, phase='saved') {
        const done = new Promise((resolve,reject) => {
          const timeout = setTimeout(() => reject(Error('test save did not settle')), 3000);
          settled = value => { clearTimeout(timeout); settled=null; resolve(value); };
        });
        assert.equal(client.dispatch(action), true);
        assert.equal((await done).phase, phase);
      },
    };
    players.push(result);
    return result;
  }
  const male=player('male'), female=player('female');
  await male.client.start(); await female.client.start();
  const baseline=structuredClone(male.state());
  await male.send({type:'nest-buy',item:'cushion'});
  const pose=suggestNestPlacement(male.state().nest,'cushion');
  assert.ok(pose);
  await male.send({type:'nest-place',item:'cushion',...pose});
  await female.send({type:'nest-palette',palette:'mint'});
  await male.send({type:'nest-upgrade',level:2});
  await female.send({type:'sleep',furniture:'cushion'});
  assert.equal(male.state().sleeping,true);
  assert.ok(male.state().pendingGrowth.some(reward=>reward.furniture==='cushion'));
  await female.send({type:'nest-store',item:'cushion'});
  assert.equal(male.state().nest.placements.some(p=>p.item==='cushion'),false);
  assert.equal(male.state().nest.palette,'mint');
  assert.equal(male.state().nest.level,2);
  assert.equal(male.state().coins,baseline.coins-100-280);
  assert.deepEqual(male.state().nest,female.state().nest);
  assert.equal(male.state().nest.lastEdit.actor,'女方');

  const beforeRejection=structuredClone(male.state().nest);
  demoEngine.controls.rejectNext=true;
  await male.send({type:'nest-palette',palette:'peach'},'error');
  assert.deepEqual(male.state().nest,beforeRejection);
  assert.deepEqual(female.state().nest,beforeRejection);

  const fresh=createDemoEngine({storage:createMemoryStorage()}).snapshot().state;
  assert.equal(fresh.nest.level,1);
  assert.equal(fresh.nest.palette,'honey');
  assert.equal(fresh.nest.owned.includes('cushion'),false);
  assert.equal(fresh.nest.placements.length,5);
  assert.equal(fresh.coins,baseline.coins);
});
