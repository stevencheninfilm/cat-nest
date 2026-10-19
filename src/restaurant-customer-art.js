import { RESTAURANT_GUESTS } from './restaurant-customers.js';
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function restaurantGuestSprite(id){
  const guest=RESTAURANT_GUESTS.find(item=>item.id===id),index=guest?.atlasIndex,rows=guest?.atlasRows??6;
  const atlas=guest?.atlasSet&&new URL(`${import.meta.env?.BASE_URL||'./'}assets/restaurant/${guest.atlasSet}/atlas.webp`,globalThis.document?.baseURI||import.meta.url).href;
  const style=index===undefined?'':` data-rg-customer="${id}" style="${esc(`background-image:url('${atlas}');--rg-rows:${rows};--rg-x:${index%4/3*100}%;--rg-front-y:${Math.floor(index/4)*2/(rows-1)*100}%;--rg-back-y:${(Math.floor(index/4)*2+1)/(rows-1)*100}%`)}"`;
  return `<span class="r-cat r-cat-${id}"${style} aria-hidden="true"></span>`;
}
