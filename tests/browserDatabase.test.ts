import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDatabaseFile, restoreDatabaseFile, saveDatabaseFile, supportsFileDatabase, parseFileDatabase, databaseIsDirty, authorizeDatabaseFile, type DatabaseFileHandle } from '../src/lib/browserDatabase';
import { canonicalJson } from '../src/lib/database-schema.mjs';
import { csvToMaterials, toCsv } from '../src/lib/csv';

const original = await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8');
const clone = () => JSON.parse(original);
async function fileFixture(t: any) {
  const directory = await mkdtemp(join(tmpdir(), 'cae-browser-file-'));
  const path = join(directory, 'materials.json');
  await writeFile(path, original);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const state = { permission: 'granted' as PermissionState, requests: 0, opens: 0, aborts: 0,
    beforeClose: async () => {}, afterClose: async () => {}, failWrite: false, failClose: false };
  const handle: DatabaseFileHandle = {
    kind: 'file', name: 'materials.json',
    getFile: async () => { const bytes = await readFile(path, 'utf8'); return { text: async () => bytes }; },
    queryPermission: async () => state.permission,
    requestPermission: async () => { state.requests++; return state.permission; },
    createWritable: async options => {
      state.opens++; assert.equal(options?.mode, 'exclusive'); let pending = '';
      return {
        write: async text => { if (state.failWrite) throw new Error('write failed'); pending = text; },
        close: async () => { await state.beforeClose(); if (state.failClose) throw new Error('close failed'); await writeFile(path, pending); await state.afterClose(); },
        abort: async () => { state.aborts++; },
      };
    },
  };
  return { path, handle, state };
}

