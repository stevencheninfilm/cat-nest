import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurantProgressionPanel, progressionEntryMarkup } from '../src/restaurant-progression-ui.js';
import { initialState } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';

const resource=(kind,id,name,level,extra={})=>({key:`${kind}:${id}`,kind,id,name,level,description:'给小馆添一点新变化。',currency:'coins',cost:100,owned:false,available:false,status:'locked',...extra});
function fixture(currentLevel=2){
  const catalog=[
    resource('recipe','rice','暖暖蛋包饭',1,{owned:true,available:true,status:'owned',cost:0,preview:{type:'food',id:'rice'}}),
    resource('station','fridge','10 号冰箱',1,{owned:true,available:true,status:'owned',cost:0,preview:{type:'icon',id:'facility'}}),
    resource('staff','shadow','小黑',2,{available:true,status:'available',cost:220,preview:{type:'cat',id:'waiter'}}),
    resource('facility','fridge-2','保鲜冰箱升级',3,{targetLevel:2,preview:{type:'icon',id:'facility'}}),
    resource('research','rice-2','蛋包饭研发',4,{cost:72,targetLevel:2,preview:{type:'food',id:'rice'}}),
    resource('decoration','cream-library','暖光书房',4,{cost:180,preview:{type:'decoration',id:'cream-library'}}),
    resource('recipe','gold-salmon','金箔三文鱼饭',6,{currency:'goldFish',cost:30,preview:{type:'gold',id:'gold-salmon'}}),
    resource('training','speed-8','速度训练',8,{currency:'goldFish',cost:2,targetLevel:8,preview:{type:'icon',id:'training'}}),
    resource('decoration','royal','皇家猫宴',10,{currency:'goldFish',cost:12,preview:{type:'decoration',id:'royal'}}),
  ];
  return {progression:{level:currentLevel,nextLevel:currentLevel+1,experience:160,earnedExperience:100,legacyExperience:60,progress:.25,target:220,remaining:60,levelExperience:20,levelTarget:80,
    resourceCounts:{recipes:21,staff:7,facilities:4,decorations:9,abilities:4,stations:10},catalog,
    milestones:Array.from({length:10},(_,index)=>({level:index+1,startExperience:index*120,items:catalog.filter(item=>item.level===index+1),available:index+1<=currentLevel,current:index+1===currentLevel}))}};
}
const articles=markup=>[...markup.matchAll(/<article\b[^>]*data-r-progression-key="([^"]*)"[^>]*>[\s\S]*?<\/article>/g)];

test('the compact roadmap keeps its current level, XP and one inventory line without repeated explanatory blocks',()=>{
  const info=fixture(),before=structuredClone(info),markup=restaurantProgressionPanel(info);
  assert.match(markup,/data-r-progression-current-level="2"/);
  const hero=markup.match(/<header class="rp-hero">[\s\S]*?<\/header>/)[0];
  assert.match(hero,/<h3>Lv\.2<\/h3>/);assert.match(hero,/<strong>20 \/ 80<\/strong>/);
  assert.match(hero,/aria-valuenow="25"/);assert.match(hero,/style="width:25%"/);
  assert.doesNotMatch(markup,/rp-resource-counts|rp-experience-source|rp-footer|rp-continuation|每一次用心|再积攒|首次升级/);
  assert.doesNotMatch(markup,/rp-note|等级达标后，付费项目需另购/,'prices on each resource make another explanation row unnecessary');
  assert.match(markup,/已开放 <b>3\/9<\/b> 项 · 已拥有 <b>2<\/b> 项/);
  assert.deepEqual(info,before,'reading the roadmap never purchases, unlocks or changes experience');
});

