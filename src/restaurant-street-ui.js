import { RESTAURANT_GUESTS } from './restaurant-customers.js';
import { restaurantGuestSprite } from './restaurant-customer-art.js';
import { restaurantSeat } from './restaurant-guests.js';
import { restaurantQueuePosition } from './restaurant-street.js';
import { restaurantGuestTier } from './restaurant-order-probabilities.js';

const ordinary=RESTAURANT_GUESTS.filter(guest=>!guest.advanced);
const names=Object.fromEntries(RESTAURANT_GUESTS.map(guest=>[guest.id,guest.name]));
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const conversations={
  walk:[['这条街今天好热闹。','下次也来这里逛逛！'],['闻到刚出炉的香味啦。','先散步，一会儿再来。'],['慢一点，等等我呀。','前面的花开得真好。']],
  queue:[['这家小馆闻起来好香。','等一会儿也值得喵。'],['一会儿坐窗边好不好？','好呀，边吃边晒太阳。'],['今天想点一份甜的。','那我也陪你尝尝。']],
  inside:[['一起吃饭真开心。','下次还坐这一桌吧。'],['这里的饭香香的。','慢慢吃，不着急喵。'],['今天的小馆好热闹。','有你一起就更好了。']],
  crossing:[['里面的朋友，吃得好吗？','很好吃，欢迎来坐坐！'],['等到位置就来找我们呀。','好呀，一会儿见！'],['你们也喜欢这家小馆？','对呀，是街边的小幸福。']],
};

/** A transient, deterministic-with-injected-random street simulation. It cannot
 * write wallet, encounters, orders or a home save. Only the FIFO is persisted. */
export function createRestaurantStreetLife({random=Math.random}={}){
  const pick=items=>items[Math.min(items.length-1,Math.floor(clamp(random())*items.length))];
  const between=(min,max)=>Math.round(min+(max-min)*clamp(random()));
  let walkers=[],nextWalkAt=null,nextChatAt=null,dialogue=null,serial=0;
  function reset(){walkers=[];nextWalkAt=null;nextChatAt=null;dialogue=null;}
  function update(info,now,{active=true}={}){
    if(!active){reset();return {actors:[],bubbles:[],waiting:0};}
    nextWalkAt??=now+between(2200,4200);nextChatAt??=now+between(5500,8500);
    walkers=walkers.filter(group=>now<group.startedAt+group.duration);
    if(now>=nextWalkAt){
      if(walkers.length<2){
        const choices=[...ordinary],cats=[];
        for(let count=random()<.4?2:1;count>0;count--){const guest=pick(choices);cats.push(guest.id);choices.splice(choices.indexOf(guest),1);}
        walkers.push({id:`walk-${++serial}`,cats,startedAt:now,duration:between(14500,19500),direction:random()<.5?1:-1,lane:random()<.5?13.5:15.3});
      }
      nextWalkAt=now+between(8500,14000);
    }
    const actors=walkers.flatMap(group=>group.cats.map((cat,seat)=>{
      const progress=clamp((now-group.startedAt)/group.duration),x=-12+124*progress;
      return {id:`${group.id}:${seat}`,group:group.id,cat,kind:'passer',x:group.direction===1?x-seat*7:100-x+seat*7,y:group.lane+seat*.4,facing:group.direction===1?'right':'left'};
    }));
    const queue=(info.waitingParties??[]).filter(party=>party.expiresAt>now);
    queue.forEach((party,index)=>party.cats.forEach((cat,seat)=>{
      const target=restaurantQueuePosition(index,seat),progress=clamp((now-party.arrivedAt)/3500);
      actors.push({id:`${party.id}:${seat}`,group:party.id,cat,kind:'queue',x:target.x+(112-target.x)*(1-progress),y:target.y,facing:'left'});
    }));
    const indoors=info.parties.filter(party=>party.status==='seated').flatMap(party=>party.members.map(member=>({id:`${party.id}:${member.seat}`,group:party.id,cat:member.cat,kind:'inside',...restaurantSeat(party.table,member.seat)})));
    const speakers=[...actors,...indoors],byId=new Map(speakers.map(actor=>[actor.id,actor]));
    if(dialogue&&(now>=dialogue.startedAt+6400||dialogue.speakers.some(id=>!byId.has(id))))dialogue=null;
    if(!dialogue&&now>=nextChatAt){
      const candidates=[];
      for(const kind of ['passer','queue','inside']){
        const matching=speakers.filter(actor=>actor.kind===kind&&(kind!=='passer'||actor.x>12&&actor.x<88));
        const pair=matching.find(actor=>matching.some(other=>actor.id!==other.id&&actor.group===other.group));
        if(pair)candidates.push({kind:kind==='passer'?'walk':kind,pair:[pair,matching.find(actor=>actor.id!==pair.id&&actor.group===pair.group)]});
        else if(matching.length>1)candidates.push({kind:kind==='passer'?'walk':kind,pair:matching.slice(0,2)});
      }
      const outside=actors.filter(actor=>actor.x>14&&actor.x<86),inside=indoors.filter(actor=>actor.y<42);
      if(outside.length&&inside.length)candidates.push({kind:'crossing',pair:[pick(outside),pick(inside)]});
      if(candidates.length){const chosen=pick(candidates);dialogue={id:`chat-${++serial}`,startedAt:now,speakers:chosen.pair.map(actor=>actor.id),lines:pick(conversations[chosen.kind])};}
      nextChatAt=now+between(15000,23000);
    }
    const closeSpeakers=dialogue&&Math.abs(byId.get(dialogue.speakers[0]).x-byId.get(dialogue.speakers[1]).x)<28&&Math.abs(byId.get(dialogue.speakers[0]).y-byId.get(dialogue.speakers[1]).y)<4;
    const bubbles=dialogue?dialogue.lines.flatMap((text,index)=>{
      const elapsed=now-dialogue.startedAt-index*2600,speaker=byId.get(dialogue.speakers[index]);
      return speaker&&elapsed>=0&&elapsed<(index===0&&closeSpeakers?2600:3500)?[{id:`${dialogue.id}:${index}`,speaker:speaker.id,name:names[speaker.cat],kind:speaker.kind,text,x:clamp(speaker.x,17,83),y:speaker.y+(speaker.kind==='inside'?2:1.2)}]:[];
    }):[];
    return {actors,bubbles,waiting:queue.length};
  }
  return {update,reset};
}

