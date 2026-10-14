import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createPetServer} from '../server/pet-server.mjs';
import {createModelAssetHandler} from '../server/model-assets.mjs';
// Only optimized game assets are exposed. Source archives remain private.
const directory=resolve('artifacts/licensed/mage-cat/processed');
const store={async get(file){const bytes=await readFile(resolve(directory,file));return{bytes,type:file.endsWith('.glb')?'model/gltf-binary':'image/webp',etag:`"${createHash('sha256').update(bytes).digest('hex')}"`};}};
const server=createPetServer({serveStatic:false,store:{configured:false},corsOrigin:['http://localhost:5174','http://127.0.0.1:5174'],modelAssets:createModelAssetHandler({store})});
server.listen(9095,'127.0.0.1',()=>console.log('Mage Cat preview assets ready on 127.0.0.1:9095'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.shutdown());
