import test from 'node:test';
import assert from 'node:assert/strict';
import {CAT_PLAY_UNLOCK_LEVEL,TOUCH_GAMES,catPlayUnlocked} from '../src/minigames-touch-rules.js';
import {initialState,normalizeState,levelStartXp,levelInfo,reduceAction} from '../src/state.js';
import {minigamesPanel} from '../src/minigames-ui.js';
import {createDemoEngine,DEMO_ACTORS} from '../demo/engine.js';
import {createMemoryStorage} from '../demo/storage.js';

const now=Date.UTC(2026,9,15),actor={id:'partner-male',name:'男方'},threshold=levelStartXp(CAT_PLAY_UNLOCK_LEVEL);
test('cat play unlocks exactly at level five for every game and mode',()=>{
  assert.equal(CAT_PLAY_UNLOCK_LEVEL,5);
  assert.equal(catPlayUnlocked(NaN),false);
  assert.equal(catPlayUnlocked(levelInfo(threshold-.1).level),false);
  assert.equal(catPlayUnlocked(levelInfo(threshold).level),true);
  for(const game of TOUCH_GAMES)for(const mode of ['solo','computer','duo']){
    const action={type:'game-create',game,mode,previousId:null};
    assert.equal(reduceAction({...initialState(now),xp:threshold-.1},action,actor,now,'below-unlock'),null,`${game}/${mode}`);
    assert.ok(reduceAction({...initialState(now),xp:threshold},action,actor,now,'at-unlock'),`${game}/${mode}`);
  }
  assert.ok(reduceAction({...initialState(now),xp:0},{type:'pet'},actor,now,'pet-before-unlock'));
  assert.ok(reduceAction({...initialState(now),xp:0},{type:'game-create',game:'rps',mode:'solo',previousId:null},actor,now,'classic-before-unlock'));
});
test('existing saved play can continue and end below the new unlock level',()=>{
  for(const game of TOUCH_GAMES){
    const started=reduceAction({...initialState(now),xp:threshold},{type:'game-create',game,mode:'solo',previousId:null},actor,now,'old-game');
    const saved=normalizeState({...started,xp:0},now);
    assert.equal(saved.games.match.id,started.games.match.id);
    const ready=reduceAction(saved,{type:'game-arcade-ready',gameId:saved.games.match.id},actor,now,'resume-old-game');
    assert.ok(ready);
    const ended=reduceAction(ready,{type:'game-cancel',gameId:ready.games.match.id},actor,now,'end-old-game');
    assert.equal(ended.games.match.status,'cancelled');
  }
});
test('game house gates the same touch games while keeping classic games available',()=>{
  const state={...initialState(now),xp:threshold-.1};
  const locked=minigamesPanel({state,clientId:actor.id,now});
  for(const game of TOUCH_GAMES){
    assert.match(locked,new RegExp(`data-game-select="${game}"[^>]*disabled`));
    const picker=minigamesPanel({state,clientId:actor.id,selectedGame:game,now});
    assert.match(picker,/Lv\.5 后解锁陪玩/);
    assert.equal((picker.match(/data-game-create="[^"]+"[^>]*disabled/g)||[]).length,3);
  }
  assert.doesNotMatch(locked,/data-game-select="rps"[^>]*disabled/);
  const open=minigamesPanel({state:{...state,xp:threshold},clientId:actor.id,now});
  for(const game of TOUCH_GAMES)assert.doesNotMatch(open,new RegExp(`data-game-select="${game}"[^>]*disabled`));
});
test('default demo respects the lock and its existing unlock control opens play',()=>{
  const engine=createDemoEngine({storage:createMemoryStorage(),now:()=>now});
  const send=()=>engine.action({clientId:DEMO_ACTORS.male.id,operationId:crypto.randomUUID(),action:{type:'game-create',game:'teaser',mode:'solo',previousId:null}});
  assert.equal(send().status,409);
  assert.equal(engine.snapshot().state.games.match,null);
  engine.scenario('unlock');
  assert.equal(send().status,200);
});
