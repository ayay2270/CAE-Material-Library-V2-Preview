import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Bundle the real TS modules using Vite's existing tooling, without adding dependencies.
async function loadModule(relativePath) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { hToEtan, etanToH, solverPlasticityParameters } = await loadModule('../src/lib/solverPlasticity.ts');
const { csvToMaterials, toCsv } = await loadModule('../src/lib/csv.ts');
const sgcc = { youngsModulus: 200000, yieldStress: 250, ultimateStress: 356, elongation: 40 };

test('calculated H and every original intermediate remain available with authoritative stored H', () => {
  const material = Object.freeze({ ...sgcc, etan: 740.06 });
  const result = solverPlasticityParameters(material, material.etan);
  assert.equal(result.hardeningSlopeH, material.etan);
  assert.equal(result.tangentModulusEtan.toFixed(2), '737.33');
  assert.equal(result.calculatedH.toFixed(2), '740.07');
  assert.notEqual(result.calculatedH, result.hardeningSlopeH);
  assert.deepEqual(result.calculatedHDetails, {
    eyEng: 250 / 200000, euEng: 40 / 100,
    syTrue: 250 * (1 + 250 / 200000), suTrue: 356 * (1 + 40 / 100),
    eyTrue: Math.log1p(250 / 200000), euTrue: Math.log1p(40 / 100),
    deltaStrain: Math.log1p(40 / 100) - Math.log1p(250 / 200000),
    deltaStress: 356 * (1 + 40 / 100) - 250 * (1 + 250 / 200000),
    hardeningSlopeH: (356 * (1 + 40 / 100) - 250 * (1 + 250 / 200000)) / (Math.log1p(40 / 100) - Math.log1p(250 / 200000)),
  });
  assert.equal(material.etan, 740.06);
});

test('missing stored H activates the full precision calculated H; incomplete estimate never replaces stored H', () => {
  const result = solverPlasticityParameters(sgcc);
  assert.equal(result.hardeningSlopeH, result.calculatedH);
  assert.equal(result.tangentModulusEtan, hToEtan(sgcc.youngsModulus, result.calculatedH));
  const incomplete = solverPlasticityParameters({ ...sgcc, elongation: null }, 740.06);
  assert.equal(incomplete.calculatedH, null);
  assert.equal(incomplete.calculatedHDetails, null);
  assert.equal(incomplete.hardeningSlopeH, 740.06);
  assert.equal(incomplete.tangentModulusEtan.toFixed(2), '737.33');
});

test('E = 200000 MPa, supplied H = 740.06 MPa converts to ETAN = 737.33 MPa', () => {
  const tangentModulusEtan = hToEtan(200000, 740.06);
  assert.equal(tangentModulusEtan.toFixed(2), '737.33');
  assert.ok(Math.abs(tangentModulusEtan - 737.33) < 0.005);
  assert.notEqual(tangentModulusEtan, 740.06);
  assert.equal(solverPlasticityParameters(sgcc, 740.06).hardeningSlopeH, 740.06);
});

test('reverse conversion and round trips retain H with normal rounding tolerance', () => {
  assert.equal(etanToH(200000, 737.33).toFixed(2), '740.06');
  for (const [youngsModulus, hardeningSlopeH] of [[200000, 740.06], [71000, 8002.05], [500, 1000], [200000, 0]]) {
    assert.ok(Math.abs(etanToH(youngsModulus, hToEtan(youngsModulus, hardeningSlopeH)) - hardeningSlopeH) < 1E-8);
  }
});

test('zero hardening is valid and large finite inputs do not overflow the H → ETAN calculation', () => {
  assert.equal(hToEtan(200000, 0), 0);
  assert.equal(etanToH(200000, 0), 0);
  assert.equal(hToEtan(1E308, 1E308), 5E307);
});

test('invalid, nonfinite, nonnumeric and out-of-domain conversion inputs return null', () => {
  for (const invalid of [NaN, Infinity, -Infinity, null, undefined, '', '200000', true, {}]) {
    assert.equal(hToEtan(invalid, 740.06), null);
    assert.equal(hToEtan(200000, invalid), null);
    assert.equal(etanToH(invalid, 737.33), null);
    assert.equal(etanToH(200000, invalid), null);
  }
  for (const youngsModulus of [0, -1]) {
    assert.equal(hToEtan(youngsModulus, 740.06), null);
    assert.equal(etanToH(youngsModulus, 737.33), null);
  }
  assert.equal(hToEtan(200000, -1), null);
  for (const tangentModulusEtan of [-1, 200000, 200001]) assert.equal(etanToH(200000, tangentModulusEtan), null);
  assert.equal(etanToH(1E308, 9.99E307), null); // Result outside the finite range.
});

test('supplied H takes precedence without silently replacing invalid H; fallback preserves the upstream model', () => {
  const inputs = { ...sgcc };
  const provided = solverPlasticityParameters(inputs, 740.06);
  assert.equal(provided.hardeningSource, 'provided');
  assert.equal(provided.hardeningSlopeH, 740.06);
  assert.equal(provided.tangentModulusEtan.toFixed(2), '737.33');
  assert.equal(solverPlasticityParameters({ ...inputs, ultimateStress: null }, 740.06).tangentModulusEtan.toFixed(2), '737.33');
  const estimated = solverPlasticityParameters(inputs);
  assert.equal(estimated.hardeningSource, 'estimated');
  assert.ok(Math.abs(estimated.hardeningSlopeH - 740.0670218197076) < 1E-9);
  for (const providedH of [-1, NaN, Infinity, '740.06']) {
    assert.equal(solverPlasticityParameters(inputs, providedH).hardeningSlopeH, null);
    assert.equal(solverPlasticityParameters(inputs, providedH).tangentModulusEtan, null);
  }
  assert.equal(solverPlasticityParameters({ ...inputs, youngsModulus: 0 }, 740.06).tangentModulusEtan, null);
  assert.equal(solverPlasticityParameters({ ...inputs, ultimateStress: null }).hardeningSlopeH, null);
  assert.deepEqual(inputs, sgcc);
});

test('correct H CSV labels round-trip and former ETAN headers preserve existing supplied H', () => {
  const material = { ...sgcc, name: 'SGCC', category: 'Metal', density: 7.82E-9, poissonRatio: 0.3, etan: 740.06, source: 'Web', notes: '', updatedAt: '2026-10-05', history: [], id: 'test' };
  const current = toCsv([material]);
  assert.ok(current.includes('H (MATS1) H (MPa)'));
  for (const text of [current, current.replace('H (MATS1) H (MPa)', 'ETAN Et (MPa)')]) {
    const imported = csvToMaterials(text);
    assert.deepEqual(imported.errors, []);
    assert.equal(imported.rows[0].etan, 740.06);
    assert.equal(imported.rows[0].yieldStress, 250);
  }
});
