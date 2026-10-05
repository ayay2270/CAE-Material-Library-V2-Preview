import { useMemo, useState } from 'react';
import type { Material } from '../types';
import { calcEtan } from '../lib/etan';
import type { EtanInputs } from '../lib/etan';
import { formatValue } from '../lib/format';
import { EtanCalculationDetails } from './EtanCalculationDetails';

interface Props {
  materials: Material[];
}

type Field = keyof EtanInputs;
const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: 'youngsModulus', label: "Young's Modulus", unit: 'MPa' },
  { key: 'yieldStress', label: 'Yield Stress', unit: 'MPa' },
  { key: 'ultimateStress', label: 'Ultimate Stress', unit: 'MPa' },
  { key: 'elongation', label: 'Elongation', unit: '%' },
];

const toText = (v: number | null) => (v === null ? '' : String(v));

/** Existing ETAN workspace page; uses the same bilinear estimate as material Properties. */
export function EtanPage({ materials }: Props) {
  const [matId, setMatId] = useState<string>('');
  const [vals, setVals] = useState<Record<Field, string>>({ youngsModulus: '', yieldStress: '', ultimateStress: '', elongation: '' });

  const material = materials.find((m) => m.id === matId) ?? null;

  const pick = (id: string) => {
    setMatId(id);
    const m = materials.find((x) => x.id === id);
    setVals(
      m
        ? { youngsModulus: toText(m.youngsModulus), yieldStress: toText(m.yieldStress), ultimateStress: toText(m.ultimateStress), elongation: toText(m.elongation) }
        : { youngsModulus: '', yieldStress: '', ultimateStress: '', elongation: '' },
    );
  };

  const inputs: EtanInputs = useMemo(() => {
    const n = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : null);
    return { youngsModulus: n(vals.youngsModulus), yieldStress: n(vals.yieldStress), ultimateStress: n(vals.ultimateStress), elongation: n(vals.elongation) };
  }, [vals]);

  const result = calcEtan(inputs);

  return (
    <main className="page etan-page">
      <div className="page-head">
        <h1>ETAN 算法</h1>
        <span className="page-sub">由工程應力／應變資料估算雙線性 ETAN；Elongation 以 % 輸入。</span>
      </div>

      <div className="etan-card">
        <label className="etan-pick">
          <span>選擇材料</span>
          <select value={matId} onChange={(e) => pick(e.target.value)}>
            <option value="">— 手動輸入 —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <div className="etan-inputs">
          {FIELDS.map((f) => (
            <label key={f.key}>
              <span>
                {f.label} <small className="muted">({f.unit})</small>
              </span>
              <input inputMode="decimal" value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} placeholder="—" />
            </label>
          ))}
        </div>

        <div className="etan-result" role="status">
          <div>
            <span className="muted small">Calculated ETAN (Bilinear Estimate) · MPa</span>
            <b data-testid="etan-result">{result === null ? '—' : result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>
          {result === null && <p className="etan-note">ETAN unavailable. Enter valid positive values with UTS ≥ Yield Stress and ultimate strain greater than yield strain.</p>}
          {material && (
            <div className="etan-stored">
              <span className="muted small">資料庫中儲存的 ETAN</span>
              <b>{formatValue('etan', material.etan)}</b>
              <span className="muted small">MPa</span>
            </div>
          )}
        </div>
        <EtanCalculationDetails inputs={inputs} />
      </div>
    </main>
  );
}
