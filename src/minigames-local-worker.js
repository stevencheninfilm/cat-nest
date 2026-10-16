import { stepLocalGame } from './minigames-local-rules.js';

// Chess search runs away from the animation/input thread on supporting devices.
self.onmessage=({data})=>{
  const {id,hub,action,session,actor,at,index}=data;
  try{self.postMessage({id,hub:stepLocalGame(hub,action,session,actor,at,index)});}
  catch{self.postMessage({id,error:true});}
};
