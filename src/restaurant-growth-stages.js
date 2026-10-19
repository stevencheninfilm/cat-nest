/** Restaurant titles are presentation derived from the shared growth level.
 * They never grant XP or alter the resource/save progression. */
export const RESTAURANT_GROWTH_STAGES=Object.freeze([
  {id:'bistro',min:1,max:10,title:'小馆',stars:1,color:'#81a66c',light:'#e8f1b5',deep:'#527b50',edge:'#a4bd85',track:'#e1e8cc',bar:'linear-gradient(90deg,#72965f,#afc886,#e0eaa9)'},
  {id:'popular',min:11,max:20,title:'人气餐厅',stars:2,color:'#64a9c6',light:'#dbf5f7',deep:'#367e9d',edge:'#9acbd9',track:'#dbeaf0',bar:'linear-gradient(90deg,#4c95bb,#8bd0de,#d4f2ed)'},
  {id:'starred',min:21,max:30,title:'星级餐厅',stars:3,color:'#aa87c8',light:'#f5e8ff',deep:'#7958a3',edge:'#cbb0e2',track:'#e9e0f1',bar:'linear-gradient(90deg,#9470b8,#c4a4df,#f1d9f3)'},
  {id:'michelin',min:31,max:40,title:'米其林餐厅',stars:4,color:'#dfaa44',light:'#fff2b0',deep:'#ad7424',edge:'#e9c879',track:'#f1e5c5',bar:'linear-gradient(90deg,#ca9132,#efc95e,#fff0a7)'},
  {id:'flagship',min:41,max:50,title:'全球旗舰店',stars:5,color:'#cf88a1',light:'#fff0e9',deep:'#a5567e',edge:'#e8afc2',track:'#f0dfe8',bar:'linear-gradient(90deg,#bd759f,#e8aac4,#ecd4f4,#f6dcab)'},
].map(stage=>Object.freeze(stage)));

export function restaurantGrowthStage(level){
  const current=Number.isFinite(level)?Math.max(1,Math.floor(level)):1;
  return RESTAURANT_GROWTH_STAGES.find(stage=>current<=stage.max)||RESTAURANT_GROWTH_STAGES.at(-1);
}

export function restaurantGrowthStageStyle(level){
  const stage=restaurantGrowthStage(level);
  return Object.entries({color:stage.color,light:stage.light,deep:stage.deep,edge:stage.edge,track:stage.track,bar:stage.bar}).map(([key,value])=>`--rg-${key}:${value}`).join(';');
}
