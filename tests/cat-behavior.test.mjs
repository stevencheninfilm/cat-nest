import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catTemperament, createCatBehavior, idleChoices, CAT_EXPRESSION_SECONDS } from '../src/cat-behavior.js';
import { createMageAnimationPlayer } from '../src/mage-cat-player.js';
import { createDialoguePicker, CAT_DIALOGUE } from '../src/cat-speech.js';
import { CAT_EXPRESSIONS } from '../src/cat-expressions.js';
import { CAT_ACTIONS, MANUAL_ONLY_CAT_CLIPS } from '../src/cat-actions.js';

const at = hour => new Date(2026, 9, 14, hour).valueOf();
const healthy = { hunger: 70, energy: 76, mood: 90, sleeping: false };
const clips = ['idle', 'walk', 'run', 'attack', 'special_attack', 'turn_left', 'turn_right', 'hurt', 'death']
  .map(name => new THREE.AnimationClip(`Cat|${name}`, name === 'attack' ? 3.45 : name === 'special_attack' ? 2.883 : 1, []));
function fixture(options = {}) {
  const behavior = createCatBehavior({ random: () => .4, clock: () => at(14), ...options });
  behavior.setClips(clips); behavior.setState(healthy); return behavior;
}
function advance(behavior, seconds) { let pose; for (let i = 0; i < Math.ceil(seconds * 30); i++) pose = behavior.step(1 / 30); return pose; }

test('local day boundaries and current needs determine mood without mutating the shared state', () => {
  for (const [hour, period] of [[0, 'night'], [5, 'night'], [6, 'morning'], [10, 'morning'], [11, 'day'], [16, 'day'], [17, 'evening'], [18, 'evening'], [20, 'evening'], [21, 'night'], [22, 'night'], [23, 'night']]) {
    assert.equal(catTemperament(healthy, at(hour)).period, period);
  }
  for (const [state, mood] of [[{ sleeping: true, hunger: 0 }, 'sleeping'], [{ hunger: 20 }, 'hungry'], [{ energy: 20 }, 'tired'], [{ mood: 20 }, 'lonely'], [{ energy: 60 }, 'sleepy'], [{}, 'happy']]) {
    const value = { ...healthy, ...state }; const before = structuredClone(value);
    assert.equal(catTemperament(value, at(23)).mood, mood); assert.deepEqual(value, before);
  }
});

test('each chosen expression plays once then restores the prior natural mood without modifying the save', () => {
  const behavior=fixture(), save={...healthy,coins:50,xp:80,pendingGrowth:[]}, before=structuredClone(save);
  for(const expression of CAT_EXPRESSIONS) {
    behavior.setState(save);
    const pose=behavior.setExpression(expression.id);
    assert.equal(pose.mood,expression.id);assert.equal(pose.expression,expression.id);
    assert.equal(pose.source,'expression');
    advance(behavior,CAT_EXPRESSION_SECONDS-.15);
    behavior.setState(save);
    assert.equal(behavior.snapshot().mood,expression.id);
    advance(behavior,.2);
    assert.equal(behavior.snapshot().expression,'auto');
    assert.equal(behavior.snapshot().mood,'happy');
    assert.equal(behavior.snapshot().id,'idle');
  }
  assert.deepEqual(save,before);
  assert.equal(behavior.setExpression('not-an-expression').expression,'auto');
});

test('a temporary expression returns to real sleep and uses current care state when it finishes', () => {
  const behavior=fixture();behavior.setState({...healthy,sleeping:true});
  assert.equal(behavior.setExpression('happy').sleeping,false);
  const restored=advance(behavior,CAT_EXPRESSION_SECONDS+.1);
  assert.equal(restored.mood,'sleeping');assert.equal(restored.eyes,'closed');assert.equal(restored.rate,.25);
  behavior.setExpression('calm');
  behavior.setState({...healthy,sleeping:false,hunger:12});
  assert.equal(behavior.snapshot().mood,'calm');
  assert.equal(advance(behavior,CAT_EXPRESSION_SECONDS+.1).mood,'hungry');
});

