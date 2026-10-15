import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatStroke} from '../src/home-cat-gestures.js';
import {touchSurfaceMarkup,toyGuideMarkup} from '../src/minigames-touch-ui.js';

test('one sustained stroke gives one care intent regardless of move events',()=>{
  const stroke=createCatStroke();
  assert.equal(stroke.begin({id:1,x:20,y:20,at:0}),true);
  for(let x=21;x<=60;x++)stroke.move({id:1,x,y:20});
  assert.deepEqual(stroke.end({id:1,at:300}),{moved:true,stroke:true});
  assert.equal(stroke.end({id:1,at:400}),null);
});
test('the toy tutorial explains looking, covering and finding before the timed game',()=>{
  const look=toyGuideMarkup('look'),find=toyGuideMarkup('find',0),done=toyGuideMarkup('done');
  assert.match(look,/不计时练习/);assert.match(look,/记住了，盖起来/);
  assert.equal((look.match(/data-toy-guide-cell="\d" disabled/g)||[]).length,3);
  assert.match(find,/点刚才的软垫/);assert.match(find,/这里空空的，再试试/);
  assert.doesNotMatch(find,/data-toy-guide-cell="\d" disabled/);
  assert.match(done,/开始 40 秒陪玩/);assert.match(done,/10 点成长/);
  for(const html of [look,find,done])assert.doesNotMatch(html,/data-arcade-id|data-arcade-move|data-home-cat-claim/,'practice cannot submit game inputs or rewards');
});
test('taps, cancelled gestures and secondary fingers do not grant a stroke; quick strokes still respond',()=>{
  const stroke=createCatStroke();
  assert.equal(stroke.begin({id:2,x:0,y:0,at:0,primary:false}),false);
  stroke.begin({id:1,x:0,y:0,at:0});
  assert.equal(stroke.begin({id:2,x:0,y:0,at:0}),false);
  assert.equal(stroke.move({id:2,x:100,y:0}),null);
  assert.deepEqual(stroke.end({id:1,at:200}),{moved:false,stroke:false});
  stroke.begin({id:1,x:0,y:0,at:0});stroke.move({id:1,x:50,y:0});
  assert.deepEqual(stroke.end({id:1,at:80}),{moved:true,stroke:true});
  stroke.begin({id:1,x:0,y:0,at:0});stroke.move({id:1,x:50,y:0});
  assert.deepEqual(stroke.end({id:1,at:500,cancelled:true}),{moved:true,stroke:false});
  stroke.begin({id:1,x:0,y:0,at:0});stroke.cancel();
  assert.equal(stroke.end({id:1,at:500}),null);
});
test('room games reuse the real main cat while the game house keeps its own illustration',()=>{
  for(const game of ['teaser','treats','hide-toy']){
    const room=touchSurfaceMarkup(game,{home:true});
    assert.doesNotMatch(room,/touch-kitten-art|touch-room-window|touch-room-rug/);
    assert.match(room,/data-touch-feedback/);
  }
  assert.match(touchSurfaceMarkup('teaser'),/touch-kitten-art/);
  assert.match(touchSurfaceMarkup('treats',{home:true}),/data-touch-catcher/);
  assert.equal((touchSurfaceMarkup('hide-toy',{home:true}).match(/data-arcade-move=/g)||[]).length,6);
});
