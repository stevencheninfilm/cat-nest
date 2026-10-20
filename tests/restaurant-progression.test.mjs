import { KITCHEN_CIRCLE_PALETTES } from '../src/restaurant-circle-palettes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState } from '../src/state.js';
import { restaurantLevelInfo as levelInfo, levelStartXp as legacyLevelStartXp, restaurantLevelStartXp as levelStartXp } from '../src/growth-levels.js';
import { initialRestaurant, normalizeRestaurant, validRestaurant, restaurantInfo, restaurantLevel, RESTAURANT_RECIPES, RESTAURANT_STAFF, RESTAURANT_UPGRADES } from '../src/restaurant.js';
import { SPECIAL_RESTAURANT_RECIPES, PREMIUM_RESTAURANT_THEMES } from '../src/restaurant-economy.js';
import { RESTAURANT_DECORATIONS } from '../src/restaurant-decor.js';
import { KITCHEN_ZONES } from '../src/restaurant-kitchen.js';
import { initialRestaurantProgression, validRestaurantProgression, normalizeRestaurantProgression, restaurantExperience, restaurantExperienceInfo, restaurantProgressionInfo, restaurantResourceLevel, restaurantRecipeUnlocked } from '../src/restaurant-progression.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
const catalogs={recipes:[...RESTAURANT_RECIPES,...SPECIAL_RESTAURANT_RECIPES],staff:RESTAURANT_STAFF,upgrades:RESTAURANT_UPGRADES,decorations:RESTAURANT_DECORATIONS,premiumThemes:PREMIUM_RESTAURANT_THEMES,zones:KITCHEN_ZONES};
function restaurantWithExperience(experience,offset=0) {
  const restaurant=initialRestaurant(NOW);restaurant.stats.experience=experience;restaurant.progression={version:2,experienceOffset:offset,legacyRecipes:[]};
  return restaurant;
}
const roadmap=restaurant=>restaurantProgressionInfo(restaurant,catalogs);
const OLD_RECIPE_LEVELS={rice:1,coffee:1,sandwich:1,donut:1,lemontea:1,pancake:2,pudding:2,matcha:2,burger:3,udon:3,waffle:3,strawberrymilk:3,pizza:4,sushi:4,grape:4,parfait:5,cheesecake:5,cocoa:5};
const oldRecipesAt=level=>Object.keys(OLD_RECIPE_LEVELS).filter(id=>OLD_RECIPE_LEVELS[id]<=level).sort();

test('restaurant effective experience follows the restaurant half-cost ladder at every tested boundary',()=>{
  for(const level of [1,2,3,5,8,10,11,20,49,50,51,100,1000000]) {
    const start=levelStartXp(level),target=60+15*(level-1);
    for(const xp of [start,Math.max(0,start-.1),start+.1,start+target-.1,start+target]) {
      const restaurant=restaurantWithExperience(xp),growth=levelInfo(xp),info=restaurantExperienceInfo(restaurant);
      assert.equal(restaurantExperience(restaurant),xp);
      assert.equal(info.level,growth.level);assert.equal(restaurantLevel(xp),growth.level);
      assert.equal(info.levelExperience,growth.progress);assert.equal(info.levelTarget,growth.target);
      assert.equal(info.target,levelStartXp(growth.level+1));assert.equal(info.nextLevel,growth.level+1);
      assert.equal(info.earnedExperience,xp);assert.equal(info.legacyExperience,0);
    }
  }
});

test('effective experience adds decimal migration credit exactly without altering earned experience',()=>{
  for(const [earned,offset,expected] of [[36,84,120],[119.8,.1,119.9],[119.9,.1,120],[269.8,.1,269.9],[269.9,.1,270],[.1,.2,.3]]) {
    const restaurant=restaurantWithExperience(earned,offset),before=structuredClone(restaurant),info=restaurantExperienceInfo(restaurant);
    assert.equal(restaurantExperience(restaurant),expected);assert.equal(info.experience,expected);
    assert.equal(info.level,levelInfo(expected).level);assert.equal(info.earnedExperience,earned);assert.equal(info.legacyExperience,offset);
    assert.deepEqual(restaurant,before,'projection never writes credit into the real experience ledger');
  }
});