test('valid selected materials.json loads every property and can obtain editing permission explicitly', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle);
  assert.deepEqual(session.database, clone());
  assert.equal(session.canonical, canonicalJson(clone()));
  assert.equal(f.state.opens, 0);
  assert.equal(await authorizeDatabaseFile(f.handle), true);
  assert.equal(f.state.requests, 1);
});
test('invalid JSON, version/schema, duplicate IDs, invalid curves and empty data are rejected without writing', async t => {
  const f = await fileFixture(t);
  const invalids: unknown[] = [{}, { ...clone(), schemaVersion: 2 }, { ...clone(), materials: [] }, { ...clone(), indexes: null }];
  const duplicate = clone(); duplicate.materials.push(duplicate.materials[0]); invalids.push(duplicate);
  const curve = clone(); curve.materials[0].stressStrainCurve = { points: [{ strain: 0, stress: 0 }] }; invalids.push(curve);
  for (const value of ['{broken', ...invalids.map(value => JSON.stringify(value))]) {
    await writeFile(f.path, value);
    await assert.rejects(readDatabaseFile(f.handle), /[\u3400-\u9fff]/);
    assert.equal(await readFile(f.path, 'utf8'), value); assert.equal(f.state.opens, 0);
  }
  await assert.rejects(readDatabaseFile({ ...f.handle, name: 'other.json' }), /src\/data\/materials.json/);
});
test('restoring granted handles reads disk without prompting; expired permission requires an explicit click', async t => {
  const f = await fileFixture(t);
  assert.ok(await restoreDatabaseFile(f.handle)); assert.equal(f.state.requests, 0);
  f.state.permission = 'prompt'; assert.equal(await restoreDatabaseFile(f.handle), null); assert.equal(f.state.requests, 0);
  f.state.permission = 'denied'; assert.equal(await authorizeDatabaseFile(f.handle), false);
  f.state.permission = 'granted'; assert.ok(await restoreDatabaseFile(f.handle));
});
test('save writes only the selected file and preserves engineering values, indexes, history and ordered full curves', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle); const draft = clone();
  draft.materials[0].notes = '本機測試';
  draft.indexes.sources.push('unused source');
  draft.materials[0].stressStrainCurve = { points: [{ strain: 0, stress: 0 }, { strain: 0.03, stress: 275 }, { strain: -0.001, stress: -5 }], definition: 'true', strainKind: 'plastic', source: 'test', notes: 'unloading', metadata: { originalUnits: ['%', 'MPa'] } };
  const verified = await saveDatabaseFile(session, draft);
  assert.deepEqual(JSON.parse(await readFile(f.path, 'utf8')), draft);
  assert.deepEqual(verified.database, draft); assert.equal(verified.backupText, original);
  assert.equal(verified.database.materials[0].etan, clone().materials[0].etan);
  assert.equal(verified.canonical, canonicalJson(draft));
});
test('save does not resolve or claim success before writer close and verified re-read complete', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle); const draft = clone(); draft.materials[0].notes = '待寫入';
  let release!: () => void; let reached!: () => void;
  const closing = new Promise<void>(resolve => reached = resolve);
  const paused = new Promise<void>(resolve => release = resolve);
  f.state.beforeClose = async () => { reached(); await paused; };
  let successful = false;
  const saving = saveDatabaseFile(session, draft).then(value => { successful = true; return value; });
  await closing; assert.equal(successful, false); assert.equal(await readFile(f.path, 'utf8'), original);
  release(); await saving; assert.equal(successful, true);
});
test('validation, duplicate IDs, empty saves and revoked permission cannot open a writer', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle);
  const duplicate = clone(); duplicate.materials.push(duplicate.materials[0]);
  for (const value of [duplicate, { ...clone(), materials: [] }]) await assert.rejects(saveDatabaseFile(session, value));
  f.state.permission = 'denied'; await assert.rejects(saveDatabaseFile(session, clone()), { name: 'NotAllowedError' });
  assert.equal(f.state.opens, 0); assert.equal(await readFile(f.path, 'utf8'), original);
});
test('external disk edits are not overwritten and fail verification rather than claiming success', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle); const external = clone(); external.materials[0].notes = '他人更新';
  await writeFile(f.path, JSON.stringify(external));
  await assert.rejects(saveDatabaseFile(session, clone()), /未覆寫/); assert.equal(f.state.opens, 0);
  const fresh = await readDatabaseFile(f.handle); const draft = clone(); draft.materials[0].notes = '本機更新';
  f.state.afterClose = async () => { await writeFile(f.path, JSON.stringify(external)); };
  await assert.rejects(saveDatabaseFile(fresh, draft), /驗證不一致/);
  assert.deepEqual(JSON.parse(await readFile(f.path, 'utf8')), external);
  assert.ok(fresh.backupText); // Do not roll back unexpected contents over another user's update.
});
test('write/close failures abort the stream, retain the prior file and keep an in-memory backup', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle);
  f.state.failWrite = true; await assert.rejects(saveDatabaseFile(session, clone()));
  assert.equal(f.state.aborts, 1); assert.equal(await readFile(f.path, 'utf8'), original); assert.equal(session.backupText, original);
  f.state.failWrite = false; f.state.failClose = true; await assert.rejects(saveDatabaseFile(session, clone()));
  assert.equal(f.state.aborts, 2); assert.equal(await readFile(f.path, 'utf8'), original);
});
test('dirty comparison ignores object-key order but retains numerical values and ordered curve data', () => {
  const saved = clone(); const draft = clone();
  assert.equal(databaseIsDirty(draft, saved), false);
  draft.materials[0].notes = 'change'; assert.equal(databaseIsDirty(draft, saved), true);
  assert.equal(databaseIsDirty(clone(), saved), false);
  assert.throws(() => parseFileDatabase('{broken'), /JSON 格式無效/);
});
test('unsupported/insecure contexts remain read-only without touching any file', () => {
  assert.equal(supportsFileDatabase(undefined), false);
  assert.equal(supportsFileDatabase({ isSecureContext: true }), false);
  assert.equal(supportsFileDatabase({ isSecureContext: false, showOpenFilePicker: async () => [] }), false);
  assert.equal(supportsFileDatabase({ isSecureContext: true, showOpenFilePicker: async () => [] }), true);
});
test('CSV import can be saved and verified through the browser file adapter without losing H or curves', async t => {
  const f = await fileFixture(t); const session = await readDatabaseFile(f.handle); const draft = clone();
  draft.materials[0].notes = 'CSV 值';
  const imported = csvToMaterials(toCsv(draft.materials)); assert.equal(imported.errors.length, 0);
  draft.materials = draft.materials.map((m: any, i: number) => ({ ...m, ...imported.rows[i] }));
  const saved = await saveDatabaseFile(session, draft);
  assert.deepEqual((await readDatabaseFile(f.handle)).database, saved.database);
  assert.equal(saved.database.materials[0].notes, 'CSV 值');
  assert.equal(saved.database.materials[0].etan, session.database.materials[0].etan);
});
