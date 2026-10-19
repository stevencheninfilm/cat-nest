import { pathToFileURL } from 'node:url';

/** Promote Pages only after the same source revision can safely save progress. */
export async function waitForBackendRelease({url,sha,fetchImpl=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,timeoutMs=900_000,pollMs=5_000,log=console.log}={}) {
  if(!/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Expected a full release commit SHA');
  const base=new URL(url);if(base.protocol!=='https:')throw new Error('Backend release checks require HTTPS');
  const versionUrl=new URL('/version.json',base),healthUrl=new URL('/api/health',base);
  versionUrl.searchParams.set('release_check',sha);
  const start=now();let attempts=0;
  for(;;){
    attempts++;
    try {
      const response=await fetchImpl(versionUrl,{cache:'no-store',signal:AbortSignal.timeout(10_000)});
      if(response.ok&&(await response.json()).release===sha){
        const health=await fetchImpl(healthUrl,{cache:'no-store',signal:AbortSignal.timeout(10_000)});
        if(health.ok){const state=await health.json();if(state.ok===true&&state.configured===true){log(`Backend ${sha.slice(0,12)} is ready; Pages may publish.`);return {sha,attempts};}}
      }
    }catch{/* Transient network/startup errors must not publish a mismatched UI. */}
    const remaining=timeoutMs-(now()-start);
    if(remaining<=0)throw new Error(`Backend ${sha.slice(0,12)} is not ready; Pages publication stopped.`);
    log(`Waiting for backend ${sha.slice(0,12)} (attempt ${attempts})…`);
    await pause(Math.min(pollMs,remaining));
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await waitForBackendRelease({url:process.env.BACKEND_URL,sha:process.env.GITHUB_SHA});
}
