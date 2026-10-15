import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  let middleware;
  localModelPreview({directory}).configureServer({middlewares:{use(handler){middleware=handler;}}});
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const base='http://127.0.0.1/api/pet-model/mage-cat-v1/';
  // Exercise the actual asset middleware without starting a second Vite preview.
  async function fetch(url,options={}) {
    return new Promise((resolve,reject)=>{
      let status=200,headers={};
      const response={headersSent:false,destroyed:false,
        setHeader(key,value){headers[key]=value;},
        writeHead(code,values){status=code;headers={...headers,...values};this.headersSent=true;},
        end(body){resolve(new Response(options.method==='HEAD'||status===304?null:body,{status,headers}));}};
      middleware({url:new URL(url).pathname,method:options.method||'GET',headers:options.headers||{}},response,error=>error?reject(error):reject(Error('asset middleware was bypassed')));
    });
  }
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
