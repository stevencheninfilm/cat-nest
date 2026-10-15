import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeedsFeedback } from '../src/pet-needs-feedback.js';
import { NEED_KEYS, petNeeds } from '../src/pet-needs.js';
import { initialState, reduceAction } from '../src/state.js';

function fixture() {
  let clock = 0, sequence = 0, visible = true, reduced = false;
  const frames = new Map(), timers = new Map(), motions = [];
  const node = () => ({ textContent:'', hidden:true, className:'', animate(keyframes, options) {
    const motion = { keyframes, options, cancelled:false, cancel() { this.cancelled=true; } };
    motions.push(motion); return motion;
  } });
  const numbers = Object.fromEntries(NEED_KEYS.map(key => [key,node()]));
  const deltas = Object.fromEntries(NEED_KEYS.map(key => [key,node()]));
  const root = { querySelector(selector) {
    return selector.startsWith('#') ? numbers[selector.slice(1)] : deltas[selector.match(/"([^"]+)"/)[1]];
  } };
  const feedback = createNeedsFeedback({ root, now:() => clock,
    canAnimate:() => visible, reducedMotion:() => reduced,
    frame:callback => { const id=++sequence; frames.set(id,callback); return id; },
    cancelFrame:id => frames.delete(id),
    setTimer:(callback, delay) => { const id=++sequence; timers.set(id,{ at:clock+delay,callback }); return id; },
    clearTimer:id => timers.delete(id),
  });
  return { feedback, numbers, deltas, frames, timers, motions,
    visible(value) { visible=value; }, reduced(value) { reduced=value; },
    advance(ms) {
      clock+=ms;
      for (const [id,callback] of [...frames]) { frames.delete(id); callback(); }
      for (const [id,timer] of [...timers]) if (timer.at<=clock) { timers.delete(id); timer.callback(); }
    },
  };
}
const needs = (mood=70) => ({ hunger:60, mood, energy:90 });

test('care feedback uses actual capped increases, eases to the target and then disappears', () => {
  const f=fixture(), at=Date.UTC(2026,9,14);
  const before={...initialState(at),hunger:95,mood:98,energy:90};
  const after=reduceAction(before,{type:'feed',food:'snack'},{id:'partner-male',name:'男方'},at,'need-feedback-feeding');
  f.feedback.update(petNeeds(before,at));
  assert.equal(f.motions.length,0,'loading a save is quiet');
  f.feedback.update(petNeeds(after,at));
  assert.equal(f.deltas.hunger.textContent,'+5');
  assert.equal(f.deltas.mood.textContent,'+2');
  assert.equal(f.deltas.energy.hidden,true);
  assert.equal(f.numbers.hunger.textContent,'95');
  f.advance(160);
  assert.ok(Number(f.numbers.hunger.textContent)>95 && Number(f.numbers.hunger.textContent)<100);
  f.advance(160);
  assert.equal(f.numbers.hunger.textContent,'100');
  assert.equal(f.frames.size,0);
  const hint=f.motions[0], fadeStart=hint.keyframes.at(-2).offset*hint.options.duration;
  assert.equal(hint.options.easing,'linear','keyframe offsets correspond to elapsed time');
  assert.ok(fadeStart>=2000 && fadeStart<=2200,'the hint stays clear for about two seconds before fading');
  assert.ok(hint.options.duration-fadeStart>=700 && hint.options.duration-fadeStart<=900,'the fade is gradual');
  f.advance(1680);
  assert.equal(f.deltas.hunger.hidden,false,'the hint is still present at two seconds');
  assert.equal(f.deltas.mood.hidden,false);
  f.advance(900);
  assert.equal(f.deltas.hunger.hidden,true);
  assert.equal(f.deltas.mood.hidden,true);
  assert.equal(f.timers.size,0);
});

test('play shows each positive and negative change, and repeated cloud confirmations never replay it', () => {
  const f=fixture(), at=Date.UTC(2026,9,14);
  const before={...initialState(at),...needs()};
  const after=reduceAction(before,{type:'play'},{id:'partner-male',name:'男方'},at,'need-feedback-playing');
  f.feedback.update(petNeeds(before,at));
  f.feedback.update(petNeeds(after,at));
  assert.deepEqual(NEED_KEYS.map(key=>f.deltas[key].textContent),['−3','+10','−8']);
  assert.match(f.deltas.energy.className,/is-negative/);
  assert.match(f.deltas.mood.className,/is-positive/);
  const effects=f.motions.length, timerIds=[...f.timers.keys()];
  f.advance(200);
  f.feedback.update(petNeeds(after,at));
  assert.equal(f.motions.length,effects);
  assert.deepEqual([...f.timers.keys()],timerIds);
  f.advance(2700);
  assert.deepEqual(NEED_KEYS.map(key=>f.numbers[key].textContent),['57','80','82']);
  assert.ok(NEED_KEYS.every(key=>f.deltas[key].hidden));
});

test('new changes replace the old hint and rollback or hydration resets silently', () => {
  const f=fixture();
  f.feedback.update(needs()); f.feedback.update(needs(76));
  f.advance(100);
  f.feedback.update(needs(80));
  assert.equal(f.deltas.mood.textContent,'+4');
  assert.equal(f.timers.size,1);
  assert.ok(f.motions[0].cancelled,'the earlier floating hint was cancelled');
  f.feedback.reset(needs());
  assert.equal(f.numbers.mood.textContent,'70');
  assert.equal(f.deltas.mood.hidden,true);
  assert.equal(f.frames.size,0); assert.equal(f.timers.size,0);
  f.feedback.update(needs(76));
  assert.equal(f.deltas.mood.textContent,'+6');
  f.advance(320);
  assert.equal(f.numbers.mood.textContent,'76');
});

test('reduced motion keeps a static hint, hidden views settle immediately and teardown clears work', () => {
  const f=fixture(); f.reduced(true);
  f.feedback.update(needs()); f.feedback.update(needs(76));
  assert.equal(f.numbers.mood.textContent,'76');
  assert.equal(f.deltas.mood.textContent,'+6');
  assert.equal(f.motions.length,0); assert.equal(f.frames.size,0);
  f.visible(false); f.feedback.update(needs(80));
  assert.equal(f.numbers.mood.textContent,'80');
  assert.equal(f.deltas.mood.hidden,true); assert.equal(f.timers.size,0);
  f.visible(true); f.reduced(false); f.feedback.update(needs(80));
  assert.equal(f.deltas.mood.hidden,true,'returning to the page does not replay a hidden change');
  f.feedback.update(needs(86)); f.feedback.destroy();
  assert.equal(f.frames.size,0); assert.equal(f.timers.size,0);
  assert.ok(f.motions.every(motion=>motion.cancelled));
});
