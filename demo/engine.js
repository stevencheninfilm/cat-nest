import { initialState, normalizeState, reduceAction, FOODS, foodCooldownMs, levelStartXp } from '../src/state.js';
import { publicGameHub } from '../src/minigames.js';
import { COUPLE_ROLES } from '../src/couple-profile.js';
import { demoLocalStorage } from './storage.js';
import { TOUCH_GAMES, TOUCH_DURATION, touchComputerEvents } from '../src/minigames-touch-rules.js';

export const DEMO_ROOM = 'dddddddddddddddddddddddddddd5174';
const clone = value => structuredClone(value);
export const DEMO_ACTORS = Object.fromEntries(COUPLE_ROLES.map(role => [role.id, { id:role.clientId, name:role.name }]));

export function demoSeed(now = Date.now()) {
  let state = { ...initialState(now-13*86_400_000), name:'糯米', coins:12000, xp:400, love:320, hunger:90, mood:94, energy:96, needsUpdatedAt:now, updatedAt:now, appearance:{body:4,clothes:1,eyes:0,wand:0} };
  // Fictional keepsakes belong only to the isolated, reset-on-refresh test save.
  state.diary.entries.push({id:'level:2',kind:'level',at:now-7*86_400_000,catName:'糯米',photo:'happy',level:2});
  for (const [role, action, age] of [['male',{type:'feed',food:'water'},12*60_000],['female',{type:'feed',food:'mousse'},8*60_000],['female',{type:'pet'},2*60_000]]) {
    state = reduceAction(state, action, DEMO_ACTORS[role], now-age, `demo-seed-${role}-${action.type}`) || state;
  }
  return normalizeState(state, now);
}

