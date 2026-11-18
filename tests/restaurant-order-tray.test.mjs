import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceAction } from '../src/state.js';
import { restaurantInfo } from '../src/restaurant.js';
import { RESTAURANT_ARRIVAL_MS } from '../src/restaurant-guests.js';
import { restaurantTrayTickets } from '../src/restaurant-order-tray.js';

const start = Date.parse('2026-10-20T02:18:00Z');
const actor = { id: 'tray-staff', name: '糯米' };

test('the order tray follows real arrivals, seating, acceptance and pending rollback', () => {
  const seated = start + RESTAURANT_ARRIVAL_MS;
  const state = reduceAction(initialState(start), { type: 'restaurant-arrive', partySize: 2, recipeId: 'rice' }, actor, start);
  assert.equal(restaurantTrayTickets(restaurantInfo(state, start)).length, 0);
  const info = restaurantInfo(state, seated);
  assert.equal(restaurantTrayTickets(info, { replaying: [info.parties[0].id] }).length, 0);
  const seats = restaurantTrayTickets(info);
  assert.deepEqual(seats.map(ticket => [ticket.table, ticket.seat]), [[1, '左座'], [1, '右座']]);
  const id = seats[0].id;
  assert.equal(restaurantTrayTickets(info, { pendingAccepts: [id] })[0].state, 'pending');
  assert.equal(restaurantTrayTickets(info, { trackedId: id })[0].state, 'requested', 'a rejected acceptance can be retried');
  const accepted = restaurantInfo(reduceAction(state, { type: 'restaurant-kitchen-accept', orderId: id }, actor, seated), seated);
  assert.equal(restaurantTrayTickets(accepted, { trackedId: id, pendingAccepts: [id] })[0].state, 'pending');
  assert.equal(restaurantTrayTickets(accepted, { trackedId: id })[0].state, 'accepted');
  assert.deepEqual(restaurantTrayTickets(accepted).map(ticket => ticket.id), [seats[1].id]);
});

test('all sixteen seats are individually addressable and preserve second-course and daily-commission context', () => {
  const recipe = { id: 'rice', name: '暖暖蛋包饭', category: '主食' };
  const parties = Array.from({ length: 8 }, (_, table) => ({
    id: 'guests-' + table, table, status: 'seated',
    members: [1, 0].map(seat => ({
      seat, order: { id: table + '-' + seat, recipe, status: 'requested', course: 2, courses: 2 },
    })),
  })).reverse();
  const dailyCommission = { category: '主食', completed: false };
  const tickets = restaurantTrayTickets({ parties, dailyCommission });
  assert.equal(tickets.length, 16);
  assert.equal(new Set(tickets.map(ticket => ticket.id)).size, 16);
  assert.deepEqual(tickets.map(ticket => ticket.id), Array.from({ length: 16 }, (_, i) => Math.floor(i / 2) + '-' + i % 2));
  assert.ok(tickets.every(ticket => ticket.course.includes('第 2 餐') && ticket.commission));
  assert.ok(restaurantTrayTickets({ parties, dailyCommission: { ...dailyCommission, completed: true } }).every(ticket => !ticket.commission));
  assert.deepEqual(restaurantTrayTickets({ parties: [] }), []);
});
