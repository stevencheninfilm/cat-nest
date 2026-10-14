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
