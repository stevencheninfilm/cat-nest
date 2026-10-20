import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { restaurantInfo } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';
import { kitchenWorkflowBoardMarkup, kitchenWorkflowBoardState, paintKitchenWorkflowBoard } from '../src/restaurant-kitchen-board.js';
import { kitchenFlowPanel } from '../src/restaurant-kitchen-ui.js';
import { kitchenTerminalMarkup, kitchenGuideMarkup } from '../src/restaurant-kitchen-terminal.js';
import { restaurantRecipesPanel } from '../src/restaurant-ui.js';
import { kitchenAnimationId, kitchenAnimationUrl, kitchenPropUrl } from '../src/restaurant-kitchen-assets.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'workflow-board-test',name:'店长'};
const ids=(html,attribute)=>[...html.matchAll(new RegExp(`${attribute}="([^"]+)"`,'g'))].map(match=>match[1]);
const act=(state,action,now)=>reduceAction(state,action,actor,now);
const completedIds=['rice','coffee','sandwich','lemontea','donut','pancake','pudding','matcha','burger','udon','waffle','strawberrymilk','gold-salmon','sushi','pizza','grape','parfait','gold-sundae','cheesecake','gold-latte','cocoa'];
const unlockedState=()=>{const state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(50);state.restaurant.ownedSpecialRecipes=['gold-salmon','sushi','pizza','gold-sundae','gold-latte'];for(const id of state.restaurant.ownedSpecialRecipes)state.restaurant.recipeLevels[id]=1;return state;};

test('the workflow back office lists all twenty-one recipes in the exact current menu order',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),board=kitchenWorkflowBoardMarkup(info),menu=ids(restaurantRecipesPanel(info),'data-r-dish');
  assert.deepEqual(menu.slice(0,5),['rice','coffee','sandwich','lemontea','donut']);
  assert.deepEqual(ids(board,'data-r-board-recipe'),menu.filter(id=>KITCHEN_FLOWS[id]));
  assert.match(board,/21 道菜品 · 完整制作工序/);
  assert.equal((board.match(/class="rk-board-rail"/g)||[]).length,21);
  assert.equal((board.match(/data-r-board-animate /g)||[]).length,169);
  for(const recipe of completedIds){
    const row=board.slice(board.indexOf(`data-r-board-recipe="${recipe}"`)).split('</article>')[0];
    assert.deepEqual(ids(row,'data-r-board-step'),['request',...KITCHEN_FLOWS[recipe].map(step=>step.id),'delivery','return']);
  }
});

test('new recipes are selectable from the terminal, detailed instructions and textbook in the same order',()=>{
  const info=restaurantInfo(initialState(NOW),NOW),terminal=kitchenTerminalMarkup(info),detail=kitchenFlowPanel(info,{recipeId:'sandwich',now:NOW}),guide=kitchenGuideMarkup(info);
  assert.match(terminal,/data-r-tab="workflows"/);
  assert.deepEqual(ids(terminal,'data-r-debug-dish'),completedIds);
  assert.deepEqual(ids(detail,'data-r-flow-recipe'),completedIds);
  assert.match(detail,/熟火腿/);assert.match(detail,/ingredients-sandwich\.webp/);assert.doesNotMatch(detail,/ingredients-latte\.webp/);
  assert.ok(guide.indexOf('猫爪三明治')<guide.indexOf('柠檬气泡茶'));
  assert.match(guide,/猫爪三明治 · 7 道工序/);assert.match(guide,/柠檬气泡茶 · 6 道工序/);
});

test('the board follows later menu order changes without keeping a separate recipe list',()=>{
  const info=restaurantInfo(initialState(NOW),NOW);
  info.recipes=[...info.recipes].reverse();
  const menu=ids(restaurantRecipesPanel(info),'data-r-dish').filter(id=>KITCHEN_FLOWS[id]);
  assert.deepEqual(ids(kitchenWorkflowBoardMarkup(info),'data-r-board-recipe'),menu);
});

test('the gold salmon process is previewable in menu order before purchase, while every test/start gate remains locked',()=>{
  const state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(20);
  const info=restaurantInfo(state,NOW),board=kitchenWorkflowBoardMarkup(info),row=board.slice(board.indexOf('data-r-board-recipe="gold-salmon"')).split('</article>')[0];
  assert.match(row,/金箔三文鱼饭/);assert.match(row,/data-r-debug-dish="gold-salmon" disabled/);
  assert.match(row,/gold-v1\/special-salmon.webp/);assert.doesNotMatch(row,/foods\/gold-salmon/);
  const detail=kitchenFlowPanel(info,{recipeId:'gold-salmon',now:NOW});
  assert.match(detail,/<h3>金箔三文鱼饭<\/h3>/);assert.match(detail,/先解锁这份金色招牌/);
  assert.match(kitchenGuideMarkup(info),/金箔三文鱼饭 · 9 道工序/);
});

