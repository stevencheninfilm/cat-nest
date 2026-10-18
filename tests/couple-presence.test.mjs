import test from 'node:test';
import assert from 'node:assert/strict';
import { COUPLE_ROLES } from '../src/couple-profile.js';
import { presenceForRole, connectionSummary } from '../src/couple-presence-ui.js';

const [male, female] = COUPLE_ROLES;
const connected = { configured:true, entered:true, phase:'online', known:true, members:[{ id:male.clientId }] };

test('only a received live roster distinguishes online from offline', () => {
  assert.equal(presenceForRole(male, connected).state, 'online');
  assert.equal(presenceForRole(female, connected).state, 'offline');
  assert.equal(presenceForRole(male, { ...connected, members:[{ id:'some-other-browser' }] }).state, 'offline');
  for (const role of COUPLE_ROLES) {
    assert.equal(presenceForRole(role, { ...connected, known:false }).state, 'unknown');
    assert.equal(presenceForRole(role, { ...connected, entered:false }).state, 'unknown');
  }
});

test('a broken connection never reports stale online members or a falsely offline partner', () => {
  for (const phase of ['offline','error','full','connecting']) {
    for (const role of COUPLE_ROLES) assert.equal(presenceForRole(role, { ...connected, phase }).state, 'unknown');
  }
  assert.equal(presenceForRole(male, { ...connected, configured:false }).state, 'local');
});

test('the compact summary counts identities rather than tabs and separates pending saves', () => {
  const options = { ...connected, members:[{ id:male.clientId },{ id:male.clientId },{ id:female.clientId }] };
  assert.equal(connectionSummary(options), '2 人在线 · 互动自动保存');
  assert.equal(connectionSummary({ ...options, savePhase:'saving' }), '2 人在线 · 互动自动保存');
  assert.equal(connectionSummary({ ...options, savePhase:'error' }), '2 人在线 · 保存待确认');
  assert.equal(connectionSummary({ ...options, phase:'offline' }), '连接中断 · 在线状态待确认');
});
