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

test('first-time status stays concise with download, connection and setup help', () => {
  const html = ui.status(state);
  assert.match(html, /<details[^>]*open=""/);
  for (const text of ['資料庫狀態', '○ 尚未連結本機資料庫', '第一次使用？', '下載目前材料資料庫 JSON', '連結本機資料庫', '先把專案複製到電腦', 'src/data/materials.json', '獨立備份', '不會建立 Git 儲存庫', '第一次使用？查看設定步驟']) assert.ok(html.includes(text), text);
  for (const text of ['File → Clone repository', 'Commit to main', '第一次使用這台電腦', '修改完成後', '之後每次使用']) assert.equal(html.includes(text), false, 'full tutorial belongs in help: ' + text);
  assert.equal(html.includes('npm run dev'), false);
  const unsupported = ui.status({ ...state, fileSupported: false, fileStatus: 'unsupported' });
  assert.match(unsupported, /disabled=""[^>]*>連結本機資料庫/);
  assert.ok(unsupported.includes('下載目前材料資料庫 JSON'));
});

test('connected status stays compact and preserves save, sync and deployment controls', () => {
  const html = ui.status({ ...state, fileStatus: 'linked', fileName: 'materials.json', editable: true, lastSavedAt: 1,
    github: { ...state.github, status: 'synced', deployment: 'updated', commit: 'a'.repeat(40) } });
  for (const text of ['✓ 已連結', 'materials.json', '✓ 儲存成功', '已同步至 GitHub', '線上版已更新', 'Save Database', '檢查 GitHub 同步', '重新讀取本機資料庫', '中斷連結', '使用說明']) assert.ok(html.includes(text), text);
  for (const text of ['第一次使用？', 'GitHub Desktop Clone', '下載目前材料資料庫 JSON']) assert.equal(html.includes(text), false, text);
  assert.doesNotMatch(html, /<details[^>]*open=""/);
  const dirty = ui.status({ ...state, fileStatus: 'linked', editable: true, dirty: true });
  assert.ok(dirty.includes('有未儲存變更'));
  const permission = ui.status({ ...state, fileStatus: 'permission', fileName: 'materials.json' });
  assert.ok(permission.includes('重新授權本機資料庫'));
});

test('Chinese help distinguishes JSON backup from a cloned project and links the repository', () => {
  const html = ui.help(true);
  for (const text of ['只想查看 / 備份', '我要新增 / 編輯材料', '不需要先把專案複製到電腦', 'GitHub Desktop Clone', 'src/data/materials.json', '下載的獨立 JSON 不會自動與 GitHub Repository 綁定', '不是用來直接 Push 到 GitHub', '真正的本機 Git Repository', '開啟 GitHub Repository']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('https://github.com/ayay2270/CAE-Material-Library-V2-Preview'));
  assert.ok(html.includes('noopener noreferrer'));
  assert.equal(html.includes('npm run dev'), false);
  assert.equal(html.includes('Git 追蹤檔案'), false);
});

test('help separates one-time setup, post-edit upload and daily use with accurate status meanings', () => {
  const html = ui.help(true);
  const setup = html.split('aria-label="第一次使用這台電腦"')[1].split('</section>')[0];
  const upload = html.split('aria-label="修改完成後"')[1].split('</section>')[0];
  const daily = html.split('aria-label="之後每次使用"')[1].split('</section>')[0];
  assert.ok(html.includes('Clone = 把 GitHub 上的專案複製到你的電腦，並保留與 GitHub 的版本同步關係。'));
  for (const text of ['登入 GitHub 帳號', 'File → Clone repository', 'ayay2270/CAE-Material-Library-V2-Preview', 'C:\\Users\\你的帳號\\Documents\\GitHub\\', '└─ src', '└─ data', '└─ materials.json', '連結本機資料庫', '允許網站讀取與寫入', '✓ 已連結']) assert.ok(setup.includes(text), text);
  assert.equal((setup.match(/<li>/g) || []).length, 9);
  let position = -1;
  for (const text of ['Save Database', '✓ 儲存成功', '還沒有上傳到 GitHub', 'Changes', 'src/data/materials.json', 'Summary', 'Update material database', 'Commit to main', 'Push origin', '檢查 GitHub 同步', '✓ 已同步至 GitHub', '✓ 線上版已更新', '其他電腦重新整理網站後']) {
    const next = upload.indexOf(text);
    assert.ok(next > position, 'upload order: ' + text);
    position = next;
  }
  assert.equal((upload.match(/<li>/g) || []).length, 11);
  const dailySteps = daily.split('<ol')[1];
  assert.equal(dailySteps.includes('Clone'), false);
  position = -1;
  for (const text of ['Fetch / Pull', '開啟 CAE Material Library', '新增／編輯材料', 'Save Database', 'GitHub Desktop Commit', 'Push origin', '檢查 GitHub 同步']) {
    const next = dailySteps.indexOf(text);
    assert.ok(next > position, 'daily order: ' + text);
    position = next;
  }
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
