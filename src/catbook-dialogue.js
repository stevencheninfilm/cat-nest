import { COLLECTION_CATS, getCollectionCat, collectionSceneInvitation } from './cat-collection.js';
import { sceneCatPlacement, sceneAllowsCat } from './catbook-scenes.js';

const pair=(sceneId,a,b,lines)=>Object.freeze({id:`${sceneId}:${a}:${b}`,sceneId,members:Object.freeze([a,b]),lines:Object.freeze(lines.map((text,index)=>Object.freeze({speakerId:index%2 ? b : a,text})))});
export const CAT_DIALOGUE_PAIRS=Object.freeze([
  pair('station','cocoa','wheat',['你看，下一站会是什么地方？','有小鱼干的地方！','那我们坐在窗边，一起找找吧。','好呀，看到第一家就叫你。']),
  pair('station','porter','matcha',['今天的旅客都到齐了吗？','还有一杯热茶，留给最后来的朋友。','那我再等等，别让它错过这班车。','慢慢来，茶还暖着呢。']),
  pair('station','sunshine','velvet',['今天的阳光像蜂蜜一样。','我想把这个颜色画下来。','那我坐好，给你当小模特。','别动哦，你的尾巴也要入画。']),
  pair('station','tart','ashbean',['我的纸箱像一节小车厢。','那我的就是安静车厢。','下一站，小鱼干站！','到站记得轻轻叫醒我。']),
  pair('garden','chime','gozer',['你一直背对着我，在看什么呀？','桥下好像有一片会游泳的叶子。','那是小鱼吧？我的铃铛会吓到它吗？','轻轻响一下，它也许会来打招呼。']),
  pair('garden','gabriel','bubble',['里面舒服吗？要不要出来晒太阳？','这里像一朵软软的小云。','那我在上面替你守着阳光。','等我探出头，我们一起晒。']),
  pair('western','matcha','gabriel',['走了这么远，来喝口茶吧。','可以加一点西部的阳光吗？','已经加好了，还带一点仙人掌的影子。','那我慢慢喝，陪你看日落。']),
  pair('snow','wheat','pebble',['玻璃上有一朵小雪花。','我这边也有，我们比比谁的更圆。','嘘，别靠太近，会被呼吸融化。','那我们一起安静地看一会儿。']),
  pair('snow','porter','bubble',['小乘客，你的雪地专座暖和吗？','暖和！只是还缺一条小围巾。','下一趟我给你带来，蓝色的好吗？','好呀，和我的小桶一个颜色。']),
]);

const solo={
  callie:['这个角度刚好够我磨磨爪。','伸个懒腰，再往高处看看。'],
  cocoa:['窗外的小风景，每天都不一样。','我给你留了一个靠窗的位置。'],
  dottie:['毛线球，往这边滚一点！','你也想和我玩一小会儿吗？'],
  fred:['今天这碗饭也香香的。','等我吃完这口，再陪你玩。'],
  gabriel:['这里的风刚刚好。','坐在一起，发会儿呆吧。'],
  ginger:['翻个身，烦恼就掉下来啦。','我的毛线球有没有跑远？'],
  gozer:['那边好像有什么在动。','让我再仔细看看。'],
  mack:['把小爪子伸得长长的。','呼，今天也要舒舒服服。'],
  scout:['跟着我的小帽子，去探险吧。','前面会不会藏着小鱼干？'],
  mochi:['这颗铃铛是我最喜欢的宝贝。','叮铃，你听见了吗？'],
  onyx:['风把我的围巾吹起来啦。','我会在这里等你回来。'],
  biscuit:['慢慢来，今天还有好多时间。','靠近一点，听听小风的声音。'],
  pearl:['再伸一下，就能碰到云了。','你也来活动活动小爪子吧。'],
  sunshine:['把今天的阳光分你一半。','你的到来，让这里更暖和了。'],
  sprout:['抓到啦！刚才那片小影子。','再陪我玩一次嘛。'],
  velvet:['这里的颜色，适合画一张小画。','你的样子，我也想画下来。'],
  toast:['咬一小口，快乐一整天。','吃饱以后，陪我散散步吧。'],
  mint:['这阵风有薄荷的味道。','伸个懒腰，心情也松开啦。'],
  porter:['欢迎乘坐今天的快乐列车。','别着急，我会等每一位朋友。'],
  wheat:['小窗外有好多新鲜事。','你也来这里看看风景吧。'],
  pebble:['我在这个小角落等你。','刚刚好，能看见你过来。'],
  chime:['叮铃，今天也见到你啦。','我的铃铛只轻轻响一下。'],
  matcha:['给你留了一杯暖暖的茶。','坐一会儿，茶香会慢慢飘过来。'],
  crinkle:['沙沙，这个纸袋会说话。','再钻进去看看！'],
  cloudcap:['帽子有一点大，风景有一点远。','顶着小纸帽，慢慢走就好。'],
  acorn:['嘘，我发现了一个秘密角落。','尾巴留在外面，会被发现吗？'],
  bubble:['从这里探出头，世界刚刚好。','这是我的小窝，也欢迎你。'],
  tart:['这个小箱子，刚好装下我。','在这里窝着，连风都软软的。'],
  ashbean:['我眯着眼睛，也知道是你来了。','小声一点，我们一起歇歇。'],
  nightwatch:['今天的庭院，也由我守护。','嘘，忍者正在观察风的方向。'],
};

