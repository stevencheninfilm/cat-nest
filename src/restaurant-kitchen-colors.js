import { restaurantLockedAttributes, restaurantLockIcon } from './restaurant-locked-ui.js';
import { KITCHEN_CIRCLE_PALETTES, kitchenCirclePalette, restaurantCirclePaletteUnlocked } from './restaurant-circle-palettes.js';
export { KITCHEN_CIRCLE_PALETTES, kitchenCirclePalette } from './restaurant-circle-palettes.js';
export const kitchenCircleStyle=id=>{
  const palette=kitchenCirclePalette(id);
  return `--rk-circle-bg:${palette.background};--rk-circle-border:${palette.border};--rk-circle-caption:${palette.caption};--rk-circle-ink:${palette.ink}`;
};
const propUrl=()=>new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/kitchen-v1/seasonings.webp`,globalThis.document?.baseURI||import.meta.url).href;

export function kitchenPaletteMarkup(info){
  const selected=kitchenCirclePalette(info.restaurant.circlePalette).id;
  return `<section class="rk-palette-options" aria-label="操作圈配色"><header><strong>操作圈配色</strong><small>等级解锁 · 免费切换</small></header><div class="rk-palette-grid" role="group" aria-label="选择操作圈配色">${KITCHEN_CIRCLE_PALETTES.map(palette=>{
    const unlocked=restaurantCirclePaletteUnlocked(info.restaurant,palette,info.level),active=palette.id===selected;
    return `<button type="button" data-r-action="palette" data-r-palette="${palette.id}" ${restaurantLockedAttributes(!unlocked)} aria-label="${unlocked?`切换为${palette.name}操作圈`:`${palette.name}操作圈，小馆 ${palette.unlockLevel} 级解锁`}" aria-pressed="${active}" ${unlocked?'':'disabled'} style="${kitchenCircleStyle(palette.id)}"><span class="rk-palette-sample" aria-hidden="true"><img src="${propUrl()}" alt="" draggable="false"/><svg viewBox="0 0 60 60"><circle class="rk-palette-track" cx="30" cy="30" r="27"/><circle class="rk-palette-fill" cx="30" cy="30" r="27"/></svg><b>2s</b></span><strong>${palette.name}</strong><small>${!unlocked?restaurantLockIcon():''}${active?'使用中':unlocked?'可切换':`Lv.${palette.unlockLevel}`}</small></button>`;
  }).join('')}</div></section>`;
}
