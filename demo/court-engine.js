// Deliberately fictional, deterministic examples. No AI or external transport.
export function sampleVerdict(now, assessment='similar') {
  const details={
    headline:'把一起照顾小猫的约定说清楚', conclusion:'这是一份演示判词。两人对照顾时间的期待不同，可以先核对约定，再商量轮流照顾的方式。', confidence:'medium',
    rootAnalysis:'示例中双方都希望小猫被照顾好，但没有确认当天的具体分工。',
    facts:[{text:'双方都表达了想照顾小猫的意愿。',source:'虚构演示材料'}], disputes:['当天是否明确约定了喂食时间，示例材料没有提供完整记录。'],
    responsibility:{assessment,summary:'演示责任分布，仅用于展示界面。',percentages:assessment==='a_more' ? {a:65,b:35}:assessment==='b_more' ? {a:35,b:65}:assessment==='undetermined' ? {a:null,b:null}:{a:50,b:50},a:{level:'contributing',reason:'可以更具体地说明自己的安排。'},b:{level:'contributing',reason:'可以及时确认是否接得上照顾。'}},
    decree:'先核对时间与分工，再约定临时有事时怎样告诉对方。',repairMode:assessment==='boundaries' ? 'boundaries_first':'together',
    repairTasks:[{title:'确认下一次喂食安排',description:'双方自愿选好各自方便的时间。'},{title:'听一听对方的期待',description:'各自复述对方最在意的一点。'}],
    communication:{a:'我希望我们把照顾时间提前说好。',b:'我也在意小猫，我们一起确认一下分工吧。'},followUpQuestions:['下次怎样确认对方已经看到安排？'],appeal:{changed:'新一轮演示会保留上一轮记录。',unchanged:'始终区分事实、感受和推测。'},
  };
  return {model:'预设演示 · 未调用 AI',createdAt:new Date(now).toISOString(),details,text:'这是一份虚构演示判词，仅用于展示网站效果。\n\n先确认事实，再表达感受，最后共同约好下一次的照顾安排。'};
}
const round = (index,now,kind='initial') => ({id:`demo-round-${index}`,index,kind,status:'collecting',createdAt:now,submissions:{},submittedRoles:[],verdict:null});
export function createDemoCourt(engine,{now=Date.now}={}) {
  function finish(court,assessment='similar') {
    const r=court.rounds.at(-1); r.status='judged'; r.verdict=sampleVerdict(now(),assessment);
    r.submittedRoles=['a','b'];
    for (const role of ['a','b']) r.submissions[role] ||= {statement:'虚构演示：我希望和你一起把小猫照顾好。',images:[],submittedAt:now()};
    r.repair={mode:r.verdict.details.repairMode,tasks:r.verdict.details.repairTasks.map((task,i)=>({...task,id:`demo-task-${r.index}-${i}`,confirmations:{a:false,b:false}}))};
  }
  return {
    showcase(assessment='similar') {
      const court={id:`d${crypto.randomUUID().replaceAll('-','').slice(0,11)}`,title:'一起照顾小猫的约定 · 演示案卷',revision:1,createdAt:now(),requiresAuth:false,parties:{a:{name:'演示男方',claimed:true,online:true},b:{name:'演示女方',claimed:true,online:true}},rounds:[round(1,now())]};
      finish(court,assessment); engine.saveCourt(court); return court;
    },
    request(path,method,body={},headers={}) {
      if (path==='/config') return {data:{configured:true,model:'预设示例（不调用 AI）',persistence:'browser-demo'}};
      let court=engine.getCourt();
      if (path==='/rooms' && method==='POST') {
        court={id:'demo00000001',title:String(body.title || '演示小法庭').slice(0,80),revision:1,createdAt:now(),requiresAuth:false,parties:{a:{claimed:false,online:false},b:{claimed:false,online:false}},rounds:[round(1,now())]};
      } else if (!court || !path.startsWith(`/rooms/${court.id}`)) return {status:404,error:'这是独立演示，请先创建一个演示案件'};
      else {
        const endpoint=path.split('?')[0].split('/').at(-1);
        const token=headers.Authorization || headers.authorization || '';
        const role=token.endsWith('demo-b') ? 'b':'a';
        if (endpoint==='claim') { const chosen=body.role==='b'?'b':'a'; court.parties[chosen]={name:String(body.name || '演示主人').slice(0,20),claimed:true,online:true}; court.revision++; engine.saveCourt(court); return {data:{room:court,token:`demo-${chosen}`,role:chosen}}; }
        if (['submit','statement','submissions','appeal'].includes(endpoint) && method==='POST') {
          if(endpoint==='appeal')court.rounds.push(round(court.rounds.length+1,now(),'appeal'));
          const r=court.rounds.at(-1); r.submissions[role]={statement:String(body.statement || ''),images:body.images || [],submittedAt:now()};
          court.parties[role==='a'?'b':'a']={name:'演示伙伴',claimed:true,online:true};
          finish(court); // The demo partner supplies its fictional statement immediately.
        }
        if(endpoint==='judge')finish(court);
        if(endpoint==='repair') { const task=court.rounds.find(r=>r.id===body.roundId)?.repair?.tasks.find(t=>t.id===body.taskId); if(task)task.confirmations[role]=body.confirmed===true; }
        if(endpoint==='presence') { court.parties[role].online=true; court.parties[role].typing=body.typing===true; }
        if(method!=='GET')court.revision++;
      }
      engine.saveCourt(court); return {data:{room:court}};
    },
  };
}