/** Ephemeral conversations: a tap advances one line; no progress is saved or timed. */
export function createCatDialogue() {
  let active=null, turn=null, currentScene=null;
  const rounds=new Map();
  const present=(scene,id,collection)=>sceneAllowsCat(scene,getCollectionCat(id)) && !!collectionSceneInvitation(collection,id,scene.id);
  const clear=()=>{active=null;turn=null;currentScene=null;};
  return {
    clear,
    current:()=>turn,
    next(scene,cat,collection) {
      if(currentScene!==scene.id) clear();
      currentScene=scene.id;
      if(!cat || !present(scene,cat.id,collection)) return null;
      if(active && active.pair.members.every(id=>present(scene,id,collection))) {
        const {pair,index}=active;
        turn={...pair.lines[index],kind:'pair',pairId:pair.id,step:index+1,total:pair.lines.length,sceneId:scene.id};
        active=index+1<pair.lines.length ? {pair,index:index+1} : null;
        return turn;
      }
      active=null;
      const pair=CAT_DIALOGUE_PAIRS.find(pair=>pair.sceneId===scene.id && pair.members.includes(cat.id));
      if(pair) {
        const buddy=pair.members.find(id=>id!==cat.id);
        if(!present(scene,buddy,collection)) {
          const name=getCollectionCat(buddy).name;
          turn={speakerId:cat.id,sceneId:scene.id,kind:'waiting',text:`${name}还没来呢，我给朋友留个位置。`};
          return turn;
        }
        active={pair,index:1};
        turn={...pair.lines[0],sceneId:scene.id,kind:'pair',pairId:pair.id,step:1,total:pair.lines.length};
        return turn;
      }
      const placement=sceneCatPlacement(scene,cat);
      const sleeping=['sleep','loaf','rest'].includes(placement.motion) || /睡觉|午睡|打盹/.test(placement.activity);
      const phrases=sleeping ? ['zzz…'] : solo[cat.id] || ['喵，你来啦。','今天也想和你待在一起。'];
      const key=`${scene.id}:${cat.id}`,index=rounds.get(key)||0;
      rounds.set(key,index+1);
      turn={speakerId:cat.id,sceneId:scene.id,kind:sleeping ? 'sleep' : 'solo',text:phrases[index%phrases.length]};
      return turn;
    },
  };
}

export function catSpeechMarkup(turn) {
  if(!turn) return '';
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const cat=COLLECTION_CATS.find(cat=>cat.id===turn.speakerId);
  return `<div class="book-speech-bubble" data-speech-kind="${turn.kind}"><strong>${esc(cat.name)}</strong><p>${esc(turn.text)}</p>${turn.kind==='pair' ? `<small>${turn.step<turn.total ? '点任意猫猫继续' : '聊完啦，再点点猫猫吧'} · ${turn.step} / ${turn.total}</small>` : ''}</div>`;
}
