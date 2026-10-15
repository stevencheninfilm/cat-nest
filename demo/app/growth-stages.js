import { levelInfo, levelStartXp } from './state.js';

// Skins are derived from saved XP. Previewing one never changes the save.
export const GROWTH_STAGES = Object.freeze([
  { id:'jelly', name:'橙色果冻', min:1, max:10, material:'jelly', color:'#ff9000', light:'#ffe59a', deep:'#d95408', edge:'#ffbb45', glow:'#ffc34f', saturation:1.65, description:'软乎乎的橙色果冻，圆润饱满，藏着最初的温暖。' },
  { id:'candy', name:'镭射糖果', min:11, max:20, material:'candy', color:'#e995d6', light:'#fff0c8', deep:'#9653b4', edge:'#c9a5f8', glow:'#e9afff', saturation:1.15, description:'糖衣映出粉紫、浅金与薄荷色的虹光，每个角度都闪亮。' },
  { id:'crystal', name:'透明水晶', min:21, max:30, material:'crystal', color:'#ecd5c1', light:'#ffffff', deep:'#a18d80', edge:'#f5e6d9', glow:'#ffe4cd', saturation:1.05, description:'清透水晶带着微暖折光，饱满的晶面映出细细虹彩。' },
  { id:'amber', name:'蜜糖琥珀', min:31, max:40, material:'amber', color:'#eaa127', light:'#fff0a9', deep:'#9c4b09', edge:'#e8b655', glow:'#ffd36e', saturation:1.3, description:'澄澈的蜜糖琥珀，浓郁金橙色里透出温润的光。' },
  { id:'gold-amber', name:'金箔蜜糖琥珀', min:41, max:50, material:'gold-amber', color:'#eead29', light:'#fff6c4', deep:'#a55b0b', edge:'#f2d177', glow:'#ffe697', saturation:1.3, description:'细碎金箔封存在琥珀中，点点金光随着转动浮现。' },
  { id:'ruby', name:'红宝石', min:51, max:60, material:'ruby', color:'#d91745', light:'#ffc2d2', deep:'#8d123b', edge:'#e5ba69', glow:'#ff90ad', saturation:1.3, description:'深红宝石切出明亮晶面，以细金边珍藏每一份陪伴。' },
  { id:'sapphire', name:'蓝宝石', min:61, max:70, material:'sapphire', color:'#4f88e8', light:'#cdeaff', deep:'#23459f', edge:'#c8d9f4', glow:'#99cbff', saturation:1.2, description:'深蓝宝石映着冰色高光，银色镶边让轮廓更精致。' },
  { id:'opal', name:'星云欧泊', min:71, max:80, material:'opal', color:'#a58ce9', light:'#f3e5ff', deep:'#604296', edge:'#e9c5f8', glow:'#ccacff', saturation:1.2, description:'紫色星云流动着蓝绿变彩，细小星屑藏在圆润的心里。' },
  { id:'diamond', name:'钻石鎏金', min:81, max:Infinity, material:'diamond', color:'#e5c979', light:'#fff8dc', deep:'#9b7631', edge:'#e8c36a', glow:'#fff2b8', saturation:1, description:'通透钻石、细金镶边与璀璨折光，收藏一路走来的爱。' },
].map(stage => Object.freeze(stage)));

export function getGrowthStage(level = 1) {
  const safe = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return GROWTH_STAGES.find(stage => safe <= stage.max) || GROWTH_STAGES.at(-1);
}

export function getGrowthStageById(id) {
  return GROWTH_STAGES.find(stage => stage.id === id) || GROWTH_STAGES[0];
}

export function growthStageForXp(xp) { return getGrowthStage(levelInfo(xp).level); }

/** A stage spans the XP between its first level and the next skin's first level.
 * Only confirmed XP is counted; future stages stay empty and past ones stay full.
 */
export function growthStageProgress(xp, stage = growthStageForXp(xp)) {
  const level = levelInfo(xp);
  const totalXp = levelStartXp(level.level) + level.progress;
  const start = levelStartXp(stage.min);
  const next = GROWTH_STAGES[GROWTH_STAGES.indexOf(stage) + 1] || null;
  const target = next ? levelStartXp(next.min) - start : null;
  const rawEarned = target === null ? Math.max(0, totalXp - start) : Math.min(target, Math.max(0, totalXp - start));
  const earned = Number.isInteger(rawEarned) ? rawEarned : Math.round(rawEarned * 10) / 10;
  const locked = totalXp < start;
  // The final skin has no further unlock target; show its unlocked state in full.
  const ratio = target === null ? (locked ? 0 : 1) : earned / target;
  return { stage, next, earned, target, ratio, locked,
    remaining:target === null ? 0 : Math.round((target - earned) * 10) / 10,
    unlockRemaining:Math.max(0, Math.round((start - totalXp) * 10) / 10),
  };
}

export function stageRange(stage) { return stage.max === Infinity ? `${stage.min} 级起` : `${stage.min}–${stage.max} 级`; }
export function stageStyle(stage) {
  const fill = stage.id === 'candy' ? 'linear-gradient(110deg,#f9d49b,#edb4dd 37%,#c49ce8 67%,#9edbd9)' : stage.id === 'opal' ? 'linear-gradient(110deg,#cda1f5,#a7c8fa 34%,#a788de 60%,#efb3d9)' : `linear-gradient(180deg,${stage.light},${stage.color} 44%,${stage.deep})`;
  return `--growth-color:${stage.color};--growth-light:${stage.light};--growth-deep:${stage.deep};--growth-edge:${stage.edge};--growth-glow:${stage.glow};--heart-saturation:${stage.saturation};--growth-fill:${fill};--growth-texture:url(${new URL(`./assets/growth-bars/v1/${stage.id}.webp`, import.meta.url).href})`;
}

/** Only a confirmed XP increase across a boundary produces a celebration. */
export function growthUpgrade(previousXp, nextXp) {
  const from = growthStageForXp(previousXp), to = growthStageForXp(nextXp);
  return to.min > from.min ? { from, to, level:levelInfo(nextXp).level } : null;
}