test('the real resource catalog opening expands its starter set and previews the next level before the catalog',()=>{
  const now=Date.parse('2026-10-18T12:00:00Z'),info=restaurantInfo(initialState(now),now),before=structuredClone(info.progression);
  const markup=restaurantProgressionPanel(info),catalog=info.progression.catalog;
  assert.ok(catalog.length>=80);assert.equal(articles(markup).length,catalog.length,'every real resource remains in the expanded roadmap');
  const available=catalog.filter(item=>item.available).length,owned=catalog.filter(item=>item.owned).length;
  assert.ok(markup.includes(`已开放 <b>${available}/${catalog.length}</b> 项 · 已拥有 <b>${owned}</b> 项`));
  assert.ok(catalog.filter(item=>item.level===1).length>8);
  const current=markup.match(/<details\b([^>]*data-r-progression-level="1"[^>]*)>/)[1];
  assert.match(current,/is-current/);assert.match(current,/\bopen\b/,'the starter resources are expanded by default');
  const stationPanel=restaurantProgressionPanel(info,{category:'station'}),stationGroup=stationPanel.match(/<details\b([^>]*data-r-progression-level="1"[^>]*)>/)[1];
  assert.match(stationGroup,/\bopen\b/,'a focused category still opens its current-level resources');
  const next=catalog.filter(item=>item.level===info.progression.nextLevel),preview=markup.match(/<aside class="rp-next-stop"[\s\S]*?<\/aside>/)[0];
  assert.match(preview,/Lv\.2/);assert.doesNotMatch(preview,/<header>/,'the next stop uses one image-and-name row instead of a separate heading');
  for(const item of next.slice(0,3))assert.ok(preview.includes(item.name));
  assert.match(preview,/class="r-cat r-cat-waiter"/,'the next colleague appears with the real staff sprite');
  assert.doesNotMatch(preview,/鱼干|另付|达标/,'the preview contains the resource instead of a repeated payment explanation');
  assert.ok(markup.indexOf(preview)<markup.indexOf('data-r-progression-list'),'the next stop appears before the expanded resource groups');
  assert.doesNotMatch(markup,/data-r-action=/);assert.deepEqual(info.progression,before);
});

test('a next level with several resources keeps every preview in a keyboard-accessible horizontal strip',()=>{
  const info=fixture(),next=info.progression.nextLevel;
  info.progression.catalog.push(resource('staff','milky','奶盖',next,{preview:{type:'cat',id:'chef'}}));
  const preview=restaurantProgressionPanel(info).match(/<aside class="rp-next-stop"[\s\S]*?<\/aside>/)[0];
  assert.match(preview,/<small>2 项<\/small>/);assert.match(preview,/tabindex="0" aria-label="横向滑动查看 2 项下级资源"/);
  assert.equal((preview.match(/class="rp-next-item"/g)||[]).length,2);
  assert.match(preview,/保鲜冰箱升级/);assert.match(preview,/奶盖/);assert.doesNotMatch(preview,/data-r-action=/);
});

