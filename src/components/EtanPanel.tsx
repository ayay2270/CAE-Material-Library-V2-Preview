import type { Material } from '../types';
import { SolverPlasticityResults } from './SolverPlasticityResults';

export function EtanPanel({ material }: { material: Material }) {
  // Keep the existing stored field; it contains supplied H, not LS-DYNA ETAN.
  return <SolverPlasticityResults inputs={material} providedH={material.etan} density={material.density} poissonRatio={material.poissonRatio} />;
}
