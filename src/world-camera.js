import * as THREE from 'three';

const OFFSET=new THREE.Vector3(10,12,15);
const ROOM_CENTER=new THREE.Vector3(0,.85,0);

/** One camera for both views. Follow framing preserves a useful, tappable floor area. */
export function createWorldCameraRig(camera){
  let width=1,height=1,overview=false,half=8,fullHalf=8,first=true;
  const center=ROOM_CENTER.clone(),goal=ROOM_CENTER.clone();
  function measure(){
    const probe=new THREE.OrthographicCamera(-1,1,1,-1,.1,70);probe.position.copy(ROOM_CENTER).add(OFFSET);probe.lookAt(ROOM_CENTER);probe.updateMatrixWorld();
    let maxX=0,maxY=0;
    const corners=[];
    for(const x of [-4.35,4.35])for(const z of [-3.8,3.8])corners.push([x,-.4,z]);
    for(const x of [-4.35,4.35])corners.push([x,2.7,-3.8]);
    for(const z of [-3.8,3.8])corners.push([-4.35,2.7,z]);
    for(const p of corners){const v=new THREE.Vector3(...p).applyMatrix4(probe.matrixWorldInverse);maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));}
    fullHalf=Math.max(maxY*1.05,maxX/(width/height)*1.055);
  }
  function update(delta,{cat,focus,reducedMotion=false,snap=false}={}){
    const phone=width<700;
    goal.copy(ROOM_CENTER);
    if(!overview && cat){
      if(focus){goal.x=(cat.x+focus.x)/2;goal.z=(cat.z+focus.z)/2;}
      else{goal.x=cat.x*.85+.4;goal.z=cat.z*.85+.15;}
      goal.x=THREE.MathUtils.clamp(goal.x,-2.6,2.6);goal.z=THREE.MathUtils.clamp(goal.z,-2.5,2.3);
    }
    const phoneScale=.46*Math.min(1,width/360);
    const desiredHalf=fullHalf*(overview?1:phone?phoneScale:.8);
    const gain=first || snap || reducedMotion?1:1-Math.exp(-Math.min(delta,.1)*4.5);
    center.lerp(goal,gain);half+=(desiredHalf-half)*gain;first=false;
    const aspect=width/height;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
    camera.position.copy(center).add(OFFSET);camera.lookAt(center);camera.updateMatrixWorld();
    return {overview,zoom:fullHalf/half,center:center.clone()};
  }
  return {
    resize(w,h,pose={}){width=Math.max(1,w);height=Math.max(1,h);measure();update(0,{...pose,snap:true});},
    setOverview(value){overview=Boolean(value);},
    get overview(){return overview;},
    update,
  };
}