test('restaurant growth continues beyond the fifty-level resource map and preserves large save boundaries',()=>{
  for(const level of [51,100,1000000]) {
    const restaurant=restaurantWithExperience(levelStartXp(level)),info=roadmap(restaurant);
    assert.equal(info.level,level);assert.equal(info.nextLevel,level+1);assert.equal(info.levelTarget,60+15*(level-1));
    assert.equal(info.lastUnlockLevel,50);assert.equal(info.nextUnlockLevel,null);
    assert.equal(info.catalog.every(item=>item.available),true,'the finite resource map does not cap experience');
  }
  const largest=restaurantWithExperience(Number.MAX_SAFE_INTEGER);
  assert.equal(restaurantExperience(largest),Number.MAX_SAFE_INTEGER);
  assert.equal(restaurantExperienceInfo(largest).level,levelInfo(Number.MAX_SAFE_INTEGER).level);
});

test('legacy six-order and twenty-four-order restaurants retain reached levels without changing any reward or wallet',()=>{
  for(const [served,earned,expectedLevel,offset] of [[6,36,2,84],[24,144,5,516],[24,700,5,0]]) {
    const state=initialState(NOW);state.coins=417;state.goldFish=9;state.xp=777.1;
    state.restaurant.stats={served,earned:913,experience:earned};state.restaurant.nextOrderId=served+1;delete state.restaurant.progression;
    const before=structuredClone(state),pure=normalizeRestaurantProgression(state.restaurant),restored=normalizeState(state,NOW);
    assert.deepEqual({...pure,legacyRecipes:[...pure.legacyRecipes].sort()},{version:2,experienceOffset:offset,legacyRecipes:oldRecipesAt(expectedLevel)});assert.equal(validRestaurant(restored.restaurant),true);
    assert.equal(restaurantInfo(restored,NOW).level,levelInfo(earned+offset).level);
    assert.equal(restored.restaurant.stats.experience,earned);assert.equal(restored.restaurant.stats.earned,913);assert.equal(restored.restaurant.stats.served,served);
    assert.equal(restored.coins,417);assert.equal(restored.goldFish,9);assert.equal(restored.xp,777.1);
    assert.deepEqual(state,before,'migration does not mutate the loaded object');
  }
});

test('legacy migration is a one-time offset and repeated normalization never stacks it',()=>{
  const legacy=restaurantWithExperience(36);legacy.stats.served=6;legacy.nextOrderId=7;delete legacy.progression;
  assert.equal(restaurantExperience(legacy),120);
  const first=normalizeRestaurant(legacy,NOW);assert.deepEqual({...first.progression,legacyRecipes:[...first.progression.legacyRecipes].sort()},{version:2,experienceOffset:84,legacyRecipes:oldRecipesAt(2)});
  let repeated=first;
  for(let index=0;index<5;index++)repeated=normalizeRestaurant(JSON.parse(JSON.stringify(repeated)),NOW+index*1000);
  assert.deepEqual(repeated.progression,first.progression);assert.equal(repeated.stats.experience,36);assert.equal(restaurantExperience(repeated),120);
  repeated.stats.experience=42;
  const afterPayment=normalizeRestaurant(repeated,NOW+10000);
  assert.equal(afterPayment.progression.experienceOffset,84);assert.equal(afterPayment.stats.experience,42);assert.equal(restaurantExperience(afterPayment),126);
});

