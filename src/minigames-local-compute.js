/** Worker failures fall back to the identical local rules, never to the API. */
export function createLocalGameCompute({createWorker=()=>typeof Worker==='function'?new Worker(new URL('./minigames-local-worker.js',import.meta.url),{type:'module'}):null}={}){
  let worker=null,unavailable=false,serial=0;const pending=new Map();
  function fail(){unavailable=true;worker?.terminate();worker=null;for(const task of pending.values()){clearTimeout(task.timer);task.resolve(null);}pending.clear();}
  function warm(){
    if(worker||unavailable)return;
    try{
      worker=createWorker();if(!worker){unavailable=true;return;}
      worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;pending.delete(data.id);clearTimeout(task.timer);task.resolve(data.error?null:data.hub);};
      worker.onerror=fail;
    }catch{fail();}
  }
  return {warm,
    run(input){warm();if(!worker)return null;return new Promise(resolve=>{const id=++serial,timer=setTimeout(fail,500);pending.set(id,{resolve,timer});try{worker.postMessage({id,...input});}catch{fail();}});},
    dispose(){fail();},
  };
}
