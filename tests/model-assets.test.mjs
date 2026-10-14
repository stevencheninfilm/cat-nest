import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelAssetStore,createModelAssetHandler,MODEL_ROUTE} from '../server/model-assets.mjs';
const glb=()=>{const b=Buffer.alloc(20);b.write('glTF');b.writeUInt32LE(2,4);b.writeUInt32LE(20,8);return b;};
const response=bytes=>new Response(bytes,{status:200,headers:{'Content-Length':String(bytes.length)}});
function sink(){return{status:0,headers:{},body:null,setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,headers={}){this.status=status;for(const[k,v]of Object.entries(headers))this.setHeader(k,v);},end(body){this.body=body;}};}
test('private model reads use fixed paths and bearer headers, cache identical results, and coalesce concurrent requests',async()=>{
 let calls=0,seen;let release;const gate=new Promise(r=>release=r);
 const store=createModelAssetStore({token:'test-private-token',repository:'stevencheninfilm/cat-nest-data',branch:'main',fetchImpl:async(url,opts)=>{calls++;seen={url,opts};await gate;return response(glb());}});
 const a=store.get('model.glb'),b=store.get('model.glb');release();const [x,y]=await Promise.all([a,b]);
 assert.equal(calls,1);assert.equal(x,y);assert.equal((await store.get('model.glb')),x);assert.equal(x.type,'model/gltf-binary');assert.ok(seen.url.includes('/cat-nest-data/contents/assets/mage-cat-v1/model.glb?ref=main'));assert.equal(seen.opts.headers.Authorization,'Bearer test-private-token');assert.equal(seen.opts.redirect,'error');
});
test('source files, traversal, unknown assets and missing credentials are rejected before any network request',async()=>{
 let calls=0;const store=createModelAssetStore({token:'test-token',fetchImpl:async()=>{calls++;return response(glb());}});
 for(const name of ['../rooms/home.json','mage_cat.fbx','model.glb/extra','%2e%2e','model.zip'])await assert.rejects(store.get(name),e=>e.status===404);
 await assert.rejects(createModelAssetStore({token:''}).get('model.glb'),e=>e.status===503);assert.equal(calls,0);
});
test('failed or corrupt upstream reads never become cached successes or leak upstream error content',async()=>{
 let calls=0;const store=createModelAssetStore({token:'test-token',fetchImpl:async()=>{calls++;return calls===1?new Response('secret-upstream-detail',{status:403}):response(glb());}});
 await assert.rejects(store.get('model.glb'),e=>e.status===503 && !e.message.includes('secret'));assert.equal((await store.get('model.glb')).bytes.length,20);assert.equal(calls,2);
 await assert.rejects(createModelAssetStore({token:'test',fetchImpl:async()=>response(Buffer.from('{"content":"bad"}'))}).get('model.glb'),e=>e.status===503);
});
test('asset responses support GET, HEAD, conditional caching and bounded method/path access',async()=>{
 const bytes=glb();let reads=0;const handle=createModelAssetHandler({store:{async get(){reads++;return{bytes,type:'model/gltf-binary',etag:'"content"'};}}});
 const req={method:'GET',headers:{}};const url=new URL(`http://localhost${MODEL_ROUTE}model.glb`);let res=sink();assert.equal(await handle(req,res,url),true);assert.equal(res.status,200);assert.equal(res.body,bytes);assert.equal(res.headers['content-type'],'model/gltf-binary');
 res=sink();await handle({...req,method:'HEAD'},res,url);assert.equal(res.status,200);assert.equal(res.body,undefined);
 res=sink();await handle({...req,headers:{'if-none-match':'"content"'}},res,url);assert.equal(res.status,304);assert.equal(res.body,undefined);
 res=sink();await handle({...req,method:'POST'},res,url);assert.equal(res.status,405);res=sink();await handle(req,res,new URL(`http://localhost${MODEL_ROUTE}mage_cat.fbx`));assert.equal(res.status,404);assert.equal(reads,3);
});