test('progression validation accepts legacy v1 and exact v2 ledgers with a finite one-decimal offset through 660',()=>{
  assert.deepEqual(initialRestaurantProgression(),{version:2,experienceOffset:0,legacyRecipes:[]});
  for(const experienceOffset of [0,.1,.3,1,119.9,120,659.9,660])for(const version of [1,2])assert.equal(validRestaurantProgression({version,experienceOffset,...(version===2?{legacyRecipes:[]}:{} )}),true,`valid version=${version}, offset=${experienceOffset}`);
  for(const value of [null,undefined,[],{}, {version:1},{experienceOffset:0},{version:0,experienceOffset:0},{version:'1',experienceOffset:0},{version:2,experienceOffset:0},{version:1,experienceOffset:0,legacyRecipes:[]},{version:2,experienceOffset:0,legacyRecipes:[],extra:0}])assert.equal(validRestaurantProgression(value),false);
  for(const experienceOffset of [-1,-.1,.01,.11,660.1,661,Infinity,NaN,'120',null])assert.equal(validRestaurantProgression({version:2,experienceOffset,legacyRecipes:[]}),false,`invalid offset=${String(experienceOffset)}`);
  assert.equal(validRestaurantProgression({version:2,experienceOffset:0,legacyRecipes:[]},Number.MAX_SAFE_INTEGER),true);
  assert.equal(validRestaurantProgression({version:2,experienceOffset:1,legacyRecipes:[]},Number.MAX_SAFE_INTEGER),false,'migration cannot overflow earned safe-integer experience');
});

test('v2 legacy recipe permissions are unique arrays of known ordinary recipe IDs only',()=>{
  assert.equal(validRestaurantProgression({version:2,experienceOffset:0,legacyRecipes:Object.keys(OLD_RECIPE_LEVELS)}),true);
  for(const legacyRecipes of [undefined,null,{},'rice',['rice','rice'],['unknown'],['gold-salmon'],['gold-latte'],['constructor'],[1],['rice',null],[['rice']],['rice',['rice']]])assert.equal(validRestaurantProgression({version:2,experienceOffset:0,legacyRecipes}),false,`invalid legacy recipes=${JSON.stringify(legacyRecipes)}`);
});

test('v1 migration freezes precisely the already-open ordinary menu under the old one-through-five rules',()=>{
  for(const level of [1,2,3,4,5,10,49,50]) {
    const legacy=restaurantWithExperience(legacyLevelStartXp(level));legacy.progression={version:1,experienceOffset:0};
    const before=structuredClone(legacy),migrated=normalizeRestaurant(legacy,NOW);
    assert.equal(migrated.progression.version,2);assert.deepEqual([...migrated.progression.legacyRecipes].sort(),oldRecipesAt(level));
    assert.equal(migrated.stats.experience,legacy.stats.experience);assert.equal(restaurantExperience(migrated),restaurantExperience(legacy));
    for(const id of oldRecipesAt(level).filter(id=>!['sushi','pizza'].includes(id)))assert.equal(restaurantRecipeUnlocked(migrated,catalogs.recipes.find(recipe=>recipe.id===id)),true,`${id} remains available after widening the map`);
    assert.deepEqual(legacy,before);
  }
});

test('migration consumes existing effective XP credit but a v2 ledger never dynamically expands its grandfathered list',()=>{
  const legacy=restaurantWithExperience(36);legacy.progression={version:1,experienceOffset:84};
  const migrated=normalizeRestaurant(legacy,NOW),frozen=[...migrated.progression.legacyRecipes];
  assert.equal(restaurantExperience(migrated),120);assert.deepEqual([...frozen].sort(),oldRecipesAt(2));
  migrated.stats.experience=levelStartXp(50);
  const advanced=normalizeRestaurant(migrated,NOW+1000);
  assert.deepEqual(advanced.progression.legacyRecipes,frozen);
  advanced.stats.experience=0;
  const reloaded=normalizeRestaurant(JSON.parse(JSON.stringify(advanced)),NOW+2000);
  assert.deepEqual(reloaded.progression.legacyRecipes,frozen,'later XP and repeated reload never recalculate legacy recipe ownership');
  const fresh=restaurantWithExperience(levelStartXp(50)),freshLoaded=normalizeRestaurant(fresh,NOW);
  assert.deepEqual(freshLoaded.progression.legacyRecipes,[],'high-level v2 homes do not silently become legacy homes');
});

