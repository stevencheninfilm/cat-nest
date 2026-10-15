// Dialogue is local presentation only. Speaking never creates or collects growth.
export const CAT_DIALOGUE = Object.freeze({
  greeting: ['你回来啦，我等你好久啦～', '快靠近一点，我给你留了位置。', '今天的第一声呼噜，送给你♡', '闻到熟悉的味道啦，是你！', '尾巴摇好了，就等你回家喵。', '你一来，我的小窝就暖起来啦。'],
  idle: ['我把阳光踩软了，分你一半。', '今天也想和你贴贴喵～', '嘘，听见我的小呼噜了吗？', '我刚刚抓住了一小片阳光！', '你忙你的，我在这里陪着你。', '我的魔法？是让你开心一点。', '尾巴晃呀晃，都是喜欢你。', '把烦恼放门口，进来抱抱我。', '我有认真长大，也有认真想你。', '今天的小愿望：一直陪着你。'],
  pet: ['呼噜呼噜…就是这里，再摸摸♡', '我把小脑袋交给你啦。', '你的手暖暖的，我好喜欢。', '耳朵后面也想被摸摸喵。', '舒服得快要变成一摊小猫啦。', '我偷偷把这次摸摸记在心里了。', '再靠近一点，蹭蹭你的手～', '收到温柔啦，我也喜欢你！'],
  play: ['抓到啦！我是不是超厉害？', '看我的猫猫飞扑，嘿！', '刚才那一下，我差点就抓住啦！', '魔杖准备好，快乐变出来～', '我的小爪爪今天特别灵活！', '和你玩的时候，尾巴都停不下。', '这局算我赢，下次还找你玩♡', '呼，跑了一圈，开心装满啦。'],
  sleep: ['我先眯一会儿，梦里见喵…', '晚安，给我留一小块月亮吧。', '小爪子收好了，我要做美梦啦。', '呼噜…今天被爱得好满足。', '我会梦到你，还有一大碗小鱼。', '陪我安静一会儿，好不好…'],
  wake: ['睡饱啦！我的小爪爪又有力气了。', '伸个懒腰，第一眼就看见你♡', '我刚做了一个甜甜的小鱼梦！', '早呀，今天也一起攒快乐吧。', '充好电啦，想继续黏着你～'],
  dress: ['这身小装扮，我要穿给你看！', '我的小魔法，是不是更可爱了？', '转个圈圈，让你看看新衣服♡', '穿上你选的，我尾巴都翘起来啦。', '镜子说，今天的我也很神气喵。'],
  rename: ['{name}，我记住自己的新名字啦！', '以后叫我{name}，我就跑过来♡', '这个名字我喜欢，要多叫几遍喵。'],
  feeding: ['让我闻闻，今天有什么好吃的？', '小碗准备好啦，我坐乖乖。', '你挑的味道，我都想尝一口。', '我听见开饭的声音啦，喵！', '想和你一起，把今天吃得香香的。'],
  hungry: ['肚子咕噜了一声，你听见了吗？', '我在认真等一顿香香的小餐。', '要是有小鱼就好啦，眨眼。', '小肚子空空，想吃点好吃的。'],
  tired: ['我有一点点困，想靠着你歇歇。', '小爪爪跑累啦，抱抱再充电。', '哈欠…我的眼皮在打架啦。', '想把尾巴圈起来，打个小盹。'],
  lonely: ['今天想多蹭蹭你，可以吗？', '我把小脑袋伸过来啦，摸摸嘛。', '有你陪着，我就会开心一点。', '我攒了一肚子小呼噜，想给你听。'],
  full: ['肚子圆圆，心里也暖暖的♡', '吃饱饱啦，想和你一起晒太阳。', '小碗香香，我也乖乖。', '我把幸福装进小肚子里啦。'],
  collect: ['你的心意，我有好好收下喵♡', '一点点长大，都有你陪着我。', '看，我又朝你长大了一点点！', '我把这份喜欢，藏进小心心啦。'],
  morning: ['早呀，我把今天的第一声呼噜留给你。', '阳光进屋啦，陪我慢慢醒来喵。', '早安，今天也想和你一起长大。', '新的一天，从蹭蹭你的手开始♡'],
  evening: ['天色软下来啦，终于等到你陪我。', '忙了一天，来听一会儿我的呼噜吧。', '窗外慢慢暗了，小窝里还有我们。', '晚上的小魔法，是陪你把心放松。'],
  night: ['夜深啦，我轻轻陪着你。', '嘘，小魔杖也要休息啦。', '月亮替我们守着窗，我就在这里。', '慢一点，今晚只想安安静静地贴贴。'],
  comfort: ['有你摸摸，心里慢慢暖起来了。', '刚刚有点失落，现在想再靠近你一点。', '谢谢你发现我想被陪着喵。', '把小脑袋交给你，我就安心啦。'],
  gentlePet: ['困困的，也想轻轻蹭蹭你的手。', '呼噜…我眯着眼也知道是你。', '摸摸收到啦，让我慢慢充电。', '小爪子累了，靠着你就很好。'],
  gentlePlay: ['我慢慢追，你也慢一点点喵。', '小魔杖轻轻挥，陪你玩一小会儿。', '今天想玩温柔一点的游戏。', '追两步就歇歇，有你陪着就开心。'],
});

