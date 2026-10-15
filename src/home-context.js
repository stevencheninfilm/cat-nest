import { initialState } from './state.js';

export const EVIAN_ROOM_ID = '6858d44c3a9ce3b77ea7c5334b4acd02';
const main = Object.freeze({ id:'main', roomId:null, href:'./' });
const evian = Object.freeze({ id:'evian', roomId:EVIAN_ROOM_ID, href:'./evian/' });

export function homeContext(pathname = '') {
  return /(?:^|\/)evian(?:\/(?:index\.html)?)?$/.test(pathname) ? evian : main;
}

export function homeStorageKey(key, context) {
  return context.id === 'evian' ? `evian:${key}` : key;
}

export function initialHomeState(context, now = Date.now()) {
  const state = initialState(now);
  return context.id === 'evian' ? { ...state, coins:1200, love:0, xp:0 } : state;
}
