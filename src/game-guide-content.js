import { formatAffection } from './affection.js';
import { FOODS, FEEDING_BONUS, FEEDING_WINDOW_MS } from './state.js';
import { careRuleText, foodDurationText } from './care-ui.js';
import { needsDecayDescription, CARE_NEED_EFFECTS } from './pet-needs.js';
import { GAMES, GAME_DAILY_LIMIT } from './minigames.js';
import { TOUCH_GAMES, CAT_PLAY_UNLOCK_LEVEL, TOUCH_INFO } from './minigames-touch-rules.js';
import { FEATURE_UNLOCKS } from './feature-unlocks.js';

export const GUIDE_ASSET_ROOT = 'assets/game-guide/v1/';
export const GUIDE_IMAGES = ['welcome', 'care', 'growth', 'games', 'court', 'memories', 'catbook'];
const step = (title, body) => ({ title, body });
const open = (label, view) => ({ label, view });
const point = (label, target) => ({ label, target });

/** Instructions describe real entry points; reading never performs a care action. */
export function gameGuideChapters({ isTest = false } = {}) {
  return [
    {
      id:'welcome', group:'认识小窝', icon:'⌂', title:'欢迎回家，先认识小窝', short:'小窝全景', art:'welcome',
      summary:'养一只小猫，也把两个人的日常慢慢装进这个家。你可以按顺序读，也可以从目录挑想了解的功能。',
      entry:'右上角「新手手册」图标，或「设置 → 图文新手手册」',
      steps:[step('先认出三个区域','上方是猫爪币、亲密度、等级和身份；中间是可以互动的小猫；两侧和底部是各个功能入口。'),step('每天从照顾开始','看看饱饱、开心、活力，再挑一份食物、摸摸它或陪它玩。出现爱心成长气泡后，记得点击领取。'),step('再去发现喜欢的玩法','左侧小游戏可以独自玩，也能与伙伴联机。底部的猫猫判官帮助沟通，猫猫图鉴可以邀请新的朋友。')],
      tip:'第一次来，建议按「喂食 → 日常互动 → 收成长 → 小游戏」试一遍。每章的「找到入口」会在实际页面圈出位置。',
      links:[point('带我认识主页','home')],
    },
    {
      id:'identity', group:'认识小窝', icon:'♡', title:'选择身份，邀请另一位主人', short:'身份与邀请', art:'welcome',
      summary:'同一个小窝由两位主人共同照顾。先选自己的身份，再把这个小窝的邀请交给对方。',
      entry:'主页上方身份栏；设置 → 双人绑定与邀请',
      steps:[step('每次进入先选自己','选择男方或女方。两个人分别使用各自的身份，照顾记录、喂食冷却和对局席位才能分清是谁完成的。'),step('打开双人绑定与邀请','在设置里查看两位主人的状态，复制邀请链接，再自行发给伙伴。对方打开后选择另一身份。'),step('看实际加入状态','复制链接不等于对方已经加入。等对方真正进入，同窝主人状态才会更新；当前在线情况看主页身份栏。')],
      tip:isTest?'这里是测试调试存档，可以模拟伙伴；刷新恢复默认，测试进度不会写进正式小窝。':'请使用你们原来的小窝网址继续游戏，操作会在后台自动保存，异常时才提醒。更换浏览器时需要网络连接，才能取回云端进度。',
      links:[open('查看双人邀请','invite'),point('找到身份入口','identity')],
    },
    {
      id:'feeding', group:'每天照顾', icon:'◡', title:'喂食：挑一份合适的小餐', short:'喂食与餐盘', art:'care',
      summary:'先选食物，再确认喂食。餐盘会显示两位主人各自上桌的食物和剩余时间。',
      entry:'主页下方「喂食」，或小猫下方的食物预览',
      steps:[step('挑选食物','打开喂食页，在全部、主食、小零食、饮水之间切换。点击食物，看看价格、活力和冷却时间；「准备喂食」表示尚未上桌。'),step('点击「喂这个」','确认猫爪币足够、次数和冷却允许后，再点底部按钮。成功后食物进入共享餐盘，同时生成对应的成长气泡。'),step('查看两个人的喂养详情',`切到「喂养详情」看我和对方是否本轮已喂。首次喂食开启 ${FEEDING_WINDOW_MS / 3600000} 小时窗口，两人各喂一次且奖励次数可用时，本轮额外获得 ${formatAffection(FEEDING_BONUS)} 亲密度和 ${FEEDING_BONUS} 点成长。`)],
      tip:`${careRuleText('feed')}。喂食冷却按身份计算，并取决于这次选的食物；换食物不会跳过上一餐的冷却。饮水不增加饱饱。`,
      catalog:'foods', links:[open('打开喂食页','feeding'),point('找到喂食按钮','feeding')],
    },
    {
      id:'care', group:'每天照顾', icon:'✋', title:'摸摸、逗猫、休息', short:'日常互动', art:'care',
      summary:'两侧按钮能直接选择照顾方式。点小猫也能互动，先确认当前互动模式，慢慢陪它就好。',
      entry:'主页左侧「摸摸／逗猫」，右侧「休息」，以及小猫本身',
      steps:[step('温柔摸摸','点击左侧「摸摸」给它一点安慰。小猫的动作和说话是即时反馈；有成长奖励时，还要收下气泡。'),step('陪它玩一会儿','点击「逗猫」陪它追逗猫棒，可以获得猫爪币，并让它更开心；玩耍会消耗少量饱饱和活力，累了先休息。'),step('休息与叫醒',`点击右侧「休息」让小猫入睡，一次休息恢复 ${CARE_NEED_EFFECTS.sleep.energy} 活力。睡着时按钮可叫醒它；叫醒不消耗照顾次数，也没有额外成长。`)],
      tip:`${careRuleText('pet')}；${careRuleText('play')}；${careRuleText('sleep')}。这些次数由两人共享，冷却也共享。按钮的倒计时会说明何时可用。`,
      links:[point('找到互动按钮','care')],
    },
    {
      id:'needs', group:'每天照顾', icon:'☀', title:'看懂饱饱、开心与活力', short:'三项状态', art:'care',
      summary:'状态条告诉你小猫现在需要什么。照顾状态，也能让接下来产生的成长多一点。',
      entry:'小猫名字和成长条下方的「饱饱／开心／活力」',
      steps:[step('点击具体状态看方法','饱饱主要靠食物；开心可以通过摸摸、逗猫提升；活力可以通过喂食、饮水和休息补充。点每一项能看详细说明。'),step('照顾会随时间变化',`${needsDecayDescription()}，离线也会计算。看到数值下降，先补最需要的一项，不用反复刷新。`),step('认识成长加成','三项中每有一项大于 80，本次照顾的成长加 10%；最多三项合计加 30%。加成在生成气泡时计算，领取时不会再加一次。')],
      tip:'亲密度、当前状态和成长经验是不同的数值。想知道为什么某次成长多了一点，可以点成长加成标记查看。',
      links:[open('看看饱饱说明','need-hunger'),open('看看成长加成','growth-bonus'),point('找到三项状态','needs')],
    },
    {
      id:'growth', group:'每天照顾', icon:'✦', title:'收下爱心，让小猫长大', short:'成长与资源', art:'growth',
      summary:'成长气泡需要亲手领取。领取后经验才进入成长条，累计到门槛就能进入新的成长阶段。',
      entry:'主页爱心成长气泡、成长条；上方「Lv.」',
      steps:[step('照顾完成后找爱心','喂食、摸摸、逗猫、休息或达标的小游戏，可能留下待领取的成长气泡。看到气泡时点击，把这份心意收进成长条。'),step('留意领取与升级','气泡不会因为离开就自动消失，也不会自动入账。双方共享同一份气泡，任意一人领走后，另一人不会重复领取。'),step('区分三种资源','猫爪币用于买食物，逗猫可以获得；亲密度记录陪伴的心意；成长经验决定等级。点上方等级可预览阶段和进度。')],
      tip:'已经做过照顾但等级没变？先看看待领取气泡，再看成长条距离下一级还差多少。小游戏奖励也要领取。',
      links:[open('查看待领取成长','growth'),open('查看成长阶段','stages')],
    },
    {
      id:'together', group:'一起生活', icon:'∞', title:'双人协作：把照顾接力下去', short:'照顾足迹与默契', art:'welcome',
      summary:'不用同时在线，也能知道对方为小猫做了什么。一起完成接力，让日常留下共同回忆。',
      entry:'主页身份栏附近的伙伴动态；日记底部的照顾足迹入口',
      steps:[step('在「照顾足迹」看彼此','打开双人面板，查看谁在什么时候喂食、摸摸或陪玩。在线提示与已经完成的记录各有含义，不在线也可能照顾过。'),step('在「默契接力」接下一棒','按任务提示由一人先做、另一人完成后续。日常次数与冷却仍然适用，不能为完成任务绕过限制。'),step('在「共同回忆」留下纪念','完成条件后到回忆里重温，也能跳转日记查看对应纪念卡。纪念本身不额外发成长，双人喂养奖励仍按喂食规则计算。')],
      tip:'当天的照顾次数和部分奖励由小窝共同计算，以北京时间 0 点重置；跨日后仍要等尚未结束的冷却。',
      links:[open('打开双人照顾面板','shared-care')],
    },
    {
      id:'games', group:'一起玩耍', icon:'⚄', title:'小游戏：一个人或两个人都能玩', short:'小游戏全玩法', art:'games',
      summary:`游戏屋有 ${Object.keys(GAMES).length} 款小游戏。可以先从单人挑战开始，再与电脑或另一位主人一起玩。`,
      entry:'主页左侧「小游戏」',
      steps:[step('选游戏，再选模式','进入游戏屋，点喜欢的封面，选择单人挑战、对战电脑或双人联机。每局开始前会给出操作与达标要求。'),step('双人要分别发起和加入','两台手机进入同一小窝，分别选择男方和女方。一人发起双人对局，另一人在游戏屋加入，按回合提示操作。'),step('达标结算，再领成长',`限时游戏要满足本局要求；中途退出不发奖。双人完成额外 +5 成长，每日小窝合计最多 ${GAME_DAILY_LIMIT} 点小游戏成长，北京时间 0 点重置。结算后点击成长气泡领取。`)],
      tip:`「逗猫棒追逐」「接住小零食」「寻找小玩具」在小猫 Lv.${CAT_PLAY_UNLOCK_LEVEL} 解锁。它们与主页的日常「逗猫」是不同玩法。`,
      catalog:'games', links:[open('进入猫猫游戏屋','games'),point('找到小游戏入口','games')],
    },
    {
      id:'court', group:'一起生活', icon:'⚖', title:'猫猫判官：把事情说清楚', short:'判官与修复', art:'court',
      summary:'各自说经过和感受，再让猫猫听取双方信息，分析责任、整理下一步的约定。',
      entry:'右上角「设置 → 猫猫判官」',
      steps:[step('发起，或加入小法庭','点「发起审理」建立一次对话，把入席邀请自行发给对方；已收到邀请时点「加入小法庭」。'),step('两人分别认领席位并陈词','选择猫爪方或鱼干方，各自写清发生了什么、感受与期待，可选上传最多 4 张截图。提交前只自己可见，提交后本轮陈词锁定。'),step('双方提交后等待判词','只有两边都提交，才开始评理。读正式判词和一起修复；任务由双方各自确认完成。需要补充时，可按页面提示继续复议，旧轮记录保留。')],
      tip:isTest?'测试存档使用预设判词，可安全体验流程；不会调用真实 AI。':'截图先遮挡无关隐私。正式审理会把双方陈词与截图交给 OpenAI 分析；判词根据已提交的信息形成，信息不足时会说明。',
      links:[open('去看看猫猫判官','judge'),point('找到判官入口','court')],
    },
    {
      id:'diary', group:'把日子留下', icon:'▤', title:'成长日记：从足迹到纪念卡', short:'日记与收藏', art:'memories',
      summary:`小猫 Lv.${FEATURE_UNLOCKS.diary.level} 解锁日记。日常照顾留下足迹，达成主题条件会收下一张正式纪念卡。翻一翻，就能看见一起长大的日子。`,
      entry:'主页右侧「日记」',
      steps:[step('从「待解锁」找下一个目标','打开日记，在待解锁栏目查看具体主题与条件。按平常节奏照顾、成长或完成共同活动，达成后会留下纪念。'),step('区分卡册和时间轴','正式卡册每个主题只计一次；同主题重复纪念保留在时间轴，不重复增加卡册数量。日常足迹则记录近期照顾。'),step('收藏，或保存一张卡','点卡片右上角爱心加入共同收藏；打开纪念卡预览后点「保存图片」。支持系统分享的设备也可自行分享，取消收藏不会删除纪念。')],
      tip:'部分图鉴猫猫的解锁条件看的是正式卡册数量。时间轴里有很多条记录，并不代表已经收齐同样多的正式主题。',
      links:[open('翻开成长日记','diary'),point('找到日记入口','diary')],
    },
    {
      id:'catbook', group:'把日子留下', icon:'♧', title:'猫猫图鉴：邀请新的朋友', short:'图鉴与场景', art:'catbook',
      summary:`小猫 Lv.${FEATURE_UNLOCKS.collection.level} 解锁图鉴。在车站、庭院、露台、雪庭，以及冬日玻璃屋和三套夏日场景里，慢慢认识每只猫，也听它们说自己的故事。`,
      entry:'主页底部右侧「猫猫图鉴」',
      steps:[step('查条件，完成后邀请','在猫猫图鉴或陪伴成就里查看每只猫的具体条件与当前进度。解锁后，点击邀请，让它来到当前场景。'),step('季节猫友用鱼条解锁','新场景的猫友首次使用金鱼或银鱼解锁，价格暂定；鱼条获取方式待定。已收集后到其他适用场景邀请免费。'),step('同一只猫，每个场景邀请一次','全局收集只记一只，但各个场景的入住分别邀请。到新场景看到轮廓时，先查看条件和该场景的邀请状态。手机上左右拖动大地图寻找猫猫。'),step('点猫猫，听它说话','普通猫猫会独白，睡觉的猫猫会说 zzz。特别的伙伴能互相聊天，点击其中任意一只推进下一句；另一半尚未解锁或未到本场景时，会先说等待朋友的话。')],
      tip:'「切换场景」在地图底部；图鉴与陪伴成就也在底部。邀请与聊天是不同操作，先邀请入住，再点场景中的猫猫交流。',
      links:[open('去猫猫图鉴逛逛','collection'),point('找到图鉴入口','catbook')],
    },
    {
      id:'appearance', group:'小窝随心', icon:'✿', title:'名字与装扮，换一点小魔法', short:'名字与装扮', art:'welcome',
      summary:'给共同的伙伴取个喜欢的名字，在魔法小猫与贝壳小水獭之间切换，也可以搭配小猫装扮。',
      entry:'主页小猫名字；右侧「装扮」，或设置 → 小猫装扮',
      steps:[step('点名字修改昵称','点击主页名字旁的改名入口，输入喜欢的名字并确认。改名会更新这只共同的小猫，原来的成长仍然保留。'),step('先预览装扮','打开装扮页，先选择魔法小猫或贝壳小水獭。小猫还可以分别挑选毛色、衣服、眼睛和魔杖；预览满意后，再按下方按钮保存。'),step('即时换装，后台保存','两位主人看的是同一只小猫。确认后先显示新外观，再在后台同步给伙伴；保存异常时会提醒，中途取消预览不会替你提交。')],
      tip:`主界面的小猫也会回应当前状态。小猫表情在 Lv.${FEATURE_UNLOCKS.expressions.level}、动作在 Lv.${FEATURE_UNLOCKS.actions.level} 解锁，可以从小猫旁的入口查看。`,
      links:[open('打开小猫装扮','appearance'),open('看看表情','expressions'),point('找到名字入口','name')],
    },
    {
      id:'companion', group:'小窝随心', icon:'☾', title:'沉浸陪伴，安静待一会儿', short:'沉浸陪伴', art:'care',
      summary:'收起主界面，只留下你和小猫。忙碌时，也可以留一小段安静的陪伴。',
      entry:'主页右上角「沉浸陪伴」',
      steps:[step('点右上角进入','沉浸模式会暂时隐藏资源、侧边按钮和导航，让画面更安静。'),step('仍然可以轻点小猫','点小猫继续使用原有互动方式；照顾次数、冷却和保存规则照常生效。'),step('轻点空白处退出','退出按钮隐藏时，轻点空白处让它出现，再点「退出沉浸」。使用键盘也可以按 Esc 返回。')],
      tip:'沉浸陪伴只是界面模式。想喂食、玩小游戏或读日记时，先退出，再使用主页的对应入口。',
      links:[point('找到沉浸入口','companion')],
    },
    {
      id:'settings', group:'小窝随心', icon:'⚙', title:'设置、保存与暂未开放的功能', short:'设置与保存', art:'welcome',
      summary:'把常用帮助放在随时能找到的地方。知道进度保存在哪里，也知道哪些功能还在准备中。',
      entry:'主页右上角「设置」',
      steps:[step('设置里可以重新读引导','可以切换身份、查看双人邀请、重走一分钟上手流程、打开这本手册、换装扮、看版本历史和开关互动音效。'),step('离开前看看保存状态',isTest?'测试调试存档在刷新或重新进入时恢复默认。正式小窝有独立保存的进度，测试体验不会影响它们。':'看主页底部的保存提示。网络未连接或仍在保存时，先等状态恢复；下次使用原来的小窝网址和自己的身份继续。'),step('3D 小屋暂未开放','主页的 3D 小屋与布置入口目前统一锁定。等开放后再进行探索和布置；现有喂食、日记、小游戏和图鉴可以照常使用。')],
      tip:'这本手册会记住本机的阅读位置，可以随时关掉、重新打开。阅读进度与游戏里的成长、金币和邀请进度分别记录。',
      links:[open('打开小窝设置','settings'),open('重新走一分钟上手','onboarding')],
    },
    {
      id:'daily', group:'认识小窝', icon:'✓', title:'今天，先这样陪它一会儿', short:'每日小路线', art:'memories',
      summary:'不需要一次完成所有事情。选几件喜欢的小事，让这个家一点点热闹起来。',
      entry:'从主页开始，随时可从右上角打开这本手册',
      steps:[step('看看小猫，补一份需要','先读状态条。饿了去喂食，累了休息；次数允许时摸摸它，再收下待领取的成长气泡。'),step('选一种今天的陪伴','有空就玩一局小游戏，或到双人面板接一棒。遇到想认真谈的分歧，可以一起进入猫猫判官。'),step('留下一点纪念','翻翻日记的新主题，到图鉴看看能否邀请新朋友。日常操作在后台保存，异常时按页面提示处理，明天再见。')],
      tip:'没有必须打完的每日清单。找不到功能时，用目录搜索「喂食」「五子棋」「判官」等关键词，随时回来查一查。',
      links:[point('回主页看看','home')],
    },
  ];
}

export function guideCatalog(kind) {
  if (kind === 'foods') return Object.entries(FOODS).map(([id,food]) => ({
    name:food.name, body:`${food.cost} 猫爪币 · 饱饱 +${food.hunger} · 活力 +${food.energy} · 基础成长 ${food.love} · 冷却 ${foodDurationText(id)}`,
  }));
  if (kind === 'games') return Object.entries(GAMES).map(([id,game]) => ({
    name:game.name, body:`${game.description}${TOUCH_INFO[id] ? ` 达标：${TOUCH_INFO[id].requirement}。` : ''}`,
    note:`基础成长 +${game.xp}${TOUCH_GAMES.includes(id) ? ` · Lv.${CAT_PLAY_UNLOCK_LEVEL} 解锁` : ''}`,
  }));
  return [];
}

export function searchGuide(chapters, query) {
  const words=String(query || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return chapters.filter(chapter => {
    const text=[chapter.title,chapter.short,chapter.summary,chapter.entry,chapter.tip,...chapter.steps.flatMap(item=>[item.title,item.body]),...guideCatalog(chapter.catalog).flatMap(item=>[item.name,item.body])].join(' ').toLocaleLowerCase();
    return words.every(word=>text.includes(word));
  });
}
