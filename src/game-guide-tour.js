/** Targets are existing UI; tour navigation never submits gameplay actions. */
export const GAME_TOUR = [
  {id:'welcome',chapter:'welcome',view:'home',target:'#cat',title:'嗨，我来带你认识这个家',body:'我是你的小猫向导。跟着亮起来的地方，我们一起看看怎么照顾小猫、玩游戏和留下回忆。',hint:'随时可以暂停，下次从这里继续。',next:'出发，认识小窝'},
  {id:'wallet',chapter:'growth',view:'home',target:'.wallet',title:'这三份心意，各有用处',body:'猫爪币用来买食物，逗猫就能获得；亲密度记录陪伴；等级来自领取后的成长经验。点等级，还能看成长阶段。'},
  {id:'identity',chapter:'identity',view:'home',target:'.couple-presence, [data-open="roles"]',title:'先认出你和另一位主人',body:'每次进入选择自己的身份。两人分别选男方和女方；在设置里的「双人绑定与邀请」复制链接，让伙伴来到同一个家。',hint:'复制邀请后，还要等对方实际加入。'},
  {id:'needs',chapter:'needs',view:'home',target:'.needs',title:'饿不饿，累不累？看看这里',body:'饱饱、开心、活力会随时间变化，离线也会计算。每项都可以点开看提升方法；状态大于 80，还能给照顾成长加成。'},
  {id:'feeding-entry',chapter:'feeding',view:'home',target:'#feed-button',title:'第一站，给小猫挑一份小餐',body:'看到亮起来的「喂食」了吗？点它打开餐桌，我带你认一认里面的按钮。',next:'打开喂食页',activate:true},
  {id:'feeding-menu',chapter:'feeding',view:'feeding',target:'.food-filters',title:'先选食物，准备好再上桌',body:'主食、小零食、饮水都在这里。往下看食物卡，选择后上方会预览价格、活力和冷却。此时还没有花费猫爪币。'},
  {id:'feeding-confirm',chapter:'feeding',view:'feeding',target:'#serve-food',title:'最后确认，才会真正喂食',body:'实际喂养时点「喂这个」。按钮会告诉你成长、冷却或次数状态。这次先认认位置，想喂的时候再自己确认。',hint:'本次导览不会替你花币或消耗喂食次数。'},
  {id:'feeding-pair',chapter:'feeding',view:'feeding',target:'.feeding-pair-summary',title:'我和对方，都照顾到了吗？',body:'这里分别显示两人的本轮喂养状态。两位主人在本轮各喂一次、奖励次数可用时，会得到额外亲密度和成长；详细餐盘记录在「喂养详情」。'},
  {id:'care',chapter:'care',view:'home',target:'.left-actions',title:'摸摸它，再陪它玩一会儿',body:'「摸摸」让小猫开心一点；「逗猫」能带来成长和猫爪币，也会消耗少量活力。按钮旁的次数和倒计时告诉你何时能继续。'},
  {id:'rest',chapter:'care',view:'home',target:'#sleep-button',title:'累了，就让小猫好好休息',body:'点「休息」让它入睡、恢复活力。睡着后可以随时叫醒；叫醒没有额外成长。日常照顾的次数与冷却由两位主人共享。'},
  {id:'growth',chapter:'growth',view:'home',target:'.pet-card',title:'别忘了，收下成长小爱心',body:'照顾或小游戏留下的爱心气泡，需要点击领取，经验才进入这里的成长条。气泡不会自动消失，也不会由两个人重复领取。',hint:'上方的 Lv. 可以查看全部成长阶段。'},
  {id:'games-entry',chapter:'games',view:'home',target:'[data-open="games"]',title:'来游戏屋，找一点小快乐',body:'以后点这里进入小游戏，可以独自挑战、和电脑比一比，或邀请伙伴联机。本轮先认识入口；第一次打开游戏屋，我再带你看具体玩法。',next:'继续认识其他功能'},
  {id:'games',chapter:'games',view:'games',target:'[data-game-select="rps"]',title:'先选喜欢的游戏，再选模式',body:'翻牌、五子棋、猜数字、2048……点封面后会显示单人、电脑和双人选项，以及操作规则。双人联机由一人发起，另一人在同一小窝加入。',hint:'限时游戏需达标，中途退出不发奖；结算后记得领成长气泡。'},
  {id:'games-touch',chapter:'games',view:'games',target:'[data-game-select="teaser"]',title:'还有三种猫猫触屏小游戏',body:'逗猫棒追逐、接住小零食、寻找小玩具，在小猫 Lv.5 解锁。它们是独立小游戏，与主页「逗猫」不同。',hint:'每款具体玩法与奖励，可以在图文手册中查看。'},
  {id:'together',chapter:'together',view:'shared-care',target:'.shared-tabs',title:'一个人照顾，也能等另一人接力',body:'「照顾足迹」看彼此做过什么；「默契接力」按任务接下一棒；「共同回忆」留住完成的纪念。普通照顾次数和冷却照常生效。'},
  {id:'court-entry',chapter:'court',view:'home',target:'[data-open="judge"]',title:'想认真聊聊，猫猫会听',body:'底部的「猫猫判官」是两个人好好说话的小法庭。本轮先认识入口；等你主动打开判官，我再带你了解入席、陈词和修复流程。',next:'继续认识其他功能'},
  {id:'court',chapter:'court',view:'judge',target:'#court-create, #court-claim-button, #court-submit, #court-stage, .court-result-tabs',title:'各自陈词，双方到齐才开庭',body:'一人发起审理并分享邀请，另一人加入。分别认领猫爪方、鱼干方，写下经过和感受，可附最多 4 张截图。双方提交后才会评理。',hint:'判词后可以查看修复建议、各自确认任务，或补充证词复议。指引不会替你提交；已有法庭可按当前进度继续。'},
  {id:'diary-entry',chapter:'diary',view:'home',target:'[data-open="diary"]',title:'一起长大的日子，都值得记下',body:'从右侧「日记」进入，看看小猫的成长与两个人的共同纪念。',next:'翻开成长日记',activate:true},
  {id:'diary',chapter:'diary',view:'diary',target:'.journal-tabs',title:'每一个主题，收藏一次',body:'「待解锁」写着下一张纪念卡的条件；「正式卡册」按主题收集；重复的纪念留在时间轴。点卡片爱心可共同收藏，打开卡片还能保存图片。',hint:'部分图鉴猫猫看的是正式卡册数量，不是时间轴条数。'},
  {id:'catbook-entry',chapter:'catbook',view:'home',target:'[data-open="collection"]',title:'去认识住在地图里的新朋友',body:'「猫猫图鉴」里有不同场景和猫猫朋友。完成条件后，要亲手邀请它们入住。',next:'去看看图鉴地图',activate:true},
  {id:'catbook',chapter:'catbook',view:'collection',target:'.book-yard-camera',title:'左右逛地图，点猫猫听它说话',body:'大地图左右拖动。每只猫在不同场景都需要分别邀请一次；点已入住的猫猫会说话，特别的伙伴可以聊天，点任意一只继续下一句。',hint:'朋友还没解锁或没到本场景时，猫猫会先说等待朋友的话。'},
  {id:'appearance-entry',chapter:'appearance',view:'home',target:'[data-open="appearance"]',title:'装扮在这里，挑一份小魔法',body:'可以选魔法小猫，也可以让抱贝壳的小水獭陪你。等你点开「装扮」，我再介绍怎样预览和保存；本轮先把其他入口认一认。'},
  {id:'appearance',chapter:'appearance',view:'appearance',target:'.pet-character-choices, .appearance-tabs',title:'选择伙伴，再换个小模样',body:'先选魔法小猫或贝壳小水獭，小猫还可以搭配毛色、衣服、眼睛和魔杖。满意后点下方按钮保存；两位主人看到同一位伙伴，原来的成长一直保留。',hint:'只预览还没有提交，关闭时可以保留原来的装扮。'},
  {id:'companion',chapter:'companion',view:'home',target:'[data-companion-enter]',title:'也可以，只安静陪它一会儿',body:'点「沉浸陪伴」收起界面，仍然可以轻点小猫互动。轻点空白处会显示「退出沉浸」，键盘 Esc 也能返回。'},
  {id:'settings',chapter:'settings',view:'settings',target:'[data-open="handbook"]',title:'想不起来时，来这里找我',body:'设置里可以随时重新开始实景引导，或者打开图文手册查具体步骤、食物和小游戏玩法。3D 小屋与布置目前暂未开放。'},
  {id:'finish',chapter:'daily',view:'home',target:'#cat',title:'认识这个家，就从今天开始',body:'看看状态，选一份照顾，收下成长，再去玩一局、翻翻日记。不用赶着完成所有事情，照自己的节奏陪它就好。',hint:'操作会在后台自动同步；出现保存异常时，按提示处理并保留浏览器数据。',next:'认识啦，回到小窝'},
];

