import { useState } from 'react';
import type { Material, SourceFile, StressStrainData } from '../types';
import { useIndexes } from '../lib/indexes';
import { PROPS } from '../lib/props';
import { formatDateLong, formatValue, unitFor } from '../lib/format';
import { SOURCE_KINDS, webHref } from '../lib/sourceFiles';
import type { UnitPrefs } from '../lib/format';
import { Modal } from './Modal';
import { StressStrainSection } from './StressStrainSection';
import { EtanPanel } from './EtanPanel';
import { EditIcon, TrashIcon } from './icons';

interface Props {
  material: Material;
  units: UnitPrefs;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveCurve: (data: StressStrainData) => string | null;
}

type Tab = 'props' | 'curve' | 'source' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'props', label: '基本性質' },
  { id: 'curve', label: '材料曲線' },
  { id: 'source', label: '來源與備註' },
  { id: 'history', label: '歷史記錄' },
];

const ACTION_LABEL = { created: '建立', edited: '編輯', imported: '匯入' } as const;

/** One source document: a web link opens in a new tab; any other path can only be copied. */
function SourceFileItem({ file }: { file: SourceFile }) {
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');
  const href = webHref(file.url);
  const kind = SOURCE_KINDS.find((k) => k.id === file.kind) ?? SOURCE_KINDS[2];
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopy('done');
    } catch {
      setCopy('failed'); // the path stays selectable so it can be copied by hand
    }
    window.setTimeout(() => setCopy('idle'), 2500);
  };
  return (
    <li className="src-file">
      <span className={`src-kind ${file.kind}`} title={kind.label}>{kind.short}</span>
      <span className="src-main">
        {href
          ? <a className="src-name" href={href} target="_blank" rel="noopener noreferrer">{file.name || href}<span className="sr-only">（在新分頁開啟）</span></a>
          : <span className="src-name">{file.name || file.url}</span>}
        {file.url && file.url !== file.name && <code className="src-url">{file.url}</code>}
      </span>
      {file.url && (
        <button type="button" className="btn small-btn" onClick={copyText} aria-live="polite">
          {copy === 'done' ? '已複製' : copy === 'failed' ? '請手動選取複製' : href ? '複製連結' : '複製路徑'}
        </button>
      )}
    </li>
  );
}

export function MaterialDrawer({ material: m, units, onClose, onEdit, onDelete, onSaveCurve }: Props) {
  const indexes = useIndexes();
  const [tab, setTab] = useState<Tab>('props');

  return (
    <Modal
      variant="drawer"
      width={540}
      onClose={onClose}
      title={
        <span className="drawer-title">
          {m.name} <span className="cat-tag">{indexes.label(m.category)}</span>
        </span>
      }
      footer={
        <>
          <button className="btn danger-outline" onClick={onDelete}>
            <TrashIcon /> 刪除
          </button>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>關閉</button>
          <button className="btn primary" onClick={onEdit}>
            <EditIcon /> 編輯
          </button>
        </>
      }
    >
      <div className="tabs" role="tablist" aria-label="材料詳細資料">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'props' && (
          <>
          <dl className="prop-grid">
            {PROPS.map((p) => {
              const v = m[p.key];
              return (
                <div key={p.key} className={v === null ? 'missing' : ''}>
                  <dt>
                    {p.label}
                    {p.optional && <small className="muted"> (optional)</small>}
                  </dt>
                  <dd>
                    {formatValue(p.key, v, units)}
                    {v !== null && unitFor(p, units) !== '—' && <small>{unitFor(p, units)}</small>}
                  </dd>
                </div>
              );
            })}
          </dl>
          <EtanPanel key={m.id} material={m} />
          </>
        )}

        {tab === 'curve' && <StressStrainSection key={m.id} material={m} units={units} onSave={onSaveCurve} />}

        {tab === 'source' && (
          <dl className="meta-grid">
            <dt>Source</dt>
            <dd>{m.source || <span className="muted">—</span>}</dd>
            <dt>來源檔案</dt>
            <dd>
              {m.sourceFiles && m.sourceFiles.length > 0
                ? <ul className="src-files">{m.sourceFiles.map((f) => <SourceFileItem key={f.id} file={f} />)}</ul>
                : <><span className="muted">—</span> <button type="button" className="link-btn" onClick={onEdit}>加入 Excel / PDF 來源</button></>}
            </dd>
            <dt>Updated</dt>
            <dd>{formatDateLong(m.updatedAt)}</dd>
            <dt>備註</dt>
            <dd className="notes">{m.notes || <span className="muted">無備註</span>}</dd>
          </dl>
        )}

        {tab === 'history' && (
          <ol className="history">
            {m.history.map((h, i) => (
              <li key={i}>
                <time>{formatDateLong(h.at)}</time>
                <span className={`h-action ${h.action}`}>{ACTION_LABEL[h.action]}</span>
                <span className="h-sum">{h.summary}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
