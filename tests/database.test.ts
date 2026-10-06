import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createDatabaseStore } from '../server/database-store.mjs';
import { createDatabaseMiddleware, localDatabasePlugin } from '../server/database-api.mjs';
import { validateDatabase, canonicalJson } from '../src/lib/database-schema.mjs';
import { detectLegacy, recoverLegacy, LEGACY_MATERIAL_KEY, RECOVERY_KEY } from '../src/lib/legacy';
import { changeIndex, deriveIndexes, INDEX_KEY } from '../src/lib/indexes';
import { csvToMaterials, toCsv } from '../src/lib/csv';
import { curveToCsv, parseCurvePoints } from '../src/lib/curveData';
import { seedMaterials } from './original-seed';

// A fixed migration fixture lets future intentional material edits/deletions pass CI.
const raw = await readFile(new URL('./migrated-database.json', import.meta.url), 'utf8');
const master = validateDatabase(JSON.parse(raw));
const copy = () => structuredClone(master);
async function fixture(t: any) {
  const root = await mkdtemp(join(tmpdir(), 'cae-database-test-'));
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/materials.json'), raw);
  t.after(() => rm(root, { recursive: true, force: true }));
  return createDatabaseStore(root);
}

test('current Git master loads successfully, including after intentional library edits', async () => {
  const current = validateDatabase(JSON.parse(await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8')));
  assert.ok(current.materials.length > 0);
});

test('migration baseline: every original material ID/value/metadata/history survives unchanged', () => {
  assert.equal(master.materials.length, 11);
  assert.deepEqual(master.materials, seedMaterials());
  assert.equal(master.indexes.categories.length, 5);
  assert.deepEqual(master.indexes.sources, ['Legacy data', 'Provided by Jennifer', 'Web']);
});
test('atomic local save writes validated JSON, retains previous bytes in one backup and cleans temp files', async t => {
  const store = await fixture(t);
  const { revision } = await store.read();
  const draft = copy(); draft.materials[0].notes = 'saved locally';
  const result = await store.save(draft, revision);
  assert.deepEqual((await store.read()).database, draft);
  assert.equal((await store.read()).revision, result.revision);
  assert.equal(await readFile(store.backup, 'utf8'), raw);
  assert.deepEqual(await readdir(join(store.path, '..')), ['materials.json']);
});
test('duplicate IDs, empty/corrupt databases and missing fields cannot overwrite disk or backup', async t => {
  const store = await fixture(t); const { revision } = await store.read();
  const duplicate = copy(); duplicate.materials.push(duplicate.materials[0]);
  const empty = copy(); empty.materials = [];
  const missing = copy(); delete (missing.materials[0] as any).density;
  const badCurve = copy(); (badCurve.materials[0] as any).stressStrainCurve = { points: [{ strain: 0, stress: 1 }] };
  for (const bad of [duplicate, empty, missing, badCurve, {}, null, 'invalid JSON']) await assert.rejects(store.save(bad, revision));
  assert.equal(await readFile(store.path, 'utf8'), raw);
  await assert.rejects(readFile(store.backup));
});
test('corrupt on-disk master is never replaced and optimistic revisions prevent lost updates', async t => {
  const store = await fixture(t); const { revision } = await store.read();
  const a = copy(); a.materials[0].notes = 'A';
  await store.save(a, revision);
  await assert.rejects(store.save(copy(), revision), /changed on disk/);
  await writeFile(store.path, '{broken');
  await assert.rejects(store.save(copy(), revision));
  assert.equal(await readFile(store.path, 'utf8'), '{broken');
});

test('separate local servers cannot overwrite one another during concurrent saves', async t => {
  const store = await fixture(t);
  const second = createDatabaseStore(join(store.path, '../../..'));
  const { revision } = await store.read();
  const a = copy(); a.materials[0].notes = 'A';
  const b = copy(); b.materials[0].notes = 'B';
  const results = await Promise.allSettled([store.save(a, revision), second.save(b, revision)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  const loaded = (await store.read()).database;
  assert.ok(['A', 'B'].includes(loaded.materials[0].notes));
  assert.equal(await readFile(store.backup, 'utf8'), raw);
  assert.deepEqual(await readdir(join(store.path, '..')), ['materials.json']);
});

test('backup write failure leaves the master unchanged and releases the save lock', async t => {
  const store = await fixture(t);
  await mkdir(join(store.backup, '..'), { recursive: true });
  await mkdir(store.backup); // Destination is a directory, so atomic backup replacement must fail.
  await assert.rejects(store.save(copy(), (await store.read()).revision));
  assert.equal(await readFile(store.path, 'utf8'), raw);
  assert.deepEqual(await readdir(join(store.path, '..')), ['materials.json']);
});
test('full curves retain all points/order/definitions/metadata and extra solver fields on save/reload', async t => {
  const store = await fixture(t); const { revision } = await store.read(); const draft = copy();
  const parsed = parseCurvePoints('Strain (%),Stress (GPa)\n0,0\n1,0.2\n0.5,0.1\n-0.1,-0.02', '%', 'GPa');
  assert.deepEqual(parsed.errors, []);
  const curve = { points: parsed.points, definition: 'true' as const, strainKind: 'plastic' as const, source: 'Lab A', notes: 'unloading; keep order' };
  draft.materials[0].stressStrainCurve = curve;
  (draft.materials[0] as any).lsDyna = { model: 'test-only', metadata: [1, 2] };
  (draft.materials[0] as any).optiStruct = { additionalField: 123 };
  await store.save(draft, revision);
  const loaded = (await store.read()).database;
  assert.deepEqual(loaded, draft);
  assert.deepEqual(parseCurvePoints(curveToCsv(curve), 'mm/mm', 'MPa').points, curve.points);
});
test('category labels/IDs, unused categories/sources and source references/history survive save/reload', async t => {
  const store = await fixture(t); const draft = copy();
  draft.indexes = changeIndex(draft.indexes, 'category', null, 'Unused category').next!;
  draft.indexes = changeIndex(draft.indexes, 'source', null, 'Unused source').next!;
  draft.indexes = changeIndex(draft.indexes, 'category', 'Metal', '金屬新版').next!;
  draft.indexes = changeIndex(draft.indexes, 'source', 'Web', 'Vendor').next!;
  draft.materials = draft.materials.map(m => m.source !== 'Web' ? m : { ...m, source: 'Vendor', history: [{ at: m.updatedAt, action: 'edited' as const, summary: 'Source：Web → Vendor（來源索引重新命名）' }, ...m.history] });
  await store.save(draft, (await store.read()).revision);
  assert.deepEqual((await store.read()).database, draft);
  assert.equal(draft.materials[0].category, 'Metal');
  assert.equal(draft.indexes.categories.find(c => c.id === 'Metal')?.label, '金屬新版');
  assert.ok(draft.indexes.sources.includes('Unused source'));
});
test('legacy material/index detection preserves originals, reports corruption and honors only exact acknowledged data', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  assert.equal(detectLegacy(storage, master), null);
  values.set(LEGACY_MATERIAL_KEY, JSON.stringify(master.materials));
  assert.equal(detectLegacy(storage, master), null);
  const legacy = copy(); legacy.materials[0].notes = 'legacy note';
  legacy.indexes = changeIndex(legacy.indexes, 'source', null, 'Zero count legacy').next!;
  values.set(LEGACY_MATERIAL_KEY, JSON.stringify(legacy.materials)); values.set(INDEX_KEY, JSON.stringify(legacy.indexes));
  const before = new Map(values); const notice = detectLegacy(storage, master)!;
  assert.deepEqual(recoverLegacy(notice), legacy);
  assert.deepEqual(values, before);
  values.set(RECOVERY_KEY, notice.fingerprint);
  assert.equal(detectLegacy(storage, master), null);
  assert.ok(detectLegacy(storage, master, true));
  values.set(LEGACY_MATERIAL_KEY, '{broken');
  assert.ok(detectLegacy(storage, master)?.error);
  assert.equal(values.get(LEGACY_MATERIAL_KEY), '{broken');
});
test('legacy index-only custom catalogs are detected even when no material key exists', () => {
  const indexes = changeIndex(master.indexes, 'category', null, 'Recovered category').next!;
  const recovery = detectLegacy({ getItem: k => k === INDEX_KEY ? JSON.stringify(indexes) : null }, master)!;
  assert.deepEqual(recovery.database?.materials, master.materials);
  assert.deepEqual(recovery.database?.indexes, indexes);
});
test('CSV import → draft → Save Database preserves engineering values, multiline notes and full curves', async t => {
  const store = await fixture(t); const draft = copy();
  const material = structuredClone(master.materials[0]); material.name = 'CSV Test'; material.notes = 'a,"b"\nsecond line';
  material.stressStrainCurve = { points: [{ strain: 0, stress: 0 }, { strain: 0.1, stress: 45 }, { strain: 0.05, stress: 10 }], source: 'Curve lab', notes: 'retain', definition: 'engineering', strainKind: 'total' };
  const imported = csvToMaterials(toCsv([material])); assert.deepEqual(imported.errors, []);
  draft.materials.push({ ...imported.rows[0], id: 'csv-import-test', updatedAt: material.updatedAt, history: [{ at: material.updatedAt, action: 'imported', summary: 'CSV import' }] });
  draft.indexes = deriveIndexes(draft.materials, draft.indexes);
  await store.save(draft, (await store.read()).revision);
  const record = (await store.read()).database.materials.at(-1)!;
  for (const key of ['density', 'youngsModulus', 'poissonRatio', 'yieldStress', 'etan', 'ultimateStress', 'elongation', 'source', 'notes', 'stressStrainCurve'] as const) assert.deepEqual(record[key], material[key]);
});
test('local HTTP API requires same-origin + token, rejects invalid JSON and supports real JSON save', async t => {
  const store = await fixture(t); const root = join(store.path, '../../..');
  const middleware = createDatabaseMiddleware(root, '/CAE-Material-Library-V2-Preview/');
  const server = createServer((req, res) => { void middleware(req, res, () => { res.statusCode = 404; res.end(); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const url = origin + '/CAE-Material-Library-V2-Preview/__database';
  const loaded = await (await fetch(url)).json(); assert.deepEqual(loaded.database, master);
  const post = (body: string, headers = {}) => fetch(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Local-Database': loaded.token, ...headers }, body });
  assert.equal((await post('{}', { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await post('{}', { 'X-Local-Database': 'invalid' })).status, 403);
  assert.equal((await post('{broken')).status, 400);
  const duplicate = copy(); duplicate.materials.push(duplicate.materials[0]);
  assert.equal((await post(JSON.stringify({ database: duplicate, revision: loaded.revision }))).status, 400);
  assert.equal(await readFile(store.path, 'utf8'), raw);
  const draft = copy(); draft.materials[0].notes = 'via HTTP';
  assert.equal((await post(JSON.stringify({ database: draft, revision: loaded.revision }))).status, 200);
  assert.deepEqual((await store.read()).database, draft);
  assert.equal((await post(JSON.stringify({ database: master, revision: loaded.revision }))).status, 409);
});
test('write plugin is dev-only, supplies no production preview server hook and compares ordered points faithfully', () => {
  const plugin = localDatabasePlugin(); assert.equal(plugin.apply, 'serve');
  assert.equal((plugin as any).configurePreviewServer, undefined);
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});