for(const recipeId of completedIds.slice(2))test(`${recipeId} back office observes explicit clicks, walking, station countdown and delivery without advancing the dish`,()=>{
  let state=act(unlockedState(),{type:'restaurant-arrive',partySize:1,recipeId},NOW),id=state.restaurant.orders[0].id,now=state.restaurant.orders[0].createdAt;
  state.restaurant.staffTraining['worker-1'].levels.stamina=10;
  state.restaurant.staffTraining['worker-1'].energy=235;
  let model=kitchenWorkflowBoardState(restaurantInfo(state,now),recipeId,now);
  assert.equal(model.cards[0].state,'next');assert.equal(model.action.type,'kitchen-accept');
  state=act(state,{type:'restaurant-kitchen-accept',orderId:id},now);
  model=kitchenWorkflowBoardState(restaurantInfo(state,now),recipeId,now);
  assert.equal(model.cards[0].state,'done');assert.equal(model.cards[1].state,'next');assert.equal(model.action.stepId,'gather');
  for(const step of KITCHEN_FLOWS[recipeId]){
    state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:step.id},now);
    const workflow=state.restaurant.orders[0].workflow,run=workflow.runs.at(-1),work=workflow.segments.find(item=>item.stepId===step.id&&item.phase==='work');
    const walk=workflow.segments.find(item=>item.startAt===run.startAt&&item.phase==='walk');
    if(walk){model=kitchenWorkflowBoardState(restaurantInfo(state,walk.startAt),recipeId,walk.startAt);const card=model.cards.find(item=>item.id===step.id);assert.equal(card.state,'walk');assert.equal(card.seconds,null);assert.equal(card.progress,0);assert.equal(model.action,null);}
    const midpoint=Math.floor((work.startAt+work.endAt)/2);
    model=kitchenWorkflowBoardState(restaurantInfo(state,midpoint),recipeId,midpoint);
    const card=model.cards.find(item=>item.id===step.id);assert.equal(card.state,'work');assert.ok(card.seconds>0);assert.ok(Math.abs(card.progress-.5)<.01);assert.equal(model.action,null);
    const saved=JSON.stringify(state),later=run.endAt+30000;
    model=kitchenWorkflowBoardState(restaurantInfo(state,later),recipeId,later);
    assert.equal(model.cards.find(item=>item.id===step.id).state,'done');assert.ok(model.action);assert.equal(JSON.stringify(state),saved);
    now=run.endAt;
  }
  model=kitchenWorkflowBoardState(restaurantInfo(state,now),recipeId,now);
  assert.equal(model.action.stepId,'delivery');assert.equal(model.cards.find(item=>item.id==='delivery').state,'next');
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'delivery'},now);
  const workflow=state.restaurant.orders[0].workflow;
  model=kitchenWorkflowBoardState(restaurantInfo(state,workflow.servedAt),recipeId,workflow.servedAt);
  assert.equal(model.cards.find(item=>item.id==='delivery').state,'done');assert.equal(model.cards.find(item=>item.id==='return').state,'walk');
  model=kitchenWorkflowBoardState(restaurantInfo(state,workflow.completedAt),recipeId,workflow.completedAt);
  assert.equal(model.cards.find(item=>item.id==='return').state,'done');assert.equal(model.action,null);
});

