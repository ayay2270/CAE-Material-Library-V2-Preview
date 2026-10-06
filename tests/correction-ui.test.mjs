import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Render the real components in production mode; reuse existing tooling/dependencies.
const result = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { App } from './src/App';
    import { SolverPlasticityResults } from './src/components/SolverPlasticityResults';
    import { ImportExportDialog } from './src/components/Dialogs';
    import { MaterialDrawer } from './src/components/MaterialDrawer';
    import { LocalEditingDialog } from './src/components/LocalEditingDialog';
    export { requestLocalEditing } from './src/lib/localEditing';
    export const library = () => renderToStaticMarkup(<App />);
    export const solver = (inputs, providedH) => renderToStaticMarkup(<SolverPlasticityResults inputs={inputs} providedH={providedH} />);
    export const imports = (database, editable) => renderToStaticMarkup(<ImportExportDialog editable={editable} database={database} materials={database.materials} visibleRows={database.materials} onImport={()=>({added:0,updated:0,unchanged:0})} onReset={()=>{}} onRecover={()=>{}} onLegacy={()=>{}} onReadOnly={()=>{}} onClose={()=>{}} />);
    export const drawer = material => renderToStaticMarkup(<MaterialDrawer editable={false} material={material} units={{density:'t/mm3',stress:'MPa'}} onClose={()=>{}} onEdit={()=>{}} onDelete={()=>{}} onSaveCurve={()=>null} />);
    export const guidance = () => renderToStaticMarkup(<LocalEditingDialog onClose={()=>{}} />);
  `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl' },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"', 'process.env.NODE_ENV': '"production"' },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;
const database = JSON.parse(await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8'));
const sgcc = database.materials.find(material => material.name === 'SGCC');

test('real SGCC renders stored H, calculated reference, full substituted steps and correct ETAN source', () => {
  const html = ui.solver(sgcc, sgcc.etan);
  for (const text of ['Stored H', '740.06 MPa', 'Calculated H Estimate', '740.07 MPa', '737.33 MPa', 'H source: Stored H', 'Engineering strains', 'True stresses', 'True strains', 'Calculated H — Existing bilinear estimate', '250 × (1 + 0.00125)', '356 × (1 + 0.4)', 'ln(1 + 0.00125)', 'ln(1 + 0.4)', '498.4 − 250.3125', 'Calculated H is reference only.']) assert.ok(html.includes(text), text);
});

test('no stored H renders calculated active H and its conversion source; invalid estimate explains missing inputs', () => {
  const html = ui.solver(sgcc, null);
  assert.ok(html.includes('H source: Calculated H'));
  assert.ok(html.includes('active H because Stored H is unavailable'));
  assert.ok(html.includes('740.07 MPa'));
  assert.ok(html.includes('737.34 MPa'));
  const incomplete = ui.solver({ ...sgcc, elongation: null }, sgcc.etan);
  assert.ok(incomplete.includes('Calculated H unavailable'));
  assert.ok(incomplete.includes('737.33 MPa'));
});

test('production library, detail and import dialog retain visible Add/Edit/Delete/Import controls', () => {
  const html = ui.library();
  for (const text of ['新增材料', '編輯 SGCC', '刪除 SGCC', 'Local editing only', 'Actions']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Save Database</button>'));
  const imports = ui.imports(database, false);
  assert.ok(imports.includes('選擇 CSV 檔案'));
  assert.ok(!imports.includes('type="file"'), 'production must not present an upload input');
  const drawer = ui.drawer(sgcc);
  assert.ok(drawer.includes('> 編輯</button>'));
  assert.ok(drawer.includes('> 刪除</button>'));
  assert.ok(ui.imports(database, true).includes('data-testid="csv-input"'), 'local import retains the file input');
});

test('production editing requests only show guidance, leave database unchanged and perform no mutation', () => {
  const before = JSON.stringify(database);
  let guidanceCount = 0;
  for (const action of ['add', 'edit', 'delete', 'import']) {
    ui.requestLocalEditing(false, () => { database.materials.splice(0); assert.fail(`${action} must not run`); }, () => guidanceCount++);
  }
  assert.equal(guidanceCount, 4);
  assert.equal(JSON.stringify(database), before);
  const html = ui.guidance();
  for (const text of ['This GitHub Pages version is read-only.', 'npm run dev', 'Save Database', 'src/data/materials.json', 'Then commit and push']) assert.ok(html.includes(text), text);
});

test('ready local editor executes editing and CSV import actions without read-only guidance', () => {
  let calls = 0;
  for (const action of ['add', 'edit', 'delete', 'import']) {
    ui.requestLocalEditing(true, () => calls++, () => assert.fail(`${action} must be available locally`));
  }
  assert.equal(calls, 4);
});