test('a second choice replaces the first preview and backgrounding or care can cancel it safely', () => {
  const behavior=fixture();behavior.setExpression('lonely');advance(behavior,2);
  behavior.setExpression('tired');advance(behavior,1.5);
  assert.equal(behavior.snapshot().expression,'tired');
  assert.equal(advance(behavior,1.6).expression,'auto');
  behavior.setExpression('sleeping');behavior.suspend();assert.equal(behavior.snapshot().mood,'happy');
  behavior.setExpression('lonely');assert.equal(behavior.react('pet',healthy).expression,'auto');
  behavior.setExpression('hungry');behavior.cancel(healthy);assert.equal(behavior.snapshot().mood,'happy');
});

test('natural mood controls care responses after a one-shot expression, with dialogue following the visible face', () => {
  const behavior=fixture();behavior.setExpression('lonely');
  assert.ok(['comfort','nuzzle'].includes(behavior.react('touch',{...healthy,mood:20}).id));
  behavior.setExpression('tired');assert.ok(['gentle','comfort'].includes(behavior.react('touch',{...healthy,energy:20}).id));
  behavior.setExpression('sleeping');const response=behavior.react('touch',{...healthy,sleeping:true});
  assert.equal(response.id,'sleepyTouch');assert.equal(response.eyes,'closed');assert.equal(response.mouth,'happy');
  assert.equal(response.expression,'auto');
  const wake=behavior.react('sleep',{...healthy,sleeping:false});assert.equal(wake.expression,'auto');assert.equal(wake.id,'wake');
  const pick=createDialoguePicker(()=>.4);
  assert.ok(CAT_DIALOGUE.comfort.includes(pick('touch',{...healthy,behaviorMood:'lonely'})));
  assert.ok(CAT_DIALOGUE.sleep.includes(pick('touch',{...healthy,behaviorMood:'sleeping'})));
  assert.ok(CAT_DIALOGUE.pet.includes(pick('touch',{...healthy,hunger:0,energy:0,mood:0,behaviorMood:'happy'})));
});

test('five minutes of unattended behavior uses varied authored clips, with quiet gaps and no recent repeats', () => {
  let seed = 24; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const behavior = fixture({ random }), seen = [], keys = new Set(); let previousToken = 0, neutralFrames = 0;
  for (let i = 0; i < 30 * 300; i++) {
    const pose = behavior.step(1 / 30); keys.add(pose.clip);
    if (pose.id === 'idle') neutralFrames++;
    else if (pose.token !== previousToken) { assert.ok(!seen.slice(-2).includes(pose.id)); seen.push(pose.id); previousToken = pose.token; }
    assert.ok(!MANUAL_ONLY_CAT_CLIPS.includes(pose.clip));
  }
  assert.ok(seen.length >= 15); assert.ok(new Set(seen).size >= 5);
  assert.ok(keys.has('walk')); assert.ok(keys.has('turn_left') || keys.has('turn_right'));
  assert.ok(neutralFrames > 30 * 100, 'leave breathing room between gestures');
});

test('happy idle can use all seven everyday clips but spaces out lively gestures', () => {
  let seed=24;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  const behavior=fixture({random}), seen=new Set(), lastByClip=new Map();let token=0,lastLively=-Infinity;
  for(let i=0;i<900*30;i++) {
    const pose=behavior.step(1/30);seen.add(pose.clip);
    if(!pose.token || pose.token===token)continue;
    token=pose.token;
    const gap={run:50,attack:60,special_attack:90}[pose.clip];
    if(gap) {
      assert.ok(pose.elapsed-lastLively>=45-.001);
      assert.ok(pose.elapsed-(lastByClip.get(pose.clip)??-Infinity)>=gap-.001);
      lastLively=pose.elapsed;lastByClip.set(pose.clip,pose.elapsed);
    }
  }
  assert.deepEqual([...seen].sort(),['idle','walk','run','attack','special_attack','turn_left','turn_right'].sort());
});

