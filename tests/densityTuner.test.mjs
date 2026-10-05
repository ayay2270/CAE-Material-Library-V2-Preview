import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDensity, formatDensity, parsePositiveValue } from '../src/lib/densityTuner.ts';

test('example calculation and reverse check use full precision', () => {
  const result = calculateDensity(8.565E-10, 6.02E-5, 'ton', 3.13, 'kg');
  assert.ok(result);
  assert.equal(formatDensity(result.density), '4.453E-8');
  assert.equal(result.scaleFactor.toFixed(3), '51.993');
  assert.equal(result.expectedMass.toFixed(3), '3.130');
  assert.ok(Math.abs(result.density - 4.453230897009967E-8) < 1E-20);
});

test('all mass unit pairs agree for equivalent physical masses', () => {
  const current = { ton: 0.002, kg: 2, g: 2000 };
  const target = { ton: 0.001, kg: 1, g: 1000 };
  for (const currentUnit of Object.keys(current)) {
    for (const targetUnit of Object.keys(target)) {
      const result = calculateDensity(1.2E-9, current[currentUnit], currentUnit, target[targetUnit], targetUnit);
      assert.ok(result);
      assert.equal(result.scaleFactor, 0.5);
      assert.equal(result.density, 6E-10);
      assert.equal(result.expectedMass, target[targetUnit]);
    }
  }
  assert.equal(calculateDensity(1E-9, 2, 'kg', 2, 'kg').scaleFactor, 1);
});

test('decimal and scientific notation are parsed strictly', () => {
  for (const raw of ['8.565E-10', '4.45E-8', '1.2e-9', '3.13', '.5', '+1E+2', ' 2 ']) {
    assert.equal(parsePositiveValue(raw), Number(raw));
  }
  for (const raw of ['', ' ', '0', '-1', '1E', '1E-', '1E--9', '1.2.3', '1kg', 'Infinity', 'NaN', '0x10', '1E309', '1E-999']) {
    assert.equal(parsePositiveValue(raw), null, raw);
  }
});

test('nonpositive inputs and unrepresentable calculations cannot produce results', () => {
  for (const value of [0, -1, NaN, Infinity]) {
    assert.equal(calculateDensity(value, 1, 'kg', 1, 'kg'), null);
    assert.equal(calculateDensity(1, value, 'kg', 1, 'kg'), null);
    assert.equal(calculateDensity(1, 1, 'kg', value, 'kg'), null);
  }
  assert.equal(calculateDensity(1E308, 1, 'kg', 10, 'kg'), null);
  assert.equal(calculateDensity(1E-300, 1E300, 'kg', 1E-300, 'kg'), null);
});

test('quantity multiplies total target mass and validates whole-number counts', () => {
  const result = calculateDensity(8.565E-10, 6.02E-5, 'ton', 3.13, 'kg', 2);
  assert.equal(formatDensity(result.density), '8.906E-8');
  assert.equal(result.expectedMass.toFixed(3), '6.260');
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 1E20]) {
    assert.equal(calculateDensity(1E-9, 1, 'kg', 1, 'kg', quantity), null);
  }
});
