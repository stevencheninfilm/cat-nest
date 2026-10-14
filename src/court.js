import './court.css';
import { verdictDisplay } from './court-verdict-display.js';
import { verdictCards } from './court-verdict-cards.js';

const API = `${(import.meta.env.VITE_COURT_API_URL || '').replace(/\/$/, '')}/api/court`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paths = {
  paw: '<circle cx="7.5" cy="8" r="2"/><circle cx="16.5" cy="8" r="2"/><circle cx="3.5" cy="13" r="1.5"/><circle cx="20.5" cy="13" r="1.5"/><path d="M8 13c-1 2-3 3-3 5 0 3 4 3 7 1 3 2 7 2 7-1 0-2-2-3-3-5-2-3-6-3-8 0Z"/>',
  gavel: '<path d="m14 3 7 7m-9-5 7 7M8 9l7 7m-9-5 7 7m-3-6 6-6M2 22l8-8M15 22h7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow: '<path d="M19 12H5m7-7-7 7 7 7"/>',
  next: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5-7 7-3-3-3 3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.paw}</svg>`;
const roleLabel = role => role === 'a' ? '猫爪方' : '鱼干方';
const otherRole = role => role === 'a' ? 'b' : 'a';
const storedSession = id => { try { return JSON.parse(sessionStorage.getItem(`catcourt.session.${id}`)); } catch { return null; } };
function safeImage(value) { return /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(value || '') ? value : ''; }
function verdictMarkup(value) {
  return esc(value).split('\n').map(line => {
    const content = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (/^#{1,4}\s/.test(content)) return `<h4>${content.replace(/^#{1,4}\s+/, '')}</h4>`;
    if (/^[-*]\s/.test(content)) return `<p class="court-verdict-bullet">${content.replace(/^[-*]\s+/, '')}</p>`;
    return line.trim() ? `<p>${content}</p>` : '<div class="court-paragraph-gap"></div>';
  }).join('');
}
const textValue = value => typeof value === 'string' ? value : '';
const textItems = value => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : textValue(value).trim() ? [value] : [];
const paragraphMarkup = value => textItems(value).map(item => `<p>${esc(item).replace(/\n/g, '<br>')}</p>`).join('');

