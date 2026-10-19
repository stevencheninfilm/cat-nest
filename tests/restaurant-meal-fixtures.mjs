import assert from 'node:assert/strict';
import { reduceAction } from '../src/state.js';
import { restaurantInfo, validRestaurant } from '../src/restaurant.js';
import { KITCHEN_FLOWS } from '../src/restaurant-kitchen.js';

/** Prepare a real meal without collecting it. Shared fixtures must follow the
 * same clicked steps and rest clocks after the final automatic dish is filled. */
export function prepareRestaurantMealForCollection(state,id,actor){
  let at=state.updatedAt,order=restaurantInfo(state,at).orders.find(item=>item.id===id);
  assert.ok(order);at=Math.max(at,order.createdAt);
  const commit=(action,time)=>{
    state=reduceAction(state,action,actor,time);assert.ok(state,`${action.type}:${action.stepId??''}`);
    assert.ok(validRestaurant(state.restaurant));at=time;order=restaurantInfo(state,at).orders.find(item=>item.id===id);
  };
  if([2,3,4].includes(order.workflow?.version)){
    if(order.workflow.acceptedAt===null)commit({type:'restaurant-kitchen-accept',orderId:id},at);
    for(const step of KITCHEN_FLOWS[order.recipeId].slice(order.workflow.runs.length)){
      const run=order.workflow.runs.at(-1);at=Math.max(at,run?.endAt??0,run?.rest?.fullAt??0);
      commit({type:'restaurant-kitchen-step',orderId:id,stepId:step.id},at);
    }
    const last=order.workflow.runs.at(-1);
    if(order.workflow.servedAt===null)commit({type:'restaurant-kitchen-step',orderId:id,stepId:'delivery'},Math.max(at,last.endAt,last.rest?.fullAt??0));
  }else if(order.autoServeAt===null)commit({type:'restaurant-serve',orderId:id},Math.max(at,order.readyAt));
  at=Math.max(at,order.collectAt);order=restaurantInfo(state,at).orders.find(item=>item.id===id);
  assert.equal(order.status,'collectible');return {state,order,at};
}