test('care choices follow mood and avoid adjacent clip repeats without a fixed three-action cycle', () => {
  let seed=12;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  const behavior=fixture({random}), sequence=[];
  for(let i=0;i<40;i++)sequence.push(behavior.react('play',healthy).clip);
  assert.ok(sequence.every((clip,i)=>i===0||clip!==sequence[i-1]));
  assert.ok(sequence.some((clip,i)=>i>=3&&clip!==sequence[i-3]),'do not cycle through three clips in the same order');
  behavior.playAction('special_attack');
  assert.notEqual(behavior.react('play',healthy).clip,'special_attack','manual choices also inform gesture memory');
  for(const [state,allowed] of [
    [{...healthy,energy:15},['slowPlay','nuzzle']],
    [{...healthy,mood:20},['nuzzle','slowPlay','left','right']],
    [{...healthy,mood:60},['slowPlay','paw','left','right']],
    [{...healthy,hunger:15},['slowPlay','nuzzle']],
  ]) {
    for(let i=0;i<16;i++)assert.ok(allowed.includes(behavior.react('play',state).id));
  }
  const feedClips=new Set();for(let i=0;i<20;i++)feedClips.add(behavior.react('feed',healthy).clip);
  assert.ok(feedClips.has('walk')&&feedClips.has('idle'));
});

test('Hit and Death are manual-only across every mood, time, and daily interaction', () => {
  assert.deepEqual(MANUAL_ONLY_CAT_CLIPS,['hurt','death']);
  for(const hour of [8,14,19,23])for(const patch of [{},{mood:60},{mood:20},{hunger:15},{energy:15},{sleeping:true}]) {
    let seed=7;const behavior=fixture({clock:()=>at(hour),random:()=>((seed=(seed*1664525+1013904223)>>>0)/2**32)});
    const state={...healthy,...patch},before=structuredClone(state);behavior.setState(state);
    for(const type of ['pet','touch','feed','play','dress'])for(let i=0;i<8;i++) {
      assert.ok(!MANUAL_ONLY_CAT_CLIPS.includes(behavior.react(type,state).clip));
    }
    behavior.cancel(state);
    for(let i=0;i<90*30;i++)assert.ok(!MANUAL_ONLY_CAT_CLIPS.includes(behavior.step(1/30).clip));
    assert.deepEqual(state,before);
    for(const id of ['hit','death'])assert.equal(behavior.playAction(id).source,'animation');
  }
});

test('night and fatigue suppress running, extend quiet gaps, and never persist autonomous sleep or rewards', () => {
  const behavior = fixture({ clock: () => at(23) });
  const state = { ...healthy, energy: 45, coins: 50, xp: 80, pendingGrowth: [] }, before = structuredClone(state);
  behavior.setState(state); const seen = new Set(); let starts = 0, token = 0;
  for (let i = 0; i < 30 * 300; i++) {
    const pose = behavior.step(1 / 30); seen.add(pose.id);
    assert.equal(pose.sleeping, false); assert.equal(pose.period, 'night'); assert.ok(!['walk', 'run', 'attack', 'special_attack'].includes(pose.clip));
    if (pose.token && pose.token !== token) { starts++; token = pose.token; }
  }
  assert.ok(seen.has('doze') && seen.has('yawn')); assert.ok(starts < 20); assert.deepEqual(state, before);
});

test('care interrupts idle immediately and emotion changes the same interaction', () => {
  const behavior = fixture(); advance(behavior, 5);
  const reaction = behavior.react('play', healthy);
  assert.equal(reaction.source, 'interaction'); assert.ok(['attack', 'run', 'special_attack'].includes(reaction.clip));
  assert.equal(reaction.eyes, 'excited');
  const pet = behavior.react('pet', { ...healthy, mood: 20 });
  assert.ok(['comfort', 'nuzzle'].includes(pet.id)); assert.equal(pet.source, 'interaction');
  const tired = behavior.react('play', { ...healthy, energy: 20 });
  assert.ok(['slowPlay', 'nuzzle'].includes(tired.id)); assert.ok(!['attack', 'run', 'special_attack'].includes(tired.clip));
  behavior.cancel(healthy); assert.equal(behavior.snapshot().id, 'idle');
  assert.equal(behavior.snapshot().mood, 'happy');
});

