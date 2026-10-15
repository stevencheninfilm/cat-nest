/** Expand the drawing area while keeping every original cat pixel in the same place. */
export function catStageFrame({width,height,halfHeight,roomWidth=width,roomHeight=height,offsetX=0,offsetY=0,expanded=false}) {
  const unit=2*halfHeight/height,cat={left:-width*unit/2,right:width*unit/2,top:halfHeight,bottom:-halfHeight};
  return {cat,unit,expanded,width:expanded?roomWidth:width,height:expanded?roomHeight:height,
    left:cat.left-(expanded?offsetX*unit:0),right:cat.right+(expanded?(roomWidth-offsetX-width)*unit:0),
    top:cat.top+(expanded?offsetY*unit:0),bottom:cat.bottom-(expanded?(roomHeight-offsetY-height)*unit:0),
    offsetX:expanded?offsetX:0,offsetY:expanded?offsetY:0};
}
/** Turn around the actual feet, rather than orbiting the asset's off-centre origin. */
export function catStageOffset(anchor,yaw,facing,offset,currentAnchor=anchor) {
  const rotated=(point,angle)=>({x:point.x*Math.cos(angle)+point.z*Math.sin(angle),z:-point.x*Math.sin(angle)+point.z*Math.cos(angle)});
  const before=rotated(anchor,yaw),after=rotated(currentAnchor,facing);
  return {x:offset.x+before.x-after.x,z:offset.z+before.z-after.z};
}
