/** Keep taps separate from drags, including when the 3D model is still loading. */
export function bindCatGestures({cat,canInteract,onTap,onStart=()=>{},consumeModelTap=()=>false,view=window}) {
  let pointer=null,suppressClick=false;
  const disposers=[];
  const listen=(node,type,handler,options)=>{
    node.addEventListener(type,handler,options);
    disposers.push(()=>node.removeEventListener(type,handler,options));
  };
  function track(event) {
    if(!pointer||pointer.id!==event.pointerId)return null;
    if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>8)pointer.moved=true;
    return pointer;
  }
  function finish(event,cancelled=false) {
    const current=event ? track(event) : pointer;
    if(!current)return;
    pointer=null;
    suppressClick=current.moved||cancelled;
    cat.classList.remove('is-rotating');
    try{if(cat.hasPointerCapture?.(current.id))cat.releasePointerCapture(current.id);}catch{}
  }
  listen(cat,'pointerdown',event=>{
    if(event.button!==0)return;
    if(pointer){if(pointer.id!==event.pointerId)pointer.moved=true;return;}
    if(event.isPrimary===false){suppressClick=true;return;}
    suppressClick=!canInteract();
    if(suppressClick)return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    try{cat.setPointerCapture?.(event.pointerId);}catch{}
    onStart();
  });
  listen(cat,'pointermove',event=>{
    if(!track(event)?.moved)return;
    event.preventDefault();cat.classList.add('is-rotating');
  },{passive:false});
  listen(cat,'pointerup',event=>finish(event));
  listen(cat,'pointercancel',event=>finish(event,true));
  listen(cat,'lostpointercapture',event=>finish(event,true));
  listen(cat,'contextmenu',()=>finish(null,true));
  listen(view,'pointerup',event=>finish(event,true));
  listen(view,'pointercancel',event=>finish(event,true));
  listen(view,'blur',()=>finish(null,true));
  listen(view,'pagehide',()=>finish(null,true));
  listen(cat,'click',event=>{
    event.stopPropagation();
    const modelDragged=consumeModelTap();
    if(event.detail!==0&&(suppressClick||modelDragged)){event.preventDefault();return;}
    if(canInteract())onTap();
  },true);
  return ()=>{finish(null,true);for(const dispose of disposers)dispose();};
}
