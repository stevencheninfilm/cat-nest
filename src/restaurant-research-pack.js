/** 灵感手札 presentation for the research reveal: a sealed foil notebook that
 * tears open, ribbon/confetti particles, and the "集齐" fragment banner.
 * Pure presentation — it never reads or changes saved research, and every
 * effect is a no-op outside a real DOM (node tests) or under reduced motion. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let uid=0;

export const restaurantResearchAtelier=()=>{
  try{return new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/research-v2/atelier.jpg`,globalThis.document?.baseURI||import.meta.url).href;}
  catch{return '';}
};

function mascot(u){
  return `<g class="rr-pack-mascot" transform="translate(150 218)"><circle r="66" fill="url(#rrp-mh${u})"/><circle r="58" fill="none" stroke="#e9cf8f" stroke-width="1.4" stroke-dasharray="3 4" opacity=".8"/><ellipse cx="0" cy="44" rx="54" ry="11" fill="#fffdf6" stroke="#e4cfa6" stroke-width="2"/><path d="M-40 40 L-31 -12 Q0 -22 31 -12 L40 40 Q0 50 -40 40Z" fill="url(#rrp-mb${u})" stroke="#d49a3e" stroke-width="2.6" stroke-linejoin="round"/><path d="M-31 -12 Q0 -24 31 -12 L32 -4 Q27 4 21 -2 Q15 10 7 0 Q-1 12 -9 0 Q-17 8 -23 -2 Q-29 4 -32 -4Z" fill="url(#rrp-mc${u})" stroke="#9c5121" stroke-width="2" stroke-linejoin="round"/><ellipse cx="-24" cy="12" rx="3.6" ry="11" fill="#fff" opacity=".55"/>${[-13,13].map(x=>`<g class="rr-pack-eye"><ellipse cx="${x}" cy="15" rx="7.4" ry="8.4" fill="#fff" stroke="#3a2618" stroke-width="1.8"/><g class="rr-pack-pupil"><circle cx="${x}" cy="16" r="4.4" fill="#3a2618"/><circle cx="${x+1.4}" cy="14" r="1.5" fill="#fff"/></g><ellipse class="rr-pack-lid" cx="${x}" cy="15" rx="8.4" ry="9.4" fill="#f6cf74"/></g>`).join('')}<path d="M-4.5 27 Q0 31 4.5 27" fill="none" stroke="#3a2618" stroke-width="2" stroke-linecap="round"/><ellipse cx="-25" cy="26" rx="5" ry="3" fill="#ff9f9f" opacity=".55"/><ellipse cx="25" cy="26" rx="5" ry="3" fill="#ff9f9f" opacity=".55"/></g>`;
}

/** The sealed notebook laid over the card back. count is 1 or 10. */
export function restaurantResearchPackMarkup(count=1){
  const u=++uid,holo=id=>`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="408" spreadMethod="reflect"><stop offset="0" stop-color="#fbeed2"/><stop offset=".22" stop-color="#f6cdd0"/><stop offset=".45" stop-color="#ddcff2"/><stop offset=".66" stop-color="#c7ebe0"/><stop offset=".85" stop-color="#f7e2a8"/><stop offset="1" stop-color="#fbeed2"/><animateTransform attributeName="gradientTransform" type="translate" values="-150 -90;150 90;-150 -90" dur="7s" repeatCount="indefinite"/></linearGradient>`;
  let jag='M12 64';for(let x=12;x<288;x+=8)jag+=` L${x+4} ${60+((x/8)%2?7:1)} L${Math.min(288,x+8)} 64`;
  let top='M12 22';for(let x=12;x<288;x+=8)top+=` L${x+4} 4 L${x+8} 22`;
  let bottom='';for(let x=288;x>12;x-=8)bottom+=` L${x-4} 406 L${x-8} 386`;
  const body=`${jag} L288 64 L288 386${bottom} L12 386Z`,tag=count===10?'十连合订 · 灵感 300':'单册 · 灵感 30',foot=count===10?'菜谱碎片 · 10 份':'菜谱碎片 · 1 份';
  return `<span class="rr-pack" data-rr-pack aria-hidden="true"><span class="rr-pack-rays"></span><span class="rr-pack-glow"></span><span class="rr-pack-shadow"></span><span class="rr-pack-bob"><svg class="rr-pack-layer rr-pack-body" viewBox="0 0 300 408"><defs>${holo(`rrp-fo${u}`)}<linearGradient id="rrp-sh${u}" x1="0" y1="0" x2="1" y2=".25"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/><animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0;1 0" keyTimes="0;.6;1" dur="3.2s" repeatCount="indefinite"/></linearGradient><linearGradient id="rrp-sd${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a5530" stop-opacity=".28"/><stop offset=".12" stop-color="#7a5530" stop-opacity="0"/><stop offset=".88" stop-color="#7a5530" stop-opacity="0"/><stop offset="1" stop-color="#7a5530" stop-opacity=".32"/></linearGradient><linearGradient id="rrp-gd${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".5" stop-color="#d6a84f"/><stop offset="1" stop-color="#fbe3a0"/></linearGradient><radialGradient id="rrp-mh${u}"><stop offset="0" stop-color="#fffbea"/><stop offset=".7" stop-color="#ffe8b8" stop-opacity=".8"/><stop offset="1" stop-color="#ffe0a0" stop-opacity="0"/></radialGradient><linearGradient id="rrp-mb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b9"/><stop offset="1" stop-color="#f3c25c"/></linearGradient><linearGradient id="rrp-mc${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e09440"/><stop offset="1" stop-color="#a9561f"/></linearGradient><clipPath id="rrp-cp${u}"><path d="${body}"/></clipPath></defs><g clip-path="url(#rrp-cp${u})"><rect x="0" y="40" width="300" height="370" fill="url(#rrp-fo${u})"/><rect x="0" y="40" width="300" height="370" fill="url(#rrp-sd${u})"/><rect class="rr-pack-sheen" x="0" y="40" width="300" height="370" fill="url(#rrp-sh${u})"/><rect x="0" y="372" width="300" height="40" fill="#c9a463" opacity=".35"/></g><path d="${body}" fill="none" stroke="#c9a463" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="88" width="244" height="270" rx="16" fill="#fffaf0" fill-opacity=".62" stroke="url(#rrp-gd${u})" stroke-width="2.4"/><text x="48" y="128" font-weight="900" font-size="30" fill="#7a4f22" letter-spacing="2">灵感手札</text><g transform="translate(176 106)"><rect width="84" height="26" rx="13" fill="#5a3d27"/><rect x="1.5" y="1.5" width="81" height="23" rx="11.5" fill="none" stroke="#d6a84f" stroke-width="1.4"/><text x="42" y="17.5" text-anchor="middle" font-weight="700" font-size="10" fill="#f6dc99">${esc(tag)}</text></g>${mascot(u)}<text x="44" y="322" font-family="Georgia,serif" font-size="12" fill="#8a6a4d" letter-spacing="2.5">RECIPE NOTES</text><text x="256" y="322" text-anchor="end" font-weight="900" font-size="13" fill="#7a4f22">${esc(foot)}</text><line x1="44" y1="332" x2="256" y2="332" stroke="#d9bd84" stroke-width="1"/><text x="150" y="350" text-anchor="middle" font-size="9.5" fill="#a8834a" letter-spacing="2">猫猫餐厅研发室 · 必得菜谱碎片</text></svg><svg class="rr-pack-layer rr-pack-strip" viewBox="0 0 300 408"><defs>${holo(`rrp-fs${u}`)}</defs><path d="${top} L288 22 L288 66 L12 66Z" fill="url(#rrp-fs${u})" stroke="#c9a463" stroke-width="3" stroke-linejoin="round"/><rect x="12" y="4" width="276" height="18" fill="#c9a463" opacity=".35"/><line x1="18" y1="62" x2="282" y2="62" stroke="#fffaf0" stroke-width="2.6" stroke-dasharray="6 5"/><text x="26" y="47" font-family="Georgia,serif" font-weight="700" font-size="12.5" fill="#7a5530" letter-spacing="3.5">TEAR SEAL · 撕开</text><g transform="translate(258 42)"><circle r="12" fill="#c25b45" stroke="#8e3a2a" stroke-width="1.6"/><g fill="#fbe3d6"><ellipse cx="0" cy="2" rx="3.4" ry="2.8"/><circle cx="-4" cy="-3" r="1.4"/><circle cx="-1.4" cy="-5" r="1.4"/><circle cx="1.4" cy="-5" r="1.4"/><circle cx="4" cy="-3" r="1.4"/></g></g></svg><i class="rr-pack-seam"></i><i class="rr-pack-beam"></i></span></span>`;
}

