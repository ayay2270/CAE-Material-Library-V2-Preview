// Run against npm run dev. Set PLAYWRIGHT_MODULE to an installed Playwright path if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const URL = 'http://127.0.0.1:5173/CAE-Material-Library-V2-Preview/';
const WEB = 'https://contoso.sharepoint.com/sites/cae/EPE96_Bromake.xlsx';
const PATH = '\\\\fileserver\\CAE\\EPE\\Bromake test report.pdf';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL);
    const rows = page.locator('.materials-page tbody tr');
    assert.equal(await rows.count(), 11);

    const openDetail = async (name) => { await rows.filter({ hasText: name }).first().click(); await page.getByRole('tab', { name: '來源與備註' }).click(); };
    const panel = () => page.getByRole('tabpanel');

    // A record without files: nothing changes visually except a quick way to add one.
    await openDetail('ADC12');
    await panel().getByText('來源檔案', { exact: true }).waitFor();
    assert.equal(await panel().locator('.src-file').count(), 0);
    await panel().getByRole('button', { name: '加入 Excel / PDF 來源' }).click();

    // Form: rows are added, the type follows the extension, empty rows are dropped.
    const form = page.getByRole('dialog', { name: /編輯 ADC12/ });
    await form.getByRole('button', { name: '加入來源檔案' }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '來源檔案 1 名稱');
    await form.getByLabel('來源檔案 1 連結或路徑').fill(WEB);
    assert.equal(await form.getByLabel('來源檔案 1 類型').inputValue(), 'excel');
    await form.getByRole('button', { name: '加入來源檔案' }).click();
    await form.getByLabel('來源檔案 2 名稱').fill('Bromake 測試報告.pdf');
    assert.equal(await form.getByLabel('來源檔案 2 類型').inputValue(), 'pdf');
    await form.getByLabel('來源檔案 2 連結或路徑').fill(PATH);
    await form.getByText('不是 http(s) 連結', { exact: false }).waitFor();
    await form.getByRole('button', { name: '加入來源檔案' }).click(); // left empty on purpose
    await form.getByRole('button', { name: '儲存變更' }).click();
    await page.getByRole('tab', { name: '來源與備註' }).click();

    // Detail: web link opens in a new tab, a network path is text with a copy button.
    const items = panel().locator('.src-file');
    assert.equal(await items.count(), 2);
    const link = items.nth(0).getByRole('link');
    assert.equal(await link.textContent().then((t) => t.replace('（在新分頁開啟）', '')), 'EPE96_Bromake.xlsx');
    assert.equal(await link.getAttribute('href'), WEB);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal((await items.nth(0).locator('.src-kind').textContent()).trim(), 'XLS');
    assert.equal(await items.nth(1).getByRole('link').count(), 0);
    assert.equal((await items.nth(1).locator('.src-kind').textContent()).trim(), 'PDF');
    await items.nth(1).getByRole('button', { name: '複製路徑' }).click();
    await items.nth(1).getByRole('button', { name: '已複製' }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), PATH);
    await items.nth(0).getByRole('button', { name: '複製連結' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), WEB);

    // History records the change; the data survives a reload.
    await page.getByRole('tab', { name: '歷史記錄' }).click();
    assert.match(await page.locator('.history li').first().textContent(), /來源檔案/);
    await page.reload();
    await openDetail('ADC12');
    assert.equal(await panel().locator('.src-file').count(), 2);
    await page.getByRole('button', { name: '關閉', exact: true }).click();

    // CSV backup carries the files and restores them on import.
    await page.getByRole('button', { name: /匯入 \/ 匯出/ }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /匯出全部/ }).click()]);
    const csvPath = await download.path();
    const csv = fs.readFileSync(csvPath, 'utf8');
    assert.match(csv.split(/\r?\n/)[0], /Source Files JSON$/);
    assert.ok(csv.includes('Bromake test report.pdf'));
    assert.equal((csv.match(/EPE96_Bromake\.xlsx/g) || []).length >= 1, true);
    await page.keyboard.press('Escape');

    await openDetail('ADC12');
    await page.getByRole('button', { name: '編輯', exact: true }).click();
    const edit = page.getByRole('dialog', { name: /編輯 ADC12/ });
    await edit.getByRole('button', { name: '移除來源檔案 1' }).click();
    await edit.getByRole('button', { name: '移除來源檔案 1' }).click();
    await edit.getByRole('button', { name: '儲存變更' }).click();
    await page.getByRole('tab', { name: '來源與備註' }).click();
    assert.equal(await panel().locator('.src-file').count(), 0);
    await page.getByRole('button', { name: '關閉', exact: true }).click();

    await page.getByRole('button', { name: /匯入 \/ 匯出/ }).click();
    await page.getByTestId('csv-input').setInputFiles(csvPath);
    await page.getByRole('status').getByText(/已匯入 11 列/).waitFor();
    await page.keyboard.press('Escape');
    await openDetail('ADC12');
    assert.equal(await panel().locator('.src-file').count(), 2);
    await page.getByRole('button', { name: '關閉', exact: true }).click();

    // Older backups (no Source Files JSON column) must not wipe existing files.
    const header = csv.split(/\r?\n/)[0].replace(/,Source Files JSON$/, '');
    const legacyCsv = [header, 'ADC12,Metal,,,,,,,,,,2026-01-01T00:00:00Z,'].join('\r\n');
    fs.writeFileSync(csvPath + '.legacy.csv', '﻿' + legacyCsv + '\r\n');
    await page.getByRole('button', { name: /匯入 \/ 匯出/ }).click();
    await page.getByTestId('csv-input').setInputFiles(csvPath + '.legacy.csv');
    await page.getByRole('status').getByText(/已匯入/).waitFor();
    await page.keyboard.press('Escape');
    await openDetail('ADC12');
    assert.equal(await panel().locator('.src-file').count(), 2, 'a CSV without the column keeps existing source files');

    assert.deepEqual(errors, []);
    console.log('sourceFiles.ui: all checks passed');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
