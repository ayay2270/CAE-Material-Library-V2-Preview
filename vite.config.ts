import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This preview is served from its own GitHub Pages repository subpath.
export default defineConfig({
  base: '/CAE-Material-Library-V2-Preview/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
