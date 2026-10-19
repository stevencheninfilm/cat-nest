import { StorageError } from './github-store.mjs';

export const GUIDE_ROLES = ['male', 'female'];
export const GUIDE_PHASES = ['unknown', 'legacy', 'shown', 'paused', 'completed'];
export const emptyGuide = () => ({ generation:0, phase:'unknown', shownAt:null, pausedAt:null, completedAt:null, reportedAt:null, resetAt:null });
const validId = id => typeof id==='string' && /^[a-z][a-z0-9-]{0,39}$/i.test(id);
const plain = value => value && typeof value==='object' && !Array.isArray(value);
export function validGuide(value) {
  return plain(value) && Number.isSafeInteger(value.generation) && value.generation>=0 && GUIDE_PHASES.includes(value.phase)
    && ['shownAt','pausedAt','completedAt','reportedAt','resetAt'].every(key=>value[key]===null || Number.isSafeInteger(value[key])&&value[key]>=0);
}
export function validGuideReport(value) {
  return plain(value) && Object.keys(value).length===3 && Number.isSafeInteger(value.generation) && value.generation>=0
    && GUIDE_PHASES.slice(1).includes(value.phase) && typeof value.operationId==='string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value.operationId);
}

/** Separate metadata files: no room snapshot, revision, rewards or care action is changed. */
export function createGuideStore({token=process.env.GITHUB_TOKEN, repository=process.env.GITHUB_REPOSITORY||'stevencheninfilm/cat-nest-data', branch=process.env.GITHUB_BRANCH||'main', fetchImpl=globalThis.fetch, now=Date.now, maxRetries=4}={}) {
  const configured=typeof token==='string'&&!!token.trim()&&/^[\w.-]+\/[\w.-]+$/.test(repository);
  const locks=new Map();
  async function request(home,method,input) {
    if(!configured)throw new StorageError('GUIDE_NOT_CONFIGURED','向导记录暂不可用。');
    const url=`https://api.github.com/repos/${repository}/contents/guides/${home}.json${method==='GET'?`?${new URLSearchParams({ref:branch})}`:''}`;
    try {return await fetchImpl(url,{method,redirect:'error',signal:AbortSignal.timeout(15_000),headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cat-nest-guide','Cache-Control':'no-cache',...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});}
    catch {throw new StorageError('GUIDE_UNAVAILABLE','向导记录暂不可用，请稍后重试。');}
  }
  async function read(home) {
    if(!validId(home))throw new StorageError('INVALID_HOME','存档入口无效。',400);
    const response=await request(home,'GET');
    if(response.status===404)return {data:{version:1,roles:{male:emptyGuide(),female:emptyGuide()},resetIds:[]},sha:null};
    if(!response.ok)throw new StorageError('GUIDE_UNAVAILABLE','向导记录暂不可用。');
    try {
      const file=await response.json(),data=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
      if(typeof file.sha!=='string'||data.version!==1||!GUIDE_ROLES.every(role=>validGuide(data.roles?.[role]))||!Array.isArray(data.resetIds)||data.resetIds.length>100)throw Error();
      return {data,sha:file.sha};
    } catch {throw new StorageError('GUIDE_CORRUPT','向导记录格式异常，请联系维护者。');}
  }
  async function change(home,update) {
    const previous=locks.get(home)||Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      for(let attempt=0;attempt<maxRetries;attempt++) {
        const {data,sha}=await read(home),result=update(data);
        if(!result.changed)return result.value;
        const response=await request(home,'PUT',{message:`Update guide preferences ${home}`,branch,content:Buffer.from(JSON.stringify(data)).toString('base64'),...(sha?{sha}:{})});
        if([409,422].includes(response.status))continue;
        if(!response.ok)throw new StorageError('GUIDE_WRITE_FAILED','向导设定未确认保存，请稍后重试。');
        return result.value;
      }
      throw new StorageError('GUIDE_CONFLICT','向导设定正在更新，请稍后重试。',409);
    });
    locks.set(home,task);return task.finally(()=>{if(locks.get(home)===task)locks.delete(home);});
  }
  function checkRole(role){if(!GUIDE_ROLES.includes(role))throw new StorageError('INVALID_ROLE','请选择男方或女方。',400);}
  return {
    configured,
    async get(home,role){checkRole(role);return structuredClone((await read(home)).data.roles[role]);},
    async list(home){return structuredClone((await read(home)).data.roles);},
    async report(home,role,input) {
      checkRole(role);if(!validGuideReport(input))throw new StorageError('INVALID_GUIDE_REPORT','向导记录无效。',400);
      return change(home,data=>{
        const record=data.roles[role];
        // An old device must never acknowledge or overwrite a newer reset.
        if(input.generation!==record.generation)return {changed:false,value:{record,stale:true}};
        if(GUIDE_PHASES.indexOf(input.phase)<=GUIDE_PHASES.indexOf(record.phase))return {changed:false,value:{record,stale:false}};
        const at=now();record.phase=input.phase;record.reportedAt=at;
        if(input.phase!=='legacy')record.shownAt??=at;
        if(input.phase==='paused')record.pausedAt=at;
        if(input.phase==='completed')record.completedAt=at;
        return {changed:true,value:{record,stale:false}};
      });
    },
    async reset(home,role,{expectedGeneration,operationId}) {
      checkRole(role);
      if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||typeof operationId!=='string'||!/^[-\w]{8,80}$/.test(operationId))throw new StorageError('INVALID_RESET','重置请求无效。',400);
      return change(home,data=>{
        const record=data.roles[role],old=data.resetIds.find(item=>item.id===operationId);
        if(old){if(old.role!==role||old.generation!==expectedGeneration+1)throw new StorageError('GUIDE_CONFLICT','该请求编号已使用。',409);return {changed:false,value:record};}
        if(record.generation!==expectedGeneration)throw new StorageError('GUIDE_CONFLICT','向导状态已经变化，请刷新后重试。',409);
        data.roles[role]={...emptyGuide(),generation:expectedGeneration+1,resetAt:now()};
        data.resetIds.push({id:operationId,role,generation:expectedGeneration+1});data.resetIds=data.resetIds.slice(-100);
        return {changed:true,value:data.roles[role]};
      });
    },
  };
}
