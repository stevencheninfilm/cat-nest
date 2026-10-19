import test from 'node:test';
import assert from 'node:assert/strict';
import { levelInfo, levelStartXp } from '../src/growth-levels.js';
import { levelInfo as stateLevelInfo, levelStartXp as stateLevelStartXp } from '../src/state.js';

test('state retains the identical shared growth function exports',()=>{
  assert.equal(stateLevelInfo,levelInfo);assert.equal(stateLevelStartXp,levelStartXp);
});

test('each early level follows the original 120 then 30-more experience ladder exactly',()=>{
  let start=0;
  for(let level=1;level<=1000;level++) {
    const target=120+30*(level-1);
    assert.equal(levelStartXp(level),start);
    assert.deepEqual(levelInfo(start),{level,progress:0,target});
    assert.deepEqual(levelInfo(start+target-1),{level,progress:target-1,target});
    assert.deepEqual(levelInfo(start+target),{level:level+1,progress:0,target:target+30});
    start+=target;
  }
});

test('one-decimal experience rounding keeps fractional progress and exact boundary transitions',()=>{
  for(const [xp,expected] of [
    [0.04,{level:1,progress:0,target:120}],
    [0.05,{level:1,progress:.1,target:120}],
    [1.04,{level:1,progress:1,target:120}],
    [1.05,{level:1,progress:1.1,target:120}],
    [119.94,{level:1,progress:119.9,target:120}],
    [119.95,{level:2,progress:0,target:150}],
    [120.1,{level:2,progress:.1,target:150}],
    [269.9,{level:2,progress:149.9,target:150}],
    [269.95,{level:3,progress:0,target:180}],
    [270.1,{level:3,progress:.1,target:180}],
    [450.1,{level:4,progress:.1,target:210}],
  ])assert.deepEqual(levelInfo(xp),expected,`xp=${xp}`);
});

test('the expanded restaurant map leaves the pet XP thresholds at levels forty-nine and fifty unchanged',()=>{
  assert.equal(levelStartXp(49),39600);assert.equal(levelStartXp(50),41160);assert.equal(levelStartXp(51),42750);
  for(const [xp,expected] of [
    [39599.9,{level:48,progress:1529.9,target:1530}],
    [39600,{level:49,progress:0,target:1560}],
    [39600.1,{level:49,progress:.1,target:1560}],
    [41159.9,{level:49,progress:1559.9,target:1560}],
    [41160,{level:50,progress:0,target:1590}],
    [41160.1,{level:50,progress:.1,target:1590}],
    [42750,{level:51,progress:0,target:1620}],
  ])assert.deepEqual(levelInfo(xp),expected,`xp=${xp}`);
});

test('invalid experience and level inputs preserve zero defaults, flooring and upper XP clamping',()=>{
  for(const value of [undefined,null,NaN,Infinity,-Infinity,'120',{},[],true,-1,-.1])assert.deepEqual(levelInfo(value),{level:1,progress:0,target:120});
  for(const value of [undefined,null,NaN,Infinity,-Infinity,'2',{},[],true,-5,0,.9,1.9])assert.equal(levelStartXp(value),0);
  assert.equal(levelStartXp(2.9),120);assert.equal(levelStartXp(3.1),270);
  assert.deepEqual(levelInfo(Number.MAX_SAFE_INTEGER+1000),levelInfo(Number.MAX_SAFE_INTEGER));
  assert.deepEqual(levelInfo(Number.MAX_VALUE),levelInfo(Number.MAX_SAFE_INTEGER));
});

function integerOracle(xp) {
  const total=BigInt(xp);let low=0n,high=100000000n;
  const threshold=completed=>15n*completed*(completed+7n);
  while(low+1n<high){const middle=(low+high)/2n;if(threshold(middle)<=total)low=middle;else high=middle;}
  return {level:Number(low+1n),progress:Number(total-threshold(low)),target:Number(120n+30n*low)};
}

test('large save boundaries and the safe integer limit agree with an independent integer search',()=>{
  const samples=new Set([0,1,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER-1]);
  for(const level of [1000,100000,1000000,10000000,24500000]) {
    const completed=BigInt(level-1),boundary=15n*completed*(completed+7n);
    assert.equal(levelStartXp(level),Number(boundary));
    for(const offset of [-1n,0n,1n])samples.add(Number(boundary+offset));
  }
  for(const xp of samples)assert.deepEqual(levelInfo(xp),integerOracle(xp),`large xp=${xp}`);
});