export function createCourt({ container, onBack, toast = () => {}, profileName = '铲屎官', modelAssetBase, getPetAppearance = () => undefined, previewRoom }) {
  const readOnlyPreview = Boolean(import.meta.env.DEV && previewRoom);
  let active = false, room = null, session = null, config = null, configFailed = false;
  let polling = false, busy = false, uploading = false, selectedRole = 'a', appealMode = false;
  let images = [], pollTimer, presenceTimer, typingTimer, lastTypedAt = 0;
  let evidenceTrigger = null;
  let lastHistory = '', lastParty = '', draftRound = '', selectedRoom = '';
  const drafts = new Map();
  const resultViews = new Map();
  const repairBusy = new Set();
  const announcedRounds = new Set();
  let judgeModel, judgeLoading, destroyed = false;
  const $ = selector => container.querySelector(selector);
  container.classList.add('cat-court');
  container.hidden = true;
  container.innerHTML = `
    <div class="court-shell">
      <header class="court-topbar">
        <button class="court-back" type="button" data-court="back">${icon('arrow')}<span>回到小窝</span></button>
        <a class="court-brand" href="#" data-court="top"><span>${icon('paw')}</span><div>猫猫判官<small>A LITTLE COURT OF LOVE</small></div></a>
        <span class="court-connection" id="court-connection" role="status"><i></i>连接中</span>
      </header>
      <section class="court-hero" aria-labelledby="court-title">
        <div class="court-hero-copy"><span class="court-eyebrow">温柔开庭 · 好好说话</span><h1 id="court-title">把事情说清楚，<br>把约定留下来<span>。</span></h1><p>公正一点，温柔一点。<br class="court-mobile-break">让猫猫陪你们找到问题，也找到下一步的办法。</p><span class="court-hero-note">${icon('heart')} 每个人的感受与边界，都值得被认真听见</span></div>
        <section class="court-bench-stage" id="court-bench-stage" data-ruling="waiting" aria-labelledby="court-bench-title"><div class="court-bench-meta"><span class="court-bench-kicker" id="court-bench-kicker">温柔开庭 · 听取双方陈词</span></div><div class="court-bench-art"><h2 id="court-bench-title">猫猫在听</h2></div><p class="court-bench-caption" id="court-bench-caption" role="status">两边的话，猫猫都会认真听喵。</p><div class="court-bench-dock"><div class="court-bench-dock-copy"><span class="court-bench-plaque">糯米大人 · 公正有据</span><button type="button" class="court-bench-replay" id="court-bench-replay" data-court="announce" data-announce-round="" hidden>${icon('gavel')}敲槌宣读</button><span class="court-bench-welcome" id="court-bench-welcome">先把经过慢慢说清楚。</span></div><div class="court-judge-model" id="court-judge-model" role="img" aria-label="主页同款猫猫判官与立体法槌"><span class="court-model-fallback">${icon('paw')}<small id="court-model-status">猫猫正在入席…</small></span></div></div></section>
      </section>
      <div class="court-notice" id="court-notice" hidden role="alert"></div>
      <section class="court-lobby" id="court-lobby" aria-label="发起或加入小法庭">
        <div class="court-start-card court-paper"><span class="court-section-kicker">给关系一个好好说话的地方</span><h2>今天，想一起聊聊什么？</h2><p class="court-description">你们各自陈词、提交截图。双方准备好后，<br>猫猫才会开庭，给出有依据的责任分析与修复建议。</p>
          <form id="court-create-form"><label for="court-topic">这次分歧的主题 <span>选填</span></label><input id="court-topic" name="title" maxlength="80" placeholder="给这次对话起个小标题" autocomplete="off"><button class="court-primary" id="court-create" type="submit">${icon('gavel')} 发起审理 ${icon('next')}</button></form>
          <div class="court-join"><span>已经收到对方的邀请？</span><button type="button" class="court-link" data-court="toggle-join">加入小法庭 ${icon('next')}</button></div>
          <form id="court-join-form" hidden><label for="court-join-code">邀请链接或法庭编号</label><div class="court-input-row"><input id="court-join-code" name="code" required autocomplete="off" placeholder="粘贴邀请链接或输入编号"><button type="submit" class="court-secondary">加入</button></div></form>
        </div>
        <aside class="court-how"><span class="court-section-kicker">小法庭的三个约定</span><div class="court-how-item"><span>01</span><div><h3>两个人，都有自己的席位</h3><p>选择身份，邀请对方入席。<br>不打断，也不替对方下定义。</p></div></div><div class="court-how-item"><span>02</span><div><h3>把事情讲清楚，把证据放上来</h3><p>陈述经过与感受，附上聊天截图。<br>双方提交后，一起等猫猫开庭。</p></div></div><div class="court-how-item"><span>03</span><div><h3>评责任，也给彼此留台阶</h3><p>有异议可以补充证词，继续审理。<br>比输赢更重要的，是下次怎么做。</p></div></div><span class="court-how-sign">认真听你说话的猫猫 ${icon('paw')}</span></aside>
      </section>
      <section id="court-room" class="court-room" hidden aria-label="双人小法庭">
        <div class="court-case-heading"><div><span class="court-section-kicker">你们的小法庭 <span id="court-case-number"></span></span><h2 id="court-case-title"></h2></div><button class="court-secondary court-share" type="button" data-court="share">${icon('copy')} 邀请对方入席</button></div>
        <div class="court-share-fallback" id="court-share-fallback" hidden><label for="court-share-url">邀请链接 · 长按或选中复制</label><input id="court-share-url" readonly></div>
        <div class="court-steps" aria-label="审理进度"><span data-step="1"><i>1</i>双方入席</span><b></b><span data-step="2"><i>2</i>各自陈词</span><b></b><span data-step="3"><i>3</i>猫猫评理</span></div>
        <div class="court-parties" id="court-parties"></div>
        <div class="court-case-grid">
          <div class="court-workspace">
            <section class="court-paper court-claim" id="court-claim"><span class="court-section-kicker">先选一个属于你的席位</span><h3>猫猫该怎么称呼你？</h3><p>同一个邀请链接，两个人各选一方。陈词提交后，会自动等待另一方。</p><form id="court-claim-form"><label for="court-your-name">你的昵称</label><input id="court-your-name" name="name" maxlength="30" required value="${esc(typeof profileName === 'function' ? profileName() : profileName)}" autocomplete="nickname"><div class="court-role-options"><button type="button" data-court-role="a" class="selected" aria-pressed="true">${icon('paw')} 我是猫爪方</button><button type="button" data-court-role="b" aria-pressed="false"><span aria-hidden="true">◈</span> 我是鱼干方</button></div><button id="court-claim-button" class="court-primary" type="submit">认领席位，开始陈词 ${icon('next')}</button></form><p id="court-claim-note" class="court-small"></p></section>
            <section class="court-paper court-composer" id="court-composer" hidden><div class="court-panel-heading"><div><span class="court-section-kicker" id="court-composer-kicker">轮到你说说啦</span><h3 id="court-composer-title">你的陈词</h3></div><span class="court-round-badge" id="court-round-badge">第 1 轮</span></div><form id="court-statement-form"><label for="court-statement" id="court-statement-label">发生了什么？你当时的感受和期待是什么？</label><textarea id="court-statement" name="statement" maxlength="12000" rows="7" placeholder="可以按事情的经过慢慢说。猫猫会区分事实、感受和推测，也会认真看你提供的证据。" required></textarea><div class="court-editor-meta"><span>${icon('shield')} 提交前，仅自己可见</span><span id="court-char-count">0 / 12,000</span></div><div class="court-evidence-upload"><div><strong>截图证据 <span>选填</span></strong><p>最多 4 张 · 支持 JPG、PNG、WebP</p></div><label class="court-upload-button" for="court-evidence">${icon('image')} 添加截图</label><input id="court-evidence" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></div><div class="court-upload-previews" id="court-upload-previews"></div><div class="court-form-error" id="court-form-error" hidden role="alert"></div><button class="court-primary" id="court-submit" type="submit">${icon('check')} 提交我的陈词</button><p class="court-submit-note">提交后本轮陈词会锁定。双方都提交后，猫猫才开始评理。</p><button type="button" class="court-link court-cancel-appeal" id="court-cancel-appeal" data-court="cancel-appeal" hidden>暂时不补充，回看判词</button></form></section>
            <section class="court-paper court-stage" id="court-stage" hidden aria-live="polite"></section>
            <section class="court-transcript" id="court-transcript" hidden><div class="court-transcript-heading"><h3>${icon('chat')} 本案陈词与记录</h3><span>每一轮，都会好好保留</span></div><div id="court-history"></div></section>
          </div>
          <aside class="court-bench-note"><span class="court-note-icon">${icon('heart')}</span><h3>开庭之前，先深呼吸一下</h3><p>可以表达委屈，也请尽量描述具体的行为。猫猫不会因为谁声音大，就偏向谁。</p><div></div><strong>我们一起找的答案</strong><ul><li>哪些事实已经明确？</li><li>各自需要承担什么责任？</li><li>怎样让同样的分歧少发生？</li></ul><span class="court-note-sign">愿每句话被听见，每条边界被尊重。♡</span></aside>
        </div>
      </section>
      <footer class="court-footer"><span>${icon('paw')} 心平气和，喵喵有理</span><details><summary>关于小法庭与隐私</summary><p>猫猫会根据双方提供的信息分析，不把推测当成事实；信息不足时会说明不确定性。陈词与截图会保存在本网站服务端，审理时发送给 OpenAI。请遮挡无关隐私，只邀请你信任的人。</p><p id="court-config-note">正在检查判官连接…</p></details></footer>
    </div>
    <dialog class="court-evidence-dialog" id="court-evidence-dialog"><button type="button" class="court-dialog-close" data-court="close-image" aria-label="关闭截图">${icon('close')}</button><img id="court-full-image" alt="本案截图证据"><p id="court-full-image-name"></p></dialog>`;

  function current() { return room?.rounds?.at(-1); }
  async function ensureJudgeModel() {
    if (judgeModel) { judgeModel.syncAppearance(); judgeModel.setPaused(!active || document.hidden); return; }
    if (judgeLoading) return judgeLoading;
    judgeLoading = import('./court-judge-model.js').then(({ createCourtJudge }) => {
      if (destroyed) return;
      judgeModel = createCourtJudge({ container: $('#court-judge-model'), assetBase: modelAssetBase, getAppearance: getPetAppearance,
        onReady() { $('#court-model-status').textContent = '判官已入席'; judgeModel?.setPaused(!active || document.hidden); },
        onError() { $('#court-model-status').textContent = '3D 暂未加载，判词仍可正常阅读'; },
      });
      judgeModel.setPaused(!active || document.hidden);
      if ($('#court-bench-stage').classList.contains('has-ruling')) judgeModel.announce();
    }).catch(() => { if (!destroyed) $('#court-model-status').textContent = '3D 暂未加载，判词仍可正常阅读'; });
    return judgeLoading;
  }
  function syncJudgeVisibility() { judgeModel?.setPaused(!active || document.hidden); }
  function rulingTexture(key) { return `${import.meta.env.BASE_URL}assets/court-rulings/${key}-v1.webp`; }
  function waitingBench(round) {
    const stage = $('#court-bench-stage');
    container.classList.remove('has-verdict');
    stage.dataset.ruling = 'waiting'; stage.classList.remove('has-ruling');
    stage.style.removeProperty('--court-ruling-art');
    $('#court-bench-title').textContent = round?.status === 'judging' ? '认真评理中' : '猫猫在听';
    $('#court-bench-kicker').textContent = '温柔开庭 · 听取双方陈词';
    $('#court-bench-replay').hidden = true; $('#court-bench-welcome').hidden = false;
    const caption = round?.status === 'judging' ? '双方陈词已到齐，猫猫正在逐条看证据。' : '两边的话，猫猫都会认真听喵。';
    if ($('#court-bench-caption').textContent !== caption) $('#court-bench-caption').textContent = caption;
  }
  function announceRound(round, remember = true) {
    if (!round?.verdict) return;
    const display = verdictDisplay(round.verdict, round.repair);
    const stage = $('#court-bench-stage');
    stage.dataset.ruling = display.key;
    stage.classList.add('has-ruling');
    stage.style.setProperty('--court-ruling-art', `url("${rulingTexture(display.key)}")`);
    $('#court-bench-title').textContent = display.title;
    $('#court-bench-kicker').textContent = `第 ${round.index} 轮 · ${round.kind === 'appeal' ? '复议裁定' : '初次裁定'}`;
    const name = display.key === 'primary-a' ? personName('a') : display.key === 'primary-b' ? personName('b') : '';
    const caption = name ? `责任较重：${name}` : display.caption;
    if ($('#court-bench-caption').textContent !== caption) $('#court-bench-caption').textContent = caption;
    $('#court-bench-replay').hidden = false;
    $('#court-bench-replay').dataset.announceRound = round.id;
    $('#court-bench-welcome').hidden = true;
    if (remember && announcedRounds.has(round.id)) return;
    if (remember) announcedRounds.add(round.id);
    judgeModel?.announce();
  }
  function rulingBanner(round) {
    const display = verdictDisplay(round.verdict, round.repair);
    const name = display.key === 'primary-a' ? personName('a') : display.key === 'primary-b' ? personName('b') : '';
    const caption = name ? `${name} · 本轮需承担更多行为责任` : display.caption;
    const texture = rulingTexture(display.key);
    return `<section class="court-ruling-banner ${display.tone}" data-ruling="${display.key}" style="--court-ruling-art:url('${esc(texture)}')" aria-label="${esc(display.title)}：${esc(caption)}"><span class="court-ruling-round">第 ${round.index} 轮${round.kind === 'appeal' ? ' · 复议裁定' : ' · 本轮裁定'}</span><div class="court-ruling-image"><h4>${esc(display.title)}</h4></div><div class="court-ruling-footer"><p>${esc(caption)}</p><button type="button" class="court-ruling-replay" data-court="announce" data-announce-round="${esc(round.id)}">${icon('gavel')}敲槌宣读</button></div>${display.source === 'legacy-unclassified' ? '<small class="court-ruling-history-note">历史判词没有结构化责任字段，请以完整原文为准。</small>' : ''}</section>`;
  }
  function submitted(round, role) { return Boolean(round?.submissions?.[role] || round?.submittedRoles?.includes(role)); }
  function sessionKey() { return `catcourt.session.${room?.id}`; }
  function saveSession() { try { sessionStorage.setItem(sessionKey(), JSON.stringify(session)); } catch { /* private sessions can disable browser storage */ } }
  function notice(message = '') { $('#court-notice').hidden = !message; $('#court-notice').textContent = message; }
  function formError(message = '') { $('#court-form-error').hidden = !message; $('#court-form-error').textContent = message; }
  function setBusy(value) { busy = value; updateControls(); }
  function updateControls() {
    $('#court-create').disabled = busy;
    $('#court-claim-button').disabled = busy || !room || room.parties?.[selectedRole]?.claimed;
    $('#court-submit').disabled = busy || uploading;
    $('#court-submit').innerHTML = busy ? `${icon('clock')} 正在提交…` : uploading ? `${icon('image')} 正在整理截图…` : `${icon('check')} ${appealMode ? '提交补充证词，申请复议' : '提交我的陈词'}`;
    $('#court-evidence').disabled = busy || uploading;
    $('#court-statement').readOnly = busy;
    updateRepairControls();
  }
  async function request(path, options = {}) {
    if (readOnlyPreview) throw new Error('历史预览只读取已有记录。');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 20000);
    try {
      const response = await fetch(`${API}${path}`, {
        method: options.method || 'GET', signal: abort.signal,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (data.room) applyRoom(data.room);
      if (!response.ok) {
        if (['INVALID_ROLE_TOKEN', 'AUTH_REQUIRED'].includes(data.error?.code) && session) {
          try { sessionStorage.removeItem(sessionKey()); } catch {}
          session = null; lastParty = ''; lastHistory = '';
          if (room) room = { ...room, requiresAuth: true, rounds: [] };
          renderRoom();
        }
        const error = new Error(data.error?.message || (typeof data.error === 'string' ? data.error : `暂时无法完成操作（${response.status}）`));
        error.code = data.error?.code; error.status = response.status; throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('连接有点慢，请稍后重试。你的未提交内容还在。');
      if (error instanceof TypeError) throw new Error('小法庭服务暂时未连接，请稍后重试。你的未提交内容还在。');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function loadConfig() {
    try { config = await request('/config'); configFailed = false; }
    catch { configFailed = true; }
    renderConfig();
  }
  function renderConfig() {
    const badge = $('#court-connection');
    badge.classList.toggle('connected', Boolean(config?.configured && !configFailed));
    badge.classList.toggle('unavailable', configFailed || config?.configured === false);
    badge.innerHTML = `<i></i>${configFailed ? '服务未连接' : config?.configured ? '判官已就位' : config ? '判官待连接' : '连接中'}`;
    $('#court-config-note').textContent = configFailed ? '小法庭服务暂时无法连接。网站服务恢复后即可发起或继续审理。' : config?.configured ? `判官使用 ${config.model} · 高思考模式。未提交的输入不会同步给对方；对方可以看到你正在输入。` : 'ChatGPT 尚未接入。你们仍可入席并保存陈词；由网站管理员在服务端配置 OpenAI 后，即可继续审理。';
  }
  function stashDraft() {
    if (draftRound) {
      const statement = $('#court-statement').value;
      drafts.set(draftRound, { statement, images: [...images] });
      try { sessionStorage.setItem(`catcourt.draft.${draftRound}`, statement); } catch {}
    }
  }
  function setDraftRound(key) {
    if (key === draftRound) return;
    stashDraft(); draftRound = key;
    const draft = drafts.get(key);
    let saved = '';
    try { saved = sessionStorage.getItem(`catcourt.draft.${key}`) || ''; } catch {}
    $('#court-statement').value = draft?.statement ?? saved;
    images = draft?.images || [];
    updateCount(); renderUploads(); formError();
  }
  function applyRoom(next) {
    if (!next?.id || next.id !== selectedRoom) return;
    if (room && Number(next.revision || 0) < Number(room.revision || 0)) return;
    // A request sent before role claim may finish after the authorized snapshot.
    if (next.requiresAuth && session?.token && room?.requiresAuth === false) return;
    if (!next.rounds && room) {
      // Presence can observe a new revision before we have its transcript.
      // Keep the full-snapshot revision so the next poll still fetches it.
      room = { ...room, ...next, revision: room.revision, rounds: room.rounds };
    } else room = next;
    if (appealMode && current()?.status !== 'judged') appealMode = false;
    renderRoom();
  }
  function personName(role) { return room?.parties?.[role]?.name || roleLabel(role); }
  function renderParties() {
    const round = current();
    const signature = JSON.stringify([room.parties, round?.status, round?.submittedRoles, ['a', 'b'].map(role => submitted(round, role)), session?.role]);
    if (signature === lastParty) return;
    lastParty = signature;
    $('#court-parties').innerHTML = ['a', 'b'].map(role => {
      const party = room.parties?.[role] || {};
      const mine = session?.role === role;
      const done = submitted(round, role);
      const status = !party.claimed ? '等待入席' : done ? '本轮陈词已提交' : party.typing && !mine ? '正在认真输入…' : party.online ? '在线 · 正在准备陈词' : '暂时离线';
      return `<article class="court-party ${role} ${mine ? 'is-me' : ''}"><span class="court-party-avatar">${role === 'a' ? icon('paw') : '◈'}</span><div><strong>${esc(party.name || roleLabel(role))}${mine ? '<em>我</em>' : ''}</strong><span class="court-party-role">${roleLabel(role)} <b>·</b> ${party.claimed ? '已入席' : '空席位'}</span></div><span class="court-party-state ${done ? 'done' : party.typing && !mine ? 'typing' : ''}">${done ? icon('check') : `<i class="${party.online ? 'online' : ''}"></i>`}<span>${status}</span></span></article>`;
    }).join('');
    for (const role of ['a', 'b']) {
      const button = $(`[data-court-role="${role}"]`);
      button.disabled = Boolean(room.parties?.[role]?.claimed);
      button.classList.toggle('selected', role === selectedRole);
      button.setAttribute('aria-pressed', String(role === selectedRole));
    }
  }
  function renderStage(round) {
    const stage = $('#court-stage');
    if (readOnlyPreview) { stage.hidden = true; return; }
    const ownSubmitted = session && submitted(round, session.role);
    let markup = '';
    if (!session && Object.values(room.parties || {}).every(party => party.claimed)) {
      markup = `<span class="court-stage-symbol">${icon('shield')}</span><h3>两位当事人都已入席</h3><p>为保护双方隐私，本案内容仅对已认领席位的浏览器开放。<br>如果你已入席，请使用当时的浏览器继续审理。</p>`;
    } else if (session && round?.status === 'judging') {
      markup = `<span class="court-stage-symbol court-thinking">${icon('gavel')}</span><span class="court-section-kicker">双方陈词已收到</span><h3>猫猫正在认真评理</h3><p>逐条看证据，也认真听你们的感受。<br>判词会在这里自动出现，稍等一下喵。</p><span class="court-stage-footnote">${esc(config?.model || 'ChatGPT')} · 高思考模式</span>`;
    } else if (session && round?.status === 'error') {
      markup = `<span class="court-stage-symbol">${icon('clock')}</span><h3>证词已收好，开庭稍等一下</h3><p>${esc(round.error?.message || round.error || '判官暂时无法完成分析，请稍后重试。')}</p><p class="court-stage-footnote">双方陈词和截图已保留，无需重复提交。</p><button class="court-secondary" type="button" data-court="retry">${icon('refresh')} 重新请猫猫评理</button>`;
    } else if (session && ownSubmitted && round?.status === 'collecting') {
      const partner = personName(otherRole(session.role));
      markup = `<span class="court-stage-symbol">${icon('check')}</span><span class="court-section-kicker">你的陈词已收到</span><h3>等${esc(partner)}也说说吧</h3><p>双方提交后，猫猫会自动开庭。<br>这段时间可以回看你的陈词，也给彼此一点空间。</p><button class="court-link" type="button" data-court="share">${icon('copy')} 把入席邀请发给对方</button>`;
    } else if (session && round?.status === 'judged' && !appealMode) {
      markup = '';
    }
    stage.hidden = !markup;
    if (stage.innerHTML !== markup) stage.innerHTML = markup;
  }
  function renderRoom() {
    if (!room) return;
    const round = current();
    $('#court-lobby').hidden = true; $('#court-room').hidden = false;
    container.classList.add('has-case');
    container.classList.toggle('has-verdict', Boolean(round?.verdict));
    $('#court-case-number').textContent = `NO. ${room.id.toUpperCase()}`;
    $('#court-case-title').textContent = room.title || '我们想好好说说话';
    const bothClaimed = ['a', 'b'].every(role => room.parties?.[role]?.claimed);
    const step = ['judging', 'judged', 'error'].includes(round?.status) ? 3 : bothClaimed ? 2 : 1;
    container.querySelectorAll('[data-step]').forEach(el => { el.classList.toggle('current', Number(el.dataset.step) === step); el.classList.toggle('complete', Number(el.dataset.step) < step); });
    if (room.parties?.[selectedRole]?.claimed && !session) selectedRole = ['a', 'b'].find(role => !room.parties?.[role]?.claimed) || 'a';
    renderParties();
    $('#court-claim').hidden = Boolean(session) || bothClaimed;
    $('#court-claim-note').textContent = '席位会保存在当前浏览器标签页，请用这个标签页继续本案。';
    const showComposer = Boolean(session && (appealMode && round?.status === 'judged' || round?.status === 'collecting' && !submitted(round, session.role)));
    $('#court-composer').hidden = !showComposer;
    if (showComposer) {
      const nextAppeal = appealMode && round?.status === 'judged';
      const key = `${room.id}:${nextAppeal ? `appeal-${round.index + 1}` : round?.id || round?.index}`;
      const pendingAppeal = `${room.id}:appeal-${round.index}`;
      if (!nextAppeal && round.kind === 'appeal' && key !== draftRound && draftRound === pendingAppeal) {
        stashDraft();
        const pending = drafts.get(pendingAppeal);
        drafts.set(key, pending);
        drafts.delete(pendingAppeal);
        try { sessionStorage.setItem(`catcourt.draft.${key}`, pending?.statement || ''); sessionStorage.removeItem(`catcourt.draft.${pendingAppeal}`); } catch {}
        draftRound = '';
      } else if (!nextAppeal && round.kind === 'appeal' && !drafts.has(key)) {
        let pendingStatement = '', currentStatement = null;
        try { currentStatement = sessionStorage.getItem(`catcourt.draft.${key}`); pendingStatement = sessionStorage.getItem(`catcourt.draft.${pendingAppeal}`) || ''; } catch {}
        if (currentStatement !== null) pendingStatement = '';
        if (pendingStatement) drafts.set(key, { statement: pendingStatement, images: [] });
      }
      setDraftRound(key);
      $('#court-composer-kicker').textContent = `现在由${roleLabel(session.role)}陈词 · ${personName(session.role)}`;
      $('#court-composer-title').textContent = nextAppeal || round.kind === 'appeal' ? '再说说，你想补充什么？' : '你的感受，猫猫在听';
      $('#court-round-badge').textContent = `第 ${nextAppeal ? round.index + 1 : round.index} 轮${nextAppeal || round.kind === 'appeal' ? ' · 复议' : ''}`;
      $('#court-statement-label').textContent = nextAppeal || round.kind === 'appeal' ? '有哪些遗漏的事实、新的证据，或对判词的异议？' : '发生了什么？你当时的感受和期待是什么？';
      $('#court-cancel-appeal').hidden = !nextAppeal;
    }
    renderStage(round); renderHistory(); updateControls();
    if (round?.verdict) announceRound(round);
    else waitingBench(round);
    judgeModel?.syncAppearance();
  }
  function formalVerdict(round) {
    const verdict = round.verdict;
    const details = verdict.details && typeof verdict.details === 'object' && !Array.isArray(verdict.details) ? verdict.details : null;
    const date = verdict.createdAt && Number.isFinite(Date.parse(verdict.createdAt)) ? new Date(verdict.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const latest = current()?.id === round.id;
    const canRepair = Boolean(round.repair);
    const boundary = round.repair?.mode === 'boundaries_first' || details?.repairMode === 'boundaries_first';
    return `<section class="court-formal-verdict" aria-label="第 ${round.index} 轮正式判词">
      <header class="court-formal-heading"><span class="court-formal-emblem" aria-hidden="true">${icon('gavel')}</span><div><span class="court-section-kicker">猫猫正式判词 · 第 ${round.index} 轮${round.kind === 'appeal' ? '复议' : '审理'}</span><h3>${esc(details?.headline || (round.kind === 'appeal' ? '复议判词' : '初审判词'))}</h3><div class="court-formal-meta">${date ? `<time>${esc(date)}</time><span>·</span>` : ''}<span>${esc(verdict.model || config?.model || 'ChatGPT')} · 高思考</span></div></div><span class="court-formal-stamp">${icon('paw')}已审理</span></header>
      ${latest ? '' : rulingBanner(round)}
      ${verdictCards(round, personName)}
      ${textValue(verdict.text) ? `<details class="court-verdict-details court-original" data-history="original-${esc(round.id)}"><summary><span>阅读完整判词原文</span><span class="court-detail-chevron">⌄</span></summary><div class="court-verdict-body">${verdictMarkup(verdict.text)}</div></details>` : ''}
      <div class="court-formal-sign"><span>愿事实被说清楚，愿彼此的感受和边界被尊重。</span><span>猫猫判官 ${icon('paw')}</span></div>
      ${canRepair || latest && session ? `<div class="court-result-actions">${canRepair ? `<button class="court-primary" type="button" data-court-view="repair" data-result-round="${esc(round.id)}">${icon(boundary ? 'shield' : 'heart')} ${boundary ? '查看边界建议' : '一起看看修复计划'} ${icon('next')}</button>` : ''}${latest && session ? `<button class="court-secondary" type="button" data-court="appeal">${icon('chat')} 补充证词，申请复议</button>` : ''}</div>` : ''}
    </section>`;
  }
  function repairPlan(round) {
    const plan = round.repair;
    if (!plan) return '';
    const details = round.verdict?.details;
    const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
    const boundary = plan.mode === 'boundaries_first' || details?.repairMode === 'boundaries_first';
    const complete = tasks.filter(task => task.confirmations?.a && task.confirmations?.b).length;
    const percentage = tasks.length ? Math.round(complete / tasks.length * 100) : 0;
    const latest = current()?.id === round.id && current()?.status === 'judged';
    const editable = Boolean(latest && session && !boundary);
    const communication = details?.communication;
    return `<section class="court-repair-plan ${boundary ? 'boundaries-first' : ''}" aria-label="第 ${round.index} 轮${boundary ? '边界建议' : '修复计划'}">
      <header class="court-repair-heading"><div><span class="court-section-kicker">判词之后，下一步怎么走</span><h3>${boundary ? '先把自己的边界照顾好' : '把修复，落在一件件小事上'}</h3><p>${boundary ? '尊重意愿、保持安全。无需通过共同确认来证明和好。' : '不用急着解决所有问题。读懂任务，再按自己的实际完成情况确认。'}</p></div><span class="court-formal-emblem" aria-hidden="true">${icon(boundary ? 'shield' : 'heart')}</span></header>
      ${boundary ? `<div class="court-boundary-note">${icon('shield')}<p>本轮先以安全与边界为重点。以下是判官给出的建议，供各自阅读参考。</p></div>` : tasks.length ? `<section class="court-repair-progress" aria-label="修复任务共同确认进度"><div><strong>${complete === tasks.length ? '这些约定，双方都已确认' : '每一项确认，都来自你们自己'}</strong><span>共同确认 <b>${complete}</b> / ${tasks.length} 项 <em>${percentage}%</em></span></div><div class="court-repair-progress-track" role="progressbar" aria-label="双方共同确认的任务比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${tasks.length} 项任务中 ${complete} 项得到双方确认"><span style="width:${percentage}%"></span></div><p>${complete === tasks.length ? `双方已共同确认这 ${tasks.length} 件事。之后的感受，可以继续慢慢沟通。` : '进度记录的是双方确认，不代表感情评分。未完成的部分，可以按你们自己的节奏来。'}</p></section>` : ''}
      ${!latest ? '<p class="court-repair-archive">这是此前一轮的计划，记录已保留。本轮任务以最新判词为准。</p>' : ''}
      <div class="court-repair-tasks">${tasks.map((task, index) => {
        const jointlyConfirmed = Boolean(task.confirmations?.a && task.confirmations?.b);
        const ownConfirmed = Boolean(session && task.confirmations?.[session.role]);
        const key = `${round.id}:${task.id}`;
        return `<article class="court-repair-task ${!boundary && jointlyConfirmed ? 'is-complete' : ''}"><div class="court-task-top"><span class="court-task-number">${String(index + 1).padStart(2, '0')}</span><div><span class="court-mini-label">${boundary ? '边界建议' : `修复任务 ${index + 1}`}</span><h4>${esc(task.title)}</h4></div>${!boundary && jointlyConfirmed ? `<span class="court-task-complete">${icon('check')}双方已确认</span>` : ''}</div>${paragraphMarkup(task.description)}${boundary ? '' : `<div class="court-task-confirmations">${['a', 'b'].map(role => `<span class="court-task-person ${role} ${task.confirmations?.[role] ? 'confirmed' : ''}"><i>${task.confirmations?.[role] ? icon('check') : icon('clock')}</i><strong>${esc(personName(role))}${session?.role === role ? '<em>我</em>' : ''}</strong><span>${task.confirmations?.[role] ? '已确认' : '尚未确认'}</span></span>`).join('')}</div>${editable ? `<button class="${ownConfirmed ? 'court-secondary' : 'court-primary'} court-task-confirm" type="button" data-repair-round="${esc(round.id)}" data-repair-task="${esc(task.id)}" data-repair-confirmed="${ownConfirmed ? 'false' : 'true'}" ${repairBusy.has(key) ? 'disabled' : ''}>${repairBusy.has(key) ? icon('clock') : ownConfirmed ? icon('refresh') : icon('check')}<span>${repairBusy.has(key) ? '正在保存确认…' : ownConfirmed ? '我已确认 · 撤回我的确认' : '这项我已完成，确认一下'}</span></button>` : ''}`}</article>`;
      }).join('')}</div>
      ${communication && (textValue(communication.a) || textValue(communication.b)) ? `<section class="court-repair-communication"><div class="court-section-heading"><h4>${boundary ? '表达边界，可以这样说' : '好好沟通，可以从这句话开始'}</h4><span>判官提供的表达建议</span></div><div>${['a', 'b'].filter(role => textValue(communication[role])).map(role => `<article class="${role}"><span>${esc(personName(role))} · ${roleLabel(role)}</span><p>“${esc(communication[role])}”</p></article>`).join('')}</div></section>` : ''}
      ${!boundary && editable ? '<p class="court-repair-explainer">只能确认或撤回自己这一方的记录。每项任务需双方分别确认，才计入共同完成进度。</p>' : ''}
      <button class="court-secondary court-return-verdict" type="button" data-court-view="verdict" data-result-round="${esc(round.id)}">${icon('arrow')} 返回这轮判词</button>
    </section>`;
  }
  function updateRepairControls() {
    container.querySelectorAll('[data-repair-task]').forEach(button => {
      const pending = repairBusy.has(`${button.dataset.repairRound}:${button.dataset.repairTask}`);
      const round = room?.rounds?.find(item => item.id === button.dataset.repairRound);
      const safe = round?.repair?.mode === 'together' && round?.verdict?.details?.repairMode !== 'boundaries_first';
      button.disabled = pending || !session || current()?.id !== round?.id || round?.status !== 'judged' || !safe;
      const label = button.querySelector('span');
      if (label) label.textContent = pending ? '正在保存确认…' : button.dataset.repairConfirmed === 'false' ? '我已确认 · 撤回我的确认' : '这项我已完成，确认一下';
    });
  }
  function repairFocusTarget(roundId, taskId) {
    return [...container.querySelectorAll('[data-repair-task]')].find(button => button.dataset.repairRound === roundId && button.dataset.repairTask === taskId)
      || [...container.querySelectorAll('.court-result-tabs [data-court-view]')].find(button => button.dataset.resultRound === roundId && button.dataset.courtView === 'repair');
  }
  function renderHistory() {
    const readable = room?.rounds?.filter(round => Object.values(round.submissions || {}).some(Boolean) || round.verdict) || [];
    $('#court-transcript').hidden = !readable.length;
    $('.court-transcript-heading h3').innerHTML = `${icon('chat')} ${readable.some(round => round.verdict) ? '本案判词、约定与证据' : '本案陈词与记录'}`;
    const signature = JSON.stringify([readable, session?.role, [...resultViews]]);
    if (lastHistory === signature) return;
    lastHistory = signature;
    const openDetails = new Set([...container.querySelectorAll('#court-history details[open]')].map(el => el.dataset.history));
    const focus = document.activeElement;
    let focusKey = null;
    if ($('#court-history').contains(focus)) {
      if (focus?.dataset?.repairTask) focusKey = { type: 'repair', round: focus.dataset.repairRound, task: focus.dataset.repairTask };
      else if (focus?.dataset?.announceRound) focusKey = { type: 'announce', round: focus.dataset.announceRound };
      else if (focus?.dataset?.courtView) focusKey = { type: 'view', round: focus.dataset.resultRound, view: focus.dataset.courtView };
      else if (focus?.dataset?.evidenceRound) focusKey = { type: 'evidence', round: focus.dataset.evidenceRound, role: focus.dataset.evidenceRole, index: focus.dataset.evidenceIndex };
      else if (focus?.tagName === 'SUMMARY' && focus.parentElement?.dataset?.history) focusKey = { type: 'summary', history: focus.parentElement.dataset.history };
    }
    $('#court-history').innerHTML = [...readable].reverse().map(round => {
      const verdict = round.verdict;
      const view = resultViews.get(round.id) === 'repair' && round.repair ? 'repair' : 'verdict';
      const boundary = round.repair?.mode === 'boundaries_first' || verdict?.details?.repairMode === 'boundaries_first';
      return `<article class="court-record" data-result-id="${esc(round.id)}"><div class="court-record-heading"><span>第 ${round.index} 轮${round.kind === 'appeal' ? ' · 复议' : ' · 初次审理'}</span><span>${verdict ? '已出判词' : round.status === 'judging' ? '正在审理' : round.status === 'error' ? '等待重试' : '陈词收集中'}</span></div>${verdict ? `${round.repair ? `<nav class="court-result-tabs" aria-label="本轮判词与${boundary ? '边界建议' : '修复计划'}"><button type="button" data-court-view="verdict" data-result-round="${esc(round.id)}" aria-pressed="${view === 'verdict'}">${icon('gavel')} 正式判词</button><button type="button" data-court-view="repair" data-result-round="${esc(round.id)}" aria-pressed="${view === 'repair'}">${icon(boundary ? 'shield' : 'heart')} ${boundary ? '边界建议' : '一起修复'}</button></nav>` : ''}${view === 'repair' ? repairPlan(round) : formalVerdict(round)}` : ''}<div class="court-statements"><h4 class="court-evidence-record-title">${icon('image')} 本轮陈词与截图证据</h4>${['a', 'b'].map(role => {
        const submission = round.submissions?.[role];
        if (!submission) return `<div class="court-missing-statement">${esc(personName(role))}的陈词还在路上 ${icon('clock')}</div>`;
        const key = `${round.id || round.index}-${role}`;
        return `<details class="court-statement-record ${role}" data-history="${esc(key)}" ${openDetails.has(key) ? 'open' : ''}><summary><span>${role === 'a' ? icon('paw') : '<b>◈</b>'}<strong>${esc(personName(role))}的陈词</strong><em>${submission.images?.length ? `${submission.images.length} 张截图` : '文字陈词'}</em></span><span class="court-detail-chevron">⌄</span></summary><p>${esc(submission.statement)}</p>${submission.images?.length ? `<div class="court-source-images">${submission.images.map((file, index) => `<button type="button" data-evidence-round="${esc(round.id || round.index)}" data-evidence-role="${role}" data-evidence-index="${index}" aria-label="查看证据 ${esc(file.name)}"><img src="${esc(safeImage(file.dataUrl))}" alt="${esc(file.name)}" loading="lazy"><span>${esc(file.name)}</span></button>`).join('')}</div>` : ''}<time>${submission.submittedAt ? esc(new Date(submission.submittedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''} 已提交</time></details>`;
      }).join('')}</div></article>`;
    }).join('');
    for (const details of container.querySelectorAll('#court-history details')) if (openDetails.has(details.dataset.history)) details.open = true;
    updateRepairControls();
    if (focusKey) {
      let nextFocus;
      if (focusKey.type === 'repair') nextFocus = repairFocusTarget(focusKey.round, focusKey.task);
      if (focusKey.type === 'view') nextFocus = [...container.querySelectorAll('.court-result-tabs [data-court-view]')].find(button => button.dataset.resultRound === focusKey.round && button.dataset.courtView === focusKey.view);
      if (focusKey.type === 'evidence') nextFocus = [...container.querySelectorAll('[data-evidence-round]')].find(button => button.dataset.evidenceRound === focusKey.round && button.dataset.evidenceRole === focusKey.role && button.dataset.evidenceIndex === focusKey.index);
      if (focusKey.type === 'summary') nextFocus = [...container.querySelectorAll('#court-history details')].find(details => details.dataset.history === focusKey.history)?.querySelector('summary');
      if (focusKey.type === 'announce') nextFocus = [...container.querySelectorAll('[data-announce-round]')].find(button => button.dataset.announceRound === focusKey.round);
      nextFocus?.focus({ preventScroll: true });
    }
  }
  function renderUploads() {
    $('#court-upload-previews').innerHTML = images.map((file, index) => `<div class="court-upload-preview"><img src="${esc(safeImage(file.dataUrl))}" alt="${esc(file.name)}"><button type="button" data-court-remove="${index}" aria-label="移除截图 ${esc(file.name)}">${icon('close')}</button><span>${esc(file.name)}</span></div>`).join('');
  }
  function updateCount() { $('#court-char-count').textContent = `${$('#court-statement').value.length.toLocaleString('en-US')} / 12,000`; }
  function sharedUrl() { const url = new URL(location.href); url.searchParams.set('court', room.id); return url.href; }
  async function share() {
    try { await navigator.clipboard.writeText(sharedUrl()); toast('小法庭邀请已复制，发给对方一起入席吧'); }
    catch { $('#court-share-fallback').hidden = false; $('#court-share-url').value = sharedUrl(); $('#court-share-url').focus(); $('#court-share-url').select(); }
  }
  async function loadRoom(id) {
    stashDraft();
    selectedRoom = id; session = storedSession(id); room = null; lastParty = ''; lastHistory = ''; appealMode = false; draftRound = ''; images = [];
    waitingBench();
    $('#court-statement').value = ''; renderUploads(); updateCount(); notice();
    try {
      const data = await request(`/rooms/${encodeURIComponent(id)}`);
      if (data.room) applyRoom(data.room);
      const url = new URL(location.href); url.searchParams.set('court', id); history.replaceState(null, '', url);
      startPolling();
    } catch (error) {
      notice(`${error.message} ${error.status === 404 ? '请确认邀请链接或编号。' : ''}`);
      if (!room) { $('#court-lobby').hidden = false; $('#court-room').hidden = true; container.classList.remove('has-case'); }
    }
  }
  async function poll() {
    if (!active || !room || polling) return;
    polling = true;
    try { await request(`/rooms/${encodeURIComponent(room.id)}?since=${encodeURIComponent(room.revision || 0)}`); notice(); }
    catch (error) { notice(error.message); }
    finally { polling = false; }
  }
  async function presence(typing = Date.now() - lastTypedAt < 5000) {
    if (!active || !room || !session) return;
    try { await request(`/rooms/${room.id}/presence`, { method: 'POST', body: { typing } }); } catch { /* polling presents connection failures without interrupting the draft */ }
  }
  function startPolling() {
    clearInterval(pollTimer); clearInterval(presenceTimer);
    pollTimer = setInterval(poll, 1500);
    presenceTimer = setInterval(() => presence(), 5000);
    presence(false);
  }
  async function compressImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请上传 JPG、PNG 或 WebP 格式的截图。');
    if (file.size > 25 * 1024 * 1024) throw new Error('这张截图太大啦，请选择小于 25 MB 的图片。');
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('截图读取失败，请再试一次。')); reader.readAsDataURL(file); });
    const picture = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('截图无法打开，请换一张图片。')); img.src = dataUrl; });
    const ratio = Math.min(1, 1800 / Math.max(picture.naturalWidth, picture.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(picture.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * ratio));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(picture, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/jpeg', .88);
    if (result.length > 2700000) result = canvas.toDataURL('image/jpeg', .7);
    if (result.length > 5400000) throw new Error('截图压缩后仍然太大，请裁切后再上传。');
    return { id: crypto.randomUUID(), name: file.name.slice(0, 120), dataUrl: result };
  }
  async function handleSubmit(event) {
    const form = event.target;
    if (!['court-create-form', 'court-join-form', 'court-claim-form', 'court-statement-form'].includes(form.id)) return;
    event.preventDefault(); event.stopPropagation(); if (busy) return;
    setBusy(true); notice(); formError();
    try {
      if (form.id === 'court-create-form') {
        const data = await request('/rooms', { method: 'POST', body: { title: $('#court-topic').value.trim() } });
        await loadRoom(data.room.id); $('#court-room').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (form.id === 'court-join-form') {
        let code = $('#court-join-code').value.trim();
        try { if (code.includes('://')) code = new URL(code).searchParams.get('court') || ''; } catch { /* validated below */ }
        if (!/^[a-z0-9]{12}$/i.test(code)) throw new Error('请输入 12 位法庭编号，或粘贴完整邀请链接。');
        await loadRoom(code.toLowerCase());
      } else if (form.id === 'court-claim-form') {
        const name = $('#court-your-name').value.trim();
        if (!name) throw new Error('请先告诉猫猫你的昵称。');
        const data = await request(`/rooms/${room.id}/claim`, { method: 'POST', body: { role: selectedRole, name } });
        session = { token: data.token, role: data.role || selectedRole }; saveSession(); lastParty = ''; applyRoom(data.room); presence(false);
        $('#court-statement').focus();
      } else {
        const statement = $('#court-statement').value.trim();
        if (!statement) throw new Error('先说说发生了什么，再提交给猫猫吧。');
        if (uploading) throw new Error('截图还在整理，稍等一下喵。');
        const pendingKey = draftRound;
        const endpoint = appealMode && current()?.status === 'judged' ? 'appeal' : 'submit';
        await request(`/rooms/${room.id}/${endpoint}`, { method: 'POST', body: { statement, images } });
        drafts.delete(pendingKey);
        try { sessionStorage.removeItem(`catcourt.draft.${pendingKey}`); } catch {}
        appealMode = false; $('#court-statement').value = ''; images = []; draftRound = ''; updateCount(); renderUploads(); renderRoom(); presence(false);
        toast('陈词已提交，猫猫认真收好了');
      }
    } catch (error) {
      if (form.id === 'court-statement-form') formError(error.message); else notice(error.message);
    } finally { setBusy(false); }
  }
  async function handleClick(event) {
    const resultView = event.target.closest('[data-court-view]');
    if (resultView) {
      const round = room?.rounds?.find(item => item.id === resultView.dataset.resultRound);
      if (!round?.verdict || resultView.dataset.courtView === 'repair' && !round.repair) return;
      resultViews.set(round.id, resultView.dataset.courtView === 'repair' ? 'repair' : 'verdict');
      renderHistory();
      [...container.querySelectorAll('.court-result-tabs [data-court-view]')].find(button => button.dataset.resultRound === round.id && button.dataset.courtView === resultViews.get(round.id))?.focus({ preventScroll: true });
      return;
    }
    const confirmation = event.target.closest('[data-repair-task]');
    if (confirmation) {
      const roundId = confirmation.dataset.repairRound, taskId = confirmation.dataset.repairTask;
      const round = room?.rounds?.find(item => item.id === roundId);
      const key = `${roundId}:${taskId}`;
      if (!session || repairBusy.has(key) || current()?.id !== roundId || round?.status !== 'judged' || round?.repair?.mode !== 'together' || round?.verdict?.details?.repairMode === 'boundaries_first') return;
      const actorRole = session.role;
      const priorRevision = room.revision;
      const priorConfirmed = Boolean(round.repair.tasks.find(task => task.id === taskId)?.confirmations?.[actorRole]);
      const desiredConfirmation = confirmation.dataset.repairConfirmed === 'true';
      const restoreFocus = document.activeElement === confirmation;
      repairBusy.add(key); updateRepairControls(); notice();
      try {
        await request(`/rooms/${room.id}/repair`, { method: 'POST', body: { roundId, taskId, confirmed: desiredConfirmation } });
        const savedPlan = room?.rounds?.find(item => item.id === roundId)?.repair;
        const savedTask = savedPlan?.tasks?.find(task => task.id === taskId);
        const savedConfirmation = Boolean(savedTask?.confirmations?.[actorRole]);
        if (savedTask && savedConfirmation === desiredConfirmation && savedConfirmation !== priorConfirmed && room.revision > priorRevision) {
          const completed = savedPlan.tasks.filter(task => task.confirmations?.a && task.confirmations?.b).length;
          toast(`${savedConfirmation ? '你的确认已保存' : '已撤回你的确认'} · 双方共同确认 ${completed} / ${savedPlan.tasks.length} 项`);
        }
      } catch (error) { notice(error.message); }
      finally {
        repairBusy.delete(key); updateRepairControls();
        if (restoreFocus && (document.activeElement === document.body || document.activeElement === confirmation)) repairFocusTarget(roundId, taskId)?.focus({ preventScroll: true });
      }
      return;
    }
    const evidence = event.target.closest('[data-evidence-round]');
    if (evidence) {
      const round = room.rounds.find(value => String(value.id || value.index) === evidence.dataset.evidenceRound);
      const file = round?.submissions?.[evidence.dataset.evidenceRole]?.images?.[Number(evidence.dataset.evidenceIndex)];
      if (file && safeImage(file.dataUrl)) {
        evidenceTrigger = { round: evidence.dataset.evidenceRound, role: evidence.dataset.evidenceRole, index: evidence.dataset.evidenceIndex };
        $('#court-full-image').src = file.dataUrl; $('#court-full-image-name').textContent = file.name; $('#court-evidence-dialog').showModal();
      }
      return;
    }
    const remove = event.target.closest('[data-court-remove]');
    if (remove) { if (!busy) { images.splice(Number(remove.dataset.courtRemove), 1); renderUploads(); stashDraft(); } return; }
    const role = event.target.closest('[data-court-role]');
    if (role && !role.disabled) { selectedRole = role.dataset.courtRole; lastParty = ''; renderParties(); updateControls(); return; }
    const button = event.target.closest('[data-court]'); if (!button) return;
    event.preventDefault();
    if (button.dataset.court === 'announce') {
      const round = room?.rounds?.find(item => item.id === button.dataset.announceRound);
      announceRound(round, false);
      $('#court-bench-stage').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      $('#court-bench-replay').focus({ preventScroll: true });
      return;
    }
    if (button.dataset.court === 'back') { close(); onBack?.(); }
    if (button.dataset.court === 'top') container.scrollIntoView({ behavior: 'smooth' });
    if (button.dataset.court === 'toggle-join') { $('#court-join-form').hidden = !$('#court-join-form').hidden; if (!$('#court-join-form').hidden) $('#court-join-code').focus(); }
    if (button.dataset.court === 'share') share();
    if (button.dataset.court === 'appeal') { appealMode = true; renderRoom(); $('#court-composer').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#court-statement').focus({ preventScroll: true }); }
    if (button.dataset.court === 'cancel-appeal') { stashDraft(); appealMode = false; renderRoom(); }
    if (button.dataset.court === 'close-image') $('#court-evidence-dialog').close();
    if (button.dataset.court === 'retry' && !busy) {
      setBusy(true); notice();
      try { await loadConfig(); await request(`/rooms/${room.id}/judge`, { method: 'POST', body: {} }); }
      catch (error) { notice(error.message); }
      finally { setBusy(false); }
    }
  }
  async function handleUpload(event) {
    if (event.target.id !== 'court-evidence') return;
    const files = [...event.target.files]; event.target.value = ''; formError();
    if (images.length + files.length > 4) { formError('每轮最多上传 4 张截图，可以先移除一张再添加。'); return; }
    uploading = true; updateControls();
    try {
      const additions = [];
      for (const file of files) additions.push(await compressImage(file));
      const total = [...images, ...additions].reduce((sum, file) => sum + file.dataUrl.length * .75, 0);
      if (total > 8 * 1024 * 1024) throw new Error('截图总大小超过 8 MB，请裁切后再上传。');
      images.push(...additions); renderUploads(); stashDraft();
    } catch (error) { formError(error.message); }
    finally { uploading = false; updateControls(); }
  }
  function handleInput(event) {
    if (event.target.id !== 'court-statement') return;
    updateCount(); stashDraft(); formError();
    const wasTyping = Date.now() - lastTypedAt < 5000; lastTypedAt = Date.now();
    if (!wasTyping) presence(true);
    clearTimeout(typingTimer); typingTimer = setTimeout(() => presence(false), 4000);
  }
  container.addEventListener('click', handleClick);
  container.addEventListener('submit', handleSubmit);
  container.addEventListener('input', handleInput);
  container.addEventListener('change', handleUpload);
  $('#court-evidence-dialog').addEventListener('click', event => { if (event.target === $('#court-evidence-dialog')) $('#court-evidence-dialog').close(); });
  function restoreEvidenceFocus() {
    if (!active || container.hidden || !evidenceTrigger) return;
    [...container.querySelectorAll('[data-evidence-round]')].find(button => button.dataset.evidenceRound === evidenceTrigger.round && button.dataset.evidenceRole === evidenceTrigger.role && button.dataset.evidenceIndex === evidenceTrigger.index)?.focus({ preventScroll: true });
    evidenceTrigger = null;
  }
  $('#court-evidence-dialog').addEventListener('close', restoreEvidenceFocus);
  async function open() {
    active = true; container.hidden = false;
    if (readOnlyPreview) {
      room = previewRoom; selectedRoom = room.id; session = null;
      config = { model: current()?.verdict?.model };
      $('#court-connection').innerHTML = '<i></i>历史只读预览';
      $('#court-connection').classList.add('connected');
      $('#court-config-note').textContent = '此页只展示本地保存的历史测试记录，不提交陈词，也不发起新的分析。';
      $('.court-share').hidden = true;
      notice('历史测试案卷 · 原判词与截图保留 · 当前仅预览新版界面');
      renderRoom(); void ensureJudgeModel();
      return;
    }
    loadConfig();
    void ensureJudgeModel();
    const requested = new URLSearchParams(location.search).get('court');
    if (requested && /^[a-z0-9]{12}$/i.test(requested) && requested !== room?.id) await loadRoom(requested.toLowerCase());
    else if (room) {
      const url = new URL(location.href); url.searchParams.set('court', room.id); history.replaceState(null, '', url);
      startPolling(); poll();
    } else if (requested) notice('邀请编号格式不正确，请使用 12 位法庭编号或完整邀请链接。');
    container.scrollIntoView({ block: 'start' });
  }
  function close() {
    stashDraft(); presence(false); active = false; container.hidden = true; clearInterval(pollTimer); clearInterval(presenceTimer); clearTimeout(typingTimer);
    if ($('#court-evidence-dialog').open) $('#court-evidence-dialog').close();
    const url = new URL(location.href); url.searchParams.delete('court'); history.replaceState(null, '', url);
    judgeModel?.setPaused(true);
  }
  document.addEventListener('visibilitychange', syncJudgeVisibility);
  function destroy() { destroyed = true; close(); judgeModel?.destroy(); document.removeEventListener('visibilitychange', syncJudgeVisibility); container.removeEventListener('click', handleClick); container.removeEventListener('submit', handleSubmit); container.removeEventListener('input', handleInput); container.removeEventListener('change', handleUpload); $('#court-evidence-dialog').removeEventListener('close', restoreEvidenceFocus); container.innerHTML = ''; }
  return { open, close, destroy };
}
