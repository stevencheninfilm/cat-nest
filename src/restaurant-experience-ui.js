import { restaurantLevelInfo as levelInfo } from './growth-levels.js';
import { restaurantGrowthStage } from './restaurant-growth-stages.js';
import { applyRestaurantGrowthStage } from './restaurant-growth-stage-ui.js';

const number=value=>value.toLocaleString('zh-CN',{maximumFractionDigits:1});
const tenths=value=>Math.round(value*10)/10;
const valid=value=>value&&Number.isFinite(value.experience)&&value.experience>=0&&Number.isFinite(value.earnedExperience)&&value.earnedExperience>=0;

/** Animate actual earned XP only. Loading a save or migration credit is silent. */
export function restaurantExperienceGain(before,after){
  if(!valid(before)||!valid(after))return null;
  const earned=tenths(after.earnedExperience-before.earnedExperience);
  if(earned<=0||after.experience<before.experience)return null;
  const from=levelInfo(before.experience),to=levelInfo(after.experience);
  const segment=(level,fromExperience,experience,target)=>({level,fromExperience,experience,target,from:fromExperience/target,to:experience/target});
  // Batched offline collections can cross many levels: show the old bar fill
  // and the final level, keeping feedback bounded rather than queuing each level.
  const segments=from.level===to.level?[segment(to.level,from.progress,to.progress,to.target)]:[
    segment(from.level,from.progress,from.target,from.target),segment(to.level,0,to.progress,to.target),
  ];
  return {earned,fromLevel:from.level,level:to.level,levelsGained:to.level-from.level,segments};
}

function gainMarkup(gain,earned){
  const stage=restaurantGrowthStage(gain.level),newTitle=stage.id!==restaurantGrowthStage(gain.fromLevel).id;
  return `<div class="rx-gain-heading"><span>营业经验 <b data-r-gain-amount>+${number(earned)}</b></span>${gain.levelsGained?`<strong>${newTitle?`${stage.title} · `:''}升至 Lv.${gain.level}</strong>`:''}</div><div class="rx-gain-progress"><span data-r-gain-level>Lv.${gain.fromLevel}</span><div class="rx-gain-track" role="progressbar" aria-label="本次营业经验进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-r-gain-fill></i></div><span data-r-gain-value></span></div>`;
}

/** Transient HUD feedback. The controller observes the authoritative XP ledger;
 * it never grants XP, changes levels, or replays an old gain when reopened. */
export function createRestaurantExperience({container,setTimer=setTimeout,clearTimer=clearTimeout,requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id),reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}){
  let previous=null,running=false,earned=0,generation=0,dismissTimer=null,fadeTimer=null;
  const queue=[],timers=new Set(),frames=new Set();
  function later(callback,delay){
    const version=generation,id=setTimer(()=>{timers.delete(id);if(version===generation)callback();},delay);
    timers.add(id);return id;
  }
  function frame(callback){
    const version=generation,id=requestFrame(()=>{frames.delete(id);if(version===generation)callback();});
    frames.add(id);
  }
  function clearDismiss(){
    for(const id of [dismissTimer,fadeTimer])if(id!==null){clearTimer(id);timers.delete(id);}
    dismissTimer=fadeTimer=null;
    container.classList.remove('is-leaving');
  }
  function pump(){
    const gain=queue.shift();if(!gain)return;
    running=true;clearDismiss();container.hidden=false;
    container.innerHTML=gainMarkup(gain,earned);
    const fill=container.querySelector('[data-r-gain-fill]'),track=fill.parentElement;
    const label=container.querySelector('[data-r-gain-level]'),value=container.querySelector('[data-r-gain-value]');
    function animate(index){
      const segment=gain.segments[index],duration=reducedMotion()?0:gain.segments.length===1?720:index===0?380:600;
      applyRestaurantGrowthStage(container,segment.level);
      label.textContent=`Lv.${segment.level}`;value.textContent=`${number(segment.experience)} / ${number(segment.target)}`;
      fill.style.transition='none';fill.style.width=`${segment.from*100}%`;
      track.setAttribute('aria-valuenow',String(Math.round(segment.from*100)));
      track.setAttribute('aria-valuetext',`Lv.${segment.level}，${number(segment.experience)} / ${number(segment.target)} 经验`);
      frame(()=>frame(()=>{
        fill.style.transition=`width ${duration}ms cubic-bezier(.2,.7,.25,1)`;fill.style.width=`${segment.to*100}%`;
        track.setAttribute('aria-valuenow',String(Math.round(segment.to*100)));
        later(()=>{
          if(index+1<gain.segments.length){animate(index+1);return;}
          running=false;
          if(queue.length){pump();return;}
          dismissTimer=later(()=>{
            container.classList.add('is-leaving');
            fadeTimer=later(()=>{container.hidden=true;container.innerHTML='';container.classList.remove('is-leaving');earned=0;},180);
          },1400);
        },duration);
      }));
    }
    animate(0);
  }
  function reset(){
    generation++;
    for(const id of timers)clearTimer(id);
    for(const id of frames)cancelFrame(id);
    timers.clear();frames.clear();queue.length=0;
    previous=null;running=false;earned=0;dismissTimer=fadeTimer=null;
    container.hidden=true;container.innerHTML='';container.classList.remove('is-leaving');
  }
  function sync(progression){
    if(!valid(progression))return;
    const current={experience:progression.experience,earnedExperience:progression.earnedExperience};
    if(!previous){previous=current;return;}
    const before=previous;previous=current;
    if(current.experience<before.experience||current.earnedExperience<before.earnedExperience){reset();previous=current;return;}
    const gain=restaurantExperienceGain(before,current);if(!gain)return;
    clearDismiss();earned=tenths(earned+gain.earned);queue.push(gain);
    const amount=container.querySelector('[data-r-gain-amount]');if(amount)amount.textContent=`+${number(earned)}`;
    if(!running)pump();
  }
  return {sync,reset,destroy:reset};
}
