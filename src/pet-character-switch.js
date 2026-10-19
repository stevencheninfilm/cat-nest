/** One visible character, cached loads, and last-choice-wins previews. */
export function createCharacterSwitch({initial='cat',load,apply,onStatus=()=>{},dispose=()=>{}}) {
  const pending=new Map();let active=initial,revision=0,destroyed=false,phase='ready';
  const report=status=>{phase=status.phase;onStatus(status);};
  return {
    async select(id) {
      const ticket=++revision;
      if(destroyed)return false;
      if(id===active){if(phase!=='ready')report({character:id,phase:'ready'});return true;}
      report({character:id,phase:'loading'});
      if(!pending.has(id)) {
        const promise=Promise.resolve().then(()=>load(id));pending.set(id,promise);
        promise.catch(()=>{if(pending.get(id)===promise)pending.delete(id);});
      }
      try {
        const value=await pending.get(id);
        if(destroyed||ticket!==revision)return false;
        apply(value,id);active=id;report({character:id,phase:'ready'});return true;
      } catch(error) {
        if(!destroyed&&ticket===revision)report({character:id,phase:'error',error});
        return false;
      }
    },
    destroy(){if(destroyed)return;destroyed=true;revision++;for(const [id,promise]of pending)promise.then(value=>dispose(value,id)).catch(()=>{});pending.clear();},
  };
}
