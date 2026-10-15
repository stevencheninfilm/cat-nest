import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root:fileURLToPath(new URL('../test/', import.meta.url)),
  base:'./',
  publicDir:fileURLToPath(new URL('./public/', import.meta.url)),
  build:{ outDir:fileURLToPath(new URL('../dist-demo/', import.meta.url)), emptyOutDir:true },
});
