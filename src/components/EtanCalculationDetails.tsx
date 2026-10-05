import type { ReactNode } from 'react';
import { calcEtanDetails } from '../lib/etan';
import type { EtanInputs } from '../lib/etan';
import './EtanPanel.css';

function Variable({ symbol, point, kind }: { symbol: string; point?: string; kind?: string }) {
  return <span className="etan-variable"><i>{symbol}</i>{point && <sub><i>{point}</i>{kind && <><span>, </span><span>{kind}</span></>}</sub>}</span>;
}

function Fraction({ numerator, denominator }: { numerator: ReactNode; denominator: ReactNode }) {
  return <span className="etan-fraction"><span>{numerator}</span><span>{denominator}</span></span>;
}

function Strain({ point, kind }: { point: string; kind: string }) {
  return <Variable symbol="ε" point={point} kind={kind} />;
}
function Stress({ point, kind }: { point: string; kind?: string }) {
  return <Variable symbol="σ" point={point} kind={kind} />;
}

function TrueStress({ point }: { point: string }) {
  return <><Stress point={point} kind="true" /> = <Stress point={point} /> (1 + <Strain point={point} kind="eng" />)</>;
}
function TrueStrain({ point }: { point: string }) {
  return <><Strain point={point} kind="true" /> = <span className="etan-math-function">ln</span>(1 + <Strain point={point} kind="eng" />)</>;
}
function EtanFormula() {
  return <>ETAN = <Fraction numerator={<><Stress point="u" kind="true" /> − <Stress point="y" kind="true" /></>} denominator={<><Strain point="u" kind="true" /> − <Strain point="y" kind="true" /></>} /></>;
}

export function EtanCalculationDetails({ inputs }: { inputs: EtanInputs }) {
  const result = calcEtanDetails(inputs);
  return (
    <details className="etan-auto-details">
      <summary><span className="etan-show-details">Show calculation details</span><span className="etan-hide-details">Hide calculation details</span></summary>
      <div className="etan-auto-details-body">
        <h4>ETAN Calculation Details</h4>
        {result ? <ol className="etan-auto-steps">
          <li>
            <h5>Engineering strains</h5>
            <div className="etan-equation"><Strain point="y" kind="eng" /> = <Fraction numerator={<Stress point="y" />} denominator={<Variable symbol="E" />} /> = <Fraction numerator={inputs.yieldStress} denominator={inputs.youngsModulus} /></div>
            <p className="etan-step-value">= {result.eyEng.toFixed(6)}</p>
            <div className="etan-equation"><Strain point="u" kind="eng" /> = <Fraction numerator="Elongation" denominator="100" /> = <Fraction numerator={inputs.elongation} denominator="100" /></div>
            <p className="etan-step-value">= {result.euEng.toFixed(6)}</p>
          </li>
          <li>
            <h5>True stresses</h5>
            <div className="etan-equation"><TrueStress point="y" /></div>
            <p className="etan-step-value">= {result.syTrue.toFixed(3)} MPa</p>
            <div className="etan-equation"><TrueStress point="u" /></div>
            <p className="etan-step-value">= {result.suTrue.toFixed(3)} MPa</p>
          </li>
          <li>
            <h5>True strains</h5>
            <div className="etan-equation"><TrueStrain point="y" /></div>
            <p className="etan-step-value">≈ {result.eyTrue.toFixed(6)}</p>
            <div className="etan-equation"><TrueStrain point="u" /></div>
            <p className="etan-step-value">≈ {result.euTrue.toFixed(6)}</p>
          </li>
          <li>
            <h5>ETAN (Bilinear Estimate)</h5>
            <div className="etan-equation"><EtanFormula /></div>
            <p className="etan-step-value">≈ {result.etan.toFixed(2)} MPa</p>
          </li>
        </ol> : <p>Enter valid material values to view the calculated steps.</p>}
        <div className="etan-auto-reference">
          <b>Formula Reference</b>
          <div className="etan-formula-list">
            <div className="etan-equation"><Strain point="y" kind="eng" /> = <Fraction numerator={<Stress point="y" />} denominator={<Variable symbol="E" />} /></div>
            <div className="etan-equation"><Strain point="u" kind="eng" /> = <Fraction numerator="Elongation" denominator="100" /></div>
            <div className="etan-equation"><TrueStress point="y" /></div>
            <div className="etan-equation"><TrueStress point="u" /></div>
            <div className="etan-equation"><TrueStrain point="y" /></div>
            <div className="etan-equation"><TrueStrain point="u" /></div>
            <div className="etan-equation"><EtanFormula /></div>
          </div>
          <p className="etan-formula-note">Elongation is stored in %. Calculation uses full precision.</p>
        </div>
      </div>
    </details>
  );
}
