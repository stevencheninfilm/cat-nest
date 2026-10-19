import { verify } from 'node:crypto';
import homes from '../config/homes.json' with {type:'json'};
import admin from '../config/guide-admin.json' with {type:'json'};
import { createGuideStore, GUIDE_ROLES } from './guide-store.mjs';
import { StorageError } from './github-store.mjs';

export const guideResetMessage = (home,role,input) => JSON.stringify(['cat-nest-guide-reset-v1',home,role,input.expectedGeneration,input.operationId,input.issuedAt]);
export function verifyGuideReset(home,role,input,{publicKey=admin.publicKey,now=Date.now}={}) {
  if(!input || Object.keys(input).length!==4 || !Number.isSafeInteger(input.issuedAt)||Math.abs(now()-input.issuedAt)>300_000||typeof input.signature!=='string'||input.signature.length>200)return false;
  try{return verify(null,Buffer.from(guideResetMessage(home,role,input)),publicKey,Buffer.from(input.signature,'base64'));}catch{return false;}
}
export function createGuideHandler({store=createGuideStore(),publicKey=admin.publicKey,now=Date.now,registeredHomes=homes}={}) {
  const allowed=new Set(registeredHomes.filter(home=>home.source!=='test').map(home=>home.id));
  const rates=new Map();
  return async(request,response,url,{json,body})=>{
    if(!url.pathname.startsWith('/api/guides/'))return false;
    // IDs are case-sensitive, matching the registered save entry (e.g. Crown).
    const match=/^\/api\/guides\/([a-z][a-z0-9-]{0,39})(?:\/(male|female)(?:\/(reset))?)?$/i.exec(url.pathname);
    const [,home,role,reset]=match||[];
    if(!allowed.has(home)||role&&!GUIDE_ROLES.includes(role))throw new StorageError('GUIDE_NOT_FOUND','没有找到这个存档的向导记录。',404);
    if(request.method==='GET'&&!reset){json(response,200,role?{record:await store.get(home,role)}:{roles:await store.list(home)});return true;}
    if(request.method==='POST'&&role) {
      const input=await body(request);
      if(reset) {
        if(!verifyGuideReset(home,role,input,{publicKey,now}))throw new StorageError('GUIDE_FORBIDDEN','此操作只允许本机管理后台发起。',403);
        json(response,200,{record:await store.reset(home,role,input)});return true;
      }
      const key=`${home}:${role}:${request.socket?.remoteAddress}`,at=now(),rate=rates.get(key);
      if(rate&&at<rate.until&&rate.count>=20)throw new StorageError('GUIDE_RATE_LIMIT','向导记录请求较多，请稍后重试。',429);
      rates.set(key,rate&&at<rate.until?{...rate,count:rate.count+1}:{count:1,until:at+60_000});
      if(rates.size>10000)for(const [key,value]of rates)if(value.until<at)rates.delete(key);
      json(response,200,await store.report(home,role,input));return true;
    }
    json(response,405,{error:{code:'METHOD_NOT_ALLOWED',message:'不支持当前请求方式。'}});return true;
  };
}
