import { GAMES } from './minigames.js';
import { TOUCH_GAMES } from './minigames-touch-rules.js';

export const gameAssetUrls=()=>[...Object.keys(GAMES).filter(game=>!TOUCH_GAMES.includes(game)).map(game=>`./assets/minigames/covers/${game}-v1.webp`),new URL('../public/assets/catbook/cats.png',import.meta.url).href];
/** Decode once when entering the game room; failures never block local play. */
export function createGamePreload({ImageClass=globalThis.Image}={}){
  let task;const images=[];
  return ()=>task||=Promise.allSettled(gameAssetUrls().map(url=>new Promise(resolve=>{
    if(!ImageClass){resolve();return;}const image=new ImageClass();images.push(image);image.decoding='async';image.onload=()=>{Promise.resolve(image.decode?.()).catch(()=>{}).finally(resolve);};image.onerror=resolve;image.src=url;
  })));
}
