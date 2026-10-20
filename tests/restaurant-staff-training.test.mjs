import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_TRAINING_MAX_LEVEL, STAFF_ENERGY_RECOVERY_MS, STAFF_TRAINING_STATS, normalizeStaffTraining, validStaffTraining, workerAbilitySnapshot, staffTrainingUpgradeCost, workerOrderEnergyCost, workerEnergyReadyAt, reserveWorkerEnergy, trainingUpgradeResult, staffTrainingInfo } from '../src/restaurant-staff-training.js';

const NOW=Date.parse('2026-10-18T12:00:00Z');
const wallet={coins:100000,goldFish:1000};
const training=staff=>normalizeStaffTraining(undefined,NOW,staff);

test('legacy saves create independent level-one training and full stamina for each active worker',()=>{
  const data=training(2);
  assert.deepEqual(Object.keys(data),['worker-1','worker-2','worker-3']);
  assert.equal(validStaffTraining(data,2),true);
  assert.deepEqual(data['worker-1'],{levels:{speed:1,stamina:1,endurance:1,skill:1},energyBase:200,abilityVersion:2,energy:200,energyAt:NOW});
  data['worker-1'].levels.speed=5;
  assert.equal(data['worker-2'].levels.speed,1);
  assert.deepEqual(Object.keys(training(8)).at(-1),'worker-9','future roster rows can be registered without a source-code branch');
});

test('training validation rejects impossible levels, energy, timestamps and unauthorised workers',()=>{
  for(const mutate of [
    data=>{data['worker-1'].levels.skill=11;},data=>{data['worker-1'].energy=201;},
    data=>{data['worker-1'].energy=-1;},data=>{data['worker-1'].energyAt=1.2;},
    data=>{data['worker-1'].levels.happiness=3;},data=>{data['worker-2']=structuredClone(data['worker-1']);},
  ]){const data=training(0);mutate(data);assert.equal(validStaffTraining(data,0),false);}
  assert.equal(validStaffTraining([],0),false);
  const repaired=normalizeStaffTraining({'worker-1':{levels:{speed:999,stamina:3},energy:999,energyAt:-1}},NOW,0);
  assert.equal(validStaffTraining(repaired,0),true);
  assert.equal(repaired['worker-1'].levels.speed,1);assert.equal(repaired['worker-1'].levels.stamina,3);
  assert.equal(repaired['worker-1'].energy,260);assert.equal(repaired['worker-1'].energyAt,NOW);
});

test('training charges ordinary currency through target level 7 and gold only for target levels 8–10',()=>{
  assert.equal(STAFF_TRAINING_MAX_LEVEL,10);
  for(const stat of STAFF_TRAINING_STATS) {
    for(let level=1;level<=9;level++) {
      const cost=staffTrainingUpgradeCost(stat.id,level);
      assert.equal(cost.targetLevel,level+1);assert.ok(cost.amount>0);
      assert.equal(cost.currency,level>=7?'goldFish':'coins');
    }
    assert.equal(staffTrainingUpgradeCost(stat.id,10),null);
  }
  assert.deepEqual([7,8,9].map(level=>staffTrainingUpgradeCost('speed',level).amount),[2,4,7]);
  for(const level of [0,-1,1.5,'1',11])assert.equal(staffTrainingUpgradeCost('speed',level),null);
  assert.equal(staffTrainingUpgradeCost('coins',1),null);
});

test('one ability can reach level ten without changing any other worker or ability',()=>{
  const original=training(2);let data=original,balances={...wallet},coinSpent=0,goldSpent=0;
  for(let level=1;level<10;level++) {
    const result=trainingUpgradeResult(data,'worker-2','speed',balances,NOW,2);
    assert.equal(result.ok,true);assert.equal(result.level,level+1);
    if(result.cost.currency==='coins')coinSpent+=result.cost.amount;else goldSpent+=result.cost.amount;
    data=result.training;balances={coins:result.coins,goldFish:result.goldFish};
  }
  assert.equal(data['worker-2'].levels.speed,10);
  assert.equal(data['worker-1'].levels.speed,1);assert.equal(data['worker-3'].levels.speed,1);
  assert.equal(data['worker-2'].levels.skill,1);assert.equal(original['worker-2'].levels.speed,1);
  assert.equal(balances.coins,wallet.coins-coinSpent);assert.equal(balances.goldFish,wallet.goldFish-goldSpent);
  assert.equal(trainingUpgradeResult(data,'worker-2','speed',balances,NOW,2).ok,false);
});

