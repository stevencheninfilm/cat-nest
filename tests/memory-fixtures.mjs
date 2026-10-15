import { GAMES } from '../src/minigames.js';
import { memoryDay } from '../src/memory-journal.js';

/** Distinct formal themes, with all 36 non-anniversary cards first. */
export function formalMemoryEntries(at,catName='糯米') {
  const base={at,catName,photo:'happy'};
  return [
    {kind:'adoption',id:'adoption'},
    {kind:'level',id:'level:2',level:2},
    ...['feed','pet','play','sleep','dress','rename'].map(occasion=>({kind:'first',occasion,id:`first:${occasion}`})),
    ...['meal','relay','goodnight'].map(occasion=>({kind:'together',occasion,id:`together:${occasion}:${memoryDay(at)}`})),
    ...Object.keys(GAMES).map(occasion=>({kind:'game',occasion,sourceId:`fixture-${occasion}`,id:`game:fixture-${occasion}`})),
    ...Array.from({length:12},(_,variant)=>({kind:'fun',variant,sourceId:`fixture-fun-${variant}`,id:`fun:${memoryDay(at)-variant}`,at:at-variant*86_400_000})),
    {kind:'anniversary',id:'anniversary:1',year:1},
  ].map(e=>({...base,...e}));
}
