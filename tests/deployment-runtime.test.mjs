import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,relative,join,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('the production image includes the complete API import graph, including shared restaurant rules and home config',async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const docker=await readFile(join(root,'Dockerfile'),'utf8');
  const copies=[...docker.matchAll(/^COPY --from=build \/app\/(\S+) \.\/(\S+)$/gm)].map(match=>match[1]);
  const files=new Set(),queue=['server/index.mjs','scripts/court-archive.mjs'];
  while(queue.length){
    const name=queue.shift();if(files.has(name))continue;
    await access(join(root,name));files.add(name);
    assert.ok(copies.some(source=>name===source||name.startsWith(`${source}/`)),`API runtime dependency missing from image: ${name}`);
    if(extname(name)==='.json')continue;
    const source=await readFile(join(root,name),'utf8');
    for(const match of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g)){
      let dependency=resolve(root,dirname(name),match[1]);
      if(!extname(dependency))dependency+='.js';
      queue.push(relative(root,dependency));
    }
  }
  assert.ok(files.has('src/game-defaults.js'));
  assert.ok(files.has('src/restaurant-facilities.js'));
  assert.ok(files.has('config/homes.json'));
  const staged=await mkdtemp(join(tmpdir(),'catnest-api-runtime-'));
  t.after(()=>rm(staged,{recursive:true,force:true}));
  for(const name of [...files,'package.json']){
    await mkdir(dirname(join(staged,name)),{recursive:true});
    await copyFile(join(root,name),join(staged,name));
  }
  const api=await import(pathToFileURL(join(staged,'server/pet-server.mjs')).href);
  const court=await import(pathToFileURL(join(staged,'server/court.mjs')).href);
  assert.equal(typeof api.createPetHandler,'function');
  assert.equal(typeof court.createCourtServer,'function');
});
