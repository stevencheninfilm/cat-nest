// Run before the app reads URL state, so an old case link starts a fresh demo.
export function initializeDemoVisit(target) {
  const url=new URL(target.location.href);
  url.searchParams.delete('court');
  url.searchParams.delete('room');
  if(url.searchParams.get('mode')==='judge')url.searchParams.delete('mode');
  if(!url.hash)url.hash='restaurant';
  if(url.href!==target.location.href)target.history.replaceState(null,'',url.href);
  // Back/forward cache can restore an entire JS heap without reloading modules.
  target.addEventListener('pageshow',event=>{if(event.persisted)target.location.reload();});
}
