import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const deployed = JSON.parse(await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8'));
// Exercise unknown fields and complete curve/history metadata without modifying the master.
deployed.metadata = { revision: 'deployed-fixture', tags: ['backup', 'transfer'] };
deployed.indexes.sources.push('未使用的來源');
deployed.materials[0].notes = '完整資料庫備份';
deployed.materials[0].metadata = { originalUnits: 'MPa' };
deployed.materials[0].stressStrainCurve = {
  points: [{ strain: 0, stress: 0 }, { strain: 0.03, stress: 275 }, { strain: -0.001, stress: -5 }],
  definition: 'true', strainKind: 'plastic', source: 'Web', notes: '保留原始順序', metadata: { test: '完整曲線' },
};
const built = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { DatabaseStatus } from './src/components/DatabaseStatus';
    import { DatabaseOnboardingDialog } from './src/components/DatabaseOnboardingDialog';
    export { downloadDeployedDatabase, DEPLOYED_DATABASE_FILENAME } from './src/lib/deployedDatabaseDownload';
    export const status = state => renderToStaticMarkup(<DatabaseStatus state={state} />);
    export const help = supported => renderToStaticMarkup(<DatabaseOnboardingDialog supported={supported} onClose={()=>{}} onConnect={()=>{}} />);
  `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"' },
  plugins: [{ name: 'deployed-test-snapshot', setup(builder) {
    builder.onLoad({ filter: /src[\\/]data[\\/]materials\.json$/ }, () => ({ contents: JSON.stringify(deployed), loader: 'json' }));
  } }],
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;
const state = {
  fileStatus: 'unlinked', fileSupported: true, developerMode: false, fileError: null, fileName: null,
  editable: false, dirty: false, saving: false, saveError: null, lastReadAt: null, lastSavedAt: null, backupText: null,
  connectFile() {}, reloadFile() {}, disconnectFile() {}, saveDatabase() {},
  github: { status: 'idle', deployment: 'idle', error: null, commit: '', checkedAt: null, check() {} },
};

test('first-time status opens one screen with download, connection and Clone guidance', () => {
  const html = ui.status(state);
  assert.match(html, /<details[^>]*open=""/);
  for (const text of ['資料庫狀態', '○ 尚未連結本機資料庫', '第一次使用？', '下載目前材料資料庫 JSON', '連結本機資料庫', 'GitHub Desktop Clone', 'src/data/materials.json', '獨立備份', '不會建立 Git 儲存庫', '第一次使用 / 如何開始']) assert.ok(html.includes(text), text);
  assert.equal(html.includes('npm run dev'), false);
  const unsupported = ui.status({ ...state, fileSupported: false, fileStatus: 'unsupported' });
  assert.match(unsupported, /disabled=""[^>]*>連結本機資料庫/);
  assert.ok(unsupported.includes('下載目前材料資料庫 JSON'));
});

test('connected status stays compact and preserves save, sync and deployment controls', () => {
  const html = ui.status({ ...state, fileStatus: 'linked', fileName: 'materials.json', editable: true, lastSavedAt: 1,
    github: { ...state.github, status: 'synced', deployment: 'updated', commit: 'a'.repeat(40) } });
  for (const text of ['✓ 已連結', 'materials.json', '✓ 已儲存', '已同步至 GitHub', '線上版已更新', 'Save Database', '檢查 GitHub 同步', '重新讀取本機資料庫', '中斷連結', '使用說明']) assert.ok(html.includes(text), text);
  for (const text of ['第一次使用？', 'GitHub Desktop Clone', '下載目前材料資料庫 JSON']) assert.equal(html.includes(text), false, text);
  assert.doesNotMatch(html, /<details[^>]*open=""/);
  const dirty = ui.status({ ...state, fileStatus: 'linked', editable: true, dirty: true });
  assert.ok(dirty.includes('有未儲存變更'));
  const permission = ui.status({ ...state, fileStatus: 'permission', fileName: 'materials.json' });
  assert.ok(permission.includes('重新授權本機資料庫'));
});

test('Chinese help separates standalone backup from Clone/link/save/Commit/Push and links the repository', () => {
  const html = ui.help(true);
  for (const text of ['只想查看 / 備份', '我要新增 / 編輯材料', '無需 Clone', 'GitHub Desktop Clone', 'src/data/materials.json', 'Save Database', 'Commit', 'Push origin', '已同步至 GitHub', '不是剛下載的獨立 JSON', '開啟 GitHub Repository']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('https://github.com/ayay2270/CAE-Material-Library-V2-Preview'));
  assert.ok(html.includes('noopener noreferrer'));
  assert.equal(html.includes('npm run dev'), false);
});

test('download exports the complete deployed document, never stale storage or a draft', async () => {
  const originalDocument = globalThis.document;
  const originalStorage = globalThis.localStorage;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const blobs = [];
  const downloads = [];
  try {
    globalThis.localStorage = { getItem: () => assert.fail('deployed download must not read localStorage') };
    globalThis.document = { createElement: tag => {
      assert.equal(tag, 'a');
      const link = { href: '', download: '', click: () => downloads.push(link.download) };
      return link;
    } };
    URL.createObjectURL = blob => { blobs.push(blob); return 'blob:deployed'; };
    URL.revokeObjectURL = () => {};
    ui.downloadDeployedDatabase();
    ui.downloadDeployedDatabase();
    assert.equal(ui.DEPLOYED_DATABASE_FILENAME, 'CAE-Material-Library-materials.json');
    assert.deepEqual(downloads, [ui.DEPLOYED_DATABASE_FILENAME, ui.DEPLOYED_DATABASE_FILENAME]);
    for (const blob of blobs) {
      assert.equal(blob.type, 'application/json');
      assert.deepEqual(JSON.parse(await blob.text()), deployed);
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.localStorage = originalStorage;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
