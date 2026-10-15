import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORLD_OBJECTS,WORLD_OBSTACLES,ROBOT_APPROACH,findWorldPath,walkable} from '../src/world-layout.js';

test('all interaction approaches are reachable without entering furniture',()=>{
  const destinations=[...WORLD_OBJECTS.map(o=>o.approach),ROBOT_APPROACH];let start={x:0,z:1.4};
  for(const end of destinations){
    const path=findWorldPath(start,end);assert.ok(path?.length,JSON.stringify(end));let before=start;
    for(const next of path){for(let i=0;i<=100;i++)assert.ok(walkable({x:before.x+(next.x-before.x)*i/100,z:before.z+(next.z-before.z)*i/100}),'segment cuts a corner');before=next;}
    assert.deepEqual(path.at(-1),end);start=end;
  }
});
test('wall, furniture, nonfinite and invalid targets are rejected',()=>{
  const start={x:0,z:1.4};for(const target of [null,{x:NaN,z:0},{x:Infinity,z:0},{x:5,z:0},...WORLD_OBSTACLES.map(({x,z})=>({x,z}))])assert.equal(findWorldPath(start,target),null);
});
test('a new path uses its supplied current position without sharing mutable waypoints',()=>{
  const a=findWorldPath({x:0,z:1.4},{x:1.35,z:-2.65}),b=findWorldPath({x:.3,z:.7},ROBOT_APPROACH);assert.ok(a && b);a[0].x=100;assert.notEqual(b[0].x,100);assert.deepEqual(b.at(-1),ROBOT_APPROACH);
});
test('exported assets are valid self-contained GLBs and robot translation tracks are VEC3',async()=>{
  for(const id of ['robot','home','station']){
    const b=await readFile(new URL(`../public/assets/world/v1/${id}.glb`,import.meta.url));assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
    const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());assert.equal(json.asset.version,'2.0');assert.ok(json.nodes.length>20);assert.ok(json.buffers.every(buffer=>!buffer.uri));assert.ok(!json.images?.length);
    if(id==='robot'){
      assert.deepEqual(json.animations.map(a=>a.name),['HoverIdle','Greeting','HappyNod']);
      for(const animation of json.animations)for(const channel of animation.channels){const sampler=animation.samplers[channel.sampler],output=json.accessors[sampler.output];assert.equal(output.type,channel.target.path==='rotation'?'VEC4':'VEC3');assert.equal(output.count,json.accessors[sampler.input].count);}
    }
  }
});
