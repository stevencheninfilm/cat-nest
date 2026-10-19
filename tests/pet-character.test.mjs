import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeAppearance,validAppearance,appearanceCharacter } from '../src/mage-cat-config.js';
import { initialState,reduceAction,normalizeState } from '../src/state.js';
import { sanitizeAction,createGitHubStore } from '../server/github-store.mjs';
import { createCharacterSwitch } from '../src/pet-character-switch.js';
import { appearanceSheetMarkup } from '../src/appearance-ui.js';
import { prepareOtterModel,updateOtterExpression,disposeOtterModel,OTTER_CLIPS,OTTER_DISPLAY_HEIGHT } from '../src/otter-model.js';

const cat={body:4,clothes:1,eyes:2,wand:1},otter={...cat,character:'otter'};
test('legacy cat saves and pending dress payloads remain valid; otter preserves cat colors',()=>{
 assert.deepEqual(normalizeAppearance(cat),cat);assert.equal(validAppearance(cat),true);
 assert.deepEqual(normalizeAppearance(otter),otter);assert.equal(validAppearance(otter),true);
 assert.deepEqual(normalizeAppearance({...otter,character:'cat'}),cat);
 for(const character of ['wolf','../otter',{},null,0])assert.equal(validAppearance({...cat,character}),false);
 assert.equal(validAppearance({...otter,extra:true}),false);
 assert.deepEqual(sanitizeAction({type:'dress',appearance:otter}),{type:'dress',appearance:otter});
 assert.equal(appearanceCharacter({}), 'cat');
});
test('switching both directions keeps progress and pending growth; no reward for switching',()=>{
 const start=initialState(1000);start.appearance=cat;start.xp=1200;start.coins=800;
 start.homeBond.owners=[{id:'partner-male',joinedAt:1000},{id:'partner-female',joinedAt:1000}];
 const fed=reduceAction(start,{type:'feed',food:'meal'},{id:'partner-male',name:'男方'},1000);
 const changed=reduceAction(fed,{type:'dress',appearance:otter},{id:'partner-female',name:'女方'},1000);
 for(const key of ['xp','coins','love','hunger','mood','energy','pendingGrowth','careLimits','homeBond'])assert.deepEqual(changed[key],fed[key],key);
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(changed)),1000).appearance,otter);
 const restored=reduceAction(changed,{type:'dress',appearance:cat},{id:'partner-male',name:'男方'},1000);
 assert.deepEqual(restored.appearance,cat);assert.equal(restored.xp,start.xp);
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('rapid preview changes cannot apply an obsolete load and reuse one asset download',async()=>{
 const done=deferred(),seen=[],phases=[];let loads=0;
 const switcher=createCharacterSwitch({load:async()=>{loads++;return done.promise;},apply:(_,id)=>seen.push(id),onStatus:s=>phases.push(s.phase)});
 const first=switcher.select('otter');await Promise.resolve();await switcher.select('cat');done.resolve({});await first;
 assert.deepEqual(seen,[]);await switcher.select('otter');assert.deepEqual(seen,['otter']);assert.equal(loads,1);assert.equal(phases.at(-1),'ready');
 switcher.destroy();
});
test('a failed character load keeps the current model, can retry, and disposes late results',async()=>{
 let fail=true,applied=0,disposed=0;const statuses=[];
 const switcher=createCharacterSwitch({load:async()=>{if(fail)throw Error('offline');return {};},apply:()=>applied++,onStatus:s=>statuses.push(s.phase),dispose:()=>disposed++});
 assert.equal(await switcher.select('otter'),false);assert.equal(applied,0);assert.equal(statuses.at(-1),'error');
 fail=false;assert.equal(await switcher.select('otter'),true);assert.equal(applied,1);switcher.destroy();await Promise.resolve();assert.equal(disposed,1);
 const late=deferred();const other=createCharacterSwitch({load:()=>late.promise,apply:()=>assert.fail('destroyed viewer must not change'),dispose:()=>disposed++});
 const pending=other.select('otter');await Promise.resolve();other.destroy();late.resolve({});await pending;await Promise.resolve();assert.equal(disposed,2);
});
test('outfit panel exposes both characters and only the selected character controls',()=>{
 const catUI=appearanceSheetMarkup({draft:cat}),otterUI=appearanceSheetMarkup({draft:otter});
 for(const html of [catUI,otterUI]){assert.match(html,/data-pet-character="cat"/);assert.match(html,/data-pet-character="otter"/);assert.match(html,/成长继续保留/);}
 assert.match(catUI,/aria-label="装扮部位"/);assert.doesNotMatch(otterUI,/data-appearance-choice/);assert.match(otterUI,/Glossy Studio/);
 assert.match(appearanceSheetMarkup({draft:otter,loading:true}),/id="apply-appearance" disabled/);
 assert.match(appearanceSheetMarkup({draft:otter,error:true}),/data-retry-character/);
});