/** The "集齐" banner appears only when the accepted single draw leaves this
 * recipe with enough fragments for its next grade. Numbers are the saved ones. */
export function restaurantResearchCollectMarkup(result){
  const recipe=result?.recipe;
  if(!recipe||recipe.upgradeCost===null||recipe.upgradeCost===undefined||recipe.fragments<recipe.upgradeCost)return '';
  const grades=['B','A','S','SS','SSS'],from=grades[recipe.level-1]??result.grade,to=grades[recipe.level]??'SSS';
  const note=recipe.researchUnlocked===false?`小馆 Lv.${esc(recipe.researchUnlockLevel)} 可研发`:'可以研发了';
  return `<div class="rr-collect-burst"></div><div class="rr-collect-ribbon"><b>集齐！</b><span class="rr-collect-shine"></span></div><div class="rr-collect-panel"><div class="rr-collect-row"><span class="rr-collect-icon"><span class="r-food r-food-${esc(recipe.id)}"></span></span><span class="rr-collect-name">${esc(recipe.name)} · 菜谱碎片</span><span class="rr-collect-num"><em>${recipe.fragments}</em> / ${recipe.upgradeCost}</span></div><div class="rr-collect-pips" style="--rr-pips:${recipe.upgradeCost}">${Array.from({length:recipe.upgradeCost},(_,index)=>`<i style="--rr-pip:${index}"></i>`).join('')}</div><div class="rr-collect-cta"><span class="rr-collect-grade" data-grade="${from}">${from}</span><span class="rr-collect-arrow">→</span><span class="rr-collect-grade" data-grade="${to}">${to}</span><span class="rr-collect-note">${note}</span></div></div>`;
}

