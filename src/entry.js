import { homeContext } from './home-context.js';

const home = homeContext(location.pathname);
if (home.id === 'main') {
  location.replace(new URL('./test/', document.baseURI).href);
} else if (!location.pathname.endsWith('/') && !location.pathname.endsWith('.html')) {
  location.replace(`${location.pathname}/${location.search}${location.hash}`);
} else {
  await import('./main.js');
}
