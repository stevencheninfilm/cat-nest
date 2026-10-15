import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mat,glow,box,sphere,cylinder,torus,group,line,paw} from './world-assets.js';
import {ARCADE_OBJECTS} from './world-arcade.js';

const FONT={A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',D:'11110/10001/10001/10001/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',G:'01111/10000/10000/10111/10001/10001/01110',H:'10001/10001/10001/11111/10001/10001/10001',I:'11111/00100/00100/00100/00100/00100/11111',J:'00111/00010/00010/00010/00010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/11001/10101/10011/10011/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110',V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/11011/10001',X:'10001/10001/01010/00100/01010/10001/10001',Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111'};
function text(parent,word,size,pos,material){
  const step=size/7,geometries=[];
  for(const [i,letter]of [...word].entries())for(const [row,line]of (FONT[letter]||'').split('/').entries())for(let col=0;col<line.length;col++)if(line[col]==='1')geometries.push(new THREE.PlaneGeometry(step*.87,step*.87).translate((i*6+col-word.length*3)*step,(6-row)*step,0));
  const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='MarqueeText';mesh.position.set(...pos);parent.add(mesh);return mesh;
}
function plush(parent,pos,color){
  const g=group(parent,'PlushCat',pos);sphere(g,'PlushBody',.16,[0,.14,0],color,[1,.9,.8]);sphere(g,'PlushHead',.18,[0,.35,0],color);
  for(const s of [-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.08,.15,3),color);ear.position.set(s*.13,.52,0);g.add(ear);sphere(g,'PlushEye',.018,[s*.065,.36,.16],mat('#403043'),[1,1,.25]);}
  return g;
}