test('insufficient currency, foreign staff and forged statistic IDs leave the input unchanged',()=>{
  const data=training(0),before=structuredClone(data);
  for(const [id,stat,balances] of [['worker-1','speed',{coins:0,goldFish:100}],['worker-2','speed',wallet],['worker-0','speed',wallet],['worker-1','coins',wallet],['__proto__','speed',wallet]])assert.equal(trainingUpgradeResult(data,id,stat,balances,NOW,0).ok,false);
  data['worker-1'].levels.speed=7;
  assert.equal(trainingUpgradeResult(data,'worker-1','speed',{coins:10000,goldFish:1},NOW,0).ok,false);
  data['worker-1'].levels.speed=1;
  assert.deepEqual(data,before);
});

test('each skill has an independent observable effect and level-one timings stay unchanged',()=>{
  const data=training(1),base=workerAbilitySnapshot('worker-1',data,NOW);
  assert.equal(base.walkMsMultiplier,1);assert.equal(base.workMsMultiplier,1);assert.equal(base.enduranceMultiplier,1);assert.equal(base.maxEnergy,200);assert.equal(base.qualityMultiplier,1);
  data['worker-1'].levels={speed:10,stamina:10,endurance:10,skill:10};
  const trained=workerAbilitySnapshot('worker-1',data,NOW),other=workerAbilitySnapshot('worker-2',data,NOW);
  assert.ok(trained.walkMsMultiplier<base.walkMsMultiplier);assert.ok(trained.workMsMultiplier<base.workMsMultiplier);
  assert.ok(trained.maxEnergy>base.maxEnergy);assert.ok(trained.enduranceMultiplier<base.enduranceMultiplier);
  assert.equal(trained.qualityMultiplier,1.27);assert.equal(other.qualityMultiplier,1);
  assert.equal(other.walkMsMultiplier,1);assert.equal(other.maxEnergy,200);
  assert.equal(workerOrderEnergyCost(9,base),48);assert.equal(workerOrderEnergyCost(9,trained),5);
  assert.equal(workerOrderEnergyCost(Array.from({length:4}),base),28);
});

test('stamina is spent once per reserved order and cannot regenerate during work',()=>{
  const original=training(0),cost=48;
  const reserved=reserveWorkerEnergy(original,'worker-1',{startAt:NOW,completedAt:NOW+30000,energyCost:cost});
  assert.equal(reserved['worker-1'].energy,152);assert.equal(reserved['worker-1'].energyAt,NOW+30000);
  assert.equal(original['worker-1'].energy,200);
  assert.equal(workerAbilitySnapshot('worker-1',reserved,NOW+10000).energy,152);
  assert.equal(workerAbilitySnapshot('worker-1',reserved,NOW+30000).energy,152);
  assert.equal(workerAbilitySnapshot('worker-1',reserved,NOW+30000+STAFF_ENERGY_RECOVERY_MS*10).energy,162);
  assert.equal(workerAbilitySnapshot('worker-1',reserved,NOW+86400000).energy,200);
});

test('repeated work exhausts stamina and forces a measured rest before the next order',()=>{
  let data=training(0);data['worker-1'].energy=100;
  data=reserveWorkerEnergy(data,'worker-1',{startAt:NOW,completedAt:NOW+30000,energyCost:48});
  data=reserveWorkerEnergy(data,'worker-1',{startAt:NOW+30000,completedAt:NOW+60000,energyCost:48});
  assert.equal(data['worker-1'].energy,4);
  const plan=workerEnergyReadyAt(data['worker-1'],NOW+60000,48);
  assert.equal(plan.restMs,44*STAFF_ENERGY_RECOVERY_MS);assert.equal(plan.energyBefore,48);
  assert.equal(reserveWorkerEnergy(data,'worker-1',{startAt:plan.startAt-1,completedAt:plan.startAt+30000,energyCost:48}),null);
  const rested=reserveWorkerEnergy(data,'worker-1',{startAt:plan.startAt,completedAt:plan.startAt+30000,energyCost:48});
  assert.equal(rested['worker-1'].energy,0);assert.equal(rested['worker-1'].energyAt,plan.startAt+30000);
});

