import { homeContext } from './home-context.js';
import { unlockSteven } from './private-access.js';
import './private-access.css';

const home = homeContext(location.pathname);
if (home.id === 'main') {
  // Do not load the private application or carry old room/court links into demo.
  location.replace(new URL('./test/', document.baseURI).href);
} else {
  if (!location.pathname.endsWith('/') && !location.pathname.endsWith('.html')) {
    location.replace(`${location.pathname}/${location.search}${location.hash}`);
  } else {
    const localPreview = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PET_PREVIEW === true;
    if (home.id === 'steven' && !localPreview) {
      const apiBase = import.meta.env.VITE_API_URL || (location.hostname.endsWith('.onrender.com') ? location.origin : '');
      await unlockSteven(apiBase);
    }
    await import('./main.js');
  }
}
