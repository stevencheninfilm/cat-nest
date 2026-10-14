import { defineConfig } from 'vite';
const apiProxy = {
  target: 'http://127.0.0.1:8787',
  changeOrigin: true,
  configure(proxy) {
    // The local Vite proxy is the API caller; the browser uses a different port.
    proxy.on('proxyReq', request => request.removeHeader('origin'));
  },
};
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': apiProxy },
  },
  preview: { proxy: { '/api': apiProxy } },
});
