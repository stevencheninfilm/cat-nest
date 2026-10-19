import { createRestaurantAudio, RESTAURANT_AUDIO, RESTAURANT_MUSIC_CHOICES } from './restaurant-audio.js';

export const restaurantAudioIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></svg>';
const musicPicker=scene=>`<div class="ra-picker"><label for="ra-${scene}-track">${scene==='restaurant'?'营业配乐':'抽卡配乐'}</label><div><select id="ra-${scene}-track" data-ra-select="${scene}" aria-label="${scene==='restaurant'?'选择营业配乐':'选择抽卡配乐'}">${RESTAURANT_MUSIC_CHOICES[scene].map(id=>`<option value="${id}">${RESTAURANT_AUDIO[id].title}</option>`).join('')}</select><button data-r-audio-listen="${scene}" aria-label="${scene==='restaurant'?'试听营业配乐':'试听抽卡配乐'}">试听</button></div><small data-ra-description="${scene}"></small></div>`;
export const restaurantAudioMarkup=()=>`<dialog class="ra-dialog" aria-labelledby="ra-title"><header><div><small>CAT CAFÉ RADIO</small><h2 id="ra-title">小馆的声音</h2></div><button class="r-round" data-r-audio-close aria-label="关闭声音设置">×</button></header><div class="ra-now"><span aria-hidden="true">♫</span><div><strong data-ra-track></strong><small data-ra-status role="status" aria-live="polite"></small></div></div><div class="ra-library" role="group" aria-label="选择场景配乐">${musicPicker('restaurant')}${musicPicker('research')}</div><label class="ra-mute"><span>静音</span><input type="checkbox" data-ra-muted></label><label class="ra-volume"><span>背景音乐 <output data-ra-music-value></output></span><input type="range" min="0" max="100" step="1" data-ra-music aria-label="背景音乐音量"></label><label class="ra-volume"><span>操作音效 <output data-ra-effects-value></output></span><input type="range" min="0" max="100" step="1" data-ra-effects aria-label="操作音效音量"></label><div class="ra-previews"><button data-r-audio-preview="click">试听新按键音</button><button data-r-audio-preview="reveal">试听揭晓</button><button data-r-audio-retry>重新播放</button></div><p>选择后立即试听并记住。营业和抽卡分别设置；关闭窗口恢复当前场景配乐。切到后台或离开餐厅时暂停。</p></dialog>`;

export function createRestaurantAudioUI({container,preferences}){
  let restoreFocus=null;
  const $=selector=>container.querySelector(selector);
  function paint(state){
    const entry=$('[data-r-audio-open]');
    if(entry){entry.dataset.audioStatus=state.status;entry.title=`声音设置 · ${state.title}`;entry.setAttribute('aria-label',`声音设置，${state.muted?'已静音':state.title}`);}
    const dialog=$('.ra-dialog');if(!dialog)return;
    $('[data-ra-track]').textContent=state.title;
    $('[data-ra-status]').textContent=state.previewing&&state.status==='playing'?'试听中 · 关闭设置后恢复场景配乐':{playing:'正在播放',waiting:'点击任意按钮，开启小馆的声音',paused:'已暂停',muted:'已静音',unavailable:'音频暂未载入，点击重新播放重试',loading:'正在载入配乐…','music-off':'音乐音量为零，音效仍可播放'}[state.status];
    for(const scene of Object.keys(RESTAURANT_MUSIC_CHOICES)){
      const id=state[`${scene}Track`],select=$(`[data-ra-select="${scene}"]`),button=$(`[data-r-audio-listen="${scene}"]`);if(select.value!==id)select.value=id;
      $(`[data-ra-description="${scene}"]`).textContent=RESTAURANT_AUDIO[id].description;
      const previewing=state.previewing&&state.musicId===id;button.textContent=previewing?'结束试听':'试听';button.setAttribute('aria-pressed',String(previewing));
    }
    for(const key of ['music','effects']){const value=Math.round(state[key]*100);const input=$(`[data-ra-${key}]`);if(input.value!==String(value))input.value=value;$(`[data-ra-${key}-value]`).textContent=`${value}%`;}
    $('[data-ra-muted]').checked=state.muted;
  }
  const audio=createRestaurantAudio({preferences,onChange:paint});
  const activate=event=>{if(event.type==='keydown'&&!['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key))return;void audio.unlock();};
  function close(){const dialog=$('.ra-dialog');if(dialog?.open)dialog.close();audio.stopPreview();if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});restoreFocus=null;}
  function click(event){
    const button=event.target.closest('button');
    if(button?.hasAttribute('data-r-audio-open')){event.stopImmediatePropagation();restoreFocus=button;paint(audio.snapshot());$('.ra-dialog').showModal();void audio.unlock();return;}
    if(!event.target.closest('.ra-dialog'))return;
    event.stopImmediatePropagation();
    if(button?.hasAttribute('data-r-audio-close')){close();return;}
    if(button?.dataset.rAudioListen){const scene=button.dataset.rAudioListen;if(!Object.hasOwn(RESTAURANT_MUSIC_CHOICES,scene))return;const state=audio.snapshot(),id=state[`${scene}Track`];if(state.previewing&&state.musicId===id)audio.stopPreview();else{audio.previewMusic(id);void audio.unlock();}return;}
    if(button?.dataset.rAudioPreview){void audio.unlock().then(()=>audio.play(button.dataset.rAudioPreview));return;}
    if(button?.hasAttribute('data-r-audio-retry'))void audio.unlock();
    if(event.target===$('.ra-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}
  }
  function input(event){if(!event.target.closest('.ra-dialog'))return;event.stopImmediatePropagation();const target=event.target;if(target.matches('[data-ra-muted]'))audio.setSettings({muted:target.checked});for(const key of ['music','effects'])if(target.matches(`[data-ra-${key}]`))audio.setSettings({[key]:Number(target.value)/100});}
  function change(event){const scene=event.target.dataset.raSelect,id=event.target.value;if(!Object.hasOwn(RESTAURANT_MUSIC_CHOICES,scene)||!RESTAURANT_MUSIC_CHOICES[scene].includes(id))return;event.stopImmediatePropagation();audio.setSettings({[`${scene}Track`]:id});audio.previewMusic(id);void audio.unlock();}
  function cancel(event){if(event.target!==$('.ra-dialog'))return;event.preventDefault();event.stopImmediatePropagation();close();}
  function key(event){if(!$('.ra-dialog')?.open)return;event.stopImmediatePropagation();if(event.key==='Escape'){event.preventDefault();close();}}
  container.addEventListener('pointerdown',activate,true);container.addEventListener('keydown',activate,true);container.addEventListener('click',click,true);container.addEventListener('input',input,true);container.addEventListener('change',change,true);container.addEventListener('cancel',cancel,true);container.addEventListener('keydown',key,true);
  paint(audio.snapshot());
  return {...audio,paint:()=>paint(audio.snapshot()),closeSettings:close,destroy(){close();audio.destroy();container.removeEventListener('pointerdown',activate,true);container.removeEventListener('keydown',activate,true);container.removeEventListener('click',click,true);container.removeEventListener('input',input,true);container.removeEventListener('change',change,true);container.removeEventListener('cancel',cancel,true);container.removeEventListener('keydown',key,true);}};
}
