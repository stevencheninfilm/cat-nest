import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ENTRIES, homeContext } from '../src/home-context.js';
import { initialState } from '../src/state.js';
import { restaurantMarkup, restaurantTerminalAllowed } from '../src/restaurant-ui.js';

test('only test save URLs allow the restaurant terminal, in every supported path form',()=>{
  for(const home of HOME_ENTRIES)for(const prefix of ['','/cat-nest'])for(const suffix of ['','/','/index.html']){
    const context=homeContext(`${prefix}/${home.id}${suffix}`),expected=home.id==='test';
    assert.equal(restaurantTerminalAllowed({isTest:context.isTest}),expected,`${prefix}/${home.id}${suffix}`);
    const html=restaurantMarkup(initialState(),{isTest:context.isTest,debugEnabled:true});
    assert.equal(html.includes('data-r-tab="terminal"'),expected);
    assert.equal(html.includes('id="rg-terminal"'),expected);
    assert.equal(html.includes('data-r-terminal-panel'),expected);
    assert.ok(html.includes('data-r-audio-open'),'normal player controls remain available');
  }
});

test('a caller cannot enable the terminal on normal, unknown or default saves',()=>{
  for(const isTest of [false,undefined,null,'true',1]){
    assert.equal(restaurantTerminalAllowed({isTest,debugEnabled:true}),false);
    assert.doesNotMatch(restaurantMarkup(initialState(),{isTest,debugEnabled:true}),/data-r-tab="terminal"|id="rg-terminal"/);
  }
  for(const path of ['/cat-nest/','/cat-nest/unknown/','/monitor/'])assert.equal(restaurantTerminalAllowed({isTest:homeContext(path).isTest,debugEnabled:true}),false);
  assert.equal(restaurantTerminalAllowed({isTest:true,debugEnabled:false}),false);
  assert.equal(restaurantTerminalAllowed({isTest:true}),true);
});
