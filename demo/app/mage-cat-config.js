// Only this curated, project-specific asset set is served by the backend.
export const MAGE_CAT_VERSION = 'mage-cat-v1';
export const MAGE_CAT_AUTHOR = { name:'Nekueda', url:'https://www.fab.com/listings/710bc3f3-6bfd-4942-9eea-c7af4901bf03' };
export const APPEARANCE_OPTIONS = {
  body: [{name:'午夜黑',color:'#383744'},{name:'雾灰色',color:'#727277'},{name:'奶油白',color:'#eee7dc'},{name:'暖橘色',color:'#d39b50'},{name:'可可棕',color:'#6e4035'}],
  clothes: [{name:'经典紫',color:'#73627f'},{name:'星光蓝',color:'#7dabc2'},{name:'薄荷绿',color:'#92b6a2'},{name:'玫瑰粉',color:'#be7c98'},{name:'暖金色',color:'#caa268'}],
  eyes: [{name:'琥珀',color:'#d9ad52'},{name:'海蓝',color:'#6ca2ce'},{name:'森林',color:'#86aa7c'}],
  wand: [{name:'星星金',color:'#ebd36c'},{name:'月光蓝',color:'#84b9ce'},{name:'花朵粉',color:'#d899c1'}],
};
export const DEFAULT_APPEARANCE = Object.freeze({body:0,clothes:0,eyes:0,wand:0});
export function normalizeAppearance(value) {
  return Object.fromEntries(Object.entries(APPEARANCE_OPTIONS).map(([key,choices])=>[key,Number.isInteger(value?.[key]) && value[key]>=0 && value[key]<choices.length ? value[key] : 0]));
}
export function validAppearance(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length===4 && Object.entries(APPEARANCE_OPTIONS).every(([key,choices])=>Object.hasOwn(value,key) && Number.isInteger(value[key]) && value[key]>=0 && value[key]<choices.length);
}
export const EYE_EXPRESSIONS = ['basic','excited','sad','angry','unamused','crying'];
export const UNIVERSAL_EYES = ['closed','happy','panic','tired','wink'];
export const MOUTHS = ['basic','happy','sad','angry','serious','surprised'];
export const MAGE_CAT_FILES = Object.freeze([
  'model.glb','body-normal.webp','body-ao.webp',
  ...Array.from({length:5},(_,i)=>`coat-${i}.webp`),
  ...Array.from({length:3},(_,i)=>`wand-${i}.webp`),
  ...Array.from({length:3},(_,i)=>`wand-emissive-${i}.webp`),
  ...Array.from({length:3},(_,i)=>EYE_EXPRESSIONS.map(name=>`eyes-${i}-${name}.webp`)).flat(),
  ...UNIVERSAL_EYES.map(name=>`eyes-${name}.webp`),
  ...MOUTHS.map(name=>`mouth-${name}.webp`),
]);
