import test from 'node:test';
import assert from 'node:assert/strict';
import {petNamePlacement} from '../src/pet-name-layout.js';

test('short names stay centered across the whole status strip',()=>{
  const p=petNamePlacement({textWidth:32,titleWidth:276,bonusLeft:212});
  assert.equal(p.fontSize,16);assert.equal(p.offset,0);assert.equal(p.wrap,false);
});
test('a name shifts only as far left as needed to clear the growth badge',()=>{
  const p=petNamePlacement({textWidth:100,titleWidth:232,bonusLeft:168});
  assert.equal(p.fontSize,16);assert.equal(p.wrap,false);assert.ok(p.offset<0);
  assert.equal((232+p.width)/2+p.offset,164);
});
test('long names shrink to one line, with a readable minimum on very narrow screens',()=>{
  const fits=petNamePlacement({textWidth:240,titleWidth:276,bonusLeft:212});
  assert.ok(fits.fontSize<16&&fits.fontSize>=11);assert.equal(fits.wrap,false);
  const narrow=petNamePlacement({textWidth:240,titleWidth:192,bonusLeft:128});
  assert.equal(narrow.fontSize,11);assert.equal(narrow.wrap,true);
});
test('all supported widths keep the name outside the badge without shifting it right',()=>{
  for(const titleWidth of [192,234,276])for(const textWidth of [20,32,100,180,256]){
    const bonusLeft=titleWidth-64,p=petNamePlacement({textWidth,titleWidth,bonusLeft});
    const left=(titleWidth-p.width)/2+p.offset,right=left+p.width;
    assert.ok(left>=-0.01);assert.ok(right<=bonusLeft-4+0.01);assert.ok(p.offset<=0);
    assert.ok(p.fontSize>=11&&p.fontSize<=16);
    if(!p.wrap)assert.ok(textWidth*p.fontSize/16+28<=p.width+0.01);
  }
});