export function restaurantStreetMarkup(){
  return '<div class="rs-street" data-r-street role="group" aria-label="街边来往与等位顾客"><div data-r-street-actors></div></div><div class="rs-chat-layer" data-r-street-chat aria-live="off"><span class="rs-queue-sign" data-r-queue-sign hidden></span></div>';
}

/** Keep actor/bubble nodes across restaurant polling; animate positions without
 * restarting their walk or repeating a conversation on each save. */
export function createRestaurantStreet({container,random=Math.random}){
  const life=createRestaurantStreetLife({random}),actors=new Map(),bubbles=new Map();
  const actorLayer=container.querySelector('[data-r-street-actors]'),chatLayer=container.querySelector('[data-r-street-chat]'),sign=container.querySelector('[data-r-queue-sign]');
  let info=null,running=false,frame=0,active=true;
  function paint(now=Date.now()){
    if(!info)return;
    const scene=life.update(info,now,{active}),live=new Set(),talking=new Set();
    for(const actor of scene.actors){
      live.add(actor.id);let element=actors.get(actor.id);
      if(!element){element=document.createElement('span');element.className=`rs-actor rs-${actor.kind}`;element.dataset.rGuestTier=restaurantGuestTier(actor.cat);element.setAttribute('role','img');element.setAttribute('aria-label',`${names[actor.cat]}，${actor.kind==='queue'?'门外等位':'路过小馆'}`);element.innerHTML=`<span class="rs-facing">${restaurantGuestSprite(actor.cat)}</span>`;actorLayer.append(element);actors.set(actor.id,element);}
      element.style.left=`${actor.x}%`;element.style.top=`${actor.y}%`;element.dataset.facing=actor.facing;
    }
    for(const [id,element] of actors)if(!live.has(id)){element.remove();actors.delete(id);}
    for(const bubble of scene.bubbles){
      talking.add(bubble.id);let element=bubbles.get(bubble.id);
      if(!element){element=document.createElement('span');element.className='rs-chat-bubble';element.dataset.rChatKind=bubble.kind;element.setAttribute('aria-label',`${bubble.name}说：${bubble.text}`);element.textContent=bubble.text;chatLayer.append(element);bubbles.set(bubble.id,element);}
      element.style.left=`${bubble.x}%`;element.style.top=`${bubble.y}%`;
    }
    for(const [id,element] of bubbles)if(!talking.has(id)){element.remove();bubbles.delete(id);}
    sign.hidden=scene.waiting===0;sign.textContent=scene.waiting?`等位 · ${scene.waiting} 组`:'';
  }
  function tick(){if(!running)return;if(!document.hidden)paint();frame=requestAnimationFrame(tick);}
  function stop(){running=false;cancelAnimationFrame(frame);}
  function clear(){life.reset();for(const element of [...actors.values(),...bubbles.values()])element.remove();actors.clear();bubbles.clear();sign.hidden=true;}
  return {sync(value,{enabled=true}={}){info=value;active=enabled;paint();},start(){if(running)return;running=true;paint();frame=requestAnimationFrame(tick);},stop,reset:clear,destroy(){stop();clear();}};
}