test('the scene and board share one prop/animation registry, including final food and reused art',()=>{
  for(const [recipeId,steps] of Object.entries(KITCHEN_FLOWS))for(const step of steps){
    const prop=kitchenPropUrl(step.prop),loop=kitchenAnimationUrl(kitchenAnimationId(step.id,recipeId));
    assert.doesNotMatch(prop,/undefined|null/);assert.doesNotMatch(loop,/undefined|null/);
    if(['sandwich','lemontea'].includes(recipeId))assert.match(loop,/kitchen-v3\/animations\//);
  }
  assert.match(kitchenPropUrl('sandwich'),/foods\/sandwich.webp$/);
  assert.match(kitchenPropUrl('lemontea'),/foods\/lemontea.webp$/);
  assert.match(kitchenPropUrl('seasonings'),/kitchen-v1\/seasonings.webp$/);
  assert.equal(kitchenAnimationId('wrap-omelette','rice'),'wrap-omelette');
});

test('historical timed dishes remain read-only in the board, including their existing work countdown',()=>{
  const state=act(initialState(NOW),{type:'restaurant-start',recipeId:'rice'},NOW),order=state.restaurant.orders[0];
  const work=order.workflow.segments.find(segment=>segment.phase==='work'),now=work.startAt+100;
  const model=kitchenWorkflowBoardState(restaurantInfo(state,now),'rice',now);
  assert.equal(model.cards[0].state,'done');assert.equal(model.action,null);
  assert.equal(model.cards.find(card=>card.id===work.stepId).state,'work');
  assert.ok(model.cards.find(card=>card.id===work.stepId).seconds>0);
  const legacy=act(initialState(NOW),{type:'restaurant-start',recipeId:'sandwich'},NOW),before=JSON.stringify(legacy);
  assert.equal(legacy.restaurant.orders[0].workflow,undefined);
  assert.equal(kitchenWorkflowBoardState(restaurantInfo(legacy,NOW),'sandwich',NOW).action,null);
  assert.equal(JSON.stringify(legacy),before);
});

test('when time alone finishes a step, the board enables the next explicit action without rebuilding or losing row scroll',()=>{
  let state=act(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'sandwich'},NOW),id=state.restaurant.orders[0].id,now=state.restaurant.orders[0].createdAt;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:id},now);
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},now);
  const run=state.restaurant.orders[0].workflow.runs.at(-1),button={dataset:{},setAttribute(){},disabled:false,textContent:''},live={textContent:''};
  const row={dataset:{rBoardRecipe:'sandwich'},querySelector:selector=>selector==='.rk-board-test'?button:live,querySelectorAll:()=>[]};
  const root={querySelectorAll:()=>[row]};
  paintKitchenWorkflowBoard(root,restaurantInfo(state,now),{now});assert.equal(button.disabled,true);
  now=run.endAt;paintKitchenWorkflowBoard(root,restaurantInfo(state,now),{now});
  assert.equal(button.disabled,false);assert.equal(button.dataset.rAction,'kitchen-step');assert.equal(button.dataset.rStep,'wash-salad');assert.equal(button.textContent,'开始洗蔬菜');
  paintKitchenWorkflowBoard(root,restaurantInfo(state,now),{now,blocked:true});assert.equal(button.disabled,true);
});

test('the board opens the next operation immediately when an exhausted employee leaves for rest',()=>{
  let state=act(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'lemontea'},NOW),id=state.restaurant.orders[0].id,now=state.restaurant.orders[0].createdAt;
  state.restaurant.staffTraining['worker-1'].energy=10;state.restaurant.staffTraining['worker-1'].energyAt=now;
  state=act(state,{type:'restaurant-kitchen-accept',orderId:id},now);
  state=act(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},now);
  const rest=state.restaurant.orders[0].workflow.runs.at(-1).rest;assert.ok(rest);
  let model=kitchenWorkflowBoardState(restaurantInfo(state,rest.departAt),'lemontea',rest.departAt);
  assert.equal(model.action.stepId,'wash-lemon');assert.match(model.status,/等待空闲员工接手/);
  model=kitchenWorkflowBoardState(restaurantInfo(state,rest.arriveAt+1),'lemontea',rest.arriveAt+1);
  assert.equal(model.action.stepId,'wash-lemon');assert.match(model.status,/等待空闲员工接手/);
  model=kitchenWorkflowBoardState(restaurantInfo(state,rest.fullAt),'lemontea',rest.fullAt);
  assert.equal(model.action.stepId,'wash-lemon');
});

for(const [id,art] of [['gold-sundae','special-sundae'],['gold-latte','special-latte']])test(id+' keeps a premium preview and purchase gate with the correct gold artwork',()=>{
  const state=initialState(NOW);state.restaurant.stats.experience=levelStartXp(50);
  const info=restaurantInfo(state,NOW),html=kitchenWorkflowBoardMarkup(info),row=html.slice(html.indexOf('data-r-board-recipe="'+id+'"')).split('</article>')[0];
  assert.ok(row.includes('data-r-debug-dish="'+id+'" disabled'));assert.ok(row.includes('gold-v1/'+art+'.webp'));assert.ok(!row.includes('foods/'+id));
  assert.match(kitchenFlowPanel(info,{recipeId:id,now:NOW}),/先解锁这份金色招牌/);
});
