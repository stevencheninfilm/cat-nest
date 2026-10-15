import { COLLECTION_CATS, collectionCatProgress } from './cat-collection.js';
import { CAT_SCENES, collectionSceneProgress, sceneCatPlacement } from './catbook-scenes.js';
import { levelInfo } from './state.js';

/** Track confirmed snapshots only. Repeated saves and reconnects do not replay rewards. */
export function createCollectionEvents(initialState) {
  const invited=new Set(initialState.collection.invited.map(record=>record.id));
  const ready=new Set(COLLECTION_CATS.filter(cat=>collectionCatProgress(cat,initialState.collection,levelInfo(initialState.xp).level).complete).map(cat=>cat.id));
  const scenes=new Set(CAT_SCENES.filter(scene=>collectionSceneProgress(scene,initialState.collection,levelInfo(initialState.xp).level).complete).map(scene=>scene.id));
  return {
    observe(state) {
      const result=[], current=new Set(state.collection.invited.map(record=>record.id));
      for(const cat of COLLECTION_CATS) {
        if(current.has(cat.id) && !invited.has(cat.id)) result.push({type:'cat-arrived',id:cat.id});
        if(current.has(cat.id)) invited.add(cat.id);
      }
      for(const scene of CAT_SCENES) {
        if(collectionSceneProgress(scene,state.collection,levelInfo(state.xp).level).complete && !scenes.has(scene.id)) { scenes.add(scene.id); result.push({type:'scene-unlocked',id:scene.id}); }
      }
      const level=levelInfo(state.xp).level;
      for(const cat of COLLECTION_CATS) {
        const progress=collectionCatProgress(cat,state.collection,level);
        if(progress.complete && !ready.has(cat.id)) {
          ready.add(cat.id);
          if(!current.has(cat.id)) result.push({type:'cat-unlocked',id:cat.id});
        }
      }
      return result;
    },
  };
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const CAT_ARRIVAL_MS=3200;

/** Walk along the foreground, then hop through the furniture tiers to the exact foot anchor. */
export function catArrivalRoute(scene,cat,{width,height,left,top,viewWidth,viewHeight}) {
  const place=sceneCatPlacement(scene,cat);
  const target={x:width*place.x/100,y:height*place.y/100};
  const fromLeft=target.x < left+viewWidth/2, direction=fromLeft ? 1 : -1;
  const startX=fromLeft ? left-90 : left+viewWidth+90;
  const floorY=clamp(Math.max(target.y+height*.06,Math.min(height*.82,top+viewHeight-140)),target.y,height*.94);
  const approachX=clamp(target.x-direction*32,25,width-25);
  const point=(x,y,offset)=>({transform:`translate(${x}px, ${y}px)`,offset});
  const frames=[point(startX,floorY,0),point(startX+(approachX-startX)*.4,floorY,.22),point(approachX,floorY,.52)];
  const hops=clamp(Math.ceil((floorY-target.y)/(height*.19)),1,3);
  let previous={x:approachX,y:floorY};
  for(let step=1;step<=hops;step++) {
    const next=step === hops ? target : {x:target.x-direction*(hops-step)*10,y:floorY+(target.y-floorY)*step/hops};
    frames.push(point((previous.x+next.x)/2,Math.min(previous.y,next.y)-height*.025,.52+.48*(step-.5)/hops));
    frames.push(point(next.x,next.y,.52+.48*step/hops));
    previous=next;
  }
  return {frames,direction,target};
}
