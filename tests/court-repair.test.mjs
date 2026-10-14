import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCourtServer } from '../server/court.mjs';
import { createCourtStore } from '../server/court-store.mjs';
import { structuredVerdict } from './court-verdict-fixtures.mjs';

// Prepared only. Execution waits for the user's combined test notice.
async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-repair-'));
  const dataFile = path.join(directory, 'rooms.json');
  let server, base, calls = 0;
  const start = async () => {
    server = await createCourtServer({
      dataFile, databaseUrl: '', apiKey: 'mock-only', ...options,
      fetchImpl: async (_url, request) => {
        calls++;
        assert.equal(JSON.parse(request.body).text.format.type, 'json_schema');
        return { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify(options.details || structuredVerdict()) }) };
      },
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
    await server.closeCourtStore();
  };
  await start();
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  const call = async (endpoint, body, token) => {
    const response = await fetch(`${base}/api/court${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const room = (await call('/rooms', { title: '虚构修复流程验收' })).body.room;
  const route = `/rooms/${room.id}`;
  const a = (await call(`${route}/claim`, { role: 'a', name: '测试甲' })).body;
  const b = (await call(`${route}/claim`, { role: 'b', name: '测试乙' })).body;
  const get = async () => (await call(route, undefined, a.token)).body.room;
  const wait = async (count = 1) => {
    for (let i = 0; i < 100; i++) {
      const current = await get();
      if (current.rounds.length === count && current.rounds.at(-1).status === 'judged') return current;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('mock verdict was not saved');
  };
  const judge = async () => {
    await call(`${route}/submit`, { statement: '甲方虚构证词' }, a.token);
    await call(`${route}/submit`, { statement: '乙方虚构证词' }, b.token);
    return wait();
  };
  const confirm = (round, task, role, confirmed = true, extra = {}) => call(`${route}/repair`, { roundId: round.id, taskId: task.id, confirmed, ...extra }, role === 'a' ? a.token : b.token);
  return { call, get, judge, wait, confirm, a, b, route, dataFile, stop, start, get calls() { return calls; } };
}

const completed = repair => repair.tasks.filter(task => task.confirmations.a && task.confirmations.b).length;

test('structured verdict and both confirmations persist; repeats are idempotent and revocation is independent', async t => {
  const f = await fixture(t);
  const judged = await f.judge();
  const round = judged.rounds[0];
  assert.equal(round.verdict.details.responsibility.assessment, 'a_more');
  assert.equal(round.repair.tasks.length, 3);
  const task = round.repair.tasks[0];
  const first = await f.confirm(round, task, 'a');
  assert.equal(first.status, 200);
  assert.equal(completed(first.body.room.rounds[0].repair), 0);
  const both = await f.confirm(round, task, 'b');
  assert.equal(completed(both.body.room.rounds[0].repair), 1);
  const repeat = await f.confirm(round, task, 'a');
  assert.equal(repeat.body.room.revision, both.body.room.revision);
  assert.deepEqual(repeat.body.room.rounds[0].repair, both.body.room.rounds[0].repair);
  await f.stop(); await f.start();
  assert.deepEqual((await f.get()).rounds, both.body.room.rounds);
  const revoked = await f.confirm(round, task, 'a', false);
  assert.equal(completed(revoked.body.room.rounds[0].repair), 0);
  assert.equal(revoked.body.room.rounds[0].repair.tasks[0].confirmations.a, null);
  assert.equal(typeof revoked.body.room.rounds[0].repair.tasks[0].confirmations.b, 'string');
  assert.equal(f.calls, 1, 'confirmations, revocation and restart never call AI');
});

test('confirmation requires this case role and never accepts another role or client progress', async t => {
  const f = await fixture(t);
  const round = (await f.judge()).rounds[0];
  const task = round.repair.tasks[0];
  const body = { roundId: round.id, taskId: task.id, confirmed: true };
  assert.equal((await f.call(`${f.route}/repair`, body)).status, 401);
  assert.equal((await f.confirm(round, task, 'a', true, { role: 'b' })).status, 400);
  assert.equal((await f.confirm(round, task, 'a', true, { progress: 100 })).status, 400);
  const other = (await f.call('/rooms', { title: '另一个案件' })).body.room;
  const outsider = (await f.call(`/rooms/${other.id}/claim`, { role: 'a' })).body;
  assert.equal((await f.call(`${f.route}/repair`, body, outsider.token)).status, 403);
  assert.equal((await f.call(f.route)).body.room.rounds[0].repair, null);
  assert.equal(completed((await f.get()).rounds[0].repair), 0);
});

test('both parties can confirm concurrently and appeals keep earlier tasks read-only', async t => {
  const f = await fixture(t);
  const round = (await f.judge()).rounds[0];
  const task = round.repair.tasks[0];
  const results = await Promise.all([f.confirm(round, task, 'a'), f.confirm(round, task, 'b')]);
  assert.equal(results.every(result => result.status === 200), true);
  const original = (await f.get()).rounds[0];
  assert.equal(completed(original.repair), 1);
  await f.call(`${f.route}/appeal`, { statement: '甲方复议虚构材料' }, f.a.token);
  assert.equal((await f.confirm(round, task, 'a', false)).status, 409);
  await f.call(`${f.route}/submit`, { statement: '乙方复议虚构材料' }, f.b.token);
  const appealed = await f.wait(2);
  assert.deepEqual(appealed.rounds[0], original);
  assert.equal(completed(appealed.rounds[1].repair), 0);
  assert.notEqual(appealed.rounds[1].repair.tasks[0].id, task.id);
  assert.equal(f.calls, 2);
});

test('a failed confirmation save leaves persisted progress and revision unchanged', async t => {
  let rejectWrite = false;
  const f = await fixture(t, { beforePersist: async () => { if (rejectWrite) throw new Error('simulated disk error'); } });
  const before = await f.judge();
  rejectWrite = true;
  const failed = await f.confirm(before.rounds[0], before.rounds[0].repair.tasks[0], 'a');
  assert.equal(failed.status, 503);
  assert.deepEqual(await f.get(), before);
  rejectWrite = false;
  assert.equal((await f.confirm(before.rounds[0], before.rounds[0].repair.tasks[0], 'a')).status, 200);
  assert.equal(f.calls, 1);
});

test('boundary-first verdict cannot be converted into mutual-confirmation scoring', async t => {
  const f = await fixture(t, { details: structuredVerdict({ repairMode: 'boundaries_first', repairTasks: [
    { title: '保留安全的沟通边界', description: '优先安排自身安全与支持，不需要对方同意才保护自己。' },
    { title: '选择可信的支持', description: '在安全的前提下联系自己信任的人，按自己的需要接受支持。' },
    { title: '选择是否继续联系', description: '根据自身安全需要决定接触方式，不要求当面对质。' },
  ] }) });
  const round = (await f.judge()).rounds[0];
  assert.equal(round.repair.mode, 'boundaries_first');
  assert.equal((await f.confirm(round, round.repair.tasks[0], 'a')).status, 409);
  assert.equal(f.calls, 1);
  const archive = JSON.parse(await readFile(f.dataFile, 'utf8'));
  const room = archive.rooms[(await f.get()).id];
  room.rounds[0].repair.mode = 'together';
  // Storage refuses mismatched safety mode even if an imported archive is edited.
  const store = await createCourtStore({ dataFile: f.dataFile, databaseUrl: '' });
  try {
    await assert.rejects(store.withRoom(room.id, async (_draft, save) => { await save(room); }), { code: 'INVALID_COURT_ARCHIVE' });
  } finally { await store.close(); }
});
