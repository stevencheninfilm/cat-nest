import { COLLECTION_CATS } from '../src/cat-collection.js';
import { CAT_SCENES, sceneAllowsCat } from '../src/catbook-scenes.js';

// Explicit visits for artwork/geometry tests that intend to display all owned cats.
export function invitedEverywhere(state) {
  const next=structuredClone(state);
  next.collection.sceneInvited=CAT_SCENES.flatMap(scene=>next.collection.invited
    .filter(record=>sceneAllowsCat(scene,COLLECTION_CATS.find(cat=>cat.id===record.id)))
    .map(record=>({...record,sceneId:scene.id,operationId:scene.id==='station' ? record.operationId : `fixture-${scene.id}-${record.id}`})));
  return next;
}
