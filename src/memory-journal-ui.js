import { memoryDays, nextMemoryAnniversary, normalizeMemoryJournal } from './memory-journal.js';
import { diaryTimeline } from './diary-ui.js';
import { GAMES } from './minigames.js';
import { memoryArtwork } from './memory-art.js';
import { memoryUnlocks } from './memory-unlocks.js';

export const escapeMemory=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const memoryDate=(at,options={})=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',...options}).format(at);
const funStories=[
  ['尾巴的小秘密','今天的尾巴，偷偷弯成了一个小问号。'],['把爱藏进呼噜里','没有说出口的喜欢，都变成了轻轻的呼噜声。'],
  ['认真营业的小猫','巡视了一圈小窝，然后决定：还是陪你最好。'],['小爪爪盖章','伸出小爪爪，把今天也盖上了「喜欢你」的章。'],
  ['眼睛里有小星星','魔法不一定来自小魔杖，也可能来自你的一次陪伴。'],['今天也想贴贴','明明已经很近了，还想再靠近一点点。'],
  ['一朵毛茸茸的云','把自己团成一小朵云，等着你伸手摸摸。'],['小窝里的守护者','认真守着这间小窝，也认真等着你回来。'],
  ['胡须上的小心思','胡须轻轻动了一下，大概又想到了什么好玩的事。'],['不用赶路的时刻','在这里，可以和小猫一起，把时间过慢一点。'],
  ['最喜欢的座位','小窝这么大，最喜欢的位置还是你身边。'],['收好今天的温柔','把这一刻的温柔，悄悄放进了记忆口袋。'],
];
const firstTitles={feed:'第一份开饭的仪式',pet:'第一次温柔摸摸',play:'第一次一起玩耍',sleep:'第一个安心的盹',dress:'第一次换上新装',rename:'一个属于它的名字'};
const firstTexts={feed:'一份小小的餐食，让这里更像家了。',pet:'从手心传来的温柔，是陪伴开始的样子。',play:'逗猫棒晃一晃，小窝里就多了一点快乐。',sleep:'有人陪着，连打盹都变得格外安心。',dress:'把喜欢的颜色，穿成今天的小小仪式。',rename:'从此，呼唤这个名字，就有了一份特别的牵挂。'};
const pairTitles={meal:'两个人，一起开饭',relay:'你摸摸，我来逗逗',goodnight:'把晚安接在手心里'};
const pairTexts={meal:'男方和女方各准备一份心意，小猫的餐桌变得圆满。',relay:'一个人的温柔，由另一个人接住。今天又多了一点默契。',goodnight:'前一份陪伴还暖着，另一份安心的休息已经接上。'};
export function memoryPresentation(e) {
  let title,description,label,tone='honey';
  if(e.kind==='adoption'){title='第一次回家';description=`从这一天起，${e.catName}有了小窝，也有了你们。`;label='领养纪念';tone='sage';}
  if(e.kind==='anniversary'){title=`陪伴的第 ${e.year} 周年`;description=`又一起走过一年。那些普通的日子，都因为${e.catName}变得特别。`;label='领养纪念';tone='sage';}
  if(e.kind==='level'){title=`${e.catName}长到 Lv.${e.level} 啦`;description=e.level%10===1?'新的爱心材质，是日复一日陪伴留下的光。':'每一点成长背后，都是被认真照顾过的日子。';label='成长里程碑';}
  if(e.kind==='first'){title=firstTitles[e.occasion];description=firstTexts[e.occasion];label='第一次';}
  if(e.kind==='together'){title=pairTitles[e.occasion];description=pairTexts[e.occasion];label='双人回忆';tone='rose';}
  if(e.kind==='game'){title=`一起玩完一局${GAMES[e.occasion].name}`;description='输赢会过去，一起认真玩耍的时光会被记住。';label='双人回忆';tone='rose';}
  if(e.kind==='fun'){[title,description]=funStories[e.variant];label='小猫随笔';tone='lavender';}
  if(e.kind==='legacy'){title='从旧日记拾起的瞬间';description=e.text;label='过去的陪伴';tone='sage';}
  return {title,description,label,tone,participants:['together','game'].includes(e.kind)?'男方 ♡ 女方':e.actorId==='partner-male'?'男方':e.actorId==='partner-female'?'女方':'我们的小窝'};
}
export function memoryArt(e,className='') {
  const art=memoryArtwork(e);
  return `<div class="memory-photo ${className}" role="img" aria-label="${escapeMemory(e.catName)}的纪念插画：${art.description}"><img src="${art.src}" alt="" width="960" height="640" loading="lazy" decoding="async" draggable="false"/></div>`;
}
function journalMemoryCard(e,favorites,saving) {
  const p=memoryPresentation(e),star=favorites.has(e.id);
  return `<article class="journal-memory-card" data-memory-kind="${e.kind}" data-memory-tone="${p.tone}">
    <button class="memory-photo-wrap" data-memory-card="${e.id}" aria-label="查看「${escapeMemory(p.title)}」的纪念插画和完整故事">${memoryArt(e)}</button>
    <div class="journal-memory-card-copy">
      <div class="memory-meta"><span class="memory-kind">${p.label}</span><time datetime="${new Date(e.at).toISOString()}" title="${memoryDate(e.at)}">${memoryDate(e.at,{year:undefined,month:'numeric',day:'numeric'})}</time></div>
      <h3>${escapeMemory(p.title)}</h3><p>${escapeMemory(p.description)}</p>
      <footer><span>${p.participants}</span><button data-memory-card="${e.id}" aria-label="为「${escapeMemory(p.title)}」制作纪念卡">纪念卡 <span aria-hidden="true">↗</span></button></footer>
    </div>
    <button class="memory-favorite ${star?'is-favorite':''}" data-memory-favorite="${e.id}" aria-label="${star?'取消收藏':'收藏'}「${escapeMemory(p.title)}」" aria-pressed="${star}" ${saving?'disabled':''}>${star?'♥':'♡'}</button>
  </article>`;
}
function journalLockedCard(goal) {
  const p=memoryPresentation(goal.entry),progress=goal.progress;
  return `<article class="journal-memory-card journal-locked-card" data-memory-unlock="${goal.id}">
    <div class="memory-photo-wrap">${memoryArt(goal.entry,'memory-photo-locked')}<span class="memory-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span></div>
    <div class="journal-memory-card-copy"><div class="memory-meta"><span class="memory-kind">待解锁 · ${p.label}</span></div><h3>${escapeMemory(p.title)}</h3><p class="memory-unlock-requirement">${escapeMemory(goal.requirement)}</p><p class="memory-unlock-status">${escapeMemory(goal.status)}</p>${progress?`<progress class="memory-unlock-progress" value="${progress.value}" max="${progress.max}" aria-label="${escapeMemory(p.title)}解锁进度">${Math.round(progress.value/progress.max*100)}%</progress>`:''}</div>
  </article>`;
}
function journalPagination(current,pages) {
  return pages>1?`<nav class="journal-pagination" aria-label="成长日记翻页"><button data-diary-page="${current-1}" ${current===0?'disabled':''}>上一页</button><span>${current+1} / ${pages}</span><button data-diary-page="${current+1}" ${current===pages-1?'disabled':''}>下一页</button></nav>`:'';
}
export function memoryJournalPanel(state,{tab='moments',filter='all',page=0,saving=false,now=Date.now(),message=''}={}) {
  const diary=normalizeMemoryJournal(state.diary,state,now),favorites=new Set(diary.favorites),days=memoryDays(diary,now);
  const all=diary.entries,anniversary=nextMemoryAnniversary(diary,now),locked=memoryUnlocks(state,now,diary);
  const isLocked=tab==='locked';
  const filtered=isLocked?locked.filter(goal=>filter==='all'||goal.category===filter):all.filter(e=>(tab!=='favorites'||favorites.has(e.id)) && (filter==='all'||filter==='growth'&&['level','first','adoption','anniversary'].includes(e.kind)||filter==='together'&&e.kind==='game'||filter===e.kind));
  const pages=Math.max(1,Math.ceil(filtered.length/8)),current=Math.max(0,Math.min(page,pages-1)),items=filtered.slice(current*8,(current+1)*8);
  const tabs=[['moments','时光轴'],['locked',`待解锁 ${locked.length}`],['favorites',`共同收藏 ${favorites.size||''}`],['recent','日常足迹']];
  const filters=`<div class="journal-filters" aria-label="筛选纪念类型">${[['all','全部'],['growth','成长'],['together','双人'],['fun','趣事']].map(([id,label])=>`<button data-diary-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>`;
  const empty=isLocked?'<div class="journal-empty"><span aria-hidden="true">✧</span><h3>这一类的回忆已经收齐了</h3><p>去其他分类看看，下一份纪念正在等你们。</p><button data-diary-filter="all">查看全部待解锁</button></div>':`<div class="journal-empty"><span aria-hidden="true">${tab==='favorites'?'♡':'✧'}</span><h3>${tab==='favorites'?'把舍不得忘记的时刻留在这里':'下一章，等你们一起写'}</h3><p>${tab==='favorites'?'点亮卡片右上角的爱心，两个人都能再次找到它。':'陪伴、成长与默契，会慢慢留下新的纪念。'}</p><button data-diary-filter="all" ${tab==='favorites'?'data-diary-show-all':''}>回到全部时刻</button></div>`;
  const footnote=isLocked?'达成后会自动移入时光轴，可收藏或制作纪念卡。<br>照顾仍按现有次数与冷却进行 · 成长气泡需点击领取':tab==='favorites'?'收藏由两个人共享，取消收藏不会删除原来的纪念。':'纪念会长久留在这份小窝存档里，刷新和换设备也能再见。';
  const content=tab==='recent'?`<p class="journal-recent-note">最近 40 次日常照顾。特别的时刻会另外留在时光轴。</p>${diaryTimeline(state.history,{now})}`:`${filters}${isLocked?'<p class="journal-unlock-intro">下一份回忆，和你们一起完成。<small>这里展示未收集的主题、下一个等级与后续爱心阶段。</small></p>':''}${items.length?`<div class="${isLocked?'journal-unlock-list':'journal-timeline'}">${items.map(e=>isLocked?journalLockedCard(e):journalMemoryCard(e,favorites,saving)).join('')}</div>${journalPagination(current,pages)}`:empty}<p class="journal-footnote">${footnote}<br>纪念日按北京时间记录 · 卡片配图为纪念插画</p>`;
  return `<div class="memory-journal"><header class="journal-heading"><span>OUR LITTLE CHAPTERS</span><h2>${escapeMemory(state.name)}的成长日记</h2><p>把平凡的一天，慢慢收藏成我们。</p></header><div class="journal-summary"><div><strong>${days}<small>天</small></strong><span>一起生活</span></div><div><strong>${all.length}</strong><span>留下的时刻</span></div><div><strong>${all.filter(e=>['together','game'].includes(e.kind)).length}</strong><span>双人默契</span></div></div><p class="journal-adoption"><span>♧ ${memoryDate(diary.adoptedAt)} · 回家的第一天</span>${anniversary?`<small>距离下个领养纪念日 ${anniversary} 天</small>`:''}</p><div class="journal-tabs" role="tablist" aria-label="成长日记栏目">${tabs.map(([id,label])=>`<button role="tab" data-diary-tab="${id}" id="diary-tab-${id}" aria-selected="${tab===id}" aria-controls="journal-content">${label}</button>`).join('')}</div><div class="journal-feedback" role="status" aria-live="polite">${escapeMemory(message)}</div><section id="journal-content" role="tabpanel" aria-labelledby="diary-tab-${tab}">${content}</section><button class="journal-couple-link" data-open="shared-care">看看彼此的照顾足迹与默契接力 <span>›</span></button></div>`;
}
export function memoryCardPanel(e,{url,error='',canShare=false}={}) {
  const p=memoryPresentation(e);
  return `<div class="journal-card-panel"><button class="journal-back" data-diary-back>‹ 回到成长日记</button><header class="journal-heading"><span>A MOMENT TO KEEP</span><h2>把这一刻，送给喜欢的人</h2><p>一张小小的卡片，装下我们一起长大的日子。</p></header><div class="journal-export-preview" aria-busy="${!url&&!error}">${url?`<img src="${url}" alt="${escapeMemory(p.title)}纪念卡片预览"/>`:error?`<p role="alert">${escapeMemory(error)}</p><button data-memory-retry="${e.id}">重新生成</button>`:'<span class="journal-card-loader" aria-hidden="true">✧</span><p role="status">正在装好这一份纪念…</p>'}</div><div class="journal-export-actions"><button class="primary" data-memory-download ${!url?'disabled':''}>保存图片</button>${canShare?`<button data-memory-share ${!url?'disabled':''}>分享纪念卡 ↗</button>`:''}</div><p class="journal-footnote">图片仅包含这一刻的纪念，不包含存档网址和房间信息。${canShare?'':'<br>保存后，可以把图片发给想分享的人。'}</p></div>`;
}
