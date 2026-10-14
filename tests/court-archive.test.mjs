import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { archiveDigest, exportArchive, importArchive, inspectArchive, parseArguments, readArchiveFile, runArchiveCommand, writeArchiveFile } from '../scripts/court-archive.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYKsAAAAASUVORK5CYII=';
const WHEN = '2026-10-14T00:00:00.000Z';
const makeRoom = (id) => ({
  id,
  title: '虚构迁移验收案',
  createdAt: WHEN,
  parties: { a: { name: '甲', tokenHash: 'a'.repeat(64) }, b: { name: '乙', tokenHash: 'b'.repeat(64) } },
  rounds: [
    { id: '111111111111', index: 1, kind: 'initial', createdAt: WHEN, status: 'judged', error: null, submissions: { a: { statement: '原始甲方陈词', submittedAt: WHEN, images: [{ id: '333333333333', name: '记录.png', dataUrl: PNG }] }, b: { statement: '原始乙方陈词', submittedAt: WHEN, images: [] } }, verdict: { text: '初审判词', model: 'test-model', createdAt: WHEN, usage: { input: 5 } } },
    { id: '222222222222', index: 2, kind: 'appeal', createdAt: WHEN, status: 'collecting', error: null, submissions: { a: { statement: '复议新证词', submittedAt: WHEN, images: [{ id: '444444444444', name: '复议.png', dataUrl: PNG, size: 68 }] }, b: null }, verdict: null },
  ],
  extension: { nested: ['保留未知字段', { value: 7 }] },
});
const makeArchive = (...ids) => ({ version: 1, rooms: Object.fromEntries(ids.map((id) => [id, makeRoom(id)])) });

/** Offline transactional fixture; no database, app server or OpenAI connection. */
function memoryPool(initial = new Map(), { failAfterInsert = false } = {}) {
  let rooms = structuredClone(initial);
  let transaction;
  let insertCount = 0;
  const client = {
    async query(sql, values = []) {
      if (sql.startsWith('BEGIN')) { transaction = structuredClone(rooms); return { rows: [] }; }
      if (sql === 'COMMIT') { rooms = transaction; transaction = undefined; return { rows: [] }; }
      if (sql === 'ROLLBACK') { transaction = undefined; return { rows: [] }; }
      if (sql.startsWith('SELECT pg_advisory_xact_lock') || sql.startsWith('CREATE TABLE')) return { rows: [] };
      if (sql.startsWith('SELECT room FROM')) return { rows: transaction.has(values[0]) ? [{ room: structuredClone(transaction.get(values[0])) }] : [] };
      if (sql.startsWith('INSERT INTO')) {
        transaction.set(values[0], JSON.parse(values[1]));
        insertCount += 1;
        if (failAfterInsert && insertCount === 1) throw new Error('simulated driver diagnostics containing a connection secret');
        return { rows: [] };
      }
      if (sql.startsWith('SELECT id, room')) return { rows: [...transaction].map(([id, room]) => ({ id, room: structuredClone(room) })) };
      throw new Error('unsupported fixture query');
    },
    release() {},
  };
  return { connect: async () => client, get rooms() { return rooms; } };
}

test('migration preserves private evidence, appeal history and optional legacy fields exactly', async () => {
  const archive = makeArchive('aabbccddeeff');
  const pool = memoryPool();
  const first = await importArchive(pool, archive);
  assert.deepEqual({ rooms: first.rooms, rounds: first.rounds, submissions: first.submissions, images: first.images, verdicts: first.verdicts, inserted: first.inserted, skipped: first.skipped }, { rooms: 1, rounds: 2, submissions: 3, images: 2, verdicts: 1, inserted: 1, skipped: 0 });
  const exported = await exportArchive(pool);
  assert.equal(exported.summary.sha256, archiveDigest(archive));
  assert.deepEqual(exported.archive.rooms.aabbccddeeff, archive.rooms.aabbccddeeff);
  assert.equal(Object.hasOwn(exported.archive.rooms.aabbccddeeff, 'revision'), false);
  assert.equal(Object.hasOwn(exported.archive.rooms.aabbccddeeff.rounds[0].submissions.a.images[0], 'size'), false);
  const second = await importArchive(pool, archive);
  assert.equal(second.inserted, 0);
  assert.equal(second.skipped, 1);
  assert.equal(pool.rooms.size, 1);
});