test('migration preserves researched dishes and active legacy orders without changing their saved amounts or timing',()=>{
  for(const version of [null,1]) {
    const legacy=restaurantWithExperience(0);delete legacy.parties;
    if(version===null)delete legacy.progression;else legacy.progression={version:1,experienceOffset:0};
    legacy.recipeLevels.cocoa=3;legacy.nextOrderId=2;
    const order={id:'table-1',recipeId:'pizza',createdAt:NOW,readyAt:NOW+23000,servedAt:null,recipeLevel:1,tipsLevel:1,kitchenLevel:1,staffLevel:0,actorId:'legacy-client'};
    legacy.orders=[order];const before=structuredClone(legacy);
    assert.equal(validRestaurant(legacy),true);
    const migrated=normalizeRestaurant(legacy,NOW+1000),expected=[...oldRecipesAt(1),'cocoa','pizza'].sort();
    assert.equal(validRestaurant(migrated),true);assert.deepEqual([...migrated.progression.legacyRecipes].sort(),expected);
    assert.deepEqual(migrated.orders,[order]);assert.equal(migrated.recipeLevels.cocoa,3);assert.equal(migrated.recipeLevels.pizza,1);
    assert.equal(restaurantInfo(migrated,NOW+1000).recipes.find(recipe=>recipe.id==='cocoa').unlocked,true);
    assert.equal(restaurantInfo(migrated,NOW+1000).specialRecipes.find(recipe=>recipe.id==='pizza').owned,false);assert.ok(!restaurantInfo(migrated,NOW+1000).recipes.some(recipe=>recipe.id==='pizza'));
    migrated.orders=[];migrated.parties=[];
    const afterCollection=normalizeRestaurant(migrated,NOW+30000);
    assert.deepEqual([...afterCollection.progression.legacyRecipes].sort(),expected,'an inherited active order grants a permanent permission rather than one inferred on each reload');
    assert.deepEqual(legacy,before);
  }
});

test('owned special recipes remain independent from migrated ordinary permissions and are counted once in the live menu',()=>{
  const legacy=restaurantWithExperience(0);legacy.progression={version:1,experienceOffset:0};
  legacy.ownedSpecialRecipes=SPECIAL_RESTAURANT_RECIPES.map(recipe=>recipe.id);
  for(const id of legacy.ownedSpecialRecipes)legacy.recipeLevels[id]=1;
  const migrated=normalizeRestaurant(legacy,NOW),info=restaurantInfo(migrated,NOW);
  assert.equal(validRestaurant(migrated),true);assert.deepEqual([...migrated.progression.legacyRecipes].sort(),oldRecipesAt(1));
  assert.equal(info.recipes.filter(recipe=>recipe.special&&recipe.unlocked).length,5);
  assert.equal(info.specialRecipes.filter(recipe=>recipe.owned&&recipe.unlocked).length,5);
  assert.equal(info.recipes.filter(recipe=>recipe.unlocked).length,10,'five old base dishes plus five purchased special dishes');
  migrated.stats.experience=levelStartXp(50);
  const fullyAvailable=restaurantInfo(migrated,NOW);
  assert.equal(fullyAvailable.recipes.filter(recipe=>recipe.unlocked).length,21);
  assert.equal(new Set(fullyAvailable.recipes.map(recipe=>recipe.id)).size,21);
  assert.equal(fullyAvailable.progression.catalog.filter(item=>item.kind==='recipe'&&item.owned).length,21);
});

