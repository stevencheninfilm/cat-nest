import { homeContext, homeTitle } from './home-context.js';
import { createHomeRuntime, setAppRuntime } from './app-runtime.js';

const home = homeContext(location.pathname);
if (home.id === 'main') {
  location.replace(new URL('./test/', document.baseURI).href);
} else if(home.id==='unknown') {
  document.title='没有找到这个小窝';
  document.querySelector('#app').innerHTML='<main style="padding:32px;font:16px/1.8 system-ui"><h1>没有找到这个小窝</h1><p>请检查存档网址，或联系维护者。原存档没有被修改。</p><a href="./test/">体验测试小窝</a></main>';
} else if (!location.pathname.endsWith('/') && !location.pathname.endsWith('.html')) {
  location.replace(`${location.pathname}/${location.search}${location.hash}`);
} else {
  let testAdapter;
  if(home.isTest) {
    const [{initializeDemoVisit},transport,storage]=await Promise.all([import('../demo/visit.js'),import('../demo/transport.js'),import('../demo/storage.js')]);
    initializeDemoVisit(window);
    testAdapter={apiBase:transport.DEMO_ORIGIN,fetch:transport.demoFetch,eventSourceFactory:url=>new transport.DemoEventSource(url),localStorage:storage.demoLocalStorage,sessionStorage:storage.demoSessionStorage,guidePreferences:storage.demoPreferences,actions:{invitePartner:role=>transport.demoEngine.scenario('join',role),unlockRestaurantDecorations:()=>transport.demoEngine.scenario('restaurant-decorations'),restaurantStaff:command=>transport.demoEngine.debugRestaurantStaff(command)}};
  }
  const localPreview=Boolean(import.meta.env.DEV && import.meta.env.VITE_LOCAL_PET_PREVIEW);
  const apiBase=import.meta.env.VITE_API_URL || (localPreview || location.hostname.endsWith('.onrender.com') ? location.origin : '');
  const browserStorage=name=>{try{return globalThis[name];}catch{return null;}};
  setAppRuntime(createHomeRuntime({home,apiBase,courtApiBase:import.meta.env.VITE_COURT_API_URL || apiBase,localPreview,localStorage:browserStorage('localStorage'),sessionStorage:browserStorage('sessionStorage'),testAdapter}));
  document.title=homeTitle(home);
  document.documentElement.dataset.home=home.id;
  await import('./main.js');
  if(home.isTest)await import('../demo/controls.js');
}
