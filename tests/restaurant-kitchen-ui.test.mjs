import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { KITCHEN_FLOWS, KITCHEN_ZONES } from '../src/restaurant-kitchen.js';
import { kitchenSceneMarkup, kitchenFlowPanel, kitchenViewModel, kitchenActionPresentations, kitchenAnimationId } from '../src/restaurant-kitchen-ui.js';
import { KITCHEN_FOOD_PROPS, KITCHEN_V3_PROPS, KITCHEN_V4_PROPS, KITCHEN_V5_PROPS, KITCHEN_V6_PROPS, KITCHEN_V7_PROPS, KITCHEN_V8_PROPS } from '../src/restaurant-kitchen-assets.js';
import { INTERACTIVE_KITCHEN_ZONES } from '../src/restaurant-kitchen-layout.js';
import { kitchenTerminalMarkup, kitchenGuideMarkup } from '../src/restaurant-kitchen-terminal.js';
import { restaurantMarkup } from '../src/restaurant-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'kitchen-view-client',name:'店长'};

test('the kitchen scene exposes all ten named work areas and the phone flow controls',()=>{
  const html=kitchenSceneMarkup();
  for(const zone of KITCHEN_ZONES){
    assert.ok(html.includes(`data-r-kitchen-zone="${zone.id}"`));
    assert.ok(html.includes(`${zone.id}号${zone.name}，空闲`));
  }
  assert.equal((html.match(/class="rk-zone rk-zone-/g)||[]).length,10);
  assert.ok(html.includes('fridge-closed.webp'));
  assert.ok(!html.includes('knife.webp'),'tools appear only while an employee is using them');
  assert.ok(!html.includes('whisk.webp'));
  assert.ok(html.includes('data-rk-next-action'));
  assert.equal((html.match(/aria-hidden="true" tabindex="-1"/g)||[]).length,10,'only the guide exposes station names to keyboard and assistive navigation');
  assert.ok(html.includes('data-r-kitchen-tutorial'));
  assert.ok(!html.includes('data-r-kitchen-focus'),'every operation stays in the same fitted scene');
  const info=restaurantInfo(initialState(NOW),NOW),terminal=kitchenTerminalMarkup(info);
  assert.ok(terminal.includes('data-r-debug-dish="rice"'));
  assert.ok(terminal.includes('data-r-debug-dish="coffee"'));
  const game=restaurantMarkup(initialState(NOW),{isTest:true});
  assert.ok(!game.includes('rk-live-detail'));assert.ok(!game.includes('rk-tracker'));
  assert.ok(!game.includes('class="r-header"'));assert.ok(!game.includes('FOOD BAR STORY'));
  assert.ok(game.includes('data-r-level-value'));
  assert.match(game, /r-scene-controls[^]*?data-r-back[^]*?rr-research-shortcut/);
  assert.match(game, /r-tools[^]*?data-r-audio-open[^]*?r-info-entry/);
  assert.ok(!game.includes('厨房实时工序'));assert.ok(!game.includes('当前制作流程'));
  const guide=kitchenGuideMarkup(info);
  assert.ok(guide.includes('料理工序教材'));assert.ok(guide.includes('取鸡蛋、米饭、鸡腿肉和蔬菜'));
});

test('scene prompts wait for acceptance and expose exactly the next unclicked step',()=>{
  let state=reduceAction(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'rice'},actor,NOW);
  const id=state.restaurant.orders[0].id,at=NOW+6000;
  let view=kitchenViewModel(state.restaurant,id,at+3600000);
  assert.equal(view.phase,'requested');assert.equal(view.next,null);assert.equal(view.worker,null);
  state=reduceAction(state,{type:'restaurant-kitchen-accept',orderId:id},actor,at);
  view=kitchenViewModel(state.restaurant,id,at+3600000);
  assert.equal(view.phase,'awaiting');assert.equal(view.next.id,'gather');assert.equal(view.next.zoneId,10);
  assert.equal(view.model.zones.filter(zone=>zone.occupant).length,0,'waiting for a click shows no operating props');
  state=reduceAction(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},actor,at+10);
  const run=state.restaurant.orders[0].workflow.runs[0];
  view=kitchenViewModel(state.restaurant,id,run.endAt+3600000);
  assert.equal(view.phase,'awaiting');assert.equal(view.next.id,'wash');assert.equal(view.worker.phase,'awaiting');
  assert.equal(view.model.zones.filter(zone=>zone.occupant).length,0);
});

test('a future queued run shows its own waiting circle instead of offering the following step early',()=>{
  let state=reduceAction(initialState(NOW),{type:'restaurant-arrive',partySize:1,recipeId:'rice'},actor,NOW);
  const id=state.restaurant.orders[0].id;
  state=reduceAction(state,{type:'restaurant-kitchen-accept',orderId:id},actor,NOW+6000);
  state=reduceAction(state,{type:'restaurant-kitchen-step',orderId:id,stepId:'gather'},actor,NOW+10000);
  const view=kitchenViewModel(state.restaurant,id,NOW+8000),actions=kitchenActionPresentations(state.restaurant,NOW+8000);
  assert.equal(view.phase,'queued');assert.equal(view.next,null);assert.equal(view.active.currentStep.id,'gather');
  assert.equal(actions.length,1);assert.equal(actions[0].step.id,'gather');assert.equal(actions[0].queued,true);assert.equal(actions[0].running,true);assert.equal(actions[0].moving,false);
  assert.equal(kitchenViewModel(state.restaurant,id,NOW+10000).phase,'walk');
  const end=state.restaurant.orders[0].workflow.runs[0].endAt;
  assert.equal(kitchenViewModel(state.restaurant,id,end).next.id,'wash');
});

test('the stove divider follows the reference seam and operation anchors stay on countertop surfaces',()=>{
  const zone=id=>INTERACTIVE_KITCHEN_ZONES.find(zone=>zone.id===id);
  assert.equal(zone(4).bounds.x+zone(4).bounds.w,zone(5).bounds.x);
  assert.ok(Math.abs(zone(5).bounds.x-48.62)<.05);
  for(const id of [3,4,5,6,7]){
    const item=zone(id);
    assert.ok(item.prop.y>=84.6&&item.prop.y<=90.1);
    assert.ok(item.prop.x>item.bounds.x&&item.prop.x<item.bounds.x+item.bounds.w);
  }
  assert.ok(zone(8).prop.width<=6.5);assert.ok(zone(9).prop.width<=5);
});

test('every operation points to a transparent, genuinely animated, infinitely looping WebP',async()=>{
  const manifests=await Promise.all(['kitchen-v2','kitchen-v3','kitchen-v4','kitchen-v5','kitchen-v6','kitchen-v7','kitchen-v8'].map(async directory=>({directory,...JSON.parse(await readFile(new URL(`../public/assets/restaurant/${directory}/manifest.json`,import.meta.url),'utf8'))})));
  assert.equal(manifests[0].animations.length,13);assert.equal(manifests[1].animations.length,13);
  for(const [recipeId,steps] of Object.entries(KITCHEN_FLOWS))for(const step of steps){
    const id=kitchenAnimationId(step.id,recipeId),manifest=manifests.find(manifest=>manifest.animations.some(item=>item.id===id)),animation=manifest?.animations.find(item=>item.id===id);
    assert.ok(animation,`${recipeId}:${step.id} has a loop`);
    const bytes=await readFile(new URL(`../public/assets/restaurant/${manifest.directory}/${animation.file}`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.includes(Buffer.from('ANIM'))&&bytes.includes(Buffer.from('ANMF')));
    const offset=bytes.indexOf(Buffer.from('ANIM'));assert.equal(bytes.readUInt16LE(offset+12),0,'WebP loop count zero means infinite');
    assert.ok(animation.frames>=6);assert.ok(animation.durations.every(duration=>duration>0&&duration<=200));
    assert.equal(animation.width,animation.height);assert.ok(animation.width>=384);
  }
});

test('the detailed panel displays the authoritative current step, worker and completed steps',()=>{
  const state=reduceAction(initialState(NOW),{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  const order=state.restaurant.orders[0],step=order.workflow.segments.find(segment=>segment.phase==='work'&&segment.stepId==='chop-chicken');
  const now=step.startAt+1500,info=restaurantInfo(state,now);
  const html=kitchenFlowPanel(info,{orderId:order.id,now});
  assert.ok(html.includes('1 号员工'));
  assert.ok(!html.includes('2 号员工'));
  assert.ok(html.includes('切鸡腿肉'));
  assert.ok(html.includes('is-current'));
  assert.ok(html.includes('is-done'));
  assert.ok(!html.includes('NaN'));
  for(const process of KITCHEN_FLOWS.rice)assert.ok(html.includes(`data-rk-step="${process.id}"`));
  const station=kitchenFlowPanel(info,{orderId:order.id,zoneId:6,now});
  assert.ok(station.includes('1 号员工 · 正在切鸡腿肉'));
  assert.ok(station.includes('同一时间只接待一位员工'));
});

test('finished dishes use the existing food atlas while kitchen props use the correct production base',t=>{
  const previous=globalThis.document;
  globalThis.document={baseURI:'https://example.test/cat-nest/'};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const info=restaurantInfo(initialState(NOW),NOW),html=kitchenFlowPanel(info,{recipeId:'rice',now:NOW});
  assert.ok(html.includes('https://example.test/cat-nest/assets/restaurant/kitchen-v1/bowl-eggs.webp'));
  assert.ok(html.includes('r-food-rice'));
  assert.ok(!html.includes('kitchen-v1/rice.webp'));
  assert.ok(!html.includes('kitchen-v1/undefined.webp'));
});

test('an order panel keeps its own queued, completed and arriving state while the same employee handles another dish',()=>{
  let state=reduceAction(initialState(NOW),{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  state=reduceAction(state,{type:'restaurant-start',recipeId:'coffee'},actor,NOW);
  const [rice,coffee]=state.restaurant.orders;
  const riceWork=rice.workflow.segments.find(segment=>segment.phase==='work');
  let now=riceWork.startAt+500,info=restaurantInfo(state,now);
  assert.match(kitchenFlowPanel(info,{orderId:coffee.id,now}),/1 号员工 · 等待员工/);
  const coffeeWork=coffee.workflow.segments.find(segment=>segment.phase==='work');
  now=coffeeWork.startAt+500;info=restaurantInfo(state,now);
  assert.match(kitchenFlowPanel(info,{orderId:rice.id,now}),/1 号员工 · 制作完成/);
  let arriving=reduceAction(initialState(NOW),{type:'restaurant-start',recipeId:'rice'},actor,NOW);
  arriving=reduceAction(arriving,{type:'restaurant-arrive',partySize:1,recipeId:'coffee'},actor,NOW);
  const future=arriving.restaurant.orders.at(-1);
  assert.match(kitchenFlowPanel(restaurantInfo(arriving,NOW+2000),{orderId:future.id,now:NOW+2000}),/等待安排员工 · 等待客人入座/);
});

test('all kitchen process props and movable tools are packaged as transparent WebP assets',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v1/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.assets.length,17);
  const required=new Set(['fridge-closed','fridge-open','knife','whisk','bowl-empty','latte-cup',...Object.values(KITCHEN_FLOWS).flatMap(flow=>flow.map(step=>step.prop)).filter(id=>!KITCHEN_FOOD_PROPS.includes(id)&&!KITCHEN_V3_PROPS.includes(id)&&!KITCHEN_V4_PROPS.includes(id)&&!KITCHEN_V5_PROPS.includes(id)&&!KITCHEN_V6_PROPS.includes(id)&&!KITCHEN_V7_PROPS.includes(id)&&!KITCHEN_V8_PROPS.includes(id))]);
  for(const id of required){
    const item=manifest.assets.find(item=>item.id===id);assert.ok(item,`missing ${id}`);
    const bytes=await readFile(new URL(`../public/assets/restaurant/kitchen-v1/${item.file}`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(item.alpha.min,0);assert.equal(item.alpha.max,255);
    assert.ok(item.alpha.transparentFraction>.4&&item.alpha.transparentFraction<.9);
  }
  const next=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v3/manifest.json',import.meta.url),'utf8'));
  for(const id of KITCHEN_V3_PROPS){
    const item=(next.assets||next.props).find(item=>item.id===id);assert.ok(item,`missing new kitchen prop ${id}`);
    const bytes=await readFile(new URL(`../public/assets/restaurant/kitchen-v3/${item.file}`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(item.alpha.min,0);assert.equal(item.alpha.max,255);assert.ok(item.alpha.transparentFraction>.3);
  }
  const latest=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v4/manifest.json',import.meta.url),'utf8'));
  assert.equal(latest.props.length,19);assert.equal(latest.animations.length,23);
  for(const id of KITCHEN_V4_PROPS){
    const item=latest.props.find(item=>item.id===id);assert.ok(item,`missing new kitchen prop ${id}`);
    const bytes=await readFile(new URL(`../public/assets/restaurant/kitchen-v4/${item.file}`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);
  }
  for(const item of latest.animations){assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);assert.ok(item.distinctDecodedFrames>=3);}
  const newest=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v5/manifest.json',import.meta.url),'utf8'));
  assert.equal(newest.props.length,22);assert.equal(newest.animations.length,26);
  for(const id of KITCHEN_V5_PROPS){
    const item=newest.props.find(item=>item.id===id);assert.ok(item,`missing current kitchen prop ${id}`);
    const bytes=await readFile(new URL(`../public/assets/restaurant/kitchen-v5/${item.file}`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);
  }
  for(const item of newest.animations){assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);assert.ok(item.distinctDecodedFrames>=3);}
  const v6=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v6/manifest.json',import.meta.url),'utf8'));
  assert.equal(v6.props.length,26);assert.equal(v6.animations.length,30);
  for(const id of KITCHEN_V6_PROPS){
    const item=v6.props.find(item=>item.id===id);assert.ok(item,`missing v6 kitchen prop ${id}`);
    const bytes=await readFile(new URL(`../public/assets/restaurant/kitchen-v6/${item.file}`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);
  }
  for(const item of v6.animations){assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);assert.ok(item.distinctDecodedFrames>=3);}
  const v7=JSON.parse(await readFile(new URL('../public/assets/restaurant/kitchen-v7/manifest.json',import.meta.url),'utf8'));
  assert.equal(v7.props.length,26);assert.equal(v7.animations.length,30);
  for(const id of KITCHEN_V7_PROPS){
    const item=v7.props.find(item=>item.id===id);assert.ok(item,'missing v7 prop '+id);
    const bytes=await readFile(new URL('../public/assets/restaurant/kitchen-v7/'+item.file,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);
  }
  for(const item of v7.animations){assert.equal(item.alphaMin,0);assert.ok(item.transparentFraction>.3);assert.ok(item.distinctDecodedFrames>=3);}
  const closed=manifest.assets.find(item=>item.id==='fridge-closed'),open=manifest.assets.find(item=>item.id==='fridge-open');
  assert.deepEqual([closed.width,closed.height,closed.bodyAnchor],[open.width,open.height,open.bodyAnchor]);
});