/** Same reducer as the real server, with a deliberately different data store. */
export function createDemoEngine({ storage = demoLocalStorage, now = Date.now, publish = () => {} } = {}) {
  const key = 'server';
  let record;
  try { record = JSON.parse(storage.getItem(key)); } catch {}
  if (!record || record.version !== 1 || !Number.isSafeInteger(record.revision)) record = {version:1,revision:0,state:demoSeed(now()),receipts:[],court:null};
  const listeners = new Set();
  const logs = [];
  const controls = { latency:650, offline:false, rejectNext:false, partnerOnline:true };
  function snapshot(event) {
    const state = normalizeState(record.state, now());
    state.games = publicGameHub(state.games);
    return { roomId:DEMO_ROOM, state, revision:record.revision, ...(event ? {event:clone(event)} : {}) };
  }
  function log(method, path, status) { logs.unshift({at:new Date(now()).toISOString(),method,path,status,revision:record.revision}); logs.splice(30); }
  function notify(type, data) { for (const listener of listeners) listener(type,clone(data)); }
  function persist(event) { storage.setItem(key, JSON.stringify(record)); publish(record.revision); notify(event ? 'action':'state', snapshot(event)); }
  function replace(state) { record.state=normalizeState(state,now()); record.revision++; persist(); }
  function action(item) {
    const actor = Object.values(DEMO_ACTORS).find(actor => actor.id === item.clientId);
    if (!actor || typeof item.operationId !== 'string') return {status:400,error:'请选择一个演示身份'};
    if (record.receipts.includes(item.operationId)) return {status:200,data:snapshot()};
    const state = reduceAction(record.state,item.action,actor,now(),item.operationId);
    if (!state) return {status:409,error:'这次操作不满足条件，已恢复原来的状态'};
    record.state=state; record.revision++; record.receipts.push(item.operationId); record.receipts=record.receipts.slice(-500);
    const event={operationId:item.operationId,action:item.action,actor}; persist(event);
    return {status:200,data:snapshot(event)};
  }
  storage.setItem(key,JSON.stringify(record));
  return {
    controls, logs, snapshot, action, log,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    roster(me) { return [me, ...(controls.partnerOnline ? [Object.values(DEMO_ACTORS).find(actor => actor.id !== me.id)] : [])]; },
    presence() { notify('presence-refresh',null); },
    setOffline(value) { controls.offline=value; notify(value ? 'disconnect':'reconnect',null); },
    sync() { try { const saved=JSON.parse(storage.getItem(key)); if (saved?.revision > record.revision) { record=saved; notify('state',snapshot()); } } catch {} },
    reset() { record={version:1,revision:record.revision+1,state:demoSeed(now()),receipts:[],court:null}; persist(); },
    scenario(kind, role='male', food='mousse') {
      const other = role === 'male' ? 'female':'male';
      if (kind === 'new-home') { controls.partnerOnline=false;replace({...initialState(now()),xp:0,love:0});notify('presence-refresh',null);return '已准备全新测试小窝，原有正式存档不受影响'; }
      if (kind === 'join') { controls.partnerOnline=true;const result=action({clientId:DEMO_ACTORS[other].id,operationId:`demo-join-${crypto.randomUUID()}`,action:{type:'join-home'}});notify('presence-refresh',null);return result.error||'演示伙伴已加入共同小窝'; }
      if (kind === 'unlock') {
        const s=clone(record.state); s.xp=levelStartXp(125)+20; s.coins=99999;
        s.collection.stats={feed:10000,pet:10000,play:10000,sleep:10000,pair:10000}; s.collection.foods=Object.keys(FOODS);
        s.collection.wins={rps:10000,memory:10000,gomoku:10000};
        s.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:20,play:10,sleep:3}};
        replace(s); return '已解锁全部成长阶段和基础图鉴邀请条件；编号 25–36 按已解锁日记卡片开放';
      }
      if (kind === 'clear-limits') { const s=clone(record.state); s.careLimits=initialState(now()).careLimits; s.sleeping=false; s.hunger=s.mood=s.energy=96; s.needsUpdatedAt=now(); replace(s); return '每日次数、冷却和体力已恢复，仅影响演示'; }
      if (kind === 'portion') {
        const s=clone(record.state); s.feedRecords=Object.values(DEMO_ACTORS).map((actor,i)=>({actorId:actor.id,actor:actor.name,food:i ? food:'water',at:now()-Math.round(foodCooldownMs(i ? food:'water')*.76)}));
        s.careLimits.feedCooldowns=s.feedRecords.map(({actorId,food,at})=>({actorId,food,at}));
        replace(s); return '已切到食物剩余 25% 的展示';
      }
      const type = kind === 'relay' ? 'pet' : kind;
      const actor=DEMO_ACTORS[other];
      if (kind === 'relay') { const s=clone(record.state); s.careLimits=initialState(now()).careLimits; s.sleeping=false; s.energy=96; replace(s); }
      if (kind === 'feed') { const s=clone(record.state); s.careLimits.feedCooldowns=s.careLimits.feedCooldowns.filter(record=>record.actorId!==actor.id); s.careLimits.counts.feed=0; replace(s); }
      const result=action({clientId:actor.id,operationId:`demo-partner-${crypto.randomUUID()}`,action:{type,...(type==='feed' ? {food}: {})}});
      return result.error || `演示伙伴${actor.name}${type==='pet' ? '摸了摸小猫，轮到你逗猫接力啦':'完成了一次互动'}`;
    },
    getCourt() { return clone(record.court); },
    saveCourt(court) { record.court=clone(court); storage.setItem(key,JSON.stringify(record)); },
    partnerGame(viewerId) {
      const m=record.state.games?.match;
      if(!m || m.mode!=='duo' || !['waiting','active'].includes(m.status))return false;
      const actor=Object.values(DEMO_ACTORS).find(actor=>actor.id!==viewerId);
      const step=m.game==='rps' ? m.rounds.length:m.step;
      let next;
      if(m.status==='waiting')next={type:'game-join',gameId:m.id};
      else if(TOUCH_GAMES.includes(m.game)){
        const player=m.players.findIndex(p=>p.id===actor.id),a=m.arcade,run=a.runs[player];
        if(player<0)return false;
        if(a.stage==='ready'){if(a.ready[player])return false;next={type:'game-arcade-ready',gameId:m.id};}
        else{
          if(a.stage!=='running'||now()<a.startAt||run.finished)return false;
          const until=Math.min(TOUCH_DURATION[m.game],now()-a.startAt);
          const events=touchComputerEvents(m.game,a.seed,'normal').filter(e=>e[0]>run.elapsed&&e[0]<=until);
          next={type:'game-arcade-input',gameId:m.id,seq:run.seq,until,events};
        }
      }
      else if(m.phase==='reveal') { if(now()<m.revealUntil)return false; next={type:'game-next',gameId:m.id,step}; }
      else {
        const player=m.players.findIndex(player=>player.id===actor.id);
        if(player<0 || (m.game==='rps' ? m.locked[player] : m.players[m.turn]?.id!==actor.id))return false;
        const move=m.game==='rps' ? ['rock','paper','scissors'][Math.floor(Math.random()*3)]
          : m.game==='memory' ? m.matched.findIndex((matched,i)=>!matched&&!m.flipped.includes(i))
          : m.game==='guess' ? Math.floor((m.low+m.high)/2)
          : m.game==='connect4' ? m.board.slice(0,7).findIndex(cell=>!cell) : m.board.findIndex(cell=>!cell);
        if(move===-1)return false;
        next={type:'game-move',gameId:m.id,step,move};
      }
      return action({clientId:actor.id,operationId:`demo-game-${crypto.randomUUID()}`,action:next}).status===200;
    },
  };
}
