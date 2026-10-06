import test from 'node:test';
import assert from 'node:assert/strict';
import { calcHardeningSlope, calcHardeningSlopeDetails } from '../src/lib/etan.ts';

const sgcc = { youngsModulus: 200000, yieldStress: 250, ultimateStress: 356, elongation: 40 };

test('SGCC, Nylon 66 and Copper agree with reference values', () => {
  for (const [inputs, expected] of [
    [sgcc, '740.07'],
    [{ youngsModulus: 3300, yieldStress: 83.36, ultimateStress: 83.36, elongation: 2.7 }, '85.54'],
    [{ youngsModulus: 110000, yieldStress: 33.3, ultimateStress: 210, elongation: 60 }, '644.43'],
  ]) assert.equal(calcHardeningSlope(inputs).toFixed(2), expected);
});

test('percentage conversion and full-precision calculation details', () => {
  const d = calcHardeningSlopeDetails(sgcc);
  assert.equal(d.euEng, 0.4);
  assert.equal(d.eyEng, 0.00125);
  assert.equal(d.syTrue.toFixed(3), '250.313');
  assert.equal(d.suTrue.toFixed(3), '498.400');
  assert.equal(d.eyTrue.toFixed(6), '0.001249');
  assert.equal(d.euTrue.toFixed(6), '0.336472');
  assert.ok(Math.abs(d.hardeningSlopeH - 740.0670218197076) < 1E-9);
  assert.equal(calcHardeningSlope(sgcc), d.hardeningSlopeH);
});

test('missing, nonpositive and nonfinite inputs produce no result', () => {
  for (const key of Object.keys(sgcc)) {
    for (const value of [null, undefined, 0, -1, NaN, Infinity, -Infinity]) {
      assert.equal(calcHardeningSlope({ ...sgcc, [key]: value }), null, `${key}: ${value}`);
    }
  }
});

test('inconsistent stress/strain points and numerical overflow produce no result', () => {
  assert.equal(calcHardeningSlope({ ...sgcc, ultimateStress: 249 }), null);
  assert.equal(calcHardeningSlope({ ...sgcc, elongation: 0.125 }), null);
  assert.equal(calcHardeningSlope({ ...sgcc, elongation: 0.1 }), null);
  assert.equal(calcHardeningSlope({ ...sgcc, youngsModulus: 1E-320 }), null);
  assert.equal(calcHardeningSlope({ ...sgcc, ultimateStress: 1E308, elongation: 1E308 }), null);
});
