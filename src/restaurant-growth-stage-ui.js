import { restaurantGrowthStage, restaurantGrowthStageStyle } from './restaurant-growth-stages.js';

/** All colors come from the fixed tier catalog; no saved style is interpolated. */
export function applyRestaurantGrowthStage(element,level){
  const stage=restaurantGrowthStage(level);
  for(const declaration of restaurantGrowthStageStyle(level).split(';')){
    const colon=declaration.indexOf(':');
    element.style.setProperty(declaration.slice(0,colon),declaration.slice(colon+1));
  }
  element.setAttribute('data-r-growth-stage',stage.id);
  return stage;
}

export function restaurantStageStars(level,{compact=false}={}){
  const stage=restaurantGrowthStage(level);
  return `<span class="rg-stars${compact?' is-compact':''}" role="img" aria-label="${stage.stars}星${stage.title}">${'<i class="rg-star" aria-hidden="true"></i>'.repeat(compact?1:stage.stars)}${compact?`<b aria-hidden="true">${stage.stars}</b>`:''}</span>`;
}
