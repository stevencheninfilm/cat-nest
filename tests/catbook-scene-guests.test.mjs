import { invitedEverywhere } from './catbook-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_CATS } from '../src/cat-collection.js';
import { CAT_SCENES, sceneAllowsCat, sceneCatPlacement, sceneCatClipPath, sceneCatGlassShapes, catArrivalScene } from '../src/catbook-scenes.js';
import { catbookMarkup, collectionNoticeMarkup } from '../src/catbook-ui.js';
import { catArrivalRoute } from '../src/catbook-events.js';
import { initialState, levelStartXp, FOODS } from '../src/state.js';

function allOwned() {
  const state=initialState();
  state.xp=levelStartXp(120);
  state.collection.stats={feed:180,pet:600,play:300,sleep:30,pair:96};
  state.collection.foods=Object.keys(FOODS);
  state.collection.wins={rps:12,memory:12,gomoku:12};
  state.collection.achievements={boost:3,dress:1,daily:{feed:10,pet:10,play:10,sleep:3}};
  state.collection.invited=COLLECTION_CATS.map(cat=>({id:cat.id,at:Date.now(),operationId:`scene-test-${cat.id}`,actorId:'scene-test'}));
  return state;
}
const visitorIds=html=>[...html.matchAll(/class="book-yard-cat\b[^>]*data-book-cat="([^"]+)"/g)].map(match=>match[1]);

test('garden review keeps Porter out and adds Maple on the pond stone without changing other yards',()=>{
  const state=allOwned(), before=structuredClone(state);
  for(const scene of CAT_SCENES) {
    const expected=scene.id === 'station' ? COLLECTION_CATS : COLLECTION_CATS.filter(cat=>cat.index < 12 || (cat.reviewOutline && !(scene.id === 'garden' && cat.id === 'porter')) || (scene.id === 'garden' && ['onyx','maple'].includes(cat.id)));
    const html=catbookMarkup(invitedEverywhere(state),{sceneId:scene.id});
    assert.deepEqual(visitorIds(html),expected.map(cat=>cat.id));
    assert.equal((html.match(/class="book-cat-card\b[^>]*collected/g)||[]).length,COLLECTION_CATS.length,'all collections remain owned in the catalog');
    assert.match(html,new RegExp(`已收集${COLLECTION_CATS.length}只猫猫`));
  }
  assert.deepEqual(state,before,'scene visibility must not modify saved invitations');
});

test('station guests are never given a hidden landing or an entrance route in other scenes',()=>{
  const station=CAT_SCENES.find(scene=>scene.id === 'station');
  for(const cat of COLLECTION_CATS.slice(12,24)) for(const scene of CAT_SCENES) {
    if(['onyx','maple'].includes(cat.id) && scene.id === 'garden') continue;
    assert.equal(catArrivalScene(scene,cat),station);
    if(scene.id !== 'station') {
      assert.equal(sceneAllowsCat(scene,cat),false);
      assert.equal(sceneCatPlacement(scene,cat),null);
      assert.equal(catArrivalRoute(scene,cat,{width:400,height:844,left:0,top:0,viewWidth:390,viewHeight:844}),null);
    }
  }
  for(const cat of COLLECTION_CATS.slice(0,12)) for(const scene of CAT_SCENES) {
    assert.equal(catArrivalScene(scene,cat),scene,'original cats may arrive in any yard');
  }
});

test('Onyx can settle beside the garden lantern without allowing the other new cats in',()=>{
  const garden=CAT_SCENES.find(scene=>scene.id === 'garden'), cat=COLLECTION_CATS.find(cat=>cat.id === 'onyx');
  const state=invitedEverywhere(allOwned());
  state.collection.sceneInvited=state.collection.sceneInvited.filter(record=>record.sceneId !== 'garden' || record.id === 'onyx');
  const html=catbookMarkup(state,{sceneId:'garden',catId:'onyx'});
  assert.match(html,/data-scene-id="garden"/);
  assert.deepEqual(visitorIds(html),['onyx']);
  assert.equal(catArrivalScene(garden,cat),garden);
  assert.match(html,/可在猫猫车站、日式庭院相遇/);
  assert.match(collectionNoticeMarkup({type:'cat-arrived',id:'onyx'},{sceneId:'garden',settled:true}),/石灯右侧的草地上安顿好啦/);
});

test('a new cat invited from another yard has station instructions and a valid station welcome',()=>{
  const state=allOwned();
  state.collection.invited=state.collection.invited.filter(cat=>cat.id !== 'velvet');
  const html=catbookMarkup(invitedEverywhere(state),{sceneId:'garden',catId:'velvet'});
  assert.match(html,/常驻猫猫车站/);
  assert.match(html,/邀请绒绒加入猫猫车站/);
  assert.match(collectionNoticeMarkup({type:'cat-arrived',id:'velvet'},{sceneId:'garden',settled:true}),/欢迎绒绒来到猫猫车站/);
  assert.match(collectionNoticeMarkup({type:'cat-arrived',id:'velvet'},{sceneId:'garden',settled:true}),/黄色猫猫旁的围墙木栏上安顿好啦/);
});

test('an empty yard guides players to invite a friend to the current scene',()=>{
  const state=allOwned();
  const html=catbookMarkup(state,{sceneId:'garden',catId:'mochi'});
  assert.match(html,/data-scene-id="garden"/);
  assert.deepEqual(visitorIds(html),[]);
  assert.match(html,/data-book-cat="bandit">[\s\S]*?邀请斑斑来日式庭院/);
  assert.match(html,/已经在猫猫车站等你啦/,'station residency is visible in the cat detail');
});

test('carriage windows reveal the seated cats above the sill and conceal their lower paws',()=>{
  const scene=CAT_SCENES.find(scene=>scene.id === 'station');
  const inside=(points,x,y)=>points.reduce((hit,[ax,ay],i)=>{
    const [bx,by]=points[(i+1)%points.length];
    return ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) ? !hit : hit;
  },false);
  for(const id of ['cocoa','gabriel','pebble']) {
    const cat=COLLECTION_CATS.find(cat=>cat.id===id), placement=sceneCatPlacement(scene,cat);
    const clip=sceneCatClipPath(scene,placement);
    const points=[...clip.matchAll(/(-?[\d.]+)% (-?[\d.]+)%/g)].map(match=>[Number(match[1]),Number(match[2])]);
    assert.equal(inside(points,50,30),true,`${id}'s head remains visible through the window`);
    assert.equal(inside(points,50,99),false,`${id}'s lower paws are concealed by the sloped sill`);
    for(const other of CAT_SCENES.filter(other=>other.id !== 'station')) {
      const otherPlacement=sceneCatPlacement(other,cat);
      assert.notDeepEqual(otherPlacement.window,placement.window,'the carriage aperture never follows a cat to another yard');
      if(!otherPlacement.opening && !(id === 'pebble' && other.id === 'snow')) assert.equal(sceneCatClipPath(other,otherPlacement),null);
    }
  }
});

test('owned sprites and locked silhouettes share the carriage occlusion without clipping the button hit area',()=>{
  const state=allOwned(), before=structuredClone(state);
  const full=catbookMarkup(invitedEverywhere(state),{sceneId:'station'});
  assert.deepEqual(state,before,'rendering never changes confirmed invitations');
  assert.equal((full.match(/class="book-cat-window"/g)||[]).length,6);
  for(const id of ['cocoa','gabriel']) {
    const button=full.match(new RegExp(`<button class="book-yard-cat[^>]*data-book-cat="${id}"[^>]*>[\\s\\S]*?</button>`))[0];
    assert.match(button,/><span class="book-cat-window" style="clip-path:polygon\(/);
    assert.doesNotMatch(button.split('>')[0],/clip-path/,'only the artwork is masked, preserving the accessible tap target');
  }
  state.collection.invited=[];
  const emptyBefore=structuredClone(state);
  assert.equal((catbookMarkup(invitedEverywhere(state),{sceneId:'station'}).match(/class="book-cat-window"/g)||[]).length,6);
  assert.deepEqual(state,emptyBefore);
  assert.equal((catbookMarkup(invitedEverywhere(before),{sceneId:'garden'}).match(/class="book-cat-window"/g)||[]).length,4);
});

test('garden cave rims hide the four peeking faces for both owned cats and locked contours',()=>{
  const state=allOwned(), before=structuredClone(state);
  for(const id of ['wheat','pebble','tart','ashbean']) {
    const cat=COLLECTION_CATS.find(cat=>cat.id===id), garden=CAT_SCENES.find(scene=>scene.id==='garden');
    const placement=sceneCatPlacement(garden,cat), mask=sceneCatClipPath(garden,placement);
    assert.match(mask,/^ellipse\(/);
    const [rx,ry,cx,cy]=[...mask.matchAll(/(-?[\d.]+)%/g)].map(match=>Number(match[1]));
    const inside=(x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
    assert.equal(inside(50,55),true,`${id}'s face remains visible at the opening`);
    assert.equal(inside(0,0),false,`${id}'s upper edge is hidden by the furniture rim`);
    for(const owned of [true,false]) {
      const snapshot=structuredClone(state);
      if(!owned) snapshot.collection.invited=snapshot.collection.invited.filter(cat=>cat.id!==id);
      const html=catbookMarkup(invitedEverywhere(snapshot),{sceneId:'garden'});
      const element=html.match(new RegExp(`<button\\b[^>]*class="book-yard-${owned ? 'cat' : 'placeholder'}[^>]*data-book-${owned ? 'cat' : 'locked-cat'}="${id}"[^>]*>[\\s\\S]*?class="book-cat-window" style="clip-path:([^\"]+)"`));
      assert.ok(element,`${id}'s ${owned ? 'sprite' : 'locked contour'} is masked`);
      assert.equal(element[1],mask);
      assert.doesNotMatch(element[0].split('>')[0],/clip-path/,'the hit target stays outside the mask');
    }
  }
  const garden=CAT_SCENES.find(scene=>scene.id==='garden'), maple=COLLECTION_CATS.find(cat=>cat.id==='maple'), porter=COLLECTION_CATS.find(cat=>cat.id==='porter');
  assert.equal(catArrivalScene(garden,maple),garden);
  assert.match(sceneCatPlacement(garden,maple).surface,/池塘.*石头/);
  assert.equal(sceneAllowsCat(garden,porter),false);
  assert.equal(catArrivalScene(garden,porter).id,'station');
  const html=catbookMarkup(invitedEverywhere(state),{sceneId:'garden'});
  assert.match(html,/class="book-cat-card[^>]*collected[^>]*data-book-cat="porter"/,'removing a scene guest keeps its collected record');
  assert.deepEqual(state,before,'occlusion and placement never mutate the save');
});

test('snow cabinet doors and reflections stay in front of both residents and locked silhouettes',()=>{
  const state=allOwned(), before=structuredClone(state), snow=CAT_SCENES.find(scene=>scene.id==='snow');
  for(const id of ['wheat','pebble']) {
    const cat=COLLECTION_CATS.find(cat=>cat.id===id), place=sceneCatPlacement(snow,cat);
    const glass=sceneCatGlassShapes(snow,place);
    assert.equal(glass.length,2,'a reflection stripe and frosted lower pane cover the face');
    assert.ok(glass.every(shape=>shape.opacity>0 && shape.opacity<1),'the cat stays visible behind the glass');
    for(const other of CAT_SCENES.filter(scene=>scene.id!=='snow')) assert.deepEqual(sceneCatGlassShapes(other,sceneCatPlacement(other,cat)),[]);
    for(const owned of [true,false]) {
      const snapshot=structuredClone(state);
      if(!owned) snapshot.collection.invited=snapshot.collection.invited.filter(cat=>cat.id!==id);
      const html=catbookMarkup(invitedEverywhere(snapshot),{sceneId:'snow'});
      const start=html.indexOf(`data-book-${owned ? 'cat' : 'locked-cat'}="${id}"`);
      const fragment=html.slice(start,html.indexOf('</button>',start));
      const art=fragment.indexOf(owned ? 'class="book-scene-cat"' : 'class="book-cat-silhouette"');
      assert.ok(art>=0);
      assert.ok(fragment.indexOf('class="book-cat-glass"')>art,'glass must be drawn over the cat artwork');
      assert.equal((fragment.match(/<polygon /g)||[]).length,2);
      assert.match(fragment,/class="book-cat-window" style="clip-path:polygon\(/,'cabinet frames crop the head edges');
    }
  }
  assert.deepEqual(state,before);
});

test('pole, roof frame and cactus cover only their overlapping cat artwork, including locked silhouettes',()=>{
  const state=allOwned(),before=structuredClone(state);
  const inside=(points,x,y)=>points.reduce((hit,[ax,ay],index)=>{
    const [bx,by]=points[(index+1)%points.length];
    return (ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax ? !hit : hit;
  },false);
  for(const [sceneId,id,hidden,visible] of [
    ['station','maple',[1238,429],[1188,421]],
    ['station','luna',[532,309],[569,321]],
    ['western','crinkle',[180,1482],[265,1494]],
  ]) {
    const scene=CAT_SCENES.find(scene=>scene.id===sceneId),cat=COLLECTION_CATS.find(cat=>cat.id===id),place=sceneCatPlacement(scene,cat);
    const clip=sceneCatClipPath(scene,place);
    assert.match(clip,/^polygon\(evenodd,/);
    const points=[...clip.matchAll(/(-?[\d.]+)% (-?[\d.]+)%/g)].map(match=>[Number(match[1]),Number(match[2])]);
    const [worldWidth,worldHeight]=scene.ratio.split('/').map(Number),[poseWidth,poseHeight]=place.ratio.split('/').map(Number);
    const width=worldWidth*place.size/100,height=width*poseHeight/poseWidth;
    const left=worldWidth*place.x/100-width/2,top=worldHeight*place.y/100-height*place.baseline/100;
    const visibleAt=([x,y])=>inside(points,(x-left)/width*100,(y-top)/height*100);
    assert.equal(visibleAt(hidden),false,`${id} is behind the foreground object`);
    assert.equal(visibleAt(visible),true,`${id}'s non-overlapping artwork remains visible`);
    for(const owned of [true,false]) {
      const snapshot=structuredClone(state);
      if(!owned) snapshot.collection.invited=snapshot.collection.invited.filter(record=>record.id!==id);
      const html=catbookMarkup(invitedEverywhere(snapshot),{sceneId});
      const fragment=html.match(new RegExp(`<button\\b[^>]*class="book-yard-${owned ? 'cat' : 'placeholder'}[^>]*data-book-${owned ? 'cat' : 'locked-cat'}="${id}"[^>]*>[\\s\\S]*?</button>`))[0];
      assert.ok(fragment.includes(`clip-path:${clip}`));
      assert.doesNotMatch(fragment.split('>')[0],/clip-path/,'the mask never clips the cat button or its tap target');
    }
    for(const other of CAT_SCENES.filter(scene=>scene.id!==sceneId && sceneAllowsCat(scene,cat))) {
      assert.equal(sceneCatPlacement(other,cat).occluders,undefined,'foreground objects never follow cats to another yard');
    }
  }
  assert.deepEqual(state,before,'depth masks never modify a save');
});
