import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForBackendRelease} from '../scripts/wait-backend-release.mjs';

const sha='a'.repeat(40),url='https://backend.example.test';
const reply=data=>({ok:true,json:async()=>data});
test('Pages waits for the exact backend commit and configured health',async()=>{
 let time=0,versions=0,health=0;const requests=[];
 const result=await waitForBackendRelease({url,sha,log(){},now:()=>time,pause:async ms=>{time+=ms;},pollMs:1,timeoutMs:20,
  fetchImpl:async target=>{requests.push(target.href);if(target.pathname==='/version.json')return reply({release:++versions<2?'b'.repeat(40):sha});return reply({ok:true,configured:++health>1});}});
 assert.equal(result.attempts,3);assert.equal(health,2);assert.ok(requests.every(value=>new URL(value).origin===url));
});
test('transient fetch and invalid responses retry without opening the frontend gate',async()=>{
 let time=0,reads=0;
 const result=await waitForBackendRelease({url,sha,log(){},now:()=>time,pause:async ms=>{time+=ms;},pollMs:1,timeoutMs:10,
  fetchImpl:async target=>{if(target.pathname==='/api/health')return reply({ok:true,configured:true});reads++;if(reads===1)throw Error('offline');if(reads===2)return {ok:true,json:async()=>{throw Error('startup response');}};return reply({release:sha});}});
 assert.equal(result.attempts,3);
});
test('a mismatched or unhealthy backend never permits Pages publication',async()=>{
 for(const readyVersion of [false,true]){
  let time=0;
  await assert.rejects(waitForBackendRelease({url,sha,log(){},now:()=>time,pause:async ms=>{time+=ms;},pollMs:1,timeoutMs:3,
   fetchImpl:async target=>target.pathname==='/version.json'?reply({release:readyVersion?sha:'c'.repeat(40)}):reply({ok:false,configured:false})}),/Pages publication stopped/);
 }
});
