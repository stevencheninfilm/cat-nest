import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurantGoldDropFrames, createRestaurantGoldDrops, GOLD_DROP_FLIGHT_MS } from '../src/restaurant-gold-drop.js';
import { restaurantGuestTables } from '../src/restaurant-guests-ui.js';

const meal=(id='table-1',rewardGold=1)=>({id,partyId:'party-1',table:0,seat:0,status:'collectible',rewardGold});
function fixture(t,{reduced=false,brokenAnimation=false}={}){
  t.mock.timers.enable({apis:['setTimeout']});
  const nodes=[],motions=[];
  const layer={ownerDocument:{createElement(){
    const classes=new Set();
    const node={style:{},dataset:{},attributes:{},classList:{add:name=>classes.add(name),contains:name=>classes.has(name)},setAttribute(name,value){this.attributes[name]=value;},remove(){const i=nodes.indexOf(this);if(i>=0)nodes.splice(i,1);},animate(frames,options){
      if(brokenAnimation)throw Error('Animation unavailable');
      const motion={frames,options,cancelled:false,cancel(){this.cancelled=true;}};motions.push(motion);return motion;
    }};return node;
  }},append:node=>nodes.push(node)};
  const stage={getBoundingClientRect:()=>({left:0,top:0,width:500,height:1000}),querySelector:()=>({getBoundingClientRect:()=>({left:60,top:260,width:70,height:70})})};
  return {nodes,motions,controller:createRestaurantGoldDrops({stage,layer,reducedMotion:()=>reduced})};
}

test('the gold path starts at the customer, rises above a straight line and ends on the table',()=>{
  const from={x:15,y:28},to={x:24,y:31},frames=restaurantGoldDropFrames(from,to);
  assert.equal(parseFloat(frames[0].left),from.x);assert.equal(parseFloat(frames[0].top),from.y);
  assert.equal(parseFloat(frames.at(-1).left),to.x);assert.equal(parseFloat(frames.at(-1).top),to.y);
  assert.ok(parseFloat(frames[12].top)<Math.min(from.y,to.y));
  assert.ok(frames.every(frame=>Number.isFinite(parseFloat(frame.left))&&Number.isFinite(parseFloat(frame.top))));
});

test('a paid bonus drops once, rests visibly on the table, then clears without changing the meal',t=>{
  const f=fixture(t),order=meal('table-1',2),before=structuredClone(order);
  assert.equal(f.controller.prepare(order),true);f.controller.sync({orders:[]});
  assert.equal(f.controller.play(order.id),true);assert.equal(f.controller.play(order.id),false);
  assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].attributes['aria-label'],'金鱼干 +2');
  assert.match(f.nodes[0].innerHTML,/gold-fish.webp/);assert.equal(f.motions[0].options.duration,GOLD_DROP_FLIGHT_MS);
  t.mock.timers.tick(GOLD_DROP_FLIGHT_MS);
  assert.ok(f.nodes[0].classList.contains('is-landed'));assert.equal(f.motions[0].cancelled,true);
  assert.equal(parseFloat(f.nodes[0].style.left),21.5);assert.ok(Math.abs(parseFloat(f.nodes[0].style.top)-30.8)<1e-6);
  t.mock.timers.tick(1800);assert.ok(f.nodes[0].classList.contains('is-leaving'));
  t.mock.timers.tick(260);assert.equal(f.nodes.length,0);assert.equal(f.controller.play(order.id),false);
  assert.deepEqual(order,before);
});

test('a rollback removes the visual and permits a real retry; a declined dispatch also stays clean',t=>{
  const f=fixture(t),order=meal();f.controller.prepare(order);f.controller.sync({orders:[]});f.controller.play(order.id);
  f.controller.sync({orders:[order]});assert.equal(f.nodes.length,0);assert.equal(f.motions[0].cancelled,true);
  assert.equal(f.controller.prepare(order),true);f.controller.cancel(order.id);
  assert.equal(f.controller.play(order.id),false);t.mock.timers.tick(10000);assert.equal(f.nodes.length,0);
});

for(const options of [{reduced:true},{brokenAnimation:true}]){
  test(`a static table reward is available when ${options.reduced?'motion is reduced':'animation fails'}`,t=>{
    const f=fixture(t,options),order=meal();f.controller.prepare(order);f.controller.play(order.id);
    assert.ok(f.nodes[0].classList.contains('is-landed'));assert.equal(parseFloat(f.nodes[0].style.left),21.5);
    f.controller.reset();assert.equal(f.nodes.length,0);
  });
}

test('ordinary payments create no gold, rapid collections stay bounded and closing cancels all effects',t=>{
  const f=fixture(t);assert.equal(f.controller.prepare(meal('table-1',0)),false);assert.equal(f.controller.play('table-1'),false);
  for(let i=0;i<200;i++){const order=meal(`table-${i+2}`);f.controller.prepare(order);f.controller.play(order.id);}
  assert.equal(f.nodes.length,12);f.controller.destroy();assert.equal(f.nodes.length,0);
  assert.ok(f.motions.every(motion=>motion.cancelled));t.mock.timers.tick(10000);assert.equal(f.nodes.length,0);
});

test('customer prompts hide preparation details and collection text while retaining their actions',()=>{
  const order={...meal(),recipe:{id:'coffee',name:'猫爪拿铁'},recipeLevel:1,rewardCoins:67,rewardXp:9,workflow:{version:4}};
  const render=(status,version=4)=>restaurantGuestTables({capacity:2,parties:[{id:'party-1',table:0,status:'seated',members:[{seat:0,order:{...order,status,workflow:{version}}}]}]},{icon:()=>'<svg></svg>',food:()=>'<i></i>'}).match(/<button class="r-order-bubble"[^]*?<\/button>/)[0];
  const waiting=render('awaiting');assert.match(waiting,/等待厨师继续制作/);assert.match(waiting,/data-r-kitchen-select="table-1"/);assert.doesNotMatch(waiting,/<small|data-r-countdown/);
  const working=render('preparing');assert.match(working,/厨师制作中/);assert.doesNotMatch(working,/<small|data-r-countdown/);
  assert.doesNotMatch(render('preparing',1),/用餐中|<small/,'legacy automatic cooking also uses a clean preparation prompt');
  const paid=render('collectible');assert.match(paid,/data-r-action="collect"/);assert.match(paid,/r-collect-fish/);assert.match(paid,/\+67/);assert.doesNotMatch(paid,/收小鱼干|rg-bonus-gold|<small/);
});
