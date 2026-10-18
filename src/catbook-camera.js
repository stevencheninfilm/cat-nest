// Small tap jitter, especially vertical movement, must not turn into a pan.
export const isYardPan=(dx,dy)=>Math.abs(dx)>=10 && Math.abs(dx)>Math.abs(dy);

// Keep a scene's horizontal framing as the mobile browser changes its usable height.
export function createYardCamera() {
  const positions=new Map();
  let frame=null;
  const bounds=camera=>({ width:camera.clientWidth, height:camera.clientHeight, worldWidth:camera.scrollWidth });
  const matches=(camera,size)=>frame?.camera === camera && ['width','height','worldWidth'].every(key=>frame[key] === size[key]);
  function remember(camera,sceneId) {
    if(!camera || !sceneId) return;
    // WebKit can retain a vertical offset after focus or elastic scrolling,
    // even though only the horizontal axis belongs to the map camera.
    if(camera.scrollTop!==0) camera.scrollTop=0;
    const size=bounds(camera);
    // A resize may clamp scrollLeft before ResizeObserver runs. Keep the last
    // deliberate position instead of treating that clamp as a new camera move.
    if(frame?.camera === camera && !matches(camera,size)) return;
    const range=size.worldWidth-size.width;
    if(range>0) positions.set(sceneId,Math.max(0,Math.min(1,camera.scrollLeft/range)));
  }
  function restore(camera,sceneId) {
    const size=bounds(camera);
    camera.scrollLeft=Math.max(0,size.worldWidth-size.width)*(positions.get(sceneId) ?? .5);
    camera.scrollTop=0;
    frame={camera,...size};
  }
  return {
    remember, restore,
    resize(camera,sceneId) {
      if(camera.scrollTop!==0) camera.scrollTop=0;
      if(matches(camera,bounds(camera))) return false;
      restore(camera,sceneId);
      return true;
    }
  };
}
