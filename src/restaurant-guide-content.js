import { STAFF_IDLE_RECOVERY_MS } from './restaurant-staff-training.js';

// Targets are existing player controls. A tour only navigates views; it never
// creates a guest, submits an order or invokes a purchase action.
export const RESTAURANT_TOUR=Object.freeze([
  {id:'welcome',label:'欢迎开张',view:'business',target:'.r-shop-sign',title:'欢迎来到猫猫的小食光',body:'我来陪你认认小馆。先迎接猫友，再把一份热乎乎的料理送上桌，慢慢经营自己的猫猫餐厅。',hint:'跟着金色框和箭头看，随时可以暂停。',next:'带我认识小馆'},
  {id:'wallet',label:'两种鱼干',view:'business',target:'.r-hud',title:'小鱼干和金鱼干，各有用处',body:'小鱼干与小窝的猫爪币共用钱包，用来升级和雇佣。银级、金级猫友吃完两餐后，会送来金鱼干，可永久解锁招牌菜与珍藏装扮。'},
  {id:'orders',label:'接下点餐',view:'business',target:['.r-order-bubble[data-r-action="kitchen-accept"]','.r-order-bubble','.rg-empty-table','.r-shop-sign'],title:'看到“想吃这份”，先记下点餐',body:'空桌会自然迎来猫友，朋友也可能两位同桌。入座后，点头顶的菜品气泡接单；同桌两位客人各有自己的订单。',hint:'现在先认识位置，关闭指引后再亲手接单。'},
  {id:'ingredients',label:'取料与工序',view:'kitchen',target:['.rk-action-circle','.rk-surface-10','.rk-focus-tools'],title:'做菜从点一下食材圈开始',body:'接单后进入厨房，点冰箱附近的食材圈，员工才会去取料。之后跟着菜品图标，逐步点击清洗、切配、加工和装盘。',hint:'不同料理有不同工序，不需要连续快速点。'},
  {id:'timing',label:'等待蓝圈',view:'kitchen',target:['.rk-worker-progress','.rk-action-circle','.rk-surface-10'],title:'蓝色圆环结束，再做下一步',body:'员工会先走到工位，再开始加工。蓝色圆环表示这一步的进度；完成后会出现下一个操作圈，等你点击才继续。',hint:'离开页面后，已开始的工序继续计时；未点击的工序会等你。'},
  {id:'serving',label:'送餐上桌',view:'business',target:['.r-order-bubble[data-r-step="delivery"]','.r-order-bubble','.rg-empty-table','.r-shop-sign'],title:'装盘后，还要把菜送到桌边',body:'料理做好时，餐桌上会出现“送餐啦”。点一下，员工就会端餐过去；等客人吃完，气泡会变成可以收取的小鱼干。'},
  {id:'checkout',label:'结账与成长',view:'business',target:'.r-level',title:'收好鱼干，小馆也会长大',body:'点用餐结束的鱼干气泡结账，小馆获得营业经验，也为小窝留下一颗“餐厅经营经验”气泡。回小窝点击领取，才计入小猫成长。',hint:'点这里的等级，可以查看下一步开放哪些资源。'},
  {id:'menu',label:'菜谱与招牌',view:'recipes',target:['.r-recipe-card','.r-categories'],title:'在菜谱里认识每一份拿手菜',body:'点菜品卡查看售价、品质和制作工序。新菜随小馆等级开放；金色招牌还需要金鱼干永久解锁，拥有后才会进入点餐。'},
  {id:'research',label:'菜谱研发',view:'research',target:['.rr-atelier-controls','.rr-atelier','.rr-research'],title:'收集灵感，让拿手菜更出色',body:'客人结账可能赠送灵感。用灵感探索菜谱碎片，再用对应碎片把菜品从 B 逐步升到 SSS；多余碎片可以融合回灵感。',compactBody:'结账可能获得灵感。探索菜谱碎片，再用碎片升阶至 SSS；多余碎片可融合。',hint:'介绍位置时不会替你探索、消耗灵感或升阶。',compactHint:'本次仅介绍，不消耗灵感。'},
  {id:'staff',label:'伙伴与能力',view:'training',target:['[data-r-ability="speed"]','.re-training'],title:'每位伙伴，都能单独培养',body:'速度加快员工走动，体力提高储备，耐力减少工序耗能，熟练度改善加工与品质。每项能力独立升级，顾客走路不会跟着变快。',hint:'伙伴页可雇佣员工，再切到“能力升级”培养已加入的猫猫。'},
  {id:'rest',label:'体力与休息',view:'business',target:'.rr-entrance',title:'头顶的蓝色小条，是员工体力',body:'每次点击制作工序都会消耗体力。耗尽后移动速度降到平时的 20%，完成当前工序就去休息室；回满后留在里面，等你下一次派工。',hint:`休息室可查看恢复倒计时。离线或小馆闲置 ${STAFF_IDLE_RECOVERY_MS/60000} 分钟，所有员工体力自动回满。`},
  {id:'upgrades',label:'升级小馆',view:'upgrades',target:['.ru-facility','.ru-facility-list'],title:'想快一点，先看看设施升级',body:'厨房与取料设施能缩短相应加工时间，扩建可增加座位，其他设施改善收益。卡片写着当前效果、下一级和开放等级，准备好再购买。',compactBody:'厨房与取料设施缩短加工时间，扩建增加座位。先查看效果和开放等级，再决定升级。'},
  {id:'decor',label:'布置与加成',view:'themes',target:'.r-appearance-tabs',title:'给小馆换一份喜欢的风景',body:'配色能切换操作圈，布置能更换整套场景，珍藏装扮可同时摆放多件。场景解锁后属性常驻累计；换景时，两位施工猫会来帮忙。',hint:'不用换上对应场景，也能保留已解锁加成。'},
  {id:'finish',label:'开始营业',view:'business',target:'.r-wallet-guide',title:'认识啦，一起好好开张吧',body:'先从一位猫友、一份料理开始。想不起来时，点钱包旁的小书，或在营业信息里重新查看；两位主人经营的是同一间小馆。',hint:'指引只记录阅读进度，原来的钱币、订单和成长一直保留。',next:'一起开张吧'},
].map(step=>Object.freeze({...step,target:Array.isArray(step.target)?Object.freeze(step.target):step.target})));

export const RESTAURANT_KITCHEN_TOUR=Object.freeze(['ingredients','timing','serving','checkout','rest']);
export function restaurantGuideRoute(kind='all'){
  return kind==='kitchen'?RESTAURANT_TOUR.filter(step=>RESTAURANT_KITCHEN_TOUR.includes(step.id)):RESTAURANT_TOUR;
}