export const FOOD_DIALOGUE = Object.freeze({
  snack: ['小鱼咔嚓咔嚓，好香呀！', '这一口脆脆的，我喜欢喵。', '我闻见小鱼啦，胡须都翘起来了。', '小鱼吃进肚，快乐藏不住♡'],
  meal: ['一口一口吃，我会好好长大。', '猫粮香香，今天也要吃光光！', '我有乖乖吃饭，给你看看小碗。', '你准备的饭，我吃得特别香♡'],
  fish: ['罐罐打开了，我的快乐也打开啦！', '鱼香跑进鼻子里，喵呜！', '我想把这口鲜鲜的味道记住。', '谢谢你的罐罐，碗底也要舔干净。'],
  chicken: ['肉肉软软的，我一口就喜欢上了。', '鸡胸肉好香，我要慢慢嚼。', '这一口肉肉，奖励我乖乖长大！', '吃到肉肉啦，给你一个小呼噜♡'],
  shrimp: ['虾虾鲜鲜的，我的耳朵都竖起啦。', '这口小虾，我要细细尝！', '我吃到海的味道了，喵呜。', '小碗里的虾虾，被我发现啦♡'],
  salmon: ['这一口鱼鱼，香到尾巴打圈圈！', '三文鱼软软的，我好喜欢。', '我先舔舔嘴，再认真吃一口。', '鱼鱼进肚，今天的快乐加倍啦。'],
  mousse: ['慕斯软乎乎，像吃了一小朵云。', '舔一口，嘴巴和心都甜甜的♡', '这个滑滑的味道，我记住啦。', '我的小舌头，停不下来啦！'],
  treat: ['肉条挤一点，我就再靠近一点。', '舔到最后一口，还想蹭蹭你的手。', '这一条小零食，是你的偏爱喵。', '被肉条收买啦，我今天更喜欢你♡'],
  water: ['咕嘟咕嘟，我有乖乖喝水喵。', '喝口水润润嗓子，再陪你说话。', '清清凉凉的，胡须都精神啦！', '小口喝水，做一只健康小猫♡'],
});

function dialogueKey(kind, state, action) {
  if (kind === 'feed') return Object.hasOwn(FOOD_DIALOGUE, action.food) ? `feed:${action.food}` : 'full';
  if (kind === 'sleep') return state.sleeping ? 'sleep' : 'wake';
  if (['pet', 'touch', 'play'].includes(kind)) {
    if (state.sleeping) return 'sleep';
    if (kind === 'play' && (state.energy < 30 || state.behaviorPeriod === 'night' || state.hunger < 35)) return 'gentlePlay';
    if (kind !== 'play' && state.energy < 30) return 'gentlePet';
    if (kind !== 'play' && state.mood < 40) return 'comfort';
    if (kind === 'touch') return 'pet';
  }
  if (kind === 'idle' || kind === 'greeting') {
    if (state.sleeping) return 'sleep';
    if (state.hunger < 35) return 'hungry';
    if (state.energy < 30) return 'tired';
    if (state.mood < 40) return 'lonely';
    if (state.behaviorPeriod === 'night') return 'night';
    if (kind === 'greeting') return state.behaviorPeriod === 'morning' ? 'morning' : 'greeting';
    if (state.behaviorPeriod === 'evening') return 'evening';
    if (state.hunger >= 90) return 'full';
  }
  return Object.hasOwn(CAT_DIALOGUE, kind) ? kind : 'idle';
}

