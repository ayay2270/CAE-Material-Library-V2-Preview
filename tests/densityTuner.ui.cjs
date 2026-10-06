// Run against npm run dev. Set PLAYWRIGHT_MODULE to an installed Playwright path if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/CAE-Material-Library-V2-Preview/');
    const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
    const tool = page.getByRole('navigation', { name: 'Engineering Tools' }).getByRole('button', { name: 'Density Tuner' });
    const rows = page.locator('.materials-page tbody tr');
    const initialCount = await rows.count();
    assert.equal(initialCount, 11);
    const search = page.getByRole('searchbox');
    await search.fill('ADC12');
    assert.equal(await rows.count(), 1);
    await tool.click();
    assert.equal(await tool.getAttribute('aria-current'), 'page');
    assert.equal(await page.getByTestId('recommended-density').textContent(), '4.453E-8');
    assert.equal(await page.getByTestId('density-scale-factor').count(), 0);
    assert.equal(await page.getByTestId('expected-mass').textContent(), '3.130 kg');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByText('Copied.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '4.453E-8');
    const quantity = page.getByLabel('Quantity', { exact: true });
    assert.equal(await quantity.inputValue(), '1');
    await quantity.fill('2');
    assert.equal(await page.getByTestId('recommended-density').textContent(), '8.906E-8');
    assert.equal(await page.getByTestId('expected-mass').textContent(), '6.260 kg');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByText('Copied.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '8.906E-8');
    for (const bad of ['', '0', '-1', '1.5', 'bad']) {
      await quantity.fill(bad);
      assert.equal(await quantity.getAttribute('aria-invalid'), 'true');
      assert.equal(await page.getByTestId('recommended-density').textContent(), '—');
      assert.equal(await page.getByRole('button', { name: 'Copy', exact: true }).isDisabled(), true);
    }
    await quantity.fill('1');
    const input = page.getByLabel('Current Density', { exact: true });
    for (const field of ['Current Density', 'Current Mass', 'Target Mass']) {
      const control = page.getByLabel(field, { exact: true });
      const original = await control.inputValue();
      for (const bad of ['', '0', '-1', '1E-', 'bad']) {
        await control.fill(bad);
        assert.equal(await control.getAttribute('aria-invalid'), 'true');
        assert.equal(await page.getByTestId('recommended-density').textContent(), '—');
        assert.equal(await page.getByRole('button', { name: 'Copy', exact: true }).isDisabled(), true);
        assert.equal(await page.getByText('Enter a valid positive value.', { exact: true }).count(), 1);
      }
      await control.fill(original);
    }
    await page.getByLabel('Target Mass unit').selectOption('g');
    await page.getByLabel('Target Mass', { exact: true }).fill('3130');
    assert.equal(await page.getByTestId('recommended-density').textContent(), '4.453E-8');
    assert.equal(await page.getByTestId('expected-mass').textContent(), '3130.000 g');
    await page.getByLabel('Target Mass unit').selectOption('ton');
    await page.getByLabel('Target Mass', { exact: true }).fill('0.00313');
    assert.equal(await page.getByTestId('recommended-density').textContent(), '4.453E-8');
    assert.equal(await page.getByTestId('expected-mass').textContent(), '0.003 ton');
    await page.getByLabel('Current Mass unit').selectOption('kg');
    await page.getByLabel('Current Mass', { exact: true }).fill('0.0602');
    assert.equal(await page.getByTestId('recommended-density').textContent(), '4.453E-8');
    await page.getByLabel('Current Mass unit').selectOption('ton');
    await page.getByLabel('Current Mass', { exact: true }).fill('6.02E-5');
    await page.getByLabel('Target Mass unit').selectOption('kg');
    await page.getByLabel('Target Mass', { exact: true }).fill('3.13');
    const sampleStyle = await tool.evaluate(el => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.padding, s.gap, s.borderRadius]; });
    const workspaceStyle = await nav.getByRole('button', { name: 'ETAN 計算' }).evaluate(el => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.padding, s.gap, s.borderRadius]; });
    assert.deepEqual(sampleStyle, workspaceStyle);
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'density-tuner-desktop.png'), fullPage: true });
    for (const width of [375, 667, 768]) {
      await page.setViewportSize({ width, height: width === 667 ? 375 : 900 });
      assert.ok(await input.isVisible());
      const bounds = await page.locator('.density-tuner-panel').boundingBox();
      assert.ok(bounds.x + bounds.width <= width + 1);
      const overflow = await page.locator('.density-tuner-panel').evaluate(el => el.scrollWidth > el.clientWidth);
      assert.equal(overflow, false, `overflow at ${width}px`);
    }
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'density-tuner-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await nav.getByRole('button', { name: '材料庫', exact: true }).click();
    assert.equal(await search.inputValue(), 'ADC12');
    await search.fill('');
    assert.equal(await rows.count(), initialCount);
    await page.getByRole('button', { name: '卡片', exact: true }).click();
    assert.equal(await page.locator('.material-card').count(), initialCount);
    await page.getByRole('button', { name: '表格', exact: true }).click();
    const selectors = page.locator('.materials-page tbody input[type=checkbox]');
    await selectors.nth(0).check();
    await selectors.nth(1).check();
    await tool.click();
    await nav.getByRole('button', { name: /材料比較/ }).click();
    assert.equal(await page.getByTestId('compare-table').isVisible(), true);
    assert.equal(await page.locator('.compare-wrap').getAttribute('data-count'), '2');
    await nav.getByRole('button', { name: 'Material Map', exact: true }).click();
    assert.equal(await page.getByTestId('map-svg').isVisible(), true);
    await nav.getByRole('button', { name: 'ETAN 計算', exact: true }).click();
    assert.equal(await page.getByTestId('hardening-h-result').isVisible(), true);
    assert.equal(await page.getByTestId('tangent-etan-result').isVisible(), true);
    await page.getByRole('button', { name: '新增材料', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '新增材料', exact: true });
    await dialog.getByLabel('Material Name *', { exact: true }).fill('Density Tuner regression sample');
    await dialog.getByRole('button', { name: '新增', exact: true }).click();
    await nav.getByRole('button', { name: '材料庫', exact: true }).click();
    assert.equal(await rows.count(), initialCount + 1);
    await page.reload();
    assert.equal(await rows.count(), initialCount + 1);
    assert.deepEqual(errors, []);
    console.log('PASS: preset, clipboard, 15 invalid inputs, unit changes, sidebar style, responsive layout, search state, table/cards, compare, map, ETAN, add material and persistence.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
