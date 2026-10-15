import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_DIALOGUE_PAIRS, createCatDialogue, catSpeechMarkup } from '../src/catbook-dialogue.js';
import { COLLECTION_CATS, getCollectionCat } from '../src/cat-collection.js';
import { CAT_SCENES, sceneCatPlacement, sceneAllowsCat } from '../src/catbook-scenes.js';
import { initialState } from '../src/state.js';
import { invitedEverywhere } from './catbook-fixtures.mjs';

const owned=()=>{const state=initialState();state.collection.invited=COLLECTION_CATS.map(cat=>({id:cat.id,at:1,actorId:'speech-test',operationId:`speech-test-${cat.id}`}));return invitedEverywhere(state).collection;};
const scene=id=>CAT_SCENES.find(scene=>scene.id===id);

test('all nine marked pairs chat in their own scene and either participant can start',()=>{
  const collection=owned(),before=structuredClone(collection);
  assert.deepEqual(CAT_DIALOGUE_PAIRS.map(pair=>[pair.sceneId,...pair.members]),[
    ['station','cocoa','wheat'],['station','porter','matcha'],['station','sunshine','velvet'],['station','tart','ashbean'],
    ['garden','chime','gozer'],['garden','gabriel','bubble'],['western','matcha','gabriel'],['snow','wheat','pebble'],['snow','porter','bubble'],
  ]);
  for(const pair of CAT_DIALOGUE_PAIRS) for(const starter of pair.members) {
    const dialogue=createCatDialogue(),yard=scene(pair.sceneId);
    for(let step=0;step<pair.lines.length;step++) {
      // An unrelated sleeping cat also advances a chat when the player taps it.
      const cat=getCollectionCat(step===0 ? starter : step%2 ? 'bandit' : pair.members[1]);
      const turn=dialogue.next(yard,cat,collection);
      assert.equal(turn.kind,'pair');assert.equal(turn.step,step+1);
      assert.equal(turn.speakerId,pair.lines[step].speakerId);assert.equal(turn.text,pair.lines[step].text);
      assert.match(catSpeechMarkup(turn),new RegExp(getCollectionCat(turn.speakerId).name));
    }
    assert.equal(dialogue.next(yard,getCollectionCat('bandit'),collection).kind,'sleep','the conversation ends after its final line');
  }
  assert.deepEqual(collection,before,'chatting never changes saved progress');
});

test('missing or uninvited partners give a waiting line and no off-scene phantom reply',()=>{
  for(const pair of CAT_DIALOGUE_PAIRS) for(const globalMissing of [true,false]) {
    const collection=owned(),[speaker,buddy]=pair.members;
    collection.sceneInvited=collection.sceneInvited.filter(record=>record.id!==buddy);
    if(globalMissing) collection.invited=collection.invited.filter(record=>record.id!==buddy);
    else {
      // An explicit receipt in another scene prevents legacy station fallback.
      const receipt=collection.invited.find(record=>record.id===buddy);
      collection.sceneInvited.push({...receipt,sceneId:pair.sceneId==='garden' ? 'station' : 'garden'});
    }
    const turn=createCatDialogue().next(scene(pair.sceneId),getCollectionCat(speaker),collection);
    assert.equal(turn.kind,'waiting');assert.equal(turn.speakerId,speaker);
    assert.match(turn.text,new RegExp(getCollectionCat(buddy).name));assert.match(turn.text,/还没来/);
  }
});

test('every invited cat has a reaction; every sleeping pose says zzz',()=>{
  const collection=owned();
  for(const yard of CAT_SCENES) for(const cat of COLLECTION_CATS.filter(cat=>sceneAllowsCat(yard,cat))) {
    const turn=createCatDialogue().next(yard,cat,collection);
    assert.ok(turn.text.length>0);
    if(['sleep','loaf','rest'].includes(sceneCatPlacement(yard,cat).motion)) {
      assert.equal(turn.kind,'sleep');assert.match(turn.text,/^zzz/);
    }
  }
});

test('progress is ephemeral and scene changes or clearing never continue an old pair',()=>{
  const dialogue=createCatDialogue(),collection=owned();
  assert.equal(dialogue.next(scene('station'),getCollectionCat('wheat'),collection).step,1);
  assert.equal(dialogue.next(scene('snow'),getCollectionCat('wheat'),collection).pairId,'snow:wheat:pebble');
  assert.equal(dialogue.current().step,1);
  dialogue.clear();assert.equal(dialogue.current(),null);
  assert.equal(dialogue.next(scene('snow'),getCollectionCat('pebble'),collection).step,1);
  assert.equal(dialogue.next(scene('garden'),getCollectionCat('porter'),collection),null,'a nonresident cannot speak');
});

test('a cat napping inside a box also says zzz despite using a peeking sprite',()=>{
  for(const id of ['garden','western','snow']) {
    const turn=createCatDialogue().next(scene(id),getCollectionCat('ashbean'),owned());
    assert.equal(turn.kind,'sleep');assert.match(turn.text,/^zzz/);
  }
});
