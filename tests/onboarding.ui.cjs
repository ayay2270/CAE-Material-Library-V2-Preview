// Run against a production preview; file picker and GitHub responses are isolated fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');

(async () => {
  const deployed = JSON.parse(await fs.readFile(path.join(__dirname, '../src/data/materials.json'), 'utf8'));
  const { canonicalJson } = await import(pathToFileURL(path.join(__dirname, '../src/lib/database-schema.mjs')));
  let remote = structuredClone(deployed);
  const local = structuredClone(deployed);
  local.materials.find(material => material.name === 'SGCC').notes = 'Linked file fixture';
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(database => {
      const key = 'onboarding-test-file';
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(database));
      const handle = {
        kind: 'file', name: 'materials.json',
        async queryPermission() { return 'granted'; },
        async requestPermission() {
          sessionStorage.setItem('permission-prompts', String(Number(sessionStorage.getItem('permission-prompts') || 0) + 1));
          return 'granted';
        },
        async getFile() { return new File([sessionStorage.getItem(key)], 'materials.json'); },
        async createWritable() {
          let pending;
          return {
            async write(text) { pending = text; },
            async close() { sessionStorage.setItem(key, pending); },
            async abort() {},
          };
        },
      };
      window.showOpenFilePicker = async () => [handle];
      // A test-only store retains the fake handle across reloads without cloning its functions.
      Object.defineProperty(window, 'indexedDB', { value: {
        open() {
          const request = {};
          request.result = {
            close() {},
            transaction() {
              const tx = { objectStore: () => ({
                get: () => ({ result: sessionStorage.getItem('remembered-file') ? handle : undefined }),
                put: () => { sessionStorage.setItem('remembered-file', 'yes'); return { result: undefined }; },
                delete: () => { sessionStorage.removeItem('remembered-file'); return { result: undefined }; },
              }) };
              setTimeout(() => tx.oncomplete?.(), 0);
              return tx;
            },
          };
          setTimeout(() => request.onsuccess?.(), 0);
          return request;
        },
      } });
    }, local);
    await page.route('https://api.github.com/repos/ayay2270/CAE-Material-Library-V2-Preview/**', route => {
      assert.equal(route.request().method(), 'GET');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
        route.request().url().includes('/commits/main') ? { sha: 'a'.repeat(40) } : remote) });
    });
    await page.route('**/database-version.json?*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        schemaVersion: 1, databaseSha256: createHash('sha256').update(canonicalJson(remote)).digest('hex'),
      }),
    }));
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4174/CAE-Material-Library-V2-Preview/');
    const status = page.getByRole('region', { name: '資料庫狀態', exact: true });
    await status.getByText('第一次使用？', { exact: true }).waitFor();
    const download = async button => {
      const pending = page.waitForEvent('download');
      await button.click();
      const file = await pending;
      assert.equal(file.suggestedFilename(), 'CAE-Material-Library-materials.json');
      assert.deepEqual(JSON.parse(await fs.readFile(await file.path(), 'utf8')), deployed);
    };
    await download(status.getByRole('button', { name: '下載目前材料資料庫 JSON', exact: true }));
    await page.screenshot({ path: path.join(os.tmpdir(), 'database-onboarding-desktop.png'), fullPage: true });
    await status.getByRole('button', { name: '第一次使用 / 如何開始', exact: true }).click();
    const help = page.getByRole('dialog', { name: '第一次使用 / 如何開始', exact: true });
    await help.getByRole('region', { name: '只想查看 / 備份' }).waitFor();
    assert.equal(await help.getByRole('link', { name: '開啟 GitHub Repository' }).getAttribute('href'),
      'https://github.com/ayay2270/CAE-Material-Library-V2-Preview');
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await help.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'database-onboarding-help-mobile.png'), fullPage: true });
    await help.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('.database-status-menu > summary').click();
    const box = await status.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 812);
    await page.screenshot({ path: path.join(os.tmpdir(), 'database-onboarding-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await status.getByRole('button', { name: '連結本機資料庫', exact: true }).click();
    await page.getByRole('button', { name: 'Save Database', exact: true }).waitFor();
    assert.equal(await page.getByText('第一次使用？', { exact: true }).count(), 0);
    await page.locator('.database-status-menu > summary').click();
    await status.getByText('尚未同步', { exact: false }).waitFor();
    await status.getByRole('button', { name: '使用說明', exact: true }).click();
    await download(help.getByRole('button', { name: '下載目前材料資料庫 JSON', exact: true }));
    await help.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('.materials-page tbody tr').filter({ has: page.getByText('SGCC', { exact: true }) }).click();
    const drawer = page.locator('.drawer .dialog');
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    const form = page.getByRole('dialog', { name: '編輯 SGCC', exact: true });
    await form.waitFor();
    await form.locator('textarea').fill('Saved onboarding fixture');
    await form.getByRole('button', { name: '儲存變更', exact: true }).click();
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Save Database', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('onboarding-test-file')).materials.find(m => m.name === 'SGCC').notes === 'Saved onboarding fixture');
    remote = await page.evaluate(() => JSON.parse(sessionStorage.getItem('onboarding-test-file')));
    await page.locator('.database-status-menu > summary').click();
    await status.locator('dd').filter({ hasText: /^✓ 已儲存/ }).waitFor();
    await status.getByRole('button', { name: '檢查 GitHub 同步', exact: true }).click();
    await status.locator('dd').filter({ hasText: /^✓ 已同步至 GitHub/ }).waitFor();
    await status.getByText('✓ 線上版已更新（資料庫一致）', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Save Database', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('permission-prompts')), '1');
    assert.equal(await page.getByText('第一次使用？', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile onboarding, full deployed JSON download, linked-file edit/save, read-only sync/deployment and handle restore (isolated browser fixtures).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
