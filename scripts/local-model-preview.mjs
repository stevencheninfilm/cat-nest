import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createModelAssetHandler } from '../server/model-assets.mjs';

/** Serve only the optimized game's allowlisted files in the development server. */
export function localModelPreview({ directory }) {
  return {
    name: 'cat-nest-local-model',
    apply: 'serve',
    configureServer(server) {
      if (!existsSync(resolve(directory, 'model.glb'))) return;
      const handle = createModelAssetHandler({ store: {
        async get(file) {
          const bytes = await readFile(resolve(directory, file));
          return {
            bytes,
            type: file.endsWith('.glb') ? 'model/gltf-binary' : 'image/webp',
            etag: `"${createHash('sha256').update(bytes).digest('hex')}"`,
          };
        },
      } });
      // Register before Vite's API proxy, so local preview needs no asset server.
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || '/', 'http://localhost');
        handle(request, response, url).then(handled => {
          if (!handled) next();
        }).catch(next);
      });
    },
  };
}

export function localModelUrl({ command, directory, configuredUrl = '' }) {
  if (command !== 'serve' || !existsSync(resolve(directory, 'model.glb'))) return null;
  // Retire the old temporary asset-server setting while respecting custom URLs.
  const oldPreview = /^http:\/\/(?:localhost|127\.0\.0\.1):9095\/api\/pet-model\/mage-cat-v1\/?$/;
  return !configuredUrl || oldPreview.test(configuredUrl) ? '/api/pet-model/mage-cat-v1' : null;
}
