import { normalizeMemoryJournal } from './memory-journal.js';
import { memoryJournalPanel, memoryCardPanel, memoryPresentation } from './memory-journal-ui.js';
import { createMemoryCard } from './memory-card.js';

export function createDiaryController({root,getState,saving=()=>false,dispatch,toast=()=>{},supplemental=()=>''}) {
  let tab='collection',filter='all',page=0,selected=null,url=null,blob=null,error='',signature='',generation=0,pending=null,message='',progressTimer=null;
  const state=()=>getState();
  const journal=()=>normalizeMemoryJournal(state().diary,state());
  const selectedEntry=()=>journal().entries.find(e=>e.id===selected);
  const canShare=()=>{try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[new File([''], '纪念卡.png',{type:'image/png'})]});}catch{return false;}};
  function cleanCard(){generation++;if(url)URL.revokeObjectURL(url);url=blob=null;error='';}
  function panel() { if(!progressTimer)progressTimer=setInterval(()=>{if(root.closest('dialog')?.open&&root.dataset.view==='diary'&&tab==='locked'&&!selected)refresh();},30_000);const e=selectedEntry();return e?memoryCardPanel(e,{url,error,canShare:canShare()}):memoryJournalPanel(state(),{tab,filter,page,saving:saving(),message})+supplemental(); }
  function draw() {
    if(root.dataset.view!=='diary')return;
    const scroll=root.closest('dialog')?.scrollTop||0,active=document.activeElement;
    const focus=active?.closest('[data-memory-favorite], [data-diary-tab], [data-diary-filter]');
    const selector=focus?.dataset.memoryFavorite?`[data-memory-favorite="${focus.dataset.memoryFavorite}"]`:focus?.dataset.diaryTab?`[data-diary-tab="${focus.dataset.diaryTab}"]`:focus?.dataset.diaryFilter?`[data-diary-filter="${focus.dataset.diaryFilter}"]`:null;
    root.innerHTML=panel();if(root.closest('dialog'))root.closest('dialog').scrollTop=scroll;
    if(selector)root.querySelector(selector)?.focus({preventScroll:true});
  }
  function refresh() {
    if(pending && !saving()) {
      const saved=journal().favorites.includes(pending.id)===pending.favorite;
      message=saved?(pending.favorite?'已加入共同收藏 ♡':'已取消收藏，纪念仍保留在时光轴'):'收藏还未保存成功，请稍后重试';pending=null;
    }
    const key=JSON.stringify([tab==='locked'?Math.floor(Date.now()/30_000):null,state().diary,state().history,state().xp,state().coupleCare,state().feedingWindow,state().games?.match,saving(),message]);
    if(key!==signature){signature=key;draw();}
  }
  async function prepare(id) {
    selected=id;cleanCard();const token=generation;const e=selectedEntry();if(!e)return;
    draw();root.closest('dialog').scrollTop=0;
    try{const result=await createMemoryCard(e);if(token!==generation||selected!==id)return;blob=result;url=URL.createObjectURL(result);}
    catch(failure){if(token!==generation)return;error=failure.message||'卡片暂时没能生成，请重试';}
    draw();
  }
  function download() {
    if(!blob||!url)return;const e=selectedEntry(),link=document.createElement('a');link.href=url;link.download=`${e.catName}-${memoryPresentation(e).title.replace(/[\\/:*?"<>|]/g,'')}-纪念卡.png`;link.click();toast('纪念卡已生成，可以把图片分享给喜欢的人 ♡');
  }
  root.addEventListener('click',async event=>{
    if(root.dataset.view!=='diary')return;
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.diaryTab){tab=button.dataset.diaryTab;page=0;message='';draw();}
    else if(button.dataset.diaryFilter){filter=button.dataset.diaryFilter;if(button.hasAttribute('data-diary-show-all'))tab='collection';page=0;draw();}
    else if(button.dataset.diaryPage!==undefined){page=Math.max(0,Number(button.dataset.diaryPage)||0);draw();root.closest('dialog').scrollTop=0;}
    else if(button.dataset.memoryFavorite){
      const id=button.dataset.memoryFavorite,favorite=!journal().favorites.includes(id);
      if(dispatch({type:'diary-favorite',memoryId:id,favorite})){pending={id,favorite};message='正在保存共同收藏…';refresh();draw();}
    } else if(button.dataset.memoryCard){await prepare(button.dataset.memoryCard);}
    else if(button.dataset.memoryRetry){await prepare(button.dataset.memoryRetry);}
    else if(button.hasAttribute('data-diary-back')){selected=null;cleanCard();draw();root.closest('dialog').scrollTop=0;}
    else if(button.hasAttribute('data-memory-download'))download();
    else if(button.hasAttribute('data-memory-share')&&blob){
      try{await navigator.share({files:[new File([blob],'猫猫小窝-纪念卡.png',{type:'image/png'})],title:memoryPresentation(selectedEntry()).title});}
      catch(failure){if(failure.name!=='AbortError')toast('暂时无法直接分享，可以先保存图片');}
    }
  });
  return {panel,refresh,open(nextFilter='all'){tab='collection';filter=['together','fun','growth'].includes(nextFilter)?nextFilter:'all';page=0;selected=null;cleanCard();},close(){clearInterval(progressTimer);progressTimer=null;selected=null;pending=null;message='';signature='';cleanCard();}};
}
