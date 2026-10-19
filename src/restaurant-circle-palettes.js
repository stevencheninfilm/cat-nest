// Shared by the client and authoritative save reducer. UI colours never affect
// a recipe's timing, employee abilities or rewards.
const palette=(id,name,unlockLevel,background,border,caption,ink)=>Object.freeze({id,name,unlockLevel,background,border,caption,ink});
export const KITCHEN_CIRCLE_PALETTES=Object.freeze([
  palette('cream','奶油米黄',1,'#fff6d8','#cdb783','#fff8e4','#92764a'),
  palette('sky','晴空浅蓝',5,'#e0f1ff','#95b9d4','#edf7ff','#567e9a'),
  palette('mint','薄荷奶绿',10,'#e7f3e0','#a6bf91','#f0f8e9','#6c8757'),
  palette('peach','蜜桃奶橘',18,'#ffe7d9','#d6ab91','#fff1e8','#a27357'),
  palette('lilac','香芋淡紫',28,'#eee6ff','#b8a5d0','#f6f0ff','#81679a'),
]);
export const restaurantCirclePalette=id=>KITCHEN_CIRCLE_PALETTES.find(palette=>palette.id===id)||null;
export const kitchenCirclePalette=id=>restaurantCirclePalette(id)||KITCHEN_CIRCLE_PALETTES[0];
export const restaurantCirclePaletteUnlocked=(restaurant,palette,level)=>level>=palette.unlockLevel||Boolean(restaurant.ownedCirclePalettes?.includes(palette.id));
