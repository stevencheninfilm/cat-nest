import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { localModelPreview, localModelUrl } from './scripts/local-model-preview.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
const modelDirectory = fileURLToPath(new URL('./artifacts/licensed/mage-cat/processed/', import.meta.url));
const apiProxy = {
  target: 'http://127.0.0.1:8787',
  changeOrigin: true,
  configure(proxy) {
    // The local Vite proxy is the API caller; the browser uses a different port.
    proxy.on('proxyReq', request => request.removeHeader('origin'));
  },
};
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  const modelUrl = localModelUrl({ command, directory:modelDirectory, configuredUrl:process.env.VITE_MODEL_URL || env.VITE_MODEL_URL });
  return {
  base: './',
  plugins: [localModelPreview({ directory:modelDirectory })],
  define: modelUrl ? { 'import.meta.env.VITE_MODEL_URL':JSON.stringify(modelUrl) } : {},
  server: {
    port: 5173,
    proxy: { '/api': apiProxy },
  },
  preview: { proxy: { '/api': apiProxy } },
  };
});