/** Original low-poly arcade diorama; no third-party models or textures. */
export function createArcadeRoomAsset(){
  const root=group(null,'Retro_Catcade');
  const berry=mat('#793344'),wine=mat('#3c203b'),red=mat('#bd4d57',.12,.45),wood=mat('#9d5e4f'),chrome=mat('#a9b7ce',.65,.3),navy=mat('#302d4b'),cream=mat('#fff0ce'),dark=mat('#171d2e',.15,.4),felt=mat('#789276'),pink=glow('#ff9da5'),amber=glow('#ffc98b'),cyan=glow('#72e1e5');
  box(root,'Foundation',[8.5,.4,7.4],[0,-.25,0],wine,.13);
  const tiles=[mat('#4e3046'),mat('#624051')];
  for(let x=0;x<8;x++)for(let z=0;z<7;z++)box(root,'FloorTile',[1.03,.055,1.03],[-3.65+x*1.045,-.01,-3.13+z*1.045],tiles[(x+z)%2],0).castShadow=false;
  const carpet=cylinder(root,'ArcadeCarpet',2.15,2.15,.025,[0,.035,.8],mat('#9b435b'),48);carpet.scale.z=.84;
  const carpetRim=torus(root,'CarpetRim',2.02,.018,[0,.055,.8],mat('#df9e8e'));carpetRim.rotation.x=-Math.PI/2;carpetRim.scale.y=.84;
  box(root,'BackWall',[8.5,2.7,.18],[0,1.32,-3.62],wine);
  box(root,'SideWall',[.18,2.7,7.2],[-4.16,1.32,0],wine);
  for(let x=0;x<10;x++)for(let y=0;y<3;y++)box(root,'WallPanel',[.79,.73,.045],[-3.72+x*.83,.42+y*.78,-3.505],berry,0);
  for(let z=0;z<8;z++)for(let y=0;y<3;y++)box(root,'SidePanel',[.045,.73,.85],[-4.045,.42+y*.78,-3.08+z*.89],berry,0);
  box(root,'BackWallCap',[8.5,.1,.24],[0,2.7,-3.62],wood);
  box(root,'SideWallCap',[.24,.1,7.3],[-4.16,2.7,0],wood);
  for(const y of [2.34,2.43]){box(root,'BackNeon',[8.25,.045,.045],[0,y,-3.465],pink,.012);box(root,'SideNeon',[.045,.045,7.05],[-4.005,y,.02],pink,.012);}
  const sign=group(root,'CatcadeSign',[.2,2.4,-3.43]);box(sign,'SignBox',[2.9,.55,.14],[0,0,0],navy);text(sign,'CATCADE',.24,[0,-.09,.1],amber);
  for(const def of ARCADE_OBJECTS){
    const p=group(root,`Prop_${def.id}`,[def.x,0,def.z]);p.userData.interactionId=def.id;
    if(def.id==='arcade'){
      box(p,'Cabinet',[1.08,1.7,.88],[0,.88,0],navy,.08);
      for(const x of [-.54,.54])box(p,'CabinetSide',[.1,2.42,.96],[x,1.23,-.04],chrome,.03);
      box(p,'Marquee',[1.08,.33,.94],[0,2.31,-.02],wine);
      box(p,'MarqueeLight',[.94,.025,.025],[0,2.14,.46],pink,.008);text(p,'PAW PILOT',.12,[0,2.28,.465],amber);
      const screen=box(p,'ArcadeScreen',[.9,.77,.05],[0,1.67,.45],dark,.05);screen.material=screen.material.clone();screen.material.emissive.set('#2e7779');screen.material.emissiveIntensity=.4;
      for(let i=0;i<8;i++)box(p,'Scanline',[.84,.005,.012],[0,1.37+i*.085,.482],mat('#5c9da5'),0);
      text(p,'PRESS START',.075,[0,1.47,.49],amber);
      const ship=group(p,'ArcadeShip',[0,1.82,.49]);const arrow=new THREE.Mesh(new THREE.ConeGeometry(.07,.13,3),cyan);ship.add(arrow);sphere(ship,'ShipCore',.035,[0,-.04,.01],cream);
      for(let i=0;i<6;i++)sphere(p,'PixelStar',.012,[Math.sin(i*5)*.36,1.65+Math.cos(i*3)*.27,.49],cream,[1,1,.2]);
      const deck=box(p,'ControlDeck',[1.1,.14,.5],[0,1.11,.4],chrome);deck.rotation.x=.12;
      const joystick=group(p,'ArcadeJoystick',[-.29,1.21,.46]);cylinder(joystick,'Stick',.025,.025,.17,[0,.08,0],navy);sphere(joystick,'StickBall',.065,[0,.19,0],red);
      for(let i=0;i<3;i++)cylinder(p,'ArcadeButton',.045,.045,.025,[.1+i*.12,1.21,.47],i%2?amber:red);
      box(p,'CoinPanel',[.47,.4,.035],[0,.5,.46],wine);box(p,'CoinSlot',[.06,.14,.02],[0,.53,.485],chrome,.01);
    }else if(def.id==='claw'){
      box(p,'PrizeBase',[1.06,.76,.9],[0,.39,0],red);
      box(p,'PrizeRoof',[1.12,.3,1.03],[0,2.29,0],red);
      text(p,'LUCKY PAWS',.105,[0,2.25,.53],amber);
      for(const x of [-.5,.5])for(const z of [-.41,.41])box(p,'PrizeCorner',[.065,1.45,.065],[x,1.5,z],chrome,.02);
      const glass=new THREE.MeshStandardMaterial({color:'#d8d2f5',transparent:true,opacity:.15,roughness:.2,metalness:.1,depthWrite:false});
      box(p,'PrizeGlass',[.94,1.3,.025],[0,1.48,.435],glass,.008);
      const prize=group(p,'ClawPrize',[0,.77,.08]);plush(prize,[0,0,0],mat('#e3b7c9'));plush(p,[-.27,.77,-.17],mat('#eed6a7'));plush(p,[.29,.77,-.15],mat('#a9c9d0'));
      const claw=group(p,'ClawRig',[0,2.05,0]);cylinder(claw,'ClawCord',.012,.012,.25,[0,.15,0],navy);sphere(claw,'ClawHub',.075,[0,0,0],chrome);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;line(claw,'ClawFinger',[[0,0,0],[Math.cos(a)*.16,-.14,Math.sin(a)*.16],[Math.cos(a)*.08,-.28,Math.sin(a)*.08]],chrome,.018);}
      box(p,'PrizeHatch',[.55,.25,.045],[0,.28,.48],wine);text(p,'GOOD LUCK',.065,[0,.52,.48],cream);
    }else if(def.id==='jukebox'){
      box(p,'JukeboxCabinet',[1.03,1.72,.65],[0,.89,0],wood,.1);
      sphere(p,'JukeboxTop',.52,[0,1.75,0],wood,[1,1,.63]);
      box(p,'JukeboxPanel',[.8,1.4,.04],[0,.9,.35],navy,.09);
      const arch=new THREE.Mesh(new THREE.TorusGeometry(.43,.045,6,32,Math.PI),pink);arch.name='JukeboxArch';arch.position.set(0,1.75,.38);p.add(arch);
      for(const x of [-.43,.43])box(p,'JukeboxSideTube',[.07,1.38,.05],[x,1.06,.38],pink,.025);
      const record=group(p,'JukeboxRecord',[0,1.65,.42]);const disc=cylinder(record,'Record',.24,.24,.025,[0,0,0],dark);disc.rotation.x=Math.PI/2;torus(record,'RecordGroove',.18,.008,[0,0,.018],chrome);sphere(record,'RecordLabel',.075,[0,0,.03],amber,[1,1,.2]);box(record,'RecordShine',[.15,.02,.01],[.08,.05,.04],cream,.003);
      for(let i=0;i<8;i++)box(p,'SpeakerLine',[.53,.025,.025],[0,.42+i*.07,.39],chrome,.006);
      const lights=group(p,'JukeboxLights',[0,1.15,.4]);for(let i=0;i<5;i++)box(lights,'Equalizer',[.075,.08+i%3*.05,.025],[-.24+i*.12,0,0],i%2?cyan:amber,.01);
      text(p,'MEOW FM',.095,[0,2.13,.28],cream);
    }else if(def.id==='pool'){
      for(const x of [-.66,.66])for(const z of [-.8,.8]){box(p,'PoolLeg',[.2,.8,.2],[x,.4,z],wood);box(p,'PoolFoot',[.3,.1,.3],[x,.05,z],chrome);}
      box(p,'PoolBody',[1.87,.33,2.08],[0,.91,0],red,.09);box(p,'PoolFelt',[1.56,.07,1.77],[0,1.1,0],felt,.04);
      for(const x of [-.85,.85])box(p,'PoolRail',[.16,.15,1.98],[x,1.16,0],wood,.04);
      for(const z of [-.96,.96])box(p,'PoolRail',[1.84,.15,.16],[0,1.16,z],wood,.04);
      for(const x of [-.76,.76])for(const z of [-.86,0,.86])cylinder(p,'PoolPocket',.105,.105,.016,[x,1.22,z],dark,16);
      const spots=[[-.18,-.3],[.03,-.35],[.24,-.43],[-.26,.12],[.13,.27],[.38,-.04],[-.4,.5]],colors=['#fff0d3','#4386b8','#bd4956','#e8b847','#7fb29a','#d9d2b7','#354154'];
      for(let i=0;i<spots.length;i++)sphere(p,`PoolBall_${i}`,.075,[spots[i][0],1.21,spots[i][1]],mat(colors[i],.1,.25));
      const cue=cylinder(p,'PoolCue',.017,.024,1.88,[.07,1.27,0],cream,10);cue.rotation.x=Math.PI/2;cue.rotation.z=.25;
    }else if(def.id==='popcorn'){
      box(p,'CartBody',[.94,.52,.83],[0,.6,0],red);
      for(const x of [-.35,.35])box(p,'CartLeg',[.07,.42,.07],[x,.24,-.27],wood);
      for(const x of [-.48,.48]){const wheel=torus(p,'CartWheel',.24,.035,[x,.28,.2],wine);wheel.rotation.y=Math.PI/2;for(let i=0;i<5;i++){const spoke=box(p,'WheelSpoke',[.015,.43,.02],[x,.28,.2],chrome,.002);spoke.rotation.x=i*Math.PI/5;}}
      for(const x of [-.45,.45])for(const z of [-.37,.37])box(p,'CartFrame',[.045,.89,.045],[x,1.22,z],red,.015);
      const glass=new THREE.MeshStandardMaterial({color:'#ece4f6',transparent:true,opacity:.17,roughness:.25,depthWrite:false});box(p,'PopcornGlass',[.84,.73,.025],[0,1.24,.39],glass,.01);
      box(p,'CartRoof',[1.03,.22,.96],[0,1.8,0],red);text(p,'POPCORN',.1,[0,1.78,.49],cream);
      for(let i=0;i<6;i++)box(p,'CartStripe',[.065,.44,.02],[-.35+i*.14,.61,.43],cream,.005);
      const kettle=group(p,'PopcornKettle',[0,1.35,0]);cylinder(kettle,'KettleBowl',.19,.13,.14,[0,0,0],chrome);box(kettle,'KettleLid',[.43,.025,.37],[0,.09,0],chrome,.02);
      for(let i=0;i<7;i++)sphere(p,`PopcornPuff_${i}`,.07,[Math.sin(i*4)*.27,.94+Math.sin(i*3)*.035,Math.cos(i*4)*.23],cream,[1.2,.8,1]);
      line(p,'CartHandle',[[.46,.9,-.2],[.7,.9,-.2],[.7,.9,.2],[.46,.9,.2]],chrome,.025);
    }else if(def.id==='drinks'){
      box(p,'DrinkCounter',[1.08,.76,.86],[0,.39,0],cream,.06);
      for(const x of [-.26,.26]){box(p,'CounterDoor',[.48,.63,.025],[x,.39,.445],wood,.025);sphere(p,'CounterHandle',.025,[x*.55,.44,.47],dark);}
      box(p,'CounterTop',[1.16,.1,.97],[0,.82,0],wood);
      box(p,'Dispenser',[1.04,.9,.67],[0,1.3,-.08],chrome,.07);box(p,'DrinkSign',[1.12,.29,.73],[0,1.9,-.08],red);text(p,'BUBBLE BAR',.09,[0,1.87,.3],cream);
      for(let i=0;i<5;i++){const color=mat(['#dc7992','#e2b65b','#82bfa2','#82adc8','#a7a0d1'][i]);box(p,'DrinkChoice',[.12,.24,.045],[-.36+i*.18,1.54,.29],color,.02);const spout=cylinder(p,'DrinkSpout',.025,.025,.13,[-.36+i*.18,1.32,.31],dark,10);spout.rotation.x=.2;}
      box(p,'DrinkTray',[.95,.035,.24],[0,.99,.34],dark,.02);
      cylinder(p,'DrinkCup',.075,.055,.2,[0,1.1,.35],pink);
      const stream=cylinder(p,'DrinkStream',.015,.015,.17,[0,1.25,.35],cyan,8);stream.visible=false;
    }else if(def.id==='booth'){
      box(p,'BoothBase',[1.17,.28,1.7],[0,.17,0],wine,.09);box(p,'BoothSeat',[1.13,.24,1.55],[0,.43,0],red,.12);box(p,'BoothBack',[1.15,.9,.2],[0,.84,-.69],red,.1);
      for(const x of [-.5,.5])box(p,'BoothArm',[.14,.43,1.65],[x,.62,0],wood,.06);
      for(const x of [-.3,0,.3])sphere(p,'VelvetButton',.025,[x,.9,-.58],amber,[1,1,.25]);
      box(p,'BoothCushion',[.48,.14,.48],[.19,.65,-.38],cream,.07);
    }else if(def.id==='recycle'){
      box(p,'RecycleBin',[.48,.7,.48],[0,.37,0],navy,.04);
      for(const y of [.15,.66])box(p,'BinTrim',[.51,.06,.51],[0,y,0],amber,.02);
      const lid=group(p,'BinLid',[0,.84,0]);const roof=new THREE.Mesh(new THREE.ConeGeometry(.4,.2,4),navy);roof.rotation.y=Math.PI/4;lid.add(roof);
      text(p,'THANKS',.065,[0,.43,.25],amber);
    }
  }
  root.userData={assetVersion:1,creator:'Cat Nest',theme:'arcade'};return root;
}
