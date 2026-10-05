import { calcEtanDetails } from '../lib/etan';
import type { Material } from '../types';
import { InfoIcon } from './icons';
import './EtanPanel.css';

const INPUTS = [
  { key: 'youngsModulus', label: "Young's Modulus (E)", unit: 'MPa' },
  { key: 'yieldStress', label: 'Yield Stress (σy)', unit: 'MPa' },
  { key: 'ultimateStress', label: 'Ultimate Stress (σu)', unit: 'MPa' },
  { key: 'elongation', label: 'Elongation', unit: '%' },
] as const;

export function EtanPanel({ material: m }: { material: Material }) {
  const result = calcEtanDetails(m);
  const missing = INPUTS.some(({ key }) => m[key] == null);

  return (
    <section className="etan-auto" aria-label="ETAN — Auto Calculation">
      <h3>ETAN — Auto Calculation <InfoIcon size={15} /></h3>
      <div className="etan-auto-top">
        <div className="etan-auto-result" role="status" aria-live="polite">
          <span>Calculated ETAN (Bilinear Estimate)</span>
          {result
            ? <strong data-testid="etan-auto-result">{result.etan.toFixed(2)} <small>MPa</small></strong>
            : <strong className="etan-auto-unavailable" data-testid="etan-auto-result">ETAN unavailable</strong>}
        </div>
        <p className="etan-auto-description">Estimated from engineering data using yield point and UTS point. Suitable for bilinear approximation.</p>
      </div>
      {result ? (
        <p className="etan-auto-note"><InfoIcon size={15} /><span>ETAN uses engineering-to-true stress/strain conversion. Elongation (%) is divided by 100.</span></p>
      ) : (
        <p className="etan-auto-note">{missing
          ? "Young's Modulus, Yield Stress, Ultimate Stress and Elongation are required."
          : 'Check material values: positive inputs, UTS ≥ Yield Stress and ultimate strain greater than yield strain are required.'}</p>
      )}
      <table className="etan-auto-inputs" aria-label="ETAN source properties">
        <tbody>
          {INPUTS.map(({ key, label, unit }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{m[key] !== null && Number.isFinite(m[key]) ? String(m[key]) : '—'}</td>
              <td>{unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </section>
  );
}