test('one-shot duration follows the actual authored clip and randomized speed, then returns to idle', () => {
  const behavior = fixture({ random: () => 0 }); const pose = behavior.react('play', healthy);
  assert.equal(pose.clip, 'special_attack'); assert.ok(Math.abs(pose.duration * pose.rate - 2.883) < 1e-10);
  advance(behavior, pose.duration - .08); assert.equal(behavior.snapshot().id, 'magic');
  advance(behavior, .12); assert.equal(behavior.snapshot().id, 'idle');
});

test('all nine explicit actions use their original clip once and return to natural care state', () => {
  const behavior=fixture({autonomous:false}), save={...healthy,coins:50,xp:80,pendingGrowth:[]}, before=structuredClone(save);
  behavior.setState(save);
  assert.equal(CAT_ACTIONS.length,9);
  for(const action of CAT_ACTIONS) {
    const pose=behavior.playAction(action.id), clip=clips.find(clip=>clip.name===`Cat|${action.clip}`);
    assert.equal(pose.clip,action.clip);assert.equal(pose.source,'animation');assert.equal(pose.loop,false);
    assert.equal(pose.rate,1);assert.equal(pose.duration,clip.duration+(action.hold||0));
    advance(behavior,pose.duration-.1);assert.equal(behavior.snapshot().id,`animation-${action.id}`);
    const restored=advance(behavior,.15);
    assert.equal(restored.id,'idle');assert.equal(restored.loop,true);assert.equal(restored.mood,'happy');
  }
  assert.deepEqual(save,before);
});

test('explicit actions preserve real sleep and live needs, and newer interactions can interrupt them', () => {
  const behavior=fixture({autonomous:false});behavior.setState({...healthy,sleeping:true});
  const running=behavior.playAction('run');assert.equal(running.sleeping,false);assert.equal(running.eyes,'excited');
  behavior.setState({hunger:12});assert.equal(behavior.snapshot().clip,'run');
  const restored=advance(behavior,running.duration+.1);assert.equal(restored.sleeping,true);assert.equal(restored.rate,.25);
  behavior.setState({sleeping:false});assert.equal(behavior.snapshot().mood,'hungry');
  behavior.playAction('death');advance(behavior,.3);
  const replacement=behavior.playAction('attack');assert.equal(replacement.time,0);assert.equal(replacement.clip,'attack');
  const repeated=behavior.playAction('attack');assert.ok(repeated.token>replacement.token);
  behavior.setExpression('happy');assert.equal(behavior.snapshot().id,'expression');
  behavior.playAction('hit');assert.equal(behavior.snapshot().expression,'auto');
  assert.equal(behavior.react('pet',healthy).source,'interaction');
  behavior.playAction('death');behavior.suspend();assert.equal(behavior.snapshot().id,'idle');
  behavior.playAction('walk');behavior.cancel();assert.equal(behavior.snapshot().id,'idle');
  assert.equal(behavior.playAction('not-a-clip').id,'idle');
  for(const action of CAT_ACTIONS)assert.equal(fixture({reducedMotion:true}).playAction(action.id).clip,'idle');
  const limited=fixture();limited.setClips([clips[0]]);assert.equal(limited.playAction('hit').clip,'idle');
});

test('sleep, wake, suspension, missing clips and reduced motion keep a valid neutral pose', () => {
  const behavior = fixture(); behavior.react('play');
  behavior.setState({ sleeping: true }); const sleep = advance(behavior, 60);
  assert.equal(sleep.id, 'idle'); assert.equal(sleep.clip, 'idle'); assert.equal(sleep.eyes, 'closed'); assert.equal(sleep.rate, .25);
  const wake = behavior.react('sleep', { sleeping: false }); assert.equal(wake.id, 'wake'); assert.equal(wake.sleeping, false);
  behavior.react('play'); behavior.suspend(); assert.equal(behavior.snapshot().id, 'idle');
  assert.equal(behavior.step(0).id, 'idle', 'resume leaves a fresh quiet gap');
  const reduced = fixture({ reducedMotion: true }); assert.equal(reduced.react('play').clip, 'idle');
  for (let i = 0; i < 2000; i++) assert.equal(reduced.step(.1).clip, 'idle');
  const limited = fixture(); limited.setClips([clips[0]]); assert.equal(limited.react('play').clip, 'idle');
  for (const delta of [NaN, -2, Infinity, undefined]) assert.ok(Number.isFinite(limited.step(delta).time));
});

