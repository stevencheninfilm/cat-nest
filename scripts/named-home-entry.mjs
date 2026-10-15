import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export function namedHomeHtml(html, base = '../') {
  if (!html.includes('<head>') || /<base\b/i.test(html)) throw new Error('Named home requires one HTML head without an existing base');
  return html.replace('<head>', `<head><base href="${base}">`);
}

export function demoRedirectHtml() {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=./test/"><title>猫猫小窝 · 演示版</title><script>location.replace(new URL("./test/",location.href).href)</script></head><body><a href="./test/">进入演示版</a></body></html>';
}

/** Private homes share one application build; the public root only redirects. */
export function namedHomeEntry() {
  let root, outDir, command;
  return {
    name:'cat-nest-named-home-entry',
    configResolved(config) { root=config.root; outDir=resolve(root, config.build.outDir); command=config.command; },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url || '/', 'http://localhost').pathname;
        if (['/','/index.html'].includes(path)) { response.writeHead(302,{Location:'/test/','Cache-Control':'no-store'});response.end();return; }
        if (!['/evian','/evian/','/evian/index.html','/steven','/steven/','/steven/index.html'].includes(path)) return next();
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
      for (const name of ['evian','steven']) {
        await mkdir(resolve(outDir,name),{recursive:true});
        await writeFile(resolve(outDir,name,'index.html'),html);
      }
      await writeFile(resolve(outDir,'index.html'),demoRedirectHtml());
    },
  };
}
