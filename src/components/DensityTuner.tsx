import { useState } from 'react';
import { calculateDensity, formatDensity, parsePositiveValue } from '../lib/densityTuner';
import type { MassUnit } from '../lib/densityTuner';
import './DensityTuner.css';

const FIELDS = [
  { key: 'density', label: 'Current Density' },
  { key: 'currentMass', label: 'Current Mass' },
  { key: 'targetMass', label: 'Target Mass' },
] as const;
const MASS_UNITS: MassUnit[] = ['ton', 'kg', 'g'];

export function DensityTuner() {
  const [values, setValues] = useState({ density: '8.565E-10', currentMass: '6.02E-5', targetMass: '3.13' });
  const [currentUnit, setCurrentUnit] = useState<MassUnit>('ton');
  const [targetUnit, setTargetUnit] = useState<MassUnit>('kg');
  const [copyStatus, setCopyStatus] = useState('');
  const density = parsePositiveValue(values.density);
  const currentMass = parsePositiveValue(values.currentMass);
  const targetMass = parsePositiveValue(values.targetMass);
  const valid = density !== null && currentMass !== null && targetMass !== null;
  const result = valid ? calculateDensity(density, currentMass, currentUnit, targetMass, targetUnit) : null;
  const recommended = result ? formatDensity(result.density) : '';

  const copy = async () => {
    if (!recommended) return;
    try {
      await navigator.clipboard.writeText(recommended);
      setCopyStatus('Copied.');
    } catch {
      setCopyStatus('Unable to copy. Select the density and copy manually.');
    }
  };

  return (
    <main className="page density-tuner-page">
      <div className="page-head">
        <h1>Density Tuner</h1>
        <span className="page-sub">Tune material density to achieve a target mass while keeping geometry unchanged.</span>
      </div>
      <div className="density-tuner-panel">
        <div className="density-tuner-inputs">
          {FIELDS.map(({ key, label }) => {
            const invalid = parsePositiveValue(values[key]) === null;
            return (
              <div className="density-tuner-field" key={key}>
                <label htmlFor={`density-tuner-${key}`}>{label}</label>
                <div className="density-tuner-control">
                  <input
                    id={`density-tuner-${key}`}
                    type="text"
                    spellCheck={false}
                    value={values[key]}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `density-tuner-${key}-error` : undefined}
                    onChange={(e) => {
                      setValues({ ...values, [key]: e.target.value });
                      setCopyStatus('');
                    }}
                  />
                  {key !== 'density' && (
                    <select
                      aria-label={`${label} unit`}
                      value={key === 'currentMass' ? currentUnit : targetUnit}
                      onChange={(e) => {
                        const unit = e.target.value as MassUnit;
                        if (key === 'currentMass') setCurrentUnit(unit);
                        else setTargetUnit(unit);
                        setCopyStatus('');
                      }}
                    >
                      {MASS_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  )}
                </div>
                {invalid && <span className="density-tuner-error" id={`density-tuner-${key}-error`}>Enter a valid positive value.</span>}
              </div>
            );
          })}
        </div>
        <div className="density-tuner-results" role="status" aria-live="polite" aria-atomic="true">
          <div className="density-tuner-recommended">
            <span>Recommended Density</span>
            <div className="density-tuner-copy-row">
              <b data-testid="recommended-density">{recommended || '—'}</b>
              <button type="button" className="btn" disabled={!result} onClick={copy}>Copy</button>
            </div>
          </div>
          <div className="density-tuner-expected">
            <span>Expected Mass</span>
            <b data-testid="expected-mass">{result ? `${result.expectedMass.toFixed(3)} ${targetUnit}` : '—'}</b>
          </div>
        </div>
        {valid && !result && <p className="density-tuner-error" role="status">Values are outside the supported calculation range.</p>}
        {copyStatus && <p className="density-tuner-copy-status" role="status">{copyStatus}</p>}
        <p className="density-tuner-formula">New Density = Current Density × Target Mass / Current Mass</p>
      </div>
    </main>
  );
}