test('the fifty-level live roadmap opens every native range and level by default',()=>{
  const now=Date.parse('2026-10-18T12:00:00Z'),state=initialState(now),initial=restaurantInfo(state,now);
  assert.ok(initial.progression.catalog.length>=80);assert.equal(initial.progression.milestones.length,50);
  assert.equal(initial.progression.milestones.filter(milestone=>milestone.level>1).every(milestone=>milestone.items.length>0),true);
  const initialMarkup=restaurantProgressionPanel(initial),ranges=[...initialMarkup.matchAll(/<details\b([^>]*data-r-progression-range="([^"]+)"[^>]*)>/g)];
  assert.deepEqual(ranges.map(range=>range[2]),['1-10','11-20','21-30','31-40','41-50']);
  assert.match(ranges[0][1],/\bopen\b/);
  for(const range of ranges.slice(1))assert.match(range[1],/\bopen\b/);
  for(const group of initialMarkup.matchAll(/<details\b([^>]*data-r-progression-level="(\d+)"[^>]*)>/g))assert.match(group[1],/\bopen\b/,'starter and future resources all start expanded');
  assert.equal(articles(initialMarkup).length,initial.progression.catalog.length,'expanding ranges retains every catalog node');
  state.restaurant.stats.experience=levelStartXp(25);
  const middle=restaurantProgressionPanel(restaurantInfo(state,now)),middleRanges=[...middle.matchAll(/<details\b([^>]*data-r-progression-range="([^"]+)"[^>]*)>/g)];
  assert.deepEqual(middleRanges.filter(range=>/\bopen\b/.test(range[1])).map(range=>range[2]),['1-10','11-20','21-30','31-40','41-50']);
  assert.match(middle,/<b>Lv\.26<\/b>/,'the next-stop preview remains visible without opening distant ranges');
  assert.doesNotMatch(middle,/data-r-action=/);
});

test('experience continues past the fifty-level resource map while employee ability targets remain ten',()=>{
  const now=Date.parse('2026-10-18T12:00:00Z'),state=initialState(now);
  state.restaurant.stats.experience=levelStartXp(51);
  const info=restaurantInfo(state,now),markup=restaurantProgressionPanel(info);
  assert.equal(info.progression.level,51);assert.equal(info.progression.nextLevel,52);
  assert.match(markup,/<h3>Lv\.51<\/h3>/);assert.match(markup,/<b>Lv\.52<\/b>/);
  assert.match(markup,/现有资源门槛均已达到，经验继续增长/);
  assert.ok(markup.includes(`已开放 <b>${info.progression.catalog.length}/${info.progression.catalog.length}</b>`));
  for(const range of markup.matchAll(/<details\b([^>]*data-r-progression-range="([^"]+)"[^>]*)>/g))assert.match(range[1],/\bopen\b/,'past ranges also remain expanded by default');
  const training=restaurantProgressionPanel(info,{category:'training'});
  assert.equal(articles(training).length,9);
  assert.equal(Math.max(...info.progression.catalog.filter(item=>item.kind==='training').map(item=>item.targetLevel)),10);
  assert.match(training,/data-r-target-level="10"/);assert.doesNotMatch(training,/data-r-target-level="(?:11|50|51)"/);
  assert.doesNotMatch(markup,/已满级|最高等级|等级上限/);
});

test('all nine category controls filter actual catalog kinds and retain accessible selected state',()=>{
  const info=fixture(),all=restaurantProgressionPanel(info);
  assert.equal((all.match(/data-r-progression-category=/g)||[]).length,9);
  for(const category of ['feature','recipe','staff','facility','research','training','decoration','station']){
    const markup=restaurantProgressionPanel(info,{category}),expected=info.progression.catalog.filter(item=>item.kind===category);
    assert.equal(articles(markup).length,expected.length,category);
    for(const item of info.progression.catalog)assert.equal(articles(markup).some(article=>article[1]===item.key),item.kind===category);
    assert.match(markup,new RegExp(`data-r-progression-category="${category}" aria-pressed="true"`));
  }
  assert.equal(restaurantProgressionPanel(info,{category:'unknown'}),all,'a stale category restores the complete roadmap');
});

test('levels are ordered and all start expanded while the next one stays highlighted',()=>{
  const markup=restaurantProgressionPanel(fixture());
  const groups=[...markup.matchAll(/<details\b([^>]*data-r-progression-level="(\d+)"[^>]*)>/g)];
  assert.deepEqual(groups.map(group=>Number(group[2])),[1,2,3,4,6,8,10]);
  for(const [attributes,expected] of [[groups.find(group=>group[2]==='2')[1],'is-current'],[groups.find(group=>group[2]==='3')[1],'is-next']])assert.ok(attributes.includes(expected));
  assert.match(groups.find(group=>group[2]==='2')[1],/\bopen\b/);
  for(const group of groups.filter(group=>Number(group[2])>2))assert.match(group[1],/\bopen\b/,'future content starts expanded and native details remains clickable to collapse');
  assert.match(markup,/<h3>Lv\.3<small>下一站<\/small><\/h3>/);
  assert.doesNotMatch(markup,/累计 240 经验/,'each milestone keeps only its level and count');
});

test('resource cards show ownership, eligibility, target levels and separate prices without sending purchase actions',()=>{
  const markup=restaurantProgressionPanel(fixture()),cards=new Map(articles(markup).map(article=>[article[1],article[0]]));
  assert.match(cards.get('recipe:rice'),/已拥有/);assert.match(cards.get('staff:shadow'),/可购买/);assert.match(cards.get('decoration:royal'),/未到级/);
  assert.match(cards.get('facility:fridge-2'),/data-r-target-level="2"/);
  assert.match(cards.get('staff:shadow'),/<b>220<\/b> 小鱼干/);
  assert.match(cards.get('recipe:gold-salmon'),/<b>30<\/b> 金鱼干/);
  assert.match(cards.get('decoration:royal'),/<b>12<\/b> 金鱼干/);
  assert.doesNotMatch(cards.get('recipe:rice'),/rp-price|基础资源/,'owned resources do not repeat a purchase price');
  for(const [key,panel] of [['recipe:rice','recipes'],['recipe:gold-salmon','gold'],['staff:shadow','staff'],['facility:fridge-2','upgrades'],['research:rice-2','research'],['training:speed-8','training'],['decoration:royal','themes'],['station:fridge','flow']]){
    assert.ok(cards.get(key).includes(`data-r-tab="${panel}"`));
    assert.ok(cards.get(key).includes(`data-r-progression-resource="${key}"`));
    assert.doesNotMatch(cards.get(key),/小馆 Lv\.\d+ 开放|需另付|购入价/,'the enclosing milestone already supplies the restaurant level');
  }
  assert.doesNotMatch(markup,/data-r-action=/,'every card is a navigation aid, not a transaction');
});

test('compact resource headings keep each ability target once and preserve the main-chef navigation hook',()=>{
  const now=Date.parse('2026-10-18T12:00:00Z'),info=restaurantInfo(initialState(now),now);
  const training=new Map(articles(restaurantProgressionPanel(info,{category:'training'})).map(article=>[article[1],article[0]]));
  const heading=training.get('training:10').match(/<div class="rp-resource-heading">[\s\S]*?<\/div>/)[0];
  assert.match(heading,/<h4>四项员工能力<\/h4>/);assert.equal((heading.match(/Lv\.10/g)||[]).length,1);
  assert.match(heading,/aria-label="能力等级 10"/);assert.match(training.get('training:10'),/每人每项/);
  assert.match(training.get('training:10'),/<b>7<\/b> 金鱼干/);
  const staff=new Map(articles(restaurantProgressionPanel(info,{category:'staff'})).map(article=>[article[1],article[0]]));
  assert.match(staff.get('staff:chef'),/data-r-tab="training" data-r-progression-resource="staff:chef"/);
});

test('per-item pricing descriptions remain authoritative when no single cost applies',()=>{
  const info=fixture(),training=info.progression.catalog.find(item=>item.kind==='training');
  training.cost=null;training.description='每位员工分别定价，升至 8–10 级使用金鱼干。';
  const markup=restaurantProgressionPanel(info,{category:'training'}),card=articles(markup)[0][0];
  assert.match(card,/每位员工分别定价/);assert.match(card,/8–10 级使用金鱼干/);
  assert.doesNotMatch(card,/rp-price|基础资源|免费|需另付/);
});

test('growth after the last resource uses one short continuation while newly registered milestones still render',()=>{
  const info=fixture(11),markup=restaurantProgressionPanel(info);
  assert.match(markup,/<h3>Lv\.11<\/h3>/);assert.match(markup,/<b>Lv\.12<\/b>/);
  assert.equal((markup.match(/现有资源门槛均已达到，经验继续增长/g)||[]).length,1);
  assert.doesNotMatch(markup,/已满级|最高等级|等级上限|满级 10/);
  info.progression.catalog.push(resource('recipe','new-dish','新料理',12));
  const expanded=restaurantProgressionPanel(info);
  assert.match(expanded,/is-next is-future" data-r-progression-level="12"/);assert.match(expanded,/新料理/);
  assert.doesNotMatch(expanded,/现有资源门槛均已达到/,'a newly registered later item keeps its real future gate');
});

test('shared production asset URLs and escaped catalog text render safely',t=>{
  const previous=globalThis.document;globalThis.document={baseURI:'https://example.test/cat-nest/'};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const info=fixture(),royal=info.progression.catalog.find(item=>item.id==='royal');
  royal.name='<img src=x onerror="bad">';royal.description='A&B <script>bad</script>';royal.key='bad" data-r-action="hire';
  const markup=restaurantProgressionPanel(info);
  assert.ok(markup.includes('src="https://example.test/cat-nest/assets/restaurant/gold-v1/special-salmon.webp"'));
  assert.ok(markup.includes('src="https://example.test/cat-nest/assets/restaurant/gold-v1/theme-royal.webp"'));
  assert.ok(markup.includes('src="https://example.test/cat-nest/assets/restaurant/decor/cream-library/scene.webp"'));
  const now=Date.parse('2026-10-18T12:00:00Z'),real=restaurantProgressionPanel(restaurantInfo(initialState(now),now),{category:'station'});
  assert.ok(real.includes('src="https://example.test/cat-nest/assets/restaurant/kitchen-v1/fridge-closed.webp"'));
  assert.ok(markup.includes('&lt;img src=x onerror=&quot;bad&quot;&gt;'));assert.ok(markup.includes('A&amp;B &lt;script&gt;bad&lt;/script&gt;'));
  assert.doesNotMatch(markup,/<script>|<img src=x|data-r-action="hire"/);
});

test('the compact entry works before info loads, while empty categories and malformed progress remain readable',()=>{
  const entry=progressionEntryMarkup();assert.match(entry,/data-r-tab="progression"/);assert.match(entry,/小馆成长路线/);assert.doesNotMatch(entry,/undefined|NaN|满级/);
  assert.match(progressionEntryMarkup(fixture()),/小馆 · Lv\.2/);
  assert.match(restaurantProgressionPanel(),/成长路线正在整理/);
  const info=fixture();info.progression.catalog=[];info.progression.progress=Infinity;
  assert.match(restaurantProgressionPanel(info,{category:'recipe'}),/这个分类暂时没有资源/);
  assert.match(restaurantProgressionPanel(info),/aria-valuenow="0"/);
  assert.doesNotMatch(restaurantProgressionPanel(info),/undefined|NaN|Infinity/);
});
