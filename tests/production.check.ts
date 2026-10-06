import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { preview } from 'vite';

test('built GitHub Pages viewer has no filesystem writer; POST cannot change the repository database', async t => {
  const path = new URL('../src/data/materials.json', import.meta.url);
  const before = await readFile(path, 'utf8');
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'silent' });
  t.after(() => new Promise<void>(resolve => server.httpServer.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;
  const base = '/CAE-Material-Library-V2-Preview/';
  const response = await fetch(origin + base + '__database', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ database: { materials: [] } }) });
  assert.notEqual(response.headers.get('content-type')?.includes('application/json'), true);
  assert.equal(await readFile(path, 'utf8'), before);
  const html = await (await fetch(origin + base)).text(); assert.match(html, /CAE/);
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  const js = (await Promise.all(assets.filter(f => f.endsWith('.js')).map(f => readFile(new URL(`../dist/assets/${f}`, import.meta.url), 'utf8')))).join('\n');
  assert.equal(/node:fs|writeFile|createDatabaseMiddleware|x-local-database|__database/.test(js), false, 'production must omit local API/writer code');
  assert.ok(js.includes(JSON.stringify(JSON.parse(before).materials[0].id)), 'committed material ID is included in the deployed viewer');
});
