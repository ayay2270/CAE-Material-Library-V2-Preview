import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDatabasePlugin } from './server/database-api.mjs';
import { validateDatabase } from './src/lib/database-schema.mjs';
import { readFileSync } from 'node:fs';

// This preview is served from its own GitHub Pages repository subpath.
export default defineConfig(({ command }) => {
  validateDatabase(JSON.parse(readFileSync(new URL('./src/data/materials.json', import.meta.url), 'utf8')));
  return {
  base: '/CAE-Material-Library-V2-Preview/',
  plugins: [react(), command === 'serve' && localDatabasePlugin()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  };
});
