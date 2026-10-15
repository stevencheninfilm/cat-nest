import { readFile, readdir, access, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_ENTRIES } from '../src/home-context.js';

export async function verifySharedBuild(directory,entries=HOME_ENTRIES) {
  let common;
  for(const {id} of entries) {
    const html=await readFile(resolve(directory,id,'index.html'),'utf8');
    if(common!==undefined && html!==common)throw new Error(`${id} 使用了不同的应用入口`);
    common=html;
    for(const folder of ['assets','model']) {
      try{await access(resolve(directory,id,folder));}catch(error){if(error.code==='ENOENT')continue;throw error;}
      throw new Error(`${id} 含有独立应用资源副本`);
    }
  }
  const scripts=[...common.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
  if(scripts.length!==1 || !scripts[0].startsWith('/cat-nest/assets/'))throw new Error('缺少唯一共享入口');
  const entry=scripts[0].replace('/cat-nest/','');
  const assets=await readdir(resolve(directory,'assets'));
  await access(resolve(directory,entry));
  const appHash=createHash('sha256').update(common).digest('hex');
  return {appHash,entry,entries:entries.map(home=>home.id),assetCount:assets.length};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const directory=fileURLToPath(new URL('../dist/',import.meta.url));
  const result=await verifySharedBuild(directory);
  const release=process.env.GITHUB_SHA || process.env.RENDER_GIT_COMMIT || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  await writeFile(resolve(directory,'version.json'),JSON.stringify({release,...result},null,2));
  console.log(`Shared application verified: ${result.entries.join(', ')} → ${result.entry}`);
}
