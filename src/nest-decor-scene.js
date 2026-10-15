import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { NEST_ITEMS, nestPalette, normalizeNest } from './nest-decor.js';

const caches=new WeakMap();
const material=color=>new THREE.MeshStandardMaterial({color,roughness:.8});
function mesh(group,geometry,color,position,scale){const m=new THREE.Mesh(geometry,material(color));m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
const box=(g,s,c,p)=>mesh(g,new RoundedBoxGeometry(...s,2,.05),c,p);
const sphere=(g,r,c,p,s)=>mesh(g,new THREE.SphereGeometry(r,16,10),c,p,s);
const cylinder=(g,r,h,c,p)=>mesh(g,new THREE.CylinderGeometry(r,r,h,24),c,p);
function heart(g,x,y,z,color){const shape=new THREE.Shape();shape.moveTo(0,-.12);shape.bezierCurveTo(-.45,.13,-.22,.45,0,.22);shape.bezierCurveTo(.22,.45,.45,.13,0,-.12);const m=mesh(g,new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,steps:1}),color,[x,y,z]);return m;}
function extra(id){
  const g=new THREE.Group();g.name=`Prop_${id}`;g.userData.interactionId=id;
  if(id==='plant'){
    cylinder(g,.26,.4,'#dfb59c',[0,.2,0]);cylinder(g,.23,.025,'#76634f',[0,.41,0]);
    for(let i=0;i<5;i++){const leaf=sphere(g,.18,'#91af83',[Math.sin(i*2.1)*.14,.6+i*.07,Math.cos(i*2.1)*.14],[.5,1.5,.6]);leaf.rotation.z=Math.sin(i)*.5;}
  }else if(id==='scratch'){
    cylinder(g,.36,.14,'#b58c6a',[0,.07,0]);cylinder(g,.15,1.1,'#e3c89b',[0,.66,0]);
    for(let i=0;i<12;i++){const ring=mesh(g,new THREE.TorusGeometry(.153,.018,5,20),'#b89870',[0,.18+i*.085,0]);ring.rotation.x=Math.PI/2;}
    sphere(g,.19,'#d6a1a4',[0,1.3,0]);
  }else if(id==='cushion'){
    box(g,[.78,.22,.76],'#c8b2d5',[0,.15,0]);sphere(g,.35,'#ead9ec',[0,.28,0],[1,.32,1]);
    sphere(g,.07,'#b895bf',[0,.39,0],[1,.2,1]);
  }else if(id==='rug'){
    const rug=cylinder(g,1,.035,'#bda9ce',[0,.055,0]);rug.scale.z=.75;
    const ring=mesh(g,new THREE.TorusGeometry(.87,.018,5,48),'#f8e2af',[0,.08,0]);ring.rotation.x=Math.PI/2;ring.scale.y=.75;
    sphere(g,.16,'#f9de9b',[.35,.085,0],[1,.1,1]);
  }else if(id==='bookshelf'){
    for(const x of [-.5,.5])box(g,[.12,1.3,.55],'#b48a6a',[x,.65,0]);
    for(const y of [.12,.7,1.3])box(g,[1.1,.1,.6],'#b48a6a',[0,y,0]);
    for(let row=0;row<2;row++)for(let i=0;i<5;i++)box(g,[.13,.35+i%2*.09,.34],['#9aaf99','#b4a0c3','#dfb495'][i%3],[-.34+i*.17,.34+row*.58,0]);
  }else if(id==='memory'){
    box(g,[.85,.1,.6],'#b9957c',[0,.13,0]);for(const x of [-.34,.34])box(g,[.1,.7,.1],'#b9957c',[x,.4,0]);
    box(g,[.78,.75,.1],'#f8e4c2',[0,.8,0]);heart(g,-.19,.81,.07,'#dba3a1');heart(g,.19,.81,.07,'#a2b9bd');
  }
  return g;
}
function upgrades(level){
  const g=new THREE.Group();g.name='NestUpgrade';
  if(level>=2){
    for(let i=0;i<13;i++){
      const x=-3.5+i*.57,y=2.4-Math.sin(i/12*Math.PI)*.32;
      const bulb=sphere(g,.055,'#ffe0a2',[x,y,-3.35]);bulb.material.emissive.set('#ffcb77');bulb.material.emissiveIntensity=.65;
      if(i<12){const wire=cylinder(g,.012,.58,'#a98b70',[x+.28,y,-3.37]);wire.rotation.z=Math.PI/2;}
    }
  }
  if(level>=3){box(g,[1.05,.52,.08],'#f7e7ce',[0,2.03,-3.42]);heart(g,-.22,1.99,-3.34,'#d9a0a1');heart(g,.22,1.99,-3.34,'#96b6b0');}
  return g;
}
function dispose(root){const gs=new Set(),ms=new Set();root.traverse(n=>{if(n.isMesh){gs.add(n.geometry);ms.add(n.material);}});for(const v of gs)v.dispose();for(const v of ms)v.dispose();}
export function applyNestScene(room,value){
  const nest=normalizeNest(value);let cache=caches.get(room);
  if(!cache){
    cache={props:new Map(),materials:new Map(),level:0,upgrade:null};
    const replacements=new Map();room.traverse(n=>{if(!n.isMesh)return;const replace=m=>{if(!replacements.has(m)){const clone=m.clone();replacements.set(m,clone);if(clone.color)cache.materials.set(clone,clone.color.getHexString());}return replacements.get(m);};n.material=Array.isArray(n.material)?n.material.map(replace):replace(n.material);});
    for(const item of NEST_ITEMS){let prop=room.getObjectByName(`Prop_${item.id}`);if(!prop){prop=extra(item.id);room.add(prop);}cache.props.set(item.id,prop);}
    caches.set(room,cache);
  }
  const p=nestPalette(nest.palette),map={edcda9:p.wall,ca9d75:p.floor,ae7953:p.trim,ddb1ac:p.fabric,fff0d3:p.cream};
  if(nest.palette!=='honey')for(const [original,color,gain]of [['637b8c',p.wall,.65],['304351',p.floor,.5],['294454',p.trim,.5],['405d6e',p.fabric,.65],['bacbd1',p.cream,.85]])map[original]=`#${new THREE.Color(color).multiplyScalar(gain).getHexString()}`;
  for(const [mat,original]of cache.materials)mat.color.set(map[original]||`#${original}`);
  for(const [id,prop]of cache.props){const placement=nest.placements.find(v=>v.item===id);prop.visible=Boolean(placement);if(placement){prop.position.set(placement.x,0,placement.z);prop.rotation.y=placement.rotation*Math.PI/2;}}
  if(cache.level!==nest.level){if(cache.upgrade){room.remove(cache.upgrade);dispose(cache.upgrade);}cache.upgrade=upgrades(nest.level);room.add(cache.upgrade);cache.level=nest.level;}
  return cache.props;
}
export function previewNestPlacement(room,id,pose){const prop=caches.get(room)?.props.get(id);if(!prop||!pose)return;prop.visible=true;prop.position.set(pose.x,0,pose.z);prop.rotation.y=pose.rotation*Math.PI/2;}
