import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrowthBubbleView } from '../src/growth-ui.js';
import { GROWTH_STAGES } from '../src/growth-stages.js';

const reward = index => ({ id: `tap-reward-${index}`, kind: 'pet', amount: 3.6, actor: '男方', boosted: true, boostCount: 2 });
function fixture() {
  let rootWrites = 0, slotWrites = 0, slots = [], html = '';
  const count = { textContent: '' }, more = { hidden: true, setAttribute() {}, querySelector: () => count };
  const root = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value; rootWrites++;
      slots = Array.from({ length: 4 }, () => {
        let button = null, label = null;
        return { set innerHTML(markup) {
          slotWrites++;
          button = markup ? { disabled: / disabled(?: |$)/.test(markup.split('>')[0]), markup, id: markup.match(/data-growth-reward="([^"]+)"/)[1] } : null;
          label = markup ? { textContent: markup.match(/class="growth-label">([^<]*)/)[1] } : null;
        }, querySelector(selector) { return selector === 'button' ? button : label; } };
      });
    },
    querySelector(selector) { return selector === '.growth-more' ? more : slots[Number(selector.match(/"(\d)"/)[1])]; },
    replaceChildren() { html = ''; slots = []; rootWrites++; },
  };
  const view = createGrowthBubbleView(root);
  return { view, root, more, count, writes: () => ({ root: rootWrites, slots: slotWrites }), button: index => slots[index]?.querySelector('button'), label: index => slots[index]?.querySelector('.growth-label') };
}

test('pending state and duplicate snapshots preserve all bubble buttons and artwork nodes', () => {
  const f = fixture(), rewards = Array.from({ length: 6 }, (_, i) => reward(i));
  f.view.render(rewards, { stage: GROWTH_STAGES[0] });
  const buttons = [0, 1, 2, 3].map(f.button), writes = f.writes();
  for (let i = 0; i < 100; i++) f.view.render(rewards, { stage: GROWTH_STAGES[0], pendingRewardIds: new Set([rewards[0].id]) });
  assert.deepEqual(f.writes(), writes);
  for (const [index, button] of buttons.entries()) assert.equal(f.button(index), button);
  assert.equal(f.button(0).disabled, true); assert.equal(f.label(0).textContent, '领取中…');
  assert.equal(f.button(1).disabled, false); assert.equal(f.label(1).textContent, '摸摸');
  assert.equal(f.count.textContent, '+2'); assert.equal(f.more.hidden, false);
});

test('claiming one bubble only replaces its slot and leaves the other three in place', () => {
  const f = fixture(), rewards = Array.from({ length: 6 }, (_, i) => reward(i)); f.view.render(rewards);
  const before = [0, 1, 2, 3].map(f.button), writes = f.writes();
  f.view.render(rewards.slice(1));
  assert.equal(f.button(0).id, rewards[4].id);
  for (const index of [1, 2, 3]) assert.equal(f.button(index), before[index]);
  assert.equal(f.writes().root, writes.root); assert.equal(f.writes().slots, writes.slots + 1);
  f.view.render(rewards.slice(2)); assert.equal(f.more.hidden, true);
});

test('rollback restores collectability, while a real stage or amount change refreshes its artwork', () => {
  const f = fixture(), rewards = [reward(0), reward(1)]; f.view.render(rewards, { blocked: true, stage: GROWTH_STAGES[0] });
  const original = f.button(0); assert.equal(original.disabled, true);
  f.view.render(rewards, { stage: GROWTH_STAGES[0] }); assert.equal(f.button(0), original); assert.equal(original.disabled, false);
  f.view.render([{ ...rewards[0], amount: 3.9 }, rewards[1]], { stage: GROWTH_STAGES[0] });
  assert.notEqual(f.button(0), original); assert.match(f.button(0).markup, /\+3.9/);
  const next = f.button(1); f.view.render(rewards, { stage: GROWTH_STAGES[1] }); assert.notEqual(f.button(1), next);
  f.view.render([]); assert.equal(f.root.innerHTML, '');
  f.view.render(rewards); assert.equal(f.button(0).id, rewards[0].id);
});

test('a burst of distinct claims creates each replacement once instead of rebuilding every neighbor', () => {
  const f = fixture(), rewards = Array.from({ length: 100 }, (_, i) => reward(i));
  f.view.render(rewards); const initial = f.writes();
  for (let i = 1; i <= 96; i++) f.view.render(rewards.slice(i));
  assert.equal(f.writes().root, 1);
  assert.equal(f.writes().slots - initial.slots, 96);
  assert.equal(f.more.hidden, true);
});

test('restaurant receipts keep one upper-left icon while its total grows and care nodes stay intact',()=>{
  const f=fixture(),income=(index,amount)=>({id:`income-reward-${index}`,kind:'restaurant-collect',amount,actor:'男方'}),rewards=[income(0,8.1),reward(0),reward(1)];
  f.view.render(rewards);assert.equal(f.button(0).id,'restaurant-income-total');assert.match(f.button(0).markup,/\+8.1/);const care=f.button(1);
  f.view.render([...rewards,income(1,9.2)]);assert.match(f.button(0).markup,/\+17.3/);assert.equal(f.button(1),care);assert.equal(f.more.hidden,true);
  f.view.render(rewards.filter(r=>r.kind!=='restaurant-collect'));assert.equal(f.button(1),care);assert.notEqual(f.button(0)?.id,'restaurant-income-total');
});
