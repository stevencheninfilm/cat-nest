import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD_OBJECTS } from './world-layout.js';

export {mat,glow,box,sphere,cylinder,torus,group,line,paw};

const mat=(color,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const glow=color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.6,roughness:.4});
function box(parent,name,size,pos,material,radius=.06){
  const geometry=radius?new RoundedBoxGeometry(...size,2,Math.min(radius,...size.map(n=>n/3))):new THREE.BoxGeometry(...size);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(parent,name,r,pos,material,scale=[1,1,1]){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,20,12),material);mesh.name=name;mesh.position.set(...pos);mesh.scale.set(...scale);mesh.castShadow=true;parent.add(mesh);return mesh;}
function cylinder(parent,name,top,bottom,height,pos,material,segments=24){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,segments),material);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function torus(parent,name,r,tube,pos,material){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,6,32),material);mesh.name=name;mesh.position.set(...pos);parent.add(mesh);return mesh;}
function group(parent,name,pos=[0,0,0]){const g=new THREE.Group();g.name=name;g.position.set(...pos);parent?.add(g);return g;}
function line(parent,name,points,material,radius=.025){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,20,radius,6,false),material);mesh.name=name;parent.add(mesh);return mesh;}
function paw(parent,x,y,z,material,scale=1){sphere(parent,'PawPad',.105*scale,[x,y,z],material,[1,.8,.2]);for(const [dx,dy] of [[-.12,.13],[0,.18],[.12,.13]])sphere(parent,'PawToe',.05*scale,[x+dx*scale,y+dy*scale,z],material,[1,1,.3]);}

/** Original project assets: named, separately articulated meshes and PBR materials. */
export function createRobotAsset(){
  const root=group(null,'TuanTuan_T01');
  const shell=mat('#b6d9df',.28,.33),cream=mat('#fff2d5',.1,.4),navy=mat('#244957',.35,.35),screen=mat('#112f3d',.45,.22),gold=glow('#ffd98d'),cyan=glow('#85ecdf');
  const hover=group(root,'RobotHover',[0,.9,0]);
  const head=group(hover,'RobotHead',[0,.56,0]);
  box(head,'Shell',[1.05,.87,.77],[0,0,0],shell,.22);
  box(head,'FaceRim',[.94,.7,.08],[0,-.015,.383],cream,.15);
  box(head,'FaceScreen',[.83,.59,.07],[0,-.02,.432],screen,.13);
  for(const [side,x] of [['L',-.205],['R',.205]]){
    box(head,`Eye_${side}`,[.095,.235,.025],[x,.015,.478],gold,.045);
    const happy=line(head,`Happy_${side}`,[[x-.09,-.005,.478],[x,.085,.478],[x+.09,-.005,.478]],gold,.022);happy.visible=false;
  }
  line(head,'Smile',[[-.15,-.16,.478],[0,-.2,.478],[.15,-.16,.478]],gold,.022);
  box(head,'Crest',[.3,.1,.24],[0,.44,.03],cream,.04);
  for(const s of [-1,1]){
    cylinder(head,'AntennaBase',.08,.1,.12,[s*.55,.12,0],navy);
    const coil=[];for(let i=0;i<=40;i++){const t=i/40;coil.push([s*(.54+t*.14)+Math.cos(t*Math.PI*5)*.055,.2+t*.44,Math.sin(t*Math.PI*5)*.055]);}
    line(head,'AntennaSpring',coil,navy,.024);sphere(head,'AntennaLight',.105,[s*.68,.69,0],gold);
    sphere(head,'Cheek',.055,[s*.36,-.17,.47],mat('#e6a5a3'),[1,.5,.15]);
  }
  const body=group(hover,'RobotBody',[0,-.22,0]);sphere(body,'BodyShell',.34,[0,0,0],shell,[1,.95,.85]);
  cylinder(body,'Thruster',.19,.065,.35,[0,-.3,0],navy);
  const ring=torus(body,'ThrusterRing',.11,.025,[0,-.42,0],cyan);ring.rotation.x=Math.PI/2;
  sphere(body,'HeartCore',.11,[0,.04,.285],gold,[1,.8,.25]);
  for(const s of [-1,1]){
    const arm=group(hover,s<0?'Arm_L':'Arm_R',[s*.38,-.14,0]);
    const upper=box(arm,'ArmShell',[.5,.14,.24],[s*.25,0,0],shell);upper.rotation.z=s*-.18;
    box(arm,'ArmLight',[.3,.025,.04],[s*.26,.08,.13],cyan,.01);
    const hand=group(arm,'Hand',[s*.55,-.06,0]);sphere(hand,'Palm',.12,[0,0,0],navy,[1,.7,.8]);
    for(let j=0;j<3;j++)box(hand,'Finger',[.045,.065,.15],[(j-1)*.055,-.015,.1],navy,.02);
  }
  root.userData={assetVersion:1,creator:'Cat Nest',interactionId:'robot'};return root;
}