test('conflicting case rolls back earlier inserted cases instead of overwriting evidence', async () => {
  const original = makeRoom('ffffffffffff');
  const changed = structuredClone(original);
  changed.rounds[0].submissions.a.statement = '不能覆盖的另一版本';
  const pool = memoryPool(new Map([[original.id, original]]));
  const archive = makeArchive('000000000001', 'ffffffffffff');
  archive.rooms.ffffffffffff = changed;
  await assert.rejects(importArchive(pool, archive), { code: 'ARCHIVE_CONFLICT' });
  assert.equal(pool.rooms.has('000000000001'), false);
  assert.deepEqual(pool.rooms.get(original.id), original);
});

test('mid-transaction failure restores the entire archive and hides driver diagnostics', async () => {
  const pool = memoryPool(new Map(), { failAfterInsert: true });
  await assert.rejects(importArchive(pool, makeArchive('aabbccddeeff', '112233445566')), (error) => {
    assert.equal(error.code, 'DATABASE_FAILED');
    assert.equal(error.message.includes('connection secret'), false);
    return true;
  });
  assert.equal(pool.rooms.size, 0);
});

test('summary never includes testimony, image payloads or role hashes', () => {
  const archive = makeArchive('aabbccddeeff');
  const summary = inspectArchive(archive);
  const output = JSON.stringify(summary);
  for (const privateValue of ['原始甲方陈词', '复议新证词', PNG, 'a'.repeat(64), 'b'.repeat(64)]) assert.equal(output.includes(privateValue), false);
  assert.match(summary.sha256, /^[a-f0-9]{64}$/);
  assert.equal(summary.imageBytes, Buffer.byteLength(PNG.split(',')[1], 'base64') * 2);
  const reversed = { rooms: { aabbccddeeff: { ...archive.rooms.aabbccddeeff } }, version: 1 };
  assert.equal(archiveDigest(reversed), summary.sha256);
  assert.throws(() => inspectArchive({ ...archive, unknownRootMetadata: true }), { code: 'INVALID_ARCHIVE' });
});

test('local export is private and refuses existing files and symlinks', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-archive-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const archive = makeArchive('aabbccddeeff');
  const file = path.join(directory, 'backup.json');
  await writeArchiveFile(file, archive);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal((await readArchiveFile(file)).summary.sha256, archiveDigest(archive));
  const before = await readFile(file, 'utf8');
  await assert.rejects(writeArchiveFile(file, makeArchive('112233445566')), { code: 'DESTINATION_EXISTS' });
  assert.equal(await readFile(file, 'utf8'), before);
  const alias = path.join(directory, 'alias.json');
  await symlink(file, alias);
  await assert.rejects(writeArchiveFile(alias, archive), { code: 'DESTINATION_EXISTS' });
  assert.equal(await readFile(file, 'utf8'), before);
});

test('inspect command is offline and rejects inline database credentials', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cat-court-inspect-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'archive.json');
  await writeFile(file, JSON.stringify(makeArchive('aabbccddeeff')), { mode: 0o600 });
  const output = [];
  await runArchiveCommand(['inspect', '--file', file], (value) => output.push(value));
  assert.equal(output.length, 1);
  assert.equal(output[0].command, 'inspect');
  assert.equal(output[0].rooms, 1);
  assert.throws(() => parseArguments(['import', '--file', file, '--database', 'postgres://private-connection']), { code: 'ARGUMENTS' });
  await writeFile(file, '{truncated', { mode: 0o600 });
  await assert.rejects(readArchiveFile(file), { code: 'INVALID_ARCHIVE' });
});
