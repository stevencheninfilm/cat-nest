import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { HOME_ENTRIES, initialHomeState } from '../src/home-context.js';
import { demoSeed, createDemoEngine } from '../demo/engine.js';
import { createMemoryStorage } from '../demo/storage.js';
import { restaurantStaffDebugResult } from '../demo/restaurant-staff.js';
import { isNewPet } from '../src/home-bond.js';

const NOW=1_800_000_000_000;

test('new homes and the prepared test visit start with exactly 100 fish',()=>{
  assert.equal(initialState(NOW).coins,100);
  assert.equal(isNewPet(initialState(NOW)),true);
  assert.equal(isNewPet({...initialState(NOW),coins:1200}),true,'a legacy untouched pet remains adoptable with its original wallet');
  for(const home of HOME_ENTRIES)assert.equal(initialHomeState(home,NOW).coins,100,home.id);
  const demo=demoSeed(NOW);
  assert.equal(demo.coins,100);assert.equal(demo.feedRecords.length,2);assert.equal(demo.pendingGrowth.length,3);
  const engine=createDemoEngine({storage:createMemoryStorage(),now:()=>NOW});
  assert.equal(engine.snapshot().state.coins,100);engine.scenario('unlock');engine.reset();
  assert.equal(engine.snapshot().state.coins,100);
});

test('loading existing wallets preserves their balance and terminal reset never refills it',()=>{
  for(const coins of [0,37,100,1200,11960,999999]){
    const saved={...initialState(NOW),coins};
    assert.equal(normalizeState(JSON.parse(JSON.stringify(saved)),NOW+1000).coins,coins);
    const reset=restaurantStaffDebugResult(saved,{mode:'reset'},NOW+1000);
    assert.equal(reset.ok,true);assert.equal(reset.state.coins,coins);
  }
  const fed=reduceAction(initialState(NOW),{type:'feed',food:'water'},{id:'wallet-test-client',name:'店长'},NOW);
  assert.equal(fed.coins,95);
  assert.equal(normalizeState(JSON.parse(JSON.stringify(fed)),NOW+1000).coins,95);
});