test('manual dragging and court mode can suppress unattended activity', () => {
  const court = fixture({ autonomous: false });
  assert.equal(advance(court, 300).id, 'idle');
  for (const mood of ['sleeping', 'tired', 'sleepy', 'hungry', 'lonely', 'calm', 'happy']) {
    const choices = idleChoices({ mood, quiet: ['sleeping', 'tired', 'sleepy'].includes(mood), night: true });
    assert.ok(!choices.some(([id]) => ['zoomies', 'magic', 'paw'].includes(id)));
  }
});

test('blink intervals vary and preserve the current emotional mouth', () => {
  let seed = 12; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const behavior = fixture({ random, autonomous: false }); behavior.setState({ mood: 20 });
  const blinks = []; let closed = false;
  for (let i = 0; i < 30 * 50; i++) {
    const pose = behavior.step(1 / 30);
    if (pose.eyes === 'closed' && !closed) blinks.push(i);
    assert.equal(pose.mouth, 'sad'); closed = pose.eyes === 'closed';
  }
  assert.ok(blinks.length > 6); assert.ok(new Set(blinks.slice(1).map((frame, i) => frame - blinks[i])).size > 3);
});

test('animation playback restarts repeated clips, loops locomotion, and releases faded actions', () => {
  const root = new THREE.Object3D(), mixer = new THREE.AnimationMixer(root);
  const player = createMageAnimationPlayer(mixer, clips);
  const sync = (clip, token, loop = false, rate = 1) => player.sync({ clip, token, loop, rate });
  sync('idle', 0, true); player.update(.3);
  sync('attack', 1); player.update(.5); assert.ok(mixer.clipAction(clips[3]).time > .4);
  sync('attack', 2); assert.equal(mixer.clipAction(clips[3]).time, 0);
  sync('walk', 3, true); player.update(2.4); assert.equal(mixer.clipAction(clips[1]).isRunning(), true);
  sync('idle', 0, true, .25); player.update(.3);
  for (const clip of clips.slice(1)) assert.equal(mixer.clipAction(clip).isRunning(), false);
  assert.equal(mixer.clipAction(clips[0]).getEffectiveTimeScale(), .25);
});

test('explicit idle and locomotion are finite, repeat on demand, and Death holds then blends back', () => {
  const mixer=new THREE.AnimationMixer(new THREE.Object3D()), player=createMageAnimationPlayer(mixer,clips);
  player.sync({clip:'idle',token:1,source:'animation',loop:false,rate:1});player.update(.4);
  player.sync({clip:'idle',token:2,source:'animation',loop:false,rate:1});assert.equal(mixer.clipAction(clips[0]).time,0);
  for(const clip of [clips[1],clips[2],clips[7],clips[8]]) {
    player.sync({clip:clip.name.split('|')[1],token:3,source:'animation',loop:false,rate:1});
    player.update(clip.duration+.1);
    const action=mixer.clipAction(clip);assert.equal(action.time,clip.duration);assert.equal(action.paused,true);
    player.sync({clip:'idle',token:0,source:'idle',loop:true,rate:1});player.update(.3);
    assert.equal(action.isRunning(),false);assert.equal(action.getEffectiveWeight(),0);
    assert.equal(mixer.clipAction(clips[0]).isRunning(),true);
  }
});

test('dialogue follows both mood and time, including touch feedback during care cooldowns', () => {
  const pick = createDialoguePicker(() => .4);
  for (const [kind, state, key] of [['pet', { mood: 20 }, 'comfort'], ['touch', { energy: 20 }, 'gentlePet'], ['play', { behaviorPeriod: 'night' }, 'gentlePlay'], ['idle', { behaviorPeriod: 'night' }, 'night'], ['greeting', { behaviorPeriod: 'morning' }, 'morning']]) {
    assert.ok(CAT_DIALOGUE[key].includes(pick(kind, { ...healthy, ...state })));
  }
});
