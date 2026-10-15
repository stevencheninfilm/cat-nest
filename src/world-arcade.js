import {ROBOT_HOME} from './world-layout.js';

export const ARCADE_OBJECTS=Object.freeze([
  {id:'arcade',arcade:'霓虹街机',icon:'🕹',label:'玩街机',x:-2.8,z:-2.65,width:1.15,depth:.95,approach:{x:-2.8,z:-1.65},reply:'摇杆轻轻一拨，猫爪飞船出发！团团给你亮起了通关小星星。'},
  {id:'claw',arcade:'抓娃娃机',icon:'♧',label:'抓娃娃',x:-1.15,z:-2.65,width:1.1,depth:.95,approach:{x:-1.15,z:-1.65},reply:'小爪钩慢慢落下，抱起一只软软猫团子。团团也探头看得很认真。'},
  {id:'jukebox',arcade:'复古点唱机',icon:'♫',label:'点首歌',x:1,z:-2.7,width:1.1,depth:.8,approach:{x:1,z:-1.65},reply:'点唱机跟着节拍亮起来，猫猫晃晃脑袋，团团陪着挥挥小手。'},
  {id:'drinks',arcade:'彩虹饮料吧',icon:'🥤',label:'饮料吧',x:3.05,z:-2.65,width:1.1,depth:.9,approach:{x:2.8,z:-1.65},reply:'给你一杯彩虹气泡，给猫猫留一碗清水。碰一下杯，今天也要开心。'},
  {id:'pool',arcade:'迷你台球桌',icon:'●',label:'推台球',x:-2.5,z:-.05,width:1.9,depth:2.1,approach:{x:-1.05,z:0},reply:'小爪一推，彩色球轻轻碰到一起。漂亮的一杆！团团举起了小手。'},
  {id:'popcorn',arcade:'爆米花小车',icon:'🍿',label:'爆米花',x:-2.65,z:2.1,width:1,depth:1,approach:{x:-1.55,z:1.95},reply:'噗噗噗，金黄色的小云朵蹦起来啦。猫猫凑近闻闻香气。'},
  {id:'booth',arcade:'红绒休息椅',icon:'☁',label:'坐一会',x:3,z:-.2,width:1.2,depth:1.8,approach:{x:1.85,z:.15},reply:'在红绒小椅旁歇歇脚。下一局开始前，先收好刚才的快乐。'},
  {id:'recycle',arcade:'星星回收箱',icon:'♻',label:'整理一下',x:3.35,z:2.7,width:.5,depth:.5,approach:{x:2.55,z:2.65},reply:'把小纸杯送回回收箱，街机屋又整整齐齐啦。团团亮起一颗感谢星。'},
].map(o=>Object.freeze({...o,labelY:['arcade','claw','jukebox','drinks'].includes(o.id)?2.6:o.id==='popcorn'?2.05:o.id==='recycle'?1.2:1.65,approach:Object.freeze(o.approach)})));
export const ARCADE_OBSTACLES=Object.freeze([
  ...ARCADE_OBJECTS.map(({x,z,width,depth})=>Object.freeze({x,z,width,depth})),
  Object.freeze({...ROBOT_HOME,width:.75,depth:.75}),
]);
export const ARCADE_ANIMATED_NODES=Object.freeze(['ArcadeScreen','ArcadeJoystick','ArcadeShip','ClawRig','ClawPrize','JukeboxRecord','JukeboxLights','PopcornKettle','DrinkCup','DrinkStream','BinLid',...Array.from({length:7},(_,i)=>`PoolBall_${i}`),...Array.from({length:7},(_,i)=>`PopcornPuff_${i}`)]);

/** Local presentation with fixed rest transforms; switching/cancelling always restores them. */
export function createArcadePresentation(room){
  const targets=new Map();room.traverse(node=>{if(ARCADE_ANIMATED_NODES.includes(node.name))targets.set(node.name,{node,position:node.position.clone(),rotation:node.rotation.clone(),scale:node.scale.clone(),visible:node.visible,emissive:node.material?.emissiveIntensity});});
  const move=(name,fn)=>{const t=targets.get(name);if(t)fn(t.node,t);};
  function reset(){for(const t of targets.values()){t.node.position.copy(t.position);t.node.rotation.copy(t.rotation);t.node.scale.copy(t.scale);t.node.visible=!['DrinkStream'].includes(t.node.name) && t.visible;if(t.emissive!==undefined)t.node.material.emissiveIntensity=t.emissive;}}
  reset();
  return {
    reset,
    update(id,time,duration,reduced=false){
      if(reduced){reset();return;}
      const gain=reduced?0:Math.sin(Math.min(1,time/duration)*Math.PI);
      if(id==='arcade'){
        move('ArcadeJoystick',(n,t)=>{n.rotation.z=t.rotation.z+Math.sin(time*6)*.25*gain;});
        move('ArcadeShip',(n,t)=>{n.position.x=t.position.x+Math.sin(time*3)*.28*gain;});
        move('ArcadeScreen',(n,t)=>{n.material.emissiveIntensity=t.emissive+gain*.5;});
      }
      if(id==='claw'){
        move('ClawRig',(n,t)=>{n.position.y=t.position.y-Math.sin(Math.min(1,time/duration)*Math.PI)*.43*(reduced?0:1);});
        move('ClawPrize',(n,t)=>{n.position.y=t.position.y+Math.max(0,Math.sin(time/duration*Math.PI*1.5))*.18*gain;});
      }
      if(id==='pool')for(let i=0;i<7;i++)move(`PoolBall_${i}`,(n,t)=>{n.position.x=t.position.x+Math.sin(time*2.5+i*.4)*.14*gain;n.position.z=t.position.z+Math.sin(time*2+i*.8)*.12*gain;});
      if(id==='jukebox'){move('JukeboxRecord',(n,t)=>{n.rotation.z=t.rotation.z+time*3*(reduced?0:1);});move('JukeboxLights',(n,t)=>{n.scale.y=t.scale.y*(1+Math.sin(time*5)*.14*gain);});}
      if(id==='popcorn'){
        move('PopcornKettle',(n,t)=>{n.rotation.z=t.rotation.z+Math.sin(time*8)*.05*gain;});
        for(let i=0;i<7;i++)move(`PopcornPuff_${i}`,(n,t)=>{n.position.y=t.position.y+Math.abs(Math.sin(time*5+i))*.24*gain;});
      }
      if(id==='drinks'){
        move('DrinkCup',(n,t)=>{n.position.y=t.position.y+Math.sin(time*2)**2*.08*gain;});
        move('DrinkStream',n=>{n.visible=!reduced && time>.5 && time<duration-.6;});
      }
      if(id==='recycle')move('BinLid',(n,t)=>{n.rotation.z=t.rotation.z-.3*gain;});
    },
  };
}