export function createRoomAsset(theme='home'){
  const sci=theme==='station',root=group(null,sci?'Orbital_Nook':'Cozy_Cat_Home');
  const wall=mat(sci?'#637b8c':'#edcda9'),trim=mat(sci?'#294454':'#ae7953',sci?.35:0),floor=mat(sci?'#304351':'#ca9d75'),light=glow(sci?'#ffda98':'#ffe3ac'),mint=glow(sci?'#84ebea':'#f9cb87'),fabric=mat(sci?'#405d6e':'#ddb1ac'),cream=mat(sci?'#bacbd1':'#fff0d3'),dark=mat('#163440',.15,.35);
  box(root,'Foundation',[8.5,.4,7.4],[0,-.25,0],trim,.16);
  for(let x=0;x<8;x++)for(let z=0;z<7;z++){
    const tile=box(root,'FloorTile',[sci?1.02:1.035,.06,sci?.97:1.01],[-3.65+x*1.045,-.015,-3.13+z*1.045],floor,.025);tile.receiveShadow=true;tile.castShadow=false;
    if(sci && (x===1 || x===6) && z%2===0)box(root,'FloorGuide',[.12,.012,.24],[-3.65+x*1.045,.025,-3.13+z*1.045],mint,.01);
  }
  box(root,'BackWall',[8.5,2.6,.2],[0,1.28,-3.62],wall);
  box(root,'SideWall',[.2,2.6,7.2],[-4.16,1.28,0],wall);
  box(root,'BackCap',[8.55,.1,.25],[0,2.6,-3.62],trim);
  box(root,'SideCap',[.25,.1,7.3],[-4.16,2.6,0],trim);
  box(root,'BackSkirting',[8.2,.17,.11],[0,.12,-3.48],trim);
  box(root,'SideSkirting',[.11,.17,7.1],[-4.03,.12,0],trim);
  for(let x=-3.5;x<4;x+=1.1)box(root,'WallPanelSeam',[.022,2.3,.015],[x,1.35,-3.505],trim,0);
  const window=group(root,'Window',[-2.25,1.65,-3.47]);
  box(window,'WindowFrame',[2.05,1.19,.16],[0,0,0],trim);
  box(window,'WindowGlow',[1.83,.98,.06],[0,0,.09],mint);
  box(window,'WindowGlass',[1.68,.83,.07],[0,0,.135],mat(sci?'#285968':'#f3d49d',.1,.4));
  if(sci){
    for(let i=0;i<11;i++)sphere(window,'Star',.018+(i%3)*.009,[Math.sin(i*7)*.72,Math.cos(i*4)*.33,.18],light);
    torus(window,'Orbit',.25,.018,[.12,.03,.19],mint).rotation.z=.4;
    sphere(window,'Planet',.11,[.12,.03,.2],cream);
  }else{
    box(window,'WindowCross',[.07,.9,.04],[0,0,.19],cream);box(window,'WindowCross',[1.7,.07,.04],[0,0,.19],cream);
    for(const x of [-1.02,1.02])box(window,'Curtain',[.3,1.32,.18],[x,-.04,.2],fabric,.08);
  }
  const rug=new THREE.Mesh(new THREE.CylinderGeometry(2.12,2.12,.025,48),mat(sci?'#3b5865':'#e7c4a4'));rug.name='CentralRug';rug.scale.z=.8;rug.position.set(0,.035,.7);rug.receiveShadow=true;root.add(rug);
  const rugRing=torus(root,'RugStitch',1.91,.016,[0,.055,.7],mat(sci?'#577d85':'#f6dfbd'));rugRing.rotation.x=-Math.PI/2;rugRing.scale.y=.8;
  for(const def of WORLD_OBJECTS){
    const prop=group(root,`Prop_${def.id}`,[def.x,0,def.z]);prop.userData.interactionId=def.id;
    if(def.id==='console'){
      for(const x of [-.65,.65])box(prop,'DeskLeg',[.18,.65,.55],[x,.33,0],trim);
      box(prop,'DeskTop',[1.9,.16,.95],[0,.75,0],cream);
      box(prop,'DeskLight',[1.5,.035,.035],[0,.78,.48],light,.01);
      box(prop,'ScreenStand',[.1,.4,.1],[0,1,-.1],trim);
      box(prop,'MonitorFrame',[1.05,.7,.12],[0,1.44,-.18],trim);
      box(prop,'MonitorDisplay',[.91,.55,.035],[0,1.44,-.105],dark);
      for(let i=0;i<5;i++)box(prop,'ScreenBars',[.06,.12+i*.06,.018],[-.31+i*.15,1.42,-.08],mint,.01);
      box(prop,'Keyboard',[.75,.035,.26],[0,.86,.19],trim);
      for(let i=0;i<4;i++)box(prop,'KeyStrip',[.55,.012,.018],[0,.885,.105+i*.05],cream,.005);
      cylinder(prop,'Mug',.09,.08,.18,[.67,.92,.16],fabric);
    }else if(def.id==='bed'){
      box(prop,'BedFrame',[1.38,.32,2.45],[0,.2,0],trim,.1);
      box(prop,'Mattress',[1.22,.25,2.2],[0,.45,0],cream,.14);
      box(prop,'Blanket',[1.23,.17,1.46],[0,.64,.35],fabric,.1);
      box(prop,'Pillow',[.95,.2,.5],[0,.66,-.72],cream,.13);
      box(prop,'Headboard',[1.4,.9,.18],[0,.55,-1.15],trim);
      if(sci){for(const x of [-.66,.66])box(prop,'BedRail',[.035,.04,2.2],[x,.43,0],light,.01);}
      else paw(prop,0,.57,1.235,mat('#e6c28d'),1.4);
    }else if(def.id==='charger'){
      cylinder(prop,'DockBase',.63,.7,.12,[0,.07,0],trim);
      const ring=torus(prop,'DockRing',.51,.032,[0,.145,0],light);ring.rotation.x=Math.PI/2;
      if(sci){
        box(prop,'ChargerPillar',[.58,1.6,.36],[0,.85,-.3],trim);
        box(prop,'PowerDisplay',[.37,.75,.03],[0,1.1,-.1],dark);
        for(let i=0;i<4;i++)box(prop,'PowerBar',[.23,.08,.02],[0,.86+i*.16,-.075],mint,.01);
      }else{
        cylinder(prop,'LampStem',.035,.035,1.25,[0,.75,0],trim);
        cylinder(prop,'LampShade',.35,.53,.46,[0,1.5,0],cream);
        sphere(prop,'LampBulb',.17,[0,1.28,0],light);
      }
    }else if(def.id==='sofa'){
      box(prop,'SofaBase',[1.12,.35,1.65],[0,.25,0],trim,.13);
      box(prop,'SofaBack',[.22,1.05,1.65],[-.44,.65,0],fabric,.11);
      for(const z of [-.69,.69])box(prop,'SofaArm',[1.14,.65,.22],[0,.57,z],fabric,.1);
      box(prop,'SofaSeat',[.94,.25,1.18],[.06,.56,0],fabric,.13);
      const pillow=box(prop,'SofaPillow',[.25,.52,.53],[-.15,.92,0],cream,.12);pillow.rotation.z=-.2;
      if(sci)box(prop,'SofaEdgeLight',[.025,.035,1.48],[.57,.45,0],light,.01);
    }else if(def.id==='toy'){
      cylinder(prop,'ToyStand',.34,.4,.12,[0,.08,0],trim);
      sphere(prop,'ToyBall',.25,[0,sci?.65:.36,0],mat(sci?'#65bfc6':'#d78c8c',.15,.4));
      const ring=torus(prop,'ToyOrbit',.34,.024,[0,sci?.65:.36,0],light);ring.rotation.x=1.2;ring.rotation.y=.5;
    }else if(def.id==='door'){
      box(prop,'DoorFrame',[1.58,2.38,.24],[0,1.2,0],trim,.08);
      const slab=box(prop,'DoorPanel',[1.3,2.12,.12],[0,1.18,.17],mat(sci?'#506976':'#d6a179',sci?.4:0));slab.userData.closedX=0;
      box(prop,'DoorHeaderLight',[.83,.08,.035],[0,2.25,.15],light,.015);
      sphere(prop,'DoorBell',.09,[.91,1.18,.17],mint,[1,1,.4]);
      paw(prop,0,1.45,.25,cream,1.5);
    }
  }
  // Small, non-colliding accents stay outside the walking area.
  const pots=group(root,'CornerPlant',[3.55,0,-2.85]);cylinder(pots,'Pot',.27,.19,.4,[0,.2,0],fabric);
  for(let i=0;i<5;i++){const leaf=sphere(pots,'Leaf',.18,[Math.sin(i*2)*.22,.6+i*.08,Math.cos(i*2)*.18],mat(sci?'#6ca69f':'#8d9f79'),[.5,1.9,.6]);leaf.rotation.z=Math.sin(i)*.5;}
  root.userData={assetVersion:1,creator:'Cat Nest',theme};return root;
}

export function createRobotClips(robot){
  const times=[0,.4,.8,1.2,1.6],tracks=[];
  const q=(x,y,z)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)).toArray();
  tracks.push(new THREE.QuaternionKeyframeTrack('Arm_R.quaternion',times,[...q(0,0,0),...q(0,0,1.1),...q(0,0,.6),...q(0,0,1.1),...q(0,0,0)]));
  const wave=new THREE.AnimationClip('Greeting',1.6,tracks);
  const bob=new THREE.AnimationClip('HoverIdle',3,[new THREE.VectorKeyframeTrack('RobotHover.position',[0,1.5,3],[0,.9,0,0,.96,0,0,.9,0])]);
  const nod=new THREE.AnimationClip('HappyNod',1.2,[new THREE.QuaternionKeyframeTrack('RobotHead.quaternion',[0,.3,.6,.9,1.2],[...q(0,0,0),...q(.16,0,.1),...q(-.08,0,-.1),...q(.16,0,.1),...q(0,0,0)])]);
  robot.animations=[bob,wave,nod];return robot.animations;
}
