import { TOUCH_INFO, TOY_PEEK_MS, teaserTarget, treatDrop, hiddenToyCell, touchPoint } from './minigames-touch-rules.js';

const svg=(body,cls='')=>`<svg class="${cls}" viewBox="0 0 160 160" fill="none" aria-hidden="true">${body}</svg>`;
const fish=()=>svg('<path d="m119 81 28-24v48z" fill="#DBA65E"/><ellipse cx="74" cy="81" rx="47" ry="29" fill="#EDBF77"/><path d="m66 56 13 23-13 26M85 57l12 23-12 25" stroke="#D79E56" stroke-width="5"/><circle cx="45" cy="76" r="5" fill="#785642"/>');
const feather=()=>svg('<path d="M26 140 105 49" stroke="#B89068" stroke-width="6" stroke-linecap="round"/><path d="M53 105C27 77 73 12 126 18c10 48-30 99-73 87Z" fill="#B9CBA8"/><path d="m53 105 61-72M63 93l-5-28m18 13 25-2m-13-15-1-23" stroke="#F4F2D8" stroke-width="4" stroke-linecap="round"/>');
const leaf=()=>svg('<path d="M34 126C8 52 76 21 133 27c-3 74-43 116-99 99Z" fill="#A6BB8C"/><path d="m35 126 69-66M57 104l-4-31m28 8 24-1" stroke="#E1E9C8" stroke-width="5" stroke-linecap="round"/>');
const paw=()=>svg('<ellipse cx="80" cy="104" rx="34" ry="25" fill="currentColor"/><ellipse cx="40" cy="68" rx="15" ry="20" transform="rotate(-25 40 68)" fill="currentColor"/><ellipse cx="70" cy="44" rx="14" ry="20" fill="currentColor"/><ellipse cx="103" cy="47" rx="14" ry="20" transform="rotate(15 103 47)" fill="currentColor"/><ellipse cx="128" cy="72" rx="13" ry="19" transform="rotate(30 128 72)" fill="currentColor"/>');
const kitten=()=>svg('<ellipse cx="80" cy="140" rx="48" ry="9" fill="#8B71552B"/><path d="m37 70-7-43 35 18m58 25 7-43-35 18" fill="#4C4650" stroke="#4C4650" stroke-width="7" stroke-linejoin="round"/><path d="m39 54-4-17 17 11m69 6 4-17-17 11" fill="#CE939C"/><ellipse cx="80" cy="113" rx="32" ry="31" fill="#544B58"/><ellipse cx="80" cy="78" rx="52" ry="42" fill="#544B58"/><ellipse cx="58" cy="76" rx="13" ry="18" fill="#E5BA72"/><ellipse cx="102" cy="76" rx="13" ry="18" fill="#E5BA72"/><ellipse cx="62" cy="75" rx="7" ry="14" fill="#453946"/><ellipse cx="98" cy="75" rx="7" ry="14" fill="#453946"/><circle cx="57" cy="69" r="4" fill="#FFF8E7"/><circle cx="94" cy="69" r="4" fill="#FFF8E7"/><path d="m75 92 5 5 5-5m-15 9q5 7 10-2 5 9 10 2" stroke="#DB9DA7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 112q30 17 60 0" stroke="#BFB1CF" stroke-width="8"/><path d="m69 120 11 11 11-11" fill="#F5E5CB"/><ellipse cx="59" cy="137" rx="14" ry="7" fill="#65596A"/><ellipse cx="101" cy="137" rx="14" ry="7" fill="#65596A"/>','touch-kitten-art');
export function touchCoverMarkup(game){
  return `<span class="touch-cover touch-cover-${game}" aria-hidden="true"><i class="touch-cover-orbit"></i><span class="touch-cover-cat">${kitten()}</span><span class="touch-cover-object">${game==='teaser'?feather():game==='treats'?fish():paw()}</span><i class="touch-cover-spark">✧</i></span>`;
}
export function toyGuideMarkup(phase='look',wrong=null){
  const found=phase==='done',look=phase==='look';
  return `<div class="toy-guide" data-toy-guide><small class="toy-guide-eyebrow">不计时练习 · 不消耗次数</small><h3>${look?'① 先看：小鱼在中间':found?'③ 找到啦！你学会了':'② 再找：点刚才的软垫'}</h3><p>${look?'记住小鱼玩具的位置。准备好后，再亲手把它盖起来。':found?'正式游戏有 6 个软垫：每轮先看 2 秒，再找回小鱼。':'小鱼盖住了！试着点中间的软垫，把它找回来。'}</p><div class="toy-guide-board">${[0,1,2].map(n=>`<button data-toy-guide-cell="${n}" ${look||found?'disabled':''} class="${n===1&&(look||found)?'is-revealed':''} ${wrong===n?'is-empty':''}" aria-label="练习第 ${n+1} 个软垫${n===1&&(look||found)?'，小鱼在这里':''}"><span class="touch-hidden-fish">${fish()}</span><span class="touch-pillow"><i>${['☾','✧','♡'][n]}</i></span><small>${n+1}</small></button>`).join('')}</div><p class="toy-guide-feedback" role="status">${wrong!==null?'这里空空的，再试试刚才中间的软垫。':found?'找到 3 次并完成正式陪玩，可得 10 点成长。':look?'看见了吗？小鱼在第 2 个软垫。':'现在可以点软垫了。练习可以慢慢来。'}</p>${look?'<button class="toy-guide-primary" data-toy-guide-cover>记住了，盖起来</button>':found?'<button class="toy-guide-primary" data-toy-guide-start>开始 40 秒陪玩</button>':''}${!found?'<button class="toy-guide-skip" data-toy-guide-start>我会玩了，直接开始</button>':''}</div>`;
}
export function touchSurfaceMarkup(game,{home=false}={}){
  const base=home?'':'<span class="touch-room-window" aria-hidden="true"></span><span class="touch-room-rug" aria-hidden="true"></span>';
  const scene=game==='teaser'?`<div class="touch-playfield touch-teaser" data-touch-surface="teaser" tabindex="0" role="group" aria-label="逗猫棒追逐区域，按住拖动羽毛经过爪印，也可用方向键移动">${base}<span class="touch-target" data-touch-target>${paw()}</span><span class="touch-kitten" data-touch-kitten>${kitten()}</span><span class="touch-wand" data-touch-wand>${feather()}</span><span class="touch-drag-hint">按住羽毛，拖向爪印</span></div>`:game==='treats'?`<div class="touch-playfield touch-treats" data-touch-surface="treats" tabindex="0" role="slider" aria-label="左右移动猫猫接零食，也可按左右方向键" aria-valuemin="0" aria-valuemax="31" aria-valuenow="16">${base}${[0,1,2].map(n=>`<span class="touch-drop" data-treat-drop="${n}" hidden><i>${fish()}</i><b>${leaf()}</b></span>`).join('')}<span class="touch-catcher" data-touch-catcher>${kitten()}<span class="touch-bowl"></span></span><span class="touch-drag-hint">左右拖动猫猫 · 小鱼要接，叶子躲开</span></div>`:`<div class="touch-hide-room"><p class="touch-peek" data-touch-peek>先记住小鱼的位置</p><div class="touch-hide-board" aria-label="六个藏玩具的软垫">${Array.from({length:6},(_,n)=>`<button data-arcade-move="${n}" aria-label="第 ${n+1} 个软垫"><span class="touch-hidden-fish">${fish()}</span><span class="touch-pillow"><i>${['☾','✧','♡','✿','☼','⋆'][n]}</i></span><small>${n+1}</small></button>`).join('')}</div><div class="touch-hide-rounds" data-touch-rounds aria-label="八轮寻找进度"></div></div>`;
  const content=home?scene.replaceAll(kitten(),''):scene;
  return `<div class="touch-game-scene">${content}<p class="touch-feedback" data-touch-feedback role="status" aria-live="polite">${TOUCH_INFO[game].hint}</p><p class="touch-goal" data-touch-goal></p></div>`;
}
const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
const animations=new WeakMap();
const position=(node,x,y)=>{const left=`${x}%`;if(node.style.left!==left)node.style.left=left;if(y!==undefined){const top=`${y}%`;if(node.style.top!==top)node.style.top=top;}};
const attr=(node,key,value)=>{if(node.getAttribute?.(key)!==value)node.setAttribute(key,value);};
export function touchStatusText(game,run,elapsed){
  if(game==='teaser')return `追到 ${run.hits} 次 · 跟上下一枚爪印`;
  if(game==='treats')return `接到 ${run.caught} 条小鱼 · 碰到 ${run.bumps} 片叶子`;
  return `第 ${Math.min(8,Math.floor(elapsed/5000)+1)} / 8 轮 · 找到 ${run.found} 次`;
}
export function drawTouchGame(stage,game,run,elapsed,seed,enabled){
  const goal=game==='teaser'?[run.hits,5]:game==='treats'?[run.caught,3]:[run.found,3];
  text(stage.querySelector('[data-touch-goal]'),`${goal[0]} / ${goal[1]} ${game==='treats'?'条小鱼':'次'} · ${goal[0]>=goal[1]&&(game!=='treats'||run.inputs>=3)?'完成本局即可获得成长':`达到目标，完成本局可得 ${TOUCH_INFO[game].xp} 成长`}`);
  const feedback=stage.querySelector('[data-touch-feedback]');
  const previous=stage.dataset.touchFeedback;
  let key,message;
  if(game==='teaser'){
    const slot=Math.min(29,Math.floor(elapsed/1500)),target=teaserTarget(seed,slot),p=touchPoint(run.point);
    const targetNode=stage.querySelector('[data-touch-target]');position(targetNode,target.x/31*100,target.y/31*100);targetNode.classList.toggle('is-caught',run.hitSlots.includes(slot));
    for(const selector of ['[data-touch-wand]','[data-touch-kitten]']){const node=stage.querySelector(selector);position(node,p.x/31*100,p.y/31*100);}
    key=`${run.hits}`;message=run.hits?'追到啦！小猫扑了一下 · +10 分':'按住羽毛，划过发光的爪印';
  }else if(game==='treats'){
    const catcher=stage.querySelector('[data-touch-catcher]');position(catcher,run.basket/31*100);
    attr(stage.querySelector('[data-touch-surface]'),'aria-valuenow',String(run.basket));
    const current=Math.floor((elapsed-800)/1000);
    stage.querySelectorAll('[data-treat-drop]').forEach((node,n)=>{const index=current-n,d= index>=0&&index<29?treatDrop(seed,index):null,progress=d?(elapsed-d.spawn)/1200:-1;node.hidden=!d||progress<0||progress>=1||index<=run.resolved;if(!node.hidden){position(node,d.x/31*100,8+progress*69);node.classList.toggle('is-leaf',d.leaf);}});
    key=`${run.caught}:${run.missed}:${run.bumps}`;message=run.bumps&&previous?.split(':')[2]!==String(run.bumps)?'是叶子呀，挪开一点再接 · −2 分':run.caught&&previous?.split(':')[0]!==String(run.caught)?'接到小鱼！猫猫好开心 · +10 分':run.missed?'差一点，再接下一条小鱼':'左右拖动猫猫，接小鱼、躲叶子';
  }else{
    const round=Math.min(7,Math.floor(elapsed/5000)),phase=elapsed%5000,target=hiddenToyCell(seed,round),peek=phase<TOY_PEEK_MS,solved=run.solved.includes(round),tries=run.attempted.filter(n=>Math.floor(n/6)===round).length;
    const waiting=solved||phase>=4800||tries>=2;
    text(stage.querySelector('[data-touch-peek]'),solved?'✓ 找到啦！等下一轮':peek?`① 记住位置 · ${Math.ceil((TOY_PEEK_MS-phase)/1000)} 秒`:waiting?'这一轮结束，看看小鱼在哪':'② 点软垫寻找 · 还可试 '+(2-tries)+' 次');
    stage.querySelectorAll('[data-arcade-move]').forEach((node,n)=>{const tried=run.attempted.includes(round*6+n);node.classList.toggle('is-revealed',(peek||waiting)&&n===target);node.classList.toggle('is-memory-target',peek&&n===target);node.classList.toggle('is-empty',tried&&n!==target);const disabled=!enabled||peek||waiting||tried;if(node.disabled!==disabled)node.disabled=disabled;attr(node,'aria-label',`第 ${n+1} 个软垫${peek&&n===target?'，小鱼在这里':tried?n===target?'，找到小鱼':'，空空的':''}`);});
    const rounds=stage.querySelector('[data-touch-rounds]');const stamp=`${round}:${run.solved.join(',')}`;if(rounds.dataset.stamp!==stamp){rounds.dataset.stamp=stamp;rounds.innerHTML=Array.from({length:8},(_,n)=>`<i class="${run.solved.includes(n)?'is-found':n===round?'is-current':''}">${run.solved.includes(n)?'✓':n+1}</i>`).join('');}
    key=`${round}:${peek}:${run.found}:${run.wrong}`;message=solved?'找到小鱼玩具！猫猫好开心 · +10 分':peek?'看发光的位置，记住小鱼在哪个软垫下面':tries===1?'这里空空的，再点一次刚才藏小鱼的软垫':tries>=2?'小鱼在这里，下一轮再来试试':'小鱼盖住了！点刚才发光的那个软垫';
  }
  if(previous!==key){stage.dataset.touchFeedback=key;text(feedback,message);if(previous!==undefined&&feedback.animate){animations.get(feedback)?.cancel();animations.set(feedback,feedback.animate([{opacity:.6,transform:'translateY(2px)'},{opacity:1,transform:'none'}],{duration:180}));}}
}