test('the roadmap catalog comes from the live 21 dishes, seven staff, four facilities, fifteen scene decorations, five palettes and ten zones',()=>{
  const info=roadmap(restaurantWithExperience(0)),byKind=kind=>info.catalog.filter(item=>item.kind===kind);
  assert.equal(catalogs.recipes.length,21);assert.equal(catalogs.staff.length+1,7);assert.equal(catalogs.upgrades.length,4);
  assert.equal(catalogs.decorations.length+catalogs.premiumThemes.length,15);assert.equal(catalogs.zones.length,10);
  assert.deepEqual(info.resourceCounts,{recipes:21,staff:7,facilities:4,decorations:20,abilities:4,stations:10});
  const expected=21+7+catalogs.upgrades.reduce((sum,item)=>sum+item.maxLevel,0)+4+9+20+10;
  assert.equal(info.catalog.length,expected);assert.equal(new Set(info.catalog.map(item=>item.key)).size,expected);
  assert.equal(byKind('recipe').length,21);assert.equal(byKind('staff').length,7);assert.equal(byKind('facility').length,catalogs.upgrades.reduce((sum,item)=>sum+item.maxLevel,0));
  assert.equal(byKind('research').length,4);assert.equal(byKind('training').length,9);assert.equal(byKind('decoration').length,20);assert.equal(byKind('station').length,10);
});

test('every resource appears in exactly one milestone with the real shared XP threshold',()=>{
  const info=roadmap(restaurantWithExperience(levelStartXp(5))),items=info.milestones.flatMap(milestone=>milestone.items);
  assert.equal(items.length,info.catalog.length);assert.equal(new Set(items.map(item=>item.key)).size,info.catalog.length);
  assert.deepEqual(items.map(item=>item.key).sort(),info.catalog.map(item=>item.key).sort());
  assert.deepEqual(info.milestones.map(milestone=>milestone.level),Array.from({length:50},(_,index)=>index+1));
  for(const milestone of info.milestones) {
    assert.equal(milestone.startExperience,levelStartXp(milestone.level));assert.equal(milestone.available,milestone.level<=5);assert.equal(milestone.current,milestone.level===5);
    assert.ok(milestone.items.length>=1,`level ${milestone.level} contains a real resource`);
    assert.equal(milestone.items.every(item=>item.level===milestone.level),true);
  }
  assert.equal(info.lastUnlockLevel,50);assert.equal(info.nextUnlockLevel,6);
});

test('the resource map contains no invented menu, employee, decoration, facility or kitchen station IDs',()=>{
  const info=roadmap(restaurantWithExperience(0)),ids=kind=>info.catalog.filter(item=>item.kind===kind).map(item=>item.id).sort();
  assert.deepEqual(ids('recipe'),catalogs.recipes.map(recipe=>recipe.id).sort());
  assert.deepEqual(ids('staff'),['chef',...catalogs.staff.map(employee=>employee.id)].sort());
  assert.deepEqual(ids('decoration'),[...catalogs.decorations,...catalogs.premiumThemes,...KITCHEN_CIRCLE_PALETTES].map(decoration=>decoration.id).sort());
  assert.deepEqual(ids('station'),catalogs.zones.map(zone=>String(zone.id)).sort());
  assert.deepEqual(ids('research'),['research-2','research-3','research-4','research-5']);
  assert.deepEqual(ids('training'),Array.from({length:9},(_,index)=>`training-${index+2}`).sort());
  const expectedFacilityKeys=catalogs.upgrades.flatMap(upgrade=>Array.from({length:upgrade.maxLevel},(_,index)=>`facility:${upgrade.id}:${index+1}`));
  assert.deepEqual(info.catalog.filter(item=>item.kind==='facility').map(item=>item.key).sort(),expectedFacilityKeys.sort());
  assert.deepEqual([...new Set(info.catalog.map(item=>item.kind))].sort(),['decoration','facility','recipe','research','staff','station','training']);
});

