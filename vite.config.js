import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // The corpus is fetched at runtime from public/, never inlined, so the
    // JavaScript bundle stays small enough to parse before the first keystroke.
    target: 'es2020',
    reportCompressedSize: true,
  },
  server: {
    port: 5173,
  },
});
