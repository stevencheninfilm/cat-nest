import { levelInfo } from './state.js';
import { GROWTH_STAGES, growthStageForXp, growthStageProgress, getGrowthStageById, stageRange, stageStyle } from './growth-stages.js';
import { jellyHeartMarkup } from './growth-ui.js';

function stageArtwork(stage, locked) {
  return `${jellyHeartMarkup(stage)}${locked ? '<span class="stage-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10V7a4 4 0 0 1 8 0v3"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></svg></span>' : ''}`;
}

const number = value => value.toLocaleString('zh-CN');
function percentage(progress) {
  // Do not round an unfinished stage up to 100%.
  const value = Math.floor(progress.ratio * 10_000) / 100;
  return value === 0 && progress.ratio > 0 ? '不足0.01%' : `${number(value)}%`;
}
function growthMeter(progress, className, label = `${progress.stage.name}阶段成长进度`) {
  const value = progress.target === null ? progress.ratio * 100 : progress.earned;
  return `<span class="${className} stage-meter" role="progressbar" aria-label="${label}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${progress.target ?? 100}"><span class="stage-bar-fill" style="width:${progress.ratio * 100}%" ${progress.ratio === 0 ? 'hidden' : ''}></span></span>`;
}
function growthCount(progress) {
  return progress.target === null ? (progress.locked ? '待解锁' : '全部解锁') : `${number(progress.earned)} / ${number(progress.target)}`;
}
function stageHint(progress) {
  if (progress.locked) return `再积攒 ${number(progress.unlockRemaining)} 点成长，解锁此阶段`;
  if (progress.next && progress.remaining > 0) return `再积攒 ${number(progress.remaining)} 点成长，Lv.${progress.next.min} 解锁${progress.next.name}`;
  return progress.next ? '此阶段已完成，下一种爱心已解锁' : '全部材质已解锁，继续陪伴，等级仍会成长';
}

function stageCard(stage, xp, current, preview) {
  const progress = growthStageProgress(xp, stage);
  const isCurrent = stage.id === current.id;
  return `<button class="stage-card ${progress.locked ? 'is-locked' : ''} ${stage.id === preview.id ? 'selected' : ''} ${isCurrent ? 'current' : ''}" style="${stageStyle(stage)}" data-stage-preview="${stage.id}" aria-label="预览${stage.name}，${stageRange(stage)}${isCurrent ? '，当前阶段' : progress.locked ? '，待解锁' : ''}" aria-pressed="${stage.id === preview.id}"><span class="stage-card-state">${isCurrent ? '当前' : progress.locked ? '待解锁' : '已解锁'}</span><span class="stage-card-art">${stageArtwork(stage, progress.locked)}</span><strong>${stage.name}</strong><small>${stageRange(stage)}</small>${growthMeter(progress, 'stage-card-bar')}<span class="stage-card-progress"><b>${percentage(progress)}</b><small>${growthCount(progress)}</small></span></button>`;
}

function progressMarkup(xp) {
  const level = levelInfo(xp);
  const stage = growthStageForXp(xp);
  const progress = growthStageProgress(xp, stage);
  return `<div class="stage-current-progress" style="${stageStyle(stage)}"><div class="stage-progress-caption"><strong>当前 Lv.${level.level} · ${stage.name}</strong><span>${percentage(progress)}</span></div>${growthMeter(progress, 'stage-progress-track', '当前阶段成长进度')}<div class="stage-progress-detail"><span>${growthCount(progress)}${progress.target === null ? '' : ' 成长'}</span><span>本级 ${number(level.progress)} / ${number(level.target)}</span></div><small>${stageHint(progress)}</small></div>`;
}

export function growthStagesPanel(xp, previewId = growthStageForXp(xp).id) {
  const level = levelInfo(xp), current = growthStageForXp(xp), preview = getGrowthStageById(previewId);
  const isCurrent = preview.id === current.id;
  const previewLocked = level.level < preview.min;
  const previewProgress = growthStageProgress(xp, preview);
  const status = isCurrent ? '正在使用' : level.level >= preview.min ? '已走过的阶段' : `Lv.${preview.min} 解锁`;
  return `<div class="stage-heading"><span class="eyebrow">A HEART THAT GROWS WITH YOU</span><h2>每一程，都更闪亮</h2><p>陪伴慢慢积攒，爱心每十级焕新。</p></div>${progressMarkup(xp)}<section class="stage-preview ${previewLocked ? 'is-locked' : ''}" tabindex="-1" style="${stageStyle(preview)}" aria-label="${preview.name}材质预览"><div class="stage-preview-art">${stageArtwork(preview, previewLocked)}</div><div class="stage-preview-copy"><span class="stage-preview-tag">${isCurrent ? '当前材质' : '材质预览'} · ${stageRange(preview)}</span><h3>${preview.name}</h3><p>${preview.description}</p><span class="stage-preview-status">${status}</span></div><div class="stage-preview-progress">${growthMeter(previewProgress, 'stage-preview-bar')}<div class="stage-preview-progress-caption"><span>${percentage(previewProgress)}</span><span>${growthCount(previewProgress)}</span></div></div></section><div class="stage-grid" role="group" aria-label="全部成长阶段">${GROWTH_STAGES.map(stage => stageCard(stage, xp, current, preview)).join('')}</div><p class="stage-preview-note">点击查看材质 · 实际外观随等级自动升级</p><button class="stage-guide-link" data-open="guide">查看成长获取方式 <span>›</span></button>`;
}

export function growthUpgradePanel(upgrade, xp) {
  return `<div class="stage-upgrade" style="${stageStyle(upgrade.to)}"><span class="eyebrow">A LITTLE LOVE, A NEW SHINE</span><h2>爱心焕新啦</h2><p>每一次陪伴，都让小心意更闪亮。</p><div class="stage-upgrade-art"><span class="stage-upgrade-before" style="${stageStyle(upgrade.from)}">${jellyHeartMarkup(upgrade.from)}</span><span class="stage-upgrade-arrow" aria-hidden="true">✦</span><span class="stage-upgrade-after">${jellyHeartMarkup(upgrade.to)}</span></div><span class="stage-upgrade-level">Lv.${upgrade.level} · 新阶段</span><h3>${upgrade.to.name}</h3><p>${upgrade.to.description}</p>${progressMarkup(xp)}<button class="stage-upgrade-primary" data-close>继续陪伴 ♡</button><button class="stage-guide-link" data-open="stages">查看全部成长阶段 <span>›</span></button></div>`;
}
