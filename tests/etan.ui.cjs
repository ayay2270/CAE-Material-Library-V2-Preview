const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/CAE-Material-Library-V2-Preview/');
    await page.locator('.materials-page tbody tr').filter({ has: page.getByText('SGCC', { exact: true }) }).click();
    const drawer = page.locator('.drawer .dialog');
    const result = page.getByTestId('etan-auto-result');
    const panel = page.getByRole('region', { name: 'ETAN — Auto Calculation' });
    assert.equal(await result.textContent(), '740.07 MPa');
    assert.equal(await panel.locator('input').count(), 0);
    assert.equal(await panel.locator('details').count(), 0);
    // Preserve full curve points while calculating and editing the estimate.
    await drawer.getByRole('tab', { name: '材料曲線' }).click();
    await drawer.getByRole('button', { name: '加入完整曲線' }).click();
    await drawer.locator('textarea').first().fill('0,0\n0.00125,250\n0.4,356');
    await drawer.getByRole('button', { name: '儲存完整曲線' }).click();
    await drawer.getByRole('button', { name: '編輯完整曲線' }).waitFor();
    await drawer.getByRole('tab', { name: '基本性質' }).click();
    assert.equal(await result.textContent(), '740.07 MPa');
    const edit = async values => {
      await drawer.getByRole('button', { name: '編輯', exact: true }).click();
      const form = page.getByRole('dialog', { name: '編輯 SGCC' });
      for (const [label, value] of Object.entries(values)) await form.getByLabel(new RegExp(`^${label}`)).fill(value);
      await form.getByRole('button', { name: '儲存變更', exact: true }).click();
      await result.waitFor();
    };
    await edit({ Elongation: '50' });
    assert.notEqual(await result.textContent(), '740.07 MPa');
    assert.equal(await drawer.locator('.prop-grid > div').filter({ has: page.locator('dt', { hasText: /^ETAN/ }) }).locator('dd').textContent(), '740.06MPa');
    await drawer.getByRole('tab', { name: '材料曲線' }).click();
    await drawer.getByRole('button', { name: '編輯完整曲線' }).click();
    assert.equal(await drawer.locator('textarea').first().inputValue(), '0,0\n0.00125,250\n0.4,356');
    await drawer.getByRole('button', { name: '取消曲線編輯' }).click();
    await drawer.getByRole('tab', { name: '基本性質' }).click();
    await edit({ 'Ultimate Stress': '' });
    assert.equal(await result.textContent(), 'ETAN unavailable');
    assert.ok((await panel.textContent()).includes('are required.'));
    assert.equal(await panel.locator('details').count(), 0);
    await edit({ 'Ultimate Stress': '200' });
    assert.equal(await result.textContent(), 'ETAN unavailable');
    await edit({ 'Ultimate Stress': '356', Elongation: '40' });
    assert.equal(await result.textContent(), '740.07 MPa');
    for (const [width, height] of [[375, 812], [667, 375], [768, 900]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'etan-properties-mobile.png'), fullPage: true });
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: 'ETAN 計算' }).click();
    await page.locator('.etan-pick select').selectOption('seed-7');
    assert.equal(await page.getByTestId('etan-result').textContent(), '740.07');
    const details = page.locator('.etan-page details');
    assert.equal(await details.getAttribute('open'), null);
    await details.getByText('Show calculation details', { exact: true }).click();
    assert.notEqual(await details.getAttribute('open'), null);
    for (const expected of ['0.400000', '250.313 MPa', '498.400 MPa', 'Formula Reference']) {
      assert.ok((await details.textContent()).includes(expected));
    }
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'etan-page-expanded.png'), fullPage: true });
    await page.locator('.etan-inputs input').nth(3).fill('50');
    assert.ok((await details.textContent()).includes('0.500000'));
    await page.locator('.etan-inputs input').nth(3).fill('');
    assert.ok((await details.textContent()).includes('Enter valid material values'));
    assert.equal(await details.locator('.etan-auto-steps').count(), 0);
    await page.locator('.etan-inputs input').nth(3).fill('40');
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('.etan-card').evaluate(el => el.scrollWidth > el.clientWidth), false);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await details.getByText('Hide calculation details', { exact: true }).click();
    assert.equal(await details.getAttribute('open'), null);
    await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: '材料庫', exact: true }).click();
    await page.locator('.materials-page tbody tr').filter({ has: page.getByText('ChipSet', { exact: true }) }).click();
    assert.equal(await result.textContent(), 'ETAN unavailable');
    assert.deepEqual(errors, []);
    console.log('PASS: SGCC Properties, percentage steps, collapse/expand, auto-update on edit, missing/inconsistent inputs, stored ETAN and full curve preservation, mobile layouts, existing ETAN page.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
