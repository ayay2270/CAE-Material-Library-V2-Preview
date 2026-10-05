export type MassUnit = 'ton' | 'kg' | 'g';

// Metric mass units, normalized to kg before taking the ratio.
const KG_PER_UNIT: Record<MassUnit, number> = { ton: 1000, kg: 1, g: 0.001 };
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function parsePositiveValue(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function calculateDensity(
  currentDensity: number,
  currentMass: number,
  currentUnit: MassUnit,
  targetMass: number,
  targetUnit: MassUnit,
  quantity = 1,
) {
  if (![currentDensity, currentMass, targetMass].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;
  const currentKg = currentMass * KG_PER_UNIT[currentUnit];
  const targetKg = targetMass * quantity * KG_PER_UNIT[targetUnit];
  const scaleFactor = targetKg / currentKg;
  const density = currentDensity * scaleFactor;
  const expectedMass = currentMass * (density / currentDensity)
    * (KG_PER_UNIT[currentUnit] / KG_PER_UNIT[targetUnit]);
  if (![currentKg, targetKg, scaleFactor, density, expectedMass].every((n) => Number.isFinite(n) && n > 0)) return null;
  return { density, scaleFactor, expectedMass };
}

export const formatDensity = (value: number) => value.toExponential(3).replace(/e\+?/, 'E');