/** A shuffle bag per context uses every line before recycling, without boundary repeats. */
export function createDialoguePicker(random = Math.random) {
  const bags = new Map();
  const last = new Map();
  return (kind, state = {}, action = {}, actor = null) => {
    const key = dialogueKey(kind, state, action);
    let bag = bags.get(key);
    if (!bag?.length) {
      const lines = key.startsWith('feed:') ? FOOD_DIALOGUE[action.food] : CAT_DIALOGUE[key];
      bag = [...lines];
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const next = Math.floor(Math.min(.999999, Math.max(0, random())) * (index + 1));
        [bag[index], bag[next]] = [bag[next], bag[index]];
      }
      if (bag.at(-1) === last.get(key)) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      bags.set(key, bag);
    }
    const template = bag.pop();
    last.set(key, template);
    let line = template.replaceAll('{name}', state.name || '糯米');
    // The cat still speaks in first person when the other caregiver acts.
    if (actor && !actor.mine && ['feed', 'pet', 'play', 'dress'].includes(kind)) {
      line = `${actor.name || '猫友'}，${line}`;
    }
    return line;
  };
}

export const SPEECH_HOLD_MS = 6000;
export const SPEECH_FADE_MS = 240;
export const SPEECH_CHARACTER_MS = 55;

/** Timers belong to the speech bubble alone; replacing a line cancels all old timers. */
export function createCatSpeech({ element, getState, canSpeak = () => true, random = Math.random,
  reducedMotion = () => false, schedule = setTimeout, cancel = clearTimeout }) {
  const text = element.querySelector('.speech-content');
  const measure = element.querySelector('.speech-text');
  const name = element.querySelector('.speech-name');
  const announcement = element.querySelector('.speech-announcement');
  const pick = createDialoguePicker(random);
  let running = false, typingTimer, holdTimer, fadeTimer, idleTimer;

  function clearLineTimers() {
    cancel(typingTimer); cancel(holdTimer); cancel(fadeTimer);
  }
  function queueIdle() {
    cancel(idleTimer);
    if (!running || !canSpeak()) return;
    // Leave a quiet gap between thoughts; accepted interactions always take priority.
    idleTimer = schedule(() => say('idle'), 28000 + random() * 17000);
  }
  function hide(immediate = false) {
    clearLineTimers();
    element.classList.remove('is-speaking', 'is-typing');
    announcement.textContent = '';
    const finish = () => { element.hidden = true; text.textContent = ''; };
    if (immediate || reducedMotion()) finish();
    else fadeTimer = schedule(finish, SPEECH_FADE_MS);
  }
  function say(kind, action = {}, actor = null) {
    clearLineTimers(); cancel(idleTimer);
    if (!running || !canSpeak()) { hide(true); return; }
    const state = getState();
    const line = pick(kind, state, action, actor);
    name.textContent = state.name || '糯米';
    element.dataset.mood = kind === 'sleep' && !state.sleeping ? 'wake' : state.sleeping ? 'sleep' : kind;
    element.hidden = false;
    element.classList.add('is-speaking');
    announcement.textContent = '';
    const characters = Array.from(line);
    let count = 0;
    function complete() {
      element.classList.remove('is-typing');
      announcement.textContent = `${state.name || '糯米'}说：${line}`;
      holdTimer = schedule(() => { hide(); queueIdle(); }, SPEECH_HOLD_MS);
    }
    function type() {
      if (!canSpeak()) { hide(true); return; }
      count += 1;
      text.textContent = characters.slice(0, count).join('');
      if (count < characters.length) typingTimer = schedule(type, SPEECH_CHARACTER_MS);
      else complete();
    }
    // Reserve the complete line's height to keep the bubble still while typing.
    measure.dataset.line = line;
    if (reducedMotion()) { text.textContent = line; complete(); }
    else { element.classList.add('is-typing'); type(); }
  }
  return {
    start() { running = true; say('greeting'); },
    say,
    sync() {
      if (!canSpeak()) { cancel(idleTimer); hide(true); }
      else if (running && element.hidden) queueIdle();
    },
    stop() { running = false; cancel(idleTimer); hide(true); },
  };
}
