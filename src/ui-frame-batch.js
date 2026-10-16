/** State/queue updates remain synchronous; paint each group once per frame. */
export function createUiFrameBatch(paint,{request=requestAnimationFrame,cancel=cancelAnimationFrame}={}) {
  let frame=0,flags=new Set(),effects=[];
  function flush(){
    if(frame)cancel(frame);frame=0;
    if(!flags.size&&!effects.length)return;
    const next=flags,after=effects;flags=new Set();effects=[];
    paint(next);for(const effect of after)effect();
  }
  function schedule(){if(!frame)frame=request(flush);}
  return {request(kind){flags.add(kind);schedule();},afterPaint(effect){effects.push(effect);schedule();},flush,
    cancel(){if(frame)cancel(frame);frame=0;flags.clear();effects=[];}};
}