test('training roadmap charges coins for target levels two through seven and gold only for eight through ten',()=>{
  const training=roadmap(restaurantWithExperience(0)).catalog.filter(item=>item.kind==='training').sort((a,b)=>a.targetLevel-b.targetLevel);
  assert.deepEqual(training.map(item=>item.targetLevel),[2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(training.map(item=>item.currency),['coins','coins','coins','coins','coins','coins','goldFish','goldFish','goldFish']);
  assert.deepEqual(training.map(item=>item.cost),[80,130,200,300,440,620,2,4,7]);
  for(const item of training)assert.equal(item.level,restaurantResourceLevel('training',null,item.targetLevel));
  assert.equal(training.every(item=>item.targetLevel<=10&&item.level>=1&&item.level<=50),true,'the map broadens while each ability still has ten levels');
  assert.deepEqual(training.map(item=>item.level),training.map(item=>item.level).sort((a,b)=>a-b));
});

test('level fifty opens every purchase permission without claiming unpurchased resources as owned',()=>{
  const restaurant=restaurantWithExperience(levelStartXp(50)),before=structuredClone(restaurant),info=roadmap(restaurant);
  assert.equal(info.catalog.every(item=>item.available),true);assert.equal(info.nextUnlockLevel,null);
  const find=key=>info.catalog.find(item=>item.key===key);
  for(const recipe of SPECIAL_RESTAURANT_RECIPES)assert.equal(find(`recipe:${recipe.id}`).status,'available');
  for(const employee of RESTAURANT_STAFF)assert.equal(find(`staff:${employee.id}`).owned,false);
  for(const upgrade of RESTAURANT_UPGRADES)for(let target=2;target<=upgrade.maxLevel;target++)assert.equal(find(`facility:${upgrade.id}:${target}`).owned,false);
  for(const theme of PREMIUM_RESTAURANT_THEMES)assert.equal(find(`decoration:${theme.id}`).status,'available');
  for(const suite of RESTAURANT_DECORATIONS.filter(suite=>suite.cost>0))assert.equal(find(`decoration:${suite.id}`).owned,false);
  assert.equal(find('staff:chef').status,'owned');assert.equal(find('decoration:cream-bakery').status,'owned');
  assert.equal(info.catalog.filter(item=>item.kind==='training'||item.kind==='research').every(item=>!item.owned),true);
  assert.deepEqual(restaurant,before,'viewing the entire roadmap never buys, hires or trains anything');
});

test('levels forty-nine and fifty follow the halved XP thresholds and leave final resources locked until fifty',()=>{
  const before49=roadmap(restaurantWithExperience(19799.9)),at49=roadmap(restaurantWithExperience(19800)),before50=roadmap(restaurantWithExperience(20579.9)),at50=roadmap(restaurantWithExperience(20580));
  assert.equal(before49.level,48);assert.equal(at49.level,49);assert.equal(before50.level,49);assert.equal(at50.level,50);
  assert.equal(at49.startExperience,19800);assert.equal(at50.startExperience,20580);
  assert.equal(at49.nextUnlockLevel,50);assert.equal(at50.nextUnlockLevel,null);
  const last=at49.catalog.filter(item=>item.level===50);assert.ok(last.length>0);
  assert.equal(last.every(item=>!item.available&&!item.owned),true);
  for(const item of last)assert.equal(at50.catalog.find(other=>other.key===item.key).available,true);
});

test('the recipe unlock helper uses central map levels and preserves explicit legacy and special ownership',()=>{
  for(const recipe of RESTAURANT_RECIPES) {
    const unlock=restaurantResourceLevel('recipe',recipe.id),at=restaurantWithExperience(levelStartXp(unlock));
    assert.ok(unlock>=1&&unlock<=50);assert.equal(restaurantRecipeUnlocked(at,recipe),true);
    if(unlock>1){const before=restaurantWithExperience(levelStartXp(unlock)-.1);assert.equal(restaurantRecipeUnlocked(before,recipe),false);}
    const preserved=restaurantWithExperience(0);preserved.progression.legacyRecipes=[recipe.id];
    assert.equal(restaurantRecipeUnlocked(preserved,recipe),true);
  }
  for(const recipe of SPECIAL_RESTAURANT_RECIPES) {
    const state=restaurantWithExperience(levelStartXp(50));assert.equal(restaurantRecipeUnlocked(state,recipe),false,'a level alone never buys a special recipe');
    state.stats.experience=0;state.ownedSpecialRecipes=[recipe.id];
    assert.equal(restaurantRecipeUnlocked(state,recipe),true,'already bought special recipes survive the wider level map');
  }
});
