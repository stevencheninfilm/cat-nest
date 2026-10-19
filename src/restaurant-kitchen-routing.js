import { STAFF_REST_ROOM_ENTRANCE, STAFF_REST_ROOM_POSITION } from './restaurant-staff-training.js';

/** Version 4's floor network. Coordinates are employee foot positions. Each
 * workflow snapshots capacity so later expansion never changes its route. */
export const KITCHEN_ROUTE_LANES=Object.freeze({
  outboundX:47.5,returnX:54.5,doorY:65.5,corridorY:76,
  centralTopY:47,centralBottomY:57.6,
  outboundBypassX:61,returnBypassX:63,leftBranchX:35,
  restFrontX:90,
});
export const KITCHEN_ROW_AISLES=Object.freeze([40,52,64]);
const origin=Object.freeze({x:50,y:76});
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const point=(x,y)=>({x,y});
const compact=(from,points)=>points.filter((p,i)=>!same(p,i?points[i-1]:from)).map(p=>point(p.x,p.y));
const rowFor=seat=>seat===6?0:seat===7?2:Math.floor(seat/2);
const inDiningRoom=position=>position.y<KITCHEN_ROUTE_LANES.doorY;
const L=KITCHEN_ROUTE_LANES;

function roomExit(layoutCapacity){
  const points=[STAFF_REST_ROOM_ENTRANCE,point(L.restFrontX,47),point(L.restFrontX,52)];
  if(layoutCapacity===8)points.push(point(L.returnBypassX,52),point(L.returnBypassX,L.centralBottomY),point(L.returnX,L.centralBottomY));
  else points.push(point(L.returnX,52));
  return [...points,point(L.returnX,L.doorY),point(L.returnX,L.corridorY),origin];
}

/** Every rest-room departure re-enters through the kitchen doorway. Ordinary
 * station moves stay on the horizontal aisle inside the counters. */
export function kitchenStationPath(from,to,layoutCapacity=8){
  const points=[];
  if(inDiningRoom(from))points.push(...roomExit(layoutCapacity));
  else if(from.x===to.x)return compact(from,[to]);
  else points.push(point(from.x,L.corridorY));
  points.push(point(to.x,L.corridorY),to);
  return compact(from,points);
}

function kitchenOutbound(from,layoutCapacity){
  const points=inDiningRoom(from)?roomExit(layoutCapacity):[point(from.x,L.corridorY)];
  return [...points,point(L.outboundX,L.corridorY),point(L.outboundX,L.doorY)];
}

/** Approach the food drop-off from the aisle below its table. The middle
 * aisle has separate left/right branches around the central expansion table. */
export function kitchenDeliveryPath(from,table,seat,layoutCapacity=8){
  const row=rowFor(seat),aisle=KITCHEN_ROW_AISLES[row],points=kitchenOutbound(from,layoutCapacity);
  if(layoutCapacity===8&&row===0)points.push(point(L.outboundX,L.centralBottomY),point(L.outboundBypassX,L.centralBottomY),point(L.outboundBypassX,L.centralTopY),point(L.outboundX,L.centralTopY),point(L.outboundX,aisle));
  else if(layoutCapacity===8&&row===1){const branch=table.x<50?L.leftBranchX:L.outboundBypassX;points.push(point(L.outboundX,L.centralBottomY),point(branch,L.centralBottomY),point(branch,aisle));}
  else points.push(point(L.outboundX,aisle));
  points.push(point(table.x,aisle),table);
  return compact(from,points);
}

function tableReturn(table,seat,layoutCapacity){
  const row=rowFor(seat),aisle=KITCHEN_ROW_AISLES[row],points=[point(table.x,aisle)];
  if(layoutCapacity===8&&row===0)points.push(point(L.returnX,aisle),point(L.returnX,L.centralTopY),point(L.returnBypassX,L.centralTopY),point(L.returnBypassX,L.centralBottomY),point(L.returnX,L.centralBottomY));
  else if(layoutCapacity===8&&row===1){const branch=table.x<50?L.leftBranchX:L.returnBypassX;points.push(point(branch,aisle),point(branch,L.centralBottomY),point(L.returnX,L.centralBottomY));}
  else points.push(point(L.returnX,aisle));
  return points;
}

export function kitchenReturnPath(table,seat,layoutCapacity=8){
  return compact(table,[...tableReturn(table,seat,layoutCapacity),point(L.returnX,L.doorY),point(L.returnX,L.corridorY),origin]);
}

/** An exhausted server goes directly from the table to the rest room. A cook
 * leaving a station first crosses the kitchen doorway on the outbound lane. */
export function kitchenRestPath(from,seat,layoutCapacity=8){
  const points=[];
  if(inDiningRoom(from)){
    const row=rowFor(seat),aisle=KITCHEN_ROW_AISLES[row];
    points.push(point(from.x,aisle));
    if(layoutCapacity===8){
      if(row===0)points.push(point(L.returnX,aisle),point(L.returnX,L.centralTopY),point(L.returnBypassX,L.centralTopY),point(L.returnBypassX,52));
      else if(row===1&&from.x<50)points.push(point(L.leftBranchX,aisle),point(L.leftBranchX,L.centralBottomY),point(L.returnBypassX,L.centralBottomY),point(L.returnBypassX,52));
      else if(row===2)points.push(point(L.returnX,aisle),point(L.returnX,L.centralBottomY),point(L.returnBypassX,L.centralBottomY),point(L.returnBypassX,52));
    }else if(row!==1)points.push(point(L.returnX,aisle),point(L.returnX,52));
  }else{
    points.push(...kitchenOutbound(from,layoutCapacity));
    if(layoutCapacity===8)points.push(point(L.outboundX,L.centralBottomY),point(L.outboundBypassX,L.centralBottomY),point(L.outboundBypassX,52));
    else points.push(point(L.outboundX,52));
  }
  points.push(point(L.restFrontX,52),point(L.restFrontX,47),STAFF_REST_ROOM_ENTRANCE,STAFF_REST_ROOM_POSITION);
  return compact(from,points);
}
