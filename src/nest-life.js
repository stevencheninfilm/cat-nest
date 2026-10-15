/** Device-local atmosphere and cosmetic moments. No care or cloud mutations. */
export const NEST_PERIODS=Object.freeze({
  morning:{label:'早晨',icon:'☀',range:'06:00–11:00',ambient:2.05,key:2.4,tint:'#ffe4bb',sky:'#fff1d7',lines:['晨光落在窗边，小猫也慢慢醒来了。','今天的第一缕阳光，留给你和小猫。','窗帘轻轻亮起来，新的一天开始了。','小爪子伸一伸，陪你迎接新的一天。']},
  day:{label:'白天',icon:'☼',range:'11:00–17:00',ambient:2.15,key:2.25,tint:'#fff0dc',sky:'#f5f4e5',lines:['阳光铺在地毯上，正适合一起发呆。','小窝亮堂堂的，连呼噜都懒洋洋。','窗外热热闹闹，小猫在家等你。','把忙碌放一放，陪小猫晒一会儿太阳。']},
  evening:{label:'黄昏',icon:'◒',range:'17:00–21:00',ambient:1.65,key:2.05,tint:'#ffc394',sky:'#eed1bd',lines:['天边染成蜜桃色，小窝也柔软下来。','晚霞走到窗边，小猫把位置留给你。','一天慢慢收尾，来听一会儿小呼噜。','暖光照着小爪子，今天也辛苦啦。']},
  night:{label:'深夜',icon:'☾',range:'21:00–06:00',ambient:1.35,key:1.65,tint:'#ffdeb4',sky:'#b5c7e8',lines:['窗外安静了，留一盏暖灯陪着小猫。','月光轻轻落下，小窝里只剩小呼噜。','夜深也不用赶路，小猫陪你慢一点。','把声音放轻，陪小猫守一会儿月亮。']},
});
export const LIFE_RULES=Object.freeze({chance:.12,checkMs:60000,warmupMs:25000,cooldownMs:15*60000,dailyLimit:3,holdMs:6500,historyLimit:12});
const integer=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const sample=random=>{const value=random();return Number.isFinite(value)?Math.max(0,Math.min(.999999,value)):.5;};
const hash=text=>{let value=2166136261;for(const char of String(text))value=Math.imul(value^char.charCodeAt(0),16777619);return value>>>0;};
export function localNestTime(now=Date.now()) {
  if(!Number.isFinite(new Date(now).valueOf()))now=Date.now();
  const date=new Date(now),hour=date.getHours(),period=hour>=6&&hour<11?'morning':hour>=11&&hour<17?'day':hour>=17&&hour<21?'evening':'night';
  const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const clock=`${String(hour).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  const definition=NEST_PERIODS[period];
  return {period,day,clock,...definition,description:definition.lines[hash(day+period)%definition.lines.length]};
}
export const LIFE_EVENTS=Object.freeze({
  spill:{title:'哎呀，碰倒了',icon:'🧶',lines:['小爪子碰倒了线团，咕噜噜滚到了脚边。','线团滚远了，小猫装作什么都没发生。','刚刚伸了伸爪，空纸杯就歪到了一边。']},
  gift:{title:'发现一个小礼物',icon:'🎁',lines:['小猫从垫子底下，扒出一颗亮亮的纸星星。','窗边藏着一根漂亮羽毛，小猫悄悄叼给你。','一小段彩色缎带，被小猫当作宝贝送来了。']},
  affection:{title:'突然想和你贴贴',icon:'♡',lines:['小猫把脑袋轻轻凑过来，尾巴绕了个小弯。','明明刚刚还在发呆，忽然就想蹭蹭你。','小爪子轻轻搭过来：再陪我一小会儿嘛。']},
});
function validRecord(item) {return !!item&&typeof item.id==='string'&&/^\d{4}-\d{2}-\d{2}\.\d+$/.test(item.id)&&Object.hasOwn(LIFE_EVENTS,item.kind)&&integer(item.variant,2)&&integer(item.at)&&Number.isFinite(new Date(item.at).valueOf())&&Object.hasOwn(NEST_PERIODS,item.period);}
export function normalizeLifeLedger(value,now=Date.now()) {
  const day=localNestTime(now).day;
  if(!value||value.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(value.day)||!integer(value.count,LIFE_RULES.dailyLimit)||!integer(value.checkedAt)||!integer(value.lastAt)||!Array.isArray(value.records)||value.records.length>LIFE_RULES.historyLimit||!value.records.every(validRecord))return {version:1,day,count:0,checkedAt:0,lastAt:0,records:[]};
  const ledger=structuredClone(value);
  // A backward clock/day must not reset cooldowns or the presentation quota.
  if(day>ledger.day&&now>=ledger.checkedAt&&now>=ledger.lastAt){ledger.day=day;ledger.count=0;}
  return ledger;
}
export function lifeEventText(event) {return LIFE_EVENTS[event.kind]?.lines[event.variant]||'';}
export function makeLifeEvent(kind,now,variant=0) {const time=localNestTime(now);return {id:`${time.day}.${Math.floor(now/60000)}`,kind,variant,at:now,period:time.period};}
export function rollLifeEvent(ledger,now,random=Math.random) {
  const time=localNestTime(now);
  if(time.day!==ledger.day||now-ledger.checkedAt<LIFE_RULES.checkMs||now-ledger.lastAt<LIFE_RULES.cooldownMs||ledger.count>=LIFE_RULES.dailyLimit)return null;
  if(sample(random)>=LIFE_RULES.chance)return null;
  const previous=ledger.records[0],pool=(time.period==='night'?['affection','affection','gift']:['affection','affection','gift','spill']).filter(kind=>kind!==previous?.kind);
  const kind=pool[Math.floor(sample(random)*pool.length)],old=ledger.records.find(record=>record.kind===kind);
  const variants=[0,1,2].filter(n=>n!==old?.variant),variant=variants[Math.floor(sample(random)*variants.length)];
  return makeLifeEvent(kind,now,variant);
}
/** One foreground opportunity per minute, no missed-event backlog after a pause. */
export function createLifeScheduler({read=()=>null,write=()=>{},clock=Date.now,random=Math.random,canEvent=()=>true,onEvent=()=>true,onEnd=()=>{}}={}) {
  let eligibleSince=null,active=null,expiresAt=0,memory=null;
  const load=now=>normalizeLifeLedger(read()??memory,now);
  function end(){if(active){active=null;expiresAt=0;onEnd();}}
  function interrupt(){eligibleSince=null;end();}
  function show(event,preview=false){if(onEvent(event,{preview})===false)return false;active=event;expiresAt=clock()+LIFE_RULES.holdMs;return true;}
  return {
    tick() {
      const now=clock();
      if(active&&(now>=expiresAt||expiresAt-now>LIFE_RULES.holdMs))end();
      if(!canEvent()){interrupt();return;}
      if(active)return;
      if(eligibleSince===null){eligibleSince=now;return;}
      if(now-eligibleSince<LIFE_RULES.warmupMs)return;
      const ledger=load(now),day=localNestTime(now).day;
      if(day!==ledger.day||now-ledger.checkedAt<LIFE_RULES.checkMs||now-ledger.lastAt<LIFE_RULES.cooldownMs||ledger.count>=LIFE_RULES.dailyLimit)return;
      const event=rollLifeEvent(ledger,now,random);
      ledger.checkedAt=now;
      if(event&&show(event)){ledger.count++;ledger.lastAt=now;ledger.records=[event,...ledger.records].slice(0,LIFE_RULES.historyLimit);}
      memory=ledger;try{write(ledger);}catch{}
    },
    interrupt,
    records(){return load(clock()).records;},
    preview(kind,at=clock()){if(!Object.hasOwn(LIFE_EVENTS,kind)||!canEvent())return false;end();eligibleSince=null;return show(makeLifeEvent(kind,at),true);},
    get active(){return active;},
  };
}
