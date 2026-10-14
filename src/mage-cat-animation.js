/** Keep the author's clip names intact; pet actions use appropriate existing clips. */
export function clipKey(name) { return String(name).split('|').at(-1).replace(/\s+/g,'_').toLowerCase(); }
export function chooseMageClip(type, sleeping, available) {
  const keys=new Set(available.map(clipKey));
  const preferred=type==='play' ? ['special_attack','run','idle'] : ['idle'];
  return preferred.find(key=>keys.has(key)) || null;
}
export function mageExpression(type, sleeping, phase = 0) {
  if(sleeping)return {eyes:'closed',mouth:'basic'};
  if(type==='pet' && phase<1)return {eyes:'happy',mouth:'happy'};
  if(type==='feed' && phase<1)return {eyes:'excited',mouth:'happy'};
  if(type==='play' && phase<1)return {eyes:'excited',mouth:'happy'};
  return {eyes:'basic',mouth:'basic'};
}
export const MAGE_REACTION_SECONDS = {pet:2.6,feed:2.8,play:2.9};

/** Keep facial planes, skin and clothing on the author's rig; animate only its outer group. */
export function advanceMagePose(mixer, pivot, delta, {sleeping=false,reaction='',reactionTime=0,elapsed=0,yaw=0,reducedMotion=false}={}) {
  mixer.update(delta);
  const duration=MAGE_REACTION_SECONDS[reaction] || 0;
  const strength=duration && reactionTime<duration ? Math.sin(Math.PI*reactionTime/duration) : 0;
  const gain=reducedMotion?.25:1;
  pivot.position.y=reaction==='feed' && !sleeping ? Math.sin(reactionTime*9)**2*.025*strength*gain : 0;
  pivot.rotation.y=yaw+(reaction==='pet' && !sleeping ? Math.sin(reactionTime*4)*.055*strength*gain : 0);
  pivot.rotation.z=0;
  const breath=sleeping ? 1+Math.sin(elapsed*1.2)*.003*gain : 1;
  pivot.scale.setScalar(breath);
}
