import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoupleExperience } from '../src/couple-experience.js';
import { initialState, reduceAction } from '../src/state.js';

const at=Date.parse('2026-10-14T08:00:00Z'), male={id:'partner-male',name:'男方'}, female={id:'partner-female',name:'女方'};
const pet=(state,actor,id,time=at)=>reduceAction(state,{type:'pet'},actor,time,id);
function harness() {
  const memory=new Map(), activity=[], moments=[], arrivals=[]; let visible=true;
  const observer=createCoupleExperience({readSeen:key=>memory.get(key),writeSeen:(key,value)=>memory.set(key,value),canNotify:()=>visible,onActivity:(...args)=>activity.push(args),onMoment:moment=>moments.push(moment),onArrival:partner=>arrivals.push(partner)});
  observer.reset({role:'male',roomId:'fake-couple-home'});
  return {observer,memory,activity,moments,arrivals,setVisible:value=>visible=value};
}

test('loading a saved home is quiet, and live partner activity is emitted once across duplicate snapshots',()=>{
  const h=harness(), base=initialState(at);h.observer.observe(base,at);
  const next=pet(base,female,'observer-female-pet');
  h.observer.observe(next,at);h.observer.observe(next,at);h.observer.observe(next,at);
  assert.equal(h.activity.length,1);assert.equal(h.activity[0][0].actorId,female.id);assert.equal(h.activity[0][1].away,false);
  h.observer.reset({role:'male',roomId:'fake-couple-home'});h.observer.observe(next,at);
  assert.equal(h.activity.length,1);
});

test('confirmed own actions and rejected previews never create a partner notification',()=>{
  const h=harness(), base=initialState(at);h.observer.observe(base,at);
  const preview=pet(base,female,'unconfirmed-partner-pet');assert.equal(preview.coupleCare.records.length,1);
  h.observer.observe(base,at);h.observer.observe(base,at);
  h.observer.observe(pet(base,male,'confirmed-own-pet'),at);
  assert.equal(h.activity.length,0);assert.equal(h.moments.length,0);
});

test('returning to a home uses a per-role watermark to describe care performed while away once',()=>{
  const h=harness(), first=pet(initialState(at),female,'earlier-female-pet');h.observer.observe(first,at);
  h.observer.reset({role:'male',roomId:'fake-couple-home'});
  const next=reduceAction(first,{type:'feed',food:'water'},female,at+60_000,'away-female-water');
  h.observer.observe(next,at+60_000);h.observer.observe(next,at+60_000);
  assert.equal(h.activity.length,1);assert.equal(h.activity[0][1].away,true);
  assert.equal(h.memory.get('catnest.partnerSeen.fake-couple-home.male').id,'away-female-water');
});

test('hidden-page updates wait until visible and do not mark unseen activity read',()=>{
  const h=harness(), first=pet(initialState(at),female,'seen-female-pet');h.observer.observe(first,at);
  h.setVisible(false);
  const next=reduceAction(first,{type:'feed',food:'water'},female,at+60_000,'hidden-female-water');
  h.observer.observe(next,at+60_000);
  assert.equal(h.activity.length,0);
  assert.equal(h.memory.get('catnest.partnerSeen.fake-couple-home.male').id,'seen-female-pet');
  h.setVisible(true);h.observer.observe(next,at+60_000);
  assert.equal(h.activity.length,1);assert.equal(h.activity[0][1].away,true);
});

test('one confirmed cooperation takes priority over its activity and is never celebrated again on refresh',()=>{
  const h=harness(), first=pet(initialState(at),male,'moment-male-pet');h.observer.observe(first,at);
  const next=reduceAction(first,{type:'play'},female,at+60_000,'moment-female-play');
  h.observer.observe(next,at+60_000);h.observer.observe(next,at+60_000);
  assert.equal(h.moments.length,1);assert.equal(h.activity.length,0);
  h.observer.reset({role:'male',roomId:'fake-couple-home'});h.observer.observe(next,at+60_000);
  assert.equal(h.moments.length,1);
});

test('arrival feedback follows an actual offline-to-online transition, not the first roster or reconnect',()=>{
  const h=harness();h.observer.presence([male,female],true);assert.equal(h.arrivals.length,0);
  h.observer.presence([male],true);h.observer.presence([male,female],true);h.observer.presence([male,female],true);
  assert.equal(h.arrivals.length,1);assert.equal(h.arrivals[0].id,'female');
  h.observer.presence([],false);h.observer.presence([male,female],true);assert.equal(h.arrivals.length,1);
});

test('switching roles changes the partner and never mixes the two read markers',()=>{
  const h=harness(), first=pet(initialState(at),male,'switch-male-pet');
  h.observer.reset({role:'female',roomId:'fake-couple-home'});h.observer.observe(first,at);
  assert.equal(h.memory.get('catnest.partnerSeen.fake-couple-home.female').id,'switch-male-pet');
  assert.equal(h.memory.has('catnest.partnerSeen.fake-couple-home.male'),false);
  const next=reduceAction(first,{type:'feed',food:'water'},male,at+60_000,'switch-male-water');
  h.observer.observe(next,at+60_000);assert.equal(h.activity[0][0].actorId,male.id);
});
