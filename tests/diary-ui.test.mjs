import test from 'node:test';
import assert from 'node:assert/strict';
import { diaryTimeline } from '../src/diary-ui.js';

test('daily timeline groups across local midnight, sorts newest first and preserves role colors', () => {
  const now = new Date(2026, 9, 14, 12).getTime();
  const history = [
    { actor:'男方', text:'昨晚陪它玩', at:new Date(2026, 9, 13, 23, 59).getTime() },
    { actor:'女方', text:'凌晨喂食', at:new Date(2026, 9, 14, 0, 1).getTime() },
    { actor:'男方', text:'中午摸摸', at:new Date(2026, 9, 14, 11, 30).getTime() },
  ];
  const snapshot = JSON.stringify(history);
  const html = diaryTimeline(history, { now });
  assert.equal((html.match(/class="diary-day"/g) || []).length, 2);
  assert.match(html, /data-diary-date="2026-10-14"/);
  assert.match(html, /data-diary-date="2026-10-13"/);
  assert.match(html, /<h3>今天<\/h3>/);
  assert.match(html, /<h3>昨天<\/h3>/);
  assert.match(html, /2 条记录/);
  assert.ok(html.indexOf('中午摸摸') < html.indexOf('凌晨喂食'));
  assert.ok(html.indexOf('凌晨喂食') < html.indexOf('昨晚陪它玩'));
  assert.match(html, /data-diary-role="female"/);
  assert.match(html, />00:01<\/time>/);
  assert.equal(JSON.stringify(history), snapshot);
});

test('yesterday crosses the year boundary and older dates show their year', () => {
  const now = new Date(2027, 0, 1, 12).getTime();
  const html = diaryTimeline([
    { actor:'女方', text:'跨年陪伴', at:new Date(2026, 11, 31, 20).getTime() },
    { actor:'男方', text:'前天的陪伴', at:new Date(2026, 11, 30, 20).getTime() },
  ], { now });
  assert.match(html, /data-diary-date="2026-12-31"/);
  assert.match(html, /<h3>昨天<\/h3>/);
  assert.match(html, /<h3>2026年12月30日<\/h3>/);
});

test('unknown caregivers remain neutral, saved text is escaped and empty histories are readable', () => {
  const html = diaryTimeline([{ actor:'<猫友>', text:'<script>坏内容</script>', at:1 }], { now:2 });
  assert.match(html, /data-diary-role="other"/);
  assert.match(html, /&lt;猫友&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(diaryTimeline([]), /还没有记录/);
  assert.match(diaryTimeline([{ actor:'男方', text:'无效时间', at:NaN }]), /还没有记录/);
});