const COLS=['#ffe08a','#fff6d8','#f4b7c8','#a8e3d9','#d6a84f','#c9b4e0','#ffd2a1','#f6b7a6'];
const BANDS=['#f6a6b8','#ffc08a','#ffe08a','#a8e3c8','#9fd3f0','#c9b4f0','#f6a6b8'];
const shade=(hex,k)=>{const n=parseInt(hex.slice(1),16);return `rgb(${Math.min(255,Math.round((n>>16)*k))},${Math.min(255,Math.round((n>>8&255)*k))},${Math.min(255,Math.round((n&255)*k))})`;};

/** Canvas particles and the mascot's eyes. Returns a no-op object without a DOM. */
export function createRestaurantResearchEffects(dialog,{reducedMotion=()=>false}={}){
  const noop={phase(){},collect(){},reset(){},destroy(){}};
  if(typeof HTMLElement==='undefined'||!(dialog instanceof HTMLElement)||typeof requestAnimationFrame!=='function')return noop;
  let canvas=null,ctx=null,parts=[],raf=0,W=0,H=0,pointer=null,eyesRaf=0;
  const timers=new Set();
  function mount(){
    const host=dialog.querySelector('.rr-discovery');
    if(!host)return false;
    if(canvas?.isConnected)return true;
    canvas=document.createElement('canvas');canvas.className='rr-fx';canvas.setAttribute('aria-hidden','true');host.append(canvas);ctx=canvas.getContext('2d');
    if(!ctx){canvas.remove();canvas=null;return false;}
    fit();return true;
  }
  function fit(){const d=Math.min(2,globalThis.devicePixelRatio||1);W=innerWidth;H=innerHeight;canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);}
  function run(){if(!raf)raf=requestAnimationFrame(step);}
  function rect(selector){const node=dialog.querySelector(selector);return node?.getBoundingClientRect?.()??null;}
  function confetti(x,y,n,spread=1){for(let i=0;i<n;i++){const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.4,s=(2+Math.random()*7)*spread;parts.push({k:Math.random()<.22?'star':Math.random()<.35?'paw':'rect',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2*spread,g:.15,r:Math.random()*6,vr:(Math.random()-.5)*.35,sz:3+Math.random()*5,c:COLS[i%COLS.length],life:1,dl:.006+Math.random()*.006});}}
  function sparks(x,y,n,c='#fff3c4'){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=3+Math.random()*9;parts.push({k:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,sz:1.5+Math.random()*2,c,life:1,dl:.025});}}
  function streamers(x,y,w){
    for(let i=0;i<9;i++){const c=BANDS[i%7],spread=(i-4)/4;parts.push({k:'band',x0:x+spread*w*.32,y0:y,ang:-Math.PI/2+spread*.55+(Math.random()-.5)*.12,c,c2:shade(c,.72),hi:shade(c,1.12),len:0,max:H*(.42+Math.random()*.28),bw:w*(.07+Math.random()*.04),amp:w*(.06+Math.random()*.05),ph:Math.random()*6,tw:.03+Math.random()*.02,t:0,delay:Math.abs(spread)*4+Math.random()*3,fall:0,life:1});}
    for(let i=0;i<30;i++){const a=-Math.PI/2+(Math.random()-.5)*2.2,s=4+Math.random()*7;parts.push({k:'curl',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,g:.12,r:Math.random()*6,vr:(Math.random()-.5)*.2,sz:10+Math.random()*12,c:BANDS[i%7],life:1,dl:.008+Math.random()*.004,ph:Math.random()*6});}
  }
  function star(x,y,s,c){ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?s*.35:s;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.fill();}
  function paw(x,y,s,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y+s*.3,s*.55,s*.45,0,0,7);ctx.fill();for(const [a,b] of [[-.55,-.25],[-.2,-.6],[.2,-.6],[.55,-.25]]){ctx.beginPath();ctx.arc(x+a*s,y+b*s,s*.22,0,7);ctx.fill();}}
  function step(){
    raf=0;if(!canvas?.isConnected){parts=[];return;}
    ctx.clearRect(0,0,W,H);parts=parts.filter(p=>p.life>0&&(p.k==='band'||p.y<H+80));
    for(const p of parts){
      if(p.k!=='band')continue;p.t++;if(p.t<p.delay)continue;
      const tt=p.t-p.delay;p.len+=(p.max-p.len)*.1;p.ph+=.22;if(tt>30){p.fall+=.6+(tt-30)*.08;p.life-=.022;}
      ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.4));
      const ux=Math.cos(p.ang),uy=Math.sin(p.ang),nx=-uy,ny=ux,N=Math.max(2,p.len/5|0);let pl=null,pr=null;
      for(let j=0;j<=N;j++){const s=j*5,u=s/(p.len||1),o=Math.sin(s*.035-p.ph)*p.amp*(.25+u),cx=p.x0+ux*s+nx*o,cy=p.y0+uy*s+ny*o+p.fall*u*u*1.4,tw=Math.cos(s*p.tw+p.ph*.6),half=p.bw*.5*(1-u*.55)*Math.max(.12,Math.abs(tw)),L=[cx+nx*half,cy+ny*half],R=[cx-nx*half,cy-ny*half];
        if(pl){ctx.fillStyle=tw>0?p.c:p.c2;ctx.beginPath();ctx.moveTo(pl[0],pl[1]);ctx.lineTo(L[0],L[1]);ctx.lineTo(R[0],R[1]);ctx.lineTo(pr[0],pr[1]);ctx.closePath();ctx.fill();
          if(tw>.55){ctx.strokeStyle=p.hi;ctx.lineWidth=Math.max(1,half*.35);ctx.beginPath();ctx.moveTo((pl[0]*2+pr[0])/3,(pl[1]*2+pr[1])/3);ctx.lineTo((L[0]*2+R[0])/3,(L[1]*2+R[1])/3);ctx.stroke();}}
        pl=L;pr=R;}
    }
    ctx.globalCompositeOperation='lighter';
    for(const p of parts){if(p.k!=='spark')continue;p.x+=p.vx;p.y+=p.vy;p.vx*=.94;p.vy*=.94;p.life-=p.dl;ctx.globalAlpha=Math.max(0,p.life);ctx.strokeStyle=p.c;ctx.lineWidth=p.sz;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*2.4,p.y-p.vy*2.4);ctx.stroke();}
    ctx.globalCompositeOperation='source-over';
    for(const p of parts){
      if(p.k==='band'||p.k==='spark')continue;
      p.vy+=p.g;const drag=p.k==='curl'?.97:.985;p.vx*=drag;p.vy*=drag;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.life-=p.dl;
      ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.5));
      if(p.k==='curl'){p.ph+=.2;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.strokeStyle=p.c;ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();for(let s=-p.sz;s<=p.sz;s+=2)ctx.lineTo(s,Math.sin(s*.4+p.ph)*3);ctx.stroke();ctx.restore();}
      else if(p.k==='star')star(p.x,p.y,p.sz*1.3,p.c);else if(p.k==='paw')paw(p.x,p.y,p.sz,p.c);
      else{ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.fillRect(-p.sz/2,-p.sz/4,p.sz,p.sz/2);ctx.restore();}
    }
    ctx.globalAlpha=1;if(parts.length)run();else ctx.clearRect(0,0,W,H);
  }
  function later(callback,ms){const id=setTimeout(()=>{timers.delete(id);if(dialog.open)callback();},ms);timers.add(id);}
  // The pudding on the notebook watches the player's pointer.
  function look(){eyesRaf=0;if(!pointer)return;for(const eye of dialog.querySelectorAll('.rr-pack-mascot')){const r=eye.getBoundingClientRect(),dx=pointer.x-(r.left+r.width/2),dy=pointer.y-(r.top+r.height*.6),d=Math.hypot(dx,dy)||1,k=Math.min(1,d/160)*3.2;for(const pupil of eye.querySelectorAll('.rr-pack-pupil'))pupil.setAttribute('transform',`translate(${(dx/d*k).toFixed(2)} ${(dy/d*k).toFixed(2)})`);}}
  function move(event){pointer={x:event.clientX,y:event.clientY};if(!eyesRaf)eyesRaf=requestAnimationFrame(look);}
  dialog.addEventListener('pointermove',move);
  return {
    phase(value){
      if(value==='brewing'){parts=[];return;}
      if((value!=='flipping'&&value!=='revealed')||reducedMotion()||!mount())return;
      if(value==='flipping'){
        const r=rect('[data-rr-pack]');if(!r)return;
        const x=r.left+r.width/2,y=r.top+r.height*.12,big=dialog.dataset.rrBatch==='true';
        streamers(x,y,r.width);confetti(x,y,big?170:120,1.15);sparks(x,y,60);run();
      }
      if(value==='revealed'){
        const r=rect('.rr-discovery-card');if(!r)return;
        later(()=>{sparks(r.left+r.width/2,r.top+r.height/2,36,'#fff3c4');run();},60);
      }
    },
    collect(){
      if(reducedMotion()||!mount())return;
      later(()=>{const r=rect('[data-rr-collect] .rr-collect-pips');if(r)sparks(r.right-8,r.top+r.height/2,40,'#ffe08a');confetti(W*.2,H*.72,60);confetti(W*.8,H*.72,60);run();},560);
    },
    reset(){for(const id of timers)clearTimeout(id);timers.clear();cancelAnimationFrame(raf);cancelAnimationFrame(eyesRaf);raf=eyesRaf=0;parts=[];pointer=null;canvas?.remove();canvas=null;ctx=null;},
    destroy(){this.reset();dialog.removeEventListener('pointermove',move);},
  };
}
