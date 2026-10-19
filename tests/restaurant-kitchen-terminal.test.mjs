import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { kitchenTerminalState, kitchenTerminalMarkup, kitchenGuideMarkup, paintKitchenTerminal } from '../src/restaurant-kitchen-terminal.js';
import { restaurantTerminalPanel } from '../src/restaurant-guests-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'kitchen-terminal-client',name:'店长'};
const start=(state,recipeId,now=NOW)=>reduceAction(state,{type:'restaurant-start',recipeId},actor,now);

test('an empty terminal offers single-dish tests without broken ingredient previews or gameplay panels',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),state=kitchenTerminalState(info,{now:NOW});
  assert.equal(state.title,'暂无测试订单');assert.equal(state.orderId,'');assert.equal(state.progress,0);
  const html=restaurantTerminalPanel(info,{icon:()=>''});
  assert.ok(html.includes('单菜测试'));assert.ok(html.includes('选择要查看的菜品订单'));
  assert.ok(html.includes('单独测试暖暖蛋包饭'));assert.ok(html.includes('单独测试猫爪拿铁'));
  assert.ok(html.includes('玩法与教材'));
  assert.ok(!html.includes('rk-live-detail'));assert.ok(!html.includes('rk-tracker'));
  assert.match(html,/data-r-tab="themes" data-r-theme-view="colors"><strong>操作圈配色/);
  assert.doesNotMatch(html,/data-r-kitchen-palette=/,'the terminal routes to the level-gated decoration panel');
  assert.ok(!html.includes('undefined.webp'));
});

test('the compact monitor distinguishes arrival, a real work step, delivery, return and payment',()=>{
  const arriving=reduceAction(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'rice'},actor,NOW);
  let now=NOW+1000,info=restaurantInfo(arriving,now),status=kitchenTerminalState(info,{orderId:arriving.restaurant.orders[0].id,now});
  assert.equal(status.step,'客人正在入座');assert.ok(status.meta.includes('5 秒'));
  const started=start(initialState(NOW),'rice'),order=started.restaurant.orders[0],id=order.id;
  const work=order.workflow.segments.find(segment=>segment.phase==='work'&&segment.stepId==='chop-chicken');
  now=work.startAt+1000;info=restaurantInfo(started,now);status=kitchenTerminalState(info,{orderId:id,now});
  assert.equal(status.step,'切鸡腿肉');assert.ok(status.meta.includes('6 号工位'));assert.ok(status.progress>0&&status.progress<1);
  const delivery=order.workflow.segments.find(segment=>segment.phase==='delivery');
  now=delivery.startAt+1;status=kitchenTerminalState(restaurantInfo(started,now),{orderId:id,now});
  assert.equal(status.step,'正在送到餐桌');
  now=order.workflow.servedAt+1;status=kitchenTerminalState(restaurantInfo(started,now),{orderId:id,now});
  assert.equal(status.step,'正在返回厨房');
  now=order.workflow.servedAt+5000;status=kitchenTerminalState(restaurantInfo(started,now),{orderId:id,now});
  assert.equal(status.step,'已用餐，等待收款');
});

test('manual dishes safely show an unassigned worker and expose only the next explicit operation',()=>{
  let state=reduceAction(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'rice'},actor,NOW);
  const id=state.restaurant.orders[0].id;let now=state.restaurant.orders[0].createdAt;
  let info=restaurantInfo(state,now),status=kitchenTerminalState(info,{orderId:id,now});
  assert.equal(status.step,'等待接单');assert.equal(status.meta,'待安排员工');
  assert.equal(status.action.type,'kitchen-accept');
  assert.ok(kitchenTerminalMarkup(info).includes('待安排'));
  state=reduceAction(state,{type:'restaurant-kitchen-accept',orderId:id},actor,now);
  status=kitchenTerminalState(restaurantInfo(state,now),{orderId:id,now});
  assert.equal(status.action.type,'kitchen-step');assert.equal(status.action.stepId,'gather');
  assert.match(status.step,/待点击/);
  state=reduceAction(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},actor,now);
  const flow=state.restaurant.orders[0].workflow,work=flow.segments.find(segment=>segment.phase==='work');
  now=work.startAt+1;status=kitchenTerminalState(restaurantInfo(state,now),{orderId:id,now});
  assert.equal(status.action,null);assert.ok(status.meta.includes('1 号员工'));
  now=flow.runs.at(-1).endAt+10000;
  status=kitchenTerminalState(restaurantInfo(state,now),{orderId:id,now});
  assert.equal(status.action.stepId,'wash');
  assert.equal(state.restaurant.orders[0].workflow.runs.length,1,'monitor reads never advance a manual dish');
});

