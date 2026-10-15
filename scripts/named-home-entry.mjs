import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export function namedHomeHtml(html, base = '../') {
  if (!html.includes('<head>') || /<base\b/i.test(html)) throw new Error('Named home requires one HTML head without an existing base');
  return html.replace('<head>', `<head><base href="${base}">`);
}

/** Both URLs share one application build; relative artwork stays at its root. */
export function namedHomeEntry() {
  let root, outDir, command;
  return {
    name:'cat-nest-named-home-entry',
    configResolved(config) { root=config.root; outDir=resolve(root, config.build.outDir); command=config.command; },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url || '/', 'http://localhost').pathname;
        if (!['/evian','/evian/','/evian/index.html'].includes(path)) return next();
        try {
          const html = namedHomeHtml(await readFile(resolve(root,'index.html'),'utf8'), '/');
          response.setHeader('Content-Type','text/html; charset=utf-8');
          response.end(await server.transformIndexHtml(path,html));
        } catch (error) { next(error); }
      });
    },
    async closeBundle() {
      // Vite also calls closeBundle while shutting down its development server.
      if (command !== 'build') return;
      const html = namedHomeHtml(await readFile(resolve(outDir,'index.html'),'utf8'));
      await mkdir(resolve(outDir,'evian'),{recursive:true});
      await writeFile(resolve(outDir,'evian/index.html'),html);
    },
  };
}
