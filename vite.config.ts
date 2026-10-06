import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDatabasePlugin } from './server/database-api.mjs';
import { validateDatabase } from './src/lib/database-schema.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJson } from './src/lib/database-schema.mjs';

// This preview is served from its own GitHub Pages repository subpath.
export default defineConfig(({ command }) => {
  validateDatabase(JSON.parse(readFileSync(new URL('./src/data/materials.json', import.meta.url), 'utf8')));
  return {
  base: '/CAE-Material-Library-V2-Preview/',
  plugins: [react(), command === 'serve' && localDatabasePlugin(), {
    name: 'committed-database-version',
    generateBundle() {
      const master = validateDatabase(JSON.parse(readFileSync(new URL('./src/data/materials.json', import.meta.url), 'utf8')));
      this.emitFile({ type: 'asset', fileName: 'database-version.json', source: JSON.stringify({
        schemaVersion: 1, databaseSha256: createHash('sha256').update(canonicalJson(master)).digest('hex'),
        commit: process.env.GITHUB_SHA ?? null,
      }) + '\n' });
    },
  }],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  };
});
