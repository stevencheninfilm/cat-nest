/** Own only gestures that begin on the invitation card; never pan the yard underneath. */
export function createInvitationSwipe({container,canSwipe,onStep}) {
  let gesture=null,suppressClick=false;
  function release() {
    const previous=gesture;
    gesture=null;
    if(previous?.captured) {
      try { previous.card.releasePointerCapture(previous.id); } catch { /* A redraw can remove the card first. */ }
    }
  }
  const consume=event=>{if(event.cancelable) event.preventDefault();event.stopImmediatePropagation();};
  container.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(gesture) { release();suppressClick=true;return; }
    const card=event.target.closest('[data-book-invitation-carousel]');
    if(!card || event.button!==0 || !event.isPrimary || !canSwipe()) return;
    gesture={card,id:event.pointerId,x:event.clientX,y:event.clientY,axis:null,moved:false,captured:false};
  });
  container.addEventListener('pointermove',event=>{
    if(!gesture || gesture.id!==event.pointerId) return;
    if(!gesture.card.isConnected || !canSwipe()) { release();return; }
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.hypot(dx,dy)<12) return;
    gesture.moved=true;
    if(!gesture.axis) {
      if(Math.abs(dx)>Math.abs(dy)*1.25) gesture.axis='horizontal';
      else if(Math.abs(dy)>Math.abs(dx)) gesture.axis='vertical';
    }
    if(!gesture.captured) {
      gesture.card.setPointerCapture(event.pointerId);gesture.captured=true;
    }
    consume(event);
  },true);
  container.addEventListener('pointerup',event=>{
    if(!gesture || gesture.id!==event.pointerId) return;
    const previous=gesture,dx=event.clientX-previous.x,dy=event.clientY-previous.y;
    const moved=previous.moved || Math.hypot(dx,dy)>=12;
    const step=previous.axis!=='vertical' && Math.abs(dx)>=36 && Math.abs(dx)>Math.abs(dy)*1.25 ? dx<0 ? 1 : -1 : 0;
    release();
    if(moved) { suppressClick=true;consume(event); }
    if(step && previous.card.isConnected && canSwipe()) onStep(step);
  },true);
  container.addEventListener('pointercancel',event=>{
    if(gesture?.id!==event.pointerId) return;
    release();suppressClick=true;
  },true);
  container.addEventListener('lostpointercapture',event=>{
    if(gesture?.id===event.pointerId) { release();suppressClick=true; }
  },true);
  container.addEventListener('click',event=>{
    if(!suppressClick || event.detail===0) return;
    suppressClick=false;consume(event);
  },true);
  return {cancel() {if(gesture?.moved)suppressClick=true;release();}};
}
