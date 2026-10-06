import { useMemo, useState } from 'react';
import { useIndexes } from '../lib/indexes';
import type { Category, Material, MaterialInput, SourceFileKind } from '../types';
import { PROPS } from '../lib/props';
import { MAX_NAME, MAX_SOURCE_FILES, MAX_URL, SOURCE_KINDS, guessKind, newFileId, normalizeSourceFiles, webHref } from '../lib/sourceFiles';
import { Modal } from './Modal';
import { CloseIcon, PlusIcon } from './icons';

interface Props {
  initial: Material | null; // null = new material
  existing: Material[];
  onSave: (input: MaterialInput) => void;
  onClose: () => void;
}

const RULES: Partial<Record<(typeof PROPS)[number]['key'], { min?: number; max?: number; positive?: boolean }>> = {
  density: { positive: true },
  youngsModulus: { positive: true },
  poissonRatio: { min: 0, max: 0.5 },
  yieldStress: { positive: true },
  etan: { min: 0 },
  ultimateStress: { positive: true },
  elongation: { min: 0 },
};

const toText = (v: number | null) => (v === null ? '' : String(v));

/** One editable row of 來源檔案. `kindSet` stops the automatic Excel/PDF guess once the user picked a type. */
interface FileRow { id: string; kind: SourceFileKind; name: string; url: string; kindSet: boolean }

export function MaterialForm({ initial, existing, onSave, onClose }: Props) {
  const indexes = useIndexes();
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'Metal');
  const [source, setSource] = useState(initial?.source ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(PROPS.map((p) => [p.key, toText(initial?.[p.key] ?? null)])),
  );
  const [files, setFiles] = useState<FileRow[]>(() => (initial?.sourceFiles ?? []).map((f) => ({ ...f, kindSet: true })));
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const patchFile = (id: string, patch: Partial<FileRow>) => setFiles((rows) => rows.map((r) => {
    if (r.id !== id) return r;
    const next = { ...r, ...patch };
    // Until the user chooses a type, follow the extension of the name or link (.xlsx → Excel, .pdf → PDF).
    if (!next.kindSet && ('name' in patch || 'url' in patch)) next.kind = guessKind(next.name) ?? guessKind(next.url) ?? 'other';
    return next;
  }));
  const addFile = () => {
    const id = newFileId();
    setFiles((rows) => [...rows, { id, kind: 'other', name: '', url: '', kindSet: false }]);
    setJustAdded(id);
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (!n) e.name = '請輸入材料名稱。';
    else if (existing.some((m) => m.id !== initial?.id && m.name.toLowerCase() === n.toLowerCase()))
      e.name = '已有相同名稱的材料。';
    for (const p of PROPS) {
      const raw = vals[p.key].trim();
      if (raw === '') continue;
      const num = Number(raw);
      const r = RULES[p.key];
      if (!Number.isFinite(num)) e[p.key] = '請輸入數字（例如 2.82E-9）。';
      else if (r?.positive && num <= 0) e[p.key] = '必須大於 0。';
      else if (r?.min !== undefined && num < r.min) e[p.key] = `必須 ≥ ${r.min}。`;
      else if (r?.max !== undefined && num > r.max) e[p.key] = `必須 ≤ ${r.max}。`;
    }
    return e;
  }, [name, vals, existing, initial]);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const input: MaterialInput = {
      name: name.trim(),
      category,
      source: source.trim(),
      notes: notes.trim(),
      sourceFiles: normalizeSourceFiles(files),
      density: null,
      youngsModulus: null,
      poissonRatio: null,
      yieldStress: null,
      etan: null,
      ultimateStress: null,
      elongation: null,
    };
    for (const p of PROPS) {
      const raw = vals[p.key].trim();
      input[p.key] = raw === '' ? null : Number(raw);
    }
    onSave(input);
  };

  const err = (k: string) => (submitted || touchedHint(k)) && errors[k];
  // Live-validate property fields only once the user typed something.
  const touchedHint = (k: string) => k !== 'name' && vals[k]?.trim() !== '';

  return (
    <Modal
      title={initial ? `編輯 ${initial.name}` : '新增材料'}
      width={600}
      onClose={onClose}
      footer={
        <>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={submit}>{initial ? '儲存變更' : '新增'}</button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="form-row two">
          <label className={err('name') ? 'invalid' : ''}>
            <span>Material Name *</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 SUS304 1/2H" />
            {err('name') && <em>{errors.name}</em>}
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {indexes.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend>性質 <small>（未知請留空，將顯示為「—」，不會存成 0）</small></legend>
          <div className="form-grid">
            {PROPS.map((p) => (
              <label key={p.key} className={err(p.key) ? 'invalid' : ''}>
                <span>
                  {p.label}
                  <small> {p.unit !== '—' ? `(${p.unit})` : ''}{p.optional ? ' · optional' : ''}</small>
                </span>
                <input
                  inputMode="decimal"
                  value={vals[p.key]}
                  onChange={(e) => setVals({ ...vals, [p.key]: e.target.value })}
                  placeholder="—"
                />
                {err(p.key) && <em>{errors[p.key]}</em>}
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          <span>Source</span>
          <input list="material-source-options" value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：供應商資料表、網路、提供者姓名" />
          <datalist id="material-source-options">{indexes.sources.map(s => <option key={s} value={s}/>)}</datalist>
        </label>
        <fieldset className="file-fieldset">
          <legend>來源檔案 <small>（Excel / PDF 等來源文件的連結或路徑，可加入多筆）</small></legend>
          {files.length === 0 && <p className="form-hint">沒有來源文件可略過。有的話按下方「加入來源檔案」。</p>}
          {files.map((f, i) => (
            <div className="file-row" key={f.id}>
              <select aria-label={`來源檔案 ${i + 1} 類型`} value={f.kind} onChange={(e) => patchFile(f.id, { kind: e.target.value as SourceFileKind, kindSet: true })}>
                {SOURCE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <input aria-label={`來源檔案 ${i + 1} 名稱`} value={f.name} maxLength={MAX_NAME} autoFocus={f.id === justAdded}
                onChange={(e) => patchFile(f.id, { name: e.target.value })} placeholder="顯示名稱，例如 EPE 96 材料測試報告.pdf" />
              <button type="button" className="icon-btn danger" aria-label={`移除來源檔案 ${i + 1}`} title="移除" onClick={() => setFiles((rows) => rows.filter((r) => r.id !== f.id))}><CloseIcon /></button>
              <input className="file-url" aria-label={`來源檔案 ${i + 1} 連結或路徑`} value={f.url} maxLength={MAX_URL} spellCheck={false}
                onChange={(e) => patchFile(f.id, { url: e.target.value })} placeholder="https://… 連結，或 \\伺服器\資料夾\檔案.xlsx" />
              {f.url.trim() !== '' && webHref(f.url) === null && <p className="form-hint file-note">不是 http(s) 連結：瀏覽器無法直接開啟，詳細頁會提供「複製路徑」。</p>}
            </div>
          ))}
          <button type="button" className="btn small-btn" onClick={addFile} disabled={files.length >= MAX_SOURCE_FILES}><PlusIcon /> 加入來源檔案</button>
        </fieldset>
        <label>
          <span>備註</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="試驗條件、熱處理狀態、參考連結…" />
        </label>
        <p className="form-hint">數值以 mm–t–N–s 單位制儲存（密度 t/mm³、應力 MPa）。</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
