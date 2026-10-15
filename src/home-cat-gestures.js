/** A completed stroke is one care intent, independent of pointer event count. */
export function createCatStroke(){
  let pointer=null;
  return {
    begin({id,x,y,at,primary=true}){if(pointer||!primary)return false;pointer={id,x,y,at,distance:0};return true;},
    move({id,x,y}){if(pointer?.id!==id)return null;pointer.distance+=Math.hypot(x-pointer.x,y-pointer.y);pointer.x=x;pointer.y=y;return {distance:pointer.distance};},
    end({id,cancelled=false}){if(pointer?.id!==id)return null;const p=pointer;pointer=null;return {moved:p.distance>8,stroke:!cancelled&&p.distance>=26};},
    cancel(){pointer=null;},
  };
}
