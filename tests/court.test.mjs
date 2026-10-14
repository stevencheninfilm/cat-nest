import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCourtServer } from '../server/court.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYKsAAAAASUVORK5CYII=';
const image = { name: '聊天记录.png', dataUrl: PNG };
const answer = (text = '猫猫根据双方陈词分析：先倾听，再约定。') => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }) });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-'));
  const dataFile = path.join(directory, 'rooms.json');
  let server;
  let base;
  const start = async (extra = {}) => {
    server = await createCourtServer({ dataFile, apiKey: 'test-server-key', fetchImpl: async () => answer(), ...options, ...extra });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = () => new Promise((resolve, reject) => {
    server.close(() => { server.closeCourtStore().then(resolve, reject); });
    server.closeIdleConnections();
  });
  await start();
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  const call = async (endpoint, body, token, headers = {}) => {
    const response = await fetch(`${base}/api/court${endpoint}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const create = async () => (await call('/rooms', { title: '迟到的小争执' })).body.room;
  const claim = async (room, role) => (await call(`/rooms/${room.id}/claim`, { role, name: role === 'a' ? '小鱼' : '团子' })).body;
  const pair = async () => { const room = await create(); return { room, a: await claim(room, 'a'), b: await claim(room, 'b') }; };
  const get = async (room, token) => (await call(`/rooms/${room.id}`, undefined, token)).body.room;
  const waitJudged = async (room, token) => {
    for (let i = 0; i < 100; i++) { const current = await get(room, token); if (current.rounds.at(-1).status !== 'judging') return current; await delay(10); }
    assert.fail('AI judgment did not finish');
  };
  return { call, create, claim, pair, get, waitJudged, dataFile, stop, start, get base() { return base; } };
}

test('roles are atomically exclusive and secrets never leave authenticated claim response', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const results = await Promise.all([f.call(`/rooms/${room.id}/claim`, { role: 'a', name: '甲' }), f.call(`/rooms/${room.id}/claim`, { role: 'a', name: '另一人' })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const claimed = results.find((result) => result.status === 200).body;
  assert.match(claimed.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(claimed.role, 'a');
  assert.equal(claimed.room.parties.a.claimed, true);
  assert.equal('tokenHash' in claimed.room.parties.a, false);
  const stored = await readFile(f.dataFile, 'utf8');
  assert.equal(stored.includes(claimed.token), false, 'disk holds hashes rather than bearer tokens');
  assert.equal((await f.call(`/rooms/${room.id}/submit`, { statement: '没有凭据' })).status, 401);
  assert.equal((await f.call(`/rooms/${room.id}/submit`, { statement: '伪造凭据' }, 'x'.repeat(43))).status, 403);
});

test('judgment waits for both sides, sends genuine image inputs, and gates duplicate requests', async (t) => {
  const requests = [];
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async (url, options) => { requests.push({ url, options, body: JSON.parse(options.body) }); return pending; } });
  const { room, a, b } = await f.pair();
  assert.equal((await f.call(`/rooms/${room.id}/judge`, {}, a.token)).status, 409);
  const first = await f.call(`/rooms/${room.id}/submit`, { statement: '我等了半小时', images: [image], role: 'b' }, a.token);
  assert.equal(first.status, 200);
  assert.equal(first.body.room.rounds[0].submissions.a.statement, '我等了半小时');
  assert.equal(first.body.room.rounds[0].submissions.b, null, 'body role cannot overwrite other role');
  assert.equal(requests.length, 0);
  const publicRoom = await f.get(room);
  assert.equal(publicRoom.requiresAuth, true);
  assert.deepEqual(publicRoom.rounds[0].submissions, { a: null, b: null });
  const second = await f.call(`/rooms/${room.id}/submit`, { statement: '我忘记告知了' }, b.token);
  assert.equal(second.status, 202);
  assert.equal(second.body.room.rounds[0].status, 'judging');
  const retries = await Promise.all([f.call(`/rooms/${room.id}/judge`, {}, a.token), f.call(`/rooms/${room.id}/judge`, {}, b.token), f.call(`/rooms/${room.id}/submit`, { statement: '重复' }, b.token)]);
  assert.deepEqual(retries.map((result) => result.status), [409, 409, 409]);
  assert.equal(requests.length, 1, 'one upstream invocation per round');
  const request = requests[0];
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.body.model, 'gpt-6-astra');
  assert.deepEqual(request.body.reasoning, { effort: 'high' });
  assert.equal(request.body.store, false);
  assert.equal(request.body.input[0].content.find((item) => item.type === 'input_image').image_url, PNG);
  assert.match(request.body.instructions, /不机械各打五十大板/);
  release(answer());
  const judged = await f.waitJudged(room, a.token);
  assert.equal(judged.rounds[0].status, 'judged');
  assert.match(judged.rounds[0].verdict.text, /猫猫/);
  assert.equal((await f.get(room)).rounds[0].verdict, null);
});

test('appeal is a new two-party round and retains all previous evidence and judgment', async (t) => {
  const requests = [];
  const f = await fixture(t, { fetchImpl: async (_, options) => { requests.push(JSON.parse(options.body)); return answer(`第${requests.length}轮分析`); } });
  const { room, a, b } = await f.pair();
  assert.equal((await f.call(`/rooms/${room.id}/appeal`, { statement: '过早复议' }, a.token)).status, 409);
  await f.call(`/rooms/${room.id}/submit`, { statement: '原始甲方陈词', images: [image] }, a.token);
  await f.call(`/rooms/${room.id}/submit`, { statement: '原始乙方陈词' }, b.token);
  await f.waitJudged(room, a.token);
  const appeal = await f.call(`/rooms/${room.id}/appeal`, { statement: '新增甲方证词' }, a.token);
  assert.equal(appeal.status, 200);
  assert.equal(appeal.body.room.rounds.length, 2);
  assert.equal(appeal.body.room.rounds[1].kind, 'appeal');
  assert.equal(appeal.body.room.rounds[1].status, 'collecting');
  assert.equal(requests.length, 1);
  await f.call(`/rooms/${room.id}/submit`, { statement: '乙方同意沿用上轮陈词，补充解释' }, b.token);
  const final = await f.waitJudged(room, b.token);
  assert.equal(final.rounds[0].verdict.text, '第1轮分析');
  assert.equal(final.rounds[1].verdict.text, '第2轮分析');
  const input = JSON.stringify(requests[1].input);
  for (const text of ['原始甲方陈词', '原始乙方陈词', '新增甲方证词', '第1轮分析', PNG]) assert.equal(input.includes(text), true, `history retains ${text.slice(0, 15)}`);
});

test('missing server key leaves saved testimony and a clear retriable configuration error', async (t) => {
  let requests = 0;
  const f = await fixture(t, { apiKey: '', fetchImpl: async () => { requests++; return answer(); } });
  const config = await f.call('/config');
  assert.equal(config.body.configured, false);
  assert.equal(config.body.reasoning, 'high');
  assert.equal('apiKey' in config.body, false);
  const { room, a, b } = await f.pair();
  await f.call(`/rooms/${room.id}/submit`, { statement: '甲陈词' }, a.token);
  const submitted = await f.call(`/rooms/${room.id}/submit`, { statement: '乙陈词' }, b.token);
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.room.rounds[0].status, 'error');
  assert.equal(submitted.body.room.rounds[0].error.code, 'AI_NOT_CONFIGURED');
  const retry = await f.call(`/rooms/${room.id}/judge`, {}, a.token);
  assert.equal(retry.status, 503);
  assert.equal(retry.body.error.code, 'AI_NOT_CONFIGURED');
  assert.equal(retry.body.room.rounds[0].submissions.b.statement, '乙陈词');
  assert.equal(requests, 0);
});

test('upstream error can be retried once and concurrent retries never double charge', async (t) => {
  let requests = 0;
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async () => { requests++; return requests === 1 ? { ok: false, status: 429 } : blocked; } });
  const { room, a, b } = await f.pair();
  await f.call(`/rooms/${room.id}/submit`, { statement: '甲陈词' }, a.token);
  await f.call(`/rooms/${room.id}/submit`, { statement: '乙陈词' }, b.token);
  const failed = await f.waitJudged(room, a.token);
  assert.equal(failed.rounds[0].error.code, 'AI_RATE_LIMIT');
  const retries = await Promise.all([f.call(`/rooms/${room.id}/judge`, {}, a.token), f.call(`/rooms/${room.id}/judge`, {}, b.token)]);
  assert.deepEqual(retries.map((result) => result.status).sort(), [202, 409]);
  assert.equal(requests, 2);
  release(answer('成功重试'));
  assert.equal((await f.waitJudged(room, a.token)).rounds[0].verdict.text, '成功重试');
});

test('durable case and role ownership survive restart', async (t) => {
  const f = await fixture(t);
  const { room, a, b } = await f.pair();
  await f.call(`/rooms/${room.id}/submit`, { statement: '已保存陈词', images: [image] }, a.token);
  await f.stop(); await f.start();
  const restored = await f.get(room, a.token);
  assert.equal(restored.parties.b.claimed, true);
  assert.equal(restored.rounds[0].submissions.a.statement, '已保存陈词');
  assert.equal(restored.rounds[0].submissions.a.images[0].dataUrl, PNG);
  assert.equal((await f.call(`/rooms/${room.id}/claim`, { role: 'a' })).status, 409);
  await f.call(`/rooms/${room.id}/submit`, { statement: '重启后乙方提交' }, b.token);
  assert.equal((await f.waitJudged(room, a.token)).rounds[0].status, 'judged');
});

test('typing presence is shared only through authenticated role and clears on submit', async (t) => {
  const f = await fixture(t);
  const { room, a, b } = await f.pair();
  assert.equal((await f.call(`/rooms/${room.id}/presence`, { typing: true })).status, 401);
  await f.call(`/rooms/${room.id}/presence`, { typing: true }, a.token);
  const visible = await f.get(room, b.token);
  assert.equal(visible.parties.a.typing, true);
  assert.equal(visible.parties.a.online, true);
  await f.call(`/rooms/${room.id}/submit`, { statement: '说完啦' }, a.token);
  assert.equal((await f.get(room, b.token)).parties.a.typing, false);
});

test('revision polling and presence omit evidence until the persisted case changes', async (t) => {
  const f = await fixture(t);
  const { room, a, b } = await f.pair();
  const first = await f.call(`/rooms/${room.id}/submit`, { statement: '本轮陈词', images: [image] }, a.token);
  const revision = first.body.room.revision;
  assert.equal(Number.isInteger(revision), true);
  const unchanged = await f.call(`/rooms/${room.id}?since=${revision}`, undefined, a.token);
  assert.equal(unchanged.body.unchanged, true);
  assert.equal('rounds' in unchanged.body.room, false);
  assert.equal(JSON.stringify(unchanged.body).includes(PNG), false);
  assert.equal(JSON.stringify(unchanged.body).includes('本轮陈词'), false);
  const presence = await f.call(`/rooms/${room.id}/presence`, { typing: true }, b.token);
  assert.equal('rounds' in presence.body.room, false);
  assert.equal(presence.body.room.revision, revision, 'ephemeral presence does not invalidate evidence cache');
  const fresh = await f.call(`/rooms/${room.id}?since=${revision - 1}`, undefined, a.token);
  assert.equal(fresh.body.room.rounds[0].submissions.a.images[0].dataUrl, PNG);
  await f.call(`/rooms/${room.id}/submit`, { statement: '另一方新增陈词' }, b.token);
  await f.waitJudged(room, a.token);
  const changed = await f.call(`/rooms/${room.id}?since=${revision}`, undefined, a.token);
  assert.equal(changed.body.room.revision > revision, true);
  assert.equal(changed.body.room.rounds[0].submissions.b.statement, '另一方新增陈词');
  assert.equal(changed.body.room.rounds[0].status, 'judged');
  const disk = JSON.parse(await readFile(f.dataFile, 'utf8'));
  assert.equal(disk.rooms[room.id].revision, changed.body.room.revision);
});

test('judgment reads and presence wait until the new revision is durably committed', async (t) => {
  let releaseCommit;
  let enteredCommit;
  const commitGate = new Promise((resolve) => { releaseCommit = resolve; });
  const commitEntered = new Promise((resolve) => { enteredCommit = resolve; });
  const f = await fixture(t, { beforePersist: async (candidate) => {
    if (Object.values(candidate.rooms).some((room) => room.rounds.at(-1).status === 'judged')) {
      enteredCommit();
      await commitGate;
    }
  } });
  const { room, a, b } = await f.pair();
  await f.call(`/rooms/${room.id}/submit`, { statement: '甲陈词' }, a.token);
  const submitted = await f.call(`/rooms/${room.id}/submit`, { statement: '乙陈词' }, b.token);
  await commitEntered;
  const before = JSON.parse(await readFile(f.dataFile, 'utf8')).rooms[room.id];
  assert.equal(before.rounds[0].status, 'judging');
  assert.equal(before.revision, submitted.body.room.revision);
  const reads = Promise.all([
    f.call(`/rooms/${room.id}`, undefined, a.token),
    f.call(`/rooms/${room.id}`),
    f.call(`/rooms/${room.id}/presence`, { typing: false }, b.token),
  ]);
  try {
    const observed = await Promise.race([reads.then(() => 'published'), delay(30).then(() => 'waiting')]);
    assert.equal(observed, 'waiting', 'neither private/public GET nor presence may publish an in-flight revision');
  } finally {
    releaseCommit();
  }
  const results = await reads;
  const committed = JSON.parse(await readFile(f.dataFile, 'utf8')).rooms[room.id];
  assert.equal(committed.rounds[0].status, 'judged');
  assert.equal(committed.revision, before.revision + 1);
  for (const result of results) assert.equal(result.body.room.revision, committed.revision);
  assert.equal(results[0].body.room.rounds[0].status, 'judged');
  assert.equal(results[1].body.room.rounds[0].status, 'judged');
});

test('failed durable claims and submissions leave the committed room unchanged and remain retryable', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const directory = path.dirname(f.dataFile);
  const backup = `${directory}-backup`;
  const blockWrites = async () => { await rename(directory, backup); await writeFile(directory, 'filesystem write failure'); };
  const restoreWrites = async () => { await rm(directory, { force: true }); await rename(backup, directory); };
  await blockWrites();
  try {
    const failed = await f.call(`/rooms/${room.id}/claim`, { role: 'a', name: '甲方' });
    assert.equal(failed.status, 503);
    const unchanged = await f.get(room);
    assert.equal(unchanged.revision, room.revision);
    assert.equal(unchanged.parties.a.claimed, false);
    assert.equal(unchanged.parties.a.online, false);
  } finally {
    await restoreWrites();
  }
  const a = await f.claim(room, 'a');
  assert.equal(a.role, 'a', 'failed claim must not consume the seat');
  const diskBefore = JSON.parse(await readFile(f.dataFile, 'utf8')).rooms[room.id];
  await blockWrites();
  try {
    const failed = await f.call(`/rooms/${room.id}/submit`, { statement: '保存失败后重试' }, a.token);
    assert.equal(failed.status, 503);
    const unchanged = await f.get(room, a.token);
    assert.equal(unchanged.revision, diskBefore.revision);
    assert.equal(unchanged.rounds[0].submissions.a, null);
  } finally {
    await restoreWrites();
  }
  const retry = await f.call(`/rooms/${room.id}/submit`, { statement: '保存失败后重试' }, a.token);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.room.rounds[0].submissions.a.statement, '保存失败后重试');
  const diskAfter = JSON.parse(await readFile(f.dataFile, 'utf8')).rooms[room.id];
  assert.equal(diskAfter.revision, retry.body.room.revision);
  assert.equal(diskAfter.rounds[0].submissions.a.statement, '保存失败后重试');
});

test('malformed testimony and image evidence cannot mutate a round', async (t) => {
  const f = await fixture(t);
  const { room, a } = await f.pair();
  const cases = [
    {}, { statement: 'x'.repeat(12001) }, { statement: '空\u0000字符' },
    { images: [{ name: 'URL', dataUrl: 'https://internal.example/secret.png' }] },
    { images: [{ name: '文本伪装', dataUrl: `data:image/png;base64,${Buffer.from('not a png').toString('base64')}` }] },
    { images: [{ name: '格式伪装', dataUrl: PNG.replace('image/png', 'image/jpeg') }] },
    { images: [image, image, image, image, image] },
    { images: {} },
  ];
  for (const body of cases) assert.equal((await f.call(`/rooms/${room.id}/submit`, body, a.token)).status, 400);
  assert.equal((await f.get(room, a.token)).rounds[0].submissions.a, null);
});

test('CORS allows exact configured origins, rejects wildcard setup and disallowed sites', async (t) => {
  const f = await fixture(t, { allowedOrigins: 'https://cats.example' });
  const good = await f.call('/config', undefined, undefined, { Origin: 'https://cats.example' });
  assert.equal(good.status, 200);
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://cats.example');
  assert.equal((await f.call('/rooms', {}, undefined, { Origin: 'https://evil.example' })).status, 403);
  const preflight = await fetch(`${f.base}/api/court/config`, { method: 'OPTIONS', headers: { Origin: 'https://cats.example', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  await assert.rejects(createCourtServer({ allowedOrigins: '*', dataFile: f.dataFile }), /精确/);
});

test('optional API handler can mount pet cloud service in the same server', async (t) => {
  const f = await fixture(t, { handleRequest: async (_req, res, url) => {
    if (url.pathname !== '/api/pet/health') return false;
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ pet: true })); return true;
  } });
  const result = await fetch(`${f.base}/api/pet/health`);
  assert.deepEqual(await result.json(), { pet: true });
  assert.equal((await f.call('/config')).status, 200);
});
