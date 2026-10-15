import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {YARN_PLAY,yarnPlayPose} from '../src/nest-yarn-play.js';
import {catStageFrame} from '../src/cat-stage-frame.js';
import {createYarnModel,createGiftModel,createPaperCupModel,createLifePropStage,disposeLifeModel,LIFE_PROP_SECONDS} from '../src/nest-life-props.js';

function fixture({aspect=1,reducedMotion=false}={}) {
  const scene=new THREE.Scene(),halfHeight=Math.max(1.72,1.65/Math.max(.65,aspect));
  const camera=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,.1,100);
  camera.position.set(0,1.65,8);camera.lookAt(0,1.5,0);camera.updateMatrixWorld();
  const pivot=new THREE.Group();pivot.name='CatPivot';scene.add(pivot);
  let view=catStageFrame({width:280*aspect,height:280,halfHeight,roomWidth:280*aspect+80,roomHeight:760,offsetX:40,offsetY:210});
  const stage=createLifePropStage({scene,camera,reducedMotion,getStageFrame:()=>view,setRoomView(expanded){view=catStageFrame({width:280*aspect,height:280,halfHeight,roomWidth:280*aspect+80,roomHeight:760,offsetX:40,offsetY:210,expanded});for(const edge of ['left','right','top','bottom'])camera[edge]=view[edge];camera.updateProjectionMatrix();}});
  return {scene,camera,pivot,stage,root:scene.getObjectByName('LifeEventProps')};
}
test('yarn and gift are mesh geometry with real thread, lid, wrapping and bow details',()=>{
  for(const [create,name]of [[createYarnModel,'LifeYarn'],[createGiftModel,'LifeGift'],[createPaperCupModel,'LifePaperCup']]){
    const model=create(),box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
    assert.equal(model.name,name);assert.ok(size.x>.3&&size.y>.3&&size.z>.3);
    model.traverse(o=>{if(o.isMesh){assert.ok(o.geometry.attributes.position.count>20);assert.equal(o.material.map,null);}});
    if(name==='LifeYarn'){
      for(let n=1;n<=4;n++)assert.equal(model.getObjectByName(`Winding_${n}`).geometry.type,'TubeGeometry');
      assert.equal(model.getObjectByName('LooseYarnEnd').geometry.type,'TubeGeometry');
    }
    if(name==='LifeGift')for(const detail of ['GiftLid','WrapFrontBack','WrapSides','BowLeft','BowRight','RibbonTailLeft','RibbonTailRight','BowKnot'])assert.ok(model.getObjectByName(detail)?.isMesh);
    disposeLifeModel(model);
  }
});
test('props remain in frame throughout arrival across narrow phone and desktop cat canvases',()=>{
  for(const aspect of [.45,.65,.8,1,1.3,1.8])for(const kind of ['gift','spill'])for(const variant of [0,2]){
    const f=fixture({aspect});f.stage.act({type:'life-show',kind,variant});
    let previous=0;
    for(const at of [0,.1,.6,1.2,1.55,1.7,1.83,2,2.45,2.85,3.3,3.55,4.15,4.35,4.95,5.8,6.1]){
      f.stage.update(at-previous);previous=at;f.scene.updateMatrixWorld(true);
      const model=f.root.children.find(o=>o.isGroup&&o.visible);
      assert.ok(model);
      const box=new THREE.Box3().setFromObject(model,true);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const p=new THREE.Vector3(x,y,z).project(f.camera);
        assert.ok(p.x>=-1&&p.x<=1,`horizontal clipping: ${aspect} ${kind} ${variant} ${p.x}`);
        assert.ok(p.y>=-1&&p.y<=1,`vertical clipping: ${aspect} ${kind} ${variant} ${p.y}`);
      }
    }
    f.stage.destroy();
  }
});
test('the reference arc falls from the upper right, and the ball waits for paw contact before rolling',()=>{
  const start=yarnPlayPose(0).ball,landing=yarnPlayPose(YARN_PLAY.flight).ball;
  assert.ok(start.z<-2&&start.scale<.5&&start.y>3);assert.equal(landing.y,0);assert.equal(landing.scale,1);
  let last=start;
  for(let n=1;n<=40;n++){const next=yarnPlayPose(YARN_PLAY.flight*n/40).ball;assert.ok(next.x<=last.x&&next.y<=last.y);last=next;}
  assert.equal(yarnPlayPose(YARN_PLAY.contact-.01).ball.x,landing.x);
  assert.ok(yarnPlayPose(YARN_PLAY.contact+.25).ball.x>landing.x);
  const reach=yarnPlayPose(YARN_PLAY.contact);assert.equal(reach.cat.phase,'paw');assert.equal(reach.cat.reach,1);
  const run=yarnPlayPose(3.4);assert.equal(run.cat.clip,'run');assert.ok(run.cat.x>0);
  assert.ok(yarnPlayPose(4.1).cat.x<run.cat.x,'cat follows the returning ball');
  const rest=yarnPlayPose(YARN_PLAY.rest);assert.equal(rest.cat.x,0);assert.equal(rest.cat.blend,0);assert.equal(rest.ball.y,0);
  for(const boundary of [YARN_PLAY.flight,YARN_PLAY.flight+YARN_PLAY.bounce,YARN_PLAY.contact,3.3,4.15,4.95,YARN_PLAY.rest]){
    const a=yarnPlayPose(boundary-1e-6),b=yarnPlayPose(boundary+1e-6);
    for(const key of ['x','y','z','scale','rotation','tailScale','shadowScale','shadowOpacity'])assert.ok(Math.abs(a.ball[key]-b.ball[key])<.0001,`${key} remains continuous at ${boundary}`);
    for(const key of ['x','y','z','yaw','reach','blend'])assert.ok(Math.abs(a.cat[key]-b.cat[key])<.0001,`cat ${key} remains continuous at ${boundary}`);
  }
});
test('airborne yarn casts a soft shadow on the floor and interruption can restart the full flight',()=>{
  const f=fixture();f.stage.act({type:'life-show',kind:'spill',variant:0});
  const yarn=f.root.getObjectByName('LifeYarn'),shadow=f.root.getObjectByName('PropContactShadow');
  assert.ok(yarn.position.y>1);assert.equal(shadow.position.y,.025);assert.ok(shadow.material.opacity<.1);
  f.stage.update(YARN_PLAY.flight);assert.equal(yarn.position.y,0);assert.equal(shadow.position.y,.025);assert.equal(shadow.material.opacity,.18);
  f.stage.act({type:'life-hide'});assert.equal(f.root.visible,false);
  f.stage.act({type:'life-show',kind:'spill',variant:1});assert.ok(yarn.position.y>1);assert.ok(yarn.scale.x<.5);f.stage.destroy();
});
test('one prop is visible at a time and normal interruptions clear it immediately',()=>{
  const f=fixture();assert.equal(f.root.visible,false);
  assert.equal(f.stage.act({type:'life-show',kind:'affection'}),false);
  assert.equal(f.stage.act({type:'life-show',kind:'spill',variant:0}),true);
  assert.equal(f.root.getObjectByName('LifeYarn').visible,true);
  assert.equal(f.root.parent,f.scene);assert.notEqual(f.root.parent,f.pivot);
  f.pivot.rotation.y=2;assert.equal(f.root.rotation.y,0,'cat dragging does not rotate the floor props');
  f.stage.act({type:'life-show',kind:'gift'});
  assert.equal(f.root.getObjectByName('LifeYarn').visible,false);assert.equal(f.root.getObjectByName('LifeGift').visible,true);
  f.stage.act({type:'life-hide'});assert.equal(f.root.visible,false);
  f.stage.update(1);assert.equal(f.root.visible,false);
  f.stage.act({type:'life-show',kind:'spill',variant:2});assert.equal(f.root.getObjectByName('LifePaperCup').visible,true);
  f.stage.update(LIFE_PROP_SECONDS);assert.equal(f.root.visible,false);f.stage.destroy();
});
test('events fade, can replay at full opacity, and respect reduced motion',()=>{
  const f=fixture({reducedMotion:true});f.stage.act({type:'life-show',kind:'spill',variant:1});
  const yarn=f.root.getObjectByName('LifeYarn'),ball=yarn.getObjectByName('YarnBall'),start=f.root.position.clone();
  f.stage.update(.6);assert.ok(start.equals(f.root.position));assert.equal(ball.rotation.z,0);
  f.stage.update(LIFE_PROP_SECONDS-.85);assert.ok(Math.abs(yarn.getObjectByName('YarnCore').material.opacity-.5)<1e-6);
  f.stage.act({type:'life-show',kind:'spill',variant:0});assert.equal(yarn.getObjectByName('YarnCore').material.opacity,1);
  f.stage.act({type:'life-show',kind:'gift'});f.stage.update(.4);assert.equal(f.root.getObjectByName('LifeGift').position.y,0);
  f.stage.destroy();
});
test('destroy releases shared materials and geometry once and rejects later actions',()=>{
  const f=fixture(),disposed=new Map(),resources=new Set();
  f.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1));
  f.stage.destroy();f.stage.destroy();assert.equal(f.root.parent,null);assert.equal(disposed.size,resources.size);
  for(const count of disposed.values())assert.equal(count,1);
  assert.equal(f.stage.act({type:'life-show',kind:'gift'}),false);
});
test('exported GLB models are standalone geometry assets with embedded buffers',async()=>{
  for(const [file,name]of [['yarn','LifeYarn'],['gift','LifeGift'],['cup','LifePaperCup']]){
    const buffer=await readFile(new URL(`../public/assets/nest-life/v1/${file}.glb`,import.meta.url));
    assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);
    const length=buffer.readUInt32LE(12),json=JSON.parse(buffer.toString('utf8',20,20+length));
    assert.ok(json.nodes.some(node=>node.name===name));assert.ok(json.meshes.length>=3);
    assert.equal(json.buffers.length,1);assert.equal(json.buffers[0].uri,undefined);assert.equal(json.images,undefined);
  }
});
