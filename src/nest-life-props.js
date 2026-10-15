import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { yarnPlayPose } from './nest-yarn-play.js';

const colorMaterial=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
function mesh(group,name,geometry,material,position=[0,0,0]) {
  const object=new THREE.Mesh(geometry,material);object.name=name;object.position.set(...position);group.add(object);return object;
}
/** Four crossing windings and a loose curled end, all made from real tubes. */
export function createYarnModel() {
  const root=new THREE.Group();root.name='LifeYarn';
  const ball=new THREE.Group();ball.name='YarnBall';ball.position.y=.35;root.add(ball);
  mesh(ball,'YarnCore',new THREE.SphereGeometry(.328,24,16),colorMaterial('#cc918b'));
  for(let layer=0;layer<4;layer++) {
    const points=[];
    for(let n=0;n<=240;n++) {
      const t=n/240,latitude=-1.34+t*2.68,angle=t*Math.PI*14+layer*.7,radius=.335+layer*.003;
      points.push(new THREE.Vector3(radius*Math.cos(latitude)*Math.cos(angle),radius*Math.sin(latitude),radius*Math.cos(latitude)*Math.sin(angle)));
    }
    const thread=mesh(ball,`Winding_${layer+1}`,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),240,.011,5,false),colorMaterial(['#edb3a4','#e5aaa0','#d89a94','#f0bdae'][layer]));
    thread.rotation.set(layer*Math.PI*.31,layer*.59,layer*.43);
  }
  const tail=new THREE.CatmullRomCurve3([[.23,.13,.12],[.37,.035,.18],[.52,.025,.28],[.69,.025,.23],[.78,.025,.31],[.72,.025,.39],[.61,.025,.37]].map(p=>new THREE.Vector3(...p)));
  mesh(root,'LooseYarnEnd',new THREE.TubeGeometry(tail,48,.014,6,false),colorMaterial('#e5aaa0'));
  return root;
}
function ribbonStrip(points,width,material,name,parent) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),vertices=[],indices=[];
  const count=40;
  for(let n=0;n<=count;n++) {
    const t=n/count,p=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3(-tangent.y,tangent.x,0).normalize().multiplyScalar(width/2);
    for(const sign of [-1,1])vertices.push(p.x+side.x*sign,p.y+side.y*sign,p.z+side.z*sign);
    if(n<count){const a=n*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return mesh(parent,name,geometry,material);
}
/** Rounded box, raised lid, crossed wrapping and a sculpted satin bow. */
export function createGiftModel() {
  const root=new THREE.Group();root.name='LifeGift';
  const cream=colorMaterial('#efd1a6',.68),lid=colorMaterial('#f7ddb6',.65),ribbon=colorMaterial('#b88196',.5);ribbon.side=THREE.DoubleSide;
  mesh(root,'GiftBox',new RoundedBoxGeometry(.65,.56,.61,3,.045),cream,[0,.29,0]);
  mesh(root,'WrapFrontBack',new THREE.BoxGeometry(.11,.56,.618),ribbon,[0,.29,0]);
  mesh(root,'WrapSides',new THREE.BoxGeometry(.658,.56,.11),ribbon,[0,.29,0]);
  mesh(root,'GiftLid',new RoundedBoxGeometry(.71,.12,.67,3,.025),lid,[0,.615,0]);
  mesh(root,'LidRibbonX',new THREE.BoxGeometry(.714,.126,.115),ribbon,[0,.615,0]);
  mesh(root,'LidRibbonZ',new THREE.BoxGeometry(.115,.128,.674),ribbon,[0,.615,0]);
  ribbonStrip([[0,.735,0],[-.15,.94,-.015],[-.32,.92,0],[-.25,.76,.04],[0,.735,.02]],.075,ribbon,'BowLeft',root);
  ribbonStrip([[0,.735,0],[.15,.94,-.02],[.32,.92,.02],[.25,.76,.06],[0,.735,.02]],.075,ribbon,'BowRight',root);
  ribbonStrip([[-.02,.75,.025],[-.15,.71,.17],[-.21,.64,.32],[-.24,.48,.36]],.085,ribbon,'RibbonTailLeft',root);
  ribbonStrip([[.02,.75,.025],[.1,.71,.18],[.16,.6,.34],[.13,.5,.36]],.085,ribbon,'RibbonTailRight',root);
  const knot=mesh(root,'BowKnot',new THREE.SphereGeometry(.075,16,10),ribbon,[0,.75,.025]);knot.scale.set(1,.7,.7);
  return root;
}
export function createPaperCupModel() {
  const root=new THREE.Group();root.name='LifePaperCup';
  const cup=new THREE.Group();cup.rotation.z=-1.13;cup.position.set(0,.19,0);root.add(cup);
  const material=colorMaterial('#edd8b2');material.side=THREE.DoubleSide;
  mesh(cup,'PaperCup',new THREE.CylinderGeometry(.18,.13,.4,24,1,true),material,[0,.19,0]);
  const rim=mesh(cup,'CupRim',new THREE.TorusGeometry(.18,.014,6,24),colorMaterial('#fff1d2'),[0,.39,0]);rim.rotation.x=Math.PI/2;
  mesh(cup,'CupBase',new THREE.CylinderGeometry(.13,.13,.015,24),material,[0,0,0]);
  return root;
}
export function disposeLifeModel(root) {
  const geometries=new Set(),materials=new Set();
  root.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export const LIFE_PROP_SECONDS=6.5;
/** Uses the cat's existing renderer and lights; props stay on the floor when the cat rotates. */
export function createLifePropStage({scene,camera,getStageFrame=()=>null,setRoomView=()=>{},reducedMotion=false}) {
  const root=new THREE.Group();root.name='LifeEventProps';root.visible=false;scene.add(root);
  const models={yarn:createYarnModel(),gift:createGiftModel(),cup:createPaperCupModel()};
  const scales={yarn:1,gift:.85,cup:1.2},bounds={};
  for(const [id,model] of Object.entries(models)){
    model.scale.setScalar(scales[id]);model.rotation.y=id==='gift'?-.36:id==='cup'?.12:0;
    model.visible=false;root.add(model);model.updateMatrixWorld(true);bounds[id]=new THREE.Box3().setFromObject(model).expandByScalar(.02);
  }
  const shadowMaterial=new THREE.MeshBasicMaterial({color:'#50362d',transparent:true,opacity:.18,depthWrite:false});
  const shadow=mesh(root,'PropContactShadow',new THREE.CircleGeometry(.39,32),shadowMaterial,[0,.025,.12]);shadow.scale.y=.13;shadow.renderOrder=-1;
  let active=null,age=0,destroyed=false,currentCat=null;
  const start=new THREE.Vector3(),direction=new THREE.Vector3();
  function hide(){root.visible=false;active=null;currentCat=null;Object.values(models).forEach(m=>m.visible=false);setRoomView(false);}
  function position() {
    if(!active)return;
    const model=models[active],box=bounds[active],margin=.08,frame=getStageFrame(),catFrame=frame?.cat??camera;
    // Keep every vertex inside the existing orthographic view without zooming the cat.
    const available=Math.max(.5,catFrame.right-catFrame.left),fit=Math.min(1,available*.43/(box.max.x-box.min.x));
    const entrance=reducedMotion?1:1-Math.pow(1-Math.min(1,age/1.05),3);
    const x=Math.min(catFrame.right-box.max.x*fit-margin,catFrame.right*.63+(1-entrance)*.18);
    let arrival=null;
    if(active==='yarn'){
      const landingX=Math.min(.95,catFrame.right-box.max.x*fit-margin,camera.right-(box.max.x+(reducedMotion?0:.6))*fit-margin);
      // Pick the reference's upper-right entry in the room, rather than inside the cat's old crop.
      start.set(frame?.expanded ? .9 : .78,frame?.expanded ? .62 : .65,-1).unproject(camera);camera.getWorldDirection(direction);
      start.addScaledVector(direction,(-1.65-start.z)/direction.z);
      const play=yarnPlayPose(age,{startX:start.x/fit,startY:Math.max(1,(start.y-.035)/fit),landingX:landingX/fit,reducedMotion});
      arrival=play.ball;currentCat=play.cat;root.position.set(0,.035,1.15);
    }else{currentCat=null;root.position.set(Math.max(catFrame.left-box.min.x*fit+margin,x),.035,1.15);}
    root.scale.setScalar(fit);
    model.position.set(arrival?.x??0,arrival?.y??(active==='gift'&&!reducedMotion&&age<1.05?Math.sin(age/1.05*Math.PI)*.10:0),arrival?.z??0);
    model.scale.setScalar(scales[active]*(arrival?.scale??1));
    if(arrival){model.getObjectByName('YarnBall').rotation.z=arrival.rotation;model.getObjectByName('LooseYarnEnd').scale.setScalar(arrival.tailScale);}
    // The contact shadow follows the floor, staying below the airborne yarn.
    shadow.position.set(arrival?.x??0,.025,.12+(arrival?.z??0));
    shadow.scale.set(arrival?.shadowScale??1,.13*(arrival?.shadowScale??1),1);
    const opacity=Math.min(1,Math.max(0,(LIFE_PROP_SECONDS-age)/.5));
    model.traverse(o=>{if(o.isMesh){o.material.transparent=true;o.material.opacity=opacity;}});shadowMaterial.opacity=.18*opacity*(arrival?.shadowOpacity??1);
  }
  return {
    act(action) {
      if(destroyed)return false;
      if(action?.type==='life-hide'){hide();return true;}
      if(action?.type!=='life-show'||!['spill','gift'].includes(action.kind))return false;
      hide();active=action.kind==='gift'?'gift':action.variant===2?'cup':'yarn';models[active].visible=true;root.visible=true;age=0;setRoomView(active==='yarn'&&!reducedMotion);position();return true;
    },
    update(delta) {if(!active||destroyed)return;age+=Number.isFinite(delta)?Math.max(0,delta):0;if(age>=LIFE_PROP_SECONDS)hide();else position();},
    resize:position,
    catPose:()=>currentCat,
    destroy(){if(destroyed)return;destroyed=true;hide();scene.remove(root);disposeLifeModel(root);},
  };
}