test('selecting a queued recipe keeps its own worker and progress while another order is working',()=>{
  const first=start(initialState(NOW),'rice'),state=start(first,'coffee'),[rice,coffee]=state.restaurant.orders;
  const work=rice.workflow.segments.find(segment=>segment.phase==='work'),now=work.startAt+100;
  const info=restaurantInfo(state,now),selected=kitchenTerminalState(info,{orderId:coffee.id,now});
  assert.equal(selected.title,'猫爪拿铁');assert.equal(selected.orderId,coffee.id);assert.equal(selected.step,'等待员工接单');
  assert.ok(selected.meta.includes(`${Number(coffee.workflow.workerId.slice(7))} 号员工`));
  assert.notEqual(selected.step,kitchenTerminalState(info,{orderId:rice.id,now}).step);
});

test('a stale selection falls back to a remaining order after collection and full tables disable test buttons',()=>{
  let state=start(start(initialState(NOW),'rice'),'coffee');
  assert.match(kitchenTerminalMarkup(restaurantInfo(state,NOW)),/aria-label="单独测试暖暖蛋包饭" disabled/);
  const [rice,coffee]=state.restaurant.orders,now=rice.workflow.servedAt+5000;
  state=reduceAction(state,{type:'restaurant-collect',orderId:rice.id},actor,now);
  const info=restaurantInfo(state,now),selection=kitchenTerminalState(info,{orderId:rice.id,now});
  assert.equal(selection.orderId,coffee.id);
  assert.ok(!kitchenTerminalMarkup(info).includes(`value="${rice.id}"`));
});

test('painting live status updates existing text nodes instead of replacing the terminal controls',()=>{
  const state=start(initialState(NOW),'rice'),order=state.restaurant.orders[0],step=order.workflow.segments.find(segment=>segment.phase==='work');
  const now=step.startAt+500,info=restaurantInfo(state,now),nodes=Object.fromEntries(['title','step','meta'].map(key=>[`[data-r-kitchen-monitor-${key}]`,{textContent:''}]));
  nodes['[data-r-kitchen-monitor-progress]']={style:{}};
  const monitor={querySelector:selector=>nodes[selector]},select={value:''};
  const root={querySelector:selector=>selector==='[data-r-kitchen-monitor]'?monitor:select,querySelectorAll:()=>[]};
  paintKitchenTerminal(root,info,{orderId:order.id,now});
  assert.equal(nodes['[data-r-kitchen-monitor-title]'].textContent,'暖暖蛋包饭');
  assert.equal(nodes['[data-r-kitchen-monitor-step]'].textContent,step.stepId==='gather'?'取鸡蛋、米饭、鸡腿肉和蔬菜':'');
  assert.equal(select.value,order.id);assert.ok(parseFloat(nodes['[data-r-kitchen-monitor-progress]'].style.width)>0);
});

test('the textbook contains static ordered instructions and no live tracking or test actions',()=>{
  const html=kitchenGuideMarkup(restaurantInfo(initialState(NOW),NOW));
  assert.ok(html.includes('暖暖蛋包饭 · 9 道工序'));assert.ok(html.includes('猫爪拿铁 · 4 道工序'));
  assert.ok(html.indexOf('清洗洋葱')<html.indexOf('切鸡腿肉'));
  assert.ok(html.includes('送餐与返回'));
  assert.ok(!html.includes('data-r-action'));assert.ok(!html.includes('data-r-debug'));assert.ok(!html.includes('data-rk-current'));
});
