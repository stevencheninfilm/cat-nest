import { memoryHash } from './memory-journal.js';

// Original, separately generated scenes. Selection is derived from the saved
// memory, so both people and the exported card always see the same artwork.
const artworks = {
  adoption: [new URL('./assets/memory-journal/v1/adoption.webp', import.meta.url).href, '小猫提着小篮子，迎接回家的双手'],
  anniversary: [new URL('./assets/memory-journal/v1/anniversary.webp', import.meta.url).href, '两个人为小猫系好纪念礼物的丝带'],
  growth: [new URL('./assets/memory-journal/v1/growth.webp', import.meta.url).href, '小猫与闪着微光的果冻爱心'],
  feed: [new URL('./assets/memory-journal/v1/feed.webp', import.meta.url).href, '小猫迎接刚刚端来的第一份餐食'],
  pet: [new URL('./assets/memory-journal/v1/pet.webp', import.meta.url).href, '手心轻轻落在小猫的头顶'],
  play: [new URL('./assets/memory-journal/v1/play.webp', import.meta.url).href, '小猫伸出爪爪追逐羽毛逗猫棒'],
  sleep: [new URL('./assets/memory-journal/v1/sleep.webp', import.meta.url).href, '小猫蜷在藤编小床里安心入睡'],
  dress: [new URL('./assets/memory-journal/v1/dress.webp', import.meta.url).href, '小猫在镜子前看看自己的新装扮'],
  name: [new URL('./assets/memory-journal/v1/name.webp', import.meta.url).href, '为小猫的围巾系上一枚心形名牌'],
  'duo-meal': [new URL('./assets/memory-journal/v1/duo-meal.webp', import.meta.url).href, '两个人一起为小猫摆好小餐桌'],
  'duo-relay': [new URL('./assets/memory-journal/v1/duo-relay.webp', import.meta.url).href, '两个人接力摸摸小猫和陪它玩耍'],
  'duo-goodnight': [new URL('./assets/memory-journal/v1/duo-goodnight.webp', import.meta.url).href, '两双手为小猫轻轻掖好晚安被角'],
  'duo-game': [new URL('./assets/memory-journal/v1/duo-game.webp', import.meta.url).href, '小猫陪两个人一起玩桌上的小游戏'],
  'fun-tail': [new URL('./assets/memory-journal/v1/fun-tail.webp', import.meta.url).href, '小猫回头看着弯成问号的尾巴'],
  'fun-purr': [new URL('./assets/memory-journal/v1/fun-purr.webp', import.meta.url).href, '小猫在针织软垫上舒服地踩奶'],
  'fun-patrol': [new URL('./assets/memory-journal/v1/fun-patrol.webp', import.meta.url).href, '小猫抬着爪爪巡视暖暖的小窝'],
  'fun-paw': [new URL('./assets/memory-journal/v1/fun-paw.webp', import.meta.url).href, '小爪爪轻轻按在打开的手心上'],
  'fun-stars': [new URL('./assets/memory-journal/v1/fun-stars.webp', import.meta.url).href, '小猫仰头看帽尖旁的一颗小星星'],
  'fun-snuggle': [new URL('./assets/memory-journal/v1/fun-snuggle.webp', import.meta.url).href, '小猫依偎着两个人温暖的手'],
  'fun-cloud': [new URL('./assets/memory-journal/v1/fun-cloud.webp', import.meta.url).href, '小猫在窗边把自己团成一朵云'],
  'fun-guard': [new URL('./assets/memory-journal/v1/fun-guard.webp', import.meta.url).href, '小猫守在暖灯下等着家人回来'],
  'fun-whiskers': [new URL('./assets/memory-journal/v1/fun-whiskers.webp', import.meta.url).href, '小猫的胡须碰到一片轻轻飘落的羽毛'],
  'fun-slow': [new URL('./assets/memory-journal/v1/fun-slow.webp', import.meta.url).href, '小猫在午后窗台上伸一个懒腰'],
  'fun-seat': [new URL('./assets/memory-journal/v1/fun-seat.webp', import.meta.url).href, '小猫坐在身边最喜欢的沙发角落'],
  'fun-pocket': [new URL('./assets/memory-journal/v1/fun-pocket.webp', import.meta.url).href, '小猫把温柔的小物件收进记忆口袋'],
};
const firstArt = { feed:'feed', pet:'pet', play:'play', sleep:'sleep', dress:'dress', rename:'name' };
const funArt = ['fun-tail','fun-purr','fun-patrol','fun-paw','fun-stars','fun-snuggle','fun-cloud','fun-guard','fun-whiskers','fun-slow','fun-seat','fun-pocket'];

export function memoryArtwork(entry) {
  let key;
  if (entry.kind === 'adoption' || entry.kind === 'anniversary') key = entry.kind;
  else if (entry.kind === 'level') key = 'growth';
  else if (entry.kind === 'first') key = firstArt[entry.occasion];
  else if (entry.kind === 'together') key = `duo-${entry.occasion}`;
  else if (entry.kind === 'game') key = 'duo-game';
  else if (entry.kind === 'fun') key = funArt[entry.variant];
  else if (entry.kind === 'legacy') {
    const text = entry.text || '';
    if (/喂|餐|吃|饮水/.test(text)) key = 'feed';
    else if (/摸|抚/.test(text)) key = 'pet';
    else if (/睡|休息|打盹/.test(text)) key = 'sleep';
    else if (/换装|装扮|衣/.test(text)) key = 'dress';
    else if (/取名|名字|改名/.test(text)) key = 'name';
    else if (/游戏|猜拳|翻牌|棋/.test(text)) key = 'duo-game';
    else if (/逗|玩/.test(text)) key = 'play';
    else key = ['fun-pocket','fun-patrol','fun-seat','fun-slow'][memoryHash(entry.id) % 4];
  }
  if (!Object.hasOwn(artworks, key)) key = 'fun-pocket';
  const [src, description] = artworks[key];
  return { key, src, description };
}
