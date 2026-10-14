import { createHash } from 'node:crypto';
import { MAGE_CAT_FILES, MAGE_CAT_VERSION } from '../src/mage-cat-config.js';
const files=new Set(MAGE_CAT_FILES);
export const MODEL_ROUTE=`/api/pet-model/${MAGE_CAT_VERSION}/`;
/** Read only project assets from the private data repository. Never expose source archives or credentials. */
export function createModelAssetStore({token=process.env.GITHUB_TOKEN,repository=process.env.GITHUB_REPOSITORY || 'stevencheninfilm/cat-nest-data',branch=process.env.GITHUB_BRANCH || 'main',fetchImpl=globalThis.fetch}={}) {
  const configured=typeof token==='string' && token.trim().length>0 && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) && typeof branch==='string' && branch.length>0;
  const cache=new Map(),loading=new Map();
  return {
    async get(file){
      if(!files.has(file))throw Object.assign(new Error('Model asset not found'),{status:404});
      if(!configured)throw Object.assign(new Error('Model assets are not configured'),{status:503});
      if(cache.has(file))return cache.get(file);
      if(loading.has(file))return loading.get(file);
      const task=(async()=>{
        const url=`https://api.github.com/repos/${repository}/contents/assets/${MAGE_CAT_VERSION}/${file}?${new URLSearchParams({ref:branch})}`;
        const response=await fetchImpl(url,{headers:{Accept:'application/vnd.github.raw+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cat-nest-model-assets'},signal:AbortSignal.timeout(25_000),redirect:'error'});
        if(!response.ok)throw Object.assign(new Error('Model asset temporarily unavailable'),{status:response.status===404?404:503});
        const length=Number(response.headers.get('content-length'));
        if(length>10_000_000)throw Object.assign(new Error('Model asset exceeds its size limit'),{status:503});
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length===0 || bytes.length>10_000_000)throw Object.assign(new Error('Invalid model asset size'),{status:503});
        const valid=file.endsWith('.glb')?bytes.length>=20 && bytes.toString('ascii',0,4)==='glTF' && bytes.readUInt32LE(4)===2 && bytes.readUInt32LE(8)===bytes.length:bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
        if(!valid)throw Object.assign(new Error('Model asset validation failed'),{status:503});
        const result={bytes,type:file.endsWith('.glb')?'model/gltf-binary':'image/webp',etag:`"${createHash('sha256').update(bytes).digest('hex')}"`};
        cache.set(file,result);return result;
      })().finally(()=>loading.delete(file));
      loading.set(file,task);return task;
    },
  };
}
export function createModelAssetHandler({store=createModelAssetStore()}={}) {
  return async function handle(request,response,url){
    if(!url.pathname.startsWith('/api/pet-model/'))return false;
    const file=url.pathname.startsWith(MODEL_ROUTE)?url.pathname.slice(MODEL_ROUTE.length):'';
    const send=(status,message)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify({error:{code:'MODEL_UNAVAILABLE',message}}));};
    if(!files.has(file)){send(404,'小猫资源不存在。');return true;}
    if(!['GET','HEAD'].includes(request.method)){response.setHeader('Allow','GET, HEAD');send(405,'此接口只提供小猫资源。');return true;}
    try{
      const asset=await store.get(file);
      response.setHeader('ETag',asset.etag);response.setHeader('Cache-Control','public, max-age=86400, immutable');response.setHeader('X-Content-Type-Options','nosniff');
      if(request.headers['if-none-match']===asset.etag){response.writeHead(304);response.end();return true;}
      response.writeHead(200,{'Content-Type':asset.type,'Content-Length':asset.bytes.length});response.end(request.method==='HEAD'?undefined:asset.bytes);
    }catch(error){send(error.status===404?404:503,'小猫正在准备中，请稍后重试。');}
    return true;
  };
}