test('an idle worker recovers before scheduling and future reservations cannot overlap',()=>{
  const data=training(0);data['worker-1'].energy=10;data['worker-1'].energyAt=NOW;
  assert.deepEqual(workerEnergyReadyAt(data['worker-1'],NOW+80000,48),{startAt:NOW+80000,restMs:0,energyBefore:110,energyCost:48});
  const reserved=reserveWorkerEnergy(data,'worker-1',{startAt:NOW+80000,completedAt:NOW+110000,energyCost:48});
  const plan=workerEnergyReadyAt(reserved['worker-1'],NOW+90000,48);
  assert.equal(plan.startAt,NOW+110000);
  assert.equal(reserveWorkerEnergy(reserved,'worker-1',{startAt:NOW+90000,completedAt:NOW+120000,energyCost:48}),null);
});

test('increasing capacity avoids premature rest and endurance reduces actual reservation cost',()=>{
  const data=training(0);data['worker-1'].levels.stamina=10;data['worker-1'].energy=235;
  const abilities=workerAbilitySnapshot('worker-1',data,NOW),cost=workerOrderEnergyCost(9,abilities);
  let row=data['worker-1'];
  for(let i=0;i<4;i++){const plan=workerEnergyReadyAt(row,NOW+i*30000,cost);assert.equal(plan.restMs,0);row={...row,energy:plan.energyBefore-cost,energyAt:NOW+(i+1)*30000};}
  assert.ok(workerEnergyReadyAt(row,row.energyAt,cost).restMs>0);
  data['worker-1'].levels.endurance=10;data['worker-1'].energy=30;
  const reduced=workerOrderEnergyCost(9,workerAbilitySnapshot('worker-1',data,NOW));
  assert.equal(workerEnergyReadyAt(data['worker-1'],NOW,reduced).restMs,0);
  assert.ok(workerEnergyReadyAt(data['worker-1'],NOW,48).restMs>0);
});

test('stamina upgrades retain spent energy and future recovery timestamps',()=>{
  const data=training(0);data['worker-1'].energy=20;data['worker-1'].energyAt=NOW+30000;
  const result=trainingUpgradeResult(data,'worker-1','stamina',wallet,NOW,0);
  assert.equal(result.ok,true);assert.equal(result.training['worker-1'].energy,20);assert.equal(result.training['worker-1'].energyAt,NOW+30000);
  assert.equal(workerAbilitySnapshot('worker-1',result.training,NOW).maxEnergy,230);
  const idle=training(0);idle['worker-1'].energy=20;idle['worker-1'].energyAt=NOW-8000;
  const recovered=trainingUpgradeResult(idle,'worker-1','stamina',wallet,NOW,0);
  assert.equal(recovered.training['worker-1'].energy,30);assert.equal(recovered.training['worker-1'].energyAt,NOW);
});

test('energy helpers reject impossible or malformed reservations',()=>{
  const data=training(0),record=data['worker-1'];
  for(const cost of [0,-1,201,Infinity,NaN])assert.equal(workerEnergyReadyAt(record,NOW,cost),null);
  assert.equal(workerEnergyReadyAt(record,-1,20),null);
  assert.equal(workerOrderEnergyCost(0),null);assert.equal(workerOrderEnergyCost(2,{enduranceMultiplier:0}),null);
  assert.equal(reserveWorkerEnergy(data,'worker-2',{startAt:NOW,completedAt:NOW+100,energyCost:20}),null);
  assert.equal(reserveWorkerEnergy(data,'worker-1',{startAt:NOW,completedAt:NOW,energyCost:20}),null);
  assert.equal(reserveWorkerEnergy(data,'worker-1',{startAt:NOW,completedAt:NOW+10,energyCost:100000}),null);
});

test('UI info reports all four upgrades for existing employees without mutating the save',()=>{
  const restaurant={staff:2,staffTraining:training(2)},before=structuredClone(restaurant);
  const info=staffTrainingInfo(restaurant,NOW);
  assert.equal(info.length,3);assert.deepEqual(info[0].stats.map(stat=>stat.id),['speed','stamina','endurance','skill']);
  assert.equal(info[0].stats.every(stat=>stat.level===1&&stat.cost.targetLevel===2),true);
  assert.deepEqual(restaurant,before);
});
