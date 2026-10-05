/**
 * Bilinear ETAN estimate from engineering yield and UTS points.
 * Stress is stored in MPa; elongation is stored as a percentage.
 */
export interface EtanInputs {
  youngsModulus: number | null; // MPa
  yieldStress: number | null; // MPa
  ultimateStress: number | null; // MPa
  elongation: number | null; // %
}

export const ETAN_FORMULA_READY = true;

/** Shared full-precision intermediates for the result and its calculation details. */
export function calcEtanDetails(inputs: EtanInputs) {
  const { youngsModulus: E, yieldStress: sy, ultimateStress: su, elongation } = inputs;
  if (E == null || sy == null || su == null || elongation == null) return null;
  if (![E, sy, su, elongation].every(n => Number.isFinite(n) && n > 0) || su < sy) return null;

  const eyEng = sy / E;
  const euEng = elongation / 100;
  const syTrue = sy * (1 + eyEng);
  const suTrue = su * (1 + euEng);
  const eyTrue = Math.log1p(eyEng);
  const euTrue = Math.log1p(euEng);
  const deltaStrain = euTrue - eyTrue;
  const deltaStress = suTrue - syTrue;
  if (![eyEng, euEng, syTrue, suTrue, eyTrue, euTrue, deltaStrain, deltaStress].every(Number.isFinite)
    || deltaStrain <= 0 || deltaStress < 0) return null;

  const etan = deltaStress / deltaStrain;
  if (!Number.isFinite(etan)) return null;
  return { eyEng, euEng, syTrue, suTrue, eyTrue, euTrue, deltaStrain, deltaStress, etan };
}

export function calcEtan(inputs: EtanInputs): number | null {
  return calcEtanDetails(inputs)?.etan ?? null;
}
