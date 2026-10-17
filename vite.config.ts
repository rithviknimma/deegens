import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + HashRouter so the build works under any GitHub Pages path.
export default defineConfig({
  plugins: [react()],
  base: './',
});
