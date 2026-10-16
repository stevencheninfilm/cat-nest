/** Shared progression gates. Viewing a feature never creates or resets data. */
export const FEATURE_UNLOCKS=Object.freeze({
  collection:Object.freeze({level:2,name:'猫猫图鉴'}),
  diary:Object.freeze({level:3,name:'猫猫日记'}),
  expressions:Object.freeze({level:4,name:'小猫表情'}),
  actions:Object.freeze({level:6,name:'小猫动作'}),
});
export function isFeatureUnlocked(feature,level) {
  return Object.hasOwn(FEATURE_UNLOCKS,feature)&&Number.isFinite(level)&&level>=FEATURE_UNLOCKS[feature].level;
}
export function featureUnlockMessage(feature) {
  const rule=Object.hasOwn(FEATURE_UNLOCKS,feature)?FEATURE_UNLOCKS[feature]:null;return rule?`${rule.name}在 Lv.${rule.level} 解锁`:'功能尚未开放';
}
export function featureStatus(feature,{level=1,confirmedLevel=1,cloud=false,ready=true}={}) {
  const rule=Object.hasOwn(FEATURE_UNLOCKS,feature)?FEATURE_UNLOCKS[feature]:null;
  return {...rule,unlocked:ready&&isFeatureUnlocked(feature,cloud?confirmedLevel:level),message:ready?featureUnlockMessage(feature):'正在读取小窝，确认成长等级后即可使用'};
}