export const PANEL_TOURS = Object.freeze({games:['games','games-touch'],judge:['court'],appearance:['appearance']});
const deferredIds=new Set(Object.values(PANEL_TOURS).flat());
export const OVERVIEW_TOUR = GAME_TOUR.filter(step=>!deferredIds.has(step.id)).map(step=>step.id);
export function guideTourRoute(panel) { return panel && PANEL_TOURS[panel] ? [...PANEL_TOURS[panel]] : [...OVERVIEW_TOUR]; }

export function tourStepForChapter(id) { return Math.max(0,GAME_TOUR.findIndex(step=>step.chapter===id)); }

/** Clip to viewport, then place the speech card in the larger free vertical area. */
export function tourLayout(rect, width, height, cardHeight) {
  const margin=12, top=Math.max(8,Math.min(height-8,rect?.top ?? height*.28));
  const bottom=Math.max(top,Math.min(height-8,rect?.bottom ?? height*.48));
  const left=Math.max(8,Math.min(width-8,rect?.left ?? width*.35));
  const right=Math.max(left,Math.min(width-8,rect?.right ?? width*.65));
  const useBelow=height-bottom >= top;
  const cardTop=Math.max(margin,Math.min(height-cardHeight-margin,useBelow ? bottom+54 : top-cardHeight-54));
  return {top,left,right,bottom,cardTop,arrowBelow:!useBelow};
}
