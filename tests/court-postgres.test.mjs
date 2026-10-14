import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCourtServer } from '../server/court.mjs';
import { structuredVerdict } from './court-verdict-fixtures.mjs';

// Opt in only with a separate test database. Never use production env defaults.
const databaseUrl = process.env.COURT_TEST_DATABASE_URL;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYKsAAAAASUVORK5CYII=';
const hash = value => createHash('sha256').update(value).digest('hex');

test('real Postgres retains both concurrent submissions, images and appeal history across fresh servers', { skip: !databaseUrl }, async t => {
  const { createCourtPool } = await import('../server/court-store.mjs');
  const servers = new Set();
  const caseIds = [];
  let inferenceCalls = 0;
  const start = async () => {
    const server = await createCourtServer({
      databaseUrl, requireDurableStorage: true, apiKey: 'mock-only',
      fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify(structuredVerdict({ conclusion: `模拟判词 ${++inferenceCalls}` })) }) }),
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    servers.add(server);
    const call = async (route, body, token) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/court${route}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    return { server, call };
  };
  const stop = async server => {
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
    await server.closeCourtStore();
    servers.delete(server);
  };
  t.after(async () => {
    for (const server of [...servers]) await stop(server);
    const pool = await createCourtPool({ databaseUrl });
    try { await pool.query('DELETE FROM cat_court_rooms WHERE id = ANY($1::text[])', [caseIds]); }
    finally { await pool.end(); }
  });
  const first = await start();
  const second = await start();
  const created = await first.call('/rooms', { title: '持久化虚构验收案件' });
  assert.equal(created.status, 201);
  const roomId = created.body.room.id;
  caseIds.push(roomId);
  const route = `/rooms/${roomId}`;
  const a = (await first.call(`${route}/claim`, { role: 'a', name: '测试甲' })).body;
  const b = (await second.call(`${route}/claim`, { role: 'b', name: '测试乙' })).body;
  const submit = await Promise.all([
    first.call(`${route}/submit`, { statement: '初审甲方证词', images: [{ name: 'initial.png', dataUrl: PNG }] }, a.token),
    second.call(`${route}/submit`, { statement: '初审乙方证词' }, b.token),
  ]);
  assert.deepEqual(submit.map(result => result.status).sort(), [200, 202]);
  const waitForVerdict = async (client, rounds) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await client.call(route, undefined, a.token);
      assert.equal(result.status, 200);
      if (result.body.room.rounds.length === rounds && result.body.room.rounds.at(-1).status === 'judged') return result.body.room;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail('mock verdict did not persist');
  };
  const initial = await waitForVerdict(second, 1);
  assert.equal(initial.rounds[0].submissions.a.statement, '初审甲方证词');
  assert.equal(initial.rounds[0].submissions.b.statement, '初审乙方证词');
  const appeals = await Promise.all([
    first.call(`${route}/appeal`, { statement: '甲方补充证词' }, a.token),
    second.call(`${route}/appeal`, { statement: '乙方补充证词', images: [{ name: 'appeal.png', dataUrl: PNG }] }, b.token),
  ]);
  assert.deepEqual(appeals.map(result => result.status).sort(), [200, 202]);
  const completed = await waitForVerdict(first, 2);
  assert.deepEqual(completed.rounds[0], initial.rounds[0]);
  const finalRound = completed.rounds[1];
  const taskId = finalRound.repair.tasks[0].id;
  const confirmations = await Promise.all([
    first.call(`${route}/repair`, { roundId: finalRound.id, taskId, confirmed: true }, a.token),
    second.call(`${route}/repair`, { roundId: finalRound.id, taskId, confirmed: true }, b.token),
  ]);
  assert.equal(confirmations.every(result => result.status === 200), true);
  const saved = (await first.call(route, undefined, a.token)).body.room;
  assert.equal(typeof saved.rounds[1].repair.tasks[0].confirmations.a, 'string');
  assert.equal(typeof saved.rounds[1].repair.tasks[0].confirmations.b, 'string');
  assert.equal(inferenceCalls, 2);
  await stop(first.server);
  await stop(second.server);
  const fresh = await start();
  for (const token of [a.token, b.token]) {
    const restored = await fresh.call(route, undefined, token);
    assert.equal(restored.status, 200);
    assert.deepEqual(restored.body.room.rounds, saved.rounds);
    assert.equal(restored.body.room.revision, saved.revision);
    assert.equal(hash(restored.body.room.rounds[0].submissions.a.images[0].dataUrl), hash(PNG));
    assert.equal(hash(restored.body.room.rounds[1].submissions.b.images[0].dataUrl), hash(PNG));
  }
  const stranger = await fresh.call(route);
  assert.equal(stranger.body.room.rounds[0].submissions.a, null);
  assert.equal((await fresh.call(`${route}/claim`, { role: 'a' })).status, 409);
  assert.equal((await fresh.call('/config')).body.storage.durable, true);
  assert.equal(inferenceCalls, 2, 'fresh servers must not repeat completed analyses');
});
