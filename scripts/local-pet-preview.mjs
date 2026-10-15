import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createPetHandler } from '../server/pet-server.mjs';
import { sanitizeAction, sanitizeActor, publicRoom, StorageError } from '../server/github-store.mjs';
import { initialState, normalizeState, reduceAction, careActionInfo } from '../src/state.js';
import { publicGameEvent, validGameHub } from '../src/minigames.js';

import { HOME_ENTRIES, initialHomeState } from '../src/home-context.js';
import { normalizeMemoryJournal, validMemoryJournal } from '../src/memory-journal.js';

export const PREVIEW_HOME = '00000000000000000000000000005174';
/** Development-only file storage. No extra listener, credentials, GitHub call,
 * or production save is involved. The existing Vite listener carries HTTP/SSE. */
export function createLocalPreviewStore({ file, legacyFile, now=Date.now, homeId=PREVIEW_HOME, seedState=initialState } = {}) {
  let queue = Promise.resolve();
  const migration=legacyFile?(async()=>{
    await mkdir(dirname(file),{recursive:true});
    try { await copyFile(legacyFile,file,constants.COPYFILE_EXCL); }
    catch(error) {if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
  })():Promise.resolve();
  async function load() {
    try {
      await migration;
      const room = JSON.parse(await readFile(file,'utf8'));
      if (!room || room.roomId !== homeId || !Number.isSafeInteger(room.revision) || !validGameHub(room.state?.games,{privateState:true}) || !Array.isArray(room.operations) || !Array.isArray(room.claimedGrowth) || (room.state.diary!==undefined && !validMemoryJournal(room.state.diary))) throw new Error('invalid preview save');
      room.state.diary=normalizeMemoryJournal(room.state.diary,room.state,now(),room.createdAt);
      return room;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new StorageError('PREVIEW_STORAGE_ERROR','本地预览存档暂不可用，原记录没有被覆盖。');
      const at=now();
      return { version:1, roomId:homeId, revision:0, state:seedState(at), operations:[], claimedGrowth:[], createdAt:at, updatedAt:at };
    }
  }
  async function persist(room) {
    await mkdir(dirname(file),{recursive:true});
    const temporary=`${file}.tmp`;
    await writeFile(temporary,JSON.stringify(room),'utf8');
    await rename(temporary,file);
  }
  return {
    configured:true,
    storage:'local-preview',
    async getRoom(roomId) {
      if (roomId !== homeId) throw new StorageError('ROOM_NOT_FOUND','本地预览小窝不存在。',404);
      return publicRoom(await load());
    },
    async applyAction(roomId,input) {
      if (roomId !== homeId) throw new StorageError('ROOM_NOT_FOUND','本地预览小窝不存在。',404);
      const action=sanitizeAction(input?.action), actor=sanitizeActor(input?.clientId,input?.name), operationId=input?.operationId;
      if (!action || !actor || typeof operationId !== 'string' || !/^[a-zA-Z0-9_.:-]{8,180}$/.test(operationId)) throw new StorageError('INVALID_ACTION','操作内容无效。',400);
      const result=queue.catch(()=>{}).then(async()=>{
        const room=await load();
        const duplicate=room.operations.find(op=>op.id===operationId);
        if (duplicate) {
          if (duplicate.event.actor.id!==actor.id || JSON.stringify(duplicate.event.action)!==JSON.stringify(action)) throw new StorageError('OPERATION_CONFLICT','操作编号已用于其他操作。',409);
          return {...publicRoom(room),event:publicGameEvent(duplicate.event),duplicate:true};
        }
        const invitation=room.state.collection?.sceneInvited?.find(record=>record.operationId===operationId)
          || room.state.collection?.invited?.find(record=>record.operationId===operationId);
        if(invitation) {
          if(action.type!=='invite-cat' || action.catId!==invitation.id || actor.id!==invitation.actorId || (action.sceneId||'station')!==(invitation.sceneId||'station')) throw new StorageError('OPERATION_CONFLICT','操作编号已用于其他操作。',409);
          return {...publicRoom(room),event:{operationId,action,actor},duplicate:true};
        }
        const produced=room.state.pendingGrowth.find(r=>r.id===operationId) || room.claimedGrowth.find(r=>r.id===operationId);
        if(action.type==='game-create' && (room.state.pendingGrowth.some(r=>r.id===`game:${operationId}`) || room.claimedGrowth.some(r=>r.id===`game:${operationId}`))) throw new StorageError('OPERATION_CONFLICT','操作编号已用于已结算的小游戏。',409);
        if (produced) {
          if (produced.actorId!==actor.id || produced.kind!==action.type || produced.furniture!==action.furniture || action.type==='feed' && produced.food!==action.food) throw new StorageError('OPERATION_CONFLICT','操作编号已用于其他操作。',409);
          return {...publicRoom(room),event:{operationId,action,actor},duplicate:true};
        }
        const at=now(), info=careActionInfo(room.state,action,actor.id,at);
        if (!info.allowed) throw new StorageError('CARE_COOLDOWN','请等待照顾冷却或每日额度恢复。',409);
        const next=reduceAction(room.state,action,actor,at,operationId);
        if (!next) throw new StorageError('ACTION_REJECTED','对局或小窝已更新，请按最新状态操作。',409);
        if (action.type==='claim-growth') room.claimedGrowth.push(room.state.pendingGrowth.find(r=>r.id===action.rewardId));
        const event={operationId,action,actor};
        room.state=normalizeState(next,at); room.revision++; room.updatedAt=at;
        room.operations=[...room.operations,{id:operationId,event}].slice(-100);
        await persist(room);
        return {...publicRoom(room),event:publicGameEvent(event),duplicate:false};
      });
      queue=result;
      return result;
    },
  };
}
export function localPetPreview({ root, enabled }) {
  return {
    name:'cat-nest-local-pet-preview', apply:'serve',
    configureServer(server) {
      if (!enabled) return;
      // Preview saves are runtime data, outside watched source directories.
      // Watching a save can reload the page and interrupt the next bot turn.
      const folder=`cat-nest-preview-${createHash('sha256').update(root).digest('hex').slice(0,16)}`;
      const handle=createPetHandler({store:createLocalPreviewStore({file:resolve(tmpdir(),folder,'home.json'),legacyFile:resolve(root,'.cat-preview','home.json')}),coupleRoomId:PREVIEW_HOME,serveStatic:false,pollMs:2000});
      const namedHandles=new Map(HOME_ENTRIES.filter(home=>home.source==='room').map(home=>[home.roomId,createPetHandler({store:createLocalPreviewStore({file:resolve(tmpdir(),folder,`${home.id}.json`),homeId:home.roomId,seedState:at=>initialHomeState(home,at)}),coupleRoomId:home.roomId,serveStatic:false,pollMs:2000})]));
      server.middlewares.use((request,response,next)=>{
        const path=new URL(request.url || '/','http://localhost').pathname;
        if (!['/api/couple/home','/api/health'].includes(path) && !path.startsWith('/api/rooms/')) return next();
        const selected=namedHandles.get(/^\/api\/rooms\/([a-f0-9]{32})(?:\/|$)/.exec(path)?.[1]) || handle;
        selected(request,response).then(handled=>{if(!handled)next();}).catch(next);
      });
      server.httpServer?.once('close',()=>{handle.close();for(const named of namedHandles.values())named.close();});
    },
  };
}
