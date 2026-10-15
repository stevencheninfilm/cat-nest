/** Server startup has no measurable percentage. Show the actual lifecycle
 * stage with an indeterminate bar, then dismiss only when both are ready. */
export function homeLoadingState({ entered=false, configured=false, phase='solo', snapshotReady=false, modelPhase='loading' }={}) {
  if (!entered) return null;
  if (configured && phase !== 'online') {
    if (phase === 'error' || phase === 'full') return {
      state:'error', retry:true,
      title:phase === 'full' ? '小窝暂时满员' : '小窝暂时没连上',
      detail:phase === 'full' ? '已有两位猫友在线，请稍后再连接。' : '服务器暂时没有响应，原存档会保留。',
    };
    if (phase === 'offline') return { state:'connecting', title:'正在恢复连接…', detail:'已保存的进度仍然保留，正在重新连接。', retry:true };
    return snapshotReady
      ? { state:'syncing', title:'正在同步小窝…', detail:'存档已读取，正在建立实时连接。' }
      : { state:'connecting', title:'正在连接小窝…', detail:'正在唤醒服务器并读取存档，首次连接可能需要约一分钟。' };
  }
  if (configured && !snapshotReady) return { state:'syncing', title:'正在读取小窝…', detail:'正在同步你们保存的成长和照顾记录。' };
  if (modelPhase === 'loading') return { state:'model', title:'小猫正在回家…', detail:'正在准备小猫的模型与装扮。' };
  return null;
}

export function homeLoadingMarkup() {
  return `<section class="home-loading" id="home-loading" role="status" aria-live="polite" aria-atomic="true" hidden>
    <span class="home-loading-icon" aria-hidden="true">⌛</span>
    <strong class="home-loading-title"></strong><p class="home-loading-detail"></p>
    <div class="home-loading-track" role="progressbar" aria-label="小窝加载进度"><i aria-hidden="true"></i></div>
    <button type="button" class="home-loading-retry" data-home-loading-retry hidden>重新连接</button>
  </section>`;
}

export function updateHomeLoading(element, options) {
  const loading = homeLoadingState(options);
  element.hidden = !loading;
  element.closest('.scene')?.classList.toggle('is-home-loading', Boolean(loading));
  if (!loading) return;
  element.dataset.state = loading.state;
  const setText = (selector, value) => {
    const node = element.querySelector(selector);
    if (node.textContent !== value) node.textContent = value;
  };
  setText('.home-loading-icon', loading.state === 'error' ? '☁' : '⌛');
  setText('.home-loading-title', loading.title);
  setText('.home-loading-detail', loading.detail);
  const track = element.querySelector('.home-loading-track');
  track.hidden = loading.state === 'error';
  if (track.getAttribute('aria-valuetext') !== loading.title) track.setAttribute('aria-valuetext', loading.title);
  element.querySelector('.home-loading-retry').hidden = !loading.retry;
}