test('actual shipped otter is skinned, keeps normalized weights, and all nine clips deform safely',async()=>{
 const file=await readFile(new URL('../public/pets/baby-otter-v1/model.glb',import.meta.url));
 assert.ok(file.length<2_500_000,'mobile runtime asset budget');
 // CPU geometry validation uses neutral materials; no browser, renderer or
 // mock replacement geometry is used. Texture bytes remain in the real GLB.
 const loader=new GLTFLoader().register(()=>({name:'CPU-test-material',loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())}));
 const gltf=await loader.parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
 const slot=prepareOtterModel(gltf);let mesh;slot.model.traverse(n=>{if(n.isSkinnedMesh)mesh=n;});
 slot.model.updateMatrixWorld(true);
 const displayBox=new THREE.Box3().setFromObject(slot.model);
 assert.ok(Math.abs(displayBox.getSize(new THREE.Vector3()).y-OTTER_DISPLAY_HEIGHT)<1e-5);
 assert.equal(OTTER_DISPLAY_HEIGHT,2.15,'otter body must not fill the cat hat-and-body frame');
 assert.ok(Math.abs(displayBox.min.y)<1e-5,'the smaller otter keeps its feet on the same floor');
 assert.equal(mesh.skeleton.bones.length,22);assert.equal(mesh.geometry.index.count/3,32000);
 const weights=mesh.geometry.attributes.skinWeight;
 for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
 assert.deepEqual(gltf.animations.map(c=>c.name.toLowerCase()).sort(),[...OTTER_CLIPS].sort());
 const mixer=new THREE.AnimationMixer(slot.model),point=new THREE.Vector3();let moved=0;
 for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();const samples=[];
  for(const ratio of [0,.25,.5,.75]){
   mixer.setTime(clip.duration*ratio);slot.model.updateMatrixWorld(true);const box=new THREE.Box3();
   for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);assert.ok(point.toArray().every(Number.isFinite));box.expandByPoint(point);}
   assert.ok(box.getSize(point).length()<6,`${clip.name} must not explode or stretch`);samples.push(mesh.getVertexPosition(100,new THREE.Vector3()).toArray());
  }
  if(JSON.stringify(samples[0])!==JSON.stringify(samples[2]))moved++;
 }
 assert.equal(moved,9,'the mesh, rather than just its outer group, must animate');
 updateOtterExpression(slot.model,'wink');assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Blink_L],.55);assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Blink_R],0);
 for(const expression of ['happy','basic','excited','sad','unamused','crying','panic']){
  updateOtterExpression(slot.model,expression);assert.deepEqual(mesh.morphTargetInfluences,[0,0],`${expression} keeps both eyes visible`);
 }
 for(const expression of ['closed','tired']){
  updateOtterExpression(slot.model,expression);assert.ok(mesh.morphTargetInfluences.every(value=>value>0&&value<=.55),`${expression} never collapses the eyes into the face`);
 }
 updateOtterExpression(slot.model,'basic');assert.deepEqual(mesh.morphTargetInfluences,[0,0]);
 mixer.stopAllAction();mixer.uncacheRoot(slot.model);disposeOtterModel(slot);
});

test('server stores an otter in the original room and deduplicates retry after restart',async()=>{
 let entry;let sequence=0;const fetchImpl=async(_url,request)=>{
  if(request.method==='GET')return entry?Response.json({sha:entry.sha,encoding:'base64',content:Buffer.from(JSON.stringify(entry.room)).toString('base64')}):new Response('{}',{status:404});
  const body=JSON.parse(request.body);if(entry&&body.sha!==entry.sha)return new Response('{}',{status:409});
  entry={sha:`sha${++sequence}`,room:JSON.parse(Buffer.from(body.content,'base64').toString())};return Response.json({});
 };
 const options={token:'test-only',repository:'qa/test',fetchImpl,now:()=>1000};
 const store=createGitHubStore(options),room=await store.createRoom();
 const before=await store.getRoom(room.roomId),operation={operationId:'otter-dress-operation',clientId:'otter-client',name:'猫友',action:{type:'dress',appearance:otter}};
 const saved=await store.applyAction(room.roomId,operation);assert.equal(saved.roomId,before.roomId);assert.deepEqual(saved.state.appearance,otter);
 const restarted=createGitHubStore(options),again=await restarted.applyAction(room.roomId,operation);assert.equal(again.duplicate,true);assert.equal(again.revision,saved.revision);
 assert.deepEqual((await restarted.getRoom(room.roomId)).state.appearance,otter);for(const key of ['xp','coins','pendingGrowth'])assert.deepEqual(again.state[key],before.state[key]);
});
