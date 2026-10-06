import { calcHardeningSlope } from './etan';
import type { HardeningInputs } from './etan';

/** OptiStruct MATS1 H → LS-DYNA MAT_003 ETAN. All moduli are in MPa. */
export function hToEtan(youngsModulus: number, hardeningSlopeH: number): number | null {
  if (!Number.isFinite(youngsModulus) || !Number.isFinite(hardeningSlopeH)
    || youngsModulus <= 0 || hardeningSlopeH < 0) return null;
  // Algebraically E * H / (E + H), without overflowing the product or sum.
  const tangentModulusEtan = hardeningSlopeH <= youngsModulus
    ? hardeningSlopeH / (1 + hardeningSlopeH / youngsModulus)
    : youngsModulus / (1 + youngsModulus / hardeningSlopeH);
  return Number.isFinite(tangentModulusEtan) ? tangentModulusEtan : null;
}

/** LS-DYNA MAT_003 ETAN → OptiStruct MATS1 H. Requires 0 ≤ ETAN < E. */
export function etanToH(youngsModulus: number, tangentModulusEtan: number): number | null {
  if (!Number.isFinite(youngsModulus) || !Number.isFinite(tangentModulusEtan)
    || youngsModulus <= 0 || tangentModulusEtan < 0 || tangentModulusEtan >= youngsModulus) return null;
  const hardeningSlopeH = tangentModulusEtan / (1 - tangentModulusEtan / youngsModulus);
  return Number.isFinite(hardeningSlopeH) ? hardeningSlopeH : null;
}

/** Prefer the existing supplied H; estimate only when it is absent. Never persist ETAN over H. */
export function solverPlasticityParameters(inputs: HardeningInputs, providedH: number | null = null) {
  const hardeningSource = providedH == null ? 'estimated' : 'provided';
  const candidateH = providedH == null ? calcHardeningSlope(inputs) : providedH;
  const hardeningSlopeH = candidateH != null && Number.isFinite(candidateH) && candidateH >= 0 ? candidateH : null;
  const tangentModulusEtan = hardeningSlopeH != null && inputs.youngsModulus != null
    ? hToEtan(inputs.youngsModulus, hardeningSlopeH) : null;
  return { hardeningSlopeH, tangentModulusEtan, hardeningSource };
}
