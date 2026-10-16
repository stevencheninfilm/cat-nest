import {FEATURE_UNLOCKS,featureUnlockMessage} from './feature-unlocks.js';

export function featureLockPanel(feature) {
  const rule=Object.hasOwn(FEATURE_UNLOCKS,feature)?FEATURE_UNLOCKS[feature]:null;
  if(!rule)return '';
  return `<div class="feature-lock-card" role="status"><span aria-hidden="true">🔒</span><strong>${featureUnlockMessage(feature)}</strong><p>喂食、互动后收下成长爱心，陪小猫慢慢长大吧。</p>${feature==='diary'?'<small>成长记录会一直保留，解锁后就能看到。</small>':''}</div>`;
}
export function updateFeatureEntry(button,status,label) {
  if(!button)return;
  button.classList.toggle('is-level-locked',!status.unlocked);
  button.setAttribute('aria-disabled',String(!status.unlocked));
  button.setAttribute('aria-label',status.unlocked?label:`${label}，${status.message}`);
  button.title=status.unlocked?label:status.message;
  let badge=button.querySelector('[data-feature-lock-badge]');
  if(!badge){badge=button.ownerDocument.createElement('em');badge.className='feature-lock-badge';badge.dataset.featureLockBadge='';badge.setAttribute('aria-hidden','true');button.append(badge);}
  const text=`Lv.${status.level} 解锁`;if(badge.textContent!==text)badge.textContent=text;
  badge.hidden=status.unlocked;
}
