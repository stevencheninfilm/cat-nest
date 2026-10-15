export const WORLD_BOUNDS = Object.freeze({ minX:-3.65, maxX:3.65, minZ:-3.05, maxZ:3.05 });
export const WORLD_OBJECTS = Object.freeze([
  { id:'console', home:'音乐桌', station:'星图控制台', x:0, z:-2.25, width:1.8, depth:.9, approach:{x:0,z:-1.18} },
  { id:'bed', home:'软软猫床', station:'太空休眠舱', x:2.85, z:-.8, width:1.4, depth:2.5, approach:{x:1.65,z:-.05} },
  { id:'charger', home:'暖暖小夜灯', station:'能量充电站', x:-2.85, z:-2.05, width:1.2, depth:1.2, approach:{x:-1.85,z:-1.5} },
  { id:'sofa', home:'抱枕沙发', station:'观星沙发', x:-2.95, z:.05, width:1.2, depth:1.65, approach:{x:-1.8,z:.15} },
  { id:'toy', home:'猫猫玩具球', station:'悬浮星球', x:-2.25, z:2.05, width:.65, depth:.65, approach:{x:-1.25,z:1.95} },
  { id:'door', home:'小屋门铃', station:'气闸门', x:1.5, z:-3.3, width:1.35, depth:.45, approach:{x:1.35,z:-2.65} },
]);
export const ROBOT_HOME = Object.freeze({ x:2.05, z:1.85 });
export const ROBOT_APPROACH = Object.freeze({ x:.7, z:2.65 });
export const WORLD_OBSTACLES = Object.freeze([
  ...WORLD_OBJECTS.filter(item=>item.id!=='door').map(item=>({x:item.x,z:item.z,width:item.width,depth:item.depth})),
  { ...ROBOT_HOME, width:.75, depth:.75 },
]);
export function walkable(point, clearance=.22, obstacles=WORLD_OBSTACLES) {
  if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.z))return false;
  if(point.x<WORLD_BOUNDS.minX || point.x>WORLD_BOUNDS.maxX || point.z<WORLD_BOUNDS.minZ || point.z>WORLD_BOUNDS.maxZ)return false;
  return !obstacles.some(o=>Math.abs(point.x-o.x)<o.width/2+clearance && Math.abs(point.z-o.z)<o.depth/2+clearance);
}
function clearSegment(a,b,obstacles) {
  // Test whole segments against inflated rectangles; sampling can miss thin corners.
  for(const o of obstacles){
    let enter=0,exit=1,intersects=true;
    for(const [axis,half]of [['x',o.width/2+.22],['z',o.depth/2+.22]]){
      const direction=b[axis]-a[axis],min=o[axis]-half,max=o[axis]+half;
      if(Math.abs(direction)<1e-12){if(a[axis]<min || a[axis]>max){intersects=false;break;}}
      else{const first=(min-a[axis])/direction,last=(max-a[axis])/direction;enter=Math.max(enter,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));if(enter>exit){intersects=false;break;}}
    }
    if(intersects)return false;
  }
  return true;
}
/** Small A* grid; no diagonal corner cutting. Smooth only collision-free segments. */
export function findWorldPath(start, target, obstacles=WORLD_OBSTACLES) {
  if(!walkable(start,.22,obstacles) || !walkable(target,.22,obstacles))return null;
  if(clearSegment(start,target,obstacles))return [{...target}];
  const step=.18,cols=Math.floor((WORLD_BOUNDS.maxX-WORLD_BOUNDS.minX)/step)+1,rows=Math.floor((WORLD_BOUNDS.maxZ-WORLD_BOUNDS.minZ)/step)+1;
  const point=id=>({x:WORLD_BOUNDS.minX+(id%cols)*step,z:WORLD_BOUNDS.minZ+Math.floor(id/cols)*step});
  function nearest(p){
    let best=-1,d=Infinity;
    for(let id=0;id<cols*rows;id++){const q=point(id),distance=Math.hypot(q.x-p.x,q.z-p.z);if(distance<d && walkable(q,.22,obstacles) && clearSegment(p,q,obstacles)){best=id;d=distance;}}
    return best;
  }
  const first=nearest(start),last=nearest(target);if(first<0 || last<0)return null;
  const open=new Set([first]),closed=new Set(),g=new Map([[first,0]]),parent=new Map();
  const heuristic=id=>{const p=point(id),q=point(last);return Math.hypot(p.x-q.x,p.z-q.z);};
  while(open.size){
    let current=-1,score=Infinity;
    for(const id of open){const f=g.get(id)+heuristic(id);if(f<score){score=f;current=id;}}
    if(current===last){
      const path=[{...target}];let id=last;while(id!==first){path.unshift(point(id));id=parent.get(id);}path.unshift(point(first));
      const smooth=[];let from=start,index=0;
      while(index<path.length){let end=path.length-1;while(end>index && !clearSegment(from,path[end],obstacles))end--;smooth.push(path[end]);from=path[end];index=end+1;}
      return smooth;
    }
    open.delete(current);closed.add(current);
    const cx=current%cols,cz=Math.floor(current/cols);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=cx+dx,z=cz+dz;if(x<0 || x>=cols || z<0 || z>=rows)continue;
      const next=z*cols+x;if(closed.has(next) || !walkable(point(next),.22,obstacles) || !clearSegment(point(current),point(next),obstacles))continue;
      const cost=g.get(current)+Math.hypot(dx,dz)*step;
      if(cost<(g.get(next)??Infinity)){g.set(next,cost);parent.set(next,current);open.add(next);}
    }
  }
  return null;
}
