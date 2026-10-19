import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, normalizeState, reduceAction } from '../src/state.js';
import { validRestaurant } from '../src/restaurant.js';
import { RESTAURANT_GUESTS, RESTAURANT_GUEST_CATS } from '../src/restaurant-guests.js';
import { restaurantCustomerCatalog } from '../src/restaurant-guests-ui.js';

const NOW=Date.parse('2026-10-18T12:00:00Z'),actor={id:'guest-art-test',name:'店长'};

test('all sixteen ordinary appearances enter through normal arrival and survive save reload without affecting rewards',()=>{
  assert.deepEqual(RESTAURANT_GUEST_CATS.slice(0,4),['orange','calico','gray','scarf']);
  assert.equal(RESTAURANT_GUEST_CATS.length,32);assert.equal(new Set(RESTAURANT_GUEST_CATS).size,32);
  const observed=new Set();
  for(let sample=0;sample<160;sample++){
    const original=initialState(NOW),state=reduceAction(original,{type:'restaurant-arrive',partySize:2},actor,NOW+sample);
    assert.ok(state);assert.equal(validRestaurant(state.restaurant),true);
    const members=state.restaurant.parties[0].members;
    assert.notEqual(members[0].cat,members[1].cat);
    members.forEach(member=>observed.add(member.cat));
    assert.equal(state.coins,original.coins);assert.equal(state.xp,original.xp);
    assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)),NOW+sample+1000).restaurant,state.restaurant);
  }
  assert.deepEqual([...observed].sort(),RESTAURANT_GUESTS.filter(guest=>!guest.advanced).map(guest=>guest.id).sort());
});

test('each new appearance has distinct transparent front/back assets and a bounded atlas cell',async()=>{
  const root=new URL('../public/assets/restaurant/guests-v1/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  const newcomers=RESTAURANT_GUESTS.filter(guest=>guest.atlasSet==='guests-v1');
  assert.equal(newcomers.length,12);assert.equal(Object.keys(manifest.customers).length,12);
  const atlas=await readFile(new URL(manifest.atlas.file,root));
  assert.equal(atlas.toString('ascii',12,16),'VP8X');assert.ok(atlas[20]&0x10);
  assert.equal(1+atlas.readUIntLE(24,3),1024);assert.equal(1+atlas.readUIntLE(27,3),1536);
  for(const guest of newcomers){
    const cell=manifest.customers[guest.id];assert.equal(cell.name,guest.name);
    assert.ok(cell.column>=0&&cell.column<4);assert.ok(cell.row>=0&&cell.backRow<6);assert.equal(cell.backRow,cell.row+1);
    const [front,back]=await Promise.all([cell.front,cell.back].map(file=>readFile(new URL(file,root))));
    for(const bytes of [front,back]){assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes[20]&0x10);assert.ok(bytes.length>1000);}
    assert.ok(!front.equals(back),`${guest.name} needs its own back view`);
  }
  const catalog=restaurantCustomerCatalog();
  for(const guest of RESTAURANT_GUESTS)assert.ok(catalog.includes(guest.name));
  assert.equal((catalog.match(/<li>/g)||[]).length,32);
});
