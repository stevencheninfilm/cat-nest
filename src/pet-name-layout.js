/** Keep names centered until the growth badge requires a leftward adjustment. */
export function petNamePlacement({textWidth,titleWidth,bonusLeft=titleWidth,maxFontSize=16,minFontSize=11,padding=28,gap=4}) {
  const right=Math.max(1,Math.min(titleWidth,bonusLeft-gap));
  const availableText=Math.max(1,right-padding-1);
  const fontSize=Math.max(minFontSize,Math.min(maxFontSize,Math.floor(maxFontSize*Math.min(1,availableText/Math.max(1,textWidth))*100)/100));
  const naturalWidth=textWidth*fontSize/maxFontSize+padding;
  const width=Math.min(right,Math.ceil(naturalWidth));
  return {fontSize,width,offset:Math.min(0,right-(titleWidth+width)/2),wrap:naturalWidth>right};
}

export function createPetNameLayout({title,button,text,badge}) {
  let frame=0,signature='';
  function update() {
    frame=0;
    const bounds=title.getBoundingClientRect();
    if(!bounds.width)return;
    const bonus=badge?.getBoundingClientRect();
    const bonusLeft=bonus?.width ? bonus.left-bounds.left : bounds.width+4;
    const maxFontSize=parseFloat(getComputedStyle(button).getPropertyValue('--pet-name-max-size'))||16;
    const nextSignature=JSON.stringify([text.textContent,bounds.width,bonusLeft,maxFontSize]);
    if(nextSignature===signature)return;
    signature=nextSignature;
    button.style.setProperty('--pet-name-font-size',`${maxFontSize}px`);
    button.style.setProperty('--pet-name-wrap','nowrap');
    const range=document.createRange();range.selectNodeContents(text);
    const placement=petNamePlacement({textWidth:range.getBoundingClientRect().width,titleWidth:bounds.width,bonusLeft,maxFontSize});
    button.style.setProperty('--pet-name-font-size',`${placement.fontSize}px`);
    button.style.setProperty('--pet-name-width',`${placement.width}px`);
    button.style.setProperty('--pet-name-offset',`${placement.offset}px`);
    button.style.setProperty('--pet-name-wrap',placement.wrap?'normal':'nowrap');
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  function fontsChanged(){signature='';schedule();}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  observer?.observe(title);if(badge)observer?.observe(badge);
  window.addEventListener('resize',schedule);
  document.fonts?.addEventListener('loadingdone',fontsChanged);
  document.fonts?.ready.then(fontsChanged);
  schedule();
  return {update:schedule,destroy(){observer?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.fonts?.removeEventListener('loadingdone',fontsChanged);}};
}
