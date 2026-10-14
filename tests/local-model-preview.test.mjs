import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { localModelPreview, localModelUrl } from '../scripts/local-model-preview.mjs';

test('development model URL retires the temporary server without altering production or custom URLs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cat-model-preview-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  assert.equal(localModelUrl({ command:'serve', directory }), null);
  await writeFile(join(directory, 'model.glb'), 'glTF');
  assert.equal(localModelUrl({ command:'serve', directory }), '/api/pet-model/mage-cat-v1');
  assert.equal(localModelUrl({ command:'serve', directory, configuredUrl:'http://127.0.0.1:9095/api/pet-model/mage-cat-v1' }), '/api/pet-model/mage-cat-v1');
  assert.equal(localModelUrl({ command:'build', directory }), null);
  assert.equal(localModelUrl({ command:'serve', directory, configuredUrl:'https://custom.example/model' }), null);
});

test('Vite serves optimized model files before the API proxy and blocks original source packages', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cat-model-preview-'));
  const bytes = Buffer.from('glTF-local-preview-fixture');
  await writeFile(join(directory, 'model.glb'), bytes);
  await writeFile(join(directory, 'coat-0.webp'), 'RIFF-local-texture-WEBP');
  await writeFile(join(directory, 'original.zip'), 'private-source-package');
  const server = await createServer({
    configFile:false, root:directory, plugins:[localModelPreview({ directory })],
    server:{ host:'127.0.0.1', port:0, proxy:{ '/api':{ target:'http://127.0.0.1:1' } } },
  });
  t.after(async () => { await server.close(); await rm(directory, { recursive:true, force:true }); });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/api/pet-model/mage-cat-v1/`;
  const model = await fetch(`${base}model.glb`);
  assert.equal(model.status, 200);
  assert.equal(model.headers.get('content-type'), 'model/gltf-binary');
  assert.deepEqual(Buffer.from(await model.arrayBuffer()), bytes);
  const texture = await fetch(`${base}coat-0.webp`, { method:'HEAD' });
  assert.equal(texture.status, 200);
  assert.equal(texture.headers.get('content-type'), 'image/webp');
  assert.equal((await texture.arrayBuffer()).byteLength, 0);
  assert.equal((await fetch(`${base}model.glb`, { headers:{ 'if-none-match':model.headers.get('etag') } })).status, 304);
  for (const file of ['original.zip', 'mage_cat.fbx', '%2e%2e%2foriginal.zip']) {
    const response = await fetch(`${base}${file}`);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /private-source-package/);
  }
});
